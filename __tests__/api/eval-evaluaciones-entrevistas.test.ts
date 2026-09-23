/**
 * @jest-environment node
 */

// RUTA: __tests__/api/eval-evaluaciones-entrevistas.test.ts
//
// Auditoría 2026-09 — EVAL-003/004/005/006/017/018/019/021.
// Ejercita los HANDLERS REALES de /api/evaluations/notes,
// /api/evaluations/skill-ratings y /api/interview-requests/[id].

jest.mock('next/server', () => ({
  NextRequest: class {},
  NextResponse: {
    json: (data: unknown, options?: { status?: number }) => ({
      status: options?.status ?? 200,
      json: async () => data,
    }),
  },
}));

const mockPrisma = {
  application: { findUnique: jest.fn() },
  evaluationNote: { findMany: jest.fn(), create: jest.fn() },
  skillRating: { findMany: jest.fn(), upsert: jest.fn() },
  interviewRequest: { findUnique: jest.fn(), update: jest.fn() },
  $transaction: jest.fn(),
};

jest.mock('@/lib/prisma', () => ({
  get prisma() {
    return mockPrisma;
  },
}));

const mockRequireRole = jest.fn();
jest.mock('@/lib/auth', () => ({
  requireRole: (...args: unknown[]) => mockRequireRole(...args),
}));

import type { NextRequest } from 'next/server';
import * as notesRoute from '@/app/api/evaluations/notes/route';
import * as ratingsRoute from '@/app/api/evaluations/skill-ratings/route';
import * as interviewRoute from '@/app/api/interview-requests/[id]/route';

function session(id: number, role: string) {
  return {
    user: {
      id,
      role,
      email: `u${id}@test.com`,
      nombre: 'Ana',
      apellidoPaterno: 'López',
      apellidoMaterno: null,
      isActive: true,
      credits: 0,
      specialty: null,
    },
  };
}

function getReq(url: string): NextRequest {
  return { headers: { get: () => null }, url: `http://localhost${url}` } as unknown as NextRequest;
}

function postReq(body: unknown): NextRequest {
  return {
    headers: { get: () => null },
    url: 'http://localhost/api/x',
    json: async () => body,
  } as unknown as NextRequest;
}

async function call(p: Promise<unknown>) {
  const res = (await p) as { status: number; json: () => Promise<any> };
  return { status: res.status, body: await res.json() };
}

/** Application con la forma de loadApplicationForAuth. */
function authApp(status: string, opts: { jobUserId?: number; recruiterId?: number; specialistId?: number } = {}) {
  return {
    id: 10,
    status,
    job: {
      userId: opts.jobUserId ?? 50,
      assignment: { recruiterId: opts.recruiterId ?? 3, specialistId: opts.specialistId ?? 4 },
    },
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  mockPrisma.$transaction.mockImplementation((ops: unknown) =>
    Array.isArray(ops) ? Promise.all(ops) : Promise.resolve([])
  );
  mockPrisma.evaluationNote.findMany.mockResolvedValue([]);
  mockPrisma.evaluationNote.create.mockImplementation(({ data }: any) => ({ id: 1, ...data }));
  mockPrisma.skillRating.upsert.mockImplementation(({ create }: any) => ({ id: 1, ...create }));
});

// =============================================================================
// EVAL-003 — identidad desde la base, no desde los headers del JWT
// =============================================================================

