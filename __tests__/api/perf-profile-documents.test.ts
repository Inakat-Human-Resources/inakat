// RUTA: __tests__/api/perf-profile-documents.test.ts

/**
 * Auditoría 2026-09 · módulo perfil — /api/profile/documents
 *
 * PERF-002: fileUrl aceptaba cualquier host http(s). Un candidato podía guardar
 *           un enlace de phishing que el staff abría desde la ficha.
 * PERF-003: al eliminar un documento sólo se borraba la fila; el archivo con
 *           datos personales seguía público para siempre.
 * PERF-004: la ruta hacía su propia autenticación sin mirar isActive, así que
 *           un usuario desactivado seguía escribiendo con su JWT.
 * PERF-019: id no numérico -> 500; POST sin límites de tipo, longitud ni número
 *           de documentos.
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
    candidate: { findFirst: jest.fn() },
    candidateDocument: {
      findMany: jest.fn(),
      count: jest.fn(),
      create: jest.fn(),
      findUnique: jest.fn(),
      delete: jest.fn(),
    },
  },
}));

jest.mock('@/lib/auth', () => ({ requireAuth: jest.fn() }));
jest.mock('@/lib/rate-limit', () => ({ applyRateLimit: jest.fn(() => null) }));
jest.mock('@vercel/blob', () => ({ del: jest.fn(async () => undefined) }));

import { requireAuth } from '@/lib/auth';
import { applyRateLimit } from '@/lib/rate-limit';
import { prisma } from '@/lib/prisma';
import { del } from '@vercel/blob';
import { POST, DELETE } from '@/app/api/profile/documents/route';

const mockRequireAuth = requireAuth as jest.Mock;
const mockApplyRateLimit = applyRateLimit as jest.Mock;
const mockCandidate = (prisma as any).candidate;
const mockDoc = (prisma as any).candidateDocument;
const mockDel = del as jest.Mock;

const URL_PROPIA = 'https://abc123store.public.blob.vercel-storage.com/9f2-cv.pdf';

function pedir(url: string, method: string, body?: any) {
  return new Request(url, {
    method,
    headers: body ? { 'content-type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
}

describe('PERF · /api/profile/documents', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockApplyRateLimit.mockReturnValue(null);
    mockRequireAuth.mockResolvedValue({ user: { id: 1, email: 'c@t.com', role: 'candidate' } });
    mockCandidate.findFirst.mockResolvedValue({ id: 10, userId: 1 });
    mockDoc.count.mockResolvedValue(0);
    mockDoc.create.mockImplementation(({ data }: any) => Promise.resolve({ id: 99, ...data }));
  });

  describe('PERF-004 · autenticación con isActive', () => {
    it('POST rechaza a un usuario desactivado (requireAuth devuelve error)', async () => {
      mockRequireAuth.mockResolvedValue({ error: 'Usuario no encontrado o desactivado', status: 403 });

      const res = await POST(pedir('http://localhost/api/profile/documents', 'POST', {
        name: 'CV',
        fileUrl: URL_PROPIA,
      }));

      expect(res.status).toBe(403);
      expect(mockDoc.create).not.toHaveBeenCalled();
    });

    it('DELETE rechaza a un usuario desactivado', async () => {
      mockRequireAuth.mockResolvedValue({ error: 'Usuario no encontrado o desactivado', status: 403 });

      const res = await DELETE(pedir('http://localhost/api/profile/documents?id=1', 'DELETE'));

      expect(res.status).toBe(403);
      expect(mockDoc.delete).not.toHaveBeenCalled();
    });
  });

  describe('PERF-002 · sólo URLs de nuestro almacenamiento', () => {
    const rechazadas = [
      'https://login-inakat.example/sesion-expirada',
      'http://example.com/cv.pdf',
      'https://cdn.inakat.com/cv/1.pdf',
      'https://public.blob.vercel-storage.com.evil.test/cv.pdf',
      'javascript:alert(1)',
      'data:text/html,<script>alert(1)</script>',
      'file:///etc/passwd',
      'no es una url',
    ];

    it.each(rechazadas)('rechaza fileUrl ajena: %s', async (fileUrl) => {
      const res = await POST(pedir('http://localhost/api/profile/documents', 'POST', {
        name: 'Cédula profesional',
        fileUrl,
      }));

      expect(res.status).toBe(400);
      expect(mockDoc.create).not.toHaveBeenCalled();
    });

    it('acepta una URL del blob propio', async () => {
      const res = await POST(pedir('http://localhost/api/profile/documents', 'POST', {
        name: 'Título',
        fileUrl: URL_PROPIA,
        fileType: 'pdf',
      }));

      expect(res.status).toBe(201);
      expect(mockDoc.create).toHaveBeenCalledTimes(1);
      expect(mockDoc.create.mock.calls[0][0].data.fileUrl).toBe(URL_PROPIA);
    });

    it('acepta el fallback local /uploads/ fuera de producción', async () => {
      const res = await POST(pedir('http://localhost/api/profile/documents', 'POST', {
        name: 'Título',
        fileUrl: '/uploads/1234-cv.pdf',
      }));

      expect(res.status).toBe(201);
    });
  });

  describe('PERF-019 · validación', () => {
    it('DELETE con id no numérico responde 400, no 500', async () => {
      const res = await DELETE(pedir('http://localhost/api/profile/documents?id=abc', 'DELETE'));

      expect(res.status).toBe(400);
      expect(mockDoc.findUnique).not.toHaveBeenCalled();
    });

    it('rechaza un nombre de más de 120 caracteres', async () => {
      const res = await POST(pedir('http://localhost/api/profile/documents', 'POST', {
        name: 'x'.repeat(121),
        fileUrl: URL_PROPIA,
      }));

      expect(res.status).toBe(400);
      expect(mockDoc.create).not.toHaveBeenCalled();
    });

    it('rechaza un nombre que no es texto', async () => {
      const res = await POST(pedir('http://localhost/api/profile/documents', 'POST', {
        name: { $ne: null },
        fileUrl: URL_PROPIA,
      }));

      expect(res.status).toBe(400);
      expect(mockDoc.create).not.toHaveBeenCalled();
    });

    it('rechaza fileType demasiado largo', async () => {
      const res = await POST(pedir('http://localhost/api/profile/documents', 'POST', {
        name: 'Título',
        fileUrl: URL_PROPIA,
        fileType: 'vnd.openxmlformats-officedocument.wordprocessingml.document',
      }));

      expect(res.status).toBe(400);
      expect(mockDoc.create).not.toHaveBeenCalled();
    });

    it('impide pasar del tope de documentos por candidato', async () => {
      mockDoc.count.mockResolvedValue(20);

      const res = await POST(pedir('http://localhost/api/profile/documents', 'POST', {
        name: 'Uno más',
        fileUrl: URL_PROPIA,
      }));

      expect(res.status).toBe(400);
      expect(mockDoc.create).not.toHaveBeenCalled();
    });

    it('aplica rate limit', async () => {
      await POST(pedir('http://localhost/api/profile/documents', 'POST', {
        name: 'Título',
        fileUrl: URL_PROPIA,
      }));

      expect(mockApplyRateLimit).toHaveBeenCalled();
      expect(mockApplyRateLimit.mock.calls[0][1]).toBe('profile-documents');
    });
  });

  describe('PERF-003 · el archivo se borra con la fila', () => {
    it('DELETE borra el blob del documento eliminado', async () => {
      mockDoc.findUnique.mockResolvedValue({ id: 7, candidateId: 10, fileUrl: URL_PROPIA });
      mockDoc.delete.mockResolvedValue({ id: 7 });

      const res = await DELETE(pedir('http://localhost/api/profile/documents?id=7', 'DELETE'));

      expect(res.status).toBe(200);
      expect(mockDoc.delete).toHaveBeenCalledWith({ where: { id: 7 } });
      expect(mockDel).toHaveBeenCalledWith(URL_PROPIA);
    });

    it('no intenta borrar un blob que no es nuestro (dato antiguo)', async () => {
      mockDoc.findUnique.mockResolvedValue({ id: 8, candidateId: 10, fileUrl: 'https://otro.example/x.pdf' });
      mockDoc.delete.mockResolvedValue({ id: 8 });

      const res = await DELETE(pedir('http://localhost/api/profile/documents?id=8', 'DELETE'));

      expect(res.status).toBe(200);
      expect(mockDel).not.toHaveBeenCalled();
    });

    it('si el borrado del blob falla, la respuesta sigue siendo 200', async () => {
      mockDoc.findUnique.mockResolvedValue({ id: 9, candidateId: 10, fileUrl: URL_PROPIA });
      mockDoc.delete.mockResolvedValue({ id: 9 });
      mockDel.mockRejectedValueOnce(new Error('blob caído'));

      const res = await DELETE(pedir('http://localhost/api/profile/documents?id=9', 'DELETE'));

      expect(res.status).toBe(200);
    });

    it('no borra ni el blob ni la fila de otro candidato', async () => {
      mockDoc.findUnique.mockResolvedValue({ id: 5, candidateId: 999, fileUrl: URL_PROPIA });

      const res = await DELETE(pedir('http://localhost/api/profile/documents?id=5', 'DELETE'));

      expect(res.status).toBe(403);
      expect(mockDoc.delete).not.toHaveBeenCalled();
      expect(mockDel).not.toHaveBeenCalled();
    });
  });
});
