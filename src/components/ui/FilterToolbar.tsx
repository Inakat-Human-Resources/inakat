// RUTA: src/components/ui/FilterToolbar.tsx
'use client';

import { useId, useState, type ReactNode, type SelectHTMLAttributes } from 'react';
import { Search, SlidersHorizontal, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Input, Select } from './FormField';
import Button, { clasesBoton } from './Button';
import { Badge } from './Badge';

export interface FilterToolbarProps {
  /** Buscador de texto (opcional). */
  busqueda?: {
    valor: string;
    alCambiar: (valor: string) => void;
    /** Etiqueta accesible: «Buscar vacantes». */
    etiqueta: string;
    placeholder?: string;
  };
  /** Filtros: usa <FiltroSelect>. */
  children?: ReactNode;
  /** Botones a la derecha (Exportar, Nueva…). */
  acciones?: ReactNode;
  /** Cuántos filtros hay activos: con > 0 aparece «Limpiar filtros». */
  activos?: number;
  alLimpiar?: () => void;
  /** Resumen a la izquierda: «Mostrando 20 de 130». */
  resumen?: ReactNode;
  /**
   * Modo «aplicar al enviar» (búsquedas en el servidor): la barra es un
   * <form>; Intro en el buscador o en cualquier filtro, o el botón «Buscar»,
   * llaman a `alAplicar`. Sin esto, los filtros se aplican al cambiar (la
   * página decide).
   */
  alAplicar?: () => void;
  /** Con `alAplicar`: hay cambios que aún no se aplicaron → «Sin aplicar» (se anuncia). */
  sinAplicar?: boolean;
  /** Con `alAplicar`: mientras busca, «Buscar» se deshabilita. */
  aplicando?: boolean;
  /** Texto del botón de aplicar (por defecto «Buscar»). */
  textoAplicar?: string;
  /**
   * En móvil (< 640 px) los filtros (children) se pliegan tras un botón
   * «Filtros» con el contador de activos; desde sm, siempre a la vista.
   */
  plegableEnMovil?: boolean;
  /** Contador del botón «Filtros» (por defecto, `activos`). */
  activosPlegables?: number;
  /**
   * Bajo la fila de filtros, dentro de la misma barra (y del mismo <form>, así
   * Intro también aplica): un panel de filtros avanzados, una nota.
   */
  debajo?: ReactNode;
  className?: string;
}

/**
 * Barra de filtros de una lista o tabla. Va dentro de la Card de la tabla
 * (arriba) o justo encima.
 *
 *   <FilterToolbar
 *     busqueda={{ valor: q, alCambiar: setQ, etiqueta: 'Buscar candidatos', placeholder: 'Nombre o correo' }}
 *     activos={[estado, empresa].filter(Boolean).length}
 *     alLimpiar={() => { setEstado(''); setEmpresa(''); }}
 *   >
 *     <FiltroSelect etiqueta="Estado" value={estado} onChange={(e) => setEstado(e.target.value)}>
 *       <option value="">Todos</option>
 *     </FiltroSelect>
 *   </FilterToolbar>
 *
 * Búsqueda en el servidor (se aplica al pulsar «Buscar» o Intro):
 *
 *   <FilterToolbar busqueda={…} alAplicar={buscar} sinAplicar={firma !== firmaAplicada}
 *     aplicando={cargando} plegableEnMovil>…</FilterToolbar>
 */
