/**
 * @jest-environment node
 */
// RUTA: __tests__/api/jobs/jobs-owner-view-auth.test.ts
//
// Regresión de seguridad (auditoría 2026-06): GET /api/jobs determinaba la
// "vista de propietario" (que expone notasInternas y los datos reales de
// vacantes confidenciales) por la mera presencia del query param ?userId, sin
// autenticación. Un visitante anónimo podía leer notas internas y de-anonimizar
// vacantes confidenciales iterando ?userId=N.
//
// Estos tests ejercen el handler REAL con prisma y cookies mockeados.

export {};

jest.mock('@/lib/prisma', () => ({
  prisma: {
    job: { findMany: jest.fn(), count: jest.fn() },
    user: { findUnique: jest.fn() },
  },
}));

jest.mock('next/headers', () => ({
  cookies: jest.fn(),
}));

import { GET } from '@/app/api/jobs/route';
import { prisma } from '@/lib/prisma';
import { cookies } from 'next/headers';
import { generateToken } from '@/lib/auth';

const mockPrisma = prisma as unknown as {
  job: { findMany: jest.Mock; count: jest.Mock };
  user: { findUnique: jest.Mock };
};
const mockCookies = cookies as unknown as jest.Mock;

const confidentialJob = {
  id: 1,
  title: 'Desarrollador Senior',
  company: 'TechCorp SA de CV',
  location: 'Av. Revolución 123, Monterrey, Nuevo León',
  salary: '$40,000',
  status: 'active',
  isConfidential: true,
  notasInternas: 'NOTA INTERNA: cliente paga rápido, prioridad alta',
  userId: 5,
  expiresAt: null,
  user: { companyRequest: { logoUrl: 'https://blob/logo.png' } },
};

function setCookies(token?: string) {
  mockCookies.mockResolvedValue({
    get: (name: string) =>
      token && name === 'auth-token' ? { value: token } : undefined,
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  mockPrisma.job.findMany.mockResolvedValue([{ ...confidentialJob }]);
  mockPrisma.job.count.mockResolvedValue(1);
});

async function callGet(query: string) {
  const res = await GET(new Request(`http://localhost/api/jobs?${query}`));
  return res.json();
}

describe('GET /api/jobs — vista de propietario gateada por auth', () => {
  it('visitante ANÓNIMO con ?userId=5 NO recibe notasInternas y ve la vacante confidencial sanitizada', async () => {
    setCookies(undefined); // sin sesión
    const body = await callGet('userId=5');

    const job = body.data?.[0] ?? body.jobs?.[0];
    expect(job).toBeDefined();
    expect(job.notasInternas).toBeUndefined();
    expect(job.company).toBe('Empresa Confidencial');
    expect(job.logoUrl).toBeNull();
  });

  it('usuario AUTENTICADO pidiendo ?userId de OTRO usuario NO recibe notasInternas', async () => {
    // Sesión válida del usuario 9 (no es dueño de las vacantes del userId 5)
    mockPrisma.user.findUnique.mockResolvedValue({
      id: 9,
      role: 'company',
      isActive: true,
    });
    setCookies(generateToken({ userId: 9, email: 'otro@x.com', role: 'company' }));

    const body = await callGet('userId=5');
    const job = body.data?.[0] ?? body.jobs?.[0];
    expect(job.notasInternas).toBeUndefined();
    expect(job.company).toBe('Empresa Confidencial');
  });

  it('PROPIETARIO autenticado (userId coincide) SÍ recibe notasInternas y datos reales', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({
      id: 5,
      role: 'company',
      isActive: true,
    });
    setCookies(generateToken({ userId: 5, email: 'dueno@x.com', role: 'company' }));

    const body = await callGet('userId=5');
    const job = body.data?.[0] ?? body.jobs?.[0];
    expect(job.notasInternas).toBe('NOTA INTERNA: cliente paga rápido, prioridad alta');
    expect(job.company).toBe('TechCorp SA de CV');
  });

  it('ADMIN autenticado ve notasInternas al filtrar por un userId concreto', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({
      id: 1,
      role: 'admin',
      isActive: true,
    });
    setCookies(generateToken({ userId: 1, email: 'admin@x.com', role: 'admin' }));

    const body = await callGet('userId=5');
    const job = body.data?.[0] ?? body.jobs?.[0];
    expect(job.notasInternas).toBeDefined();
    expect(job.company).toBe('TechCorp SA de CV');
  });
});
