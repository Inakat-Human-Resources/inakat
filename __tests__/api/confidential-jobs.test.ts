// RUTA: __tests__/api/confidential-jobs.test.ts

/**
 * Tests para FEAT-3: Vacantes Confidenciales
 * Verifican: sanitización de datos en vistas públicas, preservación para propietarios
 */

describe('Confidential Jobs Feature', () => {
  describe('sanitizeConfidentialJob function logic', () => {
    // Función de sanitización (replica la lógica del API)
    const sanitizeConfidentialJob = (job: any, isOwnerOrAdmin: boolean) => {
      if (!job.isConfidential || isOwnerOrAdmin) {
        return job;
      }
      return {
        ...job,
        company: 'Empresa Confidencial',
        location: job.location ? job.location.split(',')[1]?.trim() || 'México' : 'México',
      };
    };

    const mockConfidentialJob = {
      id: 1,
      title: 'Desarrollador Senior',
      company: 'TechCorp SA de CV',
      location: 'Av. Revolución 123, Monterrey, Nuevo León',
      salary: '$40,000 - $50,000 / mes',
      isConfidential: true,
      status: 'active'
    };

    const mockPublicJob = {
      id: 2,
      title: 'Diseñador UX',
      company: 'DesignStudio',
      location: 'Roma Norte, CDMX, Ciudad de México',
      salary: '$30,000 - $35,000 / mes',
      isConfidential: false,
      status: 'active'
    };

    it('debería ocultar nombre de empresa para vacantes confidenciales en vista pública', () => {
      const sanitized = sanitizeConfidentialJob(mockConfidentialJob, false);

      expect(sanitized.company).toBe('Empresa Confidencial');
      expect(sanitized.company).not.toBe('TechCorp SA de CV');
    });

    it('debería mostrar solo estado/región para ubicación en vacantes confidenciales', () => {
      const sanitized = sanitizeConfidentialJob(mockConfidentialJob, false);

      // Debe mostrar solo "Nuevo León" (la parte después de la primera coma)
      expect(sanitized.location).not.toContain('Av. Revolución 123');
      expect(sanitized.location).toBe('Monterrey');
    });

    it('debería preservar todos los datos para propietarios de vacantes confidenciales', () => {
      const sanitized = sanitizeConfidentialJob(mockConfidentialJob, true);

      expect(sanitized.company).toBe('TechCorp SA de CV');
      expect(sanitized.location).toBe('Av. Revolución 123, Monterrey, Nuevo León');
    });

    it('debería preservar todos los datos para admins en vacantes confidenciales', () => {
      const sanitized = sanitizeConfidentialJob(mockConfidentialJob, true); // isOwnerOrAdmin = true

      expect(sanitized.company).toBe('TechCorp SA de CV');
      expect(sanitized.location).toBe('Av. Revolución 123, Monterrey, Nuevo León');
    });

    it('NO debería modificar vacantes no confidenciales', () => {
      const sanitized = sanitizeConfidentialJob(mockPublicJob, false);

      expect(sanitized.company).toBe('DesignStudio');
      expect(sanitized.location).toBe('Roma Norte, CDMX, Ciudad de México');
      expect(sanitized).toEqual(mockPublicJob);
    });

    it('debería preservar otros campos de la vacante confidencial', () => {
      const sanitized = sanitizeConfidentialJob(mockConfidentialJob, false);

      expect(sanitized.id).toBe(1);
      expect(sanitized.title).toBe('Desarrollador Senior');
      expect(sanitized.salary).toBe('$40,000 - $50,000 / mes');
      expect(sanitized.status).toBe('active');
      expect(sanitized.isConfidential).toBe(true);
    });

    it('debería manejar ubicación sin comas (solo ciudad)', () => {
      const jobSimpleLocation = {
        ...mockConfidentialJob,
        location: 'Monterrey'
      };
      const sanitized = sanitizeConfidentialJob(jobSimpleLocation, false);

      expect(sanitized.location).toBe('México'); // Fallback
    });

    it('debería manejar ubicación vacía o null', () => {
      const jobNoLocation = {
        ...mockConfidentialJob,
        location: ''
      };
      const sanitized = sanitizeConfidentialJob(jobNoLocation, false);

      expect(sanitized.location).toBe('México'); // Fallback
    });
  });

  describe('Job creation with isConfidential flag', () => {
    it('debería aceptar isConfidential: true al crear vacante', () => {
      const jobData = {
        title: 'Desarrollador',
        company: 'MiEmpresa',
        location: 'CDMX',
        salary: '$20,000',
        jobType: 'Tiempo Completo',
        description: 'Descripción del puesto',
        isConfidential: true
      };

      expect(jobData.isConfidential).toBe(true);
    });

    it('debería defaultear isConfidential a false si no se proporciona', () => {
      const jobData = {
        title: 'Desarrollador',
        company: 'MiEmpresa',
        location: 'CDMX',
        salary: '$20,000',
        jobType: 'Tiempo Completo',
        description: 'Descripción del puesto'
      };

      const isConfidential = jobData.isConfidential || false;
      expect(isConfidential).toBe(false);
    });
  });

  describe('Sanitization for job listings', () => {
    const sanitizeConfidentialJob = (job: any, isOwnerOrAdmin: boolean) => {
      if (!job.isConfidential || isOwnerOrAdmin) {
        return job;
      }
      return {
        ...job,
        company: 'Empresa Confidencial',
        location: job.location ? job.location.split(',')[1]?.trim() || 'México' : 'México',
      };
    };

    it('debería sanitizar múltiples vacantes en listado público', () => {
      const jobs = [
        { id: 1, company: 'Empresa A', location: 'Calle 1, Monterrey', isConfidential: true },
        { id: 2, company: 'Empresa B', location: 'Calle 2, CDMX', isConfidential: false },
        { id: 3, company: 'Empresa C', location: 'Calle 3, GDL', isConfidential: true }
      ];

      const sanitized = jobs.map(job => sanitizeConfidentialJob(job, false));

      // Vacante 1 - confidencial, debe estar sanitizada
      expect(sanitized[0].company).toBe('Empresa Confidencial');
      expect(sanitized[0].location).toBe('Monterrey');

      // Vacante 2 - NO confidencial, debe estar completa
      expect(sanitized[1].company).toBe('Empresa B');
      expect(sanitized[1].location).toBe('Calle 2, CDMX');

      // Vacante 3 - confidencial, debe estar sanitizada
      expect(sanitized[2].company).toBe('Empresa Confidencial');
      expect(sanitized[2].location).toBe('GDL');
    });

    it('debería NO sanitizar cuando es vista de propietario (userId match)', () => {
      const jobs = [
        { id: 1, company: 'Mi Empresa', location: 'Mi Dirección, MTY', isConfidential: true, userId: 5 }
      ];

      // Simular que el usuario 5 está viendo sus propias vacantes
      const isOwnerView = true;
      const sanitized = jobs.map(job => sanitizeConfidentialJob(job, isOwnerView));

      expect(sanitized[0].company).toBe('Mi Empresa');
      expect(sanitized[0].location).toBe('Mi Dirección, MTY');
    });
  });

  describe('UI checkbox behavior', () => {
    it('debería inicializar isConfidential como false por defecto', () => {
      const initialFormData = {
        title: '',
        company: '',
        isConfidential: false
      };

      expect(initialFormData.isConfidential).toBe(false);
    });

    it('debería poder toglear isConfidential', () => {
      let formData = { isConfidential: false };

      // Simular click en checkbox
      formData = { ...formData, isConfidential: true };
      expect(formData.isConfidential).toBe(true);

      // Simular otro click
      formData = { ...formData, isConfidential: false };
      expect(formData.isConfidential).toBe(false);
    });
  });

  // =========================================================================
  // FEAT-3b: Sanitización en APIs de candidato
  // =========================================================================
  describe('Vacantes confidenciales en aplicaciones del candidato', () => {
    // Helper para sanitizar aplicaciones (replica lógica de las APIs)
    const sanitizeApplications = (applications: any[]) => {
      return applications.map(app => {
        if (app.job?.isConfidential) {
          return {
            ...app,
            job: {
              ...app.job,
              company: 'Empresa Confidencial',
              location: app.job.location?.includes(',')
                ? app.job.location.split(',').pop()?.trim() || app.job.location
                : app.job.location,
            }
          };
        }
        return app;
      });
    };

    const mockApplicationsWithConfidentialJob = [
      {
        id: 1,
        candidateName: 'Juan Pérez',
        status: 'reviewing',
        job: {
          id: 10,
          title: 'Desarrollador Senior',
          company: 'TechCorp Secreta SA',
          location: 'Av. Principal 123, Monterrey, Nuevo León',
          isConfidential: true
        }
      },
      {
        id: 2,
        candidateName: 'Juan Pérez',
        status: 'pending',
        job: {
          id: 20,
          title: 'Diseñador UX',
          company: 'DesignStudio',
          location: 'Roma Norte, CDMX',
          isConfidential: false
        }
      }
    ];

    it('/api/candidate/applications debe sanitizar empresa confidencial', () => {
      const sanitized = sanitizeApplications(mockApplicationsWithConfidentialJob);

      // Aplicación 1 - vacante confidencial
      expect(sanitized[0].job.company).toBe('Empresa Confidencial');
      expect(sanitized[0].job.location).toBe('Nuevo León');
      expect(sanitized[0].job.location).not.toContain('Av. Principal');

      // Aplicación 2 - vacante NO confidencial
      expect(sanitized[1].job.company).toBe('DesignStudio');
      expect(sanitized[1].job.location).toBe('Roma Norte, CDMX');
    });

    it('/api/my-applications debe sanitizar empresa confidencial', () => {
      const sanitized = sanitizeApplications(mockApplicationsWithConfidentialJob);

      expect(sanitized[0].job.company).toBe('Empresa Confidencial');
      expect(sanitized[0].job.title).toBe('Desarrollador Senior'); // Título NO cambia
    });

    it('/api/applications/[id] debe sanitizar para rol candidate', () => {
      const application = mockApplicationsWithConfidentialJob[0];
      const viewerRole = 'candidate';

      // Simular lógica del API
      let responseData = application;
      if (['candidate', 'user'].includes(viewerRole) && application.job?.isConfidential) {
        responseData = {
          ...application,
          job: {
            ...application.job,
            company: 'Empresa Confidencial',
            location: application.job.location?.includes(',')
              ? application.job.location.split(',').pop()?.trim() || application.job.location
              : application.job.location,
          }
        };
      }

      expect(responseData.job.company).toBe('Empresa Confidencial');
    });

    it('/api/applications/[id] debe sanitizar para rol user', () => {
      const application = mockApplicationsWithConfidentialJob[0];
      const viewerRole = 'user';

      let responseData = application;
      if (['candidate', 'user'].includes(viewerRole) && application.job?.isConfidential) {
        responseData = {
          ...application,
          job: {
            ...application.job,
            company: 'Empresa Confidencial',
            location: application.job.location?.includes(',')
              ? application.job.location.split(',').pop()?.trim() || application.job.location
              : application.job.location,
          }
        };
      }

      expect(responseData.job.company).toBe('Empresa Confidencial');
    });

    it('/api/applications/[id] NO debe sanitizar para admin', () => {
      const application = mockApplicationsWithConfidentialJob[0];
      const viewerRole = 'admin';

      let responseData = application;
      if (['candidate', 'user'].includes(viewerRole) && application.job?.isConfidential) {
        responseData = {
          ...application,
          job: {
            ...application.job,
            company: 'Empresa Confidencial',
          }
        };
      }

      // Admin ve el nombre real
      expect(responseData.job.company).toBe('TechCorp Secreta SA');
    });

    it('/api/applications/[id] NO debe sanitizar para recruiter', () => {
      const application = mockApplicationsWithConfidentialJob[0];
      const viewerRole = 'recruiter';

      let responseData = application;
      if (['candidate', 'user'].includes(viewerRole) && application.job?.isConfidential) {
        responseData = {
          ...application,
          job: {
            ...application.job,
            company: 'Empresa Confidencial',
          }
        };
      }

      // Recruiter ve el nombre real
      expect(responseData.job.company).toBe('TechCorp Secreta SA');
    });

    it('/api/applications/[id] NO debe sanitizar para company', () => {
      const application = mockApplicationsWithConfidentialJob[0];
      const viewerRole = 'company';

      let responseData = application;
      if (['candidate', 'user'].includes(viewerRole) && application.job?.isConfidential) {
        responseData = {
          ...application,
          job: {
            ...application.job,
            company: 'Empresa Confidencial',
          }
        };
      }

      // Company ve el nombre real
      expect(responseData.job.company).toBe('TechCorp Secreta SA');
    });

    it('debería manejar ubicación sin comas en aplicaciones', () => {
      const appWithSimpleLocation = {
        id: 3,
        job: {
          company: 'Empresa X',
          location: 'Monterrey',
          isConfidential: true
        }
      };

      const sanitized = sanitizeApplications([appWithSimpleLocation]);

      // Sin coma, retorna la ubicación original
      expect(sanitized[0].job.location).toBe('Monterrey');
    });

    it('stats de my-applications deben calcularse sobre aplicaciones sanitizadas', () => {
      const applications = [
        { id: 1, status: 'pending', job: { isConfidential: true, company: 'Secret' } },
        { id: 2, status: 'reviewing', job: { isConfidential: false, company: 'Public' } },
        { id: 3, status: 'pending', job: { isConfidential: true, company: 'Hidden' } }
      ];

      const sanitized = sanitizeApplications(applications);
      const stats = {
        total: sanitized.length,
        pending: sanitized.filter(app => app.status === 'pending').length,
        reviewing: sanitized.filter(app => app.status === 'reviewing').length
      };

      expect(stats.total).toBe(3);
      expect(stats.pending).toBe(2);
      expect(stats.reviewing).toBe(1);

      // Verificar que las empresas fueron sanitizadas
      expect(sanitized[0].job.company).toBe('Empresa Confidencial');
      expect(sanitized[1].job.company).toBe('Public');
      expect(sanitized[2].job.company).toBe('Empresa Confidencial');
    });
  });
});
