/**
 * @jest-environment node
 */
// RUTA: __tests__/api/jobs/jobs-id-auth.test.ts
//
// INFRA-006: esta suite afirmaba constantes locales (`const requiresAuth =
// true; expect(requiresAuth).toBe(true)`) y una copia pegada de la whitelist de
// PATCH que ya no coincidía con la real. Pasaba aunque se borrara la
// comprobación de propiedad o se volviera a hacer spread del body al update.
//
// Ahora se ejecutan los handlers REALES de /api/jobs/[id] con prisma y
// next/headers mockeados: si alguien quita verifyJobOwnership, el bloqueo de
// borradores o la whitelist, estos tests se ponen en rojo.

export {};

process.env.JWT_SECRET =
  process.env.JWT_SECRET || 'test-secret-con-mas-de-treinta-y-dos-caracteres-123';

jest.mock('@/lib/prisma', () => ({
  prisma: {
    job: { findUnique: jest.fn(), update: jest.fn(), updateMany: jest.fn(), delete: jest.fn() },
    user: { findUnique: jest.fn(), updateMany: jest.fn(), update: jest.fn() },
    creditTransaction: { create: jest.fn() },
    specialty: { findFirst: jest.fn() },
    pricingMatrix: { findFirst: jest.fn() },
    companyRequest: { findUnique: jest.fn() },
    $transaction: jest.fn()
  }
}));

jest.mock('next/headers', () => ({ cookies: jest.fn() }));

import { PATCH, PUT, DELETE } from '@/app/api/jobs/[id]/route';
import { prisma } from '@/lib/prisma';
import { cookies } from 'next/headers';
import { generateToken } from '@/lib/auth';

const mockPrisma = prisma as unknown as {
  job: { findUnique: jest.Mock; update: jest.Mock; updateMany: jest.Mock; delete: jest.Mock };
  user: { findUnique: jest.Mock; updateMany: jest.Mock; update: jest.Mock };
  creditTransaction: { create: jest.Mock };
  specialty: { findFirst: jest.Mock };
  pricingMatrix: { findFirst: jest.Mock };
  companyRequest: { findUnique: jest.Mock };
  $transaction: jest.Mock;
};
const mockCookies = cookies as unknown as jest.Mock;

const DUENO = 5;
const OTRA_EMPRESA = 9;
const ADMIN = 1;

function sinSesion(): void {
  mockCookies.mockResolvedValue({ get: () => undefined });
}

/** Sesión válida: cookie firmada + fila del usuario en la base. */
function sesion(id: number, role: string): void {
  mockPrisma.user.findUnique.mockResolvedValue({
    id,
    email: `u${id}@x.com`,
    nombre: 'N',
    apellidoPaterno: null,
    apellidoMaterno: null,
    role,
    isActive: true,
    credits: 0,
    specialty: null
  });
  const token = generateToken({ userId: id, email: `u${id}@x.com`, role: role as never });
  mockCookies.mockResolvedValue({
    get: (name: string) => (name === 'auth-token' ? { value: token } : undefined)
  });
}

function vacante(extra: Record<string, unknown> = {}) {
  return {
    id: 10,
    userId: DUENO,
    title: 'Backend',
    status: 'active',
    editableUntil: null,
    creditCost: 3,
    profile: 'Tecnología',
    seniority: 'Jr',
    workMode: 'remote',
    salaryMin: null,
    _count: { applications: 0 },
    ...extra
  };
}

const ctx = (id: string) => ({ params: Promise.resolve({ id }) });
const req = (body: unknown = {}) =>
  ({ json: async () => body, headers: { get: () => null } }) as unknown as Request;

/** `data` con el que se llamó a prisma.job.update (la única escritura de PATCH). */
function datosEscritos(): Record<string, unknown> {
  expect(mockPrisma.job.update).toHaveBeenCalledTimes(1);
  return mockPrisma.job.update.mock.calls[0][0].data;
}

beforeEach(() => {
  jest.clearAllMocks();
  mockPrisma.$transaction.mockImplementation(async (cb: any) => cb(mockPrisma));
  mockPrisma.job.update.mockResolvedValue({ id: 10 });
  mockPrisma.job.updateMany.mockResolvedValue({ count: 1 });
  mockPrisma.job.delete.mockResolvedValue({ id: 10 });
  mockPrisma.specialty.findFirst.mockResolvedValue({ name: 'Tecnología', subcategories: [] });
  mockPrisma.pricingMatrix.findFirst.mockResolvedValue(null);
  mockPrisma.companyRequest.findUnique.mockResolvedValue({ nombreEmpresa: 'Mi Empresa' });
});

describe('/api/jobs/[id] — autenticación (handler real)', () => {
  it('PATCH sin cookie responde 401 y no escribe', async () => {
    mockPrisma.job.findUnique.mockResolvedValue(vacante());
    sinSesion();

    const res = await PATCH(req({ status: 'paused' }), ctx('10'));

    expect(res.status).toBe(401);
    expect(mockPrisma.job.update).not.toHaveBeenCalled();
  });

  it('PUT sin cookie responde 401 y no escribe', async () => {
    mockPrisma.job.findUnique.mockResolvedValue(vacante());
    sinSesion();

    const res = await PUT(req({ title: 'X' }), ctx('10'));

    expect(res.status).toBe(401);
    expect(mockPrisma.job.update).not.toHaveBeenCalled();
  });

  it('DELETE sin cookie responde 401 y no borra', async () => {
    mockPrisma.job.findUnique.mockResolvedValue(vacante({ status: 'draft' }));
    sinSesion();

    const res = await DELETE(req(), ctx('10'));

    expect(res.status).toBe(401);
    expect(mockPrisma.job.delete).not.toHaveBeenCalled();
  });
});

