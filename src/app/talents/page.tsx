// RUTA: src/app/talents/page.tsx
//
// Bolsa de trabajo pública, registro PÚBLICO «Arco» (patrón de la portada):
// <main className="hm"> con sus suelos — arena (portada) · tinta (buscador y
// resultados) · naranja (cierre) — y, después de </main>, el pie y el único JS
// de movimiento (SiteMotion). Estilos propios en ./talents.css (prefijo tl-).
import "./talents.css";
import HeroTalentSection from "@/components/sections/talents/HeroTalentSection";
import SearchPositionsSection from "@/components/sections/talents/SearchPositionsSection";
import CierreTalentSection from "@/components/sections/talents/CierreTalentSection";
import Footer from "@/components/commons/Footer";
import SiteMotion from "@/components/ui/SiteMotion";
import type { Metadata } from "next";
import { BASE_OPEN_GRAPH } from "@/lib/seo";

export const metadata: Metadata = {
  title: "Vacantes para candidatos",
  description:
    "Encuentra vacantes en toda la República Mexicana y postúlate. En INAKAT te evalúan personas expertas, no un algoritmo.",
  alternates: { canonical: "/talents" },
  openGraph: {
    ...BASE_OPEN_GRAPH,
    title: "Vacantes para candidatos | INAKAT",
    description:
      "Encuentra vacantes en toda la República Mexicana y postúlate. Te evalúan personas expertas, no un algoritmo.",
    url: "/talents",
  },
};

export default function TalentsPage() {
  return (
    <>
      <main className="hm">
        <div className="hm-progress" aria-hidden="true" />
        <HeroTalentSection />
        {/* id="vacantes" (el ancla de «Ver vacantes») vive en el buscador. */}
        <SearchPositionsSection />
        <CierreTalentSection />
      </main>
      <Footer />
      <SiteMotion />
    </>
  );
}
