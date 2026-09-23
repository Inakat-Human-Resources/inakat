/**
 * @jest-environment node
 */
/**
 * Hallazgos residuales del módulo de vacantes (auditoría 2026-09, vac.md) que
 * seguían abiertos tras la primera tanda de arreglos:
 *
 *  - VAC-003: el ajuste de créditos del PUT sólo miraba vacantes 'active'. Una
 *    vacante PAUSADA se subía de Jr a Director gratis y se reanudaba después.
 *  - VAC-007 (en PUT): una combinación fuera de la matriz (found:false) bajaba
 *    el precio al de por defecto y DEVOLVÍA la diferencia.
 *  - VAC-022: la ubicación pública de una confidencial era el último segmento
 *    ("México" siempre) o, sin comas, la dirección COMPLETA.
 *  - VAC-025: el dashboard de admin pedía /api/jobs?includeDrafts=true sin
 *    userId y recibía sólo las activas.
 *  - VAC-010 / VAC-033: orden global en el servidor (`sort`) y Cache-Control
 *    sólo en la respuesta idéntica para todos.
 *  - VAC-041: PATCH con un solo extremo del salario saltaba rango y mínimo.
 *  - VAC-001: /api/applications/check vinculaba por email aunque la cuenta no
 *    lo hubiera verificado.
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
      findMany: jest.fn(),
      count: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
    user: { findUnique: jest.fn(), updateMany: jest.fn(), update: jest.fn() },
    application: { findFirst: jest.fn() },
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

import { GET as listarVacantes } from '@/app/api/jobs/route';
import { PUT, PATCH } from '@/app/api/jobs/[id]/route';
import { GET as comprobarPostulacion } from '@/app/api/applications/check/route';
import { publicConfidentialLocation, sanitizeConfidentialJob } from '@/lib/jobs-public';
import { prisma } from '@/lib/prisma';
import { calculateJobCreditCost } from '@/lib/pricing';
import { cookies } from 'next/headers';
import { generateToken } from '@/lib/auth';

const mockPrisma = prisma as unknown as {
  job: {
    findUnique: jest.Mock;
    findMany: jest.Mock;
    count: jest.Mock;
    update: jest.Mock;
    updateMany: jest.Mock;
  };
  user: { findUnique: jest.Mock; updateMany: jest.Mock; update: jest.Mock };
  application: { findFirst: jest.Mock };
  creditTransaction: { create: jest.Mock };
  specialty: { findFirst: jest.Mock };
  pricingMatrix: { findFirst: jest.Mock };
  companyRequest: { findUnique: jest.Mock };
  $transaction: jest.Mock;
};
const mockCosto = calculateJobCreditCost as jest.Mock;
const mockCookies = cookies as unknown as jest.Mock;

function setCookie(token?: string): void {
  mockCookies.mockResolvedValue({
    get: (name: string) => (name === 'auth-token' && token ? { value: token } : undefined),
  });
}

/** Sesión activa: la fila de la base devuelve el rol y, opcionalmente, emailVerified. */
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
    ...extra,
  });
  setCookie(generateToken({ userId: id, email: `u${id}@x.com`, role }));
}

function anonimo(): void {
  mockPrisma.user.findUnique.mockResolvedValue(null);
  setCookie(undefined);
}

const ctx = (id: string) => ({ params: Promise.resolve({ id }) });
const req = (body: unknown = {}) =>
  ({ json: async () => body, headers: { get: () => null } }) as unknown as Request;
const reqUrl = (url: string) => new Request(url);

/** Vacante ya publicada de la empresa 5, dentro de su ventana de edición. */
function vacantePublicada(status: string) {
  return {
    id: 10,
    userId: 5,
    title: 'Backend',
    status,
    creditCost: 5,
    profile: 'Tecnología',
    seniority: 'Jr',
    workMode: 'remote',
    salaryMin: 30000,
    salaryMax: 38000,
    editableUntil: new Date(Date.now() + 60 * 60 * 1000),
  };
}

