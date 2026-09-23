/**
 * @jest-environment node
 */

// RUTA: __tests__/api/auth-recuperacion-handler.test.ts
//
// AUTH-012: forgot-password y reset-password no tenían NINGÚN test que
// ejecutara el handler (sólo lecturas del código fuente). Esta suite corre las
// rutas reales con Prisma simulado y cubre:
//
//  - AUTH-005: el enlace usa NEXT_PUBLIC_APP_URL y, en producción, nunca el
//    Host de la petición.
//  - AUTH-006: el nombre del usuario se escapa en el HTML del correo.
//  - AUTH-015: cuerpos inválidos → 400, no 500.
//  - AUTH-016: el correo sale DESPUÉS de responder (after) y hay límite por
//    destinatario.
//  - AUTH-021: en la base se guarda el SHA-256 del token y el consumo es un
//    updateMany condicionado (un solo uso, sólo cuentas activas).

import { createHash } from 'crypto';

process.env.JWT_SECRET =
  process.env.JWT_SECRET || 'test-secret-con-mas-de-treinta-y-dos-caracteres-123';

const mockPrisma = {
  user: {
    findUnique: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn()
  }
};

// Getter perezoso: los `import` se elevan por encima de las `const`.
jest.mock('@/lib/prisma', () => ({
  get prisma() {
    return mockPrisma;
  }
}));

// `after()` sólo funciona dentro del ciclo de vida de una petición de Next; en
// el test se capturan las tareas diferidas para ejecutarlas a mano.
const mockTareasDiferidas: Array<() => unknown> = [];

jest.mock('next/server', () => {
  const real = jest.requireActual('next/server');
  return {
    ...real,
    after: (tarea: () => unknown) => {
      mockTareasDiferidas.push(tarea);
    }
  };
});

const mockSendPasswordResetEmail = jest.fn(async (_params: unknown) => true);

jest.mock('@/lib/email', () => {
  const real = jest.requireActual('@/lib/email');
  return {
    ...real,
    sendPasswordResetEmail: (params: unknown) => mockSendPasswordResetEmail(params)
  };
});

import { POST as forgotPassword } from '@/app/api/auth/forgot-password/route';
import { POST as resetPassword } from '@/app/api/auth/reset-password/route';
import { getAppUrl } from '@/lib/utils';

const sha256 = (valor: string) => createHash('sha256').update(valor).digest('hex');

const envMutable = process.env as Record<string, string | undefined>;
const envOriginal = {
  NEXT_PUBLIC_APP_URL: envMutable.NEXT_PUBLIC_APP_URL,
  NODE_ENV: envMutable.NODE_ENV
};

let contadorDeIps = 0;

function pedir(url: string, body: unknown, headers: Record<string, string> = {}) {
  return new Request(url, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      // Cada petición estrena IP para no chocar con el límite por IP.
      'x-forwarded-for': `198.51.100.${++contadorDeIps}`,
      ...headers
    },
    body: typeof body === 'string' ? body : JSON.stringify(body)
  });
}

const pedirReset = (body: unknown, headers?: Record<string, string>) =>
  pedir('http://localhost:3000/api/auth/forgot-password', body, headers);

async function ejecutarTareasDiferidas() {
  while (mockTareasDiferidas.length > 0) {
    await mockTareasDiferidas.shift()!();
  }
}

beforeEach(() => {
  jest.clearAllMocks();
  mockTareasDiferidas.length = 0;
  envMutable.NEXT_PUBLIC_APP_URL = 'https://app.inakat.test';
});

afterAll(() => {
  envMutable.NEXT_PUBLIC_APP_URL = envOriginal.NEXT_PUBLIC_APP_URL;
  envMutable.NODE_ENV = envOriginal.NODE_ENV;
});

