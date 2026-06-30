// RUTA: __tests__/api/credits-purchases-self-referral.test.ts

/**
 * @jest-environment node
 */

/**
 * Test del fix #34 (auto-referido): un usuario NO puede aplicar en su propia
 * compra un código de descuento que él mismo creó (se auto-asignaría descuento
 * + comisión). El handler real debe responder 400 ANTES de crear el pago o de
 * registrar el uso del código.
 */

jest.mock('next/server', () => ({
  NextRequest: class {},
  NextResponse: {
    json: (data: unknown, options?: { status?: number }) => ({
      status: options?.status ?? 200,
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

const mockPaymentCreate = jest.fn();
jest.mock('mercadopago', () => ({
  MercadoPagoConfig: class {},
  Payment: class {
    create = mockPaymentCreate;
  },
}));

import { verifyToken } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

const mockVerifyToken = verifyToken as unknown as jest.Mock;
const mockPrisma = prisma as unknown as {
  creditPackage: { findFirst: jest.Mock };
  user: { findUnique: jest.Mock };
  creditPurchase: { create: jest.Mock };
  discountCode: { findFirst: jest.Mock };
  discountCodeUse: { create: jest.Mock };
  $transaction: jest.Mock;
};

interface PurchaseReqBody {
  packageType: string;
  paymentData: Record<string, unknown>;
  discountCode?: string;
}

function makeReq(token: string, body: PurchaseReqBody) {
  return {
    cookies: {
      get: (name: string) =>
        name === 'auth-token' ? { value: token } : undefined,
    },
    json: async () => body,
  } as unknown as Parameters<
    typeof import('@/app/api/credits/purchases/route').POST
  >[0];
}

describe('POST /api/credits/purchases — fix #34 auto-referido', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockVerifyToken.mockReset();
  });

  it('rechaza con 400 cuando el comprador usa su propio código de descuento', async () => {
    const buyerId = 42;

    mockVerifyToken.mockReturnValue({
      userId: buyerId,
      email: 'empresa@test.com',
      role: 'company',
    });

    mockPrisma.creditPackage.findFirst.mockResolvedValue({
      id: 1,
      credits: 10,
      price: 1000,
      isActive: true,
    });

    // El código pertenece al MISMO usuario que está comprando.
    mockPrisma.discountCode.findFirst.mockResolvedValue({
      id: 7,
      code: 'MICODIGO',
      userId: buyerId,
      discountPercent: 20,
      commissionPercent: 10,
    });

    const { POST } = await import('@/app/api/credits/purchases/route');
    const res = await POST(
      makeReq('token-company', {
        packageType: 'pack_10',
        paymentData: {},
        discountCode: 'MICODIGO',
      })
    );

    expect(res.status).toBe(400);
    const responseBody = (await res.json()) as { error?: string };
    expect(responseBody.error).toMatch(/tu propio código/i);

    // No debe haber creado el pago ni registrado el uso del código.
    expect(mockPaymentCreate).not.toHaveBeenCalled();
    expect(mockPrisma.creditPurchase.create).not.toHaveBeenCalled();
    expect(mockPrisma.discountCodeUse.create).not.toHaveBeenCalled();
  });
});
