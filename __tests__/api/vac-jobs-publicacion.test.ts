/**
 * @jest-environment node
 */
/**
 * VAC-005 / VAC-007 / VAC-019 / VAC-020 / VAC-021 / VAC-040 — PUT /api/jobs/publish.
 *
 * Lo que estaba roto al publicar un borrador:
 *  - El `findUnique` "para bloquear la fila" no bloquea nada (PostgreSQL, READ
 *    COMMITTED): dos publicaciones simultáneas leían el mismo saldo, ambas
 *    pasaban el `if` y ambos `decrement` se aplicaban -> saldo negativo.
 *  - La comprobación de 'draft' y la activación estaban FUERA de la transacción
 *    del cobro: doble clic = dos cobros y una sola vacante publicada; y si la
 *    activación fallaba, los créditos se perdían con la vacante en borrador.
 *  - El costo sólo se calculaba `if (profile && seniority && workMode)`: un
 *    borrador sin seniority se publicaba GRATIS.
 *  - El GET era anónimo, sin paginar y con includeDrafts/status/userId libres.
 *  - El POST era un duplicado sin consumidores que se saltaba las validaciones
 *    de POST /api/jobs.
 *
 * Se ejercita el handler REAL con prisma mockeado.
 */

export {};

process.env.JWT_SECRET =
  process.env.JWT_SECRET || 'test-secret-con-mas-de-treinta-y-dos-caracteres-123';

jest.mock('@/lib/prisma', () => ({
  prisma: {
    job: { findUnique: jest.fn(), findMany: jest.fn(), count: jest.fn(), updateMany: jest.fn() },
    user: { findUnique: jest.fn(), updateMany: jest.fn() },
    creditTransaction: { create: jest.fn() },
    pricingMatrix: { findFirst: jest.fn() },
    $transaction: jest.fn(),
  },
}));

jest.mock('next/headers', () => ({ cookies: jest.fn() }));

import * as publishRoute from '@/app/api/jobs/publish/route';
import { prisma } from '@/lib/prisma';
import { cookies } from 'next/headers';
import { generateToken } from '@/lib/auth';

const mockPrisma = prisma as unknown as {
  job: { findUnique: jest.Mock; findMany: jest.Mock; count: jest.Mock; updateMany: jest.Mock };
  user: { findUnique: jest.Mock; updateMany: jest.Mock };
  creditTransaction: { create: jest.Mock };
  pricingMatrix: { findFirst: jest.Mock };
  $transaction: jest.Mock;
};
const mockCookies = cookies as unknown as jest.Mock;

/** Ejecuta el callback de la transacción contra los mismos mocks (tx === prisma). */
function transaccionReal(): void {
  mockPrisma.$transaction.mockImplementation(async (cb: any) => cb(mockPrisma));
}

function sesionEmpresa(credits: number): void {
  mockPrisma.user.findUnique.mockResolvedValue({
    id: 5,
    email: 'empresa@x.com',
    nombre: 'Empresa',
    apellidoPaterno: null,
    apellidoMaterno: null,
    role: 'company',
    isActive: true,
    credits,
    specialty: null,
    // EMP-002: publicar exige empresa aprobada (requireApprovedCompany).
    companyRequest: { status: 'approved' },
  });
  mockCookies.mockResolvedValue({
    get: (name: string) =>
      name === 'auth-token'
        ? { value: generateToken({ userId: 5, email: 'empresa@x.com', role: 'company' }) }
        : undefined,
  });
}

function borrador(extra: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: 10,
    userId: 5,
    title: 'Dev',
    status: 'draft',
    profile: 'Tecnología',
    seniority: 'Sr',
    workMode: 'remote',
    creditCost: 0,
    ...extra,
  };
}

function req(body: unknown): Request {
  return { json: async () => body } as unknown as Request;
}

beforeEach(() => {
  jest.clearAllMocks();
  transaccionReal();
  mockPrisma.pricingMatrix.findFirst.mockResolvedValue({ id: 1, credits: 10, minSalary: null });
  mockPrisma.job.updateMany.mockResolvedValue({ count: 1 });
  mockPrisma.user.updateMany.mockResolvedValue({ count: 1 });
  mockPrisma.creditTransaction.create.mockResolvedValue({});
});

