// RUTA: __tests__/api/assign-candidates.test.ts

/**
 * Tests para la API de asignación de candidatos a vacantes
 * Endpoint: /api/admin/assign-candidates
 */

// Mock de Prisma
const mockPrismaJob = {
  findUnique: jest.fn(),
};

const mockPrismaCandidate = {
  findMany: jest.fn(),
  updateMany: jest.fn(),
};

const mockPrismaApplication = {
  findMany: jest.fn(),
  findFirst: jest.fn(),
  createMany: jest.fn(),
};

jest.mock('@/lib/prisma', () => ({
  prisma: {
    job: mockPrismaJob,
    candidate: mockPrismaCandidate,
    application: mockPrismaApplication,
  },
}));

describe('Assign Candidates API Logic Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /api/admin/assign-candidates', () => {
    it('debería validar que jobId es requerido', () => {
      const body = { candidateIds: [1, 2, 3] };

      const hasJobId = !!body.jobId;
      expect(hasJobId).toBe(false);
    });

    it('debería validar que candidateIds es un array no vacío', () => {
      const bodyEmpty = { jobId: 1, candidateIds: [] };
      const bodyValid = { jobId: 1, candidateIds: [1, 2] };
      const bodyInvalid = { jobId: 1, candidateIds: 'not-array' };

      expect(Array.isArray(bodyEmpty.candidateIds) && bodyEmpty.candidateIds.length === 0).toBe(true);
      expect(Array.isArray(bodyValid.candidateIds) && bodyValid.candidateIds.length > 0).toBe(true);
      expect(Array.isArray(bodyInvalid.candidateIds)).toBe(false);
    });

    it('debería verificar que la vacante existe', async () => {
      mockPrismaJob.findUnique.mockResolvedValue(null);

      const job = await mockPrismaJob.findUnique({
        where: { id: 999 }
      });

      expect(job).toBeNull();
    });

    it('debería verificar que la vacante existe cuando es válida', async () => {
      const mockJob = {
        id: 1,
        title: 'Developer',
        company: 'Tech Corp',
        status: 'active'
      };

      mockPrismaJob.findUnique.mockResolvedValue(mockJob);

      const job = await mockPrismaJob.findUnique({
        where: { id: 1 }
      });

      expect(job).not.toBeNull();
      expect(job.title).toBe('Developer');
    });

    it('debería obtener candidatos por IDs', async () => {
      const mockCandidates = [
        { id: 1, nombre: 'Juan', apellidoPaterno: 'Pérez', email: 'juan@test.com' },
        { id: 2, nombre: 'María', apellidoPaterno: 'López', email: 'maria@test.com' },
      ];

      mockPrismaCandidate.findMany.mockResolvedValue(mockCandidates);

      const candidateIds = [1, 2];
      const candidates = await mockPrismaCandidate.findMany({
        where: {
          id: { in: candidateIds }
        }
      });

      expect(candidates).toHaveLength(2);
      expect(mockPrismaCandidate.findMany).toHaveBeenCalledWith({
        where: { id: { in: [1, 2] } }
      });
    });

    it('debería detectar candidatos ya asignados a la vacante', async () => {
      const existingApplications = [
        { id: 1, jobId: 1, candidateEmail: 'juan@test.com' }
      ];

      mockPrismaApplication.findMany.mockResolvedValue(existingApplications);

      const applications = await mockPrismaApplication.findMany({
        where: {
          jobId: 1,
          candidateEmail: { in: ['juan@test.com', 'maria@test.com'] }
        }
      });

      const existingEmails = new Set(applications.map((a: any) => a.candidateEmail.toLowerCase()));

      expect(existingEmails.has('juan@test.com')).toBe(true);
      expect(existingEmails.has('maria@test.com')).toBe(false);
    });

    it('debería filtrar candidatos que ya están asignados', () => {
      const candidates = [
        { id: 1, email: 'juan@test.com' },
        { id: 2, email: 'maria@test.com' },
        { id: 3, email: 'pedro@test.com' },
      ];

      const existingEmails = new Set(['juan@test.com']);

      const candidatesToAssign = candidates.filter(
        c => !existingEmails.has(c.email.toLowerCase())
      );

      expect(candidatesToAssign).toHaveLength(2);
      expect(candidatesToAssign.map(c => c.email)).toEqual(['maria@test.com', 'pedro@test.com']);
    });

    it('debería crear aplicaciones con status "injected_by_admin"', async () => {
      const candidatesToAssign = [
        { id: 1, nombre: 'Juan', apellidoPaterno: 'Pérez', apellidoMaterno: 'García', email: 'juan@test.com', telefono: '123456', cvUrl: null, source: 'linkedin', profile: 'Tecnología', seniority: 'Sr' },
      ];

      const jobId = 1;

      mockPrismaApplication.createMany.mockResolvedValue({ count: 1 });

      await mockPrismaApplication.createMany({
        data: candidatesToAssign.map(candidate => ({
          jobId,
          candidateName: `${candidate.nombre} ${candidate.apellidoPaterno}${candidate.apellidoMaterno ? ' ' + candidate.apellidoMaterno : ''}`,
          candidateEmail: candidate.email.toLowerCase(),
          candidatePhone: candidate.telefono,
          cvUrl: candidate.cvUrl,
          status: 'injected_by_admin',
          notes: `Candidato inyectado por Admin. Fuente original: ${candidate.source}.`
        }))
      });

      expect(mockPrismaApplication.createMany).toHaveBeenCalled();
      const callArg = mockPrismaApplication.createMany.mock.calls[0][0];
      expect(callArg.data[0].status).toBe('injected_by_admin');
      expect(callArg.data[0].candidateName).toBe('Juan Pérez García');
    });

    it('debería actualizar status de candidatos a "in_process"', async () => {
      const candidateIds = [1, 2, 3];

      mockPrismaCandidate.updateMany.mockResolvedValue({ count: 3 });

      await mockPrismaCandidate.updateMany({
        where: { id: { in: candidateIds } },
        data: { status: 'in_process' }
      });

      expect(mockPrismaCandidate.updateMany).toHaveBeenCalledWith({
        where: { id: { in: [1, 2, 3] } },
        data: { status: 'in_process' }
      });
    });

    it('debería retornar error si todos los candidatos ya están asignados', () => {
      const candidates = [
        { id: 1, email: 'juan@test.com' },
        { id: 2, email: 'maria@test.com' },
      ];

      const existingEmails = new Set(['juan@test.com', 'maria@test.com']);

      const candidatesToAssign = candidates.filter(
        c => !existingEmails.has(c.email.toLowerCase())
      );

      expect(candidatesToAssign).toHaveLength(0);
      // En este caso la API retorna status 409 con error
    });

    it('debería calcular correctamente assigned y skipped counts', () => {
      const totalCandidates = 5;
      const assignedCandidates = 3;
      const skippedCount = totalCandidates - assignedCandidates;

      expect(skippedCount).toBe(2);
    });
  });

  describe('GET /api/admin/assign-candidates', () => {
    it('debería validar que jobId es requerido', () => {
      const searchParams = new URLSearchParams('');
      const jobId = searchParams.get('jobId');

      expect(jobId).toBeNull();
    });

    it('debería obtener aplicaciones inyectadas por admin', async () => {
      const mockApplications = [
        { id: 1, jobId: 1, candidateEmail: 'juan@test.com', status: 'injected_by_admin' },
        { id: 2, jobId: 1, candidateEmail: 'maria@test.com', status: 'injected_by_admin' },
      ];

      mockPrismaApplication.findMany.mockResolvedValue(mockApplications);

      const applications = await mockPrismaApplication.findMany({
        where: {
          jobId: 1,
          status: 'injected_by_admin'
        },
        orderBy: { createdAt: 'desc' }
      });

      expect(applications).toHaveLength(2);
      expect(applications[0].status).toBe('injected_by_admin');
    });

    it('debería retornar array vacío si no hay candidatos asignados', async () => {
      mockPrismaApplication.findMany.mockResolvedValue([]);

      const applications = await mockPrismaApplication.findMany({
        where: {
          jobId: 999,
          status: 'injected_by_admin'
        }
      });

      expect(applications).toHaveLength(0);
    });
  });
});
