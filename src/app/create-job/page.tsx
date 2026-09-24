import { Suspense } from 'react';
import { redirect } from 'next/navigation';
import { requireRole } from '@/lib/auth';
import CreateJobForm from '@/components/sections/jobs/CreateJobForm';
import CreateJobFormFallback from '@/components/sections/jobs/CreateJobFormFallback';

// La página consulta la sesión en cada visita: no puede renderizarse estática.
export const dynamic = 'force-dynamic';

export default async function CreateJobPage() {
  // /create-job no está en el matcher del middleware y el formulario tampoco
  // comprobaba nada: un anónimo o un candidato rellenaba los ~20 campos y sólo
  // al pulsar GUARDAR se enteraba con un toast de 'No autenticado', perdiendo
  // todo lo escrito. Se resuelve antes de pintar el formulario.
  // requireRole consulta la base de datos, así que también corta a un usuario
  // desactivado con la cookie todavía vigente.
  const auth = await requireRole(['company', 'admin']);

  if ('error' in auth) {
    if (auth.status === 401) {
      redirect('/login?redirect=/create-job');
    }
    redirect('/unauthorized');
  }

  // Registro de aplicación: el <main>, el papel y los márgenes los pone el
  // AppShell (src/app/create-job/layout.tsx). Aquí sólo va el formulario.
  return (
    <Suspense fallback={<CreateJobFormFallback />}>
      <CreateJobForm />
    </Suspense>
  );
}
