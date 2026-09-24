// RUTA: src/components/ui/IconButton.tsx
'use client';

import { forwardRef, type AnchorHTMLAttributes, type ButtonHTMLAttributes } from 'react';
import { Loader2, type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useEnTabla } from './ContextoTabla';

type Variante = 'fantasma' | 'contorno' | 'secundario' | 'peligro' | 'sobre-tinta';

const VARIANTES: Record<Variante, string> = {
  fantasma: 'text-ink hover:bg-ink/[0.06]',
  contorno: 'border border-line-strong bg-white text-ink hover:bg-paper hover:border-ink',
  secundario: 'bg-ink text-white hover:bg-teal',
  peligro: 'text-danger hover:bg-danger-tint',
  // Para la barra lateral y los suelos oscuros.
  'sobre-tinta': 'text-sidebar-text hover:bg-ink-soft hover:text-white',
};

const TAMANOS = {
  sm: 'h-8 w-8 [&_svg]:h-4 [&_svg]:w-4',
  md: 'h-10 w-10 [&_svg]:h-[18px] [&_svg]:w-[18px]',
} as const;

const BASE =
  'inline-flex flex-none items-center justify-center rounded-lg transition-colors duration-150 ' +
  'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal';

/**
 * Clases de un botón de icono, para aplicarlas a otro elemento (un <label>
 * de archivo, un enlace que no pasa por IconLink…). Recuerda el nombre
 * accesible: aria-label o texto sr-only.
 */
export function clasesIconButton({
  variante = 'fantasma',
  tamano = 'md',
}: { variante?: Variante; tamano?: keyof typeof TAMANOS } = {}) {
  return cn(BASE, VARIANTES[variante], TAMANOS[tamano]);
}

export interface IconButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> {
  /** OBLIGATORIO: nombre accesible (aria-label) y globo al pasar (title). */
  etiqueta: string;
  icono: LucideIcon;
  variante?: Variante;
  /** Por defecto `md`; dentro de una DataTable, `sm` (ver ContextoTabla). */
  tamano?: keyof typeof TAMANOS;
  cargando?: boolean;
}

/**
 * Botón de sólo icono. Sin `etiqueta` no compila: un botón con un icono y sin
 * nombre es un botón mudo para el lector de pantalla.
 *
 *   <IconButton etiqueta="Ver pipeline" icono={BarChart3} onClick={…} />
 */
const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton(
  { etiqueta, icono: Icono, variante = 'fantasma', tamano: tamanoPedido, cargando, className, type = 'button', disabled, title, ...resto },
  ref
) {
  const enTabla = useEnTabla();
  const tamano = tamanoPedido ?? (enTabla ? 'sm' : 'md');
  return (
    <button
      ref={ref}
      type={type}
      aria-label={etiqueta}
      title={title ?? etiqueta}
      disabled={disabled || cargando}
      aria-busy={cargando || undefined}
      className={cn(clasesIconButton({ variante, tamano }), 'disabled:pointer-events-none disabled:opacity-50', className)}
      {...resto}
    >
      {cargando ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Icono aria-hidden="true" />}
    </button>
  );
});

export default IconButton;

export interface IconLinkProps extends Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'children'> {
  href: string;
  /** OBLIGATORIO: nombre accesible (aria-label) y globo al pasar (title). */
  etiqueta: string;
  icono: LucideIcon;
  variante?: Variante;
  tamano?: keyof typeof TAMANOS;
  /**
   * Enlace externo (por defecto sí): abre en una pestaña nueva con
   * rel="noopener noreferrer" y lo dice al lector («…, se abre en una pestaña nueva»).
   */
  externo?: boolean;
}

/**
 * Enlace con aspecto de botón de icono: el perfil de LinkedIn, descargar un
 * documento. Es un <a> (navega); para una acción, IconButton.
 *
 *   <IconLink href={c.linkedinUrl} etiqueta={`LinkedIn de ${c.nombre}`} icono={Linkedin} tamano="sm" />
 *
 * El href no se valida aquí: si viene de un usuario, compruébalo antes
 * (isSafeHttpUrl de src/lib/sanitize.ts).
 */
export const IconLink = forwardRef<HTMLAnchorElement, IconLinkProps>(function IconLink(
  { href, etiqueta, icono: Icono, variante = 'fantasma', tamano: tamanoPedido, externo = true, className, title, target, rel, ...resto },
  ref
) {
  const enTabla = useEnTabla();
  const tamano = tamanoPedido ?? (enTabla ? 'sm' : 'md');
  return (
    <a
      ref={ref}
      href={href}
      target={target ?? (externo ? '_blank' : undefined)}
      rel={rel ?? (externo ? 'noopener noreferrer' : undefined)}
      aria-label={externo ? `${etiqueta}, se abre en una pestaña nueva` : etiqueta}
      title={title ?? etiqueta}
      className={cn(clasesIconButton({ variante, tamano }), className)}
      {...resto}
    >
      <Icono aria-hidden="true" />
    </a>
  );
});
