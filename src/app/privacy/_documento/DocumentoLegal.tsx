// RUTA: src/app/privacy/_documento/DocumentoLegal.tsx
//
// Maqueta de los documentos legales (/privacy y /terms) en el registro PÚBLICO
// «Arco». La importan las dos páginas (vive aquí, en una carpeta privada de
// /privacy, porque las dos rutas son del mismo bloque; sustituye a la de
// src/components/sections/legal, que ya no importa nadie).
//
// Un documento se LEE: cabecera en arena con el titular a escala de encuadre
// (remate serif, como el resto de páginas públicas) y el puente del isotipo
// —tres arcos que nacen de la costura entre arena y papel y el punto que los
// cruza al bajar—, y el texto sobre papel en una columna editorial de ~68
// caracteres, sin tarjeta. Al margen, fija mientras se lee, la nota de que el
// documento es PROVISIONAL (un solo aviso) y, cuando el texto crezca, el índice.
//
// El TEXTO lo pone cada página y es del cliente: aquí no se escribe ni una
// línea legal. La maqueta sólo añade el estado del documento («provisional»,
// ver la lista de decisiones del cliente en docs/PLAN-OPUS-2026-09.md, A.3).
import './documento.css';
import type { CSSProperties, ReactNode } from 'react';
import Link from 'next/link';
import { ArrowLeft, ArrowUpRight, Clock, Mail, MessageCircle } from 'lucide-react';
import Footer from '@/components/commons/Footer';
import SiteMotion from '@/components/ui/SiteMotion';
import TituloMascara from '@/components/ui/TituloMascara';
import { CONTACTO } from '@/lib/nav-publica';

export interface SeccionIndice {
  /** id del encabezado (h2) al que salta. */
  id: string;
  etiqueta: string;
}

interface DocumentoLegalProps {
  /** Arranque del titular (el h1), en estructura: «Política de». */
  titulo: string;
  /** Remate del titular en serif itálica: «privacidad». */
  remate: string;
  /** «Última actualización: …», tal como lo fija el cliente. */
  actualizado: string;
  /**
   * Índice del margen. Sólo se pinta con dos secciones o más: hoy los dos
   * documentos caben en una pantalla y no lo llevan. Cuando llegue el texto
   * definitivo, pasa aquí sus h2 (cada uno con su id).
   */
  indice?: SeccionIndice[];
  children: ReactNode;
}

export default function DocumentoLegal({
  titulo,
  remate,
  actualizado,
  indice = [],
  children,
}: DocumentoLegalProps) {
  const nombre = `${titulo} ${remate}`;
  const conIndice = indice.length >= 2;

  return (
    <>
      <main className="hm">
        {/* Progreso de lectura (ligado al scroll sólo con soporte; site.css). */}
        <div className="hm-progress" aria-hidden="true" />

        <section className="hm-suelo--arena dl-cabeza" aria-labelledby="dl-titulo">
          {/* El puente: tres arcos que nacen de la costura con el papel y el
              punto (la persona) que lo cruza al bajar. Decorativo. */}
          <div className="dl-puente" aria-hidden="true">
            <span className="dl-arco dl-arco--a" />
            <span className="dl-arco dl-arco--b" />
            <span className="dl-arco dl-arco--c" />
            <span className="dl-orbita">
              <span className="dl-punto" />
            </span>
          </div>

          <div className="hm-wrap">
            <p className="hm-eyebrow hm-entra">Legal</p>
            <TituloMascara
              como="h1"
              id="dl-titulo"
              className="hm-display mt-5"
              renglones={[{ texto: titulo }, { texto: remate, contenido: <em>{remate}</em> }]}
            />
            <p className="dl-fecha hm-entra" style={{ '--i': 1 } as CSSProperties}>
              {actualizado}
            </p>
          </div>
        </section>

        <section className="hm-suelo--papel dl-cuerpo" aria-label={`Texto: ${nombre}`}>
          <div className="hm-wrap dl-rejilla">
            <aside className="dl-margen" aria-label="Estado del documento">
              <div className="dl-margen__fijo">
                {/* El ÚNICO aviso de que el documento es provisional. */}
                <p className="dl-nota">
                  <Clock aria-hidden="true" />
                  <span>
                    <strong>Documento provisional.</strong> El texto definitivo
                    está pendiente de publicación.
                  </span>
                </p>

                {conIndice && (
                  <nav className="dl-indice" aria-labelledby="dl-indice-t">
                    <p id="dl-indice-t" className="dl-indice__titulo">
                      En este documento
                    </p>
                    <ol>
                      {indice.map((seccion, i) => (
                        <li key={seccion.id}>
                          <a href={`#${seccion.id}`}>
                            <span className="dl-indice__n" aria-hidden="true">
                              {String(i + 1).padStart(2, '0')}
                            </span>
                            {seccion.etiqueta}
                          </a>
                        </li>
                      ))}
                    </ol>
                  </nav>
                )}
              </div>
            </aside>

            <div className="dl-columna">
              <article className="dl-texto">{children}</article>

              <p className="dl-volver">
                <Link href="/">
                  <ArrowLeft aria-hidden="true" />
                  Volver al inicio
                </Link>
              </p>
            </div>
          </div>
        </section>
      </main>
      <Footer />
      <SiteMotion />
    </>
  );
}

/**
 * Cierre de contacto de los documentos legales: el texto de introducción lo
 * pone cada página (es del cliente); los canales salen de nav-publica.
 */
export function ContactoLegal({ children }: { children: ReactNode }) {
  return (
    <div className="dl-contacto">
      <p>{children}</p>
      <ul className="dl-canales">
        <li>
          <a className="dl-canal" href={`mailto:${CONTACTO.email}`}>
            <span className="dl-canal__icono" aria-hidden="true">
              <Mail />
            </span>
            <span>
              <span className="dl-canal__etiqueta">Email</span>
              <span className="dl-canal__valor">{CONTACTO.email}</span>
            </span>
            <ArrowUpRight className="dl-canal__flecha" aria-hidden="true" />
          </a>
        </li>
        <li>
          <a
            className="dl-canal"
            href={CONTACTO.whatsapp}
            target="_blank"
            rel="noopener noreferrer"
          >
            <span className="dl-canal__icono" aria-hidden="true">
              <MessageCircle />
            </span>
            <span>
              <span className="dl-canal__etiqueta">WhatsApp</span>
              <span className="dl-canal__valor">
                {CONTACTO.telefono}
                <span className="sr-only"> (se abre en otra pestaña)</span>
              </span>
            </span>
            <ArrowUpRight className="dl-canal__flecha" aria-hidden="true" />
          </a>
        </li>
      </ul>
    </div>
  );
}
