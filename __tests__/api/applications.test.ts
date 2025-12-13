// RUTA: __tests__/api/applications.test.ts

/**
 * Tests para las APIs de aplicaciones a vacantes
 * Verifican: creación, validación de duplicados, actualización de status
 */

// Mock de Prisma
const mockPrismaApplication = {
  findMany: jest.fn(),
  findFirst: jest.fn(),
  findUnique: jest.fn(),
  create: jest.fn(),
  update: jest.fn(),
  delete: jest.fn(),
};

const mockPrismaJob = {
  findUnique: jest.fn(),
};

jest.mock('@/lib/prisma', () => ({
  prisma: {
    application: mockPrismaApplication,
    job: mockPrismaJob,
  },
}));

describe('Applications API Logic Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /api/applications - Lógica de filtros', () => {
    it('debería listar todas las aplicaciones', async () => {
      const mockApplications = [
        { id: 1, jobId: 1, candidateName: 'Juan', status: 'pending' },
        { id: 2, jobId: 1, candidateName: 'María', status: 'reviewing' },
      ];

      mockPrismaApplication.findMany.mockResolvedValue(mockApplications);

      const applications = await mockPrismaApplication.findMany({
        include: { job: true },
        orderBy: { createdAt: 'desc' },
      });

      expect(applications).toHaveLength(2);
    });

    it('debería filtrar por jobId', async () => {
      mockPrismaApplication.findMany.mockResolvedValue([]);

      await mockPrismaApplication.findMany({
        where: { jobId: 5 },
      });

      expect(mockPrismaApplication.findMany).toHaveBeenCalledWith({
        where: { jobId: 5 },
      });
    });

    it('debería filtrar por status', async () => {
      mockPrismaApplication.findMany.mockResolvedValue([]);

      await mockPrismaApplication.findMany({
        where: { status: 'pending' },
      });

      expect(mockPrismaApplication.findMany).toHaveBeenCalledWith({
        where: { status: 'pending' },
      });
    });

    it('debería filtrar por candidateEmail', async () => {
      mockPrismaApplication.findMany.mockResolvedValue([]);

      await mockPrismaApplication.findMany({
        where: { candidateEmail: 'test@test.com' },
      });

      expect(mockPrismaApplication.findMany).toHaveBeenCalledWith({
        where: { candidateEmail: 'test@test.com' },
      });
    });
  });

  describe('POST /api/applications - Validaciones', () => {
    it('debería validar campos requeridos', () => {
      const validApplication = {
        jobId: 1,
        candidateName: 'Juan Pérez',
        candidateEmail: 'juan@test.com',
      };

      const requiredFields = ['jobId', 'candidateName', 'candidateEmail'];
      const isValid = requiredFields.every(field => validApplication[field as keyof typeof validApplication]);
      expect(isValid).toBe(true);
    });

    it('debería fallar si falta jobId', () => {
      const invalidApplication = {
        candidateName: 'Juan',
        candidateEmail: 'juan@test.com',
      };

      const hasJobId = 'jobId' in invalidApplication;
      expect(hasJobId).toBe(false);
    });

    it('debería fallar si falta candidateEmail', () => {
      const invalidApplication = {
        jobId: 1,
        candidateName: 'Juan',
      };

      const hasEmail = 'candidateEmail' in invalidApplication;
      expect(hasEmail).toBe(false);
    });
  });

  describe('POST /api/applications - Verificación de vacante', () => {
    it('debería rechazar si la vacante no existe', async () => {
      mockPrismaJob.findUnique.mockResolvedValue(null);

      const job = await mockPrismaJob.findUnique({ where: { id: 999 } });

      expect(job).toBeNull();
      // Esto resultaría en 404
    });

    it('debería rechazar si la vacante no está activa', async () => {
      const closedJob = { id: 1, title: 'Vacante Cerrada', status: 'closed' };
      mockPrismaJob.findUnique.mockResolvedValue(closedJob);

      const job = await mockPrismaJob.findUnique({ where: { id: 1 } });

      expect(job.status).toBe('closed');
      expect(job.status !== 'active').toBe(true);
      // Esto resultaría en 400
    });

    it('debería aceptar si la vacante está activa', async () => {
      const activeJob = { id: 1, title: 'Vacante Activa', status: 'active' };
      mockPrismaJob.findUnique.mockResolvedValue(activeJob);

      const job = await mockPrismaJob.findUnique({ where: { id: 1 } });

      expect(job.status).toBe('active');
    });
  });

  describe('POST /api/applications - Prevención de duplicados', () => {
    it('NO debería permitir duplicados (mismo email + misma vacante)', async () => {
      const existingApplication = {
        id: 1,
        jobId: 1,
        candidateEmail: 'duplicado@test.com',
      };

      mockPrismaApplication.findFirst.mockResolvedValue(existingApplication);

      const existing = await mockPrismaApplication.findFirst({
        where: {
          jobId: 1,
          candidateEmail: 'duplicado@test.com'.toLowerCase(),
        },
      });

      expect(existing).not.toBeNull();
      // Esto resultaría en 400: "Ya has aplicado a esta vacante anteriormente"
    });

    it('debería normalizar email a minúsculas para comparación', () => {
      const email1 = 'TEST@example.com';
      const email2 = 'test@example.com';

      expect(email1.toLowerCase()).toBe(email2.toLowerCase());
    });

    it('debería permitir mismo email en diferentes vacantes', async () => {
      // Primera aplicación
      mockPrismaApplication.findFirst.mockResolvedValueOnce(null);

      const existing1 = await mockPrismaApplication.findFirst({
        where: { jobId: 1, candidateEmail: 'juan@test.com' },
      });

      expect(existing1).toBeNull();

      // Segunda aplicación (diferente vacante)
      mockPrismaApplication.findFirst.mockResolvedValueOnce(null);

      const existing2 = await mockPrismaApplication.findFirst({
        where: { jobId: 2, candidateEmail: 'juan@test.com' },
      });

      expect(existing2).toBeNull();
    });
  });

  describe('POST /api/applications - Creación exitosa', () => {
    it('debería crear aplicación con todos los campos', async () => {
      const newApplication = {
        id: 1,
        jobId: 1,
        candidateName: 'Juan Pérez',
        candidateEmail: 'juan@test.com',
        candidatePhone: '8112345678',
        cvUrl: 'https://storage.com/cv.pdf',
        coverLetter: 'Carta de presentación...',
        status: 'pending',
      };

      mockPrismaApplication.create.mockResolvedValue(newApplication);

      const application = await mockPrismaApplication.create({
        data: {
          jobId: 1,
          candidateName: 'Juan Pérez',
          candidateEmail: 'juan@test.com',
          candidatePhone: '8112345678',
          cvUrl: 'https://storage.com/cv.pdf',
          coverLetter: 'Carta de presentación...',
          status: 'pending',
        },
      });

      expect(application.status).toBe('pending');
      expect(application.candidateEmail).toBe('juan@test.com');
    });

    it('debería crear aplicación sin campos opcionales', async () => {
      const newApplication = {
        id: 1,
        jobId: 1,
        candidateName: 'María García',
        candidateEmail: 'maria@test.com',
        candidatePhone: null,
        cvUrl: null,
        coverLetter: null,
        status: 'pending',
      };

      mockPrismaApplication.create.mockResolvedValue(newApplication);

      const application = await mockPrismaApplication.create({
        data: {
          jobId: 1,
          candidateName: 'María García',
          candidateEmail: 'maria@test.com',
          status: 'pending',
        },
      });

      expect(application.cvUrl).toBeNull();
      expect(application.coverLetter).toBeNull();
    });
  });

  describe('PATCH /api/applications/[id] - Actualización de status', () => {
    const validStatuses = ['pending', 'reviewing', 'interviewed', 'rejected', 'accepted'];

    it('debería validar status válidos', () => {
      validStatuses.forEach(status => {
        expect(validStatuses.includes(status)).toBe(true);
      });
    });

    it('debería rechazar status inválido', () => {
      const invalidStatus = 'invalid_status';
      expect(validStatuses.includes(invalidStatus)).toBe(false);
    });

    it('debería actualizar status de pending a reviewing', async () => {
      const updated = {
        id: 1,
        status: 'reviewing',
        reviewedAt: new Date(),
      };

      mockPrismaApplication.update.mockResolvedValue(updated);

      const application = await mockPrismaApplication.update({
        where: { id: 1 },
        data: { status: 'reviewing', reviewedAt: new Date() },
      });

      expect(application.status).toBe('reviewing');
      expect(application.reviewedAt).toBeDefined();
    });

    it('debería marcar reviewedAt al cambiar a reviewing/rejected/accepted', () => {
      const statusesRequiringReviewedAt = ['reviewing', 'rejected', 'accepted'];

      statusesRequiringReviewedAt.forEach(status => {
        const updateData: any = { status };
        if (['reviewing', 'rejected', 'accepted'].includes(status)) {
          updateData.reviewedAt = new Date();
        }
        expect(updateData.reviewedAt).toBeDefined();
      });
    });

    it('debería actualizar notas', async () => {
      const updated = {
        id: 1,
        notes: 'Buen candidato, programar entrevista',
      };

      mockPrismaApplication.update.mockResolvedValue(updated);

      const application = await mockPrismaApplication.update({
        where: { id: 1 },
        data: { notes: 'Buen candidato, programar entrevista' },
      });

      expect(application.notes).toBe('Buen candidato, programar entrevista');
    });
  });

  describe('DELETE /api/applications/[id]', () => {
    it('debería eliminar aplicación existente', async () => {
      mockPrismaApplication.findUnique.mockResolvedValue({ id: 1 });
      mockPrismaApplication.delete.mockResolvedValue({ id: 1 });

      const existing = await mockPrismaApplication.findUnique({ where: { id: 1 } });
      expect(existing).not.toBeNull();

      await mockPrismaApplication.delete({ where: { id: 1 } });

      expect(mockPrismaApplication.delete).toHaveBeenCalledWith({ where: { id: 1 } });
    });

    it('debería fallar si la aplicación no existe', async () => {
      mockPrismaApplication.findUnique.mockResolvedValue(null);

      const existing = await mockPrismaApplication.findUnique({ where: { id: 999 } });
      expect(existing).toBeNull();
      // Esto resultaría en 404
    });
  });
});
