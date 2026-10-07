/**
 * @jest-environment node
 */

// RUTA: __tests__/integracion-worky2/rutas-integracion.test.ts
//
// Puente INAKAT ↔ Worky2: las tres rutas de /api/integration (keys, webhooks y
// candidates) llamadas de verdad (handler real + JWT real + SHA-256 real), con Prisma y DNS simulados.
// Cubre lo que Worky2 necesita del lado INAKAT: que la empresa pueda dar de
// alta la key y el webhook con los datos que Worky2 le muestra, y que el
// endpoint de candidatos autentique, pagine y no filtre nada de más.

export {};

jest.mock('@/lib/prisma', () => ({
  prisma: {
    user: { findUnique: jest.fn() },
    integrationApiKey: {
      count: jest.fn(),
      create: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn()
    },
    integrationWebhook: {
      count: jest.fn(),
      create: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn()
    },
    application: { findMany: jest.fn(), count: jest.fn() },
    candidate: { findMany: jest.fn() }
  }
}));

jest.mock('dns/promises', () => ({
  __esModule: true,
  default: { lookup: jest.fn() }
}));

import crypto from 'crypto';
import dns from 'dns/promises';
import { prisma } from '@/lib/prisma';
import { generateToken } from '@/lib/auth';
import * as keysRoute from '@/app/api/integration/keys/route';
import * as webhooksRoute from '@/app/api/integration/webhooks/route';
import * as candidatesRoute from '@/app/api/integration/candidates/route';

const mp = prisma as unknown as {
  user: { findUnique: jest.Mock };
  integrationApiKey: Record<'count' | 'create' | 'findMany' | 'findUnique' | 'update', jest.Mock>;
  integrationWebhook: Record<
    'count' | 'create' | 'findFirst' | 'findMany' | 'findUnique' | 'update',
    jest.Mock
  >;
  application: { findMany: jest.Mock; count: jest.Mock };
  candidate: { findMany: jest.Mock };
};
const lookup = (dns as unknown as { lookup: jest.Mock }).lookup;

const EMPRESA_ID = 9;
const OTRA_EMPRESA_ID = 10;

// Cada petición sale de una IP distinta: los límites de alta/baja (20/h por
// IP) son de módulo y si no se repartirían entre tests.
let ipSecuencia = 0;
const otraIp = () => `203.0.113.${(ipSecuencia++ % 250) + 1}`;

function peticion(
  url: string,
  init: { method?: string; body?: unknown; headers?: Record<string, string> } = {}
): Request {
  return new Request(url, {
    method: init.method ?? 'GET',
    headers: { 'x-forwarded-for': otraIp(), ...(init.headers ?? {}) },
    body: init.body === undefined ? undefined : JSON.stringify(init.body)
  });
}

const tokenDe = (userId: number, role = 'company') =>
  generateToken({ userId, email: `u${userId}@empresa.mx`, role });

const sesion = (userId = EMPRESA_ID, role = 'company') => ({
  cookie: `otra=1; auth-token=${tokenDe(userId, role)}`
});
const bearer = (userId = EMPRESA_ID, role = 'company') => ({
  authorization: `Bearer ${tokenDe(userId, role)}`
});

function usuarioEnBase(
  extra: Partial<{ role: string; isActive: boolean; companyRequest: { status: string } | null }> = {}
) {
  return {
    id: EMPRESA_ID,
    email: 'u9@empresa.mx',
    nombre: 'Empresa Nueve',
    role: 'company',
    isActive: true,
    companyRequest: { status: 'approved' },
    ...extra
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  mp.user.findUnique.mockResolvedValue(usuarioEnBase());
  // worky.example.com resuelve a una IP pública; interno.example.com a la red privada.
  lookup.mockImplementation(async (host: string) =>
    host === 'interno.example.com'
      ? [{ address: '10.0.0.7', family: 4 }]
      : [{ address: '93.184.216.34', family: 4 }]
  );
});

// ============================================================
// /api/integration/keys — la key que la empresa pega en Worky2
// ============================================================

