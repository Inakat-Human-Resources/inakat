/**
 * @jest-environment node
 */

// RUTA: __tests__/api/eval-dashboards-pipeline.test.ts
//
// Auditoría 2026-09 — Reclutador, especialista y evaluaciones (EVAL-*).
// Ejercita los HANDLERS REALES de /api/recruiter/dashboard y
// /api/specialist/dashboard con Prisma y requireRole mockeados.

jest.mock('next/server', () => ({
  NextResponse: {
    json: (data: unknown, options?: { status?: number }) => ({
      status: options?.status ?? 200,
      json: async () => data,
    }),
  },
  // Fuera de una petición real `after()` lanza: runAfterResponse cae entonces
  // a ejecutar la tarea en línea, que es lo que permite verificarla aquí.
  after: () => {
    throw new Error('after() fuera de una petición');
  },
}));

const mockPrisma = {
  application: { findUnique: jest.fn(), update: jest.fn(), create: jest.fn() },
  jobAssignment: {
    findFirst: jest.fn(),
    findMany: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn(),
  },
  candidate: { findMany: jest.fn() },
  notification: { create: jest.fn() },
  $transaction: jest.fn(),
};

// Getter: la fábrica corre al importar la ruta, antes de que `mockPrisma`
// quede inicializado; así se resuelve en el momento de usarlo.
jest.mock('@/lib/prisma', () => ({
  get prisma() {
    return mockPrisma;
  },
}));

const mockRequireRole = jest.fn();
jest.mock('@/lib/auth', () => ({
  requireRole: (...args: unknown[]) => mockRequireRole(...args),
}));

const mockCreateNotification = jest.fn();
jest.mock('@/lib/notifications', () => ({
  ...jest.requireActual('@/lib/notifications'),
  createNotification: (...args: unknown[]) => mockCreateNotification(...args),
}));

import * as recruiterRoute from '@/app/api/recruiter/dashboard/route';
import * as specialistRoute from '@/app/api/specialist/dashboard/route';

interface RouteResponse {
  status: number;
  json: () => Promise<{ success: boolean; error?: string; data?: any; message?: string }>;
}

function session(id: number, role: string) {
  return {
    user: {
      id,
      role,
      email: `u${id}@test.com`,
      nombre: 'Test',
      apellidoPaterno: null,
      apellidoMaterno: null,
      isActive: true,
      credits: 0,
      specialty: null,
    },
  };
}

function putReq(body: unknown): Request {
  return {
    url: 'http://localhost/api/x/dashboard',
    json: async () => body,
  } as unknown as Request;
}

function getReq(path: string): Request {
  return { url: `http://localhost${path}` } as unknown as Request;
}

async function call(
  handler: (req: Request) => Promise<unknown>,
  req: Request
): Promise<{ status: number; body: Awaited<ReturnType<RouteResponse['json']>> }> {
  const res = (await handler(req)) as RouteResponse;
  return { status: res.status, body: await res.json() };
}

beforeEach(() => {
  jest.clearAllMocks();
  // La transacción interactiva recibe el mismo cliente mockeado como `tx`.
  mockPrisma.$transaction.mockImplementation((fn: (tx: typeof mockPrisma) => unknown) =>
    fn(mockPrisma)
  );
  mockPrisma.application.update.mockImplementation(({ where, data }: any) => ({
    id: where.id,
    ...data,
  }));
  mockPrisma.jobAssignment.update.mockResolvedValue({});
  mockPrisma.jobAssignment.updateMany.mockResolvedValue({ count: 1 });
  mockPrisma.candidate.findMany.mockResolvedValue([]);
  mockCreateNotification.mockResolvedValue(undefined);
});

function appRow(status: string, jobUserId: number | null = 50) {
  return {
    id: 10,
    jobId: 7,
    status,
    job: { id: 7, title: 'Dev', userId: jobUserId },
  };
}

// =============================================================================
// Ramas legacy eliminadas (EVAL-001, EVAL-002)
// =============================================================================

