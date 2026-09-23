/**
 * @jest-environment node
 */

// RUTA: __tests__/api/evaluations/skill-ratings-authz.test.ts
//
// Cierra IDOR cross-tenant en /api/evaluations/skill-ratings.
// Ejercita el HANDLER REAL (GET/POST) — no reimplementa la lógica.
//
// La identidad YA NO se lee de los headers que inyecta el middleware desde el
// JWT (x-user-id / x-user-role): el handler llama a requireRole(), que consulta
// la base y comprueba isActive, así que un usuario desactivado o degradado deja
// de tener acceso al instante en vez de conservarlo toda la vida del token.
// Por eso aquí se mockea requireRole en vez de fabricar headers.

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
    $transaction: jest.fn(),
  },
}));

const mockRequireRole = jest.fn();
jest.mock('@/lib/auth', () => ({
  requireRole: (...args: unknown[]) => mockRequireRole(...args),
}));

import type { NextRequest } from 'next/server';
import { GET, POST } from '@/app/api/evaluations/skill-ratings/route';
import { prisma } from '@/lib/prisma';

const mockPrisma = prisma as unknown as {
  application: { findUnique: jest.Mock };
  skillRating: { findMany: jest.Mock; upsert: jest.Mock };
  $transaction: jest.Mock;
};

interface RouteResponse {
  status: number;
  json: () => Promise<{ success: boolean; error?: string; data?: unknown }>;
}

/** Sesión válida resuelta contra la base, como la devuelve requireRole(). */
function session(id: number, role: string) {
  return {
    user: {
      id,
      role,
      email: `u${id}@test.com`,
      nombre: 'Test',
      apellidoPaterno: null,
      apellidoMaterno: null,
      isActive: true,
      credits: 0,
      specialty: null,
    },
  };
}

function makeGetReq(applicationId: string): NextRequest {
  return {
    headers: { get: () => null },
    url: `http://localhost/api/evaluations/skill-ratings?applicationId=${applicationId}`,
  } as unknown as NextRequest;
}

function makePostReq(body: unknown): NextRequest {
  return {
    headers: { get: () => null },
    url: 'http://localhost/api/evaluations/skill-ratings',
    json: async () => body,
  } as unknown as NextRequest;
}

describe('GET /api/evaluations/skill-ratings — autorización por ownership', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // $transaction recibe un array de promesas de upsert y las resuelve.
    mockPrisma.$transaction.mockImplementation((ops: unknown) =>
      Array.isArray(ops) ? Promise.all(ops) : Promise.resolve([])
    );
  });

  it('niega a una company que NO es dueña de la vacante (IDOR) con 403', async () => {
    mockRequireRole.mockResolvedValue(session(1, 'company'));
    // La application pertenece a la job de OTRA empresa (userId 999)
    mockPrisma.application.findUnique.mockResolvedValue({
      id: 10,
      status: 'sent_to_company',
      job: { userId: 999, assignment: null },
    });

    const res = (await GET(makeGetReq('10'))) as unknown as RouteResponse;

    expect(res.status).toBe(403);
    expect(mockPrisma.skillRating.findMany).not.toHaveBeenCalled();
  });

  it('permite a la company dueña de la vacante con status visible', async () => {
    mockRequireRole.mockResolvedValue(session(1, 'company'));
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

    const res = (await GET(makeGetReq('10'))) as unknown as RouteResponse;

    expect(res.status).toBe(200);
    expect(mockPrisma.skillRating.findMany).toHaveBeenCalledTimes(1);
    const body = await res.json();
    expect(body.success).toBe(true);
  });

  it('devuelve 404 si la application no existe', async () => {
    mockRequireRole.mockResolvedValue(session(1, 'company'));
    mockPrisma.application.findUnique.mockResolvedValue(null);

    const res = (await GET(makeGetReq('99'))) as unknown as RouteResponse;

    expect(res.status).toBe(404);
    expect(mockPrisma.skillRating.findMany).not.toHaveBeenCalled();
  });

  it('corta al usuario que requireRole rechaza (desactivado o degradado)', async () => {
    // requireRole consulta la base: si el admin desactivó la cuenta, ni
    // siquiera se llega a mirar la Application.
    mockRequireRole.mockResolvedValue({
      error: 'Usuario no encontrado o desactivado',
      status: 403,
    });

    const res = (await GET(makeGetReq('10'))) as unknown as RouteResponse;

    expect(res.status).toBe(403);
    expect(mockPrisma.application.findUnique).not.toHaveBeenCalled();
  });
});

describe('POST /api/evaluations/skill-ratings — solo specialist asignado', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockPrisma.$transaction.mockImplementation((ops: unknown) =>
      Array.isArray(ops) ? Promise.all(ops) : Promise.resolve([])
    );
  });

  it('niega a un specialist NO asignado a la job (IDOR de escritura) con 403', async () => {
    mockRequireRole.mockResolvedValue(session(3, 'specialist'));
    mockPrisma.application.findUnique.mockResolvedValue({
      id: 10,
      status: 'evaluating',
      job: { userId: 5, assignment: { recruiterId: 7, specialistId: 999 } },
    });

    const res = (await POST(
      makePostReq({ applicationId: 10, ratings: [{ skillName: 'React', rating: 4 }] })
    )) as unknown as RouteResponse;

    expect(res.status).toBe(403);
    expect(mockPrisma.skillRating.upsert).not.toHaveBeenCalled();
  });

  it('permite al specialist asignado guardar calificaciones', async () => {
    mockRequireRole.mockResolvedValue(session(3, 'specialist'));
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
      makePostReq({ applicationId: 10, ratings: [{ skillName: 'React', rating: 4 }] })
    )) as unknown as RouteResponse;

    expect(res.status).toBe(200);
    expect(mockPrisma.skillRating.upsert).toHaveBeenCalledTimes(1);
    // Las escrituras van en una sola transacción: un P2002 ya no puede dejar
    // la mitad de las habilidades guardadas.
    expect(mockPrisma.$transaction).toHaveBeenCalledTimes(1);
  });
});
