/**
 * @jest-environment node
 */

// RUTA: __tests__/api/middleware-exceptions.test.ts
//
// INFRA-007: esta suite comparaba un array local consigo mismo y además
// documentaba lo contrario de lo que hace el código (listaba POST /api/upload
// como ruta protegida y afirmaba "exactamente 3 excepciones" sobre su propia
// copia). Ahora se ejecuta el middleware REAL con NextRequest reales y cookies
// JWT firmadas, de modo que borrar o añadir una excepción rompe el test.

process.env.JWT_SECRET =
  process.env.JWT_SECRET || 'test-secret-con-mas-de-treinta-y-dos-caracteres-123';

// AUTH-002: el middleware ya no decide con el JWT a secas — consulta el estado
// vigente del usuario (isActive + role) en la base. Aquí se simula esa consulta
// devolviendo un usuario coherente con el rol del token; el caso interesante
// (token y base que NO coinciden) se cubre en auth-middleware-sesion.test.ts.
let mockUsuarioEnBase: { email: string; role: string; isActive: boolean } | null =
  null;

jest.mock('@/lib/prisma', () => ({
  prisma: {
    user: {
      findUnique: jest.fn(async () => mockUsuarioEnBase)
    }
  }
}));

import { NextRequest } from 'next/server';
import { generateToken } from '@/lib/auth';
import { middleware, config } from '@/middleware';
import type { JWTPayload } from '@/lib/auth';

const BASE = 'http://localhost:3000';

type Role = JWTPayload['role'];

function tokenFor(role: Role, userId = 1): string {
  return generateToken({ userId, email: `${role}@test.com`, role });
}

function request(
  pathname: string,
  options: { method?: string; role?: Role } = {}
): NextRequest {
  const headers = new Headers();
  if (options.role) {
    headers.set('cookie', `auth-token=${tokenFor(options.role)}`);
    mockUsuarioEnBase = {
      email: `${options.role}@test.com`,
      role: options.role,
      isActive: true
    };
  } else {
    mockUsuarioEnBase = null;
  }
  return new NextRequest(`${BASE}${pathname}`, {
    method: options.method || 'GET',
    headers
  });
}

/** El middleware deja pasar con NextResponse.next(): status 200 + cabecera interna. */
function dejaPasar(res: Response): boolean {
  return res.status === 200 && res.headers.get('x-middleware-next') === '1';
}

// Rutas que el middleware debe dejar pasar SIN cookie de sesión.
const EXCEPCIONES_PUBLICAS = [
  { pathname: '/api/company-requests', method: 'POST', razon: 'Registro de empresas' },
  { pathname: '/api/applications', method: 'POST', razon: 'Candidatos aplican' },
  // OJO: la subida es pública de verdad (registro de empresa/candidato sin sesión).
  // El único freno es el rate-limit por IP de /api/upload. No es un olvido: es el
  // contrato actual, y si se cambia, este test debe cambiar con él.
  { pathname: '/api/upload', method: 'POST', razon: 'Subida durante el registro' }
] as const;

describe('Middleware - Excepciones públicas (handler real)', () => {
  EXCEPCIONES_PUBLICAS.forEach(({ pathname, method, razon }) => {
    it(`${method} ${pathname} pasa sin cookie (${razon})`, async () => {
      const res = await middleware(request(pathname, { method }));
      expect(dejaPasar(res)).toBe(true);
    });
  });

  it('no hay más excepciones públicas que las declaradas', async () => {
    // Se prueban todas las combinaciones método/ruta del matcher que NO son
    // excepción: todas deben responder 401 sin cookie.
    const candidatas: Array<{ pathname: string; method: string }> = [
      { pathname: '/api/company-requests', method: 'GET' },
      { pathname: '/api/company-requests', method: 'DELETE' },
      { pathname: '/api/applications', method: 'GET' },
      { pathname: '/api/applications', method: 'DELETE' },
      { pathname: '/api/applications/check', method: 'GET' },
      { pathname: '/api/upload', method: 'GET' },
      { pathname: '/api/admin/users', method: 'GET' },
      { pathname: '/api/admin/candidates', method: 'POST' },
      { pathname: '/api/company/dashboard', method: 'GET' },
      { pathname: '/api/recruiter/dashboard', method: 'GET' },
      { pathname: '/api/specialist/dashboard', method: 'GET' },
      { pathname: '/api/candidate/applications', method: 'GET' },
      { pathname: '/api/profile', method: 'PUT' },
      { pathname: '/api/profile/experience', method: 'POST' },
      { pathname: '/api/profile/documents', method: 'POST' },
      { pathname: '/api/evaluations/notes', method: 'GET' },
      { pathname: '/api/evaluations/notes', method: 'POST' },
      { pathname: '/api/credits/purchases', method: 'POST' },
      { pathname: '/api/interview-requests/1', method: 'PATCH' },
      { pathname: '/api/notifications', method: 'PATCH' },
      { pathname: '/api/vendor/my-code', method: 'GET' },
      { pathname: '/api/my-applications', method: 'GET' }
    ];

    for (const { pathname, method } of candidatas) {
      const res = await middleware(request(pathname, { method }));
      expect({ pathname, method, status: res.status }).toEqual({
        pathname,
        method,
        status: 401
      });
    }
  });

  it('GET /api/applications/check ya NO es público (oráculo de postulaciones)', async () => {
    const res = await middleware(request('/api/applications/check'));
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.success).toBe(false);
  });
});