describe('PUT /api/jobs/publish — activar y cobrar van en la misma transacción', () => {
  it('reclama el borrador con un updateMany condicionado a status draft', async () => {
    sesionEmpresa(50);
    mockPrisma.job.findUnique
      .mockResolvedValueOnce(borrador())
      .mockResolvedValue({ ...borrador(), status: 'active' });

    const res = await publishRoute.PUT(req({ jobId: 10 }));

    expect(res.status).toBe(200);
    const claim = mockPrisma.job.updateMany.mock.calls[0][0] as {
      where: { id: number; status: string };
      data: { status: string; creditCost: number };
    };
    expect(claim.where).toEqual({ id: 10, status: 'draft' });
    expect(claim.data.status).toBe('active');
    // Y ocurre DENTRO de la transacción.
    expect(mockPrisma.$transaction).toHaveBeenCalledTimes(1);
  });

  it('si el borrador ya no está en draft (doble clic) responde 409 y no cobra', async () => {
    sesionEmpresa(50);
    mockPrisma.job.findUnique.mockResolvedValue(borrador());
    mockPrisma.job.updateMany.mockResolvedValue({ count: 0 }); // otra petición ganó

    const res = await publishRoute.PUT(req({ jobId: 10 }));

    expect(res.status).toBe(409);
    expect(mockPrisma.user.updateMany).not.toHaveBeenCalled();
    expect(mockPrisma.creditTransaction.create).not.toHaveBeenCalled();
  });

  it('el saldo se reclama con una condición atómica (credits >= costo), no con una lectura previa', async () => {
    sesionEmpresa(50);
    mockPrisma.job.findUnique
      .mockResolvedValueOnce(borrador())
      .mockResolvedValue({ ...borrador(), status: 'active' });

    await publishRoute.PUT(req({ jobId: 10 }));

    const cobro = mockPrisma.user.updateMany.mock.calls[0][0] as {
      where: { id: number; credits: { gte: number } };
      data: { credits: { decrement: number } };
    };
    expect(cobro.where.credits.gte).toBe(10);
    expect(cobro.data.credits.decrement).toBe(10);
  });

  it('si el saldo no alcanza responde 402 y la transacción revierte (no queda publicada)', async () => {
    sesionEmpresa(3);
    mockPrisma.job.findUnique.mockResolvedValue(borrador());
    mockPrisma.user.updateMany.mockResolvedValue({ count: 0 }); // no alcanzó
    // La transacción real haría rollback; aquí se comprueba que LANZA.
    mockPrisma.$transaction.mockImplementation(async (cb: any) => {
      try {
        return await cb(mockPrisma);
      } catch (e) {
        // rollback simulado: el reclamo de la vacante se deshace
        mockPrisma.job.updateMany.mockClear();
        throw e;
      }
    });

    const res = await publishRoute.PUT(req({ jobId: 10 }));

    expect(res.status).toBe(402);
    expect(mockPrisma.creditTransaction.create).not.toHaveBeenCalled();
  });
});

describe('PUT /api/jobs/publish — no se publica gratis ni por debajo de precio', () => {
  it('rechaza un borrador sin seniority en vez de publicarlo con costo 0', async () => {
    sesionEmpresa(50);
    mockPrisma.job.findUnique.mockResolvedValue(borrador({ seniority: null }));

    const res = await publishRoute.PUT(req({ jobId: 10 }));
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.missing).toContain('seniority');
    expect(mockPrisma.job.updateMany).not.toHaveBeenCalled();
  });

  it('rechaza una combinación que no está en la matriz (no cobra el precio por defecto)', async () => {
    sesionEmpresa(50);
    mockPrisma.job.findUnique.mockResolvedValue(borrador({ seniority: 'Director.' }));
    mockPrisma.pricingMatrix.findFirst.mockResolvedValue(null); // found: false

    const res = await publishRoute.PUT(req({ jobId: 10 }));

    expect(res.status).toBe(400);
    expect(mockPrisma.user.updateMany).not.toHaveBeenCalled();
  });
});

describe('/api/jobs/publish — superficie de la ruta', () => {
  it('ya no expone un POST (era un duplicado más débil de POST /api/jobs)', () => {
    expect((publishRoute as Record<string, unknown>).POST).toBeUndefined();
  });

  it('el GET pagina y, sin sesión, fuerza status active', async () => {
    mockCookies.mockResolvedValue({ get: () => undefined });
    mockPrisma.job.findMany.mockResolvedValue([]);
    mockPrisma.job.count.mockResolvedValue(0);

    await publishRoute.GET(
      new Request('http://localhost/api/jobs/publish?includeDrafts=true&userId=5')
    );

    const call = mockPrisma.job.findMany.mock.calls[0][0] as {
      where: { status: string; userId?: number };
      take: number;
    };
    expect(call.where.status).toBe('active');
    expect(call.where.userId).toBeUndefined();
    expect(Number.isFinite(call.take)).toBe(true);
  });
});
