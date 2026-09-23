// RUTA: src/app/admin/_components/Paginacion.tsx

'use client';

/**
 * ADM-001/004/016/025: las APIs del panel devuelven tandas (20 o 30 filas) con
 * un bloque `pagination`, pero las pantallas pintaban `data.data` y se quedaban
 * ahí: el registro 31 era inalcanzable y los contadores ("Total 30") mentían.
 *
 * Este control es el mismo que ya usa /admin/vendors (PAGO-007), extraído para
 * que las demás pantallas no vuelvan a inventarse uno. La forma de `pagination`
 * es la que construye buildPaginatedResponse() en src/lib/pagination.ts.
 *
 * `_components` es carpeta privada de Next: no genera ninguna ruta.
 */

export interface PaginacionApi {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

export const PAGINACION_VACIA: PaginacionApi = {
  page: 1,
  limit: 20,
  total: 0,
  totalPages: 1,
  hasNext: false,
  hasPrev: false
};

export default function Paginacion({
  pagination,
  onChange,
  etiqueta
}: {
  pagination: PaginacionApi;
  onChange: (nuevaPagina: number) => void;
  etiqueta: string;
}) {
  if (pagination.totalPages <= 1) return null;

  return (
    <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-4 sm:px-6 py-4 border-t">
      <p className="text-sm text-gray-600">
        Página {pagination.page} de {pagination.totalPages} · {pagination.total} {etiqueta}
      </p>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => onChange(pagination.page - 1)}
          disabled={!pagination.hasPrev}
          className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Anterior
        </button>
        <button
          type="button"
          onClick={() => onChange(pagination.page + 1)}
          disabled={!pagination.hasNext}
          className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Siguiente
        </button>
      </div>
    </div>
  );
}
