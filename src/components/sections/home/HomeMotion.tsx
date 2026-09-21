// RUTA: src/components/sections/home/HomeMotion.tsx
'use client';

import { useEffect } from 'react';

// Único JS de la home: lo que CSS no puede hacer.
// - Paralaje del puntero en la portada: escribe --mx/--my EN la portada (no en :root).
// - Botones imantados: usa la propiedad `translate`, así el transform del hover sigue vivo.
// Solo con puntero fino y sin movimiento reducido. El rAF se detiene solo.
const HomeMotion = () => {
  useEffect(() => {
    // Las animaciones de ENTRADA de home.css cuelgan de .hm--js, y la clase se pone
    // sólo cuando la pestaña está VISIBLE. Motivo: en una pestaña de fondo (ctrl+click,
    // restaurar sesión) el reloj de animación no avanza, y un `both` deja el título y
    // la foto congelados en su fotograma inicial — es decir, invisibles. Así, quien
    // abra la home en segundo plano la encuentra legible, y la animación arranca
    // limpia la primera vez que la mira.
    const root = document.querySelector('.hm');
    const cleanups: Array<() => void> = [];

    const arm = () => {
      if (document.visibilityState !== 'visible') return false;
      root?.classList.add('hm--js');
      return true;
    };

    if (!arm()) {
      const onVisible = () => {
        if (arm()) document.removeEventListener('visibilitychange', onVisible);
      };
      document.addEventListener('visibilitychange', onVisible);
      cleanups.push(() => document.removeEventListener('visibilitychange', onVisible));
    }

    cleanups.push(() => root?.classList.remove('hm--js'));

    const fine = window.matchMedia('(hover: hover) and (pointer: fine)');
    const calm = window.matchMedia('(prefers-reduced-motion: reduce)');
    if (!fine.matches || calm.matches) return () => cleanups.forEach((fn) => fn());

    const hero = document.querySelector<HTMLElement>('[data-hm-hero]');

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
