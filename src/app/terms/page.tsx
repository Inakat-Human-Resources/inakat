// RUTA: src/app/terms/page.tsx
import Footer from '@/components/commons/Footer';
import Link from 'next/link';

export default function TermsPage() {
  return (
    <main className="min-h-screen">
      <section className="bg-custom-beige py-16 md:py-24">
        <div className="container mx-auto px-4 max-w-3xl">
          <h1 className="font-display text-3xl md:text-4xl lg:text-5xl font-bold text-title-dark mb-8">
            Términos y Condiciones
          </h1>

          <div className="bg-white rounded-2xl p-8 md:p-10 shadow-sm space-y-6 text-text-black/80 leading-relaxed">
            <p>
              Esta página está en construcción. Los términos y condiciones completos de INAKAT estarán disponibles próximamente.
            </p>

            <div className="bg-soft-green/10 border-l-4 border-button-orange rounded-r-lg p-5">
              <p>
                Si tienes preguntas legales o necesitas información sobre nuestras políticas, contáctanos directamente:
              </p>
              <ul className="mt-3 space-y-2">
                <li>
                  <a href="mailto:info@inakat.com" className="text-button-dark-green hover:underline font-medium">info@inakat.com</a>
                </li>
                <li>
                  <a href="https://wa.me/528116312490" target="_blank" rel="noopener noreferrer" className="text-button-dark-green hover:underline font-medium">WhatsApp: +52 811 631 2490</a>
                </li>
              </ul>
            </div>

            <p className="text-sm text-text-black/50">
              Última actualización: Febrero 2026
            </p>
          </div>

          <div className="mt-8 text-center">
            <Link
              href="/"
              className="inline-flex text-button-dark-green font-semibold hover:text-button-orange transition-colors"
            >
              &larr; Volver al inicio
            </Link>
          </div>
        </div>
      </section>
      <Footer />
    </main>
  );
}
