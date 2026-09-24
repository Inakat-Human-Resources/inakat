// RUTA: src/app/diseno/vista/admin/page.tsx
// Banco de pruebas: la página REAL /admin con fetch simulado (fixtures) y el
// AppShell de su rol. El layout de /diseno/vista instala el simulador antes.
import PaginaReal from '@/app/admin/page';

export default function Vista() {
  return <PaginaReal />;
}
