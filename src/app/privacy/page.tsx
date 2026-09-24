// RUTA: src/app/privacy/page.tsx
//
// Política de privacidad, maquetada como documento legible (DocumentoLegal,
// registro público «Arco»; la maqueta vive en ./_documento). El texto es el del
// cliente, sin una palabra cambiada; la maqueta sólo deja visible que es
// PROVISIONAL (un solo aviso, al margen).
import { Check } from 'lucide-react';
import type { Metadata } from 'next';
import DocumentoLegal, { ContactoLegal } from './_documento/DocumentoLegal';

export const metadata: Metadata = {
  title: 'Política de Privacidad',
  description:
    'Política de privacidad y tratamiento de datos personales de INAKAT.',
  // Página provisional ("se detallará próximamente"): no debe indexarse ni
  // figurar en el sitemap hasta que exista el aviso de privacidad integral.
  robots: { index: false, follow: true },
  alternates: { canonical: '/privacy' },
};

const PRINCIPIOS = [
  'Tu información personal se utiliza exclusivamente para el proceso de reclutamiento y evaluación.',
  'No vendemos ni compartimos tus datos con terceros ajenos al proceso de selección.',
  'Tus documentos y evaluaciones son confidenciales y se manejan con estrictos protocolos de seguridad.',
];

export default function PrivacyPage() {
  return (
    <DocumentoLegal
      titulo="Política de"
      remate="privacidad"
      actualizado="Última actualización: Febrero 2026"
    >
      <p className="dl-entrada">
        En INAKAT nos comprometemos a proteger la privacidad de nuestros usuarios. Esta página detallará próximamente cómo recopilamos, usamos y protegemos tu información personal.
      </p>

      <h2 id="principios">Principios generales</h2>
      <p>Mientras finalizamos nuestra política completa, estos son nuestros principios fundamentales:</p>
      <ul className="dl-principios">
        {PRINCIPIOS.map((principio) => (
          <li key={principio}>
            <span className="dl-principios__marca" aria-hidden="true">
              <Check />
            </span>
            <p>{principio}</p>
          </li>
        ))}
      </ul>

      <ContactoLegal>
        Si tienes preguntas sobre privacidad o deseas ejercer tus derechos ARCO (Acceso, Rectificación, Cancelación u Oposición), contáctanos:
      </ContactoLegal>
    </DocumentoLegal>
  );
}
