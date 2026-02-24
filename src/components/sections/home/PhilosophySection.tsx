// RUTA: src/components/sections/home/PhilosophySection.tsx
'use client';

import { useInView } from '@/hooks/useInView';

const PhilosophySection = () => {
  const { ref, isInView } = useInView(0.15);

  return (
    <section
      ref={ref as React.RefObject<HTMLDivElement>}
      className="bg-white py-16 md:py-24"
    >
      <div className="container mx-auto px-4 max-w-4xl">
        <h2
          className={`animate-on-scroll ${isInView ? 'in-view' : ''} font-display text-3xl md:text-4xl lg:text-5xl font-bold text-title-dark text-center mb-10`}
        >
          Reclutamiento con <span className="gradient-text">sentido humano</span>
        </h2>

        <div className="space-y-6">
          <p
            className={`animate-on-scroll ${isInView ? 'in-view' : ''} text-lg md:text-xl text-text-black/80 leading-relaxed text-center`}
            style={{ transitionDelay: '100ms' }}
          >
            En INAKAT entendemos que reclutar no es solo cubrir un puesto.
            Es encontrar a la persona adecuada{' '}
            <strong>para el rol, la cultura y las condiciones reales de tu empresa.</strong>
          </p>

          <p
            className={`animate-on-scroll ${isInView ? 'in-view' : ''} text-lg md:text-xl text-text-black/80 leading-relaxed text-center`}
            style={{ transitionDelay: '200ms' }}
          >
            Sabemos que{' '}
            <strong>
              un candidato no es solo lo que sabe hacer, sino cómo se comporta,
              cómo se comunica, cómo se adapta, cuánto le importa el puesto y si
              realmente puede sostenerlo en el tiempo.
            </strong>
          </p>

          <p
            className={`animate-on-scroll ${isInView ? 'in-view' : ''} text-lg md:text-xl text-text-black/80 leading-relaxed text-center`}
            style={{ transitionDelay: '300ms' }}
          >
            Por eso,{' '}
            <strong>
              no elegimos solo por currículum, elegimos por compatibilidad,
              compromiso, ubicación, cultura y realidad humana.
            </strong>
          </p>
        </div>
      </div>
    </section>
  );
};

export default PhilosophySection;
