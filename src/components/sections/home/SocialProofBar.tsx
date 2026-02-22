// RUTA: src/components/sections/home/SocialProofBar.tsx
'use client';

import { useInView } from '@/hooks/useInView';
import { Award, MapPin, ShieldCheck, Bot, Eye } from 'lucide-react';

const metrics = [
  {
    icon: Award,
    value: '7 Áreas',
    label: 'de especialidad',
  },
  {
    icon: MapPin,
    value: 'Presencia',
    label: 'en toda la República',
  },
  {
    icon: ShieldCheck,
    value: 'Evaluación',
    label: 'dual garantizada',
  },
  {
    icon: Bot,
    value: 'IA + Humanos',
    label: 'en cada proceso',
  },
  {
    icon: Eye,
    value: 'Transparencia',
    label: 'total en cada paso',
  },
];

const SocialProofBar = () => {
  const { ref, isInView } = useInView(0.2);

  return (
    <section
      ref={ref as React.RefObject<HTMLDivElement>}
      className="bg-title-dark py-10 md:py-14"
    >
      <div className="container mx-auto px-4">
        <div
          className="grid grid-cols-2 md:grid-cols-5 gap-8 md:gap-4 stagger-children"
        >
          {metrics.map((metric, index) => {
            const Icon = metric.icon;
            return (
              <div
                key={index}
                className={`animate-on-scroll ${isInView ? 'in-view' : ''} flex flex-col items-center text-center ${
                  index === 4 ? 'col-span-2 md:col-span-1' : ''
                }`}
                style={{ transitionDelay: `${index * 100}ms` }}
              >
                <Icon className="w-8 h-8 text-button-green mb-3" />
                <p className="text-button-green font-display font-bold text-lg md:text-xl">
                  {metric.value}
                </p>
                <p className="text-white/80 text-sm mt-1">{metric.label}</p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
};

export default SocialProofBar;
