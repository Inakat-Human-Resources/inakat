// RUTA: src/app/companies/page.tsx
import CompaniesHeroSection from "@/components/sections/companies/CompaniesHeroSection";
import CompanyBenefitsSection from "@/components/sections/companies/CompanyBenefitsSection";
import FormRegisterForQuotationSection from "@/components/sections/companies/FormRegisterForQuotationSection";
import Footer from "@/components/commons/Footer";
import type { Metadata } from "next";
import { BASE_OPEN_GRAPH } from "@/lib/seo";

export const metadata: Metadata = {
  title: "Empresas",
  description:
    "Registra tu empresa en INAKAT y recibe candidatos evaluados por psicólogos organizacionales y especialistas técnicos de tu industria.",
  alternates: { canonical: "/companies" },
  openGraph: {
    ...BASE_OPEN_GRAPH,
    title: "Empresas | INAKAT",
    description:
      "Recibe candidatos evaluados por psicólogos organizacionales y especialistas técnicos de tu industria.",
    url: "/companies",
  },
};

export default function CompaniesPage() {
  return (
    <main className="min-h-screen">
      <CompaniesHeroSection />
      <CompanyBenefitsSection />
      {/* CompanyTestimonialsSection removed — testimonials used placeholder data */}
      {/* Form section header */}
      <section id="register" className="bg-soft-beige pt-16 md:pt-24 pb-12 md:pb-16">
        <div className="container mx-auto px-4 text-center">
          <h2 className="font-display text-3xl md:text-4xl lg:text-5xl font-bold text-title-dark mb-4">
            Registra tu Empresa
          </h2>
          <p className="text-text-black/60 text-lg max-w-2xl mx-auto">
            Completa el formulario y nuestro equipo te contactará para iniciar
            el proceso.
          </p>
        </div>
      </section>
      <FormRegisterForQuotationSection />
      <Footer />
    </main>
  );
}
