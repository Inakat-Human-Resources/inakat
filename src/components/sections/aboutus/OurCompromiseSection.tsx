// RUTA: src/components/sections/aboutus/OurCompromiseSection.tsx
'use client';

import { useInView } from '@/hooks/useInView';
import { ShieldCheck, Heart } from 'lucide-react';

const OurCompromiseSection = () => {
  const { ref, isInView } = useInView(0.15);

  return (
    <section
      ref={ref as React.RefObject<HTMLDivElement>}
      className="bg-soft-green py-16 md:py-24"
    >
      <div className="container mx-auto px-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-5xl mx-auto">
          {/* Card: Evaluación profunda */}
          <div
            className={`animate-on-scroll ${isInView ? 'in-view' : ''} bg-white/95 rounded-2xl p-8 md:p-10 border-l-4 border-button-orange`}
            style={{ transitionDelay: '0ms' }}
          >
            <ShieldCheck className="w-10 h-10 text-button-orange mb-4" />
            <h3 className="font-display text-2xl font-bold text-title-dark mb-4">
              Evaluación profunda y experta
            </h3>
            <p className="text-text-black/80 leading-relaxed mb-4">
              Todo el proceso está conducido por especialistas reales.{' '}
              <strong>Psicólogos expertos</strong> evalúan actitudes, valores,
              formas de trabajo, claridad de intención y compatibilidad
              cultural. <strong>Especialistas técnicos</strong> validan
              habilidades, experiencia y nivel de ejecución.
            </p>
            <p className="text-button-dark-green font-semibold">
              La tecnología y la IA nos ayudan a detectar señales relevantes,
              pero cada paso, cada filtro y cada elección está pensada y
              ejecutada por personas expertas.
            </p>
          </div>

          {/* Card: Nuestra promesa */}
          <div
            className={`animate-on-scroll ${isInView ? 'in-view' : ''} bg-white/95 rounded-2xl p-8 md:p-10 border-l-4 border-button-green`}
            style={{ transitionDelay: '150ms' }}
          >
            <Heart className="w-10 h-10 text-button-green mb-4" />
            <h3 className="font-display text-2xl font-bold text-title-dark mb-4">
              Nuestra promesa
            </h3>
            <div className="space-y-3 text-text-black/80 leading-relaxed">
              <p>
                Si creemos que un candidato no es adecuado, lo explicamos con
                fundamentos.
              </p>
              <p>
                Si vemos señales de alerta, las hacemos visibles. Y si
                encontramos una gran oportunidad para tu empresa, también te lo
                decimos con argumentos.
              </p>
              <p>
                No ofrecemos fórmulas genéricas ni promesas vacías. Ofrecemos{' '}
                <strong>claridad, criterio y compromiso</strong> para ayudarte a
                elegir bien.
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default OurCompromiseSection;
