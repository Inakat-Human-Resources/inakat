/**
 * @jest-environment node
 */
/**
 * Cierre del módulo de vacantes (auditoría 2026-09, vac.md): lo que seguía
 * abierto después de las tandas anteriores.
 *
 *  - VAC-022 (residual): /api/my-applications y /api/candidate/applications
 *    tenían su propia copia de la ubicación "pública" de una confidencial, y
 *    con una dirección sin comas devolvían la cadena COMPLETA al candidato.
 *  - VAC-041 (PUT): el rango salarial sólo se validaba si llegaban los dos
 *    extremos.
 *  - VAC-038: PUT sin coordenadas en el body las borraba.
 *  - VAC-011: el conteo de postulaciones por candidato de
 *    /admin/assign-candidates bajaba la tabla entera; ahora hay un endpoint de
 *    conteo con groupBy.
 *
 * Se ejercitan los handlers REALES con Prisma simulado.
 */

export {};

process.env.JWT_SECRET =
  process.env.JWT_SECRET || 'test-secret-con-mas-de-treinta-y-dos-caracteres-123';

jest.mock('@/lib/prisma', () => ({
  prisma: {
    job: {
      findUnique: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
    user: { findUnique: jest.fn(), updateMany: jest.fn(), update: jest.fn() },
    candidate: { findUnique: jest.fn() },
    application: { findMany: jest.fn(), groupBy: jest.fn() },
    creditTransaction: { create: jest.fn() },
    specialty: { findFirst: jest.fn() },
    pricingMatrix: { findFirst: jest.fn() },
    companyRequest: { findUnique: jest.fn() },
    $transaction: jest.fn(),
  },
}));

jest.mock('@/lib/pricing', () => ({
  calculateJobCreditCost: jest.fn(),
}));

jest.mock('next/headers', () => ({ cookies: jest.fn() }));

import { GET as misPostulaciones } from '@/app/api/my-applications/route';
import { GET as postulacionesCandidato } from '@/app/api/candidate/applications/route';
import { PUT } from '@/app/api/jobs/[id]/route';
import { POST as contarPostulaciones } from '@/app/api/applications/counts/route';
import { prisma } from '@/lib/prisma';
import { cookies } from 'next/headers';
import { generateToken } from '@/lib/auth';
import type { NextRequest } from 'next/server';

const mockPrisma = prisma as unknown as {
  job: { findUnique: jest.Mock; update: jest.Mock; updateMany: jest.Mock };
  user: { findUnique: jest.Mock; updateMany: jest.Mock; update: jest.Mock };
  candidate: { findUnique: jest.Mock };
  application: { findMany: jest.Mock; groupBy: jest.Mock };
  creditTransaction: { create: jest.Mock };
  specialty: { findFirst: jest.Mock };
  pricingMatrix: { findFirst: jest.Mock };
  companyRequest: { findUnique: jest.Mock };
  $transaction: jest.Mock;
};
const mockCookies = cookies as unknown as jest.Mock;

function setCookie(token?: string): void {
  mockCookies.mockResolvedValue({
    get: (name: string) => (name === 'auth-token' && token ? { value: token } : undefined),
  });
}

/** Sesión activa: la fila de la base devuelve el rol vigente. */
function sesion(id: number, role: string, extra: Record<string, unknown> = {}): void {
  mockPrisma.user.findUnique.mockResolvedValue({
    id,
    email: `u${id}@x.com`,
    nombre: 'N',
    apellidoPaterno: null,
    apellidoMaterno: null,
    role,
    isActive: true,
    credits: 100,
    specialty: null,
    emailVerified: null,
    ...extra,
  });
  setCookie(generateToken({ userId: id, email: `u${id}@x.com`, role }));
}

const ctx = (id: string) => ({ params: Promise.resolve({ id }) });
const req = (body: unknown = {}) =>
  ({ json: async () => body, headers: { get: () => null } }) as unknown as Request;

/** Postulación a una vacante confidencial cuya dirección se tecleó SIN comas. */
function postulacionConfidencial() {
  return {
    id: 1,
    jobId: 10,
    userId: 7,
    status: 'pending',
    notes: 'nota interna',
    candidateEmail: 'u7@x.com',
    job: {
      id: 10,
      title: 'Contador',
      company: 'ACME SA',
      location: 'Av Reforma 222 Col Juárez CDMX',
      salary: '$30,000',
      jobType: 'Tiempo Completo',
      workMode: 'presential',
      status: 'active',
      profile: 'Finanzas',
      seniority: 'Sr',
      isConfidential: true,
      user: { companyRequest: { logoUrl: 'https://x/logo.png' } },
    },
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  mockPrisma.$transaction.mockImplementation(async (cb: any) => cb(mockPrisma));
  mockPrisma.job.update.mockResolvedValue({ id: 10 });
  mockPrisma.job.updateMany.mockResolvedValue({ count: 1 });
  mockPrisma.specialty.findFirst.mockResolvedValue({ name: 'Tecnología', subcategories: [] });
  mockPrisma.pricingMatrix.findFirst.mockResolvedValue(null);
  mockPrisma.companyRequest.findUnique.mockResolvedValue({ nombreEmpresa: 'X' });
});

// ---------------------------------------------------------------------------
describe('VAC-022 — las vistas del candidato no filtran la dirección de una confidencial', () => {
  it('/api/my-applications no devuelve la dirección sin comas tal cual', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({ emailVerified: null });
    mockPrisma.application.findMany.mockResolvedValue([postulacionConfidencial()]);

    const request = new Request('http://localhost/api/my-applications', {
      headers: { 'x-user-id': '7', 'x-user-email': 'u7@x.com' },
    }) as unknown as NextRequest;
    const res = await misPostulaciones(request);
    const body = await res.json();

    expect(res.status).toBe(200);
    const job = body.data.applications[0].job;
    expect(job.company).toBe('Empresa Confidencial');
    expect(job.location).toBe('México');
    expect(job.logoUrl).toBeNull();
  });

  it('/api/candidate/applications tampoco', async () => {
    sesion(7, 'candidate');
    mockPrisma.candidate.findUnique.mockResolvedValue({
      id: 3,
      userId: 7,
      nombre: 'N',
      email: 'u7@x.com',
    });
    mockPrisma.application.findMany.mockResolvedValue([postulacionConfidencial()]);

    const res = await postulacionesCandidato();
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.data[0].job.company).toBe('Empresa Confidencial');
    expect(body.data[0].job.location).toBe('México');
    expect(body.data[0].notes).toBeNull();
  });

  it('con una dirección de Google se publica el estado, no el país ni la calle', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({ emailVerified: null });
    const app = postulacionConfidencial();
    app.job.location = 'Av. Lázaro Cárdenas 2400, San Pedro Garza García, N.L., México';
    mockPrisma.application.findMany.mockResolvedValue([app]);

    const request = new Request('http://localhost/api/my-applications', {
      headers: { 'x-user-id': '7', 'x-user-email': 'u7@x.com' },
    }) as unknown as NextRequest;
    const body = await (await misPostulaciones(request)).json();

    expect(body.data.applications[0].job.location).toBe('N.L.');
  });
});

