// RUTA: __tests__/api/adm-continuacion-api.test.ts

/**
 * Auditoría 2026-09 · módulo admin (API) — segunda pasada.
 *
 * ADM-050: admin/users y admin/candidates usan la constante compartida
 *          PASSWORD_MIN_LENGTH (antes cada ruta tenía su número a mano).
 * ADM-024: /api/admin/users aceptaba cualquier texto como especialidad.
 * ADM-080: borrar un candidato dejaba sus archivos públicos en el store de blobs.
 * ADM-011: Asignar Candidatos bajaba GET /api/applications entero para contar;
 *          ahora el conteo viene en GET /api/admin/candidates.
 * ADM-082: notas internas: mismo tratamiento en POST que en PUT.
 * ADM-041/042: confirmar, reprogramar o cancelar una entrevista no avisaba a la
 *          empresa.
 * ADM-038: reactivar un paquete no comprobaba duplicados de créditos activos.
 * ADM-074: se podía asignar equipo a una vacante en borrador.
 * ADM-015: el GET de asignaciones no decía si el reclutador asignado seguía activo.
 * ADM-092/093: la tabla de precios por defecto estaba duplicada y desalineada.
 */

jest.mock('next/server', () => ({
  NextRequest: class {},
  NextResponse: {
    json: (data: any, options?: any) => ({
      status: options?.status || 200,
      json: async () => data,
    }),
  },
}));

const tx = {
  user: { update: jest.fn(), findUnique: jest.fn() },
  candidate: { delete: jest.fn() },
  application: { updateMany: jest.fn() },
  interviewRequest: { update: jest.fn() },
};

jest.mock('@/lib/prisma', () => ({
  prisma: {
    user: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    specialty: { findFirst: jest.fn(), findMany: jest.fn(), findUnique: jest.fn() },
    jobAssignment: { count: jest.fn(), findUnique: jest.fn(), upsert: jest.fn() },
    candidate: { findUnique: jest.fn(), findMany: jest.fn(), count: jest.fn() },
    application: { findMany: jest.fn(), groupBy: jest.fn() },
    interviewRequest: { findUnique: jest.fn() },
    creditPackage: { findUnique: jest.fn(), findFirst: jest.fn(), update: jest.fn() },
    job: { findUnique: jest.fn(), findMany: jest.fn() },
    pricingMatrix: { findMany: jest.fn(), createMany: jest.fn() },
    $transaction: jest.fn(),
  },
}));

jest.mock('@/lib/auth', () => ({
  requireRole: jest.fn(),
  requireAuth: jest.fn(),
}));

jest.mock('@/lib/notifications', () => ({
  createNotification: jest.fn(),
  // Igual que la real fuera de un request: ejecuta en línea y nunca propaga.
  runAfterResponse: jest.fn(async (_etiqueta: string, fn: () => Promise<unknown>) => {
    try {
      await fn();
    } catch {
      /* se registra en la real */
    }
  }),
}));

jest.mock('@vercel/blob', () => ({ del: jest.fn() }));
// ADM-041/042: el PATCH de entrevistas manda correos; nunca SMTP real en tests.
jest.mock('@/lib/email', () => ({
  sendInterviewUpdate: jest.fn().mockResolvedValue(true),
}));


jest.mock('bcryptjs', () => ({
  __esModule: true,
  default: { hash: jest.fn(async () => 'hash-falso') },
  hash: jest.fn(async () => 'hash-falso'),
}));

import { requireRole } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { createNotification } from '@/lib/notifications';
import { del } from '@vercel/blob';
import { PASSWORD_MIN_LENGTH } from '@/lib/validations';
import { POST as usersPost, PUT as usersPut } from '@/app/api/admin/users/route';
import {
  GET as candidatesGet,
  POST as candidatesPost,
} from '@/app/api/admin/candidates/route';
import { DELETE as candidateDelete } from '@/app/api/admin/candidates/[id]/route';
import { PATCH as interviewPatch } from '@/app/api/admin/interviews/[id]/route';
import { PUT as packagePut } from '@/app/api/admin/credit-packages/[id]/route';
import {
  GET as assignmentsGet,
  POST as assignmentsPost,
} from '@/app/api/admin/assignments/route';
import { PUT as specialtyPut } from '@/app/api/admin/specialties/[id]/route';
import { GET as syncGet } from '@/app/api/admin/pricing/sync/route';
import {
  COMBINACIONES_ESPERADAS,
  generarPreciosPorDefecto,
} from '@/app/api/admin/pricing/precios-por-defecto';

