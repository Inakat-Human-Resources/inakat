// RUTA: __tests__/api/vendors.test.ts

/**
 * Tests para el Sistema de Vendedores
 * Incluye: Códigos de descuento, validación, uso en compras, admin
 */

// Mock de NextResponse
jest.mock('next/server', () => ({
  NextResponse: {
    json: (data: any, options?: any) => ({
      status: options?.status || 200,
      json: async () => data
    })
  }
}));

// Mock de prisma
const mockPrisma = {
  discountCode: {
    findFirst: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    findMany: jest.fn(),
    count: jest.fn()
  },
  discountCodeUse: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    count: jest.fn(),
    aggregate: jest.fn(),
    update: jest.fn()
  }
};

jest.mock('@/lib/prisma', () => ({
  prisma: mockPrisma
}));

// Helper para crear requests con headers de autenticación
function createMockRequest(options: {
  userId?: number;
  userRole?: string;
  body?: any;
  method?: string;
  url?: string;
} = {}) {
  const headers = new Map<string, string>();
  if (options.userId) {
    headers.set('x-user-id', String(options.userId));
  }
  if (options.userRole) {
    headers.set('x-user-role', options.userRole);
  }

  return {
    headers: {
      get: (name: string) => headers.get(name) || null
    },
    json: async () => options.body || {},
    url: options.url || 'http://localhost:3000/api/vendor/my-code'
  } as any;
}

