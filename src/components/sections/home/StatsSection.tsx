// RUTA: src/components/sections/home/StatsSection.tsx
'use client';

import { useInView } from '@/hooks/useInView';
import { useCountUp } from '@/hooks/useCountUp';

const stats = [
  { value: 11, suffix: '', label: 'pasos de evaluación', sublabel: 'antes de presentar candidatos' },
  { value: 7, suffix: '+', label: 'áreas de especialidad', sublabel: 'cubiertas por expertos' },
  { value: 2, suffix: '', label: 'filtros de evaluación', sublabel: 'psicológico + técnico' },
  { value: 24, suffix: '', label: 'días hábiles promedio', sublabel: 'del proceso completo' },
];

const StatItem = ({
  stat,
  isInView,
  delay,
}: {
  stat: (typeof stats)[0];
  isInView: boolean;
  delay: number;
}) => {
  const count = useCountUp(stat.value, 2000, isInView);

  return (
    <div
      className={`animate-on-scroll ${isInView ? 'in-view' : ''} text-center`}
      style={{ transitionDelay: `${delay}ms` }}
    >
      <p className="font-display text-5xl md:text-6xl lg:text-7xl font-black text-button-orange">
        {count}
        {stat.suffix}
      </p>
      <p className="text-title-dark font-semibold text-sm uppercase tracking-wider mt-3">
        {stat.label}
      </p>
      {stat.sublabel && (
        <p className="text-text-black/50 text-xs uppercase tracking-wider mt-1">
          {stat.sublabel}
        </p>
      )}
    </div>
  );
};

const StatsSection = () => {
  const { ref, isInView } = useInView(0.2);

  return (
    <section
      ref={ref as React.RefObject<HTMLDivElement>}
      className="bg-custom-beige py-16 md:py-24"
    >
      <div className="container mx-auto px-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-10 md:gap-8 max-w-5xl mx-auto">
          {stats.map((stat, index) => (
            <StatItem
              key={index}
              stat={stat}
              isInView={isInView}
              delay={index * 150}
            />
          ))}
        </div>
      </div>
    </section>
  );
};

export default StatsSection;