describe('POST /api/integration/keys', () => {
  beforeEach(() => {
    mp.integrationApiKey.count.mockResolvedValue(0);
    mp.integrationApiKey.create.mockImplementation(async ({ data }) => ({
      id: 31,
      name: data.name,
      isActive: true,
      createdAt: new Date('2026-10-01T12:00:00Z')
    }));
  });

  it('sin sesión responde 401 y no toca la base', async () => {
    const res = await keysRoute.POST(
      peticion('http://localhost/api/integration/keys', { method: 'POST', body: { name: 'Worky2' } })
    );
    expect(res.status).toBe(401);
    expect(mp.integrationApiKey.create).not.toHaveBeenCalled();
  });

  it('un JWT con firma falsa es 401', async () => {
    const falso = jwtFirmadoCon('otro-secreto-de-mas-de-treinta-y-dos-caracteres');
    const res = await keysRoute.POST(
      peticion('http://localhost/api/integration/keys', {
        method: 'POST',
        body: { name: 'Worky2' },
        headers: { authorization: `Bearer ${falso}` }
      })
    );
    expect(res.status).toBe(401);
  });

  it('un usuario que no es empresa recibe 403', async () => {
    mp.user.findUnique.mockResolvedValue(usuarioEnBase({ role: 'user' }));
    const res = await keysRoute.POST(
      peticion('http://localhost/api/integration/keys', {
        method: 'POST',
        body: { name: 'Worky2' },
        headers: sesion(EMPRESA_ID, 'user')
      })
    );
    expect(res.status).toBe(403);
    expect(mp.integrationApiKey.create).not.toHaveBeenCalled();
  });

  it('una empresa sin aprobar no puede crear keys (403)', async () => {
    mp.user.findUnique.mockResolvedValue(usuarioEnBase({ companyRequest: { status: 'pending' } }));
    const res = await keysRoute.POST(
      peticion('http://localhost/api/integration/keys', {
        method: 'POST',
        body: { name: 'Worky2' },
        headers: sesion()
      })
    );
    expect(res.status).toBe(403);
    expect(mp.integrationApiKey.create).not.toHaveBeenCalled();
  });

  it('una empresa desactivada no puede crear keys aunque su JWT siga vigente', async () => {
    mp.user.findUnique.mockResolvedValue(usuarioEnBase({ isActive: false }));
    const res = await keysRoute.POST(
      peticion('http://localhost/api/integration/keys', {
        method: 'POST',
        body: { name: 'Worky2' },
        headers: bearer()
      })
    );
    expect(res.status).toBe(403);
  });

  it('crea la key con el formato del contrato y guarda SOLO su SHA-256', async () => {
    const res = await keysRoute.POST(
      peticion('http://localhost/api/integration/keys', {
        method: 'POST',
        body: { name: '  Worky2 producción  ' },
        headers: sesion()
      })
    );
    expect(res.status).toBe(201);
    const json = await res.json();

    // El formato que valida requireApiKey y que la empresa pega en Worky2
    expect(json.data.key).toMatch(/^inak_[0-9a-f]{32}$/);
    expect(json.data.name).toBe('Worky2 producción');

    const data = mp.integrationApiKey.create.mock.calls[0][0].data;
    expect(data.userId).toBe(EMPRESA_ID);
    expect(data.keyHash).toBe(crypto.createHash('sha256').update(json.data.key).digest('hex'));
    expect(JSON.stringify(data)).not.toContain(json.data.key);
  });

  it('acepta el JWT tanto en cookie como en Authorization: Bearer', async () => {
    for (const headers of [sesion(), bearer()]) {
      const res = await keysRoute.POST(
        peticion('http://localhost/api/integration/keys', {
          method: 'POST',
          body: { name: 'Worky2' },
          headers
        })
      );
      expect(res.status).toBe(201);
    }
  });

  it('rechaza nombres vacíos (400)', async () => {
    const res = await keysRoute.POST(
      peticion('http://localhost/api/integration/keys', {
        method: 'POST',
        body: { name: ' ' },
        headers: sesion()
      })
    );
    expect(res.status).toBe(400);
  });

  it('tope de 10 keys activas (409)', async () => {
    mp.integrationApiKey.count.mockResolvedValue(10);
    const res = await keysRoute.POST(
      peticion('http://localhost/api/integration/keys', {
        method: 'POST',
        body: { name: 'Worky2' },
        headers: sesion()
      })
    );
    expect(res.status).toBe(409);
    expect(mp.integrationApiKey.create).not.toHaveBeenCalled();
  });
});

