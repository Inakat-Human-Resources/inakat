// RUTA: src/components/ui/StatCard.tsx

import type { ReactNode } from 'react';
import Link from 'next/link';
import type { LucideIcon } from 'lucide-react';
import { ArrowRight } from 'lucide-react';
import { cn } from '@/lib/utils';

type Tono = 'teal' | 'orange' | 'lime' | 'ink';

// Icono sobre su tinte: teal 6.18 · naranja oscuro 6.14 · lima oscuro 7.84 · tinta 10.35.
const TONOS: Record<Tono, string> = {
  teal: 'bg-teal-tint text-teal',
  orange: 'bg-orange-tint text-orange-dark',
  lime: 'bg-lime-tint text-lime-dark',
  ink: 'bg-mist text-ink',
};

export interface StatCardProps {
  /** Qué se cuenta: «Vacantes totales». */
  etiqueta: string;
  /** La cifra (se pinta con números tabulares). */
  valor: ReactNode;
  /** Desglose o contexto bajo la cifra: «98 activas · 12 borradores». */
  detalle?: ReactNode;
  icono?: LucideIcon;
  tono?: Tono;
  /** Enlace al listado de lo que se cuenta. */
  enlace?: { href: string; etiqueta: string };
  /** Aviso destacado bajo el detalle (p. ej. «3 pausadas»). */
  alerta?: ReactNode;
  cargando?: boolean;
  /**
   * Cifra larga («$1,262,050.00», 13 caracteres): más pequeña donde la tarjeta
   * es estrecha (media columna en móvil; cuatro por fila con la barra lateral
   * entre 1280 y 1535 px) para no salirse de ella. Sin decirlo, se activa sola
   * cuando `valor` es un texto de más de 10 caracteres. Si una fila de cifras
   * mezcla largas y cortas, pásalo a todas para que midan igual.
   */
  compacta?: boolean;
  className?: string;
}

/**
 * Una cifra del panel. Va en una rejilla de 2 (hasta 1280 px: con la barra
 * lateral no caben 4 sin recortar etiquetas) a 4:
 *
 *   <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
 *     <StatCard etiqueta="Candidatos" valor={1234} detalle="En banco de talentos" icono={Users} />
 *   </div>
 *
 * Absorbe a src/components/company/StatCard.tsx, que ya se había retirado en la
 * auditoría EMP por código muerto (un test impide que vuelva): si una pantalla
 * necesita una cifra, es ésta. Formatea tú el número (cifra.toLocaleString('es-MX')).
 */
export default function StatCard({
  etiqueta,
  valor,
  detalle,
  icono: Icono,
  tono = 'teal',
  enlace,
  alerta,
  cargando,
  compacta,
  className,
}: StatCardProps) {
  const cifraCompacta = compacta ?? (typeof valor === 'string' && valor.length > 10);
  return (
    <div
      className={cn(
        'relative flex min-w-0 flex-col rounded-xl border border-line bg-white p-4 shadow-ap-1 sm:p-5',
        className
      )}
      aria-busy={cargando || undefined}
    >
      <div className="flex items-start justify-between gap-3">
        {/* En móvil (dos cifras por fila) la etiqueta puede ocupar dos renglones
            y el icono se retira: «Solicitudes pendientes» se leía «Solicitudes p…».
            Desde sm, un renglón recortado con el texto completo en el globo. */}
        <p
          className="min-w-0 text-[13px] font-medium leading-snug text-ink-muted line-clamp-2 sm:line-clamp-none sm:truncate sm:text-sm"
          title={etiqueta}
        >
          {etiqueta}
        </p>
        {Icono && (
          <span
            className={cn('hidden h-9 w-9 flex-none items-center justify-center rounded-lg sm:flex', TONOS[tono])}
            aria-hidden="true"
          >
            <Icono className="h-[18px] w-[18px]" />
          </span>
        )}
      </div>
      <p
        className={cn(
          'mt-2 font-display font-semibold leading-none tracking-tight text-ink tabular-nums sm:-mt-1',
          cifraCompacta ? 'text-lg sm:text-[32px] xl:max-2xl:text-[26px]' : 'text-[28px] sm:text-[32px]'
        )}
      >
        {cargando ? <span className="skeleton inline-block h-8 w-16 rounded-md align-middle" aria-hidden="true" /> : valor}
        {cargando && <span className="sr-only">Cargando</span>}
      </p>
      {detalle && <p className="mt-2 text-xs leading-relaxed text-ink-muted">{detalle}</p>}
      {alerta && <div className="mt-1.5 text-xs font-medium text-orange-dark">{alerta}</div>}
      {enlace && (
        <Link
          href={enlace.href}
          className="group mt-3 inline-flex items-center gap-1 self-start rounded text-xs font-semibold text-teal hover:text-teal-dark"
        >
          {enlace.etiqueta}
          <ArrowRight className="h-3.5 w-3.5 transition-transform duration-150 group-hover:translate-x-0.5" aria-hidden="true" />
        </Link>
      )}
    </div>
  );
}
