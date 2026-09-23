// RUTA: __tests__/api/adm-asignaciones-pipeline.test.ts

/**
 * Auditoría 2026-09 · módulo admin — asignación de candidatos y de equipo.
 *
 * ADM-026: comprobar-luego-crear fuera de transacción (duplicados y estados a
 *          medias si fallaba el updateMany).
 * ADM-027: la nota interna de inyección se guardaba en Application.notes y
 *          /my-applications se la mostraba al candidato.
 * ADM-029: una vacante con sólo reclutador no caía en ningún filtro.
 * ADM-070/071: ids no numéricos -> 500; se inyectaba en vacantes cerradas y
 *          sobre candidatos 'hired'/'inactive'.
 * ADM-073: pipelineStats no contaba company_interested/interviewed/archived.
 * ADM-074: POST de asignaciones aceptaba usuarios desactivados.
 * ADM-075/076/077: notificaciones repetidas y fire-and-forget sin await.
 */

jest.mock('next/server', () => ({
  NextResponse: {
    json: (data: any, options?: any) => ({
      status: options?.status || 200,
      json: async () => data,
    }),
  },
}));

const tx = {
  application: { findMany: jest.fn(), createMany: jest.fn() },
  candidate: { updateMany: jest.fn() },
};

jest.mock('@/lib/prisma', () => ({
  prisma: {
    job: { findUnique: jest.fn(), findMany: jest.fn(), count: jest.fn() },
    candidate: { findMany: jest.fn(), updateMany: jest.fn() },
    application: { findMany: jest.fn(), createMany: jest.fn() },
    jobAssignment: { findUnique: jest.fn(), upsert: jest.fn() },
    user: { findUnique: jest.fn(), findMany: jest.fn() },
    $transaction: jest.fn(),
  },
}));

jest.mock('@/lib/auth', () => ({
  requireRole: jest.fn(),
  requireAuth: jest.fn(),
}));

jest.mock('@/lib/notifications', () => ({
  createNotification: jest.fn(),
}));

import { requireRole } from '@/lib/auth';
import { createNotification } from '@/lib/notifications';
import { prisma } from '@/lib/prisma';
import {
  GET as assignGet,
  POST as assignPost,
} from '@/app/api/admin/assign-candidates/route';
import {
  GET as assignmentsGet,
  POST as assignmentsPost,
} from '@/app/api/admin/assignments/route';

const mockRequireRole = requireRole as jest.Mock;
const mockCreateNotification = createNotification as jest.Mock;
const mockJob = (prisma as any).job;
const mockCandidate = (prisma as any).candidate;
const mockApplication = (prisma as any).application;
const mockJobAssignment = (prisma as any).jobAssignment;
const mockUser = (prisma as any).user;
const mockTransaction = (prisma as any).$transaction as jest.Mock;

const ADMIN = { user: { id: 1, email: 'admin@inakat.com', role: 'admin' } };

function pedir(url: string, method = 'GET', body?: any) {
  return new Request(url, {
    method,
    body: body ? JSON.stringify(body) : undefined,
  });
}

const CANDIDATO = {
  id: 5,
  nombre: 'Ana',
  apellidoPaterno: 'López',
  apellidoMaterno: null,
  email: 'ana@test.com',
  telefono: '5512345678',
  cvUrl: null,
  source: 'linkedin',
  profile: 'Tecnología',
  seniority: 'Sr',
  status: 'available',
};

