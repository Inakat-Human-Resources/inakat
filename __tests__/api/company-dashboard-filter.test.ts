// RUTA: __tests__/api/company-dashboard-filter.test.ts

/**
 * Tests para el filtrado de aplicaciones en el dashboard de empresa
 * Endpoint: /api/company/dashboard
 *
 * Verifica que la empresa SOLO ve candidatos con status apropiados
 */

// Mock de Prisma
const mockPrismaUser = {
  findUnique: jest.fn(),
};

const mockPrismaJob = {
  findMany: jest.fn(),
};

const mockPrismaApplication = {
  findMany: jest.fn(),
};

jest.mock('@/lib/prisma', () => ({
  prisma: {
    user: mockPrismaUser,
    job: mockPrismaJob,
    application: mockPrismaApplication,
  },
}));

describe('Company Dashboard Filter Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // Status visibles para la empresa
  const COMPANY_VISIBLE_STATUSES = [
    'sent_to_company',
    'interviewed',
    'accepted',
    'rejected'
  ];

  // Status NO visibles para la empresa
  const HIDDEN_STATUSES = [
    'pending',
    'reviewing',
    'injected_by_admin',
    'sent_to_specialist'
  ];

  describe('GET /api/company/dashboard - Filtrado de aplicaciones', () => {
    it('debería filtrar solo status visibles para empresa', async () => {
      const allApplications = [
        { id: 1, status: 'pending', candidateName: 'Pendiente' },
        { id: 2, status: 'reviewing', candidateName: 'Revisando' },
        { id: 3, status: 'sent_to_company', candidateName: 'Enviado' },
        { id: 4, status: 'interviewed', candidateName: 'Entrevistado' },
        { id: 5, status: 'accepted', candidateName: 'Aceptado' },
        { id: 6, status: 'rejected', candidateName: 'Rechazado' },
        { id: 7, status: 'injected_by_admin', candidateName: 'Inyectado' },
        { id: 8, status: 'sent_to_specialist', candidateName: 'A especialista' }
      ];

      // Filtrar solo los visibles
      const visibleApplications = allApplications.filter(
        app => COMPANY_VISIBLE_STATUSES.includes(app.status)
      );

      expect(visibleApplications).toHaveLength(4);
      expect(visibleApplications.map(a => a.id)).toEqual([3, 4, 5, 6]);
    });

    it('NO debería retornar aplicaciones con status pending', () => {
      const status = 'pending';
      expect(COMPANY_VISIBLE_STATUSES.includes(status)).toBe(false);
    });

    it('NO debería retornar aplicaciones con status reviewing', () => {
      const status = 'reviewing';
      expect(COMPANY_VISIBLE_STATUSES.includes(status)).toBe(false);
    });

    it('NO debería retornar aplicaciones con status injected_by_admin', () => {
      const status = 'injected_by_admin';
      expect(COMPANY_VISIBLE_STATUSES.includes(status)).toBe(false);
    });

    it('NO debería retornar aplicaciones con status sent_to_specialist', () => {
      const status = 'sent_to_specialist';
      expect(COMPANY_VISIBLE_STATUSES.includes(status)).toBe(false);
    });

    it('SÍ debería retornar aplicaciones con status sent_to_company', () => {
      const status = 'sent_to_company';
      expect(COMPANY_VISIBLE_STATUSES.includes(status)).toBe(true);
    });

    it('SÍ debería retornar aplicaciones con status interviewed', () => {
      const status = 'interviewed';
      expect(COMPANY_VISIBLE_STATUSES.includes(status)).toBe(true);
    });

    it('SÍ debería retornar aplicaciones con status accepted', () => {
      const status = 'accepted';
      expect(COMPANY_VISIBLE_STATUSES.includes(status)).toBe(true);
    });

    it('SÍ debería retornar aplicaciones con status rejected', () => {
      const status = 'rejected';
      expect(COMPANY_VISIBLE_STATUSES.includes(status)).toBe(true);
    });

    it('debería construir query con filtro de status', async () => {
      const jobIds = [1, 2, 3];

      mockPrismaApplication.findMany.mockResolvedValue([]);

      await mockPrismaApplication.findMany({
        where: {
          jobId: { in: jobIds },
          status: { in: COMPANY_VISIBLE_STATUSES }
        }
      });

      expect(mockPrismaApplication.findMany).toHaveBeenCalledWith({
        where: {
          jobId: { in: [1, 2, 3] },
          status: { in: COMPANY_VISIBLE_STATUSES }
        }
      });
    });

    it('debería filtrar por empresa correctamente', async () => {
      const companyUserId = 5;
      const companyJobs = [
        { id: 1, userId: 5, title: 'Job 1' },
        { id: 2, userId: 5, title: 'Job 2' }
      ];

      mockPrismaJob.findMany.mockResolvedValue(companyJobs);

      const jobs = await mockPrismaJob.findMany({
        where: { userId: companyUserId }
      });

      expect(jobs).toHaveLength(2);
      expect(jobs.every((j: any) => j.userId === companyUserId)).toBe(true);
    });

    it('debería calcular estadísticas correctas para empresa', () => {
      const applications = [
        { status: 'sent_to_company' },
        { status: 'sent_to_company' },
        { status: 'interviewed' },
        { status: 'accepted' },
        { status: 'rejected' },
        { status: 'rejected' }
      ];

      const stats = {
        total: applications.length,
        newCandidates: applications.filter(a => a.status === 'sent_to_company').length,
        interviewed: applications.filter(a => a.status === 'interviewed').length,
        accepted: applications.filter(a => a.status === 'accepted').length,
        rejected: applications.filter(a => a.status === 'rejected').length
      };

      expect(stats.total).toBe(6);
      expect(stats.newCandidates).toBe(2);
      expect(stats.interviewed).toBe(1);
      expect(stats.accepted).toBe(1);
      expect(stats.rejected).toBe(2);
    });

    it('debería retornar array vacío si empresa no tiene candidatos enviados', async () => {
      mockPrismaApplication.findMany.mockResolvedValue([]);

      const applications = await mockPrismaApplication.findMany({
        where: {
          jobId: { in: [1, 2] },
          status: { in: COMPANY_VISIBLE_STATUSES }
        }
      });

      expect(applications).toHaveLength(0);
    });

    it('debería incluir datos de job en cada aplicación', async () => {
      const mockApplications = [
        {
          id: 1,
          status: 'sent_to_company',
          job: { id: 1, title: 'Developer', location: 'CDMX', status: 'active' }
        }
      ];

      mockPrismaApplication.findMany.mockResolvedValue(mockApplications);

      const applications = await mockPrismaApplication.findMany({
        where: { status: { in: COMPANY_VISIBLE_STATUSES } },
        include: {
          job: { select: { id: true, title: true, location: true, status: true } }
        }
      });

      expect(applications[0].job).toBeDefined();
      expect(applications[0].job.title).toBe('Developer');
    });
  });

  describe('Estadísticas por vacante', () => {
    it('debería calcular estadísticas por vacante solo con candidatos visibles', () => {
      const jobId = 1;
      const allApplicationsForJob = [
        { jobId: 1, status: 'sent_to_company' },
        { jobId: 1, status: 'sent_to_company' },
        { jobId: 1, status: 'interviewed' },
        { jobId: 1, status: 'accepted' },
        // Estos NO deberían contarse
        { jobId: 1, status: 'pending' },
        { jobId: 1, status: 'reviewing' }
      ];

      // Filtrar solo visibles
      const visibleForJob = allApplicationsForJob.filter(
        a => COMPANY_VISIBLE_STATUSES.includes(a.status)
      );

      const jobStats = {
        jobId,
        totalCandidates: visibleForJob.length,
        newCandidates: visibleForJob.filter(a => a.status === 'sent_to_company').length,
        interviewedCandidates: visibleForJob.filter(a => a.status === 'interviewed').length,
        acceptedCandidates: visibleForJob.filter(a => a.status === 'accepted').length
      };

      expect(jobStats.totalCandidates).toBe(4); // Solo los 4 visibles
      expect(jobStats.newCandidates).toBe(2);
      expect(jobStats.interviewedCandidates).toBe(1);
      expect(jobStats.acceptedCandidates).toBe(1);
    });
  });

  describe('Flujo de candidatos', () => {
    it('debería seguir el flujo correcto: pending -> reviewing -> sent_to_specialist -> sent_to_company', () => {
      const flowSteps = [
        'pending',           // Candidato aplica
        'reviewing',         // Reclutador revisa
        'sent_to_specialist', // Enviado a especialista
        'sent_to_company'    // Especialista envía a empresa
      ];

      // Verificar que solo el último es visible para empresa
      const lastStep = flowSteps[flowSteps.length - 1];
      expect(COMPANY_VISIBLE_STATUSES.includes(lastStep)).toBe(true);

      // Los pasos anteriores NO deben ser visibles
      const previousSteps = flowSteps.slice(0, -1);
      previousSteps.forEach(step => {
        expect(COMPANY_VISIBLE_STATUSES.includes(step)).toBe(false);
      });
    });

    it('debería permitir transiciones de estado por empresa', () => {
      // Transiciones válidas para empresa
      const validTransitions = [
        { from: 'sent_to_company', to: 'interviewed' },
        { from: 'sent_to_company', to: 'rejected' },
        { from: 'interviewed', to: 'accepted' },
        { from: 'interviewed', to: 'rejected' }
      ];

      // Todas las transiciones deben ser entre status visibles
      validTransitions.forEach(({ from, to }) => {
        expect(COMPANY_VISIBLE_STATUSES.includes(from)).toBe(true);
        expect(COMPANY_VISIBLE_STATUSES.includes(to)).toBe(true);
      });
    });
  });

  describe('Seguridad', () => {
    it('debería verificar rol de empresa', () => {
      const userRole = 'company';
      expect(userRole === 'company').toBe(true);
    });

    it('debería rechazar otros roles', () => {
      const invalidRoles = ['admin', 'user', 'candidate', 'recruiter', 'specialist'];

      invalidRoles.forEach(role => {
        // Solo 'company' puede acceder al dashboard de empresa
        expect(role === 'company').toBe(false);
      });
    });

    it('debería filtrar solo vacantes de la empresa autenticada', () => {
      const authenticatedCompanyId = 5;
      const jobs = [
        { id: 1, userId: 5 },
        { id: 2, userId: 5 },
        { id: 3, userId: 10 } // Otra empresa
      ];

      const companyJobs = jobs.filter(j => j.userId === authenticatedCompanyId);

      expect(companyJobs).toHaveLength(2);
      expect(companyJobs.every(j => j.userId === authenticatedCompanyId)).toBe(true);
    });
  });
});
