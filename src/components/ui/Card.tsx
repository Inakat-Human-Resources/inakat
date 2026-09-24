// RUTA: src/components/ui/Card.tsx

import type { ElementType, ReactNode } from 'react';
import { cn } from '@/lib/utils';

export interface CardProps {
  /** Título de la tarjeta (h2 por defecto; cambia el nivel con `nivelTitulo`). */
  titulo?: ReactNode;
  descripcion?: ReactNode;
  /** Botones o filtros a la derecha del título. */
  acciones?: ReactNode;
  /** Franja inferior (totales, paginación, «Ver todo»). */
  pie?: ReactNode;
  children?: ReactNode;
  /** Sin relleno interior: para tablas y listas que llegan al borde. */
  sinRelleno?: boolean;
  /** Elemento raíz (section, article, div…). Por defecto <section>. */
  como?: ElementType;
  nivelTitulo?: 2 | 3 | 4;
  id?: string;
  className?: string;
  /** Clases del cuerpo. */
  claseCuerpo?: string;
}

/**
 * Superficie blanca sobre el papel: la unidad de agrupación del panel.
 *
 *   <Card titulo="Últimas compras" acciones={<Button variante="contorno" tamano="sm">Exportar</Button>}>
 *     …
 *   </Card>
 *
 * OJO: globals.css declara `section { overflow: hidden }`. La tarjeta lo
 * devuelve a `overflow: clip` (recorta las esquinas igual, pero NO crea
 * contenedor de scroll), así la cabecera fija de un DataTable dentro sigue
 * funcionando.
 */
export default function Card({
  titulo,
  descripcion,
  acciones,
  pie,
  children,
  sinRelleno,
  como: Como = 'section',
  nivelTitulo = 2,
  id,
  className,
  claseCuerpo,
}: CardProps) {
  const Titulo = `h${nivelTitulo}` as ElementType;
  const conCabecera = titulo || descripcion || acciones;
  return (
    <Como
      id={id}
      className={cn('rounded-xl border border-line bg-white shadow-ap-1 [overflow:clip]', className)}
    >
      {conCabecera && (
        <div className="flex flex-col gap-3 border-b border-line px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            {titulo && (
              <Titulo className="font-display text-base font-semibold leading-snug text-ink">{titulo}</Titulo>
            )}
            {descripcion && <p className="mt-0.5 text-sm text-ink-muted">{descripcion}</p>}
          </div>
          {acciones && <div className="flex flex-wrap items-center gap-2">{acciones}</div>}
        </div>
      )}
      <div className={cn(!sinRelleno && 'p-5', claseCuerpo)}>{children}</div>
      {pie && <div className="border-t border-line bg-paper/60 px-5 py-3">{pie}</div>}
    </Como>
  );
}
