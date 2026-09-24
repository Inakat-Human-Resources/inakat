// RUTA: src/app/diseno/vista/admin/pricing/page.tsx
// Banco de pruebas: la página REAL /admin/pricing con fetch simulado (fixtures) y el
// AppShell de su rol. El layout de /diseno/vista instala el simulador antes.
import PaginaReal from '@/app/admin/pricing/page';

export default function Vista() {
  return <PaginaReal />;
}
