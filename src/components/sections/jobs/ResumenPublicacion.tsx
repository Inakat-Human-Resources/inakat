// RUTA: src/components/sections/jobs/ResumenPublicacion.tsx
//
// La calculadora de costo del formulario de vacante, SIEMPRE a la vista
// (docs/DISENO.md §6):
// - desde 1280 px, columna lateral fija (`sticky top-20`) con el desglose;
// - por debajo, barra pegada al borde inferior (`sticky bottom-0`) con la cifra,
//   el estado del saldo y los botones.
//
// Es UN solo elemento que cambia de forma con el ancho (no dos copias): los
// botones existen una vez, con su lógica en CreateJobForm, que los pasa en
// `acciones`. Sticky y no fixed: vive dentro del <form> (sin overflow), no tapa
// la barra lateral del AppShell y al final de la página vuelve a su sitio.
//
// Contrastes (medidos): tinta/blanco 12.38 · ink-muted/blanco 5.85 ·
// peligro/blanco 6.57 · tinta/naranja claro 10.70 · naranja oscuro (icono)/naranja claro 6.14.

import type { ReactNode } from 'react';
import { AlertCircle } from 'lucide-react';
import StatusBadge from '@/components/ui/Badge';
import { cn } from '@/lib/utils';

/** id del panel: CreateJobForm lo usa para que un campo enfocado no quede debajo de la barra. */
export const ID_RESUMEN = 'resumen-vacante';
/** id de la línea que explica por qué no se puede publicar todavía (aria-describedby del botón). */
export const ID_AYUDA_COSTO = 'resumen-vacante-ayuda';

export interface ResumenPublicacionProps {
  modoEdicion: boolean;
  /** Créditos del usuario; null si todavía no se sabe o si es administrador (no se le muestra saldo). */
  saldo: number | null;
  costo: number;
  calculando: boolean;
  /** Saldo suficiente para publicar (siempre true para el administrador). */
  suficientes: boolean;
  perfil: string;
  nivel: string;
  modalidad: string;
  /** Edición: estado con el que se abrió la vacante y lo que costó. */
  estadoVacante?: string | null;
  costoPagado?: number | null;
  /** Edición: cobro (+) o devolución (−) que provocará guardar; 0 si no aplica. */
  deltaEdicion: number;
  /** Aviso del último envío (error o borrador guardado). */
  aviso?: ReactNode;
  /** Los botones del formulario (Guardar borrador / Publicar, o Cancelar / Guardar cambios). */
  acciones: ReactNode;
}

function Dato({ etiqueta, valor }: { etiqueta: string; valor: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="text-ink-muted">{etiqueta}</dt>
      <dd className={cn('min-w-0 truncate text-right font-medium', valor ? 'text-ink' : 'text-ink-muted')}>
        {valor || 'Sin elegir'}
      </dd>
    </div>
  );
}

