// RUTA: src/components/ui/FormField.tsx
'use client';

import {
  createContext,
  forwardRef,
  useContext,
  useId,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from 'react';
import { AlertCircle, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

// ---------------------------------------------------------------------------
// Contexto: FormField reparte id, aria-describedby y aria-invalid a su control
// ---------------------------------------------------------------------------
interface ContextoCampo {
  id: string;
  describedBy?: string;
  invalido: boolean;
  requerido: boolean;
}
const CampoContext = createContext<ContextoCampo | null>(null);

/** Para controles propios que quieran engancharse a un FormField. */
export function useCampo() {
  return useContext(CampoContext);
}

export interface FormFieldProps {
  /** Etiqueta VISIBLE (obligatoria: nada de placeholder como etiqueta). */
  etiqueta: ReactNode;
  children: ReactNode;
  /** Ayuda bajo el campo: formato esperado, para qué se usa. */
  ayuda?: ReactNode;
  /** Error de validación. Se enlaza con aria-describedby y marca aria-invalid. */
  error?: string | null;
  requerido?: boolean;
  /** Marca «(opcional)» junto a la etiqueta, para formularios con mayoría de obligatorios. */
  opcional?: boolean;
  /** id del control (si no, se genera). */
  id?: string;
  className?: string;
  /** Etiqueta sólo para lectores de pantalla (p. ej. un buscador con icono). Úsalo poco. */
  etiquetaOculta?: boolean;
  /**
   * El error llega sin que la persona pulse nada (falla una subida de foto o
   * de CV): role="alert" en el mensaje para que se anuncie al aparecer. Los
   * errores de validación al enviar NO lo necesitan (el foco va al campo).
   */
  anunciarError?: boolean;
}

/**
 * Campo de formulario: etiqueta visible asociada, ayuda y error enlazados.
 *
 *   <FormField etiqueta="Correo de contacto" ayuda="Te escribiremos aquí." error={errores.email} requerido>
 *     <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
 *   </FormField>
 *
 * El control de dentro (Input, Select, Textarea) recibe solo su id,
 * aria-describedby, aria-invalid y required: no los pases a mano.
 */
export default function FormField({
  etiqueta,
  children,
  ayuda,
  error,
  requerido = false,
  opcional = false,
  id,
  className,
  etiquetaOculta = false,
  anunciarError = false,
}: FormFieldProps) {
  const generado = useId();
  const idCampo = id ?? `campo-${generado}`;
  const idAyuda = ayuda ? `${idCampo}-ayuda` : undefined;
  const idError = error ? `${idCampo}-error` : undefined;
  const describedBy = [idError, idAyuda].filter(Boolean).join(' ') || undefined;

  return (
    <CampoContext.Provider value={{ id: idCampo, describedBy, invalido: Boolean(error), requerido }}>
      <div className={cn('flex flex-col gap-1.5', className)}>
        <label
          htmlFor={idCampo}
          className={cn('text-sm font-medium text-ink', etiquetaOculta && 'sr-only')}
        >
          {etiqueta}
          {requerido && (
            <>
              <span className="ml-0.5 text-danger" aria-hidden="true">
                *
              </span>
              <span className="sr-only"> (obligatorio)</span>
            </>
          )}
          {opcional && <span className="ml-1.5 font-normal text-ink-muted">(opcional)</span>}
        </label>
        {children}
        {error && (
          <p
            id={idError}
            role={anunciarError ? 'alert' : undefined}
            className="flex items-start gap-1.5 text-[13px] font-medium text-danger"
          >
            <AlertCircle className="mt-px h-4 w-4 flex-none" aria-hidden="true" />
            {error}
          </p>
        )}
        {ayuda && (
          <p id={idAyuda} className="text-[13px] text-ink-muted">
            {ayuda}
          </p>
        )}
      </div>
    </CampoContext.Provider>
  );
}

// ---------------------------------------------------------------------------
// Controles
// ---------------------------------------------------------------------------
// 16 px en móvil, 14 px desde sm: iOS Safari hace zoom al enfocar cualquier
// campo de menos de 16 px y el formulario se descuadra. En escritorio, igual
// que siempre. (globals.css lo garantiza también para los campos sueltos.)
const CONTROL =
  'w-full rounded-lg border bg-white text-base sm:text-sm text-ink transition-[border-color,box-shadow] duration-150 ' +
  // Placeholder en ink-muted entero (5.85:1): al 80 % bajaba a 3.8 y no pasaba AA.
  'placeholder:text-ink-muted focus:outline-none focus:ring-2 ' +
  'disabled:cursor-not-allowed disabled:bg-mist disabled:text-ink-muted';

function clasesControl(invalido: boolean) {
  // Borde #7c8482: 3.83:1 sobre blanco (un campo debe distinguirse, WCAG 1.4.11).
  return cn(
    CONTROL,
    invalido
      ? 'border-danger focus:border-danger focus:ring-danger/20'
      : 'border-line-strong hover:border-ink focus:border-teal focus:ring-teal/25'
  );
}

/**
 * Une lo que pase el contexto con lo que venga por props.
 *
 * Obligatorio sólo a la vista: `<FormField requerido>` con el control en
 * `required={false}` marca la etiqueta con * y «(obligatorio)» y pone
 * aria-required en el control, SIN el atributo nativo `required` (que añadiría
 * una validación del navegador que el formulario no tenía).
 */
function useAtributosDeCampo(props: {
  id?: string;
  'aria-describedby'?: string;
  'aria-invalid'?: unknown;
  'aria-required'?: boolean | 'true' | 'false';
  required?: boolean;
}) {
  const campo = useContext(CampoContext);
  const invalido = props['aria-invalid'] === true || props['aria-invalid'] === 'true' || Boolean(campo?.invalido);
  const requeridoCampo = Boolean(campo?.requerido);
  return {
    id: props.id ?? campo?.id,
    'aria-describedby': [campo?.describedBy, props['aria-describedby']].filter(Boolean).join(' ') || undefined,
    'aria-invalid': invalido || undefined,
    'aria-required': props['aria-required'] ?? (requeridoCampo && props.required === false ? true : undefined),
    required: props.required ?? (requeridoCampo || undefined),
    invalido,
  };
}

export type InputProps = InputHTMLAttributes<HTMLInputElement> & {
  /** Icono o texto dentro del campo, a la izquierda (p. ej. <Search/> o «$»). Decorativo. */
  prefijo?: ReactNode;
  /**
   * Botón o texto dentro del campo, a la derecha, con su hueco reservado: el
   * ojo de mostrar/ocultar la contraseña (un <IconButton tamano="sm">), una
   * unidad. NO es decorativo: un botón aquí se alcanza con Tab y se lee. Si es
   * texto que el lector no necesita (la unidad ya está en la etiqueta),
   * envuélvelo tú en aria-hidden.
   */
  sufijo?: ReactNode;
};

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { className, prefijo, sufijo, ...props },
  ref
) {
  const { invalido, ...a11y } = useAtributosDeCampo(props);
  const control = (
    <input
      ref={ref}
      {...props}
      {...a11y}
      className={cn(
        clasesControl(invalido),
        'h-10 px-3',
        prefijo ? 'pl-9' : undefined,
        sufijo ? 'pr-11' : undefined,
        className
      )}
    />
  );
  if (!prefijo && !sufijo) return control;
  return (
    <div className="relative">
      {prefijo && (
        <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-ink-muted [&_svg]:h-4 [&_svg]:w-4" aria-hidden="true">
          {prefijo}
        </span>
      )}
      {control}
      {sufijo && (
        <span className="absolute inset-y-0 right-1 flex items-center text-[13px] text-ink-muted">{sufijo}</span>
      )}
    </div>
  );
});

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(function Select(
  { className, children, ...props },
  ref
) {
  const { invalido, ...a11y } = useAtributosDeCampo(props);
  return (
    <div className="relative">
      <select
        ref={ref}
        {...props}
        {...a11y}
        className={cn(clasesControl(invalido), 'h-10 appearance-none pl-3 pr-9', className)}
      >
        {children}
      </select>
      <ChevronDown
        className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-muted"
        aria-hidden="true"
      />
    </div>
  );
});

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(function Textarea(
  { className, rows = 4, ...props },
  ref
) {
  const { invalido, ...a11y } = useAtributosDeCampo(props);
  return (
    <textarea
      ref={ref}
      rows={rows}
      {...props}
      {...a11y}
      className={cn(clasesControl(invalido), 'min-h-[5.5rem] px-3 py-2.5 leading-relaxed', className)}
    />
  );
});

