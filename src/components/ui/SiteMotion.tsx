// RUTA: src/components/ui/SiteMotion.tsx
'use client';

import { useEffect } from 'react';

/**
 * Único JS de movimiento del registro PÚBLICO (nació como HomeMotion, en la
 * portada). Cualquier página pública lo monta una vez, dentro o fuera de su
 * <main className="hm">:
 *
 *   <main className="hm">…</main>
 *   <SiteMotion />
 *
 * Hace tres cosas, todas prescindibles (sin JS la página se lee completa):
 *
 * 1. EL CANDADO: pone .hm--js en cada raíz .hm, pero SÓLO con la pestaña
 *    visible. Las animaciones de ENTRADA de site.css/home.css cuelgan de esa
 *    clase. En una pestaña de fondo (ctrl+click, restaurar sesión, una captura
 *    automática) el reloj de animación no avanza, y un `both` deja el título y
 *    la foto congelados en su fotograma inicial: invisibles. Así, quien abre la
 *    página en segundo plano la encuentra legible, y la animación arranca
 *    limpia la primera vez que la mira.
 * 2. Paralaje del puntero en [data-hm-hero]: escribe --mx/--my EN ese elemento
 *    (no en :root); lo consumen los .hm-plane de dentro.
 * 3. Botones imantados [data-hm-magnet]: usa la propiedad `translate`, así el
 *    `transform` del hover sigue vivo.
 *
 * 2 y 3 sólo con puntero fino y sin movimiento reducido. El rAF se detiene solo.
 */
const SiteMotion = () => {
  useEffect(() => {
    const raices = Array.from(document.querySelectorAll<HTMLElement>('.hm'));
    const cleanups: Array<() => void> = [];

    const arm = () => {
      if (document.visibilityState !== 'visible') return false;
      raices.forEach((raiz) => raiz.classList.add('hm--js'));
      return true;
    };

    if (!arm()) {
      const onVisible = () => {
        if (arm()) document.removeEventListener('visibilitychange', onVisible);
      };
      document.addEventListener('visibilitychange', onVisible);
      cleanups.push(() => document.removeEventListener('visibilitychange', onVisible));
    }

    cleanups.push(() => raices.forEach((raiz) => raiz.classList.remove('hm--js')));

    const fine = window.matchMedia('(hover: hover) and (pointer: fine)');
    const calm = window.matchMedia('(prefers-reduced-motion: reduce)');
    if (!fine.matches || calm.matches) return () => cleanups.forEach((fn) => fn());

    document.querySelectorAll<HTMLElement>('[data-hm-hero]').forEach((hero) => {
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
    });

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

export default SiteMotion;