const mockRequireRole = requireRole as jest.Mock;
const db = prisma as any;
const mockTransaction = db.$transaction as jest.Mock;
const mockCreateNotification = createNotification as jest.Mock;
const mockDel = del as jest.Mock;

const ADMIN = { user: { id: 1, email: 'admin@inakat.com', role: 'admin' } };

function pedir(url: string, method = 'GET', body?: any) {
  return new Request(url, {
    method,
    body: body ? JSON.stringify(body) : undefined,
  });
}

/** NextRequest simulado para la ruta de entrevistas (sólo usa json()). */
function pedirNext(body: any): any {
  return { json: async () => body, headers: new Headers() };
}

const params = (id: string) => ({ params: Promise.resolve({ id }) });

const TOKEN_ORIGINAL = process.env.BLOB_READ_WRITE_TOKEN;

beforeEach(() => {
  jest.resetAllMocks();
  mockRequireRole.mockResolvedValue(ADMIN);
  mockTransaction.mockImplementation(async (cb: any) => cb(tx));
  const { runAfterResponse } = jest.requireMock('@/lib/notifications');
  runAfterResponse.mockImplementation(async (_e: string, fn: () => Promise<unknown>) => {
    try {
      await fn();
    } catch {
      /* igual que la real */
    }
  });
  process.env.BLOB_READ_WRITE_TOKEN = 'token-de-prueba';
});

afterAll(() => {
  process.env.BLOB_READ_WRITE_TOKEN = TOKEN_ORIGINAL;
});

describe('ADM-050 · mínimo de contraseña compartido', () => {
  it('la constante compartida vale 8, el mismo mínimo que aplican estas rutas', () => {
    expect(PASSWORD_MIN_LENGTH).toBe(8);
  });

  it('POST de staff rechaza PASSWORD_MIN_LENGTH - 1 caracteres', async () => {
    db.user.findUnique.mockResolvedValue(null);
    const res = await usersPost(
      pedir('http://localhost/api/admin/users', 'POST', {
        email: 'nuevo@inakat.com',
        password: 'a'.repeat(PASSWORD_MIN_LENGTH - 1),
        nombre: 'Nuevo',
        role: 'recruiter',
      })
    );
    expect(res.status).toBe(400);
    expect(db.user.create).not.toHaveBeenCalled();
  });

  it('POST de candidato con cuenta rechaza PASSWORD_MIN_LENGTH - 1 caracteres', async () => {
    db.candidate.findUnique.mockResolvedValue(null);
    const res = await candidatesPost(
      pedir('http://localhost/api/admin/candidates', 'POST', {
        nombre: 'Ana',
        apellidoPaterno: 'López',
        email: 'ana@test.com',
        password: 'a'.repeat(PASSWORD_MIN_LENGTH - 1),
      })
    );
    expect(res.status).toBe(400);
    expect(mockTransaction).not.toHaveBeenCalled();
  });
});

