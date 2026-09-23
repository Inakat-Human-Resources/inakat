// RUTA: src/lib/pagination.ts

export interface PaginationParams {
  page: number;
  limit: number;
  skip: number;
  take: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

/** Tope de página: `skip` tiene que caber en el Int32 que espera Postgres. */
const MAX_PAGE = 100000;

/**
 * Lee un entero de un query param, con respaldo si no es un número válido.
 *
 * `parseInt('abc')` da NaN y `Math.max(1, NaN)` sigue siendo NaN: ese NaN
 * llegaba a Prisma como `skip`/`take` y cualquier ruta paginada (incluida la
 * pública GET /api/jobs) respondía 500 ante `?page=abc`.
 */
function aEntero(valor: string | null, respaldo: number): number {
  const n = Number.parseInt(valor ?? '', 10);
  return Number.isFinite(n) ? n : respaldo;
}

/**
 * Extrae parámetros de paginación de los searchParams.
 * Siempre devuelve enteros finitos y dentro de rango.
 */
export function getPaginationParams(
  searchParams: URLSearchParams,
  defaultLimit = 20,
  maxLimit = 100
): PaginationParams {
  const page = Math.min(Math.max(1, aEntero(searchParams.get('page'), 1)), MAX_PAGE);
  const limit = Math.min(
    Math.max(1, aEntero(searchParams.get('limit'), defaultLimit)),
    maxLimit
  );
  const skip = (page - 1) * limit;

  return { page, limit, skip, take: limit };
}

/**
 * Convierte un id que llega del usuario (query param o body) en un entero
 * positivo, o `null` si no lo es.
 *
 * Varias rutas pasaban `parseInt(entrada)` directo a Prisma: con `?jobId=abc`
 * la consulta lanzaba y la respuesta era un 500 genérico —ensuciando los logs—
 * en lugar del 400 que corresponde a una entrada inválida.
 */
export function parseId(value: unknown): number | null {
  if (typeof value === 'number') {
    return Number.isInteger(value) && value > 0 ? value : null;
  }
  if (typeof value !== 'string' || value.trim() === '') return null;
  const n = Number(value);
  if (!Number.isInteger(n) || n <= 0) return null;
  return n;
}

/**
 * Construye la respuesta paginada.
 */
export function buildPaginatedResponse<T>(
  data: T[],
  total: number,
  params: PaginationParams
): PaginatedResponse<T> {
  const totalPages = Math.ceil(total / params.limit);
  return {
    data,
    pagination: {
      page: params.page,
      limit: params.limit,
      total,
      totalPages,
      hasNext: params.page < totalPages,
      hasPrev: params.page > 1,
    },
  };
}
