// RUTA: src/lib/nav-publica.ts
//
// Enlaces del registro PÚBLICO: la barra (PublicNav), su cajón móvil y el pie
// (Footer) se pintan desde aquí para no desincronizarse.

export interface EnlacePublico {
  etiqueta: string;
  href: string;
}

export const ENLACES_PUBLICOS: EnlacePublico[] = [
  { etiqueta: 'Inicio', href: '/' },
  { etiqueta: 'Sobre nosotros', href: '/about' },
  { etiqueta: 'Empresas', href: '/companies' },
  { etiqueta: 'Talentos', href: '/talents' },
  { etiqueta: 'Contacto', href: '/contact' },
];

/**
 * CTA principal de la barra. Lleva al formulario de /companies, que vive bajo
 * el ancla #register: quien rehaga /companies debe conservar ese id.
 */
export const CTA_REGISTRO_EMPRESA: EnlacePublico = {
  etiqueta: 'Registra tu empresa',
  href: '/companies#register',
};

export const CONTACTO = {
  email: 'info@inakat.com',
  telefono: '+52 811 631 2490',
  telefonoHref: 'tel:+528116312490',
  whatsapp: 'https://wa.me/528116312490',
  instagram: 'https://www.instagram.com/inakatmx/',
};

/** ¿Es este enlace la página actual? «Inicio» sólo en «/». */
export function esEnlaceActual(href: string, pathname: string | null | undefined): boolean {
  if (!pathname) return false;
  if (href === '/') return pathname === '/';
  return pathname === href || pathname.startsWith(`${href}/`);
}
