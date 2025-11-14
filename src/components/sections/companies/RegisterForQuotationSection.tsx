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
      <Image
        src={laptopImage}
        alt="Por qué INAKAT"
        className="absolute left-0 top-1/2 -translate-y-1/2 h-[280px] w-[32em]"
      />

      <div className="container mx-auto flex flex-col md:flex-row items-center relative">
        {/* Spacer div for laptop image */}
        <div className="w-1/4" />

        {/* Right side content */}
        <div className="w-2/3 grid grid-cols-2 gap-8 ml-[200px]">
          {/* Title and button */}
          <div className="flex flex-col justify-center">
            <h2 className="text-4xl font-bold mb-6">
              COTIZA EN <br />
              TIEMPO REAL
            </h2>
            <button
              onClick={() => router.push("/companies#register")}
              className="bg-button-green text-white py-3 px-6 rounded-full hover:bg-green-700 font-semibold w-fit"
            >
              REGÍSTRATE →
            </button>
          </div>

          {/* Description */}
          <div className="flex items-center">
            <p className="text-lg text-justify pr-16">
              Una vez que te registres como empresa, podrás acceder a nuestra
              calculadora, en la cual podrás verificar todas nuestras variables
              de cotización, para siempre transparentar y optimizar el inicio de
              nuestro
            </p>
          </div>
        </div>
      </div>

      {/* Decorative image positioned absolutely relative to section */}
      <Image
        src={decorativeImage}
        alt="Decoración derecha"
        className="absolute right-[-5em] top-1/2 transform -translate-y-1/2 rotate-90 w-1/6 w-[200px]"
      />
    </section>
  );
};

export default RegisterForQuotationSection;
