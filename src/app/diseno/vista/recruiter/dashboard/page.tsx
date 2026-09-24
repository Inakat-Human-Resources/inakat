// RUTA: src/app/diseno/vista/recruiter/dashboard/page.tsx
// Banco de pruebas: la página REAL /recruiter/dashboard con fetch simulado (fixtures) y el
// AppShell de su rol. El layout de /diseno/vista instala el simulador antes.
import PaginaReal from '@/app/recruiter/dashboard/page';

export default function Vista() {
  return <PaginaReal />;
}
