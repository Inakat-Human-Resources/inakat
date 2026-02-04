"use client";

import React from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import semicircleImage from "@/assets/images/1-home/5.png";

const SpecialtiesSection = () => {
  const router = useRouter();

  // List of specialties - Solo 7 categorías principales
  const specialties = [
    "Psicología, Educación y Ciencias Humanas",
    "Tecnologías de la Información",
    "Ingeniería y Tecnología Avanzada",
    "Negocios, Administración y Finanzas",
    "Marketing, Comunicación y Diseño",
    "Talento, Gestión y Operación de Oficinas",
    "Salud y Bienestar",
  ];

  return (
    <section className="relative w-full bg-custom-beige py-16 overflow-hidden">
      {/* Left semicircle image - solo desktop */}
      <div className="absolute left-0 top-1/2 transform -translate-y-1/2 w-1/2 hidden md:block">
        <Image
          src={semicircleImage}
          alt="Decoración derecha"
          className="absolute left-[-6em] top-1/2 transform -translate-y-1/2 w-32 md:w-40 lg:w-48"
          style={{ clipPath: "inset(0 0 0 50%)" }}
        />
      </div>
      {/* Right image - solo desktop */}
      <div className="absolute right-0 top-1/2 transform -translate-y-1/2 w-1/2 hidden md:block">
        <Image
          src={semicircleImage}
          alt="Decoración izquierda"
          className="absolute right-[-6em] top-1/2 transform -translate-y-1/2 w-32 md:w-40 lg:w-48"
          style={{ clipPath: "inset(0 50% 0 0)" }}
        />
      </div>

      {/* Main content */}
      <div className="container mx-auto px-8 md:px-16 flex flex-col md:flex-row items-center justify-between">
        {/* Column 1: Title and button */}
        <div className="md:w-1/3 text-center md:text-left">
          <h2 className="text-3xl font-bold text-title-dark">
            NUESTRAS ÁREAS DE ESPECIALIDAD
          </h2>
          <button
            onClick={() => router.push("/about")}
            className="mt-6 bg-button-orange text-white py-2 px-6 rounded-full hover:bg-orange-700"
          >
            DESCUBRE MÁS →
          </button>
        </div>

        {/* Column 2: Specialties */}
        <div className="md:w-2/3 flex flex-wrap justify-center md:justify-start gap-4 mt-6 md:mt-0">
          {specialties.map((specialty, index) => (
            <span
              key={index}
              className="bg-button-green text-white py-2 px-4 rounded-full shadow-md text-lg"
            >
              #{specialty}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
};

export default SpecialtiesSection;
