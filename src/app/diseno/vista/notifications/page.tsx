// RUTA: src/app/diseno/vista/notifications/page.tsx
// Banco de pruebas: la página REAL /notifications con fetch simulado (fixtures) y el
// AppShell de su rol. El layout de /diseno/vista instala el simulador antes.
import PaginaReal from '@/app/notifications/page';

export default function Vista() {
  return <PaginaReal />;
}
