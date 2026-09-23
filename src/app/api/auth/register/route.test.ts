/**
 * @jest-environment node
 */

// Tests para: src/app/api/auth/register/route.ts
//
// AUTH-017: este archivo tenía 440 líneas que NUNCA importaban el handler:
// copiaban `calcularAñosExperiencia` y comprobaban regex y literales definidos
// en el propio test, así que ninguna regresión del registro rompía nada. Ahora
// ejecuta el POST real. La batería amplia (409 sin enumeración, P2002, URLs,
// fechas, rate limit) vive en __tests__/api/auth-register-handler.test.ts; aquí
// queda lo que sólo se veía a través de las copias: la política de contraseña,
// el rol forzado y el cálculo de años de experiencia que llega a la base.

process.env.JWT_SECRET =
  process.env.JWT_SECRET || 'test-secret-con-mas-de-treinta-y-dos-caracteres-123';

const mockPrisma = {
  user: { findUnique: jest.fn(), create: jest.fn() },
  candidate: { findUnique: jest.fn(), create: jest.fn() },
  $transaction: jest.fn()
};

// Getter perezoso: los `import` se elevan por encima de las `const`.
jest.mock('@/lib/prisma', () => ({
  get prisma() {
    return mockPrisma;
  }
}));

import { POST } from './route';

let contadorDeIps = 0;

function peticion(body: Record<string, unknown>) {
  return new Request('http://localhost:3000/api/auth/register', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-forwarded-for': `100.64.0.${++contadorDeIps}`
    },
    body: JSON.stringify({
      email: 'luis@test.com',
      password: 'Password1',
      nombre: 'Luis',
      apellidoPaterno: 'Pérez',
      ...body
    })
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  mockPrisma.user.findUnique.mockResolvedValue(null);
  mockPrisma.candidate.findUnique.mockResolvedValue(null);
  mockPrisma.user.create.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({
    id: 11,
    ...data
  }));
  mockPrisma.candidate.create.mockResolvedValue({ id: 3, experiences: [], documents: [] });
  mockPrisma.$transaction.mockImplementation(async (cb: (tx: unknown) => unknown) =>
    cb(mockPrisma)
  );
});

describe('POST /api/auth/register', () => {
  it.each([
    ['sin mayúscula', 'password1'],
    ['sin número', 'Password'],
    ['demasiado corta', 'Pass1']
  ])('rechaza una contraseña %s con 400 y sin tocar la base', async (_caso, password) => {
    const res = await POST(peticion({ password }));

    expect(res.status).toBe(400);
    expect(mockPrisma.$transaction).not.toHaveBeenCalled();
  });

  it('el rol SIEMPRE es candidate aunque el cuerpo pida otro', async () => {
    const res = await POST(peticion({ role: 'admin' }));
    const cuerpo = await res.json();

    expect(res.status).toBe(201);
    expect(mockPrisma.user.create.mock.calls[0][0].data.role).toBe('candidate');
    expect(cuerpo.user.role).toBe('candidate');
  });

  it('guarda el email en minúsculas', async () => {
    await POST(peticion({ email: 'Luis@Test.COM' }));

    expect(mockPrisma.user.create.mock.calls[0][0].data.email).toBe('luis@test.com');
    expect(mockPrisma.candidate.create.mock.calls[0][0].data.email).toBe('luis@test.com');
  });

  it('calcula los años de experiencia que se guardan en el Candidate', async () => {
    await POST(
      peticion({
        experiences: [
          {
            empresa: 'A',
            puesto: 'Dev',
            fechaInicio: '2015-01-01',
            fechaFin: '2019-01-01',
            esActual: false
          },
          {
            empresa: 'B',
            puesto: 'Dev',
            fechaInicio: '2019-01-01',
            fechaFin: '2021-01-01',
            esActual: false
          }
        ]
      })
    );

    expect(mockPrisma.candidate.create.mock.calls[0][0].data.añosExperiencia).toBe(6);
  });

  it('sin experiencias guarda 0 años', async () => {
    await POST(peticion({}));

    expect(mockPrisma.candidate.create.mock.calls[0][0].data.añosExperiencia).toBe(0);
  });

  it('el Candidate nace con source "registro" y vinculado al User creado', async () => {
    await POST(peticion({}));

    const datos = mockPrisma.candidate.create.mock.calls[0][0].data;
    expect(datos.source).toBe('registro');
    expect(datos.userId).toBe(11);
  });
});
