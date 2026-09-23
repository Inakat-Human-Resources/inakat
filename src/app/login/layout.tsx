// RUTA: src/app/login/layout.tsx
// La página es 'use client': su metadata vive aquí. No se indexa.
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Iniciar sesión',
  description: 'Accede a tu cuenta de INAKAT.',
  robots: { index: false, follow: false },
};

export default function LoginLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
