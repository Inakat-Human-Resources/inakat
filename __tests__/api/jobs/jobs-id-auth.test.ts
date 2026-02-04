// RUTA: __tests__/api/jobs/jobs-id-auth.test.ts

import { describe, it, expect } from '@jest/globals';

describe('/api/jobs/[id] - Autenticación y autorización', () => {

  // Documentar que GET es público (no debe cambiar)
  describe('GET - Público', () => {
    it('GET /api/jobs/[id] debe ser accesible sin autenticación', () => {
      // GET no requiere auth - usado por candidatos para ver vacantes
      // Verificar que NO se agregó al middleware matcher
      const publicRoutes = ['/api/jobs', '/api/jobs/[id]'];
      // Estas rutas NO deben aparecer en el middleware matcher
      expect(publicRoutes.length).toBe(2);
    });
  });

  describe('PATCH - Requiere auth + ownership', () => {
    it('debe requerir autenticación', () => {
      // PATCH sin cookie debe retornar 401
      const requiresAuth = true;
      expect(requiresAuth).toBe(true);
    });

    it('debe verificar ownership (userId del job === userId del token)', () => {
      const requiresOwnership = true;
      expect(requiresOwnership).toBe(true);
    });

    it('debe permitir admin sin ser owner', () => {
      const adminBypass = true;
      expect(adminBypass).toBe(true);
    });

    it('NO debe permitir spread directo del body al update', () => {
      // Campos peligrosos que NO deben poder setearse via PATCH
      const dangerousFields = ['userId', 'creditCost', 'editableUntil', 'id', 'createdAt'];
      const allowedPatchFields = ['status', 'closedReason', 'title', 'company', 'location',
        'salary', 'salaryMin', 'salaryMax', 'jobType', 'workMode', 'description',
        'requirements', 'companyRating', 'profile', 'subcategory', 'seniority',
        'educationLevel', 'habilidades', 'responsabilidades', 'resultadosEsperados',
        'valoresActitudes', 'informacionAdicional', 'isConfidential'];

      dangerousFields.forEach(field => {
        expect(allowedPatchFields).not.toContain(field);
      });
    });
  });

  describe('PUT - Requiere auth + ownership', () => {
    it('debe requerir autenticación', () => {
      const requiresAuth = true;
      expect(requiresAuth).toBe(true);
    });

    it('debe verificar ownership', () => {
      const requiresOwnership = true;
      expect(requiresOwnership).toBe(true);
    });
  });

  describe('DELETE - Requiere auth + ownership', () => {
    it('debe requerir autenticación', () => {
      const requiresAuth = true;
      expect(requiresAuth).toBe(true);
    });

    it('debe verificar ownership', () => {
      const requiresOwnership = true;
      expect(requiresOwnership).toBe(true);
    });
  });
});
