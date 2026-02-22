// RUTA: src/app/companies/page.tsx
import CompaniesHeroSection from "@/components/sections/companies/CompaniesHeroSection";
import CompanyBenefitsSection from "@/components/sections/companies/CompanyBenefitsSection";
import CompanyTestimonialsSection from "@/components/sections/companies/CompanyTestimonialsSection";
import FormRegisterForQuotationSection from "@/components/sections/companies/FormRegisterForQuotationSection";
import Footer from "@/components/commons/Footer";

export default function CompaniesPage() {
  return (
    <main className="min-h-screen">
      <CompaniesHeroSection />
      <CompanyBenefitsSection />
      <CompanyTestimonialsSection />
      {/* Form section header */}
      <section id="register" className="bg-soft-beige pt-16 md:pt-24 pb-0">
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
