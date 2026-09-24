// RUTA: src/components/sections/jobs/SeccionVacante.tsx
//
// Un bloque del formulario de vacante («Puesto», «Perfil y sueldo»…). El mismo
// contenido se ve de dos maneras:
// - al PUBLICAR es un paso: todos los pasos están montados y los que no tocan
//   se ocultan con `hidden` (así el mapa y lo escrito no se pierden al ir y
//   volver, docs/DISENO.md §6). Su h2 recibe el foco al cambiar de paso para
//   que el lector anuncie dónde está.
// - al EDITAR es una tarjeta más: todas a la vista, para cambiar cualquier dato
//   sin recorrer los pasos.
//
// No es un <section>: globals.css les pone overflow: hidden y recortaría el
// anillo de foco de los campos que llegan al borde.

import type { ReactNode } from 'react';
import Card from '@/components/ui/Card';

export interface SeccionVacanteProps {
  /** Identificador del paso (`puesto`, `perfil`…): el h2 lleva id `paso-titulo-<id>`. */
  id: string;
  titulo: string;
  descripcion?: string;
  /** Edición: cada bloque en su tarjeta, todos visibles. */
  enTarjeta: boolean;
  /** Publicación: el paso no es el actual. */
  oculta?: boolean;
  children: ReactNode;
}

export default function SeccionVacante({ id, titulo, descripcion, enTarjeta, oculta = false, children }: SeccionVacanteProps) {
  const idTitulo = `paso-titulo-${id}`;

  if (enTarjeta) {
    return (
      <Card
        id={`seccion-${id}`}
        titulo={
          <span id={idTitulo} tabIndex={-1} className="scroll-mt-24 outline-none">
            {titulo}
          </span>
        }
        descripcion={descripcion}
        claseCuerpo="space-y-5 sm:p-6"
      >
        {children}
      </Card>
    );
  }

  return (
    <div id={`seccion-${id}`} hidden={oculta} role="group" aria-labelledby={idTitulo}>
      <h2
        id={idTitulo}
        tabIndex={-1}
        className="scroll-mt-24 font-display text-lg font-semibold leading-snug text-ink outline-none sm:text-xl"
      >
        {titulo}
      </h2>
      {descripcion && <p className="mt-1 text-sm text-ink-muted">{descripcion}</p>}
      <div className="mt-6 space-y-5">{children}</div>
    </div>
  );
}
