// RUTA: src/components/sections/companies/CompaniesHeroSection.tsx
//
// Portada de /companies («Arco», registro público) y, pegada a ella, la banda
// de las tres garantías.
//
// - El titular baja en escalera (tres máscaras que suben al cargar, con
//   TituloMascara: aria-label en el h1 y trozos aria-hidden).
// - La foto vive en una ventana de MEDIO PUNTO: el puente del isotipo a escala
//   de página, apoyado en una línea de suelo; el punto naranja es la persona.
// - Las tres viñetas que antes iban en una lista pequeña bajo la entradilla
//   pasan a una banda naranja a toda escala (mismo texto, palabra por palabra).
//
// Componente de servidor: el único JS de movimiento es <SiteMotion /> (lo monta
// la página). Sin JS o con movimiento reducido todo está en su sitio.
import type { CSSProperties } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import heroImage from '@/assets/images/3-companies/1.png';
import TituloMascara from '@/components/ui/TituloMascara';

/** Las tres garantías de siempre, partidas en estructura + remate serif. */
const garantias = [
  { base: 'Evaluación psicológica', remate: 'por expertos' },
  { base: 'Validación técnica', remate: 'por especialistas' },
  { base: 'Candidatos evaluados', remate: 'en 2-4 semanas' },
];

const CompaniesHeroSection = () => {
  return (
    <>
      <section className="emp-hero hm-suelo--arena" data-hm-hero aria-labelledby="emp-hero-titulo">
        <div className="emp-hero__arcos hm-plane" aria-hidden="true">
          <span className="hm-arc hm-arc--a" />
          <span className="hm-arc hm-arc--b" />
          <span className="hm-arc hm-arc--c" />
        </div>

        <div className="hm-wrap emp-hero__inner">
          <p className="hm-eyebrow hm-entra" style={{ '--i': 0 } as CSSProperties}>
            Para empresas
          </p>

          <TituloMascara
            como="h1"
            id="emp-hero-titulo"
            className="hm-display emp-hero__titulo"
            renglones={[
              { texto: 'Encuentra al talento', className: 'emp-hero__r1' },
              { texto: 'que tu empresa', className: 'emp-hero__r2' },
              { texto: 'merece.', contenido: <em>merece.</em>, className: 'emp-hero__r3' },
            ]}
          />

          <div className="emp-hero__pie">
            <div className="hm-entra" style={{ '--i': 1 } as CSSProperties}>
              <p className="hm-lead">
                Publica tu vacante, nosotros nos encargamos del proceso de
                evaluación completo.
              </p>
              <div className="emp-hero__cta">
                <Link href="#register" className="hm-btn hm-btn--orange" data-hm-magnet>
                  Registra tu Empresa
                  <ArrowRight aria-hidden="true" />
                </Link>
                <Link href="#register" className="hm-btn hm-btn--ghost" data-hm-magnet>
                  Cotiza en tiempo real
                </Link>
              </div>
            </div>

            <figure className="emp-hero__marco hm-plane">
              <div className="emp-hero__ventana">
                <Image
                  src={heroImage}
                  alt="Dos profesionales revisan juntos una tableta"
                  priority
                  placeholder="blur"
                  sizes="(max-width: 899px) 92vw, 46vw"
                />
              </div>
              <span className="hm-dot emp-hero__punto" aria-hidden="true" />
              <span className="hm-dot emp-hero__punto2" aria-hidden="true" />
              <span className="emp-hero__sello" aria-hidden="true">
                Evaluación dual
              </span>
            </figure>
          </div>
        </div>
      </section>

      {/* La banda continúa la portada: no abre sección propia en el índice de
          encabezados. La cejilla es un rótulo visual (en mayúsculas por CSS,
          que el árbol de accesibilidad de Chrome leería «LO QUE RECIBES»); el
          nombre accesible lo lleva la lista numerada, en caja normal. */}
      <section className="hm-seccion hm-suelo--naranja emp-garantias">
        <span className="emp-garantias__arco" aria-hidden="true" />
        <div className="hm-wrap">
          <p className="hm-eyebrow" aria-hidden="true">
            Lo que recibes
          </p>
          <ol className="emp-garantias__lista" aria-label="Lo que recibes">
            {garantias.map((g, i) => (
              <li key={g.base} className="emp-garantia">
                <span className="emp-garantia__n" aria-hidden="true">
                  {String(i + 1).padStart(2, '0')}
                </span>
                <p className="emp-garantia__t">
                  <span className="hm-mask">
                    <span>
                      {g.base} <em>{g.remate}</em>
                    </span>
                  </span>
                </p>
              </li>
            ))}
          </ol>
        </div>
      </section>
    </>
  );
};

export default CompaniesHeroSection;
