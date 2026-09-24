// RUTA: src/components/sections/aboutus/OurCompromiseSection.tsx
//
// /about · 5. Compromiso (suelo verde azulado). Dos pilares con los textos de
// siempre: la evaluación experta (su última frase, como cita en serif) y la
// promesa. El titular «Nuestro compromiso» existía sólo para lectores de
// pantalla; ahora también se ve. Estilos: src/app/about/about.css (ab-).
import { ShieldCheck, Heart } from 'lucide-react';

const OurCompromiseSection = () => {
  return (
    <section className="hm-suelo--teal hm-on-dark ab-compromiso" aria-labelledby="ab-compromiso-t">
      {/* Primer encabezado de la sección: nivel 2 (la jerarquía de /about
          baja del h1 de la portada sin saltarse niveles). */}
      <span className="ab-compromiso__arco" aria-hidden="true" />
      <div className="hm-wrap">
        <h2 id="ab-compromiso-t" className="hm-h2">
          Nuestro <em>compromiso</em>
        </h2>

        <div className="ab-compromiso__rejilla">
          <article className="ab-pilar hm-rv">
            <ShieldCheck className="ab-pilar__icono" aria-hidden="true" />
            <h3 className="ab-pilar__titulo">Evaluación profunda y experta</h3>
            <p>
              Todo el proceso está conducido por especialistas reales.{' '}
              <strong>Psicólogos expertos</strong> evalúan actitudes, valores,
              formas de trabajo, claridad de intención y compatibilidad
              cultural. <strong>Especialistas técnicos</strong> validan
              habilidades, experiencia y nivel de ejecución.
            </p>
            <p className="ab-pilar__cita">
              La tecnología y la IA nos ayudan a detectar señales relevantes,
              pero cada paso, cada filtro y cada elección está pensada y
              ejecutada por personas expertas.
            </p>
          </article>

          <article className="ab-pilar hm-rv">
            <Heart className="ab-pilar__icono" aria-hidden="true" />
            <h3 className="ab-pilar__titulo">Nuestra promesa</h3>
            <div className="ab-promesa">
              <p>
                Si creemos que un candidato no es adecuado, lo explicamos con
                fundamentos.
              </p>
              <p>
                Si vemos señales de alerta, las hacemos visibles. Y si
                encontramos una gran oportunidad para tu empresa, también te lo
                decimos con argumentos.
              </p>
              <p>
                No ofrecemos fórmulas genéricas ni promesas vacías. Ofrecemos{' '}
                <strong>claridad, criterio y compromiso</strong> para ayudarte a
                elegir bien.
              </p>
            </div>
          </article>
        </div>
      </div>
    </section>
  );
};

export default OurCompromiseSection;
