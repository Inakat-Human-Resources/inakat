import type { NextConfig } from "next";
import { assertServerEnv } from "./src/lib/env";

// PAGO-017: el build de PRODUCCIÓN falla si falta una variable obligatoria
// (MERCADOPAGO_WEBHOOK_SECRET, NEXT_PUBLIC_APP_URL, SMTP_PASS...) en vez de
// degradar en silencio. Sólo en el deploy de producción de Vercel: `next build`
// siempre corre con NODE_ENV=production, y el CI y los builds locales usan
// valores de prueba incompletos a propósito. Fuera de ahí no se comprueba aquí
// (los handlers usan requireEnv y responden 503 con un mensaje claro).
//
// OJO: hoy es una ADVERTENCIA, no un error. Al activarlo se vio que en Vercel
// faltan MERCADOPAGO_WEBHOOK_SECRET, SMTP_USER y SMTP_PASS — o sea, que en
// producción no salen correos y el webhook de pagos responde 500. Tumbar el
// deploy por eso bloquearía también todos los arreglos. Cuando esas variables
// estén dadas de alta, cambiar a `STRICT_ENV_CHECK=true` para que vuelva a fallar.
if (process.env.VERCEL_ENV === "production") {
  try {
    assertServerEnv();
  } catch (error) {
    if (process.env.STRICT_ENV_CHECK === "true") throw error;
    console.warn(
      "\n⚠️  ENTORNO DE PRODUCCIÓN INCOMPLETO — el deploy sigue, pero:\n",
      error instanceof Error ? error.message : error,
      "\n"
    );
  }
}

// SEGURIDAD (INFRA-014): Content-Security-Policy.
//
// Orígenes externos reales de la app (revisados en el código):
//  - SDK de Mercado Pago (sólo /credits/purchase): sdk.mercadopago.com, sus
//    estáticos en *.mlstatic.com, la API y los iframes de los Bricks en
//    *.mercadopago.com / *.mercadolibre.com.
//  - Google Maps (useLoadScript en 4 formularios): maps.googleapis.com, teselas
//    e iconos en maps.gstatic.com / *.googleapis.com / *.ggpht.com, y la hoja de
//    estilos + fuente Roboto que inyecta el propio Maps.
//  - Imágenes y documentos de Vercel Blob.
// Las fuentes de la app son next/font (autoalojadas). El layout tiene un
// <script> inline mínimo, así que script-src necesita 'unsafe-inline' mientras
// no haya nonce por middleware.
//
// Se envía en modo Report-Only: el navegador AVISA en consola de lo que
// bloquearía, pero no bloquea nada. Pasar a `Content-Security-Policy` (enforce)
// es una acción manual: primero hay que recorrer en staging el checkout de
// Mercado Pago y los formularios con mapa sin ver violaciones.
const isDev = process.env.NODE_ENV !== "production";

const contentSecurityPolicy = [
  "default-src 'self'",
  // 'unsafe-eval' sólo en desarrollo: lo necesita el refresco en caliente de Next.
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""} https://sdk.mercadopago.com https://*.mercadopago.com https://*.mlstatic.com https://maps.googleapis.com`,
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' data: https://fonts.gstatic.com",
  "img-src 'self' data: blob: https://*.public.blob.vercel-storage.com https://maps.gstatic.com https://*.googleapis.com https://*.ggpht.com https://*.mlstatic.com https://*.mercadopago.com https://*.mercadolibre.com",
  "connect-src 'self' https://*.public.blob.vercel-storage.com https://api.mercadopago.com https://*.mercadopago.com https://*.mercadolibre.com https://*.mlstatic.com https://maps.googleapis.com",
  "frame-src 'self' https://*.mercadopago.com https://*.mercadolibre.com",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'self'",
].join("; ");

// SEGURIDAD (#86): cabeceras HTTP de seguridad. Antes no se enviaba ninguna.
const securityHeaders = [
  { key: "Content-Security-Policy-Report-Only", value: contentSecurityPolicy },
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(self), browsing-topics=()",
  },
  { key: "X-DNS-Prefetch-Control", value: "on" },
];

const nextConfig: NextConfig = {
  // No anunciar "X-Powered-By: Next.js" (INFRA-014): es huella gratis para quien
  // busca versiones vulnerables.
  poweredByHeader: false,
  images: {
    // INFRA-032: con el comodín, /_next/image optimiza imágenes de los stores
    // de CUALQUIER cliente de Vercel. BLOB_STORE_HOSTNAME fija el host exacto
    // del nuestro (p. ej. abc123.public.blob.vercel-storage.com); sin ella se
    // mantiene el comodín para no romper las imágenes.
    remotePatterns: [
      {
        protocol: 'https',
        hostname: process.env.BLOB_STORE_HOSTNAME || '*.public.blob.vercel-storage.com',
      },
    ],
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
