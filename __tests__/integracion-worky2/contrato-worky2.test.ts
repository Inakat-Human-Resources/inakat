/**
 * @jest-environment node
 */

// RUTA: __tests__/integracion-worky2/contrato-worky2.test.ts
//
// CONTRATO INAKAT → Worky2, generado con el código REAL de INAKAT.
//
// Este test arma un escenario fijo (cinco contrataciones con los casos que
// cuestan: perfil completo con acentos, nombre compuesto sin perfil,
// partículas, nombre de una sola palabra y el estado legado 'hired'), lo pasa
// por GET /api/integration/candidates y por dispatchCandidateAccepted, y guarda
// lo que sale por la red en `contrato-worky2.json`:
//   - las páginas de la respuesta de candidatos, tal cual;
//   - el POST del webhook: URL, cabeceras y el cuerpo CRUDO firmado.
//
// Worky2 tiene una copia idéntica (`__tests__/fixtures/contrato-inakat.json`) y
// la reproduce contra su cliente, su receptor del webhook y su importador. Si
// INAKAT cambia lo que emite, este test falla aquí primero.
//
// Regenerar tras un cambio INTENCIONAL del contrato:
//   ACTUALIZAR_CONTRATO=1 npx jest __tests__/integracion-worky2/contrato-worky2
// y copiar el JSON a Worky (ver docs/WORKY2_INTEGRATION.md, «Tests del puente»).

export {};

jest.mock('@/lib/prisma', () => ({
  prisma: {
    application: { findMany: jest.fn(), count: jest.fn(), findUnique: jest.fn() },
    candidate: { findMany: jest.fn() },
    integrationApiKey: { findUnique: jest.fn(), update: jest.fn() },
    integrationWebhook: { findMany: jest.fn() }
  }
}));

jest.mock('dns/promises', () => ({
  __esModule: true,
  default: { lookup: jest.fn(async () => [{ address: '93.184.216.34', family: 4 }]) }
}));

import crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import { prisma } from '@/lib/prisma';
import { GET as getCandidatos } from '@/app/api/integration/candidates/route';
import { dispatchCandidateAccepted } from '@/lib/worky2-webhook';
import { separarNombreCompleto } from '@/lib/integration-candidate';

const mp = prisma as unknown as {
  application: { findMany: jest.Mock; count: jest.Mock; findUnique: jest.Mock };
  candidate: { findMany: jest.Mock };
  integrationApiKey: { findUnique: jest.Mock; update: jest.Mock };
  integrationWebhook: { findMany: jest.Mock };
};

const RUTA_CONTRATO = path.join(__dirname, 'contrato-worky2.json');
const RUTA_EN_WORKY = path.join('__tests__', 'fixtures', 'contrato-inakat.json');

// ── Escenario fijo ──────────────────────────────────────────────────────────

const EMPRESA_ID = 9;
const API_KEY = 'inak_0123456789abcdef0123456789abcdef';
const SECRETO_WEBHOOK = 'c0ffee'.repeat(10) + 'beef'; // 64 hex, como lo genera Worky2
const URL_WEBHOOK =
  'https://worky.example.com/api/integrations/inakat/webhook/0b6f3c3e-5a8d-4c1e-9d55-2f1a7e9b4c10';
const AHORA = new Date('2026-10-01T18:00:00.000Z');
const ID_ENTREGA = '5d0c7f3a-8e2b-4c51-9a7e-2b6f1d3e4a90';
const POR_PAGINA = 2;

const vacante = (extra: Record<string, unknown> = {}) => ({
  id: 7,
  title: 'Analista de nómina',
  userId: EMPRESA_ID,
  salaryMin: 30000,
  salaryMax: 38000,
  ...extra
});

