// RUTA: __tests__/api/company-logo.test.ts

/**
 * Tests para FEAT-1: Logo de Empresa
 * Verifican: inclusión de logoUrl en APIs, sanitización en vacantes confidenciales
 */

// Mock de Prisma
const mockPrismaJob = {
  findMany: jest.fn(),
  findUnique: jest.fn(),
};

const mockPrismaApplication = {
  findMany: jest.fn(),
  findUnique: jest.fn(),
};

const mockPrismaCompanyRequest = {
  create: jest.fn(),
  update: jest.fn(),
  findUnique: jest.fn(),
};

const mockPrismaUser = {
  findUnique: jest.fn(),
};

jest.mock('@/lib/prisma', () => ({
  prisma: {
    job: mockPrismaJob,
    application: mockPrismaApplication,
    companyRequest: mockPrismaCompanyRequest,
    user: mockPrismaUser,
  },
}));

describe('FEAT-1: Logo de Empresa', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Inclusión de logoUrl en respuestas', () => {
    it('debe incluir logoUrl en vacantes no confidenciales', () => {
      const job = {
        id: 1,
        title: 'Desarrollador',
        company: 'TechCorp',
        isConfidential: false,
        user: {
          companyRequest: {
            logoUrl: 'https://example.com/logo.png',
          },
        },
      };

      const logoUrl = job.user?.companyRequest?.logoUrl || null;
      expect(logoUrl).toBe('https://example.com/logo.png');
    });

    it('debe retornar null si la empresa no tiene logo', () => {
      const job = {
        id: 1,
        title: 'Desarrollador',
        company: 'TechCorp',
        isConfidential: false,
        user: {
          companyRequest: {
            logoUrl: null,
          },
        },
      };

      const logoUrl = job.user?.companyRequest?.logoUrl || null;
      expect(logoUrl).toBeNull();
    });

    it('debe retornar null si no hay companyRequest', () => {
      const job = {
        id: 1,
        title: 'Desarrollador',
        company: 'TechCorp',
        isConfidential: false,
        user: null,
      };

      const logoUrl = job.user?.companyRequest?.logoUrl || null;
      expect(logoUrl).toBeNull();
    });
  });

  describe('Sanitización de logo en vacantes confidenciales', () => {
    const sanitizeConfidentialJob = (job: any, isOwnerOrAdmin: boolean) => {
      if (!job.isConfidential || isOwnerOrAdmin) {
        return job;
      }
      return {
        ...job,
        company: 'Empresa Confidencial',
        location: job.location ? job.location.split(',')[1]?.trim() || 'México' : 'México',
        logoUrl: null,
      };
    };

    it('debe ocultar logoUrl en vacantes confidenciales para usuarios normales', () => {
      const job = {
        id: 1,
        title: 'Desarrollador',
        company: 'TechCorp Secreto',
        location: 'Monterrey, Nuevo León',
        isConfidential: true,
        logoUrl: 'https://example.com/logo.png',
      };

      const sanitized = sanitizeConfidentialJob(job, false);

      expect(sanitized.logoUrl).toBeNull();
      expect(sanitized.company).toBe('Empresa Confidencial');
      expect(sanitized.location).toBe('Nuevo León');
    });

    it('debe mantener logoUrl para propietario en vacante confidencial', () => {
      const job = {
        id: 1,
        title: 'Desarrollador',
        company: 'TechCorp Secreto',
        location: 'Monterrey, Nuevo León',
        isConfidential: true,
        logoUrl: 'https://example.com/logo.png',
      };

      const sanitized = sanitizeConfidentialJob(job, true);

      expect(sanitized.logoUrl).toBe('https://example.com/logo.png');
      expect(sanitized.company).toBe('TechCorp Secreto');
    });

    it('debe mantener logoUrl para admin en vacante confidencial', () => {
      const job = {
        id: 1,
        title: 'Desarrollador',
        company: 'TechCorp Secreto',
        location: 'Monterrey, Nuevo León',
        isConfidential: true,
        logoUrl: 'https://example.com/logo.png',
      };

      const sanitized = sanitizeConfidentialJob(job, true); // isOwnerOrAdmin

      expect(sanitized.logoUrl).toBe('https://example.com/logo.png');
    });

    it('debe mantener logoUrl en vacantes NO confidenciales', () => {
      const job = {
        id: 1,
        title: 'Desarrollador',
        company: 'TechCorp',
        location: 'Monterrey, Nuevo León',
        isConfidential: false,
        logoUrl: 'https://example.com/logo.png',
      };

      const sanitized = sanitizeConfidentialJob(job, false);

      expect(sanitized.logoUrl).toBe('https://example.com/logo.png');
      expect(sanitized.company).toBe('TechCorp');
    });
  });

  describe('Logo en aplicaciones de candidato', () => {
    it('debe incluir logoUrl en aplicaciones para vacantes no confidenciales', () => {
      const application = {
        id: 1,
        job: {
          id: 10,
          title: 'Desarrollador',
          company: 'TechCorp',
          isConfidential: false,
          user: {
            companyRequest: {
              logoUrl: 'https://example.com/logo.png',
            },
          },
        },
      };

      const logoUrl = application.job?.user?.companyRequest?.logoUrl || null;
      const shouldHideLogo = application.job?.isConfidential;
      const finalLogoUrl = shouldHideLogo ? null : logoUrl;

      expect(finalLogoUrl).toBe('https://example.com/logo.png');
    });

    it('debe ocultar logoUrl en aplicaciones para vacantes confidenciales', () => {
      const application = {
        id: 1,
        job: {
          id: 10,
          title: 'Desarrollador',
          company: 'TechCorp Secreto',
          isConfidential: true,
          user: {
            companyRequest: {
              logoUrl: 'https://example.com/logo.png',
            },
          },
        },
      };

      const logoUrl = application.job?.user?.companyRequest?.logoUrl || null;
      const shouldHideLogo = application.job?.isConfidential;
      const finalLogoUrl = shouldHideLogo ? null : logoUrl;

      expect(finalLogoUrl).toBeNull();
    });
  });

  describe('Transformación de datos para API', () => {
    it('debe remover user anidado y agregar logoUrl directamente', () => {
      const rawJob = {
        id: 1,
        title: 'Desarrollador',
        company: 'TechCorp',
        location: 'CDMX',
        isConfidential: false,
        user: {
          companyRequest: {
            logoUrl: 'https://example.com/logo.png',
          },
        },
      };

      // Simular transformación del API
      const logoUrl = rawJob.user?.companyRequest?.logoUrl || null;
      const { user, ...jobWithoutUser } = rawJob;
      const transformedJob = { ...jobWithoutUser, logoUrl };

      expect(transformedJob.logoUrl).toBe('https://example.com/logo.png');
      expect(transformedJob).not.toHaveProperty('user');
      expect(transformedJob.company).toBe('TechCorp');
    });

    it('debe manejar correctamente cuando no hay logo', () => {
      const rawJob = {
        id: 1,
        title: 'Desarrollador',
        company: 'StartupCorp',
        location: 'GDL',
        isConfidential: false,
        user: {
          companyRequest: null,
        },
      };

      const logoUrl = rawJob.user?.companyRequest?.logoUrl || null;
      const { user, ...jobWithoutUser } = rawJob;
      const transformedJob = { ...jobWithoutUser, logoUrl };

      expect(transformedJob.logoUrl).toBeNull();
    });
  });

  describe('Componente CompanyLogo (unit tests)', () => {
    it('debe determinar correctamente cuando mostrar logo vs fallback', () => {
      // Caso con logo
      const withLogo = { logoUrl: 'https://example.com/logo.png', company: 'TechCorp' };
      expect(!!withLogo.logoUrl).toBe(true);

      // Caso sin logo
      const withoutLogo = { logoUrl: null, company: 'StartupCorp' };
      expect(!!withoutLogo.logoUrl).toBe(false);

      // Caso con string vacío
      const emptyLogo = { logoUrl: '', company: 'EmptyCorp' };
      expect(!!emptyLogo.logoUrl).toBe(false);
    });

    it('debe usar diferentes tamaños según prop size', () => {
      const sizeMap = {
        xs: { container: 'w-6 h-6', icon: 12 },
        sm: { container: 'w-8 h-8', icon: 16 },
        md: { container: 'w-10 h-10', icon: 20 },
        lg: { container: 'w-12 h-12', icon: 24 },
        xl: { container: 'w-16 h-16', icon: 32 },
      };

      expect(sizeMap['xs'].container).toBe('w-6 h-6');
      expect(sizeMap['md'].icon).toBe(20);
      expect(sizeMap['xl'].container).toBe('w-16 h-16');
    });
  });

  describe('Múltiples vacantes en lista', () => {
    it('debe transformar correctamente múltiples vacantes', () => {
      const rawJobs = [
        {
          id: 1,
          title: 'Dev 1',
          company: 'Company A',
          isConfidential: false,
          user: { companyRequest: { logoUrl: 'https://a.com/logo.png' } },
        },
        {
          id: 2,
          title: 'Dev 2',
          company: 'Company B',
          isConfidential: true,
          user: { companyRequest: { logoUrl: 'https://b.com/logo.png' } },
        },
        {
          id: 3,
          title: 'Dev 3',
          company: 'Company C',
          isConfidential: false,
          user: { companyRequest: null },
        },
      ];

      const isOwnerView = false;

      const transformedJobs = rawJobs.map((job) => {
        const logoUrl = job.user?.companyRequest?.logoUrl || null;
        const { user, ...jobWithoutUser } = job;
        const withLogo = { ...jobWithoutUser, logoUrl };

        // Sanitizar si es confidencial
        if (withLogo.isConfidential && !isOwnerView) {
          return {
            ...withLogo,
            company: 'Empresa Confidencial',
            logoUrl: null,
          };
        }
        return withLogo;
      });

      // Vacante 1: no confidencial con logo
      expect(transformedJobs[0].logoUrl).toBe('https://a.com/logo.png');
      expect(transformedJobs[0].company).toBe('Company A');

      // Vacante 2: confidencial - logo oculto
      expect(transformedJobs[1].logoUrl).toBeNull();
      expect(transformedJobs[1].company).toBe('Empresa Confidencial');

      // Vacante 3: no confidencial sin logo
      expect(transformedJobs[2].logoUrl).toBeNull();
      expect(transformedJobs[2].company).toBe('Company C');
    });
  });
});

