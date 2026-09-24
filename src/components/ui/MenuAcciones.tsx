// RUTA: src/components/ui/MenuAcciones.tsx
'use client';

/**
 * Menú de acciones de una fila («⋯»): las acciones secundarias de una tabla
 * sin llenar la fila de botones.
 *
 *   <MenuAcciones
 *     etiqueta={`Más acciones para ${vacante.title}`}
 *     opciones={[
 *       { id: 'pausar', etiqueta: 'Pausar', icono: Pause, alElegir: () => pausar(v.id) },
 *       { id: 'cancelar', etiqueta: 'Cancelar vacante', icono: Ban, peligro: true, alElegir: … },
 *     ]}
 *   />
 *
 * Patrón WAI-ARIA de botón de menú: aria-haspopup/aria-expanded en el botón,
 * role="menu" + role="menuitem"; flechas ↑/↓, Inicio/Fin, Escape cierra y
 * devuelve el foco al botón, Tab cierra.
 *
 * El menú se pinta al final de <body> (Capa) con posición fija calculada desde
 * el botón: dentro de la tabla lo recortarían la tarjeta ([overflow:clip]) y
 * el contenedor con desplazamiento lateral de DataTable. Al desplazar la página
 * o cambiar el tamaño de la ventana, se cierra (no se queda flotando lejos del
 * botón).
 *
 * Los eventos de React atraviesan los portales: un clic en una opción subiría
 * hasta la <tr> clicable de DataTable y abriría la fila. Por eso el menú corta
 * la propagación del clic.
 *
 * Sirve a cualquier tabla con acciones secundarias (empresa, admin, reclutador…).
 */

