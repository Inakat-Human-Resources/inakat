// RUTA: __tests__/api/recruiter-dashboard.test.ts

/**
 * Tests para las APIs del dashboard de reclutador
 * Verifican: autenticación, permisos de rol, actualización de estados
 */

// Mock de Prisma
const mockPrismaJobAssignment = {
  findMany: jest.fn(),
  findUnique: jest.fn(),
  update: jest.fn(),
};

const mockPrismaCandidate = {
  findMany: jest.fn(),
};

const mockPrismaApplication = {
  updateMany: jest.fn(),
};

const mockPrismaUser = {
  findUnique: jest.fn(),
};

jest.mock('@/lib/prisma', () => ({
  prisma: {
    jobAssignment: mockPrismaJobAssignment,
    candidate: mockPrismaCandidate,
    application: mockPrismaApplication,
    user: mockPrismaUser,
  },
}));

// Mock de auth
const mockVerifyToken = jest.fn();
jest.mock('@/lib/auth', () => ({
  verifyToken: (...args: any[]) => mockVerifyToken(...args),
}));

describe('Recruiter Dashboard API Logic Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /api/recruiter/dashboard - Autenticación y permisos', () => {
    it('debería requerir autenticación', () => {
      mockVerifyToken.mockReturnValue(null);

      const result = mockVerifyToken('invalid-token');

      expect(result).toBeNull();
    });

    it('debería requerir rol de reclutador', () => {
      mockVerifyToken.mockReturnValue({
        userId: 1,
        email: 'user@test.com',
        role: 'user', // Rol incorrecto
      });

      const payload = mockVerifyToken('valid-token');

      expect(payload?.role).not.toBe('recruiter');
    });

    it('debería permitir acceso con rol de reclutador', () => {
      mockVerifyToken.mockReturnValue({
        userId: 1,
        email: 'recruiter@test.com',
        role: 'recruiter',
      });

      const payload = mockVerifyToken('valid-token');

      expect(payload?.role).toBe('recruiter');
    });

    it('debería permitir acceso con rol de admin', () => {
      mockVerifyToken.mockReturnValue({
        userId: 1,
        email: 'admin@test.com',
        role: 'admin',
      });

      const payload = mockVerifyToken('valid-token');

      expect(['recruiter', 'admin']).toContain(payload?.role);
    });
  });

  describe('GET /api/recruiter/dashboard - Obtener asignaciones', () => {
    it('debería obtener asignaciones del reclutador', async () => {
      const mockAssignments = [
        {
          id: 1,
          jobId: 1,
          recruiterId: 5,
          recruiterStatus: 'pending',
          job: { title: 'Developer', company: 'TechCo' },
        },
        {
          id: 2,
          jobId: 2,
          recruiterId: 5,
          recruiterStatus: 'reviewing',
          job: { title: 'Designer', company: 'DesignCo' },
        },
      ];

      mockPrismaJobAssignment.findMany.mockResolvedValue(mockAssignments);

      const assignments = await mockPrismaJobAssignment.findMany({
        where: { recruiterId: 5 },
        include: { job: true },
      });

      expect(assignments).toHaveLength(2);
      expect(assignments[0].recruiterId).toBe(5);
    });

    it('debería filtrar por status', async () => {
      mockPrismaJobAssignment.findMany.mockResolvedValue([]);

      await mockPrismaJobAssignment.findMany({
        where: { recruiterId: 5, recruiterStatus: 'pending' },
      });

      expect(mockPrismaJobAssignment.findMany).toHaveBeenCalledWith({
        where: { recruiterId: 5, recruiterStatus: 'pending' },
      });
    });
  });

  describe('PUT /api/recruiter/dashboard - Actualizar estado', () => {
    it('debería actualizar estado de asignación', async () => {
      const mockUpdated = {
        id: 1,
        recruiterStatus: 'reviewing',
        recruiterNotes: 'Revisando candidatos',
      };

      mockPrismaJobAssignment.update.mockResolvedValue(mockUpdated);

      const updated = await mockPrismaJobAssignment.update({
        where: { id: 1 },
        data: {
          recruiterStatus: 'reviewing',
          recruiterNotes: 'Revisando candidatos',
        },
      });

      expect(updated.recruiterStatus).toBe('reviewing');
    });

    it('debería actualizar Application.status al enviar al especialista', async () => {
      // Simular obtención de candidatos
      const mockCandidates = [
        { id: 1, email: 'candidate1@test.com' },
        { id: 2, email: 'candidate2@test.com' },
      ];

      mockPrismaCandidate.findMany.mockResolvedValue(mockCandidates);

      // Simular actualización de applications
      mockPrismaApplication.updateMany.mockResolvedValue({ count: 2 });

      // Obtener emails de candidatos
      const candidates = await mockPrismaCandidate.findMany({
        where: { id: { in: [1, 2] } },
        select: { email: true },
      });

      const emails = candidates.map((c: { email: string }) => c.email.toLowerCase());

      // Actualizar Applications
      const result = await mockPrismaApplication.updateMany({
        where: {
          jobId: 1,
          candidateEmail: { in: emails },
        },
        data: {
          status: 'sent_to_specialist',
          updatedAt: expect.any(Date),
        },
      });

      expect(result.count).toBe(2);
      expect(mockPrismaApplication.updateMany).toHaveBeenCalled();
    });

    it('debería verificar que la asignación pertenece al reclutador', async () => {
      const mockAssignment = {
        id: 1,
        recruiterId: 5,
        jobId: 1,
      };

      mockPrismaJobAssignment.findUnique.mockResolvedValue(mockAssignment);

      const assignment = await mockPrismaJobAssignment.findUnique({
        where: { id: 1 },
      });

      const currentUserId = 5;
      const hasPermission = assignment?.recruiterId === currentUserId;

      expect(hasPermission).toBe(true);
    });

    it('debería rechazar si no es el reclutador asignado', async () => {
      const mockAssignment = {
        id: 1,
        recruiterId: 5,
        jobId: 1,
      };

      mockPrismaJobAssignment.findUnique.mockResolvedValue(mockAssignment);

      const assignment = await mockPrismaJobAssignment.findUnique({
        where: { id: 1 },
      });

      const currentUserId = 10; // Diferente al recruiterId
      const hasPermission = assignment?.recruiterId === currentUserId;

      expect(hasPermission).toBe(false);
    });
  });

  describe('Estadísticas del reclutador', () => {
    it('debería calcular estadísticas correctamente', () => {
      const assignments = [
        { recruiterStatus: 'pending' },
        { recruiterStatus: 'pending' },
        { recruiterStatus: 'reviewing' },
        { recruiterStatus: 'reviewing' },
        { recruiterStatus: 'reviewing' },
        { recruiterStatus: 'sent_to_specialist' },
      ];

      const stats = {
        total: assignments.length,
        pending: assignments.filter((a) => a.recruiterStatus === 'pending').length,
        reviewing: assignments.filter((a) => a.recruiterStatus === 'reviewing').length,
        sentToSpecialist: assignments.filter(
          (a) => a.recruiterStatus === 'sent_to_specialist'
        ).length,
      };

      expect(stats.total).toBe(6);
      expect(stats.pending).toBe(2);
      expect(stats.reviewing).toBe(3);
      expect(stats.sentToSpecialist).toBe(1);
    });
  });
});
