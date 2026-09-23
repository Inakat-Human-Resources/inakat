// RUTA: src/app/global-error.tsx
'use client';

import { useEffect } from 'react';

/**
 * Último recurso: cubre los fallos del propio root layout (por ejemplo, una
 * excepción del Navbar, que vive fuera de {children} y por tanto fuera del
 * alcance de src/app/error.tsx). Debe renderizar sus propios <html> y <body>.
 */
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
          backgroundColor: '#e8e7d4',
          color: '#333333',
          fontFamily: 'system-ui, -apple-system, sans-serif',
          padding: '1rem',
        }}
      >
        <div style={{ textAlign: 'center', maxWidth: '28rem' }}>
          <h2
            style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '0.5rem' }}
          >
            Algo salió mal
          </h2>
          <p style={{ opacity: 0.7, marginBottom: '1.5rem' }}>
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
              onClick={reset}
              style={{
                padding: '0.5rem 1.5rem',
                borderRadius: '9999px',
                border: 'none',
                backgroundColor: '#f48602',
                color: '#ffffff',
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
              style={{
                padding: '0.5rem 1.5rem',
                borderRadius: '9999px',
                border: '1px solid #2b5d62',
                color: '#2b5d62',
                textDecoration: 'none',
              }}
            >
              Ir al inicio
            </a>
          </div>
        </div>
      </body>
    </html>
  );
}
