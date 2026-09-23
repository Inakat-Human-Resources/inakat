// RUTA: src/app/forgot-password/layout.tsx
// La página es 'use client': su metadata vive aquí. No se indexa.
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Recuperar contraseña',
  description: 'Solicita un enlace para restablecer tu contraseña de INAKAT.',
  robots: { index: false, follow: false },
};

export default function ForgotPasswordLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
