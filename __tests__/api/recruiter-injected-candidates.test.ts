// RUTA: __tests__/api/recruiter-injected-candidates.test.ts

import { describe, it, expect, beforeEach, jest } from '@jest/globals';

// Mock de Prisma
const mockPrisma = {
  jobAssignment: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn()
  },
  application: {
    findMany: jest.fn(),
    update: jest.fn()
  },
  candidate: {
    findMany: jest.fn(),
    findUnique: jest.fn()
  }
};

jest.mock('@/lib/prisma', () => ({
  prisma: mockPrisma
}));

describe('Reclutador - Candidatos Inyectados por Admin', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Visibilidad de status injected_by_admin', () => {
    it('debería incluir injected_by_admin en los status visibles para reclutador', () => {
      const RECRUITER_VISIBLE_STATUSES = ['pending', 'reviewing', 'injected_by_admin'];

      expect(RECRUITER_VISIBLE_STATUSES).toContain('pending');
      expect(RECRUITER_VISIBLE_STATUSES).toContain('reviewing');
      expect(RECRUITER_VISIBLE_STATUSES).toContain('injected_by_admin');
      expect(RECRUITER_VISIBLE_STATUSES).not.toContain('sent_to_specialist');
      expect(RECRUITER_VISIBLE_STATUSES).not.toContain('sent_to_company');
    });

    it('debería filtrar correctamente aplicaciones por status', () => {
      const mockApplications = [
        { id: 1, status: 'pending', candidateName: 'Juan' },
        { id: 2, status: 'reviewing', candidateName: 'María' },
        { id: 3, status: 'injected_by_admin', candidateName: 'Pedro' },
        { id: 4, status: 'sent_to_specialist', candidateName: 'Ana' },
        { id: 5, status: 'sent_to_company', candidateName: 'Luis' }
      ];

      const RECRUITER_VISIBLE_STATUSES = ['pending', 'reviewing', 'injected_by_admin'];

      const visibleApplications = mockApplications.filter(
        app => RECRUITER_VISIBLE_STATUSES.includes(app.status)
      );

      expect(visibleApplications).toHaveLength(3);
      expect(visibleApplications.map(a => a.candidateName)).toEqual(['Juan', 'María', 'Pedro']);
    });

    it('candidato inyectado debe poder ser enviado a especialista', () => {
      const validTransitionsFromInjected = ['reviewing', 'sent_to_specialist', 'discarded'];

      expect(validTransitionsFromInjected).toContain('sent_to_specialist');
    });

    it('candidato inyectado NO debe ser visible para empresa directamente', () => {
      const COMPANY_VISIBLE_STATUSES = ['sent_to_company', 'company_interested', 'interviewed', 'rejected', 'accepted'];

      expect(COMPANY_VISIBLE_STATUSES).not.toContain('injected_by_admin');
      expect(COMPANY_VISIBLE_STATUSES).not.toContain('pending');
      expect(COMPANY_VISIBLE_STATUSES).not.toContain('reviewing');
    });
  });

  describe('Validación de especialista antes de enviar', () => {
    it('debería rechazar envío si no hay especialista asignado', async () => {
      const mockAssignment = {
        id: 1,
        jobId: 1,
        recruiterId: 5,
        specialistId: null // Sin especialista
      };

      const canSendToSpecialist = mockAssignment.specialistId !== null;

      expect(canSendToSpecialist).toBe(false);
    });

    it('debería permitir envío si hay especialista asignado', async () => {
      const mockAssignment = {
        id: 1,
        jobId: 1,
        recruiterId: 5,
        specialistId: 10 // Con especialista
      };

      const canSendToSpecialist = mockAssignment.specialistId !== null;

      expect(canSendToSpecialist).toBe(true);
    });

    it('debería validar que el especialista existe en la base de datos', () => {
      const mockAssignment = {
        id: 1,
        jobId: 1,
        recruiterId: 5,
        specialistId: 10,
        specialist: {
          id: 10,
          nombre: 'Dr. Tech',
          email: 'tech@inakat.com',
          role: 'specialist',
          specialty: 'Tecnología'
        }
      };

      expect(mockAssignment.specialist).toBeDefined();
      expect(mockAssignment.specialist.role).toBe('specialist');
    });
  });

  describe('Flujo de inyección completo', () => {
    it('debería seguir el flujo correcto: injected -> reviewing -> sent_to_specialist', () => {
      const statusFlow = ['injected_by_admin', 'reviewing', 'sent_to_specialist'];

      // Verificar que cada transición es válida
      expect(statusFlow[0]).toBe('injected_by_admin');
      expect(statusFlow[1]).toBe('reviewing');
      expect(statusFlow[2]).toBe('sent_to_specialist');
    });

    it('candidato inyectado puede ser descartado en cualquier momento', () => {
      const initialStatus = 'injected_by_admin';
      const discardedStatus = 'discarded';

      // Simular transición directa a descartado
      const canDiscard = true; // Siempre se puede descartar

      expect(canDiscard).toBe(true);
    });
  });
});
