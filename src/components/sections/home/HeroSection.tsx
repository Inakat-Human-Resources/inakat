// RUTA: src/components/sections/home/HeroSection.tsx
'use client';

import Link from 'next/link';
import Image from 'next/image';
import heroImage from '@/assets/images/1-home/1.png';
import iconK from '@/assets/images/1-home/2.png';
import circleTeal from '@/assets/images/1-home/5.png';

const HeroSection = () => {
  return (
    <section className="bg-custom-beige py-12 md:py-20 lg:py-24">
      <div className="container mx-auto px-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 md:gap-12 items-center">
          {/* Text Column */}
          <div className="order-1">
            <h1 className="hero-headline font-display text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold text-title-dark leading-tight">
              Contrata talento
              <br />
              que realmente
              <br />
              <span className="gradient-text">hace la diferencia.</span>
            </h1>

            <p className="hero-sub mt-6 text-lg md:text-xl text-text-black/70 max-w-lg leading-relaxed">
              Evaluación dual: psicólogos + especialistas técnicos.
              <br />
              IA como apoyo. Personas que deciden.
            </p>

            <div className="hero-cta mt-8 flex flex-col sm:flex-row gap-4">
              <Link
                href="/companies"
                className="inline-flex items-center justify-center bg-button-orange text-white font-semibold px-8 py-4 rounded-full text-lg hover:scale-105 hover:shadow-lg transition-all duration-300"
              >
                Registra tu Empresa
              </Link>
              <Link
                href="/talents"
                className="inline-flex items-center justify-center border-2 border-button-green text-button-dark-green font-semibold px-8 py-4 rounded-full text-lg hover:bg-button-green hover:text-white transition-all duration-300"
              >
                Soy Candidato
              </Link>
            </div>
          </div>

          {/* Image Column */}
          <div className="hero-image order-2 relative">
            {/* Decorative circle */}
            <div className="absolute -top-8 -right-8 w-24 h-24 md:w-32 md:h-32 opacity-20 animate-float-delayed pointer-events-none">
              <Image
                src={circleTeal}
                alt=""
                fill
                className="object-contain"
                aria-hidden="true"
              />
            </div>

            {/* Main hero image */}
            <div className="relative rounded-2xl overflow-hidden shadow-2xl">
              <Image
                src={heroImage}
                alt="Equipo INAKAT - Profesionales de reclutamiento"
                width={600}
                height={450}
                className="w-full h-auto object-cover"
                priority
              />
              {/* Subtle overlay with brand icon */}
              <div className="absolute bottom-4 right-4 w-12 h-12 md:w-16 md:h-16 opacity-30">
                <Image
                  src={iconK}
                  alt=""
                  fill
                  className="object-contain"
                  aria-hidden="true"
                />
              </div>
            </div>

            {/* Floating decorative element */}
            <div className="absolute -bottom-6 -left-6 w-16 h-16 md:w-20 md:h-20 opacity-15 animate-float pointer-events-none">
              <Image
                src={circleTeal}
                alt=""
                fill
                className="object-contain"
                aria-hidden="true"
              />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default HeroSection;
