// RUTA: src/app/page.tsx
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
import CTAFinalSection from "@/components/sections/home/CTAFinalSection";
import Footer from "@/components/commons/Footer";

export default function Home() {
  return (
    <main className="min-h-screen">
      <HeroSection />
      <SocialProofBar />
      <PhilosophySection />
      <SelectionProcessSection />
      <DualCTASection />
      <WhyInakatSection />
      <SpecialtiesSection />
      <StatsSection />
      <TestimonialsSection />
      <CoverageMapSection />
      <FAQSection />
      <CTAFinalSection />
      <Footer />
    </main>
  );
}
