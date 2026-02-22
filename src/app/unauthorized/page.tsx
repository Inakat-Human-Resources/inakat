// RUTA: src/app/unauthorized/page.tsx
'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import { ShieldX } from 'lucide-react';
import Footer from '@/components/commons/Footer';

function UnauthorizedContent() {
  const searchParams = useSearchParams();
  const reason = searchParams.get('reason');

  const getMessage = () => {
    switch (reason) {
      case 'no-token':
        return 'Debes iniciar sesión para acceder a esta página.';
      case 'expired':
        return 'Tu sesión ha expirado. Por favor inicia sesión nuevamente.';
      case 'no-permission':
        return 'No tienes permisos para acceder a este recurso.';
      default:
        return 'No tienes autorización para ver esta página.';
    }
  };

  return (
    <div className="text-center max-w-md mx-auto">
      <div className="w-20 h-20 rounded-full bg-button-orange/10 flex items-center justify-center mx-auto mb-6">
        <ShieldX className="w-10 h-10 text-button-orange" />
      </div>

      <h1 className="font-display text-3xl font-bold text-title-dark mb-3">
        Acceso Denegado
      </h1>

      <p className="text-text-black/60 text-lg mb-8">
        {getMessage()}
      </p>

      <div className="flex flex-col sm:flex-row gap-3 justify-center">
        <Link
          href="/login"
          className="inline-flex items-center justify-center bg-button-orange text-white font-semibold px-8 py-3 rounded-full hover:scale-105 hover:shadow-lg transition-all duration-300"
        >
          Iniciar Sesión
        </Link>
        <Link
          href="/"
          className="inline-flex items-center justify-center border-2 border-title-dark/20 text-title-dark font-semibold px-8 py-3 rounded-full hover:bg-title-dark hover:text-white transition-all duration-300"
        >
          Ir al inicio
        </Link>
      </div>
    </div>
  );
}

export default function UnauthorizedPage() {
  return (
    <main className="min-h-screen bg-custom-beige flex flex-col">
      <div className="flex-1 flex items-center justify-center px-4">
        <Suspense
          fallback={
            <div className="text-center text-text-black/50">Cargando...</div>
          }
        >
          <UnauthorizedContent />
        </Suspense>
      </div>
      <Footer />
    </main>
  );
}