describe('Middleware - Autenticación', () => {
  it('una ruta de API sin cookie responde 401 en JSON', async () => {
    const res = await middleware(request('/api/admin/users'));
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toMatch(/No autenticado/i);
  });

  it('una ruta de página sin cookie redirige a /unauthorized', async () => {
    const res = await middleware(request('/admin/users'));
    expect([302, 307, 308]).toContain(res.status);
    const location = res.headers.get('location') || '';
    expect(location).toContain('/unauthorized');
    expect(location).toContain('reason=no-token');
  });

  it('un token inválido responde 401 y no pasa', async () => {
    const headers = new Headers({ cookie: 'auth-token=esto.no.es.un.jwt' });
    const res = await middleware(
      new NextRequest(`${BASE}/api/admin/users`, { method: 'GET', headers })
    );
    expect(res.status).toBe(401);
  });
});

describe('Middleware - Permisos por rol', () => {
  const casos: Array<{ pathname: string; role: Role; esperado: 'pasa' | 403 }> = [
    { pathname: '/api/admin/users', role: 'admin', esperado: 'pasa' },
    { pathname: '/api/admin/users', role: 'candidate', esperado: 403 },
    { pathname: '/api/admin/users', role: 'company', esperado: 403 },
    { pathname: '/api/applications', role: 'company', esperado: 403 },
    { pathname: '/api/company/dashboard', role: 'company', esperado: 'pasa' },
    { pathname: '/api/company/dashboard', role: 'admin', esperado: 'pasa' },
    { pathname: '/api/company/dashboard', role: 'recruiter', esperado: 403 },
    { pathname: '/api/recruiter/dashboard', role: 'recruiter', esperado: 'pasa' },
    { pathname: '/api/recruiter/dashboard', role: 'specialist', esperado: 403 },
    { pathname: '/api/specialist/dashboard', role: 'specialist', esperado: 'pasa' },
    { pathname: '/api/specialist/dashboard', role: 'company', esperado: 403 },
    { pathname: '/api/candidate/applications', role: 'candidate', esperado: 'pasa' },
    { pathname: '/api/candidate/applications', role: 'company', esperado: 403 },
    { pathname: '/api/my-applications', role: 'user', esperado: 'pasa' },
    { pathname: '/api/my-applications', role: 'company', esperado: 403 },
    { pathname: '/api/profile', role: 'user', esperado: 'pasa' },
    { pathname: '/api/notifications', role: 'vendor', esperado: 'pasa' }
  ];

  casos.forEach(({ pathname, role, esperado }) => {
    it(`${role} en ${pathname} -> ${esperado}`, async () => {
      const res = await middleware(request(pathname, { role }));
      if (esperado === 'pasa') {
        expect(dejaPasar(res)).toBe(true);
      } else {
        expect(res.status).toBe(403);
      }
    });
  });

  it('propaga la identidad a la API en cabeceras x-user-*', async () => {
    const res = await middleware(request('/api/profile', { role: 'company' }));
    expect(dejaPasar(res)).toBe(true);
    // NextResponse.next({ request: { headers } }) las expone como override.
    const overrides = res.headers.get('x-middleware-override-headers') || '';
    expect(overrides).toContain('x-user-id');
    expect(overrides).toContain('x-user-role');
    expect(res.headers.get('x-middleware-request-x-user-role')).toBe('company');
  });
});

describe('Middleware - Matcher', () => {
  it('el matcher cubre las rutas sensibles', () => {
    const matcher = config.matcher as string[];
    const esperadas = [
      '/api/admin/:path*',
      '/api/company/:path*',
      '/api/recruiter/:path*',
      '/api/specialist/:path*',
      '/api/candidate/:path*',
      '/api/evaluations/:path*',
      '/api/interview-requests/:path*',
      '/api/credits/:path*',
      '/api/vendor/:path*',
      '/api/upload'
    ];
    esperadas.forEach((ruta) => expect(matcher).toContain(ruta));
  });

  it('el middleware corre en runtime nodejs (verifyToken usa jsonwebtoken)', () => {
    expect(config.runtime).toBe('nodejs');
  });
});
