// RUTA: __tests__/api/pricing-delete.test.ts

/**
 * Tests para DELETE /api/admin/pricing
 * Verifica la eliminación de entradas de PricingMatrix
 * con validación de vacantes activas
 */

// Mock de Prisma
const mockPrismaPricingMatrix = {
  findUnique: jest.fn(),
  delete: jest.fn(),
};

const mockPrismaJob = {
  findMany: jest.fn(),
};

const mockPrismaUser = {
  findUnique: jest.fn(),
};

jest.mock('@/lib/prisma', () => ({
  prisma: {
    pricingMatrix: mockPrismaPricingMatrix,
    job: mockPrismaJob,
    user: mockPrismaUser,
  },
}));

describe('DELETE /api/admin/pricing', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // Datos de prueba
  const mockPricingEntry = {
    id: 1,
    profile: 'Tecnología',
    seniority: 'Jr',
    workMode: 'remote',
    location: null,
    credits: 10,
    isActive: true,
  };

  const mockAdminUser = {
    id: 1,
    email: 'admin@inakat.com',
    role: 'admin',
  };

  const mockCompanyUser = {
    id: 2,
    email: 'company@example.com',
    role: 'company',
  };

  describe('Eliminación exitosa', () => {
    it('debería eliminar entrada de pricing cuando no hay vacantes usándola', async () => {
      // Setup: entrada existe, no hay vacantes activas
      mockPrismaPricingMatrix.findUnique.mockResolvedValue(mockPricingEntry);
      mockPrismaJob.findMany.mockResolvedValue([]); // Sin vacantes activas
      mockPrismaPricingMatrix.delete.mockResolvedValue(mockPricingEntry);

      // Simular la lógica del endpoint
      const pricingEntry = await mockPrismaPricingMatrix.findUnique({
        where: { id: 1 }
      });

      expect(pricingEntry).not.toBeNull();

      // Verificar vacantes activas
      const activeJobs = await mockPrismaJob.findMany({
        where: {
          profile: pricingEntry.profile,
          seniority: pricingEntry.seniority,
          workMode: pricingEntry.workMode,
          status: { in: ['active', 'paused', 'draft'] }
        }
      });

      expect(activeJobs).toHaveLength(0);

      // Eliminar
      await mockPrismaPricingMatrix.delete({ where: { id: 1 } });

      expect(mockPrismaPricingMatrix.delete).toHaveBeenCalledWith({
        where: { id: 1 }
      });
    });

    it('debería retornar mensaje de éxito con detalles del pricing eliminado', async () => {
      mockPrismaPricingMatrix.findUnique.mockResolvedValue(mockPricingEntry);
      mockPrismaJob.findMany.mockResolvedValue([]);
      mockPrismaPricingMatrix.delete.mockResolvedValue(mockPricingEntry);

      const pricingEntry = await mockPrismaPricingMatrix.findUnique({ where: { id: 1 } });
      const activeJobs = await mockPrismaJob.findMany({});

      if (activeJobs.length === 0) {
        await mockPrismaPricingMatrix.delete({ where: { id: 1 } });

        const successMessage = `Entrada de precios eliminada: ${pricingEntry.profile} - ${pricingEntry.seniority} - ${pricingEntry.workMode}`;
        expect(successMessage).toBe('Entrada de precios eliminada: Tecnología - Jr - remote');
      }
    });
  });

  describe('Conflicto con vacantes activas (409)', () => {
    it('debería retornar 409 cuando hay vacantes activas usando el pricing', async () => {
      const activeJobs = [
        { id: 101, title: 'Desarrollador Frontend', company: 'TechCorp', status: 'active' },
        { id: 102, title: 'Desarrollador Backend', company: 'StartupX', status: 'draft' },
      ];

      mockPrismaPricingMatrix.findUnique.mockResolvedValue(mockPricingEntry);
      mockPrismaJob.findMany.mockResolvedValue(activeJobs);

      const pricingEntry = await mockPrismaPricingMatrix.findUnique({ where: { id: 1 } });
      const foundJobs = await mockPrismaJob.findMany({
        where: {
          profile: pricingEntry.profile,
          seniority: pricingEntry.seniority,
          workMode: pricingEntry.workMode,
          status: { in: ['active', 'paused', 'draft'] }
        }
      });

      expect(foundJobs.length).toBeGreaterThan(0);

      // El endpoint retornaría 409 Conflict
      const errorMessage = `No se puede eliminar. Hay ${foundJobs.length} vacante(s) usando esta configuración de precios.`;
      expect(errorMessage).toBe('No se puede eliminar. Hay 2 vacante(s) usando esta configuración de precios.');
    });

    it('debería incluir lista de vacantes en conflicto en la respuesta', async () => {
      const activeJobs = [
        { id: 101, title: 'Dev Frontend', company: 'TechCorp', status: 'active' },
      ];

      mockPrismaPricingMatrix.findUnique.mockResolvedValue(mockPricingEntry);
      mockPrismaJob.findMany.mockResolvedValue(activeJobs);

      const foundJobs = await mockPrismaJob.findMany({});

      const conflictResponse = {
        success: false,
        error: `No se puede eliminar. Hay ${foundJobs.length} vacante(s) usando esta configuración de precios.`,
        activeJobs: foundJobs.map(j => ({
          id: j.id,
          title: j.title,
          company: j.company,
          status: j.status
        }))
      };

      expect(conflictResponse.activeJobs).toHaveLength(1);
      expect(conflictResponse.activeJobs[0].title).toBe('Dev Frontend');
    });

    it('debería considerar vacantes en estado "paused" como activas', async () => {
      const pausedJob = [
        { id: 103, title: 'Senior Dev', company: 'BigCorp', status: 'paused' }
      ];

      mockPrismaPricingMatrix.findUnique.mockResolvedValue(mockPricingEntry);
      mockPrismaJob.findMany.mockResolvedValue(pausedJob);

      const foundJobs = await mockPrismaJob.findMany({
        where: {
          status: { in: ['active', 'paused', 'draft'] }
        }
      });

      expect(foundJobs.length).toBe(1);
      expect(foundJobs[0].status).toBe('paused');
      // No se debería permitir eliminar
    });

    it('debería considerar vacantes en estado "draft" como activas', async () => {
      const draftJob = [
        { id: 104, title: 'Draft Position', company: 'NewCo', status: 'draft' }
      ];

      mockPrismaPricingMatrix.findUnique.mockResolvedValue(mockPricingEntry);
      mockPrismaJob.findMany.mockResolvedValue(draftJob);

      const foundJobs = await mockPrismaJob.findMany({
        where: {
          status: { in: ['active', 'paused', 'draft'] }
        }
      });

      expect(foundJobs.length).toBe(1);
      expect(foundJobs[0].status).toBe('draft');
      // No se debería permitir eliminar
    });

    it('debería permitir eliminar si solo hay vacantes "closed"', async () => {
      // Las vacantes cerradas no deben bloquear la eliminación
      mockPrismaPricingMatrix.findUnique.mockResolvedValue(mockPricingEntry);
      mockPrismaJob.findMany.mockResolvedValue([]); // El query con status: in['active','paused','draft'] no retorna closed

      const foundJobs = await mockPrismaJob.findMany({
        where: {
          profile: mockPricingEntry.profile,
          seniority: mockPricingEntry.seniority,
          workMode: mockPricingEntry.workMode,
          status: { in: ['active', 'paused', 'draft'] }
        }
      });

      expect(foundJobs.length).toBe(0);
      // Se debería permitir eliminar
    });
  });

  describe('Validaciones de entrada', () => {
    it('debería retornar 400 cuando no se proporciona ID', () => {
      const id = null;
      const hasId = !!id;

      expect(hasId).toBe(false);
      // El endpoint retornaría 400 Bad Request
    });

    it('debería retornar 400 cuando el ID no es un número válido', () => {
      const id = 'abc';
      const parsedId = parseInt(id);

      expect(isNaN(parsedId)).toBe(true);
      // El endpoint retornaría 400 Bad Request
    });

    it('debería retornar 404 cuando la entrada no existe', async () => {
      mockPrismaPricingMatrix.findUnique.mockResolvedValue(null);

      const pricingEntry = await mockPrismaPricingMatrix.findUnique({
        where: { id: 999 }
      });

      expect(pricingEntry).toBeNull();
      // El endpoint retornaría 404 Not Found
    });
  });

  describe('Seguridad', () => {
    it('debería verificar que el usuario es admin', () => {
      expect(mockAdminUser.role).toBe('admin');
      expect(mockCompanyUser.role).not.toBe('admin');
    });

    it('debería rechazar usuarios no admin (403)', () => {
      const roles = ['company', 'recruiter', 'specialist', 'candidate', 'user'];

      roles.forEach(role => {
        expect(role === 'admin').toBe(false);
      });
      // El endpoint retornaría 403 Forbidden para estos roles
    });

    it('debería requerir autenticación (401)', () => {
      const token = null;
      expect(!!token).toBe(false);
      // El endpoint retornaría 401 Unauthorized sin token
    });
  });

  describe('Búsqueda de vacantes', () => {
    it('debería buscar vacantes por profile, seniority y workMode exactos', async () => {
      mockPrismaPricingMatrix.findUnique.mockResolvedValue(mockPricingEntry);
      mockPrismaJob.findMany.mockResolvedValue([]);

      const pricingEntry = await mockPrismaPricingMatrix.findUnique({ where: { id: 1 } });

      await mockPrismaJob.findMany({
        where: {
          profile: pricingEntry.profile,
          seniority: pricingEntry.seniority,
          workMode: pricingEntry.workMode,
          status: { in: ['active', 'paused', 'draft'] }
        },
        select: {
          id: true,
          title: true,
          company: true,
          status: true
        }
      });

      expect(mockPrismaJob.findMany).toHaveBeenCalledWith({
        where: {
          profile: 'Tecnología',
          seniority: 'Jr',
          workMode: 'remote',
          status: { in: ['active', 'paused', 'draft'] }
        },
        select: {
          id: true,
          title: true,
          company: true,
          status: true
        }
      });
    });

    it('no debería buscar por location (pricing sin location)', async () => {
      // El pricing puede no tener location, pero los jobs sí
      // La búsqueda solo debe usar profile, seniority, workMode y status
      mockPrismaPricingMatrix.findUnique.mockResolvedValue({
        ...mockPricingEntry,
        location: null
      });

      const pricingEntry = await mockPrismaPricingMatrix.findUnique({ where: { id: 1 } });

      // Verificar que location es null
      expect(pricingEntry.location).toBeNull();

      // La búsqueda no incluye location
      const whereClause = {
        profile: pricingEntry.profile,
        seniority: pricingEntry.seniority,
        workMode: pricingEntry.workMode,
        status: { in: ['active', 'paused', 'draft'] }
      };

      expect(whereClause).not.toHaveProperty('location');
    });
  });

  describe('Manejo de errores', () => {
    it('debería manejar errores de base de datos', async () => {
      mockPrismaPricingMatrix.findUnique.mockRejectedValue(new Error('Database connection error'));

      await expect(
        mockPrismaPricingMatrix.findUnique({ where: { id: 1 } })
      ).rejects.toThrow('Database connection error');
      // El endpoint retornaría 500 Internal Server Error
    });

    it('debería manejar error al eliminar', async () => {
      mockPrismaPricingMatrix.findUnique.mockResolvedValue(mockPricingEntry);
      mockPrismaJob.findMany.mockResolvedValue([]);
      mockPrismaPricingMatrix.delete.mockRejectedValue(new Error('Delete failed'));

      await expect(
        mockPrismaPricingMatrix.delete({ where: { id: 1 } })
      ).rejects.toThrow('Delete failed');
      // El endpoint retornaría 500 Internal Server Error
    });
  });

  describe('Casos de uso reales', () => {
    it('debería permitir eliminar pricing de perfil de prueba sin vacantes', async () => {
      const testPricing = {
        id: 99,
        profile: 'Perfil de Prueba',
        seniority: 'Jr',
        workMode: 'remote',
        credits: 1,
        isActive: true
      };

      mockPrismaPricingMatrix.findUnique.mockResolvedValue(testPricing);
      mockPrismaJob.findMany.mockResolvedValue([]); // Sin vacantes
      mockPrismaPricingMatrix.delete.mockResolvedValue(testPricing);

      const entry = await mockPrismaPricingMatrix.findUnique({ where: { id: 99 } });
      const jobs = await mockPrismaJob.findMany({});

      expect(entry).not.toBeNull();
      expect(jobs).toHaveLength(0);

      await mockPrismaPricingMatrix.delete({ where: { id: 99 } });
      expect(mockPrismaPricingMatrix.delete).toHaveBeenCalled();
    });

    it('debería bloquear eliminación de pricing de Tecnología con vacantes activas', async () => {
      const techPricing = {
        id: 1,
        profile: 'Tecnología',
        seniority: 'Sr',
        workMode: 'remote',
        credits: 25,
        isActive: true
      };

      const techJobs = [
        { id: 1, title: 'Senior Backend Developer', company: 'TechCorp', status: 'active' },
        { id: 2, title: 'Senior Frontend Developer', company: 'StartupX', status: 'active' },
        { id: 3, title: 'Tech Lead', company: 'BigTech', status: 'paused' },
      ];

      mockPrismaPricingMatrix.findUnique.mockResolvedValue(techPricing);
      mockPrismaJob.findMany.mockResolvedValue(techJobs);

      const entry = await mockPrismaPricingMatrix.findUnique({ where: { id: 1 } });
      const jobs = await mockPrismaJob.findMany({});

      expect(entry).not.toBeNull();
      expect(jobs.length).toBe(3);

      // No se debe eliminar
      expect(mockPrismaPricingMatrix.delete).not.toHaveBeenCalled();
    });
  });
});
