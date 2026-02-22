// RUTA: src/components/sections/home/WhyInakatSection.tsx
'use client';

import { useInView } from '@/hooks/useInView';
import { Brain, Microscope, Bot, Eye, BarChart3, MapPin } from 'lucide-react';

const features = [
  {
    icon: Brain,
    title: 'Psicólogos expertos',
    description:
      'Evalúan actitud, valores y fit cultural. Cada candidato es analizado por profesionales de psicología organizacional.',
    iconColor: 'text-button-orange',
  },
  {
    icon: Microscope,
    title: 'Especialistas técnicos',
    description:
      'Validan que el candidato domina su disciplina. Líderes de industria evalúan las competencias reales.',
    iconColor: 'text-soft-green',
  },
  {
    icon: Bot,
    title: 'IA responsable',
    description:
      'No decide. Señala. Usamos inteligencia artificial como apoyo estratégico. El criterio siempre es humano.',
    iconColor: 'text-button-orange',
  },
  {
    icon: Eye,
    title: 'Transparencia total',
    description:
      'Ves cada paso del proceso en tiempo real. Sin sorpresas, sin cajas negras. Información clara desde el día uno.',
    iconColor: 'text-soft-green',
  },
  {
    icon: BarChart3,
    title: 'Reportes detallados',
    description:
      'Cada candidato viene con evaluación completa: perfil psicológico, competencias técnicas y recomendaciones.',
    iconColor: 'text-button-orange',
  },
  {
    icon: MapPin,
    title: 'Presencia nacional',
    description:
      'Conocemos el talento local de cada región de México. Conexiones estratégicas en las principales ciudades.',
    iconColor: 'text-soft-green',
  },
];

const WhyInakatSection = () => {
  const { ref, isInView } = useInView(0.1);

  return (
    <section
      ref={ref as React.RefObject<HTMLDivElement>}
      className="bg-custom-beige py-16 md:py-24"
    >
      <div className="container mx-auto px-4">
        {/* Section title */}
        <h2
          className={`animate-on-scroll ${isInView ? 'in-view' : ''} font-display text-3xl md:text-4xl lg:text-5xl font-bold text-title-dark text-center mb-4`}
        >
          ¿Por qué las empresas eligen INAKAT?
        </h2>
        <p
          className={`animate-on-scroll ${isInView ? 'in-view' : ''} text-text-black/60 text-lg text-center mb-14 max-w-2xl mx-auto`}
          style={{ transitionDelay: '100ms' }}
        >
          Una combinación única de expertise humano y tecnología para encontrar
          al candidato ideal.
        </p>

        {/* Feature grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8">
          {features.map((feature, index) => {
            const Icon = feature.icon;
            return (
              <div
                key={index}
                className={`animate-on-scroll ${isInView ? 'in-view' : ''} bg-white rounded-xl p-8 shadow-sm hover:shadow-md hover:border-b-4 hover:border-button-orange transition-all duration-300 group`}
                style={{ transitionDelay: `${index * 100}ms` }}
              >
                <Icon
                  className={`w-12 h-12 ${feature.iconColor} mb-4 group-hover:scale-110 transition-transform duration-300`}
                />
                <h3 className="font-display text-xl font-bold text-title-dark mb-3">
                  {feature.title}
                </h3>
                <p className="text-text-black/70 text-base leading-relaxed">
                  {feature.description}
                </p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
};

export default WhyInakatSection;
