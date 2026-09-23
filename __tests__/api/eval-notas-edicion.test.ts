/**
 * @jest-environment node
 */

// RUTA: __tests__/api/eval-notas-edicion.test.ts
//
// Auditoría 2026-09 — EVAL-020. Ejercita el HANDLER REAL de
// /api/evaluations/notes/[id]: una nota marcada pública por error ya se puede
// despublicar, editar o borrar (autor asignado o admin).

jest.mock('next/server', () => ({
  NextRequest: class {},
  NextResponse: {
    json: (data: unknown, options?: { status?: number }) => ({
      status: options?.status ?? 200,
      json: async () => data,
    }),
  },
}));

const mockPrisma = {
  application: { findUnique: jest.fn() },
  evaluationNote: { findUnique: jest.fn(), update: jest.fn(), deleteMany: jest.fn() },
};

jest.mock('@/lib/prisma', () => ({
  get prisma() {
    return mockPrisma;
  },
}));

const mockRequireRole = jest.fn();
jest.mock('@/lib/auth', () => ({
  requireRole: (...args: unknown[]) => mockRequireRole(...args),
}));

import type { NextRequest } from 'next/server';
import * as noteRoute from '@/app/api/evaluations/notes/[id]/route';

function session(id: number, role: string) {
  return { user: { id, role, email: `u${id}@test.com`, nombre: 'Ana', isActive: true } };
}

function req(body?: unknown): NextRequest {
  return {
    headers: { get: () => null },
    url: 'http://localhost/api/evaluations/notes/7',
    json: async () => body,
  } as unknown as NextRequest;
}

const ctx = (id: string) => ({ params: Promise.resolve({ id }) });

async function call(p: Promise<unknown>) {
  const res = (await p) as { status: number; json: () => Promise<any> };
  return { status: res.status, body: await res.json() };
}

/** Application con la forma de loadApplicationForAuth. */
function authApp(recruiterId: number | null, specialistId: number | null = null) {
  return {
    id: 50,
    status: 'evaluating',
    job: { userId: 900, assignment: { recruiterId, specialistId } },
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  mockPrisma.evaluationNote.findUnique.mockResolvedValue({ id: 7, authorId: 10, applicationId: 50 });
  mockPrisma.evaluationNote.update.mockImplementation(async ({ data }: any) => ({ id: 7, ...data }));
  mockPrisma.evaluationNote.deleteMany.mockResolvedValue({ count: 1 });
  mockPrisma.application.findUnique.mockResolvedValue(authApp(10));
});

