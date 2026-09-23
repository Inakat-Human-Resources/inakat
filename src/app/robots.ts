// RUTA: src/app/robots.ts
//
// Sustituye a public/robots.txt para derivar el dominio de la misma variable de
// entorno que el sitemap (antes el dominio iba a mano y los previews anunciaban
// URLs de producción).
import { MetadataRoute } from 'next';
import { absoluteUrl } from '@/lib/site-url';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: [
        '/admin/',
        '/api/',
        '/company/',
        '/recruiter/',
        '/specialist/',
        '/candidate/',
        '/vendor/',
        '/credits/',
        '/profile',
        '/login',
        '/register',
        '/unauthorized',
        '/create-job',
        '/my-applications',
        '/applications',
        // Rutas con token o privadas que antes quedaban rastreables
        '/forgot-password',
        '/reset-password',
        '/notifications',
      ],
    },
    sitemap: absoluteUrl('/sitemap.xml'),
  };
}
