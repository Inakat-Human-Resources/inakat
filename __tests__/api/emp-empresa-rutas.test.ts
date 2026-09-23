// RUTA: __tests__/api/emp-empresa-rutas.test.ts

/**
 * Módulo EMPRESA — comportamiento de las rutas tras la auditoría 2026-09.
 *
 * Cubre:
 *  - EMP-002  la aprobación del admin se aplica de verdad (rechazar desactiva)
 *  - EMP-005  no se puede pedir entrevista de un candidato aún no enviado
 *  - EMP-011  el alta pública de empresa tiene rate limit
 *  - EMP-012  la empresa no puede escribir Application.notes (notas internas)
 *  - EMP-015  validación de la solicitud de entrevista (400, no 500)
 *  - EMP-016  la campanita 'interview_requested' sí se emite
 *  - EMP-010  DELETE de solicitud no deja un usuario huérfano activo
 *  - EMP-024  PUT de admin valida y sincroniza el correo de login
 *  - EMP-025  política de contraseña del alta de empresa
 *  - EMP-022  pre-validación (dryRun) antes de subir documentos
 *  - EMP-028  PUT de perfil valida tipos en vez de reventar con 500
 *  - EMP-038  las coordenadas del mapa se persisten
 */

jest.mock('next/server', () => ({
  NextRequest: class {},
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
    findFirst: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
  user: {
    findUnique: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
  application: { findUnique: jest.fn(), update: jest.fn() },
  interviewRequest: { findFirst: jest.fn(), create: jest.fn() },
  job: { count: jest.fn(), update: jest.fn() },
  creditPurchase: { count: jest.fn() },
  notification: { create: jest.fn(), createMany: jest.fn() },
  $transaction: jest.fn(),
};

jest.mock('@/lib/prisma', () => ({ prisma: mockPrisma }));

jest.mock('@/lib/notifications', () => ({
  createNotification: jest.fn(async () => ({ id: 1 })),
  notifyAllAdmins: jest.fn(async () => undefined),
  // El helper real registra el trabajo con after(); en tests se ejecuta en línea
  // para poder afirmar que el efecto ocurre (y que se espera).
  runAfterResponse: jest.fn(async (_etiqueta: string, fn: () => Promise<unknown>) => {
    await fn();
  }),
}));

jest.mock('@/lib/email', () => ({
  sendCompanyApproved: jest.fn(async () => true),
  sendCompanyRejected: jest.fn(async () => true),
  sendInterviewRequestToAdmin: jest.fn(async () => true),
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

import { notifyAllAdmins } from '@/lib/notifications';
import { applyRateLimit } from '@/lib/rate-limit';
import { requireApprovedCompany } from '@/lib/auth';

const mockNotifyAllAdmins = notifyAllAdmins as jest.Mock;
const mockApplyRateLimit = applyRateLimit as jest.Mock;
const mockRequireApprovedCompany = requireApprovedCompany as jest.Mock;

/** Request mínima: sólo json() y headers.get() */
function req(body: unknown, headers: Record<string, string> = {}) {
  return {
    json: async () => body,
    headers: { get: (k: string) => headers[k] ?? null },
    url: 'http://localhost/api/test',
  } as unknown as Request;
}

const ctx = (id: string) => ({ params: Promise.resolve({ id }) });

const SOLICITUD_VALIDA = {
  nombre: 'Juan',
  apellidoPaterno: 'Pérez',
  apellidoMaterno: 'López',
  nombreEmpresa: 'Acme',
  correoEmpresa: 'rh@acme.com',
  razonSocial: 'Acme SA de CV',
  rfc: 'ACM123456AB1',
  direccionEmpresa: 'Av. Siempre Viva 742, CDMX',
  password: 'Password1',
};

beforeEach(() => {
  jest.clearAllMocks();
  mockApplyRateLimit.mockReturnValue(null);
  mockRequireApprovedCompany.mockResolvedValue(null);
  mockPrisma.$transaction.mockImplementation(async (cb: unknown) =>
    typeof cb === 'function' ? (cb as (tx: unknown) => unknown)(mockPrisma) : cb
  );
});

// =============================================================================
// POST /api/company-requests
// =============================================================================

describe('POST /api/company-requests — alta pública de empresa', () => {
  it('EMP-011: aplica rate limit antes de tocar la base', async () => {
    mockApplyRateLimit.mockReturnValue({ status: 429, json: async () => ({ error: 'limite' }) });

    const { POST } = await import('@/app/api/company-requests/route');
    const res = await POST(req(SOLICITUD_VALIDA));

    expect(res.status).toBe(429);
    expect(mockApplyRateLimit).toHaveBeenCalled();
    expect(mockPrisma.user.findUnique).not.toHaveBeenCalled();
  });

  it('EMP-025: rechaza una contraseña sin mayúscula ni número', async () => {
    const { POST } = await import('@/app/api/company-requests/route');
    const res = await POST(req({ ...SOLICITUD_VALIDA, password: 'aaaaaaaa' }));

    expect(res.status).toBe(400);
    expect(mockPrisma.$transaction).not.toHaveBeenCalled();
  });

  it('EMP-001: rechaza un logoUrl con esquema javascript:', async () => {
    const { POST } = await import('@/app/api/company-requests/route');
    const res = await POST(
      req({ ...SOLICITUD_VALIDA, logoUrl: 'javascript:alert(1)' })
    );

    expect(res.status).toBe(400);
    expect(mockPrisma.$transaction).not.toHaveBeenCalled();
  });

  it('EMP-022: con dryRun valida y responde 200 sin crear nada', async () => {
    mockPrisma.user.findUnique.mockResolvedValue(null);

    const { POST } = await import('@/app/api/company-requests/route');
    const res = await POST(req({ ...SOLICITUD_VALIDA, dryRun: true }));

    expect(res.status).toBe(200);
    expect(mockPrisma.$transaction).not.toHaveBeenCalled();
    expect(mockPrisma.companyRequest.create).not.toHaveBeenCalled();
  });

  it('EMP-022: con dryRun detecta el correo duplicado ANTES de subir documentos', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({ id: 9 });

    const { POST } = await import('@/app/api/company-requests/route');
    const res = await POST(req({ ...SOLICITUD_VALIDA, dryRun: true }));

    expect(res.status).toBe(409);
  });

  it('EMP-037: acepta apellido materno vacío y nombres con diéresis o apóstrofo', async () => {
    mockPrisma.user.findUnique.mockResolvedValue(null);
    mockPrisma.companyRequest.create.mockResolvedValue({ id: 7 });
    mockPrisma.user.create.mockResolvedValue({ id: 3 });

    const { POST } = await import('@/app/api/company-requests/route');
    const res = await POST(
      req({
        ...SOLICITUD_VALIDA,
        nombre: "María-José",
        apellidoPaterno: 'Argüelles',
        apellidoMaterno: '',
      })
    );

    expect(res.status).toBe(201);
    expect(mockPrisma.companyRequest.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ apellidoMaterno: '' }) })
    );
  });

  it('EMP-026: guarda User.nombre sin repetir el apellido paterno', async () => {
    mockPrisma.user.findUnique.mockResolvedValue(null);
    mockPrisma.companyRequest.create.mockResolvedValue({ id: 7 });
    mockPrisma.user.create.mockResolvedValue({ id: 3 });

    const { POST } = await import('@/app/api/company-requests/route');
    await POST(req(SOLICITUD_VALIDA));

    const datosUsuario = mockPrisma.user.create.mock.calls[0][0].data;
    expect(datosUsuario.nombre).toBe('Juan');
    expect(datosUsuario.apellidoPaterno).toBe('Pérez');
  });

  it('EMP-038: persiste las coordenadas del mapa cuando llegan', async () => {
    mockPrisma.user.findUnique.mockResolvedValue(null);
    mockPrisma.companyRequest.create.mockResolvedValue({ id: 7 });
    mockPrisma.user.create.mockResolvedValue({ id: 3 });

    const { POST } = await import('@/app/api/company-requests/route');
    await POST(req({ ...SOLICITUD_VALIDA, latitud: 19.43, longitud: -99.13 }));

    expect(mockPrisma.companyRequest.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ latitud: 19.43, longitud: -99.13 }),
      })
    );
  });

  it('EMP-038: rechaza coordenadas fuera de rango', async () => {
    const { POST } = await import('@/app/api/company-requests/route');
    const res = await POST(req({ ...SOLICITUD_VALIDA, latitud: 999, longitud: 0 }));

    expect(res.status).toBe(400);
  });

  it('EMP-009: espera la notificación a admins en vez de soltarla al vacío', async () => {
    mockPrisma.user.findUnique.mockResolvedValue(null);
    mockPrisma.companyRequest.create.mockResolvedValue({ id: 7 });
    mockPrisma.user.create.mockResolvedValue({ id: 3 });

    const { POST } = await import('@/app/api/company-requests/route');
    await POST(req(SOLICITUD_VALIDA));

    expect(mockNotifyAllAdmins).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'new_request' })
    );
  });
});