describe('PATCH /api/evaluations/notes/[id]', () => {
  it('el autor asignado despublica su nota', async () => {
    mockRequireRole.mockResolvedValue(session(10, 'recruiter'));

    const res = await call(noteRoute.PATCH(req({ isPublic: false }), ctx('7')));

    expect(res.status).toBe(200);
    expect(mockPrisma.evaluationNote.update).toHaveBeenCalledWith({
      where: { id: 7 },
      data: { isPublic: false },
    });
  });

  it('edita el contenido recortado y sin comerse "<...>"', async () => {
    mockRequireRole.mockResolvedValue(session(10, 'recruiter'));

    await call(noteRoute.PATCH(req({ content: '  Domina List<String>  ' }), ctx('7')));

    expect(mockPrisma.evaluationNote.update).toHaveBeenCalledWith({
      where: { id: 7 },
      data: { content: 'Domina List<String>' },
    });
  });

  it('otro reclutador (no autor) recibe 403 y no se escribe nada', async () => {
    mockRequireRole.mockResolvedValue(session(11, 'recruiter'));
    mockPrisma.application.findUnique.mockResolvedValue(authApp(11));

    const res = await call(noteRoute.PATCH(req({ isPublic: false }), ctx('7')));

    expect(res.status).toBe(403);
    expect(mockPrisma.evaluationNote.update).not.toHaveBeenCalled();
  });

  it('el autor ya no asignado a la vacante recibe 403', async () => {
    mockRequireRole.mockResolvedValue(session(10, 'recruiter'));
    mockPrisma.application.findUnique.mockResolvedValue(authApp(99));

    const res = await call(noteRoute.PATCH(req({ isPublic: false }), ctx('7')));

    expect(res.status).toBe(403);
    expect(mockPrisma.evaluationNote.update).not.toHaveBeenCalled();
  });

  it('el admin puede despublicar cualquier nota', async () => {
    mockRequireRole.mockResolvedValue(session(1, 'admin'));

    const res = await call(noteRoute.PATCH(req({ isPublic: false }), ctx('7')));

    expect(res.status).toBe(200);
    expect(mockPrisma.evaluationNote.update).toHaveBeenCalled();
  });

  it('valida tipos: isPublic no booleano, content vacío o body vacío → 400', async () => {
    mockRequireRole.mockResolvedValue(session(10, 'recruiter'));

    expect((await call(noteRoute.PATCH(req({ isPublic: 'false' }), ctx('7')))).status).toBe(400);
    expect((await call(noteRoute.PATCH(req({ content: '   ' }), ctx('7')))).status).toBe(400);
    expect((await call(noteRoute.PATCH(req({}), ctx('7')))).status).toBe(400);
    expect((await call(noteRoute.PATCH(req({ content: 'x'.repeat(5001) }), ctx('7')))).status).toBe(400);
    expect(mockPrisma.evaluationNote.update).not.toHaveBeenCalled();
  });

  it('id no numérico → 400 sin consultar', async () => {
    mockRequireRole.mockResolvedValue(session(10, 'recruiter'));

    const res = await call(noteRoute.PATCH(req({ isPublic: false }), ctx('abc')));

    expect(res.status).toBe(400);
    expect(mockPrisma.evaluationNote.findUnique).not.toHaveBeenCalled();
  });

  it('nota inexistente → 404', async () => {
    mockRequireRole.mockResolvedValue(session(10, 'recruiter'));
    mockPrisma.evaluationNote.findUnique.mockResolvedValue(null);

    const res = await call(noteRoute.PATCH(req({ isPublic: false }), ctx('7')));

    expect(res.status).toBe(404);
  });

  it('usuario desactivado o sin rol: manda requireRole', async () => {
    mockRequireRole.mockResolvedValue({ error: 'Cuenta desactivada', status: 403 });

    const res = await call(noteRoute.PATCH(req({ isPublic: false }), ctx('7')));

    expect(res.status).toBe(403);
    expect(mockRequireRole).toHaveBeenCalledWith(['recruiter', 'specialist', 'admin']);
    expect(mockPrisma.evaluationNote.findUnique).not.toHaveBeenCalled();
  });
});

describe('DELETE /api/evaluations/notes/[id]', () => {
  it('el autor asignado borra su nota', async () => {
    mockRequireRole.mockResolvedValue(session(10, 'recruiter'));

    const res = await call(noteRoute.DELETE(req(), ctx('7')));

    expect(res.status).toBe(200);
    expect(mockPrisma.evaluationNote.deleteMany).toHaveBeenCalledWith({ where: { id: 7 } });
  });

  it('un especialista ajeno no puede borrar la nota del reclutador', async () => {
    mockRequireRole.mockResolvedValue(session(20, 'specialist'));
    mockPrisma.application.findUnique.mockResolvedValue(authApp(10, 20));

    const res = await call(noteRoute.DELETE(req(), ctx('7')));

    expect(res.status).toBe(403);
    expect(mockPrisma.evaluationNote.deleteMany).not.toHaveBeenCalled();
  });

  it('si otra pestaña ya la borró responde 404, no 500', async () => {
    mockRequireRole.mockResolvedValue(session(1, 'admin'));
    mockPrisma.evaluationNote.deleteMany.mockResolvedValue({ count: 0 });

    const res = await call(noteRoute.DELETE(req(), ctx('7')));

    expect(res.status).toBe(404);
  });
});