describe('EVAL-003: requireRole decide, no los headers x-user-*', () => {
  const rechazado = { error: 'Usuario no encontrado o desactivado', status: 403 };

  it('notes GET corta a un usuario desactivado aunque traiga headers de reclutador', async () => {
    mockRequireRole.mockResolvedValue(rechazado);
    const req = {
      headers: { get: (h: string) => (h === 'x-user-id' ? '3' : h === 'x-user-role' ? 'recruiter' : null) },
      url: 'http://localhost/api/evaluations/notes?applicationId=10',
    } as unknown as NextRequest;

    const { status } = await call(notesRoute.GET(req));

    expect(status).toBe(403);
    expect(mockPrisma.application.findUnique).not.toHaveBeenCalled();
  });

  it('notes POST corta a un usuario desactivado', async () => {
    mockRequireRole.mockResolvedValue(rechazado);

    const { status } = await call(
      notesRoute.POST(postReq({ applicationId: 10, content: 'x', isPublic: true }))
    );

    expect(status).toBe(403);
    expect(mockPrisma.evaluationNote.create).not.toHaveBeenCalled();
  });

  it('interview-requests GET corta a un usuario desactivado', async () => {
    mockRequireRole.mockResolvedValue(rechazado);

    const { status } = await call(
      interviewRoute.GET(getReq('/api/interview-requests/15') as unknown as Request, {
        params: Promise.resolve({ id: '15' }),
      })
    );

    expect(status).toBe(403);
    expect(mockPrisma.interviewRequest.findUnique).not.toHaveBeenCalled();
  });

  it('la nota se firma con el id de la sesión resuelta en la base', async () => {
    mockRequireRole.mockResolvedValue(session(3, 'recruiter'));
    mockPrisma.application.findUnique.mockResolvedValue(authApp('reviewing'));

    const { status } = await call(
      notesRoute.POST(postReq({ applicationId: 10, content: 'Buen perfil' }))
    );

    expect(status).toBe(201);
    const { data } = mockPrisma.evaluationNote.create.mock.calls[0][0];
    expect(data.authorId).toBe(3);
    expect(data.authorRole).toBe('recruiter');
  });
});

// =============================================================================
// EVAL-004 — la empresa sólo ve notas de postulaciones que se le presentaron
// =============================================================================

describe('EVAL-004: notes GET para la empresa', () => {
  beforeEach(() => mockRequireRole.mockResolvedValue(session(50, 'company')));

  it.each(['evaluating', 'discarded', 'pending', 'sent_to_specialist'])(
    'responde 403 si la postulación está en "%s" aunque la vacante sea suya',
    async (status) => {
      mockPrisma.application.findUnique.mockResolvedValue(authApp(status, { jobUserId: 50 }));

      const res = await call(notesRoute.GET(getReq('/api/evaluations/notes?applicationId=10')));

      expect(res.status).toBe(403);
      expect(mockPrisma.evaluationNote.findMany).not.toHaveBeenCalled();
    }
  );

  it('en estado visible sólo pide notas públicas y sin authorId', async () => {
    mockPrisma.application.findUnique.mockResolvedValue(authApp('sent_to_company', { jobUserId: 50 }));

    const { status } = await call(notesRoute.GET(getReq('/api/evaluations/notes?applicationId=10')));

    expect(status).toBe(200);
    const args = mockPrisma.evaluationNote.findMany.mock.calls[0][0];
    expect(args.where).toEqual({ applicationId: 10, isPublic: true });
    expect(args.select).toBeDefined();
    expect(args.select.authorId).toBeUndefined();
  });

  it('el staff asignado sigue viendo todas las notas', async () => {
    mockRequireRole.mockResolvedValue(session(4, 'specialist'));
    mockPrisma.application.findUnique.mockResolvedValue(authApp('evaluating'));

    const { status } = await call(notesRoute.GET(getReq('/api/evaluations/notes?applicationId=10')));

    expect(status).toBe(200);
    const args = mockPrisma.evaluationNote.findMany.mock.calls[0][0];
    expect(args.where).toEqual({ applicationId: 10 });
  });
});

// =============================================================================
// EVAL-017 / EVAL-018 / EVAL-019 — validación del POST de notas
// =============================================================================

