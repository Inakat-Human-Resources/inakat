// RUTA: src/components/sections/aboutus/AboutUsSection.tsx
//
// Primer tramo de /about en el registro público «Arco» (estilos en
// src/app/about/about.css, prefijo ab-). Cuatro suelos seguidos:
//   1. portada (arena): el único h1 y la foto dentro del puente;
//   2. el nombre (tinta): INAKAT a escala de página;
//   3. el modelo (papel): dos arcos —dos filtros humanos— sobre la persona;
//   4. la presencia (lima): las ciudades en grande.
// Los textos son los de siempre, sólo repartidos: la última frase del párrafo
// del modelo («Dos filtros humanos, cero decisiones automatizadas.») pasa a ser
// su titular. Sin JS y con movimiento reducido todo se lee en su estado final.
import Image from 'next/image';
import TituloMascara from '@/components/ui/TituloMascara';
import aboutImage from '@/assets/images/2-about/1.png';

// Las mismas siete ciudades que nombra el párrafo de presencia (y el mapa de la
// portada). OJO: la FAQ de la portada nombra cinco; está en la lista de
// pendientes del cliente (docs/HOME-REVAMP-2026-09.md).
const CIUDADES = ['CDMX', 'Monterrey', 'Guadalajara', 'Puebla', 'Querétaro', 'León', 'Mérida'];

const AboutUsSection = () => {
  return (
    <>
      {/* 1. PORTADA */}
      <section className="hm-suelo--arena ab-hero" aria-labelledby="ab-titulo">
        <div className="hm-wrap">
          <div className="ab-hero__cabeza">
            <div>
              <p className="hm-eyebrow hm-entra">Sobre nosotros</p>
              {/* Único h1 de /about, partido en máscaras: el nombre accesible
                  va en el encabezado y los trozos, ocultos (TituloMascara). */}
              <TituloMascara
                como="h1"
                id="ab-titulo"
                className="hm-display ab-hero__titulo mt-5"
                renglones={[{ texto: '¿Quiénes' }, { texto: 'somos?', contenido: <em>somos?</em> }]}
              />
            </div>
            <p className="hm-lead ab-hero__lead hm-entra" style={{ '--i': 1 } as React.CSSProperties}>
              Somos una empresa mexicana de reclutamiento especializado que nació
              con una convicción clara:{' '}
              <strong>
                las mejores contrataciones no las hace un algoritmo, las hacen
                personas que entienden a personas.
              </strong>
            </p>
          </div>

          <figure className="ab-hero__foto">
            <span className="ab-anillo ab-anillo--b" aria-hidden="true" />
            <span className="ab-anillo" aria-hidden="true" />
            <div className="ab-ventana">
              {/* Es la imagen del primer pantallazo (candidata a LCP): sin
                  loading="lazy". Es una foto de archivo, no el equipo de
                  INAKAT: el alt no lo presenta como tal (pendiente del
                  cliente: una fotografía real del equipo). */}
              <Image
                src={aboutImage}
                alt="Fotografía de archivo: dos profesionales revisan una tableta"
                sizes="(min-width: 1480px) 1370px, 94vw"
                priority
              />
            </div>
            <span className="hm-dot ab-hero__punto" aria-hidden="true" />
            <span className="hm-dot ab-hero__punto2" aria-hidden="true" />
          </figure>
        </div>
      </section>

      {/* 2. EL NOMBRE */}
      <section className="hm-suelo--tinta ab-nombre" aria-labelledby="ab-nombre-t">
        <span className="ab-nombre__arco" aria-hidden="true" />
        <div className="hm-wrap">
          <p className="hm-eyebrow">Nuestro nombre</p>
          <h2 id="ab-nombre-t" className="ab-nombre__palabra">
            {/* El contorno es decorativo (sólo se ve con scroll timelines): el
                lector de pantalla oye «INAKAT» una vez. data-t alimenta la
                tapa (::after) que esconde las costuras de la fuente variable
                (about.css, bloque de movimiento). */}
            <span className="ab-nombre__contorno" aria-hidden="true" data-t="INAKAT">
              INAKAT
            </span>
            <span className="ab-nombre__lleno">INAKAT</span>
          </h2>
          <div className="ab-nombre__cuerpo">
            <p className="ab-nombre__talento" aria-hidden="true">
              «talento»
            </p>
            <p className="ab-nombre__texto">
              <strong>INAKAT</strong> proviene de la palabra &quot;talento&quot; en lengua
              wayuu, una comunidad que honra las habilidades únicas de cada
              persona. Ese principio es el corazón de todo lo que hacemos.
            </p>
          </div>
        </div>
      </section>

      {/* 3. EL MODELO */}
      <section className="hm-suelo--papel ab-modelo" aria-labelledby="ab-modelo-t">
        <div className="hm-wrap ab-modelo__rejilla">
          <div>
            <p className="hm-eyebrow">Nuestro modelo</p>
            <h2 id="ab-modelo-t" className="hm-h2 mt-5">
              Dos filtros humanos, <em>cero decisiones automatizadas.</em>
            </h2>
            <p className="ab-modelo__texto">
              Nuestro modelo combina{' '}
              <strong>psicólogos organizacionales</strong> que evalúan actitud,
              valores y compatibilidad cultural, con{' '}
              <strong>especialistas técnicos líderes en su industria</strong> que
              validan que el candidato realmente domina su disciplina.
            </p>
          </div>

          {/* Los dos filtros: dos arcos que se cruzan sobre la persona. Repite
              lo que dice el párrafo, así que es decorativo. */}
          <div className="ab-filtros" aria-hidden="true">
            <div className="ab-filtros__lienzo">
              <span className="ab-filtro ab-filtro--a" />
              <span className="ab-filtro ab-filtro--b" />
              <span className="ab-filtros__punto" />
            </div>
            <div className="ab-filtros__rotulos">
              <span>Psicólogos organizacionales</span>
              <span>Especialistas técnicos</span>
            </div>
          </div>
        </div>
      </section>

      {/* 4. LA PRESENCIA */}
      <section className="hm-suelo--lima ab-presencia" aria-labelledby="ab-presencia-t">
        <span className="ab-presencia__arco" aria-hidden="true" />
        <div className="hm-wrap">
          <p className="hm-eyebrow">Presencia</p>
          <h2 id="ab-presencia-t" className="hm-h2 mt-5">
            El talento local <em>de cada región.</em>
          </h2>
          {/* Las ciudades a escala de cartel; el párrafo de abajo ya las nombra,
              así que la lista grande no se lee dos veces. */}
          <ul className="ab-ciudades" aria-hidden="true">
            {CIUDADES.map((ciudad) => (
              <li key={ciudad} className="hm-rv">
                {ciudad}
              </li>
            ))}
          </ul>
          <p className="ab-presencia__texto">
            Con presencia activa en las principales ciudades de México — CDMX,
            Monterrey, Guadalajara, Puebla, Querétaro, León y Mérida —
            conocemos el talento local de cada región y conectamos a las empresas
            con profesionales que{' '}
            <strong>
              de verdad pueden aportar a su equipo, su operación y sus metas.
            </strong>
          </p>
        </div>
      </section>
    </>
  );
};

export default AboutUsSection;