// =============================================================================
// PATCH / PUT / DELETE /api/company-requests/[id]
// =============================================================================

describe('PATCH /api/company-requests/[id] — la decisión del admin se aplica', () => {
  it('EMP-002: al rechazar desactiva la cuenta de la empresa', async () => {
    mockPrisma.companyRequest.findUnique.mockResolvedValue({ id: 5, userId: 42 });
    mockPrisma.companyRequest.update.mockResolvedValue({
      id: 5,
      userId: 42,
      correoEmpresa: 'rh@acme.com',
      nombreEmpresa: 'Acme',
    });

    const { PATCH } = await import('@/app/api/company-requests/[id]/route');
    const res = await PATCH(req({ status: 'rejected', rejectionReason: 'ilegible' }), ctx('5'));

    expect(res.status).toBe(200);
    expect(mockPrisma.user.update).toHaveBeenCalledWith({
      where: { id: 42 },
      data: { isActive: false },
    });
  });

  it('EMP-002: al aprobar reactiva la cuenta', async () => {
    mockPrisma.companyRequest.findUnique.mockResolvedValue({ id: 5, userId: 42 });
    mockPrisma.companyRequest.update.mockResolvedValue({
      id: 5,
      userId: 42,
      correoEmpresa: 'rh@acme.com',
      nombreEmpresa: 'Acme',
    });

    const { PATCH } = await import('@/app/api/company-requests/[id]/route');
    await PATCH(req({ status: 'approved' }), ctx('5'));

    expect(mockPrisma.user.update).toHaveBeenCalledWith({
      where: { id: 42 },
      data: { isActive: true },
    });
  });
});

