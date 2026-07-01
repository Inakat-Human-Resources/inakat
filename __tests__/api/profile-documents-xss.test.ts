/**
 * @jest-environment node
 */

// RUTA: __tests__/api/profile-documents-xss.test.ts
//
// Tests para el fix #55 (Stored XSS) en POST /api/profile/documents:
// fileUrl debe ser una URL http(s) absoluta; se rechazan javascript:, data:, etc.
// Ejercita el HANDLER REAL.

jest.mock('@/lib/prisma', () => ({
  prisma: {
    candidate: { findFirst: jest.fn() },
    candidateDocument: { create: jest.fn() },
  },
}));
jest.mock('next/headers', () => ({ cookies: jest.fn() }));

import { POST } from '@/app/api/profile/documents/route';
import { prisma } from '@/lib/prisma';
import { cookies } from 'next/headers';
import { generateToken } from '@/lib/auth';

const mockPrisma = prisma as unknown as {
  candidate: { findFirst: jest.Mock };
  candidateDocument: { create: jest.Mock };
};
const mockCookies = cookies as unknown as jest.Mock;

const token = generateToken({ userId: 1, email: 'cand@test.com', role: 'user' });

function buildRequest(body: unknown): Request {
  return new Request('http://localhost/api/profile/documents', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('POST /api/profile/documents - validación de fileUrl (XSS #55)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockCookies.mockResolvedValue({
      get: (n: string) => (n === 'auth-token' ? { value: token } : undefined),
    });
    mockPrisma.candidate.findFirst.mockResolvedValue({ id: 10, userId: 1 });
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

  it('acepta una URL https absoluta', async () => {
    const res = await POST(
      buildRequest({ name: 'CV', fileUrl: 'https://cdn.inakat.com/cv/1.pdf', fileType: 'pdf' })
    );
    expect(res.status).toBe(201);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(mockPrisma.candidateDocument.create).toHaveBeenCalledTimes(1);
  });

  it('acepta una URL http absoluta', async () => {
    const res = await POST(buildRequest({ name: 'CV', fileUrl: 'http://example.com/cv.pdf' }));
    expect(res.status).toBe(201);
    expect(mockPrisma.candidateDocument.create).toHaveBeenCalledTimes(1);
  });
});
