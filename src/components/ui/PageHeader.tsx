// RUTA: src/components/ui/PageHeader.tsx

import type { ReactNode } from 'react';
import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface Miga {
  etiqueta: string;
  href?: string;
}

export interface PageHeaderProps {
  /** El h1 de la página (28–34 px). Uno por página. */
  titulo: string;
  /** Remate en serif itálica, la voz humana: titulo="Vacantes" remate="de todas las empresas". */
  remate?: string;
  /** Antetítulo con el punto naranja: la sección («Reclutamiento»). */
  antetitulo?: string;
  descripcion?: ReactNode;
  /** Botones de la página (el primario, el último). */
  acciones?: ReactNode;
  /** Migas para páginas de detalle: [{ etiqueta: 'Vacantes', href: '/admin' }, { etiqueta: 'Puesto' }]. */
  migas?: Miga[];
  className?: string;
}

/**
 * Cabecera de una página de aplicación.
 *
 *   <PageHeader
 *     antetitulo="Reclutamiento"
 *     titulo="Vacantes"
 *     remate="de todas las empresas"
 *     descripcion="37 empresas con vacantes publicadas"
 *     acciones={<Button variante="contorno" icono={RefreshCw}>Actualizar</Button>}
 *   />
 */
export default function PageHeader({ titulo, remate, antetitulo, descripcion, acciones, migas, className }: PageHeaderProps) {
  return (
    <header className={cn('mb-6 flex flex-col gap-4 sm:mb-8 sm:flex-row sm:items-end sm:justify-between', className)}>
      <div className="min-w-0">
        {migas && migas.length > 0 && (
          <nav aria-label="Migas de pan" className="mb-3">
            <ol className="flex flex-wrap items-center gap-1 text-sm text-ink-muted">
              {migas.map((miga, i) => {
                const ultima = i === migas.length - 1;
                return (
                  <li key={`${miga.etiqueta}-${i}`} className="flex items-center gap-1">
                    {miga.href && !ultima ? (
                      <Link href={miga.href} className="rounded hover:text-ink hover:underline">
                        {miga.etiqueta}
                      </Link>
                    ) : (
                      <span aria-current={ultima ? 'page' : undefined} className={ultima ? 'text-ink' : undefined}>
                        {miga.etiqueta}
                      </span>
                    )}
                    {!ultima && <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />}
                  </li>
                );
              })}
            </ol>
          </nav>
        )}
        {antetitulo && (
          <p className="mb-2 inline-flex items-center gap-2 font-display text-[11px] font-semibold uppercase tracking-[0.16em] text-ink-muted">
            <span className="h-1.5 w-1.5 rounded-full bg-orange" aria-hidden="true" />
            {antetitulo}
          </p>
        )}
        <h1 className="font-display text-[28px] font-bold leading-[1.1] tracking-[-0.02em] text-ink sm:text-[32px] lg:text-[34px]">
          {titulo}
          {remate && (
            <>
              {' '}
              <em className="font-serif font-normal italic tracking-normal text-teal">{remate}</em>
            </>
          )}
        </h1>
        {descripcion && <div className="mt-2 max-w-2xl text-sm text-ink-muted sm:text-[15px]">{descripcion}</div>}
      </div>
      {acciones && <div className="flex flex-shrink-0 flex-wrap items-center gap-2">{acciones}</div>}
    </header>
  );
}
