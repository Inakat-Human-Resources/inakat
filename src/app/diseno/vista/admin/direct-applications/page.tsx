// RUTA: src/app/diseno/vista/admin/direct-applications/page.tsx
// Banco de pruebas: la página REAL /admin/direct-applications con fetch simulado (fixtures) y el
// AppShell de su rol. El layout de /diseno/vista instala el simulador antes.
import PaginaReal from '@/app/admin/direct-applications/page';

export default function Vista() {
  return <PaginaReal />;
}