export interface CheckboxProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  /** Etiqueta visible, a la derecha de la casilla. */
  etiqueta: ReactNode;
  /** Aclaración bajo la etiqueta. */
  descripcion?: ReactNode;
}

/**
 * Casilla con su etiqueta clicable (todo el renglón activa la casilla).
 *
 *   <Checkbox etiqueta="Vacante confidencial" descripcion="No se muestra el nombre de la empresa."
 *     checked={confidencial} onChange={(e) => setConfidencial(e.target.checked)} />
 */
export const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(function Checkbox(
  { etiqueta, descripcion, className, id, ...props },
  ref
) {
  const generado = useId();
  const idCasilla = id ?? `casilla-${generado}`;
  const idDesc = descripcion ? `${idCasilla}-desc` : undefined;
  return (
    <div className={cn('flex items-start gap-3', className)}>
      <input
        ref={ref}
        id={idCasilla}
        type="checkbox"
        aria-describedby={idDesc}
        {...props}
        className="mt-0.5 h-[18px] w-[18px] flex-none cursor-pointer rounded border-line-strong accent-teal disabled:cursor-not-allowed"
      />
      <div className="min-w-0">
        <label htmlFor={idCasilla} className="cursor-pointer text-sm font-medium text-ink">
          {etiqueta}
        </label>
        {descripcion && (
          <p id={idDesc} className="mt-0.5 text-[13px] text-ink-muted">
            {descripcion}
          </p>
        )}
      </div>
    </div>
  );
});
