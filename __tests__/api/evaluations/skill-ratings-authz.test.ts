/**
 * @jest-environment node
 */

// RUTA: __tests__/api/evaluations/skill-ratings-authz.test.ts
//
// Cierra IDOR cross-tenant en /api/evaluations/skill-ratings.
// Ejercita el HANDLER REAL (GET/POST) — no reimplementa la lógica.
//
// Estos handlers leen la identidad desde headers inyectados por el middleware
// (x-user-id / x-user-role), no desde la cookie auth-token, por eso el request
// de prueba expone headers.get(...) en vez de cookies.

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
    application: { findUnique: jest.fn() },
    skillRating: { findMany: jest.fn(), upsert: jest.fn() },
  },
}));

import type { NextRequest } from 'next/server';
import { GET, POST } from '@/app/api/evaluations/skill-ratings/route';
import { prisma } from '@/lib/prisma';

const mockPrisma = prisma as unknown as {
  application: { findUnique: jest.Mock };
  skillRating: { findMany: jest.Mock; upsert: jest.Mock };
};

interface RouteResponse {
  status: number;
  json: () => Promise<{ success: boolean; error?: string; data?: unknown }>;
}

function makeGetReq(
  headers: Record<string, string>,
  applicationId: string
): NextRequest {
  return {
    headers: { get: (n: string) => headers[n] ?? null },
    url: `http://localhost/api/evaluations/skill-ratings?applicationId=${applicationId}`,
  } as unknown as NextRequest;
}

function makePostReq(
  headers: Record<string, string>,
  body: unknown
): NextRequest {
  return {
    headers: { get: (n: string) => headers[n] ?? null },
    url: 'http://localhost/api/evaluations/skill-ratings',
    json: async () => body,
  } as unknown as NextRequest;
}

describe('GET /api/evaluations/skill-ratings — autorización por ownership', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('niega a una company que NO es dueña de la vacante (IDOR) con 403', async () => {
    // La application pertenece a la job de OTRA empresa (userId 999)
    mockPrisma.application.findUnique.mockResolvedValue({
      id: 10,
      status: 'sent_to_company',
      job: { userId: 999, assignment: null },
    });

    const res = (await GET(
      makeGetReq({ 'x-user-id': '1', 'x-user-role': 'company' }, '10')
    )) as unknown as RouteResponse;

    expect(res.status).toBe(403);
    expect(mockPrisma.skillRating.findMany).not.toHaveBeenCalled();
  });

  it('permite a la company dueña de la vacante con status visible', async () => {
    mockPrisma.application.findUnique.mockResolvedValue({
      id: 10,
      status: 'sent_to_company',
      job: { userId: 1, assignment: null },
    });
    mockPrisma.skillRating.findMany.mockResolvedValue([
      {
        id: 5,
        skillName: 'React',
        rating: 4,
        comment: null,
        ratedBy: { nombre: 'Ana', apellidoPaterno: 'Lopez' },
        updatedAt: new Date('2026-01-01'),
      },
    ]);

    const res = (await GET(
      makeGetReq({ 'x-user-id': '1', 'x-user-role': 'company' }, '10')
    )) as unknown as RouteResponse;

    expect(res.status).toBe(200);
    expect(mockPrisma.skillRating.findMany).toHaveBeenCalledTimes(1);
    const body = await res.json();
    expect(body.success).toBe(true);
  });

  it('devuelve 404 si la application no existe', async () => {
    mockPrisma.application.findUnique.mockResolvedValue(null);

    const res = (await GET(
      makeGetReq({ 'x-user-id': '1', 'x-user-role': 'company' }, '99')
    )) as unknown as RouteResponse;

    expect(res.status).toBe(404);
    expect(mockPrisma.skillRating.findMany).not.toHaveBeenCalled();
  });
});

describe('POST /api/evaluations/skill-ratings — solo specialist asignado', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('niega a un specialist NO asignado a la job (IDOR de escritura) con 403', async () => {
    mockPrisma.application.findUnique.mockResolvedValue({
      id: 10,
      status: 'evaluating',
      job: { userId: 5, assignment: { recruiterId: 7, specialistId: 999 } },
    });

    const res = (await POST(
      makePostReq(
        { 'x-user-id': '3', 'x-user-role': 'specialist' },
        { applicationId: 10, ratings: [{ skillName: 'React', rating: 4 }] }
      )
    )) as unknown as RouteResponse;

    expect(res.status).toBe(403);
    expect(mockPrisma.skillRating.upsert).not.toHaveBeenCalled();
  });

  it('permite al specialist asignado guardar calificaciones', async () => {
    mockPrisma.application.findUnique.mockResolvedValue({
      id: 10,
      status: 'evaluating',
      job: { userId: 5, assignment: { recruiterId: 7, specialistId: 3 } },
    });
    mockPrisma.skillRating.upsert.mockResolvedValue({
      id: 1,
      skillName: 'React',
      rating: 4,
    });

    const res = (await POST(
      makePostReq(
        { 'x-user-id': '3', 'x-user-role': 'specialist' },
        { applicationId: 10, ratings: [{ skillName: 'React', rating: 4 }] }
      )
    )) as unknown as RouteResponse;

    expect(res.status).toBe(200);
    expect(mockPrisma.skillRating.upsert).toHaveBeenCalledTimes(1);
  });
});
