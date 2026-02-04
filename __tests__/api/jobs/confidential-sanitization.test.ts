// RUTA: __tests__/api/jobs/confidential-sanitization.test.ts

import { describe, it, expect } from '@jest/globals';

describe('Confidential job location sanitization - consistency', () => {
  // Simular la lógica de sanitización estandarizada
  function sanitizeLocation(location: string | null): string {
    return location ? location.split(',').pop()?.trim() || 'México' : 'México';
  }

  it('should return last part for multi-part locations', () => {
    expect(sanitizeLocation('Calle 5, Monterrey, Nuevo León')).toBe('Nuevo León');
  });

  it('should return second part when only two parts', () => {
    expect(sanitizeLocation('Monterrey, Nuevo León')).toBe('Nuevo León');
  });

  it('should return the string itself when no comma', () => {
    expect(sanitizeLocation('Remoto')).toBe('Remoto');
  });

  it('should return México for null location', () => {
    expect(sanitizeLocation(null)).toBe('México');
  });

  it('should return México for empty string', () => {
    expect(sanitizeLocation('')).toBe('México');
  });

  it('should trim whitespace from result', () => {
    expect(sanitizeLocation('Ciudad,  Nuevo León  ')).toBe('Nuevo León');
  });
});