import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react';
import { MoreHorizontal, type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import Capa from './Capa';
import IconButton from './IconButton';

export interface OpcionMenu {
  id: string;
  etiqueta: string;
  icono?: LucideIcon;
  /** Aclaración pequeña bajo la etiqueta («Quedan 2 h 30 min»). */
  detalle?: string;
  /** Acción que no se deshace o que descarta algo: texto en rojo. */
  peligro?: boolean;
  alElegir: () => void;
}

export interface MenuAccionesProps {
  /** Nombre accesible del botón: «Más acciones para Analista contable». */
  etiqueta: string;
  opciones: OpcionMenu[];
  icono?: LucideIcon;
  tamano?: 'sm' | 'md';
  className?: string;
}

interface Posicion {
  top?: number;
  bottom?: number;
  right: number;
}

/** Alto aproximado de cada opción (para decidir si abre hacia arriba). */
const ALTO_OPCION = 44;

export default function MenuAcciones({ etiqueta, opciones, icono = MoreHorizontal, tamano = 'sm', className }: MenuAccionesProps) {
  const [abierto, setAbierto] = useState(false);
  const [posicion, setPosicion] = useState<Posicion | null>(null);
  const botonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const opcionesRef = useRef<Array<HTMLButtonElement | null>>([]);
  // Qué opción recibe el foco al abrir (↑ en el botón abre por la última).
  const focoAlAbrir = useRef<'primera' | 'ultima'>('primera');
  const idMenu = useId();

  const abrir = (enfocar: 'primera' | 'ultima' = 'primera') => {
    const r = botonRef.current?.getBoundingClientRect();
    if (!r) return;
    const alto = opciones.length * ALTO_OPCION + 16;
    const cabeAbajo = r.bottom + 6 + alto <= window.innerHeight || r.top < alto;
    const right = Math.max(8, window.innerWidth - r.right);
    setPosicion(cabeAbajo ? { top: r.bottom + 6, right } : { bottom: window.innerHeight - r.top + 6, right });
    focoAlAbrir.current = enfocar;
    setAbierto(true);
  };

  const cerrar = (devolverFoco: boolean) => {
    setAbierto(false);
    if (devolverFoco) botonRef.current?.focus();
  };

  // Al abrir, el foco entra en la primera (o la última) opción.
  useEffect(() => {
    if (!abierto) return;
    const i = focoAlAbrir.current === 'ultima' ? opciones.length - 1 : 0;
    opcionesRef.current[i]?.focus({ preventScroll: true });
    // Sólo al abrir.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [abierto]);

  // Clic fuera, desplazamiento o cambio de tamaño: se cierra.
  useEffect(() => {
    if (!abierto) return;
    const alPulsarFuera = (e: MouseEvent) => {
      const destino = e.target as Node;
      if (menuRef.current?.contains(destino) || botonRef.current?.contains(destino)) return;
      setAbierto(false);
    };
    const alMover = (e: Event) => {
      // El propio menú no se desplaza; cualquier otro scroll lo deja lejos del botón.
      if (e.target instanceof Node && menuRef.current?.contains(e.target)) return;
      setAbierto(false);
    };
    const alRedimensionar = () => setAbierto(false);
    document.addEventListener('mousedown', alPulsarFuera);
    window.addEventListener('scroll', alMover, true);
    window.addEventListener('resize', alRedimensionar);
    return () => {
      document.removeEventListener('mousedown', alPulsarFuera);
      window.removeEventListener('scroll', alMover, true);
      window.removeEventListener('resize', alRedimensionar);
    };
  }, [abierto]);

  const alTeclearBoton = (e: KeyboardEvent<HTMLButtonElement>) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      abrir(e.key === 'ArrowUp' ? 'ultima' : 'primera');
    }
  };

  const alTeclearMenu = (e: KeyboardEvent<HTMLDivElement>) => {
    const lista = opcionesRef.current.filter(Boolean) as HTMLButtonElement[];
    const actual = lista.indexOf(document.activeElement as HTMLButtonElement);
    let destino = -1;
    if (e.key === 'ArrowDown') destino = (actual + 1) % lista.length;
    else if (e.key === 'ArrowUp') destino = (actual - 1 + lista.length) % lista.length;
    else if (e.key === 'Home') destino = 0;
    else if (e.key === 'End') destino = lista.length - 1;
    else if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      cerrar(true);
      return;
    } else if (e.key === 'Tab') {
      e.preventDefault();
      cerrar(true);
      return;
    }
    if (destino >= 0) {
      e.preventDefault();
      lista[destino]?.focus();
    }
  };

  if (opciones.length === 0) return null;

  return (
    <>
      <IconButton
        ref={botonRef}
        etiqueta={etiqueta}
        icono={icono}
        tamano={tamano}
        aria-haspopup="menu"
        aria-expanded={abierto}
        aria-controls={abierto ? idMenu : undefined}
        onClick={() => (abierto ? cerrar(false) : abrir())}
        onKeyDown={alTeclearBoton}
        className={cn(abierto && 'bg-ink/[0.06]', className)}
      />
      {abierto && posicion && (
        <Capa>
          <div
            ref={menuRef}
            id={idMenu}
            role="menu"
            aria-label={etiqueta}
            onKeyDown={alTeclearMenu}
            // Portal: sin esto el clic sube por el árbol de React hasta la fila clicable.
            onClick={(e) => e.stopPropagation()}
            style={{ position: 'fixed', top: posicion.top, bottom: posicion.bottom, right: posicion.right }}
            className="ap-fondo z-50 w-max min-w-[14rem] max-w-[calc(100vw-1rem)] rounded-xl border border-line bg-white p-1.5 shadow-ap-2"
          >
            {opciones.map((opcion, i) => {
              const Icono = opcion.icono;
              return (
                <button
                  key={opcion.id}
                  ref={(el) => {
                    opcionesRef.current[i] = el;
                  }}
                  type="button"
                  role="menuitem"
                  tabIndex={-1}
                  onClick={(e) => {
                    e.stopPropagation();
                    // El foco vuelve al botón ANTES de la acción: si la acción
                    // abre un Modal, éste lo devolverá ahí al cerrarse.
                    cerrar(true);
                    opcion.alElegir();
                  }}
                  className={cn(
                    'flex w-full items-start gap-2.5 rounded-lg px-3 py-2 text-left text-sm transition-colors duration-150',
                    'focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-teal',
                    // danger sobre danger-tint 5.41 · tinta sobre papel 11.35
                    opcion.peligro
                      ? 'text-danger hover:bg-danger-tint focus:bg-danger-tint'
                      : 'text-ink hover:bg-paper focus:bg-paper'
                  )}
                >
                  {Icono && <Icono className="mt-0.5 h-4 w-4 flex-none" aria-hidden="true" />}
                  <span className="min-w-0">
                    <span className="block font-medium leading-snug">{opcion.etiqueta}</span>
                    {opcion.detalle && (
                      <span className={cn('mt-0.5 block text-xs', opcion.peligro ? 'text-danger' : 'text-ink-muted')}>
                        {opcion.detalle}
                      </span>
                    )}
                  </span>
                </button>
              );
            })}
          </div>
        </Capa>
      )}
    </>
  );
}
