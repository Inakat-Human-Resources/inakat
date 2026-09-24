// RUTA: src/app/diseno/layout.tsx
//
// Banco de pruebas del sistema de diseño: galería de componentes (/diseno) y
// las páginas reales de la aplicación con datos simulados (/diseno/vista/…).
// SÓLO EN DESARROLLO: en producción todo /diseno responde notFound() (pinta la
// página 404 con noindex), no está en el sitemap y robots.ts lo excluye.
//
// Medido con `next build && next start` (23/09/2026): la respuesta es la 404
// con <meta name="robots" content="noindex"> pero con estado HTTP 200. Es la
// limitación de Next con streaming: el loading.tsx raíz envuelve cada segmento
// en un Suspense, la cabecera sale antes de que este layout lance notFound(), y
// ya no se puede cambiar el estado (ni desde generateMetadata: se probó). Para
// un 404 duro haría falta cortar /diseno en src/middleware.ts en producción.
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

export const metadata: Metadata = {
  title: 'Sistema de diseño',
  robots: { index: false, follow: false },
};

export default function DisenoLayout({ children }: { children: React.ReactNode }) {
  if (process.env.NODE_ENV === 'production') notFound();
  return <>{children}</>;
}
