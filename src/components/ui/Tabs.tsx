// RUTA: src/components/ui/Tabs.tsx
'use client';

import { useEffect, useRef, useState, type HTMLAttributes, type KeyboardEvent, type ReactNode } from 'react';
import { cn } from '@/lib/utils';

type Desborde = 'inicio' | 'fin' | 'ambos' | null;

/** Hueco que se deja a la pestaña activa respecto al borde (fuera del degradado). */
const MARGEN_ACTIVA = 48;

export interface Pestana {
  id: string;
  etiqueta: string;
  /** Número a la derecha (pendientes, resultados). */
  contador?: number;
  deshabilitada?: boolean;
}

export interface TabsProps {
  pestanas: Pestana[];
  activa: string;
  alCambiar: (id: string) => void;
  /** Nombre del grupo para el lector de pantalla: «Secciones del perfil». */
  etiqueta: string;
  /** Prefijo de ids (para enlazar pestaña ↔ panel). Único en la página. */
  idBase: string;
  className?: string;
}

/**
 * Pestañas con el patrón WAI-ARIA: flechas ←/→ mueven, Inicio/Fin saltan, sólo
 * la pestaña activa está en el orden de tabulación. Cada panel va en
 * <PanelPestana> con el mismo idBase.
 *
 *   <Tabs idBase="perfil" etiqueta="Secciones del perfil" activa={tab} alCambiar={setTab}
 *     pestanas={[{ id: 'datos', etiqueta: 'Datos' }, { id: 'cv', etiqueta: 'CV', contador: 2 }]} />
 *   <PanelPestana idBase="perfil" id="datos" activa={tab}>…</PanelPestana>
 *
 * Si no caben (móvil, un modal estrecho), la fila se desplaza de lado: el
 * borde que esconde más pestañas se desvanece (data-desborde + app.css) y la
 * pestaña activa se desplaza a la vista al elegirla o al cargar.
 */
