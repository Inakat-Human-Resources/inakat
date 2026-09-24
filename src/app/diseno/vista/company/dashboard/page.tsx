// RUTA: src/app/diseno/vista/company/dashboard/page.tsx
// Banco de pruebas: la página REAL /company/dashboard con fetch simulado (fixtures) y el
// AppShell de su rol. El layout de /diseno/vista instala el simulador antes.
import PaginaReal from '@/app/company/dashboard/page';

export default function Vista() {
  return <PaginaReal />;
}