export default function FilterToolbar({
  busqueda,
  children,
  acciones,
  activos = 0,
  alLimpiar,
  resumen,
  alAplicar,
  sinAplicar = false,
  aplicando = false,
  textoAplicar = 'Buscar',
  plegableEnMovil = false,
  activosPlegables,
  debajo,
  className,
}: FilterToolbarProps) {
  const idBusqueda = useId();
  const idFiltros = useId();
  const [filtrosAbiertos, setFiltrosAbiertos] = useState(false);
  const contadorPlegables = activosPlegables ?? activos;

  const fila = (
    <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
      <div className="flex flex-1 flex-wrap items-end gap-3">
        {busqueda && (
          <div className="flex w-full flex-col gap-1 sm:w-64">
            <label htmlFor={idBusqueda} className="text-xs font-medium text-ink-muted">
              {busqueda.etiqueta}
            </label>
            <Input
              id={idBusqueda}
              type="search"
              value={busqueda.valor}
              onChange={(e) => busqueda.alCambiar(e.target.value)}
              placeholder={busqueda.placeholder}
              prefijo={<Search />}
              className="h-9"
            />
          </div>
        )}
        {plegableEnMovil && children && (
          <button
            type="button"
            onClick={() => setFiltrosAbiertos((v) => !v)}
            aria-expanded={filtrosAbiertos}
            aria-controls={idFiltros}
            className={cn(clasesBoton({ variante: 'contorno', tamano: 'sm' }), 'h-9 sm:hidden')}
          >
            <SlidersHorizontal aria-hidden="true" />
            Filtros
            {contadorPlegables > 0 && (
              <span className="rounded-full bg-ink px-1.5 py-0.5 text-[11px] leading-none text-white tabular-nums">
                {contadorPlegables}
                <span className="sr-only"> activos</span>
              </span>
            )}
          </button>
        )}
        {plegableEnMovil ? (
          <div id={idFiltros} className={cn(filtrosAbiertos ? 'contents' : 'hidden', 'sm:contents')}>
            {children}
          </div>
        ) : (
          children
        )}
        {alAplicar && (
          <div className="flex items-center gap-2">
            <Button type="submit" tamano="sm" variante="secundario" icono={Search} className="h-9" disabled={aplicando}>
              {textoAplicar}
            </Button>
            {/* La región viva existe siempre; su contenido aparece al tocar un
                filtro sin aplicarlo todavía (así el lector lo anuncia). */}
            <span role="status" className="inline-flex">
              {sinAplicar && (
                <Badge tono="aviso" tamano="sm">
                  Sin aplicar
                </Badge>
              )}
            </span>
          </div>
        )}
        {activos > 0 && alLimpiar && (
          <button
            type="button"
            onClick={alLimpiar}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg px-2.5 text-[13px] font-medium text-teal transition-colors duration-150 hover:bg-teal-tint"
          >
            <X className="h-4 w-4" aria-hidden="true" />
            Limpiar filtros
            <span className="sr-only">({activos} activos)</span>
          </button>
        )}
      </div>
      {(resumen || acciones) && (
        <div className="flex flex-wrap items-center gap-3">
          {resumen && <p className="text-[13px] text-ink-muted tabular-nums">{resumen}</p>}
          {acciones}
        </div>
      )}
    </div>
  );

  if (alAplicar) {
    return (
      <form
        role="search"
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          alAplicar();
        }}
        className={className}
      >
        {fila}
        {debajo}
      </form>
    );
  }
  return (
    <div role="search" className={className}>
      {fila}
      {debajo}
    </div>
  );
}

export interface FiltroSelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  /** Etiqueta VISIBLE, pequeña, sobre el desplegable. */
  etiqueta: string;
  /** Resalta el filtro cuando tiene un valor elegido. */
  activo?: boolean;
}

/** Desplegable compacto con etiqueta visible, para barras de filtros. */
export function FiltroSelect({ etiqueta, activo, className, children, id, ...props }: FiltroSelectProps) {
  const generado = useId();
  const idSelect = id ?? `filtro-${generado}`;
  const tieneValor = activo ?? Boolean(props.value);
  return (
    // En móvil, a lo ancho (como el buscador); desde sm, a su medida.
    <div className="flex w-full flex-col gap-1 sm:w-auto sm:min-w-[9.5rem]">
      <label htmlFor={idSelect} className="text-xs font-medium text-ink-muted">
        {etiqueta}
      </label>
      <Select
        id={idSelect}
        {...props}
        // 16 px en móvil (iOS hace zoom al enfocar un campo más pequeño), 13 px desde sm.
        className={cn('h-9 text-base sm:text-[13px]', tieneValor && 'border-teal bg-teal-tint/40 font-medium', className)}
      >
        {children}
      </Select>
    </div>
  );
}
