// RUTA: src/components/sections/home/CTAFinalSection.tsx
'use client';

import Link from 'next/link';
import { useInView } from '@/hooks/useInView';
import { Mail, Phone } from 'lucide-react';

const CTAFinalSection = () => {
  const { ref, isInView } = useInView(0.2);

  return (
    <section
      ref={ref as React.RefObject<HTMLDivElement>}
      className="py-20 md:py-28"
      style={{
        background: 'linear-gradient(135deg, #2b5d62 0%, #283739 100%)',
      }}
    >
      <div className="container mx-auto px-4">
        <div
          className={`animate-on-scroll ${isInView ? 'in-view' : ''} max-w-4xl mx-auto text-center`}
        >
          <h2 className="font-display text-3xl md:text-4xl lg:text-6xl font-bold text-white leading-tight mb-4">
            Encuentra al talento que tu
            <br />
            empresa necesita.
          </h2>
          <p className="text-button-green text-xl md:text-2xl font-semibold mb-10">
            Empieza hoy.
          </p>

          {/* CTAs */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center mb-12">
            <Link
              href="/companies"
              className="inline-flex items-center justify-center bg-button-orange text-white font-semibold px-10 py-4 rounded-full text-lg hover:scale-105 hover:shadow-xl transition-all duration-300"
            >
              Registra tu Empresa
            </Link>
            <Link
              href="/talents"
              className="inline-flex items-center justify-center bg-button-green text-white font-semibold px-10 py-4 rounded-full text-lg hover:scale-105 hover:shadow-xl transition-all duration-300"
            >
              Soy Candidato
            </Link>
          </div>

          {/* Contact info */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-6 text-white/70 text-sm">
            <span className="inline-flex items-center gap-2">
              <Mail className="w-4 h-4" />
              ¿Preguntas? info@inakat.com
            </span>
            <span className="inline-flex items-center gap-2">
              <Phone className="w-4 h-4" />
              +52 811 631 2490
            </span>
          </div>
        </div>
      </div>
    </section>
  );
};

export default CTAFinalSection;
