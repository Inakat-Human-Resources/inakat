// RUTA: src/lib/jobs-public.ts

/**
 * Vista pública de una vacante confidencial.
 *
 * Había tres copias de `sanitizeConfidentialJob` (GET /api/jobs, GET
 * /api/jobs/[id] y GET /api/jobs/publish) y las tres calculaban la ubicación
 * pública con `location.split(',').pop()`:
 *  - Google guarda `formatted_address` con restricción country:'mx', cuyo
 *    último segmento es SIEMPRE "México": la vacante confidencial de San Pedro
 *    Garza García se publicaba como "México" a secas.
 *  - Si la empresa tecleó la dirección sin comas ("Av Reforma 222 CDMX"),
 *    `pop()` devolvía la cadena completa y se publicaba la dirección exacta de
 *    la oficina de una empresa que pidió anonimato.
 *
 * Aquí vive una sola versión, que las tres rutas importan.
 */

/** Segmentos finales que son el país y no aportan ubicación. */
const PAISES = new Set(['méxico', 'mexico', 'mx', 'méx', 'mex']);

/** Respaldo cuando no hay una región pública que se pueda deducir. */
const UBICACION_GENERICA = 'México';

/**
 * Ubicación pública (estado o ciudad) de una vacante confidencial.
 *
 * Toma el último segmento de la dirección que NO sea el país y le quita
 * números (códigos postales, números exteriores). Nunca devuelve una cadena
 * sin comas tal cual: sin estructura no hay forma de saber qué parte es la
 * región y qué parte la calle, así que se responde "México".
 */
export function publicConfidentialLocation(location: string | null | undefined): string {
  if (!location || typeof location !== 'string') return UBICACION_GENERICA;

  const segmentos = location
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  // Una dirección sin comas puede ser la calle completa: no se publica.
  if (segmentos.length < 2) return UBICACION_GENERICA;

  while (segmentos.length > 0 && PAISES.has(segmentos[segmentos.length - 1].toLowerCase())) {
    segmentos.pop();
  }

  // Lo que queda antes del país tiene que ser región, no dirección: si sólo
  // queda un segmento (p. ej. "Av. Reforma 222, México") puede ser la calle.
  if (segmentos.length < 2) return UBICACION_GENERICA;

  const region = segmentos[segmentos.length - 1]
    .replace(/[#\d]+/g, '')
    .replace(/\s{2,}/g, ' ')
    .trim();

  return region.length > 0 ? region : UBICACION_GENERICA;
}

/**
 * Oculta todo lo que identifica a la empresa detrás de una vacante
 * confidencial: nombre, logo, `userId` (que /api/company/... resuelve) y las
 * coordenadas exactas (apuntan a su domicilio). Para el propietario y el admin
 * la vacante sale tal cual.
 */
export function sanitizeConfidentialJob<T extends Record<string, any>>(
  job: T,
  isOwnerOrAdmin: boolean
): T {
  if (!job.isConfidential || isOwnerOrAdmin) {
    return job;
  }

  return {
    ...job,
    userId: null,
    latitude: null,
    longitude: null,
    company: 'Empresa Confidencial',
    location: publicConfidentialLocation(job.location),
    logoUrl: null
  };
}
