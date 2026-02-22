// RUTA: src/components/sections/home/DualCTASection.tsx
'use client';

import Link from 'next/link';
import { useInView } from '@/hooks/useInView';
import { Building2, UserCircle } from 'lucide-react';

const DualCTASection = () => {
  const { ref, isInView } = useInView(0.15);

  return (
    <section
      ref={ref as React.RefObject<HTMLDivElement>}
      className="bg-soft-green py-16 md:py-24"
    >
      <div className="container mx-auto px-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-5xl mx-auto">
          {/* Card Empresas */}
          <div
            className={`animate-on-scroll ${isInView ? 'in-view' : ''} bg-white/95 rounded-2xl p-8 md:p-10 border-l-4 border-button-orange hover:-translate-y-1 hover:shadow-xl transition-all duration-300`}
            style={{ transitionDelay: '0ms' }}
          >
            <Building2 className="w-10 h-10 text-button-orange mb-4" />
            <h3 className="font-display text-2xl font-bold text-title-dark mb-3">
              Para Empresas
            </h3>
            <p className="text-xl text-title-dark/80 font-medium mb-4">
              ¿Buscas talento calificado?
            </p>
            <p className="text-text-black/70 mb-8 leading-relaxed">
              Registra tu empresa y accede a nuestro proceso de selección
              experto. Recibe candidatos evaluados por psicólogos y
              especialistas técnicos.
            </p>
            <Link
              href="/companies"
              className="block w-full text-center bg-button-orange text-white font-semibold py-4 rounded-full hover:scale-105 hover:shadow-lg transition-all duration-300"
            >
              Registrarme como Empresa
            </Link>
          </div>

          {/* Card Candidatos */}
          <div
            className={`animate-on-scroll ${isInView ? 'in-view' : ''} bg-white/95 rounded-2xl p-8 md:p-10 border-l-4 border-button-green hover:-translate-y-1 hover:shadow-xl transition-all duration-300`}
            style={{ transitionDelay: '150ms' }}
          >
            <UserCircle className="w-10 h-10 text-button-green mb-4" />
            <h3 className="font-display text-2xl font-bold text-title-dark mb-3">
              Para Candidatos
            </h3>
            <p className="text-xl text-title-dark/80 font-medium mb-4">
              ¿Buscas tu próximo reto profesional?
            </p>
            <p className="text-text-black/70 mb-8 leading-relaxed">
              Sube tu CV y déjanos conectarte con las mejores empresas de
              México. Nuestro equipo te acompañará en cada paso del proceso.
            </p>
            <Link
              href="/talents"
              className="block w-full text-center bg-button-green text-white font-semibold py-4 rounded-full hover:scale-105 hover:shadow-lg transition-all duration-300"
            >
              Aplicar Ahora
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
};

export default DualCTASection;
