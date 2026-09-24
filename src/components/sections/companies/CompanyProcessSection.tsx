// RUTA: src/components/sections/companies/CompanyProcessSection.tsx
//
// «¿Cómo funciona INAKAT?» para empresas: el punto naranja (la persona) cruza
// el arco (el puente) y cada paso se enciende cuando pasa por su marca. Es un
// puente colgante: de cada marca baja un tirante al tablero y, bajo el
// tablero, la columna de su paso.
//
// El arco es REBAJADO: el mismo círculo del isotipo, pero con el centro hundido
// medio radio bajo el tablero, así que asoma un tramo de 120° (como un puente de
// verdad, más ancho que alto). Antes era un semicírculo: a 1440 medía 544 px de
// alto y, con la cabecera, llenaba la pantalla entera con un arco vacío y los
// pasos fuera de ella. Ahora arco + pasos caben juntos en una pantalla (y la
// cabecera con ellos a 1440×900 y 1024×768), también en el estado final: sin
// JS o con movimiento reducido se ven el puente y los cuatro pasos a la vez.
//
// Los cuatro pasos son los de la antigua src/components/sections/home/HowItWorksSection
// (sin tocar una palabra): ese componente quedó huérfano cuando la portada se
// rehízo y se borró; esta es la página a la que se dirigían («Publica tu vacante…»)
// y ahora es la única fuente de ese texto.
//
// Las marcas del arco son decorativas (aria-hidden); lo que se lee es la lista
// ordenada. Sin scroll timelines, sin JS o con movimiento reducido, el punto
// descansa al final del puente y todos los pasos están encendidos.
import type { CSSProperties } from 'react';

const steps = [
  {
    title: 'Publica tu vacante',
    description: 'Define el perfil que buscas y nosotros hacemos el resto.',
  },
  {
    title: 'Evaluamos al talento',
    description:
      'Psicólogos validan el fit humano. Especialistas validan la excelencia técnica.',
  },
  {
    title: 'Revisa candidatos evaluados',
    description:
      'Recibe una terna de candidatos calificados con reportes detallados.',
  },
  {
    title: 'Contrata con confianza',
    description:
      'Elige al mejor candidato sabiendo que fue validado por expertos reales.',
  },
];

/**
 * Geometría del puente, en radios (R) del círculo. Es la ÚNICA fuente: la
 * escena la pasa a la hoja como variables (--hundido, --cuerda, --lista, --pie)
 * y companies.css no repite ningún número.
 */
/** Cuánto se hunde el centro del círculo bajo el tablero. 0.5 → asoma un tramo de ±60°. */
const HUNDIDO = 0.5;
/** Ángulo del pie del arco, donde toca el tablero (0° = arriba). */
const PIE = (Math.acos(HUNDIDO) * 180) / Math.PI;
/** Ancho del arco sobre el tablero (la cuerda): 2 · sen(pie) ≈ 1.73 R. */
const CUERDA = 2 * Math.sin((PIE * Math.PI) / 180);
/** Ancho de la lista de pasos en escritorio: cuatro columnas bajo el arco. */
const LISTA = 1.7;

/**
 * Ángulo de cada marca sobre el arco: el que cae justo encima del centro de su
 * columna (a ±1/8 y ±3/8 del ancho de la lista). Salen ≈ ±12.3° y ±39.6°.
 */
const ANGULOS = [-3, -1, 1, 3].map((k) => (Math.asin((k / 8) * LISTA) * 180) / Math.PI);

const grados = (angulo: number) => (angulo * Math.PI) / 180;

/** Fracción del recorrido (de −pie a +pie) en la que el punto pasa por cada marca. */
const fraccion = (angulo: number) => ((angulo + PIE) / (2 * PIE)).toFixed(4);

/** Posición de cada marca: x desde el centro y altura sobre el tablero, en radios. */
const posicion = (angulo: number) =>
  ({
    '--x': Math.sin(grados(angulo)).toFixed(4),
    '--y': (Math.cos(grados(angulo)) - HUNDIDO).toFixed(4),
    '--f': fraccion(angulo),
  }) as CSSProperties;

const geometria = {
  '--hundido': String(HUNDIDO),
  '--cuerda': CUERDA.toFixed(4),
  '--lista': String(LISTA),
  '--pie': `${PIE.toFixed(2)}deg`,
} as CSSProperties;

const CompanyProcessSection = () => {
  return (
    <section className="emp-proceso hm-suelo--papel" aria-labelledby="emp-proceso-titulo">
      <div className="hm-wrap">
        <div className="emp-proceso__cabeza">
          <p className="hm-eyebrow">Paso a paso</p>
          <h2 id="emp-proceso-titulo" className="hm-h2">
            ¿Cómo funciona <em>INAKAT?</em>
          </h2>
        </div>

        <div className="emp-proceso__escena" style={geometria}>
          <div className="emp-arco" aria-hidden="true">
            {/* El vano recorta los anillos a ras del tablero: del círculo sólo
                asoma el arco. */}
            <span className="emp-arco__vano">
              <span className="emp-arco__anillo" />
              <span className="emp-arco__anillo emp-arco__anillo--in" />
            </span>
            <span className="emp-arco__suelo" />
            {ANGULOS.map((angulo) => (
              <span
                key={`tirante-${angulo}`}
                className="emp-arco__tirante"
                style={posicion(angulo)}
              />
            ))}
            <span className="emp-arco__corredor" />
            {ANGULOS.map((angulo, i) => (
              <span
                key={angulo}
                className="emp-arco__marca"
                data-n={i + 1}
                style={posicion(angulo)}
              >
                {i + 1}
              </span>
            ))}
          </div>

          <ol className="emp-pasos">
            {steps.map((step, i) => (
              <li
                key={step.title}
                className="emp-paso"
                style={{ '--f': fraccion(ANGULOS[i]) } as CSSProperties}
              >
                <span className="emp-paso__n" aria-hidden="true">
                  {String(i + 1).padStart(2, '0')}
                </span>
                <h3 className="emp-paso__t">{step.title}</h3>
                <p className="emp-paso__d">{step.description}</p>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </section>
  );
};

export default CompanyProcessSection;