/** Filas de Application con el include de integration-candidate.ts, en el orden de la base. */
const APLICACIONES = [
  {
    // Perfil Candidate completo, acentos y ñ, evaluaciones públicas y calificaciones
    id: 101,
    candidateName: 'ana lucia nunez',
    candidateEmail: 'ana.nunez@correo.mx',
    candidatePhone: null,
    cvUrl: 'https://blob.inakat.com/cv/ana-nunez.pdf',
    notes: 'NOTA INTERNA: pide 20% más que la banda',
    status: 'accepted',
    reviewedAt: new Date('2026-09-30T16:30:00.000Z'),
    updatedAt: new Date('2026-09-30T16:30:00.000Z'),
    job: vacante(),
    evaluationNotes: [
      { authorRole: 'recruiter', content: 'Entrevista conductual: estable, buena comunicación.' },
      { authorRole: 'specialist', content: 'Domina el cálculo de ISR e IMSS.' }
    ],
    skillRatings: [
      { skillName: 'Excel', rating: 5, comment: 'Tablas dinámicas' },
      { skillName: 'Nómina', rating: 4, comment: null }
    ]
  },
  {
    // Sin perfil: nombre compuesto en un solo campo
    id: 102,
    candidateName: 'Juan Carlos Pérez López',
    candidateEmail: 'jc.perez@correo.mx',
    candidatePhone: '4431234567',
    cvUrl: null,
    notes: null,
    status: 'accepted',
    reviewedAt: new Date('2026-09-29T10:00:00.000Z'),
    updatedAt: new Date('2026-09-29T10:00:00.000Z'),
    job: vacante(),
    evaluationNotes: [],
    skillRatings: []
  },
  {
    // Sin perfil: partículas en nombre y apellido
    id: 103,
    candidateName: 'María de los Ángeles de la Garza Ruiz',
    candidateEmail: 'angeles.garza@correo.mx',
    candidatePhone: null,
    cvUrl: null,
    notes: null,
    status: 'accepted',
    reviewedAt: new Date('2026-09-28T09:15:00.000Z'),
    updatedAt: new Date('2026-09-28T09:15:00.000Z'),
    job: vacante({ title: 'Auxiliar contable', salaryMin: 15000, salaryMax: null }),
    evaluationNotes: [],
    skillRatings: []
  },
  {
    // Sin perfil y una sola palabra: no hay apellido que inventar
    id: 104,
    candidateName: 'Xóchitl',
    candidateEmail: 'xochitl@correo.mx',
    candidatePhone: null,
    cvUrl: null,
    notes: null,
    status: 'accepted',
    reviewedAt: new Date('2026-09-27T12:00:00.000Z'),
    updatedAt: new Date('2026-09-27T12:00:00.000Z'),
    job: vacante({ salaryMin: null, salaryMax: null }),
    evaluationNotes: [],
    skillRatings: []
  },
  {
    // Estado legado 'hired', sin reviewedAt, email con mayúsculas
    id: 105,
    candidateName: 'Pedro Gómez',
    candidateEmail: 'Pedro.Gomez@Correo.MX',
    candidatePhone: null,
    cvUrl: null,
    notes: 'NOTA INTERNA: referencia laboral negativa',
    status: 'hired',
    reviewedAt: null,
    updatedAt: new Date('2026-08-15T08:00:00.000Z'),
    job: vacante({ salaryMin: 25000, salaryMax: null }),
    evaluationNotes: [],
    skillRatings: []
  }
];

/** Único perfil Candidate del escenario (match por email, sin distinguir caja). */
const PERFILES = [
  {
    email: 'Ana.Nunez@correo.mx',
    nombre: 'Ana Lucía',
    apellidoPaterno: 'Núñez',
    apellidoMaterno: 'Ávila',
    telefono: '5511223344',
    cvUrl: 'https://blob.inakat.com/cv/perfil-ana.pdf',
    universidad: 'Universidad Michoacana',
    carrera: 'Contaduría Pública',
    añosExperiencia: 6
  }
];

