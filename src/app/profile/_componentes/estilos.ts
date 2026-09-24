// RUTA: src/app/profile/_componentes/estilos.ts
//
// Clases compartidas por los paneles de /profile.

/**
 * Foco visible en una <label> que envuelve un input de archivo. El input va
 * con `sr-only` (no `hidden`, que lo sacaba del orden de tabulación): se
 * alcanza con el tabulador, se abre con Intro o Espacio y el anillo de foco lo
 * pinta la etiqueta.
 */
export const FOCO_ETIQUETA_ARCHIVO =
  'cursor-pointer focus-within:outline focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-teal';
