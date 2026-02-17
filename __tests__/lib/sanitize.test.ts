// RUTA: __tests__/lib/sanitize.test.ts

/**
 * Tests para el módulo de sanitización de texto.
 * Verifica que se remueven tags HTML, scripts, y event handlers
 * mientras se preserva el texto legítimo.
 */

import { sanitizeText, sanitizeMultilineText, sanitizeBody } from '@/lib/sanitize';

describe('sanitizeText', () => {
  it('debe retornar string vacío si input está vacío', () => {
    expect(sanitizeText('')).toBe('');
  });

  it('debe retornar texto plano sin cambios', () => {
    expect(sanitizeText('Hola mundo')).toBe('Hola mundo');
  });

  it('debe remover tags de script completos', () => {
    expect(sanitizeText('<script>alert("xss")</script>Hola')).toBe('Hola');
  });

  it('debe remover script tags con atributos', () => {
    expect(sanitizeText('<script type="text/javascript">hack()</script>OK')).toBe('OK');
  });

  it('debe remover tags HTML preservando texto', () => {
    expect(sanitizeText('<b>negrita</b> y <i>cursiva</i>')).toBe('negrita y cursiva');
  });

  it('debe remover img tags con onerror', () => {
    expect(sanitizeText('<img onerror="alert(1)">Juan')).toBe('Juan');
  });

  it('debe remover javascript: URLs', () => {
    expect(sanitizeText('javascript:alert(1)')).toBe('alert(1)');
  });

  it('debe remover event handlers inline', () => {
    expect(sanitizeText('onclick="hack()" texto')).toBe('texto');
  });

  it('debe remover data:text/html', () => {
    const result = sanitizeText('data:text/html,<script>alert(1)</script>');
    expect(result).not.toContain('data:text/html');
    expect(result).not.toContain('<script>');
  });

  it('debe normalizar whitespace excesivo', () => {
    expect(sanitizeText('mucho     espacio')).toBe('mucho  espacio');
  });

  it('debe hacer trim del resultado', () => {
    expect(sanitizeText('  texto  ')).toBe('texto');
  });

  it('debe manejar texto en español con acentos', () => {
    expect(sanitizeText('Evaluación técnica: José María')).toBe('Evaluación técnica: José María');
  });

  it('debe manejar caracteres especiales legítimos', () => {
    expect(sanitizeText('Precio: $1,500.00 (MXN)')).toBe('Precio: $1,500.00 (MXN)');
  });

  it('debe manejar ataques XSS complejos', () => {
    const malicious = '<div onmouseover="alert(1)"><script>document.cookie</script>Texto real</div>';
    const result = sanitizeText(malicious);
    expect(result).not.toContain('<script>');
    expect(result).not.toContain('onmouseover');
    expect(result).not.toContain('<div');
    expect(result).toContain('Texto real');
  });

  it('debe remover tags anidados', () => {
    const nested = '<div><p><span>contenido</span></p></div>';
    expect(sanitizeText(nested)).toBe('contenido');
  });

  it('debe remover múltiples event handlers', () => {
    const input = 'onload="hack()" onmouseover="steal()" texto limpio';
    const result = sanitizeText(input);
    expect(result).not.toContain('onload');
    expect(result).not.toContain('onmouseover');
    expect(result).toContain('texto limpio');
  });

  it('debe remover javascript: case insensitive', () => {
    expect(sanitizeText('JAVASCRIPT:alert(1)')).toBe('alert(1)');
    expect(sanitizeText('JavaScript:void(0)')).toBe('void(0)');
  });

  it('debe manejar null/undefined sin crash (via guard clause)', () => {
    // sanitizeText checks !input, so falsy values return as-is
    expect(sanitizeText(null as unknown as string)).toBeFalsy();
    expect(sanitizeText(undefined as unknown as string)).toBeFalsy();
  });
});

