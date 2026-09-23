// RUTA: src/app/sitemap.ts
import { MetadataRoute } from 'next';
import { absoluteUrl } from '@/lib/site-url';

/**
 * Fechas reales de última edición de cada página. Se actualizan a mano cuando
 * el contenido cambia: usar new Date() marcaba todas las URLs como modificadas
 * en cada deploy, señal que Google acaba ignorando por poco fiable.
 */
const rutas: Array<{
  path: string;
  lastModified: string;
  changeFrequency: MetadataRoute.Sitemap[number]['changeFrequency'];
  priority: number;
}> = [
  { path: '/', lastModified: '2026-09-15', changeFrequency: 'weekly', priority: 1 },
  { path: '/about', lastModified: '2026-09-15', changeFrequency: 'monthly', priority: 0.8 },
  { path: '/companies', lastModified: '2026-09-15', changeFrequency: 'monthly', priority: 0.8 },
  { path: '/talents', lastModified: '2026-09-15', changeFrequency: 'daily', priority: 0.9 },
  { path: '/contact', lastModified: '2026-09-15', changeFrequency: 'monthly', priority: 0.7 },
  // /terms y /privacy quedan FUERA del sitemap mientras sean páginas
  // provisionales ("en construcción"): además se sirven con robots noindex.
  // Volver a añadirlas cuando exista el texto legal definitivo.
];

export default function sitemap(): MetadataRoute.Sitemap {
  return rutas.map(({ path, lastModified, changeFrequency, priority }) => ({
    url: absoluteUrl(path),
    lastModified: new Date(`${lastModified}T00:00:00Z`),
    changeFrequency,
    priority,
  }));
}
