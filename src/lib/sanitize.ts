// RUTA: src/lib/sanitize.ts

/**
 * Normalización de texto plano que se guarda en la base de datos.
 *
 * OJO con lo que este módulo NO es: no es una defensa anti-XSS. El texto se
 * renderiza con React (que escapa por defecto; no hay un solo
 * `dangerouslySetInnerHTML` en `src/`) y en los correos con `escapeHtml`. Esa
 * es la defensa real.
 *
 * La versión anterior borraba por regex «javascript:» y TODO lo que hubiera
 * entre un '<' y el siguiente '>'. En una bolsa de trabajo tecnológica eso
 * corrompía datos en silencio: la nota «JavaScript: avanzado. React < 2 años,
 * Node > 3 años» se guardaba como « avanzado. React 3 años», es decir, con el
 * lenguaje evaluado y la experiencia cambiados. Y ni siquiera servía de escudo:
 * `<img src=x onerror=alert(1)` (sin '>' de cierre) pasaba intacto.
 *
 * Ahora sólo se quitan tags HTML REALES (`<b>`, `</script>`, `<div …>`), que
 * nadie escribe a mano en una nota, y caracteres de control. Las comparaciones
 * («< 2 años»), los dos puntos y el resto del texto se conservan.
 */

/** Tag HTML real: '<' + nombre de etiqueta + … + '>'. */
const TAG_HTML = /<\/?[a-z][a-z0-9]*\b[^>]*>/gi;

/** Caracteres de control (menos \t \n \r) que no deben acabar en la DB. */
const CARACTERES_CONTROL = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;

export function sanitizeText(input: string): string {
  if (!input) return input;

  return input
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(TAG_HTML, '')
    .replace(CARACTERES_CONTROL, '')
    .replace(/[^\S\n]{3,}/g, '  ')
    .trim();
}

export function sanitizeMultilineText(input: string): string {
  if (!input) return input;
  const preserved = input.replace(/\n/g, '{{NEWLINE}}');
  const sanitized = sanitizeText(preserved);
  return sanitized.replace(/\{\{NEWLINE\}\}/g, '\n');
}

export function sanitizeBody<T extends Record<string, unknown>>(
  obj: T,
  multilineFields: string[] = []
): T {
  const sanitized = { ...obj };
  for (const key in sanitized) {
    if (typeof sanitized[key] === 'string') {
      if (multilineFields.includes(key)) {
        (sanitized as Record<string, unknown>)[key] = sanitizeMultilineText(sanitized[key] as string);
      } else {
        (sanitized as Record<string, unknown>)[key] = sanitizeText(sanitized[key] as string);
      }
    }
  }
  return sanitized;
}

/**
 * ¿Es una URL http(s) absoluta?
 *
 * Cualquier URL que venga del usuario y vaya a renderizarse como `href` tiene que
 * pasar por aquí. `z.string().url()` NO sirve para esto: `javascript:alert(1)` es
 * una URL válida según el estándar, así que pasa la validación y luego se
 * convierte en XSS almacenado al pinchar el enlace.
 */
export function isSafeHttpUrl(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    return false;
  }
  return parsed.protocol === 'http:' || parsed.protocol === 'https:';
}
