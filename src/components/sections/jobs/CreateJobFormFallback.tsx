// RUTA: src/components/sections/jobs/CreateJobFormFallback.tsx
//
// Esqueleto de «Publicar / editar vacante»: la misma silueta que la página
// cargada (cabecera, tarjeta con los pasos y columna del costo desde 1280 px),
// para que al llegar los datos nada salte. Lo usan el <Suspense> de
// src/app/create-job/page.tsx y el formulario mientras lee la vacante a editar.
// Componente de servidor (sin estado): sirve en los dos sitios.

import Skeleton from '@/components/ui/Skeleton';

export default function CreateJobFormFallback({ mensaje = 'Cargando el formulario…' }: { mensaje?: string }) {
  return (
    <div role="status" aria-live="polite">
      <span className="sr-only">{mensaje}</span>

      {/* Cabecera */}
      <div className="mb-6 space-y-3 sm:mb-8" aria-hidden="true">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="h-8 w-72 max-w-full" />
        <Skeleton className="h-4 w-[30rem] max-w-full" />
      </div>

      <div className="xl:grid xl:grid-cols-[minmax(0,1fr)_20rem] xl:items-start xl:gap-6" aria-hidden="true">
        {/* Tarjeta del formulario: pasos + campos */}
        <div className="rounded-xl border border-line bg-white shadow-ap-1">
          <div className="flex items-center gap-3 border-b border-line px-5 py-5 sm:px-6">
            {[0, 1, 2, 3].map((i) => (
              <span key={i} className="flex flex-1 items-center gap-3">
                <Skeleton className="h-8 w-8 flex-none rounded-full" />
                <Skeleton className="hidden h-3 flex-1 sm:block" />
              </span>
            ))}
          </div>
          <div className="space-y-6 px-5 py-6 sm:px-6">
            <div className="space-y-2">
              <Skeleton className="h-5 w-40" />
              <Skeleton className="h-3.5 w-64 max-w-full" />
            </div>
            {[0, 1, 2].map((i) => (
              <div key={i} className="space-y-2">
                <Skeleton className="h-3.5 w-32" />
                <Skeleton className="h-10 w-full rounded-lg" />
              </div>
            ))}
            <div className="grid gap-5 md:grid-cols-2">
              {[0, 1].map((i) => (
                <div key={i} className="space-y-2">
                  <Skeleton className="h-3.5 w-28" />
                  <Skeleton className="h-10 w-full rounded-lg" />
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Columna del costo */}
        <div className="mt-6 hidden rounded-xl border border-line bg-white p-5 shadow-ap-1 xl:mt-0 xl:block">
          <Skeleton className="h-4 w-36" />
          <Skeleton className="mt-4 h-10 w-24" />
          <Skeleton className="mt-3 h-3.5 w-48" />
          <div className="mt-5 space-y-2 border-t border-line pt-4">
            <Skeleton className="h-3.5 w-full" />
            <Skeleton className="h-3.5 w-5/6" />
            <Skeleton className="h-3.5 w-4/6" />
          </div>
          <Skeleton className="mt-5 h-10 w-full rounded-lg" />
          <Skeleton className="mt-2 h-10 w-full rounded-lg" />
        </div>
      </div>
    </div>
  );
}