describe('GET y DELETE /api/integration/keys', () => {
  it('el listado sale enmascarado y nunca pide el hash a la base', async () => {
    mp.integrationApiKey.findMany.mockResolvedValue([
      { id: 31, name: 'Worky2', isActive: true, lastUsedAt: null, createdAt: new Date() }
    ]);
    const res = await keysRoute.GET(peticion('http://localhost/api/integration/keys', { headers: sesion() }));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data[0].maskedKey).toBe('inak_********************************');

    const args = mp.integrationApiKey.findMany.mock.calls[0][0];
    expect(args.where).toEqual({ userId: EMPRESA_ID });
    expect(args.select.keyHash).toBeUndefined();
  });

  it('revoca la key propia (isActive=false, se conserva el registro)', async () => {
    mp.integrationApiKey.findUnique.mockResolvedValue({ id: 31, userId: EMPRESA_ID, isActive: true });
    const res = await keysRoute.DELETE(
      peticion('http://localhost/api/integration/keys?id=31', { method: 'DELETE', headers: sesion() })
    );
    expect(res.status).toBe(200);
    expect(mp.integrationApiKey.update).toHaveBeenCalledWith({
      where: { id: 31 },
      data: { isActive: false }
    });
  });

  it('la key de otra empresa responde 404 (no 403: no confirma que existe)', async () => {
    mp.integrationApiKey.findUnique.mockResolvedValue({ id: 31, userId: OTRA_EMPRESA_ID, isActive: true });
    const res = await keysRoute.DELETE(
      peticion('http://localhost/api/integration/keys?id=31', { method: 'DELETE', headers: sesion() })
    );
    expect(res.status).toBe(404);
    expect(mp.integrationApiKey.update).not.toHaveBeenCalled();
  });

  it('revocar dos veces es 409 y sin id es 400', async () => {
    mp.integrationApiKey.findUnique.mockResolvedValue({ id: 31, userId: EMPRESA_ID, isActive: false });
    const dos = await keysRoute.DELETE(
      peticion('http://localhost/api/integration/keys?id=31', { method: 'DELETE', headers: sesion() })
    );
    expect(dos.status).toBe(409);

    const sinId = await keysRoute.DELETE(
      peticion('http://localhost/api/integration/keys', { method: 'DELETE', headers: sesion() })
    );
    expect(sinId.status).toBe(400);
  });
});

// ============================================================
// /api/integration/webhooks — la URL y el secreto que da Worky2
// ============================================================

/** Lo que muestra la pantalla de Integraciones de Worky2 (connection/route.ts). */
const URL_WORKY = 'https://worky.example.com/api/integrations/inakat/webhook/0b6f3c3e-5a8d-4c1e-9d55-2f1a7e9b4c10';
const SECRETO_WORKY = crypto.randomBytes(32).toString('hex'); // 64 hex, igual que Worky2

