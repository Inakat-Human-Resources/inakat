// RUTA: src/app/diseno/vista/candidate/applications/page.tsx
// Banco de pruebas: la página REAL /candidate/applications con fetch simulado (fixtures) y el
// AppShell de su rol. El layout de /diseno/vista instala el simulador antes.
import PaginaReal from '@/app/candidate/applications/page';

export default function Vista() {
  return <PaginaReal />;
}
