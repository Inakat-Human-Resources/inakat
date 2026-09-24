// RUTA: src/components/ui/EtapasPipeline.tsx

import type React from 'react';
import { cn } from '@/lib/utils';

export interface EtapaPipeline {
  id: string;
  /** Nombre de la etapa: «Pendientes», «En revisión»… (el texto que lee el lector). */
  etiqueta: string;
  valor: number;
  /** Color del punto cuando la etapa tiene gente (clase de fondo de un token). */
  punto: string;
}

/**
 * Resumen de un pipeline como un TRAYECTO: cada etapa es un punto sobre el
 * mismo puente (el isotipo de INAKAT: un punto y un arco), con su cifra y su
 * nombre. Una etapa vacía deja el punto hueco; el color sólo acompaña, el dato
 * lo dicen el número y la etiqueta.
 *
 *   <EtapasPipeline etapas={[{ id: 'pend', etiqueta: 'Pendientes', valor: 3, punto: 'bg-orange' }, …]} />
 *
 * Es un <dl>: cada etapa, un <dt> (nombre) y su <dd> (cifra). En móvil pasa a
 * una rejilla de cuatro sin el puente.
 *
 * Lo usa /admin/assign-candidates; sirve al pipeline de /admin y a los paneles
 * de reclutador y especialista.
 */
export default function EtapasPipeline({ etapas, className }: { etapas: EtapaPipeline[]; className?: string }) {
  return (
    <div className={cn('relative', className)}>
      {/* El puente: une los puntos desde sm, donde caben todas en una fila. */}
      <span
        aria-hidden="true"
        className="absolute left-[5px] right-[5px] top-[5px] hidden h-px bg-line-strong/50 sm:block"
      />
      {/* Cuatro por fila en móvil; desde sm, todas en una fila (--etapas). */}
      <dl
        className="relative grid grid-cols-4 gap-x-3 gap-y-4 sm:[grid-template-columns:repeat(var(--etapas),minmax(0,1fr))]"
        style={{ '--etapas': etapas.length } as React.CSSProperties}
      >
        {etapas.map((etapa) => (
          <div key={etapa.id} className="min-w-0">
            <span
              aria-hidden="true"
              className={cn(
                'mb-2 block h-[11px] w-[11px] rounded-full ring-4 ring-white',
                etapa.valor > 0 ? etapa.punto : 'border border-line-strong bg-white'
              )}
            />
            {/* dt antes que dd (lo exige <dl>); a la vista, la cifra arriba. */}
            <div className="flex flex-col-reverse">
              <dt className="truncate text-xs text-ink-muted" title={etapa.etiqueta}>
                {etapa.etiqueta}
              </dt>
              <dd
                className={cn(
                  'font-display text-xl font-semibold leading-tight tabular-nums',
                  etapa.valor > 0 ? 'text-ink' : 'text-ink-muted'
                )}
              >
                {etapa.valor}
              </dd>
            </div>
          </div>
        ))}
      </dl>
    </div>
  );
}
