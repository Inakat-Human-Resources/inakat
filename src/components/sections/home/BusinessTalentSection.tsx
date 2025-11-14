"use client";

import React from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import backgroundImage from "@/assets/images/1-home/1.png";
import arrowIcon from "@/assets/images/1-home/3.png";

const BusinessTalentSection = () => {
  const router = useRouter();

  return (
    <section
      className="relative bg-cover bg-center py-20"
      style={{
        backgroundImage: `url(${backgroundImage.src})`,
        backgroundSize: "cover",
        backgroundPosition: "center",
        maxHeight: "500px",
      }}
    >
      <div className="container mx-auto flex flex-col md:flex-row justify-center gap-8 relative">
        {/* Card For Companies */}
        <div className="bg-button-green p-8 rounded-xl shadow-lg w-full md:w-1/2 relative">
          <h2 className="text-white text-2xl font-bold">
            PARA <br /> EMPRESAS
          </h2>
          <p className="text-white mt-2">
            ¿En búsqueda de talentos? Registra tu empresa y conoce todo nuestro
            proceso de selección.
          </p>
          <Image
            src={arrowIcon}
            alt="Flecha"
            className="absolute top-4 right-4 w-6"
          />
          <button
            onClick={() => router.push("/companies")}
            className="mt-4 bg-button-orange text-white py-2 px-6 rounded hover:bg-orange-700"
          >
            Conoce más →
          </button>
        </div>

        {/* Card For Talents */}
        <div className="bg-custom-beige p-8 rounded-xl shadow-lg w-full md:w-1/2 relative">
          <h2 className="text-number-green text-2xl font-bold">
            PARA <br /> TALENTOS
          </h2>
          <p className="text-number-green mt-2">
            ¿Buscas empleo? Regístrate, sube tu CV y en breve nos contactaremos
            contigo.
          </p>
          <Image
            src={arrowIcon}
            alt="Flecha"
            className="absolute top-4 right-4 w-6"
          />
          <button
            onClick={() => router.push("/talents")}
            className="mt-4 bg-button-orange text-white py-2 px-6 rounded hover:bg-orange-700"
          >
            Conoce más →
          </button>
        </div>
      </div>
    </section>
  );
};

export default BusinessTalentSection;
