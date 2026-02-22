// RUTA: src/components/sections/aboutus/ExpertsSection.tsx
'use client';

import Image, { StaticImageData } from 'next/image';
import { useInView } from '@/hooks/useInView';
import expert1 from '@/assets/images/2-about/9.png';
import expert2 from '@/assets/images/2-about/10.png';
import expert3 from '@/assets/images/2-about/11.png';
import expert4 from '@/assets/images/2-about/12.png';
import expert5 from '@/assets/images/2-about/13.png';
import expert6 from '@/assets/images/2-about/14.png';
import expert7 from '@/assets/images/2-about/15.png';
import expert8 from '@/assets/images/2-about/16.png';

interface Expert {
  name: string;
  role: string;
  image: StaticImageData;
}

const experts: Expert[] = [
  { name: 'Denisse Tamez', role: 'Diseñadora Industrial', image: expert1 },
  { name: 'Javier Martínez', role: 'Marketing', image: expert2 },
  { name: 'Sofía Gutiérrez', role: 'Productora Audiovisual', image: expert3 },
  { name: 'Diego Torres', role: 'Programador', image: expert4 },
  { name: 'Laura Pérez', role: 'Diseñadora Web', image: expert5 },
  { name: 'Marcos Rodríguez', role: 'Psicólogo Clínico', image: expert6 },
  { name: 'Martha López', role: 'Project Manager', image: expert7 },
  { name: 'David Bisbal', role: 'Recursos Humanos', image: expert8 },
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
