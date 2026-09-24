// RUTA: src/app/terms/page.tsx
//
// Términos y condiciones, maquetados como documento legible (DocumentoLegal,
// registro público «Arco»; la maqueta la comparte con /privacy y vive en
// src/app/privacy/_documento). El texto es el del cliente, sin una palabra
// cambiada; la maqueta sólo deja visible que es PROVISIONAL (un solo aviso).
import type { Metadata } from 'next';
import DocumentoLegal, { ContactoLegal } from '@/app/privacy/_documento/DocumentoLegal';

export const metadata: Metadata = {
  title: 'Términos y Condiciones',
  description:
    'Términos y condiciones de uso de la plataforma INAKAT.',
  // Página provisional ("en construcción"): no debe indexarse ni figurar en el
  // sitemap hasta que exista el texto legal definitivo. Quitar robots entonces.
  robots: { index: false, follow: true },
  alternates: { canonical: '/terms' },
};

export default function TermsPage() {
  return (
    <DocumentoLegal
      titulo="Términos"
      remate="y condiciones"
      actualizado="Última actualización: Febrero 2026"
    >
      <p className="dl-entrada">
        Esta página está en construcción. Los términos y condiciones completos de INAKAT estarán disponibles próximamente.
      </p>

      <ContactoLegal>
        Si tienes preguntas legales o necesitas información sobre nuestras políticas, contáctanos directamente:
      </ContactoLegal>
    </DocumentoLegal>
  );
}
