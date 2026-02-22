// RUTA: src/app/talents/page.tsx
import HeroTalentSection from "@/components/sections/talents/HeroTalentSection";
import SearchPositionsSection from "@/components/sections/talents/SearchPositionsSection";
import Footer from "@/components/commons/Footer";

export default function TalentsPage() {
  return (
    <main className="min-h-screen">
      <HeroTalentSection />
      <div id="vacantes">
        <SearchPositionsSection />
      </div>
      <Footer />
    </main>
  );
}
