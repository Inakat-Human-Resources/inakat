// RUTA: src/components/ui/Aviso.tsx
'use client';

import type { ReactNode } from 'react';
import { AlertCircle, AlertTriangle, CheckCircle2, Info, RefreshCw, X, type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import Button from './Button';
import IconButton from './IconButton';

export type TonoAviso = 'error' | 'exito' | 'info' | 'aviso';

// Pares medidos (texto / fondo): danger-dark/danger-tint 6.30 · lime-dark/lime-tint
// 7.84 · teal-dark/teal-tint 8.18 · orange-dark/orange-tint 6.14.
const TONOS: Record<TonoAviso, { icono: LucideIcon; caja: string; cerrar: string }> = {
  error: {
    icono: AlertCircle,
    caja: 'border-danger/30 bg-danger-tint text-danger-dark',
    cerrar: 'text-danger-dark hover:bg-danger/10',
  },
  exito: {
    icono: CheckCircle2,
    caja: 'border-lime-dark/25 bg-lime-tint text-lime-dark',
    cerrar: 'text-lime-dark hover:bg-lime-dark/10',
  },
  info: {
    icono: Info,
    caja: 'border-teal/20 bg-teal-tint text-teal-dark',
    cerrar: 'text-teal-dark hover:bg-teal/10',
  },
  aviso: {
    icono: AlertTriangle,
    caja: 'border-orange/40 bg-orange-tint text-orange-dark',
    cerrar: 'text-orange-dark hover:bg-orange/15',
  },
};

export interface AvisoProps {
  /** error (por defecto) · exito · info · aviso. */
  tono?: TonoAviso;
  /** Línea en negrita encima del mensaje (opcional). */
  titulo?: ReactNode;
  /** El mensaje. También vale como `children`. */
  mensaje?: ReactNode;
  children?: ReactNode;
  /**
   * Muestra «Reintentar»: vuelve a pedir los datos con LA MISMA función que los
   * pidió (un error de carga no es un estado vacío).
   */
  alReintentar?: () => void;
  textoReintentar?: string;
  /** Muestra la X para descartar el aviso (lo que antes hacía la pantalla). */
  alCerrar?: () => void;
  /** Tamaño de formulario o de modal: texto de 13 px y menos relleno. */
  compacto?: boolean;
  className?: string;
}

/**
 * Aviso en línea (no flotante) del registro de aplicación y de los
 * formularios públicos.
 *
 *   <Aviso mensaje={error} alReintentar={cargar} />                       // error de carga
 *   <Aviso tono="exito" titulo="Listo">Te enviamos el correo.</Aviso>
 *   <Aviso tono="info" alCerrar={() => setInfo(null)}>…</Aviso>
 *
 * - El error se anuncia al momento (role="alert"); el éxito y el aviso, con
 *   cortesía (role="status"); la información no se anuncia.
 * - Color Y texto Y icono: nunca sólo el color.
 * - Para lo que llega sin que la persona pulse nada (una subida que falla),
 *   úsalo: role="alert" hace que se oiga.
 *
 * `AvisoError` es el bloque de error de página de docs/DISENO.md §5 (con su
 * margen inferior): úsalo bajo el PageHeader.
 */
export default function Aviso({
  tono = 'error',
  titulo,
  mensaje,
  children,
  alReintentar,
  textoReintentar = 'Reintentar',
  alCerrar,
  compacto = false,
  className,
}: AvisoProps) {
  const { icono: Icono, caja, cerrar } = TONOS[tono];
  const rol = tono === 'error' ? 'alert' : tono === 'info' ? undefined : 'status';
  const cuerpo = mensaje ?? children;
  return (
    <div
      role={rol}
      className={cn(
        'flex items-start rounded-xl border',
        compacto ? 'gap-2 px-3 py-2.5 text-[13px]' : 'gap-3 px-4 py-3 text-sm',
        caja,
        className
      )}
    >
      <Icono
        className={cn('flex-none', compacto ? 'mt-px h-4 w-4' : 'mt-0.5 h-[18px] w-[18px]')}
        aria-hidden="true"
      />
      <div className="min-w-0 flex-1 self-center">
        {titulo && <p className="font-display font-semibold">{titulo}</p>}
        {cuerpo && <div className={titulo ? 'mt-0.5' : 'font-medium'}>{cuerpo}</div>}
      </div>
      {alReintentar && (
        <Button
          variante="contorno"
          tamano="sm"
          icono={RefreshCw}
          onClick={alReintentar}
          className={cn('flex-none', compacto ? '-my-1' : '-my-0.5')}
        >
          {textoReintentar}
        </Button>
      )}
      {alCerrar && (
        <IconButton
          etiqueta="Cerrar aviso"
          icono={X}
          tamano="sm"
          onClick={alCerrar}
          className={cn('-my-1 -mr-1', cerrar)}
        />
      )}
    </div>
  );
}

/**
 * Error de carga de una página (docs/DISENO.md §5): va bajo el PageHeader,
 * con «Reintentar» y la X opcionales.
 *
 *   {error && <AvisoError mensaje={error} alReintentar={fetchUsers} />}
 */
export function AvisoError({ className, ...props }: Omit<AvisoProps, 'tono'>) {
  return <Aviso tono="error" {...props} className={cn('mb-6', className)} />;
}
