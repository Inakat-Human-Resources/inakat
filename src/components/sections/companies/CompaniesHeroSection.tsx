// RUTA: src/components/sections/companies/CompaniesHeroSection.tsx
'use client';

import Image from 'next/image';
import Link from 'next/link';
import heroImage from '@/assets/images/3-companies/1.png';
import { CheckCircle } from 'lucide-react';

const bullets = [
  'Evaluación psicológica por expertos',
  'Validación técnica por especialistas',
  'Candidatos evaluados en 2-4 semanas',
];

const CompaniesHeroSection = () => {
  return (
    <section className="bg-custom-beige py-12 md:py-20 lg:py-24">
      <div className="container mx-auto px-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 md:gap-12 items-center">
          {/* Text Column */}
          <div className="order-1">
            <h1 className="hero-headline font-display text-4xl sm:text-5xl md:text-6xl font-bold text-title-dark leading-tight">
              Encuentra al talento que tu empresa{' '}
              <span className="gradient-text">merece.</span>
            </h1>

            <p className="hero-sub mt-6 text-lg md:text-xl text-text-black/70 max-w-lg leading-relaxed">
              Publica tu vacante, nosotros nos encargamos del proceso de
              evaluación completo.
            </p>

            {/* Bullet points */}
            <ul className="hero-sub mt-6 space-y-3">
              {bullets.map((bullet, i) => (
                <li key={i} className="flex items-center gap-3">
                  <CheckCircle className="w-5 h-5 text-button-green flex-shrink-0" />
                  <span className="text-text-black/80">{bullet}</span>
                </li>
              ))}
            </ul>

            <div className="hero-cta mt-8 flex flex-col sm:flex-row gap-4">
              <Link
                href="#register"
                className="inline-flex items-center justify-center bg-button-orange text-white font-semibold px-8 py-4 rounded-full text-lg hover:scale-105 hover:shadow-lg transition-all duration-300"
              >
                Registra tu Empresa
              </Link>
              <Link
                href="#register"
                className="inline-flex items-center justify-center border-2 border-button-green text-button-dark-green font-semibold px-8 py-4 rounded-full text-lg hover:bg-button-green hover:text-white transition-all duration-300"
              >
                Cotiza en tiempo real
              </Link>
            </div>
          </div>

          {/* Image Column */}
          <div className="hero-image order-2">
            <Image
              src={heroImage}
              alt="Empresas que confían en INAKAT para encontrar talento"
              width={600}
              height={450}
              className="w-full h-auto rounded-2xl shadow-2xl object-cover"
              priority
            />
          </div>
        </div>
      </div>
    </section>
  );
};

export default CompaniesHeroSection;
