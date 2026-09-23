// RUTA: src/app/unauthorized/layout.tsx
// La página es 'use client': su metadata vive aquí. No se indexa.
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Acceso no autorizado',
  description: 'No tienes permisos para ver esta sección.',
  robots: { index: false, follow: false },
};

export default function UnauthorizedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
