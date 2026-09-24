// RUTA: src/components/ui/Drawer.tsx
'use client';

import { useId, useRef, type ReactNode } from 'react';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { primerCampo, useFocoAtrapado } from '@/hooks/useFocoAtrapado';
import { useBloqueoScroll } from '@/hooks/useBloqueoScroll';
import Capa from './Capa';
import IconButton from './IconButton';
import { EnTablaContext } from './ContextoTabla';

export interface DrawerProps {
  abierto: boolean;
  alCerrar: () => void;
  titulo: ReactNode;
  descripcion?: ReactNode;
  pie?: ReactNode;
  children?: ReactNode;
  /** Lado desde el que entra (por defecto, la derecha). */
  lado?: 'derecha' | 'izquierda';
  /** Ancho del panel (clase de Tailwind). */
  ancho?: string;
}

/**
 * Panel lateral: el detalle de una fila sin salir de la lista, o los filtros
 * avanzados en móvil. Mismas garantías que Modal (role="dialog", foco atrapado,
 * Escape, scroll bloqueado, portal).
 *
 *   <Drawer abierto={!!seleccion} alCerrar={() => setSeleccion(null)} titulo={seleccion?.nombre}>
 *     …
 *   </Drawer>
 */
export default function Drawer(props: DrawerProps) {
  if (!props.abierto) return null;
  // Un panel abierto desde una celda de DataTable no hereda sus botones `sm`.
  return (
    <Capa>
      <EnTablaContext.Provider value={false}>
        <PanelDrawer {...props} />
      </EnTablaContext.Provider>
    </Capa>
  );
}

function PanelDrawer({ alCerrar, titulo, descripcion, pie, children, lado = 'derecha', ancho = 'w-[min(28rem,100vw)]' }: DrawerProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const cuerpoRef = useRef<HTMLDivElement>(null);
  const idTitulo = useId();
  const idDescripcion = useId();

  // Como Modal: el foco va al primer campo del cuerpo o, si no hay, al panel.
  useFocoAtrapado(panelRef, true, {
    alEscape: alCerrar,
    focoInicial: () => primerCampo(cuerpoRef.current) ?? panelRef.current,
  });
  useBloqueoScroll(true);

  return (
    <div
      className={cn('ap-fondo fixed inset-0 z-50 flex bg-ink/45', lado === 'derecha' ? 'justify-end' : 'justify-start')}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) alCerrar();
      }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={idTitulo}
        aria-describedby={descripcion ? idDescripcion : undefined}
        className={cn(
          'flex h-full max-w-full flex-col bg-white shadow-ap-3 outline-none',
          lado === 'derecha' ? 'ap-cajon--derecha' : 'ap-cajon--izquierda',
          ancho
        )}
      >
        <div className="flex items-start justify-between gap-4 border-b border-line px-5 py-4">
          <div className="min-w-0">
            <h2 id={idTitulo} className="font-display text-lg font-semibold leading-snug text-ink">
              {titulo}
            </h2>
            {descripcion && (
              <p id={idDescripcion} className="mt-1 text-sm text-ink-muted">
                {descripcion}
              </p>
            )}
          </div>
          <IconButton etiqueta="Cerrar" icono={X} onClick={alCerrar} className="-mr-2 -mt-1" />
        </div>
        <div ref={cuerpoRef} className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-5">
          {children}
        </div>
        {pie && <div className="flex justify-end gap-2 border-t border-line bg-paper/70 px-5 py-3.5">{pie}</div>}
      </div>
    </div>
  );
}
