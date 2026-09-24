// RUTA: src/components/sections/talents/HeroTalentSection.tsx
//
// Portada de la bolsa de trabajo (/talents), registro PÚBLICO «Arco».
// Planos, de atrás hacia adelante:
//   1. los tres arcos del puente, que bajan y crecen al salir;
//   2. el titular en máscaras (TituloMascara: aria-label en el h1, trozos
//      aria-hidden);
//   3. la ventana en arco con la foto, que sube un poco más deprisa al salir,
//      y su puente: el punto naranja (la persona) lo CRUZA mientras bajas
//      hacia las vacantes, hasta el punto lima (ligado al scroll, talents.css).
// El buscador NO vive aquí: es la primera pieza de SearchPositionsSection y se
// acopla al pie de esta portada («el muelle»), cruzando del suelo arena al
// tinta de los resultados. Componente de servidor: sin JS se lee entero.

import type { CSSProperties } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { ArrowDown, ArrowRight } from 'lucide-react';
import talentsImage from '@/assets/images/4-talent/1.png';
import TituloMascara from '@/components/ui/TituloMascara';

const HeroTalentSection = () => {
  return (
    <section className="tl-hero">
      <div className="tl-hero__arcos" aria-hidden="true">
        <span className="hm-arc hm-arc--a" />
        <span className="hm-arc hm-arc--b" />
        <span className="hm-arc hm-arc--c" />
      </div>

      <div className="hm-wrap tl-hero__dentro">
        <p className="hm-eyebrow hm-entra" style={{ '--i': 0 } as CSSProperties}>
          Bolsa de trabajo
        </p>

        <TituloMascara
          como="h1"
          className="hm-display tl-hero__titulo"
          renglones={[
            { texto: 'Tu próximo gran paso' },
            { texto: 'profesional', className: 'tl-hero__l2' },
            { texto: 'empieza aquí.', contenido: <em>empieza aquí.</em>, className: 'tl-hero__l3' },
          ]}
        />

        {/* La ventana en arco con su puente: un aro concéntrico que el punto
            naranja (la persona) recorre al bajar, hasta el punto lima del otro
            lado. Fuera en móvil (no se descarga: display:none + carga diferida). */}
        <div className="tl-hero__pieza">
          <span className="tl-hero__aro" aria-hidden="true" />
          <div className="tl-ventana">
            <Image
              src={talentsImage}
              alt="Un equipo de trabajo revisa documentos en una reunión"
              placeholder="blur"
              sizes="(max-width: 1023px) 30vw, 24vw"
            />
          </div>
          <span className="tl-hero__corredor" aria-hidden="true" />
          <span className="hm-dot tl-hero__punto" aria-hidden="true" />
        </div>

        <div className="tl-hero__pie hm-entra" style={{ '--i': 1 } as CSSProperties}>
          <p className="hm-lead">
            Regístrate, crea tu perfil y conecta con las mejores empresas de México.
          </p>
          <div className="tl-hero__cta">
            <Link href="/register" className="hm-btn hm-btn--orange" data-hm-magnet>
              Regístrate ahora
              <ArrowRight aria-hidden="true" />
            </Link>
            <a href="#vacantes" className="hm-btn hm-btn--ghost tl-hero__bajar">
              Ver vacantes
              <ArrowDown aria-hidden="true" />
            </a>
          </div>
        </div>
      </div>
    </section>
  );
};

export default HeroTalentSection;
