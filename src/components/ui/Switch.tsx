// RUTA: src/components/ui/Switch.tsx
'use client';

import { cn } from '@/lib/utils';

export interface SwitchProps {
  /** Estado actual (aria-checked). */
  activo: boolean;
  /** Lo que ya hacía la pantalla al pulsar el estado (con su confirmación, si la tenía). */
  alCambiar: () => void;
  /**
   * Qué se activa, para el nombre accesible: «Pack 10», «Ana Ruiz». El lector
   * oye «Activo: Pack 10», así sabe QUÉ cambia en una tabla de veinte filas
   * iguales. Si el nombre ya está en otro elemento, usa `describidoPor`.
   */
  objeto?: string;
  /** id del elemento que describe a quién pertenece (p. ej. el nombre de la fila). */
  describidoPor?: string;
  /** Textos visibles de cada estado (por defecto «Activo» / «Inactivo»). */
  textos?: { activo: string; inactivo: string };
  /** Mientras se guarda: deshabilitado y con `textoCargando` en lugar del estado. */
  cargando?: boolean;
  textoCargando?: string;
  disabled?: boolean;
  /**
   * Color de la pista encendida. teal (por defecto): 7.38 sobre blanco, 6.77
   * sobre papel. lima-oscuro: 8.92 sobre blanco (acceso de cuentas).
   */
  tono?: 'teal' | 'lima-oscuro';
  className?: string;
}

/**
 * Interruptor de estado (activo/inactivo) que se cambia con un clic, para
 * tablas y fichas: especialidades, precios, paquetes, vendedores, usuarios…
 *
 *   <Switch activo={p.isActive} alCambiar={() => alternar(p)} objeto={p.name} />
 *   <Switch activo={u.isActive} alCambiar={() => alternar(u)} describidoPor={`nombre-${u.id}`} tono="lima-oscuro" />
 *
 * - Es un interruptor (button role="switch" + aria-checked) con el estado
 *   ESCRITO al lado: nunca sólo el color.
 * - Nombre accesible = el texto visible + el objeto («Activo: Pack 10»).
 * - Colores medidos (WCAG 1.4.11, 3:1 para un control): pista encendida teal
 *   7.38 / 6.77 (blanco / papel) o lima oscuro 8.92; apagada line-strong
 *   3.83 / 3.51; perilla blanca sobre la pista.
 * - No cambia nada por sí mismo: llama a `alCambiar` y la pantalla decide
 *   (confirmación, PUT…), como hacía antes su botón.
 */
export default function Switch({
  activo,
  alCambiar,
  objeto,
  describidoPor,
  textos = { activo: 'Activo', inactivo: 'Inactivo' },
  cargando = false,
  textoCargando = 'Guardando…',
  disabled = false,
  tono = 'teal',
  className,
}: SwitchProps) {
  const texto = cargando ? textoCargando : activo ? textos.activo : textos.inactivo;
  return (
    <button
      type="button"
      role="switch"
      aria-checked={activo}
      // «Activo: Pack 10». Empieza por el texto visible (WCAG 2.5.3).
      aria-label={objeto ? `${texto}: ${objeto}` : undefined}
      aria-busy={cargando || undefined}
      aria-describedby={describidoPor}
      disabled={disabled || cargando}
      onClick={alCambiar}
      className={cn(
        'inline-flex h-8 flex-none items-center gap-2 whitespace-nowrap rounded-full py-1 pl-1 pr-2.5 text-[13px] font-medium',
        'transition-colors duration-150 hover:bg-ink/[0.06] disabled:opacity-60',
        cargando ? 'disabled:cursor-wait' : 'disabled:cursor-not-allowed',
        'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal',
        activo ? 'text-ink' : 'text-ink-muted',
        className
      )}
    >
      <span
        aria-hidden="true"
        className={cn(
          'relative inline-flex h-[18px] w-8 flex-none items-center rounded-full transition-colors duration-150',
          activo ? (tono === 'lima-oscuro' ? 'bg-lime-dark' : 'bg-teal') : 'bg-line-strong'
        )}
      >
        <span
          className={cn(
            'h-3.5 w-3.5 rounded-full bg-white shadow-sm transition-transform duration-150 ease-marca',
            activo ? 'translate-x-4' : 'translate-x-0.5'
          )}
        />
      </span>
      <span>{texto}</span>
    </button>
  );
}
