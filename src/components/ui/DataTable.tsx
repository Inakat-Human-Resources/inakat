// RUTA: src/components/ui/DataTable.tsx
'use client';

import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type MouseEvent,
  type ReactNode,
} from 'react';
import { ArrowUpDown, ChevronDown, ChevronUp } from 'lucide-react';
import { cn } from '@/lib/utils';
import Pagination, { type PaginacionApi } from './Pagination';
import Skeleton from './Skeleton';
import { Checkbox } from './FormField';
import { EnTablaContext } from './ContextoTabla';

export interface Columna<T> {
  /** Identificador; también es la clave de orden que recibe `alOrdenar`. */
  id: string;
  /** Texto de la cabecera. En móvil es la etiqueta de cada dato de la tarjeta. */
  encabezado: string;
  celda: (fila: T) => ReactNode;
  ordenable?: boolean;
  alinear?: 'inicio' | 'centro' | 'fin';
  /** Cifras: números tabulares y alineadas a la derecha. */
  numerica?: boolean;
  /**
   * Esconder la columna cuando la TABLA (no la ventana) mide menos de:
   * md 800 px · lg 960 px · xl 1100 px · 2xl 1280 px. Lo resuelven container
   * queries de app.css. Para subir su dato a la celda principal cuando se
   * esconde, marca ese elemento con data-solo-bajo="xl" (ver src/app/admin/page.tsx).
   */
  ocultarBajo?: 'md' | 'lg' | 'xl' | '2xl';
  /**
   * Papel de la columna en la vista de tarjetas (móvil). Objetivo: 90–120 px
   * por tarjeta, no un par «etiqueta: valor» por columna.
   * - titulo: encabeza la tarjeta, sin etiqueta;
   * - acciones: arriba a la derecha si son botones de icono; si llevan texto
   *   («Aprobar», «Guardar») o campos, al pie de la tarjeta (ver `accionesAbajo`);
   * - meta: bajo el título, en UNA línea con las demás «meta», separadas por
   *   « · » y sin etiqueta (empresa · ubicación · fecha);
   * - completa: a lo ancho, sin etiqueta;
   * - oculta: no sale en la tarjeta (columnas secundarias);
   * - normal (por defecto): «Encabezado: valor».
   */
  enTarjeta?: 'titulo' | 'acciones' | 'meta' | 'completa' | 'oculta' | 'normal';
  /**
   * Nunca parte en dos líneas: salarios («$55,000 – $65,000 MXN»), fechas,
   * cifras con unidad. En tarjetas sí puede partir (el ancho manda).
   */
  unaLinea?: boolean;
  /**
   * Una línea con «…» a partir de este ancho (CSS): empresa, ubicación,
   * nombres largos. Pon también `tituloCelda` para que el texto completo salga
   * al pasar el ratón (el lector de pantalla lo lee entero de todos modos).
   */
  truncarEn?: string;
  /** Texto del atributo title de la celda (el valor completo de una celda truncada). */
  tituloCelda?: (fila: T) => string | undefined;
  /** Ancho u otras clases de la columna (cabecera y celdas). En tarjetas, los anchos no cuentan. */
  className?: string;
  /** Cabecera sólo para lectores de pantalla (p. ej. la columna de acciones). */
  encabezadoOculto?: boolean;
}

/**
 * Selección múltiple (casillas). La página lleva el estado: la tabla sólo
 * pinta las casillas y avisa de los cambios.
 */
export interface SeleccionTabla<T> {
  /** ¿Está marcada la fila? */
  marcada: (fila: T) => boolean;
  /** Marca o desmarca una fila (casilla, o clic en la fila si no es clicable). */
  alAlternar: (fila: T) => void;
  /** La fila no se puede marcar (p. ej. ya asignada): casilla deshabilitada y fila apagada. */
  deshabilitada?: (fila: T) => boolean;
  /** Nombre accesible de la casilla de cada fila: «Seleccionar a Ana Ruiz». */
  etiquetaFila: (fila: T) => string;
  /**
   * Casilla «todos», en una barra sobre la tabla (así también se ve en la
   * vista de tarjetas, donde la cabecera se esconde). La página decide qué
   * significa «todos» (p. ej. sólo las filas visibles que se pueden marcar);
   * la tabla la pinta marcada si están marcadas todas las filas habilitadas
   * y a medias (indeterminate) si sólo algunas.
   */
  todas?: {
    etiqueta: string;
    alAlternar: () => void;
    /** Texto a la derecha de la barra: «3 ya asignados». */
    extra?: ReactNode;
  };
}

