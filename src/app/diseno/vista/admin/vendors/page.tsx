// RUTA: src/app/diseno/vista/admin/vendors/page.tsx
// Banco de pruebas: la página REAL /admin/vendors con fetch simulado (fixtures) y el
// AppShell de su rol. El layout de /diseno/vista instala el simulador antes.
import PaginaReal from '@/app/admin/vendors/page';

export default function Vista() {
  return <PaginaReal />;
}
