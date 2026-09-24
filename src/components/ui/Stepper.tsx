// RUTA: src/components/ui/Stepper.tsx
'use client';

import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface PasoStepper {
  id: string;
  etiqueta: string;
  /** Una línea bajo la etiqueta (sólo escritorio). */
  descripcion?: string;
}

export interface StepperProps {
  pasos: PasoStepper[];
  /** Índice (desde 0) del paso actual. */
  actual: number;
  /**
   * Volver a un paso ya hecho. Sin esto los pasos no son pulsables. Sin
   * `pasoMaximo` sólo se ofrece hacia atrás: avanzar exige validar el paso actual.
   */
  alIrA?: (indice: number) => void;
  /**
   * Índice del paso más lejano al que ya se llegó validando. Con él también se
   * puede saltar ADELANTE hasta ese paso (volver a «Revisión» tras «Editar»
   * sin pulsar «Continuar» en cada paso intermedio). Quien lo pasa valida en
   * `alIrA` los pasos que se salta, como haría «Continuar».
   */
  pasoMaximo?: number;
  className?: string;
}

/**
 * Progreso de un formulario por pasos: los pasos son PUNTOS (la persona) unidos
 * por una línea (el puente). Hecho = verde azulado con ✓; actual = naranja;
 * pendiente = contorno.
 *
 *   <Stepper pasos={PASOS} actual={paso} alIrA={setPaso} />
 *
 * En móvil se resume en «Paso 2 de 5 · Nombre del paso» con barra. El paso
 * actual lleva aria-current="step"; el estado va en texto, no sólo en color.
 */
export default function Stepper({ pasos, actual, alIrA, pasoMaximo, className }: StepperProps) {
  const pct = pasos.length > 1 ? (actual / (pasos.length - 1)) * 100 : 100;
  return (
    <div className={className}>
      {/* Móvil: resumen */}
      <div className="sm:hidden">
        <p className="text-sm text-ink-muted">
          Paso <span className="font-semibold text-ink tabular-nums">{actual + 1}</span> de{' '}
          <span className="tabular-nums">{pasos.length}</span>
          <span aria-hidden="true"> · </span>
          <span className="font-display font-semibold text-ink">{pasos[actual]?.etiqueta}</span>
        </p>
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-mist" aria-hidden="true">
          <div className="h-full rounded-full bg-orange transition-[width] duration-200" style={{ width: `${Math.max(pct, 4)}%` }} />
        </div>
      </div>

      {/* Escritorio: puntos y puente */}
      <ol aria-label="Progreso del formulario" className="hidden items-start sm:flex">
        {pasos.map((paso, i) => {
          const esActual = i === actual;
          // Hecho: antes del actual, o ya validado más adelante (pasoMaximo).
          const hecho = i < actual || (!esActual && pasoMaximo !== undefined && i <= pasoMaximo);
          const pulsable = Boolean(alIrA) && hecho;
          const estado = hecho ? 'completado' : esActual ? 'paso actual' : 'pendiente';
          const contenido = (
            <>
              <span
                className={cn(
                  'relative z-[1] flex h-8 w-8 flex-none items-center justify-center rounded-full border-2 font-display text-[13px] font-bold tabular-nums transition-colors duration-150',
                  hecho && 'border-teal bg-teal text-white',
                  esActual && 'border-orange bg-orange text-ink ring-4 ring-orange/20',
                  !hecho && !esActual && 'border-line-strong bg-white text-ink-muted'
                )}
                aria-hidden="true"
              >
                {hecho ? <Check className="h-4 w-4" strokeWidth={3} /> : i + 1}
              </span>
              <span className="mt-2 block px-1 text-center">
                <span className={cn('block font-display text-[13px] font-semibold leading-tight', esActual || hecho ? 'text-ink' : 'text-ink-muted')}>
                  {paso.etiqueta}
                </span>
                {paso.descripcion && (
                  <span className="mt-0.5 hidden text-xs leading-snug text-ink-muted lg:block">{paso.descripcion}</span>
                )}
                <span className="sr-only"> ({estado})</span>
              </span>
            </>
          );
          return (
            <li
              key={paso.id}
              aria-current={esActual ? 'step' : undefined}
              className="relative flex flex-1 flex-col items-center"
            >
              {i > 0 && (
                <span
                  className={cn(
                    'absolute right-1/2 top-4 h-0.5 w-full -translate-y-1/2',
                    i <= Math.max(actual, pasoMaximo ?? -1) ? 'bg-teal' : 'bg-line'
                  )}
                  aria-hidden="true"
                />
              )}
              {pulsable ? (
                <button
                  type="button"
                  onClick={() => alIrA?.(i)}
                  className="flex flex-col items-center rounded-lg focus-visible:outline-offset-4"
                >
                  {contenido}
                </button>
              ) : (
                <span className="flex flex-col items-center">{contenido}</span>
              )}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