describe('POST /api/auth/forgot-password', () => {
  it('AUTH-015: un email que no es string responde 400, no 500', async () => {
    const res = await forgotPassword(pedirReset({ email: 123 }));
    expect(res.status).toBe(400);
    expect(mockPrisma.user.findUnique).not.toHaveBeenCalled();
  });

  it('AUTH-015: un cuerpo que no es JSON responde 400', async () => {
    const res = await forgotPassword(pedirReset('hola'));
    expect(res.status).toBe(400);
  });

  it('AUTH-021: guarda el SHA-256 del token y manda por correo el token en claro', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({
      id: 5,
      email: 'ana@test.com',
      nombre: 'Ana',
      isActive: true
    });

    const res = await forgotPassword(pedirReset({ email: 'ana@test.com' }));
    expect(res.status).toBe(200);

    await ejecutarTareasDiferidas();

    const guardado = mockPrisma.user.update.mock.calls[0][0].data.resetToken as string;
    const { resetUrl } = mockSendPasswordResetEmail.mock.calls[0][0] as {
      resetUrl: string;
    };
    const tokenDelCorreo = new URL(resetUrl).searchParams.get('token')!;

    expect(tokenDelCorreo).toBeTruthy();
    expect(guardado).not.toBe(tokenDelCorreo);
    expect(guardado).toBe(sha256(tokenDelCorreo));
  });

  it('AUTH-005: el enlace del correo usa NEXT_PUBLIC_APP_URL', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({
      id: 5,
      email: 'ana@test.com',
      nombre: 'Ana',
      isActive: true
    });

    await forgotPassword(pedirReset({ email: 'ana@test.com' }));
    await ejecutarTareasDiferidas();

    const { resetUrl } = mockSendPasswordResetEmail.mock.calls[0][0] as {
      resetUrl: string;
    };
    expect(resetUrl.startsWith('https://app.inakat.test/reset-password?token=')).toBe(
      true
    );
  });

  it('AUTH-016: el correo NO se envía antes de responder (va en after)', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({
      id: 5,
      email: 'ana@test.com',
      nombre: 'Ana',
      isActive: true
    });

    await forgotPassword(pedirReset({ email: 'ana@test.com' }));

    // Con la respuesta ya devuelta, el envío sigue pendiente.
    expect(mockSendPasswordResetEmail).not.toHaveBeenCalled();
    expect(mockTareasDiferidas).toHaveLength(1);

    await ejecutarTareasDiferidas();
    expect(mockSendPasswordResetEmail).toHaveBeenCalledTimes(1);
  });

  it('responde exactamente lo mismo si el correo no existe', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({
      id: 5,
      email: 'existe@test.com',
      nombre: 'Ana',
      isActive: true
    });
    const conCuenta = await (
      await forgotPassword(pedirReset({ email: 'existe@test.com' }))
    ).json();

    mockPrisma.user.findUnique.mockResolvedValue(null);
    const sinCuenta = await (
      await forgotPassword(pedirReset({ email: 'noexiste@test.com' }))
    ).json();

    expect(sinCuenta).toEqual(conCuenta);
  });

  it('una cuenta desactivada no recibe enlace', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({
      id: 5,
      email: 'baja@test.com',
      nombre: 'Ana',
      isActive: false
    });

    const res = await forgotPassword(pedirReset({ email: 'baja@test.com' }));
    await ejecutarTareasDiferidas();

    expect(res.status).toBe(200);
    expect(mockPrisma.user.update).not.toHaveBeenCalled();
    expect(mockSendPasswordResetEmail).not.toHaveBeenCalled();
  });

  it('AUTH-016: límite por destinatario aunque cada petición llegue de otra IP', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({
      id: 9,
      email: 'victima@test.com',
      nombre: 'Víctima',
      isActive: true
    });

    for (let i = 0; i < 5; i++) {
      const res = await forgotPassword(pedirReset({ email: 'victima@test.com' }));
      // Siempre la respuesta genérica: el 429 sería un oráculo.
      expect(res.status).toBe(200);
    }

    // Sólo las 3 primeras regeneran el token (y el enlace anterior sigue vivo
    // para las demás).
    expect(mockPrisma.user.update).toHaveBeenCalledTimes(3);
  });
});

