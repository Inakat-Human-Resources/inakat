// RUTA: src/components/ui/AppShell.tsx
'use client';

import { createContext, useContext, useEffect, useRef, useState, type ReactNode, type RefObject } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Coins, Globe, LogIn, LogOut, Menu, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  NAV_POR_ROL,
  etiquetaRol,
  inicioDeRol,
  itemActivo,
  rolDeNavegacion,
  type GrupoNav,
  type RolApp,
} from '@/lib/nav-app';
import { useSesion, type Sesion } from '@/hooks/useSesion';
import { useFocoAtrapado } from '@/hooks/useFocoAtrapado';
import { useBloqueoScroll } from '@/hooks/useBloqueoScroll';
import NotificationBell from '@/components/shared/NotificationBell';
import MarcaInakat, { SimboloInakat } from './MarcaInakat';
import Avatar from './Avatar';
import IconButton from './IconButton';
import { AvisosProvider } from './Toast';

// ---------------------------------------------------------------------------
// Sesión compartida con las páginas
// ---------------------------------------------------------------------------
const SesionContext = createContext<Sesion | null>(null);

/**
 * La sesión que ya leyó el AppShell (usuario, rol, créditos). Úsala en vez de
 * volver a pedir /api/auth/me sólo para pintar el nombre o el saldo. Tras una
 * acción que cambie créditos o nombre, llama a notifyAuthChanged() de
 * '@/lib/auth-events' (o a `refrescar()`).
 */
export function useSesionApp(): Sesion | null {
  return useContext(SesionContext);
}

export interface AppShellProps {
  children: ReactNode;
  /** Fuerza el rol de la navegación (banco de pruebas: /diseno/vista?rol=…). */
  rolForzado?: RolApp;
  /** Ruta que se usa para marcar el ítem activo (por defecto, la real). */
  rutaActual?: string;
  /** Reescribe los enlaces de la navegación (el banco los lleva a /diseno/vista/…). */
  construirHref?: (href: string) => string;
}

/**
 * Armazón del registro de APLICACIÓN. Lo montan los layout.tsx de cada sección
 * (admin, company, recruiter, specialist, vendor, profile, my-applications,
 * candidate, notifications, credits, create-job, applications): las páginas
 * NO lo montan y NO pintan su propio <main> (ya lo pone el armazón).
 *
 * - Barra lateral de 248 px en tinta: la marca (la misma figura del sitio
 *   público, en negativo: MarcaInakat), navegación por rol (src/lib/nav-app.ts)
 *   con el ítem activo marcado por una barra lima, y la tarjeta del usuario con
 *   su rol y «Cerrar sesión».
 * - Cabecera fija de 56 px (h-14) sobre el contenido: sección actual, saldo de
 *   créditos (empresa) y campanita. Lo que una página fije debajo va en
 *   `sticky top-14` (= var(--ap-top)).
 * - Contenido sobre papel, UN solo ancho máximo (max-w-app, 1400 px) para
 *   todas las páginas: así el borde derecho no salta al navegar. Una página
 *   de lectura (notificaciones) NO se envuelve entera en otro max-w: deja la
 *   cabecera (PageHeader) a todo el ancho y estrecha sólo su lista por dentro
 *   (max-w-lectura).
 * - Móvil (< 1024 px): barra superior + cajón con la misma navegación (foco
 *   atrapado, Escape cierra).
 */
