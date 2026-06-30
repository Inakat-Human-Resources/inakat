/**
 * @jest-environment node
 */

// RUTA: __tests__/api/company-interviews-jsonparse.test.ts
//
// #53: GET /api/company/interviews no debe devolver 500 para TODO el listado si
// una sola fila tiene un campo JSON malformado. El parseo es tolerante por fila.

export {};

jest.mock('@/lib/prisma', () => ({
  prisma: { interviewRequest: { findMany: jest.fn() } },
}));

import { GET } from '@/app/api/company/interviews/route';
import { prisma } from '@/lib/prisma';

const mockPrisma = prisma as unknown as {
  interviewRequest: { findMany: jest.Mock };
};

function makeReq(headers: Record<string, string>) {
  return {
    headers: { get: (n: string) => headers[n] ?? null },
  } as never;
}

describe('GET /api/company/interviews — parseo tolerante (#53)', () => {
  beforeEach(() => jest.clearAllMocks());

  it('no falla si una fila tiene availableSlots malformado; usa fallback []', async () => {
    mockPrisma.interviewRequest.findMany.mockResolvedValue([
      {
        id: 1,
        participants: null,
        availableSlots: '[{"date":"2026-07-01"}]', // válido
        confirmedSlot: null,
      },
      {
        id: 2,
        participants: '{{not-json',
        availableSlots: 'esto no es json', // corrupto
        confirmedSlot: 'tampoco',
      },
    ]);

    const res = await GET(makeReq({ 'x-user-id': '5', 'x-user-role': 'company' }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data).toHaveLength(2);
    // Fila válida parseada
    expect(body.data[0].availableSlots).toEqual([{ date: '2026-07-01' }]);
    // Fila corrupta -> fallbacks, sin tirar el listado
    expect(body.data[1].availableSlots).toEqual([]);
    expect(body.data[1].participants).toBeNull();
    expect(body.data[1].confirmedSlot).toBeNull();
  });
});
