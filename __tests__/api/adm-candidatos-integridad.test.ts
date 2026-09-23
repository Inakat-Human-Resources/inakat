// RUTA: __tests__/api/adm-candidatos-integridad.test.ts

/**
 * Auditoría 2026-09 · módulo admin — /api/admin/candidates
 *
 * ADM-005 / ADM-031: el formulario enviaba cartaPresentacion, fotoUrl, ciudad,
 *          estado y subcategory, y POST/PUT los descartaban en silencio.
 * ADM-032: PUT aceptaba nombre y email vacíos y cualquier status.
 * ADM-033: cambiar el email dejaba las Applications huérfanas (se enlazan por
 *          candidateEmail, no por id).
 * ADM-034: el reemplazo de experiencias borraba primero y validaba después.
 * ADM-035/083: borrar el candidato dejaba activa su cuenta de usuario.
 * ADM-036: la búsqueda por nombre completo devolvía 0 resultados.
 * ADM-037: el User se creaba fuera de transacción -> User huérfano.
 * ADM-079: cvUrl / fotoUrl / documentos sin validar esquema http(s).
 * ADM-084: filtros numéricos no numéricos -> 500.
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
  user: { create: jest.fn(), update: jest.fn(), findUnique: jest.fn() },
  candidate: { create: jest.fn(), update: jest.fn(), delete: jest.fn() },
  experience: { deleteMany: jest.fn(), createMany: jest.fn() },
  candidateDocument: { createMany: jest.fn() },
  application: { updateMany: jest.fn() },
};

jest.mock('@/lib/prisma', () => ({
  prisma: {
    candidate: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    user: { findUnique: jest.fn(), create: jest.fn(), update: jest.fn() },
    experience: { deleteMany: jest.fn(), createMany: jest.fn() },
    application: { updateMany: jest.fn() },
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
import { GET as candidatesGet, POST as candidatesPost } from '@/app/api/admin/candidates/route';
import {
  PUT as candidatePut,
  DELETE as candidateDelete,
} from '@/app/api/admin/candidates/[id]/route';

const mockRequireRole = requireRole as jest.Mock;
const mockCandidate = (prisma as any).candidate;
const mockUser = (prisma as any).user;
const mockExperience = (prisma as any).experience;
const mockTransaction = (prisma as any).$transaction as jest.Mock;

const ADMIN = { user: { id: 1, email: 'admin@inakat.com', role: 'admin' } };

function pedir(url: string, method = 'GET', body?: any) {
  return new Request(url, {
    method,
    body: body ? JSON.stringify(body) : undefined,
  });
}

const params = (id: string) => ({ params: Promise.resolve({ id }) });

describe('/api/admin/candidates — integridad de datos', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRequireRole.mockResolvedValue(ADMIN);
    Object.values(tx).forEach((modelo) =>
      Object.values(modelo).forEach((fn: any) => fn.mockReset())
    );
    // Por defecto la transacción ejecuta el callback con los mocks de tx
    mockTransaction.mockImplementation(async (cb: any) => cb(tx));
  });

  describe('ADM-005 / ADM-031 · campos que se descartaban en silencio', () => {
    it('POST guarda cartaPresentacion, subcategory y ubicación', async () => {
      mockCandidate.findUnique.mockResolvedValue(null);
      tx.candidate.create.mockResolvedValue({ id: 1 });

      const res = await candidatesPost(
        pedir('http://localhost/api/admin/candidates', 'POST', {
          nombre: 'Ana',
          apellidoPaterno: 'López',
          email: 'ana@test.com',
          cartaPresentacion: 'Me interesa mucho el puesto',
          subcategory: 'Frontend',
          ciudad: 'Monterrey',
          estado: 'Nuevo León',
        })
      );

      expect(res.status).toBe(201);
      const datos = tx.candidate.create.mock.calls[0][0].data;
      expect(datos.cartaPresentacion).toBe('Me interesa mucho el puesto');
      expect(datos.subcategory).toBe('Frontend');
      expect(datos.ciudad).toBe('Monterrey');
      expect(datos.estado).toBe('Nuevo León');
    });

    it('PUT guarda cartaPresentacion y fotoUrl', async () => {
      mockCandidate.findUnique.mockResolvedValue({
        id: 7,
        email: 'ana@test.com',
        userId: null,
        experiences: [],
      });
      tx.candidate.update.mockResolvedValue({ id: 7 });

      await candidatePut(
        pedir('http://localhost/api/admin/candidates/7', 'PUT', {
          cartaPresentacion: 'Carta nueva',
          fotoUrl: 'https://blob.example.com/foto.png',
        }),
        params('7')
      );

      const datos = tx.candidate.update.mock.calls[0][0].data;
      expect(datos.cartaPresentacion).toBe('Carta nueva');
      expect(datos.fotoUrl).toBe('https://blob.example.com/foto.png');
    });
  });

  describe('ADM-032 · validación del PUT', () => {
    it('rechaza email vacío en vez de guardarlo', async () => {
      mockCandidate.findUnique.mockResolvedValue({
        id: 7,
        email: 'ana@test.com',
        userId: null,
        experiences: [],
      });

      const res = await candidatePut(
        pedir('http://localhost/api/admin/candidates/7', 'PUT', { email: '' }),
        params('7')
      );

      expect(res.status).toBe(400);
      expect(tx.candidate.update).not.toHaveBeenCalled();
    });

    it('rechaza nombre vacío', async () => {
      mockCandidate.findUnique.mockResolvedValue({
        id: 7,
        email: 'ana@test.com',
        userId: null,
        experiences: [],
      });

      const res = await candidatePut(
        pedir('http://localhost/api/admin/candidates/7', 'PUT', { nombre: '' }),
        params('7')
      );

      expect(res.status).toBe(400);
    });

    it('rechaza un status fuera del ciclo de vida del schema', async () => {
      mockCandidate.findUnique.mockResolvedValue({
        id: 7,
        email: 'ana@test.com',
        userId: null,
        experiences: [],
      });

      const res = await candidatePut(
        pedir('http://localhost/api/admin/candidates/7', 'PUT', { status: 'lo-que-sea' }),
        params('7')
      );

      expect(res.status).toBe(400);
    });
  });

  describe('ADM-033 · cambiar el email arrastra las postulaciones', () => {
    it('actualiza Application.candidateEmail y el User vinculado en la misma transacción', async () => {
      mockCandidate.findUnique
        .mockResolvedValueOnce({
          id: 7,
          email: 'viejo@test.com',
          userId: 42,
          experiences: [],
        })
        .mockResolvedValueOnce(null); // no hay otro candidato con el email nuevo
      mockUser.findUnique.mockResolvedValue(null);
      tx.candidate.update.mockResolvedValue({ id: 7 });

      await candidatePut(
        pedir('http://localhost/api/admin/candidates/7', 'PUT', { email: 'nuevo@test.com' }),
        params('7')
      );

      expect(tx.application.updateMany).toHaveBeenCalledWith({
        where: { candidateEmail: 'viejo@test.com' },
        data: { candidateEmail: 'nuevo@test.com' },
      });
      expect(tx.user.update).toHaveBeenCalledWith({
        where: { id: 42 },
        data: { email: 'nuevo@test.com' },
      });
    });

    it('rechaza con 409 si otro usuario ya tiene ese email', async () => {
      mockCandidate.findUnique
        .mockResolvedValueOnce({ id: 7, email: 'viejo@test.com', userId: 42, experiences: [] })
        .mockResolvedValueOnce(null);
      mockUser.findUnique.mockResolvedValue({ id: 99 });

      const res = await candidatePut(
        pedir('http://localhost/api/admin/candidates/7', 'PUT', { email: 'ocupado@test.com' }),
        params('7')
      );

      expect(res.status).toBe(409);
      expect(mockTransaction).not.toHaveBeenCalled();
    });
  });

  describe('ADM-034 · las experiencias se validan antes de borrar', () => {
    it('una fecha inválida devuelve 400 sin ejecutar deleteMany', async () => {
      mockCandidate.findUnique.mockResolvedValue({
        id: 7,
        email: 'ana@test.com',
        userId: null,
        experiences: [],
      });

      const res = await candidatePut(
        pedir('http://localhost/api/admin/candidates/7', 'PUT', {
          experiences: [{ empresa: 'X', puesto: 'Y', fechaInicio: '31/12/2020' }],
        }),
        params('7')
      );

      expect(res.status).toBe(400);
      expect(tx.experience.deleteMany).not.toHaveBeenCalled();
      expect(mockExperience.deleteMany).not.toHaveBeenCalled();
    });

    it('experiences null devuelve 400 (antes reventaba en .length)', async () => {
      mockCandidate.findUnique.mockResolvedValue({
        id: 7,
        email: 'ana@test.com',
        userId: null,
        experiences: [],
      });

      const res = await candidatePut(
        pedir('http://localhost/api/admin/candidates/7', 'PUT', { experiences: null }),
        params('7')
      );

      expect(res.status).toBe(400);
    });

    it('borrado y alta de experiencias ocurren dentro de la transacción', async () => {
      mockCandidate.findUnique.mockResolvedValue({
        id: 7,
        email: 'ana@test.com',
        userId: null,
        experiences: [],
      });
      tx.candidate.update.mockResolvedValue({ id: 7 });

      await candidatePut(
        pedir('http://localhost/api/admin/candidates/7', 'PUT', {
          experiences: [{ empresa: 'X', puesto: 'Y', fechaInicio: '2020-01-01' }],
        }),
        params('7')
      );

      expect(mockTransaction).toHaveBeenCalled();
      expect(tx.experience.deleteMany).toHaveBeenCalledWith({ where: { candidateId: 7 } });
      expect(tx.experience.createMany).toHaveBeenCalled();
      // Nada fuera de la transacción
      expect(mockExperience.deleteMany).not.toHaveBeenCalled();
    });
  });

  describe('ADM-035 / ADM-083 · borrar candidato no deja cuenta huérfana', () => {
    it('desactiva el User vinculado dentro de la misma transacción', async () => {
      mockCandidate.findUnique.mockResolvedValue({ id: 7, email: 'ana@test.com', userId: 42, documents: [] });
      tx.user.findUnique.mockResolvedValue({ id: 42, role: 'candidate' });

      const res = await candidateDelete(
        pedir('http://localhost/api/admin/candidates/7', 'DELETE'),
        params('7')
      );
      const cuerpo = await res.json();

      expect(res.status).toBe(200);
      expect(tx.user.update).toHaveBeenCalledWith({
        where: { id: 42 },
        data: { isActive: false, resetToken: null, resetTokenExpiry: null },
      });
      expect(tx.candidate.delete).toHaveBeenCalledWith({ where: { id: 7 } });
      expect(cuerpo.accountDeactivated).toBe(true);
    });

    it('sin cuenta vinculada sólo borra el candidato', async () => {
      mockCandidate.findUnique.mockResolvedValue({ id: 7, email: 'ana@test.com', userId: null, documents: [] });

      const res = await candidateDelete(
        pedir('http://localhost/api/admin/candidates/7', 'DELETE'),
        params('7')
      );
      const cuerpo = await res.json();

      expect(tx.user.update).not.toHaveBeenCalled();
      expect(cuerpo.accountDeactivated).toBe(false);
    });
  });

  describe('ADM-037 · la cuenta y el candidato se crean en una transacción', () => {
    it('user.create se ejecuta con el cliente de la transacción, no suelto', async () => {
      mockCandidate.findUnique.mockResolvedValue(null);
      mockUser.findUnique.mockResolvedValue(null);
      tx.user.create.mockResolvedValue({ id: 50 });
      tx.candidate.create.mockResolvedValue({ id: 1 });

      await candidatesPost(
        pedir('http://localhost/api/admin/candidates', 'POST', {
          nombre: 'Ana',
          apellidoPaterno: 'López',
          email: 'ana@test.com',
          password: 'ContraseñaSegura1',
        })
      );

      expect(mockTransaction).toHaveBeenCalled();
      expect(tx.user.create).toHaveBeenCalled();
      expect(mockUser.create).not.toHaveBeenCalled();
      expect(tx.candidate.create.mock.calls[0][0].data.userId).toBe(50);
    });

    it('una experiencia con fecha inválida se rechaza antes de crear la cuenta', async () => {
      mockCandidate.findUnique.mockResolvedValue(null);
      mockUser.findUnique.mockResolvedValue(null);

      const res = await candidatesPost(
        pedir('http://localhost/api/admin/candidates', 'POST', {
          nombre: 'Ana',
          apellidoPaterno: 'López',
          email: 'ana@test.com',
          password: 'ContraseñaSegura1',
          experiences: [{ empresa: 'A', puesto: 'B', fechaInicio: 'no-fecha' }],
        })
      );

      expect(res.status).toBe(400);
      expect(mockTransaction).not.toHaveBeenCalled();
      expect(tx.user.create).not.toHaveBeenCalled();
    });
  });

  describe('ADM-079 · esquemas de URL', () => {
    it('POST rechaza cvUrl con esquema javascript:', async () => {
      mockCandidate.findUnique.mockResolvedValue(null);

      const res = await candidatesPost(
        pedir('http://localhost/api/admin/candidates', 'POST', {
          nombre: 'Ana',
          apellidoPaterno: 'López',
          email: 'ana@test.com',
          cvUrl: 'javascript:alert(1)',
        })
      );

      expect(res.status).toBe(400);
      expect(mockTransaction).not.toHaveBeenCalled();
    });

    it('POST rechaza un documento con fileUrl peligrosa', async () => {
      mockCandidate.findUnique.mockResolvedValue(null);

      const res = await candidatesPost(
        pedir('http://localhost/api/admin/candidates', 'POST', {
          nombre: 'Ana',
          apellidoPaterno: 'López',
          email: 'ana@test.com',
          documents: [{ name: 'Título', fileUrl: 'javascript:alert(1)' }],
        })
      );

      expect(res.status).toBe(400);
    });

    it('PUT rechaza fotoUrl con esquema no http(s)', async () => {
      mockCandidate.findUnique.mockResolvedValue({
        id: 7,
        email: 'ana@test.com',
        userId: null,
        experiences: [],
      });

      const res = await candidatePut(
        pedir('http://localhost/api/admin/candidates/7', 'PUT', {
          fotoUrl: 'javascript:alert(1)',
        }),
        params('7')
      );

      expect(res.status).toBe(400);
      expect(mockTransaction).not.toHaveBeenCalled();
    });
  });

  describe('ADM-036 / ADM-084 · búsqueda y filtros del GET', () => {
    beforeEach(() => {
      mockCandidate.findMany.mockResolvedValue([]);
      mockCandidate.count.mockResolvedValue(0);
    });

    it('la búsqueda exige todas las palabras (where.AND)', async () => {
      await candidatesGet(
        pedir('http://localhost/api/admin/candidates?search=Maria%20Lopez')
      );

      const where = mockCandidate.findMany.mock.calls[0][0].where;
      expect(where.AND).toHaveLength(2);
      expect(where.OR).toBeUndefined();
    });

    it('minAge no numérico se ignora en vez de producir una fecha inválida', async () => {
      await candidatesGet(pedir('http://localhost/api/admin/candidates?minAge=veinte'));

      const where = mockCandidate.findMany.mock.calls[0][0].where;
      expect(where.fechaNacimiento).toBeUndefined();
    });

    it('minExperience no numérico se ignora', async () => {
      await candidatesGet(
        pedir('http://localhost/api/admin/candidates?minExperience=muchos')
      );

      const where = mockCandidate.findMany.mock.calls[0][0].where;
      expect(where['añosExperiencia']).toBeUndefined();
    });

    it('status admite lista separada por comas y se filtra en servidor', async () => {
      await candidatesGet(
        pedir('http://localhost/api/admin/candidates?status=available,in_process')
      );

      const where = mockCandidate.findMany.mock.calls[0][0].where;
      expect(where.status).toEqual({ in: ['available', 'in_process'] });
    });
  });
});
