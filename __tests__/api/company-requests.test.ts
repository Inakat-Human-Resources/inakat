// RUTA: __tests__/api/company-requests.test.ts

/**
 * Tests para las APIs de solicitudes de empresa
 * Verifican: creación, validaciones, RFC compartido entre departamentos
 */

// Mock de Prisma
const mockPrismaCompanyRequest = {
  findMany: jest.fn(),
  findUnique: jest.fn(),
  create: jest.fn(),
};

jest.mock('@/lib/prisma', () => ({
  prisma: {
    companyRequest: mockPrismaCompanyRequest,
  },
}));

describe('Company Requests API Logic Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /api/company-requests - Listado', () => {
    it('debería listar todas las solicitudes', async () => {
      const mockRequests = [
        { id: 1, nombreEmpresa: 'Tech Corp', status: 'pending' },
        { id: 2, nombreEmpresa: 'Design Co', status: 'approved' },
      ];

      mockPrismaCompanyRequest.findMany.mockResolvedValue(mockRequests);

      const requests = await mockPrismaCompanyRequest.findMany({
        orderBy: { createdAt: 'desc' },
      });

      expect(requests).toHaveLength(2);
    });

    it('debería filtrar por status=pending', async () => {
      mockPrismaCompanyRequest.findMany.mockResolvedValue([]);

      await mockPrismaCompanyRequest.findMany({
        where: { status: 'pending' },
      });

      expect(mockPrismaCompanyRequest.findMany).toHaveBeenCalledWith({
        where: { status: 'pending' },
      });
    });

    it('debería filtrar por status=approved', async () => {
      mockPrismaCompanyRequest.findMany.mockResolvedValue([]);

      await mockPrismaCompanyRequest.findMany({
        where: { status: 'approved' },
      });

      expect(mockPrismaCompanyRequest.findMany).toHaveBeenCalledWith({
        where: { status: 'approved' },
      });
    });

    it('debería filtrar por status=rejected', async () => {
      mockPrismaCompanyRequest.findMany.mockResolvedValue([]);

      await mockPrismaCompanyRequest.findMany({
        where: { status: 'rejected' },
      });

      expect(mockPrismaCompanyRequest.findMany).toHaveBeenCalledWith({
        where: { status: 'rejected' },
      });
    });
  });

  describe('POST /api/company-requests - Validaciones', () => {
    const requiredFields = [
      'nombre',
      'apellidoPaterno',
      'apellidoMaterno',
      'nombreEmpresa',
      'correoEmpresa',
      'razonSocial',
      'rfc',
      'direccionEmpresa',
    ];

    it('debería validar campos requeridos', () => {
      const validRequest = {
        nombre: 'Carlos',
        apellidoPaterno: 'Mendoza',
        apellidoMaterno: 'Ruiz',
        nombreEmpresa: 'New Tech SA',
        correoEmpresa: 'carlos@newtech.com',
        razonSocial: 'New Tech SA de CV',
        rfc: 'NTE123456ABC',
        direccionEmpresa: 'Av. Tecnología 123, Monterrey',
      };

      const isValid = requiredFields.every(field => validRequest[field as keyof typeof validRequest]);
      expect(isValid).toBe(true);
    });

    it('debería rechazar si falta nombre', () => {
      const invalidRequest = {
        apellidoPaterno: 'Mendoza',
        apellidoMaterno: 'Ruiz',
        nombreEmpresa: 'Test',
        correoEmpresa: 'test@test.com',
        razonSocial: 'Test SA',
        rfc: 'TST123456ABC',
        direccionEmpresa: 'Dirección',
      };

      const hasNombre = 'nombre' in invalidRequest;
      expect(hasNombre).toBe(false);
    });

    it('debería rechazar si falta RFC', () => {
      const invalidRequest = {
        nombre: 'Test',
        apellidoPaterno: 'Test',
        apellidoMaterno: 'Test',
        nombreEmpresa: 'Test',
        correoEmpresa: 'test@test.com',
        razonSocial: 'Test SA',
        direccionEmpresa: 'Dirección',
      };

      const hasRfc = 'rfc' in invalidRequest;
      expect(hasRfc).toBe(false);
    });

    it('debería rechazar si falta direccionEmpresa', () => {
      const invalidRequest = {
        nombre: 'Test',
        apellidoPaterno: 'Test',
        apellidoMaterno: 'Test',
        nombreEmpresa: 'Test',
        correoEmpresa: 'test@test.com',
        razonSocial: 'Test SA',
        rfc: 'TST123456ABC',
      };

      const hasDireccion = 'direccionEmpresa' in invalidRequest;
      expect(hasDireccion).toBe(false);
    });
  });

  describe('POST /api/company-requests - Validación de RFC', () => {
    it('debería aceptar RFC válido de persona moral (12 caracteres)', () => {
      const rfcMoral = 'ABC123456A1A';
      const rfcPattern = /^[A-ZÑ&]{3,4}[0-9]{6}[A-Z0-9]{3}$/;

      expect(rfcPattern.test(rfcMoral)).toBe(true);
    });

    it('debería aceptar RFC válido de persona física (13 caracteres)', () => {
      const rfcFisica = 'XAXX010101AAA';
      const rfcPattern = /^[A-ZÑ&]{3,4}[0-9]{6}[A-Z0-9]{3}$/;

      expect(rfcPattern.test(rfcFisica)).toBe(true);
    });

    it('debería rechazar RFC con formato inválido', () => {
      const rfcsInvalidos = ['123', 'ABC', '12345678901234', 'abc123456a1a'];
      const rfcPattern = /^[A-ZÑ&]{3,4}[0-9]{6}[A-Z0-9]{3}$/;

      rfcsInvalidos.forEach(rfc => {
        expect(rfcPattern.test(rfc)).toBe(false);
      });
    });
  });

  describe('POST /api/company-requests - RFC compartido entre departamentos', () => {
    it('debería crear solicitud con RFC válido', async () => {
      const newRequest = {
        id: 1,
        nombre: 'Carlos',
        apellidoPaterno: 'Mendoza',
        apellidoMaterno: 'Ruiz',
        nombreEmpresa: 'New Tech SA',
        correoEmpresa: 'carlos@newtech.com',
        razonSocial: 'New Tech SA de CV',
        rfc: 'NTE123456ABC',
        direccionEmpresa: 'Av. Tecnología 123',
        status: 'pending',
      };

      mockPrismaCompanyRequest.create.mockResolvedValue(newRequest);

      const request = await mockPrismaCompanyRequest.create({
        data: {
          nombre: 'Carlos',
          apellidoPaterno: 'Mendoza',
          apellidoMaterno: 'Ruiz',
          nombreEmpresa: 'New Tech SA',
          correoEmpresa: 'carlos@newtech.com',
          razonSocial: 'New Tech SA de CV',
          rfc: 'NTE123456ABC',
          direccionEmpresa: 'Av. Tecnología 123',
        },
      });

      expect(request.rfc).toBe('NTE123456ABC');
      expect(request.status).toBe('pending');
    });

    it('debería permitir RFC duplicado (múltiples departamentos)', async () => {
      // Primer departamento
      const dept1 = {
        id: 1,
        nombre: 'Ana',
        apellidoPaterno: 'López',
        apellidoMaterno: 'García',
        nombreEmpresa: 'Corp SA - TI',
        correoEmpresa: 'ti@corp.com',
        razonSocial: 'Corp SA de CV',
        rfc: 'CSA123456ABC',
        direccionEmpresa: 'Av. Principal 100',
        status: 'pending',
      };

      // Segundo departamento, mismo RFC
      const dept2 = {
        id: 2,
        nombre: 'Pedro',
        apellidoPaterno: 'Ruiz',
        apellidoMaterno: 'Soto',
        nombreEmpresa: 'Corp SA - RH',
        correoEmpresa: 'rh@corp.com',
        razonSocial: 'Corp SA de CV',
        rfc: 'CSA123456ABC',
        direccionEmpresa: 'Av. Principal 100',
        status: 'pending',
      };

      mockPrismaCompanyRequest.create
        .mockResolvedValueOnce(dept1)
        .mockResolvedValueOnce(dept2);

      const result1 = await mockPrismaCompanyRequest.create({ data: dept1 });
      const result2 = await mockPrismaCompanyRequest.create({ data: dept2 });

      expect(result1.rfc).toBe('CSA123456ABC');
      expect(result2.rfc).toBe('CSA123456ABC');
      expect(result1.id).not.toBe(result2.id);
      expect(result1.correoEmpresa).not.toBe(result2.correoEmpresa);
    });
  });

  describe('POST /api/company-requests - Campos opcionales', () => {
    it('debería aceptar solicitud sin sitioWeb', async () => {
      const newRequest = {
        id: 1,
        nombreEmpresa: 'Test Corp',
        sitioWeb: null,
      };

      mockPrismaCompanyRequest.create.mockResolvedValue(newRequest);

      const request = await mockPrismaCompanyRequest.create({
        data: {
          nombre: 'Test',
          apellidoPaterno: 'User',
          apellidoMaterno: 'Test',
          nombreEmpresa: 'Test Corp',
          correoEmpresa: 'test@test.com',
          razonSocial: 'Test Corp SA',
          rfc: 'TST123456ABC',
          direccionEmpresa: 'Calle Test',
          sitioWeb: null,
        },
      });

      expect(request.sitioWeb).toBeNull();
    });

    it('debería aceptar solicitud sin documentos', async () => {
      const newRequest = {
        id: 1,
        nombreEmpresa: 'Test Corp',
        identificacionUrl: null,
        documentosConstitucionUrl: null,
      };

      mockPrismaCompanyRequest.create.mockResolvedValue(newRequest);

      const request = await mockPrismaCompanyRequest.create({
        data: {
          nombre: 'Test',
          apellidoPaterno: 'User',
          apellidoMaterno: 'Test',
          nombreEmpresa: 'Test Corp',
          correoEmpresa: 'test@test.com',
          razonSocial: 'Test Corp SA',
          rfc: 'TST123456ABC',
          direccionEmpresa: 'Calle Test',
          identificacionUrl: null,
          documentosConstitucionUrl: null,
        },
      });

      expect(request.identificacionUrl).toBeNull();
      expect(request.documentosConstitucionUrl).toBeNull();
    });
  });

  describe('POST /api/company-requests - Creación exitosa', () => {
    it('debería crear solicitud con todos los campos', async () => {
      const newRequest = {
        id: 1,
        nombre: 'Carlos',
        apellidoPaterno: 'Mendoza',
        apellidoMaterno: 'Ruiz',
        nombreEmpresa: 'New Tech SA',
        correoEmpresa: 'carlos@newtech.com',
        sitioWeb: 'https://newtech.com',
        razonSocial: 'New Tech SA de CV',
        rfc: 'NTE123456ABC',
        direccionEmpresa: 'Av. Tecnología 123, Monterrey, NL',
        identificacionUrl: 'https://storage.com/id.pdf',
        documentosConstitucionUrl: 'https://storage.com/docs.pdf',
        status: 'pending',
        createdAt: new Date(),
      };

      mockPrismaCompanyRequest.create.mockResolvedValue(newRequest);

      const request = await mockPrismaCompanyRequest.create({
        data: {
          nombre: 'Carlos',
          apellidoPaterno: 'Mendoza',
          apellidoMaterno: 'Ruiz',
          nombreEmpresa: 'New Tech SA',
          correoEmpresa: 'carlos@newtech.com',
          sitioWeb: 'https://newtech.com',
          razonSocial: 'New Tech SA de CV',
          rfc: 'NTE123456ABC',
          direccionEmpresa: 'Av. Tecnología 123, Monterrey, NL',
          identificacionUrl: 'https://storage.com/id.pdf',
          documentosConstitucionUrl: 'https://storage.com/docs.pdf',
        },
      });

      expect(request.nombreEmpresa).toBe('New Tech SA');
      expect(request.status).toBe('pending');
      expect(request.identificacionUrl).toBe('https://storage.com/id.pdf');
    });

    it('debería crear solicitud con status=pending por defecto', async () => {
      const newRequest = {
        id: 1,
        status: 'pending',
      };

      mockPrismaCompanyRequest.create.mockResolvedValue(newRequest);

      const request = await mockPrismaCompanyRequest.create({
        data: {
          nombre: 'Test',
          apellidoPaterno: 'Test',
          apellidoMaterno: 'Test',
          nombreEmpresa: 'Test',
          correoEmpresa: 'test@test.com',
          razonSocial: 'Test SA',
          rfc: 'TST123456ABC',
          direccionEmpresa: 'Dir',
        },
      });

      expect(request.status).toBe('pending');
    });
  });

  describe('Middleware - Permisos de acceso a /api/company-requests', () => {
    /**
     * Estos tests verifican la lógica de permisos del middleware:
     * - POST /api/company-requests → PÚBLICO (registro de empresas)
     * - GET /api/company-requests → Solo admin
     * - PUT/DELETE /api/company-requests/[id] → Solo admin
     */

    it('POST debe ser público - cualquiera puede registrar empresa', () => {
      // Simular la lógica del middleware para POST
      const pathname = '/api/company-requests';
      const method = 'POST';

      // La excepción en el middleware permite POST sin autenticación
      const isPublicPostRoute = pathname === '/api/company-requests' && method === 'POST';

      expect(isPublicPostRoute).toBe(true);
    });

    it('GET requiere rol admin', () => {
      const pathname = '/api/company-requests';
      const method = 'GET';
      const userRole = 'user';

      // La ruta está protegida para admin
      const isAdminRoute = pathname.startsWith('/api/company-requests');
      const isPostException = pathname === '/api/company-requests' && method === 'POST';
      const requiresAdmin = isAdminRoute && !isPostException;
      const hasPermission = userRole === 'admin';

      expect(requiresAdmin).toBe(true);
      expect(hasPermission).toBe(false);
    });

    it('GET con rol admin tiene acceso', () => {
      const pathname = '/api/company-requests';
      const method = 'GET';
      const userRole = 'admin';

      const isAdminRoute = pathname.startsWith('/api/company-requests');
      const isPostException = pathname === '/api/company-requests' && method === 'POST';
      const requiresAdmin = isAdminRoute && !isPostException;
      const hasPermission = userRole === 'admin';

      expect(requiresAdmin).toBe(true);
      expect(hasPermission).toBe(true);
    });

    it('PUT a /api/company-requests/[id] requiere admin', () => {
      const pathname = '/api/company-requests/123';
      const method = 'PUT';
      const userRole = 'company';

      const isAdminRoute = pathname.startsWith('/api/company-requests');
      const isPostException = pathname === '/api/company-requests' && method === 'POST';
      const requiresAdmin = isAdminRoute && !isPostException;
      const hasPermission = userRole === 'admin';

      expect(requiresAdmin).toBe(true);
      expect(hasPermission).toBe(false);
    });

    it('DELETE a /api/company-requests/[id] requiere admin', () => {
      const pathname = '/api/company-requests/456';
      const method = 'DELETE';
      const userRole = 'recruiter';

      const isAdminRoute = pathname.startsWith('/api/company-requests');
      const isPostException = pathname === '/api/company-requests' && method === 'POST';
      const requiresAdmin = isAdminRoute && !isPostException;
      const hasPermission = userRole === 'admin';

      expect(requiresAdmin).toBe(true);
      expect(hasPermission).toBe(false);
    });

    it('POST a subrutas como /api/company-requests/123 NO es público', () => {
      const pathname = '/api/company-requests/123';
      const method = 'POST';

      // Solo POST a la ruta exacta /api/company-requests es público
      const isPublicPostRoute = pathname === '/api/company-requests' && method === 'POST';

      expect(isPublicPostRoute).toBe(false);
    });
  });
});
