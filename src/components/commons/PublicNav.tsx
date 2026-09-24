// RUTA: src/components/commons/PublicNav.tsx
'use client';

import { useEffect, useRef, useState, type CSSProperties } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { ArrowRight, Mail, Menu, Phone, X } from 'lucide-react';
import logo from '@/assets/images/logo/logo.png';
import { esRutaApp, inicioDeRol } from '@/lib/nav-app';
import { CONTACTO, CTA_REGISTRO_EMPRESA, ENLACES_PUBLICOS, esEnlaceActual } from '@/lib/nav-publica';
import { useSesion } from '@/hooks/useSesion';
import { useFocoAtrapado } from '@/hooks/useFocoAtrapado';
import { useBloqueoScroll } from '@/hooks/useBloqueoScroll';

/**
 * Barra del registro PÚBLICO. La monta el layout raíz; en las rutas de la
 * aplicación (src/lib/nav-app.ts → RUTAS_APP) no se pinta: allí manda el
 * AppShell de cada sección.
 *
 * - Mide 56 px (var(--nav) en site.css) en todos los anchos y reserva ese alto
 *   con un separador, así la portada cuadra su primer pliegue con --nav.
 * - Sobre arena arriba; al bajar aparece el cristal. El backdrop-filter va en
 *   un PSEUDO-ELEMENTO (.hm-nav::before), nunca en la barra: un backdrop-filter
 *   en un ancestro convierte a sus hijos `fixed` (el cajón) en prisioneros.
 * - Por debajo de 1024 px: hamburguesa y cajón a pantalla completa en tinta con
 *   enlaces grandes. Foco atrapado, Escape cierra, el scroll de fondo se
 *   bloquea y navegar lo cierra.
 * - Sin sesión: «Iniciar sesión» (fantasma) + «Registra tu empresa» (naranja
 *   con texto tinta). Con sesión: «Ir a mi panel».
 */
export default function PublicNav() {
  const pathname = usePathname();
  // En la aplicación no hay barra pública (ni se pide la sesión desde aquí).
  if (esRutaApp(pathname)) return null;
  return <BarraPublica pathname={pathname ?? '/'} />;
}

