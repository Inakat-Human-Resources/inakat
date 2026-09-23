// RUTA: src/app/register/layout.tsx
// La página es 'use client': su metadata vive aquí. No se indexa.
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Crear cuenta',
  description: 'Crea tu cuenta de candidato en INAKAT.',
  robots: { index: false, follow: false },
};

export default function RegisterLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
