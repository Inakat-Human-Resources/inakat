/**
 * @jest-environment node
 */

// RUTA: __tests__/integracion-worky2/webhook-saliente.test.ts
//
// Webhook candidate.accepted (INAKAT → Worky2) con el código real: la empresa
// acepta a un candidato en su panel, `after()` ejecuta el despacho y sale UN
// POST firmado por cada webhook activo. Se intercepta `fetch` para revisar lo
// que viaja por la red: URL, cabeceras, cuerpo y firma.

export {};

jest.mock('next/server', () => ({
  ...jest.requireActual('next/server'),
  after: jest.fn()
}));

jest.mock('@/lib/prisma', () => ({
  prisma: {
    application: { findUnique: jest.fn(), update: jest.fn(), updateMany: jest.fn() },
    candidate: { findMany: jest.fn() },
    integrationWebhook: { findMany: jest.fn() },
    job: { update: jest.fn() },
    user: { findUnique: jest.fn() }
  }
}));

jest.mock('@/lib/notifications', () => ({
  notifyAllAdmins: jest.fn(async () => undefined),
  runAfterResponse: jest.fn(async () => undefined)
}));

jest.mock('@/lib/candidate-status', () => ({
  syncCandidateStatus: jest.fn(async () => undefined)
}));

jest.mock('dns/promises', () => ({
  __esModule: true,
  default: { lookup: jest.fn() }
}));

