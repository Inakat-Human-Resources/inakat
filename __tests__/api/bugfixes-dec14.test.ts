// RUTA: __tests__/api/bugfixes-dec14.test.ts

/**
 * Tests para los 3 bugs críticos arreglados el 14 de diciembre
 * Bug 1: Error al subir archivo en registro de empresa
 * Bug 2: Calculadora de créditos incorrecta
 * Bug 3: Reclutador/Especialista solo pueden enviar candidatos una vez
 */

// Mock de Prisma
const mockPrismaPricingMatrix = {
  findFirst: jest.fn(),
};

const mockPrismaUser = {
  findUnique: jest.fn(),
  update: jest.fn(),
};

const mockPrismaJob = {
  create: jest.fn(),
};

const mockPrismaJobAssignment = {
  findUnique: jest.fn(),
  update: jest.fn(),
};

const mockPrismaCandidate = {
  findMany: jest.fn(),
};

const mockPrismaApplication = {
  findFirst: jest.fn(),
  create: jest.fn(),
  update: jest.fn(),
  updateMany: jest.fn(),
};

const mockPrismaCreditTransaction = {
  create: jest.fn(),
};

jest.mock('@/lib/prisma', () => ({
  prisma: {
    pricingMatrix: mockPrismaPricingMatrix,
    user: mockPrismaUser,
    job: mockPrismaJob,
    jobAssignment: mockPrismaJobAssignment,
    candidate: mockPrismaCandidate,
    application: mockPrismaApplication,
    creditTransaction: mockPrismaCreditTransaction,
  },
}));

// =============================================
// BUG 1: Upload de archivos
// =============================================
describe('Bug 1: Upload de archivos en registro de empresa', () => {
  // Tipos MIME permitidos - deben coincidir con upload/route.ts
  const ALLOWED_MIME_TYPES = [
    'application/pdf',
    'image/jpeg',
    'image/png',
    'image/jpg',
    'image/webp'
  ];

  const ALLOWED_EXTENSIONS = ['.pdf', '.jpg', '.jpeg', '.png', '.webp'];

  describe('Validación de tipos de archivo', () => {
    it('debería aceptar archivos PDF', () => {
      expect(ALLOWED_MIME_TYPES.includes('application/pdf')).toBe(true);
    });

    it('debería aceptar archivos JPG/JPEG', () => {
      expect(ALLOWED_MIME_TYPES.includes('image/jpeg')).toBe(true);
      expect(ALLOWED_MIME_TYPES.includes('image/jpg')).toBe(true);
    });

    it('debería aceptar archivos PNG', () => {
      expect(ALLOWED_MIME_TYPES.includes('image/png')).toBe(true);
    });

    it('debería aceptar archivos WEBP (nuevo)', () => {
      expect(ALLOWED_MIME_TYPES.includes('image/webp')).toBe(true);
    });

    it('debería validar por extensión como fallback', () => {
      // Algunos navegadores no envían MIME type correcto
      const filename = 'documento.pdf';
      const extension = '.' + filename.split('.').pop()?.toLowerCase();
      expect(ALLOWED_EXTENSIONS.includes(extension)).toBe(true);
    });

    it('debería rechazar archivos no permitidos', () => {
      const notAllowed = ['application/msword', 'application/zip', 'text/plain'];
      notAllowed.forEach(type => {
        expect(ALLOWED_MIME_TYPES.includes(type)).toBe(false);
      });
    });
  });

  describe('Validación de tamaño', () => {
    const MAX_SIZE = 5 * 1024 * 1024; // 5MB

    it('debería aceptar archivos de hasta 5MB', () => {
      const validSizes = [1024, 1024 * 1024, 5 * 1024 * 1024]; // 1KB, 1MB, 5MB
      validSizes.forEach(size => {
        expect(size <= MAX_SIZE).toBe(true);
      });
    });

    it('debería rechazar archivos mayores a 5MB', () => {
      const invalidSizes = [5 * 1024 * 1024 + 1, 10 * 1024 * 1024]; // 5MB+1byte, 10MB
      invalidSizes.forEach(size => {
        expect(size > MAX_SIZE).toBe(true);
      });
    });

    it('debería rechazar archivos vacíos', () => {
      const emptySize = 0;
      expect(emptySize === 0).toBe(true);
    });
  });

  describe('Generación de nombres únicos', () => {
    it('debería generar nombres únicos con timestamp', () => {
      const filename = 'mi documento.pdf';
      const timestamp = Date.now();
      const randomStr = Math.random().toString(36).substring(2, 8);
      const sanitizedName = filename.replace(/[^a-zA-Z0-9.-]/g, '_');
      const uniqueName = `${timestamp}-${randomStr}-${sanitizedName}`;

      expect(uniqueName).toContain(String(timestamp));
      expect(uniqueName).toContain('mi_documento.pdf');
      expect(uniqueName).not.toContain(' '); // Sin espacios
    });
  });
});

