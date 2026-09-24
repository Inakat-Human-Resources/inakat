// RUTA: src/lib/nav-app.ts
//
// Navegación del registro de APLICACIÓN (AppShell), por rol. Es la fuente única
// de «a dónde puede ir cada quien»: la barra lateral, el cajón móvil y el banco
// de pruebas (/diseno/vista) se pintan desde aquí.
//
// Contrato: contiene TODOS los enlaces que tenía el menú del Navbar antiguo
// (escritorio + móvil) para cada rol —incluido «Mensajes de contacto» del admin
// y «Panel Vendedor» del admin—. __tests__/qa/sistema-diseno.test.ts lo
// comprueba contra la lista de antes: si quitas uno, el test lo dice.
//
// Añadir una página de aplicación:
//   1. su enlace aquí, en el grupo del rol que la usa;
//   2. si cuelga de un prefijo nuevo, ese prefijo en RUTAS_APP;
//   3. su envoltorio en src/app/diseno/vista/<misma ruta>/page.tsx.

import type { LucideIcon } from 'lucide-react';
import {
  BadgeDollarSign,
  Bell,
  Building2,
  CalendarDays,
  ClipboardList,
  Coins,
  Gift,
  Inbox,
  LayoutDashboard,
  Mail,
  Package,
  PlusCircle,
  PlugZap,
  Search,
  Tags,
  UserCog,
  UserPlus,
  UserRound,
  Users,
  FileText,
} from 'lucide-react';

export type RolApp =
  | 'admin'
  | 'company'
  | 'candidate'
  | 'user'
  | 'recruiter'
  | 'specialist'
  | 'vendor';

export const ROLES_APP: RolApp[] = [
  'admin',
  'company',
  'candidate',
  'user',
  'recruiter',
  'specialist',
  'vendor',
];

export interface ItemNav {
  etiqueta: string;
  href: string;
  icono: LucideIcon;
  /** Otros prefijos que también marcan este ítem como activo (p. ej. el detalle de una vacante). */
  tambien?: string[];
}

export interface GrupoNav {
  /** Encabezado del grupo; sin título, el grupo va primero y sin rótulo. */
  titulo?: string;
  items: ItemNav[];
}

// Enlaces que comparten todos los roles al pie de su navegación.
const CUENTA: GrupoNav = {
  titulo: 'Cuenta',
  items: [
    { etiqueta: 'Mi perfil', href: '/profile', icono: UserRound },
    { etiqueta: 'Notificaciones', href: '/notifications', icono: Bell },
  ],
};

export const NAV_POR_ROL: Record<RolApp, GrupoNav[]> = {
  admin: [
    {
      // Sin título, como «Panel» de la empresa: la cabecera y el lateral dicen
      // lo mismo que el h1 de /admin («Vista general»). /applications (todas
      // las postulaciones) cuelga de aquí sin enlace propio en el menú: si lo
      // merece es decisión de INAKAT (BITACORA.md).
      items: [
        { etiqueta: 'Vista general', href: '/admin', icono: LayoutDashboard, tambien: ['/applications'] },
      ],
    },
    {
      titulo: 'Reclutamiento',
      items: [
        { etiqueta: 'Asignar equipo', href: '/admin/assignments', icono: ClipboardList },
        { etiqueta: 'Asignar candidatos', href: '/admin/assign-candidates', icono: UserPlus },
        { etiqueta: 'Entrevistas', href: '/admin/interviews', icono: CalendarDays },
        { etiqueta: 'Candidatos interesados', href: '/admin/direct-applications', icono: Inbox },
      ],
    },
    {
      titulo: 'Empresas y comercial',
      items: [
        { etiqueta: 'Solicitudes de empresas', href: '/admin/requests', icono: Building2 },
        { etiqueta: 'Vendedores', href: '/admin/vendors', icono: Gift },
        { etiqueta: 'Paquetes de créditos', href: '/admin/credit-packages', icono: Package },
        { etiqueta: 'Precios', href: '/admin/pricing', icono: BadgeDollarSign },
        { etiqueta: 'Panel vendedor', href: '/vendor/dashboard', icono: Coins },
      ],
    },
    {
      titulo: 'Sistema',
      items: [
        { etiqueta: 'Candidatos', href: '/admin/candidates', icono: Users },
        { etiqueta: 'Usuarios', href: '/admin/users', icono: UserCog },
        { etiqueta: 'Especialidades', href: '/admin/specialties', icono: Tags },
        { etiqueta: 'Mensajes de contacto', href: '/admin/contact-messages', icono: Mail },
      ],
    },
    CUENTA,
  ],
  company: [
    {
      items: [
        {
          etiqueta: 'Panel',
          href: '/company/dashboard',
          icono: LayoutDashboard,
          tambien: ['/company/jobs'],
        },
        { etiqueta: 'Publicar vacante', href: '/create-job', icono: PlusCircle },
        { etiqueta: 'Entrevistas', href: '/company/interviews', icono: CalendarDays },
      ],
    },
    {
      titulo: 'Empresa',
      items: [
        { etiqueta: 'Perfil de empresa', href: '/company/profile', icono: Building2 },
        { etiqueta: 'Comprar créditos', href: '/credits/purchase', icono: Coins },
        { etiqueta: 'Integraciones', href: '/company/integrations', icono: PlugZap },
      ],
    },
    CUENTA,
  ],
  candidate: [
    {
      items: [
        { etiqueta: 'Mis postulaciones', href: '/candidate/applications', icono: FileText },
        { etiqueta: 'Buscar vacantes', href: '/talents', icono: Search },
      ],
    },
    CUENTA,
  ],
  user: [
    {
      items: [
        { etiqueta: 'Mis postulaciones', href: '/my-applications', icono: FileText },
        { etiqueta: 'Buscar vacantes', href: '/talents', icono: Search },
      ],
    },
    CUENTA,
  ],
  recruiter: [
    {
      items: [
        {
          etiqueta: 'Panel',
          href: '/recruiter/dashboard',
          icono: LayoutDashboard,
          tambien: ['/recruiter/jobs'],
        },
      ],
    },
    CUENTA,
  ],
  specialist: [
    {
      items: [
        {
          etiqueta: 'Panel',
          href: '/specialist/dashboard',
          icono: LayoutDashboard,
          tambien: ['/specialist/jobs'],
        },
      ],
    },
    CUENTA,
  ],
  vendor: [
    {
      items: [{ etiqueta: 'Panel vendedor', href: '/vendor/dashboard', icono: Coins }],
    },
    CUENTA,
  ],
};

