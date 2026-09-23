// RUTA: __tests__/api/emp-empresa-verificacion.test.ts

/**
 * Módulo EMPRESA — segunda pasada sobre la auditoría 2026-09.
 *
 * Cubre los huecos que quedaban tras la primera remediación:
 *  - EMP-001  identificación/acta/logo sólo pueden venir de /api/upload
 *  - EMP-008  el payload EXACTO del formulario (sitioWeb null) se acepta
 *  - EMP-002  PATCH 'pending' reactiva la cuenta; el GET de la ficha exige
 *             empresa aprobada
 *  - EMP-004/EMP-014  el dashboard ya no embebe applications en allJobs ni
 *             carga las filas completas sólo para contarlas
 *  - EMP-026  el saludo no repite el apellido y el perfil sincroniza el User
 *  - EMP-022  cambiar un archivo invalida la URL cacheada del intento anterior
 */
import fs from 'fs';
import path from 'path';

jest.mock('next/server', () => ({
  NextRequest: class {},
  after: jest.fn(),
  NextResponse: {
    json: (data: unknown, options?: { status?: number }) => ({
      status: options?.status || 200,
      json: async () => data,
    }),
  },
}));

const mockPrisma = {
  companyRequest: {
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
  user: {
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
  application: { findUnique: jest.fn(), findMany: jest.fn() },
  candidate: { findFirst: jest.fn(), findMany: jest.fn() },
  job: { findMany: jest.fn() },
  $transaction: jest.fn(),
};

jest.mock('@/lib/prisma', () => ({ prisma: mockPrisma }));

jest.mock('@/lib/notifications', () => ({
  createNotification: jest.fn(async () => ({ id: 1 })),
  notifyAllAdmins: jest.fn(async () => undefined),
  runAfterResponse: jest.fn(async (_etiqueta: string, fn: () => Promise<unknown>) => {
    await fn();
  }),
}));

jest.mock('@/lib/email', () => ({
  sendCompanyApproved: jest.fn(async () => true),
  sendCompanyRejected: jest.fn(async () => true),
}));

jest.mock('@/lib/rate-limit', () => ({
  applyRateLimit: jest.fn(() => null),
  REGISTER_RATE_LIMIT: { maxRequests: 3, windowSeconds: 3600 },
}));

jest.mock('@/lib/auth', () => ({
  requireApprovedCompany: jest.fn(async () => null),
}));

jest.mock('@/lib/worky2-webhook', () => ({
  dispatchCandidateAccepted: jest.fn(async () => undefined),
}));

import { requireApprovedCompany } from '@/lib/auth';
import { companyRequestSchema, esUrlDeArchivoSubido } from '@/lib/validations';

const mockRequireApprovedCompany = requireApprovedCompany as jest.Mock;

function req(body: unknown, headers: Record<string, string> = {}) {
  return {
    json: async () => body,
    headers: { get: (k: string) => headers[k] ?? null },
    url: 'http://localhost/api/test',
  } as unknown as Request;
}

const ctx = (id: string) => ({ params: Promise.resolve({ id }) });

const BLOB = 'https://abc123.public.blob.vercel-storage.com';

/** Lo que manda FormRegisterForQuotationSection con los opcionales vacíos. */
const PAYLOAD_FORMULARIO = {
  nombre: 'Juan',
  apellidoPaterno: 'Pérez',
  apellidoMaterno: null,
  departamento: null,
  nombreEmpresa: 'Acme',
  correoEmpresa: 'rh@acme.com',
  sitioWeb: null,
  razonSocial: 'Acme SA de CV',
  rfc: 'ACM123456AB1',
  direccionEmpresa: 'Av. Siempre Viva 742, Col. Centro, CDMX, CP 06000',
  latitud: null,
  longitud: null,
  password: 'Password1',
  identificacionUrl: `${BLOB}/ine-x1.pdf`,
  documentosConstitucionUrl: `${BLOB}/acta-x1.pdf`,
  logoUrl: null,
};

beforeEach(() => {
  jest.clearAllMocks();
  mockRequireApprovedCompany.mockResolvedValue(null);
  mockPrisma.$transaction.mockImplementation(async (cb: unknown) =>
    typeof cb === 'function' ? (cb as (tx: unknown) => unknown)(mockPrisma) : cb
  );
});

// =============================================================================
// EMP-001 — URLs de documentos
// =============================================================================

describe('EMP-001 — los documentos sólo pueden venir de /api/upload', () => {
  it('acepta Vercel Blob y la ruta local de desarrollo', () => {
    expect(esUrlDeArchivoSubido(`${BLOB}/ine.pdf`)).toBe(true);
    expect(esUrlDeArchivoSubido('/uploads/1700000000-ine.pdf')).toBe(true);
  });

  it('rechaza hosts ajenos, http sin cifrar, esquemas peligrosos y rutas raras', () => {
    for (const url of [
      'https://evil.com/ine.pdf',
      'https://public.blob.vercel-storage.com.evil.com/ine.pdf',
      'http://abc123.public.blob.vercel-storage.com/ine.pdf',
      'javascript:alert(1)',
      'data:text/html,<script>alert(1)</script>',
      '/uploads/../.env',
      '/api/admin/users',
      '//evil.com/ine.pdf',
    ]) {
      expect(esUrlDeArchivoSubido(url)).toBe(false);
    }
  });

  it('en producción ya no acepta la ruta local', () => {
    const original = process.env.NODE_ENV;
    (process.env as Record<string, string>).NODE_ENV = 'production';
    try {
      expect(esUrlDeArchivoSubido('/uploads/1700000000-ine.pdf')).toBe(false);
      expect(esUrlDeArchivoSubido(`${BLOB}/ine.pdf`)).toBe(true);
    } finally {
      (process.env as Record<string, string>).NODE_ENV = original as string;
    }
  });

  it('el schema del alta aplica el filtro a identificación, acta y logo', () => {
    for (const campo of ['identificacionUrl', 'documentosConstitucionUrl', 'logoUrl']) {
      const r = companyRequestSchema.safeParse({
        ...PAYLOAD_FORMULARIO,
        [campo]: 'https://phishing.example/documento.pdf',
      });
      expect(r.success).toBe(false);
    }
  });

  it('POST responde 400 y no crea nada con una identificación externa', async () => {
    const { POST } = await import('@/app/api/company-requests/route');
    const res = await POST(
      req({ ...PAYLOAD_FORMULARIO, identificacionUrl: 'https://evil.com/ine.pdf' })
    );

    expect(res.status).toBe(400);
    expect(mockPrisma.$transaction).not.toHaveBeenCalled();
  });
});

// =============================================================================
// EMP-008 — payload real del formulario
// =============================================================================

describe('EMP-008 — el alta acepta lo que manda el formulario', () => {
  beforeEach(() => {
    mockPrisma.user.findUnique.mockResolvedValue(null);
    mockPrisma.companyRequest.create.mockResolvedValue({ id: 7 });
    mockPrisma.user.create.mockResolvedValue({ id: 3 });
  });

  it('con sitio web, apellido materno y ubicación vacíos (null) crea la solicitud', async () => {
    const { POST } = await import('@/app/api/company-requests/route');
    const res = await POST(req(PAYLOAD_FORMULARIO));

    expect(res.status).toBe(201);
    const datos = mockPrisma.companyRequest.create.mock.calls[0][0].data;
    expect(datos.sitioWeb).toBeNull();
    expect(datos.latitud).toBeNull();
    expect(datos.identificacionUrl).toBe(`${BLOB}/ine-x1.pdf`);
  });

  it('completa con https un sitio escrito sin protocolo', async () => {
    const { POST } = await import('@/app/api/company-requests/route');
    await POST(req({ ...PAYLOAD_FORMULARIO, sitioWeb: 'www.acme.com' }));

    const datos = mockPrisma.companyRequest.create.mock.calls[0][0].data;
    expect(datos.sitioWeb).toBe('https://www.acme.com');
  });

  it('un cuerpo que no es un objeto da 400, no 500', async () => {
    const { POST } = await import('@/app/api/company-requests/route');
    const res = await POST(req(null));

    expect(res.status).toBe(400);
    expect(mockPrisma.user.findUnique).not.toHaveBeenCalled();
  });
});

// =============================================================================
// EMP-002 — aprobación
// =============================================================================

describe('EMP-002 — la decisión del admin se aplica a la cuenta', () => {
  it("reabrir una solicitud rechazada ('pending') reactiva la cuenta", async () => {
    mockPrisma.companyRequest.findUnique.mockResolvedValue({ id: 5, userId: 42 });
    mockPrisma.companyRequest.update.mockResolvedValue({
      id: 5,
      userId: 42,
      correoEmpresa: 'rh@acme.com',
      nombreEmpresa: 'Acme',
    });

    const { PATCH } = await import('@/app/api/company-requests/[id]/route');
    const res = await PATCH(req({ status: 'pending' }), ctx('5'));

    expect(res.status).toBe(200);
    expect(mockPrisma.user.update).toHaveBeenCalledWith({
      where: { id: 42 },
      data: { isActive: true },
    });
  });

  it('GET de la ficha de postulación bloquea a la empresa no aprobada', async () => {
    mockRequireApprovedCompany.mockResolvedValue({
      error: 'en revisión',
      code: 'COMPANY_NOT_APPROVED',
      status: 403,
    });

    const { GET } = await import('@/app/api/company/applications/[id]/route');
    const res = await GET(
      req(null, { 'x-user-id': '42', 'x-user-role': 'company' }),
      ctx('15')
    );

    expect(res.status).toBe(403);
    expect((await res.json()).code).toBe('COMPANY_NOT_APPROVED');
    expect(mockPrisma.application.findUnique).not.toHaveBeenCalled();
  });
});

// =============================================================================
// EMP-004 / EMP-014 / EMP-026 — dashboard
// =============================================================================

/** Todas las claves del objeto, a cualquier profundidad. */
function clavesProfundas(valor: unknown, acumuladas = new Set<string>()): Set<string> {
  if (Array.isArray(valor)) {
    valor.forEach((v) => clavesProfundas(v, acumuladas));
  } else if (valor && typeof valor === 'object' && !(valor instanceof Date)) {
    for (const [k, v] of Object.entries(valor)) {
      acumuladas.add(k);
      clavesProfundas(v, acumuladas);
    }
  }
  return acumuladas;
}

describe('GET /api/company/dashboard', () => {
  const headersEmpresa = { 'x-user-id': '42', 'x-user-role': 'company' };

  beforeEach(() => {
    mockPrisma.user.findUnique.mockResolvedValue({
      id: 42,
      email: 'rh@acme.com',
      // Usuario del alta vieja: el apellido paterno venía pegado al nombre.
      nombre: 'Juan Pérez',
      apellidoPaterno: 'Pérez',
      apellidoMaterno: 'López',
      credits: 10,
      companyRequest: {
        nombre: 'Juan',
        apellidoPaterno: 'Pérez',
        nombreEmpresa: 'Acme',
        status: 'approved',
        rejectionReason: null,
      },
    });
    mockPrisma.job.findMany.mockResolvedValue([
      { id: 1, title: 'Dev', status: 'active', notasInternas: 'interno', expiresAt: null },
      { id: 2, title: 'QA', status: 'draft', notasInternas: null, expiresAt: null },
    ]);
    mockPrisma.application.findMany.mockResolvedValue([
      {
        id: 10,
        jobId: 1,
        status: 'sent_to_company',
        candidateEmail: 'ana@mail.com',
        notes: 'nota interna de INAKAT',
        job: { id: 1, title: 'Dev' },
      },
      {
        id: 11,
        jobId: 1,
        status: 'interviewed',
        candidateEmail: 'luis@mail.com',
        notes: 'otra nota interna',
        job: { id: 1, title: 'Dev' },
      },
    ]);
    mockPrisma.candidate.findMany.mockResolvedValue([]);
  });

  it('no pide las filas completas de applications junto con las vacantes', async () => {
    const { GET } = await import('@/app/api/company/dashboard/route');
    await GET(req(null, headersEmpresa));

    const args = mockPrisma.job.findMany.mock.calls[0][0];
    expect(args.include).toBeUndefined();
  });

  it('allJobs trae el conteo pero no las applications embebidas', async () => {
    const { GET } = await import('@/app/api/company/dashboard/route');
    const res = await GET(req(null, headersEmpresa));
    const { data } = await res.json();

    const [dev, qa] = data.allJobs;
    expect(dev).not.toHaveProperty('applications');
    expect(dev).not.toHaveProperty('notasInternas');
    expect(dev.applicationCount).toBe(2);
    expect(qa.applicationCount).toBe(0);
    expect(data.topJobs[0]).toEqual(expect.objectContaining({ id: 1, applicationCount: 2 }));
  });

  it('ninguna parte de la respuesta contiene notas internas', async () => {
    const { GET } = await import('@/app/api/company/dashboard/route');
    const res = await GET(req(null, headersEmpresa));
    const claves = clavesProfundas(await res.json());

    for (const interna of ['notes', 'notas', 'notasInternas', 'recruiterNotes', 'specialistNotes']) {
      expect(claves.has(interna)).toBe(false);
    }
  });

  it('EMP-026: el saludo no repite el apellido paterno', async () => {
    const { GET } = await import('@/app/api/company/dashboard/route');
    const res = await GET(req(null, headersEmpresa));
    const { data } = await res.json();

    expect(data.company.userName).toBe('Juan Pérez');
  });
});

// =============================================================================
// EMP-026 — el perfil sincroniza el User
// =============================================================================

describe('PUT /api/company/profile — representante', () => {
  const headersEmpresa = { 'x-user-id': '42', 'x-user-role': 'company' };

  beforeEach(() => {
    mockPrisma.user.findUnique.mockResolvedValue({ id: 42, companyRequest: { id: 5 } });
    mockPrisma.companyRequest.update.mockResolvedValue({ id: 5, nombre: 'Ana' });
  });

  it('cambiar el representante actualiza también el User, en la misma transacción', async () => {
    const { PUT } = await import('@/app/api/company/profile/route');
    const res = await PUT(req({ nombre: 'Ana', apellidoPaterno: 'Ruiz' }, headersEmpresa));

    expect(res.status).toBe(200);
    expect(mockPrisma.$transaction).toHaveBeenCalled();
    expect(mockPrisma.user.update).toHaveBeenCalledWith({
      where: { id: 42 },
      data: { nombre: 'Ana', apellidoPaterno: 'Ruiz' },
    });
  });

  it('cambiar sólo datos de la empresa no toca el User', async () => {
    const { PUT } = await import('@/app/api/company/profile/route');
    const res = await PUT(req({ nombreEmpresa: 'Acme Dos' }, headersEmpresa));

    expect(res.status).toBe(200);
    expect(mockPrisma.user.update).not.toHaveBeenCalled();
  });

  it('EMP-001: rechaza un logo alojado fuera de Vercel Blob', async () => {
    const { PUT } = await import('@/app/api/company/profile/route');
    const res = await PUT(req({ logoUrl: 'https://otro-host.com/x.png' }, headersEmpresa));

    expect(res.status).toBe(400);
    expect(mockPrisma.companyRequest.update).not.toHaveBeenCalled();
  });
});

// =============================================================================
// EMP-022 — caché de subidas del formulario
// =============================================================================

describe('EMP-022 — cambiar un archivo invalida la subida cacheada', () => {
  const c = fs
    .readFileSync(
      path.join(
        process.cwd(),
        'src/components/sections/companies/FormRegisterForQuotationSection.tsx'
      ),
      'utf-8'
    )
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '');

  /** Cuerpo de una función flecha declarada como `const nombre = (...) => { ... };` */
  const cuerpoDe = (nombre: string): string => {
    const inicio = c.indexOf(`const ${nombre} = (`);
    expect(inicio).toBeGreaterThan(-1);
    const fin = c.indexOf('\n  };', inicio);
    return c.slice(inicio, fin);
  };

  it('handleFileChange y handleFileRemove limpian la URL de ese archivo', () => {
    expect(cuerpoDe('handleFileChange')).toMatch(/urlsSubidasRef\.current\[fileType\] = null/);
    expect(cuerpoDe('handleFileRemove')).toMatch(/urlsSubidasRef\.current\[fileType\] = null/);
  });

  it('elegir otro logo limpia la URL del logo subido antes', () => {
    const tras = c.slice(c.indexOf('setLogoFile(file);'));
    expect(tras.slice(0, 300)).toMatch(/urlsSubidasRef\.current\.logo = null/);
  });
});
