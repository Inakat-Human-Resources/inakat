// RUTA: __tests__/lib/normalizeUrl.test.ts

/**
 * Tests para normalizeUrl centralizada en utils.ts
 */

import { normalizeUrl } from '@/lib/utils';

describe('normalizeUrl', () => {
  it('debe retornar undefined si input es undefined', () => {
    expect(normalizeUrl(undefined)).toBeUndefined();
  });

  it('debe retornar falsy si input es string vacío', () => {
    // normalizeUrl('') → '' es falsy por la condición: url && ...
    expect(normalizeUrl('')).toBeFalsy();
  });

  it('debe agregar https:// a URL sin protocolo', () => {
    expect(normalizeUrl('linkedin.com/in/juan')).toBe('https://linkedin.com/in/juan');
  });

  it('debe agregar https:// a www sin protocolo', () => {
    expect(normalizeUrl('www.miportafolio.com')).toBe('https://www.miportafolio.com');
  });

  it('debe dejar intacto URL con https://', () => {
    expect(normalizeUrl('https://linkedin.com/in/juan')).toBe('https://linkedin.com/in/juan');
  });

  it('debe dejar intacto URL con http://', () => {
    expect(normalizeUrl('http://example.com')).toBe('http://example.com');
  });

  it('debe manejar URLs de Vercel Blob', () => {
    const blobUrl = 'https://blob.vercel-storage.com/cv-abc123.pdf';
    expect(normalizeUrl(blobUrl)).toBe(blobUrl);
  });

  it('debe manejar Google Drive links sin protocolo', () => {
    expect(normalizeUrl('drive.google.com/file/d/123')).toBe('https://drive.google.com/file/d/123');
  });

  it('debe manejar GitHub URLs sin protocolo', () => {
    expect(normalizeUrl('github.com/usuario/proyecto')).toBe('https://github.com/usuario/proyecto');
  });

  it('debe dejar intacto HTTPS con path complejo', () => {
    const url = 'https://behance.net/gallery/12345/mi-portafolio';
    expect(normalizeUrl(url)).toBe(url);
  });

  it('debe manejar URL con query params', () => {
    expect(normalizeUrl('example.com/page?key=value')).toBe('https://example.com/page?key=value');
  });
});