export default function Tabs({ pestanas, activa, alCambiar, etiqueta, idBase, className }: TabsProps) {
  const refs = useRef<Array<HTMLButtonElement | null>>([]);
  const listaRef = useRef<HTMLDivElement>(null);
  const [desborde, setDesborde] = useState<Desborde>(null);
  const primeraVez = useRef(true);

  // ¿Hay pestañas escondidas a un lado o al otro? Se mide al cargar, al
  // desplazar y al cambiar de ancho (la lista, o sus pestañas: un contador que
  // crece la ensancha sin que cambie el ancho de la lista).
  useEffect(() => {
    const lista = listaRef.current;
    if (!lista) return;
    const medir = () => {
      const maximo = lista.scrollWidth - lista.clientWidth;
      if (maximo <= 1) {
        setDesborde(null);
        return;
      }
      const antes = lista.scrollLeft > 1;
      const despues = lista.scrollLeft < maximo - 1;
      setDesborde(antes && despues ? 'ambos' : antes ? 'inicio' : despues ? 'fin' : null);
    };
    medir();
    lista.addEventListener('scroll', medir, { passive: true });
    let observador: ResizeObserver | null = null;
    if (typeof ResizeObserver !== 'undefined') {
      observador = new ResizeObserver(medir);
      observador.observe(lista);
      Array.from(lista.children).forEach((hijo) => observador?.observe(hijo));
    }
    return () => {
      lista.removeEventListener('scroll', medir);
      observador?.disconnect();
    };
  }, [pestanas.length]);

  // La pestaña activa, siempre a la vista (sólo se desplaza la fila de
  // pestañas, nunca la página: nada de scrollIntoView). Sólo al cambiar de
  // pestaña: si la persona desliza la fila, otro render no se la devuelve.
  useEffect(() => {
    const lista = listaRef.current;
    const i = pestanas.findIndex((p) => p.id === activa);
    const pestana = refs.current[i];
    if (!lista || !pestana || lista.scrollWidth <= lista.clientWidth + 1) return;
    const izquierda = pestana.offsetLeft;
    const derecha = izquierda + pestana.offsetWidth;
    let destino = lista.scrollLeft;
    if (izquierda - MARGEN_ACTIVA < lista.scrollLeft) destino = izquierda - MARGEN_ACTIVA;
    else if (derecha + MARGEN_ACTIVA > lista.scrollLeft + lista.clientWidth) {
      destino = derecha + MARGEN_ACTIVA - lista.clientWidth;
    }
    destino = Math.max(0, destino);
    const suave =
      !primeraVez.current &&
      typeof window !== 'undefined' &&
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: no-preference)').matches;
    primeraVez.current = false;
    if (Math.abs(destino - lista.scrollLeft) < 1) return;
    if (typeof lista.scrollTo === 'function') lista.scrollTo({ left: destino, behavior: suave ? 'smooth' : 'auto' });
    else lista.scrollLeft = destino;
    // eslint-disable-next-line react-hooks/exhaustive-deps -- a propósito: sólo al cambiar de pestaña
  }, [activa, pestanas.length]);

  const alTeclear = (e: KeyboardEvent<HTMLDivElement>) => {
    const habilitadas = pestanas.map((p, i) => ({ p, i })).filter(({ p }) => !p.deshabilitada);
    const actual = habilitadas.findIndex(({ p }) => p.id === activa);
    let destino = -1;
    if (e.key === 'ArrowRight') destino = (actual + 1) % habilitadas.length;
    else if (e.key === 'ArrowLeft') destino = (actual - 1 + habilitadas.length) % habilitadas.length;
    else if (e.key === 'Home') destino = 0;
    else if (e.key === 'End') destino = habilitadas.length - 1;
    if (destino < 0) return;
    e.preventDefault();
    const { p, i } = habilitadas[destino];
    alCambiar(p.id);
    refs.current[i]?.focus();
  };

  return (
    <div
      ref={listaRef}
      role="tablist"
      aria-label={etiqueta}
      onKeyDown={alTeclear}
      data-desborde={desborde ?? undefined}
      // relative: las pestañas miden su offsetLeft respecto a esta fila.
      className={cn('ap-pestanas relative flex gap-1 overflow-x-auto border-b border-line scrollbar-hide', className)}
    >
      {pestanas.map((p, i) => {
        const seleccionada = p.id === activa;
        return (
          <button
            key={p.id}
            ref={(el) => {
              refs.current[i] = el;
            }}
            type="button"
            role="tab"
            id={`${idBase}-tab-${p.id}`}
            aria-selected={seleccionada}
            aria-controls={`${idBase}-panel-${p.id}`}
            tabIndex={seleccionada ? 0 : -1}
            disabled={p.deshabilitada}
            onClick={() => alCambiar(p.id)}
            className={cn(
              'relative -mb-px inline-flex h-11 flex-none items-center gap-2 whitespace-nowrap border-b-2 px-3 font-display text-sm font-semibold transition-colors duration-150',
              'disabled:cursor-not-allowed disabled:opacity-40',
              'focus-visible:outline-offset-[-2px]',
              seleccionada ? 'border-orange text-ink' : 'border-transparent text-ink-muted hover:text-ink'
            )}
          >
            {p.etiqueta}
            {typeof p.contador === 'number' && (
              <span
                className={cn(
                  'rounded-full px-1.5 py-0.5 text-[11px] font-semibold leading-none tabular-nums',
                  seleccionada ? 'bg-ink text-white' : 'bg-mist text-ink'
                )}
              >
                {p.contador}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

export interface PanelPestanaProps extends Omit<HTMLAttributes<HTMLDivElement>, 'id' | 'children'> {
  idBase: string;
  id: string;
  activa: string;
  children: ReactNode;
  className?: string;
  /**
   * El panel inactivo se queda montado con `hidden` en vez de desaparecer.
   * Úsalo cuando los paneles son partes de UN mismo <form>: así el envío y
   * la validación ven todos los campos, como antes de partirlo en pestañas, y
   * un <input type="file"> no pierde lo elegido.
   */
  mantenerMontado?: boolean;
}

export function PanelPestana({
  idBase,
  id,
  activa,
  children,
  className,
  mantenerMontado = false,
  ...resto
}: PanelPestanaProps) {
  const visible = id === activa;
  if (!visible && !mantenerMontado) return null;
  return (
    <div
      role="tabpanel"
      id={`${idBase}-panel-${id}`}
      aria-labelledby={`${idBase}-tab-${id}`}
      tabIndex={0}
      hidden={!visible}
      {...resto}
      className={cn('pt-5 focus-visible:outline-offset-4', className)}
    >
      {children}
    </div>
  );
}
