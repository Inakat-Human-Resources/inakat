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
              {/* Callout principal: origen del nombre */}
              <div
                className={`animate-on-scroll ${isInView ? 'in-view' : ''} bg-soft-green/10 border-l-4 border-button-orange rounded-r-lg p-5 mb-6`}
                style={{ transitionDelay: '100ms' }}
              >
                <p className="text-text-black/80 italic leading-relaxed text-lg">
                  <strong>INAKAT</strong> proviene de la palabra &quot;talento&quot; en lengua
                  wayuu, una comunidad que honra las habilidades únicas de cada
                  persona. Ese principio es el corazón de todo lo que hacemos.
                </p>
              </div>

              <p
                className={`animate-on-scroll ${isInView ? 'in-view' : ''} text-lg text-text-black/80 leading-relaxed`}
                style={{ transitionDelay: '200ms' }}
              >
                Somos una empresa mexicana de reclutamiento especializado que nació
                con una convicción clara:{' '}
                <strong>
                  las mejores contrataciones no las hace un algoritmo, las hacen
                  personas que entienden a personas.
                </strong>
              </p>

              <p
                className={`animate-on-scroll ${isInView ? 'in-view' : ''} text-lg text-text-black/80 leading-relaxed`}
                style={{ transitionDelay: '300ms' }}
              >
                Nuestro modelo combina{' '}
                <strong>psicólogos organizacionales</strong> que evalúan actitud,
                valores y compatibilidad cultural, con{' '}
                <strong>especialistas técnicos líderes en su industria</strong> que
                validan que el candidato realmente domina su disciplina. Dos filtros
                humanos, cero decisiones automatizadas.
              </p>

              <p
                className={`animate-on-scroll ${isInView ? 'in-view' : ''} text-lg text-text-black/80 leading-relaxed`}
                style={{ transitionDelay: '400ms' }}
              >
                Con presencia activa en las principales ciudades de México — CDMX,
                Monterrey, Guadalajara, Puebla, Querétaro, León y Mérida —
                conocemos el talento local de cada región y conectamos a las empresas
                con profesionales que{' '}
                <strong>
                  de verdad pueden aportar a su equipo, su operación y sus metas.
                </strong>
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default AboutUsSection;