describe('POST /api/integration/webhooks', () => {
  beforeEach(() => {
    mp.integrationWebhook.count.mockResolvedValue(0);
    mp.integrationWebhook.findFirst.mockResolvedValue(null);
    mp.integrationWebhook.create.mockImplementation(async ({ data, select }) => ({
      id: 45,
      url: data.url,
      isActive: true,
      createdAt: new Date('2026-10-01T12:00:00Z'),
      ...(select?.secret ? { secret: data.secret } : {})
    }));
  });

  it('acepta tal cual la URL y el secreto que genera Worky2', async () => {
    const res = await webhooksRoute.POST(
      peticion('http://localhost/api/integration/webhooks', {
        method: 'POST',
        body: { url: URL_WORKY, secret: SECRETO_WORKY },
        headers: sesion()
      })
    );
    expect(res.status).toBe(201);
    const json = await res.json();
    expect(json.data.url).toBe(URL_WORKY);
    // El secreto se guarda para firmar, pero nunca vuelve en la respuesta
    expect(JSON.stringify(json)).not.toContain(SECRETO_WORKY);
    expect(mp.integrationWebhook.create.mock.calls[0][0].data).toEqual({
      userId: EMPRESA_ID,
      url: URL_WORKY,
      secret: SECRETO_WORKY
    });
  });

  it('rechaza un host que resuelve a la red privada (400, sin guardar)', async () => {
    const res = await webhooksRoute.POST(
      peticion('http://localhost/api/integration/webhooks', {
        method: 'POST',
        body: { url: 'https://interno.example.com/hook', secret: SECRETO_WORKY },
        headers: sesion()
      })
    );
    expect(res.status).toBe(400);
    expect(mp.integrationWebhook.create).not.toHaveBeenCalled();
  });

  it('en producción exige https (el evento lleva datos personales)', async () => {
    const entorno = process.env as Record<string, string | undefined>;
    const antes = entorno.NODE_ENV;
    entorno.NODE_ENV = 'production';
    try {
      const res = await webhooksRoute.POST(
        peticion('http://localhost/api/integration/webhooks', {
          method: 'POST',
          body: { url: URL_WORKY.replace('https:', 'http:'), secret: SECRETO_WORKY },
          headers: sesion()
        })
      );
      expect(res.status).toBe(400);
      expect((await res.json()).error).toMatch(/https/);
    } finally {
      entorno.NODE_ENV = antes;
    }
  });

  it('rechaza la URL que Worky2 mostraría sin NEXT_PUBLIC_APP_URL (localhost)', async () => {
    const res = await webhooksRoute.POST(
      peticion('http://localhost/api/integration/webhooks', {
        method: 'POST',
        body: {
          url: 'http://localhost:3000/api/integrations/inakat/webhook/0b6f3c3e-5a8d-4c1e-9d55-2f1a7e9b4c10',
          secret: SECRETO_WORKY
        },
        headers: sesion()
      })
    );
    expect(res.status).toBe(400);
  });

  it('secreto de menos de 16 caracteres es 400', async () => {
    const res = await webhooksRoute.POST(
      peticion('http://localhost/api/integration/webhooks', {
        method: 'POST',
        body: { url: URL_WORKY, secret: 'corto' },
        headers: sesion()
      })
    );
    expect(res.status).toBe(400);
  });

  it('tope de 5 webhooks activos y duplicados exactos son 409', async () => {
    mp.integrationWebhook.count.mockResolvedValueOnce(5);
    const tope = await webhooksRoute.POST(
      peticion('http://localhost/api/integration/webhooks', {
        method: 'POST',
        body: { url: URL_WORKY, secret: SECRETO_WORKY },
        headers: sesion()
      })
    );
    expect(tope.status).toBe(409);

    mp.integrationWebhook.findFirst.mockResolvedValueOnce({ id: 44 });
    const duplicado = await webhooksRoute.POST(
      peticion('http://localhost/api/integration/webhooks', {
        method: 'POST',
        body: { url: URL_WORKY, secret: SECRETO_WORKY },
        headers: sesion()
      })
    );
    expect(duplicado.status).toBe(409);
    expect(mp.integrationWebhook.create).not.toHaveBeenCalled();
  });

  it('la carrera contra el índice único (P2002) es 409, no 500', async () => {
    mp.integrationWebhook.create.mockRejectedValueOnce(Object.assign(new Error('dup'), { code: 'P2002' }));
    const res = await webhooksRoute.POST(
      peticion('http://localhost/api/integration/webhooks', {
        method: 'POST',
        body: { url: URL_WORKY, secret: SECRETO_WORKY },
        headers: sesion()
      })
    );
    expect(res.status).toBe(409);
  });

  it('una empresa sin aprobar no registra webhooks', async () => {
    mp.user.findUnique.mockResolvedValue(usuarioEnBase({ companyRequest: { status: 'rejected' } }));
    const res = await webhooksRoute.POST(
      peticion('http://localhost/api/integration/webhooks', {
        method: 'POST',
        body: { url: URL_WORKY, secret: SECRETO_WORKY },
        headers: sesion()
      })
    );
    expect(res.status).toBe(403);
  });
});