export interface OrdenTabla {
  columna: string;
  direccion: 'asc' | 'desc';
}

export interface DataTableProps<T> {
  columnas: Columna<T>[];
  filas: T[];
  claveFila: (fila: T) => string | number;
  /** Nombre de la tabla (caption para lectores de pantalla): «Vacantes». */
  etiqueta: string;
  cargando?: boolean;
  filasEsqueleto?: number;
  /** Qué pintar sin filas (un <EmptyState>). */
  vacio?: ReactNode;
  /** Orden actual (lo lleva la página: la tabla sólo lo pinta y lo pide). */
  orden?: OrdenTabla;
  alOrdenar?: (columna: string) => void;
  /** Fila clicable: con ratón en toda la fila y con Intro/Espacio al enfocarla. */
  alActivarFila?: (fila: T) => void;
  /** Resalta una fila (p. ej. la abierta en un panel lateral): aria-current. */
  filaSeleccionada?: (fila: T) => boolean;
  /** Selección múltiple con casillas (primera columna). Ver SeleccionTabla. */
  seleccion?: SeleccionTabla<T>;
  /** Clases extra de cada fila (estados propios de la página). */
  claseFila?: (fila: T) => string | undefined;
  /** Paginación REAL con el total de la API. */
  paginacion?: PaginacionApi;
  alCambiarPagina?: (pagina: number) => void;
  /** Qué se pagina, en plural: «vacantes». */
  etiquetaTotal?: string;
  /** Móvil: la misma tabla en tarjetas (por defecto) o con desplazamiento lateral. */
  movil?: 'tarjetas' | 'desplazar';
  /**
   * Tarjetas: dónde van las acciones (`enTarjeta: 'acciones'`).
   * - sin indicar (por defecto): arriba a la derecha si son sólo iconos; al
   *   pie de la tarjeta si llevan un <Button> con texto o un campo;
   * - true: siempre al pie, a lo ancho (el título se queda con toda la línea);
   * - false: siempre arriba a la derecha.
   */
  accionesAbajo?: boolean;
  /** Cabecera fija bajo la barra del AppShell al bajar por la página (desde lg). */
  cabeceraFija?: boolean;
  /**
   * Alto mínimo de fila: 44 px (compacta, por defecto: listados) o 48 px
   * (normal). Dentro de la tabla los botones salen en `sm` (32 px) salvo que la
   * página pida otro tamaño: así una fila con acciones no pasa de 48 px.
   */
  densidad?: 'compacta' | 'normal';
  className?: string;
}

const ALINEAR = { inicio: 'text-left', centro: 'text-center', fin: 'text-right' } as const;
const INTERACTIVOS = 'a, button, input, select, textarea, summary, label, [role="button"], [role="checkbox"], [role="link"]';

