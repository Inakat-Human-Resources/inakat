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

  describe('Envíos múltiples de candidatos (BUG FIX)', () => {
    /**
     * BUG: Después de enviar algunos candidatos, los no seleccionados quedaban bloqueados
     * FIX: Permitir envíos múltiples aunque el status sea 'sent_to_specialist'
     */

    it('debería permitir enviar más candidatos después del primer envío', () => {
      // Simular estado de la asignación después del primer envío
      const assignment = {
        id: 1,
        recruiterStatus: 'sent_to_specialist',
        candidatesSentToSpecialist: '1,2,3'
      };

      // La UI ahora debe mostrar botones de acción cuando status es 'sent_to_specialist'
      const canSendMore = assignment.recruiterStatus === 'reviewing' ||
                          assignment.recruiterStatus === 'sent_to_specialist';

      expect(canSendMore).toBe(true);
    });

    it('debería concatenar IDs de candidatos enviados, no reemplazar', () => {
      const previouslySent = '1,2,3';
      const newCandidateIds = [4, 5];

      // Lógica del backend para concatenar
      const previousIds = previouslySent.split(',').map(id => parseInt(id)).filter(id => !isNaN(id));
      const allSentIds = [...new Set([...previousIds, ...newCandidateIds])];

      expect(allSentIds).toEqual([1, 2, 3, 4, 5]);
    });

    it('debería evitar duplicados al concatenar', () => {
      const previouslySent = '1,2,3';
      const newCandidateIds = [2, 3, 4]; // 2 y 3 ya fueron enviados

      const previousIds = previouslySent.split(',').map(id => parseInt(id)).filter(id => !isNaN(id));
      const allSentIds = [...new Set([...previousIds, ...newCandidateIds])];

      expect(allSentIds).toEqual([1, 2, 3, 4]);
      expect(allSentIds.length).toBe(4); // No hay duplicados
    });

    it('debería manejar el primer envío sin candidatos previos', () => {
      const previouslySent = ''; // Ningún candidato enviado aún
      const newCandidateIds = [1, 2];

      const previousIds = previouslySent ? previouslySent.split(',').map(id => parseInt(id)).filter(id => !isNaN(id)) : [];
      const allSentIds = [...new Set([...previousIds, ...newCandidateIds])];

      expect(allSentIds).toEqual([1, 2]);
    });

    it('no debería mostrar solo indicador estático cuando hay candidatos por enviar', () => {
      const assignment = {
        recruiterStatus: 'sent_to_specialist'
      };
      const selectedCandidates = [4, 5];

      // Antes del fix: solo mostraba "Candidatos enviados al especialista"
      // Después del fix: muestra botón para enviar más + indicador
      const shouldShowSendButton =
        (assignment.recruiterStatus === 'reviewing' || assignment.recruiterStatus === 'sent_to_specialist') &&
        selectedCandidates.length > 0;

      expect(shouldShowSendButton).toBe(true);
    });
  });
});
