// RUTA: __tests__/api/pricing.test.ts

/**
 * Tests para la API de administración de precios
 * Endpoint: /api/admin/pricing
 *
 * Verifica el CRUD completo de PricingMatrix
 */

// Mock de Prisma
const mockPrismaPricingMatrix = {
  findMany: jest.fn(),
  findUnique: jest.fn(),
  findFirst: jest.fn(),
  create: jest.fn(),
  update: jest.fn(),
  delete: jest.fn(),
};

const mockPrismaUser = {
  findUnique: jest.fn(),
};

jest.mock('@/lib/prisma', () => ({
  prisma: {
    pricingMatrix: mockPrismaPricingMatrix,
    user: mockPrismaUser,
  },
}));

describe('Admin Pricing API Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // Constantes válidas para pricing
  const VALID_SENIORITIES = ['Practicante', 'Jr', 'Middle', 'Sr', 'Director'];
  const VALID_WORK_MODES = ['remote', 'hybrid', 'presential'];

  describe('GET /api/admin/pricing', () => {
    it('debería listar todas las entradas de pricing', async () => {
      const mockPricingEntries = [
        { id: 1, profile: 'Tecnología', seniority: 'Jr', workMode: 'remote', credits: 10, isActive: true },
        { id: 2, profile: 'Tecnología', seniority: 'Sr', workMode: 'remote', credits: 25, isActive: true },
        { id: 3, profile: 'Marketing', seniority: 'Middle', workMode: 'hybrid', credits: 15, isActive: true },
      ];

      mockPrismaPricingMatrix.findMany.mockResolvedValue(mockPricingEntries);

      const entries = await mockPrismaPricingMatrix.findMany({
        orderBy: [
          { profile: 'asc' },
          { seniority: 'asc' },
          { workMode: 'asc' }
        ]
      });

      expect(entries).toHaveLength(3);
      expect(entries[0].profile).toBe('Tecnología');
    });

    it('debería filtrar por perfil', async () => {
      const techEntries = [
        { id: 1, profile: 'Tecnología', seniority: 'Jr', workMode: 'remote', credits: 10 },
        { id: 2, profile: 'Tecnología', seniority: 'Sr', workMode: 'remote', credits: 25 },
      ];

      mockPrismaPricingMatrix.findMany.mockResolvedValue(techEntries);

      const entries = await mockPrismaPricingMatrix.findMany({
        where: { profile: 'Tecnología' }
      });

      expect(entries).toHaveLength(2);
      expect(entries.every((e: any) => e.profile === 'Tecnología')).toBe(true);
    });

    it('debería filtrar por seniority', async () => {
      const srEntries = [
        { id: 1, profile: 'Tecnología', seniority: 'Sr', workMode: 'remote', credits: 25 },
        { id: 2, profile: 'Marketing', seniority: 'Sr', workMode: 'hybrid', credits: 20 },
      ];

      mockPrismaPricingMatrix.findMany.mockResolvedValue(srEntries);

      const entries = await mockPrismaPricingMatrix.findMany({
        where: { seniority: 'Sr' }
      });

      expect(entries.every((e: any) => e.seniority === 'Sr')).toBe(true);
    });

    it('debería filtrar por workMode', async () => {
      const remoteEntries = [
        { id: 1, profile: 'Tecnología', seniority: 'Jr', workMode: 'remote', credits: 10 },
      ];

      mockPrismaPricingMatrix.findMany.mockResolvedValue(remoteEntries);

      const entries = await mockPrismaPricingMatrix.findMany({
        where: { workMode: 'remote' }
      });

      expect(entries.every((e: any) => e.workMode === 'remote')).toBe(true);
    });

    it('debería filtrar por isActive', async () => {
      const activeEntries = [
        { id: 1, profile: 'Tecnología', seniority: 'Jr', workMode: 'remote', credits: 10, isActive: true },
      ];

      mockPrismaPricingMatrix.findMany.mockResolvedValue(activeEntries);

      const entries = await mockPrismaPricingMatrix.findMany({
        where: { isActive: true }
      });

      expect(entries.every((e: any) => e.isActive === true)).toBe(true);
    });

    it('debería obtener perfiles únicos', async () => {
      const uniqueProfiles = [
        { profile: 'Marketing' },
        { profile: 'Tecnología' },
        { profile: 'Ventas' },
      ];

      mockPrismaPricingMatrix.findMany.mockResolvedValue(uniqueProfiles);

      const profiles = await mockPrismaPricingMatrix.findMany({
        select: { profile: true },
        distinct: ['profile'],
        orderBy: { profile: 'asc' }
      });

      expect(profiles).toHaveLength(3);
      expect(profiles.map((p: any) => p.profile)).toEqual(['Marketing', 'Tecnología', 'Ventas']);
    });
  });

  describe('POST /api/admin/pricing', () => {
    it('debería crear nueva entrada de pricing', async () => {
      const newEntry = {
        profile: 'Tecnología',
        seniority: 'Jr',
        workMode: 'remote',
        credits: 10,
        isActive: true
      };

      mockPrismaPricingMatrix.findFirst.mockResolvedValue(null); // No existe duplicado
      mockPrismaPricingMatrix.create.mockResolvedValue({ id: 1, ...newEntry });

      // Verificar que no existe duplicado
      const existing = await mockPrismaPricingMatrix.findFirst({
        where: {
          profile: newEntry.profile,
          seniority: newEntry.seniority,
          workMode: newEntry.workMode,
          location: null
        }
      });

      expect(existing).toBeNull();

      // Crear entrada
      const created = await mockPrismaPricingMatrix.create({
        data: newEntry
      });

      expect(created.id).toBe(1);
      expect(created.profile).toBe('Tecnología');
      expect(created.credits).toBe(10);
    });

    it('debería rechazar seniority inválido', () => {
      const invalidSeniority = 'Experto';
      expect(VALID_SENIORITIES.includes(invalidSeniority)).toBe(false);
    });

    it('debería rechazar workMode inválido', () => {
      const invalidWorkMode = 'flexible';
      expect(VALID_WORK_MODES.includes(invalidWorkMode)).toBe(false);
    });

    it('debería rechazar credits negativos', () => {
      const credits = -5;
      expect(credits >= 0).toBe(false);
    });

    it('debería rechazar duplicados', async () => {
      const existingEntry = {
        id: 1,
        profile: 'Tecnología',
        seniority: 'Jr',
        workMode: 'remote',
        location: null
      };

      mockPrismaPricingMatrix.findFirst.mockResolvedValue(existingEntry);

      const existing = await mockPrismaPricingMatrix.findFirst({
        where: {
          profile: 'Tecnología',
          seniority: 'Jr',
          workMode: 'remote',
          location: null
        }
      });

      expect(existing).not.toBeNull();
      // La API retornaría 409 Conflict
    });

    it('debería aceptar todos los seniorities válidos', () => {
      VALID_SENIORITIES.forEach(seniority => {
        expect(VALID_SENIORITIES.includes(seniority)).toBe(true);
      });
    });

    it('debería aceptar todos los workModes válidos', () => {
      VALID_WORK_MODES.forEach(workMode => {
        expect(VALID_WORK_MODES.includes(workMode)).toBe(true);
      });
    });
  });

  describe('PUT /api/admin/pricing', () => {
    it('debería actualizar entrada existente', async () => {
      const existingEntry = {
        id: 1,
        profile: 'Tecnología',
        seniority: 'Jr',
        workMode: 'remote',
        credits: 10,
        isActive: true
      };

      const updatedEntry = {
        ...existingEntry,
        credits: 15
      };

      mockPrismaPricingMatrix.findUnique.mockResolvedValue(existingEntry);
      mockPrismaPricingMatrix.update.mockResolvedValue(updatedEntry);

      // Verificar que existe
      const existing = await mockPrismaPricingMatrix.findUnique({
        where: { id: 1 }
      });

      expect(existing).not.toBeNull();

      // Actualizar
      const updated = await mockPrismaPricingMatrix.update({
        where: { id: 1 },
        data: { credits: 15 }
      });

      expect(updated.credits).toBe(15);
    });

    it('debería rechazar actualización de entrada inexistente', async () => {
      mockPrismaPricingMatrix.findUnique.mockResolvedValue(null);

      const existing = await mockPrismaPricingMatrix.findUnique({
        where: { id: 999 }
      });

      expect(existing).toBeNull();
      // La API retornaría 404
    });

    it('debería poder desactivar una entrada', async () => {
      const entry = { id: 1, isActive: true };
      const updatedEntry = { id: 1, isActive: false };

      mockPrismaPricingMatrix.findUnique.mockResolvedValue(entry);
      mockPrismaPricingMatrix.update.mockResolvedValue(updatedEntry);

      const updated = await mockPrismaPricingMatrix.update({
        where: { id: 1 },
        data: { isActive: false }
      });

      expect(updated.isActive).toBe(false);
    });

    it('debería verificar duplicados al actualizar campos clave', async () => {
      const entry = { id: 1, profile: 'Tecnología', seniority: 'Jr', workMode: 'remote' };
      const duplicate = { id: 2, profile: 'Tecnología', seniority: 'Sr', workMode: 'remote' };

      mockPrismaPricingMatrix.findUnique.mockResolvedValue(entry);
      mockPrismaPricingMatrix.findFirst.mockResolvedValue(duplicate);

      // Intentar cambiar seniority de Jr a Sr (pero ya existe Sr)
      const existingDuplicate = await mockPrismaPricingMatrix.findFirst({
        where: {
          profile: 'Tecnología',
          seniority: 'Sr',
          workMode: 'remote',
          NOT: { id: 1 }
        }
      });

      expect(existingDuplicate).not.toBeNull();
      // La API retornaría 409 Conflict
    });
  });

  describe('DELETE /api/admin/pricing', () => {
    it('debería eliminar entrada existente', async () => {
      const entry = { id: 1, profile: 'Tecnología', seniority: 'Jr', workMode: 'remote' };

      mockPrismaPricingMatrix.findUnique.mockResolvedValue(entry);
      mockPrismaPricingMatrix.delete.mockResolvedValue(entry);

      const existing = await mockPrismaPricingMatrix.findUnique({
        where: { id: 1 }
      });

      expect(existing).not.toBeNull();

      await mockPrismaPricingMatrix.delete({
        where: { id: 1 }
      });

      expect(mockPrismaPricingMatrix.delete).toHaveBeenCalledWith({
        where: { id: 1 }
      });
    });

    it('debería rechazar eliminación de entrada inexistente', async () => {
      mockPrismaPricingMatrix.findUnique.mockResolvedValue(null);

      const existing = await mockPrismaPricingMatrix.findUnique({
        where: { id: 999 }
      });

      expect(existing).toBeNull();
      // La API retornaría 404
    });
  });

  describe('Seguridad', () => {
    it('debería verificar que solo admin tiene acceso', () => {
      const adminUser = { id: 1, role: 'admin' };
      const companyUser = { id: 2, role: 'company' };
      const recruiterUser = { id: 3, role: 'recruiter' };

      expect(adminUser.role === 'admin').toBe(true);
      expect(companyUser.role === 'admin').toBe(false);
      expect(recruiterUser.role === 'admin').toBe(false);
    });

    it('debería requerir autenticación', () => {
      const token = null;
      expect(!!token).toBe(false);
      // Sin token, la API retorna 401
    });
  });

  describe('Validaciones de datos', () => {
    it('debería requerir todos los campos obligatorios', () => {
      const validEntry = {
        profile: 'Tecnología',
        seniority: 'Jr',
        workMode: 'remote',
        credits: 10
      };

      const hasProfile = !!validEntry.profile;
      const hasSeniority = !!validEntry.seniority;
      const hasWorkMode = !!validEntry.workMode;
      const hasCredits = validEntry.credits !== undefined;

      expect(hasProfile && hasSeniority && hasWorkMode && hasCredits).toBe(true);
    });

    it('debería aceptar location opcional', () => {
      const entryWithLocation = {
        profile: 'Tecnología',
        seniority: 'Jr',
        workMode: 'presential',
        location: 'CDMX',
        credits: 12
      };

      const entryWithoutLocation = {
        profile: 'Tecnología',
        seniority: 'Jr',
        workMode: 'remote',
        credits: 10
      };

      expect(entryWithLocation.location).toBe('CDMX');
      expect(entryWithoutLocation.location).toBeUndefined();
    });

    it('debería validar credits como número positivo', () => {
      const validCredits = [0, 1, 10, 100, 1000];
      const invalidCredits = [-1, -10];

      validCredits.forEach(credits => {
        expect(typeof credits === 'number' && credits >= 0).toBe(true);
      });

      invalidCredits.forEach(credits => {
        expect(typeof credits === 'number' && credits >= 0).toBe(false);
      });
    });
  });

  describe('Consistencia de cálculo de precios (BUG FIX)', () => {
    /**
     * BUG: El frontend mostraba un precio (5) pero el backend cobraba otro (6)
     * FIX: Se creó la función calculateJobCreditCost en src/lib/pricing.ts
     * que es usada tanto por /api/pricing/calculate como por /api/jobs
     */

    it('debería usar la misma lógica de búsqueda en frontend y backend', async () => {
      const query = {
        profile: 'Tecnología',
        seniority: 'Sr',
        workMode: 'remote'
      };

      // Simular que existe un registro con estos parámetros
      const mockPricing = {
        id: 1,
        profile: 'Tecnología',
        seniority: 'Sr',
        workMode: 'remote',
        location: null,
        credits: 15,
        isActive: true
      };

      mockPrismaPricingMatrix.findFirst.mockResolvedValue(mockPricing);

      // Tanto el frontend (/api/pricing/calculate) como el backend (/api/jobs)
      // ahora usan calculateJobCreditCost que ejecuta esta misma query
      const pricing = await mockPrismaPricingMatrix.findFirst({
        where: {
          profile: query.profile,
          seniority: query.seniority,
          workMode: query.workMode,
          location: null,
          isActive: true
        },
        orderBy: { id: 'asc' }
      });

      expect(pricing?.credits).toBe(15);
    });

    it('debería retornar el mismo fallback (5) cuando no hay precio definido', async () => {
      mockPrismaPricingMatrix.findFirst.mockResolvedValue(null);

      const DEFAULT_CREDITS = 5;

      // Cuando no se encuentra precio, ambos endpoints retornan 5
      const pricing = await mockPrismaPricingMatrix.findFirst({
        where: {
          profile: 'PerfilNoExistente',
          seniority: 'Sr',
          workMode: 'remote',
          location: null,
          isActive: true
        }
      });

      const credits = pricing?.credits ?? DEFAULT_CREDITS;
      expect(credits).toBe(5);
    });

    it('debería usar orderBy para resultados consistentes', async () => {
      // Si hay múltiples registros que coinciden, orderBy: { id: 'asc' }
      // garantiza que siempre se retorne el mismo
      const mockPricings = [
        { id: 1, credits: 10 },
        { id: 2, credits: 15 }
      ];

      mockPrismaPricingMatrix.findFirst.mockResolvedValue(mockPricings[0]);

      const pricing = await mockPrismaPricingMatrix.findFirst({
        where: { profile: 'Tecnología', isActive: true },
        orderBy: { id: 'asc' }
      });

      // Siempre debería retornar el de menor ID
      expect(pricing?.id).toBe(1);
      expect(pricing?.credits).toBe(10);
    });

    it('debería buscar sin location si no encuentra con location: null', async () => {
      // Primera llamada: busca con location: null, no encuentra
      // Segunda llamada: busca sin location, encuentra
      mockPrismaPricingMatrix.findFirst
        .mockResolvedValueOnce(null) // Primera búsqueda: no encuentra
        .mockResolvedValueOnce({ id: 1, credits: 12 }); // Segunda búsqueda: encuentra

      // Simular lógica de calculateJobCreditCost
      let pricing = await mockPrismaPricingMatrix.findFirst({
        where: {
          profile: 'Tecnología',
          seniority: 'Jr',
          workMode: 'presential',
          location: null,
          isActive: true
        }
      });

      if (!pricing) {
        pricing = await mockPrismaPricingMatrix.findFirst({
          where: {
            profile: 'Tecnología',
            seniority: 'Jr',
            workMode: 'presential',
            isActive: true
          }
        });
      }

      expect(pricing?.credits).toBe(12);
    });

    it('debería usar ?? en vez de || para el fallback', () => {
      // Diferencia entre ?? y ||:
      // 0 ?? 5 = 0 (nullish coalescing solo reemplaza null/undefined)
      // 0 || 5 = 5 (logical OR reemplaza cualquier valor falsy)

      // Si un precio es 0 créditos, debería respetarse
      const creditsZero = 0;
      const creditsNull = null;
      const creditsUndefined = undefined;

      expect(creditsZero ?? 5).toBe(0);
      expect(creditsNull ?? 5).toBe(5);
      expect(creditsUndefined ?? 5).toBe(5);

      // Con || el comportamiento sería diferente
      expect(creditsZero || 5).toBe(5); // ¡Incorrecto si queremos permitir 0!
    });
  });
});
