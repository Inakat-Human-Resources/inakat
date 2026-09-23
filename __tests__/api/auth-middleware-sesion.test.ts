/**
 * @jest-environment node
 */

// RUTA: __tests__/api/auth-middleware-sesion.test.ts
//
// AUTH-002 / AUTH-004 / AUTH-014 / AUTH-024 / AUTH-025
//
// El middleware decidía SÓLO con el JWT (7 días de vida), así que desactivar a
// un usuario o cambiarle el rol no surtía efecto hasta que el token caducaba, y
// las ~16 rutas que autorizan con las cabeceras x-user-* que él inyecta seguían
// respondiendo 200. Aquí se ejecuta el middleware REAL con cookies firmadas y
// un Prisma simulado, para comprobar que manda la base y no el token.

process.env.JWT_SECRET =
  process.env.JWT_SECRET || 'test-secret-con-mas-de-treinta-y-dos-caracteres-123';

type UsuarioEnBase = { email: string; role: string; isActive: boolean } | null;

let mockUsuarioEnBase: UsuarioEnBase = null;
let mockFallaLaConsulta = false;

const mockFindUnique = jest.fn(async () => {
  if (mockFallaLaConsulta) throw new Error('DB caída');
  return mockUsuarioEnBase;
});

// Acceso perezoso: los `import` se elevan por encima de las `const`, así que la
// fábrica no puede leer `mockFindUnique` en el momento de cargar el módulo.
jest.mock('@/lib/prisma', () => ({
  prisma: { user: { findUnique: (...args: unknown[]) => mockFindUnique(...(args as [])) } }
}));

import { NextRequest } from 'next/server';
import jwt from 'jsonwebtoken';
import { generateToken } from '@/lib/auth';
import { middleware, config } from '@/middleware';

const BASE = 'http://localhost:3000';

/**
 * Construye una petición con cookie firmada para `rolEnToken` mientras la base
 * dice `usuarioEnBase`. Que ambos puedan diferir es justo lo que se prueba.
 */
function peticion(
  pathname: string,
  opciones: {
    rolEnToken?: string;
    usuarioEnBase?: UsuarioEnBase;
    method?: string;
  } = {}
): NextRequest {
  const headers = new Headers();

  if (opciones.rolEnToken) {
    const token = generateToken({
      userId: 7,
      email: 'persona@test.com',
      role: opciones.rolEnToken
    });
    headers.set('cookie', `auth-token=${token}`);
  }

  mockUsuarioEnBase =
    opciones.usuarioEnBase === undefined
      ? opciones.rolEnToken
        ? { email: 'persona@test.com', role: opciones.rolEnToken, isActive: true }
        : null
      : opciones.usuarioEnBase;

  return new NextRequest(`${BASE}${pathname}`, {
    method: opciones.method || 'GET',
    headers
  });
}

const dejaPasar = (res: Response) =>
  res.status === 200 && res.headers.get('x-middleware-next') === '1';

const borraLaCookie = (res: Response) =>
  (res.headers.get('set-cookie') || '').includes('auth-token=');

beforeEach(() => {
  mockFindUnique.mockClear();
  mockFallaLaConsulta = false;
});

describe('AUTH-002 — el middleware consulta el estado vigente en la base', () => {
  it('consulta el usuario del token en la base', async () => {
    await middleware(peticion('/api/company/dashboard', { rolEnToken: 'company' }));

    expect(mockFindUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 7 } })
    );
  });

  it('un usuario DESACTIVADO no pasa aunque su JWT siga siendo válido', async () => {
    const res = await middleware(
      peticion('/api/company/dashboard', {
        rolEnToken: 'company',
        usuarioEnBase: { email: 'persona@test.com', role: 'company', isActive: false }
      })
    );

    expect(res.status).toBe(401);
    expect(dejaPasar(res)).toBe(false);
  });

  it('un usuario BORRADO no pasa aunque su JWT siga siendo válido', async () => {
    const res = await middleware(
      peticion('/api/my-applications', {
        rolEnToken: 'candidate',
        usuarioEnBase: null
      })
    );

    expect(res.status).toBe(401);
  });

  it('al cortar la sesión borra la cookie auth-token', async () => {
    const res = await middleware(
      peticion('/api/company/dashboard', {
        rolEnToken: 'company',
        usuarioEnBase: { email: 'persona@test.com', role: 'company', isActive: false }
      })
    );

    expect(borraLaCookie(res)).toBe(true);
  });

  it('el rol de la BASE manda sobre el del token: admin degradado a candidate no entra a /api/admin', async () => {
    const res = await middleware(
      peticion('/api/admin/users', {
        rolEnToken: 'admin',
        usuarioEnBase: { email: 'persona@test.com', role: 'candidate', isActive: true }
      })
    );

    expect(res.status).toBe(403);
  });

  it('el rol de la BASE manda sobre el del token: ascendido a admin entra aunque el token diga candidate', async () => {
    const res = await middleware(
      peticion('/api/admin/users', {
        rolEnToken: 'candidate',
        usuarioEnBase: { email: 'persona@test.com', role: 'admin', isActive: true }
      })
    );

    expect(dejaPasar(res)).toBe(true);
  });

  it('x-user-role viaja con el rol de la base, no con el del token', async () => {
    const res = await middleware(
      peticion('/api/profile', {
        rolEnToken: 'admin',
        usuarioEnBase: { email: 'persona@test.com', role: 'candidate', isActive: true }
      })
    );

    expect(res.headers.get('x-middleware-request-x-user-role')).toBe('candidate');
    expect(res.headers.get('x-middleware-request-x-user-email')).toBe(
      'persona@test.com'
    );
  });

  it('un token firmado pero sin userId corta la sesión (401) sin consultar la base', async () => {
    const tokenSinUsuario = jwt.sign(
      { email: 'persona@test.com', role: 'admin' },
      process.env.JWT_SECRET as string
    );
    const req = new NextRequest(`${BASE}/api/admin/users`, {
      headers: { cookie: `auth-token=${tokenSinUsuario}` }
    });

    const res = await middleware(req);

    expect(res.status).toBe(401);
    expect(mockFindUnique).not.toHaveBeenCalled();
  });

  it('si la consulta a la base falla, falla CERRADO (no deja pasar con el token)', async () => {
    mockFallaLaConsulta = true;

    const res = await middleware(
      peticion('/api/company/dashboard', { rolEnToken: 'company' })
    );

    expect(dejaPasar(res)).toBe(false);
    expect(res.status).toBe(503);
  });
});

