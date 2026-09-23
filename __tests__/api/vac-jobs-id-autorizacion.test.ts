/**
 * @jest-environment node
 */
/**
 * VAC-017 / VAC-018 / VAC-023 / VAC-039 — /api/jobs/[id].
 *
 *  - VAC-017: la autorización se decidía SÓLO con el JWT (userId y role), sin
 *    consultar la base. El token dura 7 días: una empresa desactivada por
 *    fraude seguía editando y borrando sus vacantes toda la semana.
 *  - VAC-018: el DELETE sólo miraba la propiedad, y Application cuelga de Job
 *    con onDelete: Cascade (y de Application cuelgan evaluaciones,
 *    calificaciones y entrevistas): borrar una vacante con postulaciones se
 *    llevaba el historial de todos los candidatos.
 *  - VAC-023: la ficha se devolvía sea cual sea su estado, así que enumerando
 *    /api/jobs/1..N se leían los borradores de cualquier empresa.
 *  - VAC-039: al editar la vacante de un admin se le intentaba cobrar (402) o
 *    se le "devolvían" créditos que nunca pagó.
 *
 * Se ejercitan los handlers REALES.
 */

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
    $transaction: jest.fn(),
  },
}));

jest.mock('next/headers', () => ({ cookies: jest.fn() }));

import { GET, PATCH, DELETE, PUT } from '@/app/api/jobs/[id]/route';
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

function setCookie(token?: string): void {
  mockCookies.mockResolvedValue({
    get: (name: string) => (name === 'auth-token' && token ? { value: token } : undefined),
  });
}

/** Sesión cuya fila en la base devuelve `isActive`. */
function sesion(id: number, role: string, isActive: boolean, credits = 0): void {
  mockPrisma.user.findUnique.mockResolvedValue({
    id,
    email: `u${id}@x.com`,
    nombre: 'N',
    apellidoPaterno: null,
    apellidoMaterno: null,
    role,
    isActive,
    credits,
    specialty: null,
  });
  setCookie(generateToken({ userId: id, email: `u${id}@x.com`, role }));
}

const ctx = (id: string) => ({ params: Promise.resolve({ id }) });
const req = (body: unknown = {}) =>
  ({ json: async () => body, headers: { get: () => null } }) as unknown as Request;

beforeEach(() => {
  jest.clearAllMocks();
  mockPrisma.$transaction.mockImplementation(async (cb: any) => cb(mockPrisma));
  mockPrisma.job.update.mockResolvedValue({ id: 10 });
  mockPrisma.job.updateMany.mockResolvedValue({ count: 1 });
  mockPrisma.specialty.findFirst.mockResolvedValue({ name: 'Tecnología', subcategories: [] });
});

describe('VAC-017 — la autorización se comprueba contra la base, no contra el JWT', () => {
  it('una empresa DESACTIVADA con su cookie aún válida no puede hacer PATCH', async () => {
    mockPrisma.job.findUnique.mockResolvedValue({
      id: 10,
      userId: 5,
      status: 'active',
      editableUntil: null,
    });
    sesion(5, 'company', false); // desactivada por el admin

    const res = await PATCH(req({ status: 'paused' }), ctx('10'));

    expect(res.status).toBe(403);
    expect(mockPrisma.job.update).not.toHaveBeenCalled();
  });

  it('una empresa ACTIVA y dueña sí puede pausar su vacante', async () => {
    mockPrisma.job.findUnique.mockResolvedValue({
      id: 10,
      userId: 5,
      status: 'active',
      editableUntil: null,
    });
    sesion(5, 'company', true);

    const res = await PATCH(req({ status: 'paused' }), ctx('10'));

    expect(res.status).toBe(200);
    expect(mockPrisma.job.update).toHaveBeenCalledTimes(1);
  });

  it('un usuario desactivado tampoco puede BORRAR', async () => {
    mockPrisma.job.findUnique.mockResolvedValue({
      id: 10,
      userId: 5,
      status: 'draft',
      _count: { applications: 0 },
    });
    sesion(5, 'company', false);

    const res = await DELETE(req(), ctx('10'));

    expect(res.status).toBe(403);
    expect(mockPrisma.job.delete).not.toHaveBeenCalled();
  });
});

