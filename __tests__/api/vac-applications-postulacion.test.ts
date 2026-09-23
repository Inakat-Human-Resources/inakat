/**
 * @jest-environment node
 */
/**
 * VAC-012 / VAC-013 / VAC-014 / VAC-027 / VAC-036 — POST /api/applications.
 *
 *  - VAC-013: el arreglo #48 dejó de confiar en body.userId, pero el NOMBRE y
 *    el CORREO seguían viniendo del body aunque hubiera sesión. Como la
 *    unicidad se controla por (jobId, candidateEmail), quien llegara primero
 *    con el correo de otra persona le ocupaba el sitio en la vacante.
 *  - VAC-014: cvUrl se guardaba sin validar y varias vistas de admin lo pintan
 *    como `href` crudo.
 *  - VAC-012: el "¿ya existe?" y el create no son atómicos; además el duplicado
 *    respondía 400 donde el modal esperaba 409.
 *  - VAC-027: nadie comprobaba `expiresAt` al postular.
 *  - VAC-036: `parseInt(jobId)` llegaba como NaN a Prisma -> 500 en vez de 400.
 */

export {};

process.env.JWT_SECRET =
  process.env.JWT_SECRET || 'test-secret-con-mas-de-treinta-y-dos-caracteres-123';

jest.mock('@/lib/prisma', () => ({
  prisma: {
    job: { findUnique: jest.fn() },
    application: { findFirst: jest.fn(), create: jest.fn() },
    user: { findUnique: jest.fn() },
  },
}));

jest.mock('next/headers', () => ({ cookies: jest.fn() }));

jest.mock('@/lib/notifications', () => ({
  notifyAllAdmins: jest.fn().mockResolvedValue(undefined),
  // La ruta envía la notificación con runAfterResponse (EMP-009/EMP-013).
  runAfterResponse: jest.fn(async (_etiqueta: string, fn: () => Promise<unknown>) => {
    await fn();
  }),
}));

import { POST } from '@/app/api/applications/route';
import { prisma } from '@/lib/prisma';
import { cookies } from 'next/headers';
import { generateToken } from '@/lib/auth';

const mockPrisma = prisma as unknown as {
  job: { findUnique: jest.Mock };
  application: { findFirst: jest.Mock; create: jest.Mock };
  user: { findUnique: jest.Mock };
};
const mockCookies = cookies as unknown as jest.Mock;

function sinSesion(): void {
  mockCookies.mockResolvedValue({ get: () => undefined });
}

function sesion(id: number, role: string, email: string, nombre = 'Ana'): void {
  mockPrisma.user.findUnique.mockResolvedValue({
    id,
    email,
    nombre,
    apellidoPaterno: 'Pérez',
    apellidoMaterno: null,
    role,
    isActive: true,
    credits: 0,
    specialty: null,
  });
  mockCookies.mockResolvedValue({
    get: (name: string) =>
      name === 'auth-token' ? { value: generateToken({ userId: id, email, role }) } : undefined,
  });
}

// Cada petición finge venir de una IP distinta: el rate limit de la ruta (10
// por hora por IP) es global al proceso y si no, bloquearía los últimos casos.
let ip = 0;
function req(body: unknown): Request {
  ip += 1;
  const direccion = `10.0.0.${ip}`;
  return {
    headers: {
      get: (name: string): string | null =>
        name === 'x-forwarded-for' ? direccion : null,
    },
    json: async (): Promise<unknown> => body,
  } as unknown as Request;
}

const vacanteActiva = { id: 3, status: 'active', title: 'Dev', expiresAt: null };

beforeEach(() => {
  jest.clearAllMocks();
  mockPrisma.job.findUnique.mockResolvedValue(vacanteActiva);
  mockPrisma.application.findFirst.mockResolvedValue(null);
  mockPrisma.application.create.mockResolvedValue({
    id: 1,
    job: { title: 'Dev', company: 'Acme' },
  });
});

/** Los datos con los que se creó la postulación. */
function datosCreados(): Record<string, unknown> {
  return (mockPrisma.application.create.mock.calls[0][0] as { data: Record<string, unknown> }).data;
}