describe('notes — validación de entrada', () => {
  beforeEach(() => {
    mockRequireRole.mockResolvedValue(session(3, 'recruiter'));
    mockPrisma.application.findUnique.mockResolvedValue(authApp('reviewing'));
  });

  it('EVAL-017: GET con applicationId no numérico responde 400', async () => {
    const { status } = await call(notesRoute.GET(getReq('/api/evaluations/notes?applicationId=abc')));

    expect(status).toBe(400);
    expect(mockPrisma.application.findUnique).not.toHaveBeenCalled();
  });

  it('EVAL-017: POST con content no string responde 400 (antes TypeError → 500)', async () => {
    const { status } = await call(notesRoute.POST(postReq({ applicationId: 10, content: { a: 1 } })));

    expect(status).toBe(400);
    expect(mockPrisma.evaluationNote.create).not.toHaveBeenCalled();
  });

  it('EVAL-018: conserva el texto entre "<" y ">" de una evaluación técnica', async () => {
    const texto = 'Domina List<String> y Map<K,V>; pide < 30k y tiene > 5 años';

    const { status } = await call(notesRoute.POST(postReq({ applicationId: 10, content: texto })));

    expect(status).toBe(201);
    expect(mockPrisma.evaluationNote.create.mock.calls[0][0].data.content).toBe(texto);
  });

  it('EVAL-018: rechaza una nota que excede el máximo', async () => {
    const { status } = await call(
      notesRoute.POST(postReq({ applicationId: 10, content: 'a'.repeat(5001) }))
    );

    expect(status).toBe(400);
  });

  it.each([
    'https://evil.example/login',
    'javascript:alert(1)',
    'http://inakat.public.blob.vercel-storage.com.evil.example/x.pdf',
  ])('EVAL-019: rechaza documentUrl ajeno a nuestro almacenamiento (%s)', async (url) => {
    const { status } = await call(
      notesRoute.POST(
        postReq({ applicationId: 10, content: 'x', documentUrl: url, documentName: 'Reporte.pdf', isPublic: true })
      )
    );

    expect(status).toBe(400);
    expect(mockPrisma.evaluationNote.create).not.toHaveBeenCalled();
  });

  it('EVAL-019: rechaza documentUrl que no es string (antes 500)', async () => {
    const { status } = await call(
      notesRoute.POST(postReq({ applicationId: 10, content: 'x', documentUrl: { x: 1 } }))
    );

    expect(status).toBe(400);
  });

  it('EVAL-019: acepta el adjunto subido a Vercel Blob y recorta documentName', async () => {
    const url = 'https://abc123.public.blob.vercel-storage.com/psicometrico.pdf';

    const { status } = await call(
      notesRoute.POST(
        postReq({ applicationId: 10, content: 'x', documentUrl: url, documentName: 'n'.repeat(400) })
      )
    );

    expect(status).toBe(201);
    const { data } = mockPrisma.evaluationNote.create.mock.calls[0][0];
    expect(data.documentUrl).toBe(url);
    expect(data.documentName).toHaveLength(255);
  });
});

// =============================================================================
// EVAL-021 / EVAL-017 — skill-ratings
// =============================================================================

