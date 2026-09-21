// RUTA: src/app/page.tsx
import { Instrument_Serif } from "next/font/google";
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
import HomeMotion from "@/components/sections/home/HomeMotion";
import Footer from "@/components/commons/Footer";

// La voz «humana» de la home: serif itálica frente a la sans geométrica del logotipo.
// Evaluación dual → tipografía dual.
const serif = Instrument_Serif({
  subsets: ["latin"],
  weight: "400",
  style: ["normal", "italic"],
  variable: "--font-serif",
  display: "swap",
});

export default function Home() {
  return (
    <main className={`hm min-h-screen ${serif.variable}`}>
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
      <Footer />
      <HomeMotion />
    </main>
  );
}
