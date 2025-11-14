import AreYouLookingNewTalentSection from "@/components/sections/companies/AreYouLookingNewTalentSection";
import RegisterForQuotationSection from "@/components/sections/companies/RegisterForQuotationSection";
import AdvantagesSection from "@/components/sections/companies/AdvantagesSection";
import SatisfiedCustomersSection from "@/components/sections/companies/SatisfiedCustomersSection";
import FindProfessionalsSection from "@/components/sections/companies/FindProfessionalsSection";
import FormRegisterForQuotationSection from "@/components/sections/companies/FormRegisterForQuotationSection";
import Footer from "@/components/commons/Footer";

export default function CompaniesPage() {
  return (
    <>
      <div className="bg-custom-beige text-text-black">
        <AreYouLookingNewTalentSection />
        <RegisterForQuotationSection />
        <AdvantagesSection />
        <SatisfiedCustomersSection />
        <FindProfessionalsSection />
        <FormRegisterForQuotationSection />
      </div>

      <Footer />
    </>
  );
}
