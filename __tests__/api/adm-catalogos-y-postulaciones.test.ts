// RUTA: __tests__/api/adm-catalogos-y-postulaciones.test.ts

/**
 * Auditoría 2026-09 · módulo admin — especialidades, precios, paquetes y
 * postulaciones directas.
 *
 * ADM-039: PUT de postulaciones directas pisaba estados avanzados y no marcaba
 *          reviewedAt.
 * ADM-046/047: el rename de especialidad movía la matriz de precios ANTES de
 *          comprobar el slug, y sin transacción.
 * ADM-048: el rename sólo propagaba a PricingMatrix (no a Job/Candidate/User).
 * ADM-049: el DELETE sólo miraba vacantes y borraba sin transacción.
 * ADM-050b: /api/admin/candidates/[id]/reset-password crea User y lo vincula
 *          en una transacción e invalida el resetToken (ADM-081).
 * ADM-086: credit-packages aceptaba NaN y nombre vacío.
 * ADM-087: direct-applications repetía la comprobación por header.
 * ADM-091: pricing PUT aceptaba 0 créditos y decimales.
 * ADM-094: los GET de especialidades no llamaban a requireRole.
 * ADM-095: el alta de especialidad no era atómica.
 */

jest.mock('next/server', () => ({
  NextResponse: {
    json: (data: any, options?: any) => ({
      status: options?.status || 200,
      json: async () => data,
    }),
  },
}));

const tx = {
  specialty: { create: jest.fn(), update: jest.fn(), delete: jest.fn() },
  pricingMatrix: { createMany: jest.fn(), updateMany: jest.fn(), deleteMany: jest.fn(), findMany: jest.fn() },
  job: { updateMany: jest.fn() },
  candidate: { updateMany: jest.fn(), update: jest.fn() },
  user: { updateMany: jest.fn(), create: jest.fn() },
};

jest.mock('@/lib/prisma', () => ({
  prisma: {
    specialty: { findUnique: jest.fn(), findFirst: jest.fn(), findMany: jest.fn(), create: jest.fn(), update: jest.fn(), delete: jest.fn() },
    pricingMatrix: { findUnique: jest.fn(), findMany: jest.fn(), update: jest.fn(), deleteMany: jest.fn(), createMany: jest.fn(), updateMany: jest.fn(), groupBy: jest.fn() },
    job: { count: jest.fn(), findMany: jest.fn(), updateMany: jest.fn() },
    candidate: { count: jest.fn(), findUnique: jest.fn(), update: jest.fn() },
    user: { count: jest.fn(), findUnique: jest.fn(), create: jest.fn() },
    creditPackage: { findMany: jest.fn(), findUnique: jest.fn(), findFirst: jest.fn(), create: jest.fn(), update: jest.fn() },
    application: { findMany: jest.fn(), findUnique: jest.fn(), count: jest.fn(), updateMany: jest.fn(), update: jest.fn() },
    jobAssignment: { findUnique: jest.fn() },
    $transaction: jest.fn(),
  },
}));

jest.mock('@/lib/auth', () => ({
  requireRole: jest.fn(),
  requireAuth: jest.fn(),
}));

jest.mock('bcryptjs', () => ({
  __esModule: true,
  default: { hash: jest.fn(async () => 'hash-falso') },
  hash: jest.fn(async () => 'hash-falso'),
}));

import { requireRole } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { GET as specialtiesGet, POST as specialtiesPost } from '@/app/api/admin/specialties/route';
import {
  GET as specialtyGet,
  PUT as specialtyPut,
  DELETE as specialtyDelete,
} from '@/app/api/admin/specialties/[id]/route';
import { PUT as pricingPut } from '@/app/api/admin/pricing/route';
import { POST as packagePost } from '@/app/api/admin/credit-packages/route';
import { PUT as directPut } from '@/app/api/admin/direct-applications/route';
import { POST as resetPasswordPost } from '@/app/api/admin/candidates/[id]/reset-password/route';

const mockRequireRole = requireRole as jest.Mock;
const mockSpecialty = (prisma as any).specialty;
const mockPricing = (prisma as any).pricingMatrix;
const mockJob = (prisma as any).job;
const mockCandidate = (prisma as any).candidate;
const mockUser = (prisma as any).user;
const mockPackage = (prisma as any).creditPackage;
const mockApplication = (prisma as any).application;
const mockTransaction = (prisma as any).$transaction as jest.Mock;

