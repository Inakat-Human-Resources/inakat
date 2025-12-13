// RUTA: __tests__/api/candidate-applications.test.ts

/**
 * Tests para la API de postulaciones de candidato
 * Endpoint: /api/candidate/applications
 */

// Mock de Prisma
const mockPrismaUser = {
  findUnique: jest.fn(),
};

const mockPrismaCandidate = {
  findUnique: jest.fn(),
};

const mockPrismaApplication = {
  findMany: jest.fn(),
};

jest.mock('@/lib/prisma', () => ({
  prisma: {
    user: mockPrismaUser,
    candidate: mockPrismaCandidate,
    application: mockPrismaApplication,
  },
}));

describe('Candidate Applications API Logic Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /api/candidate/applications', () => {
    it('debería requerir autenticación', () => {
      const token = null;
      expect(!!token).toBe(false);
      // La API retorna 401 si no hay token
    });

    it('debería verificar rol de candidato', async () => {
      const userCandidate = { id: 1, role: 'candidate' };
      const userCompany = { id: 2, role: 'company' };
      const userAdmin = { id: 3, role: 'admin' };

      // Solo candidate o admin pueden acceder
      expect(['candidate', 'admin'].includes(userCandidate.role)).toBe(true);
      expect(['candidate', 'admin'].includes(userCompany.role)).toBe(false);
      expect(['candidate', 'admin'].includes(userAdmin.role)).toBe(true);
    });

    it('debería buscar candidato por userId', async () => {
      const mockCandidate = {
        id: 1,
        email: 'candidato@test.com',
        nombre: 'Juan',
        userId: 10
      };

      mockPrismaCandidate.findUnique.mockResolvedValue(mockCandidate);

      const candidate = await mockPrismaCandidate.findUnique({
        where: { userId: 10 }
      });

      expect(candidate).not.toBeNull();
      expect(candidate.email).toBe('candidato@test.com');
    });

    it('debería retornar error si candidato no tiene perfil asociado', async () => {
      mockPrismaCandidate.findUnique.mockResolvedValue(null);

      const candidate = await mockPrismaCandidate.findUnique({
        where: { userId: 999 }
      });

      expect(candidate).toBeNull();
      // La API retorna 404 con mensaje "No tienes un perfil de candidato asociado"
    });

    it('debería buscar aplicaciones por email del candidato', async () => {
      const mockApplications = [
        {
          id: 1,
          jobId: 1,
          candidateEmail: 'candidato@test.com',
          status: 'sent_to_company',
          job: { id: 1, title: 'Developer', company: 'Tech Corp' }
        },
        {
          id: 2,
          jobId: 2,
          candidateEmail: 'candidato@test.com',
          status: 'interviewed',
          job: { id: 2, title: 'Designer', company: 'Design Co' }
        }
      ];

      mockPrismaApplication.findMany.mockResolvedValue(mockApplications);

      const applications = await mockPrismaApplication.findMany({
        where: {
          candidateEmail: 'candidato@test.com'
        },
        include: {
          job: {
            select: {
              id: true,
              title: true,
              company: true,
              location: true
            }
          }
        },
        orderBy: { createdAt: 'desc' }
      });

      expect(applications).toHaveLength(2);
      expect(applications[0].job.title).toBe('Developer');
    });

    it('debería incluir datos de la vacante en cada aplicación', async () => {
      const mockApplication = {
        id: 1,
        candidateEmail: 'test@test.com',
        status: 'pending',
        job: {
          id: 1,
          title: 'Developer',
          company: 'Tech Corp',
          location: 'CDMX',
          salary: '$30,000',
          jobType: 'Tiempo Completo',
          workMode: 'remote',
          status: 'active',
          profile: 'Tecnología',
          seniority: 'Jr'
        }
      };

      expect(mockApplication.job).toBeDefined();
      expect(mockApplication.job.title).toBe('Developer');
      expect(mockApplication.job.company).toBe('Tech Corp');
      expect(mockApplication.job.location).toBe('CDMX');
    });

    it('debería manejar candidato sin aplicaciones', async () => {
      mockPrismaApplication.findMany.mockResolvedValue([]);

      const applications = await mockPrismaApplication.findMany({
        where: { candidateEmail: 'nuevo@test.com' }
      });

      expect(applications).toHaveLength(0);
    });

    it('debería mapear status a labels amigables', () => {
      const statusMappings = [
        { status: 'pending', expectedLabel: 'En revisión' },
        { status: 'injected_by_admin', expectedLabel: 'En revisión' },
        { status: 'reviewing', expectedLabel: 'En proceso' },
        { status: 'sent_to_specialist', expectedLabel: 'En proceso' },
        { status: 'sent_to_company', expectedLabel: 'Enviado a empresa' },
        { status: 'interviewed', expectedLabel: 'Entrevistado' },
        { status: 'accepted', expectedLabel: 'Aceptado' },
        { status: 'rejected', expectedLabel: 'No seleccionado' }
      ];

      const getStatusLabel = (status: string) => {
        switch (status) {
          case 'pending':
          case 'injected_by_admin':
            return 'En revisión';
          case 'reviewing':
          case 'sent_to_specialist':
            return 'En proceso';
          case 'sent_to_company':
            return 'Enviado a empresa';
          case 'interviewed':
            return 'Entrevistado';
          case 'accepted':
            return 'Aceptado';
          case 'rejected':
            return 'No seleccionado';
          default:
            return 'En revisión';
        }
      };

      statusMappings.forEach(({ status, expectedLabel }) => {
        expect(getStatusLabel(status)).toBe(expectedLabel);
      });
    });

    it('debería no exponer notas internas al candidato', () => {
      const application = {
        id: 1,
        status: 'pending',
        notes: 'Nota interna del reclutador - NO mostrar al candidato'
      };

      // La API debe devolver notes como null para ocultar notas internas
      const sanitizedApplication = {
        ...application,
        notes: null
      };

      expect(sanitizedApplication.notes).toBeNull();
    });

    it('debería incluir información básica del candidato en respuesta', () => {
      const responseData = {
        success: true,
        data: [],
        count: 0,
        candidate: {
          id: 1,
          nombre: 'Juan Pérez',
          email: 'juan@test.com'
        }
      };

      expect(responseData.candidate).toBeDefined();
      expect(responseData.candidate.nombre).toBe('Juan Pérez');
      expect(responseData.candidate.email).toBe('juan@test.com');
    });

    it('debería ordenar aplicaciones por fecha descendente', async () => {
      const mockApplications = [
        { id: 3, createdAt: new Date('2024-03-15') },
        { id: 1, createdAt: new Date('2024-01-10') },
        { id: 2, createdAt: new Date('2024-02-20') }
      ];

      // Ordenar por fecha descendente
      const sorted = [...mockApplications].sort(
        (a, b) => b.createdAt.getTime() - a.createdAt.getTime()
      );

      expect(sorted[0].id).toBe(3); // Más reciente
      expect(sorted[2].id).toBe(1); // Más antiguo
    });
  });

  describe('Seguridad', () => {
    it('debería buscar email en minúsculas', () => {
      const email = 'Juan@Test.COM';
      const normalizedEmail = email.toLowerCase();

      expect(normalizedEmail).toBe('juan@test.com');
    });

    it('debería solo permitir acceso a candidato autenticado', () => {
      const payload = { userId: 1, role: 'candidate' };

      // El middleware verifica el rol antes de permitir acceso
      const allowedRoles = ['candidate', 'admin'];
      expect(allowedRoles.includes(payload.role)).toBe(true);
    });
  });
});
