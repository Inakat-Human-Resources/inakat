/**
 * @jest-environment node
 */

/**
 * Tests de seguridad para el bundle jobs-id-applications.
 *
 * #39 — PATCH /api/jobs/[id]: NO debe permitir activar/publicar una vacante GRATIS.
 *        Una empresa/owner que intenta pasar status a 'active' (p.ej. draft -> active)
 *        recibe 403 y debe usar el flujo de publicación que cobra créditos.
 *        Admin sí puede activar directamente.
 *
 * #48 — POST /api/applications: ruta pública. NUNCA debe confiar en body.userId
 *        (suplantación). Sin sesión -> userId null; con sesión -> id de la sesión.
 *
 * Se ejercitan los HANDLERS REALES (no se reimplementa la lógica).
 */

// Garantizar JWT_SECRET antes de cargar '@/lib/auth' (lo lee al inicializar el módulo).
process.env.JWT_SECRET =
  process.env.JWT_SECRET || 'test-secret-con-mas-de-treinta-y-dos-caracteres-123';

jest.mock('@/lib/prisma', () => ({
  prisma: {
    job: { findUnique: jest.fn(), update: jest.fn() },
    application: { findUnique: jest.fn(), findFirst: jest.fn(), create: jest.fn() },
  },
}));

jest.mock('next/headers', () => ({ cookies: jest.fn() }));

jest.mock('@/lib/notifications', () => ({
  notifyAllAdmins: jest.fn().mockResolvedValue(undefined),
}));

import { prisma } from '@/lib/prisma';
import { cookies } from 'next/headers';

type JobMock = { findUnique: jest.Mock; update: jest.Mock };
type AppMock = { findUnique: jest.Mock; findFirst: jest.Mock; create: jest.Mock };
const mockPrisma = prisma as unknown as { job: JobMock; application: AppMock };
const mockCookies = cookies as unknown as jest.Mock;

function setCookie(token?: string): void {
  mockCookies.mockResolvedValue({
    get: (name: string) =>
      name === 'auth-token' && token ? { value: token } : undefined,
  });
}

function makeReq(body: unknown): Request {
  return {
    headers: { get: (): string | null => null },
    json: async (): Promise<unknown> => body,
  } as unknown as Request;
}

function patchContext(id: string): { params: Promise<{ id: string }> } {
  return { params: Promise.resolve({ id }) };
}