describe('GET y DELETE /api/integration/webhooks', () => {
  it('lista sin sacar el secreto de la base', async () => {
    mp.integrationWebhook.findMany.mockResolvedValue([
      { id: 45, url: URL_WORKY, isActive: true, createdAt: new Date() }
    ]);
    const res = await webhooksRoute.GET(
      peticion('http://localhost/api/integration/webhooks', { headers: sesion() })
    );
    const json = await res.json();
    expect(json.data[0]).toMatchObject({ id: 45, url: URL_WORKY, maskedSecret: '••••••••' });
    expect(mp.integrationWebhook.findMany.mock.calls[0][0].select.secret).toBeUndefined();
  });

  it('desactiva el propio y responde 404 con el de otra empresa', async () => {
    mp.integrationWebhook.findUnique.mockResolvedValueOnce({ id: 45, userId: EMPRESA_ID, isActive: true });
    const propio = await webhooksRoute.DELETE(
      peticion('http://localhost/api/integration/webhooks?id=45', { method: 'DELETE', headers: sesion() })
    );
    expect(propio.status).toBe(200);
    expect(mp.integrationWebhook.update).toHaveBeenCalledWith({
      where: { id: 45 },
      data: { isActive: false }
    });

    mp.integrationWebhook.findUnique.mockResolvedValueOnce({ id: 46, userId: OTRA_EMPRESA_ID, isActive: true });
    const ajeno = await webhooksRoute.DELETE(
      peticion('http://localhost/api/integration/webhooks?id=46', { method: 'DELETE', headers: sesion() })
    );
    expect(ajeno.status).toBe(404);
    expect(mp.integrationWebhook.update).toHaveBeenCalledTimes(1);
  });
});

// ============================================================
// GET /api/integration/candidates — lo que Worky2 consume (pull)
// ============================================================

const KEY = `inak_${'3f'.repeat(16)}`;
const KEY_HASH = crypto.createHash('sha256').update(KEY).digest('hex');

/** Fila de Application tal como la devuelve el include de integration-candidate.ts */
function aplicacion(id: number, extra: Record<string, unknown> = {}) {
  return {
    id,
    candidateName: 'Ana Ruiz Soto',
    candidateEmail: `ana${id}@correo.mx`,
    candidatePhone: '4431234567',
    cvUrl: `https://blob.example.com/cv-${id}.pdf`,
    notes: 'NOTA INTERNA: pide 20% más que la banda',
    status: 'accepted',
    reviewedAt: new Date('2026-09-30T15:00:00Z'),
    updatedAt: new Date('2026-09-30T15:00:00Z'),
    job: { id: 7, title: 'Contador Sr', userId: EMPRESA_ID, salaryMin: 30000, salaryMax: 36000 },
    evaluationNotes: [],
    skillRatings: [],
    ...extra
  };
}