describe('ADM-024 · la especialidad del especialista sale del catálogo', () => {
  it('POST rechaza una especialidad que no existe o está desactivada', async () => {
    db.user.findUnique.mockResolvedValue(null);
    db.specialty.findFirst.mockResolvedValue(null);

    const res = await usersPost(
      pedir('http://localhost/api/admin/users', 'POST', {
        email: 'esp@inakat.com',
        password: 'Segura123',
        nombre: 'Esp',
        role: 'specialist',
        specialty: 'Inventada',
      })
    );

    expect(res.status).toBe(400);
    expect(db.specialty.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { name: 'Inventada', isActive: true } })
    );
    expect(db.user.create).not.toHaveBeenCalled();
  });

  it('POST acepta una especialidad activa del catálogo', async () => {
    db.user.findUnique.mockResolvedValue(null);
    db.specialty.findFirst.mockResolvedValue({ id: 3 });
    db.user.create.mockResolvedValue({ id: 9, role: 'specialist' });

    const res = await usersPost(
      pedir('http://localhost/api/admin/users', 'POST', {
        email: 'esp@inakat.com',
        password: 'Segura123',
        nombre: 'Esp',
        role: 'specialist',
        specialty: 'Tecnología',
      })
    );

    expect(res.status).toBe(201);
  });

  it('PUT sin cambiar la especialidad no la vuelve a contrastar', async () => {
    db.user.findUnique.mockResolvedValue({
      id: 5,
      email: 'esp@inakat.com',
      role: 'specialist',
      specialty: 'Especialidad antigua',
      isActive: true,
    });
    db.user.update.mockResolvedValue({ id: 5 });

    const res = await usersPut(
      pedir('http://localhost/api/admin/users', 'PUT', { id: 5, nombre: 'Nuevo nombre' })
    );

    expect(res.status).toBe(200);
    expect(db.specialty.findFirst).not.toHaveBeenCalled();
  });

  it('PUT que cambia a una especialidad inexistente responde 400', async () => {
    db.user.findUnique.mockResolvedValue({
      id: 5,
      email: 'esp@inakat.com',
      role: 'specialist',
      specialty: 'Tecnología',
      isActive: true,
    });
    db.specialty.findFirst.mockResolvedValue(null);

    const res = await usersPut(
      pedir('http://localhost/api/admin/users', 'PUT', { id: 5, specialty: 'Inventada' })
    );

    expect(res.status).toBe(400);
    expect(db.user.update).not.toHaveBeenCalled();
  });
});

describe('ADM-080 · borrar un candidato borra sus archivos del store', () => {
  const BLOB = 'https://abc.public.blob.vercel-storage.com';

  it('borra documentos, CV y foto propios, respetando el CV que usa una postulación', async () => {
    db.candidate.findUnique.mockResolvedValue({
      id: 7,
      email: 'ana@test.com',
      userId: null,
      cvUrl: `${BLOB}/cv.pdf`,
      fotoUrl: `${BLOB}/foto.jpg`,
      documents: [{ fileUrl: `${BLOB}/ine.pdf` }, { fileUrl: 'https://drive.google.com/x' }],
    });
    db.application.findMany.mockResolvedValue([{ cvUrl: `${BLOB}/cv.pdf` }]);

    const res = await candidateDelete(
      pedir('http://localhost/api/admin/candidates/7', 'DELETE'),
      params('7')
    );

    expect(res.status).toBe(200);
    expect(tx.candidate.delete).toHaveBeenCalledWith({ where: { id: 7 } });
    expect(mockDel).toHaveBeenCalledTimes(1);
    const borradas = mockDel.mock.calls[0][0] as string[];
    expect(borradas).toEqual(expect.arrayContaining([`${BLOB}/ine.pdf`, `${BLOB}/foto.jpg`]));
    expect(borradas).not.toContain(`${BLOB}/cv.pdf`);
    expect(borradas).not.toContain('https://drive.google.com/x');
  });

  it('un fallo al borrar el blob no convierte el borrado en error', async () => {
    db.candidate.findUnique.mockResolvedValue({
      id: 7,
      email: 'ana@test.com',
      userId: null,
      cvUrl: null,
      fotoUrl: `${BLOB}/foto.jpg`,
      documents: [],
    });
    db.application.findMany.mockResolvedValue([]);
    mockDel.mockRejectedValue(new Error('store caído'));
    const consola = jest.spyOn(console, 'error').mockImplementation(() => {});

    const res = await candidateDelete(
      pedir('http://localhost/api/admin/candidates/7', 'DELETE'),
      params('7')
    );

    expect(res.status).toBe(200);
    consola.mockRestore();
  });

  it('sin archivos propios no consulta postulaciones ni llama al store', async () => {
    db.candidate.findUnique.mockResolvedValue({
      id: 7,
      email: 'ana@test.com',
      userId: null,
      cvUrl: 'https://linkedin.com/in/ana',
      fotoUrl: null,
      documents: [],
    });

    await candidateDelete(pedir('http://localhost/api/admin/candidates/7', 'DELETE'), params('7'));

    expect(db.application.findMany).not.toHaveBeenCalled();
    expect(mockDel).not.toHaveBeenCalled();
  });
});