describe('VAC-013 — con sesión, el correo sale de la sesión y no del body', () => {
  it('ignora el candidateEmail del body y usa el de la sesión', async () => {
    sesion(7, 'candidate', 'ana@correo.com');

    const res = await POST(
      req({
        jobId: 3,
        candidateName: 'Rival',
        candidateEmail: 'rival@correo.com', // intento de ocupar el sitio del rival
      })
    );

    expect(res.status).toBe(201);
    expect(datosCreados().candidateEmail).toBe('ana@correo.com');
    expect(datosCreados().userId).toBe(7);
  });

  it('el nombre también sale del perfil de la sesión', async () => {
    sesion(7, 'candidate', 'ana@correo.com');

    await POST(req({ jobId: 3, candidateName: 'Nombre falso', candidateEmail: 'x@y.com' }));

    expect(datosCreados().candidateName).toBe('Ana Pérez');
  });

  it('una sesión de EMPRESA no puede postularse: 403', async () => {
    sesion(9, 'company', 'empresa@x.com');

    const res = await POST(
      req({ jobId: 3, candidateName: 'X', candidateEmail: 'x@y.com' })
    );

    expect(res.status).toBe(403);
    expect(mockPrisma.application.create).not.toHaveBeenCalled();
  });

  it('sin sesión se sigue aceptando la postulación anónima', async () => {
    sinSesion();

    const res = await POST(
      req({ jobId: 3, candidateName: 'Anon', candidateEmail: 'Anon@Test.com' })
    );

    expect(res.status).toBe(201);
    expect(datosCreados().userId).toBeNull();
    expect(datosCreados().candidateEmail).toBe('anon@test.com');
  });
});

describe('VAC-014 — el CV tiene que ser un enlace http(s)', () => {
  it('rechaza un cvUrl con esquema javascript:', async () => {
    sinSesion();

    const res = await POST(
      req({
        jobId: 3,
        candidateName: 'Anon',
        candidateEmail: 'anon@test.com',
        cvUrl: 'javascript:alert(document.cookie)',
      })
    );

    expect(res.status).toBe(400);
    expect(mockPrisma.application.create).not.toHaveBeenCalled();
  });

  it('rechaza un cvUrl data:text/html', async () => {
    sinSesion();

    const res = await POST(
      req({
        jobId: 3,
        candidateName: 'Anon',
        candidateEmail: 'anon@test.com',
        cvUrl: 'data:text/html,<script>fetch("//evil")</script>',
      })
    );

    expect(res.status).toBe(400);
  });

  it('acepta una URL https normal', async () => {
    sinSesion();

    const res = await POST(
      req({
        jobId: 3,
        candidateName: 'Anon',
        candidateEmail: 'anon@test.com',
        cvUrl: 'https://blob.vercel-storage.com/cv.pdf',
      })
    );

    expect(res.status).toBe(201);
  });
});

describe('VAC-012 — el duplicado responde 409 (y también si lo detecta la base)', () => {
  it('devuelve 409 cuando ya existe la postulación', async () => {
    sinSesion();
    mockPrisma.application.findFirst.mockResolvedValue({ id: 99 });

    const res = await POST(
      req({ jobId: 3, candidateName: 'Anon', candidateEmail: 'anon@test.com' })
    );

    expect(res.status).toBe(409);
  });

  it('traduce el P2002 del índice único al mismo 409', async () => {
    sinSesion();
    mockPrisma.application.create.mockRejectedValue(
      Object.assign(new Error('Unique constraint failed'), { code: 'P2002' })
    );

    const res = await POST(
      req({ jobId: 3, candidateName: 'Anon', candidateEmail: 'anon@test.com' })
    );

    expect(res.status).toBe(409);
  });
});

describe('VAC-027 / VAC-036 — vacante expirada e ids inválidos', () => {
  it('no se puede postular a una vacante ya expirada', async () => {
    sinSesion();
    mockPrisma.job.findUnique.mockResolvedValue({
      ...vacanteActiva,
      expiresAt: new Date(Date.now() - 60_000),
    });

    const res = await POST(
      req({ jobId: 3, candidateName: 'Anon', candidateEmail: 'anon@test.com' })
    );

    expect(res.status).toBe(400);
    expect(mockPrisma.application.create).not.toHaveBeenCalled();
  });

  it('un jobId no numérico responde 400 sin llegar a la base', async () => {
    sinSesion();

    const res = await POST(
      req({ jobId: 'abc', candidateName: 'Anon', candidateEmail: 'anon@test.com' })
    );

    expect(res.status).toBe(400);
    expect(mockPrisma.job.findUnique).not.toHaveBeenCalled();
  });

  it('un correo con formato inválido responde 400', async () => {
    sinSesion();

    const res = await POST(
      req({ jobId: 3, candidateName: 'Anon', candidateEmail: 'noesuncorreo' })
    );

    expect(res.status).toBe(400);
  });
});
