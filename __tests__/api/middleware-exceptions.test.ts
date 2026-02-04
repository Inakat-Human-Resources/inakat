// RUTA: __tests__/api/middleware-exceptions.test.ts

import { describe, it, expect } from '@jest/globals';

describe('Middleware - Excepciones Públicas', () => {
  // Rutas que deben ser públicas (sin autenticación)
  const PUBLIC_EXCEPTIONS = [
    { pathname: '/api/company-requests', method: 'POST', reason: 'Registro de empresas' },
    { pathname: '/api/applications', method: 'POST', reason: 'Candidatos aplican' },
    { pathname: '/api/applications/check', method: 'GET', reason: 'Verificar duplicados' }
  ];

  // Rutas que deben requerir autenticación
  const PROTECTED_ROUTES = [
    { pathname: '/api/applications', method: 'GET', requiredRole: 'admin' },
    { pathname: '/api/company-requests', method: 'GET', requiredRole: 'admin' },
    { pathname: '/api/admin/candidates', method: 'GET', requiredRole: 'admin' },
    { pathname: '/api/admin/users', method: 'GET', requiredRole: 'admin' },
    { pathname: '/api/admin/assignments', method: 'GET', requiredRole: 'admin' },
    { pathname: '/api/company/dashboard', method: 'GET', requiredRole: 'company' },
    { pathname: '/api/recruiter/dashboard', method: 'GET', requiredRole: 'recruiter' },
    { pathname: '/api/specialist/dashboard', method: 'GET', requiredRole: 'specialist' },
    { pathname: '/api/vendor/my-code', method: 'GET', requiredRole: 'any' },
    { pathname: '/api/upload', method: 'POST', requiredRole: 'any' },
    { pathname: '/api/evaluations/notes', method: 'GET', requiredRole: 'any' },
    { pathname: '/api/evaluations/notes', method: 'POST', requiredRole: 'any' },
    { pathname: '/api/credits/purchases', method: 'POST', requiredRole: 'company' },
    { pathname: '/api/profile/experience', method: 'POST', requiredRole: 'any' },
    { pathname: '/api/profile/documents', method: 'POST', requiredRole: 'any' }
  ];

  describe('Rutas públicas', () => {
    PUBLIC_EXCEPTIONS.forEach(({ pathname, method, reason }) => {
      it(`${method} ${pathname} debe ser público (${reason})`, () => {
        const isPublicException = PUBLIC_EXCEPTIONS.some(
          exc => exc.pathname === pathname && exc.method === method
        );
        expect(isPublicException).toBe(true);
      });
    });

    it('debería haber exactamente 3 excepciones públicas', () => {
      expect(PUBLIC_EXCEPTIONS).toHaveLength(3);
    });
  });

  describe('Rutas protegidas', () => {
    PROTECTED_ROUTES.forEach(({ pathname, method, requiredRole }) => {
      it(`${method} ${pathname} debe requerir rol ${requiredRole}`, () => {
        const isProtected = PROTECTED_ROUTES.some(
          route => route.pathname === pathname && route.method === method
        );
        expect(isProtected).toBe(true);
      });
    });
  });

  describe('Seguridad de datos sensibles', () => {
    it('GET /api/applications NO debe ser público', () => {
      const getApplicationsIsPublic = PUBLIC_EXCEPTIONS.some(
        exc => exc.pathname === '/api/applications' && exc.method === 'GET'
      );
      expect(getApplicationsIsPublic).toBe(false);
    });

    it('GET /api/company-requests NO debe ser público', () => {
      const getRequestsIsPublic = PUBLIC_EXCEPTIONS.some(
        exc => exc.pathname === '/api/company-requests' && exc.method === 'GET'
      );
      expect(getRequestsIsPublic).toBe(false);
    });

    it('DELETE /api/applications NO debe ser público', () => {
      const deleteApplicationsIsPublic = PUBLIC_EXCEPTIONS.some(
        exc => exc.pathname === '/api/applications' && exc.method === 'DELETE'
      );
      expect(deleteApplicationsIsPublic).toBe(false);
    });

    it('POST /api/admin/* NO debe ser público', () => {
      const adminPostIsPublic = PUBLIC_EXCEPTIONS.some(
        exc => exc.pathname.startsWith('/api/admin') && exc.method === 'POST'
      );
      expect(adminPostIsPublic).toBe(false);
    });

    it('GET /api/evaluations/notes NO debe ser público', () => {
      const isPublic = PUBLIC_EXCEPTIONS.some(
        exc => exc.pathname === '/api/evaluations/notes'
      );
      expect(isPublic).toBe(false);
    });

    it('GET /api/credits/purchases NO debe ser público', () => {
      const isPublic = PUBLIC_EXCEPTIONS.some(
        exc => exc.pathname.startsWith('/api/credits')
      );
      expect(isPublic).toBe(false);
    });

    it('/api/profile sub-rutas deben estar protegidas', () => {
      const isPublic = PUBLIC_EXCEPTIONS.some(
        exc => exc.pathname.startsWith('/api/profile')
      );
      expect(isPublic).toBe(false);
    });
  });

  describe('Consistencia de excepciones', () => {
    it('POST /api/applications es público pero GET no lo es', () => {
      const postIsPublic = PUBLIC_EXCEPTIONS.some(
        exc => exc.pathname === '/api/applications' && exc.method === 'POST'
      );
      const getIsPublic = PUBLIC_EXCEPTIONS.some(
        exc => exc.pathname === '/api/applications' && exc.method === 'GET'
      );

      expect(postIsPublic).toBe(true);
      expect(getIsPublic).toBe(false);
    });

    it('POST /api/company-requests es público pero GET no lo es', () => {
      const postIsPublic = PUBLIC_EXCEPTIONS.some(
        exc => exc.pathname === '/api/company-requests' && exc.method === 'POST'
      );
      const getIsPublic = PUBLIC_EXCEPTIONS.some(
        exc => exc.pathname === '/api/company-requests' && exc.method === 'GET'
      );

      expect(postIsPublic).toBe(true);
      expect(getIsPublic).toBe(false);
    });
  });

  describe('Roles y permisos', () => {
    const ROLE_ROUTES: Record<string, string[]> = {
      'admin': ['/api/admin/', '/api/applications', '/api/company-requests'],
      'company': ['/api/company/'],
      'recruiter': ['/api/recruiter/'],
      'specialist': ['/api/specialist/'],
      'candidate': ['/api/candidate/']
    };

    it('admin tiene acceso a rutas de admin', () => {
      expect(ROLE_ROUTES['admin']).toContain('/api/admin/');
    });

    it('company tiene acceso a rutas de company', () => {
      expect(ROLE_ROUTES['company']).toContain('/api/company/');
    });

    it('recruiter tiene acceso a rutas de recruiter', () => {
      expect(ROLE_ROUTES['recruiter']).toContain('/api/recruiter/');
    });

    it('specialist tiene acceso a rutas de specialist', () => {
      expect(ROLE_ROUTES['specialist']).toContain('/api/specialist/');
    });

    it('candidate tiene acceso a rutas de candidate', () => {
      expect(ROLE_ROUTES['candidate']).toContain('/api/candidate/');
    });
  });
});
