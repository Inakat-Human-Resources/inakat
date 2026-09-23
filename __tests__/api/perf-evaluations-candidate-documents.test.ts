// RUTA: __tests__/api/perf-evaluations-candidate-documents.test.ts

/**
 * Auditoría 2026-09 · módulo perfil — /api/evaluations/candidates/[id]/documents
 *
 * PERF-016: CandidateProfileModal llamaba a /api/admin/candidates/[id]/documents,
 *           reservada a admin: reclutadores y especialistas no podían adjuntar
 *           documentos. Abrir esa ruta tal cual era un IDOR (no comprueba
 *           asignación). La ruta nueva exige que el candidato tenga una
 *           postulación en una vacante ASIGNADA al usuario.
 */

jest.mock('next/server', () => ({
  NextResponse: {
    json: (data: any, options?: any) => ({
      status: options?.status || 200,
      json: async () => data,
    }),
  },
}));

jest.mock('@/lib/prisma', () => ({
  prisma: {
    candidate: { findUnique: jest.fn() },
    application: { findFirst: jest.fn() },
    candidateDocument: { findMany: jest.fn(), create: jest.fn() },
  },
}));

jest.mock('@/lib/auth', () => ({ requireRole: jest.fn() }));

import { requireRole } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { GET, POST } from '@/app/api/evaluations/candidates/[id]/documents/route';

const mockRequireRole = requireRole as jest.Mock;
const mockCandidate = (prisma as any).candidate;
const mockApplication = (prisma as any).application;
const mockDoc = (prisma as any).candidateDocument;

const URL_PROPIA = 'https://abc123store.public.blob.vercel-storage.com/9f2-titulo.pdf';

function params(id: string) {
  return { params: Promise.resolve({ id }) };
}

function pedirPost(body: any) {
  return new Request('http://localhost/api/evaluations/candidates/10/documents', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

function comoUsuario(id: number, role: string) {
  mockRequireRole.mockResolvedValue({ user: { id, email: `${role}@t.com`, role } });
}

describe('PERF-016 · /api/evaluations/candidates/[id]/documents', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockCandidate.findUnique.mockResolvedValue({ id: 10, email: 'ana@t.com' });
    mockApplication.findFirst.mockResolvedValue({ id: 500 });
    mockDoc.findMany.mockResolvedValue([]);
    mockDoc.create.mockImplementation(({ data }: any) => Promise.resolve({ id: 77, ...data }));
  });

  it('sólo admite admin, reclutador y especialista', async () => {
    comoUsuario(3, 'recruiter');
    await GET(new Request('http://localhost/x'), params('10'));

    expect(mockRequireRole).toHaveBeenCalledWith(['admin', 'recruiter', 'specialist']);
  });

  it('propaga el rechazo de requireRole (empresa, candidato, inactivo)', async () => {
    mockRequireRole.mockResolvedValue({ error: 'Acceso denegado', status: 403 });

    const res = await POST(pedirPost({ name: 'Título', fileUrl: URL_PROPIA }), params('10'));

    expect(res.status).toBe(403);
    expect(mockDoc.create).not.toHaveBeenCalled();
  });

  it('un reclutador asignado puede adjuntar un documento', async () => {
    comoUsuario(3, 'recruiter');

    const res = await POST(
      pedirPost({ name: '  Título universitario ', fileUrl: URL_PROPIA, fileType: 'pdf' }),
      params('10')
    );

    expect(res.status).toBe(201);
    expect(mockDoc.create).toHaveBeenCalledWith({
      data: { candidateId: 10, name: 'Título universitario', fileUrl: URL_PROPIA, fileType: 'pdf' },
    });
  });

  it('la asignación se busca por el id del reclutador en la vacante', async () => {
    comoUsuario(3, 'recruiter');
    await POST(pedirPost({ name: 'Título', fileUrl: URL_PROPIA }), params('10'));

    const where = mockApplication.findFirst.mock.calls[0][0].where;
    expect(where.job).toEqual({ assignment: { recruiterId: 3 } });
    expect(where.candidateEmail).toBe('ana@t.com');
  });

  it('para un especialista se usa specialistId', async () => {
    comoUsuario(4, 'specialist');
    await POST(pedirPost({ name: 'Título', fileUrl: URL_PROPIA }), params('10'));

    const where = mockApplication.findFirst.mock.calls[0][0].where;
    expect(where.job).toEqual({ assignment: { specialistId: 4 } });
  });

  it('un reclutador SIN asignación recibe 403 y no se crea nada (IDOR)', async () => {
    comoUsuario(3, 'recruiter');
    mockApplication.findFirst.mockResolvedValue(null);

    const res = await POST(pedirPost({ name: 'Título', fileUrl: URL_PROPIA }), params('10'));

    expect(res.status).toBe(403);
    expect(mockDoc.create).not.toHaveBeenCalled();
  });

  it('un especialista sin asignación tampoco puede LISTAR los documentos', async () => {
    comoUsuario(4, 'specialist');
    mockApplication.findFirst.mockResolvedValue(null);

    const res = await GET(new Request('http://localhost/x'), params('10'));

    expect(res.status).toBe(403);
    expect(mockDoc.findMany).not.toHaveBeenCalled();
  });

  it('el admin no necesita asignación', async () => {
    comoUsuario(1, 'admin');

    const res = await POST(pedirPost({ name: 'Título', fileUrl: URL_PROPIA }), params('10'));

    expect(res.status).toBe(201);
    expect(mockApplication.findFirst).not.toHaveBeenCalled();
  });

  it('rechaza una fileUrl que no es de nuestro almacenamiento (PERF-002)', async () => {
    comoUsuario(3, 'recruiter');

    const res = await POST(
      pedirPost({ name: 'Título', fileUrl: 'https://login-inakat.example/sesion' }),
      params('10')
    );

    expect(res.status).toBe(400);
    expect(mockDoc.create).not.toHaveBeenCalled();
  });

  it('rechaza javascript: como fileUrl', async () => {
    comoUsuario(1, 'admin');

    const res = await POST(pedirPost({ name: 'Título', fileUrl: 'javascript:alert(1)' }), params('10'));

    expect(res.status).toBe(400);
  });

  it('id no numérico -> 400, candidato inexistente -> 404', async () => {
    comoUsuario(1, 'admin');
    expect((await GET(new Request('http://localhost/x'), params('abc'))).status).toBe(400);

    mockCandidate.findUnique.mockResolvedValue(null);
    expect((await GET(new Request('http://localhost/x'), params('999'))).status).toBe(404);
  });

  it('nombre vacío o demasiado largo -> 400', async () => {
    comoUsuario(1, 'admin');
    expect((await POST(pedirPost({ name: '  ', fileUrl: URL_PROPIA }), params('10'))).status).toBe(400);
    expect((await POST(pedirPost({ name: 'a'.repeat(121), fileUrl: URL_PROPIA }), params('10'))).status).toBe(400);
    expect(mockDoc.create).not.toHaveBeenCalled();
  });

  it('cuerpo no JSON -> 400, no 500', async () => {
    comoUsuario(1, 'admin');
    const req = new Request('http://localhost/x', { method: 'POST', body: 'no-json' });

    expect((await POST(req, params('10'))).status).toBe(400);
  });
});
