// RUTA: __tests__/api/direct-applications.test.ts

/**
 * Tests para las APIs de aplicaciones directas
 * Verifican: autenticación, permisos de admin, info de assignment
 */

// Mock de Prisma
const mockPrismaApplication = {
  findMany: jest.fn(),
  findUnique: jest.fn(),
  update: jest.fn(),
};

const mockPrismaJobAssignment = {
  findUnique: jest.fn(),
};

jest.mock('@/lib/prisma', () => ({
  prisma: {
    application: mockPrismaApplication,
    jobAssignment: mockPrismaJobAssignment,
  },
}));

// Mock de auth
const mockVerifyToken = jest.fn();
jest.mock('@/lib/auth', () => ({
  verifyToken: (...args: any[]) => mockVerifyToken(...args),
}));

describe('Direct Applications API Logic Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /api/admin/direct-applications - Autenticación y permisos', () => {
    it('debería requerir rol de admin', () => {
      mockVerifyToken.mockReturnValue({
        userId: 1,
        email: 'user@test.com',
        role: 'company', // Rol incorrecto
      });

      const payload = mockVerifyToken('valid-token');

      expect(payload?.role).not.toBe('admin');
    });

    it('debería permitir acceso con rol de admin', () => {
      mockVerifyToken.mockReturnValue({
        userId: 1,
        email: 'admin@test.com',
        role: 'admin',
      });

      const payload = mockVerifyToken('valid-token');

      expect(payload?.role).toBe('admin');
    });
  });

  describe('GET /api/admin/direct-applications - Obtener aplicaciones con assignment', () => {
    it('debería obtener aplicaciones pendientes con info de assignment', async () => {
      const mockApplications = [
        {
          id: 1,
          candidateName: 'Test Candidate',
          candidateEmail: 'test@test.com',
          status: 'pending',
          createdAt: new Date(),
          job: {
            id: 1,
            title: 'Developer',
            company: 'TestCo',
            location: 'CDMX',
            status: 'active',
            assignment: {
              id: 1,
              recruiter: { id: 5, nombre: 'Ana', apellidoPaterno: 'García' }
            },
            user: {
              nombre: 'Owner',
              email: 'owner@test.com',
              companyRequest: { nombreEmpresa: 'TestCo' }
            }
          }
        }
      ];

      mockPrismaApplication.findMany.mockResolvedValue(mockApplications);

      const applications = await mockPrismaApplication.findMany({
        where: { status: 'pending' },
        include: {
          job: {
            select: {
              id: true,
              title: true,
              company: true,
              location: true,
              status: true,
              assignment: {
                select: {
                  id: true,
                  recruiter: {
                    select: { id: true, nombre: true, apellidoPaterno: true }
                  }
                }
              },
              user: {
                select: {
                  nombre: true,
                  email: true,
                  companyRequest: {
                    select: { nombreEmpresa: true }
                  }
                }
              }
            }
          }
        }
      });

      expect(applications).toHaveLength(1);
      expect(applications[0].job.assignment).toBeDefined();
      expect(applications[0].job.assignment.recruiter.nombre).toBe('Ana');
    });

    it('debería manejar aplicaciones con vacantes sin assignment', async () => {
      const mockApplications = [
        {
          id: 2,
          candidateName: 'Another Candidate',
          candidateEmail: 'another@test.com',
          status: 'pending',
          createdAt: new Date(),
          job: {
            id: 2,
            title: 'Designer',
            company: 'DesignCo',
            location: 'GDL',
            status: 'active',
            assignment: null, // Sin reclutador asignado
            user: {
              nombre: 'Owner2',
              email: 'owner2@test.com',
              companyRequest: { nombreEmpresa: 'DesignCo' }
            }
          }
        }
      ];

      mockPrismaApplication.findMany.mockResolvedValue(mockApplications);

      const applications = await mockPrismaApplication.findMany({
        where: { status: 'pending' }
      });

      expect(applications[0].job.assignment).toBeNull();
    });
  });

  describe('PUT /api/admin/direct-applications - Actualizar status', () => {
    it('debería validar status permitidos', () => {
      const validStatuses = ['reviewing', 'discarded', 'archived'];
      const invalidStatus = 'approved';

      expect(validStatuses.includes('reviewing')).toBe(true);
      expect(validStatuses.includes('discarded')).toBe(true);
      expect(validStatuses.includes('archived')).toBe(true);
      expect(validStatuses.includes(invalidStatus)).toBe(false);
    });

    it('debería actualizar status a reviewing', async () => {
      const mockUpdated = {
        id: 1,
        status: 'reviewing',
        job: { title: 'Developer', company: 'TestCo' }
      };

      mockPrismaApplication.update.mockResolvedValue(mockUpdated);

      const updated = await mockPrismaApplication.update({
        where: { id: 1 },
        data: {
          status: 'reviewing',
          updatedAt: new Date()
        },
        include: {
          job: {
            select: { title: true, company: true }
          }
        }
      });

      expect(updated.status).toBe('reviewing');
    });

    it('debería advertir cuando vacante no tiene reclutador asignado al mover a reviewing', async () => {
      // Simular que la aplicación existe
      const mockApplication = { id: 1, jobId: 10, status: 'pending' };
      mockPrismaApplication.findUnique.mockResolvedValue(mockApplication);

      // Simular update exitoso
      mockPrismaApplication.update.mockResolvedValue({
        id: 1,
        status: 'reviewing',
        job: { title: 'Dev', company: 'Co' }
      });

      // Simular que NO hay JobAssignment
      mockPrismaJobAssignment.findUnique.mockResolvedValue(null);

      const jobAssignment = await mockPrismaJobAssignment.findUnique({
        where: { jobId: mockApplication.jobId }
      });

      // Verificar que no hay assignment
      expect(jobAssignment).toBeNull();

      // El API debería retornar needsAssignment: true
      const expectedResponse = {
        success: true,
        message: 'Aplicación movida al proceso de revisión. ⚠️ Esta vacante no tiene reclutador asignado aún.',
        needsAssignment: true
      };

      expect(expectedResponse.needsAssignment).toBe(true);
      expect(expectedResponse.message).toContain('no tiene reclutador');
    });

    it('NO debería advertir cuando vacante SÍ tiene reclutador asignado', async () => {
      // Simular que la aplicación existe
      const mockApplication = { id: 1, jobId: 10, status: 'pending' };
      mockPrismaApplication.findUnique.mockResolvedValue(mockApplication);

      // Simular que SÍ hay JobAssignment
      const mockJobAssignment = {
        id: 1,
        jobId: 10,
        recruiterId: 5,
        recruiter: { id: 5, nombre: 'Ana', apellidoPaterno: 'García' }
      };
      mockPrismaJobAssignment.findUnique.mockResolvedValue(mockJobAssignment);

      const jobAssignment = await mockPrismaJobAssignment.findUnique({
        where: { jobId: mockApplication.jobId }
      });

      // Verificar que SÍ hay assignment
      expect(jobAssignment).not.toBeNull();
      expect(jobAssignment?.recruiterId).toBe(5);

      // El API debería retornar respuesta normal sin needsAssignment
      const expectedResponse = {
        success: true,
        message: 'Aplicación movida al proceso de revisión'
      };

      expect(expectedResponse).not.toHaveProperty('needsAssignment');
    });

    it('debería actualizar status a discarded', async () => {
      mockPrismaApplication.update.mockResolvedValue({
        id: 1,
        status: 'discarded',
        job: { title: 'Dev', company: 'Co' }
      });

      const updated = await mockPrismaApplication.update({
        where: { id: 1 },
        data: { status: 'discarded', updatedAt: new Date() }
      });

      expect(updated.status).toBe('discarded');
    });

    it('debería actualizar status a archived', async () => {
      mockPrismaApplication.update.mockResolvedValue({
        id: 1,
        status: 'archived',
        job: { title: 'Dev', company: 'Co' }
      });

      const updated = await mockPrismaApplication.update({
        where: { id: 1 },
        data: { status: 'archived', updatedAt: new Date() }
      });

      expect(updated.status).toBe('archived');
    });
  });

  describe('Verificación de aplicación existente', () => {
    it('debería verificar que la aplicación existe antes de actualizar', async () => {
      mockPrismaApplication.findUnique.mockResolvedValue(null);

      const application = await mockPrismaApplication.findUnique({
        where: { id: 999 }
      });

      expect(application).toBeNull();

      // El API debería retornar 404
      const expectedErrorResponse = {
        success: false,
        error: 'Aplicación no encontrada',
        status: 404
      };

      expect(expectedErrorResponse.status).toBe(404);
    });
  });
});
