// RUTA: src/app/reset-password/layout.tsx
// La página es 'use client': su metadata vive aquí. La URL lleva token: nunca
// debe indexarse ni seguirse.
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Restablecer contraseña',
  description: 'Define una contraseña nueva para tu cuenta de INAKAT.',
  robots: { index: false, follow: false },
};

export default function ResetPasswordLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
