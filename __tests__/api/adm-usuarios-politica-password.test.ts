// RUTA: __tests__/api/adm-usuarios-politica-password.test.ts

/**
 * Auditoría 2026-09 · módulo admin — /api/admin/users
 *
 * ADM-050: el alta y la edición de staff aceptaban contraseñas de 6 caracteres,
 *          pero loginSchema exige 8: esas cuentas NUNCA podían iniciar sesión.
 * ADM-051: un admin podía desactivarse a sí mismo o desactivar al último admin
 *          activo (lockout total del panel).
 * ADM-081: el cambio de contraseña desde admin no invalidaba el resetToken.
 * ADM-096: id no numérico -> 500 en vez de 400.
 * ADM-097: password corta o rol inválido se ignoraban en silencio respondiendo
 *          "actualizado exitosamente"; specialty no se limpiaba al cambiar rol.
 * ADM-036: la búsqueda por nombre completo no encontraba nada.
 */

jest.mock('next/server', () => ({
  NextResponse: {
    json: (data: any, options?: any) => ({
      status: options?.status || 200,
      json: async () => data,
    }),
  },
}));

jest.mock('@/lib/prisma', () => ({
  prisma: {
    user: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    jobAssignment: { count: jest.fn() },
    integrationApiKey: { updateMany: jest.fn() },
    integrationWebhook: { updateMany: jest.fn() },
    // PLAT-003: la desactivación va en una transacción con las integraciones.
    $transaction: jest.fn((ops: any[]) => Promise.all(ops)),
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
import {
  GET as usersGet,
  POST as usersPost,
  PUT as usersPut,
  DELETE as usersDelete,
} from '@/app/api/admin/users/route';

const mockRequireRole = requireRole as jest.Mock;
const mockUser = (prisma as any).user;
const mockJobAssignment = (prisma as any).jobAssignment;

const ADMIN_ACTUAL = { user: { id: 1, email: 'admin@inakat.com', role: 'admin' } };

function pedir(url: string, method = 'GET', body?: any) {
  return new Request(url, {
    method,
    body: body ? JSON.stringify(body) : undefined,
  });
}

describe('/api/admin/users — política de contraseñas y lockout', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRequireRole.mockResolvedValue(ADMIN_ACTUAL);
    mockJobAssignment.count.mockResolvedValue(0);
  });

  describe('ADM-050 · mínimo de 8 caracteres', () => {
    it('POST rechaza una contraseña de 6 caracteres (antes creaba la cuenta)', async () => {
      mockUser.findUnique.mockResolvedValue(null);

      const res = await usersPost(
        pedir('http://localhost/api/admin/users', 'POST', {
          email: 'nuevo@inakat.com',
          password: 'abc123',
          nombre: 'Nuevo',
          role: 'recruiter',
        })
      );

      expect(res.status).toBe(400);
      expect(mockUser.create).not.toHaveBeenCalled();
    });

    it('POST rechaza una contraseña de 7 caracteres', async () => {
      mockUser.findUnique.mockResolvedValue(null);

      const res = await usersPost(
        pedir('http://localhost/api/admin/users', 'POST', {
          email: 'nuevo@inakat.com',
          password: '1234567',
          nombre: 'Nuevo',
          role: 'recruiter',
        })
      );

      expect(res.status).toBe(400);
      expect(mockUser.create).not.toHaveBeenCalled();
    });

    it('POST acepta una contraseña de 8 caracteres', async () => {
      mockUser.findUnique.mockResolvedValue(null);
      mockUser.create.mockResolvedValue({ id: 9, email: 'nuevo@inakat.com', role: 'recruiter' });

      const res = await usersPost(
        pedir('http://localhost/api/admin/users', 'POST', {
          email: 'nuevo@inakat.com',
          password: '12345678',
          nombre: 'Nuevo',
          role: 'recruiter',
        })
      );

      expect(res.status).toBe(201);
      expect(mockUser.create).toHaveBeenCalled();
    });

    it('POST rechaza un password que no es string (antes reventaba en bcrypt)', async () => {
      mockUser.findUnique.mockResolvedValue(null);

      const res = await usersPost(
        pedir('http://localhost/api/admin/users', 'POST', {
          email: 'nuevo@inakat.com',
          password: 12345678,
          nombre: 'Nuevo',
          role: 'recruiter',
        })
      );

      expect(res.status).toBe(400);
      expect(mockUser.create).not.toHaveBeenCalled();
    });

    it('PUT devuelve 400 con password corta en vez de responder éxito ignorándola (ADM-097)', async () => {
      const res = await usersPut(
        pedir('http://localhost/api/admin/users', 'PUT', { id: 5, password: 'abc' })
      );

      expect(res.status).toBe(400);
      expect(mockUser.update).not.toHaveBeenCalled();
    });
  });

  describe('ADM-081 · el reset desde admin invalida el enlace de recuperación', () => {
    it('PUT con password nueva pone resetToken y resetTokenExpiry a null', async () => {
      mockUser.findUnique.mockResolvedValue({
        id: 5,
        email: 'reclutador@inakat.com',
        role: 'recruiter',
        isActive: true,
        specialty: null,
      });
      mockUser.update.mockResolvedValue({ id: 5 });

      await usersPut(
        pedir('http://localhost/api/admin/users', 'PUT', { id: 5, password: 'ContraseñaNueva1' })
      );

      const datos = mockUser.update.mock.calls[0][0].data;
      expect(datos.resetToken).toBeNull();
      expect(datos.resetTokenExpiry).toBeNull();
      expect(datos.password).toBe('hash-falso');
    });
  });

  describe('ADM-051 · lockout del panel', () => {
    it('DELETE rechaza que el admin se desactive a sí mismo', async () => {
      mockUser.findUnique.mockResolvedValue({ id: 1, role: 'admin', isActive: true });

      const res = await usersDelete(pedir('http://localhost/api/admin/users?id=1', 'DELETE'));

      expect(res.status).toBe(400);
      expect(mockUser.update).not.toHaveBeenCalled();
    });

    it('DELETE rechaza desactivar al último admin activo', async () => {
      mockUser.findUnique.mockResolvedValue({ id: 7, role: 'admin', isActive: true });
      mockUser.count.mockResolvedValue(0); // no quedan otros admins activos

      const res = await usersDelete(pedir('http://localhost/api/admin/users?id=7', 'DELETE'));

      expect(res.status).toBe(400);
      expect(mockUser.update).not.toHaveBeenCalled();
    });

    it('DELETE permite desactivar a otro admin si queda al menos uno activo', async () => {
      mockUser.findUnique.mockResolvedValue({ id: 7, role: 'admin', isActive: true });
      mockUser.count.mockResolvedValue(2);
      mockUser.update.mockResolvedValue({ id: 7 });

      const res = await usersDelete(pedir('http://localhost/api/admin/users?id=7', 'DELETE'));

      expect(res.status).toBe(200);
      expect(mockUser.update).toHaveBeenCalledWith({
        where: { id: 7 },
        data: { isActive: false },
      });
    });

    it('PUT rechaza que el admin se cambie a sí mismo a recruiter', async () => {
      mockUser.findUnique.mockResolvedValue({
        id: 1,
        email: 'admin@inakat.com',
        role: 'admin',
        isActive: true,
        specialty: null,
      });

      const res = await usersPut(
        pedir('http://localhost/api/admin/users', 'PUT', { id: 1, role: 'recruiter' })
      );

      expect(res.status).toBe(400);
      expect(mockUser.update).not.toHaveBeenCalled();
    });
  });

  describe('ADM-096 · ids no numéricos', () => {
    it('DELETE con id=abc responde 400 y no consulta la base', async () => {
      const res = await usersDelete(pedir('http://localhost/api/admin/users?id=abc', 'DELETE'));

      expect(res.status).toBe(400);
      expect(mockUser.findUnique).not.toHaveBeenCalled();
    });

    it('PUT con id=abc responde 400 y no consulta la base', async () => {
      const res = await usersPut(
        pedir('http://localhost/api/admin/users', 'PUT', { id: 'abc', nombre: 'X' })
      );

      expect(res.status).toBe(400);
      expect(mockUser.findUnique).not.toHaveBeenCalled();
    });
  });

  describe('ADM-097 · rol y especialidad coherentes', () => {
    it('PUT devuelve 400 con un rol fuera de la lista permitida', async () => {
      const res = await usersPut(
        pedir('http://localhost/api/admin/users', 'PUT', { id: 5, role: 'company' })
      );

      expect(res.status).toBe(400);
      expect(mockUser.update).not.toHaveBeenCalled();
    });

    it('PUT limpia specialty cuando el especialista pasa a reclutador', async () => {
      mockUser.findUnique.mockResolvedValue({
        id: 5,
        email: 'esp@inakat.com',
        role: 'specialist',
        isActive: true,
        specialty: 'Tecnología',
      });
      mockUser.update.mockResolvedValue({ id: 5 });

      await usersPut(
        pedir('http://localhost/api/admin/users', 'PUT', {
          id: 5,
          role: 'recruiter',
          specialty: 'Tecnología',
        })
      );

      expect(mockUser.update.mock.calls[0][0].data.specialty).toBeNull();
    });

    it('PUT exige especialidad al pasar a specialist', async () => {
      mockUser.findUnique.mockResolvedValue({
        id: 5,
        email: 'rec@inakat.com',
        role: 'recruiter',
        isActive: true,
        specialty: null,
      });

      const res = await usersPut(
        pedir('http://localhost/api/admin/users', 'PUT', { id: 5, role: 'specialist' })
      );

      expect(res.status).toBe(400);
      expect(mockUser.update).not.toHaveBeenCalled();
    });
  });

  describe('ADM-098 · aviso de asignaciones vivas', () => {
    it('DELETE devuelve cuántas vacantes no cerradas quedan a cargo del usuario', async () => {
      mockUser.findUnique.mockResolvedValue({ id: 7, role: 'recruiter', isActive: true });
      mockUser.update.mockResolvedValue({ id: 7 });
      mockJobAssignment.count.mockResolvedValue(8);

      const res = await usersDelete(pedir('http://localhost/api/admin/users?id=7', 'DELETE'));
      const cuerpo = await res.json();

      expect(cuerpo.activeAssignments).toBe(8);
      expect(mockJobAssignment.count).toHaveBeenCalled();
    });
  });

  describe('ADM-036 · búsqueda por nombre completo', () => {
    it('GET parte el término en palabras y exige todas (where.AND)', async () => {
      mockUser.findMany.mockResolvedValue([]);
      mockUser.count.mockResolvedValue(0);

      await usersGet(pedir('http://localhost/api/admin/users?search=Juan%20P%C3%A9rez'));

      const where = mockUser.findMany.mock.calls[0][0].where;
      expect(Array.isArray(where.AND)).toBe(true);
      expect(where.AND).toHaveLength(2);
      expect(where.OR).toBeUndefined();
    });
  });
});
