"use client";

import React from "react";
import Image from "next/image";
import mainImage from "@/assets/images/1-home/1.png";
import overlayIcon from "@/assets/images/1-home/2.png";

const HeroHomeSection = () => {
  return (
    <section className="bg-custom-beige py-12 md:py-20 mt-20 md:mt-24">
      <div className="container mx-auto px-4 grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
        {/* Left content */}
        <div className="text-left">
          <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold text-title-dark leading-tight">
            Contrata de forma inteligente. <br />
            Contrata con INAKAT.
          </h1>
          <p className="text-base md:text-lg text-text-black mt-4">
            En INAKAT, cada candidato es evaluado por psicólogos expertos y por
            especialistas líderes en su disciplina.
            <br />
            Validamos tanto el fit humano como la excelencia técnica.
            <br />
            <strong>
              Usamos inteligencia artificial como apoyo estratégico, pero todo
              el proceso está liderado por personas reales, desde el inicio
              hasta la decisión final.
            </strong>
            <br />
            Todo esto, dentro de una plataforma pensada para ti para que tengas
            claridad, confianza y transparencia total en cada paso del proceso.
          </p>
          <button className="mt-6 bg-button-green text-white py-2 px-6 rounded-full hover:bg-green-700">
            CONOCE MÁS →
          </button>

          {/* Statistics */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6 mt-8 md:mt-10">
            <div>
              <p className="text-xl md:text-3xl font-bold text-number-green">
                Evaluación dual
              </p>
              <p className="text-sm md:text-base font-bold text-number-green">
                psicólogos + especialistas técnicos
              </p>
              <div className="h-[2px] w-20 md:w-[115px] bg-number-green mt-2"></div>
            </div>
            <div>
              <p className="text-xl md:text-3xl font-bold text-number-green">
                IA que orienta,
              </p>
              <p className="text-sm md:text-base font-bold text-number-green">humanos que deciden</p>
              <div className="h-[2px] w-20 md:w-[115px] bg-number-green mt-2"></div>
            </div>
            <div>
              <p className="text-xl md:text-3xl font-bold text-number-green">
                Candidatos destacados,
              </p>
              <p className="text-sm md:text-base font-bold text-number-green">
                no solo competentes
              </p>
              <div className="h-[2px] w-20 md:w-[115px] bg-number-green mt-2"></div>
            </div>
            <div>
              <p className="text-xl md:text-3xl font-bold text-number-green">
                Transparencia total
              </p>
              <p className="text-sm md:text-base font-bold text-number-green">en todo el proceso</p>
              <div className="h-[2px] w-20 md:w-[115px] bg-number-green mt-2"></div>
            </div>
          </div>
        </div>

        {/* Image with overlay icon */}
        <div className="relative w-full flex justify-center">
          <Image
            src={mainImage}
            alt="Equipo trabajando"
            className="rounded-lg shadow-lg w-full max-w-md"
          />
          <Image
            src={overlayIcon}
            alt="Icono sobre la imagen"
            className="absolute inset-0 mx-auto my-auto w-1/4"
          />
        </div>
      </div>
    </section>
  );
};

export default HeroHomeSection;
