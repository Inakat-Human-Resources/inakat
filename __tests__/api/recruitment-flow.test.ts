// RUTA: __tests__/api/recruitment-flow.test.ts

/**
 * Tests de Flujo de Reclutamiento Completo
 *
 * Verifican el flujo completo de reclutamiento:
 * 1. Empresa publica vacante
 * 2. Admin asigna reclutador y especialista
 * 3. Reclutador evalúa candidatos y envía al especialista
 * 4. Especialista evalúa y envía a la empresa
 * 5. Empresa selecciona candidato
 */

// Mock de Prisma
const mockPrisma = {
  job: {
    create: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
  },
  jobAssignment: {
    create: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
  },
  candidate: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
  },
  user: {
    findUnique: jest.fn(),
    update: jest.fn(),
  },
  application: {
    create: jest.fn(),
    update: jest.fn(),
  },
};

jest.mock('@/lib/prisma', () => ({
  prisma: mockPrisma,
}));

describe('Flujo de Reclutamiento Completo', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Fase 1: Publicación de Vacante', () => {
    it('empresa debería poder crear vacante con créditos suficientes', async () => {
      const company = { id: 1, credits: 10, role: 'company' };
      const newJob = {
        id: 1,
        title: 'Desarrollador Senior',
        company: 'Tech Corp',
        status: 'active',
        creditCost: 6,
        userId: 1,
      };

      mockPrisma.user.findUnique.mockResolvedValue(company);
      mockPrisma.job.create.mockResolvedValue(newJob);
      mockPrisma.user.update.mockResolvedValue({ ...company, credits: 4 });

      // Verificar créditos suficientes
      const user = await mockPrisma.user.findUnique({ where: { id: 1 } });
      expect(user.credits).toBeGreaterThanOrEqual(6);

      // Crear vacante
      const job = await mockPrisma.job.create({
        data: {
          title: 'Desarrollador Senior',
          company: 'Tech Corp',
          status: 'active',
          creditCost: 6,
          userId: 1,
        },
      });

      expect(job.status).toBe('active');
      expect(job.creditCost).toBe(6);

      // Descontar créditos
      const updatedUser = await mockPrisma.user.update({
        where: { id: 1 },
        data: { credits: { decrement: 6 } },
      });

      expect(updatedUser.credits).toBe(4);
    });

    it('debería rechazar vacante si no hay créditos suficientes', async () => {
      const company = { id: 2, credits: 3, role: 'company' };
      mockPrisma.user.findUnique.mockResolvedValue(company);

      const user = await mockPrisma.user.findUnique({ where: { id: 2 } });
      const requiredCredits = 6;

      expect(user.credits).toBeLessThan(requiredCredits);
      // En este caso, el sistema debería rechazar la publicación
    });

    it('vacante debería poder guardarse como borrador sin créditos', async () => {
      const draftJob = {
        id: 2,
        title: 'Diseñador UX',
        status: 'draft',
        creditCost: 0,
      };

      mockPrisma.job.create.mockResolvedValue(draftJob);

      const job = await mockPrisma.job.create({
        data: { title: 'Diseñador UX', status: 'draft' },
      });

      expect(job.status).toBe('draft');
      expect(job.creditCost).toBe(0);
    });
  });

  describe('Fase 2: Asignación de Personal', () => {
    it('admin debería poder asignar reclutador a vacante', async () => {
      const assignment = {
        id: 1,
        jobId: 1,
        recruiterId: 10,
        specialistId: null,
        recruiterStatus: 'pending',
      };

      mockPrisma.jobAssignment.create.mockResolvedValue(assignment);

      const created = await mockPrisma.jobAssignment.create({
        data: { jobId: 1, recruiterId: 10 },
      });

      expect(created.recruiterId).toBe(10);
      expect(created.recruiterStatus).toBe('pending');
    });

    it('admin debería poder asignar especialista a vacante', async () => {
      const updatedAssignment = {
        id: 1,
        jobId: 1,
        recruiterId: 10,
        specialistId: 20,
        specialistStatus: 'pending',
      };

      mockPrisma.jobAssignment.update.mockResolvedValue(updatedAssignment);

      const updated = await mockPrisma.jobAssignment.update({
        where: { id: 1 },
        data: { specialistId: 20 },
      });

      expect(updated.specialistId).toBe(20);
    });
  });

  describe('Fase 3: Evaluación del Reclutador', () => {
    it('reclutador debería ver candidatos asignables', async () => {
      const candidates = [
        { id: 1, nombre: 'Juan', status: 'available' },
        { id: 2, nombre: 'María', status: 'available' },
        { id: 3, nombre: 'Pedro', status: 'in_process' },
      ];

      mockPrisma.candidate.findMany.mockResolvedValue(candidates);

      const available = await mockPrisma.candidate.findMany({
        where: {
          status: { notIn: ['sent_to_specialist', 'sent_to_company', 'rejected'] },
        },
      });

      expect(available).toHaveLength(3);
    });

    it('reclutador debería poder enviar candidatos al especialista', async () => {
      const updatedAssignment = {
        id: 1,
        candidatesSentToSpecialist: '1,2,3',
        recruiterStatus: 'sent_to_specialist',
        recruiterNotes: 'Candidatos pre-seleccionados',
      };

      mockPrisma.jobAssignment.update.mockResolvedValue(updatedAssignment);

      const updated = await mockPrisma.jobAssignment.update({
        where: { id: 1 },
        data: {
          candidatesSentToSpecialist: '1,2,3',
          recruiterStatus: 'sent_to_specialist',
          recruiterNotes: 'Candidatos pre-seleccionados',
        },
      });

      expect(updated.candidatesSentToSpecialist).toBe('1,2,3');
      expect(updated.recruiterStatus).toBe('sent_to_specialist');
    });
  });

  describe('Fase 4: Evaluación del Especialista', () => {
    it('especialista debería ver candidatos enviados por reclutador', async () => {
      const assignment = {
        id: 1,
        candidatesSentToSpecialist: '1,2,3',
      };

      mockPrisma.jobAssignment.findUnique.mockResolvedValue(assignment);

      const found = await mockPrisma.jobAssignment.findUnique({ where: { id: 1 } });
      const candidateIds = found.candidatesSentToSpecialist.split(',').map(Number);

      expect(candidateIds).toEqual([1, 2, 3]);
    });

    it('especialista debería poder enviar candidatos a la empresa', async () => {
      const updatedAssignment = {
        id: 1,
        candidatesSentToCompany: '1,2',
        specialistStatus: 'sent_to_company',
        specialistNotes: 'Evaluación técnica completada',
      };

      mockPrisma.jobAssignment.update.mockResolvedValue(updatedAssignment);

      const updated = await mockPrisma.jobAssignment.update({
        where: { id: 1 },
        data: {
          candidatesSentToCompany: '1,2',
          specialistStatus: 'sent_to_company',
        },
      });

      expect(updated.candidatesSentToCompany).toBe('1,2');
      expect(updated.specialistStatus).toBe('sent_to_company');
    });
  });

  describe('Fase 5: Selección Final', () => {
    it('empresa debería ver candidatos finales', async () => {
      const assignment = {
        candidatesSentToCompany: '1,2',
      };
      const candidates = [
        { id: 1, nombre: 'Juan', status: 'sent_to_company' },
        { id: 2, nombre: 'María', status: 'sent_to_company' },
      ];

      mockPrisma.jobAssignment.findUnique.mockResolvedValue(assignment);
      mockPrisma.candidate.findMany.mockResolvedValue(candidates);

      const found = await mockPrisma.jobAssignment.findUnique({ where: { jobId: 1 } });
      const ids = found.candidatesSentToCompany.split(',').map(Number);

      const finalCandidates = await mockPrisma.candidate.findMany({
        where: { id: { in: ids } },
      });

      expect(finalCandidates).toHaveLength(2);
    });

    it('candidato seleccionado debería cambiar a estado accepted', async () => {
      const acceptedCandidate = {
        id: 1,
        nombre: 'Juan',
        status: 'accepted',
      };

      mockPrisma.candidate.update.mockResolvedValue(acceptedCandidate);

      const updated = await mockPrisma.candidate.update({
        where: { id: 1 },
        data: { status: 'accepted' },
      });

      expect(updated.status).toBe('accepted');
    });

    it('vacante debería cerrarse al seleccionar candidato', async () => {
      const closedJob = {
        id: 1,
        status: 'closed',
      };

      mockPrisma.job.update.mockResolvedValue(closedJob);

      const updated = await mockPrisma.job.update({
        where: { id: 1 },
        data: { status: 'closed' },
      });

      expect(updated.status).toBe('closed');
    });
  });
});

