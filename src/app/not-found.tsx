// RUTA: src/app/not-found.tsx
//
// 404 en el registro PÚBLICO «Arco» (estilos en _estados/estados.css, prefijo
// es-). El cero del «404» es el puente del isotipo, con la persona debajo.
//
// Se pinta con el layout raíz: en rutas públicas lleva la barra encima, pero
// en las de aplicación (/admin/loquesea) NO hay barra ni AppShell. Por eso la
// página trae su propia salida: «Volver al inicio», «Ir a mi panel» si hay
// sesión (SalidaPanel) y los atajos al resto del sitio.
import './_estados/estados.css';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import Footer from '@/components/commons/Footer';
import SiteMotion from '@/components/ui/SiteMotion';
import TituloMascara from '@/components/ui/TituloMascara';
import { ENLACES_PUBLICOS } from '@/lib/nav-publica';
import SalidaPanel from './_estados/SalidaPanel';

// «Inicio» ya es el botón principal: los atajos son el resto del sitio.
const ATAJOS = ENLACES_PUBLICOS.filter((enlace) => enlace.href !== '/');

export default function NotFound() {
  return (
    <>
      <main className="hm">
        <section className="hm-suelo--arena es" aria-labelledby="es-titulo">
          <div className="es__arcos" aria-hidden="true">
            <span className="hm-arc hm-arc--a" />
            <span className="hm-arc hm-arc--b" />
            <span className="hm-arc hm-arc--c" />
          </div>

          <div className="hm-wrap es__dentro">
            <div>
              <p className="hm-eyebrow hm-entra">Error 404</p>
              <TituloMascara
                como="h1"
                id="es-titulo"
                className="hm-display es__titulo mt-5"
                renglones={[
                  { texto: 'Página no encontrada.' },
                  {
                    texto: 'Este puente no lleva a ninguna parte.',
                    contenido: <em>Este puente no lleva a ninguna parte.</em>,
                  },
                ]}
              />
              <p className="hm-lead mt-6 hm-entra" style={{ '--i': 1 } as React.CSSProperties}>
                La página que buscas no existe o fue movida.
              </p>

              <div className="es__acciones hm-entra" style={{ '--i': 2 } as React.CSSProperties}>
                <Link href="/" className="hm-btn hm-btn--orange" data-hm-magnet>
                  Volver al inicio
                  <ArrowRight aria-hidden="true" />
                </Link>
                <SalidaPanel />
              </div>

              <nav className="es__atajos hm-entra" style={{ '--i': 3 } as React.CSSProperties} aria-labelledby="es-atajos">
                <p id="es-atajos" className="es__atajos-titulo">
                  O sigue por aquí
                </p>
                <ul>
                  {ATAJOS.map((enlace) => (
                    <li key={enlace.href}>
                      <Link href={enlace.href}>{enlace.etiqueta}</Link>
                    </li>
                  ))}
                </ul>
              </nav>
            </div>

            {/* «4 ∩ 4»: decorativo, el código ya lo dice el antetítulo. */}
            <p className="es__cifra" aria-hidden="true">
              <span>4</span>
              <span className="es__puente">
                <span className="es__punto" />
              </span>
              <span>4</span>
            </p>
          </div>
        </section>
      </main>
      <Footer />
      <SiteMotion />
    </>
  );
}
