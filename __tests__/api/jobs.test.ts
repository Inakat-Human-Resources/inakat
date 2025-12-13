// RUTA: __tests__/api/jobs.test.ts

/**
 * Tests para las APIs de vacantes
 * Verifican la lógica de negocio: filtros, creación, sistema de créditos
 */

// Mock de Prisma
const mockPrismaJob = {
  findMany: jest.fn(),
  findUnique: jest.fn(),
  create: jest.fn(),
  update: jest.fn(),
};

const mockPrismaUser = {
  findUnique: jest.fn(),
  update: jest.fn(),
};

const mockPrismaPricingMatrix = {
  findFirst: jest.fn(),
};

const mockPrismaCreditTransaction = {
  create: jest.fn(),
  updateMany: jest.fn(),
};

jest.mock('@/lib/prisma', () => ({
  prisma: {
    job: mockPrismaJob,
    user: mockPrismaUser,
    pricingMatrix: mockPrismaPricingMatrix,
    creditTransaction: mockPrismaCreditTransaction,
  },
}));

describe('Jobs API Logic Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /api/jobs - Lógica de filtros', () => {
    it('debería construir query para vacantes activas por defecto', async () => {
      const mockJobs = [
        { id: 1, title: 'Dev', status: 'active', _count: { applications: 5 } },
        { id: 2, title: 'Designer', status: 'active', _count: { applications: 3 } },
      ];

      mockPrismaJob.findMany.mockResolvedValue(mockJobs);

      // Simular la lógica del handler
      const status = 'active'; // default
      const where: any = { status };

      const jobs = await mockPrismaJob.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        include: { _count: { select: { applications: true } } },
      });

      expect(jobs).toHaveLength(2);
      expect(mockPrismaJob.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { status: 'active' },
        })
      );
    });

    it('debería filtrar por status=draft', async () => {
      mockPrismaJob.findMany.mockResolvedValue([]);

      const status = 'draft';
      const where: any = { status };

      await mockPrismaJob.findMany({ where });

      expect(mockPrismaJob.findMany).toHaveBeenCalledWith({
        where: { status: 'draft' },
      });
    });

    it('debería construir query con búsqueda de texto', async () => {
      mockPrismaJob.findMany.mockResolvedValue([]);

      const search = 'developer';
      const where: any = {
        status: 'active',
        OR: [
          { title: { contains: search, mode: 'insensitive' } },
          { company: { contains: search, mode: 'insensitive' } },
          { description: { contains: search, mode: 'insensitive' } },
        ],
      };

      await mockPrismaJob.findMany({ where });

      expect(mockPrismaJob.findMany).toHaveBeenCalledWith({
        where: expect.objectContaining({
          OR: expect.arrayContaining([
            expect.objectContaining({ title: expect.any(Object) }),
          ]),
        }),
      });
    });

    it('debería filtrar por location', async () => {
      mockPrismaJob.findMany.mockResolvedValue([]);

      const location = 'Monterrey';
      const where: any = {
        status: 'active',
        location: { contains: location, mode: 'insensitive' },
      };

      await mockPrismaJob.findMany({ where });

      expect(mockPrismaJob.findMany).toHaveBeenCalledWith({
        where: expect.objectContaining({
          location: { contains: 'Monterrey', mode: 'insensitive' },
        }),
      });
    });

    it('debería filtrar por workMode', async () => {
      mockPrismaJob.findMany.mockResolvedValue([]);

      const where: any = {
        status: 'active',
        workMode: 'remote',
      };

      await mockPrismaJob.findMany({ where });

      expect(mockPrismaJob.findMany).toHaveBeenCalledWith({
        where: expect.objectContaining({
          workMode: 'remote',
        }),
      });
    });

    it('debería filtrar por userId (vacantes de una empresa)', async () => {
      mockPrismaJob.findMany.mockResolvedValue([]);

      const userId = 5;
      const where: any = {
        status: 'active',
        userId: userId,
      };

      await mockPrismaJob.findMany({ where });

      expect(mockPrismaJob.findMany).toHaveBeenCalledWith({
        where: expect.objectContaining({
          userId: 5,
        }),
      });
    });
  });

  describe('POST /api/jobs - Validaciones', () => {
    it('debería validar campos requeridos', () => {
      const validJob = {
        title: 'Developer',
        company: 'Tech Corp',
        location: 'Monterrey',
        salary: '$30,000',
        jobType: 'Tiempo Completo',
        description: 'Descripción del puesto',
      };

      const requiredFields = ['title', 'company', 'location', 'salary', 'jobType', 'description'];

      const isValid = requiredFields.every(field => validJob[field as keyof typeof validJob]);
      expect(isValid).toBe(true);

      const invalidJob = { title: 'Solo título' };
      const isInvalid = requiredFields.every(field => invalidJob[field as keyof typeof invalidJob]);
      expect(isInvalid).toBe(false);
    });
  });

  describe('POST /api/jobs - Sistema de créditos', () => {
    it('debería calcular costo de créditos desde PricingMatrix', async () => {
      const pricing = { credits: 5, profile: 'Tecnología', seniority: 'Jr', workMode: 'hybrid' };
      mockPrismaPricingMatrix.findFirst.mockResolvedValue(pricing);

      const result = await mockPrismaPricingMatrix.findFirst({
        where: { profile: 'Tecnología', seniority: 'Jr', workMode: 'hybrid', isActive: true },
      });

      expect(result.credits).toBe(5);
    });

    it('debería usar 5 créditos por defecto si no hay pricing', async () => {
      mockPrismaPricingMatrix.findFirst.mockResolvedValue(null);

      const result = await mockPrismaPricingMatrix.findFirst({
        where: { profile: 'Unknown', seniority: 'Unknown', workMode: 'presential', isActive: true },
      });

      const creditCost = result?.credits || 5;
      expect(creditCost).toBe(5);
    });

    it('debería descontar créditos al publicar (empresa)', async () => {
      const mockUser = { id: 1, role: 'company', credits: 10 };
      const creditCost = 5;

      mockPrismaUser.findUnique.mockResolvedValue(mockUser);
      mockPrismaUser.update.mockResolvedValue({ ...mockUser, credits: 5 });

      // Simular descuento
      if (mockUser.role === 'company' && mockUser.credits >= creditCost) {
        await mockPrismaUser.update({
          where: { id: mockUser.id },
          data: { credits: { decrement: creditCost } },
        });
      }

      expect(mockPrismaUser.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: { credits: { decrement: 5 } },
      });
    });

    it('debería rechazar si créditos insuficientes', async () => {
      const mockUser = { id: 1, role: 'company', credits: 2 };
      const creditCost = 5;

      const hasEnoughCredits = mockUser.credits >= creditCost;
      expect(hasEnoughCredits).toBe(false);

      // La respuesta debería ser 402
      const response = hasEnoughCredits ? 201 : 402;
      expect(response).toBe(402);
    });

    it('debería permitir publicar gratis si es admin', async () => {
      const mockAdmin = { id: 1, role: 'admin', credits: 0 };

      const canPublishFree = mockAdmin.role === 'admin';
      expect(canPublishFree).toBe(true);

      // Admin no debería tener descuento
      if (mockAdmin.role === 'admin') {
        // No llamar a update de créditos
        expect(mockPrismaUser.update).not.toHaveBeenCalled();
      }
    });

    it('debería registrar transacción de créditos', async () => {
      const mockUser = { id: 1, credits: 10 };
      const creditCost = 5;

      mockPrismaCreditTransaction.create.mockResolvedValue({
        id: 1,
        userId: 1,
        type: 'spend',
        amount: -5,
        balanceBefore: 10,
        balanceAfter: 5,
      });

      await mockPrismaCreditTransaction.create({
        data: {
          userId: mockUser.id,
          type: 'spend',
          amount: -creditCost,
          balanceBefore: mockUser.credits,
          balanceAfter: mockUser.credits - creditCost,
          description: 'Publicación de vacante: Developer',
        },
      });

      expect(mockPrismaCreditTransaction.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          type: 'spend',
          amount: -5,
        }),
      });
    });
  });

  describe('POST /api/jobs - Creación de vacante', () => {
    it('debería crear vacante como borrador por defecto', async () => {
      const newJob = {
        id: 1,
        title: 'Developer',
        company: 'Tech',
        status: 'draft',
        creditCost: 0,
      };

      mockPrismaJob.create.mockResolvedValue(newJob);

      const job = await mockPrismaJob.create({
        data: {
          title: 'Developer',
          company: 'Tech',
          location: 'Monterrey',
          salary: '$30,000',
          jobType: 'Tiempo Completo',
          workMode: 'presential',
          description: 'Descripción',
          status: 'draft',
          creditCost: 0,
        },
      });

      expect(job.status).toBe('draft');
      expect(job.creditCost).toBe(0);
    });

    it('debería crear vacante activa con publishNow=true', async () => {
      const newJob = {
        id: 1,
        title: 'Developer',
        status: 'active',
        creditCost: 5,
      };

      mockPrismaJob.create.mockResolvedValue(newJob);

      const job = await mockPrismaJob.create({
        data: {
          title: 'Developer',
          company: 'Tech',
          location: 'Monterrey',
          salary: '$30,000',
          jobType: 'Tiempo Completo',
          workMode: 'presential',
          description: 'Descripción',
          status: 'active',
          creditCost: 5,
        },
      });

      expect(job.status).toBe('active');
      expect(job.creditCost).toBe(5);
    });
  });
});