describe('PUT /api/company-requests/[id] — edición del admin', () => {
  it('EMP-024: rechaza un RFC con formato inválido', async () => {
    mockPrisma.companyRequest.findUnique.mockResolvedValue({
      id: 5,
      status: 'pending',
      correoEmpresa: 'rh@acme.com',
    });

    const { PUT } = await import('@/app/api/company-requests/[id]/route');
    const res = await PUT(req({ rfc: 'abc' }), ctx('5'));

    expect(res.status).toBe(400);
    expect(mockPrisma.companyRequest.update).not.toHaveBeenCalled();
  });

  it('EMP-024: al corregir el correo mueve también el correo de login', async () => {
    mockPrisma.companyRequest.findUnique.mockResolvedValue({
      id: 5,
      status: 'pending',
      userId: 42,
      correoEmpresa: 'rh@acmee.com',
      nombre: 'Juan',
      apellidoPaterno: 'Pérez',
      apellidoMaterno: 'López',
      nombreEmpresa: 'Acme',
      razonSocial: 'Acme SA de CV',
      rfc: 'ACM123456AB1',
      direccionEmpresa: 'Av. Siempre Viva 742',
      sitioWeb: null,
    });
    mockPrisma.user.findUnique.mockResolvedValue(null);
    mockPrisma.companyRequest.update.mockResolvedValue({ id: 5 });

    const { PUT } = await import('@/app/api/company-requests/[id]/route');
    const res = await PUT(req({ correoEmpresa: 'rh@acme.com' }), ctx('5'));

    expect(res.status).toBe(200);
    expect(mockPrisma.user.update).toHaveBeenCalledWith({
      where: { id: 42 },
      data: { email: 'rh@acme.com' },
    });
  });

  it('EMP-024: devuelve 409 si el correo nuevo ya pertenece a otra cuenta', async () => {
    mockPrisma.companyRequest.findUnique.mockResolvedValue({
      id: 5,
      status: 'pending',
      userId: 42,
      correoEmpresa: 'rh@acmee.com',
    });
    mockPrisma.user.findUnique.mockResolvedValue({ id: 99 });

    const { PUT } = await import('@/app/api/company-requests/[id]/route');
    const res = await PUT(req({ correoEmpresa: 'ocupado@acme.com' }), ctx('5'));

    expect(res.status).toBe(409);
    expect(mockPrisma.companyRequest.update).not.toHaveBeenCalled();
  });
});

