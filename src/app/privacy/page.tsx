// RUTA: src/app/privacy/page.tsx
import Footer from '@/components/commons/Footer';
import Link from 'next/link';

export default function PrivacyPage() {
  return (
    <main className="min-h-screen">
      <section className="bg-custom-beige py-16 md:py-24">
        <div className="container mx-auto px-4 max-w-3xl">
          <h1 className="font-display text-3xl md:text-4xl lg:text-5xl font-bold text-title-dark mb-8">
            Política de Privacidad
          </h1>

          <div className="bg-white rounded-2xl p-8 md:p-10 shadow-sm space-y-6 text-text-black/80 leading-relaxed">
            <p>
              En INAKAT nos comprometemos a proteger la privacidad de nuestros usuarios. Esta página detallará próximamente cómo recopilamos, usamos y protegemos tu información personal.
            </p>

            <div className="space-y-4">
              <h2 className="font-display text-xl font-bold text-title-dark">Principios generales</h2>
              <p>Mientras finalizamos nuestra política completa, estos son nuestros principios fundamentales:</p>
              <div className="space-y-3">
                <div className="flex items-start gap-3">
                  <span className="w-6 h-6 rounded-full bg-button-green flex items-center justify-center flex-shrink-0 mt-0.5">
                    <span className="text-white text-xs font-bold">&#10003;</span>
                  </span>
                  <p>Tu información personal se utiliza exclusivamente para el proceso de reclutamiento y evaluación.</p>
                </div>
                <div className="flex items-start gap-3">
                  <span className="w-6 h-6 rounded-full bg-button-green flex items-center justify-center flex-shrink-0 mt-0.5">
                    <span className="text-white text-xs font-bold">&#10003;</span>
                  </span>
                  <p>No vendemos ni compartimos tus datos con terceros ajenos al proceso de selección.</p>
                </div>
                <div className="flex items-start gap-3">
                  <span className="w-6 h-6 rounded-full bg-button-green flex items-center justify-center flex-shrink-0 mt-0.5">
                    <span className="text-white text-xs font-bold">&#10003;</span>
                  </span>
                  <p>Tus documentos y evaluaciones son confidenciales y se manejan con estrictos protocolos de seguridad.</p>
                </div>
              </div>
            </div>

            <div className="bg-soft-green/10 border-l-4 border-button-orange rounded-r-lg p-5">
              <p>
                Si tienes preguntas sobre privacidad o deseas ejercer tus derechos ARCO (Acceso, Rectificación, Cancelación u Oposición), contáctanos:
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
