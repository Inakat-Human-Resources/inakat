import AboutUsSection from "@/components/sections/aboutus/AboutUsSection";
import OurCompromiseSection from "@/components/sections/aboutus/OurCompromiseSection";
import SpecialtiesSection from "@/components/sections/aboutus/SpecialtiesSection";
import ExpertsSection from "@/components/sections/aboutus/ExpertsSection";
import SelectionProcessSection from "@/components/sections/aboutus/SelectionProcessSection";
import LocationSection from "@/components/sections/aboutus/LocationSection";
import ContactInfoSection from "@/components/sections/aboutus/ContactInfoSection";
import Footer from "@/components/commons/Footer";

export default function AboutPage() {
  return (
    <>
      <div className="bg-custom-beige text-text-black">
        <AboutUsSection />
        <OurCompromiseSection />
        <SpecialtiesSection />
        <ExpertsSection />
        <SelectionProcessSection />
        <LocationSection />
        <ContactInfoSection />
      </div>
      <Footer />
    </>
  );
}
