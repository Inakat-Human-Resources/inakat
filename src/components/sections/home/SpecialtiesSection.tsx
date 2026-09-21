// RUTA: src/components/sections/home/SpecialtiesSection.tsx
'use client';

import { useEffect, useState } from 'react';

interface Specialty {
  name: string;
  subs: string[];
}

// Fallback en caso de que el endpoint falle o tarde.
// Coincide con los seeds iniciales del catálogo de especialidades.
const FALLBACK_SPECIALTIES: Specialty[] = [
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
  const [specialties, setSpecialties] =
    useState<Specialty[]>(FALLBACK_SPECIALTIES);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const res = await fetch('/api/specialties?subcategories=true', {
          cache: 'force-cache',
        });
        if (!res.ok) return;
        const json = await res.json();
        if (cancelled || !json?.success || !Array.isArray(json.data)) return;

        const mapped: Specialty[] = json.data
          .map((s: { name: string; subcategories?: string[] }) => ({
            name: s.name,
            subs: Array.isArray(s.subcategories) ? s.subcategories : [],
          }))
          .filter((s: Specialty) => s.name);

        if (mapped.length > 0) setSpecialties(mapped);
      } catch {
        // Mantener fallback ante cualquier error de red
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <section className="hm-esp hm-on-dark" aria-labelledby="hm-esp-title">
      <span className="hm-esp__ghost" aria-hidden="true">
        Especialidades
      </span>

      <div className="hm-wrap">
        <div className="hm-esp__head">
          <p className="hm-eyebrow">Áreas de especialidad</p>
          <h2 id="hm-esp-title" className="hm-h2">
            Especialistas en <em>{specialties.length} áreas clave</em>
          </h2>
          <p className="hm-esp__lead">
            Nuestros evaluadores son líderes en su campo. Selecciona una
            especialidad para ver las subcategorías.
          </p>
        </div>

        {/* <details name> = acordeón exclusivo nativo: funciona sin JS y con teclado */}
        <div className="hm-esp__list">
          {specialties.map((specialty, index) => (
            <details key={specialty.name} name="hm-esp" className="hm-esp__item">
              <summary>
                <span className="hm-esp__i" aria-hidden="true">
                  {String(index + 1).padStart(2, '0')}
                </span>
                <span className="hm-esp__name">{specialty.name}</span>
                <span className="hm-plus" aria-hidden="true" />
              </summary>
              {specialty.subs.length > 0 ? (
                <ul className="hm-esp__subs">
                  {specialty.subs.map((sub) => (
                    <li key={sub}>{sub}</li>
                  ))}
                </ul>
              ) : (
                <p className="hm-esp__empty">
                  Próximamente más detalles de esta especialidad.
                </p>
              )}
            </details>
          ))}
        </div>
      </div>
    </section>
  );
};

export default SpecialtiesSection;