function prepararBase() {
  mp.integrationApiKey.findUnique.mockImplementation(async ({ where }) =>
    where.keyHash === crypto.createHash('sha256').update(API_KEY).digest('hex')
      ? { id: 1, userId: EMPRESA_ID, name: 'Worky2', isActive: true, user: { isActive: true, role: 'company' } }
      : null
  );
  mp.integrationApiKey.update.mockResolvedValue({});
  mp.application.findMany.mockImplementation(async ({ skip, take }) => APLICACIONES.slice(skip, skip + take));
  mp.application.count.mockResolvedValue(APLICACIONES.length);
  mp.application.findUnique.mockImplementation(async ({ where }) => APLICACIONES.find((a) => a.id === where.id) ?? null);
  mp.candidate.findMany.mockImplementation(async ({ where }) =>
    PERFILES.filter((p) => (where.email.in as string[]).includes(p.email.toLowerCase()))
  );
  mp.integrationWebhook.findMany.mockResolvedValue([{ id: 45, url: URL_WEBHOOK, secret: SECRETO_WEBHOOK }]);
}

// ── Generación del contrato con el código real ──────────────────────────────

async function generarContrato() {
  prepararBase();

  const peticiones = [];
  for (let page = 1; ; page++) {
    const ruta = `/api/integration/candidates?status=accepted&page=${page}&limit=${POR_PAGINA}`;
    const res = await getCandidatos(
      new Request(`https://www.inakat.com${ruta}`, {
        headers: { 'x-api-key': API_KEY, 'x-forwarded-for': '198.51.100.20' }
      })
    );
    const respuesta = await res.json();
    peticiones.push({ ruta, status: res.status, respuesta });
    if (!respuesta.pagination?.hasNext) break;
  }

  // Webhook: reloj y uuid fijos para que el archivo sea reproducible.
  jest.useFakeTimers({
    now: AHORA,
    doNotFake: [
      'nextTick', 'setImmediate', 'clearImmediate', 'setInterval', 'clearInterval',
      'setTimeout', 'clearTimeout', 'queueMicrotask', 'hrtime', 'performance'
    ]
  });
  const uuid = jest.spyOn(crypto, 'randomUUID').mockReturnValue(ID_ENTREGA);
  const fetchOriginal = global.fetch;
  const fetchMock = jest.fn(async () => ({ ok: true, status: 201 }) as unknown as Response);
  global.fetch = fetchMock as unknown as typeof fetch;
  try {
    await dispatchCandidateAccepted(101);
  } finally {
    global.fetch = fetchOriginal;
    uuid.mockRestore();
    jest.useRealTimers();
  }
  expect(fetchMock).toHaveBeenCalledTimes(1);
  const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];

  return {
    _LEEME:
      'Contrato INAKAT → Worky2 generado por el código real de INAKAT ' +
      '(__tests__/integracion-worky2/contrato-worky2.test.ts). NO editar a mano. ' +
      'Regenerar con ACTUALIZAR_CONTRATO=1 y copiar idéntico a Worky: __tests__/fixtures/contrato-inakat.json.',
    version: 1,
    apiKey: API_KEY,
    candidatos: { porPagina: POR_PAGINA, peticiones },
    webhook: {
      url,
      secreto: SECRETO_WEBHOOK,
      metodo: init.method,
      cabeceras: init.headers,
      cuerpo: init.body
    }
  };
}

type Contrato = Awaited<ReturnType<typeof generarContrato>>;

const CAMPOS_CONTRATO = [
  'apellidoMaterno', 'apellidoPaterno', 'carrera', 'cvUrl', 'email', 'evaluacionPsicologica',
  'evaluacionTecnica', 'experienciaAnios', 'fechaAceptacion', 'inakatCandidateId', 'nombre',
  'notasAdicionales', 'puesto', 'salarioMensualPropuesto', 'telefono', 'universidad'
];

let contrato: Contrato;

beforeAll(async () => {
  jest.spyOn(console, 'warn').mockImplementation(() => {});
  contrato = await generarContrato();
  if (process.env.ACTUALIZAR_CONTRATO === '1') {
    fs.writeFileSync(RUTA_CONTRATO, JSON.stringify(contrato, null, 2) + '\n', 'utf-8');
  }
});

