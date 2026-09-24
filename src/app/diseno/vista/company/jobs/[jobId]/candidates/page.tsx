// RUTA: src/app/diseno/vista/company/jobs/[jobId]/candidates/page.tsx
// Banco de pruebas: la página REAL /company/jobs/[jobId]/candidates con fetch simulado (fixtures) y el
// AppShell de su rol. El layout de /diseno/vista instala el simulador antes.
import PaginaReal from '@/app/company/jobs/[jobId]/candidates/page';

export default function Vista() {
  return <PaginaReal />;
}
