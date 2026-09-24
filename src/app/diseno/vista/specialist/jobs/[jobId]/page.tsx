// RUTA: src/app/diseno/vista/specialist/jobs/[jobId]/page.tsx
// Banco de pruebas: la página REAL /specialist/jobs/[jobId] con fetch simulado (fixtures) y el
// AppShell de su rol. El layout de /diseno/vista instala el simulador antes.
import PaginaReal from '@/app/specialist/jobs/[jobId]/page';

export default function Vista() {
  return <PaginaReal />;
}
