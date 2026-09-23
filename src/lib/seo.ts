// RUTA: src/lib/seo.ts
//
// Campos de Open Graph comunes a todo el sitio. Next NO fusiona openGraph entre
// segmentos: si una página declara su propio openGraph, sustituye por completo
// al del layout raíz y se pierden siteName, locale, type y la imagen. Por eso
// cada página que defina openGraph debe partir de esta base:
//
//   openGraph: { ...BASE_OPEN_GRAPH, title: '...', description: '...', url: '/ruta' }
import type { Metadata } from 'next';

type OpenGraph = NonNullable<Metadata['openGraph']>;

export const BASE_OPEN_GRAPH = {
  type: 'website',
  locale: 'es_MX',
  siteName: 'INAKAT',
  // TODO(diseño): sustituir por una imagen 1200x630 de marca (og.png).
  images: [
    {
      url: '/logo512.png',
      width: 512,
      height: 512,
      alt: 'INAKAT',
    },
  ],
} satisfies OpenGraph;
