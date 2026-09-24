// RUTA: src/app/profile/_componentes/Trayectoria.tsx
//
// Lista cronológica (experiencia laboral, educación) con el lenguaje del
// Stepper: cada entrada es un PUNTO y la línea que las une es el puente. La
// entrada actual (el trabajo de hoy, lo que se está cursando) lleva el punto
// naranja. Sólo presentación: las acciones (editar, eliminar) las pasa la
// página. Candidato a subir a src/components/ui si otra ficha lo necesita
// (CandidateProfileModal pinta lo mismo a su manera).

import type { ReactNode } from 'react';

export interface EntradaTrayectoria {
  id: number | string;
  /** Puesto o carrera: el encabezado de la entrada. */
  titulo: string;
  /** Empresa · ubicación, o la institución. */
  subtitulo?: ReactNode;
  /** Fechas y etiquetas (estatus, «Actual»). */
  meta?: ReactNode;
  descripcion?: string | null;
  /** Botones de la entrada (IconButton con su etiqueta). */
  acciones?: ReactNode;
  /** Entrada en curso: punto naranja. */
  actual?: boolean;
}

export default function Trayectoria({ entradas, etiqueta }: { entradas: EntradaTrayectoria[]; etiqueta: string }) {
  return (
    <ol aria-label={etiqueta}>
      {entradas.map((entrada, i) => (
        <li key={entrada.id} className="relative flex gap-4 pb-6 last:pb-0">
          {i < entradas.length - 1 && (
            <span className="absolute bottom-0 left-[7px] top-6 w-0.5 rounded-full bg-teal/20" aria-hidden="true" />
          )}
          <span
            className={
              entrada.actual
                ? 'relative mt-1 h-4 w-4 flex-none rounded-full border-2 border-orange bg-orange ring-4 ring-orange/20'
                : 'relative mt-1 h-4 w-4 flex-none rounded-full border-2 border-teal bg-white'
            }
            aria-hidden="true"
          />
          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h3 className="font-display text-[15px] font-semibold leading-snug text-ink">{entrada.titulo}</h3>
                {entrada.subtitulo && <div className="mt-0.5 text-sm text-ink-muted">{entrada.subtitulo}</div>}
              </div>
              {entrada.acciones && <div className="-mr-1.5 -mt-1 flex flex-none items-center">{entrada.acciones}</div>}
            </div>
            {entrada.meta && (
              <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[13px] text-ink-muted">{entrada.meta}</div>
            )}
            {entrada.descripcion && (
              <p className="mt-2 max-w-prose whitespace-pre-line text-sm leading-relaxed text-ink">{entrada.descripcion}</p>
            )}
          </div>
        </li>
      ))}
    </ol>
  );
}
