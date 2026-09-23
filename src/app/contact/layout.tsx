// RUTA: src/app/contact/layout.tsx
// La página es 'use client', así que su metadata vive en el layout del segmento.
import type { Metadata } from 'next';
import { BASE_OPEN_GRAPH } from '@/lib/seo';

export const metadata: Metadata = {
  title: 'Contacto',
  description:
    'Escríbenos y el equipo de INAKAT te contacta: reclutamiento especializado con evaluación humana en toda la República Mexicana.',
  alternates: { canonical: '/contact' },
  openGraph: {
    ...BASE_OPEN_GRAPH,
    title: 'Contacto | INAKAT',
    description:
      'Escríbenos y el equipo de INAKAT te contacta: reclutamiento especializado con evaluación humana.',
    url: '/contact',
  },
};

export default function ContactLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
