// RUTA: src/components/ui/Pagination.tsx
'use client';

import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Forma del bloque `pagination` que devuelven las APIs paginadas
 * (buildPaginatedResponse de src/lib/pagination.ts, tope 100 por página).
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
  hasPrev: false,
};

/** Construye el bloque para una lista que se pagina en el cliente. */
export function paginacionLocal(total: number, pagina: number, porPagina: number): PaginacionApi {
  const totalPages = Math.max(1, Math.ceil(total / porPagina));
  return {
    page: pagina,
    limit: porPagina,
    total,
    totalPages,
    hasNext: pagina * porPagina < total,
    hasPrev: pagina > 1,
  };
}

/** Páginas a mostrar: primera, última y dos vecinas de la actual, con «…». */
function paginasVisibles(actual: number, total: number): Array<number | '…'> {
  const set = new Set<number>([1, total, actual - 1, actual, actual + 1]);
  const lista = [...set].filter((n) => n >= 1 && n <= total).sort((a, b) => a - b);
  const salida: Array<number | '…'> = [];
  lista.forEach((n, i) => {
    if (i > 0 && n - lista[i - 1] > 1) salida.push('…');
    salida.push(n);
  });
  return salida;
}

export interface PaginationProps {
  pagination: PaginacionApi;
  alCambiar: (nuevaPagina: number) => void;
  /** Qué se pagina, en plural: «vacantes», «candidatos». */
  etiqueta: string;
  className?: string;
}

/**
 * Paginación REAL: usa el `total` y el `totalPages` que devuelve la API (no el
 * largo de la página que llegó). Con una sola página no se pinta.
 *
 *   <Pagination pagination={data.pagination} alCambiar={setPagina} etiqueta="candidatos" />
 */
export default function Pagination({ pagination, alCambiar, etiqueta, className }: PaginationProps) {
  if (pagination.totalPages <= 1) return null;
  const { page, totalPages, total } = pagination;

  const claseBoton =
    'inline-flex h-8 items-center gap-1 rounded-lg border border-line-strong bg-white px-2.5 text-[13px] font-medium text-ink ' +
    'transition-colors duration-150 hover:bg-paper disabled:cursor-not-allowed disabled:opacity-40';

  return (
    <nav
      aria-label={`Paginación de ${etiqueta}`}
      className={cn(
        'flex flex-col items-center justify-between gap-3 border-t border-line px-4 py-3 sm:flex-row sm:px-5',
        className
      )}
    >
      <p className="text-[13px] text-ink-muted tabular-nums">
        Página {page} de {totalPages} · {total} {etiqueta}
      </p>
      <div className="flex items-center gap-1.5">
        <button
          type="button"
          onClick={() => alCambiar(page - 1)}
          disabled={!pagination.hasPrev}
          className={claseBoton}
        >
          <ChevronLeft className="h-4 w-4" aria-hidden="true" />
          Anterior
        </button>
        <ul className="hidden items-center gap-1 sm:flex">
          {paginasVisibles(page, totalPages).map((n, i) =>
            n === '…' ? (
              <li key={`e${i}`} className="px-1 text-[13px] text-ink-muted" aria-hidden="true">
                …
              </li>
            ) : (
              <li key={n}>
                <button
                  type="button"
                  onClick={() => alCambiar(n)}
                  aria-label={`Página ${n}`}
                  aria-current={n === page ? 'page' : undefined}
                  className={cn(
                    'inline-flex h-8 min-w-8 items-center justify-center rounded-lg px-2 text-[13px] font-medium tabular-nums transition-colors duration-150',
                    n === page ? 'bg-ink text-white' : 'text-ink hover:bg-ink/[0.06]'
                  )}
                >
                  {n}
                </button>
              </li>
            )
          )}
        </ul>
        <button
          type="button"
          onClick={() => alCambiar(page + 1)}
          disabled={!pagination.hasNext}
          className={claseBoton}
        >
          Siguiente
          <ChevronRight className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>
    </nav>
  );
}
