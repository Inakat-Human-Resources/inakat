// RUTA: src/components/ui/CampoArchivo.tsx
'use client';

import type { ChangeEvent, RefObject } from 'react';
import { CloudUpload, FileCheck2, X } from 'lucide-react';
import { useCampo } from './FormField';
import IconButton from './IconButton';
import { cn } from '@/lib/utils';

/** 1 234 567 → «1.2 MB»; 34 567 → «34 KB». */
export function formatearTamano(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

export interface CampoArchivoProps {
  /** El archivo elegido (vive en el estado del formulario, no aquí). */
  archivo: File | null;
  /** El <input type="file"> de siempre: el formulario lo vacía al quitar. */
  inputRef: RefObject<HTMLInputElement | null>;
  accept: string;
  alCambiar: (e: ChangeEvent<HTMLInputElement>) => void;
  alQuitar: () => void;
  /** Nombre del documento para el lector de pantalla («Identificación»). */
  nombre: string;
}

/**
 * Campo de documento dentro de un <FormField>: el FormField pone la etiqueta
 * visible, la ayuda y el error; este componente engancha su botón a ellos
 * (id, aria-describedby, aria-invalid) con useCampo().
 *
 * El <input type="file"> sigue oculto y lo abre un botón (como antes), pero el
 * botón es el MISMO elemento con y sin archivo: al elegir, el foco no se pierde.
 * «Quitar» devuelve el foco a ese botón.
 *
 *   <FormField etiqueta="Identificación oficial" requerido error={errores.identificacion}>
 *     <CampoArchivo archivo={formData.identificacion} inputRef={idRef} accept=".pdf,.jpg,.png"
 *       alCambiar={alElegir} alQuitar={quitar} nombre="Identificación" />
 *   </FormField>
 *
 * Lo usa el registro de empresa (/companies); sirve a /register, al perfil del
 * candidato y a CandidateForm. Para un botón suelto de «Subir archivo», usa
 * SelectorArchivo.
 */
export default function CampoArchivo({ archivo, inputRef, accept, alCambiar, alQuitar, nombre }: CampoArchivoProps) {
  const campo = useCampo();
  const invalido = Boolean(campo?.invalido);

  const quitar = () => {
    alQuitar();
    requestAnimationFrame(() => {
      if (campo?.id) document.getElementById(campo.id)?.focus();
    });
  };

  return (
    <div className="flex items-center gap-2">
      <input type="file" ref={inputRef} className="hidden" accept={accept} onChange={alCambiar} tabIndex={-1} />
      <button
        type="button"
        id={campo?.id}
        // Sin aria-invalid (no es válido en un botón): el error llega por
        // aria-describedby y se ve en texto bajo el campo.
        aria-describedby={campo?.describedBy}
        onClick={() => inputRef.current?.click()}
        className={cn(
          'flex min-h-[4.5rem] min-w-0 flex-1 items-center gap-4 rounded-xl border-2 px-4 py-3 text-left transition-colors duration-150',
          archivo
            ? // Borde lime-dark al 60 % sobre lime-tint: 3.39:1 contra el blanco de la tarjeta (al 50 % daba 2.72).
              'border-lime-dark/60 bg-lime-tint hover:border-lime-dark'
            : invalido
              ? 'border-dashed border-danger bg-danger-tint/50 hover:bg-danger-tint'
              : 'border-dashed border-line-strong bg-paper hover:border-teal hover:bg-teal-tint'
        )}
      >
        <span
          className={cn(
            'flex h-11 w-11 flex-none items-center justify-center rounded-full',
            archivo ? 'bg-lime text-ink' : 'bg-white text-teal shadow-ap-1'
          )}
          aria-hidden="true"
        >
          {archivo ? <FileCheck2 className="h-5 w-5" /> : <CloudUpload className="h-5 w-5" />}
        </span>
        <span className="min-w-0 flex-1">
          {archivo ? (
            <>
              <span className="block truncate font-medium text-ink">{archivo.name}</span>
              <span className="block text-[13px] text-ink-muted">
                {formatearTamano(archivo.size)} · <span className="font-medium text-teal">Cambiar archivo</span>
              </span>
            </>
          ) : (
            <>
              <span className="block font-display font-semibold text-ink">
                Elegir archivo<span className="sr-only"> de {nombre}</span>
              </span>
              <span className="block text-[13px] text-ink-muted">Desde tu computadora o tu teléfono</span>
            </>
          )}
        </span>
      </button>
      {archivo && (
        <IconButton etiqueta={`Quitar ${archivo.name}`} icono={X} variante="peligro" onClick={quitar} />
      )}
    </div>
  );
}
