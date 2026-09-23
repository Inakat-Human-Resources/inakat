/**
 * @jest-environment node
 */

// RUTA: __tests__/api/auth-register-handler.test.ts
//
// AUTH-017: src/app/api/auth/register/route.test.ts tiene 440 líneas que NUNCA
// importan el handler (copian funciones y comprueban literales definidos en el
// propio test), así que ninguna regresión del registro rompía nada. Esta suite
// ejecuta el POST real.
//
// Cubre además AUTH-001 (emailVerified falso), AUTH-008 (URLs sin validar),
// AUTH-009 (enumeración por el mensaje del 409), AUTH-015 (cuerpo inválido →
// 500), AUTH-018 (los 409/400 gastaban el cupo de registros) y AUTH-020
// (carrera → 500 en vez de 409).

process.env.JWT_SECRET =
  process.env.JWT_SECRET || 'test-secret-con-mas-de-treinta-y-dos-caracteres-123';

const mockPrisma = {
  user: { findUnique: jest.fn(), create: jest.fn() },
  candidate: { findUnique: jest.fn(), create: jest.fn() },
  $transaction: jest.fn()
};

// Getter perezoso: los `import` se elevan por encima de las `const`, así que la
// fábrica no puede leer `mockPrisma` en el momento de cargar el módulo.
jest.mock('@/lib/prisma', () => ({
  get prisma() {
    return mockPrisma;
  }
}));

import { POST } from '@/app/api/auth/register/route';

/** Cuerpo mínimo válido. */
function cuerpoValido(extra: Record<string, unknown> = {}) {
  return {
    email: 'ana@test.com',
    password: 'Password1',
    nombre: 'Ana',
    apellidoPaterno: 'López',
    ...extra
  };
}

let contadorDeIps = 0;

function peticion(body: unknown, ip?: string) {
  return new Request('http://localhost:3000/api/auth/register', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      // Cada test estrena IP para no compartir contadores de rate limit.
      'x-forwarded-for': ip || `10.0.0.${++contadorDeIps}`
    },
    body: typeof body === 'string' ? body : JSON.stringify(body)
  });
}

function prepararAltaCorrecta() {
  mockPrisma.user.findUnique.mockResolvedValue(null);
  mockPrisma.candidate.findUnique.mockResolvedValue(null);
  mockPrisma.user.create.mockResolvedValue({
    id: 42,
    email: 'ana@test.com',
    nombre: 'Ana',
    apellidoPaterno: 'López',
    apellidoMaterno: null,
    role: 'candidate'
  });
  mockPrisma.candidate.create.mockResolvedValue({
    id: 8,
    experiences: [],
    documents: []
  });
  mockPrisma.$transaction.mockImplementation(async (cb: any) => cb(mockPrisma));
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe('AUTH-001 — el alta ya no se marca como email verificado', () => {
  it('crea el User con emailVerified null y rol candidate forzado', async () => {
    prepararAltaCorrecta();

    const res = await POST(peticion(cuerpoValido({ role: 'admin' })));
    expect(res.status).toBe(201);

    const datosDelUser = mockPrisma.user.create.mock.calls[0][0].data;
    expect(datosDelUser.emailVerified).toBeNull();
    expect(datosDelUser.role).toBe('candidate');
  });

  it('entrega la cookie de sesión httpOnly', async () => {
    prepararAltaCorrecta();

    const res = await POST(peticion(cuerpoValido()));
    const cookie = res.headers.get('set-cookie') || '';

    expect(cookie).toContain('auth-token=');
    expect(cookie.toLowerCase()).toContain('httponly');
  });
});

describe('AUTH-009 — el 409 no distingue User de Candidate', () => {
  it('responde lo mismo si el email es de un User que si es de un Candidate', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({ id: 1 });
    mockPrisma.candidate.findUnique.mockResolvedValue(null);
    const resUser = await POST(peticion(cuerpoValido()));
    const cuerpoUser = await resUser.json();

    jest.clearAllMocks();
    mockPrisma.user.findUnique.mockResolvedValue(null);
    mockPrisma.candidate.findUnique.mockResolvedValue({ id: 5, userId: null });
    const resCandidate = await POST(peticion(cuerpoValido()));
    const cuerpoCandidate = await resCandidate.json();

    expect(resUser.status).toBe(409);
    expect(resCandidate.status).toBe(409);
    expect(cuerpoCandidate.error).toBe(cuerpoUser.error);
  });

  it('el mensaje no menciona el banco de candidatos', async () => {
    mockPrisma.user.findUnique.mockResolvedValue(null);
    mockPrisma.candidate.findUnique.mockResolvedValue({ id: 5, userId: null });

    const res = await POST(peticion(cuerpoValido()));
    const cuerpo = await res.json();

    expect(cuerpo.error).not.toMatch(/candidato/i);
  });
});