/**
 * Tabla de datos del registro de aplicación.
 *
 *   <DataTable
 *     etiqueta="Vacantes"
 *     columnas={COLUMNAS}
 *     filas={pagina}
 *     claveFila={(v) => v.id}
 *     orden={{ columna: campo, direccion }}
 *     alOrdenar={ordenarPor}
 *     alActivarFila={abrirDetalle}
 *     paginacion={pagination}
 *     alCambiarPagina={setPagina}
 *     etiquetaTotal="vacantes"
 *     cargando={cargando}
 *     vacio={<EmptyState titulo="No hay vacantes" />}
 *   />
 *
 * - Columnas declarativas; orden controlado por la página (aria-sort en la
 *   cabecera, botón en cada cabecera ordenable).
 * - Filas de 44–48 px, cifras con números tabulares.
 * - Fila clicable con teclado; los botones y enlaces de dentro siguen
 *   funcionando solos (su clic no activa la fila).
 * - Tabla estrecha (< 600 px de TABLA: el móvil, o una columna de rejilla): la
 *   MISMA tabla se ve como tarjetas (un solo DOM: los lectores de pantalla y
 *   los tests ven una única copia de cada dato), o con desplazamiento. Cada
 *   celda envuelve su contenido en UN .ap-celda (en escritorio no pinta caja:
 *   display: contents): así «etiqueta | valor» son siempre dos piezas aunque
 *   la celda devuelva varios nodos («7» y «años» ya no se parten).
 * - Cabecera fija desde lg: la tarjeta recorta con overflow: clip (no crea
 *   contenedor de scroll). No la metas en un <section> sin overflow-visible
 *   (globals.css: section { overflow: hidden } mata el sticky).
 * - Si la tabla NO cabe a lo ancho (muchas columnas, pantalla de 1024–1280 px),
 *   la cabecera deja de ser fija y la tabla se desplaza en horizontal: una
 *   cabecera fija sólo funciona sin contenedor de scroll, y sin él las columnas
 *   de la derecha quedarían recortadas e inalcanzables. Lo mide sola (ResizeObserver).
 *   Mientras desborda, la caja lleva data-desborda y una sombra estrecha en el
 *   borde derecho (app.css) dice que hay más a la derecha.
 *   Aun así, esconde las columnas secundarias con `ocultarBajo`: desplazarse de
 *   lado es el último recurso, no el diseño.
 */