const ADMIN = { user: { id: 1, email: 'admin@inakat.com', role: 'admin' } };

function pedir(url: string, method = 'GET', body?: any) {
  return new Request(url, {
    method,
    body: body ? JSON.stringify(body) : undefined,
  });
}

const params = (id: string) => ({ params: Promise.resolve({ id }) });

beforeEach(() => {
  jest.resetAllMocks();
  mockRequireRole.mockResolvedValue(ADMIN);
  Object.values(tx).forEach((modelo) =>
    Object.values(modelo).forEach((fn: any) => fn.mockReset())
  );
  mockTransaction.mockImplementation(async (cb: any) => cb(tx));
});

describe('/api/admin/specialties — catálogo de especialidades', () => {
  describe('ADM-094 · defensa en profundidad', () => {
    it('GET del listado rechaza si requireRole devuelve error', async () => {
      mockRequireRole.mockResolvedValue({ error: 'Acceso denegado', status: 403 });

      const res = await specialtiesGet(pedir('http://localhost/api/admin/specialties'));

      expect(res.status).toBe(403);
      expect(mockSpecialty.findMany).not.toHaveBeenCalled();
    });

    it('GET por id rechaza si requireRole devuelve error', async () => {
      mockRequireRole.mockResolvedValue({ error: 'No autenticado', status: 401 });

      const res = await specialtyGet(
        pedir('http://localhost/api/admin/specialties/3'),
        params('3')
      );

      expect(res.status).toBe(401);
      expect(mockSpecialty.findUnique).not.toHaveBeenCalled();
    });
  });

  describe('ADM-095 · alta atómica', () => {
    it('specialty.create y pricingMatrix se ejecutan dentro de la transacción', async () => {
      mockSpecialty.findUnique.mockResolvedValue(null);
      mockSpecialty.findFirst.mockResolvedValue(null);
      tx.specialty.create.mockResolvedValue({ id: 9, name: 'Marketing' });
      tx.pricingMatrix.findMany.mockResolvedValue([]);

      const res = await specialtiesPost(
        pedir('http://localhost/api/admin/specialties', 'POST', { name: 'Marketing', sortOrder: 3 })
      );
      const cuerpo = await res.json();

      expect(res.status).toBe(201);
      expect(mockTransaction).toHaveBeenCalled();
      expect(tx.specialty.create).toHaveBeenCalled();
      expect(mockSpecialty.create).not.toHaveBeenCalled();
      // 5 seniorities x 3 modalidades
      expect(tx.pricingMatrix.createMany.mock.calls[0][0].data).toHaveLength(15);
      expect(cuerpo.pricingGenerated).toBe(15);
    });

    it('rechaza un nombre sin caracteres alfanuméricos (slug vacío)', async () => {
      mockSpecialty.findUnique.mockResolvedValue(null);

      const res = await specialtiesPost(
        pedir('http://localhost/api/admin/specialties', 'POST', { name: '###' })
      );

      expect(res.status).toBe(400);
      expect(mockTransaction).not.toHaveBeenCalled();
    });

    it('rechaza subcategories que no es array', async () => {
      const res = await specialtiesPost(
        pedir('http://localhost/api/admin/specialties', 'POST', {
          name: 'Marketing',
          subcategories: 'SEO',
        })
      );

      expect(res.status).toBe(400);
    });
  });

  describe('ADM-046 / ADM-047 · rename: slug antes de mover precios', () => {
    it('un slug que colisiona devuelve 409 sin tocar la matriz de precios', async () => {
      mockSpecialty.findUnique.mockResolvedValue({
        id: 4,
        name: 'TI',
        slug: 'ti',
        description: null,
        icon: null,
        color: '#2b5d62',
        subcategories: [],
        sortOrder: 1,
        isActive: true,
      });
      mockSpecialty.findFirst
        .mockResolvedValueOnce(null) // no hay duplicado por nombre
        .mockResolvedValueOnce({ id: 8, name: 'Tecnologia', slug: 'tecnologia' }); // sí por slug

      const res = await specialtyPut(
        pedir('http://localhost/api/admin/specialties/4', 'PUT', { name: 'Tecnología' }),
        params('4')
      );

      expect(res.status).toBe(409);
      expect(mockTransaction).not.toHaveBeenCalled();
      expect(mockPricing.updateMany).not.toHaveBeenCalled();
      expect(tx.pricingMatrix.updateMany).not.toHaveBeenCalled();
    });

    it('rechaza un nombre de sólo espacios', async () => {
      mockSpecialty.findUnique.mockResolvedValue({ id: 4, name: 'TI', slug: 'ti' });

      const res = await specialtyPut(
        pedir('http://localhost/api/admin/specialties/4', 'PUT', { name: '   ' }),
        params('4')
      );

      expect(res.status).toBe(400);
      expect(mockTransaction).not.toHaveBeenCalled();
    });
  });

  describe('ADM-048 · el rename propaga a todo lo que referencia por nombre', () => {
    it('actualiza Job.profile, Candidate.profile y User.specialty en la transacción', async () => {
      mockSpecialty.findUnique.mockResolvedValue({
        id: 4,
        name: 'Tecnología',
        slug: 'tecnologia',
        description: null,
        icon: null,
        color: '#2b5d62',
        subcategories: [],
        sortOrder: 1,
        isActive: true,
      });
      mockSpecialty.findFirst.mockResolvedValue(null);
      tx.pricingMatrix.updateMany.mockResolvedValue({ count: 15 });
      tx.job.updateMany.mockResolvedValue({ count: 3 });
      tx.candidate.updateMany.mockResolvedValue({ count: 7 });
      tx.user.updateMany.mockResolvedValue({ count: 2 });
      tx.specialty.update.mockResolvedValue({ id: 4, name: 'Tecnología e IT' });

      const res = await specialtyPut(
        pedir('http://localhost/api/admin/specialties/4', 'PUT', { name: 'Tecnología e IT' }),
        params('4')
      );
      const cuerpo = await res.json();

      expect(tx.job.updateMany).toHaveBeenCalledWith({
        where: { profile: 'Tecnología' },
        data: { profile: 'Tecnología e IT' },
      });
      expect(tx.candidate.updateMany).toHaveBeenCalledWith({
        where: { profile: 'Tecnología' },
        data: { profile: 'Tecnología e IT' },
      });
      expect(tx.user.updateMany).toHaveBeenCalledWith({
        where: { specialty: 'Tecnología' },
        data: { specialty: 'Tecnología e IT' },
      });
      expect(cuerpo.propagated).toEqual({ pricing: 15, jobs: 3, candidates: 7, users: 2 });
    });
  });

  describe('ADM-049 · el DELETE mira candidatos y especialistas', () => {
    it('devuelve 409 con el desglose si hay candidatos usándola', async () => {
      mockSpecialty.findUnique.mockResolvedValue({ id: 4, name: 'Educación' });
      mockJob.count.mockResolvedValue(0);
      mockCandidate.count.mockResolvedValue(12);
      mockUser.count.mockResolvedValue(3);

      const res = await specialtyDelete(
        pedir('http://localhost/api/admin/specialties/4', 'DELETE'),
        params('4')
      );
      const cuerpo = await res.json();

      expect(res.status).toBe(409);
      expect(cuerpo.inUse).toEqual({ jobs: 0, candidates: 12, specialists: 3 });
      expect(mockTransaction).not.toHaveBeenCalled();
    });

    it('borra precios y especialidad en la misma transacción cuando nadie la usa', async () => {
      mockSpecialty.findUnique.mockResolvedValue({ id: 4, name: 'Educación' });
      mockJob.count.mockResolvedValue(0);
      mockCandidate.count.mockResolvedValue(0);
      mockUser.count.mockResolvedValue(0);
      tx.pricingMatrix.deleteMany.mockResolvedValue({ count: 15 });

      const res = await specialtyDelete(
        pedir('http://localhost/api/admin/specialties/4', 'DELETE'),
        params('4')
      );

      expect(res.status).toBe(200);
      expect(tx.pricingMatrix.deleteMany).toHaveBeenCalled();
      expect(tx.specialty.delete).toHaveBeenCalledWith({ where: { id: 4 } });
      expect(mockSpecialty.delete).not.toHaveBeenCalled();
    });
  });
});