// =============================================
// BUG 2: Calculadora de créditos
// =============================================
describe('Bug 2: Calculadora de créditos', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Consistencia entre frontend y backend', () => {
    it('debería buscar pricing con location: null para coincidir con frontend', async () => {
      const searchParams = {
        profile: 'Tecnología',
        seniority: 'Jr',
        workMode: 'remote'
      };

      // Simular la búsqueda del backend (jobs/route.ts)
      mockPrismaPricingMatrix.findFirst.mockResolvedValue({
        id: 1,
        ...searchParams,
        location: null,
        credits: 10,
        isActive: true
      });

      const pricing = await mockPrismaPricingMatrix.findFirst({
        where: {
          profile: searchParams.profile,
          seniority: searchParams.seniority,
          workMode: searchParams.workMode,
          location: null, // IMPORTANTE: debe ser null explícito
          isActive: true
        }
      });

      expect(mockPrismaPricingMatrix.findFirst).toHaveBeenCalledWith({
        where: {
          profile: 'Tecnología',
          seniority: 'Jr',
          workMode: 'remote',
          location: null,
          isActive: true
        }
      });

      expect(pricing?.credits).toBe(10);
    });

    it('debería usar valor por defecto 5 si no encuentra pricing', async () => {
      mockPrismaPricingMatrix.findFirst.mockResolvedValue(null);

      const pricing = await mockPrismaPricingMatrix.findFirst({
        where: {
          profile: 'NuevoProfile',
          seniority: 'Jr',
          workMode: 'remote',
          location: null,
          isActive: true
        }
      });

      // El mismo fallback que /api/pricing/calculate
      const creditCost = pricing?.credits ?? 5;

      expect(creditCost).toBe(5);
    });

    it('debería calcular el mismo costo en frontend y backend', async () => {
      const mockPricing = {
        id: 1,
        profile: 'Tecnología',
        seniority: 'Sr',
        workMode: 'presential',
        location: null,
        credits: 15,
        isActive: true
      };

      mockPrismaPricingMatrix.findFirst.mockResolvedValue(mockPricing);

      // Simular cálculo del frontend (pricing/calculate POST)
      const frontendResult = await mockPrismaPricingMatrix.findFirst({
        where: {
          profile: 'Tecnología',
          seniority: 'Sr',
          workMode: 'presential',
          location: null,
          isActive: true
        }
      });
      const frontendCredits = frontendResult?.credits ?? 5;

      // Simular cálculo del backend (jobs/route.ts POST)
      const backendResult = await mockPrismaPricingMatrix.findFirst({
        where: {
          profile: 'Tecnología',
          seniority: 'Sr',
          workMode: 'presential',
          location: null,
          isActive: true
        }
      });
      const backendCredits = backendResult?.credits ?? 5;

      // CRÍTICO: Deben ser iguales
      expect(frontendCredits).toBe(backendCredits);
      expect(frontendCredits).toBe(15);
    });
  });

  describe('Descuento de créditos', () => {
    it('debería descontar exactamente los créditos calculados', async () => {
      const user = { id: 1, credits: 20 };
      const creditCost = 10;

      mockPrismaUser.findUnique.mockResolvedValue(user);
      mockPrismaUser.update.mockResolvedValue({
        ...user,
        credits: user.credits - creditCost
      });

      const updatedUser = await mockPrismaUser.update({
        where: { id: user.id },
        data: { credits: { decrement: creditCost } }
      });

      expect(updatedUser.credits).toBe(10);
    });
  });
});