describe('AUTH-004 — /api/vendor/* y /vendor/* exigen rol vendor o admin', () => {
  it('un candidato NO puede crear su código de descuento', async () => {
    const res = await middleware(
      peticion('/api/vendor/my-code', { rolEnToken: 'candidate', method: 'POST' })
    );

    expect(res.status).toBe(403);
  });

  it('una empresa tampoco pasa', async () => {
    const res = await middleware(
      peticion('/api/vendor/my-sales', { rolEnToken: 'company' })
    );

    expect(res.status).toBe(403);
  });

  it('un vendedor sí pasa', async () => {
    const res = await middleware(
      peticion('/api/vendor/my-code', { rolEnToken: 'vendor' })
    );

    expect(dejaPasar(res)).toBe(true);
  });

  it('un admin sí pasa', async () => {
    const res = await middleware(
      peticion('/api/vendor/my-sales', { rolEnToken: 'admin' })
    );

    expect(dejaPasar(res)).toBe(true);
  });

  it('la página /vendor/dashboard redirige a quien no es vendedor', async () => {
    const res = await middleware(
      peticion('/vendor/dashboard', { rolEnToken: 'candidate' })
    );

    expect([302, 307, 308]).toContain(res.status);
    expect(res.headers.get('location') || '').toContain('/unauthorized');
  });
});

describe('AUTH-014 / PERF-016 — documentos de candidatos', () => {
  // El staff usa /api/evaluations/candidates/[id]/documents (comprueba la
  // asignación); la ruta de admin queda solo para admin.
  it('un reclutador llega a la ruta de staff', async () => {
    const res = await middleware(
      peticion('/api/evaluations/candidates/12/documents', {
        rolEnToken: 'recruiter',
        method: 'POST'
      })
    );

    expect(dejaPasar(res)).toBe(true);
  });

  it('un especialista llega a la ruta de staff', async () => {
    const res = await middleware(
      peticion('/api/evaluations/candidates/12/documents', { rolEnToken: 'specialist' })
    );

    expect(dejaPasar(res)).toBe(true);
  });

  it('la ruta de admin ya no tiene excepción para reclutadores ni especialistas', async () => {
    for (const rol of ['recruiter', 'specialist']) {
      const res = await middleware(
        peticion('/api/admin/candidates/12/documents', { rolEnToken: rol, method: 'POST' })
      );
      expect(res.status).toBe(403);
    }
  });

  it('una empresa sigue sin poder', async () => {
    const res = await middleware(
      peticion('/api/admin/candidates/12/documents', { rolEnToken: 'company' })
    );

    expect(res.status).toBe(403);
  });

  it('la excepción NO abre el resto de /api/admin/candidates a reclutadores', async () => {
    const res = await middleware(
      peticion('/api/admin/candidates', { rolEnToken: 'recruiter' })
    );

    expect(res.status).toBe(403);
  });
});

describe('AUTH-024 / AUTH-025 — páginas de empresa fuera de /company/', () => {
  it('el matcher cubre /credits/:path* y /create-job', () => {
    const matcher = config.matcher as string[];

    expect(matcher).toContain('/credits/:path*');
    expect(matcher).toContain('/create-job');
  });

  it('/credits/purchase sin sesión redirige a /unauthorized', async () => {
    const res = await middleware(peticion('/credits/purchase'));

    expect([302, 307, 308]).toContain(res.status);
    expect(res.headers.get('location') || '').toContain('/unauthorized');
  });

  it('/credits/purchase con rol candidato redirige (antes llegaba al Brick de pago)', async () => {
    const res = await middleware(
      peticion('/credits/purchase', { rolEnToken: 'candidate' })
    );

    expect([302, 307, 308]).toContain(res.status);
    expect(res.headers.get('location') || '').toContain('reason=no-permission');
  });

  it('/create-job con rol candidato redirige', async () => {
    const res = await middleware(peticion('/create-job', { rolEnToken: 'candidate' }));

    expect([302, 307, 308]).toContain(res.status);
  });

  it('una empresa sí entra a /credits/purchase y a /create-job', async () => {
    expect(
      dejaPasar(await middleware(peticion('/credits/purchase', { rolEnToken: 'company' })))
    ).toBe(true);
    expect(
      dejaPasar(await middleware(peticion('/create-job', { rolEnToken: 'company' })))
    ).toBe(true);
  });
});