describe('/api/admin/pricing — ADM-091', () => {
  const ENTRADA = {
    id: 4,
    profile: 'Tecnología',
    seniority: 'Sr',
    workMode: 'remote',
    credits: 10,
    isActive: true,
  };

  it('rechaza 0 créditos (publicación gratis)', async () => {
    mockPricing.findUnique.mockResolvedValue(ENTRADA);

    const res = await pricingPut(
      pedir('http://localhost/api/admin/pricing', 'PUT', { id: 4, credits: 0 })
    );

    expect(res.status).toBe(400);
    expect(mockPricing.update).not.toHaveBeenCalled();
  });

  it('rechaza créditos decimales (el campo es Int)', async () => {
    mockPricing.findUnique.mockResolvedValue(ENTRADA);

    const res = await pricingPut(
      pedir('http://localhost/api/admin/pricing', 'PUT', { id: 4, credits: 2.5 })
    );

    expect(res.status).toBe(400);
  });

  it('id no numérico responde 400 sin consultar Prisma', async () => {
    const res = await pricingPut(
      pedir('http://localhost/api/admin/pricing', 'PUT', { id: 'x', credits: 3 })
    );

    expect(res.status).toBe(400);
    expect(mockPricing.findUnique).not.toHaveBeenCalled();
  });

  it('rechaza isActive no booleano', async () => {
    mockPricing.findUnique.mockResolvedValue(ENTRADA);

    const res = await pricingPut(
      pedir('http://localhost/api/admin/pricing', 'PUT', { id: 4, isActive: 'false' })
    );

    expect(res.status).toBe(400);
  });

  it('al desactivar informa cuántas vacantes vivas usan esa combinación', async () => {
    mockPricing.findUnique.mockResolvedValue(ENTRADA);
    mockJob.count.mockResolvedValue(6);
    mockPricing.update.mockResolvedValue({ ...ENTRADA, isActive: false });

    const res = await pricingPut(
      pedir('http://localhost/api/admin/pricing', 'PUT', { id: 4, isActive: false })
    );
    const cuerpo = await res.json();

    expect(cuerpo.affectedJobs).toBe(6);
  });
});

