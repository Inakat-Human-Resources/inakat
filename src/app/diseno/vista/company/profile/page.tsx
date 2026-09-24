// RUTA: src/app/diseno/vista/company/profile/page.tsx
// Banco de pruebas: la página REAL /company/profile con fetch simulado (fixtures) y el
// AppShell de su rol. El layout de /diseno/vista instala el simulador antes.
import PaginaReal from '@/app/company/profile/page';

export default function Vista() {
  return <PaginaReal />;
}
