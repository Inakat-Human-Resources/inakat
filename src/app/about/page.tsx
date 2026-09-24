// RUTA: src/app/about/page.tsx
//
// «Sobre nosotros» en el registro PÚBLICO «Arco» (el patrón de la portada:
// <main className="hm">, suelos que alternan, máscaras y revelados ligados al
// scroll). Ritmo de suelos: arena → tinta → papel → lima → verde azulado →
// arena → tinta → naranja, y el pie en tinta. Estilos propios en about.css
// (prefijo ab-); las primitivas hm- vienen de site.css, que carga el layout.
// El pie va DESPUÉS de </main> (dentro no contaba como «información del sitio»
// para el lector de pantalla) y SiteMotion arma las entradas con la pestaña
// visible.
import "./about.css";
import AboutUsSection from "@/components/sections/aboutus/AboutUsSection";
import OurCompromiseSection from "@/components/sections/aboutus/OurCompromiseSection";
import ExpertsSection from "@/components/sections/aboutus/ExpertsSection";
import SelectionProcessSection from "@/components/sections/aboutus/SelectionProcessSection";
import AboutCloseSection from "@/components/sections/aboutus/AboutCloseSection";
import Footer from "@/components/commons/Footer";
import SiteMotion from "@/components/ui/SiteMotion";
import type { Metadata } from "next";
import { BASE_OPEN_GRAPH } from "@/lib/seo";

export const metadata: Metadata = {
  title: "Sobre nosotros",
  description:
    "Conoce a INAKAT: psicólogos organizacionales y especialistas técnicos que evalúan a cada candidato. Dos filtros humanos, cero decisiones automatizadas.",
  alternates: { canonical: "/about" },
  openGraph: {
    ...BASE_OPEN_GRAPH,
    title: "Sobre nosotros | INAKAT",
    description:
      "Psicólogos organizacionales y especialistas técnicos que evalúan a cada candidato. Dos filtros humanos, cero decisiones automatizadas.",
    url: "/about",
  },
};

export default function AboutPage() {
  return (
    <>
      <main className="hm">
        <div className="hm-progress" aria-hidden="true" />
        <AboutUsSection />
        <OurCompromiseSection />
        <ExpertsSection />
        {/* La variante de rejilla (la de arco es la escena de la portada). */}
        <SelectionProcessSection />
        <AboutCloseSection />
      </main>
      <Footer />
      <SiteMotion />
    </>
  );
}
