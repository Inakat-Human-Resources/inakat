// RUTA: src/app/diseno/vista/my-applications/page.tsx
// Banco de pruebas: la página REAL /my-applications con fetch simulado (fixtures) y el
// AppShell de su rol. El layout de /diseno/vista instala el simulador antes.
import PaginaReal from '@/app/my-applications/page';

export default function Vista() {
  return <PaginaReal />;
}
