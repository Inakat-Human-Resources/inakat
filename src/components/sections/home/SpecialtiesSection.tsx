// RUTA: src/components/sections/home/SpecialtiesSection.tsx
'use client';

import { useState } from 'react';
import { useInView } from '@/hooks/useInView';

const specialties = [
  {
    name: 'Psicología, Educación y Ciencias Humanas',
    subs: [
      'Psicología clínica y organizacional',
      'Pedagogía',
      'Trabajo social',
      'Investigación educativa',
    ],
  },
  {
    name: 'Tecnologías de la Información',
    subs: [
      'Desarrollo de software',
      'Ciberseguridad',
      'Data Science',
      'DevOps',
      'Soporte TI',
    ],
  },
  {
    name: 'Ingeniería y Tecnología Avanzada',
    subs: [
      'Mecatrónica',
      'Industrial',
      'Civil',
      'Electrónica',
      'Manufactura',
    ],
  },
  {
    name: 'Negocios, Administración y Finanzas',
    subs: [
      'Contabilidad',
      'Finanzas',
      'Administración',
      'Comercio exterior',
    ],
  },
  {
    name: 'Marketing, Comunicación y Diseño',
    subs: [
      'Marketing digital',
      'Diseño gráfico y UX',
      'Comunicación corporativa',
      'Publicidad',
    ],
  },
  {
    name: 'Talento, Gestión y Operación de Oficinas',
    subs: [
      'Recursos Humanos',
      'Administración de oficinas',
      'Asistentes ejecutivos',
      'Logística',
    ],
  },
  {
    name: 'Salud y Bienestar',
    subs: [
      'Medicina',
      'Enfermería',
      'Nutrición',
      'Salud ocupacional',
    ],
  },
];

const SpecialtiesSection = () => {
  const { ref, isInView } = useInView(0.15);
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);

  return (
    <section
      ref={ref as React.RefObject<HTMLDivElement>}
      className="bg-title-dark py-16 md:py-24"
    >
      <div className="container mx-auto px-4">
        {/* Section title */}
        <h2
          className={`animate-on-scroll ${isInView ? 'in-view' : ''} font-display text-3xl md:text-4xl lg:text-5xl font-bold text-white text-center mb-4`}
        >
          Especialistas en{' '}
          <span className="text-button-green">7 áreas clave</span>
        </h2>
        <p
          className={`animate-on-scroll ${isInView ? 'in-view' : ''} text-white/60 text-lg text-center mb-14 max-w-2xl mx-auto`}
          style={{ transitionDelay: '100ms' }}
        >
          Nuestros evaluadores son líderes en su campo. Selecciona una
          especialidad para ver las subcategorías.
        </p>

        {/* Pills grid */}
        <div className="flex flex-wrap justify-center gap-4 max-w-4xl mx-auto">
          {specialties.map((specialty, index) => (
            <div
              key={index}
              className={`animate-on-scroll ${isInView ? 'in-view' : ''}`}
              style={{ transitionDelay: `${index * 80}ms` }}
            >
              <button
                onClick={() =>
                  setExpandedIndex(expandedIndex === index ? null : index)
                }
                className={`px-6 py-3 rounded-full border-2 font-medium text-sm md:text-base transition-all duration-300 ${
                  expandedIndex === index
                    ? 'bg-button-green border-button-green text-white scale-105'
                    : 'border-button-green/60 text-white hover:border-button-green hover:bg-button-green/10'
                }`}
              >
                {specialty.name}
              </button>
            </div>
          ))}
        </div>

        {/* Expanded subcategories */}
        {expandedIndex !== null && (
          <div className="mt-8 max-w-3xl mx-auto">
            <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-6 md:p-8">
              <h3 className="font-display text-lg font-semibold text-button-green mb-4">
                {specialties[expandedIndex].name}
              </h3>
              <div className="flex flex-wrap gap-3">
                {specialties[expandedIndex].subs.map((sub, i) => (
                  <span
                    key={i}
                    className="px-4 py-2 bg-white/10 rounded-lg text-white/90 text-sm"
                  >
                    {sub}
                  </span>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </section>
  );
};

export default SpecialtiesSection;
