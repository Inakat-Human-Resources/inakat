/**
 * @jest-environment node
 */

// RUTA: __tests__/api/pago-residuales.test.ts
//
// Remates del módulo de pagos:
// - el id de la comisión se valida como entero positivo ('12abc' ya no se lee
//   como la comisión 12),
// - un rechazo tardío en el webhook no cancela la comisión de una compra que
//   ya está pagada (eso sólo lo hace la rama de devolución).

export {};

const mockPaymentGet = jest.fn();

jest.mock('mercadopago', () => ({
  MercadoPagoConfig: jest.fn(),
  Payment: jest.fn().mockImplementation(() => ({ get: mockPaymentGet }))
}));

jest.mock('@/lib/email', () => ({
  sendPaymentConfirmation: jest.fn().mockResolvedValue(true)
}));

jest.mock('@/lib/notifications', () => ({
  createNotification: jest.fn().mockResolvedValue(undefined),
  notifyAllAdmins: jest.fn().mockResolvedValue(undefined)
}));

jest.mock('@/lib/auth', () => ({
  requireRole: jest.fn()
}));

jest.mock('@/lib/prisma', () => ({
  prisma: {
    creditPurchase: { findUnique: jest.fn(), updateMany: jest.fn(), update: jest.fn() },
    discountCodeUse: { findUnique: jest.fn(), updateMany: jest.fn() },
    companyRequest: { findFirst: jest.fn() },
    $transaction: jest.fn()
  }
}));

import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/auth';

const mockPrisma = prisma as unknown as {
  creditPurchase: { findUnique: jest.Mock; updateMany: jest.Mock; update: jest.Mock };
  discountCodeUse: { findUnique: jest.Mock; updateMany: jest.Mock };
};

function peticion(body: unknown): Request {
  return {
    headers: { get: () => null },
    json: async () => body,
    url: 'http://localhost:3000/api/x'
  } as unknown as Request;
}

beforeEach(() => {
  jest.clearAllMocks();
  (requireRole as jest.Mock).mockResolvedValue({ user: { id: 7, role: 'admin' } });
});

describe('PUT/GET /api/admin/vendors/commissions/[id] — id estricto', () => {
  it.each(['12abc', '0', '-3', '1.5', 'abc'])('rechaza el id %p con 400 sin consultar la base', async (id) => {
    const { PUT, GET } = await import('@/app/api/admin/vendors/commissions/[id]/route');
    const params = { params: Promise.resolve({ id }) };

    const put = await PUT(peticion({ status: 'paid' }) as never, params);
    const get = await GET(peticion({}) as never, { params: Promise.resolve({ id }) });

    expect(put.status).toBe(400);
    expect(get.status).toBe(400);
    expect(mockPrisma.discountCodeUse.findUnique).not.toHaveBeenCalled();
  });
});

describe('POST /api/webhooks/mercadopago — rechazo tardío', () => {
  it('sólo cancela comisiones de compras que NO están pagadas', async () => {
    mockPaymentGet.mockResolvedValue({ id: 555, status: 'rejected', status_detail: 'cc_rejected' });
    mockPrisma.creditPurchase.findUnique.mockResolvedValue({
      id: 1,
      userId: 5,
      amount: 10,
      totalPrice: 35000,
      paymentStatus: 'paid'
    });
    mockPrisma.creditPurchase.updateMany.mockResolvedValue({ count: 0 });
    mockPrisma.discountCodeUse.updateMany.mockResolvedValue({ count: 0 });

    const { POST } = await import('@/app/api/webhooks/mercadopago/route');
    const res = await POST(peticion({ type: 'payment', data: { id: 555 } }) as never);

    expect(res.status).toBe(200);

    // La compra sólo se degrada si no estaba pagada...
    expect(mockPrisma.creditPurchase.updateMany).toHaveBeenCalledWith({
      where: { id: 1, paymentStatus: { not: 'paid' } },
      data: { paymentStatus: 'failed' }
    });

    // ...y la comisión, con la misma guarda.
    expect(mockPrisma.discountCodeUse.updateMany).toHaveBeenCalledWith({
      where: {
        purchaseId: 1,
        commissionStatus: 'pending',
        purchase: { paymentStatus: { not: 'paid' } }
      },
      data: { commissionStatus: 'cancelled' }
    });
  });
});
