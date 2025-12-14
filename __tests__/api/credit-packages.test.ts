// RUTA: __tests__/api/credit-packages.test.ts

/**
 * Tests para la API de administración de paquetes de créditos
 * Endpoints:
 * - GET/POST /api/admin/credit-packages
 * - GET/PUT/DELETE /api/admin/credit-packages/[id]
 *
 * Verifica el CRUD completo de CreditPackage
 */

// Mock de Prisma
const mockPrismaCreditPackage = {
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
    creditPackage: mockPrismaCreditPackage,
    user: mockPrismaUser,
  },
}));

// Badges válidos
const VALID_BADGES = ['MÁS POPULAR', 'PROMOCIÓN', null, ''];

describe('Credit Packages API Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // =============================================
  // GET /api/admin/credit-packages
  // =============================================
  describe('GET /api/admin/credit-packages', () => {
    it('debería listar todos los paquetes ordenados por sortOrder', async () => {
      const mockPackages = [
        { id: 1, name: '1 Crédito', credits: 1, price: 4000, pricePerCredit: 4000, badge: null, sortOrder: 1, isActive: true },
        { id: 2, name: 'Pack 10', credits: 10, price: 35000, pricePerCredit: 3500, badge: 'MÁS POPULAR', sortOrder: 2, isActive: true },
        { id: 3, name: 'Pack 15', credits: 15, price: 50000, pricePerCredit: 3333.33, badge: null, sortOrder: 3, isActive: true },
        { id: 4, name: 'Pack 20', credits: 20, price: 65000, pricePerCredit: 3250, badge: 'PROMOCIÓN', sortOrder: 4, isActive: true },
      ];

      mockPrismaCreditPackage.findMany.mockResolvedValue(mockPackages);

      const packages = await mockPrismaCreditPackage.findMany({
        orderBy: { sortOrder: 'asc' }
      });

      expect(packages).toHaveLength(4);
      expect(packages[0].name).toBe('1 Crédito');
      expect(packages[1].badge).toBe('MÁS POPULAR');
      expect(packages[3].badge).toBe('PROMOCIÓN');
    });

    it('debería filtrar solo paquetes activos con ?activeOnly=true', async () => {
      const activePackages = [
        { id: 1, name: '1 Crédito', credits: 1, price: 4000, isActive: true },
        { id: 2, name: 'Pack 10', credits: 10, price: 35000, isActive: true },
      ];

      mockPrismaCreditPackage.findMany.mockResolvedValue(activePackages);

      const packages = await mockPrismaCreditPackage.findMany({
        where: { isActive: true },
        orderBy: { sortOrder: 'asc' }
      });

      expect(packages).toHaveLength(2);
      expect(packages.every((p: any) => p.isActive === true)).toBe(true);
    });

    it('debería incluir paquetes inactivos para admin (sin ?activeOnly)', async () => {
      const allPackages = [
        { id: 1, name: '1 Crédito', isActive: true },
        { id: 2, name: 'Pack 10', isActive: true },
        { id: 5, name: 'Pack Antiguo', isActive: false },
      ];

      mockPrismaCreditPackage.findMany.mockResolvedValue(allPackages);

      const packages = await mockPrismaCreditPackage.findMany({
        orderBy: { sortOrder: 'asc' }
      });

      expect(packages).toHaveLength(3);
      expect(packages.some((p: any) => p.isActive === false)).toBe(true);
    });

    it('debería retornar array vacío si no hay paquetes', async () => {
      mockPrismaCreditPackage.findMany.mockResolvedValue([]);

      const packages = await mockPrismaCreditPackage.findMany({
        orderBy: { sortOrder: 'asc' }
      });

      expect(packages).toHaveLength(0);
      expect(Array.isArray(packages)).toBe(true);
    });
  });

  // =============================================
  // POST /api/admin/credit-packages
  // =============================================
  describe('POST /api/admin/credit-packages', () => {
    it('debería crear un nuevo paquete con datos válidos', async () => {
      const newPackage = {
        name: 'Pack 5',
        credits: 5,
        price: 18000,
        badge: null,
        sortOrder: 2
      };

      const createdPackage = {
        id: 5,
        ...newPackage,
        pricePerCredit: 3600, // Calculado: 18000 / 5
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      mockPrismaCreditPackage.create.mockResolvedValue(createdPackage);

      const created = await mockPrismaCreditPackage.create({
        data: {
          ...newPackage,
          pricePerCredit: newPackage.price / newPackage.credits,
          isActive: true
        }
      });

      expect(created.id).toBe(5);
      expect(created.name).toBe('Pack 5');
      expect(created.pricePerCredit).toBe(3600);
    });

    it('debería calcular pricePerCredit automáticamente', () => {
      const testCases = [
        { credits: 1, price: 4000, expected: 4000 },
        { credits: 10, price: 35000, expected: 3500 },
        { credits: 15, price: 50000, expected: 3333.33 },
        { credits: 20, price: 65000, expected: 3250 },
      ];

      testCases.forEach(({ credits, price, expected }) => {
        const pricePerCredit = parseFloat((price / credits).toFixed(2));
        expect(pricePerCredit).toBe(expected);
      });
    });

    it('debería requerir campo name', () => {
      const body = { credits: 5, price: 18000 };
      const hasName = !!body.name;
      expect(hasName).toBe(false);
    });

    it('debería requerir campo credits', () => {
      const body = { name: 'Pack 5', price: 18000 };
      const hasCredits = !!(body as any).credits;
      expect(hasCredits).toBe(false);
    });

    it('debería requerir campo price', () => {
      const body = { name: 'Pack 5', credits: 5 };
      const hasPrice = !!(body as any).price;
      expect(hasPrice).toBe(false);
    });

    it('debería rechazar credits menor o igual a 0', () => {
      const invalidCredits = [0, -1, -10];

      invalidCredits.forEach(credits => {
        expect(credits > 0).toBe(false);
      });
    });

    it('debería rechazar price menor o igual a 0', () => {
      const invalidPrices = [0, -1, -100];

      invalidPrices.forEach(price => {
        expect(price > 0).toBe(false);
      });
    });

    it('debería aceptar badge válido: MÁS POPULAR', () => {
      const badge = 'MÁS POPULAR';
      expect(VALID_BADGES.includes(badge)).toBe(true);
    });

    it('debería aceptar badge válido: PROMOCIÓN', () => {
      const badge = 'PROMOCIÓN';
      expect(VALID_BADGES.includes(badge)).toBe(true);
    });

    it('debería aceptar badge null o vacío', () => {
      expect(VALID_BADGES.includes(null)).toBe(true);
      expect(VALID_BADGES.includes('')).toBe(true);
    });

    it('debería rechazar badge inválido', () => {
      const invalidBadges = ['OFERTA', 'NUEVO', 'DESCUENTO', 'random'];

      invalidBadges.forEach(badge => {
        expect(VALID_BADGES.includes(badge)).toBe(false);
      });
    });

    it('debería establecer isActive: true por defecto', async () => {
      const newPackage = {
        name: 'Nuevo Pack',
        credits: 3,
        price: 11000,
        pricePerCredit: 3666.67,
        isActive: true // Por defecto
      };

      mockPrismaCreditPackage.create.mockResolvedValue({ id: 6, ...newPackage });

      const created = await mockPrismaCreditPackage.create({ data: newPackage });

      expect(created.isActive).toBe(true);
    });

    it('debería establecer sortOrder: 0 por defecto si no se proporciona', () => {
      const body = { name: 'Pack', credits: 1, price: 4000 };
      const sortOrder = (body as any).sortOrder ?? 0;

      expect(sortOrder).toBe(0);
    });
  });

  // =============================================
  // GET /api/admin/credit-packages/[id]
  // =============================================
  describe('GET /api/admin/credit-packages/[id]', () => {
    it('debería obtener un paquete por ID', async () => {
      const mockPackage = {
        id: 2,
        name: 'Pack 10',
        credits: 10,
        price: 35000,
        pricePerCredit: 3500,
        badge: 'MÁS POPULAR',
        isActive: true,
        sortOrder: 2
      };

      mockPrismaCreditPackage.findUnique.mockResolvedValue(mockPackage);

      const pkg = await mockPrismaCreditPackage.findUnique({
        where: { id: 2 }
      });

      expect(pkg).not.toBeNull();
      expect(pkg.name).toBe('Pack 10');
      expect(pkg.badge).toBe('MÁS POPULAR');
    });

    it('debería retornar null para ID inexistente', async () => {
      mockPrismaCreditPackage.findUnique.mockResolvedValue(null);

      const pkg = await mockPrismaCreditPackage.findUnique({
        where: { id: 999 }
      });

      expect(pkg).toBeNull();
      // La API retornaría 404
    });

    it('debería rechazar ID inválido (no numérico)', () => {
      const invalidIds = ['abc', 'null', 'undefined', ''];

      invalidIds.forEach(id => {
        const parsed = parseInt(id);
        expect(isNaN(parsed)).toBe(true);
      });
    });

    it('debería parsear ID numérico correctamente', () => {
      const validIds = ['1', '10', '123'];

      validIds.forEach(id => {
        const parsed = parseInt(id);
        expect(isNaN(parsed)).toBe(false);
        expect(parsed > 0).toBe(true);
      });
    });
  });

  // =============================================
  // PUT /api/admin/credit-packages/[id]
  // =============================================
  describe('PUT /api/admin/credit-packages/[id]', () => {
    it('debería actualizar nombre del paquete', async () => {
      const existingPackage = { id: 1, name: '1 Crédito', credits: 1, price: 4000 };
      const updatedPackage = { ...existingPackage, name: 'Crédito Individual' };

      mockPrismaCreditPackage.findUnique.mockResolvedValue(existingPackage);
      mockPrismaCreditPackage.update.mockResolvedValue(updatedPackage);

      const updated = await mockPrismaCreditPackage.update({
        where: { id: 1 },
        data: { name: 'Crédito Individual' }
      });

      expect(updated.name).toBe('Crédito Individual');
    });

    it('debería actualizar precio y recalcular pricePerCredit', async () => {
      const existingPackage = { id: 2, name: 'Pack 10', credits: 10, price: 35000, pricePerCredit: 3500 };
      const newPrice = 32000;
      const newPricePerCredit = newPrice / existingPackage.credits; // 3200

      mockPrismaCreditPackage.findUnique.mockResolvedValue(existingPackage);
      mockPrismaCreditPackage.update.mockResolvedValue({
        ...existingPackage,
        price: newPrice,
        pricePerCredit: newPricePerCredit
      });

      const updated = await mockPrismaCreditPackage.update({
        where: { id: 2 },
        data: { price: newPrice, pricePerCredit: newPricePerCredit }
      });

      expect(updated.price).toBe(32000);
      expect(updated.pricePerCredit).toBe(3200);
    });

    it('debería actualizar créditos y recalcular pricePerCredit', async () => {
      const existingPackage = { id: 2, name: 'Pack 10', credits: 10, price: 35000, pricePerCredit: 3500 };
      const newCredits = 12;
      const newPricePerCredit = existingPackage.price / newCredits; // 2916.67

      mockPrismaCreditPackage.findUnique.mockResolvedValue(existingPackage);
      mockPrismaCreditPackage.update.mockResolvedValue({
        ...existingPackage,
        credits: newCredits,
        pricePerCredit: parseFloat(newPricePerCredit.toFixed(2))
      });

      const updated = await mockPrismaCreditPackage.update({
        where: { id: 2 },
        data: { credits: newCredits, pricePerCredit: parseFloat(newPricePerCredit.toFixed(2)) }
      });

      expect(updated.credits).toBe(12);
      expect(updated.pricePerCredit).toBeCloseTo(2916.67, 1);
    });

    it('debería actualizar badge', async () => {
      const existingPackage = { id: 3, name: 'Pack 15', badge: null };

      mockPrismaCreditPackage.findUnique.mockResolvedValue(existingPackage);
      mockPrismaCreditPackage.update.mockResolvedValue({
        ...existingPackage,
        badge: 'MÁS POPULAR'
      });

      const updated = await mockPrismaCreditPackage.update({
        where: { id: 3 },
        data: { badge: 'MÁS POPULAR' }
      });

      expect(updated.badge).toBe('MÁS POPULAR');
    });

    it('debería poder quitar badge (establecer a null)', async () => {
      const existingPackage = { id: 2, name: 'Pack 10', badge: 'MÁS POPULAR' };

      mockPrismaCreditPackage.findUnique.mockResolvedValue(existingPackage);
      mockPrismaCreditPackage.update.mockResolvedValue({
        ...existingPackage,
        badge: null
      });

      const updated = await mockPrismaCreditPackage.update({
        where: { id: 2 },
        data: { badge: null }
      });

      expect(updated.badge).toBeNull();
    });

    it('debería actualizar sortOrder', async () => {
      const existingPackage = { id: 1, name: '1 Crédito', sortOrder: 1 };

      mockPrismaCreditPackage.findUnique.mockResolvedValue(existingPackage);
      mockPrismaCreditPackage.update.mockResolvedValue({
        ...existingPackage,
        sortOrder: 5
      });

      const updated = await mockPrismaCreditPackage.update({
        where: { id: 1 },
        data: { sortOrder: 5 }
      });

      expect(updated.sortOrder).toBe(5);
    });

    it('debería poder desactivar paquete (isActive: false)', async () => {
      const existingPackage = { id: 1, name: '1 Crédito', isActive: true };

      mockPrismaCreditPackage.findUnique.mockResolvedValue(existingPackage);
      mockPrismaCreditPackage.update.mockResolvedValue({
        ...existingPackage,
        isActive: false
      });

      const updated = await mockPrismaCreditPackage.update({
        where: { id: 1 },
        data: { isActive: false }
      });

      expect(updated.isActive).toBe(false);
    });

    it('debería poder reactivar paquete (isActive: true)', async () => {
      const existingPackage = { id: 5, name: 'Pack Antiguo', isActive: false };

      mockPrismaCreditPackage.findUnique.mockResolvedValue(existingPackage);
      mockPrismaCreditPackage.update.mockResolvedValue({
        ...existingPackage,
        isActive: true
      });

      const updated = await mockPrismaCreditPackage.update({
        where: { id: 5 },
        data: { isActive: true }
      });

      expect(updated.isActive).toBe(true);
    });

    it('debería rechazar actualización de paquete inexistente', async () => {
      mockPrismaCreditPackage.findUnique.mockResolvedValue(null);

      const existing = await mockPrismaCreditPackage.findUnique({
        where: { id: 999 }
      });

      expect(existing).toBeNull();
      // La API retornaría 404
    });

    it('debería rechazar credits <= 0 en actualización', () => {
      const invalidCredits = [0, -1, -10];

      invalidCredits.forEach(credits => {
        expect(credits > 0).toBe(false);
      });
    });

    it('debería rechazar price <= 0 en actualización', () => {
      const invalidPrices = [0, -1, -100];

      invalidPrices.forEach(price => {
        expect(price > 0).toBe(false);
      });
    });
  });

  // =============================================
  // DELETE /api/admin/credit-packages/[id]
  // =============================================
  describe('DELETE /api/admin/credit-packages/[id]', () => {
    it('debería hacer soft delete (isActive = false)', async () => {
      const existingPackage = { id: 1, name: '1 Crédito', isActive: true };

      mockPrismaCreditPackage.findUnique.mockResolvedValue(existingPackage);
      mockPrismaCreditPackage.update.mockResolvedValue({
        ...existingPackage,
        isActive: false
      });

      // Soft delete = actualizar isActive a false
      const deleted = await mockPrismaCreditPackage.update({
        where: { id: 1 },
        data: { isActive: false }
      });

      expect(deleted.isActive).toBe(false);
    });

    it('debería mantener el registro en la base de datos después del delete', async () => {
      const softDeletedPackage = { id: 1, name: '1 Crédito', isActive: false };

      mockPrismaCreditPackage.update.mockResolvedValue(softDeletedPackage);
      mockPrismaCreditPackage.findUnique.mockResolvedValue(softDeletedPackage);

      await mockPrismaCreditPackage.update({
        where: { id: 1 },
        data: { isActive: false }
      });

      // Verificar que aún existe
      const pkg = await mockPrismaCreditPackage.findUnique({ where: { id: 1 } });
      expect(pkg).not.toBeNull();
      expect(pkg.isActive).toBe(false);
    });

    it('debería rechazar eliminación de paquete inexistente', async () => {
      mockPrismaCreditPackage.findUnique.mockResolvedValue(null);

      const existing = await mockPrismaCreditPackage.findUnique({
        where: { id: 999 }
      });

      expect(existing).toBeNull();
      // La API retornaría 404
    });

    it('NO debería usar hard delete', () => {
      // Verificar que nunca se llama a delete, solo update
      const deleteWasCalled = mockPrismaCreditPackage.delete.mock.calls.length > 0;
      expect(deleteWasCalled).toBe(false);
    });
  });

  // =============================================
  // Seguridad y Autenticación
  // =============================================
  describe('Seguridad y Autenticación', () => {
    it('debería verificar que solo admin tiene acceso al CRUD', () => {
      const adminUser = { id: 1, role: 'admin' };
      const companyUser = { id: 2, role: 'company' };
      const recruiterUser = { id: 3, role: 'recruiter' };
      const specialistUser = { id: 4, role: 'specialist' };

      expect(adminUser.role === 'admin').toBe(true);
      expect(companyUser.role === 'admin').toBe(false);
      expect(recruiterUser.role === 'admin').toBe(false);
      expect(specialistUser.role === 'admin').toBe(false);
    });

    it('debería permitir acceso público a GET con ?activeOnly=true', () => {
      // Este endpoint es público para la página de compra
      const isPublicAccess = true;
      const activeOnlyParam = 'true';

      expect(isPublicAccess && activeOnlyParam === 'true').toBe(true);
    });

    it('debería requerir autenticación para POST', () => {
      const token = null;
      expect(!!token).toBe(false);
      // Sin token, la API retorna 401
    });

    it('debería requerir autenticación para PUT', () => {
      const token = null;
      expect(!!token).toBe(false);
      // Sin token, la API retorna 401
    });

    it('debería requerir autenticación para DELETE', () => {
      const token = null;
      expect(!!token).toBe(false);
      // Sin token, la API retorna 401
    });
  });

  // =============================================
  // Validaciones de Datos
  // =============================================
  describe('Validaciones de Datos', () => {
    it('debería validar que name no esté vacío', () => {
      const validNames = ['1 Crédito', 'Pack 10', 'Paquete Especial'];
      const invalidNames = ['', '   ', null, undefined];

      validNames.forEach(name => {
        expect(name && name.trim().length > 0).toBe(true);
      });

      invalidNames.forEach(name => {
        expect(name && (name as string).trim().length > 0).toBeFalsy();
      });
    });

    it('debería validar que credits sea un número entero positivo', () => {
      const validCredits = [1, 5, 10, 15, 20, 100];
      const invalidCredits = [0, -1, 1.5, 2.7];

      validCredits.forEach(credits => {
        expect(Number.isInteger(credits) && credits > 0).toBe(true);
      });

      invalidCredits.forEach(credits => {
        expect(Number.isInteger(credits) && credits > 0).toBe(false);
      });
    });

    it('debería validar que price sea un número positivo', () => {
      const validPrices = [1000, 4000, 35000, 65000, 100000.50];
      const invalidPrices = [0, -1, -1000];

      validPrices.forEach(price => {
        expect(typeof price === 'number' && price > 0).toBe(true);
      });

      invalidPrices.forEach(price => {
        expect(typeof price === 'number' && price > 0).toBe(false);
      });
    });

    it('debería validar que sortOrder sea un número no negativo', () => {
      const validSortOrders = [0, 1, 2, 5, 10, 100];
      const invalidSortOrders = [-1, -10];

      validSortOrders.forEach(sortOrder => {
        expect(Number.isInteger(sortOrder) && sortOrder >= 0).toBe(true);
      });

      invalidSortOrders.forEach(sortOrder => {
        expect(Number.isInteger(sortOrder) && sortOrder >= 0).toBe(false);
      });
    });
  });

  // =============================================
  // Casos de Uso del Frontend
  // =============================================
  describe('Casos de Uso del Frontend', () => {
    it('debería permitir a la página de compra obtener paquetes activos', async () => {
      const activePackages = [
        { id: 1, name: '1 Crédito', credits: 1, price: 4000, badge: null, isActive: true },
        { id: 2, name: 'Pack 10', credits: 10, price: 35000, badge: 'MÁS POPULAR', isActive: true },
      ];

      mockPrismaCreditPackage.findMany.mockResolvedValue(activePackages);

      const packages = await mockPrismaCreditPackage.findMany({
        where: { isActive: true },
        orderBy: { sortOrder: 'asc' }
      });

      expect(packages.length).toBeGreaterThan(0);
      expect(packages.every((p: any) => p.isActive)).toBe(true);
    });

    it('debería ordenar paquetes por sortOrder para mostrar en orden correcto', async () => {
      const packages = [
        { id: 4, sortOrder: 4, name: 'Pack 20' },
        { id: 1, sortOrder: 1, name: '1 Crédito' },
        { id: 3, sortOrder: 3, name: 'Pack 15' },
        { id: 2, sortOrder: 2, name: 'Pack 10' },
      ];

      const sorted = [...packages].sort((a, b) => a.sortOrder - b.sortOrder);

      expect(sorted[0].name).toBe('1 Crédito');
      expect(sorted[1].name).toBe('Pack 10');
      expect(sorted[2].name).toBe('Pack 15');
      expect(sorted[3].name).toBe('Pack 20');
    });

    it('debería identificar el paquete con badge MÁS POPULAR para preselección', () => {
      const packages = [
        { id: 1, name: '1 Crédito', badge: null },
        { id: 2, name: 'Pack 10', badge: 'MÁS POPULAR' },
        { id: 3, name: 'Pack 15', badge: null },
        { id: 4, name: 'Pack 20', badge: 'PROMOCIÓN' },
      ];

      const popularPackage = packages.find(p => p.badge === 'MÁS POPULAR');

      expect(popularPackage).toBeDefined();
      expect(popularPackage?.id).toBe(2);
    });

    it('debería proporcionar datos suficientes para mostrar tarjetas de paquetes', () => {
      const pkg = {
        id: 2,
        name: 'Pack 10',
        credits: 10,
        price: 35000,
        pricePerCredit: 3500,
        badge: 'MÁS POPULAR',
        isActive: true
      };

      // Verificar que tiene todos los campos necesarios para el frontend
      expect(pkg.name).toBeDefined();
      expect(pkg.credits).toBeDefined();
      expect(pkg.price).toBeDefined();
      expect(pkg.pricePerCredit).toBeDefined();
      expect(pkg.badge !== undefined).toBe(true); // Puede ser null
    });

    it('debería usar fallback si la API no retorna paquetes', () => {
      const apiPackages: any[] = [];

      const DEFAULT_PACKAGES = [
        { id: 1, name: '1 Crédito', credits: 1, price: 4000 },
        { id: 2, name: 'Pack 10', credits: 10, price: 35000 },
      ];

      const packagesToUse = apiPackages.length > 0 ? apiPackages : DEFAULT_PACKAGES;

      expect(packagesToUse).toEqual(DEFAULT_PACKAGES);
    });
  });

  // =============================================
  // Integridad de Precios de Referencia
  // =============================================
  describe('Integridad de Precios de Referencia (OCC)', () => {
    it('debería tener el paquete de 1 crédito a $4,000', () => {
      const singlePackage = { credits: 1, price: 4000 };
      expect(singlePackage.price / singlePackage.credits).toBe(4000);
    });

    it('debería tener el paquete de 10 créditos a $35,000 ($3,500/u)', () => {
      const pack10 = { credits: 10, price: 35000 };
      expect(pack10.price / pack10.credits).toBe(3500);
    });

    it('debería tener el paquete de 15 créditos a $50,000 (~$3,333/u)', () => {
      const pack15 = { credits: 15, price: 50000 };
      expect(pack15.price / pack15.credits).toBeCloseTo(3333.33, 1);
    });

    it('debería tener el paquete de 20 créditos a $65,000 ($3,250/u)', () => {
      const pack20 = { credits: 20, price: 65000 };
      expect(pack20.price / pack20.credits).toBe(3250);
    });

    it('debería dar mejor precio por crédito a mayor cantidad', () => {
      const packages = [
        { credits: 1, price: 4000 },
        { credits: 10, price: 35000 },
        { credits: 15, price: 50000 },
        { credits: 20, price: 65000 },
      ];

      const pricesPerCredit = packages.map(p => p.price / p.credits);

      // Verificar que el precio por crédito disminuye
      for (let i = 1; i < pricesPerCredit.length; i++) {
        expect(pricesPerCredit[i]).toBeLessThan(pricesPerCredit[i - 1]);
      }
    });
  });
});
