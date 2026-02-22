// RUTA: src/components/sections/aboutus/SelectionProcessSection.tsx
'use client';

import { useInView } from '@/hooks/useInView';
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

const SelectionProcessSection = () => {
  const { ref, isInView } = useInView(0.1);

  return (
    <section
      ref={ref as React.RefObject<HTMLDivElement>}
      className="bg-title-dark py-16 md:py-24"
    >
      <div className="container mx-auto px-4">
        {/* Title */}
        <h2
          className={`animate-on-scroll ${isInView ? 'in-view' : ''} font-display text-3xl md:text-4xl lg:text-5xl font-bold text-white text-center mb-14`}
        >
          Nuestro Proceso de Selección
        </h2>

        {/* Main 9 steps grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 max-w-5xl mx-auto">
          {mainSteps.map((step, index) => {
            const Icon = step.icon;
            return (
              <div
                key={step.number}
                className={`animate-on-scroll ${isInView ? 'in-view' : ''} flex items-start gap-4 bg-white/5 rounded-xl p-5 hover:bg-white/10 transition-colors`}
                style={{ transitionDelay: `${index * 80}ms` }}
              >
                {/* Number circle */}
                <div className="flex-shrink-0 w-10 h-10 rounded-full bg-button-orange flex items-center justify-center">
                  <span className="text-white font-bold text-sm">
                    {step.number}
                  </span>
                </div>

                {/* Content */}
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <Icon className="w-4 h-4 text-button-green" />
                    <h3 className="font-display text-white font-semibold text-sm">
                      {step.title}
                    </h3>
                  </div>
                  <span className="inline-block px-2 py-0.5 bg-button-green/20 text-button-green text-xs rounded-full">
                    {step.duration}
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Divider */}
        <div className="max-w-5xl mx-auto my-10 flex items-center gap-4">
          <div className="flex-1 h-px bg-white/20" />
          <span className="text-white/40 text-sm font-medium uppercase tracking-wider">
            Post contratación
          </span>
          <div className="flex-1 h-px bg-white/20" />
        </div>

        {/* Post-hire steps */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 max-w-2xl mx-auto">
          {postSteps.map((step, index) => {
            const Icon = step.icon;
            return (
              <div
                key={step.number}
                className={`animate-on-scroll ${isInView ? 'in-view' : ''} flex items-center gap-4 bg-button-green/10 rounded-xl p-5 border border-button-green/20`}
                style={{ transitionDelay: `${(index + 9) * 80}ms` }}
              >
                <div className="flex-shrink-0 w-10 h-10 rounded-full bg-button-green flex items-center justify-center">
                  <span className="text-white font-bold text-sm">
                    {step.number}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Icon className="w-4 h-4 text-button-green" />
                  <h3 className="font-display text-white font-semibold text-sm">
                    {step.title}
                  </h3>
                </div>
              </div>
            );
          })}
        </div>

        {/* Closing text */}
        <p
          className={`animate-on-scroll ${isInView ? 'in-view' : ''} text-button-green font-semibold text-lg md:text-xl text-center mt-14 max-w-3xl mx-auto`}
          style={{ transitionDelay: '900ms' }}
        >
          Delega el proceso de reclutamiento en expertos, liberando a tu equipo
          para centrarse en objetivos clave.
        </p>
      </div>
    </section>
  );
};

export default SelectionProcessSection;
