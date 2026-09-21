// RUTA: src/components/sections/home/DualCTASection.tsx
// Dos públicos, dos hojas que se apilan: la segunda cubre a la primera al bajar.
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';

const DualCTASection = () => {
  return (
    <section className="hm-duo" aria-label="Para empresas y para candidatos">
      <article className="hm-sheet hm-sheet--a">
        <span className="hm-sheet__shape" aria-hidden="true" />
        <div className="hm-wrap hm-sheet__grid">
          <div>
            <p className="hm-sheet__kicker">01 · Para Empresas</p>
            <h2 className="hm-sheet__title">
              Para empresas
              <em>¿Buscas talento calificado?</em>
            </h2>
          </div>
          <div className="hm-sheet__body">
            <p>
              Registra tu empresa y accede a nuestro proceso de selección
              experto. Recibe candidatos evaluados por psicólogos y
              especialistas técnicos.
            </p>
            <Link href="/companies" className="hm-btn hm-btn--ink" data-hm-magnet>
              Registrarme como Empresa
              <ArrowRight aria-hidden="true" />
            </Link>
          </div>
        </div>
      </article>

      <article className="hm-sheet hm-sheet--b">
        <span className="hm-sheet__shape" aria-hidden="true" />
        <div className="hm-wrap hm-sheet__grid">
          <div>
            <p className="hm-sheet__kicker">02 · Para Candidatos</p>
            <h2 className="hm-sheet__title">
              Para candidatos
              <em>¿Buscas tu próximo reto profesional?</em>
            </h2>
          </div>
          <div className="hm-sheet__body">
            <p>
              Sube tu CV y déjanos conectarte con las mejores empresas de
              México. Nuestro equipo te acompañará en cada paso del proceso.
            </p>
            <Link href="/talents" className="hm-btn hm-btn--ink" data-hm-magnet>
              Aplicar Ahora
              <ArrowRight aria-hidden="true" />
            </Link>
          </div>
        </div>
      </article>
    </section>
  );
};

export default DualCTASection;
