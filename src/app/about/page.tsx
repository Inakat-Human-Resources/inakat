// RUTA: src/app/about/page.tsx
import AboutUsSection from "@/components/sections/aboutus/AboutUsSection";
import OurCompromiseSection from "@/components/sections/aboutus/OurCompromiseSection";
import ExpertsSection from "@/components/sections/aboutus/ExpertsSection";
import SelectionProcessSection from "@/components/sections/aboutus/SelectionProcessSection";
import CTAFinalSection from "@/components/commons/CTAFinalSection";
import Footer from "@/components/commons/Footer";
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
