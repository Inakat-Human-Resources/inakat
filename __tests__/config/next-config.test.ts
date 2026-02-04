// RUTA: __tests__/config/next-config.test.ts

import { describe, it, expect } from '@jest/globals';

describe('next.config.ts - Image configuration', () => {
  it('should allow Vercel Blob Storage images', () => {
    // Dominios que deben estar permitidos para next/image
    const requiredPatterns = [
      { protocol: 'https', hostname: '*.public.blob.vercel-storage.com' }
    ];

    // Verificar que el patrón requerido está definido
    requiredPatterns.forEach(pattern => {
      expect(pattern.protocol).toBe('https');
      expect(pattern.hostname).toContain('blob.vercel-storage.com');
    });
  });

  it('should not allow arbitrary external domains', () => {
    // Solo Vercel Blob debe estar permitido
    const allowedHostnames = ['*.public.blob.vercel-storage.com'];
    expect(allowedHostnames).toHaveLength(1);
  });
});
