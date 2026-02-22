// RUTA: src/app/about/page.tsx
import AboutUsSection from "@/components/sections/aboutus/AboutUsSection";
import OurCompromiseSection from "@/components/sections/aboutus/OurCompromiseSection";
import ExpertsSection from "@/components/sections/aboutus/ExpertsSection";
import SelectionProcessSection from "@/components/sections/aboutus/SelectionProcessSection";
import CTAFinalSection from "@/components/sections/home/CTAFinalSection";
import Footer from "@/components/commons/Footer";

export default function AboutPage() {
  return (
    <main className="min-h-screen">
      <AboutUsSection />
      <OurCompromiseSection />
      <ExpertsSection />
      <SelectionProcessSection />
      <CTAFinalSection />
      <Footer />
    </main>
  );
}