export default function ResumenPublicacion({
  modoEdicion,
  saldo,
  costo,
  calculando,
  suficientes,
  perfil,
  nivel,
  modalidad,
  estadoVacante,
  costoPagado,
  deltaEdicion,
  aviso,
  acciones,
}: ResumenPublicacionProps) {
  // Línea de estado bajo la cifra (publicar).
  let lineaEstado: ReactNode = null;
  if (!modoEdicion) {
    if (calculando) {
      lineaEstado = <span className="text-ink-muted">Calculando el costo…</span>;
    } else if (!costo) {
      lineaEstado = <span className="text-ink-muted">Elige especialidad, nivel y modalidad para calcular el costo.</span>;
    } else if (saldo !== null && suficientes) {
      lineaEstado = (
        <span className="text-ink-muted">
          Tienes <span className="font-semibold tabular-nums text-ink">{saldo}</span>; te quedarán{' '}
          <span className="font-semibold tabular-nums text-ink">{saldo - costo}</span>.
        </span>
      );
    } else if (saldo !== null) {
      lineaEstado = (
        <span className="inline-flex items-start gap-1.5 font-medium text-danger">
          <AlertCircle className="mt-px h-4 w-4 flex-none" aria-hidden="true" />
          <span>
            Te faltan {costo - saldo} créditos para publicar esta vacante
          </span>
        </span>
      );
    }
  }

  return (
    <aside
      id={ID_RESUMEN}
      aria-labelledby={`${ID_RESUMEN}-titulo`}
      className={cn(
        // Móvil y tableta: barra pegada abajo, a sangre dentro del relleno del AppShell.
        'sticky bottom-0 z-20 -mx-4 mt-6 border-t border-line bg-white px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3',
        'shadow-[0_-10px_24px_-18px_rgba(40,55,57,0.55)] sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8',
        // Escritorio ancho: columna lateral fija bajo la cabecera del AppShell.
        'xl:bottom-auto xl:top-20 xl:mx-0 xl:mt-0 xl:rounded-xl xl:border xl:p-5 xl:shadow-ap-1'
      )}
    >
      <h2
        id={`${ID_RESUMEN}-titulo`}
        className="sr-only xl:not-sr-only xl:font-display xl:text-base xl:font-semibold xl:leading-snug xl:text-ink"
      >
        {modoEdicion ? 'Resumen de la vacante' : 'Costo de publicación'}
      </h2>

      {aviso && <div className="mb-3 xl:mb-0 xl:mt-3">{aviso}</div>}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-6 xl:flex-col xl:items-stretch xl:gap-0">
        <div className="min-w-0 sm:flex-1">
          {modoEdicion ? (
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 xl:mt-3">
              {estadoVacante && <StatusBadge estado={estadoVacante} contexto="vacante" />}
              {costoPagado ? (
                <p className="text-[13px] text-ink-muted">
                  Costo pagado:{' '}
                  <span className="font-display font-semibold tabular-nums text-ink">{costoPagado}</span> créditos
                </p>
              ) : null}
            </div>
          ) : (
            // La cifra y su estado se anuncian al cambiar (cortesía, de una vez).
            <div
              aria-live="polite"
              aria-atomic="true"
              className="flex items-center justify-between gap-4 xl:mt-3 xl:block"
            >
              <p className="flex-none font-display text-ink">
                <span className="text-2xl font-bold tabular-nums leading-none xl:text-[2.5rem]">
                  {calculando ? '…' : costo > 0 ? costo : '—'}
                </span>
                <span className="ml-1.5 text-sm font-medium text-ink-muted">créditos</span>
              </p>
              {lineaEstado && (
                <p id={ID_AYUDA_COSTO} className="min-w-0 text-right text-[13px] leading-snug xl:mt-2 xl:text-left">
                  {lineaEstado}
                </p>
              )}
            </div>
          )}

          {/* En edición, el aviso del cobro o la devolución se ve en todos los anchos. */}
          {modoEdicion && deltaEdicion !== 0 && (
            <div className="mt-3 flex items-start gap-2 rounded-lg bg-orange-tint px-3 py-2.5 text-[13px] leading-snug text-ink">
              <AlertCircle className="mt-px h-4 w-4 flex-none text-orange-dark" aria-hidden="true" />
              <p>
                Este cambio recalcula el precio de la vacante:{' '}
                {deltaEdicion > 0 ? (
                  <>
                    se te cobrarán{' '}
                    <strong>{deltaEdicion} créditos</strong> adicionales
                    al guardar.
                  </>
                ) : (
                  <>
                    se te devolverán{' '}
                    <strong>{Math.abs(deltaEdicion)} créditos</strong> al
                    guardar.
                  </>
                )}
              </p>
            </div>
          )}

          {/* Desglose: sólo con sitio (columna lateral). */}
          <dl className="mt-4 hidden space-y-2 border-t border-line pt-4 text-[13px] xl:block">
            <Dato etiqueta="Especialidad" valor={perfil} />
            <Dato etiqueta="Nivel" valor={nivel} />
            <Dato etiqueta="Modalidad" valor={modalidad} />
          </dl>
          <p className="mt-3 hidden text-xs leading-relaxed text-ink-muted xl:block">
            {modoEdicion
              ? 'Cambiar la especialidad, el nivel o la modalidad de una vacante publicada recalcula su precio.'
              : 'El costo de publicación depende del perfil, nivel de experiencia y modalidad. Guardar como borrador no descuenta créditos.'}
          </p>
        </div>

        <div className="grid grid-cols-[auto_minmax(0,1fr)] gap-2 sm:flex sm:flex-none sm:items-center xl:mt-5 xl:grid xl:grid-cols-1">
          {acciones}
        </div>
      </div>
    </aside>
  );
}