/** Body completo del formulario de edición, cambiando sólo la seniority. */
function formulario(seniority: string) {
  return {
    title: 'Backend',
    company: 'X',
    location: 'Monterrey, N.L., México',
    salary: '$30,000 - $38,000',
    salaryMin: 30000,
    salaryMax: 38000,
    jobType: 'Tiempo Completo',
    workMode: 'remote',
    description: 'desc',
    profile: 'Tecnología',
    seniority,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  mockPrisma.$transaction.mockImplementation(async (cb: any) => cb(mockPrisma));
  mockPrisma.job.findMany.mockResolvedValue([]);
  mockPrisma.job.count.mockResolvedValue(0);
  mockPrisma.job.update.mockResolvedValue({ id: 10 });
  mockPrisma.job.updateMany.mockResolvedValue({ count: 1 });
  mockPrisma.user.updateMany.mockResolvedValue({ count: 1 });
  mockPrisma.specialty.findFirst.mockResolvedValue({ name: 'Tecnología', subcategories: [] });
  mockPrisma.pricingMatrix.findFirst.mockResolvedValue(null);
  mockPrisma.companyRequest.findUnique.mockResolvedValue({ nombreEmpresa: 'X' });
  mockPrisma.creditTransaction.create.mockResolvedValue({});
});

// ---------------------------------------------------------------------------
describe('VAC-022 — ubicación pública de una vacante confidencial', () => {
  it('una dirección sin comas NO se publica tal cual', () => {
    expect(publicConfidentialLocation('Av Reforma 222 CDMX')).toBe('México');
  });

  it('de la dirección de Google se queda con el estado, no con el país', () => {
    expect(
      publicConfidentialLocation(
        'Av. Lázaro Cárdenas 2400, 66269 San Pedro Garza García, N.L., México'
      )
    ).toBe('N.L.');
  });

  it('calle + país no deja nada publicable: responde "México"', () => {
    expect(publicConfidentialLocation('Av. Reforma 222, México')).toBe('México');
  });

  it('quita códigos postales y números del segmento elegido', () => {
    expect(publicConfidentialLocation('Calle 5, 06600 CDMX')).toBe('CDMX');
  });

  it('sin ubicación responde "México"', () => {
    expect(publicConfidentialLocation(null)).toBe('México');
    expect(publicConfidentialLocation('')).toBe('México');
  });

  it('sanitizeConfidentialJob oculta empresa, userId, coordenadas y logo', () => {
    const publica = sanitizeConfidentialJob(
      {
        isConfidential: true,
        company: 'Acme',
        userId: 12,
        latitude: 25.6,
        longitude: -100.3,
        logoUrl: 'https://x/logo.png',
        location: 'Av Constitución 123 Monterrey',
      },
      false
    );
    expect(publica).toMatchObject({
      company: 'Empresa Confidencial',
      userId: null,
      latitude: null,
      longitude: null,
      logoUrl: null,
      location: 'México',
    });
  });

  it('GET /api/jobs publica la ubicación saneada, no la dirección tecleada sin comas', async () => {
    anonimo();
    mockPrisma.job.findMany.mockResolvedValue([
      {
        id: 1,
        isConfidential: true,
        company: 'Acme',
        userId: 12,
        location: 'Av Reforma 222 CDMX',
        notasInternas: 'x',
        user: null,
      },
    ]);
    mockPrisma.job.count.mockResolvedValue(1);

    const res = await listarVacantes(reqUrl('http://localhost/api/jobs'));
    const body = await res.json();

    expect(body.data[0].location).toBe('México');
    expect(body.data[0].company).toBe('Empresa Confidencial');
  });
});

