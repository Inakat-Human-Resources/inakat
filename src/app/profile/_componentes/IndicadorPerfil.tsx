// RUTA: src/app/profile/_componentes/IndicadorPerfil.tsx
//
// Cuánto de su perfil ha llenado el candidato, dicho con el isotipo: el arco
// es el puente y el punto naranja (la persona) avanza por él. Sólo
// presentación: la página calcula qué está hecho a partir de su propio estado
// (no hay llamadas nuevas) y decide a dónde lleva cada pendiente.
//
// Registro de aplicación: nada ligado al scroll; el punto sólo se mueve cuando
// cambia el dato (200 ms, y con movimiento reducido globals.css lo deja en 0).

import { Check, Plus } from 'lucide-react';

export interface PasoPerfil {
  id: string;
  /** Qué falta, dicho corto: «Foto de perfil». */
  etiqueta: string;
  hecho: boolean;
}

/** Porcentaje entero de pasos hechos. */
export function porcentajePerfil(pasos: PasoPerfil[]): number {
  if (pasos.length === 0) return 100;
  return Math.round((pasos.filter((p) => p.hecho).length / pasos.length) * 100);
}

/**
 * Medio arco con el punto en la posición del progreso. Decorativo (el número
 * va en texto al lado). Verde azulado sobre blanco 7.38; el carril, niebla.
 */
export function ArcoProgreso({ porcentaje }: { porcentaje: number }) {
  const p = Math.max(0, Math.min(100, porcentaje));
  const arco = 'M10 60 A50 50 0 0 1 110 60';
  return (
    <svg viewBox="0 0 120 70" className="block h-auto w-full" aria-hidden="true" focusable="false">
      <path d={arco} fill="none" className="stroke-mist" strokeWidth={8} strokeLinecap="round" />
      {p > 0 && (
        <path
          d={arco}
          fill="none"
          className="stroke-teal transition-[stroke-dashoffset] duration-200 ease-out"
          strokeWidth={8}
          strokeLinecap="round"
          pathLength={100}
          strokeDasharray={100}
          strokeDashoffset={100 - p}
        />
      )}
      {/* El punto nace en el extremo izquierdo y gira sobre el centro del arco. */}
      <g
        className="transition-transform duration-200 ease-out"
        style={{ transform: `rotate(${p * 1.8}deg)`, transformOrigin: '60px 60px' }}
      >
        <circle cx={10} cy={60} r={6.5} className="fill-orange stroke-white" strokeWidth={2.5} />
      </g>
    </svg>
  );
}

export interface IndicadorPerfilProps {
  pasos: PasoPerfil[];
  /** Llevar a la persona a lo que falta (cambiar de pestaña, abrir el selector de foto…). */
  alIr: (id: string) => void;
}

/**
 * Tarjeta de completitud: el arco, el porcentaje y la lista de pendientes.
 * En pantallas estrechas sólo se listan los pendientes (en fichas); desde xl,
 * todos, con su marca de hecho.
 */
export default function IndicadorPerfil({ pasos, alIr }: IndicadorPerfilProps) {
  const porcentaje = porcentajePerfil(pasos);
  const hechos = pasos.filter((p) => p.hecho).length;
  const completo = hechos === pasos.length;

  return (
    <div>
      <div className="flex items-center gap-4 xl:flex-col xl:items-stretch xl:gap-2">
        <div className="relative w-28 flex-none xl:mx-auto xl:w-44">
          <ArcoProgreso porcentaje={porcentaje} />
          <p className="absolute inset-x-0 bottom-0 text-center font-display font-semibold leading-none text-ink tabular-nums">
            <span className="text-[22px] xl:text-[30px]">{porcentaje}</span>
            <span className="text-sm xl:text-base">%</span>
          </p>
        </div>
        <div className="min-w-0 xl:text-center">
          {completo ? (
            <p className="font-serif text-xl italic leading-tight text-ink">Tu perfil está completo.</p>
          ) : (
            <p className="font-display text-sm font-semibold text-ink">
              {hechos} de {pasos.length} secciones completas
            </p>
          )}
          <p className="mt-0.5 text-[13px] text-ink-muted">
            {completo
              ? 'Nada pendiente por ahora.'
              : 'Completa lo que falta para que las empresas conozcan tu perfil entero.'}
          </p>
        </div>
      </div>

      <ul className="mt-4 flex flex-wrap gap-2 xl:flex-col xl:gap-0.5">
        {pasos.map((paso) =>
          paso.hecho ? (
            <li key={paso.id} className="hidden items-center gap-2.5 px-2 py-1.5 text-sm text-ink-muted xl:flex">
              <span className="flex h-5 w-5 flex-none items-center justify-center rounded-full bg-lime text-ink" aria-hidden="true">
                <Check className="h-3 w-3" strokeWidth={3} />
              </span>
              {paso.etiqueta}
              <span className="sr-only"> (completo)</span>
            </li>
          ) : (
            <li key={paso.id} className="xl:w-full">
              <button
                type="button"
                onClick={() => alIr(paso.id)}
                className="inline-flex items-center gap-2 rounded-full border border-line-strong bg-white py-1.5 pl-1.5 pr-3 text-[13px] font-medium text-ink transition-colors duration-150 hover:border-ink hover:bg-paper xl:w-full xl:rounded-lg xl:border-transparent xl:bg-transparent xl:px-2 xl:text-sm xl:hover:border-transparent"
              >
                <span
                  className="flex h-5 w-5 flex-none items-center justify-center rounded-full border-[1.5px] border-dashed border-line-strong text-ink-muted"
                  aria-hidden="true"
                >
                  <Plus className="h-3 w-3" strokeWidth={2.5} />
                </span>
                <span className="sr-only">Completar: </span>
                {paso.etiqueta}
              </button>
            </li>
          )
        )}
      </ul>
    </div>
  );
}
