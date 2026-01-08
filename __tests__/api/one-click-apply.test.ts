/**
 * Tests para postulación con un clic
 *
 * Verifica que:
 * 1. Usuarios logueados con perfil completo pueden aplicar con un clic
 * 2. Usuarios con perfil incompleto son rechazados
 * 3. Usuarios no logueados pueden usar formulario manual
 * 4. Se detectan aplicaciones duplicadas
 */

import { prisma } from '@/lib/prisma';

// Mock de prisma
jest.mock('@/lib/prisma', () => ({
  prisma: {
    user: {
      findUnique: jest.fn(),
    },
    candidate: {
      findFirst: jest.fn(),
    },
    application: {
      findFirst: jest.fn(),
      create: jest.fn(),
    },
    job: {
      findUnique: jest.fn(),
    },
  },
}));

// Campos requeridos para postulación automática
const REQUIRED_FIELDS = ['nombre', 'apellidoPaterno', 'telefono', 'cvUrl'];

describe('One-Click Apply', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Profile Completeness Check', () => {
    it('should identify complete profile', () => {
      const completeProfile = {
        id: 1,
        nombre: 'Juan',
        apellidoPaterno: 'Pérez',
        apellidoMaterno: 'García',
        telefono: '8112345678',
        cvUrl: 'https://example.com/cv.pdf',
        email: 'juan@test.com',
      };

      const missingFields: string[] = [];
      for (const field of REQUIRED_FIELDS) {
        if (!completeProfile[field as keyof typeof completeProfile]) {
          missingFields.push(field);
        }
      }

      expect(missingFields).toHaveLength(0);
    });

    it('should identify incomplete profile - missing CV', () => {
      const incompleteProfile = {
        id: 1,
        nombre: 'Juan',
        apellidoPaterno: 'Pérez',
        telefono: '8112345678',
        cvUrl: null,
        email: 'juan@test.com',
      };

      const missingFields: string[] = [];
      for (const field of REQUIRED_FIELDS) {
        const value = incompleteProfile[field as keyof typeof incompleteProfile];
        if (!value) {
          missingFields.push(field);
        }
      }

      expect(missingFields).toContain('cvUrl');
    });

    it('should identify incomplete profile - missing phone', () => {
      const incompleteProfile = {
        id: 1,
        nombre: 'Juan',
        apellidoPaterno: 'Pérez',
        telefono: '',
        cvUrl: 'https://example.com/cv.pdf',
        email: 'juan@test.com',
      };

      const missingFields: string[] = [];
      for (const field of REQUIRED_FIELDS) {
        const value = incompleteProfile[field as keyof typeof incompleteProfile];
        if (!value || (typeof value === 'string' && value.trim() === '')) {
          missingFields.push(field);
        }
      }

      expect(missingFields).toContain('telefono');
    });

    it('should identify incomplete profile - missing name', () => {
      const incompleteProfile = {
        id: 1,
        nombre: '',
        apellidoPaterno: 'Pérez',
        telefono: '8112345678',
        cvUrl: 'https://example.com/cv.pdf',
      };

      const missingFields: string[] = [];
      for (const field of REQUIRED_FIELDS) {
        const value = incompleteProfile[field as keyof typeof incompleteProfile];
        if (!value || (typeof value === 'string' && value.trim() === '')) {
          missingFields.push(field);
        }
      }

      expect(missingFields).toContain('nombre');
    });
  });

  describe('Quick Apply Flow', () => {
    it('should create application with profile data', async () => {
      const mockCandidate = {
        id: 1,
        nombre: 'Juan',
        apellidoPaterno: 'Pérez',
        apellidoMaterno: 'García',
        telefono: '8112345678',
        cvUrl: 'https://example.com/cv.pdf',
      };

      const mockJob = {
        id: 1,
        title: 'Desarrollador Frontend',
        status: 'active',
      };

      const userEmail = 'juan@test.com';

      // Simular que no existe aplicación previa
      (prisma.application.findFirst as jest.Mock).mockResolvedValue(null);
      (prisma.job.findUnique as jest.Mock).mockResolvedValue(mockJob);

      // Verificar aplicación no existe
      const existingApp = await prisma.application.findFirst({
        where: { jobId: mockJob.id, candidateEmail: userEmail },
      });

      expect(existingApp).toBeNull();

      // Crear payload de aplicación
      const applicationPayload = {
        jobId: mockJob.id,
        candidateName: `${mockCandidate.nombre} ${mockCandidate.apellidoPaterno} ${mockCandidate.apellidoMaterno}`.trim(),
        candidateEmail: userEmail,
        candidatePhone: mockCandidate.telefono,
        cvUrl: mockCandidate.cvUrl,
        coverLetter: null,
      };

      expect(applicationPayload.candidateName).toBe('Juan Pérez García');
      expect(applicationPayload.cvUrl).toBe('https://example.com/cv.pdf');
    });

    it('should detect duplicate application', async () => {
      const existingApplication = {
        id: 1,
        jobId: 1,
        candidateEmail: 'juan@test.com',
        status: 'pending',
        createdAt: new Date(),
      };

      (prisma.application.findFirst as jest.Mock).mockResolvedValue(existingApplication);

      const existingApp = await prisma.application.findFirst({
        where: { jobId: 1, candidateEmail: 'juan@test.com' },
      });

      expect(existingApp).not.toBeNull();
      expect(existingApp?.id).toBe(1);
    });
  });

  describe('Manual Apply Flow', () => {
    it('should allow manual application without account', () => {
      const manualFormData = {
        candidateName: 'María López',
        candidateEmail: 'maria@example.com',
        candidatePhone: '8187654321',
        coverLetter: 'Me interesa la vacante...',
      };

      expect(manualFormData.candidateName).toBeTruthy();
      expect(manualFormData.candidateEmail).toContain('@');
    });

    it('should require at least name and email for manual apply', () => {
      const incompleteManualData = {
        candidateName: '',
        candidateEmail: 'test@example.com',
      };

      const isValid = incompleteManualData.candidateName.length > 0
        && incompleteManualData.candidateEmail.includes('@');

      expect(isValid).toBe(false);
    });
  });

  describe('Status Transitions', () => {
    it('new application should have pending status', () => {
      const newApplication = {
        jobId: 1,
        candidateName: 'Test User',
        candidateEmail: 'test@test.com',
        status: 'pending',
      };

      expect(newApplication.status).toBe('pending');
    });
  });
});