describe.each([
  ['recruiter', recruiterRoute.PUT],
  ['specialist', specialistRoute.PUT],
])('PUT /api/%s/dashboard — ramas legacy (EVAL-001/002)', (role, PUT) => {
  beforeEach(() => mockRequireRole.mockResolvedValue(session(3, role)));

  it('EVAL-001: discardApplicationId ya no descarta sin validar el estado', async () => {
    const { status } = await call(PUT, putReq({ discardApplicationId: 10, reason: 'x' }));

    expect(status).toBe(400);
    expect(mockPrisma.application.findUnique).not.toHaveBeenCalled();
    expect(mockPrisma.application.update).not.toHaveBeenCalled();
  });

  it('EVAL-002: candidateIds no crea postulaciones del banco ni reescribe estados', async () => {
    const { status } = await call(
      PUT,
      putReq({ assignmentId: 1, candidateIds: [1, 2, 3], status: 'sent_to_specialist' })
    );

    expect(status).toBe(400);
    expect(mockPrisma.application.create).not.toHaveBeenCalled();
    expect(mockPrisma.application.update).not.toHaveBeenCalled();
    expect(mockPrisma.jobAssignment.update).not.toHaveBeenCalled();
  });

  it('EVAL-017: un id no numérico responde 400 sin llegar a Prisma', async () => {
    const { status } = await call(
      PUT,
      putReq({ updateApplicationId: 'abc', newApplicationStatus: 'discarded' })
    );

    expect(status).toBe(400);
    expect(mockPrisma.application.findUnique).not.toHaveBeenCalled();
  });

  it('EVAL-002: un status fuera de la tabla responde 400', async () => {
    const { status } = await call(
      PUT,
      putReq({ updateApplicationId: 10, newApplicationStatus: 'accepted' })
    );

    expect(status).toBe(400);
    expect(mockPrisma.application.update).not.toHaveBeenCalled();
  });

  it('EVAL-001: no se puede descartar una postulación ya aceptada por la empresa', async () => {
    mockPrisma.application.findUnique.mockResolvedValue(appRow('accepted'));
    mockPrisma.jobAssignment.findFirst.mockResolvedValue({ id: 1, specialistId: 4 });

    const { status } = await call(
      PUT,
      putReq({ updateApplicationId: 10, newApplicationStatus: 'discarded' })
    );

    expect(status).toBe(400);
    expect(mockPrisma.application.update).not.toHaveBeenCalled();
  });
});

// =============================================================================
// PUT del reclutador
// =============================================================================

