// RUTA: src/app/not-found.tsx
import Link from 'next/link';
import Footer from '@/components/commons/Footer';

export default function NotFound() {
  return (
    <main className="min-h-screen bg-custom-beige flex flex-col">
      <div className="flex-1 flex items-center justify-center px-4">
        <div className="text-center">
          <h1 className="font-display text-7xl font-bold text-title-dark mb-2">404</h1>
          <p className="font-display text-xl text-title-dark mb-2">Página no encontrada</p>
          <p className="text-text-black/60 text-lg mb-8 max-w-md mx-auto">
            La página que buscas no existe o fue movida.
          </p>
          <Link
            href="/"
            className="inline-flex bg-button-orange text-white font-semibold px-8 py-3 rounded-full hover:scale-105 hover:shadow-lg transition-all duration-300"
          >
            Volver al inicio
          </Link>
        </div>
      </div>
      <Footer />
    </main>
  );
}
