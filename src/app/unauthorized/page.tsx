// RUTA: src/app/unauthorized/page.tsx
'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';

function UnauthorizedContent() {
  const searchParams = useSearchParams();
  const reason = searchParams.get('reason');

  return (
    <div className="max-w-md w-full text-center">
      <div className="bg-white rounded-lg shadow-lg p-8">
        <div className="text-6xl mb-4">🔒</div>

        <h1 className="text-3xl font-bold text-gray-900 mb-4">
          Acceso Denegado
        </h1>

        <p className="text-gray-600 mb-6">
          {reason === 'no-token' &&
            'Debes iniciar sesión para acceder a esta página.'}
          {reason === 'expired' &&
            'Tu sesión ha expirado. Por favor inicia sesión nuevamente.'}
          {reason === 'no-permission' &&
            'No tienes permisos para acceder a este recurso.'}
          {!reason && 'No tienes autorización para ver esta página.'}
        </p>

        <div className="space-y-3">
          <Link
            href="/login"
            className="block w-full bg-button-orange text-white py-3 px-6 rounded-lg hover:bg-orange-700 font-medium text-center"
          >
            Iniciar Sesión
          </Link>

          <Link
            href="/"
            className="block w-full bg-gray-200 text-gray-700 py-3 px-6 rounded-lg hover:bg-gray-300 font-medium text-center"
          >
            Ir al inicio
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function UnauthorizedPage() {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <Suspense fallback={<div className="text-center">Cargando...</div>}>
        <UnauthorizedContent />
      </Suspense>
    </div>
  );
}