describe('PUT /api/recruiter/dashboard — flujo validado', () => {
  it('EVAL-009: pending → reviewing marca la asignación como "reviewing" (sólo si seguía en pending)', async () => {
    mockRequireRole.mockResolvedValue(session(3, 'recruiter'));
    mockPrisma.application.findUnique.mockResolvedValue(appRow('pending'));
    mockPrisma.jobAssignment.findFirst.mockResolvedValue({ id: 1, specialistId: 4 });

    const { status } = await call(
      recruiterRoute.PUT,
      putReq({ updateApplicationId: 10, newApplicationStatus: 'reviewing' })
    );

    expect(status).toBe(200);
    expect(mockPrisma.$transaction).toHaveBeenCalledTimes(1);
    expect(mockPrisma.jobAssignment.updateMany).toHaveBeenCalledWith({
      where: { id: 1, recruiterStatus: 'pending' },
      data: { recruiterStatus: 'reviewing' },
    });
  });

  it('EVAL-009: enviar al especialista no reinicia specialistStatus si ya avanzó', async () => {
    mockRequireRole.mockResolvedValue(session(3, 'recruiter'));
    mockPrisma.application.findUnique.mockResolvedValue(appRow('reviewing'));
    mockPrisma.jobAssignment.findFirst.mockResolvedValue({ id: 1, specialistId: 4 });

    const { status } = await call(
      recruiterRoute.PUT,
      putReq({ updateApplicationId: 10, newApplicationStatus: 'sent_to_specialist' })
    );

    expect(status).toBe(200);
    // Ninguna escritura incondicional de specialistStatus: 'pending'.
    for (const [args] of mockPrisma.jobAssignment.update.mock.calls) {
      expect(args.data).not.toHaveProperty('specialistStatus');
    }
    expect(mockPrisma.jobAssignment.updateMany).toHaveBeenCalledWith({
      where: { id: 1, specialistStatus: { notIn: ['evaluating', 'sent_to_company'] } },
      data: { specialistStatus: 'pending' },
    });
  });

  it('EVAL-024: el admin encuentra la asignación por jobId y puede enviar al especialista', async () => {
    mockRequireRole.mockResolvedValue(session(1, 'admin'));
    mockPrisma.application.findUnique.mockResolvedValue(appRow('reviewing'));
    mockPrisma.jobAssignment.findFirst.mockResolvedValue({ id: 1, specialistId: 4 });

    const { status } = await call(
      recruiterRoute.PUT,
      putReq({ updateApplicationId: 10, newApplicationStatus: 'sent_to_specialist' })
    );

    expect(status).toBe(200);
    expect(mockPrisma.jobAssignment.findFirst).toHaveBeenCalledWith({ where: { jobId: 7 } });
  });

  it('EVAL-025: si la notificación falla se registra el error y la respuesta sigue siendo 200', async () => {
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    mockRequireRole.mockResolvedValue(session(3, 'recruiter'));
    mockPrisma.application.findUnique.mockResolvedValue(appRow('reviewing'));
    mockPrisma.jobAssignment.findFirst.mockResolvedValue({ id: 1, specialistId: 4 });
    mockCreateNotification.mockRejectedValue(new Error('DB caída'));

    const { status } = await call(
      recruiterRoute.PUT,
      putReq({ updateApplicationId: 10, newApplicationStatus: 'sent_to_specialist' })
    );

    expect(status).toBe(200);
    expect(mockCreateNotification).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 4, type: 'sent_to_specialist' })
    );
    expect(consoleSpy).toHaveBeenCalled();
    consoleSpy.mockRestore();
  });
});

// =============================================================================
// PUT del especialista
// =============================================================================

describe('PUT /api/specialist/dashboard — flujo validado', () => {
  beforeEach(() => mockRequireRole.mockResolvedValue(session(4, 'specialist')));

  it('EVAL-016: discarded → sent_to_company sigue prohibido (400)', async () => {
    mockPrisma.application.findUnique.mockResolvedValue(appRow('discarded'));
    mockPrisma.jobAssignment.findFirst.mockResolvedValue({ id: 1, specialistId: 4 });

    const { status } = await call(
      specialistRoute.PUT,
      putReq({ updateApplicationId: 10, newApplicationStatus: 'sent_to_company' })
    );

    expect(status).toBe(400);
    expect(mockPrisma.application.update).not.toHaveBeenCalled();
  });

  it('EVAL-009: → evaluating marca specialistStatus "evaluating" (sólo desde pending)', async () => {
    mockPrisma.application.findUnique.mockResolvedValue(appRow('sent_to_specialist'));
    mockPrisma.jobAssignment.findFirst.mockResolvedValue({ id: 1, specialistId: 4 });

    const { status } = await call(
      specialistRoute.PUT,
      putReq({ updateApplicationId: 10, newApplicationStatus: 'evaluating' })
    );

    expect(status).toBe(200);
    expect(mockPrisma.jobAssignment.updateMany).toHaveBeenCalledWith({
      where: { id: 1, specialistStatus: 'pending' },
      data: { specialistStatus: 'evaluating' },
    });
  });

  it('EVAL-009: → sent_to_company marca specialistStatus y notifica a la empresa', async () => {
    mockPrisma.application.findUnique.mockResolvedValue(appRow('evaluating', 50));
    mockPrisma.jobAssignment.findFirst.mockResolvedValue({ id: 1, specialistId: 4 });

    const { status } = await call(
      specialistRoute.PUT,
      putReq({ updateApplicationId: 10, newApplicationStatus: 'sent_to_company' })
    );

    expect(status).toBe(200);
    const [args] = mockPrisma.jobAssignment.update.mock.calls[0];
    expect(args.where).toEqual({ id: 1 });
    expect(args.data.specialistStatus).toBe('sent_to_company');
    expect(args.data.followUpDate).toBeInstanceOf(Date);
    expect(mockCreateNotification).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 50, type: 'sent_to_company' })
    );
  });

  it('EVAL-024: el admin encuentra la asignación por jobId (no por su propio id)', async () => {
    mockRequireRole.mockResolvedValue(session(1, 'admin'));
    mockPrisma.application.findUnique.mockResolvedValue(appRow('evaluating', 50));
    mockPrisma.jobAssignment.findFirst.mockResolvedValue({ id: 1, specialistId: 4 });

    const { status } = await call(
      specialistRoute.PUT,
      putReq({ updateApplicationId: 10, newApplicationStatus: 'sent_to_company' })
    );

    expect(status).toBe(200);
    expect(mockPrisma.jobAssignment.findFirst).toHaveBeenCalledWith({ where: { jobId: 7 } });
    // Con la asignación encontrada ya no se salta followUpDate/specialistStatus.
    expect(mockPrisma.jobAssignment.update).toHaveBeenCalled();
  });
});

