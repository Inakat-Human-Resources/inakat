// RUTA: src/app/notifications/layout.tsx
// Registro de aplicación: la sección vive dentro del AppShell (barra lateral
// por rol, cabecera con la campanita). Las páginas no montan su propio <main>.
import AppShell from '@/components/ui/AppShell';

export default function Layout({ children }: { children: React.ReactNode }) {
  return <AppShell>{children}</AppShell>;
}
