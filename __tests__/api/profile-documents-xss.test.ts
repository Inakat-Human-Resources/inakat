/**
 * @jest-environment node
 */

// RUTA: __tests__/api/profile-documents-xss.test.ts
//
// Tests para el fix #55 (Stored XSS) en POST /api/profile/documents:
// fileUrl se renderiza luego como href, así que se rechazan javascript:, data:,
// vbscript:, file: y cualquier cosa que no sea una URL.
//
// ACTUALIZADO por la auditoría 2026-09 (#PERF-002): exigir sólo http(s) dejaba
// pasar CUALQUIER host, y el enlace lo abre el staff desde un contexto de
// confianza. Ahora sólo se acepta nuestro propio almacenamiento (el store de
// Vercel Blob, o /uploads/ fuera de producción), así que los casos que antes
// comprobaban «acepta una URL http/https absoluta» ahora comprueban lo
// contrario: un host ajeno también se rechaza.
//
// Ejercita el HANDLER REAL.

jest.mock('@/lib/prisma', () => ({
  prisma: {
    candidate: { findFirst: jest.fn() },
    candidateDocument: { create: jest.fn(), count: jest.fn() },
  },
}));
jest.mock('@/lib/auth', () => ({ requireAuth: jest.fn() }));
jest.mock('@/lib/rate-limit', () => ({ applyRateLimit: jest.fn(() => null) }));
jest.mock('@vercel/blob', () => ({ del: jest.fn(async () => undefined) }));

import { POST } from '@/app/api/profile/documents/route';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';

const mockPrisma = prisma as unknown as {
  candidate: { findFirst: jest.Mock };
  candidateDocument: { create: jest.Mock; count: jest.Mock };
};
const mockRequireAuth = requireAuth as jest.Mock;

const URL_PROPIA = 'https://abc123store.public.blob.vercel-storage.com/9f2-cv.pdf';

function buildRequest(body: unknown): Request {
  return new Request('http://localhost/api/profile/documents', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('POST /api/profile/documents - validación de fileUrl (XSS #55 · #PERF-002)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRequireAuth.mockResolvedValue({ user: { id: 1, email: 'cand@test.com', role: 'candidate' } });
    mockPrisma.candidate.findFirst.mockResolvedValue({ id: 10, userId: 1 });
    mockPrisma.candidateDocument.count.mockResolvedValue(0);
    mockPrisma.candidateDocument.create.mockImplementation(({ data }: { data: unknown }) =>
      Promise.resolve({ id: 99, ...(data as object) })
    );
  });

  const peligrosas = [
    'javascript:alert(1)',
    'JavaScript:alert(1)',
    'data:text/html,<script>alert(1)</script>',
    'vbscript:msgbox(1)',
    'file:///etc/passwd',
    '/relativa/ruta.pdf',
    'not a url',
  ];

  it.each(peligrosas)('rechaza fileUrl peligrosa: %s', async (fileUrl) => {
    const res = await POST(buildRequest({ name: 'CV', fileUrl }));
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.success).toBe(false);
    expect(mockPrisma.candidateDocument.create).not.toHaveBeenCalled();
  });

  const ajenas = [
    'https://cdn.inakat.com/cv/1.pdf',
    'http://example.com/cv.pdf',
    'https://login-inakat.example/sesion-expirada',
  ];

  it.each(ajenas)('#PERF-002 rechaza una URL http(s) de otro host: %s', async (fileUrl) => {
    const res = await POST(buildRequest({ name: 'CV', fileUrl }));
    expect(res.status).toBe(400);
    expect(mockPrisma.candidateDocument.create).not.toHaveBeenCalled();
  });

  it('acepta una URL de nuestro almacenamiento', async () => {
    const res = await POST(buildRequest({ name: 'CV', fileUrl: URL_PROPIA, fileType: 'pdf' }));
    expect(res.status).toBe(201);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(mockPrisma.candidateDocument.create).toHaveBeenCalledTimes(1);
  });
});
