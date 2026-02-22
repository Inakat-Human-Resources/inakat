// RUTA: src/components/sections/home/HowItWorksSection.tsx
'use client';

import { useInView } from '@/hooks/useInView';
import { ClipboardList, Search, CheckCircle, Handshake } from 'lucide-react';

const steps = [
  {
    number: 1,
    icon: ClipboardList,
    title: 'Publica tu vacante',
    description:
      'Define el perfil que buscas y nosotros hacemos el resto.',
  },
  {
    number: 2,
    icon: Search,
    title: 'Evaluamos al talento',
    description:
      'Psicólogos validan el fit humano. Especialistas validan la excelencia técnica.',
  },
  {
    number: 3,
    icon: CheckCircle,
    title: 'Revisa candidatos evaluados',
    description:
      'Recibe una terna de candidatos calificados con reportes detallados.',
  },
  {
    number: 4,
    icon: Handshake,
    title: 'Contrata con confianza',
    description:
      'Elige al mejor candidato sabiendo que fue validado por expertos reales.',
  },
];

const HowItWorksSection = () => {
  const { ref, isInView } = useInView(0.15);

  return (
    <section
      ref={ref as React.RefObject<HTMLDivElement>}
      className="bg-custom-beige py-16 md:py-24"
    >
      <div className="container mx-auto px-4">
        {/* Section title */}
        <h2
          className={`animate-on-scroll ${isInView ? 'in-view' : ''} font-display text-3xl md:text-4xl lg:text-5xl font-bold text-title-dark text-center mb-16`}
        >
          ¿Cómo funciona INAKAT?
        </h2>

        {/* Desktop: Horizontal timeline */}
        <div className="hidden md:block">
          <div className="relative">
            {/* Connecting line */}
            <div className="absolute top-12 left-[12%] right-[12%] h-0.5 bg-button-green/30">
              <div
                className={`h-full bg-button-green ${isInView ? 'animate-draw-line' : 'w-0'}`}
              />
            </div>

            {/* Steps */}
            <div className="grid grid-cols-4 gap-8 relative">
              {steps.map((step, index) => {
                const Icon = step.icon;
                return (
                  <div
                    key={step.number}
                    className={`animate-on-scroll ${isInView ? 'in-view' : ''} flex flex-col items-center text-center`}
                    style={{ transitionDelay: `${index * 200}ms` }}
                  >
                    {/* Number circle */}
                    <div
                      className="w-24 h-24 rounded-full bg-button-orange flex items-center justify-center mb-6 shadow-lg"
                      style={{
                        animation: isInView
                          ? `scalePop 0.5s ease-out ${index * 200 + 300}ms both`
                          : 'none',
                        opacity: isInView ? undefined : 0,
                        transform: isInView ? undefined : 'scale(0)',
                      }}
                    >
                      <Icon className="w-10 h-10 text-white" />
                    </div>

                    {/* Card */}
                    <div className="bg-white rounded-xl p-6 shadow-sm hover:shadow-md transition-shadow w-full">
                      <span className="text-button-orange font-display font-bold text-sm">
                        Paso {step.number}
                      </span>
                      <h3 className="font-display text-lg font-bold text-title-dark mt-2">
                        {step.title}
                      </h3>
                      <p className="text-text-black/70 text-sm mt-2 leading-relaxed">
                        {step.description}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Mobile: Vertical timeline */}
        <div className="md:hidden">
          <div className="relative pl-8">
            {/* Vertical line */}
            <div className="absolute left-3 top-0 bottom-0 w-0.5 bg-button-green/30">
              <div
                className={`w-full bg-button-green transition-all duration-1000 ${
                  isInView ? 'h-full' : 'h-0'
                }`}
              />
            </div>

            {/* Steps */}
            <div className="space-y-8">
              {steps.map((step, index) => {
                const Icon = step.icon;
                return (
                  <div
                    key={step.number}
                    className={`animate-on-scroll ${isInView ? 'in-view' : ''} relative`}
                    style={{ transitionDelay: `${index * 150}ms` }}
                  >
                    {/* Number dot */}
                    <div className="absolute -left-8 top-0 w-6 h-6 rounded-full bg-button-orange flex items-center justify-center">
                      <span className="text-white text-xs font-bold">
                        {step.number}
                      </span>
                    </div>

                    {/* Card */}
                    <div className="bg-white rounded-xl p-5 shadow-sm">
                      <div className="flex items-center gap-3 mb-2">
                        <Icon className="w-6 h-6 text-button-orange flex-shrink-0" />
                        <h3 className="font-display text-lg font-bold text-title-dark">
                          {step.title}
                        </h3>
                      </div>
                      <p className="text-text-black/70 text-sm leading-relaxed">
                        {step.description}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default HowItWorksSection;
