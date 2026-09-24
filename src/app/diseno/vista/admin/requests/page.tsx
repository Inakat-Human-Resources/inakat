// RUTA: src/app/diseno/vista/admin/requests/page.tsx
// Banco de pruebas: la página REAL /admin/requests con fetch simulado (fixtures) y el
// AppShell de su rol. El layout de /diseno/vista instala el simulador antes.
import PaginaReal from '@/app/admin/requests/page';

export default function Vista() {
  return <PaginaReal />;
}
