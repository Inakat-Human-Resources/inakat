// RUTA: src/components/ui/Button.tsx
'use client';

import { forwardRef, type AnchorHTMLAttributes, type ButtonHTMLAttributes, type ReactNode } from 'react';
import Link from 'next/link';
import { ArrowUpRight, Loader2, type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useEnTabla } from './ContextoTabla';

export type VarianteBoton =
  | 'primario'
  | 'secundario'
  | 'contorno'
  | 'fantasma'
  | 'peligro'
  // Piel del registro PÚBLICO: la píldora de la portada (site.css, hm-btn).
  | 'publico-naranja'
  | 'publico-fantasma';

type VarianteApp = Exclude<VarianteBoton, 'publico-naranja' | 'publico-fantasma'>;
export type TamanoBoton = 'sm' | 'md' | 'lg';

const BASE =
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg font-display font-semibold ' +
  'transition-[background-color,color,border-color,box-shadow,transform] duration-150 ease-out ' +
  'active:translate-y-px disabled:pointer-events-none disabled:opacity-50 ' +
  'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal';

const VARIANTES: Record<VarianteApp, string> = {
  // Naranja SIEMPRE con texto tinta (4.87:1; hover 6.04:1). Blanco no pasa AA.
  primario: 'bg-orange text-ink shadow-ap-1 hover:bg-orange-hover',
  // Tinta con blanco (12.38:1); al pasar, verde azulado (7.38:1).
  secundario: 'bg-ink text-white shadow-ap-1 hover:bg-teal',
  contorno: 'border border-line-strong bg-white text-ink hover:bg-paper hover:border-ink',
  fantasma: 'text-ink hover:bg-ink/[0.06]',
  // Blanco sobre #b42318: 6.57:1.
  peligro: 'bg-danger text-white shadow-ap-1 hover:bg-danger-dark',
};

const TAMANOS: Record<TamanoBoton, string> = {
  sm: 'h-8 px-3 text-[13px] [&_svg]:h-4 [&_svg]:w-4',
  md: 'h-10 px-4 text-sm [&_svg]:h-[18px] [&_svg]:w-[18px]',
  lg: 'h-12 px-5 text-base [&_svg]:h-5 [&_svg]:w-5',
};

/**
 * Piel pública: SÓLO las clases de site.css (hm-btn + su color), sin las del
 * registro de aplicación. Así el aspecto no depende de que site.css se cargue
 * después de Tailwind para ganarle a las utilidades. El tamaño lo pone hm-btn
 * (`tamano` no aplica).
 */
const PUBLICO: Record<'publico-naranja' | 'publico-fantasma', string> = {
  // Naranja con texto tinta (4.87:1), como el primario.
  'publico-naranja': 'hm-btn hm-btn--orange',
  'publico-fantasma': 'hm-btn hm-btn--ghost',
};

/** Clases de un botón, para aplicarlas a otro elemento (un <label>, un <summary>, un <Link>…). */
export function clasesBoton({
  variante = 'primario',
  tamano = 'md',
  anchoCompleto = false,
}: { variante?: VarianteBoton; tamano?: TamanoBoton; anchoCompleto?: boolean } = {}) {
  if (variante === 'publico-naranja' || variante === 'publico-fantasma') {
    return cn(PUBLICO[variante], 'disabled:pointer-events-none disabled:opacity-50', anchoCompleto && 'w-full');
  }
  return cn(BASE, VARIANTES[variante], TAMANOS[tamano], anchoCompleto && 'w-full');
}

interface PropsComunes {
  variante?: VarianteBoton;
  /** Por defecto `md`; dentro de una DataTable, `sm` (ver ContextoTabla). */
  tamano?: TamanoBoton;
  /** Icono a la izquierda (componente de lucide-react). */
  icono?: LucideIcon;
  /** Icono a la derecha (p. ej. ArrowRight). */
  iconoFinal?: LucideIcon;
  anchoCompleto?: boolean;
  children?: ReactNode;
}

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement>, PropsComunes {
  /** Muestra un indicador, deshabilita el botón y anuncia aria-busy. */
  cargando?: boolean;
  /** Texto mientras carga (por defecto, el mismo). */
  textoCargando?: ReactNode;
}

