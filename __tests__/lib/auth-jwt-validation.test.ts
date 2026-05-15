// RUTA: __tests__/lib/auth-jwt-validation.test.ts

/**
 * Tests para la validación estricta de JWT_SECRET al cargar src/lib/auth.ts.
 * El módulo debe arrojar error si:
 * - JWT_SECRET no está definido
 * - JWT_SECRET tiene menos de 32 caracteres
 *
 * Nota: mockeamos '@/lib/prisma' porque el cliente de Prisma carga
 * dotenv internamente al requerirlo, restaurando JWT_SECRET desde .env
 * y haciendo imposible probar la validación de otra manera.
 */

jest.mock('@/lib/prisma', () => ({
  prisma: {
    user: { findUnique: jest.fn(), update: jest.fn() },
  },
}));

jest.mock('bcryptjs', () => ({
  hash: jest.fn(),
  compare: jest.fn(),
}));

jest.mock('jsonwebtoken', () => ({
  sign: jest.fn(),
  verify: jest.fn(),
}));

describe('JWT_SECRET validation', () => {
  const originalSecret = process.env.JWT_SECRET;

  afterEach(() => {
    if (originalSecret !== undefined) {
      process.env.JWT_SECRET = originalSecret;
    } else {
      delete process.env.JWT_SECRET;
    }
    jest.resetModules();
  });

  beforeEach(() => {
    jest.resetModules();
  });

  it('debería arrojar error si JWT_SECRET no está definido', () => {
    delete process.env.JWT_SECRET;
    expect(() => require('@/lib/auth')).toThrow(
      /JWT_SECRET no está configurado/
    );
  });

  it('debería arrojar error si JWT_SECRET tiene menos de 32 caracteres', () => {
    process.env.JWT_SECRET = 'short';
    expect(() => require('@/lib/auth')).toThrow(/al menos 32 caracteres/);
  });

  it('debería arrojar error si JWT_SECRET tiene exactamente 31 caracteres', () => {
    process.env.JWT_SECRET = 'a'.repeat(31);
    expect(() => require('@/lib/auth')).toThrow(/al menos 32 caracteres/);
  });

  it('debería cargar correctamente con JWT_SECRET de 32 caracteres', () => {
    process.env.JWT_SECRET = 'a'.repeat(32);
    expect(() => require('@/lib/auth')).not.toThrow();
  });

  it('debería cargar correctamente con JWT_SECRET de 64 caracteres', () => {
    process.env.JWT_SECRET = 'a'.repeat(64);
    expect(() => require('@/lib/auth')).not.toThrow();
  });
});
