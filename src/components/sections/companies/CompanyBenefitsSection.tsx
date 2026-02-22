// RUTA: src/components/sections/companies/CompanyBenefitsSection.tsx
'use client';

import { useInView } from '@/hooks/useInView';
import { Users, Globe, Trophy, Link2, HeartHandshake, Zap } from 'lucide-react';

const benefits = [
  {
    icon: Users,
    title: 'Enfoque centrado en el talento y la empresa',
    description:
      'Conectamos personas con organizaciones evaluando tanto habilidades como compatibilidad cultural.',
  },
  {
    icon: Globe,
    title: 'Amplia cobertura geográfica',
    description:
      'Presencia en toda la República Mexicana para encontrar talento local en cualquier región.',
  },
  {
    icon: Trophy,
    title: 'Compromiso con la excelencia',
    description:
      'Cada candidato pasa por evaluación dual: psicológica y técnica por especialistas reales.',
  },
  {
    icon: Link2,
    title: 'Conexiones estratégicas',
    description:
      'Red de contactos en las principales ciudades e industrias de México.',
  },
  {
    icon: HeartHandshake,
    title: 'Enfoque en el cliente',
    description:
      'Entendemos las necesidades específicas de tu empresa para encontrar el match perfecto.',
  },
  {
    icon: Zap,
    title: 'Ágiles y flexibles',
    description:
      'Procesos eficientes que entregan candidatos evaluados en 2 a 4 semanas.',
  },
];

const CompanyBenefitsSection = () => {
  const { ref, isInView } = useInView(0.1);

  return (
    <section
      ref={ref as React.RefObject<HTMLDivElement>}
      className="bg-soft-green py-16 md:py-24"
    >
      <div className="container mx-auto px-4">
        {/* Title */}
        <h2
          className={`animate-on-scroll ${isInView ? 'in-view' : ''} font-display text-3xl md:text-4xl lg:text-5xl font-bold text-white text-center mb-14`}
        >
          ¿Por qué elegir INAKAT?
        </h2>

        {/* Benefits grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 max-w-5xl mx-auto">
          {benefits.map((benefit, index) => {
            const Icon = benefit.icon;
            return (
              <div
                key={index}
                className={`animate-on-scroll ${isInView ? 'in-view' : ''} bg-white/10 backdrop-blur-sm rounded-xl p-6 hover:bg-white/15 transition-colors`}
                style={{ transitionDelay: `${index * 100}ms` }}
              >
                <Icon className="w-8 h-8 text-button-green mb-4" />
                <h3 className="font-display text-white font-bold mb-2">
                  {benefit.title}
                </h3>
                <p className="text-white/70 text-sm leading-relaxed">
                  {benefit.description}
                </p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
};

export default CompanyBenefitsSection;
