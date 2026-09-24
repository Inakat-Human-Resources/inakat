// RUTA: src/components/ui/Capa.tsx
'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

/**
 * Pinta a sus hijos al final de <body> (un portal). La usan Modal, Drawer,
 * MenuAcciones y el aviso (Toast). También sirve para subir a la capa superior
 * una capa PROPIA que no use Modal (hoy no queda ninguna en src/: la ficha de
 * candidato ya es un Modal y se lleva sola al final de <body>):
 *
 *   {pipelineAbierto && <Modal …>…</Modal>}
 *   {panelPropioAbierto && (
 *     <Capa>
 *       <MiCapaPropia … />
 *     </Capa>
 *   )}
 *
 * Por qué: un `position: fixed` dentro de un ancestro con `transform` (p. ej.
 * una tarjeta con la entrada .fade-in) queda atrapado en ese ancestro; y dos
 * capas con el mismo z-index se apilan por orden en el documento. Al final de
 * <body>, la última que se abre queda encima.
 */
export default function Capa({ children }: { children: ReactNode }) {
  const [montado, setMontado] = useState(false);
  useEffect(() => setMontado(true), []);
  if (!montado) return null;
  return createPortal(children, document.body);
}