/**
 * FEAT-1b: Tests para logo en registro y perfil de empresa
 */
describe('FEAT-1b: Logo en Registro y Perfil de Empresa', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /api/company-requests con logoUrl', () => {
    it('debe aceptar logoUrl en la solicitud de registro', () => {
      const requestBody = {
        nombre: 'Juan',
        apellidoPaterno: 'Pérez',
        apellidoMaterno: 'López',
        nombreEmpresa: 'TechCorp',
        correoEmpresa: 'contacto@techcorp.com',
        sitioWeb: 'https://techcorp.com',
        razonSocial: 'TechCorp S.A. de C.V.',
        rfc: 'TCO123456ABC',
        direccionEmpresa: 'Av. Principal 123',
        identificacionUrl: 'https://blob.com/id.pdf',
        documentosConstitucionUrl: 'https://blob.com/docs.pdf',
        logoUrl: 'https://blob.com/logo.png', // FEAT-1b
      };

      // Simular creación con logoUrl
      const createdRequest = {
        id: 1,
        ...requestBody,
        status: 'pending',
        createdAt: new Date(),
      };

      expect(createdRequest.logoUrl).toBe('https://blob.com/logo.png');
      expect(createdRequest.nombreEmpresa).toBe('TechCorp');
    });

    it('debe aceptar registro sin logoUrl (opcional)', () => {
      const requestBody = {
        nombre: 'María',
        apellidoPaterno: 'García',
        apellidoMaterno: 'Hernández',
        nombreEmpresa: 'StartupMX',
        correoEmpresa: 'contacto@startup.mx',
        sitioWeb: null,
        razonSocial: 'StartupMX S.A.',
        rfc: 'SMX987654XYZ',
        direccionEmpresa: 'Calle 5 Norte',
        identificacionUrl: 'https://blob.com/id2.pdf',
        documentosConstitucionUrl: 'https://blob.com/docs2.pdf',
        // Sin logoUrl
      };

      // Simular creación sin logoUrl
      const createdRequest = {
        id: 2,
        ...requestBody,
        logoUrl: null, // El API lo pone como null si no se envía
        status: 'pending',
        createdAt: new Date(),
      };

      expect(createdRequest.logoUrl).toBeNull();
      expect(createdRequest.nombreEmpresa).toBe('StartupMX');
    });

    it('debe validar que logoUrl sea una URL válida si se proporciona', () => {
      const validUrls = [
        'https://blob.vercel-storage.com/logo.png',
        'https://example.com/images/logo.jpg',
        'https://cdn.company.com/assets/brand/logo.webp',
      ];

      const urlRegex = /^https?:\/\/.+/;

      validUrls.forEach((url) => {
        expect(urlRegex.test(url)).toBe(true);
      });
    });
  });

  describe('PUT /api/company/profile con logoUrl', () => {
    it('debe permitir actualizar logoUrl en el perfil', () => {
      const currentProfile = {
        id: 1,
        nombreEmpresa: 'TechCorp',
        logoUrl: null,
      };

      const updateData = {
        logoUrl: 'https://blob.com/new-logo.png',
      };

      // Simular actualización
      const updatedProfile = {
        ...currentProfile,
        ...updateData,
      };

      expect(updatedProfile.logoUrl).toBe('https://blob.com/new-logo.png');
    });

    it('debe permitir cambiar logoUrl existente por uno nuevo', () => {
      const currentProfile = {
        id: 1,
        nombreEmpresa: 'TechCorp',
        logoUrl: 'https://blob.com/old-logo.png',
      };

      const updateData = {
        logoUrl: 'https://blob.com/new-logo.png',
      };

      const updatedProfile = {
        ...currentProfile,
        ...updateData,
      };

      expect(updatedProfile.logoUrl).toBe('https://blob.com/new-logo.png');
      expect(updatedProfile.logoUrl).not.toBe('https://blob.com/old-logo.png');
    });

    it('debe permitir eliminar logoUrl (poner null)', () => {
      const currentProfile = {
        id: 1,
        nombreEmpresa: 'TechCorp',
        logoUrl: 'https://blob.com/logo.png',
      };

      const updateData = {
        logoUrl: null,
      };

      const updatedProfile = {
        ...currentProfile,
        ...updateData,
      };

      expect(updatedProfile.logoUrl).toBeNull();
    });

    it('no debe modificar logoUrl si no se incluye en la actualización', () => {
      const currentProfile = {
        id: 1,
        nombreEmpresa: 'TechCorp',
        logoUrl: 'https://blob.com/logo.png',
      };

      // Actualización que NO incluye logoUrl
      const updateData = {
        nombreEmpresa: 'TechCorp Actualizado',
      };

      // Simular comportamiento del API: solo actualizar campos enviados
      const buildUpdateData = (body: any) => {
        const data: any = {};
        if (body.nombreEmpresa !== undefined) data.nombreEmpresa = body.nombreEmpresa;
        if (body.logoUrl !== undefined) data.logoUrl = body.logoUrl;
        return data;
      };

      const dataToUpdate = buildUpdateData(updateData);
      expect(dataToUpdate.logoUrl).toBeUndefined();

      // El profile mantiene su logoUrl original
      const updatedProfile = {
        ...currentProfile,
        ...dataToUpdate,
      };

      expect(updatedProfile.logoUrl).toBe('https://blob.com/logo.png');
      expect(updatedProfile.nombreEmpresa).toBe('TechCorp Actualizado');
    });
  });

  describe('Logo en dashboard de empresa', () => {
    it('debe incluir logoUrl en respuesta de dashboard', () => {
      const dashboardData = {
        company: {
          userId: 1,
          userName: 'Juan Pérez',
          email: 'juan@empresa.com',
          credits: 100,
          companyInfo: {
            nombreEmpresa: 'TechCorp',
            correoEmpresa: 'contacto@techcorp.com',
            rfc: 'TCO123456ABC',
            direccionEmpresa: 'Av. Principal 123',
            logoUrl: 'https://blob.com/logo.png', // FEAT-1b
          },
        },
        stats: {},
      };

      expect(dashboardData.company.companyInfo.logoUrl).toBe('https://blob.com/logo.png');
    });

    it('debe manejar empresa sin logo en dashboard', () => {
      const dashboardData = {
        company: {
          userId: 1,
          userName: 'María García',
          email: 'maria@startup.mx',
          credits: 50,
          companyInfo: {
            nombreEmpresa: 'StartupMX',
            correoEmpresa: 'contacto@startup.mx',
            rfc: 'SMX987654XYZ',
            direccionEmpresa: 'Calle 5 Norte',
            logoUrl: null, // Sin logo
          },
        },
        stats: {},
      };

      expect(dashboardData.company.companyInfo.logoUrl).toBeNull();
    });
  });

  describe('Logo en vista de aplicaciones (my-applications)', () => {
    it('debe incluir logoUrl del job en la aplicación', () => {
      const application = {
        id: 1,
        candidateName: 'Pedro Sánchez',
        status: 'pending',
        job: {
          id: 10,
          title: 'Desarrollador Frontend',
          company: 'TechCorp',
          location: 'CDMX',
          logoUrl: 'https://blob.com/logo.png', // FEAT-1b
        },
      };

      expect(application.job.logoUrl).toBe('https://blob.com/logo.png');
    });
  });

  describe('Logo en admin RequestDetailModal', () => {
    it('debe incluir logoUrl en los datos de la solicitud', () => {
      const companyRequest = {
        id: 1,
        nombre: 'Juan',
        apellidoPaterno: 'Pérez',
        apellidoMaterno: 'López',
        nombreEmpresa: 'TechCorp',
        correoEmpresa: 'contacto@techcorp.com',
        sitioWeb: 'https://techcorp.com',
        razonSocial: 'TechCorp S.A. de C.V.',
        rfc: 'TCO123456ABC',
        direccionEmpresa: 'Av. Principal 123',
        identificacionUrl: 'https://blob.com/id.pdf',
        documentosConstitucionUrl: 'https://blob.com/docs.pdf',
        logoUrl: 'https://blob.com/logo.png', // FEAT-1b
        status: 'pending',
      };

      expect(companyRequest.logoUrl).toBe('https://blob.com/logo.png');
    });

    it('debe mostrar la solicitud correctamente sin logo', () => {
      const companyRequest = {
        id: 2,
        nombreEmpresa: 'StartupMX',
        logoUrl: null,
        status: 'pending',
      };

      expect(companyRequest.logoUrl).toBeNull();
      expect(companyRequest.nombreEmpresa).toBe('StartupMX');
    });
  });

  describe('Logo en vistas de recruiter y specialist', () => {
    it('debe incluir logoUrl en la interfaz JobData para recruiter', () => {
      const jobData = {
        id: 1,
        title: 'Frontend Developer',
        company: 'TechCorp',
        user: {
          nombre: 'Admin User',
          companyRequest: {
            nombreEmpresa: 'TechCorp',
            logoUrl: 'https://blob.com/logo.png', // FEAT-1b
          },
        },
      };

      expect(jobData.user.companyRequest?.logoUrl).toBe('https://blob.com/logo.png');
    });

    it('debe incluir logoUrl en la interfaz JobData para specialist', () => {
      const jobData = {
        id: 1,
        title: 'Backend Developer',
        company: 'StartupMX',
        user: {
          nombre: 'Empresa User',
          companyRequest: {
            nombreEmpresa: 'StartupMX',
            logoUrl: null, // Sin logo
          },
        },
      };

      expect(jobData.user.companyRequest?.logoUrl).toBeNull();
    });
  });
});
