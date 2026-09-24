// RUTA: src/app/diseno/_banco/BancoVista.tsx
'use client';

import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
// Contexto interno de Next (el mismo que lee useRouter): sólo el banco lo usa,
// para reescribir las navegaciones de la página hacia /diseno/vista/….
import { AppRouterContext, type AppRouterInstance } from 'next/dist/shared/lib/app-router-context.shared-runtime';
import AppShell from '@/components/ui/AppShell';
import { ROLES_APP, esRutaApp, etiquetaRol, type RolApp } from '@/lib/nav-app';
import { desinstalarSimulador, fijarRolSimulado, instalarSimulador, suscribirSinFixture } from './simulador';

export const PREFIJO_VISTA = '/diseno/vista';

/** Rol con el que se ve cada ruta si no se pasa ?rol=. */
export function rolPorRuta(ruta: string): RolApp {
  if (ruta.startsWith('/admin') || ruta.startsWith('/applications')) return 'admin';
  if (ruta.startsWith('/company') || ruta.startsWith('/create-job') || ruta.startsWith('/credits')) return 'company';
  if (ruta.startsWith('/recruiter')) return 'recruiter';
  if (ruta.startsWith('/specialist')) return 'specialist';
  if (ruta.startsWith('/vendor')) return 'vendor';
  if (ruta.startsWith('/my-applications')) return 'user';
  if (ruta.startsWith('/notifications')) return 'company';
  return 'candidate';
}

/**
 * Envoltorio del banco de pruebas. ANTES de pintar la página real:
 * 1. instala el window.fetch simulado (fixtures de src/app/diseno/fixtures);
 * 2. fija el rol (?rol=admin|company|candidate|user|recruiter|specialist|vendor,
 *    o el que corresponde a la ruta);
 * y la envuelve en el AppShell de ese rol con los enlaces reescritos a
 * /diseno/vista/…, para navegar por el panel sin salir del banco. También se
 * reescriben los router.push/replace de la página (p. ej. pulsar una fila de
 * /recruiter/dashboard lleva a /diseno/vista/recruiter/jobs/N, no a la ruta
 * real que pide sesión).
 */
export default function BancoVista({ children }: { children: ReactNode }) {
  const pathname = usePathname() ?? PREFIJO_VISTA;
  const params = useSearchParams();
  const router = useRouter();
  const ruta = pathname.slice(PREFIJO_VISTA.length) || '/';
  const rolParam = params.get('rol') as RolApp | null;
  const rol: RolApp = rolParam && ROLES_APP.includes(rolParam) ? rolParam : rolPorRuta(ruta);
  const consulta = rolParam ? `rol=${rolParam}` : '';

  // Se instala DURANTE el render (idempotente), no en un efecto: los efectos de
  // los hijos (la página, el AppShell que pide /api/auth/me) corren ANTES que
  // los del padre, y llegarían a la red de verdad. En el servidor no hace nada.
  if (typeof window !== 'undefined') {
    fijarRolSimulado(rol);
    instalarSimulador();
  }
  // Al salir del banco, fetch vuelve a ser el real. (Se reinstala también aquí:
  // en desarrollo React monta, desmonta y vuelve a montar los efectos.)
  useEffect(() => {
    instalarSimulador();
    return () => desinstalarSimulador();
  }, []);

  const [sinFixture, setSinFixture] = useState<string[]>([]);
  useEffect(() => suscribirSinFixture(setSinFixture), []);

  const aVista = (href: string) => {
    if (!href.startsWith('/') || href.startsWith(PREFIJO_VISTA) || !esRutaApp(href)) return href;
    const [camino, q = ''] = href.split('?');
    const partes = [q, consulta].filter(Boolean).join('&');
    return `${PREFIJO_VISTA}${camino}${partes ? `?${partes}` : ''}`;
  };

  // useRouter() de la página lee este contexto: sus push/replace/prefetch a
  // rutas de aplicación se quedan en el banco. Una ruta pública o una consulta
  // relativa ('?tab=2') pasan tal cual.
  const routerBanco = useMemo<AppRouterInstance>(
    () => ({
      ...router,
      push: (href, opciones) => router.push(aVista(href), opciones),
      replace: (href, opciones) => router.replace(aVista(href), opciones),
      prefetch: (href, opciones) => router.prefetch(aVista(href), opciones),
    }),
    // aVista sólo depende de `consulta`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [router, consulta]
  );

  // Los enlaces de la PÁGINA real (no los del armazón) también se quedan en el banco.
  const contenedor = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = contenedor.current;
    if (!el) return;
    const alClic = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = (e.target as HTMLElement).closest('a[href]') as HTMLAnchorElement | null;
      if (!a || a.target === '_blank') return;
      const href = a.getAttribute('href') || '';
      const destino = aVista(href);
      if (destino === href) return;
      e.preventDefault();
      e.stopPropagation();
      router.push(destino);
    };
    el.addEventListener('click', alClic, true);
    return () => el.removeEventListener('click', alClic, true);
  });

  return (
    <div ref={contenedor}>
      <AppRouterContext.Provider value={routerBanco}>
        <AppShell rolForzado={rol} rutaActual={ruta} construirHref={aVista}>
          {children}
        </AppShell>
      </AppRouterContext.Provider>

      {/* Barra del banco: rol y peticiones sin fixture */}
      {/* Abajo a la derecha y en una sola línea: en móvil no debe tapar la página. */}
      <div className="ap-sobre-tinta fixed bottom-3 right-3 z-[60] flex items-center gap-2 whitespace-nowrap rounded-full bg-ink px-3 py-1.5 text-xs text-white shadow-ap-3">
        <span className="font-display font-semibold text-lime">Banco</span>
        <label className="flex items-center gap-1.5">
          <span className="hidden text-sidebar-text sm:inline">Rol</span>
          <span className="sr-only sm:hidden">Rol</span>
          <select
            value={rol}
            onChange={(e) => router.push(`${pathname}?rol=${e.target.value}`)}
            className="rounded-md bg-ink-soft px-1.5 py-0.5 text-white"
          >
            {ROLES_APP.map((r) => (
              <option key={r} value={r}>
                {etiquetaRol(r)}
              </option>
            ))}
          </select>
        </label>
        <Link href="/diseno" className="hidden rounded px-1.5 py-0.5 text-sidebar-text underline-offset-2 hover:text-white hover:underline sm:inline">
          Galería
        </Link>
        {sinFixture.length > 0 && (
          <details className="relative">
            <summary className="cursor-pointer rounded-full bg-orange px-2 py-0.5 font-semibold text-ink">
              {sinFixture.length} sin fixture
            </summary>
            <ul className="absolute bottom-full right-0 mb-2 max-h-64 w-[min(20rem,calc(100vw-1.5rem))] overflow-auto rounded-lg bg-white p-3 font-mono text-[11px] text-ink shadow-ap-3">
              {sinFixture.map((s) => (
                <li key={s} className="py-0.5">
                  {s}
                </li>
              ))}
            </ul>
          </details>
        )}
      </div>
    </div>
  );
}
