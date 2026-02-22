import type { Metadata } from "next";
import { Outfit, DM_Sans } from "next/font/google";
import "./globals.css";
import Navbar from "@/components/commons/Navbar";

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

export const metadata: Metadata = {
  title: "INAKAT - Talento Evaluado por Expertos Reales",
  description:
    "Contrata talento calificado con evaluación dual: psicólogos expertos + especialistas técnicos. IA como apoyo, personas que deciden. Presencia en toda la República Mexicana.",
  openGraph: {
    title: "INAKAT - Talento Evaluado por Expertos Reales",
    description:
      "Contrata talento calificado con evaluación dual: psicólogos expertos + especialistas técnicos. Presencia en toda la República Mexicana.",
    type: "website",
    locale: "es_MX",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" className={`${outfit.variable} ${dmSans.variable}`}>
      <body className="font-body antialiased pt-14">
        <Navbar />
        {children}
      </body>
    </html>
  );
}