// ---------------------------------------------------------------------------
describe('VAC-025 — vista admin del listado', () => {
  it('admin con includeDrafts=true y sin userId ve todas las empresas y estados', async () => {
    sesion(1, 'admin');

    await listarVacantes(reqUrl('http://localhost/api/jobs?includeDrafts=true&limit=100'));

    const { where } = mockPrisma.job.findMany.mock.calls[0][0];
    expect(where.status).toBeUndefined();
    expect(where.userId).toBeUndefined();
  });

  it('admin con all=true respeta el status pedido sin restringir por empresa', async () => {
    sesion(1, 'admin');

    await listarVacantes(reqUrl('http://localhost/api/jobs?all=true&status=paused'));

    const { where } = mockPrisma.job.findMany.mock.calls[0][0];
    expect(where.status).toBe('paused');
    expect(where.userId).toBeUndefined();
  });

  it('un anónimo con includeDrafts=true sigue viendo sólo lo publicado', async () => {
    anonimo();

    await listarVacantes(reqUrl('http://localhost/api/jobs?includeDrafts=true'));

    const { where } = mockPrisma.job.findMany.mock.calls[0][0];
    expect(where.status).toBe('active');
  });

  it('una empresa con all=true NO obtiene la vista de todas las empresas', async () => {
    sesion(5, 'company');

    await listarVacantes(reqUrl('http://localhost/api/jobs?all=true&status=draft'));

    const { where } = mockPrisma.job.findMany.mock.calls[0][0];
    expect(where.status).toBe('active');
  });
});

// ---------------------------------------------------------------------------
describe('VAC-010 / VAC-033 — orden en servidor y caché del listado público', () => {
  it('sort=oldest ordena por fecha ascendente en la base', async () => {
    anonimo();
    await listarVacantes(reqUrl('http://localhost/api/jobs?sort=oldest'));
    const { orderBy } = mockPrisma.job.findMany.mock.calls[0][0];
    expect(orderBy[0]).toEqual({ createdAt: 'asc' });
  });

  it('sort=az ordena por título', async () => {
    anonimo();
    await listarVacantes(reqUrl('http://localhost/api/jobs?sort=az'));
    const { orderBy } = mockPrisma.job.findMany.mock.calls[0][0];
    expect(orderBy[0]).toEqual({ title: 'asc' });
  });

  it('un sort desconocido cae en "más reciente"', async () => {
    anonimo();
    await listarVacantes(reqUrl('http://localhost/api/jobs?sort=salario;drop'));
    const { orderBy } = mockPrisma.job.findMany.mock.calls[0][0];
    expect(orderBy[0]).toEqual({ createdAt: 'desc' });
  });

  it('la respuesta pública (sin userId/includeDrafts/all) se cachea en el CDN', async () => {
    anonimo();
    const res = await listarVacantes(reqUrl('http://localhost/api/jobs?status=active&page=2'));
    expect(res.headers.get('Cache-Control')).toMatch(/public, s-maxage=/);
  });

  it('con userId NO se cachea: la sesión cambia el resultado y el CDN no mira cookies', async () => {
    sesion(5, 'company');
    const res = await listarVacantes(reqUrl('http://localhost/api/jobs?userId=5&includeDrafts=true'));
    expect(res.headers.get('Cache-Control')).toBe('private, no-store');
  });

  it('con includeDrafts NO se cachea aunque el visitante sea anónimo', async () => {
    anonimo();
    const res = await listarVacantes(reqUrl('http://localhost/api/jobs?includeDrafts=true'));
    expect(res.headers.get('Cache-Control')).toBe('private, no-store');
  });
});

