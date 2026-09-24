// RUTA: src/app/diseno/vista/recruiter/jobs/[jobId]/page.tsx
// Banco de pruebas: la página REAL /recruiter/jobs/[jobId] con fetch simulado (fixtures) y el
// AppShell de su rol. El layout de /diseno/vista instala el simulador antes.
import PaginaReal from '@/app/recruiter/jobs/[jobId]/page';

export default function Vista() {
  return <PaginaReal />;
}