export default function AppShell({ children, rolForzado, rutaActual, construirHref }: AppShellProps) {
  const pathname = usePathname();
  const sesion = useSesion();
  const [cajon, setCajon] = useState(false);
  const botonCajonRef = useRef<HTMLButtonElement>(null);

  const rol = rolForzado ?? rolDeNavegacion(sesion.usuario?.role);
  const grupos = rol ? NAV_POR_ROL[rol] : [];
  const ruta = rutaActual ?? pathname ?? '';
  const activo = itemActivo(grupos, ruta);
  const href = construirHref ?? ((h: string) => h);

  // Navegar cierra el cajón.
  useEffect(() => {
    setCajon(false);
  }, [pathname]);

  const lateral = (
    <Lateral
      grupos={grupos}
      ruta={ruta}
      rol={rol}
      sesion={sesion}
      href={href}
      alNavegar={() => setCajon(false)}
    />
  );

  return (
    <SesionContext.Provider value={sesion}>
      <AvisosProvider>
        <div className="ap flex min-h-screen bg-paper text-ink">
          <a href="#contenido" className="ap-saltar">
            Saltar al contenido
          </a>

          {/* Escritorio: barra lateral fija */}
          <aside
            aria-label="Navegación del panel"
            className="sticky top-0 hidden h-screen w-[var(--ap-lateral)] flex-none lg:block"
          >
            {lateral}
          </aside>

          {/* Móvil: cajón */}
          {cajon && (
            <CajonMovil alCerrar={() => setCajon(false)} botonRef={botonCajonRef}>
              {lateral}
            </CajonMovil>
          )}

          <div className="flex min-w-0 flex-1 flex-col">
            <header className="sticky top-0 z-30 flex h-14 flex-none items-center gap-3 border-b border-line bg-paper/90 px-4 backdrop-blur supports-[backdrop-filter]:bg-paper/75 sm:px-6 lg:px-8">
              <button
                ref={botonCajonRef}
                type="button"
                onClick={() => setCajon(true)}
                aria-label="Abrir menú"
                aria-expanded={cajon}
                aria-controls="menu-app"
                className="-ml-2 inline-flex h-10 w-10 items-center justify-center rounded-lg text-ink transition-colors duration-150 hover:bg-ink/[0.06] lg:hidden"
              >
                <Menu className="h-5 w-5" aria-hidden="true" />
              </button>
              <Link
                href={href(inicioDeRol(rol))}
                className="flex items-center rounded lg:hidden"
                aria-label="INAKAT, ir a mi panel"
              >
                <SimboloInakat className="h-7" />
              </Link>

              <p className="min-w-0 flex-1 truncate text-sm text-ink-muted">
                {activo ? (
                  <>
                    {activo.grupo.titulo && (
                      <span className="hidden sm:inline">
                        {activo.grupo.titulo}
                        <span className="mx-1.5 text-line-strong" aria-hidden="true">
                          /
                        </span>
                      </span>
                    )}
                    <span className="font-medium text-ink">{activo.item.etiqueta}</span>
                  </>
                ) : (
                  <span className="font-medium text-ink">{etiquetaRol(rol) || 'Panel'}</span>
                )}
              </p>

              {sesion.usuario?.role === 'company' && (
                <Link
                  href={href('/credits/purchase')}
                  className="inline-flex h-9 items-center gap-2 rounded-lg border border-line bg-white px-2.5 text-[13px] text-ink shadow-ap-1 transition-colors duration-150 hover:border-line-strong"
                  title="Comprar créditos"
                >
                  <Coins className="h-4 w-4 text-orange-dark" aria-hidden="true" />
                  <span className="font-display font-semibold tabular-nums">{sesion.usuario.credits ?? 0}</span>
                  <span className="hidden text-ink-muted sm:inline">créditos</span>
                  <span className="sr-only sm:hidden">créditos</span>
                </Link>
              )}
              {sesion.usuario && <NotificationBell />}
            </header>

            <main id="contenido" tabIndex={-1} className="flex-1 outline-none">
              <div className="mx-auto w-full max-w-app px-4 py-6 sm:px-6 lg:px-8 lg:py-8">{children}</div>
            </main>
          </div>
        </div>
      </AvisosProvider>
    </SesionContext.Provider>
  );
}