describe('/api/jobs/[id] — propiedad', () => {
  it('PATCH de otra empresa responde 403', async () => {
    mockPrisma.job.findUnique.mockResolvedValue(vacante());
    sesion(OTRA_EMPRESA, 'company');

    const res = await PATCH(req({ status: 'paused' }), ctx('10'));

    expect(res.status).toBe(403);
    expect(mockPrisma.job.update).not.toHaveBeenCalled();
  });

  it('PUT de otra empresa responde 403', async () => {
    mockPrisma.job.findUnique.mockResolvedValue(vacante());
    sesion(OTRA_EMPRESA, 'company');

    const res = await PUT(req({ title: 'Robada' }), ctx('10'));

    expect(res.status).toBe(403);
    expect(mockPrisma.job.update).not.toHaveBeenCalled();
  });

  it('DELETE de otra empresa responde 403', async () => {
    mockPrisma.job.findUnique.mockResolvedValue(vacante({ status: 'draft' }));
    sesion(OTRA_EMPRESA, 'company');

    const res = await DELETE(req(), ctx('10'));

    expect(res.status).toBe(403);
    expect(mockPrisma.job.delete).not.toHaveBeenCalled();
  });

  it('un candidato tampoco puede tocar la vacante', async () => {
    mockPrisma.job.findUnique.mockResolvedValue(vacante());
    sesion(OTRA_EMPRESA, 'candidate');

    const res = await PATCH(req({ status: 'closed', closedReason: 'cancelled' }), ctx('10'));

    expect(res.status).toBe(403);
    expect(mockPrisma.job.update).not.toHaveBeenCalled();
  });

  it('el admin puede pausar una vacante que no es suya', async () => {
    mockPrisma.job.findUnique.mockResolvedValue(vacante());
    sesion(ADMIN, 'admin');

    const res = await PATCH(req({ status: 'paused' }), ctx('10'));

    expect(res.status).toBe(200);
    expect(datosEscritos()).toEqual({ status: 'paused' });
  });
});

describe('/api/jobs/[id] PATCH — no se publica gratis', () => {
  it('draft -> active responde 403 para la empresa dueña', async () => {
    mockPrisma.job.findUnique.mockResolvedValue(vacante({ status: 'draft' }));
    sesion(DUENO, 'company');

    const res = await PATCH(req({ status: 'active' }), ctx('10'));

    expect(res.status).toBe(403);
    expect(mockPrisma.job.update).not.toHaveBeenCalled();
  });

  it('draft -> paused también responde 403 (primer paso del rodeo draft -> paused -> active)', async () => {
    mockPrisma.job.findUnique.mockResolvedValue(vacante({ status: 'draft' }));
    sesion(DUENO, 'company');

    const res = await PATCH(req({ status: 'paused' }), ctx('10'));

    expect(res.status).toBe(403);
    expect(mockPrisma.job.update).not.toHaveBeenCalled();
  });
});

describe('/api/jobs/[id] PATCH — whitelist de campos', () => {
  it('la empresa no puede cambiar seniority por PATCH (determina el precio): 400', async () => {
    mockPrisma.job.findUnique.mockResolvedValue(vacante());
    sesion(DUENO, 'company');

    const res = await PATCH(req({ seniority: 'Sr' }), ctx('10'));
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.fields).toEqual(['seniority']);
    expect(mockPrisma.job.update).not.toHaveBeenCalled();
  });

  it('los campos peligrosos del body se ignoran: sólo se escribe lo permitido', async () => {
    mockPrisma.job.findUnique.mockResolvedValue(vacante());
    sesion(DUENO, 'company');

    const res = await PATCH(
      req({
        title: 'Backend Sr',
        userId: OTRA_EMPRESA,
        creditCost: 0,
        editableUntil: '2999-01-01T00:00:00.000Z',
        id: 999,
        createdAt: '2000-01-01T00:00:00.000Z',
        expiresAt: '2999-01-01T00:00:00.000Z',
        company: 'Otra Marca SA',
        companyRating: 5
      }),
      ctx('10')
    );

    expect(res.status).toBe(200);
    expect(datosEscritos()).toEqual({ title: 'Backend Sr' });
  });

  it('pasadas las 4 horas no se edita contenido: 403', async () => {
    mockPrisma.job.findUnique.mockResolvedValue(
      vacante({ editableUntil: new Date(Date.now() - 60_000) })
    );
    sesion(DUENO, 'company');

    const res = await PATCH(req({ title: 'Otro título' }), ctx('10'));

    expect(res.status).toBe(403);
    expect(mockPrisma.job.update).not.toHaveBeenCalled();
  });

  it('pasadas las 4 horas SÍ se puede cambiar el status (pausar/cerrar)', async () => {
    mockPrisma.job.findUnique.mockResolvedValue(
      vacante({ editableUntil: new Date(Date.now() - 60_000) })
    );
    sesion(DUENO, 'company');

    const res = await PATCH(req({ status: 'closed', closedReason: 'success' }), ctx('10'));

    expect(res.status).toBe(200);
    expect(datosEscritos()).toEqual({ status: 'closed', closedReason: 'success' });
  });
});

describe('/api/jobs/[id] PUT — ventana de edición', () => {
  it('pasadas las 4 horas el PUT responde 403 aunque sea el dueño', async () => {
    mockPrisma.job.findUnique.mockResolvedValue(
      vacante({ editableUntil: new Date(Date.now() - 60_000) })
    );
    sesion(DUENO, 'company');

    const res = await PUT(req({ title: 'Nuevo' }), ctx('10'));

    expect(res.status).toBe(403);
    expect(mockPrisma.job.update).not.toHaveBeenCalled();
  });
});
