// RUTA: src/app/global-error.tsx
'use client';

import { useEffect } from 'react';

/**
 * Último recurso: cubre los fallos del propio root layout (por ejemplo, una
 * excepción de la barra pública, que vive fuera de {children} y por tanto
 * fuera del alcance de src/app/error.tsx). Debe renderizar sus propios <html>
 * y <body>.
 *
 * Como sustituye al layout raíz, aquí NO hay site.css, ni Tailwind, ni las
 * fuentes de next/font: todo va en línea (y un <style> mínimo para el foco y
 * el hover, que no se pueden escribir en `style`). Mismo registro «Arco»: arena,
 * el arco con el punto y el botón naranja con texto TINTA (4.87:1; el blanco
 * que llevaba daba 2.54 y no pasaba AA).
 */
const TINTA = '#283739';
const TEAL = '#2b5d62';
const LIMA = '#9fbb2f';
const NARANJA = '#f48602';
const ARENA = '#e8e7d4';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Error global de aplicación:', error, error.digest);
  }, [error]);

  return (
    <html lang="es">
      <body
        style={{
          margin: 0,
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: ARENA,
          color: TINTA,
          fontFamily:
            "system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif",
          padding: '1.25rem',
          boxSizing: 'border-box',
        }}
      >
        <style>{`
          .ge-accion { transition: transform .2s ease, background-color .2s ease, color .2s ease; }
          .ge-accion:hover { transform: translateY(-2px); }
          .ge-accion:focus-visible { outline: 3px solid ${TINTA}; outline-offset: 3px; }
          .ge-secundaria:hover { background-color: ${TINTA} !important; color: #fff !important; border-color: ${TINTA} !important; }
          @media (prefers-reduced-motion: reduce) { .ge-accion { transition: none; } .ge-accion:hover { transform: none; } }
        `}</style>
        <main style={{ textAlign: 'center', maxWidth: '34rem' }}>
          {/* El isotipo a escala: el puente (arco) y la persona (punto). */}
          <svg
            viewBox="0 0 120 64"
            width="120"
            height="64"
            aria-hidden="true"
            focusable="false"
            style={{ display: 'block', margin: '0 auto 1.75rem' }}
          >
            <path d="M8 62 A52 52 0 0 1 112 62" fill="none" stroke={TEAL} strokeOpacity="0.35" strokeWidth="3" />
            <path d="M26 62 A34 34 0 0 1 94 62" fill="none" stroke={LIMA} strokeWidth="3" />
            <circle cx="60" cy="52" r="8" fill={NARANJA} />
          </svg>
          <h1
            style={{
              margin: '0 0 0.75rem',
              fontSize: 'clamp(2rem, 1.4rem + 3vw, 3.25rem)',
              fontWeight: 800,
              lineHeight: 1,
              letterSpacing: '-0.035em',
            }}
          >
            Algo salió mal
          </h1>
          <p style={{ margin: '0 0 2rem', fontSize: '1.0625rem', lineHeight: 1.55 }}>
            No pudimos cargar la página. Intenta de nuevo; si el problema
            continúa, vuelve más tarde.
          </p>
          <div
            style={{
              display: 'flex',
              gap: '0.75rem',
              justifyContent: 'center',
              flexWrap: 'wrap',
            }}
          >
            <button
              type="button"
              onClick={reset}
              className="ge-accion"
              style={{
                minHeight: '3rem',
                padding: '0.75rem 1.75rem',
                borderRadius: '9999px',
                border: '2px solid transparent',
                backgroundColor: NARANJA,
                color: TINTA,
                font: 'inherit',
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              Reintentar
            </button>
            {/* Recarga completa a propósito: si falló el root layout, el router
                del cliente no es de fiar y <Link> haría una navegación suave
                sobre el mismo árbol roto. */}
            {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
            <a
              href="/"
              className="ge-accion ge-secundaria"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                minHeight: '3rem',
                padding: '0.75rem 1.75rem',
                borderRadius: '9999px',
                border: `2px solid ${TINTA}`,
                color: TINTA,
                fontWeight: 700,
                textDecoration: 'none',
                boxSizing: 'border-box',
              }}
            >
              Ir al inicio
            </a>
          </div>
          {error.digest && (
            <p style={{ margin: '1.75rem 0 0', fontSize: '0.875rem', color: 'rgb(40 55 57 / 0.8)' }}>
              Código de referencia: {error.digest}
            </p>
          )}
        </main>
      </body>
    </html>
  );
}
