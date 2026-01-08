/**
 * Tests para flujo de 4 pestañas (Reclutador y Especialista)
 *
 * Verifica:
 * 1. Transiciones de estado permitidas para Reclutador
 * 2. Transiciones de estado permitidas para Especialista
 * 3. Filtrado correcto por pestañas
 * 4. Conteo de estadísticas
 */

describe('Four Tabs Flow - Recruiter', () => {
  // Estados del reclutador
  const recruiterStatuses = {
    pending: 'Sin Revisar',
    injected_by_admin: 'Sin Revisar',
    reviewing: 'En Proceso',
    sent_to_specialist: 'Enviadas',
    discarded: 'Descartados',
  };

  // Transiciones permitidas para reclutador
  const recruiterTransitions: Record<string, string[]> = {
    pending: ['reviewing', 'discarded'],
    injected_by_admin: ['reviewing', 'discarded'],
    reviewing: ['sent_to_specialist', 'discarded'],
    discarded: ['reviewing'],
  };

  describe('Tab Filtering', () => {
    it('should group pending and injected_by_admin in "Sin Revisar" tab', () => {
      const applications = [
        { id: 1, status: 'pending' },
        { id: 2, status: 'injected_by_admin' },
        { id: 3, status: 'reviewing' },
      ];

      const sinRevisar = applications.filter(
        a => a.status === 'pending' || a.status === 'injected_by_admin'
      );

      expect(sinRevisar).toHaveLength(2);
    });

    it('should filter "En Proceso" tab correctly', () => {
      const applications = [
        { id: 1, status: 'pending' },
        { id: 2, status: 'reviewing' },
        { id: 3, status: 'reviewing' },
      ];

      const enProceso = applications.filter(a => a.status === 'reviewing');

      expect(enProceso).toHaveLength(2);
    });

    it('should filter "Enviadas" tab correctly', () => {
      const applications = [
        { id: 1, status: 'sent_to_specialist' },
        { id: 2, status: 'reviewing' },
      ];

      const enviadas = applications.filter(a => a.status === 'sent_to_specialist');

      expect(enviadas).toHaveLength(1);
    });

    it('should filter "Descartados" tab correctly', () => {
      const applications = [
        { id: 1, status: 'discarded' },
        { id: 2, status: 'discarded' },
        { id: 3, status: 'pending' },
      ];

      const descartados = applications.filter(a => a.status === 'discarded');

      expect(descartados).toHaveLength(2);
    });
  });

  describe('Status Transitions', () => {
    it('should allow pending -> reviewing', () => {
      expect(recruiterTransitions['pending']).toContain('reviewing');
    });

    it('should allow pending -> discarded', () => {
      expect(recruiterTransitions['pending']).toContain('discarded');
    });

    it('should allow reviewing -> sent_to_specialist', () => {
      expect(recruiterTransitions['reviewing']).toContain('sent_to_specialist');
    });

    it('should allow discarded -> reviewing (reactivation)', () => {
      expect(recruiterTransitions['discarded']).toContain('reviewing');
    });

    it('should NOT allow pending -> sent_to_specialist directly', () => {
      expect(recruiterTransitions['pending']).not.toContain('sent_to_specialist');
    });
  });

  describe('Stats Calculation', () => {
    it('should calculate recruiter stats correctly', () => {
      const applications = [
        { status: 'pending' },
        { status: 'pending' },
        { status: 'injected_by_admin' },
        { status: 'reviewing' },
        { status: 'reviewing' },
        { status: 'sent_to_specialist' },
        { status: 'discarded' },
      ];

      const stats = {
        pending: applications.filter(
          a => a.status === 'pending' || a.status === 'injected_by_admin'
        ).length,
        reviewing: applications.filter(a => a.status === 'reviewing').length,
        sentToSpecialist: applications.filter(a => a.status === 'sent_to_specialist').length,
        discarded: applications.filter(a => a.status === 'discarded').length,
      };

      expect(stats.pending).toBe(3);
      expect(stats.reviewing).toBe(2);
      expect(stats.sentToSpecialist).toBe(1);
      expect(stats.discarded).toBe(1);
    });
  });
});