describe('sanitizeMultilineText', () => {
  it('debe preservar saltos de línea', () => {
    const input = 'Línea 1\nLínea 2\nLínea 3';
    expect(sanitizeMultilineText(input)).toBe('Línea 1\nLínea 2\nLínea 3');
  });

  it('debe remover HTML pero preservar newlines', () => {
    const input = '<b>Título</b>\n<script>hack</script>\nTexto normal';
    const result = sanitizeMultilineText(input);
    expect(result).toContain('Título');
    expect(result).toContain('Texto normal');
    expect(result).not.toContain('<script>');
    expect(result).not.toContain('<b>');
    // Newlines deben estar preservados
    expect(result.split('\n').length).toBeGreaterThanOrEqual(2);
  });

  it('debe retornar string vacío si input está vacío', () => {
    expect(sanitizeMultilineText('')).toBe('');
  });

  it('debe manejar múltiples newlines consecutivos', () => {
    const input = 'Párrafo 1\n\n\nPárrafo 2';
    const result = sanitizeMultilineText(input);
    expect(result).toContain('Párrafo 1');
    expect(result).toContain('Párrafo 2');
    expect(result).toContain('\n');
  });

  it('debe sanitizar contenido entre newlines', () => {
    const input = 'Línea limpia\n<script>alert("xss")</script>\nOtra línea';
    const result = sanitizeMultilineText(input);
    expect(result).not.toContain('<script>');
    expect(result).toContain('Línea limpia');
    expect(result).toContain('Otra línea');
  });

  it('debe manejar notas de evaluación realistas', () => {
    const note = 'Candidato fuerte en backend.\nManejo de Python y SQL.\n\nPuntos débiles:\n- Comunicación en inglés\n- Sin experiencia cloud';
    expect(sanitizeMultilineText(note)).toBe(note);
  });
});

describe('sanitizeBody', () => {
  it('debe sanitizar todos los strings del objeto', () => {
    const body = {
      nombre: '<script>hack</script>Juan',
      email: 'juan@test.com',
      edad: 25,
    };
    const result = sanitizeBody(body);
    expect(result.nombre).toBe('Juan');
    expect(result.email).toBe('juan@test.com');
    expect(result.edad).toBe(25); // No es string, no se toca
  });

  it('debe usar sanitizeMultilineText para campos marcados', () => {
    const body = {
      titulo: 'Mi nota',
      contenido: 'Párrafo 1\nPárrafo 2',
    };
    const result = sanitizeBody(body, ['contenido']);
    expect(result.contenido).toBe('Párrafo 1\nPárrafo 2');
  });

  it('debe no mutar el objeto original', () => {
    const body = { nombre: '<b>Test</b>' };
    const original = body.nombre;
    sanitizeBody(body);
    expect(body.nombre).toBe(original);
  });

  it('debe sanitizar campo normal (sin multiline) removiendo newlines implícitos del trim', () => {
    const body = {
      nombre: '  <b>Juan</b>  ',
      mensaje: 'Texto\ncon\nnewlines',
    };
    // mensaje como campo normal (no en multilineFields) — sanitizeText hace trim
    const result = sanitizeBody(body);
    expect(result.nombre).toBe('Juan');
  });

  it('debe preservar newlines solo en campos multiline', () => {
    const body = {
      titulo: 'Sin newlines aquí',
      mensaje: 'Con\nnewlines\naquí',
    };
    const result = sanitizeBody(body, ['mensaje']);
    expect(result.mensaje).toContain('\n');
  });

  it('debe manejar objeto vacío', () => {
    const result = sanitizeBody({});
    expect(result).toEqual({});
  });

  it('debe manejar valores null y boolean sin error', () => {
    const body = {
      nombre: 'Juan',
      activo: true,
      borrado: null,
      contador: 0,
    } as Record<string, unknown>;
    const result = sanitizeBody(body);
    expect(result.nombre).toBe('Juan');
    expect(result.activo).toBe(true);
    expect(result.borrado).toBeNull();
    expect(result.contador).toBe(0);
  });
});
