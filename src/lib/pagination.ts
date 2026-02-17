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

/**
 * Extrae parámetros de paginación de los searchParams.
 */
export function getPaginationParams(
  searchParams: URLSearchParams,
  defaultLimit = 20,
  maxLimit = 100
): PaginationParams {
  const page = Math.max(1, parseInt(searchParams.get('page') || '1'));
  const rawLimit = parseInt(searchParams.get('limit') || String(defaultLimit));
  const limit = Math.min(Math.max(1, rawLimit), maxLimit);
  const skip = (page - 1) * limit;

  return { page, limit, skip, take: limit };
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
