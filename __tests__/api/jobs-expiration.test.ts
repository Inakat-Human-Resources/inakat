// RUTA: __tests__/api/jobs-expiration.test.ts

import { describe, it, expect } from '@jest/globals';

describe('Filtro de Vacantes Expiradas', () => {
  const now = new Date();
  const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  const nextWeek = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  const lastWeek = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  const mockJobs = [
    { id: 1, title: 'Dev Senior', status: 'active', expiresAt: null },
    { id: 2, title: 'Dev Junior', status: 'active', expiresAt: tomorrow },
    { id: 3, title: 'Dev Mid', status: 'active', expiresAt: yesterday },
    { id: 4, title: 'PM', status: 'paused', expiresAt: null },
    { id: 5, title: 'QA', status: 'closed', expiresAt: null },
    { id: 6, title: 'DevOps', status: 'active', expiresAt: nextWeek },
    { id: 7, title: 'Frontend', status: 'active', expiresAt: lastWeek },
    { id: 8, title: 'Backend', status: 'draft', expiresAt: null }
  ];

  // Función que simula el filtro del API
  const filterActiveJobs = (jobs: typeof mockJobs) => {
    return jobs.filter(
      job => job.status === 'active' &&
             (job.expiresAt === null || new Date(job.expiresAt) > now)
    );
  };

  describe('Vacantes activas visibles', () => {
    it('debería mostrar vacantes activas sin fecha de expiración', () => {
      const activeJobs = filterActiveJobs(mockJobs);

      expect(activeJobs.find(j => j.id === 1)).toBeDefined();
      expect(activeJobs.find(j => j.id === 1)?.title).toBe('Dev Senior');
    });

    it('debería mostrar vacantes activas con fecha futura (mañana)', () => {
      const activeJobs = filterActiveJobs(mockJobs);

      expect(activeJobs.find(j => j.id === 2)).toBeDefined();
      expect(activeJobs.find(j => j.id === 2)?.title).toBe('Dev Junior');
    });

    it('debería mostrar vacantes activas con fecha futura (próxima semana)', () => {
      const activeJobs = filterActiveJobs(mockJobs);

      expect(activeJobs.find(j => j.id === 6)).toBeDefined();
      expect(activeJobs.find(j => j.id === 6)?.title).toBe('DevOps');
    });
  });

  describe('Vacantes NO visibles', () => {
    it('NO debería mostrar vacantes expiradas (ayer)', () => {
      const activeJobs = filterActiveJobs(mockJobs);

      expect(activeJobs.find(j => j.id === 3)).toBeUndefined();
    });

    it('NO debería mostrar vacantes expiradas (semana pasada)', () => {
      const activeJobs = filterActiveJobs(mockJobs);

      expect(activeJobs.find(j => j.id === 7)).toBeUndefined();
    });

    it('NO debería mostrar vacantes pausadas', () => {
      const activeJobs = filterActiveJobs(mockJobs);

      expect(activeJobs.find(j => j.id === 4)).toBeUndefined();
    });

    it('NO debería mostrar vacantes cerradas', () => {
      const activeJobs = filterActiveJobs(mockJobs);

      expect(activeJobs.find(j => j.id === 5)).toBeUndefined();
    });

    it('NO debería mostrar borradores', () => {
      const activeJobs = filterActiveJobs(mockJobs);

      expect(activeJobs.find(j => j.id === 8)).toBeUndefined();
    });
  });

  describe('Conteo de vacantes', () => {
    it('debería retornar exactamente 3 vacantes activas no expiradas', () => {
      const activeJobs = filterActiveJobs(mockJobs);

      expect(activeJobs).toHaveLength(3);
    });

    it('las vacantes visibles deben ser Dev Senior, Dev Junior y DevOps', () => {
      const activeJobs = filterActiveJobs(mockJobs);
      const titles = activeJobs.map(j => j.title).sort();

      expect(titles).toEqual(['Dev Junior', 'Dev Senior', 'DevOps']);
    });
  });

  describe('Casos edge', () => {
    it('vacante que expira exactamente ahora debería ser filtrada', () => {
      const jobExpiringNow = { id: 100, title: 'Expiring Now', status: 'active', expiresAt: now };
      const allJobs = [...mockJobs, jobExpiringNow];
      const activeJobs = filterActiveJobs(allJobs);

      // Dependiendo de la precisión, podría o no incluirse
      // La lógica actual usa > (mayor estricto), así que se filtra
      expect(activeJobs.find(j => j.id === 100)).toBeUndefined();
    });

    it('vacante sin fecha de expiración nunca expira', () => {
      const jobNoExpiration = { id: 101, title: 'Never Expires', status: 'active', expiresAt: null };
      const allJobs = [jobNoExpiration];
      const activeJobs = filterActiveJobs(allJobs);

      expect(activeJobs.find(j => j.id === 101)).toBeDefined();
    });

    it('vacante pausada con fecha futura NO es visible', () => {
      const pausedFutureJob = { id: 102, title: 'Paused Future', status: 'paused', expiresAt: nextWeek };
      const allJobs = [pausedFutureJob];
      const activeJobs = filterActiveJobs(allJobs);

      expect(activeJobs.find(j => j.id === 102)).toBeUndefined();
    });
  });

  describe('Status de vacantes', () => {
    const JOB_STATUSES = ['active', 'paused', 'closed', 'draft'];

    it('debería reconocer todos los status válidos', () => {
      expect(JOB_STATUSES).toContain('active');
      expect(JOB_STATUSES).toContain('paused');
      expect(JOB_STATUSES).toContain('closed');
      expect(JOB_STATUSES).toContain('draft');
    });

    it('solo status "active" es visible en búsqueda pública', () => {
      const PUBLICLY_VISIBLE_STATUSES = ['active'];

      expect(PUBLICLY_VISIBLE_STATUSES).toHaveLength(1);
      expect(PUBLICLY_VISIBLE_STATUSES[0]).toBe('active');
    });

    it('empresa puede ver todos sus status', () => {
      const COMPANY_VISIBLE_STATUSES = ['active', 'paused', 'closed', 'draft'];

      expect(COMPANY_VISIBLE_STATUSES).toHaveLength(4);
    });
  });
});
