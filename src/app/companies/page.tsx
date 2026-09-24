// RUTA: src/app/companies/page.tsx
//
// /companies — la página que convierte, en el registro público «Arco» (el
// patrón de la portada: <main className="hm">, suelos que alternan, titulares
// en máscaras y movimiento ligado al scroll). Guía: docs/DISENO.md §8.
//
// Ritmo de suelos: arena (portada) → naranja (garantías) → teal (razones) →
// papel (proceso) → tinta (registro, #register) → pie.
// Estilos propios: ./companies.css (prefijo emp-).
import "./companies.css";
import CompaniesHeroSection from "@/components/sections/companies/CompaniesHeroSection";
import CompanyBenefitsSection from "@/components/sections/companies/CompanyBenefitsSection";
import CompanyProcessSection from "@/components/sections/companies/CompanyProcessSection";
import FormRegisterForQuotationSection from "@/components/sections/companies/FormRegisterForQuotationSection";
import SiteMotion from "@/components/ui/SiteMotion";
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

// El pie va DESPUÉS de <main> (dentro no contaba como «información del sitio»
// para los lectores de pantalla). SiteMotion arma las entradas sólo con la
// pestaña visible y pone el paralaje del puntero y los botones imantados.
export default function CompaniesPage() {
  return (
    <>
      <main className="hm min-h-screen">
        <div className="hm-progress" aria-hidden="true" />
        <CompaniesHeroSection />
        <CompanyBenefitsSection />
        {/* CompanyTestimonialsSection removed — testimonials used placeholder data */}
        <CompanyProcessSection />
        {/* El formulario vive bajo el ancla #register (la usa el CTA de la
            barra pública) y #formulario-registro (enlaces antiguos). */}
        <FormRegisterForQuotationSection />
      </main>
      <Footer />
      <SiteMotion />
    </>
  );
}
