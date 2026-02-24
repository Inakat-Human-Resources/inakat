// RUTA: src/components/sections/aboutus/ExpertsSection.tsx
'use client';

import Image, { StaticImageData } from 'next/image';
import { useInView } from '@/hooks/useInView';
import imgGuillermo from '@/assets/images/2-about/guillermo-sanchez.png';
import imgAlexandra from '@/assets/images/2-about/alexandra-fetisova.png';
import imgOmar from '@/assets/images/2-about/omar-garcia.png';
import imgAndrea from '@/assets/images/2-about/andrea-avalos.png';
import imgSofia from '@/assets/images/2-about/sofia-deleon.png';
import imgErnesto from '@/assets/images/2-about/ernesto-zapata.png';
import imgAndre from '@/assets/images/2-about/andre-gracia.png';
import imgAlejandro from '@/assets/images/2-about/alejandro-martinez.png';
import imgDenisse from '@/assets/images/2-about/denisse.png';

interface Expert {
  name: string;
  role: string;
  image: StaticImageData;
}

const experts: Expert[] = [
  { name: 'Guillermo Sánchez', role: 'Fundador & CEO', image: imgGuillermo },
  { name: 'Alexandra Fetisova', role: 'Especialista', image: imgAlexandra },
  { name: 'Omar García Jane', role: 'Doctor en Psicología', image: imgOmar },
  { name: 'Andrea Avalos', role: 'Ingeniera en Sistemas · Product Owner', image: imgAndrea },
  { name: 'Sofía de León', role: 'Coordinadora de Eventos', image: imgSofia },
  { name: 'Ernesto Zapata', role: 'Consultor en Finanzas · CONOCER', image: imgErnesto },
  { name: 'André Gracia', role: 'Productor Audiovisual', image: imgAndre },
  { name: 'Alejandro Martínez', role: 'Ing. Electrónico · Sistemas Embebidos', image: imgAlejandro },
  { name: 'Denisse Tamez Escamilla', role: 'Especialista', image: imgDenisse },
];

const ExpertsSection = () => {
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
          Conoce a los Expertos
        </h2>
        <p
          className={`animate-on-scroll ${isInView ? 'in-view' : ''} text-text-black/60 text-lg text-center mb-14 max-w-2xl mx-auto`}
          style={{ transitionDelay: '100ms' }}
        >
          Profesionales dedicados a encontrar el talento que tu empresa
          necesita.
        </p>

        {/* Experts grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6 md:gap-8 max-w-5xl mx-auto">
          {experts.map((expert, index) => (
            <div
              key={index}
              className={`animate-on-scroll ${isInView ? 'in-view' : ''} bg-white rounded-xl p-6 shadow-sm hover:shadow-md transition-shadow text-center`}
              style={{ transitionDelay: `${index * 80}ms` }}
            >
              <div className="w-20 h-20 mx-auto mb-4 rounded-full overflow-hidden bg-custom-beige">
                <Image
                  src={expert.image}
                  alt={expert.name}
                  className="w-full h-full object-cover"
                  loading="lazy"
                />
              </div>
              <h3 className="font-display font-bold text-title-dark text-sm md:text-base">
                {expert.name}
              </h3>
              <p className="text-button-green text-sm mt-1">{expert.role}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default ExpertsSection;
