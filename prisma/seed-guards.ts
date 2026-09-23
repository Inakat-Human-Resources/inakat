// RUTA: prisma/seed-guards.ts
//
// Comprobaciones que el seed hace ANTES de escribir nada. Viven aparte de
// seed.ts porque ese archivo ejecuta main() al importarse y no se puede probar;
// aquí son funciones puras y sí tienen test (__tests__/db/db-seed-guards.test.ts).

// Valores de ejemplo publicados en .env.example / docs: nunca deben acabar
// siendo la contraseña real de un admin.
export const PLACEHOLDERS = ['CHANGE_ME', 'CHANGEME', 'CAMBIAME', 'TU_', 'XXX'];

export const LONGITUD_MINIMA_PASSWORD = 12;

// Hosts que se consideran una base de datos de desarrollo
export const HOSTS_LOCALES = ['localhost', '127.0.0.1', '::1', 'db', 'postgres'];

/**
 * true si el valor es un placeholder de .env.example o es demasiado corto para
 * ser una contraseña de verdad. validateEnvVars solo comprobaba presencia, así
 * que un 'CHANGE_ME_...' copiado tal cual pasaba la validación.
 */
export function esPasswordInvalida(valor: string | undefined): boolean {
  if (!valor) return true;
  if (valor.length < LONGITUD_MINIMA_PASSWORD) return true;
  const upper = valor.toUpperCase();
  return PLACEHOLDERS.some(p => upper.startsWith(p));
}

/** Host de DATABASE_URL sin exponer usuario ni contraseña. */
export function hostDeBaseDeDatos(url: string | undefined): string {
  if (!url) return '';
  try {
    return new URL(url).hostname;
  } catch {
    return '';
  }
}

/** true si el host corresponde a una base local de desarrollo. */
export function esBaseLocal(host: string): boolean {
  return HOSTS_LOCALES.includes(host);
}

export type MotivoBloqueo = 'produccion' | 'host-remoto' | null;

/**
 * Decide si el seed puede correr. Devuelve el motivo por el que NO debe correr,
 * o null si puede. SEED_ALLOW_REMOTE=1 es la única autorización explícita.
 */
export function motivoParaBloquearSeed(env: {
  NODE_ENV?: string;
  DATABASE_URL?: string;
  SEED_ALLOW_REMOTE?: string;
}): MotivoBloqueo {
  if (env.SEED_ALLOW_REMOTE === '1') return null;
  if (env.NODE_ENV === 'production') return 'produccion';
  if (!esBaseLocal(hostDeBaseDeDatos(env.DATABASE_URL))) return 'host-remoto';
  return null;
}

/** Normaliza un correo como lo hace el login (email.toLowerCase()). */
export function normalizarEmail(email: string): string {
  return email.toLowerCase().trim();
}
