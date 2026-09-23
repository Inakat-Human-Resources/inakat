// RUTA: src/app/error.tsx
'use client';

import { useEffect } from 'react';
import Link from 'next/link';

/**
 * Error boundary raíz: cubre cualquier excepción de render en páginas públicas
 * y en los paneles (company/recruiter/specialist/candidate/vendor). Sin esto,
 * Next muestra su pantalla genérica en inglés, sin forma de volver.
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
    <div className="min-h-screen bg-custom-beige flex items-center justify-center px-4">
      <div className="text-center max-w-md">
        <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
          <span className="text-red-600 text-2xl font-bold">!</span>
        </div>
        <h2 className="font-display text-xl md:text-2xl font-bold text-title-dark mb-2">
          Algo salió mal
        </h2>
        <p className="text-text-black/60 mb-6">
          Ocurrió un error inesperado al mostrar esta página. Puedes intentarlo
          de nuevo o volver al inicio.
        </p>
        {error.digest && (
          <p className="text-xs text-text-black/40 mb-6">
            Código de referencia: {error.digest}
          </p>
        )}
        <div className="flex flex-wrap gap-3 justify-center">
          <button
            onClick={reset}
            className="px-6 py-2 bg-button-orange text-white rounded-full hover:bg-opacity-90 transition-colors"
          >
            Reintentar
          </button>
          <Link
            href="/"
            className="px-6 py-2 border border-button-dark-green text-button-dark-green rounded-full hover:bg-button-dark-green hover:text-white transition-colors"
          >
            Ir al inicio
          </Link>
        </div>
      </div>
    </div>
  );
}
