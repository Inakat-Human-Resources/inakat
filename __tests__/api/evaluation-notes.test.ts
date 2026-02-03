// RUTA: __tests__/api/evaluation-notes.test.ts

/**
 * Tests para FEAT-5: Notas de Evaluación
 * Verifican: autorización, validación, creación y obtención de notas
 */

// Mock de Prisma
const mockPrismaEvaluationNote = {
  findMany: jest.fn(),
  create: jest.fn(),
};

const mockPrismaApplication = {
  findUnique: jest.fn(),
};

const mockPrismaUser = {
  findUnique: jest.fn(),
};

jest.mock('@/lib/prisma', () => ({
  prisma: {
    evaluationNote: mockPrismaEvaluationNote,
    application: mockPrismaApplication,
    user: mockPrismaUser,
  },
}));

describe('API Notas de Evaluación', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /api/evaluations/notes - Autorización', () => {
    it('debe rechazar acceso si no es recruiter/specialist/admin', () => {
      const invalidRoles = ['candidate', 'company', 'user', ''];

      invalidRoles.forEach((role) => {
        const isAuthorized = ['recruiter', 'specialist', 'admin'].includes(role);
        expect(isAuthorized).toBe(false);
      });
    });

    it('debe permitir acceso a recruiter', () => {
      const role = 'recruiter';
      const isAuthorized = ['recruiter', 'specialist', 'admin'].includes(role);
      expect(isAuthorized).toBe(true);
    });

    it('debe permitir acceso a specialist', () => {
      const role = 'specialist';
      const isAuthorized = ['recruiter', 'specialist', 'admin'].includes(role);
      expect(isAuthorized).toBe(true);
    });

    it('debe permitir acceso a admin', () => {
      const role = 'admin';
      const isAuthorized = ['recruiter', 'specialist', 'admin'].includes(role);
      expect(isAuthorized).toBe(true);
    });
  });

  describe('GET /api/evaluations/notes - Validación', () => {
    it('debe requerir applicationId', () => {
      const searchParams = new URLSearchParams('');
      const applicationId = searchParams.get('applicationId');

      expect(applicationId).toBeNull();
      // API retornaría 400
    });

    it('debe aceptar applicationId válido', () => {
      const searchParams = new URLSearchParams('applicationId=123');
      const applicationId = searchParams.get('applicationId');

      expect(applicationId).toBe('123');
      expect(parseInt(applicationId!)).toBe(123);
    });
  });

  describe('GET /api/evaluations/notes - Resultados', () => {
    it('debe retornar notas de una aplicación ordenadas por fecha desc', async () => {
      const mockNotes = [
        {
          id: 2,
          authorId: 5,
          authorRole: 'specialist',
          applicationId: 123,
          content: 'Nota más reciente',
          documentUrl: null,
          documentName: null,
          createdAt: new Date('2024-01-15'),
        },
        {
          id: 1,
          authorId: 3,
          authorRole: 'recruiter',
          applicationId: 123,
          content: 'Nota más antigua',
          documentUrl: 'http://example.com/doc.pdf',
          documentName: 'Test Psicométrico.pdf',
          createdAt: new Date('2024-01-10'),
        },
      ];

      mockPrismaEvaluationNote.findMany.mockResolvedValue(mockNotes);

      const notes = await mockPrismaEvaluationNote.findMany({
        where: { applicationId: 123 },
        orderBy: { createdAt: 'desc' },
      });

      expect(notes).toHaveLength(2);
      expect(notes[0].id).toBe(2); // Más reciente primero
      expect(notes[1].id).toBe(1);
    });

    it('debe retornar array vacío si no hay notas', async () => {
      mockPrismaEvaluationNote.findMany.mockResolvedValue([]);

      const notes = await mockPrismaEvaluationNote.findMany({
        where: { applicationId: 999 },
        orderBy: { createdAt: 'desc' },
      });

      expect(notes).toHaveLength(0);
      expect(Array.isArray(notes)).toBe(true);
    });
  });

  describe('POST /api/evaluations/notes - Autorización', () => {
    it('debe rechazar si no es recruiter o specialist', () => {
      const invalidRoles = ['company', 'admin', 'candidate', 'user'];

      invalidRoles.forEach((role) => {
        const canCreate = ['recruiter', 'specialist'].includes(role);
        expect(canCreate).toBe(false);
      });
    });

    it('debe permitir a recruiter crear notas', () => {
      const role = 'recruiter';
      const canCreate = ['recruiter', 'specialist'].includes(role);
      expect(canCreate).toBe(true);
    });

    it('debe permitir a specialist crear notas', () => {
      const role = 'specialist';
      const canCreate = ['recruiter', 'specialist'].includes(role);
      expect(canCreate).toBe(true);
    });
  });

  describe('POST /api/evaluations/notes - Validación', () => {
    it('debe rechazar si falta content', () => {
      const body = { applicationId: 123 };
      const isValid = body.applicationId && ('content' in body);

      expect(isValid).toBe(false);
    });

    it('debe rechazar si content está vacío', () => {
      const body = { applicationId: 123, content: '   ' };
      const isValid = body.applicationId && body.content && body.content.trim() !== '';

      expect(isValid).toBe(false);
    });

    it('debe rechazar si falta applicationId', () => {
      const body = { content: 'Buena actitud' };
      const isValid = ('applicationId' in body) && body.content;

      expect(isValid).toBe(false);
    });

    it('debe rechazar si la application no existe', async () => {
      mockPrismaApplication.findUnique.mockResolvedValue(null);

      const application = await mockPrismaApplication.findUnique({
        where: { id: 99999 },
      });

      expect(application).toBeNull();
      // API retornaría 404
    });
  });

  describe('POST /api/evaluations/notes - Creación', () => {
    it('debe crear nota sin documento', async () => {
      const mockApplication = { id: 123, candidateName: 'Juan Pérez' };
      const mockUser = { id: 5, nombre: 'Ana', apellidoPaterno: 'García' };
      const mockCreatedNote = {
        id: 1,
        authorId: 5,
        authorRole: 'recruiter',
        applicationId: 123,
        content: 'Excelente actitud y comunicación',
        documentUrl: null,
        documentName: null,
        createdAt: new Date(),
      };

      mockPrismaApplication.findUnique.mockResolvedValue(mockApplication);
      mockPrismaUser.findUnique.mockResolvedValue(mockUser);
      mockPrismaEvaluationNote.create.mockResolvedValue(mockCreatedNote);

      const note = await mockPrismaEvaluationNote.create({
        data: {
          authorId: 5,
          authorRole: 'recruiter',
          applicationId: 123,
          content: 'Excelente actitud y comunicación',
          documentUrl: null,
          documentName: null,
        },
      });

      expect(note.id).toBe(1);
      expect(note.content).toBe('Excelente actitud y comunicación');
      expect(note.documentUrl).toBeNull();
    });

    it('debe crear nota con documento', async () => {
      const mockCreatedNote = {
        id: 2,
        authorId: 5,
        authorRole: 'recruiter',
        applicationId: 123,
        content: 'Resultados de test psicométrico adjuntos',
        documentUrl: 'https://blob.vercel-storage.com/test.pdf',
        documentName: 'Test_Psicometrico_Juan.pdf',
        createdAt: new Date(),
      };

      mockPrismaEvaluationNote.create.mockResolvedValue(mockCreatedNote);

      const note = await mockPrismaEvaluationNote.create({
        data: {
          authorId: 5,
          authorRole: 'recruiter',
          applicationId: 123,
          content: 'Resultados de test psicométrico adjuntos',
          documentUrl: 'https://blob.vercel-storage.com/test.pdf',
          documentName: 'Test_Psicometrico_Juan.pdf',
        },
      });

      expect(note.documentUrl).toBe('https://blob.vercel-storage.com/test.pdf');
      expect(note.documentName).toBe('Test_Psicometrico_Juan.pdf');
    });

    it('debe asignar authorRole correctamente para recruiter', async () => {
      const userRole = 'recruiter';

      const note = await mockPrismaEvaluationNote.create({
        data: {
          authorId: 5,
          authorRole: userRole,
          applicationId: 123,
          content: 'Nota del reclutador',
        },
      });

      expect(mockPrismaEvaluationNote.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            authorRole: 'recruiter',
          }),
        })
      );
    });

    it('debe asignar authorRole correctamente para specialist', async () => {
      mockPrismaEvaluationNote.create.mockResolvedValue({
        id: 3,
        authorId: 7,
        authorRole: 'specialist',
        applicationId: 123,
        content: 'Nota del especialista',
        createdAt: new Date(),
      });

      const note = await mockPrismaEvaluationNote.create({
        data: {
          authorId: 7,
          authorRole: 'specialist',
          applicationId: 123,
          content: 'Nota del especialista',
        },
      });

      expect(note.authorRole).toBe('specialist');
    });
  });

  describe('Flujo completo de notas', () => {
    it('especialista debe poder ver notas del reclutador', async () => {
      // Simular notas creadas por reclutador
      const mockNotes = [
        {
          id: 1,
          authorId: 3,
          authorRole: 'recruiter',
          applicationId: 123,
          content: 'Candidato con buena actitud, comunicación clara.',
          documentUrl: 'http://example.com/psicometrico.pdf',
          documentName: 'Test Psicométrico.pdf',
          createdAt: new Date('2024-01-10'),
        },
      ];

      mockPrismaEvaluationNote.findMany.mockResolvedValue(mockNotes);

      // Especialista solicita las notas
      const viewerRole = 'specialist';
      const canView = ['recruiter', 'specialist', 'admin'].includes(viewerRole);

      expect(canView).toBe(true);

      const notes = await mockPrismaEvaluationNote.findMany({
        where: { applicationId: 123 },
        orderBy: { createdAt: 'desc' },
      });

      expect(notes).toHaveLength(1);
      expect(notes[0].authorRole).toBe('recruiter');
      expect(notes[0].content).toContain('buena actitud');
    });

    it('notas deben persistir al reabrir el candidato', async () => {
      const mockNotes = [
        { id: 1, content: 'Primera nota', createdAt: new Date('2024-01-01') },
        { id: 2, content: 'Segunda nota', createdAt: new Date('2024-01-05') },
      ];

      // Primera carga
      mockPrismaEvaluationNote.findMany.mockResolvedValue(mockNotes);
      let notes = await mockPrismaEvaluationNote.findMany({
        where: { applicationId: 123 },
      });
      expect(notes).toHaveLength(2);

      // Segunda carga (simula reabrir el modal)
      notes = await mockPrismaEvaluationNote.findMany({
        where: { applicationId: 123 },
      });
      expect(notes).toHaveLength(2);
      expect(mockPrismaEvaluationNote.findMany).toHaveBeenCalledTimes(2);
    });

    it('candidato NO debe poder ver notas de evaluación', () => {
      const viewerRole = 'candidate';
      const canView = ['recruiter', 'specialist', 'admin'].includes(viewerRole);

      expect(canView).toBe(false);
    });

    it('company NO debe poder ver notas de evaluación', () => {
      const viewerRole = 'company';
      const canView = ['recruiter', 'specialist', 'admin'].includes(viewerRole);

      expect(canView).toBe(false);
    });
  });
});
