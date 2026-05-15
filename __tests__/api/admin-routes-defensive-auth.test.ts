// RUTA: __tests__/api/admin-routes-defensive-auth.test.ts

/**
 * Tests para defense-in-depth en rutas admin.
 *
 * Estas rutas históricamente solo confiaban en el middleware para verificar
 * que el usuario fuera admin. Si alguien modifica el matcher del middleware
 * por error, las rutas quedarían accesibles sin auth. Ahora cada handler
 * llama a requireRole('admin') al inicio como defensa adicional.
 */

// Mock de NextResponse (jsdom no tiene Response.json estático)
jest.mock('next/server', () => ({
  NextResponse: {
    json: (data: any, options?: any) => ({
      status: options?.status || 200,
      json: async () => data,
    }),
  },
}));

// Mock prisma para que la importación de auth.ts no triga otras llamadas
jest.mock('@/lib/prisma', () => ({
  prisma: {
    user: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    application: { findMany: jest.fn(), findUnique: jest.fn(), update: jest.fn() },
    discountCode: { findMany: jest.fn(), count: jest.fn(), findUnique: jest.fn(), create: jest.fn() },
    discountCodeUse: { findMany: jest.fn(), count: jest.fn(), findUnique: jest.fn(), update: jest.fn(), aggregate: jest.fn() },
    job: { findUnique: jest.fn() },
    candidate: { findMany: jest.fn(), updateMany: jest.fn() },
    jobAssignment: { findUnique: jest.fn() },
  },
}));

// Mock auth: queremos espiar requireRole
jest.mock('@/lib/auth', () => ({
  requireRole: jest.fn(),
  requireAuth: jest.fn(),
}));

import { requireRole } from '@/lib/auth';
import { GET as adminUsersGet, POST as adminUsersPost, PUT as adminUsersPut, DELETE as adminUsersDelete } from '@/app/api/admin/users/route';
import { GET as assignGet, POST as assignPost } from '@/app/api/admin/assign-candidates/route';
import { GET as directGet, PUT as directPut } from '@/app/api/admin/direct-applications/route';
import { GET as vendorsGet, POST as vendorsPost } from '@/app/api/admin/vendors/route';
import { GET as commissionsGet } from '@/app/api/admin/vendors/commissions/route';
import { GET as commissionIdGet, PUT as commissionIdPut } from '@/app/api/admin/vendors/commissions/[id]/route';

const mockRequireRole = requireRole as jest.Mock;

function makeRequest(url: string = 'http://localhost/api/admin/test', method: string = 'GET', body?: any) {
  return new Request(url, {
    method,
    body: body ? JSON.stringify(body) : undefined,
  });
}

describe('Rutas admin: defense-in-depth (requireRole)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('admin/users', () => {
    it('GET rechaza si requireRole devuelve error 401', async () => {
      mockRequireRole.mockResolvedValue({ error: 'No autenticado', status: 401 });
      const res = await adminUsersGet(makeRequest('http://localhost/api/admin/users'));
      expect(res.status).toBe(401);
      expect(mockRequireRole).toHaveBeenCalledWith('admin');
    });

    it('POST rechaza si requireRole devuelve error 403', async () => {
      mockRequireRole.mockResolvedValue({ error: 'Acceso denegado', status: 403 });
      const res = await adminUsersPost(makeRequest('http://localhost/api/admin/users', 'POST', { email: 'x' }));
      expect(res.status).toBe(403);
      expect(mockRequireRole).toHaveBeenCalledWith('admin');
    });

    it('PUT rechaza si requireRole devuelve error 401', async () => {
      mockRequireRole.mockResolvedValue({ error: 'No autenticado', status: 401 });
      const res = await adminUsersPut(makeRequest('http://localhost/api/admin/users', 'PUT', { id: 1 }));
      expect(res.status).toBe(401);
    });

    it('DELETE rechaza si requireRole devuelve error 403', async () => {
      mockRequireRole.mockResolvedValue({ error: 'Acceso denegado', status: 403 });
      const res = await adminUsersDelete(makeRequest('http://localhost/api/admin/users?id=1', 'DELETE'));
      expect(res.status).toBe(403);
    });
  });

  describe('admin/assign-candidates', () => {
    it('GET rechaza si requireRole devuelve error 401', async () => {
      mockRequireRole.mockResolvedValue({ error: 'No autenticado', status: 401 });
      const res = await assignGet(makeRequest('http://localhost/api/admin/assign-candidates?jobId=1'));
      expect(res.status).toBe(401);
    });

    it('POST rechaza si requireRole devuelve error 403', async () => {
      mockRequireRole.mockResolvedValue({ error: 'Acceso denegado', status: 403 });
      const res = await assignPost(makeRequest('http://localhost/api/admin/assign-candidates', 'POST', { jobId: 1, candidateIds: [1] }));
      expect(res.status).toBe(403);
    });
  });

  describe('admin/direct-applications', () => {
    it('GET rechaza si requireRole devuelve error 401', async () => {
      mockRequireRole.mockResolvedValue({ error: 'No autenticado', status: 401 });
      const res = await directGet(makeRequest('http://localhost/api/admin/direct-applications'));
      expect(res.status).toBe(401);
    });

    it('PUT rechaza si requireRole devuelve error 403', async () => {
      mockRequireRole.mockResolvedValue({ error: 'Acceso denegado', status: 403 });
      const res = await directPut(makeRequest('http://localhost/api/admin/direct-applications', 'PUT', { applicationId: 1, newStatus: 'reviewing' }));
      expect(res.status).toBe(403);
    });
  });

  describe('admin/vendors', () => {
    it('GET rechaza si requireRole devuelve error 401', async () => {
      mockRequireRole.mockResolvedValue({ error: 'No autenticado', status: 401 });
      const res = await vendorsGet(makeRequest('http://localhost/api/admin/vendors') as any);
      expect(res.status).toBe(401);
    });

    it('POST rechaza si requireRole devuelve error 403', async () => {
      mockRequireRole.mockResolvedValue({ error: 'Acceso denegado', status: 403 });
      const res = await vendorsPost(makeRequest('http://localhost/api/admin/vendors', 'POST', { nombre: 'x' }) as any);
      expect(res.status).toBe(403);
    });
  });

  describe('admin/vendors/commissions', () => {
    it('GET rechaza si requireRole devuelve error 401', async () => {
      mockRequireRole.mockResolvedValue({ error: 'No autenticado', status: 401 });
      const res = await commissionsGet(makeRequest('http://localhost/api/admin/vendors/commissions') as any);
      expect(res.status).toBe(401);
    });
  });

  describe('admin/vendors/commissions/[id]', () => {
    const mockParams = { params: Promise.resolve({ id: '1' }) };

    it('GET rechaza si requireRole devuelve error 401', async () => {
      mockRequireRole.mockResolvedValue({ error: 'No autenticado', status: 401 });
      const res = await commissionIdGet(makeRequest('http://localhost/api/admin/vendors/commissions/1') as any, mockParams);
      expect(res.status).toBe(401);
    });

    it('PUT rechaza si requireRole devuelve error 403', async () => {
      mockRequireRole.mockResolvedValue({ error: 'Acceso denegado', status: 403 });
      const res = await commissionIdPut(makeRequest('http://localhost/api/admin/vendors/commissions/1', 'PUT', { status: 'paid' }) as any, mockParams);
      expect(res.status).toBe(403);
    });
  });
});