// ---------------------------------------------------------------------------
describe('VAC-003 — PUT cobra el ajuste también en vacantes pausadas', () => {
  it('subir de Jr a Sr una vacante PAUSADA cobra la diferencia', async () => {
    sesion(5, 'company');
    mockPrisma.job.findUnique.mockResolvedValue(vacantePublicada('paused'));
    mockCosto.mockResolvedValue({ credits: 12, found: true });

    const res = await PUT(req(formulario('Sr')), ctx('10'));

    expect(res.status).toBe(200);
    // El saldo se reclama con decremento condicionado por la diferencia (12 - 5).
    expect(mockPrisma.user.updateMany).toHaveBeenCalledWith({
      where: { id: 5, credits: { gte: 7 } },
      data: { credits: { decrement: 7 } },
    });
    const body = await res.json();
    expect(body.creditChange).toMatchObject({ difference: 7, action: 'charged' });
  });

  it('un borrador NO se cobra al editarlo (se cobra entero al publicar)', async () => {
    sesion(5, 'company');
    mockPrisma.job.findUnique.mockResolvedValue({ ...vacantePublicada('draft'), editableUntil: null });
    mockCosto.mockResolvedValue({ credits: 12, found: true });

    const res = await PUT(req(formulario('Sr')), ctx('10'));

    expect(res.status).toBe(200);
    expect(mockPrisma.user.updateMany).not.toHaveBeenCalled();
    expect(mockCosto).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
describe('VAC-007 (PUT) — una combinación sin precio no abarata la vacante', () => {
  it('seniority fuera de la matriz responde 400 y no devuelve créditos', async () => {
    sesion(5, 'company');
    mockPrisma.job.findUnique.mockResolvedValue({
      ...vacantePublicada('active'),
      seniority: 'Director',
      creditCost: 18,
    });
    mockCosto.mockResolvedValue({ credits: 5, found: false });

    const res = await PUT(req(formulario('Director.')), ctx('10'));

    expect(res.status).toBe(400);
    expect(mockPrisma.user.update).not.toHaveBeenCalled();
    expect(mockPrisma.creditTransaction.create).not.toHaveBeenCalled();
    expect(mockPrisma.job.update).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
describe('VAC-041 — PATCH valida el salario con los valores finales', () => {
  it('mandar sólo salaryMin que abre un rango de más de $10,000 responde 400', async () => {
    sesion(5, 'company');
    mockPrisma.job.findUnique.mockResolvedValue(vacantePublicada('active'));

    const res = await PATCH(req({ salaryMin: 3000 }), ctx('10'));

    expect(res.status).toBe(400);
    expect(mockPrisma.job.update).not.toHaveBeenCalled();
  });

  it('un salaryMin por debajo del mínimo de la matriz responde 400', async () => {
    sesion(5, 'company');
    mockPrisma.job.findUnique.mockResolvedValue(vacantePublicada('active'));
    mockPrisma.pricingMatrix.findFirst.mockResolvedValue({ minSalary: 32000 });

    const res = await PATCH(req({ salaryMin: 31000 }), ctx('10'));

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.minSalaryRequired).toBe(32000);
    expect(mockPrisma.job.update).not.toHaveBeenCalled();
  });

  it('un salaryMin válido dentro del rango se guarda', async () => {
    sesion(5, 'company');
    mockPrisma.job.findUnique.mockResolvedValue(vacantePublicada('active'));
    mockPrisma.pricingMatrix.findFirst.mockResolvedValue({ minSalary: 25000 });

    const res = await PATCH(req({ salaryMin: 31000 }), ctx('10'));

    expect(res.status).toBe(200);
    expect(mockPrisma.job.update).toHaveBeenCalledWith({
      where: { id: 10 },
      data: { salaryMin: 31000 },
    });
  });
});

// ---------------------------------------------------------------------------
describe('VAC-001 — /api/applications/check no vincula por un email sin verificar', () => {
  const url = 'http://localhost/api/applications/check?jobId=3';

  it('con el email SIN verificar sólo busca por userId', async () => {
    sesion(7, 'candidate', { emailVerified: null });
    mockPrisma.application.findFirst.mockResolvedValue(null);

    const res = await comprobarPostulacion(reqUrl(url));

    expect(res.status).toBe(200);
    const { where } = mockPrisma.application.findFirst.mock.calls[0][0];
    expect(where).toEqual({ jobId: 3, OR: [{ userId: 7 }] });
  });

  it('con el email verificado también mira el correo de la sesión', async () => {
    sesion(7, 'candidate', { emailVerified: new Date() });
    mockPrisma.application.findFirst.mockResolvedValue(null);

    await comprobarPostulacion(reqUrl(url));

    const { where } = mockPrisma.application.findFirst.mock.calls[0][0];
    expect(where).toEqual({
      jobId: 3,
      OR: [{ userId: 7 }, { candidateEmail: 'u7@x.com' }],
    });
  });

  it('sin sesión responde 401 y no consulta postulaciones', async () => {
    anonimo();

    const res = await comprobarPostulacion(reqUrl(url));

    expect(res.status).toBe(401);
    expect(mockPrisma.application.findFirst).not.toHaveBeenCalled();
  });
});
