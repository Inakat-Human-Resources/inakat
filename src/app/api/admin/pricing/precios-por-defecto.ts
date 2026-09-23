// RUTA: src/app/api/admin/pricing/precios-por-defecto.ts

/**
 * Tabla ÚNICA de precios por defecto de una especialidad en PricingMatrix.
 *
 * La usaban por separado POST /api/admin/specialties (al crear) y
 * /api/admin/pricing/sync (al regenerar faltantes), cada uno con su propia copia,
 * y se desincronizaron: sync generaba 12 combinaciones sin 'Practicante' y daba
 * por completa una especialidad a la que le faltaban filas. Las vacantes de esas
 * combinaciones pasaban a costar el DEFAULT de 5 créditos.
 *
 * Vive junto a las rutas de precios (no es un route.ts: Next.js sólo expone
 * los handlers de archivos llamados route.ts).
 */

export const WORK_MODES = ['presential', 'hybrid', 'remote'] as const;
export const SENIORITY_LEVELS = ['Director', 'Sr', 'Middle', 'Jr', 'Practicante'] as const;
export const COMBINACIONES_ESPERADAS = SENIORITY_LEVELS.length * WORK_MODES.length;

/** Créditos base por seniority. */
const BASE_CREDITS: Record<(typeof SENIORITY_LEVELS)[number], number> = {
  Director: 10,
  Sr: 8,
  Middle: 6,
  Jr: 4,
  Practicante: 2
};

/** Ajuste por modalidad. */
const WORK_MODE_BONUS: Record<(typeof WORK_MODES)[number], number> = {
  presential: 0,
  hybrid: 1,
  remote: 2
};

export interface FilaPrecioPorDefecto {
  profile: string;
  seniority: string;
  workMode: string;
  location: string | null;
  credits: number;
  isActive: boolean;
}

/** Clave de combinación, igual en todos los consumidores. */
export function claveCombinacion(seniority: string, workMode: string): string {
  return `${seniority}-${workMode}`;
}

/**
 * Las 15 filas de precios por defecto de un perfil (5 seniorities x 3
 * modalidades), sin `location`.
 */
export function generarPreciosPorDefecto(profile: string): FilaPrecioPorDefecto[] {
  const filas: FilaPrecioPorDefecto[] = [];
  for (const workMode of WORK_MODES) {
    for (const seniority of SENIORITY_LEVELS) {
      filas.push({
        profile,
        seniority,
        workMode,
        location: null,
        credits: BASE_CREDITS[seniority] + WORK_MODE_BONUS[workMode],
        isActive: true
      });
    }
  }
  return filas;
}