describe('AUTH-020 — carrera en el alta', () => {
  it('traduce P2002 a 409 en vez de 500', async () => {
    mockPrisma.user.findUnique.mockResolvedValue(null);
    mockPrisma.candidate.findUnique.mockResolvedValue(null);
    mockPrisma.$transaction.mockRejectedValue(
      Object.assign(new Error('Unique constraint failed'), { code: 'P2002' })
    );

    const res = await POST(peticion(cuerpoValido()));
    expect(res.status).toBe(409);
  });
});

describe('AUTH-015 — cuerpos inválidos', () => {
  it('un cuerpo que no es JSON responde 400, no 500', async () => {
    const res = await POST(peticion('esto no es json'));
    expect(res.status).toBe(400);
  });
});

describe('AUTH-008 / AUTH-019 — validación de URLs, fechas y tamaños', () => {
  beforeEach(prepararAltaCorrecta);

  it('rechaza un documento con esquema javascript:', async () => {
    const res = await POST(
      peticion(
        cuerpoValido({
          documents: [{ name: 'CV', fileUrl: 'javascript:alert(1)' }]
        })
      )
    );

    expect(res.status).toBe(400);
    expect(mockPrisma.$transaction).not.toHaveBeenCalled();
  });

  it('rechaza una fotoUrl que no es http(s)', async () => {
    const res = await POST(
      peticion(cuerpoValido({ fotoUrl: 'data:text/html;base64,PHNjcmlwdD4=' }))
    );

    expect(res.status).toBe(400);
  });

  it('acepta un documento en el blob y la ruta local de /uploads', async () => {
    const res = await POST(
      peticion(
        cuerpoValido({
          documents: [
            {
              name: 'CV',
              fileUrl: 'https://abc.public.blob.vercel-storage.com/cv.pdf'
            },
            { name: 'Cédula', fileUrl: '/uploads/cedula.pdf' }
          ]
        })
      )
    );

    expect(res.status).toBe(201);
  });

  it('rechaza una fecha imposible en vez de reventar con 500', async () => {
    const res = await POST(
      peticion(
        cuerpoValido({
          experiences: [
            {
              empresa: 'A',
              puesto: 'B',
              fechaInicio: '2020-13-45',
              esActual: true
            }
          ]
        })
      )
    );

    expect(res.status).toBe(400);
    expect(mockPrisma.$transaction).not.toHaveBeenCalled();
  });

  it('rechaza colecciones sin tope (21 experiencias)', async () => {
    const experiences = Array.from({ length: 21 }, () => ({
      empresa: 'A',
      puesto: 'B',
      fechaInicio: '2020-01-01',
      esActual: true
    }));

    const res = await POST(peticion(cuerpoValido({ experiences })));
    expect(res.status).toBe(400);
  });

  it('rechaza un nombre de más de 80 caracteres', async () => {
    const res = await POST(peticion(cuerpoValido({ nombre: 'A'.repeat(81) })));
    expect(res.status).toBe(400);
  });
});

describe('AUTH-018 — el cupo de 3 registros/hora sólo lo gastan las altas creadas', () => {
  it('tres 409 seguidos no impiden el registro válido de la misma IP', async () => {
    const ip = '203.0.113.77';

    mockPrisma.user.findUnique.mockResolvedValue({ id: 1 });
    mockPrisma.candidate.findUnique.mockResolvedValue(null);

    for (let i = 0; i < 3; i++) {
      const rechazo = await POST(peticion(cuerpoValido(), ip));
      expect(rechazo.status).toBe(409);
    }

    jest.clearAllMocks();
    prepararAltaCorrecta();

    const res = await POST(peticion(cuerpoValido({ email: 'otra@test.com' }), ip));
    expect(res.status).toBe(201);
  });

  it('la cuarta alta CREADA desde la misma IP sí recibe 429', async () => {
    const ip = '203.0.113.99';
    prepararAltaCorrecta();

    for (let i = 0; i < 3; i++) {
      const alta = await POST(peticion(cuerpoValido(), ip));
      expect(alta.status).toBe(201);
    }

    const res = await POST(peticion(cuerpoValido(), ip));
    expect(res.status).toBe(429);
  });
});