// ---------------------------------------------------------------------------
/** Vacante ya publicada de la empresa 5, dentro de su ventana de edición. */
function vacantePublicada() {
  return {
    id: 10,
    userId: 5,
    title: 'Backend',
    status: 'active',
    creditCost: 5,
    profile: 'Tecnología',
    seniority: 'Jr',
    workMode: 'remote',
    salaryMin: 30000,
    salaryMax: 38000,
    latitude: 25.67,
    longitude: -100.31,
    editableUntil: new Date(Date.now() + 60 * 60 * 1000),
  };
}

/** Body del formulario de edición sin los campos de salario ni coordenadas. */
function formularioBase(extra: Record<string, unknown> = {}) {
  return {
    title: 'Backend',
    company: 'X',
    location: 'Monterrey, N.L., México',
    salary: '$30,000 - $38,000',
    jobType: 'Tiempo Completo',
    workMode: 'remote',
    description: 'desc',
    profile: 'Tecnología',
    seniority: 'Jr',
    ...extra,
  };
}

describe('VAC-041 — PUT valida el rango salarial con los valores finales', () => {
  it('mandar sólo salaryMin que abre un rango de más de $10,000 responde 400', async () => {
    sesion(5, 'company');
    mockPrisma.job.findUnique.mockResolvedValue(vacantePublicada());

    const res = await PUT(req(formularioBase({ salaryMin: 3000 })), ctx('10'));

    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/diferencia máxima/);
    expect(mockPrisma.job.update).not.toHaveBeenCalled();
  });

  it('mandar sólo salaryMax por debajo del mínimo guardado responde 400', async () => {
    sesion(5, 'company');
    mockPrisma.job.findUnique.mockResolvedValue(vacantePublicada());

    const res = await PUT(req(formularioBase({ salaryMax: 20000 })), ctx('10'));

    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/mínimo no puede ser mayor/);
    expect(mockPrisma.job.update).not.toHaveBeenCalled();
  });
});

