// RUTA: src/app/page.tsx
import "./home.css";
import HeroSection from "@/components/sections/home/HeroSection";
import SocialProofBar from "@/components/sections/home/SocialProofBar";
import PhilosophySection from "@/components/sections/home/PhilosophySection";
import SelectionProcessSection from "@/components/sections/aboutus/SelectionProcessSection";
import DualCTASection from "@/components/sections/home/DualCTASection";
import WhyInakatSection from "@/components/sections/home/WhyInakatSection";
import SpecialtiesSection from "@/components/sections/home/SpecialtiesSection";
import StatsSection from "@/components/sections/home/StatsSection";
import TestimonialsSection from "@/components/sections/home/TestimonialsSection";
import CoverageMapSection from "@/components/sections/home/CoverageMapSection";
import FAQSection from "@/components/sections/home/FAQSection";
import HomeCloseSection from "@/components/sections/home/HomeCloseSection";
import SiteMotion from "@/components/ui/SiteMotion";
import Footer from "@/components/commons/Footer";

// La portada es la referencia del registro público: sus primitivas (tokens,
// titulares, botones, arcos, revelados) viven en site.css, que carga el layout
// raíz; home.css sólo guarda sus secciones. La serif itálica (--font-serif)
// también la carga ya el layout raíz, para todo el sitio.
// El pie va DESPUÉS de <main>: dentro de él no contaba como «información del
// sitio» (contentinfo) para los lectores de pantalla. Se ve igual.
export default function Home() {
  return (
    <>
      <main className="hm min-h-screen">
        <div className="hm-progress" aria-hidden="true" />
        <HeroSection />
        <SocialProofBar />
        <PhilosophySection />
        <SelectionProcessSection variant="arc" />
        <DualCTASection />
        <WhyInakatSection />
        <SpecialtiesSection />
        <StatsSection />
        <TestimonialsSection />
        <CoverageMapSection />
        <FAQSection />
        <HomeCloseSection />
      </main>
      <Footer />
      <SiteMotion />
    </>
  );
}