function BarraPublica({ pathname }: { pathname: string }) {
  const { usuario } = useSesion();
  const [abierto, setAbierto] = useState(false);
  const [conScroll, setConScroll] = useState(false);
  const barraRef = useRef<HTMLElement>(null);
  const botonRef = useRef<HTMLButtonElement>(null);

  // El cristal aparece en cuanto la página se desliza bajo la barra.
  useEffect(() => {
    let raf = 0;
    const medir = () => {
      raf = 0;
      setConScroll(window.scrollY > 8);
    };
    const alDesplazar = () => {
      if (!raf) raf = requestAnimationFrame(medir);
    };
    medir();
    window.addEventListener('scroll', alDesplazar, { passive: true });
    return () => {
      window.removeEventListener('scroll', alDesplazar);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);

  // Navegar (logo, atrás/adelante, un enlace del cajón) cierra el cajón.
  useEffect(() => {
    setAbierto(false);
  }, [pathname]);

  // A 1024 px o más el cajón no existe: si se ensancha la ventana, se cierra.
  useEffect(() => {
    if (!abierto || typeof window.matchMedia !== 'function') return;
    const mq = window.matchMedia('(min-width: 1024px)');
    const alCambiar = () => mq.matches && setAbierto(false);
    mq.addEventListener?.('change', alCambiar);
    return () => mq.removeEventListener?.('change', alCambiar);
  }, [abierto]);

  useFocoAtrapado(barraRef, abierto, {
    alEscape: () => setAbierto(false),
    focoInicial: botonRef,
  });
  useBloqueoScroll(abierto);

  const panel = usuario ? inicioDeRol(usuario.role) : null;

  return (
    <>
      <header
        ref={barraRef}
        className="hm-nav"
        data-scroll={conScroll || undefined}
        data-abierto={abierto || undefined}
      >
        {/* Con el cajón abierto, el DIÁLOGO es este marco: barra + cajón. Así el
            botón que lo cierra (la X de la barra) queda dentro del diálogo; con el
            aria-modal sólo en el cajón, un lector de pantalla en móvil (VoiceOver
            no tiene Escape) no podía llegar a la X. */}
        <div
          className="hm-nav__marco"
          role={abierto ? 'dialog' : undefined}
          aria-modal={abierto || undefined}
          aria-label={abierto ? 'Menú' : undefined}
        >
          <nav aria-label="Principal" className="hm-nav__barra">
            <Link href="/" className="hm-nav__logo" aria-label="INAKAT, inicio">
              <Image src={logo} alt="" priority sizes="128px" />
            </Link>

            <ul className="hm-nav__enlaces hidden lg:flex">
              {ENLACES_PUBLICOS.map((enlace) => {
                const actual = esEnlaceActual(enlace.href, pathname);
                return (
                  <li key={enlace.href}>
                    <Link
                      href={enlace.href}
                      className="hm-nav__enlace whitespace-nowrap"
                      aria-current={actual ? 'page' : undefined}
                    >
                      {enlace.etiqueta}
                    </Link>
                  </li>
                );
              })}
            </ul>

            <div className="hm-nav__acciones hidden lg:flex">
              {panel ? (
                <Link href={panel} className="hm-nav__cta hm-nav__cta--naranja whitespace-nowrap">
                  Ir a mi panel
                  <ArrowRight aria-hidden="true" />
                </Link>
              ) : (
                <>
                  <Link href="/login" className="hm-nav__cta hm-nav__cta--fantasma whitespace-nowrap">
                    Iniciar sesión
                  </Link>
                  <Link href={CTA_REGISTRO_EMPRESA.href} className="hm-nav__cta hm-nav__cta--naranja whitespace-nowrap">
                    {CTA_REGISTRO_EMPRESA.etiqueta}
                  </Link>
                </>
              )}
            </div>

            <button
              ref={botonRef}
              type="button"
              onClick={() => setAbierto((a) => !a)}
              className="hm-nav__boton inline-flex lg:hidden"
              aria-label={abierto ? 'Cerrar menú' : 'Abrir menú'}
              aria-expanded={abierto}
              aria-controls="menu-movil"
            >
              {abierto ? <X aria-hidden="true" /> : <Menu aria-hidden="true" />}
            </button>
          </nav>

          {abierto && (
            <div id="menu-movil" className="hm-cajon lg:hidden">
              <span className="hm-cajon__arco" aria-hidden="true" />
              <span className="hm-cajon__arco hm-cajon__arco--b" aria-hidden="true" />
              <ul className="hm-cajon__enlaces">
                {ENLACES_PUBLICOS.map((enlace, i) => {
                  const actual = esEnlaceActual(enlace.href, pathname);
                  return (
                    <li key={enlace.href} style={{ '--i': i } as CSSProperties}>
                      <Link
                        href={enlace.href}
                        className="hm-cajon__enlace"
                        aria-current={actual ? 'page' : undefined}
                        onClick={() => setAbierto(false)}
                      >
                        <span className="hm-cajon__n" aria-hidden="true">
                          {String(i + 1).padStart(2, '0')}
                        </span>
                        {enlace.etiqueta}
                      </Link>
                    </li>
                  );
                })}
              </ul>

              <div className="hm-cajon__pie">
                <div className="hm-cajon__ctas">
                  {panel ? (
                    <Link href={panel} className="hm-btn hm-btn--orange" onClick={() => setAbierto(false)}>
                      Ir a mi panel
                      <ArrowRight aria-hidden="true" />
                    </Link>
                  ) : (
                    <>
                      <Link
                        href={CTA_REGISTRO_EMPRESA.href}
                        className="hm-btn hm-btn--orange"
                        onClick={() => setAbierto(false)}
                      >
                        {CTA_REGISTRO_EMPRESA.etiqueta}
                        <ArrowRight aria-hidden="true" />
                      </Link>
                      <Link href="/login" className="hm-btn hm-btn--ghost" onClick={() => setAbierto(false)}>
                        Iniciar sesión
                      </Link>
                    </>
                  )}
                </div>
                <ul className="hm-cajon__contacto">
                  <li>
                    <a href={`mailto:${CONTACTO.email}`}>
                      <Mail aria-hidden="true" />
                      {CONTACTO.email}
                    </a>
                  </li>
                  <li>
                    <a href={CONTACTO.telefonoHref}>
                      <Phone aria-hidden="true" />
                      {CONTACTO.telefono}
                    </a>
                  </li>
                </ul>
              </div>
            </div>
          )}
        </div>
      </header>
      {/* Reserva el alto de la barra fija (var(--nav)): sustituye al pt-14 del body. */}
      <div className="hm-nav-hueco" aria-hidden="true" />
    </>
  );
}
