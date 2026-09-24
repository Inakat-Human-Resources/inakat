// RUTA: src/components/ui/TarjetaRepetible.tsx
'use client';

import type { ReactNode } from 'react';
import { Trash2 } from 'lucide-react';
import IconButton from './IconButton';

export interface TarjetaRepetibleProps {
  /** Qué es: «Estudio 2», «Experiencia en Grupo Andes». */
  titulo: string;
  /** Una línea bajo el título (resumen de lo capturado). */
  detalle?: string;
  /** Nombre accesible de «Quitar»: «Quitar el estudio 2». */
  etiquetaQuitar: string;
  alQuitar: () => void;
  /** Nivel del título (h3 por defecto: el h2 es el del modal o la tarjeta). */
  nivelTitulo?: 3 | 4;
  children: ReactNode;
}

/**
 * Tarjeta de un elemento REPETIBLE de un formulario (un estudio, una
 * experiencia, un documento): cabecera con título, detalle y «Quitar», y los
 * campos debajo. Es un <li>: ponlas dentro de un <ul>.
 *
 *   <ul className="space-y-3">
 *     {educaciones.map((e, i) => (
 *       <TarjetaRepetible key={e.id} titulo={`Estudio ${i + 1}`} etiquetaQuitar={`Quitar el estudio ${i + 1}`}
 *         alQuitar={() => quitar(i)}>…campos…</TarjetaRepetible>
 *     ))}
 *   </ul>
 */
export default function TarjetaRepetible({
  titulo,
  detalle,
  etiquetaQuitar,
  alQuitar,
  nivelTitulo = 3,
  children,
}: TarjetaRepetibleProps) {
  const Titulo = nivelTitulo === 4 ? 'h4' : 'h3';
  return (
    <li className="rounded-xl border border-line bg-white shadow-ap-1">
      <div className="flex items-center justify-between gap-3 rounded-t-xl border-b border-line bg-paper/70 py-2 pl-4 pr-2">
        <div className="min-w-0">
          <Titulo className="truncate font-display text-sm font-semibold text-ink">{titulo}</Titulo>
          {detalle && <p className="truncate text-xs text-ink-muted">{detalle}</p>}
        </div>
        <IconButton etiqueta={etiquetaQuitar} title="Quitar" icono={Trash2} variante="peligro" tamano="sm" onClick={alQuitar} />
      </div>
      <div className="p-4">{children}</div>
    </li>
  );
}