describe('ADM-011 · conteo de postulaciones vivas en el listado de candidatos', () => {
  it('cuenta con groupBy sólo los emails de la página, sin procesos cerrados', async () => {
    db.candidate.findMany.mockResolvedValue([
      { id: 1, email: 'ana@test.com', fechaNacimiento: null },
      { id: 2, email: 'luis@test.com', fechaNacimiento: null },
    ]);
    db.candidate.count.mockResolvedValue(2);
    db.application.groupBy.mockResolvedValue([
      { candidateEmail: 'ana@test.com', _count: { _all: 2 } },
      { candidateEmail: 'Ana@Test.com', _count: { _all: 1 } },
    ]);

    const res = await candidatesGet(pedir('http://localhost/api/admin/candidates'));
    const cuerpo = await res.json();

    const args = db.application.groupBy.mock.calls[0][0];
    expect(args.by).toEqual(['candidateEmail']);
    expect(args.where.candidateEmail.in).toEqual(['ana@test.com', 'luis@test.com']);
    expect(args.where.status.notIn).toEqual(expect.arrayContaining(['rejected', 'discarded', 'archived']));
    expect(args.where.job).toEqual({ status: { not: 'closed' } });

    const porEmail = Object.fromEntries(
      cuerpo.data.map((c: any) => [c.email, c.activeApplications])
    );
    expect(porEmail).toEqual({ 'ana@test.com': 3, 'luis@test.com': 0 });
  });
});

describe('ADM-082 · notas internas en el alta', () => {
  it('POST rechaza notas que no son texto (antes llegaban a Prisma y daban 500)', async () => {
    const res = await candidatesPost(
      pedir('http://localhost/api/admin/candidates', 'POST', {
        nombre: 'Ana',
        apellidoPaterno: 'López',
        email: 'ana@test.com',
        notas: { html: '<b>x</b>' },
      })
    );
    expect(res.status).toBe(400);
    expect(db.candidate.findUnique).not.toHaveBeenCalled();
  });
});

