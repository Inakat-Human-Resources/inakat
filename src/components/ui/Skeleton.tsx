// RUTA: src/components/ui/Skeleton.tsx

import { cn } from '@/lib/utils';

/**
 * Hueco de carga con brillo (la animación `.skeleton` de globals.css; con
 * movimiento reducido queda quieto). Es decorativo: quien lo usa anuncia la
 * carga con texto o aria-busy en el contenedor.
 *
 *   <Skeleton className="h-4 w-40" />
 */
export default function Skeleton({ className }: { className?: string }) {
  return <span aria-hidden="true" className={cn('skeleton block h-4 w-full rounded-md', className)} />;
}

/** Varias líneas de texto de ancho decreciente. */
export function SkeletonTexto({ lineas = 3, className }: { lineas?: number; className?: string }) {
  return (
    <span aria-hidden="true" className={cn('block space-y-2', className)}>
      {Array.from({ length: lineas }, (_, i) => (
        <span
          key={i}
          className="skeleton block h-3.5 rounded-md"
          style={{ width: `${Math.max(40, 100 - i * 18)}%` }}
        />
      ))}
    </span>
  );
}

/** Página de aplicación cargando: cabecera + fila de cifras + tabla. */
export function SkeletonPagina({ conCifras = true }: { conCifras?: boolean }) {
  return (
    <div role="status" aria-live="polite" className="space-y-6">
      <span className="sr-only">Cargando…</span>
      <div className="space-y-3">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-4 w-96 max-w-full" />
      </div>
      {conCifras && (
        <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="rounded-xl border border-line bg-white p-5 shadow-ap-1">
              <Skeleton className="h-3.5 w-24" />
              <Skeleton className="mt-3 h-8 w-16" />
              <Skeleton className="mt-3 h-3 w-32" />
            </div>
          ))}
        </div>
      )}
      <div className="rounded-xl border border-line bg-white p-5 shadow-ap-1">
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="flex items-center gap-4 border-b border-line py-3 last:border-0">
            <Skeleton className="h-4 w-1/3" />
            <Skeleton className="h-4 w-1/5" />
            <Skeleton className="ml-auto h-6 w-16 rounded-full" />
          </div>
        ))}
      </div>
    </div>
  );
}
