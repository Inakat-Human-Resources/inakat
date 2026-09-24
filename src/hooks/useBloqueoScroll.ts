// RUTA: src/hooks/useBloqueoScroll.ts
'use client';

import { useEffect } from 'react';

// Contador compartido: con dos capas abiertas, cerrar la de arriba no debe
// devolver el scroll a la página mientras la de abajo sigue abierta.
let abiertas = 0;
let previo = '';

/** Bloquea el scroll del documento mientras `activo` (modales y cajones). */
export function useBloqueoScroll(activo: boolean): void {
  useEffect(() => {
    if (!activo) return;
    const html = document.documentElement;
    if (abiertas === 0) {
      previo = html.style.overflow;
      html.style.overflow = 'hidden';
    }
    abiertas++;
    return () => {
      abiertas = Math.max(0, abiertas - 1);
      if (abiertas === 0) html.style.overflow = previo;
    };
  }, [activo]);
}