import crypto from 'crypto';
import dns from 'dns/promises';
import { after, NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { dispatchCandidateAccepted, signWebhookPayload } from '@/lib/worky2-webhook';
import { PATCH as patchEmpresa } from '@/app/api/company/applications/[id]/route';
import { PATCH as patchAdmin } from '@/app/api/applications/[id]/route';

const mp = prisma as unknown as {
  application: { findUnique: jest.Mock; update: jest.Mock; updateMany: jest.Mock };
  candidate: { findMany: jest.Mock };
  integrationWebhook: { findMany: jest.Mock };
  job: { update: jest.Mock };
};
const lookup = (dns as unknown as { lookup: jest.Mock }).lookup;
const afterMock = after as unknown as jest.Mock;

const EMPRESA_ID = 9;
const SECRETO_A = 'a'.repeat(64);
const SECRETO_B = 'b'.repeat(64);
const URL_A = 'https://worky.example.com/api/integrations/inakat/webhook/11111111-1111-4111-8111-111111111111';
const URL_B = 'https://otro-receptor.example.com/api/integrations/inakat/webhook/22222222-2222-4222-8222-222222222222';

/** Application con el include de integration-candidate.ts (la que lee el mapper). */
function aplicacionCompleta(extra: Record<string, unknown> = {}) {
  return {
    id: 501,
    candidateName: 'José Ñúñez Ávila',
    candidateEmail: 'jose.nunez@correo.mx',
    candidatePhone: null,
    cvUrl: null,
    notes: 'NOTA INTERNA: referencia laboral negativa',
    status: 'accepted',
    reviewedAt: new Date('2026-10-01T17:59:00Z'),
    updatedAt: new Date('2026-10-01T17:59:00Z'),
    job: { id: 7, title: 'Analista de nómina', userId: EMPRESA_ID, salaryMin: 18000, salaryMax: 22000 },
    evaluationNotes: [{ authorRole: 'recruiter', content: 'Perfil estable, buena comunicación.' }],
    skillRatings: [{ skillName: 'Excel', rating: 5, comment: null }],
    ...extra
  };
}

/** Lo que devuelve fetch cuando Worky2 acepta el evento. */
const respuestaWorky = (status = 201) =>
  ({ ok: status >= 200 && status < 300, status } as unknown as Response);

let fetchMock: jest.Mock;
const fetchOriginal = global.fetch;

beforeEach(() => {
  jest.clearAllMocks();
  fetchMock = jest.fn(async () => respuestaWorky());
  global.fetch = fetchMock as unknown as typeof fetch;
  lookup.mockResolvedValue([{ address: '93.184.216.34', family: 4 }]);
  mp.application.findUnique.mockResolvedValue(aplicacionCompleta());
  mp.candidate.findMany.mockResolvedValue([]);
  mp.integrationWebhook.findMany.mockResolvedValue([{ id: 45, url: URL_A, secret: SECRETO_A }]);
  jest.spyOn(console, 'warn').mockImplementation(() => {});
  jest.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  global.fetch = fetchOriginal;
  jest.restoreAllMocks();
});

/** Verificador independiente, escrito desde la documentación del contrato. */
function firmaEsValida(secret: string, ts: string, cuerpo: string, firma: string): boolean {
  const esperada = 'v1=' + crypto.createHmac('sha256', secret).update(`${ts}.${cuerpo}`).digest('hex');
  return esperada.length === firma.length && crypto.timingSafeEqual(Buffer.from(esperada), Buffer.from(firma));
}

describe('dispatchCandidateAccepted · lo que viaja por la red', () => {
  it('manda un POST JSON firmado con el formato del contrato', async () => {
    const antes = Math.floor(Date.now() / 1000);
    await dispatchCandidateAccepted(501);
    const despues = Math.floor(Date.now() / 1000);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(URL_A);
    expect(init.method).toBe('POST');

    const h = init.headers as Record<string, string>;
    expect(h['Content-Type']).toBe('application/json');
    // Epoch en SEGUNDOS: Worky2 lo multiplica por 1000 para su ventana de 5 min
    expect(h['X-Inakat-Timestamp']).toMatch(/^\d{10}$/);
    const ts = Number(h['X-Inakat-Timestamp']);
    expect(ts).toBeGreaterThanOrEqual(antes);
    expect(ts).toBeLessThanOrEqual(despues);
    expect(h['X-Inakat-Signature']).toMatch(/^v1=[0-9a-f]{64}$/);
    expect(h['X-Inakat-Delivery']).toMatch(/^[0-9a-f-]{36}$/);

    expect(firmaEsValida(SECRETO_A, h['X-Inakat-Timestamp'], init.body, h['X-Inakat-Signature'])).toBe(true);
    expect(h['X-Inakat-Signature']).toBe(signWebhookPayload(SECRETO_A, ts, init.body));

    const cuerpo = JSON.parse(init.body);
    expect(Object.keys(cuerpo).sort()).toEqual(['candidate', 'createdAt', 'event', 'id']);
    expect(cuerpo.event).toBe('candidate.accepted');
    expect(cuerpo.id).toBe(h['X-Inakat-Delivery']);
    expect(new Date(cuerpo.createdAt).toISOString()).toBe(cuerpo.createdAt);
    expect(cuerpo.candidate).toMatchObject({
      inakatCandidateId: 501,
      nombre: 'José',
      apellidoPaterno: 'Ñúñez',
      apellidoMaterno: 'Ávila',
      email: 'jose.nunez@correo.mx',
      puesto: 'Analista de nómina',
      salarioMensualPropuesto: 22000,
      fechaAceptacion: '2026-10-01T17:59:00.000Z',
      evaluacionPsicologica: 'Perfil estable, buena comunicación.',
      notasAdicionales: null
    });
  });

  it('no sigue redirecciones (reenviaría la PII a otro host) y corta a los 5 s', async () => {
    await dispatchCandidateAccepted(501);
    const init = fetchMock.mock.calls[0][1];
    expect(init.redirect).toBe('error');
    expect(init.signal).toBeInstanceOf(AbortSignal);
  });

  it('la firma cubre los bytes UTF-8 exactos: un acento cambiado la invalida', async () => {
    await dispatchCandidateAccepted(501);
    const init = fetchMock.mock.calls[0][1];
    const h = init.headers as Record<string, string>;
    const manipulado = (init.body as string).replace('Ñúñez', 'Nunez');
    expect(manipulado).not.toBe(init.body);
    expect(firmaEsValida(SECRETO_A, h['X-Inakat-Timestamp'], manipulado, h['X-Inakat-Signature'])).toBe(false);
  });

  it('PRIVACIDAD: las notas internas de la postulación no viajan', async () => {
    await dispatchCandidateAccepted(501);
    expect(fetchMock.mock.calls[0][1].body).not.toContain('NOTA INTERNA');
  });

  it('cada webhook recibe el mismo evento firmado con SU secreto', async () => {
    mp.integrationWebhook.findMany.mockResolvedValue([
      { id: 45, url: URL_A, secret: SECRETO_A },
      { id: 46, url: URL_B, secret: SECRETO_B }
    ]);
    await dispatchCandidateAccepted(501);

    expect(fetchMock).toHaveBeenCalledTimes(2);
    const [a, b] = fetchMock.mock.calls.map(([url, init]) => ({ url, init }));
    expect(a.init.body).toBe(b.init.body);
    expect(a.init.headers['X-Inakat-Delivery']).toBe(b.init.headers['X-Inakat-Delivery']);
    const ts = a.init.headers['X-Inakat-Timestamp'];
    expect(firmaEsValida(SECRETO_A, ts, a.init.body, a.init.headers['X-Inakat-Signature'])).toBe(true);
    expect(firmaEsValida(SECRETO_B, ts, b.init.body, b.init.headers['X-Inakat-Signature'])).toBe(true);
    expect(firmaEsValida(SECRETO_A, ts, b.init.body, b.init.headers['X-Inakat-Signature'])).toBe(false);
  });

  it('sólo consulta los webhooks ACTIVOS de la empresa dueña de la vacante', async () => {
    await dispatchCandidateAccepted(501);
    expect(mp.integrationWebhook.findMany.mock.calls[0][0].where).toEqual({
      userId: EMPRESA_ID,
      isActive: true
    });
  });

  it('si un receptor falla, los demás reciben igual y la función no lanza', async () => {
    mp.integrationWebhook.findMany.mockResolvedValue([
      { id: 45, url: URL_A, secret: SECRETO_A },
      { id: 46, url: URL_B, secret: SECRETO_B }
    ]);
    fetchMock.mockImplementation(async (url: string) => {
      if (url === URL_A) throw new TypeError('fetch failed');
      return respuestaWorky(201);
    });

    await expect(dispatchCandidateAccepted(501)).resolves.toBeUndefined();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('una respuesta 4xx/5xx de Worky2 se registra y no lanza', async () => {
    fetchMock.mockResolvedValue(respuestaWorky(409));
    await expect(dispatchCandidateAccepted(501)).resolves.toBeUndefined();
    expect(console.warn).toHaveBeenCalledWith(expect.stringContaining('respondió 409'));
  });

  it('revalida el DNS antes de enviar: si ahora apunta a la red interna, no envía', async () => {
    lookup.mockResolvedValue([{ address: '169.254.169.254', family: 4 }]);
    await dispatchCandidateAccepted(501);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('sin webhooks activos, postulación inexistente o vacante huérfana: no hay POST', async () => {
    mp.integrationWebhook.findMany.mockResolvedValueOnce([]);
    await dispatchCandidateAccepted(501);

    mp.application.findUnique.mockResolvedValueOnce(null);
    await dispatchCandidateAccepted(999);

    mp.application.findUnique.mockResolvedValueOnce(
      aplicacionCompleta({ job: { id: 7, title: 'x', userId: null, salaryMin: null, salaryMax: null } })
    );
    await dispatchCandidateAccepted(501);

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('un error de base dentro del despacho no se propaga', async () => {
    mp.integrationWebhook.findMany.mockRejectedValueOnce(new Error('conexión perdida'));
    await expect(dispatchCandidateAccepted(501)).resolves.toBeUndefined();
  });
});

// ============================================================
// Disparo: la empresa acepta al candidato desde su panel
// ============================================================

describe('PATCH /api/company/applications/[id] dispara el webhook al aceptar', () => {
  /** Aplicación tal como la lee el PATCH antes de actualizarla. */
  const enPanel = (status: string) => ({
    ...aplicacionCompleta({ status }),
    job: { id: 7, userId: EMPRESA_ID, title: 'Analista de nómina' }
  });

  function patch(status: string) {
    return patchEmpresa(
      new Request('http://localhost/api/company/applications/501', {
        method: 'PATCH',
        headers: { 'x-user-id': String(EMPRESA_ID), 'x-user-role': 'company' },
        body: JSON.stringify({ status })
      }),
      { params: Promise.resolve({ id: '501' }) }
    );
  }

  beforeEach(() => {
    // El PATCH lee la aplicación (estado previo) y el despacho la vuelve a leer
    // con el include del contrato: se distinguen por lo que piden.
    mp.application.findUnique.mockImplementation(async (args: { include?: { evaluationNotes?: unknown } }) =>
      args.include?.evaluationNotes ? aplicacionCompleta() : enPanel('interviewed')
    );
    mp.application.update.mockImplementation(async ({ data }) => ({
      ...aplicacionCompleta(data),
      job: { id: 7, title: 'Analista de nómina', company: 'Empresa Nueve' }
    }));
  });

  it('aceptar → la respuesta sale y DESPUÉS (after) se manda el POST firmado a Worky2', async () => {
    const res = await patch('accepted');
    expect(res.status).toBe(200);

    // Todavía no se envió nada: el despacho va en after()
    expect(fetchMock).not.toHaveBeenCalled();
    expect(afterMock).toHaveBeenCalledTimes(1);

    await afterMock.mock.calls[0][0]();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(URL_A);
    expect(JSON.parse(init.body).candidate.inakatCandidateId).toBe(501);
  });

  it('la aceptación marca reviewedAt (de ahí salen fechaAceptacion y el filtro ?since)', async () => {
    await patch('accepted');
    expect(mp.application.update.mock.calls[0][0].data.reviewedAt).toBeInstanceOf(Date);
  });

  it('otros cambios de estado no disparan el webhook', async () => {
    mp.application.findUnique.mockResolvedValue(enPanel('sent_to_company'));
    const res = await patch('company_interested');
    expect(res.status).toBe(200);
    expect(afterMock).not.toHaveBeenCalled();
  });

  it('una aplicación ya aceptada no se puede volver a aceptar (no hay doble evento)', async () => {
    mp.application.findUnique.mockResolvedValue(enPanel('accepted'));
    const res = await patch('accepted');
    expect(res.status).toBe(400);
    expect(afterMock).not.toHaveBeenCalled();
  });
});

describe('PATCH /api/applications/[id] (admin) dispara el webhook UNA vez', () => {
  function patch(status: string) {
    return patchAdmin(
      new NextRequest('http://localhost/api/applications/501', {
        method: 'PATCH',
        headers: { 'x-user-id': '1', 'x-user-email': 'admin@inakat.com', 'x-user-role': 'admin' },
        body: JSON.stringify({ status })
      }),
      { params: Promise.resolve({ id: '501' }) }
    );
  }

  beforeEach(() => {
    mp.application.findUnique.mockImplementation(async (args: { include?: { evaluationNotes?: unknown } }) =>
      args.include?.evaluationNotes ? aplicacionCompleta() : { ...aplicacionCompleta({ status: 'sent_to_company' }), jobId: 7 }
    );
  });

  it('el admin acepta → after() → POST firmado a Worky2', async () => {
    mp.application.updateMany.mockResolvedValue({ count: 1 });
    const res = await patch('accepted');
    expect(res.status).toBe(200);
    // La aceptación se reclama de forma atómica (sólo si aún no estaba aceptada)
    expect(mp.application.updateMany.mock.calls[0][0].where).toEqual({ id: 501, status: { not: 'accepted' } });

    expect(afterMock).toHaveBeenCalledTimes(1);
    await afterMock.mock.calls[0][0]();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(JSON.parse(fetchMock.mock.calls[0][1].body).candidate.inakatCandidateId).toBe(501);
  });

  it('doble clic: la segunda petición pierde la carrera (count 0) → 409 y sin segundo evento', async () => {
    mp.application.updateMany.mockResolvedValue({ count: 0 });
    const res = await patch('accepted');
    expect(res.status).toBe(409);
    expect(afterMock).not.toHaveBeenCalled();
  });

  it('un usuario que no es admin no puede aceptar por esta ruta', async () => {
    const res = await patchAdmin(
      new NextRequest('http://localhost/api/applications/501', {
        method: 'PATCH',
        headers: { 'x-user-id': '9', 'x-user-email': 'u9@empresa.mx', 'x-user-role': 'company' },
        body: JSON.stringify({ status: 'accepted' })
      }),
      { params: Promise.resolve({ id: '501' }) }
    );
    expect(res.status).toBe(403);
    expect(afterMock).not.toHaveBeenCalled();
  });
});
