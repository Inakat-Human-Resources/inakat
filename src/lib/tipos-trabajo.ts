// RUTA: src/lib/tipos-trabajo.ts
//
// Tipos de trabajo de una vacante: el VALOR que se guarda y la ETIQUETA que se
// lee. Las vacantes publicadas desde /create-job guardan «Tiempo Completo»
// (con mayúscula), y los listados lo pintaban crudo; el resto del panel dice
// «Tiempo completo». Un solo mapa para el formulario, los filtros y los
// listados.
//
// El valor no se toca: es el que ya llevan las vacantes publicadas y el que
// filtran /talents y la API (jobType).

export const TIPOS_DE_TRABAJO: ReadonlyArray<{ valor: string; etiqueta: string }> = [
  { valor: 'Tiempo Completo', etiqueta: 'Tiempo completo' },
  { valor: 'Medio Tiempo', etiqueta: 'Medio tiempo' },
  { valor: 'Por Proyecto', etiqueta: 'Por proyecto' },
  { valor: 'Temporal', etiqueta: 'Temporal' },
  { valor: 'Prácticas', etiqueta: 'Prácticas' },
];

const POR_VALOR = new Map(TIPOS_DE_TRABAJO.map((t) => [t.valor.toLocaleLowerCase('es-MX'), t.etiqueta]));

/**
 * «Tiempo Completo» → «Tiempo completo». Sin distinguir mayúsculas (los datos
 * de prueba ya dicen «Tiempo completo»). Un valor desconocido sale tal cual;
 * sin valor, cadena vacía.
 */
export function etiquetaTipoTrabajo(valor: string | null | undefined): string {
  if (!valor) return '';
  return POR_VALOR.get(valor.trim().toLocaleLowerCase('es-MX')) ?? valor;
}
