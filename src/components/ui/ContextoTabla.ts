// RUTA: src/components/ui/ContextoTabla.ts
'use client';

import { createContext, useContext } from 'react';

/**
 * ¿Estoy dentro de una celda de DataTable? Lo pone DataTable alrededor de su
 * <table> y lo leen Button, ButtonLink, IconButton e IconLink para que, si la
 * página no pide un tamaño, dentro de una tabla salgan en `sm` (32 px): con
 * controles de 40 px las filas no bajaban de 56 px y la tabla dejaba de ser
 * densa. Un `tamano` explícito siempre gana.
 *
 * Modal y Drawer lo devuelven a `false`: un diálogo abierto desde una celda
 * (React pasa el contexto a través del portal) tiene sus botones normales.
 */
export const EnTablaContext = createContext(false);

export function useEnTabla(): boolean {
  return useContext(EnTablaContext);
}
