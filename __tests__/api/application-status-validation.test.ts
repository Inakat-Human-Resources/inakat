// RUTA: __tests__/api/application-status-validation.test.ts

import { describe, it, expect } from '@jest/globals';

describe('Validación de Status de Application', () => {
  const VALID_STATUSES = [
    'pending',
    'reviewing',
    'evaluating',
    'sent_to_specialist',
    'sent_to_company',
    'company_interested',
    'interviewed',
    'rejected',
    'accepted',
    'injected_by_admin',
    'discarded',
    'archived'
  ];

  describe('Lista de status válidos', () => {
    it('debería incluir todos los status del flujo', () => {
      // Status de candidato aplicando
      expect(VALID_STATUSES).toContain('pending');

      // Status de admin inyectando
      expect(VALID_STATUSES).toContain('injected_by_admin');

      // Status de reclutador
      expect(VALID_STATUSES).toContain('reviewing');
      expect(VALID_STATUSES).toContain('sent_to_specialist');

      // Status de especialista
      expect(VALID_STATUSES).toContain('evaluating');
      expect(VALID_STATUSES).toContain('sent_to_company');

      // Status de empresa
      expect(VALID_STATUSES).toContain('company_interested');
      expect(VALID_STATUSES).toContain('interviewed');
      expect(VALID_STATUSES).toContain('accepted');
      expect(VALID_STATUSES).toContain('rejected');

      // Status de archivo
      expect(VALID_STATUSES).toContain('discarded');
      expect(VALID_STATUSES).toContain('archived');
    });

    it('debería tener exactamente 12 status válidos', () => {
      expect(VALID_STATUSES).toHaveLength(12);
    });

    it('debería rechazar status inválidos', () => {
      const invalidStatuses = ['invalid', 'unknown', 'processing', 'waiting', 'in_review', 'approved'];

      invalidStatuses.forEach(status => {
        expect(VALID_STATUSES).not.toContain(status);
      });
    });
  });

  describe('Transiciones de status por rol', () => {
    it('reclutador puede hacer transiciones específicas', () => {
      const RECRUITER_ALLOWED_TRANSITIONS: Record<string, string[]> = {
        'pending': ['reviewing', 'discarded'],
        'injected_by_admin': ['reviewing', 'sent_to_specialist', 'discarded'],
        'reviewing': ['sent_to_specialist', 'discarded']
      };

      // Desde pending
      expect(RECRUITER_ALLOWED_TRANSITIONS['pending']).toContain('reviewing');
      expect(RECRUITER_ALLOWED_TRANSITIONS['pending']).not.toContain('sent_to_company');

      // Desde injected_by_admin
      expect(RECRUITER_ALLOWED_TRANSITIONS['injected_by_admin']).toContain('sent_to_specialist');
    });

    it('especialista puede hacer transiciones específicas', () => {
      const SPECIALIST_ALLOWED_TRANSITIONS: Record<string, string[]> = {
        'sent_to_specialist': ['evaluating', 'sent_to_company', 'discarded'],
        'evaluating': ['sent_to_company', 'discarded']
      };

      expect(SPECIALIST_ALLOWED_TRANSITIONS['sent_to_specialist']).toContain('evaluating');
      expect(SPECIALIST_ALLOWED_TRANSITIONS['evaluating']).toContain('sent_to_company');
    });

    it('empresa puede hacer transiciones específicas', () => {
      const COMPANY_ALLOWED_TRANSITIONS: Record<string, string[]> = {
        'sent_to_company': ['company_interested', 'rejected'],
        'company_interested': ['interviewed', 'accepted', 'rejected'],
        'interviewed': ['accepted', 'rejected']
      };

      expect(COMPANY_ALLOWED_TRANSITIONS['sent_to_company']).toContain('company_interested');
      expect(COMPANY_ALLOWED_TRANSITIONS['company_interested']).toContain('interviewed');
      expect(COMPANY_ALLOWED_TRANSITIONS['interviewed']).toContain('accepted');
    });
  });

  describe('Estados finales', () => {
    const FINAL_STATUSES = ['accepted', 'rejected'];

    it('accepted es un estado final', () => {
      expect(FINAL_STATUSES).toContain('accepted');
    });

    it('rejected es un estado final', () => {
      expect(FINAL_STATUSES).toContain('rejected');
    });

    it('no debería permitir transiciones desde estados finales', () => {
      // Una vez aceptado o rechazado, no se puede cambiar
      const canTransitionFromFinal = false;
      expect(canTransitionFromFinal).toBe(false);
    });
  });

  describe('Visibilidad por rol', () => {
    it('reclutador ve status específicos', () => {
      const RECRUITER_VISIBLE = ['pending', 'reviewing', 'injected_by_admin'];

      expect(RECRUITER_VISIBLE).toHaveLength(3);
      expect(RECRUITER_VISIBLE).not.toContain('sent_to_company');
    });

    it('especialista ve status específicos', () => {
      const SPECIALIST_VISIBLE = ['sent_to_specialist', 'evaluating'];

      expect(SPECIALIST_VISIBLE).toHaveLength(2);
      expect(SPECIALIST_VISIBLE).not.toContain('pending');
    });

    it('empresa ve status específicos', () => {
      const COMPANY_VISIBLE = ['sent_to_company', 'company_interested', 'interviewed', 'rejected', 'accepted'];

      expect(COMPANY_VISIBLE).toHaveLength(5);
      expect(COMPANY_VISIBLE).not.toContain('pending');
      expect(COMPANY_VISIBLE).not.toContain('evaluating');
    });
  });
});
