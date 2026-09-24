// RUTA: src/app/diseno/vista/admin/credit-packages/page.tsx
// Banco de pruebas: la página REAL /admin/credit-packages con fetch simulado (fixtures) y el
// AppShell de su rol. El layout de /diseno/vista instala el simulador antes.
import PaginaReal from '@/app/admin/credit-packages/page';

export default function Vista() {
  return <PaginaReal />;
}