/**
 * Botón del registro de aplicación.
 *
 *   <Button onClick={guardar} cargando={guardando}>Guardar</Button>
 *   <Button variante="secundario" icono={Plus}>Nueva vacante</Button>
 *   <Button variante="peligro" icono={Trash2}>Eliminar</Button>
 *
 * - primario: la acción principal de la pantalla (una por vista).
 * - secundario: acción fuerte que no es la principal.
 * - contorno: acciones neutras (Cancelar, Exportar, Actualizar).
 * - fantasma: acciones terciarias dentro de tarjetas y tablas.
 * - peligro: borrar, rechazar, cancelar algo que no se deshace.
 * - publico-naranja / publico-fantasma: la píldora de las páginas públicas
 *   (login, registro, contacto), con el mismo `cargando` y `aria-busy`.
 *
 * type="button" por defecto: un botón dentro de un <form> no envía el
 * formulario salvo que se pida type="submit".
 *
 * Lleva data-boton="texto": la vista en tarjetas de DataTable lo usa para
 * bajar al pie de la tarjeta las acciones que llevan texto (un «Aprobar» o un
 * «Guardar» no caben junto al título en un móvil).
 */
const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    variante = 'primario',
    tamano: tamanoPedido,
    icono: Icono,
    iconoFinal: IconoFinal,
    anchoCompleto,
    cargando = false,
    textoCargando,
    disabled,
    className,
    children,
    type = 'button',
    ...resto
  },
  ref
) {
  const enTabla = useEnTabla();
  const tamano = tamanoPedido ?? (enTabla ? 'sm' : 'md');
  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled || cargando}
      aria-busy={cargando || undefined}
      data-boton="texto"
      className={cn(clasesBoton({ variante, tamano, anchoCompleto }), className)}
      {...resto}
    >
      {cargando ? (
        <Loader2 className="animate-spin" aria-hidden="true" />
      ) : (
        Icono && <Icono aria-hidden="true" />
      )}
      {cargando && textoCargando ? textoCargando : children}
      {!cargando && IconoFinal && <IconoFinal aria-hidden="true" />}
    </button>
  );
});

export default Button;

export interface ButtonLinkProps
  extends Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'href'>,
    PropsComunes {
  href: string;
  /**
   * Enlace a otro sitio (un CV, LinkedIn, un portafolio): un <a> que abre en
   * una pestaña nueva con rel="noopener noreferrer", la flecha ↗ al final y
   * «(se abre en una pestaña nueva)» para el lector. Valida tú el href si viene
   * de un usuario (isSafeHttpUrl).
   */
  externo?: boolean;
}

/**
 * Enlace con aspecto de botón (navega; no ejecuta una acción).
 *
 *   <ButtonLink href="/create-job" icono={Plus}>Publicar vacante</ButtonLink>
 *   <ButtonLink externo href={cvUrl} variante="contorno" tamano="sm" icono={FileText}>Ver CV</ButtonLink>
 */
export function ButtonLink({
  href,
  variante = 'primario',
  tamano: tamanoPedido,
  icono: Icono,
  iconoFinal: IconoFinal,
  anchoCompleto,
  externo = false,
  className,
  children,
  ...resto
}: ButtonLinkProps) {
  const enTabla = useEnTabla();
  const tamano = tamanoPedido ?? (enTabla ? 'sm' : 'md');
  if (externo) {
    const Final = IconoFinal ?? ArrowUpRight;
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        data-boton="texto"
        className={cn(clasesBoton({ variante, tamano, anchoCompleto }), className)}
        {...resto}
      >
        {Icono && <Icono aria-hidden="true" />}
        {children}
        <Final aria-hidden="true" className="opacity-70" />
        <span className="sr-only"> (se abre en una pestaña nueva)</span>
      </a>
    );
  }
  return (
    <Link
      href={href}
      data-boton="texto"
      className={cn(clasesBoton({ variante, tamano, anchoCompleto }), className)}
      {...resto}
    >
      {Icono && <Icono aria-hidden="true" />}
      {children}
      {IconoFinal && <IconoFinal aria-hidden="true" />}
    </Link>
  );
}