describe('AUTH-006 — plantilla del correo de recuperación', () => {
  it('escapa el nombre: no se puede inyectar un enlace de phishing', async () => {
    const mockSendMail = jest.fn(async () => ({ messageId: 'x' }));

    await jest.isolateModulesAsync(async () => {
      process.env.SMTP_USER = 'user@test.com';
      process.env.SMTP_PASS = 'secreto';
      jest.doMock('nodemailer', () => ({
        __esModule: true,
        default: { createTransport: () => ({ sendMail: mockSendMail }) },
        createTransport: () => ({ sendMail: mockSendMail })
      }));

      const { sendPasswordResetEmail } = jest.requireActual('@/lib/email');

      await sendPasswordResetEmail({
        email: 'victima@test.com',
        nombre: '</strong><a href="https://evil.tld/login">Verifica aqui</a>',
        resetUrl: 'https://app.inakat.test/reset-password?token=abc'
      });
    });

    delete process.env.SMTP_USER;
    delete process.env.SMTP_PASS;

    expect(mockSendMail).toHaveBeenCalledTimes(1);
    const calls = mockSendMail.mock.calls as unknown as Array<[{ html: string }]>;
    const html = calls[0][0].html;

    expect(html).not.toContain('<a href="https://evil.tld');
    expect(html).toContain('&lt;a href=');
  });
});

describe('POST /api/auth/reset-password', () => {
  const pedirCambio = (body: unknown) =>
    pedir('http://localhost:3000/api/auth/reset-password', body);

  it('AUTH-015: un cuerpo que no es JSON responde 400', async () => {
    const res = await resetPassword(pedirCambio('no json'));
    expect(res.status).toBe(400);
  });

  it('AUTH-021: consume el token con un updateMany condicionado por hash, vigencia e isActive', async () => {
    mockPrisma.user.updateMany.mockResolvedValue({ count: 1 });

    const res = await resetPassword(
      pedirCambio({ token: 'token-en-claro', password: 'NuevaClave1' })
    );
    expect(res.status).toBe(200);

    const { where, data } = mockPrisma.user.updateMany.mock.calls[0][0];
    expect(where.resetToken).toBe(sha256('token-en-claro'));
    expect(where.resetTokenExpiry).toEqual({ gt: expect.any(Date) });
    expect(where.isActive).toBe(true);
    expect(data.resetToken).toBeNull();
    expect(data.resetTokenExpiry).toBeNull();
    expect(data.password).not.toBe('NuevaClave1');
  });

  it('AUTH-021: si otra petición ya consumió el token (count 0) responde 400', async () => {
    mockPrisma.user.updateMany.mockResolvedValue({ count: 0 });

    const res = await resetPassword(
      pedirCambio({ token: 'token-usado', password: 'NuevaClave1' })
    );
    expect(res.status).toBe(400);
  });

  it('rechaza una contraseña que no cumple la política sin tocar la base', async () => {
    const res = await resetPassword(pedirCambio({ token: 't', password: 'corta' }));
    expect(res.status).toBe(400);
    expect(mockPrisma.user.updateMany).not.toHaveBeenCalled();
  });
});

describe('AUTH-005 — getAppUrl', () => {
  it('usa NEXT_PUBLIC_APP_URL sin la barra final', () => {
    envMutable.NEXT_PUBLIC_APP_URL = 'https://staging.inakat.test/';
    expect(getAppUrl('https://otro.test/api')).toBe('https://staging.inakat.test');
  });

  it('fuera de producción, sin variable, cae al origen de la petición', () => {
    delete envMutable.NEXT_PUBLIC_APP_URL;
    envMutable.NODE_ENV = 'test';
    expect(getAppUrl('http://localhost:3000/api/auth/forgot-password')).toBe(
      'http://localhost:3000'
    );
  });

  it('en producción NUNCA confía en el Host de la petición', () => {
    delete envMutable.NEXT_PUBLIC_APP_URL;
    envMutable.NODE_ENV = 'production';
    try {
      expect(getAppUrl('https://evil.tld/api/auth/forgot-password')).toBe(
        'https://inakat.com'
      );
    } finally {
      envMutable.NODE_ENV = envOriginal.NODE_ENV;
    }
  });
});
