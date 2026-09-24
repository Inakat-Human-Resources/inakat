import type { Metadata, Viewport } from "next";
import { Outfit, DM_Sans, Instrument_Serif } from "next/font/google";
import "./globals.css";
// Registro público compartido (tokens de marca en :root + primitivas hm-).
import "./site.css";
// Registro de aplicación (prefijo ap-): lo que Tailwind no resuelve bien.
import "./app.css";
import PublicNav from "@/components/commons/PublicNav";
import { SITE_URL } from "@/lib/site-url";
import { BASE_OPEN_GRAPH } from "@/lib/seo";

const outfit = Outfit({
  subsets: ["latin"],
  variable: "--font-outfit",
  display: "swap",
});

const dmSans = DM_Sans({
  subsets: ["latin"],
  variable: "--font-dm-sans",
  display: "swap",
});

// La voz «humana» del sitio: serif itálica frente a la sans geométrica del
// logotipo (evaluación dual → tipografía dual). Vivía sólo en la portada; ahora
// la usan también las cabeceras de página y los estados vacíos de la aplicación.
const serif = Instrument_Serif({
  subsets: ["latin"],
  weight: "400",
  style: ["normal", "italic"],
  variable: "--font-serif",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    // Cada página exporta su propio title; el resto hereda el default.
    default: "INAKAT - Talento Evaluado por Expertos Reales",
    template: "%s | INAKAT",
  },
  description:
    "Contrata talento calificado con evaluación dual: psicólogos expertos + especialistas técnicos. IA como apoyo, personas que deciden. Presencia en toda la República Mexicana.",
  // OJO: canonical y og:url se heredan. Toda página indexable debe declarar
  // los suyos (alternates.canonical y openGraph.url) o quedaría canonizada a "/".
  alternates: {
    canonical: "/",
  },
  icons: {
    icon: "/favicon.ico",
    apple: "/logo192.png",
  },
  openGraph: {
    ...BASE_OPEN_GRAPH,
    title: "INAKAT - Talento Evaluado por Expertos Reales",
    description:
      "Contrata talento calificado con evaluación dual: psicólogos expertos + especialistas técnicos. Presencia en toda la República Mexicana.",
    url: "/",
  },
  // Sin title/description propios: así cada página cae a su og:title en vez de
  // repetir el título de la home en la tarjeta de X/Twitter.
  twitter: {
    card: "summary",
    images: ["/logo512.png"],
  },
};

export const viewport: Viewport = {
  themeColor: "#2b5d62",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    // suppressHydrationWarning: el script de abajo añade la clase "js" al <html>
    // antes de hidratar; sin esto React avisa de un className distinto.
    <html
      lang="es"
      className={`${outfit.variable} ${dmSans.variable} ${serif.variable}`}
      suppressHydrationWarning
    >
      {/* Sin pt-14: en las páginas públicas el alto de la barra lo reserva
          PublicNav (var(--nav)); en la aplicación no hay barra pública y el
          AppShell de cada sección pone su propia cabecera. */}
      <body className="font-body antialiased">
        {/* Marca que hay JavaScript ANTES de pintar: sólo entonces .animate-on-scroll
            esconde el contenido. Sin JS (o con los chunks bloqueados) todo se ve. */}
        <script
          dangerouslySetInnerHTML={{
            __html: "document.documentElement.classList.add('js');",
          }}
        />
        {/* Sólo en rutas públicas: en las de la aplicación (src/lib/nav-app.ts,
            RUTAS_APP) devuelve null y manda el AppShell del layout de sección. */}
        <PublicNav />
        {children}
      </body>
    </html>
  );
}