// =============================================================================
// GET del reclutador
// =============================================================================

function assignmentRow(statuses: string[]) {
  return {
    id: 1,
    jobId: 7,
    recruiterId: 3,
    specialistId: 4,
    recruiterNotes: null,
    specialist: null,
    recruiter: null,
    job: {
      id: 7,
      title: 'Dev',
      company: 'ACME',
      latitude: null,
      longitude: null,
      user: { nombre: 'Empresa', companyRequest: { nombreEmpresa: 'ACME SA', correoEmpresa: 'a@a.com', logoUrl: null } },
      applications: statuses.map((status, i) => ({
        id: 100 + i,
        candidateName: `Cand ${i}`,
        candidateEmail: `c${i}@test.com`,
        candidatePhone: '555',
        cvUrl: 'https://x.public.blob.vercel-storage.com/cv.pdf',
        coverLetter: 'Hola',
        status,
        createdAt: new Date('2026-09-01'),
        updatedAt: new Date('2026-09-02'),
        notes: null,
      })),
    },
  };
}

describe('GET /api/recruiter/dashboard', () => {
  beforeEach(() => mockRequireRole.mockResolvedValue(session(3, 'recruiter')));

  it('EVAL-008: company_interested e interviewed siguen en "Enviados" con su estado real', async () => {
    mockPrisma.jobAssignment.findMany.mockResolvedValue([
      assignmentRow(['company_interested', 'interviewed', 'pending']),
    ]);

    const { status, body } = await call(recruiterRoute.GET, getReq('/api/recruiter/dashboard'));

    expect(status).toBe(200);
    const sent = body.data.sentApplications;
    expect(sent.map((a: any) => a.status).sort()).toEqual(['company_interested', 'interviewed']);
    expect(body.data.stats.companyInterested).toBe(1);
    expect(body.data.stats.interviewed).toBe(1);
    expect(body.data.stats.totalSent).toBe(2);
  });

  it('EVAL-022: "Enviados" lleva CV, teléfono, carta y fecha de la postulación', async () => {
    mockPrisma.jobAssignment.findMany.mockResolvedValue([assignmentRow(['sent_to_company'])]);

    const { body } = await call(recruiterRoute.GET, getReq('/api/recruiter/dashboard'));

    const [row] = body.data.sentApplications;
    expect(row.cvUrl).toContain('cv.pdf');
    expect(row.candidatePhone).toBe('555');
    expect(row.coverLetter).toBe('Hola');
    expect(row.createdAt).toBeDefined();
  });

  it('EVAL-022: el GET pide logoUrl de la empresa y subcategory/cartaPresentacion del candidato', async () => {
    mockPrisma.jobAssignment.findMany.mockResolvedValue([assignmentRow(['pending'])]);

    await call(recruiterRoute.GET, getReq('/api/recruiter/dashboard'));

    const args = mockPrisma.jobAssignment.findMany.mock.calls[0][0];
    expect(args.include.job.include.user.select.companyRequest.select.logoUrl).toBe(true);
    const candArgs = mockPrisma.candidate.findMany.mock.calls[0][0];
    expect(candArgs.select.subcategory).toBe(true);
    expect(candArgs.select.cartaPresentacion).toBe(true);
  });

  it('EVAL-012: ?jobId= filtra la consulta a una sola vacante', async () => {
    mockPrisma.jobAssignment.findMany.mockResolvedValue([]);

    await call(recruiterRoute.GET, getReq('/api/recruiter/dashboard?jobId=7'));

    const args = mockPrisma.jobAssignment.findMany.mock.calls[0][0];
    expect(args.where).toEqual({ recruiterId: 3, jobId: 7 });
  });

  it('EVAL-012: ?jobId= no numérico responde 400', async () => {
    const { status } = await call(recruiterRoute.GET, getReq('/api/recruiter/dashboard?jobId=abc'));

    expect(status).toBe(400);
    expect(mockPrisma.jobAssignment.findMany).not.toHaveBeenCalled();
  });

  it('EVAL-023: las postulaciones se piden con select explícito', async () => {
    mockPrisma.jobAssignment.findMany.mockResolvedValue([]);

    await call(recruiterRoute.GET, getReq('/api/recruiter/dashboard'));

    const args = mockPrisma.jobAssignment.findMany.mock.calls[0][0];
    expect(args.include.job.include.applications.select).toBeDefined();
  });
});

