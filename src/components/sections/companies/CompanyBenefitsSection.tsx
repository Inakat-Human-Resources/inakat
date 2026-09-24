// RUTA: src/components/sections/companies/CompanyBenefitsSection.tsx
//
// «¿Por qué elegir INAKAT?» — seis razones, cada una en una ventana en arco.
//
// En escritorio (con scroll timelines y movimiento permitido) la escena se fija
// y la pista de arcos pasa de lado mientras se baja; abajo, el punto naranja
// recorre el puente y dice cuánto falta. En escritorio sin soporte o con
// movimiento reducido es una rejilla; bajo 900 px, un carrusel que se desliza
// con el dedo. Mismo DOM y mismo orden de lectura en los tres casos.
//
// Componente de servidor (antes era cliente sólo por useInView).
import type { CSSProperties } from 'react';
import { ArrowRight, Users, Globe, Trophy, Link2, HeartHandshake, Zap } from 'lucide-react';

const benefits = [
  {
    icon: Users,
    title: 'Enfoque centrado en el talento y la empresa',
    description:
      'Conectamos personas con organizaciones evaluando tanto habilidades como compatibilidad cultural.',
  },
  {
    icon: Globe,
    title: 'Amplia cobertura geográfica',
    description:
      'Presencia en toda la República Mexicana para encontrar talento local en cualquier región.',
  },
  {
    icon: Trophy,
    title: 'Compromiso con la excelencia',
    description:
      'Cada candidato pasa por evaluación dual: psicológica y técnica por especialistas reales.',
  },
  {
    icon: Link2,
    title: 'Conexiones estratégicas',
    description:
      'Red de contactos en las principales ciudades e industrias de México.',
  },
  {
    icon: HeartHandshake,
    title: 'Enfoque en el cliente',
    description:
      'Entendemos las necesidades específicas de tu empresa para encontrar el match perfecto.',
  },
  {
    icon: Zap,
    title: 'Ágiles y flexibles',
    description:
      'Procesos eficientes que entregan candidatos evaluados en 2 a 4 semanas.',
  },
];

const CompanyBenefitsSection = () => {
  return (
    <section
      className="emp-razones hm-suelo--teal"
      aria-labelledby="emp-razones-titulo"
      // --n: cuántas tarjetas hay; la hoja calcula con él el recorrido de la pista.
      style={{ '--n': benefits.length } as CSSProperties}
    >
      <div className="emp-razones__escena">
        <div className="hm-wrap emp-razones__cabeza">
          <p className="hm-eyebrow">Por qué INAKAT</p>
          <h2 id="emp-razones-titulo" className="hm-h2">
            ¿Por qué elegir <em>INAKAT?</em>
          </h2>
        </div>

        <ol className="emp-razones__pista">
          {benefits.map((benefit, index) => {
            const Icon = benefit.icon;
            return (
              <li key={benefit.title} className="emp-razon hm-rv">
                <div className="emp-razon__arco" aria-hidden="true">
                  <span className="emp-razon__n">{String(index + 1).padStart(2, '0')}</span>
                  <span className="emp-razon__icono">
                    <Icon />
                  </span>
                </div>
                <h3 className="emp-razon__t">{benefit.title}</h3>
                <p className="emp-razon__d">{benefit.description}</p>
              </li>
            );
          })}
        </ol>

        {/* Sólo en el carrusel de móvil (la hoja lo enseña bajo 900 px). */}
        <p className="emp-razones__desliza" aria-hidden="true">
          Desliza para ver las seis <ArrowRight />
        </p>

        <div className="emp-razones__puente" aria-hidden="true">
          <span className="emp-razones__avance" />
        </div>
      </div>
    </section>
  );
};

export default CompanyBenefitsSection;
