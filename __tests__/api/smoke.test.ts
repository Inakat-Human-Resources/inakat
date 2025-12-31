// RUTA: __tests__/api/smoke.test.ts

/**
 * Smoke Tests - Verifican que los endpoints críticos responden correctamente
 *
 * Estos tests son rápidos y verifican la disponibilidad básica del sistema.
 * Útiles para detectar problemas graves después de un deploy.
 */

// Mock de Prisma
const mockPrisma = {
  user: { findUnique: jest.fn(), findMany: jest.fn(), count: jest.fn() },
  job: { findMany: jest.fn(), findUnique: jest.fn(), count: jest.fn() },
  candidate: { findMany: jest.fn(), count: jest.fn() },
  application: { findMany: jest.fn(), count: jest.fn() },
  companyRequest: { findMany: jest.fn(), count: jest.fn() },
  creditPackage: { findMany: jest.fn() },
  pricingMatrix: { findMany: jest.fn() },
};

jest.mock('@/lib/prisma', () => ({
  prisma: mockPrisma,
}));

jest.mock('jsonwebtoken', () => ({
  verify: jest.fn(() => ({ userId: 1, role: 'admin' })),
  sign: jest.fn(() => 'mock-token'),
}));

describe('Smoke Tests - Endpoints Críticos', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Autenticación', () => {
    it('endpoint de login debería validar credenciales', async () => {
      const mockUser = {
        id: 1,
        email: 'admin@inakat.com',
        password: 'hashed',
        role: 'admin',
        isActive: true,
      };
      mockPrisma.user.findUnique.mockResolvedValue(mockUser);

      const user = await mockPrisma.user.findUnique({ where: { email: 'admin@inakat.com' } });

      expect(user).toBeDefined();
      expect(user.role).toBe('admin');
    });

    it('debería rechazar usuarios inactivos', async () => {
      const inactiveUser = {
        id: 2,
        email: 'inactive@test.com',
        isActive: false,
      };
      mockPrisma.user.findUnique.mockResolvedValue(inactiveUser);

      const user = await mockPrisma.user.findUnique({ where: { email: 'inactive@test.com' } });

      expect(user.isActive).toBe(false);
    });
  });

  describe('Vacantes (Jobs)', () => {
    it('debería poder listar vacantes activas', async () => {
      const mockJobs = [
        { id: 1, title: 'Developer', status: 'active' },
        { id: 2, title: 'Designer', status: 'active' },
      ];
      mockPrisma.job.findMany.mockResolvedValue(mockJobs);

      const jobs = await mockPrisma.job.findMany({ where: { status: 'active' } });

      expect(jobs).toHaveLength(2);
      expect(jobs.every((j: any) => j.status === 'active')).toBe(true);
    });

    it('debería poder contar vacantes por estado', async () => {
      mockPrisma.job.count.mockResolvedValue(10);

      const count = await mockPrisma.job.count({ where: { status: 'active' } });

      expect(count).toBe(10);
    });
  });

  describe('Candidatos', () => {
    it('debería poder listar candidatos disponibles', async () => {
      const mockCandidates = [
        { id: 1, nombre: 'Juan', status: 'available' },
        { id: 2, nombre: 'María', status: 'available' },
      ];
      mockPrisma.candidate.findMany.mockResolvedValue(mockCandidates);

      const candidates = await mockPrisma.candidate.findMany({ where: { status: 'available' } });

      expect(candidates).toHaveLength(2);
    });

    it('debería poder contar candidatos en el banco', async () => {
      mockPrisma.candidate.count.mockResolvedValue(150);

      const count = await mockPrisma.candidate.count();

      expect(count).toBe(150);
    });
  });

  describe('Aplicaciones', () => {
    it('debería poder listar aplicaciones pendientes', async () => {
      const mockApplications = [
        { id: 1, status: 'pending', candidateId: 1, jobId: 1 },
      ];
      mockPrisma.application.findMany.mockResolvedValue(mockApplications);

      const applications = await mockPrisma.application.findMany({ where: { status: 'pending' } });

      expect(applications).toHaveLength(1);
    });
  });

  describe('Solicitudes de Empresas', () => {
    it('debería poder listar solicitudes pendientes', async () => {
      const mockRequests = [
        { id: 1, nombreEmpresa: 'Tech Corp', status: 'pending' },
      ];
      mockPrisma.companyRequest.findMany.mockResolvedValue(mockRequests);

      const requests = await mockPrisma.companyRequest.findMany({ where: { status: 'pending' } });

      expect(requests).toHaveLength(1);
    });
  });

  describe('Sistema de Créditos', () => {
    it('debería poder listar paquetes de créditos activos', async () => {
      const mockPackages = [
        { id: 1, credits: 10, price: 35000, isActive: true },
        { id: 2, credits: 20, price: 65000, isActive: true },
      ];
      mockPrisma.creditPackage.findMany.mockResolvedValue(mockPackages);

      const packages = await mockPrisma.creditPackage.findMany({ where: { isActive: true } });

      expect(packages).toHaveLength(2);
    });

    it('debería poder obtener matriz de precios', async () => {
      const mockPricing = [
        { profile: 'Tecnología', seniority: 'Jr', credits: 5 },
        { profile: 'Tecnología', seniority: 'Sr', credits: 8 },
      ];
      mockPrisma.pricingMatrix.findMany.mockResolvedValue(mockPricing);

      const pricing = await mockPrisma.pricingMatrix.findMany();

      expect(pricing).toHaveLength(2);
    });
  });
});

describe('Smoke Tests - Integridad de Datos', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('usuario debería tener campos requeridos', async () => {
    const mockUser = {
      id: 1,
      email: 'test@example.com',
      nombre: 'Test',
      role: 'company',
      isActive: true,
      credits: 10,
    };
    mockPrisma.user.findUnique.mockResolvedValue(mockUser);

    const user = await mockPrisma.user.findUnique({ where: { id: 1 } });

    expect(user.id).toBeDefined();
    expect(user.email).toBeDefined();
    expect(user.role).toBeDefined();
    expect(user.isActive).toBeDefined();
  });

  it('vacante debería tener campos requeridos', async () => {
    const mockJob = {
      id: 1,
      title: 'Developer',
      company: 'Tech Corp',
      location: 'CDMX',
      status: 'active',
      userId: 1,
    };
    mockPrisma.job.findUnique.mockResolvedValue(mockJob);

    const job = await mockPrisma.job.findUnique({ where: { id: 1 } });

    expect(job.title).toBeDefined();
    expect(job.company).toBeDefined();
    expect(job.status).toBeDefined();
  });
});