describe('VAC-018 — el DELETE no puede arrasar con las postulaciones', () => {
  it('la empresa NO puede borrar una vacante activa: 409', async () => {
    mockPrisma.job.findUnique.mockResolvedValue({
      id: 10,
      userId: 5,
      status: 'active',
      _count: { applications: 40 },
    });
    sesion(5, 'company', true);

    const res = await DELETE(req(), ctx('10'));

    expect(res.status).toBe(409);
    expect(mockPrisma.job.delete).not.toHaveBeenCalled();
  });

  it('la empresa NO puede borrar un borrador que ya tiene postulaciones: 409', async () => {
    mockPrisma.job.findUnique.mockResolvedValue({
      id: 10,
      userId: 5,
      status: 'draft',
      _count: { applications: 3 },
    });
    sesion(5, 'company', true);

    const res = await DELETE(req(), ctx('10'));

    expect(res.status).toBe(409);
    expect(mockPrisma.job.delete).not.toHaveBeenCalled();
  });

  it('la empresa SÍ puede borrar su borrador vacío', async () => {
    mockPrisma.job.findUnique.mockResolvedValue({
      id: 10,
      userId: 5,
      status: 'draft',
      _count: { applications: 0 },
    });
    sesion(5, 'company', true);
    mockPrisma.job.delete.mockResolvedValue({ id: 10 });

    const res = await DELETE(req(), ctx('10'));

    expect(res.status).toBe(200);
    expect(mockPrisma.job.delete).toHaveBeenCalledTimes(1);
  });
});

describe('VAC-023 — la ficha de una vacante no publicada no es pública', () => {
  it('un anónimo que enumera ids recibe 404 para un borrador', async () => {
    setCookie(undefined);
    mockPrisma.job.findUnique.mockResolvedValue({
      id: 10,
      userId: 5,
      status: 'draft',
      title: 'Plan de contratación secreto',
      isConfidential: false,
      expiresAt: null,
      user: null,
    });

    const res = await GET(req(), ctx('10'));

    expect(res.status).toBe(404);
  });

  it('un anónimo recibe 404 para una vacante ya expirada', async () => {
    setCookie(undefined);
    mockPrisma.job.findUnique.mockResolvedValue({
      id: 10,
      userId: 5,
      status: 'active',
      isConfidential: false,
      expiresAt: new Date(Date.now() - 1000),
      user: null,
    });

    const res = await GET(req(), ctx('10'));

    expect(res.status).toBe(404);
  });

  it('el propietario sí ve su borrador', async () => {
    sesion(5, 'company', true);
    mockPrisma.job.findUnique.mockResolvedValue({
      id: 10,
      userId: 5,
      status: 'draft',
      isConfidential: false,
      expiresAt: null,
      notasInternas: 'interno',
      user: null,
    });

    const res = await GET(req(), ctx('10'));

    expect(res.status).toBe(200);
  });

  it('un anónimo sí ve una vacante activa y vigente', async () => {
    setCookie(undefined);
    mockPrisma.job.findUnique.mockResolvedValue({
      id: 10,
      userId: 5,
      status: 'active',
      isConfidential: false,
      expiresAt: null,
      notasInternas: 'interno',
      user: null,
    });

    const res = await GET(req(), ctx('10'));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.data.notasInternas).toBeUndefined();
  });
});

describe('VAC-039 — editar la vacante de un admin no le cobra ni le regala créditos', () => {
  const cuerpoEdicion = {
    title: 'Dev',
    company: 'ACME',
    location: 'CDMX',
    salary: '$1',
    jobType: 'Tiempo Completo',
    description: 'd',
    profile: 'Tecnología',
    seniority: 'Director',
    workMode: 'remote',
  };

  it('no se crea ningún asiento de crédito cuando el dueño es admin', async () => {
    sesion(1, 'admin', true, 0);
    mockPrisma.job.findUnique.mockResolvedValue({
      id: 10,
      userId: 1,
      status: 'active',
      editableUntil: null,
      creditCost: 5,
      profile: 'Tecnología',
      seniority: 'Jr',
      workMode: 'remote',
      title: 'Dev',
      salaryMin: null,
    });
    // El propietario (el admin) se lee después con findUnique; devuelve rol admin.
    mockPrisma.pricingMatrix.findFirst.mockResolvedValue({ id: 1, credits: 25, minSalary: null });

    const res = await PUT(req(cuerpoEdicion), ctx('10'));

    expect(res.status).toBe(200);
    expect(mockPrisma.creditTransaction.create).not.toHaveBeenCalled();
    expect(mockPrisma.user.updateMany).not.toHaveBeenCalled();
    expect(mockPrisma.user.update).not.toHaveBeenCalled();
  });
});