describe('DELETE /api/company-requests/[id] — no deja usuarios huérfanos', () => {
  it('EMP-010: 409 si la empresa ya tiene vacantes', async () => {
    mockPrisma.companyRequest.findUnique.mockResolvedValue({ id: 5, userId: 42 });
    mockPrisma.job.count.mockResolvedValue(3);
    mockPrisma.creditPurchase.count.mockResolvedValue(0);

    const { DELETE } = await import('@/app/api/company-requests/[id]/route');
    const res = await DELETE(req({}), ctx('5'));

    expect(res.status).toBe(409);
    expect(mockPrisma.companyRequest.delete).not.toHaveBeenCalled();
  });

  it('EMP-010: sin historial, borra la solicitud y desactiva la cuenta', async () => {
    mockPrisma.companyRequest.findUnique.mockResolvedValue({ id: 5, userId: 42 });
    mockPrisma.job.count.mockResolvedValue(0);
    mockPrisma.creditPurchase.count.mockResolvedValue(0);

    const { DELETE } = await import('@/app/api/company-requests/[id]/route');
    const res = await DELETE(req({}), ctx('5'));

    expect(res.status).toBe(200);
    expect(mockPrisma.user.update).toHaveBeenCalledWith({
      where: { id: 42 },
      data: { isActive: false },
    });
    expect(mockPrisma.companyRequest.delete).toHaveBeenCalledWith({ where: { id: 5 } });
  });
});

// =============================================================================
// PATCH /api/company/applications/[id]
// =============================================================================

