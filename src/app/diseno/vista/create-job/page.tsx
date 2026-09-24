// RUTA: src/app/diseno/vista/create-job/page.tsx
// Banco de pruebas de /create-job. Esa página es un componente de SERVIDOR que
// consulta la sesión en la base (requireRole) antes de pintar: aquí no hay
// sesión ni base, así que se pinta lo mismo que ella pinta DESPUÉS de esa
// comprobación, sin marco propio (el <main>, el papel y los márgenes los pone
// el AppShell). Si cambias lo que pinta src/app/create-job/page.tsx, cámbialo
// igual aquí.
import { Suspense } from 'react';
import CreateJobForm from '@/components/sections/jobs/CreateJobForm';
import CreateJobFormFallback from '@/components/sections/jobs/CreateJobFormFallback';

export default function Vista() {
  return (
    <Suspense fallback={<CreateJobFormFallback />}>
      <CreateJobForm />
    </Suspense>
  );
}
