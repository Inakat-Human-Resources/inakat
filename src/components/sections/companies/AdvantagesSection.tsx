import React from "react";
import Image, { StaticImageData } from "next/image";
import decorativeImage from "@/assets/images/3-companies/4.png";
import benefit1 from "@/assets/images/3-companies/5.png";
import benefit2 from "@/assets/images/3-companies/6.png";
import benefit3 from "@/assets/images/3-companies/7.png";
import benefit4 from "@/assets/images/3-companies/8.png";
import benefit5 from "@/assets/images/3-companies/9.png";
import benefit6 from "@/assets/images/3-companies/10.png";

interface Benefit {
  icon: StaticImageData;
  title: string;
}

const benefits: Benefit[] = [
  {
    icon: benefit1,
    title: "ENFOQUE CENTRADO EN EL TALENTO Y LA EMPRESA",
  },
  {
    icon: benefit2,
    title: "AMPLIA COBERTURA GEOGRÁFICA",
  },
  {
    icon: benefit3,
    title: "COMPROMISO CON LA EXCELENCIA",
  },
  {
    icon: benefit4,
    title: "CONEXIONES ESTRATÉGICAS",
  },
  {
    icon: benefit5,
    title: "ENFOQUE EN EL CLIENTE",
  },
  {
    icon: benefit6,
    title: "ÁGILES Y FLEXIBLES",
  },
];

const AdvantagesSection = () => {
  return (
    <section className="py-16 bg-custom-beige relative overflow-hidden">
      {/* Decorative image on the left */}
      <Image
        src={decorativeImage}
        alt="Decoración"
        className="absolute left-[-10em] top-1/2 transform -translate-y-1/2 rotate-[-90deg] w-[300px]"
      />

      <div className="container mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-8 ml-[50px]">
          {/* Title and description column */}
          <div className="md:col-span-4 py-16 px-10">
            <h2 className="text-4xl font-bold text-title-dark mb-6">
              DESCUBRE LOS <br />
              BENEFICIOS DE <br />
              INAKAT
            </h2>
            <p className="text-lg text-justify mb-8">
              Encuentra talento excepcional para tu equipo. Nuestra experiencia
              en reclutamiento te brinda los mejores profesionales. Potencia el
              crecimiento de tu empresa con nosotros.
            </p>
          </div>

          {/* Benefits grid */}
          <div className="md:col-span-8">
            <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
              {benefits.map((benefit, index) => (
                <div
                  key={index}
                  className="bg-title-dark p-6 rounded-xl text-center flex flex-col items-center"
                >
                  <h3 className="text-white text-m font-semibold">
                    {benefit.title}
                  </h3>
                  <br />
                  <div className="rounded-full mb-4 w-16 h-16 flex items-center justify-center">
                    <Image src={benefit.icon} alt={benefit.title} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default AdvantagesSection;
