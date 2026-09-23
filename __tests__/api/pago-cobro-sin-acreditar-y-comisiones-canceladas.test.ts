// RUTA: __tests__/api/pago-cobro-sin-acreditar-y-comisiones-canceladas.test.ts

/**
 * @jest-environment node
 */

/**
 * Residuales del módulo de pagos (auditoría 2026-09):
 *
 * - PAGO-002: si MercadoPago APRUEBA el cobro y luego falla la transacción que
 *   acredita, la ruta respondía 500 "Error al procesar el pago". La empresa ya
 *   estaba cobrada, creía que no, y reintentaba: segundo cargo.
 * - PAGO-012: una comisión 'cancelled' (compra rechazada/devuelta) se podía
 *   reabrir con un PUT a 'pending'.
 * - Las comisiones canceladas se etiquetaban "Pendiente".
 */

jest.mock('next/server', () => ({
  NextRequest: class {},
  NextResponse: {
    json: (data: unknown, options?: { status?: number }) => ({
      status: options?.status ?? 200,
      json: async () => data
    })
  }
}));

const mockPrisma = {
  creditPackage: { findFirst: jest.fn() },
  user: { findUnique: jest.fn() },
  creditPurchase: { create: jest.fn(), update: jest.fn(), updateMany: jest.fn() },
  discountCode: { findFirst: jest.fn() },
  discountCodeUse: {
    findUnique: jest.fn(),
    findUniqueOrThrow: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn()
  },
  companyRequest: { findFirst: jest.fn() },
  $transaction: jest.fn()
};

jest.mock('@/lib/prisma', () => ({ prisma: mockPrisma }));

jest.mock('@/lib/auth', () => ({
  verifyToken: jest.fn(),
  requireRole: jest.fn(),
  // EMP-002: la compra exige empresa aprobada; aquí se da por aprobada.
  requireApprovedCompany: jest.fn().mockResolvedValue(null)
}));

jest.mock('@/lib/notifications', () => ({
  createNotification: jest.fn().mockResolvedValue(undefined)
}));

jest.mock('@/lib/email', () => ({
  sendPaymentConfirmation: jest.fn().mockResolvedValue(true)
}));

const mockPaymentCreate = jest.fn();
jest.mock('mercadopago', () => ({
  MercadoPagoConfig: class {},
  Payment: class {
    create = mockPaymentCreate;
  }
}));

import { verifyToken, requireRole } from '@/lib/auth';
import { createNotification } from '@/lib/notifications';
import { etiquetaEstadoComision } from '@/lib/comisiones';

const mockVerifyToken = verifyToken as unknown as jest.Mock;
const mockRequireRole = requireRole as unknown as jest.Mock;

const TOKEN_ORIGINAL = process.env.MERCADOPAGO_ACCESS_TOKEN;

beforeAll(() => {
  process.env.MERCADOPAGO_ACCESS_TOKEN = 'TEST-token';
});

afterAll(() => {
  process.env.MERCADOPAGO_ACCESS_TOKEN = TOKEN_ORIGINAL;
});

beforeEach(() => {
  jest.clearAllMocks();
});

function reqCompra(body: unknown) {
  return {
    cookies: {
      get: (name: string) => (name === 'auth-token' ? { value: 'tok' } : undefined)
    },
    json: async () => body
  } as unknown as Parameters<typeof import('@/app/api/credits/purchases/route').POST>[0];
}

describe('POST /api/credits/purchases — cobro aprobado con acreditación fallida (PAGO-002)', () => {
  beforeEach(() => {
    mockVerifyToken.mockReturnValue({ userId: 42, email: 'e@test.com', role: 'company' });
    mockPrisma.creditPackage.findFirst.mockResolvedValue({
      id: 3,
      credits: 10,
      price: 35000,
      isActive: true
    });
    mockPrisma.user.findUnique.mockResolvedValue({
      id: 42,
      email: 'e@test.com',
      credits: 0,
      companyRequest: { rfc: 'XAXX010101000' }
    });
    mockPrisma.creditPurchase.create.mockResolvedValue({ id: 900 });
    mockPrisma.creditPurchase.update.mockResolvedValue({});
    mockPaymentCreate.mockResolvedValue({ id: 555, status: 'approved' });
  });

  const body = {
    packageId: 3,
    paymentData: { token: 'card-tok', payment_method_id: 'visa', installments: 1 }
  };

  it('responde 202 "en proceso" (nunca 500) si la transacción de acreditación falla', async () => {
    mockPrisma.$transaction.mockRejectedValue(new Error('Connection pool timeout'));

    const { POST } = await import('@/app/api/credits/purchases/route');
    const res = await POST(reqCompra(body));
    const data = (await res.json()) as { success: boolean; status: string };

    expect(res.status).toBe(202);
    expect(data.success).toBe(true);
    // Es el estado que la página ya trata como "pago recibido, créditos en camino".
    expect(data.status).toBe('in_process');
  });

  it('no marca la compra como failed: queda pending para que el webhook la acredite', async () => {
    mockPrisma.$transaction.mockRejectedValue(new Error('Connection pool timeout'));

    const { POST } = await import('@/app/api/credits/purchases/route');
    await POST(reqCompra(body));

    const marcadasFailed = [
      ...mockPrisma.creditPurchase.update.mock.calls,
      ...mockPrisma.creditPurchase.updateMany.mock.calls
    ].filter(([args]) => args?.data?.paymentStatus === 'failed');
    expect(marcadasFailed).toHaveLength(0);
    // Y no se notifica una acreditación que no ocurrió.
    expect(createNotification).not.toHaveBeenCalled();
  });

  it('el cobro llevó external_reference e idempotencyKey de la compra', async () => {
    mockPrisma.$transaction.mockRejectedValue(new Error('boom'));

    const { POST } = await import('@/app/api/credits/purchases/route');
    await POST(reqCompra(body));

    const llamada = mockPaymentCreate.mock.calls[0][0];
    expect(llamada.body.external_reference).toBe('900');
    expect(llamada.requestOptions.idempotencyKey).toContain('900');
  });
});

describe('PUT /api/admin/vendors/commissions/[id] — comisión cancelada (PAGO-012)', () => {
  const params = (id: string) => ({ params: Promise.resolve({ id }) });
  const reqPut = (b: unknown) => ({ headers: { get: () => null }, json: async () => b }) as never;

  beforeEach(() => {
    mockRequireRole.mockResolvedValue({ user: { id: 1, role: 'admin' } });
    mockPrisma.discountCodeUse.findUnique.mockResolvedValue({
      id: 8,
      commissionStatus: 'cancelled',
      commissionPaidAt: null,
      paymentProofUrl: null,
      purchaseId: 70,
      purchase: { paymentStatus: 'refunded' },
      code: { user: { id: 3, nombre: 'Juan', email: 'j@test.com' } }
    });
  });

  it('no se puede reabrir a pending', async () => {
    const { PUT } = await import('@/app/api/admin/vendors/commissions/[id]/route');
    const res = await PUT(reqPut({ status: 'pending' }), params('8'));

    expect(res.status).toBe(409);
    expect(mockPrisma.discountCodeUse.update).not.toHaveBeenCalled();
    expect(mockPrisma.discountCodeUse.updateMany).not.toHaveBeenCalled();
  });
});

describe('etiquetaEstadoComision', () => {
  it('una comisión cancelada no se presenta como pendiente de pago', () => {
    expect(etiquetaEstadoComision('cancelled')).toBe('Cancelada');
    expect(etiquetaEstadoComision('paid')).toBe('Pagada');
    expect(etiquetaEstadoComision('pending')).toBe('Pendiente');
  });
});
