// RUTA: src/hooks/useFocoAtrapado.ts
'use client';

import { useEffect, useRef, type RefObject } from 'react';

const ENFOCABLES = [
  'a[href]',
  'area[href]',
  'button:not([disabled])',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  'iframe',
  'summary',
  '[tabindex]:not([tabindex="-1"])',
  '[contenteditable="true"]',
].join(',');

/** Elementos enfocables con teclado dentro de `raiz`, en orden de tabulación. */
export function enfocablesDentro(raiz: HTMLElement): HTMLElement[] {
  return Array.from(raiz.querySelectorAll<HTMLElement>(ENFOCABLES)).filter(
    (el) =>
      !el.closest('[hidden], [inert], [aria-hidden="true"]') &&
      el.tabIndex !== -1 &&
      // Lo que está en display:none (p. ej. los enlaces de escritorio con el
      // cajón móvil abierto) no puede recibir el foco: fuera de la lista.
      (typeof el.checkVisibility !== 'function' || el.checkVisibility())
  );
}

/** El primer campo de formulario (input, select, textarea) usable dentro de `raiz`. */
export function primerCampo(raiz: HTMLElement | null | undefined): HTMLElement | null {
  if (!raiz) return null;
  return (
    enfocablesDentro(raiz).find((el) => el.matches('input, select, textarea') && !el.matches('[readonly]')) ?? null
  );
}

// Pila de capas abiertas: sólo la de arriba atrapa el foco y atiende Escape.
const pila: symbol[] = [];

/**
 * ¿Hay otro diálogo modal (de cualquier origen, también los heredados que no
 * usan este hook) DESPUÉS de `raiz` en el documento? Entonces `raiz` no es la
 * capa superior y no debe robarle el foco ni cerrarse con su Escape.
 */
function hayDialogoEncima(raiz: HTMLElement): boolean {
  const dialogos = Array.from(
    document.querySelectorAll<HTMLElement>('[role="dialog"][aria-modal="true"], [role="alertdialog"][aria-modal="true"]')
  ).filter((d) => d !== raiz && !raiz.contains(d) && !d.contains(raiz));
  return dialogos.some(
    (d) => raiz.compareDocumentPosition(d) & Node.DOCUMENT_POSITION_FOLLOWING
  );
}

interface Opciones {
  /** Se llama con Escape (sólo si esta capa es la de arriba). */
  alEscape?: () => void;
  /**
   * Elemento que recibe el foco al abrir (un ref, o una función que lo busca
   * en ese momento); si no hay, el primero enfocable (o la raíz).
   */
  focoInicial?: RefObject<HTMLElement | null> | (() => HTMLElement | null | undefined);
  /** Devolver el foco a donde estaba al cerrar (por defecto, sí). */
  devolverFoco?: boolean;
}

/**
 * Foco atrapado para modales, cajones y menús a pantalla completa.
 *
 * Mientras `activo`:
 * - Tab y Mayús+Tab dan la vuelta dentro de `raiz` (no se escapa al fondo).
 * - Escape llama a `alEscape`.
 * - Al abrir, enfoca `focoInicial` o el primer enfocable; al cerrar, devuelve
 *   el foco al elemento que lo tenía (el botón que abrió la capa).
 *
 * Con capas apiladas (un modal encima de otro, o un modal heredado encima de
 * uno nuevo) sólo actúa la de arriba.
 */
export function useFocoAtrapado(
  raiz: RefObject<HTMLElement | null>,
  activo: boolean,
  { alEscape, focoInicial, devolverFoco = true }: Opciones = {}
): void {
  const alEscapeRef = useRef(alEscape);
  alEscapeRef.current = alEscape;

  useEffect(() => {
    if (!activo) return;
    const el = raiz.current;
    if (!el) return;

    const id = Symbol('capa');
    pila.push(id);
    const previo = document.activeElement as HTMLElement | null;

    const enfocarInicio = () => {
      const pedido = typeof focoInicial === 'function' ? focoInicial() : focoInicial?.current;
      const destino = pedido ?? enfocablesDentro(el)[0] ?? el;
      if (destino === el && !el.hasAttribute('tabindex')) el.setAttribute('tabindex', '-1');
      destino.focus({ preventScroll: true });
    };
    // Tras pintar: el contenido de la capa ya existe.
    const t = window.setTimeout(enfocarInicio, 0);

    const esSuperior = () => pila[pila.length - 1] === id && !hayDialogoEncima(el);

    const alTeclear = (e: KeyboardEvent) => {
      if (!esSuperior()) return;

      if (e.key === 'Escape') {
        if (alEscapeRef.current) {
          e.stopPropagation();
          alEscapeRef.current();
        }
        return;
      }

      if (e.key !== 'Tab') return;
      const enfocables = enfocablesDentro(el);
      if (enfocables.length === 0) {
        e.preventDefault();
        el.focus();
        return;
      }
      const primero = enfocables[0];
      const ultimo = enfocables[enfocables.length - 1];
      const actual = document.activeElement as HTMLElement | null;
      const fuera = !actual || !el.contains(actual);

      if (e.shiftKey && (actual === primero || fuera)) {
        e.preventDefault();
        ultimo.focus();
      } else if (!e.shiftKey && (actual === ultimo || fuera)) {
        e.preventDefault();
        primero.focus();
      }
    };

    document.addEventListener('keydown', alTeclear);

    return () => {
      window.clearTimeout(t);
      document.removeEventListener('keydown', alTeclear);
      const i = pila.indexOf(id);
      if (i >= 0) pila.splice(i, 1);
      if (devolverFoco && previo && typeof previo.focus === 'function' && document.contains(previo)) {
        previo.focus({ preventScroll: true });
      }
    };
    // focoInicial es un ref estable; raiz también.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activo, devolverFoco]);
}