describe('PATCH /api/company/applications/[id]', () => {
  const headersEmpresa = { 'x-user-id': '42', 'x-user-role': 'company' };

  const aplicacionEnviada = {
    id: 15,
    status: 'sent_to_company',
    candidateName: 'Ana',
    job: { id: 8, userId: 42, title: 'Dev' },
  };

  it('EMP-002: bloquea a la empresa no aprobada', async () => {
    mockRequireApprovedCompany.mockResolvedValue({
      error: 'Tu empresa está en revisión.',
      code: 'COMPANY_NOT_APPROVED',
      status: 403,
    });

    const { PATCH } = await import('@/app/api/company/applications/[id]/route');
    const res = await PATCH(req({ status: 'rejected' }, headersEmpresa), ctx('15'));

    expect(res.status).toBe(403);
    expect((await res.json()).code).toBe('COMPANY_NOT_APPROVED');
    expect(mockPrisma.application.update).not.toHaveBeenCalled();
  });

  it('EMP-012: ignora `notes` del body (notas internas de INAKAT)', async () => {
    mockPrisma.application.findUnique.mockResolvedValue(aplicacionEnviada);
    mockPrisma.application.update.mockResolvedValue({
      id: 15,
      candidateName: 'Ana',
      job: { id: 8, title: 'Dev', company: 'Acme' },
    });

    const { PATCH } = await import('@/app/api/company/applications/[id]/route');
    const res = await PATCH(
      req({ status: 'rejected', notes: 'texto de la empresa' }, headersEmpresa),
      ctx('15')
    );

    expect(res.status).toBe(200);
    const datos = mockPrisma.application.update.mock.calls[0][0].data;
    expect(datos).not.toHaveProperty('notes');
  });

  it('EMP-013: espera la notificación a admins', async () => {
    mockPrisma.application.findUnique.mockResolvedValue(aplicacionEnviada);
    mockPrisma.application.update.mockResolvedValue({
      id: 15,
      candidateName: 'Ana',
      job: { id: 8, title: 'Dev', company: 'Acme' },
    });

    const { PATCH } = await import('@/app/api/company/applications/[id]/route');
    await PATCH(req({ status: 'rejected' }, headersEmpresa), ctx('15'));

    expect(mockNotifyAllAdmins).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'application_status' })
    );
  });
});

// =============================================================================
// POST /api/company/interview-requests
// =============================================================================

