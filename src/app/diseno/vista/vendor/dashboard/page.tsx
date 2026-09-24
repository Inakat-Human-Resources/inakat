// RUTA: src/app/diseno/vista/vendor/dashboard/page.tsx
// Banco de pruebas: la página REAL /vendor/dashboard con fetch simulado (fixtures) y el
// AppShell de su rol. El layout de /diseno/vista instala el simulador antes.
import PaginaReal from '@/app/vendor/dashboard/page';

export default function Vista() {
  return <PaginaReal />;
}