describe('Sistema de Vendedores', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // =============================================
  // DISCOUNT CODE CRUD
  // =============================================
  describe('Discount Code CRUD - /api/vendor/my-code', () => {
    describe('GET - Obtener mi código', () => {
      it('debe retornar null si el usuario no tiene código', async () => {
        mockPrisma.discountCode.findFirst.mockResolvedValue(null);

        const { GET } = await import('@/app/api/vendor/my-code/route');
        const request = createMockRequest({ userId: 1, userRole: 'user' });
        const response = await GET(request);
        const data = await response.json();

        expect(data.success).toBe(true);
        expect(data.data).toBeNull();
      });

      it('debe retornar el código si el usuario tiene uno', async () => {
        const mockCode = {
          id: 1,
          code: 'TEST10',
          discountPercent: 10,
          commissionPercent: 10,
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date(),
          _count: { uses: 5 }
        };

        mockPrisma.discountCode.findFirst.mockResolvedValue(mockCode);

        const { GET } = await import('@/app/api/vendor/my-code/route');
        const request = createMockRequest({ userId: 1, userRole: 'user' });
        const response = await GET(request);
        const data = await response.json();

        expect(data.success).toBe(true);
        expect(data.data.code).toBe('TEST10');
        expect(data.data.discountPercent).toBe(10);
      });

      it('debe retornar 401 si no está autenticado', async () => {
        const { GET } = await import('@/app/api/vendor/my-code/route');
        const request = createMockRequest({}); // Sin userId
        const response = await GET(request);

        expect(response.status).toBe(401);
      });
    });

    describe('POST - Crear código', () => {
      it('debe crear un código válido', async () => {
        mockPrisma.discountCode.findFirst.mockResolvedValue(null);
        mockPrisma.discountCode.findUnique.mockResolvedValue(null);

        const createdCode = {
          id: 1,
          code: 'MICODIGO',
          discountPercent: 10,
          commissionPercent: 10,
          isActive: true,
          createdAt: new Date()
        };
        mockPrisma.discountCode.create.mockResolvedValue(createdCode);

        const { POST } = await import('@/app/api/vendor/my-code/route');
        const request = createMockRequest({
          userId: 1,
          userRole: 'user',
          body: { code: 'micodigo' }
        });
        const response = await POST(request);
        const data = await response.json();

        expect(data.success).toBe(true);
        expect(data.data.code).toBe('MICODIGO');
        expect(response.status).toBe(201);
      });

      it('debe rechazar código muy corto', async () => {
        const { POST } = await import('@/app/api/vendor/my-code/route');
        const request = createMockRequest({
          userId: 1,
          userRole: 'user',
          body: { code: 'AB' }
        });
        const response = await POST(request);
        const data = await response.json();

        expect(data.success).toBe(false);
        expect(response.status).toBe(400);
      });

      it('debe rechazar código con caracteres especiales', async () => {
        const { POST } = await import('@/app/api/vendor/my-code/route');
        const request = createMockRequest({
          userId: 1,
          userRole: 'user',
          body: { code: 'MI-CODIGO' }
        });
        const response = await POST(request);
        const data = await response.json();

        expect(data.success).toBe(false);
        expect(response.status).toBe(400);
      });

      it('debe rechazar código duplicado', async () => {
        mockPrisma.discountCode.findFirst.mockResolvedValue(null);
        mockPrisma.discountCode.findUnique.mockResolvedValue({ id: 2, code: 'EXISTENTE' });

        const { POST } = await import('@/app/api/vendor/my-code/route');
        const request = createMockRequest({
          userId: 1,
          userRole: 'user',
          body: { code: 'EXISTENTE' }
        });
        const response = await POST(request);
        const data = await response.json();

        expect(data.success).toBe(false);
        expect(response.status).toBe(409);
      });

      it('debe rechazar si usuario ya tiene código', async () => {
        mockPrisma.discountCode.findFirst.mockResolvedValue({ id: 1, code: 'YATENGO' });

        const { POST } = await import('@/app/api/vendor/my-code/route');
        const request = createMockRequest({
          userId: 1,
          userRole: 'user',
          body: { code: 'NUEVO' }
        });
        const response = await POST(request);
        const data = await response.json();

        expect(data.success).toBe(false);
        expect(response.status).toBe(409);
      });
    });

    describe('PUT - Actualizar código', () => {
      it('debe actualizar el código existente', async () => {
        mockPrisma.discountCode.findFirst
          .mockResolvedValueOnce({ id: 1, code: 'VIEJO' }) // exists check
          .mockResolvedValueOnce(null); // duplicate check

        const updatedCode = {
          id: 1,
          code: 'NUEVO',
          discountPercent: 10,
          commissionPercent: 10,
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date()
        };
        mockPrisma.discountCode.update.mockResolvedValue(updatedCode);

        const { PUT } = await import('@/app/api/vendor/my-code/route');
        const request = createMockRequest({
          userId: 1,
          userRole: 'user',
          body: { code: 'NUEVO' }
        });
        const response = await PUT(request);
        const data = await response.json();

        expect(data.success).toBe(true);
        expect(data.data.code).toBe('NUEVO');
      });

      it('debe retornar 404 si no tiene código', async () => {
        mockPrisma.discountCode.findFirst.mockResolvedValue(null);

        const { PUT } = await import('@/app/api/vendor/my-code/route');
        const request = createMockRequest({
          userId: 1,
          userRole: 'user',
          body: { code: 'NUEVO' }
        });
        const response = await PUT(request);

        expect(response.status).toBe(404);
      });

      it('debe poder activar/desactivar el código', async () => {
        mockPrisma.discountCode.findFirst.mockResolvedValue({ id: 1, code: 'MICODIGO' });

        const updatedCode = {
          id: 1,
          code: 'MICODIGO',
          isActive: false,
          discountPercent: 10,
          commissionPercent: 10,
          createdAt: new Date(),
          updatedAt: new Date()
        };
        mockPrisma.discountCode.update.mockResolvedValue(updatedCode);

        const { PUT } = await import('@/app/api/vendor/my-code/route');
        const request = createMockRequest({
          userId: 1,
          userRole: 'user',
          body: { isActive: false }
        });
        const response = await PUT(request);
        const data = await response.json();

        expect(data.success).toBe(true);
        expect(data.data.isActive).toBe(false);
      });
    });
  });

  // =============================================
  // VENDOR SALES
  // =============================================
  describe('Vendor Sales - /api/vendor/my-sales', () => {
    it('debe retornar lista vacía si no tiene código', async () => {
      mockPrisma.discountCode.findFirst.mockResolvedValue(null);

      const { GET } = await import('@/app/api/vendor/my-sales/route');
      const request = createMockRequest({
        userId: 1,
        userRole: 'user',
        url: 'http://localhost:3000/api/vendor/my-sales'
      });
      const response = await GET(request);
      const data = await response.json();

      expect(data.success).toBe(true);
      expect(data.data.hasCode).toBe(false);
      expect(data.data.sales).toEqual([]);
    });

    it('debe retornar ventas con estadísticas', async () => {
      const mockCode = { id: 1, code: 'MICODIGO' };
      mockPrisma.discountCode.findFirst.mockResolvedValue(mockCode);

      const mockSales = [{
        id: 1,
        codeId: 1,
        purchaseId: 1,
        originalPrice: 1000,
        discountAmount: 100,
        finalPrice: 900,
        commissionAmount: 90,
        commissionStatus: 'pending',
        commissionPaidAt: null,
        paymentDueDate: new Date(),
        paymentProofUrl: null,
        createdAt: new Date(),
        purchase: {
          id: 1,
          amount: 10,
          user: {
            id: 2,
            nombre: 'Empresa Test',
            email: 'empresa@test.com',
            companyRequest: { nombreEmpresa: 'Mi Empresa' }
          }
        }
      }];

      mockPrisma.discountCodeUse.findMany.mockResolvedValue(mockSales);
      mockPrisma.discountCodeUse.count.mockResolvedValue(1);
      mockPrisma.discountCodeUse.aggregate
        .mockResolvedValueOnce({ _sum: { commissionAmount: 90 } }) // total
        .mockResolvedValueOnce({ _sum: { commissionAmount: 90 } }) // pending
        .mockResolvedValueOnce({ _sum: { commissionAmount: 0 } }); // paid

      const { GET } = await import('@/app/api/vendor/my-sales/route');
      const request = createMockRequest({
        userId: 1,
        userRole: 'user',
        url: 'http://localhost:3000/api/vendor/my-sales'
      });
      const response = await GET(request);
      const data = await response.json();

      expect(data.success).toBe(true);
      expect(data.data.hasCode).toBe(true);
      expect(data.data.sales.length).toBe(1);
      expect(data.data.summary.pendingCommission).toBe(90);
    });
  });

  // =============================================
  // DISCOUNT CODE VALIDATION
  // =============================================
  describe('Discount Code Validation - /api/discount-codes/validate', () => {
    it('debe validar código activo', async () => {
      const mockCode = {
        id: 1,
        code: 'DESCUENTO10',
        discountPercent: 10,
        user: { nombre: 'Vendedor' }
      };
      // La API usa findFirst con isActive: true
      mockPrisma.discountCode.findFirst.mockResolvedValue(mockCode);

      const { POST } = await import('@/app/api/discount-codes/validate/route');
      const request = {
        json: async () => ({ code: 'DESCUENTO10', packagePrice: 1000 })
      } as any;
      const response = await POST(request);
      const data = await response.json();

      expect(data.success).toBe(true);
      expect(data.valid).toBe(true);
      expect(data.data.discountPercent).toBe(10);
      expect(data.data.pricing.discountAmount).toBe(100);
      expect(data.data.pricing.finalPrice).toBe(900);
    });

    it('debe rechazar código inactivo', async () => {
      // Si el código está inactivo, findFirst con isActive:true no lo encuentra
      mockPrisma.discountCode.findFirst.mockResolvedValue(null);

      const { POST } = await import('@/app/api/discount-codes/validate/route');
      const request = {
        json: async () => ({ code: 'INACTIVO', packagePrice: 1000 })
      } as any;
      const response = await POST(request);
      const data = await response.json();

      expect(data.success).toBe(false);
      expect(data.valid).toBe(false);
    });

    it('debe rechazar código inexistente', async () => {
      mockPrisma.discountCode.findFirst.mockResolvedValue(null);

      const { POST } = await import('@/app/api/discount-codes/validate/route');
      const request = {
        json: async () => ({ code: 'NOEXISTE', packagePrice: 1000 })
      } as any;
      const response = await POST(request);
      const data = await response.json();

      expect(data.success).toBe(false);
      expect(data.valid).toBe(false);
    });
  });

  // =============================================
  // ADMIN VENDORS
  // =============================================
  describe('Admin Vendors - /api/admin/vendors', () => {
    it('debe listar vendedores con estadísticas', async () => {
      const mockCodes = [{
        id: 1,
        code: 'VENDEDOR1',
        discountPercent: 10,
        commissionPercent: 10,
        isActive: true,
        createdAt: new Date(),
        user: {
          id: 1,
          nombre: 'Juan',
          apellidoPaterno: 'Pérez',
          apellidoMaterno: 'López',
          email: 'juan@test.com',
          role: 'user'
        },
        uses: [{
          id: 1,
          finalPrice: 900,
          commissionAmount: 90,
          commissionStatus: 'pending'
        }]
      }];

      mockPrisma.discountCode.findMany.mockResolvedValue(mockCodes);
      mockPrisma.discountCode.count.mockResolvedValue(1);
      mockPrisma.discountCodeUse.aggregate
        .mockResolvedValueOnce({ _sum: { finalPrice: 900, commissionAmount: 90 }, _count: 1 })
        .mockResolvedValueOnce({ _sum: { commissionAmount: 90 } });

      const { GET } = await import('@/app/api/admin/vendors/route');
      const request = createMockRequest({
        userId: 1,
        userRole: 'admin',
        url: 'http://localhost:3000/api/admin/vendors'
      });
      const response = await GET(request);
      const data = await response.json();

      expect(data.success).toBe(true);
      expect(data.data.vendors.length).toBe(1);
      expect(data.data.vendors[0].code).toBe('VENDEDOR1');
    });

    it('debe retornar 401 si no es admin', async () => {
      const { GET } = await import('@/app/api/admin/vendors/route');
      const request = createMockRequest({
        userId: 1,
        userRole: 'user', // Not admin
        url: 'http://localhost:3000/api/admin/vendors'
      });
      const response = await GET(request);

      expect(response.status).toBe(401);
    });
  });

  // =============================================
  // ADMIN COMMISSIONS
  // =============================================
  describe('Admin Commissions - /api/admin/vendors/commissions', () => {
    it('debe listar comisiones pendientes', async () => {
      const mockCommissions = [{
        id: 1,
        codeId: 1,
        purchaseId: 1,
        originalPrice: 1000,
        discountAmount: 100,
        finalPrice: 900,
        commissionAmount: 90,
        commissionStatus: 'pending',
        commissionPaidAt: null,
        paymentDueDate: new Date(),
        paymentProofUrl: null,
        createdAt: new Date(),
        code: {
          id: 1,
          code: 'CODE1',
          user: {
            id: 1,
            nombre: 'Vendedor',
            apellidoPaterno: 'Test',
            email: 'vendedor@test.com'
          }
        },
        purchase: {
          id: 1,
          amount: 10,
          user: {
            id: 2,
            nombre: 'Empresa',
            email: 'empresa@test.com',
            companyRequest: { nombreEmpresa: 'Mi Empresa' }
          }
        }
      }];

      mockPrisma.discountCodeUse.findMany.mockResolvedValue(mockCommissions);
      mockPrisma.discountCodeUse.count.mockResolvedValue(1);
      mockPrisma.discountCodeUse.aggregate
        .mockResolvedValueOnce({ _sum: { commissionAmount: 90 }, _count: 1 })
        .mockResolvedValueOnce({ _sum: { commissionAmount: 0 }, _count: 0 });

      const { GET } = await import('@/app/api/admin/vendors/commissions/route');
      const request = createMockRequest({
        userId: 1,
        userRole: 'admin',
        url: 'http://localhost:3000/api/admin/vendors/commissions?status=pending'
      });
      const response = await GET(request);
      const data = await response.json();

      expect(data.success).toBe(true);
      expect(data.data.commissions.length).toBe(1);
      expect(data.data.commissions[0].commission.status).toBe('pending');
    });

    it('debe marcar comisión como pagada', async () => {
      mockPrisma.discountCodeUse.findUnique.mockResolvedValue({
        id: 1,
        commissionStatus: 'pending',
        code: {
          id: 1,
          code: 'CODE1',
          user: { id: 1, nombre: 'Vendedor', email: 'v@test.com' }
        }
      });

      const updatedCommission = {
        id: 1,
        commissionStatus: 'paid',
        commissionPaidAt: new Date(),
        commissionAmount: 90,
        paymentProofUrl: 'http://proof.com/123',
        purchaseId: 1,
        code: {
          id: 1,
          code: 'CODE1',
          user: { id: 1, nombre: 'Vendedor', email: 'v@test.com' }
        },
        purchase: { id: 1, amount: 10 }
      };
      mockPrisma.discountCodeUse.update.mockResolvedValue(updatedCommission);

      const { PUT } = await import('@/app/api/admin/vendors/commissions/[id]/route');
      const request = createMockRequest({
        userId: 1,
        userRole: 'admin',
        body: { status: 'paid', paymentProofUrl: 'http://proof.com/123' }
      });
      const response = await PUT(request, { params: Promise.resolve({ id: '1' }) });
      const data = await response.json();

      expect(data.success).toBe(true);
      expect(data.data.commission.status).toBe('paid');
    });

    it('debe retornar 404 si comisión no existe', async () => {
      mockPrisma.discountCodeUse.findUnique.mockResolvedValue(null);

      const { PUT } = await import('@/app/api/admin/vendors/commissions/[id]/route');
      const request = createMockRequest({
        userId: 1,
        userRole: 'admin',
        body: { status: 'paid' }
      });
      const response = await PUT(request, { params: Promise.resolve({ id: '999' }) });

      expect(response.status).toBe(404);
    });
  });

  // =============================================
  // PERMISOS DE ACCESO
  // =============================================
  describe('Permisos de Acceso', () => {
    it('/api/vendor/* requiere autenticación', async () => {
      const { GET } = await import('@/app/api/vendor/my-code/route');
      const request = createMockRequest({}); // Sin userId
      const response = await GET(request);

      expect(response.status).toBe(401);
    });

    it('/api/admin/vendors requiere rol admin', async () => {
      const { GET } = await import('@/app/api/admin/vendors/route');
      const request = createMockRequest({
        userId: 1,
        userRole: 'user', // Not admin
        url: 'http://localhost:3000/api/admin/vendors'
      });
      const response = await GET(request);

      expect(response.status).toBe(401);
    });

    it('/api/admin/vendors/commissions requiere rol admin', async () => {
      const { GET } = await import('@/app/api/admin/vendors/commissions/route');
      const request = createMockRequest({
        userId: 1,
        userRole: 'company', // Not admin
        url: 'http://localhost:3000/api/admin/vendors/commissions'
      });
      const response = await GET(request);

      expect(response.status).toBe(401);
    });
  });
});
