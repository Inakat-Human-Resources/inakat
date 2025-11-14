import React from "react";
import Image, { StaticImageData } from "next/image";
import expert1 from "@/assets/images/2-about/9.png";
import expert2 from "@/assets/images/2-about/10.png";
import expert3 from "@/assets/images/2-about/11.png";
import expert4 from "@/assets/images/2-about/12.png";
import expert5 from "@/assets/images/2-about/13.png";
import expert6 from "@/assets/images/2-about/14.png";
import expert7 from "@/assets/images/2-about/15.png";
import expert8 from "@/assets/images/2-about/16.png";
import fondo from "@/assets/images/2-about/fondo.png";

interface Expert {
  name: string;
  role: string;
  image: StaticImageData;
}

const experts: Expert[] = [
  { name: "DENISSE TAMEZ", role: "Diseñadora Industrial", image: expert1 },
  { name: "JAVIER MARTÍNEZ", role: "Marketing", image: expert2 },
  { name: "SOFÍA GUTIÉRREZ", role: "Productora Audiovisual", image: expert3 },
  { name: "DIEGO TORRES", role: "Programador", image: expert4 },
  { name: "LAURA PÉREZ", role: "Diseñadora Web", image: expert5 },
  { name: "MARCOS RODRÍGUEZ", role: "Psicólogo Clínico", image: expert6 },
  { name: "MARTHA LÓPEZ", role: "Project Manager", image: expert7 },
  { name: "DAVID BISBAL", role: "Recursos Humanos", image: expert8 },
];

const ExpertsSection = () => {
  return (
    <section
      className="bg-soft-green text-black py-20 relative"
      style={{
        backgroundImage: `url(${fondo.src})`,
        backgroundSize: "cover",
        backgroundPosition: "center",
      }}
    >
      <div className="container mx-auto grid grid-cols-1 md:grid-cols-6 gap-8 items-stretch">
        {/* Left Section: Title and Description */}
        <div className="md:col-span-2 bg-button-orange p-6 rounded-lg text-white flex flex-col justify-start h-full">
          <h2 className="text-3xl font-bold mb-4">CONOCE A LOS EXPERTOS</h2>
          <p className="text-lg text-justify">
            Nuestro equipo de profesionales de reclutamiento está dedicado a
            comprender las necesidades específicas de nuestros clientes y a
            identificar candidatos que no solo cumplan con los requisitos
            técnicos, sino que también encajen en la cultura y los valores de
            la empresa.
          </p>
          <p className="text-lg mt-4 text-justify">
            Valoramos la excelencia, la ética de trabajo y la pasión por la
            industria, y nos esforzamos por garantizar que cada contratación sea
            una inversión valiosa.
          </p>
        </div>

        {/* Right Section: Grid of Experts */}
        <div className="md:col-span-4 grid grid-cols-2 md:grid-cols-4 gap-6">
          {experts.map((expert, index) => (
            <div key={index} className="p-2 flex flex-col items-start">
              <Image
                src={expert.image}
                alt={expert.name}
                className="w-30 h-30 rounded-lg shadow-lg mb-2 bg-custom-beige"
              />
              <h3 className="text-lg text-white font-bold">{expert.name}</h3>
              <p className="text-sm text-lemon-green">{expert.role}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default ExpertsSection;
