// RUTA: src/components/sections/talents/CierreTalentSection.tsx
//
// Cierre de la bolsa de trabajo, en suelo naranja (texto tinta: 4.87:1; blanco
// no pasa). Las tres razones que antes eran viñetas de la portada, ahora como
// lista editorial con el número en contorno que se rellena al pasar, y la
// invitación a registrarse. Dos arcos crecen desde el pie (el puente).
// Componente de servidor: sin JS y con movimiento reducido se lee entero.

import Link from 'next/link';
import { ArrowRight } from 'lucide-react';

const razones = [
  'Evaluación que resalta tu talento',
  'Empresas verificadas en todo México',
  'Proceso transparente en cada paso',
];

const TITULO = ['Te evalúan personas expertas,', 'no un algoritmo.'];

const CierreTalentSection = () => {
  return (
    <section className="hm-seccion hm-suelo--naranja tl-cierre" aria-labelledby="tl-cierre-titulo">
      <div className="tl-cierre__arcos" aria-hidden="true">
        <span />
        <span />
      </div>

      <div className="hm-wrap tl-cierre__dentro">
        <p className="hm-eyebrow">Por qué postularte con INAKAT</p>

        {/* Renglones en máscara ligada al scroll: el nombre accesible va en el
            h2 y los trozos se ocultan al lector (se leerían a pedazos). */}
        <h2 id="tl-cierre-titulo" className="hm-h2 tl-cierre__titulo mt-6" aria-label={TITULO.join(' ')}>
          <span className="tl-renglon hm-mask" aria-hidden="true">
            <span>{TITULO[0]}</span>
          </span>
          <span className="tl-renglon hm-mask" aria-hidden="true">
            <span>
              <em>{TITULO[1]}</em>
            </span>
          </span>
        </h2>

        <ol className="tl-razones">
          {razones.map((razon, i) => {
            const n = String(i + 1).padStart(2, '0');
            return (
              <li key={razon} className="tl-razon hm-rv">
                <span className="tl-num" data-t={n} aria-hidden="true">
                  <span>{n}</span>
                </span>
                <p className="tl-razon__texto">{razon}</p>
              </li>
            );
          })}
        </ol>

        <div className="tl-cierre__cta">
          <Link href="/register" className="hm-btn hm-btn--ink" data-hm-magnet>
            Regístrate ahora
            <ArrowRight aria-hidden="true" />
          </Link>
          <Link href="/login" className="hm-btn hm-btn--ghost">
            Ya tengo cuenta
          </Link>
        </div>
      </div>
    </section>
  );
};

export default CierreTalentSection;
