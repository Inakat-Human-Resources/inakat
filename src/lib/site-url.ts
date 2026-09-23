// RUTA: src/lib/site-url.ts
//
// Única fuente de verdad de la URL pública del sitio. El resto del código ya usa
// NEXT_PUBLIC_APP_URL (MercadoPago, avisos a admin) y NEXT_PUBLIC_BASE_URL
// (correo de recuperación) para lo mismo; aquí se aceptan las dos y se
// normaliza sin barra final para poder concatenar rutas con seguridad.
export const SITE_URL: string = (
  process.env.NEXT_PUBLIC_APP_URL ||
  process.env.NEXT_PUBLIC_BASE_URL ||
  'https://inakat.com'
).replace(/\/+$/, '');

/** Devuelve la URL absoluta de una ruta interna ('/about' -> 'https://.../about'). */
export function absoluteUrl(path: string = '/'): string {
  const suffix = path.startsWith('/') ? path : `/${path}`;
  return suffix === '/' ? SITE_URL : `${SITE_URL}${suffix}`;
}
