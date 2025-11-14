import HeroTalentSection from "@/components/sections/talents/HeroTalentSection";
import SearchPositionsSection from "@/components/sections/talents/SearchPositionsSection";
import Footer from "@/components/commons/Footer";

export default function TalentsPage() {
  return (
    <>
      <div className="bg-custom-beige text-text-black">
        <HeroTalentSection />
        <SearchPositionsSection />
      </div>

      <Footer />
    </>
  );
}
