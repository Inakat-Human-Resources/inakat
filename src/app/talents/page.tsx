// RUTA: src/app/talents/page.tsx
import HeroTalentSection from "@/components/sections/talents/HeroTalentSection";
import SearchPositionsSection from "@/components/sections/talents/SearchPositionsSection";
import Footer from "@/components/commons/Footer";
import type { Metadata } from "next";
import { BASE_OPEN_GRAPH } from "@/lib/seo";

export const metadata: Metadata = {
  title: "Vacantes para candidatos",
  description:
    "Encuentra vacantes en toda la República Mexicana y postúlate. En INAKAT te evalúan personas expertas, no un algoritmo.",
  alternates: { canonical: "/talents" },
  openGraph: {
    ...BASE_OPEN_GRAPH,
    title: "Vacantes para candidatos | INAKAT",
    description:
      "Encuentra vacantes en toda la República Mexicana y postúlate. Te evalúan personas expertas, no un algoritmo.",
    url: "/talents",
  },
};

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
