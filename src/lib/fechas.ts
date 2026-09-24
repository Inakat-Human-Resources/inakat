// RUTA: src/lib/fechas.ts
//
// Las fechas del sitio con UNA sola voz. Antes cada página formateaba a su
// manera y en el mismo panel convivían «25 de febrero de 2026», «23 sep 2026»,
// «23-sep» y «23/9/2026».
//
//   fechaCorta(v)   → «23 sep 2026»            tablas, listas, tarjetas
//   fechaHora(v)    → «23 sep 2026, 18:22»     cuándo pasó algo (con hora)
//   fechaLarga(v)   → «23 de septiembre de 2026»  sólo en un detalle o en un title
//   hora(v)         → «18:22»
//   fechaIso(v)     → «2026-09-23T18:22:00.000Z»  para <time dateTime={…}>
//
// - Aceptan un ISO, un número o un Date. Si falta o no es una fecha válida
//   devuelven «—» (o lo que pidas en `vacio`): new Date(null) es 1970 y
//   new Date('x') es Invalid Date, y ninguno de los dos debe llegar a pantalla.
// - `utc: true` para las fechas SIN hora (nacimiento, periodos de experiencia,
//   vigencias) que se guardan a medianoche UTC: sin él, en México (UTC-6) se
//   leen un día antes (01/01/2020 salía «31 dic 2019»).
// - Los nombres de los meses van escritos aquí y no salen de Intl: así el
//   servidor (Node) y el navegador pintan lo mismo (el ICU de uno dice «sept»
//   y el del otro «sep», y eso rompe la hidratación).

export type ValorFecha = string | number | Date | null | undefined;

export interface OpcionesFecha {
  /** Leer la fecha en UTC (fechas sin hora guardadas a medianoche UTC). */
  utc?: boolean;
  /** Qué devolver si no hay fecha válida. Por defecto, «—». */
  vacio?: string;
}

const MESES_CORTOS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
const MESES_LARGOS = [
  'enero',
  'febrero',
  'marzo',
  'abril',
  'mayo',
  'junio',
  'julio',
  'agosto',
  'septiembre',
  'octubre',
  'noviembre',
  'diciembre',
];

const VACIO = '—';

/** El valor como Date, o null si falta o no es una fecha válida. */
export function aFecha(valor: ValorFecha): Date | null {
  if (valor === null || valor === undefined || valor === '') return null;
  const fecha = valor instanceof Date ? valor : new Date(valor);
  return Number.isNaN(fecha.getTime()) ? null : fecha;
}

/** ¿Es una fecha que se pueda pintar? */
export function esFechaValida(valor: ValorFecha): boolean {
  return aFecha(valor) !== null;
}

function partes(fecha: Date, utc: boolean) {
  return utc
    ? { dia: fecha.getUTCDate(), mes: fecha.getUTCMonth(), anio: fecha.getUTCFullYear(), h: fecha.getUTCHours(), m: fecha.getUTCMinutes() }
    : { dia: fecha.getDate(), mes: fecha.getMonth(), anio: fecha.getFullYear(), h: fecha.getHours(), m: fecha.getMinutes() };
}

const dosCifras = (n: number) => String(n).padStart(2, '0');

/** «23 sep 2026». Para tablas, listas y tarjetas. */
export function fechaCorta(valor: ValorFecha, { utc = false, vacio = VACIO }: OpcionesFecha = {}): string {
  const fecha = aFecha(valor);
  if (!fecha) return vacio;
  const { dia, mes, anio } = partes(fecha, utc);
  return `${dia} ${MESES_CORTOS[mes]} ${anio}`;
}

/** «23 sep 2026, 18:22» (24 h). Cuándo pasó algo, con hora. */
export function fechaHora(valor: ValorFecha, { utc = false, vacio = VACIO }: OpcionesFecha = {}): string {
  const fecha = aFecha(valor);
  if (!fecha) return vacio;
  const { dia, mes, anio, h, m } = partes(fecha, utc);
  return `${dia} ${MESES_CORTOS[mes]} ${anio}, ${dosCifras(h)}:${dosCifras(m)}`;
}

/** «23 de septiembre de 2026». Sólo en un detalle o en un atributo title. */
export function fechaLarga(valor: ValorFecha, { utc = false, vacio = VACIO }: OpcionesFecha = {}): string {
  const fecha = aFecha(valor);
  if (!fecha) return vacio;
  const { dia, mes, anio } = partes(fecha, utc);
  return `${dia} de ${MESES_LARGOS[mes]} de ${anio}`;
}

/** «18:22» (24 h). */
export function hora(valor: ValorFecha, { utc = false, vacio = VACIO }: OpcionesFecha = {}): string {
  const fecha = aFecha(valor);
  if (!fecha) return vacio;
  const { h, m } = partes(fecha, utc);
  return `${dosCifras(h)}:${dosCifras(m)}`;
}

/** ISO para el atributo dateTime de <time>; undefined si no hay fecha válida. */
export function fechaIso(valor: ValorFecha): string | undefined {
  return aFecha(valor)?.toISOString();
}