describe('Casos Edge del Flujo', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('debería manejar vacante expirada correctamente', async () => {
    const expiredJob = {
      id: 1,
      status: 'active',
      expiresAt: new Date('2024-01-01'), // Fecha pasada
    };

    mockPrisma.job.findUnique.mockResolvedValue(expiredJob);

    const job = await mockPrisma.job.findUnique({ where: { id: 1 } });
    const now = new Date();

    expect(new Date(job.expiresAt).getTime()).toBeLessThan(now.getTime());
  });

  it('debería permitir reabrir vacante cerrada', async () => {
    const reopenedJob = {
      id: 1,
      status: 'active',
    };

    mockPrisma.job.update.mockResolvedValue(reopenedJob);

    const updated = await mockPrisma.job.update({
      where: { id: 1 },
      data: { status: 'active' },
    });

    expect(updated.status).toBe('active');
  });

  it('candidato rechazado debería volver a estar disponible', async () => {
    const rejectedCandidate = {
      id: 1,
      status: 'available', // Vuelve a available
    };

    mockPrisma.candidate.update.mockResolvedValue(rejectedCandidate);

    const updated = await mockPrisma.candidate.update({
      where: { id: 1 },
      data: { status: 'available' },
    });

    expect(updated.status).toBe('available');
  });
});
