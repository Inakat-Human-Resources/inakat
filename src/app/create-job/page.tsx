import { Suspense } from 'react';
import { redirect } from 'next/navigation';
import { requireRole } from '@/lib/auth';
import CreateJobForm from '@/components/sections/jobs/CreateJobForm';

// La página consulta la sesión en cada visita: no puede renderizarse estática.
export const dynamic = 'force-dynamic';

function CreateJobFormFallback() {
  return (
    <div className="max-w-4xl mx-auto">
      <div className="bg-white rounded-2xl shadow-lg p-8">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/2 mb-8"></div>
          <div className="space-y-4">
            <div className="h-10 bg-gray-200 rounded"></div>
            <div className="h-10 bg-gray-200 rounded"></div>
            <div className="h-10 bg-gray-200 rounded"></div>
          </div>
        </div>
      </div>
    </div>
  );
}

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

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4">
      <Suspense fallback={<CreateJobFormFallback />}>
        <CreateJobForm />
      </Suspense>
    </div>
  );
}
