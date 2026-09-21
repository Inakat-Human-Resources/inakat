// RUTA: src/components/sections/home/HeroSection.tsx
// Portada emparedada: arcos (fondo) · línea 1 · ventana en arco · líneas 2 y 3 al frente.
// El h1 NO lleva transform ni opacity: si creara contexto de apilamiento, la ventana
// dejaría de poder quedar ENTRE las líneas del título.
import Link from 'next/link';
import Image from 'next/image';
import { ArrowRight } from 'lucide-react';
import heroImage from '@/assets/images/1-home/hero-inakat.jpg';

const lines = ['Contrata talento', 'que realmente', 'hace la diferencia.'];

const HeroSection = () => {
  return (
    <section className="hm-hero" data-hm-hero>
      <div className="hm-hero__arcs hm-plane" aria-hidden="true">
        <span className="hm-arc hm-arc--a" />
        <span className="hm-arc hm-arc--b" />
        <span className="hm-arc hm-arc--c" />
      </div>

      <div className="hm-wrap hm-hero__inner">
        <p className="hm-eyebrow">Reclutamiento con evaluación dual</p>

        {/* El título va partido en tres máscaras. Sin aria-label se leería
            "Contrata talento / que realmente / hace la diferencia." como tres
            trozos sueltos, así que el nombre accesible va en el h1 y los trozos
            se ocultan al lector de pantalla. */}
        <h1 className="hm-title" aria-label={lines.join(' ')}>
          <span className="hm-line hm-line--1" aria-hidden="true">
            <span style={{ '--i': 0 } as React.CSSProperties}>{lines[0]}</span>
          </span>
          <span className="hm-line hm-line--2" aria-hidden="true">
            <span style={{ '--i': 1 } as React.CSSProperties}>{lines[1]}</span>
          </span>
          <span className="hm-line hm-line--3" aria-hidden="true">
            <span style={{ '--i': 2 } as React.CSSProperties}>
              <em>{lines[2]}</em>
            </span>
          </span>
        </h1>

        <div className="hm-hero__piece hm-plane">
          <div className="hm-window">
            <Image
              src={heroImage}
              alt="Ilustración: profesionales de distintas disciplinas"
              priority
              placeholder="blur"
              sizes="(max-width: 860px) 72vw, 32vw"
            />
          </div>
          <span className="hm-dot hm-hero__dot" aria-hidden="true" />
          <span className="hm-dot hm-hero__dot2" aria-hidden="true" />
        </div>

        <div className="hm-hero__foot">
          <p className="hm-hero__sub">
            Evaluación dual: <strong>psicólogos + especialistas técnicos.</strong>
            <br />
            IA como apoyo. Personas que deciden.
          </p>
          <div className="hm-hero__cta">
            <Link href="/companies" className="hm-btn hm-btn--orange" data-hm-magnet>
              Registra tu Empresa
              <ArrowRight aria-hidden="true" />
            </Link>
            <Link href="/talents" className="hm-btn hm-btn--ghost" data-hm-magnet>
              Soy Candidato
            </Link>
          </div>
        </div>
      </div>

      <span className="hm-cue" aria-hidden="true">
        Desliza
      </span>
    </section>
  );
};

export default HeroSection;