describe('ADM-041 / ADM-042 · la empresa se entera de su entrevista', () => {
  const EN_UNA_HORA = new Date(Date.now() + 60 * 60 * 1000);
  const EN_DOS_HORAS = new Date(Date.now() + 2 * 60 * 60 * 1000);

  const entrevistaGuardada = (extra: Record<string, unknown> = {}) => ({
    id: 3,
    status: 'confirmed',
    scheduledStart: EN_UNA_HORA,
    scheduledEnd: EN_DOS_HORAS,
    application: { candidateName: 'Ana López', job: { title: 'Backend Sr' } },
    ...extra,
  });

  it('confirmar avisa a quien pidió la entrevista', async () => {
    db.interviewRequest.findUnique.mockResolvedValue({
      id: 3,
      applicationId: 20,
      requestedById: 44,
      status: 'pending',
      scheduledStart: null,
      scheduledEnd: null,
    });
    tx.interviewRequest.update.mockResolvedValue(entrevistaGuardada());

    const res = await interviewPatch(
      pedirNext({
        status: 'confirmed',
        scheduledStart: EN_UNA_HORA.toISOString(),
        scheduledEnd: EN_DOS_HORAS.toISOString(),
      }),
      params('3')
    );

    expect(res.status).toBe(200);
    expect(mockCreateNotification).toHaveBeenCalledTimes(1);
    const aviso = mockCreateNotification.mock.calls[0][0];
    expect(aviso.userId).toBe(44);
    expect(aviso.title).toBe('Entrevista confirmada');
    expect(aviso.message).toContain('Ana López');
    expect(aviso.link).toBe('/company/interviews');
  });

  it('cancelar una pendiente también avisa', async () => {
    db.interviewRequest.findUnique.mockResolvedValue({
      id: 3,
      applicationId: 20,
      requestedById: 44,
      status: 'pending',
      scheduledStart: null,
      scheduledEnd: null,
    });
    tx.interviewRequest.update.mockResolvedValue(
      entrevistaGuardada({ status: 'cancelled', scheduledStart: null })
    );

    await interviewPatch(pedirNext({ status: 'cancelled' }), params('3'));

    expect(mockCreateNotification).toHaveBeenCalledTimes(1);
    expect(mockCreateNotification.mock.calls[0][0].title).toBe('Entrevista cancelada');
  });

  it('reprogramar una confirmada avisa del cambio de horario', async () => {
    const antes = new Date(Date.now() + 24 * 60 * 60 * 1000);
    db.interviewRequest.findUnique.mockResolvedValue({
      id: 3,
      applicationId: 20,
      requestedById: 44,
      status: 'confirmed',
      scheduledStart: antes,
      scheduledEnd: new Date(antes.getTime() + 60 * 60 * 1000),
    });
    tx.interviewRequest.update.mockResolvedValue(entrevistaGuardada());

    await interviewPatch(
      pedirNext({
        scheduledStart: EN_UNA_HORA.toISOString(),
        scheduledEnd: EN_DOS_HORAS.toISOString(),
      }),
      params('3')
    );

    expect(mockCreateNotification.mock.calls[0][0].title).toBe('Entrevista reprogramada');
  });

  it('editar sólo las notas internas no genera aviso', async () => {
    db.interviewRequest.findUnique.mockResolvedValue({
      id: 3,
      applicationId: 20,
      requestedById: 44,
      status: 'confirmed',
      scheduledStart: EN_UNA_HORA,
      scheduledEnd: EN_DOS_HORAS,
    });
    tx.interviewRequest.update.mockResolvedValue(entrevistaGuardada());

    await interviewPatch(pedirNext({ adminNotes: 'Llamar antes' }), params('3'));

    expect(mockCreateNotification).not.toHaveBeenCalled();
  });

  it('si el aviso falla, el cambio guardado sigue respondiendo éxito', async () => {
    db.interviewRequest.findUnique.mockResolvedValue({
      id: 3,
      applicationId: 20,
      requestedById: 44,
      status: 'pending',
      scheduledStart: null,
      scheduledEnd: null,
    });
    tx.interviewRequest.update.mockResolvedValue(
      entrevistaGuardada({ status: 'cancelled', scheduledStart: null })
    );
    mockCreateNotification.mockRejectedValue(new Error('BD de notificaciones caída'));

    const res = await interviewPatch(pedirNext({ status: 'cancelled' }), params('3'));
    const cuerpo = await res.json();

    expect(res.status).toBe(200);
    expect(cuerpo.success).toBe(true);
  });
});

describe('ADM-038 · reactivar un paquete comprueba duplicados', () => {
  it('reactivar un paquete de 10 créditos con otro activo de 10 responde 409', async () => {
    db.creditPackage.findUnique.mockResolvedValue({
      id: 4,
      name: 'Pack 10 viejo',
      credits: 10,
      price: 35000,
      isActive: false,
    });
    db.creditPackage.findFirst.mockResolvedValue({ id: 2, name: 'Pack 10' });

    const res = await packagePut(
      pedir('http://localhost/api/admin/credit-packages/4', 'PUT', { isActive: true }),
      params('4')
    );

    expect(res.status).toBe(409);
    expect(db.creditPackage.findFirst).toHaveBeenCalledWith({
      where: { credits: 10, isActive: true, id: { not: 4 } },
    });
    expect(db.creditPackage.update).not.toHaveBeenCalled();
  });

  it('editar sólo el nombre de un paquete activo no consulta duplicados', async () => {
    db.creditPackage.findUnique.mockResolvedValue({
      id: 4,
      name: 'Pack 10',
      credits: 10,
      price: 35000,
      isActive: true,
    });
    db.creditPackage.update.mockResolvedValue({ id: 4 });

    const res = await packagePut(
      pedir('http://localhost/api/admin/credit-packages/4', 'PUT', { name: 'Pack Diez' }),
      params('4')
    );

    expect(res.status).toBe(200);
    expect(db.creditPackage.findFirst).not.toHaveBeenCalled();
  });
});