describe('skill-ratings — validación', () => {
  beforeEach(() => {
    mockRequireRole.mockResolvedValue(session(4, 'specialist'));
    mockPrisma.application.findUnique.mockResolvedValue(authApp('evaluating'));
  });

  it.each([4.5, '5', true, 0, 6])('EVAL-021: rating %p responde 400 (antes 500 en la columna Int)', async (rating) => {
    const { status } = await call(
      ratingsRoute.POST(postReq({ applicationId: 10, ratings: [{ skillName: 'React', rating }] }))
    );

    expect(status).toBe(400);
    expect(mockPrisma.skillRating.upsert).not.toHaveBeenCalled();
  });

  it('EVAL-021: más de 50 habilidades responde 400', async () => {
    const ratings = Array.from({ length: 51 }, (_, i) => ({ skillName: `S${i}`, rating: 3 }));

    const { status } = await call(ratingsRoute.POST(postReq({ applicationId: 10, ratings })));

    expect(status).toBe(400);
  });

  it('EVAL-021: deduplica la misma skill y escribe todo en una transacción', async () => {
    const { status } = await call(
      ratingsRoute.POST(
        postReq({
          applicationId: 10,
          ratings: [
            { skillName: 'React', rating: 4 },
            { skillName: ' react ', rating: 2 },
            { skillName: 'SQL', rating: 5, comment: 'ok' },
          ],
        })
      )
    );

    expect(status).toBe(200);
    expect(mockPrisma.skillRating.upsert).toHaveBeenCalledTimes(2);
    expect(mockPrisma.$transaction).toHaveBeenCalledTimes(1);
  });

  it('EVAL-021: el especialista no puede recalificar una postulación ya aceptada', async () => {
    mockPrisma.application.findUnique.mockResolvedValue(authApp('accepted'));

    const { status } = await call(
      ratingsRoute.POST(postReq({ applicationId: 10, ratings: [{ skillName: 'React', rating: 4 }] }))
    );

    expect(status).toBe(403);
    expect(mockPrisma.skillRating.upsert).not.toHaveBeenCalled();
  });

  it('EVAL-017: GET con applicationId no numérico responde 400', async () => {
    const { status } = await call(ratingsRoute.GET(getReq('/api/evaluations/skill-ratings?applicationId=1x')));

    expect(status).toBe(400);
    expect(mockPrisma.application.findUnique).not.toHaveBeenCalled();
  });
});

// =============================================================================
// EVAL-005 / EVAL-006 / EVAL-017 — interview-requests/[id]
// =============================================================================

function interviewRow() {
  return {
    id: 15,
    applicationId: 10,
    requestedById: 50,
    status: 'pending',
    adminNotes: 'empresa con adeudo, no priorizar',
    confirmedById: 1,
    application: {
      id: 10,
      candidateName: 'Cand',
      candidateEmail: 'c@test.com',
      candidatePhone: null,
      status: 'company_interested',
      job: { id: 7, title: 'Dev', company: 'ACME', userId: 50, assignment: { recruiterId: 3, specialistId: 4 } },
    },
    requestedBy: { id: 50, nombre: 'ACME', email: 'a@a.com' },
  };
}

describe('GET /api/interview-requests/[id]', () => {
  const ctx = (id: string) => ({ params: Promise.resolve({ id }) });

  it('EVAL-005: la empresa solicitante no recibe adminNotes ni confirmedById', async () => {
    mockRequireRole.mockResolvedValue(session(50, 'company'));
    mockPrisma.interviewRequest.findUnique.mockResolvedValue(interviewRow());

    const { status, body } = await call(
      interviewRoute.GET(getReq('/api/interview-requests/15') as unknown as Request, ctx('15'))
    );

    expect(status).toBe(200);
    expect(body.data).not.toHaveProperty('adminNotes');
    expect(body.data).not.toHaveProperty('confirmedById');
    expect(body.data.application.job).toEqual({ id: 7, title: 'Dev', company: 'ACME' });
  });

  it('EVAL-005: el admin sí ve sus notas internas', async () => {
    mockRequireRole.mockResolvedValue(session(1, 'admin'));
    mockPrisma.interviewRequest.findUnique.mockResolvedValue(interviewRow());

    const { body } = await call(
      interviewRoute.GET(getReq('/api/interview-requests/15') as unknown as Request, ctx('15'))
    );

    expect(body.data.adminNotes).toBe('empresa con adeudo, no priorizar');
  });

  it('EVAL-017: id no numérico responde 400 sin consultar', async () => {
    mockRequireRole.mockResolvedValue(session(1, 'admin'));

    const { status } = await call(
      interviewRoute.GET(getReq('/api/interview-requests/abc') as unknown as Request, ctx('abc'))
    );

    expect(status).toBe(400);
    expect(mockPrisma.interviewRequest.findUnique).not.toHaveBeenCalled();
  });

  it('EVAL-006: ya no existe el PATCH paralelo que confirmaba sin scheduledStart', () => {
    expect((interviewRoute as Record<string, unknown>).PATCH).toBeUndefined();
  });
});
