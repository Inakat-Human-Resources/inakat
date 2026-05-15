// RUTA: __tests__/api/credits-purchases-auth.test.ts

/**
 * Tests para la verificación de auth en POST /api/credits/purchases.
 * Anteriormente usaba jwt.verify directo con `as any` y crasheaba ante token corrupto.
 * Ahora usa verifyToken centralizado que retorna null y devuelve 401.
 */

jest.mock('next/server', () => ({
  NextRequest: class {},
  NextResponse: {
    json: (data: any, options?: any) => ({
      status: options?.status || 200,
      json: async () => data,
    }),
  },
}));

jest.mock('@/lib/prisma', () => ({
  prisma: {
    creditPackage: { findFirst: jest.fn() },
    user: { findUnique: jest.fn() },
    creditPurchase: { create: jest.fn() },
    discountCode: { findFirst: jest.fn() },
    discountCodeUse: { create: jest.fn() },
    $transaction: jest.fn(),
  },
}));

jest.mock('@/lib/auth', () => ({
  verifyToken: jest.fn(),
}));

jest.mock('mercadopago', () => ({
  MercadoPagoConfig: class {},
  Payment: class {
    create = jest.fn();
  },
}));

import { verifyToken } from '@/lib/auth';
const mockVerifyToken = verifyToken as jest.Mock;

function makeReq(token?: string) {
  return {
    cookies: {
      get: (name: string) => (name === 'auth-token' && token ? { value: token } : undefined),
    },
    json: async () => ({ packageType: 'pack_10', paymentData: {} }),
  } as any;
}

describe('POST /api/credits/purchases — auth verification', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockVerifyToken.mockReset();
  });

  it('debería retornar 401 si no hay cookie auth-token', async () => {
    const { POST } = await import('@/app/api/credits/purchases/route');
    const res = await POST(makeReq());
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toBe('No autorizado');
  });

  it('debería retornar 401 si el token es inválido (verifyToken devuelve null)', async () => {
    mockVerifyToken.mockReturnValue(null);
    const { POST } = await import('@/app/api/credits/purchases/route');
    const res = await POST(makeReq('token-invalido'));
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toMatch(/inválido|expirado/i);
  });

  it('debería retornar 403 si el rol no es company', async () => {
    mockVerifyToken.mockReturnValue({ userId: 1, email: 'admin@test.com', role: 'admin' });
    const { POST } = await import('@/app/api/credits/purchases/route');
    const res = await POST(makeReq('token-de-admin'));
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toBe('Solo empresas');
  });

  it('no debería usar jwt.verify directamente (route no lo importa)', () => {
    const fs = require('fs');
    const path = require('path');
    const filePath = path.resolve(process.cwd(), 'src/app/api/credits/purchases/route.ts');
    const content = fs.readFileSync(filePath, 'utf8');
    expect(content).not.toMatch(/^import jwt from 'jsonwebtoken'/m);
    expect(content).not.toMatch(/jwt\.verify\(/);
    expect(content).toContain("import { verifyToken } from '@/lib/auth'");
  });
});
