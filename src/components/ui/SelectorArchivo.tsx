// RUTA: src/components/ui/SelectorArchivo.tsx
'use client';

import { forwardRef, type InputHTMLAttributes, type ReactNode } from 'react';
import { Loader2, Upload, type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { clasesBoton, type TamanoBoton, type VarianteBoton } from './Button';

export interface SelectorArchivoProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type' | 'className' | 'children'> {
  /** Texto del botón: «Subir foto», «Adjuntar documento». */
  children: ReactNode;
  /** Icono del botón (por defecto, Upload). */
  icono?: LucideIcon;
  /** Mientras sube: giro, deshabilitado y `textoCargando`. */
  cargando?: boolean;
  textoCargando?: ReactNode;
  variante?: Exclude<VarianteBoton, 'publico-naranja' | 'publico-fantasma'>;
  tamano?: TamanoBoton;
  /** Clases del <label> (el «botón»). */
  className?: string;
}

/**
 * Botón para elegir un archivo: un <label> con aspecto de botón y el
 * <input type="file"> DENTRO, oculto a la vista (sr-only) pero alcanzable con
 * Tab (con display:none no lo estaba, AUTHUI-021). El anillo de foco lo pinta
 * el <label> cuando el input tiene foco de teclado.
 *
 *   <SelectorArchivo accept="image/*" cargando={subiendo} textoCargando="Subiendo…"
 *     onChange={(e) => { const f = e.target.files?.[0]; if (f) subir(f); }}>
 *     {fotoUrl ? 'Cambiar foto' : 'Subir foto'}
 *   </SelectorArchivo>
 *
 * El `ref`, `accept`, `onChange`, `aria-*`… van al input, como antes. Para un
 * campo de documento con nombre y «Quitar» dentro de un FormField, usa
 * CampoArchivo.
 */
const SelectorArchivo = forwardRef<HTMLInputElement, SelectorArchivoProps>(function SelectorArchivo(
  {
    children,
    icono: Icono = Upload,
    cargando = false,
    textoCargando,
    variante = 'contorno',
    tamano = 'sm',
    className,
    disabled,
    ...props
  },
  ref
) {
  const deshabilitado = Boolean(disabled || cargando);
  return (
    <label
      className={cn(
        clasesBoton({ variante, tamano }),
        'relative cursor-pointer',
        'has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-teal',
        deshabilitado && (cargando ? 'cursor-wait opacity-70' : 'cursor-not-allowed opacity-50'),
        className
      )}
    >
      {cargando ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Icono aria-hidden="true" />}
      {cargando && textoCargando ? textoCargando : children}
      <input ref={ref} type="file" className="sr-only" disabled={deshabilitado} {...props} />
    </label>
  );
});

export default SelectorArchivo;
