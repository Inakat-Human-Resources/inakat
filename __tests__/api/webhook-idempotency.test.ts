/**
 * @jest-environment node
 */

// RUTA: __tests__/api/webhook-idempotency.test.ts
//
// #35/#7: el webhook de MercadoPago no debe acreditar créditos dos veces ante
// entregas concurrentes. La acreditación "reclama" el pago de forma atómica
// (updateMany condicionado a paymentStatus != 'paid'); si otra entrega ya lo
// reclamó (count=0), no se vuelve a acreditar.

export {};

jest.mock('mercadopago', () => ({
  MercadoPagoConfig: jest.fn(),
  Payment: jest.fn().mockImplementation(() => ({
    get: jest.fn().mockResolvedValue({ id: 123, status: 'approved', status_detail: 'accredited' }),
  })),
}));

jest.mock('@/lib/email', () => ({
  sendPaymentConfirmation: jest.fn().mockResolvedValue(true),
}));
jest.mock('@/lib/notifications', () => ({
  createNotification: jest.fn().mockResolvedValue(undefined),
}));

const tx = {
  creditPurchase: { updateMany: jest.fn() },
  user: { update: jest.fn() },
  creditTransaction: { create: jest.fn() },
};

jest.mock('@/lib/prisma', () => ({
  prisma: {
    creditPurchase: { findUnique: jest.fn() },
    companyRequest: { findFirst: jest.fn() },
    $transaction: jest.fn((cb: (t: typeof tx) => Promise<unknown>) => cb(tx)),
  },
}));

import { prisma } from '@/lib/prisma';

const mockPrisma = prisma as unknown as {
  creditPurchase: { findUnique: jest.Mock };
  companyRequest: { findFirst: jest.Mock };
  $transaction: jest.Mock;
};

function makeReq(body: unknown): Request {
  return {
    headers: { get: () => null },
    json: async () => body,
  } as unknown as Request;
}

const APPROVED_BODY = { type: 'payment', data: { id: 123 } };

beforeEach(() => {
  jest.clearAllMocks();
  mockPrisma.creditPurchase.findUnique.mockResolvedValue({
    id: 1,
    userId: 5,
    amount: 10,
    totalPrice: 180,
    paymentStatus: 'pending',
  });
  mockPrisma.companyRequest.findFirst.mockResolvedValue(null);
  tx.user.update.mockResolvedValue({ credits: 110 });
});

describe('POST /api/webhooks/mercadopago — idempotencia', () => {
  it('acredita una vez cuando reclama el pago (count=1)', async () => {
    tx.creditPurchase.updateMany.mockResolvedValue({ count: 1 });

    const { POST } = await import('@/app/api/webhooks/mercadopago/route');
    const res = await POST(makeReq(APPROVED_BODY) as never);
    const body = await res.json();

    expect(body.received).toBe(true);
    expect(body.alreadyProcessed).toBeUndefined();
    expect(tx.user.update).toHaveBeenCalledTimes(1);
    expect(tx.creditTransaction.create).toHaveBeenCalledTimes(1);
  });

  it('NO acredita de nuevo si otra entrega ya reclamó el pago (count=0)', async () => {
    tx.creditPurchase.updateMany.mockResolvedValue({ count: 0 });

    const { POST } = await import('@/app/api/webhooks/mercadopago/route');
    const res = await POST(makeReq(APPROVED_BODY) as never);
    const body = await res.json();

    expect(body.alreadyProcessed).toBe(true);
    expect(tx.user.update).not.toHaveBeenCalled();
    expect(tx.creditTransaction.create).not.toHaveBeenCalled();
  });
});
