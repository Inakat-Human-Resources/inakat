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
    role: 'Especialista en Arquitectura de Software y Plataformas Tecnológicas',
    image: imgGuillermo,
    bio: 'Guillermo Sánchez es graduado del Tecnológico de Monterrey, donde obtuvo primer lugar de su generación. Es Full Stack Developer y especialista en arquitectura de software, desarrollo de plataformas digitales y sistemas tecnológicos complejos. Ha desarrollado soluciones tecnológicas para empresas en México y Canadá, integrando tecnología con procesos organizacionales y plataformas digitales de alto desempeño. En INAKAT participa evaluando perfiles relacionados con ingeniería de software, desarrollo tecnológico y arquitectura de sistemas.',
  },
  {
    name: 'Alexandra Fetisova',
    role: 'Especialista en Algoritmos Predictivos y Ciencia de Datos',
    image: imgAlexandra,
    bio: 'Alexandra Fetisova es Maestra en Matemáticas por Stanford University, con especialización en desarrollo de modelos matemáticos, algoritmos predictivos e infraestructura de datos. Ha trabajado en entornos tecnológicos avanzados diseñando sistemas de análisis y optimización algorítmica utilizados en plataformas de gran escala, comparables con las utilizadas por empresas tecnológicas globales como Amazon. En INAKAT participa en la evaluación de perfiles relacionados con ciencia de datos, inteligencia artificial y desarrollo algorítmico.',
  },
  {
    name: 'Omar García Jane',
    role: 'Especialista en Psicología del Talento y Evaluación Socioemocional',
    image: imgOmar,
    bio: 'Omar García es Doctor en Psicología y Maestro en Educación por el Tecnológico de Monterrey. Ha participado como consejero y líder de proyectos académicos y de desarrollo humano en colaboración con organismos como Naciones Unidas, el Instituto Nacional Electoral y el Consejo de la Judicatura Federal, entre otros. Su trabajo se centra en evaluación del talento, orientación socioemocional, liderazgo y desarrollo humano. En INAKAT participa evaluando perfiles desde la perspectiva psicológica, humana y de desarrollo profesional.',
  },
  {
    name: 'Andrea Ávalos',
    role: 'Especialista en Tecnología y Gestión de Productos Digitales',
    image: imgAndrea,
    bio: 'Andrea Ávalos es Ingeniera en Tecnologías Computacionales y Maestra en Administración por EGADE Business School del Tecnológico de Monterrey. Cuenta con experiencia liderando proyectos tecnológicos y desarrollo de productos digitales, integrando equipos multidisciplinarios de ingeniería, negocio y operación. Se ha desempeñado como Product Owner en distintos proyectos que requieren coordinación entre tecnología y estrategia organizacional. En INAKAT participa evaluando perfiles relacionados con gestión tecnológica, desarrollo de producto y liderazgo en proyectos digitales.',
  },
  {
    name: 'Sofía de León',
    role: 'Especialista en Operación de Proyectos y Eventos',
    image: imgSofia,
    bio: 'Sofía de León es Licenciada en Creación y Desarrollo de Empresas. Cuenta con experiencia en la organización, coordinación y operación de eventos deportivos, sociales y empresariales, gestionando logística, equipos de trabajo y experiencias para públicos diversos. Su enfoque combina visión empresarial con ejecución operativa, permitiendo evaluar perfiles relacionados con gestión de proyectos, coordinación operativa y organización de eventos.',
  },
  {
    name: 'Ernesto Zapata',
    role: 'Especialista en Finanzas y Evaluación Financiera de Proyectos',
    image: imgErnesto,
    bio: 'Ernesto Zapata es Licenciado en Finanzas por la Universidad Autónoma de Nuevo León y Maestro en Educación y Finanzas por la UNID. Ha participado como consultor financiero y consejero en múltiples organizaciones, apoyando en análisis financiero, planeación estratégica y sostenibilidad de proyectos. En INAKAT participa evaluando perfiles relacionados con finanzas, administración y toma de decisiones financieras.',
  },
  {
    name: 'André Gracia',
    role: 'Especialista en Producción Audiovisual y Narrativa Multimedia',
    image: imgAndre,
    bio: 'André Gracia es Licenciado en Producción Musical Digital por el Tecnológico de Monterrey. Se especializa en producción audiovisual, narrativa multimedia y desarrollo de contenido creativo, colaborando con organizaciones deportivas, sociales y empresariales. Ha participado en la creación de proyectos audiovisuales que integran comunicación, tecnología y storytelling visual. En INAKAT participa evaluando perfiles relacionados con producción audiovisual, medios digitales y comunicación creativa.',
  },
  {
    name: 'Alejandro Martínez',
    role: 'Ing. Electrónico · Sistemas Embebidos',
    image: imgAlejandro,
    bio: '',
  },
  {
    name: 'Denisse Tamez Escamilla',
    role: 'Especialista',
    image: imgDenisse,
    bio: '',
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
              <div className="w-32 h-32 rounded-full overflow-hidden bg-custom-beige mb-4">
                <Image
                  src={selectedExpert.image}
                  alt={selectedExpert.name}
                  width={128}
                  height={128}
                  quality={90}
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
                {selectedExpert.bio || 'Descripción próximamente.'}
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
