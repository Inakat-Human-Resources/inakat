// RUTA: __tests__/lib/auth-centralized.test.ts

/**
 * Tests para las funciones centralizadas de auth (requireAuth, requireRole).
 * Verifica que:
 * - Sin cookie → error 401
 * - Token inválido → error 401
 * - Usuario no existe → error 403
 * - Usuario desactivado → error 403
 * - Rol incorrecto → error 403
 * - Todo bien → retorna user
 */

// Mock prisma
const mockFindUnique = jest.fn();
jest.mock('@/lib/prisma', () => ({
  prisma: {
    user: { findUnique: (...args: any[]) => mockFindUnique(...args) },
  },
}));

// Mock jwt.verify via the auth module's verifyToken
// Since auth.ts uses jwt internally, we mock jsonwebtoken
const mockJwtVerify = jest.fn();
jest.mock('jsonwebtoken', () => ({
  sign: jest.fn(() => 'mock-token'),
  verify: (...args: any[]) => mockJwtVerify(...args),
}));

// Mock bcryptjs (auth.ts imports it)
jest.mock('bcryptjs', () => ({
  hash: jest.fn(),
  compare: jest.fn(),
}));

// Mock next/headers — requireAuth uses dynamic import: await import('next/headers')
const mockCookieGet = jest.fn();
jest.mock('next/headers', () => ({
  cookies: jest.fn(() =>
    Promise.resolve({
      get: mockCookieGet,
    })
  ),
}));

// Import AFTER mocks
import { requireAuth, requireRole } from '@/lib/auth';

const mockUser = {
  id: 1,
  email: 'admin@test.com',
  nombre: 'Admin',
  apellidoPaterno: 'Test',
  apellidoMaterno: null,
  role: 'admin',
  isActive: true,
  credits: 100,
  specialty: null,
};

describe('requireAuth', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('debe retornar error 401 si no hay cookie', async () => {
    mockCookieGet.mockReturnValue(undefined);
    const result = await requireAuth();
    expect('error' in result).toBe(true);
    if ('error' in result) {
      expect(result.status).toBe(401);
    }
  });

  it('debe retornar error 401 si token es inválido', async () => {
    mockCookieGet.mockReturnValue({ value: 'bad-token' });
    mockJwtVerify.mockImplementation(() => {
      throw new Error('invalid token');
    });
    const result = await requireAuth();
    expect('error' in result).toBe(true);
    if ('error' in result) {
      expect(result.status).toBe(401);
    }
  });

  it('debe retornar error 401 si payload no tiene userId', async () => {
    mockCookieGet.mockReturnValue({ value: 'token-without-userid' });
    mockJwtVerify.mockReturnValue({ email: 'test@test.com' }); // no userId
    const result = await requireAuth();
    expect('error' in result).toBe(true);
    if ('error' in result) {
      expect(result.status).toBe(401);
    }
  });

  it('debe retornar error 403 si usuario no existe', async () => {
    mockCookieGet.mockReturnValue({ value: 'valid-token' });
    mockJwtVerify.mockReturnValue({ userId: 999, email: 'x@x.com', role: 'admin' });
    mockFindUnique.mockResolvedValue(null);
    const result = await requireAuth();
    expect('error' in result).toBe(true);
    if ('error' in result) {
      expect(result.status).toBe(403);
    }
  });

  it('debe retornar error 403 si usuario está desactivado', async () => {
    mockCookieGet.mockReturnValue({ value: 'valid-token' });
    mockJwtVerify.mockReturnValue({ userId: 1, email: 'admin@test.com', role: 'admin' });
    mockFindUnique.mockResolvedValue({ ...mockUser, isActive: false });
    const result = await requireAuth();
    expect('error' in result).toBe(true);
    if ('error' in result) {
      expect(result.status).toBe(403);
    }
  });

  it('debe retornar user si todo es válido', async () => {
    mockCookieGet.mockReturnValue({ value: 'valid-token' });
    mockJwtVerify.mockReturnValue({ userId: 1, email: 'admin@test.com', role: 'admin' });
    mockFindUnique.mockResolvedValue(mockUser);
    const result = await requireAuth();
    expect('error' in result).toBe(false);
    if (!('error' in result)) {
      expect(result.user.id).toBe(1);
      expect(result.user.email).toBe('admin@test.com');
      expect(result.user.role).toBe('admin');
      expect(result.user.isActive).toBe(true);
      expect(result.user.credits).toBe(100);
    }
  });

  it('debe pasar el userId correcto al query de prisma', async () => {
    mockCookieGet.mockReturnValue({ value: 'valid-token' });
    mockJwtVerify.mockReturnValue({ userId: 42, email: 'test@test.com', role: 'admin' });
    mockFindUnique.mockResolvedValue({ ...mockUser, id: 42 });
    await requireAuth();
    expect(mockFindUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 42 },
      })
    );
  });
});

describe('requireRole', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Setup default valid auth flow
    mockCookieGet.mockReturnValue({ value: 'valid-token' });
    mockJwtVerify.mockReturnValue({ userId: 1, email: 'admin@test.com', role: 'admin' });
  });

  it('debe permitir acceso si el rol coincide (string)', async () => {
    mockFindUnique.mockResolvedValue(mockUser); // role: 'admin'
    const result = await requireRole('admin');
    expect('error' in result).toBe(false);
    if (!('error' in result)) {
      expect(result.user.role).toBe('admin');
    }
  });

  it('debe permitir acceso si el rol está en el array', async () => {
    mockFindUnique.mockResolvedValue({ ...mockUser, role: 'recruiter' });
    const result = await requireRole(['recruiter', 'admin']);
    expect('error' in result).toBe(false);
  });

  it('debe denegar acceso si el rol no coincide', async () => {
    mockFindUnique.mockResolvedValue({ ...mockUser, role: 'company' });
    const result = await requireRole('admin');
    expect('error' in result).toBe(true);
    if ('error' in result) {
      expect(result.status).toBe(403);
      expect(result.error).toContain('denegado');
    }
  });

  it('debe denegar acceso si el rol no está en el array', async () => {
    mockFindUnique.mockResolvedValue({ ...mockUser, role: 'candidate' });
    const result = await requireRole(['admin', 'recruiter', 'specialist']);
    expect('error' in result).toBe(true);
    if ('error' in result) {
      expect(result.status).toBe(403);
    }
  });

  it('debe propagar errores de auth (sin cookie)', async () => {
    mockCookieGet.mockReturnValue(undefined);
    const result = await requireRole('admin');
    expect('error' in result).toBe(true);
    if ('error' in result) {
      expect(result.status).toBe(401);
    }
  });

  it('debe propagar errores de auth (token inválido)', async () => {
    mockCookieGet.mockReturnValue({ value: 'bad' });
    mockJwtVerify.mockImplementation(() => {
      throw new Error('invalid');
    });
    const result = await requireRole('admin');
    expect('error' in result).toBe(true);
    if ('error' in result) {
      expect(result.status).toBe(401);
    }
  });

  it('debe aceptar specialist con rol ["specialist", "admin"]', async () => {
    mockFindUnique.mockResolvedValue({ ...mockUser, role: 'specialist' });
    const result = await requireRole(['specialist', 'admin']);
    expect('error' in result).toBe(false);
  });

  it('debe rechazar company con rol ["admin", "recruiter"]', async () => {
    mockFindUnique.mockResolvedValue({ ...mockUser, role: 'company' });
    const result = await requireRole(['admin', 'recruiter']);
    expect('error' in result).toBe(true);
  });
});
