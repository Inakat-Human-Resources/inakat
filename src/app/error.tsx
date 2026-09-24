// RUTA: src/app/error.tsx
'use client';

import './_estados/estados.css';
import { useEffect } from 'react';
import Link from 'next/link';
import { RotateCcw } from 'lucide-react';

/**
 * Error boundary raíz: cubre cualquier excepción de render en páginas públicas
 * y en los paneles (company/recruiter/specialist/candidate/vendor). Sin esto,
 * Next muestra su pantalla genérica en inglés, sin forma de volver.
 *
 * Registro «Arco» (estilos en _estados/estados.css, prefijo es-). Sustituye a
 * todo lo que cuelga del layout raíz —también al AppShell de una sección—, así
 * que lleva su propio <main> y sus propias salidas: reintentar e ir al inicio.
 * Sin animaciones de entrada: quien llega aquí no necesita espectáculo.
 */
export default function RootError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Error de aplicación:', error, error.digest);
  }, [error]);

  return (
    <main className="hm">
      <section className="hm-suelo--arena es es--error" aria-labelledby="es-titulo">
        <div className="es__arcos" aria-hidden="true">
          <span className="hm-arc hm-arc--b" />
          <span className="hm-arc hm-arc--c" />
        </div>

        <div className="hm-wrap es__dentro">
          <div>
            <p className="hm-eyebrow">Error inesperado</p>
            <h1 id="es-titulo" className="hm-display es__titulo mt-5">
              Algo salió mal. <em>No fue culpa tuya.</em>
            </h1>
            <p className="hm-lead mt-6">
              Ocurrió un error inesperado al mostrar esta página. Puedes intentarlo
              de nuevo o volver al inicio.
            </p>
            {error.digest && (
              <p className="es__codigo">
                Código de referencia: <code>{error.digest}</code>
              </p>
            )}
            <div className="es__acciones">
              <button type="button" onClick={reset} className="hm-btn hm-btn--orange">
                <RotateCcw aria-hidden="true" />
                Reintentar
              </button>
              <Link href="/" className="hm-btn hm-btn--ghost">
                Ir al inicio
              </Link>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