describe('Seguridad bundle jobs-id-applications', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('#39 PATCH /api/jobs/[id] — no publicación gratis', () => {
    it('rechaza con 403 que una empresa active (draft -> active) sin cobrar créditos', async () => {
      const { generateToken } = await import('@/lib/auth');
      const token = generateToken({ userId: 5, email: 'empresa@test.com', role: 'company' });
      setCookie(token);

      mockPrisma.job.findUnique.mockResolvedValue({
        id: 10,
        userId: 5,
        status: 'draft',
        editableUntil: null,
      });

      const { PATCH } = await import('@/app/api/jobs/[id]/route');
      const res = await PATCH(makeReq({ status: 'active' }), patchContext('10'));

      expect(res.status).toBe(403);
      const body = await res.json();
      expect(body.success).toBe(false);
      expect(body.error).toMatch(/publicaci/i);
      // No se debe activar la vacante ni tocar la DB
      expect(mockPrisma.job.update).not.toHaveBeenCalled();
    });

    it('permite a un admin activar la vacante directamente', async () => {
      const { generateToken } = await import('@/lib/auth');
      const token = generateToken({ userId: 1, email: 'admin@test.com', role: 'admin' });
      setCookie(token);

      mockPrisma.job.findUnique.mockResolvedValue({
        id: 10,
        userId: 5,
        status: 'draft',
        editableUntil: null,
      });
      mockPrisma.job.update.mockResolvedValue({ id: 10, status: 'active' });

      const { PATCH } = await import('@/app/api/jobs/[id]/route');
      const res = await PATCH(makeReq({ status: 'active' }), patchContext('10'));

      expect(res.status).toBe(200);
      expect(mockPrisma.job.update).toHaveBeenCalledTimes(1);
      const updateArg = mockPrisma.job.update.mock.calls[0][0] as { data: { status?: string } };
      expect(updateArg.data.status).toBe('active');
    });

    it('permite a la empresa pausar su vacante activa (no toca activación)', async () => {
      const { generateToken } = await import('@/lib/auth');
      const token = generateToken({ userId: 5, email: 'empresa@test.com', role: 'company' });
      setCookie(token);

      mockPrisma.job.findUnique.mockResolvedValue({
        id: 10,
        userId: 5,
        status: 'active',
        editableUntil: null,
      });
      mockPrisma.job.update.mockResolvedValue({ id: 10, status: 'paused' });

      const { PATCH } = await import('@/app/api/jobs/[id]/route');
      const res = await PATCH(makeReq({ status: 'paused' }), patchContext('10'));

      expect(res.status).toBe(200);
      expect(mockPrisma.job.update).toHaveBeenCalledTimes(1);
    });

    it('permite a la empresa REANUDAR su vacante pausada (paused -> active, créditos ya pagados)', async () => {
      // Regresión: bloquear sólo draft->active. paused->active es reanudar una
      // vacante que ya pagó créditos y debe seguir funcionando para el owner.
      const { generateToken } = await import('@/lib/auth');
      const token = generateToken({ userId: 5, email: 'empresa@test.com', role: 'company' });
      setCookie(token);

      mockPrisma.job.findUnique.mockResolvedValue({
        id: 10,
        userId: 5,
        status: 'paused',
        editableUntil: null,
      });
      mockPrisma.job.update.mockResolvedValue({ id: 10, status: 'active' });

      const { PATCH } = await import('@/app/api/jobs/[id]/route');
      const res = await PATCH(makeReq({ status: 'active' }), patchContext('10'));

      expect(res.status).toBe(200);
      expect(mockPrisma.job.update).toHaveBeenCalledTimes(1);
      const updateArg = mockPrisma.job.update.mock.calls[0][0] as { data: { status?: string } };
      expect(updateArg.data.status).toBe('active');
    });
  });

  describe('#48 POST /api/applications — sin suplantación de userId', () => {
    it('ignora body.userId y deja userId null cuando no hay sesión', async () => {
      setCookie(undefined);

      mockPrisma.job.findUnique.mockResolvedValue({ id: 3, status: 'active', title: 'Dev' });
      mockPrisma.application.findFirst.mockResolvedValue(null);
      mockPrisma.application.create.mockResolvedValue({
        id: 1,
        job: { title: 'Dev', company: 'Acme' },
      });

      const { POST } = await import('@/app/api/applications/route');
      const res = await POST(
        makeReq({
          jobId: 3,
          userId: 999, // intento de suplantación
          candidateName: 'Anon',
          candidateEmail: 'anon@test.com',
        })
      );

      expect(res.status).toBe(201);
      expect(mockPrisma.application.create).toHaveBeenCalledTimes(1);
      const createArg = mockPrisma.application.create.mock.calls[0][0] as {
        data: { userId: number | null };
      };
      expect(createArg.data.userId).toBeNull();
    });

    it('usa el id de la sesión e ignora body.userId cuando hay sesión válida', async () => {
      const { generateToken } = await import('@/lib/auth');
      const token = generateToken({ userId: 7, email: 'cand@test.com', role: 'candidate' });
      setCookie(token);

      mockPrisma.job.findUnique.mockResolvedValue({ id: 3, status: 'active', title: 'Dev' });
      mockPrisma.application.findFirst.mockResolvedValue(null);
      mockPrisma.application.create.mockResolvedValue({
        id: 2,
        job: { title: 'Dev', company: 'Acme' },
      });

      const { POST } = await import('@/app/api/applications/route');
      const res = await POST(
        makeReq({
          jobId: 3,
          userId: 999, // intento de suplantación: debe ignorarse
          candidateName: 'Cand',
          candidateEmail: 'cand@test.com',
        })
      );

      expect(res.status).toBe(201);
      const createArg = mockPrisma.application.create.mock.calls[0][0] as {
        data: { userId: number | null };
      };
      expect(createArg.data.userId).toBe(7);
    });
  });
});
