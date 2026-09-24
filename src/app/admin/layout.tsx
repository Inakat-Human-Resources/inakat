// RUTA: src/app/admin/layout.tsx
// Registro de aplicación: todo /admin vive dentro del AppShell (barra lateral
// con la navegación del administrador, cabecera con la campanita).
import AppShell from '@/components/ui/AppShell';

// El panel consulta la sesión y datos vivos en cada visita: nunca estático.
export const dynamic = 'force-dynamic';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <AppShell>{children}</AppShell>;
}
