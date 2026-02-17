// RUTA: src/lib/sanitize.ts

/**
 * Sanitización de texto para prevenir XSS almacenado.
 * No usamos DOMPurify — regex suficiente para texto plano.
 */

export function sanitizeText(input: string): string {
  if (!input) return input;

  return input
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<[^>]*>/g, '')
    .replace(/on\w+\s*=\s*["'][^"']*["']/gi, '')
    .replace(/javascript\s*:/gi, '')
    .replace(/data\s*:\s*text\/html/gi, '')
    .replace(/\s{3,}/g, '  ')
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