describe('/api/admin/credit-packages — ADM-086 / ADM-038', () => {
  it('rechaza credits no numérico en vez de guardar NaN', async () => {
    const res = await packagePost(
      pedir('http://localhost/api/admin/credit-packages', 'POST', {
        name: 'Pack',
        credits: 'diez',
        price: 100,
      })
    );

    expect(res.status).toBe(400);
    expect(mockPackage.create).not.toHaveBeenCalled();
  });

  it('rechaza créditos decimales (pricePerCredit quedaba incoherente)', async () => {
    const res = await packagePost(
      pedir('http://localhost/api/admin/credit-packages', 'POST', {
        name: 'Pack',
        credits: 2.5,
        price: 10000,
      })
    );

    expect(res.status).toBe(400);
  });

  it('rechaza nombre en blanco', async () => {
    const res = await packagePost(
      pedir('http://localhost/api/admin/credit-packages', 'POST', {
        name: '   ',
        credits: 10,
        price: 35000,
      })
    );

    expect(res.status).toBe(400);
  });

  it('rechaza con 409 un segundo paquete activo con los mismos créditos', async () => {
    mockPackage.findFirst.mockResolvedValue({ id: 2, name: 'Pack 10', credits: 10 });

    const res = await packagePost(
      pedir('http://localhost/api/admin/credit-packages', 'POST', {
        name: 'Pack 10 bis',
        credits: 10,
        price: 38000,
      })
    );

    expect(res.status).toBe(409);
    expect(mockPackage.create).not.toHaveBeenCalled();
  });

  it('calcula pricePerCredit con los valores normalizados', async () => {
    mockPackage.findFirst.mockResolvedValue(null);
    mockPackage.create.mockResolvedValue({ id: 3 });

    await packagePost(
      pedir('http://localhost/api/admin/credit-packages', 'POST', {
        name: 'Pack 10',
        credits: 10,
        price: 35000,
      })
    );

    expect(mockPackage.create.mock.calls[0][0].data.pricePerCredit).toBe(3500);
  });
});

