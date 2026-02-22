// RUTA: src/components/sections/aboutus/AboutUsSection.tsx
'use client';

import Image from 'next/image';
import { useInView } from '@/hooks/useInView';
import aboutImage from '@/assets/images/2-about/1.png';

const AboutUsSection = () => {
  const { ref, isInView } = useInView(0.15);

  return (
    <section
      ref={ref as React.RefObject<HTMLDivElement>}
      className="bg-custom-beige py-16 md:py-24"
    >
      <div className="container mx-auto px-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-10 md:gap-16 items-center">
          {/* Image */}
          <div
            className={`animate-on-scroll ${isInView ? 'in-view' : ''}`}
          >
            <Image
              src={aboutImage}
              alt="Equipo INAKAT"
              className="w-full rounded-2xl shadow-2xl"
              loading="lazy"
            />
          </div>

          {/* Text */}
          <div>
            <h2
              className={`animate-on-scroll ${isInView ? 'in-view' : ''} font-display text-4xl md:text-5xl font-bold text-title-dark mb-8`}
            >
              ¿Quiénes <span className="gradient-text">Somos</span>?
            </h2>

            <div className="space-y-4">
              <p
                className={`animate-on-scroll ${isInView ? 'in-view' : ''} text-lg text-text-black/80 leading-relaxed`}
                style={{ transitionDelay: '100ms' }}
              >
                En INAKAT entendemos que reclutar no es solo cubrir un puesto.
                Es encontrar a la persona adecuada{' '}
                <strong>
                  para el rol, la cultura y las condiciones reales de tu
                  empresa.
                </strong>
              </p>

              <p
                className={`animate-on-scroll ${isInView ? 'in-view' : ''} text-lg text-text-black/80 leading-relaxed`}
                style={{ transitionDelay: '200ms' }}
              >
                Sabemos que{' '}
                <strong>
                  un candidato no es solo lo que sabe hacer, sino cómo se
                  comporta, cómo se comunica, cómo se adapta, cuánto le importa
                  el puesto y si realmente puede sostenerlo en el tiempo.
                </strong>
              </p>

              <p
                className={`animate-on-scroll ${isInView ? 'in-view' : ''} text-lg text-text-black/80 leading-relaxed`}
                style={{ transitionDelay: '300ms' }}
              >
                Por eso,{' '}
                <strong>
                  no elegimos solo por currículum, elegimos por compatibilidad,
                  compromiso, ubicación, cultura y realidad humana.
                </strong>
              </p>

              {/* Callout box for wayuu origin */}
              <div
                className={`animate-on-scroll ${isInView ? 'in-view' : ''} bg-soft-green/10 border-l-4 border-button-orange rounded-r-lg p-5 mt-6`}
                style={{ transitionDelay: '400ms' }}
              >
                <p className="text-text-black/80 italic leading-relaxed">
                  El nombre <strong>INAKAT</strong> proviene de la palabra
                  &quot;talento&quot; en lengua wayuu, una comunidad que honra
                  las habilidades únicas de cada persona. Eso nos inspira a ver
                  más allá de lo obvio y conectar a las empresas con quienes{' '}
                  <strong>
                    de verdad pueden aportar a su equipo, su operación y sus
                    metas.
                  </strong>
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default AboutUsSection;