describe('GET /api/integration/candidates', () => {
  let keyId = 100;

  beforeEach(() => {
    // Una key distinta por test: el límite por key (60/min) es de módulo.
    keyId++;
    mp.integrationApiKey.findUnique.mockResolvedValue({
      id: keyId,
      userId: EMPRESA_ID,
      name: 'Worky2',
      isActive: true,
      user: { isActive: true, role: 'company' }
    });
    mp.integrationApiKey.update.mockResolvedValue({});
    mp.application.findMany.mockResolvedValue([aplicacion(501)]);
    mp.application.count.mockResolvedValue(1);
    mp.candidate.findMany.mockResolvedValue([]);
  });

  const pedir = (query = '', headers: Record<string, string> = { 'x-api-key': KEY }) =>
    candidatesRoute.GET(peticion(`http://localhost/api/integration/candidates${query}`, { headers }));

  it('sin X-Api-Key es 401', async () => {
    const res = await pedir('', {});
    expect(res.status).toBe(401);
  });

  it('una key con formato inválido es 401 sin consultar la base', async () => {
    const res = await pedir('', { 'x-api-key': 'inak_NO-ES-HEX' });
    expect(res.status).toBe(401);
    expect(mp.integrationApiKey.findUnique).not.toHaveBeenCalled();
  });

  it('busca la key por su SHA-256, nunca en claro', async () => {
    await pedir();
    expect(mp.integrationApiKey.findUnique.mock.calls[0][0].where).toEqual({ keyHash: KEY_HASH });
  });

  it('key desconocida, revocada o de empresa desactivada → 401', async () => {
    mp.integrationApiKey.findUnique.mockResolvedValueOnce(null);
    expect((await pedir()).status).toBe(401);

    mp.integrationApiKey.findUnique.mockResolvedValueOnce({
      id: keyId, userId: EMPRESA_ID, name: 'x', isActive: false, user: { isActive: true, role: 'company' }
    });
    expect((await pedir()).status).toBe(401);

    mp.integrationApiKey.findUnique.mockResolvedValueOnce({
      id: keyId, userId: EMPRESA_ID, name: 'x', isActive: true, user: { isActive: false, role: 'company' }
    });
    expect((await pedir()).status).toBe(401);
    expect(mp.application.findMany).not.toHaveBeenCalled();
  });

  it('responde la forma que espera Worky2: success, data[] y pagination', async () => {
    const res = await pedir('?status=accepted');
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(Array.isArray(json.data)).toBe(true);
    expect(json.pagination).toEqual({
      page: 1,
      limit: 50,
      total: 1,
      totalPages: 1,
      hasNext: false,
      hasPrev: false
    });
  });

  it('sólo devuelve aceptados de las vacantes de la empresa dueña de la key', async () => {
    await pedir();
    const where = mp.application.findMany.mock.calls[0][0].where;
    expect(where.job).toEqual({ userId: EMPRESA_ID });
    expect(where.status).toEqual({ in: ['accepted', 'hired'] });
  });

  it('pagina: respeta page/limit, capa el limit en 100 y avisa hasNext', async () => {
    mp.application.count.mockResolvedValue(250);
    const res = await pedir('?page=2&limit=500');
    const json = await res.json();
    const args = mp.application.findMany.mock.calls[0][0];
    expect(args.take).toBe(100);
    expect(args.skip).toBe(100);
    expect(json.pagination).toMatchObject({ page: 2, limit: 100, total: 250, totalPages: 3, hasNext: true });
  });

  it('?since filtra por reviewedAt y una fecha inválida es 400', async () => {
    await pedir('?since=2026-09-01T00:00:00.000Z');
    expect(mp.application.findMany.mock.calls[0][0].where.reviewedAt).toEqual({
      gte: new Date('2026-09-01T00:00:00.000Z')
    });

    const mala = await pedir('?since=ayer');
    expect(mala.status).toBe(400);
  });

  it('cualquier status distinto de accepted es 400', async () => {
    const res = await pedir('?status=hired');
    expect(res.status).toBe(400);
  });

  it('PRIVACIDAD: ni las notas internas ni las evaluaciones privadas salen por el puente', async () => {
    const res = await pedir();
    const texto = JSON.stringify(await res.json());
    expect(texto).not.toContain('NOTA INTERNA');
    // Las evaluaciones se piden ya filtradas a las públicas
    const include = mp.application.findMany.mock.calls[0][0].include;
    expect(include.evaluationNotes.where).toEqual({ isPublic: true });
  });

  it('límite funcional por key: la llamada 61 del minuto es 429 con Retry-After', async () => {
    for (let i = 0; i < 60; i++) {
      expect((await pedir()).status).toBe(200);
    }
    const res = await pedir();
    expect(res.status).toBe(429);
    expect(Number(res.headers.get('Retry-After'))).toBeGreaterThan(0);
  });

  it('un error de base es 500 con mensaje genérico (no filtra el error)', async () => {
    mp.application.findMany.mockRejectedValueOnce(new Error('P2021 tabla IntegrationApiKey no existe'));
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    const res = await pedir();
    expect(res.status).toBe(500);
    expect(JSON.stringify(await res.json())).not.toContain('P2021');
    errorSpy.mockRestore();
  });
});

function jwtFirmadoCon(secreto: string): string {
  const b64 = (o: unknown) => Buffer.from(JSON.stringify(o)).toString('base64url');
  const cabecera = b64({ alg: 'HS256', typ: 'JWT' });
  const cuerpo = b64({ userId: EMPRESA_ID, email: 'u9@empresa.mx', role: 'company' });
  const firma = crypto.createHmac('sha256', secreto).update(`${cabecera}.${cuerpo}`).digest('base64url');
  return `${cabecera}.${cuerpo}.${firma}`;
}