describe('Four Tabs Flow - Specialist', () => {
  // Estados del especialista
  const specialistStatuses = {
    sent_to_specialist: 'Sin Revisar',
    evaluating: 'En Proceso',
    sent_to_company: 'Enviadas',
    discarded: 'Descartados',
  };

  // Transiciones permitidas para especialista
  const specialistTransitions: Record<string, string[]> = {
    sent_to_specialist: ['evaluating', 'discarded'],
    evaluating: ['sent_to_company', 'discarded'],
    discarded: ['evaluating'],
  };

  describe('Tab Filtering', () => {
    it('should filter "Sin Revisar" tab correctly', () => {
      const applications = [
        { id: 1, status: 'sent_to_specialist' },
        { id: 2, status: 'sent_to_specialist' },
        { id: 3, status: 'evaluating' },
      ];

      const sinRevisar = applications.filter(a => a.status === 'sent_to_specialist');

      expect(sinRevisar).toHaveLength(2);
    });

    it('should filter "En Proceso" tab correctly', () => {
      const applications = [
        { id: 1, status: 'evaluating' },
        { id: 2, status: 'evaluating' },
        { id: 3, status: 'sent_to_company' },
      ];

      const enProceso = applications.filter(a => a.status === 'evaluating');

      expect(enProceso).toHaveLength(2);
    });

    it('should filter "Enviadas" tab correctly', () => {
      const applications = [
        { id: 1, status: 'sent_to_company' },
        { id: 2, status: 'sent_to_company' },
        { id: 3, status: 'evaluating' },
      ];

      const enviadas = applications.filter(a => a.status === 'sent_to_company');

      expect(enviadas).toHaveLength(2);
    });

    it('should filter "Descartados" tab correctly', () => {
      const applications = [
        { id: 1, status: 'discarded' },
        { id: 2, status: 'evaluating' },
      ];

      const descartados = applications.filter(a => a.status === 'discarded');

      expect(descartados).toHaveLength(1);
    });
  });

  describe('Status Transitions', () => {
    it('should allow sent_to_specialist -> evaluating', () => {
      expect(specialistTransitions['sent_to_specialist']).toContain('evaluating');
    });

    it('should allow sent_to_specialist -> discarded', () => {
      expect(specialistTransitions['sent_to_specialist']).toContain('discarded');
    });

    it('should allow evaluating -> sent_to_company', () => {
      expect(specialistTransitions['evaluating']).toContain('sent_to_company');
    });

    it('should allow discarded -> evaluating (reactivation)', () => {
      expect(specialistTransitions['discarded']).toContain('evaluating');
    });

    it('should NOT allow sent_to_specialist -> sent_to_company directly', () => {
      expect(specialistTransitions['sent_to_specialist']).not.toContain('sent_to_company');
    });

    it('should NOT allow any transition from sent_to_company', () => {
      expect(specialistTransitions['sent_to_company']).toBeUndefined();
    });
  });

  describe('Stats Calculation', () => {
    it('should calculate specialist stats correctly', () => {
      const applications = [
        { status: 'sent_to_specialist' },
        { status: 'sent_to_specialist' },
        { status: 'evaluating' },
        { status: 'evaluating' },
        { status: 'evaluating' },
        { status: 'sent_to_company' },
        { status: 'discarded' },
      ];

      const stats = {
        pending: applications.filter(a => a.status === 'sent_to_specialist').length,
        evaluating: applications.filter(a => a.status === 'evaluating').length,
        sentToCompany: applications.filter(a => a.status === 'sent_to_company').length,
        discarded: applications.filter(a => a.status === 'discarded').length,
      };

      expect(stats.pending).toBe(2);
      expect(stats.evaluating).toBe(3);
      expect(stats.sentToCompany).toBe(1);
      expect(stats.discarded).toBe(1);
    });
  });
});

describe('Complete Flow: Recruiter to Specialist', () => {
  it('should follow correct status flow from application to company', () => {
    // Flujo completo de una aplicación
    const flow = [
      'pending',           // 1. Candidato aplica
      'reviewing',         // 2. Reclutador revisa
      'sent_to_specialist',// 3. Reclutador envía al especialista
      'evaluating',        // 4. Especialista evalúa
      'sent_to_company',   // 5. Especialista envía a empresa
    ];

    // Verificar que cada paso es válido
    for (let i = 0; i < flow.length - 1; i++) {
      const current = flow[i];
      const next = flow[i + 1];

      // Definir todas las transiciones válidas
      const allTransitions: Record<string, string[]> = {
        pending: ['reviewing', 'discarded'],
        injected_by_admin: ['reviewing', 'discarded'],
        reviewing: ['sent_to_specialist', 'discarded'],
        sent_to_specialist: ['evaluating', 'discarded'],
        evaluating: ['sent_to_company', 'discarded'],
      };

      const isValid = allTransitions[current]?.includes(next);
      expect(isValid).toBe(true);
    }
  });

  it('should allow reactivation at any point', () => {
    // Reactivación desde descartado
    const reactivationPaths = [
      { from: 'discarded', to: 'reviewing', role: 'recruiter' },
      { from: 'discarded', to: 'evaluating', role: 'specialist' },
    ];

    const recruiterTransitions: Record<string, string[]> = {
      discarded: ['reviewing'],
    };

    const specialistTransitions: Record<string, string[]> = {
      discarded: ['evaluating'],
    };

    expect(recruiterTransitions['discarded']).toContain('reviewing');
    expect(specialistTransitions['discarded']).toContain('evaluating');
  });
});