describe('/api/admin/assign-candidates — inyección de candidatos', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRequireRole.mockResolvedValue(ADMIN);
    Object.values(tx).forEach((modelo) =>
      Object.values(modelo).forEach((fn: any) => fn.mockReset())
    );
    mockTransaction.mockImplementation(async (cb: any) => cb(tx));
    mockCreateNotification.mockResolvedValue(undefined);
  });

  describe('ADM-070 / ADM-071 · validación de entrada', () => {
    it('jobId no numérico responde 400 sin consultar Prisma', async () => {
      const res = await assignPost(
        pedir('http://localhost/api/admin/assign-candidates', 'POST', {
          jobId: 'abc',
          candidateIds: [5],
        })
      );

      expect(res.status).toBe(400);
      expect(mockJob.findUnique).not.toHaveBeenCalled();
    });

    it('un candidateId no numérico responde 400', async () => {
      const res = await assignPost(
        pedir('http://localhost/api/admin/assign-candidates', 'POST', {
          jobId: 12,
          candidateIds: [5, 'x'],
        })
      );

      expect(res.status).toBe(400);
      expect(mockJob.findUnique).not.toHaveBeenCalled();
    });

    it('rechaza con 409 inyectar en una vacante cerrada', async () => {
      mockJob.findUnique.mockResolvedValue({ id: 12, title: 'Backend', status: 'closed' });

      const res = await assignPost(
        pedir('http://localhost/api/admin/assign-candidates', 'POST', {
          jobId: 12,
          candidateIds: [5],
        })
      );

      expect(res.status).toBe(409);
      expect(mockTransaction).not.toHaveBeenCalled();
    });

    it('sólo busca candidatos en estado available o in_process', async () => {
      mockJob.findUnique.mockResolvedValue({ id: 12, title: 'Backend', status: 'active' });
      mockCandidate.findMany.mockResolvedValue([CANDIDATO]);
      tx.application.findMany.mockResolvedValue([]);
      mockJobAssignment.findUnique.mockResolvedValue(null);

      await assignPost(
        pedir('http://localhost/api/admin/assign-candidates', 'POST', {
          jobId: 12,
          candidateIds: [5],
        })
      );

      const where = mockCandidate.findMany.mock.calls[0][0].where;
      expect(where.status).toEqual({ in: ['available', 'in_process'] });
    });

    it('GET con jobId=abc responde 400 en vez de 500', async () => {
      const res = await assignGet(
        pedir('http://localhost/api/admin/assign-candidates?jobId=abc')
      );

      expect(res.status).toBe(400);
      expect(mockApplication.findMany).not.toHaveBeenCalled();
    });
  });

  describe('ADM-026 / ADM-027 · transacción y nota interna', () => {
    beforeEach(() => {
      mockJob.findUnique.mockResolvedValue({ id: 12, title: 'Backend', status: 'active' });
      mockCandidate.findMany.mockResolvedValue([CANDIDATO]);
      tx.application.findMany
        .mockResolvedValueOnce([]) // existentes
        .mockResolvedValueOnce([{ id: 100 }]); // creadas
      tx.application.createMany.mockResolvedValue({ count: 1 });
      mockJobAssignment.findUnique.mockResolvedValue(null);
    });

    it('createMany y updateMany se ejecutan con el cliente de la transacción', async () => {
      const res = await assignPost(
        pedir('http://localhost/api/admin/assign-candidates', 'POST', {
          jobId: 12,
          candidateIds: [5],
        })
      );

      expect(res.status).toBe(201);
      expect(mockTransaction).toHaveBeenCalled();
      expect(tx.application.createMany).toHaveBeenCalled();
      expect(tx.candidate.updateMany).toHaveBeenCalled();
      expect(mockApplication.createMany).not.toHaveBeenCalled();
      expect(mockCandidate.updateMany).not.toHaveBeenCalled();
    });

    it('la Application creada NO lleva notes internas', async () => {
      await assignPost(
        pedir('http://localhost/api/admin/assign-candidates', 'POST', {
          jobId: 12,
          candidateIds: [5],
        })
      );

      const fila = tx.application.createMany.mock.calls[0][0].data[0];
      expect(fila.notes).toBeUndefined();
      expect(fila.status).toBe('injected_by_admin');
      expect(fila.candidateEmail).toBe('ana@test.com');
    });
  });

  describe('ADM-076 / ADM-077 · la notificación se espera antes de responder', () => {
    it('createNotification se resuelve antes del return', async () => {
      mockJob.findUnique.mockResolvedValue({ id: 12, title: 'Backend', status: 'active' });
      mockCandidate.findMany.mockResolvedValue([CANDIDATO]);
      tx.application.findMany.mockResolvedValueOnce([]).mockResolvedValueOnce([{ id: 100 }]);
      tx.application.createMany.mockResolvedValue({ count: 1 });
      mockJobAssignment.findUnique.mockResolvedValue({ recruiterId: 33 });

      let resuelta = false;
      mockCreateNotification.mockImplementation(
        () =>
          new Promise((resolve) =>
            setTimeout(() => {
              resuelta = true;
              resolve(undefined);
            }, 5)
          )
      );

      await assignPost(
        pedir('http://localhost/api/admin/assign-candidates', 'POST', {
          jobId: 12,
          candidateIds: [5],
        })
      );

      expect(resuelta).toBe(true);
    });
  });

  describe('ADM-073 · pipelineStats cuenta todos los estados', () => {
    it('incluye companyInterested, interviewed y archived', async () => {
      mockApplication.findMany.mockResolvedValue([
        { id: 1, candidateEmail: 'a@t.com', status: 'company_interested' },
        { id: 2, candidateEmail: 'b@t.com', status: 'interviewed' },
        { id: 3, candidateEmail: 'c@t.com', status: 'archived' },
        { id: 4, candidateEmail: 'd@t.com', status: 'sent_to_company' },
      ]);
      mockJobAssignment.findUnique.mockResolvedValue(null);
      mockCandidate.findMany.mockResolvedValue([]);

      const res = await assignGet(
        pedir('http://localhost/api/admin/assign-candidates?jobId=12')
      );
      const cuerpo = await res.json();

      expect(cuerpo.pipelineStats.companyInterested).toBe(1);
      expect(cuerpo.pipelineStats.interviewed).toBe(1);
      expect(cuerpo.pipelineStats.archived).toBe(1);
      expect(cuerpo.pipelineStats.sentToCompany).toBe(1);
      expect(cuerpo.pipelineStats.total).toBe(4);
    });
  });
});