describe('VAC-038 — PUT y las coordenadas', () => {
  it('si el body no trae coordenadas, no las borra', async () => {
    sesion(5, 'company');
    mockPrisma.job.findUnique.mockResolvedValue(vacantePublicada());

    const res = await PUT(req(formularioBase()), ctx('10'));

    expect(res.status).toBe(200);
    const data = mockPrisma.job.update.mock.calls[0][0].data;
    expect(data).not.toHaveProperty('latitude');
    expect(data).not.toHaveProperty('longitude');
  });

  it('si las trae, las guarda', async () => {
    sesion(5, 'company');
    mockPrisma.job.findUnique.mockResolvedValue(vacantePublicada());

    const res = await PUT(
      req(formularioBase({ latitude: 20.67, longitude: -103.35 })),
      ctx('10')
    );

    expect(res.status).toBe(200);
    const data = mockPrisma.job.update.mock.calls[0][0].data;
    expect(data.latitude).toBe(20.67);
    expect(data.longitude).toBe(-103.35);
  });

  it('un null explícito sí las limpia', async () => {
    sesion(5, 'company');
    mockPrisma.job.findUnique.mockResolvedValue(vacantePublicada());

    await PUT(req(formularioBase({ latitude: null, longitude: null })), ctx('10'));

    const data = mockPrisma.job.update.mock.calls[0][0].data;
    expect(data.latitude).toBeNull();
    expect(data.longitude).toBeNull();
  });
});

// ---------------------------------------------------------------------------
describe('VAC-011 — conteo de postulaciones por correo', () => {
  it('sin sesión responde 401 y no consulta postulaciones', async () => {
    mockPrisma.user.findUnique.mockResolvedValue(null);
    setCookie(undefined);

    const res = await contarPostulaciones(req({ emails: ['a@x.com'] }));

    expect(res.status).toBe(401);
    expect(mockPrisma.application.groupBy).not.toHaveBeenCalled();
  });

  it('una sesión que no es admin recibe 403', async () => {
    sesion(5, 'company');

    const res = await contarPostulaciones(req({ emails: ['a@x.com'] }));

    expect(res.status).toBe(403);
    expect(mockPrisma.application.groupBy).not.toHaveBeenCalled();
  });

  it('agrupa en la base sólo los correos pedidos (normalizados y sin repetir)', async () => {
    sesion(1, 'admin');
    mockPrisma.application.groupBy.mockResolvedValue([
      { candidateEmail: 'ana@x.com', _count: { _all: 3 } },
    ]);

    const res = await contarPostulaciones(
      req({ emails: [' Ana@X.com ', 'ana@x.com', 'beto@x.com'] })
    );
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(mockPrisma.application.groupBy).toHaveBeenCalledWith({
      by: ['candidateEmail'],
      where: { candidateEmail: { in: ['ana@x.com', 'beto@x.com'] } },
      _count: { _all: true },
    });
    expect(body.data).toEqual({ 'ana@x.com': 3 });
  });

  it('rechaza un body que no es una lista de correos', async () => {
    sesion(1, 'admin');

    const res = await contarPostulaciones(req({ emails: 'ana@x.com' }));

    expect(res.status).toBe(400);
    expect(mockPrisma.application.groupBy).not.toHaveBeenCalled();
  });

  it('pone tope al número de correos por petición', async () => {
    sesion(1, 'admin');
    const muchos = Array.from({ length: 201 }, (_, i) => `c${i}@x.com`);

    const res = await contarPostulaciones(req({ emails: muchos }));

    expect(res.status).toBe(400);
    expect(mockPrisma.application.groupBy).not.toHaveBeenCalled();
  });
});
