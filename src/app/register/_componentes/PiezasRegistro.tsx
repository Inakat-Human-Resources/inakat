// RUTA: src/app/register/_componentes/PiezasRegistro.tsx
'use client';

// Piezas de PRESENTACIÓN del registro por pasos. No guardan datos ni llaman a
// nada: todo el estado, las validaciones y el envío siguen en page.tsx.
import type { CSSProperties, ReactNode } from 'react';
import { AlertCircle, Check, Loader2, Trash2, Upload } from 'lucide-react';
import IconButton from '@/components/ui/IconButton';
import { cn } from '@/lib/utils';

/**
 * El punto recorre el arco: una marca por paso, como las 11 etapas de la
 * portada. Vive dentro de la escena del panel (aria-hidden): el progreso
 * accesible lo da el Stepper de la tarjeta.
 */
export function RecorridoRegistro({ pasos, actual }: { pasos: string[]; actual: number }) {
  const total = pasos.length;
  const progreso = total > 1 ? (actual - 1) / (total - 1) : 0;
  const dosCifras = (n: number) => String(n).padStart(2, '0');
  return (
    <div className="ac-recorrido" style={{ '--p': progreso } as CSSProperties}>
      {pasos.map((paso, i) => (
        <span
          key={paso}
          className="ac-recorrido__marca"
          data-hecho={i < actual - 1 ? 'true' : 'false'}
          style={{ '--i': i } as CSSProperties}
        />
      ))}
      <span className="ac-recorrido__corredor" />
      <span className="ac-recorrido__cifra">
        <span className="ac-recorrido__n">
          {dosCifras(actual)}
          <small>/{dosCifras(total)}</small>
        </span>
        <span className="ac-recorrido__paso">{pasos[actual - 1]}</span>
      </span>
    </div>
  );
}

/**
 * Una fila de una lista (educación, experiencia, documento): grupo con nombre,
 * botón de eliminar con nombre propio («Eliminar experiencia 1») y sus
 * errores. El grupo es enfocable (tabIndex -1) para llevar ahí el foco cuando
 * la fila no pasa la validación.
 *
 * Estructura que usan los tests: el título vive en un <div> cuyo padre es la
 * tarjeta, y el PRIMER botón de la tarjeta es el de eliminar.
 */
export function TarjetaFila({
  id,
  titulo,
  etiquetaEliminar,
  alEliminar,
  errores = [],
  children,
}: {
  id: string;
  titulo: string;
  etiquetaEliminar: string;
  alEliminar: () => void;
  /** Errores de la fila; los repetidos se muestran una vez. */
  errores?: Array<string | undefined>;
  children: ReactNode;
}) {
  const lista = Array.from(new Set(errores.filter((e): e is string => Boolean(e))));
  const idTitulo = `${id}-titulo`;
  const idsError = lista.map((_, i) => `${id}-error-${i}`);
  return (
    <div
      id={id}
      role="group"
      aria-labelledby={idTitulo}
      aria-describedby={idsError.length ? idsError.join(' ') : undefined}
      tabIndex={-1}
      className={cn(
        'rounded-xl border bg-paper p-4 outline-none transition-[border-color,box-shadow] duration-150 focus-visible:ring-2 focus-visible:ring-teal/40 sm:p-5',
        lista.length ? 'border-danger/40' : 'border-line'
      )}
    >
      <div className="mb-4 flex items-center justify-between gap-3">
        <h3 id={idTitulo} className="font-display text-base font-semibold text-ink">
          {titulo}
        </h3>
        <IconButton etiqueta={etiquetaEliminar} icono={Trash2} variante="peligro" onClick={alEliminar} />
      </div>
      {children}
      {lista.map((error, i) => (
        // Error sobre papel: 6.03:1.
        <p
          key={error}
          id={idsError[i]}
          role="alert"
          className="mt-3 flex items-start gap-1.5 text-[13px] font-medium text-danger"
        >
          <AlertCircle className="mt-px h-4 w-4 flex-none" aria-hidden="true" />
          {error}
        </p>
      ))}
    </div>
  );
}

/**
 * Zona para elegir un archivo: un <label> que envuelve un <input type="file">
 * sr-only (AUTHUI-021: con display:none no se llegaba con teclado). El foco
 * del input se ve en el marco (focus-within).
 *
 * AUTHUI-027: el input se vacía ANTES de entregar el archivo, para poder
 * reintentar con el MISMO archivo tras un fallo (si no, el navegador no vuelve
 * a disparar 'change').
 */
export function ArchivoSubida({
  estado,
  texto,
  accept,
  disabled,
  alElegir,
  contexto,
  invalido = false,
}: {
  estado: 'vacio' | 'subiendo' | 'listo';
  /** Lo que se lee en la zona: «Subir archivo», «Subiendo…», el nombre del archivo. */
  texto: string;
  accept: string;
  disabled?: boolean;
  alElegir: (archivo: File) => void;
  /** Completa el nombre accesible cuando hay varias zonas («documento 2»). */
  contexto?: string;
  invalido?: boolean;
}) {
  const Icono = estado === 'subiendo' ? Loader2 : estado === 'listo' ? Check : Upload;
  return (
    <label
      className={cn(
        'flex min-h-12 w-full items-center justify-center gap-2 rounded-xl border-2 px-4 py-3 text-center text-sm font-medium transition-colors duration-150',
        'focus-within:outline focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-teal',
        // teal-dark/teal-tint 8.18 · lime-dark/lime-tint 7.84 · tinta/blanco 12.38
        estado === 'subiendo' && 'cursor-wait border-teal/40 bg-teal-tint text-teal-dark',
        estado === 'listo' && 'cursor-pointer border-lime-dark/30 bg-lime-tint text-lime-dark hover:border-lime-dark/60',
        estado === 'vacio' &&
          cn(
            'cursor-pointer border-dashed bg-white text-ink hover:border-ink',
            invalido ? 'border-danger' : 'border-line-strong'
          )
      )}
    >
      <Icono className={cn('h-[18px] w-[18px] flex-none', estado === 'subiendo' && 'animate-spin')} aria-hidden="true" />
      <span className="min-w-0 truncate">{texto}</span>
      <input
        type="file"
        accept={accept}
        className="sr-only"
        aria-label={contexto ? `${texto}, ${contexto}` : undefined}
        onChange={(e) => {
          const input = e.target;
          const file = input.files?.[0];
          input.value = '';
          if (file) alElegir(file);
        }}
        disabled={disabled}
      />
    </label>
  );
}
