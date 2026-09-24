// RUTA: src/app/diseno/vista/profile/page.tsx
// Banco de pruebas: la página REAL /profile con fetch simulado (fixtures) y el
// AppShell de su rol. El layout de /diseno/vista instala el simulador antes.
import PaginaReal from '@/app/profile/page';

export default function Vista() {
  return <PaginaReal />;
}
