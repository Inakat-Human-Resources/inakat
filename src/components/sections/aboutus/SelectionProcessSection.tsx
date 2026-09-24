// RUTA: src/components/sections/aboutus/SelectionProcessSection.tsx
//
// Fuente ÚNICA de las 11 etapas del proceso de selección, con dos caras:
// - variant="arc": la escena fijada de la portada (ProcessArc + home.css). NO
//   se toca: la portada está aprobada por el cliente.
// - variant="grid" (por defecto): /about. El punto baja por un carril al
//   ritmo del scroll y cada número rellena su contorno al pasar por el centro
//   (src/app/about/about.css, prefijo ab-). Sin scroll timelines o con
//   movimiento reducido, el carril se ve completo y quieto.
// Sigue siendo componente de cliente para que la portada no cambie de
// frontera de hidratación (ya no usa hooks).
'use client';

import ProcessArc from '@/components/sections/home/ProcessArc';
import {
  FileText,
  Users,
  Search,
  ClipboardCheck,
  ShieldCheck,
  UserCheck,
  Send,
  Handshake,
  CheckCircle,
  HeartPulse,
  TrendingUp,
} from 'lucide-react';

const mainSteps = [
  {
    number: 1,
    title: 'Definición del perfil',
    duration: '1 día',
    icon: FileText,
  },
  {
    number: 2,
    title: 'Reunión inicial con el cliente',
    duration: '1 día (Opcional)',
    icon: Users,
  },
  {
    number: 3,
    title: 'Búsqueda activa de candidatos',
    duration: '5 días',
    icon: Search,
  },
  {
    number: 4,
    title: 'Evaluación de currículos',
    duration: '3 días',
    icon: ClipboardCheck,
  },
  {
    number: 5,
    title: 'Referencias y verificación',
    duration: '4 días',
    icon: ShieldCheck,
  },
  {
    number: 6,
    title: 'Entrevistas + pruebas técnicas + evaluación',
    duration: '4 días',
    icon: UserCheck,
  },
  {
    number: 7,
    title: 'Presentación de candidatos',
    duration: '1 día',
    icon: Send,
  },
  {
    number: 8,
    title: 'Entrevistas con el cliente',
    duration: '4 días',
    icon: Handshake,
  },
  {
    number: 9,
    title: 'Cierre de entrevistas',
    duration: '1 día',
    icon: CheckCircle,
  },
];

const postSteps = [
  {
    number: 10,
    title: 'Seguimiento post contratación',
    icon: HeartPulse,
  },
  {
    number: 11,
    title: 'Evaluación continua',
    icon: TrendingUp,
  },
];

interface SelectionProcessSectionProps {
  /** 'grid' = rejilla clásica (/about). 'arc' = escena fijada de la home (requiere src/app/home.css). */
  variant?: 'grid' | 'arc';
}

const SelectionProcessSection = ({ variant = 'grid' }: SelectionProcessSectionProps) => {
  if (variant === 'arc') {
    return (
      <ProcessArc
        steps={[
          ...mainSteps.map(({ number, title, duration }) => ({ number, title, tag: duration })),
          ...postSteps.map(({ number, title }) => ({ number, title, tag: 'Post contratación' })),
        ]}
      />
    );
  }

  return (
    <section className="hm-suelo--tinta hm-on-dark ab-proceso" aria-labelledby="ab-proceso-t">
      <div className="hm-wrap ab-proceso__rejilla">
        {/* Cabecera fija desde 1024 px (la sección devuelve overflow: visible). */}
        <div className="ab-proceso__cabeza">
          <p className="hm-eyebrow">Paso a paso</p>
          <h2 id="ab-proceso-t" className="hm-h2 mt-5">
            Nuestro proceso <em>de selección</em>
          </h2>
          <p className="ab-proceso__cierre">
            Delega el proceso de reclutamiento en expertos, liberando a tu equipo
            para centrarse en objetivos clave.
          </p>
        </div>

        <div className="ab-recorrido">
          {/* El carril: el punto (la persona) lo recorre al bajar. */}
          <span className="ab-carril" aria-hidden="true">
            <span className="ab-carril__lleno" />
            <span className="ab-carril__viajero" />
          </span>

          <ol className="ab-etapas">
            {mainSteps.map((step) => {
              const Icon = step.icon;
              const n = String(step.number).padStart(2, '0');
              return (
                <li key={step.number} className="ab-etapa">
                  {/* La lista ordenada ya numera para el lector de pantalla. */}
                  <span className="ab-etapa__n" data-t={n} aria-hidden="true">
                    <span>{n}</span>
                  </span>
                  <div>
                    <h3 className="ab-etapa__titulo">
                      <Icon aria-hidden="true" />
                      {step.title}
                    </h3>
                    <span className="ab-etapa__duracion">{step.duration}</span>
                  </div>
                </li>
              );
            })}
          </ol>

          <p className="ab-etapas__corte">Post contratación</p>

          <ol className="ab-etapas ab-etapas--post" start={mainSteps.length + 1}>
            {postSteps.map((step) => {
              const Icon = step.icon;
              const n = String(step.number).padStart(2, '0');
              return (
                <li key={step.number} className="ab-etapa">
                  <span className="ab-etapa__n" data-t={n} aria-hidden="true">
                    <span>{n}</span>
                  </span>
                  <div>
                    <h3 className="ab-etapa__titulo">
                      <Icon aria-hidden="true" />
                      {step.title}
                    </h3>
                  </div>
                </li>
              );
            })}
          </ol>
        </div>
      </div>
    </section>
  );
};

export default SelectionProcessSection;
