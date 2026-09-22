/**
 * URLs opcionales del registro de empresa.
 *
 * Dos defectos en el mismo sitio:
 *  1. `.optional()` acepta `undefined` pero no `null`, y el formulario manda
 *     `null` cuando el campo se deja vacío: registrar una empresa sin sitio web
 *     fallaba con «Datos inválidos» y nadie sabía por qué.
 *  2. `z.string().url()` acepta `javascript:alert(1)` —es una URL válida para el
 *     estándar—, y estos campos se renderizan como `href` en el panel de admin.
 *
 * Aquí se prueba el schema de verdad, no su código fuente.
 */
import { companyRequestSchema } from '@/lib/validations';

const base = {
  nombre: 'Ana',
  apellidoPaterno: 'López',
  apellidoMaterno: 'Cruz',
  nombreEmpresa: 'ACME',
  correoEmpresa: 'contacto@acme.com',
  razonSocial: 'ACME SA de CV',
  rfc: 'ABC123456A1A',
  direccionEmpresa: 'Calle 123, CDMX'
};

describe('Registro de empresa: campos de URL opcionales', () => {
  it('acepta sitioWeb null (lo que manda el formulario si se deja vacío)', () => {
    const r = companyRequestSchema.safeParse({ ...base, sitioWeb: null });
    expect(r.success).toBe(true);
  });

  it('acepta sitioWeb vacío y ausente', () => {
    expect(companyRequestSchema.safeParse({ ...base, sitioWeb: '' }).success).toBe(true);
    expect(companyRequestSchema.safeParse({ ...base }).success).toBe(true);
  });

  it('acepta una URL sin protocolo y la completa con https', () => {
    const r = companyRequestSchema.safeParse({ ...base, sitioWeb: 'inakat.com' });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.sitioWeb).toBe('https://inakat.com');
  });

  it('acepta una URL normal sin tocarla', () => {
    const r = companyRequestSchema.safeParse({ ...base, sitioWeb: 'https://inakat.com/x' });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.sitioWeb).toBe('https://inakat.com/x');
  });

  it('acepta null también en los documentos', () => {
    const r = companyRequestSchema.safeParse({
      ...base,
      identificacionUrl: null,
      documentosConstitucionUrl: null
    });
    expect(r.success).toBe(true);
  });
});

describe('Registro de empresa: no se cuelan URLs peligrosas', () => {
  const peligrosas = [
    'javascript:alert(1)',
    'JavaScript:alert(document.cookie)',
    'data:text/html,<script>alert(1)</script>',
    'vbscript:msgbox(1)',
    'file:///etc/passwd'
  ];

  it.each(peligrosas)('rechaza %s como sitio web', (url) => {
    expect(companyRequestSchema.safeParse({ ...base, sitioWeb: url }).success).toBe(false);
  });

  it.each(peligrosas)('rechaza %s como identificación', (url) => {
    expect(
      companyRequestSchema.safeParse({ ...base, identificacionUrl: url }).success
    ).toBe(false);
  });

  it.each(peligrosas)('rechaza %s como acta constitutiva', (url) => {
    expect(
      companyRequestSchema.safeParse({ ...base, documentosConstitucionUrl: url }).success
    ).toBe(false);
  });
});