describe('/api/admin/assignments — equipo por vacante', () => {
  const vacante = (assignment: any) => ({
    id: 1,
    title: 'Backend',
    profile: 'Tecnología',
    assignment,
  });

  beforeEach(() => {
    jest.resetAllMocks();
    mockRequireRole.mockResolvedValue(ADMIN);
    mockUser.findMany.mockResolvedValue([]);
    mockCreateNotification.mockResolvedValue(undefined);
  });

  describe('ADM-029 · estados excluyentes y exhaustivos', () => {
    const vacantes = [
      vacante(null), // unassigned
      vacante({
        recruiterId: 3,
        specialistId: null,
        recruiterStatus: 'pending',
        specialistStatus: 'pending',
      }), // partial
      vacante({
        recruiterId: 3,
        specialistId: 4,
        recruiterStatus: 'pending',
        specialistStatus: 'pending',
      }), // assigned
      vacante({
        recruiterId: 3,
        specialistId: 4,
        recruiterStatus: 'sent_to_specialist',
        specialistStatus: 'pending',
      }), // in_progress
      vacante({
        recruiterId: 3,
        specialistId: 4,
        recruiterStatus: 'sent_to_specialist',
        specialistStatus: 'sent_to_company',
      }), // completed
    ];

    it('las estadísticas suman exactamente el total', async () => {
      mockJob.findMany.mockResolvedValue(vacantes);

      const res = await assignmentsGet(pedir('http://localhost/api/admin/assignments'));
      const { stats } = await res.json();

      expect(stats.total).toBe(5);
      expect(
        stats.unassigned + stats.partial + stats.assigned + stats.inProgress + stats.completed
      ).toBe(stats.total);
      expect(stats.partial).toBe(1);
    });

    it('el filtro "partial" devuelve la vacante con sólo reclutador', async () => {
      mockJob.findMany.mockResolvedValue(vacantes);

      const res = await assignmentsGet(
        pedir('http://localhost/api/admin/assignments?status=partial')
      );
      const cuerpo = await res.json();

      expect(cuerpo.data).toHaveLength(1);
      expect(cuerpo.data[0].assignment.specialistId).toBeNull();
    });

    it('in_progress incluye recruiterStatus sent_to_specialist', async () => {
      mockJob.findMany.mockResolvedValue(vacantes);

      const res = await assignmentsGet(
        pedir('http://localhost/api/admin/assignments?status=in_progress')
      );
      const cuerpo = await res.json();

      expect(cuerpo.data).toHaveLength(1);
      expect(cuerpo.data[0].assignment.recruiterStatus).toBe('sent_to_specialist');
    });
  });

  describe('ADM-074 · validación del POST', () => {
    it('jobId no numérico responde 400 en vez de 500 y no llega a Prisma', async () => {
      const res = await assignmentsPost(
        pedir('http://localhost/api/admin/assignments', 'POST', {
          jobId: 'abc',
          recruiterId: 3,
        })
      );

      expect(res.status).toBe(400);
      expect(mockJob.findUnique).not.toHaveBeenCalled();
    });

    it('jobId numérico en string se convierte y llega a Prisma como entero', async () => {
      mockJob.findUnique.mockResolvedValue({ id: 15, status: 'active', profile: 'Tecnología' });
      mockJobAssignment.findUnique.mockResolvedValue(null);
      mockJobAssignment.upsert.mockResolvedValue({ id: 1, job: { title: 'Backend' } });

      await assignmentsPost(
        pedir('http://localhost/api/admin/assignments', 'POST', { jobId: '15' })
      );

      expect(mockJob.findUnique).toHaveBeenCalledWith({ where: { id: 15 } });
      expect(mockJobAssignment.upsert.mock.calls[0][0].where).toEqual({ jobId: 15 });
    });

    it('recruiterId no numérico responde 400', async () => {
      const res = await assignmentsPost(
        pedir('http://localhost/api/admin/assignments', 'POST', {
          jobId: 15,
          recruiterId: 'tres',
        })
      );

      expect(res.status).toBe(400);
    });

    it('rechaza un reclutador desactivado', async () => {
      mockJob.findUnique.mockResolvedValue({ id: 15, status: 'active', profile: 'Tecnología' });
      mockUser.findUnique.mockResolvedValue({
        id: 3,
        role: 'recruiter',
        isActive: false,
        specialty: null,
      });

      const res = await assignmentsPost(
        pedir('http://localhost/api/admin/assignments', 'POST', {
          jobId: 15,
          recruiterId: 3,
        })
      );

      expect(res.status).toBe(400);
      expect(mockJobAssignment.upsert).not.toHaveBeenCalled();
    });
  });

  describe('ADM-075 · no re-notificar a quien no cambió', () => {
    it('añadir al especialista no vuelve a avisar al reclutador ya asignado', async () => {
      mockJob.findUnique.mockResolvedValue({ id: 15, status: 'active', profile: 'Tecnología' });
      mockUser.findUnique
        .mockResolvedValueOnce({ id: 3, role: 'recruiter', isActive: true })
        .mockResolvedValueOnce({
          id: 4,
          role: 'specialist',
          isActive: true,
          specialty: 'Tecnología',
        });
      mockJobAssignment.findUnique.mockResolvedValue({ recruiterId: 3, specialistId: null });
      mockJobAssignment.upsert.mockResolvedValue({
        id: 1,
        job: { title: 'Backend' },
      });

      await assignmentsPost(
        pedir('http://localhost/api/admin/assignments', 'POST', {
          jobId: 15,
          recruiterId: 3,
          specialistId: 4,
        })
      );

      expect(mockCreateNotification).toHaveBeenCalledTimes(1);
      expect(mockCreateNotification.mock.calls[0][0].userId).toBe(4);
    });
  });
});