describe('POST /api/company/interview-requests', () => {
  const headersEmpresa = { 'x-user-id': '42', 'x-user-role': 'company' };

  const manana = () => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
      d.getDate()
    ).padStart(2, '0')}`;
  };

  const cuerpoValido = () => ({
    applicationId: 15,
    type: 'videocall',
    duration: 45,
    availableSlots: [{ date: manana(), time: '10:00' }],
  });

  it('EMP-015: applicationId no numérico da 400, no 500', async () => {
    const { POST } = await import('@/app/api/company/interview-requests/route');
    const res = await POST(
      req({ ...cuerpoValido(), applicationId: 'abc' }, headersEmpresa) as never
    );

    expect(res.status).toBe(400);
    expect(mockPrisma.application.findUnique).not.toHaveBeenCalled();
  });

  it('EMP-015: rechaza horarios con formato inválido', async () => {
    const { POST } = await import('@/app/api/company/interview-requests/route');
    const res = await POST(
      req(
        { ...cuerpoValido(), availableSlots: [{ date: 'ayer', time: '99:99' }] },
        headersEmpresa
      ) as never
    );

    expect(res.status).toBe(400);
    expect(mockPrisma.interviewRequest.create).not.toHaveBeenCalled();
  });

  it('EMP-015: rechaza más de 10 participantes', async () => {
    const participants = Array.from({ length: 11 }, (_, i) => ({
      nombre: `P${i}`,
      email: `p${i}@acme.com`,
    }));

    const { POST } = await import('@/app/api/company/interview-requests/route');
    const res = await POST(req({ ...cuerpoValido(), participants }, headersEmpresa) as never);

    expect(res.status).toBe(400);
  });

  it('EMP-015: rechaza fechas pasadas', async () => {
    const { POST } = await import('@/app/api/company/interview-requests/route');
    const res = await POST(
      req(
        { ...cuerpoValido(), availableSlots: [{ date: '2020-01-01', time: '10:00' }] },
        headersEmpresa
      ) as never
    );

    expect(res.status).toBe(400);
  });

  it('EMP-005: 403 si el candidato aún no ha sido enviado a la empresa', async () => {
    mockPrisma.application.findUnique.mockResolvedValue({
      id: 15,
      status: 'pending',
      candidateName: 'Ana',
      candidateEmail: 'ana@mail.com',
      job: { id: 8, userId: 42, title: 'Dev' },
    });

    const { POST } = await import('@/app/api/company/interview-requests/route');
    const res = await POST(req(cuerpoValido(), headersEmpresa) as never);

    expect(res.status).toBe(403);
    expect(mockPrisma.interviewRequest.create).not.toHaveBeenCalled();
  });

  it('EMP-002: 403 si la empresa no está aprobada, antes de mirar la aplicación', async () => {
    mockRequireApprovedCompany.mockResolvedValue({
      error: 'en revisión',
      code: 'COMPANY_NOT_APPROVED',
      status: 403,
    });

    const { POST } = await import('@/app/api/company/interview-requests/route');
    const res = await POST(req(cuerpoValido(), headersEmpresa) as never);

    expect(res.status).toBe(403);
    expect(mockPrisma.application.findUnique).not.toHaveBeenCalled();
  });

  it('EMP-016: emite la notificación in-app interview_requested a los admins', async () => {
    mockPrisma.application.findUnique.mockResolvedValue({
      id: 15,
      status: 'sent_to_company',
      candidateName: 'Ana',
      candidateEmail: 'ana@mail.com',
      job: { id: 8, userId: 42, title: 'Dev' },
    });
    mockPrisma.interviewRequest.findFirst.mockResolvedValue(null);
    mockPrisma.interviewRequest.create.mockResolvedValue({ id: 77 });
    mockPrisma.user.findMany.mockResolvedValue([{ email: 'admin@inakat.com' }]);
    mockPrisma.companyRequest.findFirst.mockResolvedValue({ nombreEmpresa: 'Acme' });

    const { POST } = await import('@/app/api/company/interview-requests/route');
    const res = await POST(req(cuerpoValido(), headersEmpresa) as never);

    expect(res.status).toBe(201);
    expect(mockNotifyAllAdmins).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'interview_requested', link: '/admin/interviews' })
    );
  });

  it('EMP-015: comprueba el duplicado dentro de la transacción', async () => {
    mockPrisma.application.findUnique.mockResolvedValue({
      id: 15,
      status: 'sent_to_company',
      candidateName: 'Ana',
      candidateEmail: 'ana@mail.com',
      job: { id: 8, userId: 42, title: 'Dev' },
    });
    mockPrisma.interviewRequest.findFirst.mockResolvedValue({ id: 3 });

    const { POST } = await import('@/app/api/company/interview-requests/route');
    const res = await POST(req(cuerpoValido(), headersEmpresa) as never);

    expect(res.status).toBe(409);
    expect(mockPrisma.$transaction).toHaveBeenCalled();
    expect(mockPrisma.interviewRequest.create).not.toHaveBeenCalled();
  });
});

// =============================================================================
// PUT /api/company/profile
// =============================================================================

describe('PUT /api/company/profile', () => {
  const headersEmpresa = { 'x-user-id': '42', 'x-user-role': 'company' };

  beforeEach(() => {
    mockPrisma.user.findUnique.mockResolvedValue({
      id: 42,
      companyRequest: { id: 5 },
    });
  });

  it('EMP-028: un nombre numérico devuelve 400, no 500', async () => {
    const { PUT } = await import('@/app/api/company/profile/route');
    const res = await PUT(req({ nombre: 123 }, headersEmpresa));

    expect(res.status).toBe(400);
  });

  it('EMP-028: no deja vaciar el nombre del representante ni la dirección', async () => {
    const { PUT } = await import('@/app/api/company/profile/route');
    const res = await PUT(req({ nombre: '', direccionEmpresa: '' }, headersEmpresa));

    expect(res.status).toBe(400);
  });

  it('EMP-028: rechaza latitud fuera de rango', async () => {
    const { PUT } = await import('@/app/api/company/profile/route');
    const res = await PUT(req({ latitud: 500 }, headersEmpresa));

    expect(res.status).toBe(400);
  });

  it('EMP-001/EMP-028: rechaza un logoUrl que no sea http(s)', async () => {
    const { PUT } = await import('@/app/api/company/profile/route');
    const res = await PUT(req({ logoUrl: 'javascript:alert(1)' }, headersEmpresa));

    expect(res.status).toBe(400);
  });
});
