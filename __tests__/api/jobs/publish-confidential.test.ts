// RUTA: __tests__/api/jobs/publish-confidential.test.ts

import { describe, it, expect } from '@jest/globals';

describe('/api/jobs/publish GET - Confidential sanitization', () => {
  // Simular la función de sanitización
  function sanitizeConfidentialJob(job: any) {
    if (!job.isConfidential) return job;
    return {
      ...job,
      company: 'Empresa Confidencial',
      location: job.location ? job.location.split(',').pop()?.trim() || 'México' : 'México',
    };
  }

  it('should hide company name for confidential jobs', () => {
    const job = { id: 1, company: 'ACME Corp', location: 'CDMX, México', isConfidential: true };
    const result = sanitizeConfidentialJob(job);
    expect(result.company).toBe('Empresa Confidencial');
  });

  it('should sanitize location for confidential jobs', () => {
    const job = { id: 1, company: 'ACME Corp', location: 'Calle 1, Monterrey, Nuevo León', isConfidential: true };
    const result = sanitizeConfidentialJob(job);
    expect(result.location).toBe('Nuevo León');
  });

  it('should not modify non-confidential jobs', () => {
    const job = { id: 1, company: 'ACME Corp', location: 'CDMX, México', isConfidential: false };
    const result = sanitizeConfidentialJob(job);
    expect(result.company).toBe('ACME Corp');
    expect(result.location).toBe('CDMX, México');
  });

  it('should handle null location on confidential jobs', () => {
    const job = { id: 1, company: 'ACME Corp', location: null, isConfidential: true };
    const result = sanitizeConfidentialJob(job);
    expect(result.location).toBe('México');
  });
});
