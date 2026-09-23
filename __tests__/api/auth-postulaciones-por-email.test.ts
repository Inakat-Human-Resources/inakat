/**
 * @jest-environment node
 */

// RUTA: __tests__/api/auth-postulaciones-por-email.test.ts
//
// AUTH-001: el registro no verifica que quien se da de alta controle el correo,
// y /api/my-applications y /api/candidate/applications devolvían TODAS las
// postulaciones cuyo candidateEmail coincidiera con el de la cuenta. Bastaba
// registrarse con el correo de otra persona para leer las postulaciones que
// ella hizo como invitada (CV, teléfono, carta). Ahora el vínculo por email
// sólo cuenta si `emailVerified` no es null; si no, sólo las de su userId.

process.env.JWT_SECRET =
  process.env.JWT_SECRET || 'test-secret-con-mas-de-treinta-y-dos-caracteres-123';

const mockPrisma = {
  user: { findUnique: jest.fn() },
  candidate: { findUnique: jest.fn() },
  application: { findMany: jest.fn() }
};

// Getter perezoso: los `import` se elevan por encima de las `const`.
jest.mock('@/lib/prisma', () => ({
  get prisma() {
    return mockPrisma;
  }
}));

let mockCookieToken: string | undefined;

jest.mock('next/headers', () => ({
  cookies: jest.fn(async () => ({
    get: (nombre: string) =>
      nombre === 'auth-token' && mockCookieToken ? { value: mockCookieToken } : undefined
  }))
}));

import { NextRequest } from 'next/server';
import { generateToken } from '@/lib/auth';
import { GET as misPostulaciones } from '@/app/api/my-applications/route';
import { GET as postulacionesCandidato } from '@/app/api/candidate/applications/route';

type Criterio = Record<string, unknown>;

/** Los criterios del OR con que se buscaron las postulaciones. */
function criteriosDeBusqueda(): Criterio[] {
  const { where } = mockPrisma.application.findMany.mock.calls[0][0];
  return where.OR as Criterio[];
}

const buscaPorEmail = (criterios: Criterio[]) =>
  criterios.some((c) => 'candidateEmail' in c);

beforeEach(() => {
  jest.clearAllMocks();
  mockPrisma.application.findMany.mockResolvedValue([]);
});

describe('GET /api/my-applications', () => {
  function peticion() {
    return new NextRequest('http://localhost:3000/api/my-applications', {
      headers: {
        'x-user-id': '42',
        'x-user-email': 'maria@empresa.com',
        'x-user-role': 'candidate'
      }
    });
  }

  it('con el email SIN verificar sólo busca por userId', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({ emailVerified: null });

    const res = await misPostulaciones(peticion());
    expect(res.status).toBe(200);

    const criterios = criteriosDeBusqueda();
    expect(criterios).toEqual([{ userId: 42 }]);
    expect(buscaPorEmail(criterios)).toBe(false);
  });

  it('con el email verificado también vincula las postulaciones de invitado', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({ emailVerified: new Date() });

    await misPostulaciones(peticion());

    expect(criteriosDeBusqueda()).toEqual([
      { userId: 42 },
      { candidateEmail: 'maria@empresa.com' }
    ]);
  });

  it('si la cuenta no aparece, no vincula por email', async () => {
    mockPrisma.user.findUnique.mockResolvedValue(null);

    await misPostulaciones(peticion());

    expect(buscaPorEmail(criteriosDeBusqueda())).toBe(false);
  });
});

describe('GET /api/candidate/applications', () => {
  function prepararSesion(emailVerified: Date | null) {
    mockCookieToken = generateToken({
      userId: 42,
      email: 'maria@empresa.com',
      role: 'candidate'
    });

    const candidate = { id: 7, userId: 42, nombre: 'María', email: 'maria@empresa.com' };

    mockPrisma.user.findUnique.mockResolvedValue({
      id: 42,
      email: 'maria@empresa.com',
      role: 'candidate',
      isActive: true,
      emailVerified,
      candidate
    });
    mockPrisma.candidate.findUnique.mockResolvedValue(candidate);
  }

  it('con el email SIN verificar sólo busca por userId', async () => {
    prepararSesion(null);

    const res = await postulacionesCandidato();
    expect(res.status).toBe(200);

    const criterios = criteriosDeBusqueda();
    expect(criterios).toEqual([{ userId: 42 }]);
    expect(buscaPorEmail(criterios)).toBe(false);
  });

  it('con el email verificado también vincula por los correos de la cuenta', async () => {
    prepararSesion(new Date());

    await postulacionesCandidato();

    const criterios = criteriosDeBusqueda();
    expect(criterios[0]).toEqual({ userId: 42 });
    expect(criterios[1]).toEqual({
      candidateEmail: { in: ['maria@empresa.com'] }
    });
  });
});
