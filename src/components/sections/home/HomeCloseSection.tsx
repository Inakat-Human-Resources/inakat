// RUTA: src/components/sections/home/HomeCloseSection.tsx
// Cierre de la home: ventana fija (el fondo se queda quieto mientras la página pasa)
// con los dos arcos del isotipo creciendo. /about sigue usando CTAFinalSection.
import Link from 'next/link';
import { ArrowRight, Mail, Phone } from 'lucide-react';

const HomeCloseSection = () => {
  return (
    <section className="hm-close hm-on-dark" aria-labelledby="hm-close-title">
      <div className="hm-close__bg" aria-hidden="true">
        <span className="hm-close__arc" />
        <span className="hm-close__arc" />
      </div>

      <div className="hm-wrap hm-close__inner">
        <h2 id="hm-close-title" className="hm-close__title">
          Encuentra al talento que tu empresa necesita.
          <em>Empieza hoy.</em>
        </h2>

        <div className="hm-close__cta">
          <Link href="/companies" className="hm-btn hm-btn--orange" data-hm-magnet>
            Registra tu Empresa
            <ArrowRight aria-hidden="true" />
          </Link>
          <Link href="/talents" className="hm-btn hm-btn--lime" data-hm-magnet>
            Soy Candidato
          </Link>
        </div>

        <ul className="hm-close__contact">
          <li>
            <a href="mailto:info@inakat.com">
              <Mail aria-hidden="true" />
              ¿Preguntas? info@inakat.com
            </a>
          </li>
          <li>
            <a href="tel:+528116312490">
              <Phone aria-hidden="true" />
              +52 811 631 2490
            </a>
          </li>
        </ul>
      </div>
    </section>
  );
};

export default HomeCloseSection;