describe('ADM-074 / ADM-015 · asignación de equipo', () => {
  it('rechaza con 409 asignar equipo a una vacante en borrador', async () => {
    db.job.findUnique.mockResolvedValue({ id: 12, status: 'draft', title: 'X' });

    const res = await assignmentsPost(
      pedir('http://localhost/api/admin/assignments', 'POST', { jobId: 12, recruiterId: 3 })
    );

    expect(res.status).toBe(409);
    expect(db.jobAssignment.upsert).not.toHaveBeenCalled();
  });

  it('el GET incluye isActive del reclutador y del especialista asignados', async () => {
    db.job.findMany.mockResolvedValue([]);
    db.user.findMany.mockResolvedValue([]);

    await assignmentsGet(pedir('http://localhost/api/admin/assignments'));

    const include = db.job.findMany.mock.calls[0][0].include.assignment.include;
    expect(include.recruiter.select.isActive).toBe(true);
    expect(include.specialist.select.isActive).toBe(true);
  });
});

describe('Especialidades · PUT con las mismas reglas de tipo que el POST', () => {
  beforeEach(() => {
    db.specialty.findUnique.mockResolvedValue({
      id: 2,
      name: 'Arte',
      slug: 'arte',
      color: '#2b5d62',
    });
  });

  it('rechaza un color que no es hexadecimal', async () => {
    const res = await specialtyPut(
      pedir('http://localhost/api/admin/specialties/2', 'PUT', { color: 'red; x' }),
      params('2')
    );
    expect(res.status).toBe(400);
    expect(mockTransaction).not.toHaveBeenCalled();
  });

  it('rechaza subcategories con elementos no textuales', async () => {
    const res = await specialtyPut(
      pedir('http://localhost/api/admin/specialties/2', 'PUT', { subcategories: ['UX', 3] }),
      params('2')
    );
    expect(res.status).toBe(400);
    expect(mockTransaction).not.toHaveBeenCalled();
  });
});

describe('ADM-092 / ADM-093 · una sola tabla de precios por defecto', () => {
  it('genera las 15 combinaciones, incluida Practicante', () => {
    const filas = generarPreciosPorDefecto('Arte');
    expect(filas).toHaveLength(15);
    expect(COMBINACIONES_ESPERADAS).toBe(15);
    expect(filas.filter((f) => f.seniority === 'Practicante')).toHaveLength(3);
    expect(filas.find((f) => f.seniority === 'Director' && f.workMode === 'remote')?.credits).toBe(12);
    expect(filas.find((f) => f.seniority === 'Practicante' && f.workMode === 'presential')?.credits).toBe(2);
    expect(filas.every((f) => f.profile === 'Arte' && f.location === null)).toBe(true);
  });

  it('sync detecta las combinaciones de Practicante que faltan', async () => {
    db.specialty.findMany.mockResolvedValue([{ id: 1, name: 'Arte' }]);
    db.pricingMatrix.findMany.mockResolvedValue(
      generarPreciosPorDefecto('Arte')
        .filter((f) => f.seniority !== 'Practicante')
        .map(({ profile, seniority, workMode }) => ({ profile, seniority, workMode }))
    );

    const res = await syncGet();
    const cuerpo = await res.json();

    expect(cuerpo.data.incompletePricing).toHaveLength(1);
    expect(cuerpo.data.incompletePricing[0].missingCombinations).toEqual(
      expect.arrayContaining(['Practicante-presential', 'Practicante-hybrid', 'Practicante-remote'])
    );
    expect(cuerpo.data.incompletePricing[0].currentCount).toBe(12);
  });
});