const candidatosDe = (c: Contrato) => c.candidatos.peticiones.flatMap((p) => p.respuesta.data);

describe('Contrato INAKAT → Worky2 (archivo compartido)', () => {
  it('lo que emite hoy el código coincide con contrato-worky2.json', () => {
    const guardado = JSON.parse(fs.readFileSync(RUTA_CONTRATO, 'utf-8'));
    // Si esto falla, cambió lo que INAKAT manda a Worky2: si fue a propósito,
    // regenerar (ACTUALIZAR_CONTRATO=1) y actualizar la copia de Worky.
    expect(contrato).toEqual(guardado);
  });

  it('la copia de Worky es idéntica (cuando el repo de Worky está a un lado)', () => {
    const dirWorky = process.env.WORKY_REPO_DIR || path.resolve(process.cwd(), '../../../Worky2/Worky');
    const copia = path.join(dirWorky, RUTA_EN_WORKY);
    if (!fs.existsSync(copia)) {
      console.info(`[contrato] Sin copia de Worky en ${copia}: comparación omitida.`);
      return;
    }
    expect(JSON.parse(fs.readFileSync(copia, 'utf-8'))).toEqual(
      JSON.parse(fs.readFileSync(RUTA_CONTRATO, 'utf-8'))
    );
  });
});

describe('Contrato · respuesta de GET /api/integration/candidates', () => {
  it('pagina con hasNext hasta cubrir el total (Worky2 debe seguir las páginas)', () => {
    const { peticiones } = contrato.candidatos;
    expect(peticiones.length).toBeGreaterThan(1);
    expect(peticiones.every((p) => p.status === 200 && p.respuesta.success === true)).toBe(true);
    expect(peticiones.map((p) => p.respuesta.pagination.hasNext)).toEqual([true, true, false]);
    expect(candidatosDe(contrato)).toHaveLength(peticiones[0].respuesta.pagination.total);
  });

  it('cada candidato trae exactamente los 16 campos del contrato, con sus tipos', () => {
    for (const c of candidatosDe(contrato)) {
      expect(Object.keys(c).sort()).toEqual(CAMPOS_CONTRATO);
      expect(Number.isInteger(c.inakatCandidateId) && c.inakatCandidateId > 0).toBe(true);
      expect(typeof c.nombre).toBe('string');
      expect(typeof c.apellidoPaterno).toBe('string');
      expect(typeof c.email).toBe('string');
      for (const campo of ['apellidoMaterno', 'telefono', 'cvUrl', 'evaluacionPsicologica', 'evaluacionTecnica',
        'puesto', 'universidad', 'carrera', 'fechaAceptacion'] as const) {
        expect(c[campo] === null || typeof c[campo] === 'string').toBe(true);
      }
      for (const campo of ['experienciaAnios', 'salarioMensualPropuesto'] as const) {
        expect(c[campo] === null || typeof c[campo] === 'number').toBe(true);
      }
      if (c.fechaAceptacion) expect(new Date(c.fechaAceptacion).toISOString()).toBe(c.fechaAceptacion);
    }
  });

  it('PRIVACIDAD: notasAdicionales siempre null y ninguna nota interna en el archivo', () => {
    expect(candidatosDe(contrato).every((c) => c.notasAdicionales === null)).toBe(true);
    expect(JSON.stringify(contrato)).not.toContain('NOTA INTERNA');
  });

  it('el perfil Candidate manda sobre lo escrito en la postulación', () => {
    const ana = candidatosDe(contrato).find((c) => c.inakatCandidateId === 101);
    expect(ana).toMatchObject({
      nombre: 'Ana Lucía',
      apellidoPaterno: 'Núñez',
      apellidoMaterno: 'Ávila',
      telefono: '5511223344',
      cvUrl: 'https://blob.inakat.com/cv/ana-nunez.pdf', // el CV de la postulación gana
      universidad: 'Universidad Michoacana',
      carrera: 'Contaduría Pública',
      experienciaAnios: 6,
      salarioMensualPropuesto: 38000,
      fechaAceptacion: '2026-09-30T16:30:00.000Z'
    });
    expect(ana.evaluacionPsicologica).toBe('Entrevista conductual: estable, buena comunicación.');
    expect(ana.evaluacionTecnica).toBe(
      'Domina el cálculo de ISR e IMSS.\n\nHabilidades evaluadas:\nExcel: 5/5 — Tablas dinámicas\nNómina: 4/5'
    );
  });

  it('sin perfil, los apellidos se toman del final del nombre', () => {
    const porId = Object.fromEntries(candidatosDe(contrato).map((c) => [c.inakatCandidateId, c]));
    expect(porId[102]).toMatchObject({ nombre: 'Juan Carlos', apellidoPaterno: 'Pérez', apellidoMaterno: 'López' });
    expect(porId[103]).toMatchObject({
      nombre: 'María de los Ángeles',
      apellidoPaterno: 'de la Garza',
      apellidoMaterno: 'Ruiz'
    });
    expect(porId[104]).toMatchObject({ nombre: 'Xóchitl', apellidoPaterno: '', apellidoMaterno: null });
  });

  it('legado hired: fecha = updatedAt y salario = el mínimo si no hay máximo', () => {
    const pedro = candidatosDe(contrato).find((c) => c.inakatCandidateId === 105);
    expect(pedro).toMatchObject({
      fechaAceptacion: '2026-08-15T08:00:00.000Z',
      salarioMensualPropuesto: 25000,
      email: 'Pedro.Gomez@Correo.MX'
    });
  });
});

