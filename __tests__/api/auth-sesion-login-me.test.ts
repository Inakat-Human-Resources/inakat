/**
 * @jest-environment node
 */

// RUTA: __tests__/api/auth-sesion-login-me.test.ts
//
// AUTH-011: los límites de login contaban también los intentos correctos (una
// oficina con 8 personas entrando a las 9:00 se bloqueaba) y no había límite
// por cuenta (fuerza bruta distribuida contra un solo email).
// AUTH-002: /api/auth/me negaba a un usuario borrado o desactivado pero dejaba
// la cookie viva en el navegador.
// AUTH-022: el maxAge de la cookie sale de JWT_EXPIRES_IN.

process.env.JWT_SECRET =
  process.env.JWT_SECRET || 'test-secret-con-mas-de-treinta-y-dos-caracteres-123';

const mockPrisma = {
  user: { findUnique: jest.fn(), update: jest.fn() }
};

// Getter perezoso: los `import` se elevan por encima de las `const`.
jest.mock('@/lib/prisma', () => ({
  get prisma() {
    return mockPrisma;
  }
}));

let mockCookieToken: string | undefined;

jest.mock('next/headers', () => ({
  cookies: jest.fn(async () => ({
    get: (nombre: string) =>
      nombre === 'auth-token' && mockCookieToken ? { value: mockCookieToken } : undefined
  }))
}));

import bcrypt from 'bcryptjs';
import { POST as login } from '@/app/api/auth/login/route';
import { GET as me } from '@/app/api/auth/me/route';
import { generateToken, getAuthCookieMaxAge } from '@/lib/auth';

const PASSWORD = 'Password1';
let hashDePrueba = '';

beforeAll(async () => {
  // Coste bajo: sólo se prueba el flujo, no la fuerza del hash.
  hashDePrueba = await bcrypt.hash(PASSWORD, 4);
});

beforeEach(() => {
  jest.clearAllMocks();
  mockPrisma.user.update.mockResolvedValue({});
});

function usuarioActivo(email: string) {
  return {
    id: 3,
    email,
    password: hashDePrueba,
    nombre: 'Reclutadora',
    apellidoPaterno: null,
    apellidoMaterno: null,
    role: 'recruiter',
    isActive: true
  };
}

function pedirLogin(email: string, password: string, ip: string) {
  return new Request('http://localhost:3000/api/auth/login', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-forwarded-for': ip },
    body: JSON.stringify({ email, password })
  });
}

describe('AUTH-011 — límites de login', () => {
  it('los logins CORRECTOS no agotan el cupo de la IP (oficina compartida)', async () => {
    const ip = '192.0.2.10';

    for (let i = 0; i < 9; i++) {
      const email = `persona${i}@inakat.test`;
      mockPrisma.user.findUnique.mockResolvedValue(usuarioActivo(email));

      const res = await login(pedirLogin(email, PASSWORD, ip));
      expect(res.status).toBe(200);
    }
  });

  it('7 fallos desde la misma IP bloquean el 8.º intento', async () => {
    const ip = '192.0.2.20';
    mockPrisma.user.findUnique.mockResolvedValue(null);

    for (let i = 0; i < 7; i++) {
      const res = await login(pedirLogin(`nadie${i}@inakat.test`, 'Mala1234', ip));
      expect(res.status).toBe(401);
    }

    const res = await login(pedirLogin('otro@inakat.test', 'Mala1234', ip));
    expect(res.status).toBe(429);
  });

  it('hay límite POR CUENTA aunque cada intento llegue de otra IP', async () => {
    const email = 'admin@inakat.test';
    mockPrisma.user.findUnique.mockResolvedValue(usuarioActivo(email));

    for (let i = 0; i < 10; i++) {
      const res = await login(pedirLogin(email, 'Mala1234', `203.0.113.${100 + i}`));
      expect(res.status).toBe(401);
    }

    const res = await login(pedirLogin(email, PASSWORD, '203.0.113.200'));
    expect(res.status).toBe(429);
  });

  it('AUTH-022: la cookie lleva el maxAge derivado de JWT_EXPIRES_IN', async () => {
    const email = 'cookie@inakat.test';
    mockPrisma.user.findUnique.mockResolvedValue(usuarioActivo(email));

    const res = await login(pedirLogin(email, PASSWORD, '192.0.2.99'));
    const cookie = res.headers.get('set-cookie') || '';

    expect(cookie).toContain(`Max-Age=${getAuthCookieMaxAge()}`);
  });
});

describe('AUTH-002 — /api/auth/me borra la cookie de una sesión que ya no vale', () => {
  const cookieBorrada = (res: Response) => {
    const cookie = res.headers.get('set-cookie') || '';
    return cookie.includes('auth-token=') && /Max-Age=0|Expires=Thu, 01 Jan 1970/i.test(cookie);
  };

  beforeEach(() => {
    mockCookieToken = generateToken({ userId: 3, email: 'x@inakat.test', role: 'company' });
  });

  it('usuario desactivado → 403 y cookie borrada', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({ id: 3, isActive: false });

    const res = await me();

    expect(res.status).toBe(403);
    expect(cookieBorrada(res)).toBe(true);
  });

  it('usuario borrado → 404 y cookie borrada', async () => {
    mockPrisma.user.findUnique.mockResolvedValue(null);

    const res = await me();

    expect(res.status).toBe(404);
    expect(cookieBorrada(res)).toBe(true);
  });

  it('sin cookie → 200 con user null (UI-017: un anónimo no es un error)', async () => {
    mockCookieToken = undefined;

    const res = await me();
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toEqual({ success: true, user: null });
    expect(mockPrisma.user.findUnique).not.toHaveBeenCalled();
  });

  it('token inválido → 401 y cookie borrada', async () => {
    mockCookieToken = 'no-es-un-jwt';

    const res = await me();

    expect(res.status).toBe(401);
    expect(cookieBorrada(res)).toBe(true);
  });

  it('usuario activo → 200 y la cookie NO se toca', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({
      id: 3,
      email: 'x@inakat.test',
      role: 'company',
      isActive: true
    });

    const res = await me();

    expect(res.status).toBe(200);
    expect(res.headers.get('set-cookie')).toBeNull();
  });
});