// =============================================================================
// GET del especialista
// =============================================================================

describe('GET /api/specialist/dashboard', () => {
  beforeEach(() => mockRequireRole.mockResolvedValue(session(4, 'specialist')));

  it('EVAL-010: trae también los estados que escribe la empresa', async () => {
    mockPrisma.jobAssignment.findMany.mockResolvedValue([]);

    await call(specialistRoute.GET, getReq('/api/specialist/dashboard'));

    const args = mockPrisma.jobAssignment.findMany.mock.calls[0][0];
    const statuses: string[] = args.include.job.include.applications.where.status.in;
    for (const s of ['company_interested', 'interviewed', 'accepted', 'rejected']) {
      expect(statuses).toContain(s);
    }
  });

  it('EVAL-010: las postulaciones que la empresa movió siguen contando como enviadas', async () => {
    mockPrisma.jobAssignment.findMany.mockResolvedValue([
      assignmentRow(['sent_to_company', 'company_interested', 'rejected', 'evaluating']),
    ]);

    const { body } = await call(specialistRoute.GET, getReq('/api/specialist/dashboard'));

    expect(body.data.stats.sentToCompany).toBe(3);
    expect(body.data.stats.evaluating).toBe(1);
  });

  it('EVAL-023: no duplica job.applications sin enriquecer junto a applications', async () => {
    mockPrisma.jobAssignment.findMany.mockResolvedValue([assignmentRow(['evaluating'])]);

    const { body } = await call(specialistRoute.GET, getReq('/api/specialist/dashboard'));

    const [assignment] = body.data.assignments;
    expect(assignment.applications).toHaveLength(1);
    expect(assignment.job.applications).toBeUndefined();
    expect(assignment.job.title).toBe('Dev');
  });

  it('EVAL-012: ?jobId= filtra la consulta a una sola vacante', async () => {
    mockPrisma.jobAssignment.findMany.mockResolvedValue([]);

    await call(specialistRoute.GET, getReq('/api/specialist/dashboard?jobId=7'));

    const args = mockPrisma.jobAssignment.findMany.mock.calls[0][0];
    expect(args.where.jobId).toBe(7);
    expect(args.where.specialistId).toBe(4);
  });
});
