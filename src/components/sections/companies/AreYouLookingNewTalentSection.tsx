import React from "react";
import Image from "next/image";
import headerImage from "@/assets/images/3-companies/1.png";

const AreYouLookingNewTalentSection = () => {
  return (
    <section className="py-20">
      <div className="container mx-auto grid grid-cols-1 md:grid-cols-12 gap-8 items-center">
        <div className="md:col-span-4">
          <h2 className="text-4xl font-bold text-title-dark mb-6">
            ¿BUSCAS <br />
            RECLUTAR <br />
            TALENTO PARA <br />
            TU EQUIPO?
          </h2>
          <p className="text-lg mb-6 text-justify">
            Encuentra talento excepcional para tu equipo. Nuestra experiencia en
            reclutamiento te brinda los mejores profesionales. Potencia el
            crecimiento de tu empresa con nosotros.
          </p>
        </div>

        <div className="relative md:col-span-8">
          <Image
            src={headerImage}
            alt="Equipo de trabajo"
            className="w-full rounded-3xl"
          />
          <div className="absolute inset-0 bg-soft-green opacity-60 rounded-3xl"></div>
        </div>
      </div>
    </section>
  );
};

export default AreYouLookingNewTalentSection;
