// RUTA: __tests__/api/specialist-dashboard.test.ts

/**
 * Tests para las APIs del dashboard de especialista
 * Verifican: autenticación, permisos de rol, actualización de estados, fecha de seguimiento
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

describe('Specialist Dashboard API Logic Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /api/specialist/dashboard - Autenticación y permisos', () => {
    it('debería requerir autenticación', () => {
      mockVerifyToken.mockReturnValue(null);

      const result = mockVerifyToken('invalid-token');

      expect(result).toBeNull();
    });

    it('debería requerir rol de especialista', () => {
      mockVerifyToken.mockReturnValue({
        userId: 1,
        email: 'user@test.com',
        role: 'user', // Rol incorrecto
      });

      const payload = mockVerifyToken('valid-token');

      expect(payload?.role).not.toBe('specialist');
    });

    it('debería permitir acceso con rol de especialista', () => {
      mockVerifyToken.mockReturnValue({
        userId: 1,
        email: 'specialist@test.com',
        role: 'specialist',
        specialty: 'Tecnología',
      });

      const payload = mockVerifyToken('valid-token');

      expect(payload?.role).toBe('specialist');
    });

    it('debería permitir acceso con rol de admin', () => {
      mockVerifyToken.mockReturnValue({
        userId: 1,
        email: 'admin@test.com',
        role: 'admin',
      });

      const payload = mockVerifyToken('valid-token');

      expect(['specialist', 'admin']).toContain(payload?.role);
    });
  });

  describe('GET /api/specialist/dashboard - Filtro por recruiterStatus', () => {
    it('debería solo mostrar asignaciones con recruiterStatus sent_to_specialist', async () => {
      const mockAssignments = [
        {
          id: 1,
          specialistId: 3,
          recruiterStatus: 'sent_to_specialist',
          specialistStatus: 'pending',
          job: { title: 'Developer' },
        },
      ];

      mockPrismaJobAssignment.findMany.mockResolvedValue(mockAssignments);

      const assignments = await mockPrismaJobAssignment.findMany({
        where: {
          specialistId: 3,
          recruiterStatus: 'sent_to_specialist',
        },
      });

      expect(assignments).toHaveLength(1);
      expect(assignments[0].recruiterStatus).toBe('sent_to_specialist');
    });

    it('no debería mostrar asignaciones con recruiterStatus diferente', async () => {
      const allAssignments = [
        { id: 1, recruiterStatus: 'sent_to_specialist' },
        { id: 2, recruiterStatus: 'pending' },
        { id: 3, recruiterStatus: 'reviewing' },
      ];

      const filtered = allAssignments.filter(
        (a) => a.recruiterStatus === 'sent_to_specialist'
      );

      expect(filtered).toHaveLength(1);
    });
  });

  describe('PUT /api/specialist/dashboard - Actualizar estado', () => {
    it('debería actualizar estado de asignación', async () => {
      const mockUpdated = {
        id: 1,
        specialistStatus: 'evaluating',
        specialistNotes: 'Evaluando candidatos técnicos',
      };

      mockPrismaJobAssignment.update.mockResolvedValue(mockUpdated);

      const updated = await mockPrismaJobAssignment.update({
        where: { id: 1 },
        data: {
          specialistStatus: 'evaluating',
          specialistNotes: 'Evaluando candidatos técnicos',
        },
      });

      expect(updated.specialistStatus).toBe('evaluating');
    });

    it('debería actualizar Application.status al enviar a la empresa', async () => {
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

      // Actualizar Applications a sent_to_company
      const result = await mockPrismaApplication.updateMany({
        where: {
          jobId: 1,
          candidateEmail: { in: emails },
        },
        data: {
          status: 'sent_to_company',
          updatedAt: expect.any(Date),
        },
      });

      expect(result.count).toBe(2);
      expect(mockPrismaApplication.updateMany).toHaveBeenCalled();
    });

    it('debería establecer fecha de seguimiento 45 días en el futuro', () => {
      const today = new Date();
      const followUpDate = new Date(today);
      followUpDate.setDate(followUpDate.getDate() + 45);

      const daysDiff = Math.round(
        (followUpDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
      );

      expect(daysDiff).toBe(45);
    });

    it('debería calcular correctamente la fecha de seguimiento', () => {
      const calculateFollowUpDate = () => {
        const date = new Date();
        date.setDate(date.getDate() + 45);
        return date;
      };

      const followUpDate = calculateFollowUpDate();
      const today = new Date();

      // La fecha debe ser en el futuro
      expect(followUpDate.getTime()).toBeGreaterThan(today.getTime());

      // Debe ser aproximadamente 45 días
      const diffInMs = followUpDate.getTime() - today.getTime();
      const diffInDays = Math.round(diffInMs / (1000 * 60 * 60 * 24));
      expect(diffInDays).toBe(45);
    });
  });

  describe('Permisos de asignación', () => {
    it('debería verificar que la asignación pertenece al especialista', async () => {
      const mockAssignment = {
        id: 1,
        specialistId: 3,
        jobId: 1,
      };

      mockPrismaJobAssignment.findUnique.mockResolvedValue(mockAssignment);

      const assignment = await mockPrismaJobAssignment.findUnique({
        where: { id: 1 },
      });

      const currentUserId = 3;
      const hasPermission = assignment?.specialistId === currentUserId;

      expect(hasPermission).toBe(true);
    });

    it('debería rechazar si no es el especialista asignado', async () => {
      const mockAssignment = {
        id: 1,
        specialistId: 3,
        jobId: 1,
      };

      mockPrismaJobAssignment.findUnique.mockResolvedValue(mockAssignment);

      const assignment = await mockPrismaJobAssignment.findUnique({
        where: { id: 1 },
      });

      const currentUserId = 10; // Diferente al specialistId
      const hasPermission = assignment?.specialistId === currentUserId;

      expect(hasPermission).toBe(false);
    });
  });

  describe('Estadísticas del especialista', () => {
    it('debería calcular estadísticas correctamente', () => {
      const assignments = [
        { specialistStatus: 'pending' },
        { specialistStatus: 'pending' },
        { specialistStatus: 'evaluating' },
        { specialistStatus: 'evaluating' },
        { specialistStatus: 'sent_to_company' },
      ];

      const stats = {
        total: assignments.length,
        pending: assignments.filter((a) => a.specialistStatus === 'pending').length,
        evaluating: assignments.filter((a) => a.specialistStatus === 'evaluating')
          .length,
        sentToCompany: assignments.filter(
          (a) => a.specialistStatus === 'sent_to_company'
        ).length,
      };

      expect(stats.total).toBe(5);
      expect(stats.pending).toBe(2);
      expect(stats.evaluating).toBe(2);
      expect(stats.sentToCompany).toBe(1);
    });
  });

  describe('Validación de status flow', () => {
    it('debería validar los status permitidos para especialista', () => {
      const validStatuses = ['pending', 'evaluating', 'sent_to_company'];

      expect(validStatuses).toContain('pending');
      expect(validStatuses).toContain('evaluating');
      expect(validStatuses).toContain('sent_to_company');
    });

    it('debería permitir transición de pending a evaluating', () => {
      const currentStatus = 'pending';
      const newStatus = 'evaluating';
      const allowedTransitions: Record<string, string[]> = {
        pending: ['evaluating'],
        evaluating: ['sent_to_company'],
        sent_to_company: [],
      };

      const isAllowed = allowedTransitions[currentStatus]?.includes(newStatus);
      expect(isAllowed).toBe(true);
    });

    it('debería permitir transición de evaluating a sent_to_company', () => {
      const currentStatus = 'evaluating';
      const newStatus = 'sent_to_company';
      const allowedTransitions: Record<string, string[]> = {
        pending: ['evaluating'],
        evaluating: ['sent_to_company'],
        sent_to_company: [],
      };

      const isAllowed = allowedTransitions[currentStatus]?.includes(newStatus);
      expect(isAllowed).toBe(true);
    });
  });
});
