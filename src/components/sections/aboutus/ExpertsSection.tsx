// RUTA: src/components/sections/aboutus/ExpertsSection.tsx
'use client';

import { useState } from 'react';
import Image, { StaticImageData } from 'next/image';
import { useInView } from '@/hooks/useInView';
import { X, Play } from 'lucide-react';
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
  bio: string;
  videoUrl?: string;
}

const experts: Expert[] = [
  {
    name: 'Guillermo Sánchez',
    role: 'Fundador & CEO',
    image: imgGuillermo,
    bio: 'Fundador de INAKAT, con amplia experiencia en reclutamiento especializado y construcción de equipos de alto rendimiento. Apasionado por conectar talento excepcional con las empresas que más lo necesitan.',
  },
  {
    name: 'Alexandra Fetisova',
    role: 'Especialista en Reclutamiento Internacional',
    image: imgAlexandra,
    bio: 'Especialista con experiencia en reclutamiento internacional y búsqueda de talento multicultural. Conecta profesionales de distintas latitudes con oportunidades en México.',
  },
  {
    name: 'Omar García Jane',
    role: 'Doctor en Psicología',
    image: imgOmar,
    bio: 'Doctor en Psicología con enfoque en evaluación de competencias y selección de personal. Lidera los procesos de evaluación psicométrica y entrevistas por competencias en INAKAT.',
  },
  {
    name: 'Andrea Avalos',
    role: 'Ingeniera en Sistemas · Product Owner',
    image: imgAndrea,
    bio: 'Ingeniera en Sistemas con experiencia como Product Owner. Evalúa perfiles técnicos de TI y asegura que cada candidato cumpla con los estándares de calidad que las empresas requieren.',
  },
  {
    name: 'Sofía de León',
    role: 'Coordinadora de Eventos y Operaciones',
    image: imgSofia,
    bio: 'Coordinadora de Eventos y Operaciones con habilidad para gestionar procesos complejos. Asegura que cada etapa del proceso de selección se ejecute con precisión y puntualidad.',
  },
  {
    name: 'Ernesto Zapata',
    role: 'Consultor en Finanzas · Certificado CONOCER',
    image: imgErnesto,
    bio: 'Consultor en Finanzas certificado por CONOCER. Evalúa perfiles de contaduría, finanzas y administración, garantizando candidatos con sólidas competencias técnicas y estratégicas.',
  },
  {
    name: 'André Gracia',
    role: 'Productor Audiovisual',
    image: imgAndre,
    bio: 'Productor Audiovisual que captura la esencia de INAKAT a través de contenido visual. Responsable de la imagen de marca y la comunicación audiovisual del equipo.',
  },
  {
    name: 'Alejandro Martínez',
    role: 'Ing. Electrónico · Sistemas Embebidos',
    image: imgAlejandro,
    bio: 'Ingeniero Electrónico especializado en Sistemas Embebidos. Evalúa perfiles técnicos de ingeniería y tecnología, desde firmware hasta hardware y automatización industrial.',
  },
  {
    name: 'Denisse Tamez Escamilla',
    role: 'Especialista en Atracción de Talento',
    image: imgDenisse,
    bio: 'Especialista en Atracción de Talento con enfoque en hunting y sourcing de candidatos. Identifica y contacta perfiles de alto nivel para posiciones estratégicas.',
  },
];

const ExpertsSection = () => {
  const { ref, isInView } = useInView(0.1);
  const [selectedExpert, setSelectedExpert] = useState<Expert | null>(null);

  return (
    <>
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
              <button
                key={index}
                onClick={() => setSelectedExpert(expert)}
                className={`animate-on-scroll ${isInView ? 'in-view' : ''} bg-white rounded-xl p-6 shadow-sm hover:shadow-md transition-all text-center cursor-pointer hover:-translate-y-1`}
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
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* Expert detail modal */}
      {selectedExpert && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
          onClick={() => setSelectedExpert(null)}
        >
          <div
            className="bg-white rounded-2xl p-6 md:p-8 max-w-lg w-full max-h-[90vh] overflow-y-auto relative"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Close button */}
            <button
              onClick={() => setSelectedExpert(null)}
              className="absolute top-4 right-4 p-1 rounded-full hover:bg-gray-100 transition-colors"
              aria-label="Cerrar"
            >
              <X className="w-5 h-5 text-gray-500" />
            </button>

            {/* Expert info */}
            <div className="flex flex-col items-center text-center">
              <div className="w-24 h-24 rounded-full overflow-hidden bg-custom-beige mb-4">
                <Image
                  src={selectedExpert.image}
                  alt={selectedExpert.name}
                  className="w-full h-full object-cover"
                />
              </div>
              <h3 className="font-display text-xl font-bold text-title-dark">
                {selectedExpert.name}
              </h3>
              <p className="text-button-green text-sm mt-1 mb-4">
                {selectedExpert.role}
              </p>
              <p className="text-text-black/70 leading-relaxed mb-6">
                {selectedExpert.bio}
              </p>

              {/* Video button */}
              {selectedExpert.videoUrl && (
                <a
                  href={selectedExpert.videoUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-6 py-3 bg-button-green text-white rounded-lg hover:bg-green-700 transition-colors font-semibold"
                >
                  <Play className="w-4 h-4" />
                  Ver video
                </a>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default ExpertsSection;
