// RUTA: src/components/sections/aboutus/AboutCloseSection.tsx
//
// /about · 8. Cierre (suelo naranja, texto tinta: 4.87). Sustituye en /about a
// commons/CTAFinalSection (ya borrado), que pintaba blanco sobre naranja (2.54, no pasa AA)
// y no pertenecía al registro «Arco». Mismos textos y mismos destinos; el correo
// y el teléfono, que eran texto suelto, ahora son enlaces.
// Los dos arcos crecen desde el pie al llegar (about.css, prefijo ab-).
import Link from 'next/link';
import { ArrowRight, Mail, Phone } from 'lucide-react';
import { CONTACTO } from '@/lib/nav-publica';

// Titular partido en máscaras que suben al entrar en pantalla (hm-mask):
// el nombre accesible va en el encabezado y los trozos se ocultan.
const RENGLONES = ['Encuentra al talento', 'que tu empresa', 'necesita.'];

const AboutCloseSection = () => {
  return (
    <section className="hm-suelo--naranja ab-cierre" aria-labelledby="ab-cierre-t">
      <span className="ab-cierre__arco" aria-hidden="true" />
      <span className="ab-cierre__arco ab-cierre__arco--b" aria-hidden="true" />

      <div className="hm-wrap ab-cierre__dentro">
        <h2
          id="ab-cierre-t"
          className="ab-cierre__titulo"
          aria-label="Encuentra al talento que tu empresa necesita. Empieza hoy."
        >
          {RENGLONES.map((renglon) => (
            <span key={renglon} className="hm-mask" aria-hidden="true">
              <span>{renglon} </span>
            </span>
          ))}
          <span className="hm-mask" aria-hidden="true">
            <span>
              <em>Empieza hoy.</em>
            </span>
          </span>
        </h2>

        <div className="ab-cierre__cta">
          <Link href="/companies" className="hm-btn hm-btn--ink" data-hm-magnet>
            Registra tu Empresa
            <ArrowRight aria-hidden="true" />
          </Link>
          <Link href="/talents" className="hm-btn hm-btn--ghost" data-hm-magnet>
            Soy Candidato
          </Link>
        </div>

        <ul className="ab-cierre__contacto">
          <li>
            <a href={`mailto:${CONTACTO.email}`}>
              <Mail aria-hidden="true" />
              ¿Preguntas? {CONTACTO.email}
            </a>
          </li>
          <li>
            <a href={CONTACTO.telefonoHref}>
              <Phone aria-hidden="true" />
              {CONTACTO.telefono}
            </a>
          </li>
        </ul>
      </div>
    </section>
  );
};

export default AboutCloseSection;
