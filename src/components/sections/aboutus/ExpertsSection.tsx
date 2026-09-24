// RUTA: src/components/sections/aboutus/ExpertsSection.tsx
//
// /about · 6. Expertos (suelo arena). Cada experto asoma por una ventana en
// arco (el puente del isotipo); al pasar, el punto aparece a su pie. La ficha
// se abre en el Modal del sistema: role="dialog", foco atrapado, Escape,
// scroll de fondo bloqueado y el foco vuelve a la tarjeta al cerrar.
// Estilos: src/app/about/about.css (ab-).
'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Image, { StaticImageData } from 'next/image';
import { ArrowUpRight, Play } from 'lucide-react';
import Modal from '@/components/ui/Modal';
import { clasesBoton } from '@/components/ui/Button';
import imgGuillermo from '@/assets/images/2-about/guillermo-sanchez.png';
import imgAlexandra from '@/assets/images/2-about/alexandra-fetisova.png';
import imgOmar from '@/assets/images/2-about/omar-garcia.png';
import imgAndrea from '@/assets/images/2-about/andrea-avalos.png';
import imgSofia from '@/assets/images/2-about/sofia-deleon.png';
import imgErnesto from '@/assets/images/2-about/ernesto-zapata.png';
import imgAndre from '@/assets/images/2-about/andre-gracia.png';
import imgAlejandro from '@/assets/images/2-about/alejandro-martinez.png';
import imgDenisse from '@/assets/images/2-about/denisse.png';
import imgAdriana from '@/assets/images/2-about/adriana-lara.png';

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
  {
    name: 'Adriana Lara Ávalos',
    role: 'Especialista en Manufactura y Sistemas de Calidad',
    image: imgAdriana,
    bio: 'Ingeniera Industrial por el Tecnológico de Monterrey con minor en Sistemas y estancia académica en Hochschule Karlsruhe (Alemania). Manufacturing Engineer en KATCON México con experiencia en APQP, FMEA, IATF 16949 e ISO 9001/14001. Especialista en evaluar candidatos para roles de manufactura, calidad y mejora continua de procesos.',
  },
];

const ExpertsSection = () => {
  const [selectedExpert, setSelectedExpert] = useState<Expert | null>(null);
  // Tarjeta que abrió el modal: al cerrar hay que devolverle el foco (a11y).
  // El Modal ya devuelve el foco a lo que lo tenía al abrir, pero Safari no
  // enfoca un botón al pulsarlo: sin esta referencia, el foco caía en <body>.
  const tarjetaOrigenRef = useRef<HTMLButtonElement | null>(null);

  const cerrarModal = useCallback(() => setSelectedExpert(null), []);

  // Al cerrar, el foco vuelve a la tarjeta que abrió la ficha.
  useEffect(() => {
    if (selectedExpert) return;
    const origen = tarjetaOrigenRef.current;
    if (!origen) return;
    tarjetaOrigenRef.current = null;
    origen.focus({ preventScroll: true });
  }, [selectedExpert]);

  return (
    <>
      <section className="hm-suelo--arena ab-expertos" aria-labelledby="ab-expertos-t">
        <div className="hm-wrap ab-expertos__rejilla">
          {/* El encabezado es la primera celda de la rejilla (ocupa dos
              columnas): así las filas de 10 expertos salen completas en 2, 3,
              4 y 5 columnas. */}
          <div className="ab-expertos__cabeza">
            <p className="hm-eyebrow">Especialistas</p>
            <h2 id="ab-expertos-t" className="hm-h2">
              Conoce a los <em>expertos</em>
            </h2>
            <p className="ab-expertos__lead">
              Profesionales dedicados a encontrar el talento que tu empresa
              necesita.
            </p>
          </div>

          {experts.map((expert) => (
            // El revelado (hm-rv, ligado al scroll) vive en el envoltorio: si
            // estuviera en el propio botón, su transform anularía el hover.
            <div key={expert.name} className="hm-rv">
              <button
                type="button"
                aria-haspopup="dialog"
                // Guarda la tarjeta de origen para devolverle el foco al cerrar.
                onClick={(evento) => { tarjetaOrigenRef.current = evento.currentTarget; setSelectedExpert(expert); }}
                className="ab-experto"
              >
                <span className="ab-experto__ventana">
                  {/* Muy por debajo del pliegue: en diferido, para no competir
                      con la imagen de la portada. El nombre ya va en texto:
                      la foto es decorativa aquí. */}
                  <Image
                    src={expert.image}
                    alt=""
                    width={400}
                    height={500}
                    sizes="(min-width: 1320px) 250px, (min-width: 960px) 22vw, (min-width: 700px) 30vw, 46vw"
                    quality={85}
                    loading="lazy"
                  />
                </span>
                <span className="ab-experto__nombre">{expert.name}</span>
                <span className="ab-experto__rol">{expert.role}</span>
                <span className="ab-experto__ver" aria-hidden="true">
                  Ver perfil
                  <ArrowUpRight />
                </span>
              </button>
            </div>
          ))}
        </div>
      </section>

      {/* Ficha del experto: Modal del sistema (Capa al final de <body>). */}
      <Modal
        abierto={selectedExpert !== null}
        alCerrar={cerrarModal}
        titulo={selectedExpert?.name ?? ''}
        subtitulo={selectedExpert?.role}
        tamano="lg"
        pie={
          selectedExpert && (
            <>
              {/* Video: enlace externo si existe; si no, aviso en texto (un
                  botón deshabilitado no se puede enfocar ni explica nada). */}
              {selectedExpert.videoUrl ? (
                <a
                  href={selectedExpert.videoUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={clasesBoton({ variante: 'secundario' })}
                >
                  <Play aria-hidden="true" />
                  Ver video
                  <span className="sr-only"> (se abre en otra pestaña)</span>
                </a>
              ) : (
                <p className="inline-flex items-center gap-2 text-sm text-ink-muted">
                  <Play className="h-4 w-4" aria-hidden="true" />
                  Video próximamente
                </p>
              )}
            </>
          )
        }
      >
        {selectedExpert && (
          <div className="ab-ficha">
            <div className="ab-ficha__foto">
              <Image
                src={selectedExpert.image}
                alt={`Fotografía de ${selectedExpert.name}`}
                width={288}
                height={360}
                sizes="144px"
                quality={90}
              />
            </div>
            <p className={selectedExpert.bio ? 'ab-ficha__bio' : 'ab-ficha__bio ab-ficha__bio--vacia'}>
              {selectedExpert.bio || 'Descripción próximamente.'}
            </p>
          </div>
        )}
      </Modal>
    </>
  );
};

export default ExpertsSection;