export default function DataTable<T>({
  columnas,
  filas,
  claveFila,
  etiqueta,
  cargando = false,
  filasEsqueleto = 6,
  vacio,
  orden,
  alOrdenar,
  alActivarFila,
  filaSeleccionada,
  seleccion,
  claseFila,
  paginacion,
  alCambiarPagina,
  etiquetaTotal = 'resultados',
  movil = 'tarjetas',
  accionesAbajo,
  cabeceraFija = true,
  densidad = 'compacta',
  className,
}: DataTableProps<T>) {
  // Alto de celda = alto mínimo de la fila (en una tabla, `height` de la celda
  // actúa como mínimo): 44 px compacta, 48 px normal. En tarjetas no cuenta.
  const pad = densidad === 'compacta' ? 'h-11 py-2' : 'h-12 py-2.5';

  // ¿La tabla es más ancha que su contenedor? Entonces se desplaza en
  // horizontal y la cabecera deja de ser fija (ver arriba). Medir el ancho
  // REAL de la tabla (no el del contenedor) no oscila: cambiar el overflow del
  // contenedor no cambia lo que ocupa la tabla.
  const contenedorRef = useRef<HTMLDivElement>(null);
  const tablaRef = useRef<HTMLTableElement>(null);
  const [desborda, setDesborda] = useState(false);
  // ¿Se desplazó hasta el final? Entonces ya no hay nada escondido a la derecha.
  const [alFinal, setAlFinal] = useState(false);
  useEffect(() => {
    const contenedor = contenedorRef.current;
    const tabla = tablaRef.current;
    if (!contenedor || !tabla) return;
    const medirFinal = () =>
      setAlFinal(contenedor.scrollLeft + contenedor.clientWidth >= contenedor.scrollWidth - 1);
    contenedor.addEventListener('scroll', medirFinal, { passive: true });
    if (typeof ResizeObserver === 'undefined') {
      return () => contenedor.removeEventListener('scroll', medirFinal);
    }
    const medir = () => {
      setDesborda(tabla.offsetWidth > contenedor.clientWidth + 1);
      medirFinal();
    };
    medir();
    const observador = new ResizeObserver(medir);
    observador.observe(contenedor);
    observador.observe(tabla);
    return () => {
      contenedor.removeEventListener('scroll', medirFinal);
      observador.disconnect();
    };
  }, []);
  const fija = cabeceraFija && !desborda;

  // Tarjetas: la línea «meta» envuelve cuando no cabe, y la « · » de la meta
  // que empieza renglón quedaba sola al principio de la línea. Se marca esa
  // meta (data-meta-inicio) y app.css esconde su separador SIN cambiar su
  // ancho (no altera dónde parte la línea: no hay vaivén). Sólo en tarjetas.
  useEffect(() => {
    const tabla = tablaRef.current;
    if (!tabla) return;
    let cuadro = 0;
    const marcar = () => {
      cuadro = 0;
      const cuerpo = tabla.tBodies[0];
      if (!cuerpo) return;
      for (const tr of Array.from(cuerpo.rows)) {
        const metas = Array.from(tr.cells).filter((td) => td.dataset.tarjeta === 'meta');
        if (metas.length < 2) continue;
        const enTarjeta = typeof window !== 'undefined' && window.getComputedStyle(tr).display === 'flex';
        let inicio: number | null = null;
        for (const td of metas) {
          const visible = td.offsetWidth > 0;
          const empiezaRenglon = enTarjeta && visible && inicio !== null && td.offsetLeft <= inicio + 1;
          if (visible && inicio === null) inicio = td.offsetLeft;
          if (empiezaRenglon) td.setAttribute('data-meta-inicio', '');
          else td.removeAttribute('data-meta-inicio');
        }
      }
    };
    const pedir = () => {
      if (!cuadro) cuadro = window.requestAnimationFrame(marcar);
    };
    marcar();
    if (typeof ResizeObserver === 'undefined') return;
    const observador = new ResizeObserver(pedir);
    observador.observe(tabla);
    return () => {
      observador.disconnect();
      if (cuadro) window.cancelAnimationFrame(cuadro);
    };
  }, [filas, cargando]);

  // Selección: estado de la casilla «todos» (sobre las filas que se pueden marcar).
  const habilitadas = seleccion ? filas.filter((f) => !seleccion.deshabilitada?.(f)) : [];
  const todasMarcadas = Boolean(seleccion) && habilitadas.length > 0 && habilitadas.every((f) => seleccion!.marcada(f));
  const algunaMarcada = Boolean(seleccion) && habilitadas.some((f) => seleccion!.marcada(f));
  const casillaTodasRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (casillaTodasRef.current) casillaTodasRef.current.indeterminate = algunaMarcada && !todasMarcadas;
  });
  // Sin fila clicable, el clic en la fila marca su casilla.
  const alternarAlClic = Boolean(seleccion) && !alActivarFila;
  const columnasTotales = columnas.length + (seleccion ? 1 : 0);

  const alClic = (e: MouseEvent<HTMLTableRowElement>, fila: T) => {
    if (!alActivarFila && !alternarAlClic) return;
    const origen = (e.target as HTMLElement).closest(INTERACTIVOS);
    // Un botón o enlace dentro de la fila hace lo suyo, no abre la fila.
    if (origen && e.currentTarget.contains(origen)) return;
    // Seleccionar texto no es un clic.
    if (typeof window !== 'undefined' && window.getSelection()?.toString()) return;
    if (alActivarFila) {
      alActivarFila(fila);
      return;
    }
    if (seleccion && !seleccion.deshabilitada?.(fila)) seleccion.alAlternar(fila);
  };

  const alTecla = (e: KeyboardEvent<HTMLTableRowElement>, fila: T) => {
    if (!alActivarFila || e.target !== e.currentTarget) return;
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      alActivarFila(fila);
    }
  };

  const ordenDe = (col: Columna<T>): 'ascending' | 'descending' | 'none' | undefined => {
    if (!col.ordenable) return undefined;
    if (orden?.columna !== col.id) return 'none';
    return orden.direccion === 'asc' ? 'ascending' : 'descending';
  };

  const alineacion = (col: Columna<T>) => ALINEAR[col.alinear ?? (col.numerica ? 'fin' : 'inicio')];

  return (
    <div className={className}>
      {seleccion?.todas && !cargando && filas.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b border-line bg-paper/60 px-5 py-2.5">
          <Checkbox
            ref={casillaTodasRef}
            etiqueta={seleccion.todas.etiqueta}
            checked={todasMarcadas}
            onChange={seleccion.todas.alAlternar}
            disabled={habilitadas.length === 0}
          />
          {seleccion.todas.extra && (
            <span className="text-[13px] tabular-nums text-ink-muted">{seleccion.todas.extra}</span>
          )}
        </div>
      )}
      {/* ap-tabla-caja: contenedor de las container queries de app.css (las
          columnas se esconden según el ancho de la TABLA, no de la ventana).
          data-desborda: la tabla no cabe y se desplaza de lado; la sombra del
          borde derecho (ap-tabla-sombra) dice que hay más, y app.css pinta con
          el mismo atributo la de una columna fija a la derecha. */}
      <div className="relative">
      <div
        ref={contenedorRef}
        data-desborda={desborda || undefined}
        className={cn('ap-tabla-caja overflow-x-auto', fija && 'lg:overflow-visible')}
      >
        {/* Dentro de la tabla, Button/IconButton salen en `sm` si la página no
            pide otro tamaño (ContextoTabla). */}
        <EnTablaContext.Provider value={true}>
        <table
          ref={tablaRef}
          // Roles explícitos: la vista de tarjetas cambia el display de la tabla
          // y algunos navegadores dejan de exponerla como tabla sin ellos.
          role="table"
          className={cn(
            'ap-tabla text-sm',
            movil === 'tarjetas' && 'ap-tabla--tarjetas',
            seleccion && 'ap-tabla--seleccion',
            fija && 'ap-tabla--fija'
          )}
          data-acciones={accionesAbajo === undefined ? undefined : accionesAbajo ? 'abajo' : 'arriba'}
          aria-busy={cargando || undefined}
        >
          <caption className="sr-only">
            {etiqueta}
            {alActivarFila ? '. Pulsa Intro en una fila para abrirla.' : ''}
          </caption>
          <thead role="rowgroup">
            <tr role="row">
              {seleccion && (
                <th role="columnheader" scope="col" className="w-px border-b border-line bg-paper py-2.5 pl-5 pr-1">
                  <span className="sr-only">Seleccionar</span>
                </th>
              )}
              {columnas.map((col) => {
                const aria = ordenDe(col);
                const activa = orden?.columna === col.id;
                return (
                  <th
                    key={col.id}
                    role="columnheader"
                    scope="col"
                    aria-sort={aria}
                    data-ocultar={col.ocultarBajo}
                    className={cn(
                      'whitespace-nowrap border-b border-line bg-paper px-3 py-2.5 text-xs font-semibold uppercase tracking-[0.06em] text-ink-muted first:pl-5 last:pr-5',
                      alineacion(col),
                      col.className
                    )}
                  >
                    {col.encabezadoOculto ? (
                      <span className="sr-only">{col.encabezado}</span>
                    ) : col.ordenable && alOrdenar ? (
                      <button
                        type="button"
                        onClick={() => alOrdenar(col.id)}
                        className={cn(
                          '-mx-1.5 inline-flex items-center gap-1 rounded-md px-1.5 py-1 uppercase tracking-[0.06em] transition-colors duration-150 hover:bg-ink/[0.06] hover:text-ink',
                          activa && 'text-ink'
                        )}
                      >
                        {col.encabezado}
                        {activa ? (
                          orden?.direccion === 'asc' ? (
                            <ChevronUp className="h-3.5 w-3.5 text-teal" aria-hidden="true" />
                          ) : (
                            <ChevronDown className="h-3.5 w-3.5 text-teal" aria-hidden="true" />
                          )
                        ) : (
                          <ArrowUpDown className="h-3.5 w-3.5 opacity-50" aria-hidden="true" />
                        )}
                      </button>
                    ) : (
                      col.encabezado
                    )}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody role="rowgroup">
            {cargando ? (
              Array.from({ length: filasEsqueleto }, (_, i) => (
                <tr key={`esqueleto-${i}`} role="row" aria-hidden="true">
                  {seleccion && (
                    <td role="cell" data-tarjeta="oculta" className={cn('w-px border-b border-line pl-5 pr-1', pad)}>
                      <Skeleton className="h-4 w-4" />
                    </td>
                  )}
                  {columnas.map((col, j) => (
                    <td
                      key={col.id}
                      role="cell"
                      data-ocultar={col.ocultarBajo}
                      data-tarjeta={j === 0 ? 'completa' : 'oculta'}
                      // Las clases de la columna también: una columna escondida
                      // con una clase propia no deja casillas sin cabecera.
                      className={cn('border-b border-line px-3 first:pl-5 last:pr-5', pad, col.className)}
                    >
                      <Skeleton className={cn('h-4', j === 0 ? 'w-3/4' : 'w-1/2')} />
                    </td>
                  ))}
                </tr>
              ))
            ) : filas.length === 0 ? (
              <tr role="row">
                <td role="cell" colSpan={columnasTotales} className="border-b border-line">
                  {vacio ?? <p className="px-5 py-10 text-center text-sm text-ink-muted">No hay datos que mostrar.</p>}
                </td>
              </tr>
            ) : (
              filas.map((fila) => {
                const seleccionada = filaSeleccionada?.(fila) ?? false;
                const marcada = seleccion?.marcada(fila) ?? false;
                const bloqueada = seleccion?.deshabilitada?.(fila) ?? false;
                return (
                  <tr
                    key={claveFila(fila)}
                    role="row"
                    tabIndex={alActivarFila ? 0 : undefined}
                    onClick={alActivarFila || alternarAlClic ? (e) => alClic(e, fila) : undefined}
                    onKeyDown={alActivarFila ? (e) => alTecla(e, fila) : undefined}
                    aria-current={seleccionada ? 'true' : undefined}
                    className={cn(
                      'group transition-colors duration-150',
                      alActivarFila && 'ap-fila--clicable hover:bg-paper',
                      alternarAlClic && !bloqueada && 'cursor-pointer hover:bg-paper',
                      (seleccionada || marcada) && 'bg-teal-tint/50 hover:bg-teal-tint/60',
                      bloqueada && 'bg-mist/40',
                      claseFila?.(fila)
                    )}
                  >
                    {seleccion && (
                      <td
                        role="cell"
                        data-tarjeta="seleccion"
                        className={cn('w-px border-b border-line pl-5 pr-1 align-middle', pad)}
                      >
                        <input
                          type="checkbox"
                          checked={marcada}
                          disabled={bloqueada}
                          onChange={() => {
                            if (!bloqueada) seleccion.alAlternar(fila);
                          }}
                          aria-label={seleccion.etiquetaFila(fila)}
                          className="block h-[18px] w-[18px] cursor-pointer rounded border-line-strong accent-teal disabled:cursor-not-allowed"
                        />
                      </td>
                    )}
                    {columnas.map((col) => {
                      const contenido = col.celda(fila);
                      // Una celda sin nada (null, false, '') queda vacía de verdad
                      // (:empty): en tarjetas no pinta su etiqueta suelta.
                      const vacia = contenido === null || contenido === undefined || contenido === false || contenido === '';
                      return (
                        <td
                          key={col.id}
                          role="cell"
                          data-etiqueta={col.encabezado}
                          data-ocultar={col.ocultarBajo}
                          data-tarjeta={col.enTarjeta && col.enTarjeta !== 'normal' ? col.enTarjeta : undefined}
                          title={col.tituloCelda?.(fila) || undefined}
                          className={cn(
                            'border-b border-line px-3 align-middle text-ink first:pl-5 last:pr-5',
                            pad,
                            alineacion(col),
                            col.numerica && 'tabular-nums',
                            (col.unaLinea || col.truncarEn) && 'whitespace-nowrap',
                            col.className
                          )}
                        >
                          {!vacia && (
                            <div
                              className={cn('ap-celda', col.truncarEn && 'ap-celda--truncar')}
                              style={col.truncarEn ? ({ '--ap-truncar': col.truncarEn } as CSSProperties) : undefined}
                            >
                              {contenido}
                            </div>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
        </EnTablaContext.Provider>
      </div>
      {desborda && !alFinal && <div className="ap-tabla-sombra" aria-hidden="true" />}
      </div>
      {paginacion && alCambiarPagina && (
        <Pagination pagination={paginacion} alCambiar={alCambiarPagina} etiqueta={etiquetaTotal} />
      )}
    </div>
  );
}
