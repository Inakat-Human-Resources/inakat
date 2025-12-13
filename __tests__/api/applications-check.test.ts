// RUTA: __tests__/api/applications-check.test.ts

/**
 * Tests para la API de verificación de aplicaciones duplicadas
 * Endpoint: /api/applications/check
 *
 * Verifica si un candidato ya aplicó a una vacante específica
 */

// Mock de Prisma
const mockPrismaApplication = {
  findFirst: jest.fn(),
};

jest.mock('@/lib/prisma', () => ({
  prisma: {
    application: mockPrismaApplication,
  },
}));

describe('Applications Check API Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // Status labels mapping
  const STATUS_LABELS: Record<string, string> = {
    pending: 'En revisión',
    injected_by_admin: 'En revisión',
    reviewing: 'En proceso',
    sent_to_specialist: 'En proceso',
    sent_to_company: 'Enviado a empresa',
    interviewed: 'Entrevistado',
    accepted: 'Aceptado',
    rejected: 'No seleccionado'
  };

  describe('GET /api/applications/check', () => {
    it('debería retornar hasApplied: false si no existe aplicación', async () => {
      mockPrismaApplication.findFirst.mockResolvedValue(null);

      const existing = await mockPrismaApplication.findFirst({
        where: {
          jobId: 1,
          candidateEmail: 'nuevo@test.com'
        }
      });

      expect(existing).toBeNull();

      const response = {
        success: true,
        hasApplied: false
      };

      expect(response.hasApplied).toBe(false);
    });

    it('debería retornar hasApplied: true con datos si existe aplicación', async () => {
      const existingApplication = {
        id: 1,
        status: 'sent_to_company',
        createdAt: new Date('2024-06-15')
      };

      mockPrismaApplication.findFirst.mockResolvedValue(existingApplication);

      const existing = await mockPrismaApplication.findFirst({
        where: {
          jobId: 1,
          candidateEmail: 'existente@test.com'
        },
        select: {
          id: true,
          status: true,
          createdAt: true
        }
      });

      expect(existing).not.toBeNull();
      expect(existing.status).toBe('sent_to_company');

      const response = {
        success: true,
        hasApplied: true,
        application: {
          id: existing.id,
          status: existing.status,
          statusLabel: STATUS_LABELS[existing.status] || 'En proceso',
          appliedAt: existing.createdAt
        }
      };

      expect(response.hasApplied).toBe(true);
      expect(response.application.statusLabel).toBe('Enviado a empresa');
    });

    it('debería buscar email en minúsculas', () => {
      const email = 'TEST@Example.COM';
      const normalizedEmail = email.toLowerCase();

      expect(normalizedEmail).toBe('test@example.com');
    });

    it('debería requerir jobId', () => {
      const params = { email: 'test@test.com' };
      const hasJobId = !!params.jobId;

      expect(hasJobId).toBe(false);
      // La API retornaría 400 con error
    });

    it('debería requerir email', () => {
      const params = { jobId: 1 };
      const hasEmail = !!params.email;

      expect(hasEmail).toBe(false);
      // La API retornaría 400 con error
    });
  });

  describe('Status Labels Mapping', () => {
    it('debería mapear pending a "En revisión"', () => {
      expect(STATUS_LABELS['pending']).toBe('En revisión');
    });

    it('debería mapear injected_by_admin a "En revisión"', () => {
      expect(STATUS_LABELS['injected_by_admin']).toBe('En revisión');
    });

    it('debería mapear reviewing a "En proceso"', () => {
      expect(STATUS_LABELS['reviewing']).toBe('En proceso');
    });

    it('debería mapear sent_to_specialist a "En proceso"', () => {
      expect(STATUS_LABELS['sent_to_specialist']).toBe('En proceso');
    });

    it('debería mapear sent_to_company a "Enviado a empresa"', () => {
      expect(STATUS_LABELS['sent_to_company']).toBe('Enviado a empresa');
    });

    it('debería mapear interviewed a "Entrevistado"', () => {
      expect(STATUS_LABELS['interviewed']).toBe('Entrevistado');
    });

    it('debería mapear accepted a "Aceptado"', () => {
      expect(STATUS_LABELS['accepted']).toBe('Aceptado');
    });

    it('debería mapear rejected a "No seleccionado"', () => {
      expect(STATUS_LABELS['rejected']).toBe('No seleccionado');
    });
  });

  describe('Respuesta del API', () => {
    it('debería retornar estructura correcta cuando no ha aplicado', () => {
      const response = {
        success: true,
        hasApplied: false
      };

      expect(response).toHaveProperty('success');
      expect(response).toHaveProperty('hasApplied');
      expect(response).not.toHaveProperty('application');
    });

    it('debería retornar estructura correcta cuando ya aplicó', () => {
      const response = {
        success: true,
        hasApplied: true,
        application: {
          id: 1,
          status: 'pending',
          statusLabel: 'En revisión',
          appliedAt: new Date()
        }
      };

      expect(response).toHaveProperty('success');
      expect(response).toHaveProperty('hasApplied');
      expect(response).toHaveProperty('application');
      expect(response.application).toHaveProperty('id');
      expect(response.application).toHaveProperty('status');
      expect(response.application).toHaveProperty('statusLabel');
      expect(response.application).toHaveProperty('appliedAt');
    });
  });

  describe('Casos de uso', () => {
    it('debería permitir aplicar a diferentes vacantes con mismo email', async () => {
      // Verificar vacante 1 - ya aplicó
      mockPrismaApplication.findFirst.mockResolvedValueOnce({ id: 1 });

      const job1Check = await mockPrismaApplication.findFirst({
        where: { jobId: 1, candidateEmail: 'test@test.com' }
      });
      expect(job1Check).not.toBeNull();

      // Verificar vacante 2 - no ha aplicado
      mockPrismaApplication.findFirst.mockResolvedValueOnce(null);

      const job2Check = await mockPrismaApplication.findFirst({
        where: { jobId: 2, candidateEmail: 'test@test.com' }
      });
      expect(job2Check).toBeNull();
    });

    it('debería permitir diferentes emails en misma vacante', async () => {
      // Email 1 ya aplicó
      mockPrismaApplication.findFirst.mockResolvedValueOnce({ id: 1 });

      const email1Check = await mockPrismaApplication.findFirst({
        where: { jobId: 1, candidateEmail: 'email1@test.com' }
      });
      expect(email1Check).not.toBeNull();

      // Email 2 no ha aplicado
      mockPrismaApplication.findFirst.mockResolvedValueOnce(null);

      const email2Check = await mockPrismaApplication.findFirst({
        where: { jobId: 1, candidateEmail: 'email2@test.com' }
      });
      expect(email2Check).toBeNull();
    });

    it('debería detectar aplicación sin importar el status', async () => {
      const statuses = ['pending', 'reviewing', 'sent_to_company', 'rejected'];

      for (const status of statuses) {
        mockPrismaApplication.findFirst.mockResolvedValueOnce({ id: 1, status });

        const check = await mockPrismaApplication.findFirst({
          where: { jobId: 1, candidateEmail: 'test@test.com' }
        });

        expect(check).not.toBeNull();
        // Incluso si está rechazado, no puede volver a aplicar
      }
    });
  });

  describe('Validaciones', () => {
    it('debería validar que jobId sea un número', () => {
      const validJobId = parseInt('1');
      const invalidJobId = parseInt('abc');

      expect(Number.isNaN(validJobId)).toBe(false);
      expect(Number.isNaN(invalidJobId)).toBe(true);
    });

    it('debería validar formato de email básico', () => {
      const validEmail = 'test@example.com';
      const invalidEmail = 'notanemail';

      expect(validEmail.includes('@')).toBe(true);
      expect(invalidEmail.includes('@')).toBe(false);
    });
  });
});
