// RUTA: src/app/diseno/vista/company/integrations/page.tsx
// Banco de pruebas: la página REAL /company/integrations con fetch simulado (fixtures) y el
// AppShell de su rol. El layout de /diseno/vista instala el simulador antes.
import PaginaReal from '@/app/company/integrations/page';

export default function Vista() {
  return <PaginaReal />;
}
