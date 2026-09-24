// RUTA: src/components/ui/EmptyState.tsx

import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface EmptyStateProps {
  /** Qué no hay, dicho claro: «No hay vacantes con estos filtros». */
  titulo: string;
  /** Una línea en serif itálica, la voz humana: «Todavía nada por aquí». */
  frase?: string;
  /** Qué puede hacer la persona ahora. */
  descripcion?: ReactNode;
  /** Botón o enlace para salir del vacío (p. ej. «Limpiar filtros»). */
  accion?: ReactNode;
  /** Icono en lugar del arco (para vacíos pequeños dentro de tarjetas). */
  icono?: LucideIcon;
  compacto?: boolean;
  className?: string;
}

/**
 * Estado vacío: el arco y el punto del isotipo, una línea en serif y qué hacer.
 *
 *   <EmptyState
 *     frase="Todavía nada por aquí."
 *     titulo="No hay vacantes con estos filtros"
 *     accion={<Button variante="contorno" onClick={limpiar}>Limpiar filtros</Button>}
 *   />
 *
 * Distingue SIEMPRE «no hay datos» de «no se pudieron cargar»: para el error
 * usa un aviso con role="alert", no un estado vacío.
 */
export default function EmptyState({ titulo, frase, descripcion, accion, icono: Icono, compacto, className }: EmptyStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center text-center',
        compacto ? 'gap-2 px-4 py-8' : 'gap-3 px-6 py-14',
        className
      )}
    >
      {Icono ? (
        <span className="mb-1 flex h-11 w-11 items-center justify-center rounded-full bg-mist text-teal" aria-hidden="true">
          <Icono className="h-5 w-5" />
        </span>
      ) : (
        <span className="ap-vacio__arco mb-2" aria-hidden="true" />
      )}
      {frase && <p className="font-serif text-xl italic leading-tight text-ink">{frase}</p>}
      <p className={cn('font-display font-semibold text-ink', frase ? 'text-sm' : 'text-base')}>{titulo}</p>
      {descripcion && <div className="max-w-md text-sm text-ink-muted">{descripcion}</div>}
      {accion && <div className="mt-2 flex flex-wrap justify-center gap-2">{accion}</div>}
    </div>
  );
}
