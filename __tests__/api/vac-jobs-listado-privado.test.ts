/**
 * @jest-environment node
 */
/**
 * VAC-006 / VAC-023 / VAC-024 — El listado público de vacantes no puede servir
 * de escaparate de lo que no está publicado ni de sonda para des-anonimizar.
 *
 * Lo que estaba abierto:
 *  - `?includeDrafts=true` quitaba el filtro de estado y `?status=draft` hacía
 *    lo mismo, sin pedir sesión: cualquiera listaba los borradores (planes de
 *    contratación con salario y descripción), las pausadas y las cerradas de
 *    TODAS las empresas.
 *  - `?userId=N` filtraba para cualquiera, así que se podían agrupar por empresa.
 *  - La búsqueda corría en la base contra el nombre REAL de la empresa y sólo
 *    después se enmascaraba: un acierto con `?search=AcmeCorp` confirmaba quién
 *    estaba detrás de "Empresa Confidencial".
 *
 * Se ejercita el handler REAL y se mira el `where` que recibe Prisma.
 */

export {};

process.env.JWT_SECRET =
  process.env.JWT_SECRET || 'test-secret-con-mas-de-treinta-y-dos-caracteres-123';

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

function setCookies(token?: string): void {
  mockCookies.mockResolvedValue({
    get: (name: string) =>
      token && name === 'auth-token' ? { value: token } : undefined,
  });
}

/** El `where` con el que se consultó la base en la última llamada. */
function whereUsado(): any {
  const call = mockPrisma.job.findMany.mock.calls[0][0] as { where: any };
  return call.where;
}

/** Aplana el `where` a texto para buscar cláusulas anidadas. */
function contiene(objeto: unknown, clave: string): boolean {
  return JSON.stringify(objeto).includes(clave);
}

beforeEach(() => {
  jest.clearAllMocks();
  mockPrisma.job.findMany.mockResolvedValue([]);
  mockPrisma.job.count.mockResolvedValue(0);
});

async function callGet(query: string): Promise<any> {
  const res = await GET(new Request(`http://localhost/api/jobs?${query}`));
  return res.json();
}

function sesionDe(id: number, role: string): void {
  mockPrisma.user.findUnique.mockResolvedValue({ id, role, isActive: true });
  setCookies(generateToken({ userId: id, email: `u${id}@x.com`, role }));
}

describe('GET /api/jobs — sin sesión sólo existe lo publicado', () => {
  it('ignora includeDrafts=true y sigue filtrando por status active', async () => {
    setCookies(undefined);
    await callGet('includeDrafts=true');

    expect(whereUsado().status).toBe('active');
  });

  it('ignora ?status=draft', async () => {
    setCookies(undefined);
    await callGet('status=draft');

    expect(whereUsado().status).toBe('active');
  });

  it('ignora ?userId= (no se puede agrupar por empresa)', async () => {
    setCookies(undefined);
    await callGet('userId=5');

    expect(whereUsado().userId).toBeUndefined();
  });

  it('exige que la vacante esté vigente (filtro de expiración)', async () => {
    setCookies(undefined);
    await callGet('');

    expect(contiene(whereUsado(), 'expiresAt')).toBe(true);
  });
});

describe('GET /api/jobs — una sesión ajena tampoco abre la vista de propietario', () => {
  it('el usuario 9 pidiendo ?userId=5 sigue viendo sólo lo publicado', async () => {
    sesionDe(9, 'company');
    await callGet('userId=5&includeDrafts=true');

    const where = whereUsado();
    expect(where.status).toBe('active');
    expect(where.userId).toBeUndefined();
  });
});

describe('GET /api/jobs — el propietario autenticado sí ve lo suyo', () => {
  it('el dueño con ?userId propio y includeDrafts recibe todos sus estados', async () => {
    sesionDe(5, 'company');
    await callGet('userId=5&includeDrafts=true');

    const where = whereUsado();
    expect(where.userId).toBe(5);
    expect(where.status).toBeUndefined();
  });

  it('el admin puede filtrar por el userId de otra empresa', async () => {
    sesionDe(1, 'admin');
    await callGet('userId=5&status=paused');

    const where = whereUsado();
    expect(where.userId).toBe(5);
    expect(where.status).toBe('paused');
  });
});

describe('GET /api/jobs — la búsqueda no sondea vacantes confidenciales', () => {
  it('sin sesión, el nombre de la empresa sólo se busca donde es público', async () => {
    setCookies(undefined);
    await callGet('search=AcmeCorp');

    // La cláusula de `company` va emparejada con isConfidential: false.
    const where = whereUsado();
    const rama = JSON.stringify(where.AND);
    expect(rama).toContain('isConfidential');
    expect(rama).toContain('company');
  });

  it('sin sesión, la ubicación tampoco se busca contra la dirección real', async () => {
    setCookies(undefined);
    await callGet('location=Av.+Constitucion+123');

    const rama = JSON.stringify(whereUsado().AND);
    expect(rama).toContain('isConfidential');
    expect(rama).toContain('location');
  });

  it('en vista de propietario la búsqueda es directa (sin el candado)', async () => {
    sesionDe(5, 'company');
    await callGet('userId=5&search=AcmeCorp');

    const rama = JSON.stringify(whereUsado().AND);
    expect(rama).toContain('company');
    expect(rama).not.toContain('isConfidential');
  });
});

describe('GET /api/jobs — entradas inválidas no revientan la consulta', () => {
  it('?userId=abc no produce un NaN en el where', async () => {
    setCookies(undefined);
    const body = await callGet('userId=abc');

    expect(body.success).toBe(true);
    expect(whereUsado().userId).toBeUndefined();
  });

  it('?page=abc no llega como NaN a skip/take', async () => {
    setCookies(undefined);
    await callGet('page=abc&limit=xyz');

    const call = mockPrisma.job.findMany.mock.calls[0][0] as { skip: number; take: number };
    expect(Number.isFinite(call.skip)).toBe(true);
    expect(Number.isFinite(call.take)).toBe(true);
  });
});
