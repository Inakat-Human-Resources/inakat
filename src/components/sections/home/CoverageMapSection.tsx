// RUTA: src/components/sections/home/CoverageMapSection.tsx
'use client';

import Image from 'next/image';
import { useInView } from '@/hooks/useInView';
import mapImage from '@/assets/images/1-home/7.png';

const cities = [
  { name: 'CDMX', top: '62%', left: '42%' },
  { name: 'Monterrey', top: '35%', left: '52%' },
  { name: 'Guadalajara', top: '55%', left: '32%' },
  { name: 'Puebla', top: '62%', left: '48%' },
  { name: 'Querétaro', top: '52%', left: '42%' },
];

const cityList = ['CDMX', 'Monterrey', 'Guadalajara', 'Puebla', 'Querétaro', 'León', 'Mérida', 'Y más...'];

const CoverageMapSection = () => {
  const { ref, isInView } = useInView(0.15);

  return (
    <section
      ref={ref as React.RefObject<HTMLDivElement>}
      className="bg-custom-beige py-16 md:py-24"
    >
      <div className="container mx-auto px-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
          {/* Text Column */}
          <div className={`animate-on-scroll ${isInView ? 'in-view' : ''}`}>
            <h2 className="font-display text-3xl md:text-4xl lg:text-5xl font-bold text-title-dark mb-6">
              Presencia en toda
              <br />
              la República Mexicana
            </h2>
            <p className="text-text-black/70 text-lg mb-8 leading-relaxed max-w-lg">
              Conexiones estratégicas en las principales ciudades del país.
              Conocemos el mercado laboral local para conectarte con el
              mejor talento de cada región.
            </p>

            {/* City pills */}
            <div className="flex flex-wrap gap-3">
              {cityList.map((city, index) => (
                <span
                  key={index}
                  className={`animate-on-scroll ${isInView ? 'in-view' : ''} px-4 py-2 bg-button-green/10 border border-button-green/30 text-button-dark-green rounded-full text-sm font-medium`}
                  style={{ transitionDelay: `${index * 80}ms` }}
                >
                  {city}
                </span>
              ))}
            </div>
          </div>

          {/* Map Column */}
          <div
            className={`animate-on-scroll ${isInView ? 'in-view' : ''} relative`}
            style={{ transitionDelay: '200ms' }}
          >
            <div className="relative">
              <Image
                src={mapImage}
                alt="Mapa de cobertura INAKAT en la República Mexicana"
                width={600}
                height={500}
                className="w-full h-auto"
                loading="lazy"
              />

              {/* Animated city dots */}
              {cities.map((city, index) => (
                <div
                  key={index}
                  className="absolute"
                  style={{ top: city.top, left: city.left }}
                >
                  <div
                    className="pulse-dot w-3 h-3 bg-button-orange rounded-full"
                    style={{ animationDelay: `${index * 0.4}s` }}
                    title={city.name}
                  />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default CoverageMapSection;