describe('Contrato · webhook candidate.accepted', () => {
  it('cuerpo = { event, id, createdAt, candidate } y el candidato es el mismo que en el pull', () => {
    const cuerpo = JSON.parse(contrato.webhook.cuerpo as string);
    expect(cuerpo).toEqual({
      event: 'candidate.accepted',
      id: ID_ENTREGA,
      createdAt: AHORA.toISOString(),
      candidate: candidatosDe(contrato).find((c) => c.inakatCandidateId === 101)
    });
  });

  it('cabeceras del contrato y firma v1 verificable con el secreto de Worky2', () => {
    const h = contrato.webhook.cabeceras as Record<string, string>;
    expect(contrato.webhook.metodo).toBe('POST');
    expect(h['Content-Type']).toBe('application/json');
    expect(h['X-Inakat-Timestamp']).toBe(String(Math.floor(AHORA.getTime() / 1000)));
    expect(h['X-Inakat-Delivery']).toBe(ID_ENTREGA);
    const esperada =
      'v1=' +
      crypto
        .createHmac('sha256', contrato.webhook.secreto)
        .update(`${h['X-Inakat-Timestamp']}.${contrato.webhook.cuerpo}`)
        .digest('hex');
    expect(h['X-Inakat-Signature']).toBe(esperada);
  });
});

describe('separarNombreCompleto', () => {
  it.each([
    ['Ana', { nombre: 'Ana', apellidoPaterno: '', apellidoMaterno: null }],
    ['Ana Ruiz', { nombre: 'Ana', apellidoPaterno: 'Ruiz', apellidoMaterno: null }],
    ['Ana Ruiz Soto', { nombre: 'Ana', apellidoPaterno: 'Ruiz', apellidoMaterno: 'Soto' }],
    ['  Juan   Carlos Pérez López ', { nombre: 'Juan Carlos', apellidoPaterno: 'Pérez', apellidoMaterno: 'López' }],
    ['Juan de la Garza', { nombre: 'Juan', apellidoPaterno: 'de la Garza', apellidoMaterno: null }],
    ['José Luis de la Cruz Hernández', { nombre: 'José Luis', apellidoPaterno: 'de la Cruz', apellidoMaterno: 'Hernández' }],
    ['', { nombre: '', apellidoPaterno: '', apellidoMaterno: null }]
  ])('«%s»', (entrada, esperado) => {
    expect(separarNombreCompleto(entrada)).toEqual(esperado);
  });
});
