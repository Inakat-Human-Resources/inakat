import HeroHomeSection from "@/components/sections/home/HeroHomeSection";
import BusinessTalentSection from "@/components/sections/home/BusinessTalentSection";
import SpecialtiesSection from "@/components/sections/home/SpecialtiesSection";
import WhyInakatSection from "@/components/sections/home/WhyInakatSection";
import MapContactSection from "@/components/sections/home/MapContactSection";
import NewsletterSection from "@/components/sections/home/NewsletterSection";
import Footer from "@/components/commons/Footer";

export default function Home() {
  return (
    <main className="min-h-screen">
      <HeroHomeSection />
      <BusinessTalentSection />
      <SpecialtiesSection />
      <WhyInakatSection />
      <MapContactSection />
      <NewsletterSection />
      <Footer />
    </main>
  );
}
