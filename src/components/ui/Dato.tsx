// RUTA: src/components/ui/Dato.tsx
'use client';

import { useId, type ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface DatoProps {
  /** Qué es: «Teléfono», «Modalidad». */
  termino: ReactNode;
  /** El valor. */
  children: ReactNode;
  /** Icono pequeño delante del término (decorativo). */
  icono?: LucideIcon;
  className?: string;
}

/**
 * Un dato (término + valor) de una ficha. Va DENTRO de un <dl>: cada Dato es
 * un grupo <div> con su <dt> y su <dd> (lo único que admite un <dl>).
 *
 *   <dl className="grid gap-3 sm:grid-cols-2">
 *     <Dato icono={Phone} termino="Teléfono">81 1234 5678</Dato>
 *     <Dato icono={MapPin} termino="Ubicación">Monterrey, NL</Dato>
 *   </dl>
 */
export default function Dato({ termino, children, icono: Icono, className }: DatoProps) {
  return (
    <div className={cn('min-w-0', className)}>
      <dt className="flex items-center gap-1.5 text-xs font-medium text-ink-muted">
        {Icono && <Icono className="h-3.5 w-3.5 flex-none" aria-hidden="true" />}
        {termino}
      </dt>
      <dd className={cn('mt-0.5 text-sm text-ink', Icono && 'pl-5')}>{children}</dd>
    </div>
  );
}

export interface SeccionProps {
  titulo: string;
  /** Remate en serif itálica teal (la voz humana), junto al título. */
  remate?: string;
  /** Una línea bajo el título. */
  descripcion?: ReactNode;
  /** Cifra junto al título (cuántos hay). */
  contador?: number;
  /** Algo a la derecha de la cabecera (una insignia, un botón). */
  insignia?: ReactNode;
  /** Icono teal delante del título (decorativo). */
  icono?: LucideIcon;
  /** md (por defecto): bloque de una ficha. sm: bloque de texto largo en un modal. */
  tamano?: 'sm' | 'md';
  /** Nivel del título (h3 por defecto: el h2 es el del modal o la tarjeta). */
  nivel?: 2 | 3 | 4;
  className?: string;
  children: ReactNode;
}

/**
 * Sección de una ficha o de un modal: <section> con su título (aria-labelledby),
 * remate serif, contador e insignia opcionales. `[overflow:visible]` devuelve
 * lo que globals.css le quita a <section> (el foco de los botones del borde
 * se veía recortado).
 *
 *   <Seccion titulo="Experiencia" remate="lo que ha hecho" contador={3}>…</Seccion>
 *   <Seccion tamano="sm" icono={ListChecks} titulo="Requisitos">…</Seccion>
 */
export function Seccion({
  titulo,
  remate,
  descripcion,
  contador,
  insignia,
  icono: Icono,
  tamano = 'md',
  nivel = 3,
  className,
  children,
}: SeccionProps) {
  const id = useId();
  const Titulo = (`h${nivel}` as 'h2' | 'h3' | 'h4');
  const chica = tamano === 'sm';
  return (
    <section aria-labelledby={id} className={cn('[overflow:visible]', className)}>
      <div className={cn('flex flex-wrap items-start justify-between gap-2', chica ? 'mb-1.5' : 'mb-3')}>
        <div className="min-w-0">
          <Titulo
            id={id}
            className={cn(
              'flex flex-wrap items-baseline gap-x-2 font-display font-semibold leading-snug text-ink',
              chica ? 'text-sm' : 'text-base'
            )}
          >
            {Icono && <Icono className="h-4 w-4 flex-none self-center text-teal" aria-hidden="true" />}
            {titulo}
            {remate && <span className="font-serif text-[17px] font-normal italic text-teal">{remate}</span>}
            {typeof contador === 'number' && (
              <span className="text-sm font-medium tabular-nums text-ink-muted">{contador}</span>
            )}
          </Titulo>
          {descripcion && <p className="mt-0.5 text-sm text-ink-muted">{descripcion}</p>}
        </div>
        {insignia}
      </div>
      {children}
    </section>
  );
}
