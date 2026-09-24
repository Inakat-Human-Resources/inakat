// RUTA: src/components/ui/Modal.tsx
'use client';

import { useId, useRef, type ReactNode, type RefObject } from 'react';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { primerCampo, useFocoAtrapado } from '@/hooks/useFocoAtrapado';
import { useBloqueoScroll } from '@/hooks/useBloqueoScroll';
import Capa from './Capa';
import IconButton from './IconButton';
import { EnTablaContext } from './ContextoTabla';

const ANCHOS = {
  sm: 'max-w-md',
  md: 'max-w-xl',
  lg: 'max-w-3xl',
  xl: 'max-w-5xl',
} as const;

export interface ModalProps {
  abierto: boolean;
  alCerrar: () => void;
  /** Título del diálogo (su nombre accesible). */
  titulo: ReactNode;
  /**
   * Icono (o foto, logo) antes del título. Es decorativo: va FUERA del <h2>
   * (aria-hidden), así no entra en el nombre del diálogo y puede ser cualquier
   * elemento. El subtítulo y la descripción se alinean con el texto del
   * título, no con el icono.
   */
  iconoTitulo?: ReactNode;
  /** Línea bajo el título (p. ej. la vacante y la empresa). */
  subtitulo?: ReactNode;
  /** Descripción que se anuncia al abrir (aria-describedby). */
  descripcion?: ReactNode;
  /** Botones del pie. El de cerrar/cancelar primero; la acción principal, al final. */
  pie?: ReactNode;
  children?: ReactNode;
  tamano?: keyof typeof ANCHOS;
  /** Cerrar al pulsar el fondo (por defecto sí; ponlo en false si hay un formulario a medias). */
  cerrarAlPulsarFondo?: boolean;
  /**
   * Elemento que recibe el foco al abrir. Por defecto: el primer CAMPO del
   * cuerpo (input, select, textarea) para escribir sin más; si no hay campos,
   * el propio diálogo, y el lector lee su título y su descripción. Así una
   * confirmación nunca abre con el foco en «Eliminar».
   */
  focoInicial?: RefObject<HTMLElement | null>;
  /** Clases del cuerpo. */
  claseCuerpo?: string;
}

/**
 * Diálogo modal accesible:
 * - role="dialog", aria-modal, aria-labelledby (título) y aria-describedby;
 * - al abrir, el foco va al primer campo del cuerpo o, si no hay, al propio
 *   diálogo; queda atrapado (Tab da la vuelta dentro), Escape cierra, y al
 *   cerrar el foco vuelve al botón que lo abrió;
 * - scroll del fondo bloqueado;
 * - se pinta al final de <body> (Capa), así ningún `transform` lo atrapa.
 *
 *   <Modal
 *     abierto={abierto}
 *     alCerrar={() => setAbierto(false)}
 *     titulo="Eliminar vacante"
 *     descripcion="Esta acción no se puede deshacer."
 *     pie={<>
 *       <Button variante="contorno" onClick={() => setAbierto(false)}>Cancelar</Button>
 *       <Button variante="peligro" onClick={eliminar} cargando={eliminando}>Eliminar</Button>
 *     </>}
 *   />
 *
 * Con modales apilados (el pipeline y encima la ficha de candidato) cada uno
 * se pinta al final de <body> al abrirse: el último queda encima y sólo él
 * atiende Escape y atrapa el foco.
 */
export default function Modal(props: ModalProps) {
  if (!props.abierto) return null;
  // Un modal abierto desde una celda de DataTable no hereda sus botones `sm`.
  return (
    <Capa>
      <EnTablaContext.Provider value={false}>
        <PanelModal {...props} />
      </EnTablaContext.Provider>
    </Capa>
  );
}

function PanelModal({
  alCerrar,
  titulo,
  iconoTitulo,
  subtitulo,
  descripcion,
  pie,
  children,
  tamano = 'md',
  cerrarAlPulsarFondo = true,
  focoInicial,
  claseCuerpo,
}: ModalProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const cuerpoRef = useRef<HTMLDivElement>(null);
  const idTitulo = useId();
  const idDescripcion = useId();

  useFocoAtrapado(panelRef, true, {
    alEscape: alCerrar,
    focoInicial: focoInicial ?? (() => primerCampo(cuerpoRef.current) ?? panelRef.current),
  });
  useBloqueoScroll(true);

  return (
    <div
      className="ap-fondo fixed inset-0 z-50 flex items-end justify-center bg-ink/55 p-0 backdrop-blur-[2px] sm:items-center sm:p-4"
      // onMouseDown + target === currentTarget: arrastrar una selección desde
      // dentro del diálogo y soltar fuera NO lo cierra (PERF-037).
      onMouseDown={(e) => {
        if (cerrarAlPulsarFondo && e.target === e.currentTarget) alCerrar();
      }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={idTitulo}
        aria-describedby={descripcion ? idDescripcion : undefined}
        className={cn(
          'ap-panel flex max-h-[92vh] w-full flex-col overflow-hidden rounded-t-2xl bg-white shadow-ap-3 outline-none sm:max-h-[90vh] sm:rounded-2xl',
          ANCHOS[tamano]
        )}
      >
        <div className="flex items-start justify-between gap-4 border-b border-line px-5 py-4 sm:px-6">
          <div className="flex min-w-0 items-start gap-2.5">
            {iconoTitulo && (
              <span aria-hidden="true" className="flex min-h-[1.55rem] flex-none items-center">
                {iconoTitulo}
              </span>
            )}
            <div className="min-w-0">
              <h2 id={idTitulo} className="font-display text-lg font-semibold leading-snug text-ink">
                {titulo}
              </h2>
              {subtitulo && <div className="mt-1 text-sm text-ink-muted">{subtitulo}</div>}
              {descripcion && (
                <p id={idDescripcion} className="mt-1 text-sm text-ink-muted">
                  {descripcion}
                </p>
              )}
            </div>
          </div>
          <IconButton etiqueta="Cerrar" icono={X} onClick={alCerrar} className="-mr-2 -mt-1" />
        </div>
        <div ref={cuerpoRef} className={cn('min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-5 sm:px-6', claseCuerpo)}>
          {children}
        </div>
        {pie && (
          <div className="flex flex-col-reverse gap-2 border-t border-line bg-paper/70 px-5 py-3.5 sm:flex-row sm:items-center sm:justify-end sm:px-6">
            {pie}
          </div>
        )}
      </div>
    </div>
  );
}