/**
 * Prefijos de ruta del registro de aplicación. En ellas el layout raíz NO pinta
 * la barra pública ni reserva su alto: cada sección monta el AppShell en su
 * layout.tsx. /diseno es el banco de pruebas (sólo en desarrollo).
 */
export const RUTAS_APP = [
  '/admin',
  '/company',
  '/recruiter',
  '/specialist',
  '/vendor',
  '/profile',
  '/my-applications',
  '/candidate',
  '/notifications',
  '/credits',
  '/create-job',
  '/applications',
  '/diseno',
];

/** ¿La ruta pertenece a la aplicación (AppShell) y no al sitio público? */
export function esRutaApp(pathname: string | null | undefined): boolean {
  if (!pathname) return false;
  return RUTAS_APP.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

/** Normaliza el rol que devuelve /api/auth/me a uno de la navegación. */
export function rolDeNavegacion(rol: string | null | undefined): RolApp | null {
  return ROLES_APP.includes(rol as RolApp) ? (rol as RolApp) : null;
}

/** A dónde lleva «Ir a mi panel» (el mismo destino que el login tras entrar). */
export function inicioDeRol(rol: string | null | undefined): string {
  switch (rol) {
    case 'admin':
      return '/admin';
    case 'company':
      return '/company/dashboard';
    case 'recruiter':
      return '/recruiter/dashboard';
    case 'specialist':
      return '/specialist/dashboard';
    case 'candidate':
      return '/candidate/applications';
    case 'user':
      return '/my-applications';
    case 'vendor':
      return '/vendor/dashboard';
    default:
      return '/';
  }
}

/** Nombre del panel de cada rol (lo que decía el menú antiguo). */
export function etiquetaInicioDeRol(rol: string | null | undefined): string {
  switch (rol) {
    case 'admin':
      return 'Panel Admin';
    case 'company':
      return 'Dashboard Empresa';
    case 'recruiter':
      return 'Dashboard Reclutador';
    case 'specialist':
      return 'Dashboard Especialista';
    case 'candidate':
      return 'Mis Postulaciones';
    case 'user':
      return 'Mis Postulaciones';
    case 'vendor':
      return 'Panel Vendedor';
    default:
      return 'Dashboard';
  }
}

/** Etiqueta legible del rol. */
export function etiquetaRol(rol: string | null | undefined): string {
  switch (rol) {
    case 'admin':
      return 'Administrador';
    case 'company':
      return 'Empresa';
    case 'recruiter':
      return 'Reclutador';
    case 'specialist':
      return 'Especialista';
    case 'candidate':
      return 'Candidato';
    case 'user':
      return 'Usuario';
    case 'vendor':
      return 'Vendedor';
    default:
      return '';
  }
}

/**
 * Iniciales del avatar. Normaliza espacios: "Ana " o "Juan  Carlos" daban
 * "AUNDEFINED" y un nombre de sólo espacios lanzaba TypeError en el render
 * (UI-005). Sin nombre, cae a las dos primeras letras del correo.
 */
export function iniciales(nombre?: string | null, email?: string | null): string {
  const partes = (nombre ?? '').trim().split(/\s+/).filter(Boolean);
  if (partes.length >= 2) return (partes[0][0] + partes[1][0]).toUpperCase();
  if (partes.length === 1) return partes[0].slice(0, 2).toUpperCase();
  return (email || '').slice(0, 2).toUpperCase() || 'U';
}

/**
 * Ítem activo para una ruta: gana el prefijo MÁS LARGO, así /admin/users marca
 * «Usuarios» y no «Vista general» (/admin). Devuelve también su grupo, para el
 * rótulo de la cabecera.
 */
export function itemActivo(
  grupos: GrupoNav[],
  pathname: string | null | undefined
): { grupo: GrupoNav; item: ItemNav } | null {
  if (!pathname) return null;
  let mejor: { grupo: GrupoNav; item: ItemNav; largo: number } | null = null;
  for (const grupo of grupos) {
    for (const item of grupo.items) {
      for (const prefijo of [item.href, ...(item.tambien ?? [])]) {
        const coincide = pathname === prefijo || pathname.startsWith(`${prefijo}/`);
        if (coincide && (!mejor || prefijo.length > mejor.largo)) {
          mejor = { grupo, item, largo: prefijo.length };
        }
      }
    }
  }
  return mejor ? { grupo: mejor.grupo, item: mejor.item } : null;
}
