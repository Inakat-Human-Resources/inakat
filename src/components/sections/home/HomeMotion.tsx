// RUTA: src/components/sections/home/HomeMotion.tsx
'use client';

import { useEffect } from 'react';

// Único JS de la home: lo que CSS no puede hacer.
// - Paralaje del puntero en la portada: escribe --mx/--my EN la portada (no en :root).
// - Botones imantados: usa la propiedad `translate`, así el transform del hover sigue vivo.
// Solo con puntero fino y sin movimiento reducido. El rAF se detiene solo.
const HomeMotion = () => {
  useEffect(() => {
    // Marca que JS está vivo: las animaciones de ENTRADA de home.css cuelgan de .hm--js.
    // Sin JS el estado natural es el final (todo visible), nunca un fotograma congelado.
    const root = document.querySelector('.hm');
    root?.classList.add('hm--js');

    const fine = window.matchMedia('(hover: hover) and (pointer: fine)');
    const calm = window.matchMedia('(prefers-reduced-motion: reduce)');
    if (!fine.matches || calm.matches) return () => root?.classList.remove('hm--js');

    const hero = document.querySelector<HTMLElement>('[data-hm-hero]');
    const cleanups: Array<() => void> = [() => root?.classList.remove('hm--js')];

    if (hero) {
      let tx = 0;
      let ty = 0;
      let x = 0;
      let y = 0;
      let raf = 0;

      const tick = () => {
        x += (tx - x) * 0.08;
        y += (ty - y) * 0.08;
        hero.style.setProperty('--mx', x.toFixed(4));
        hero.style.setProperty('--my', y.toFixed(4));
        raf = Math.abs(tx - x) > 0.002 || Math.abs(ty - y) > 0.002 ? requestAnimationFrame(tick) : 0;
      };

      const onMove = (e: PointerEvent) => {
        const r = hero.getBoundingClientRect();
        tx = (e.clientX - r.left) / r.width - 0.5;
        ty = (e.clientY - r.top) / r.height - 0.5;
        if (!raf) raf = requestAnimationFrame(tick);
      };

      hero.addEventListener('pointermove', onMove);
      cleanups.push(() => {
        hero.removeEventListener('pointermove', onMove);
        if (raf) cancelAnimationFrame(raf);
      });
    }

    document.querySelectorAll<HTMLElement>('[data-hm-magnet]').forEach((el) => {
      const onMove = (e: PointerEvent) => {
        const r = el.getBoundingClientRect();
        const dx = (e.clientX - r.left) / r.width - 0.5;
        const dy = (e.clientY - r.top) / r.height - 0.5;
        el.style.translate = `${(dx * 14).toFixed(1)}px ${(dy * 10).toFixed(1)}px`;
      };
      const onLeave = () => {
        el.style.translate = '';
      };
      el.addEventListener('pointermove', onMove);
      el.addEventListener('pointerleave', onLeave);
      cleanups.push(() => {
        el.removeEventListener('pointermove', onMove);
        el.removeEventListener('pointerleave', onLeave);
      });
    });

    return () => cleanups.forEach((fn) => fn());
  }, []);

  return null;
};

export default HomeMotion;