// ---------------------------------------------------------------------------
// Barra lateral (la misma en escritorio y en el cajón)
// ---------------------------------------------------------------------------
function Lateral({
  grupos,
  ruta,
  rol,
  sesion,
  href,
  alNavegar,
}: {
  grupos: GrupoNav[];
  ruta: string;
  rol: RolApp | null;
  sesion: Sesion;
  href: (h: string) => string;
  alNavegar: () => void;
}) {
  const activo = itemActivo(grupos, ruta);
  const { usuario } = sesion;

  return (
    <div className="ap-sobre-tinta flex h-full flex-col bg-ink text-white">
      <div className="flex h-14 flex-none items-center border-b border-white/10 px-5">
        <Link
          href={href(inicioDeRol(rol))}
          onClick={alNavegar}
          className="flex items-center rounded-md"
          aria-label="INAKAT, ir a mi panel"
        >
          <MarcaInakat />
        </Link>
      </div>

      <nav aria-label="Secciones" className="flex-1 overflow-y-auto overscroll-contain px-3 pb-3 pt-3">
        {grupos.length === 0 ? (
          sesion.cargando ? (
            <div className="space-y-2 px-3 pt-2" aria-hidden="true">
              {[0, 1, 2, 3, 4].map((i) => (
                <span key={i} className="block h-8 rounded-md bg-white/[0.06]" />
              ))}
            </div>
          ) : !usuario ? (
            // Sin sesión (caducó con la pestaña abierta): se dice, en vez de
            // dejar el esqueleto para siempre. El acceso está abajo.
            <p className="px-3 pt-2 text-[13px] leading-relaxed text-sidebar-text">
              Tu sesión terminó. Vuelve a entrar para ver tu panel.
            </p>
          ) : null
        ) : (
          grupos.map((grupo, gi) => (
            <div key={grupo.titulo ?? `grupo-${gi}`} className={gi > 0 ? 'mt-4' : undefined}>
              {grupo.titulo && (
                <p className="px-3 pb-1.5 font-display text-[11px] font-semibold uppercase tracking-[0.14em] text-sidebar-label">
                  {grupo.titulo}
                </p>
              )}
              <ul className="space-y-0.5">
                {grupo.items.map((item) => {
                  const esActivo = activo?.item === item;
                  const Icono = item.icono;
                  return (
                    <li key={item.href}>
                      <Link
                        href={href(item.href)}
                        onClick={alNavegar}
                        aria-current={esActivo ? 'page' : undefined}
                        className={cn(
                          'ap-nav-item flex h-8 items-center gap-3 rounded-lg px-3 text-[13.5px] font-medium transition-colors duration-150',
                          esActivo
                            ? 'bg-white/[0.08] text-white'
                            : 'text-sidebar-text hover:bg-ink-soft hover:text-white'
                        )}
                      >
                        <Icono
                          className={cn('h-[18px] w-[18px] flex-none', esActivo ? 'text-lime' : 'opacity-80')}
                          aria-hidden="true"
                        />
                        <span className="truncate">{item.etiqueta}</span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))
        )}
      </nav>

      <div className="flex-none border-t border-white/10 p-3">
        {/* El sitio público (Inicio, Empresas, Talentos…): el menú antiguo lo
            enlazaba también con la sesión abierta. */}
        <Link
          href="/"
          onClick={alNavegar}
          className="mb-1.5 flex h-8 items-center gap-3 rounded-lg px-3 text-[13px] font-medium text-sidebar-text transition-colors duration-150 hover:bg-ink-soft hover:text-white"
        >
          <Globe className="h-[18px] w-[18px] flex-none opacity-80" aria-hidden="true" />
          <span className="truncate">Ir al sitio público</span>
        </Link>
        {usuario ? (
          <div className="flex items-center gap-3 rounded-lg px-2 py-1.5">
            <Avatar nombre={usuario.nombre} email={usuario.email} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-[13px] font-semibold text-white" title={usuario.email}>
                {usuario.nombre || usuario.email}
              </p>
              <p className="truncate text-xs text-sidebar-text">{etiquetaRol(usuario.role)}</p>
            </div>
            <IconButton
              etiqueta="Cerrar sesión"
              icono={LogOut}
              variante="sobre-tinta"
              tamano="sm"
              onClick={sesion.cerrarSesion}
              cargando={sesion.cerrando}
            />
          </div>
        ) : sesion.cargando ? (
          <div className="flex items-center gap-3 px-2 py-1.5" aria-hidden="true">
            <span className="h-9 w-9 rounded-full bg-white/[0.08]" />
            <span className="h-3 flex-1 rounded bg-white/[0.08]" />
          </div>
        ) : (
          // Naranja con texto tinta: 4.87:1.
          <Link
            href="/login"
            onClick={alNavegar}
            className="flex h-10 items-center justify-center gap-2 rounded-lg bg-orange px-3 font-display text-sm font-semibold text-ink transition-colors duration-150 hover:bg-orange-hover"
          >
            <LogIn className="h-4 w-4" aria-hidden="true" />
            Iniciar sesión
          </Link>
        )}
        {sesion.errorCierre && (
          <p role="alert" className="mx-2 mt-2 rounded-md bg-danger-tint px-2.5 py-1.5 text-xs font-medium text-danger-dark">
            {sesion.errorCierre}
          </p>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Cajón móvil
// ---------------------------------------------------------------------------
function CajonMovil({
  children,
  alCerrar,
  botonRef,
}: {
  children: ReactNode;
  alCerrar: () => void;
  botonRef: RefObject<HTMLButtonElement | null>;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  useFocoAtrapado(panelRef, true, { alEscape: alCerrar, devolverFoco: false });
  useBloqueoScroll(true);

  // Al cerrar, el foco vuelve al botón de la hamburguesa.
  useEffect(() => {
    const boton = botonRef.current;
    return () => boton?.focus({ preventScroll: true });
  }, [botonRef]);

  return (
    <div
      className="ap-fondo fixed inset-0 z-50 bg-ink/55 lg:hidden"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) alCerrar();
      }}
    >
      <div
        ref={panelRef}
        id="menu-app"
        role="dialog"
        aria-modal="true"
        aria-label="Menú del panel"
        className="ap-cajon--izquierda relative h-full w-[min(18rem,86vw)] shadow-ap-3"
      >
        {children}
        <button
          type="button"
          onClick={alCerrar}
          aria-label="Cerrar menú"
          className={cn(
            'absolute right-2 top-2 inline-flex h-10 w-10 items-center justify-center rounded-lg text-sidebar-text',
            'transition-colors duration-150 hover:bg-ink-soft hover:text-white focus-visible:outline-lime'
          )}
        >
          <X className="h-5 w-5" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
