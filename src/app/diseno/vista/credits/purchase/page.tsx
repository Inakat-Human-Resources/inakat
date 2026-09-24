// RUTA: src/app/diseno/vista/credits/purchase/page.tsx
// Banco de pruebas: la página REAL /credits/purchase con fetch simulado (fixtures) y el
// AppShell de su rol. El layout de /diseno/vista instala el simulador antes.
import PaginaReal from '@/app/credits/purchase/page';

export default function Vista() {
  return <PaginaReal />;
}