describe('/api/admin/direct-applications — ADM-039 / ADM-087', () => {
  it('reclama la postulación sólo si sigue pendiente y devuelve 409 si no', async () => {
    mockApplication.findUnique.mockResolvedValue({
      id: 40,
      jobId: 7,
      status: 'sent_to_specialist',
    });
    mockApplication.updateMany.mockResolvedValue({ count: 0 });

    const res = await directPut(
      pedir('http://localhost/api/admin/direct-applications', 'PUT', {
        applicationId: 40,
        newStatus: 'discarded',
      })
    );

    expect(res.status).toBe(409);
    expect(mockApplication.updateMany.mock.calls[0][0].where).toEqual({
      id: 40,
      status: 'pending',
    });
    expect(mockApplication.update).not.toHaveBeenCalled();
  });

  it('al pasar a reviewing marca reviewedAt', async () => {
    mockApplication.findUnique
      .mockResolvedValueOnce({ id: 40, jobId: 7, status: 'pending' })
      .mockResolvedValueOnce({ id: 40, job: { title: 'Backend', company: 'ACME' } });
    mockApplication.updateMany.mockResolvedValue({ count: 1 });
    (prisma as any).jobAssignment.findUnique.mockResolvedValue({ id: 1 });

    const res = await directPut(
      pedir('http://localhost/api/admin/direct-applications', 'PUT', {
        applicationId: 40,
        newStatus: 'reviewing',
      })
    );

    expect(res.status).toBe(200);
    expect(mockApplication.updateMany.mock.calls[0][0].data.reviewedAt).toBeInstanceOf(Date);
  });

  it('applicationId no numérico responde 400', async () => {
    const res = await directPut(
      pedir('http://localhost/api/admin/direct-applications', 'PUT', {
        applicationId: 'abc',
        newStatus: 'reviewing',
      })
    );

    expect(res.status).toBe(400);
    expect(mockApplication.findUnique).not.toHaveBeenCalled();
  });

  it('ADM-087: un admin legítimo pasa aunque no haya header x-user-role', async () => {
    mockApplication.findUnique
      .mockResolvedValueOnce({ id: 40, jobId: 7, status: 'pending' })
      .mockResolvedValueOnce({ id: 40, job: { title: 'Backend', company: 'ACME' } });
    mockApplication.updateMany.mockResolvedValue({ count: 1 });

    const res = await directPut(
      pedir('http://localhost/api/admin/direct-applications', 'PUT', {
        applicationId: 40,
        newStatus: 'archived',
      })
    );

    expect(res.status).toBe(200);
  });
});

describe('/api/admin/candidates/[id]/reset-password — ADM-037 / ADM-081', () => {
  it('el reset invalida el resetToken pendiente', async () => {
    mockCandidate.findUnique.mockResolvedValue({
      id: 7,
      email: 'ana@test.com',
      nombre: 'Ana',
      apellidoPaterno: 'López',
      apellidoMaterno: null,
      userId: 42,
    });
    mockUser.update = jest.fn().mockResolvedValue({ id: 42 });

    await resetPasswordPost(
      pedir('http://localhost/api/admin/candidates/7/reset-password', 'POST', {
        password: 'ContraseñaNueva1',
      }),
      params('7')
    );

    const datos = mockUser.update.mock.calls[0][0].data;
    expect(datos.resetToken).toBeNull();
    expect(datos.resetTokenExpiry).toBeNull();
  });

  it('crear la cuenta y vincularla ocurre dentro de una transacción', async () => {
    mockCandidate.findUnique.mockResolvedValue({
      id: 7,
      email: 'ana@test.com',
      nombre: 'Ana',
      apellidoPaterno: 'López',
      apellidoMaterno: null,
      userId: null,
    });
    mockUser.findUnique.mockResolvedValue(null);
    tx.user.create.mockResolvedValue({ id: 50 });

    const res = await resetPasswordPost(
      pedir('http://localhost/api/admin/candidates/7/reset-password', 'POST', {
        password: 'ContraseñaNueva1',
      }),
      params('7')
    );

    expect(res.status).toBe(200);
    expect(mockTransaction).toHaveBeenCalled();
    expect(tx.user.create).toHaveBeenCalled();
    expect(tx.candidate.update).toHaveBeenCalledWith({
      where: { id: 7 },
      data: { userId: 50 },
    });
    expect(mockUser.create).not.toHaveBeenCalled();
  });
});
