import { useEffect, useState } from 'react';

export function useCountUp(end: number, duration = 2000, start = false) {
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!start) return;

    // Quien pide "reducir movimiento" no debe ver un conteo de 2 s: la regla
    // de globals.css no alcanza a esta animación porque es de JavaScript.
    const prefiereMenosMovimiento =
      typeof window !== 'undefined' &&
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (prefiereMenosMovimiento || typeof requestAnimationFrame === 'undefined') {
      setCount(end);
      return;
    }

    let startTime: number;
    // Sin guardar el id, el bucle seguía llamando setCount tras desmontar el
    // componente y dos bucles se solapaban si cambiaban end o duration.
    let raf = requestAnimationFrame(step);

    function step(timestamp: number) {
      if (!startTime) startTime = timestamp;
      const progress = Math.min((timestamp - startTime) / duration, 1);
      setCount(Math.floor(progress * end));
      if (progress < 1) raf = requestAnimationFrame(step);
    }

    return () => cancelAnimationFrame(raf);
  }, [end, duration, start]);

  return count;
}
