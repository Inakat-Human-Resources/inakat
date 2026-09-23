// RUTA: src/lib/jobs-validation.ts

import { prisma } from './prisma';

/**
 * Validaciones compartidas por las rutas de vacantes (POST /api/jobs, PUT y
 * PATCH /api/jobs/[id], PUT /api/jobs/publish).
 *
 * Estaban duplicadas o directamente ausentes en cada ruta, y por ahí se colaban
 * publicaciones gratis, nombres de empresa ajenos y datos que reventaban Prisma
 * DESPUÉS de haber cobrado los créditos.
 */

/** Las únicas modalidades que entiende la matriz de precios. */
export const WORK_MODES = ['remote', 'hybrid', 'presential'] as const;

export type WorkMode = (typeof WORK_MODES)[number];

export function isValidWorkMode(value: unknown): value is WorkMode {
  return typeof value === 'string' && (WORK_MODES as readonly string[]).includes(value);
}

/**
 * `habilidades` se guarda como un JSON array de strings en una columna de texto.
 *
 * La API aceptaba cualquier cadena, así que un valor como "React, Node" dejaba
 * la vacante imposible de editar: el formulario hace `JSON.parse` al cargarla y
 * el fallo se reportaba como "Error de conexión" para siempre.
 *
 * Acepta el array o su JSON y devuelve SIEMPRE el JSON normalizado (o null).
 * Devuelve `{ error }` si el valor no es una lista de textos.
 */
export function parseHabilidades(
  value: unknown
): { ok: true; value: string | null } | { ok: false; error: string } {
  if (value === undefined || value === null || value === '') {
    return { ok: true, value: null };
  }

  let lista: unknown = value;

  if (typeof value === 'string') {
    try {
      lista = JSON.parse(value);
    } catch {
      return {
        ok: false,
        error: 'habilidades debe ser una lista de textos (JSON array de strings)'
      };
    }
  }

  if (!Array.isArray(lista) || lista.some((h) => typeof h !== 'string')) {
    return {
      ok: false,
      error: 'habilidades debe ser una lista de textos (JSON array de strings)'
    };
  }

  const limpias = (lista as string[]).map((h) => h.trim()).filter((h) => h.length > 0);
  return { ok: true, value: limpias.length > 0 ? JSON.stringify(limpias) : null };
}

/**
 * Nombre de empresa con el que se publica.
 *
 * En la UI el campo es de sólo lectura y se precarga de la solicitud de empresa
 * aprobada, pero el servidor guardaba `company` tal como llegaba en el body: la
 * empresa "X SA" podía publicar una vacante a nombre de "Google México" —con su
 * propio logo— para hacer phishing a candidatos o dañar a un competidor.
 *
 * Para rol `company` manda su solicitud registrada; sólo si no tiene ninguna se
 * respeta lo que envió (cuentas creadas a mano por un admin). El admin publica
 * a nombre de quien haga falta.
 */
export async function resolveCompanyName(
  userId: number,
  role: string,
  companyFromBody: string
): Promise<string> {
  if (role !== 'company') return companyFromBody;

  const solicitud = await prisma.companyRequest.findUnique({
    where: { userId },
    select: { nombreEmpresa: true }
  });

  return solicitud?.nombreEmpresa || companyFromBody;
}

/**
 * Fecha de expiración que llega del cliente.
 *
 * `new Date('mañana')` es un Invalid Date y Prisma lanzaba DESPUÉS de haber
 * descontado los créditos: el cobro quedaba hecho y la vacante no existía.
 */
export function parseExpiresAt(
  value: unknown
): { ok: true; value: Date | null } | { ok: false; error: string } {
  if (value === undefined || value === null || value === '') {
    return { ok: true, value: null };
  }

  if (typeof value !== 'string' && typeof value !== 'number') {
    return { ok: false, error: 'expiresAt no es una fecha válida' };
  }

  const fecha = new Date(value);
  if (Number.isNaN(fecha.getTime())) {
    return { ok: false, error: 'expiresAt no es una fecha válida' };
  }

  return { ok: true, value: fecha };
}

/**
 * Coordenadas de la vacante. Fuera de rango no son un punto del mapa: las
 * consumen reclutador y especialista para calcular la distancia al candidato.
 */
export function parseCoordinate(
  value: unknown,
  tipo: 'latitude' | 'longitude'
): { ok: true; value: number | null } | { ok: false; error: string } {
  if (value === undefined || value === null || value === '') {
    return { ok: true, value: null };
  }

  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(n)) {
    return { ok: false, error: `${tipo} no es un número válido` };
  }

  const limite = tipo === 'latitude' ? 90 : 180;
  if (n < -limite || n > limite) {
    return { ok: false, error: `${tipo} fuera de rango (${-limite} a ${limite})` };
  }

  return { ok: true, value: n };
}
