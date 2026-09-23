// RUTA: src/app/manifest.ts
//
// Sustituye a public/manifest.json, que seguía siendo el de create-react-app
// ("Landing Page", negro/blanco) y además no estaba enlazado desde ningún sitio.
import { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'INAKAT - Talento Evaluado por Expertos Reales',
    short_name: 'INAKAT',
    description:
      'Contrata talento calificado con evaluación dual: psicólogos expertos + especialistas técnicos.',
    start_url: '/',
    display: 'standalone',
    lang: 'es-MX',
    theme_color: '#2b5d62',
    background_color: '#e8e7d4',
    icons: [
      {
        src: '/favicon.ico',
        sizes: '64x64 32x32 24x24 16x16',
        type: 'image/x-icon',
      },
      {
        src: '/logo192.png',
        sizes: '192x192',
        type: 'image/png',
      },
      {
        src: '/logo512.png',
        sizes: '512x512',
        type: 'image/png',
      },
    ],
  };
}
