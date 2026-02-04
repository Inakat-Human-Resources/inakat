"use client";

import React from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import laptopImage from "@/assets/images/3-companies/2.png";
import decorativeImage from "@/assets/images/3-companies/3.png";

const RegisterForQuotationSection = () => {
  const router = useRouter();

  return (
    <section className="bg-soft-green text-white bg-center flex items-center justify-center py-10 relative overflow-hidden">
      {/* Imagen laptop - solo visible en desktop */}
      <Image
        src={laptopImage}
        alt="Por qué INAKAT"
        className="absolute left-0 top-1/2 -translate-y-1/2 h-[280px] w-[32em] hidden lg:block"
      />

      <div className="container mx-auto flex flex-col md:flex-row items-center relative px-4">
        {/* Spacer div for laptop image - solo en desktop */}
        <div className="hidden lg:block w-1/4" />

        {/* Right side content */}
        <div className="w-full lg:w-2/3 grid grid-cols-1 md:grid-cols-2 gap-8 lg:ml-[200px]">
          {/* Title and button */}
          <div className="flex flex-col justify-center text-center md:text-left">
            <h2 className="text-3xl md:text-4xl font-bold mb-6">
              COTIZA EN <br />
              TIEMPO REAL
            </h2>
            <button
              onClick={() => router.push("/companies#register")}
              className="bg-button-green text-white py-3 px-6 rounded-full hover:bg-green-700 font-semibold w-fit mx-auto md:mx-0"
            >
              REGÍSTRATE →
            </button>
          </div>

          {/* Description */}
          <div className="flex items-center">
            <p className="text-base md:text-lg text-center md:text-justify pr-0 md:pr-16">
              Una vez que te registres como empresa, podrás acceder a nuestra
              calculadora, en la cual podrás verificar todas nuestras variables
              de cotización, para siempre transparentar y optimizar el inicio de
              nuestro proceso.
            </p>
          </div>
        </div>
      </div>

      {/* Decorative image - solo desktop */}
      <Image
        src={decorativeImage}
        alt="Decoración derecha"
        className="absolute right-[-5em] top-1/2 transform -translate-y-1/2 rotate-90 w-[200px] hidden lg:block"
      />
    </section>
  );
};

export default RegisterForQuotationSection;