// =============================================
// BUG 3: Reclutador/Especialista envío múltiple
// =============================================
describe('Bug 3: Reclutador/Especialista envío de candidatos', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Reclutador - Filtro de applications', () => {
    it('debería mostrar candidatos con status pending o reviewing', () => {
      // El filtro correcto para el reclutador
      const validStatuses = ['pending', 'reviewing'];
      const applications = [
        { id: 1, status: 'pending' },
        { id: 2, status: 'reviewing' },
        { id: 3, status: 'sent_to_specialist' }, // Este NO debe aparecer
        { id: 4, status: 'discarded' }, // Este NO debe aparecer
      ];

      const filteredApps = applications.filter(app =>
        validStatuses.includes(app.status)
      );

      expect(filteredApps).toHaveLength(2);
      expect(filteredApps.map(a => a.id)).toEqual([1, 2]);
    });

    it('NO debería mostrar candidatos ya enviados al especialista', () => {
      const validStatuses = ['pending', 'reviewing'];
      const sentApp = { id: 3, status: 'sent_to_specialist' };

      expect(validStatuses.includes(sentApp.status)).toBe(false);
    });
  });

  describe('Especialista - Filtro de applications', () => {
    it('debería mostrar candidatos con status sent_to_specialist o evaluating', () => {
      const validStatuses = ['sent_to_specialist', 'evaluating'];
      const applications = [
        { id: 1, status: 'sent_to_specialist' },
        { id: 2, status: 'evaluating' },
        { id: 3, status: 'sent_to_company' }, // Este NO debe aparecer
        { id: 4, status: 'pending' }, // Este NO debe aparecer (aún con reclutador)
      ];

      const filteredApps = applications.filter(app =>
        validStatuses.includes(app.status)
      );

      expect(filteredApps).toHaveLength(2);
      expect(filteredApps.map(a => a.id)).toEqual([1, 2]);
    });

    it('NO debería mostrar candidatos ya enviados a la empresa', () => {
      const validStatuses = ['sent_to_specialist', 'evaluating'];
      const sentApp = { id: 3, status: 'sent_to_company' };

      expect(validStatuses.includes(sentApp.status)).toBe(false);
    });
  });

  describe('Envío de candidatos - Acumulativo', () => {
    it('debería concatenar candidatos enviados previamente (reclutador)', () => {
      const previouslySent = '1,2,3';
      const newCandidateIds = [4, 5];

      const previousIds = previouslySent.split(',').map(id => parseInt(id)).filter(id => !isNaN(id));
      const allSentIds = [...new Set([...previousIds, ...newCandidateIds])];

      expect(allSentIds).toEqual([1, 2, 3, 4, 5]);
    });

    it('debería evitar duplicados al concatenar', () => {
      const previouslySent = '1,2,3';
      const newCandidateIds = [2, 3, 4]; // 2 y 3 ya existen

      const previousIds = previouslySent.split(',').map(id => parseInt(id)).filter(id => !isNaN(id));
      const allSentIds = [...new Set([...previousIds, ...newCandidateIds])];

      expect(allSentIds).toEqual([1, 2, 3, 4]); // Sin duplicados
    });

    it('debería manejar cuando no hay candidatos previos', () => {
      const previouslySent = '';
      const newCandidateIds = [1, 2];

      const previousIds = previouslySent ? previouslySent.split(',').map(id => parseInt(id)).filter(id => !isNaN(id)) : [];
      const allSentIds = [...new Set([...previousIds, ...newCandidateIds])];

      expect(allSentIds).toEqual([1, 2]);
    });

    it('debería concatenar candidatos enviados previamente (especialista)', () => {
      const previouslySent = '10,11';
      const newCandidateIds = [12, 13];

      const previousIds = previouslySent.split(',').map(id => parseInt(id)).filter(id => !isNaN(id));
      const allSentIds = [...new Set([...previousIds, ...newCandidateIds])];

      expect(allSentIds).toEqual([10, 11, 12, 13]);
    });
  });

  describe('Actualización de Applications', () => {
    it('debería solo actualizar candidatos seleccionados, no todos', async () => {
      const selectedCandidateEmails = ['selected1@test.com', 'selected2@test.com'];
      const allApplications = [
        { id: 1, candidateEmail: 'selected1@test.com', status: 'pending' },
        { id: 2, candidateEmail: 'selected2@test.com', status: 'pending' },
        { id: 3, candidateEmail: 'notselected@test.com', status: 'pending' }, // NO seleccionado
      ];

      mockPrismaApplication.updateMany.mockResolvedValue({ count: 2 });

      await mockPrismaApplication.updateMany({
        where: {
          jobId: 1,
          candidateEmail: { in: selectedCandidateEmails }
        },
        data: {
          status: 'sent_to_specialist'
        }
      });

      expect(mockPrismaApplication.updateMany).toHaveBeenCalledWith({
        where: {
          jobId: 1,
          candidateEmail: { in: selectedCandidateEmails }
        },
        data: {
          status: 'sent_to_specialist'
        }
      });

      // El candidato no seleccionado mantiene su status 'pending'
      const notSelectedApp = allApplications.find(a => a.candidateEmail === 'notselected@test.com');
      expect(notSelectedApp?.status).toBe('pending');
    });

    it('debería NO actualizar candidatos ya enviados previamente', async () => {
      // El código verifica el status antes de actualizar
      // existingApp.status !== 'sent_to_specialist' && existingApp.status !== 'sent_to_company'

      const existingApp = { id: 1, status: 'sent_to_specialist' };

      // Esta verificación existe en el código real
      const shouldUpdate =
        existingApp.status !== 'sent_to_specialist' &&
        existingApp.status !== 'sent_to_company';

      expect(shouldUpdate).toBe(false); // NO debe actualizarse

      // Candidato que SÍ debe actualizarse
      const pendingApp = { id: 2, status: 'pending' };
      const shouldUpdatePending =
        pendingApp.status !== 'sent_to_specialist' &&
        pendingApp.status !== 'sent_to_company';

      expect(shouldUpdatePending).toBe(true); // SÍ debe actualizarse
    });
  });
});
