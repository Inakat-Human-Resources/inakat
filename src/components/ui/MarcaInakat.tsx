// RUTA: src/components/ui/MarcaInakat.tsx
//
// La marca de INAKAT, la MISMA en los dos registros.
//
// El sitio público (PublicNav, aprobado con la portada) usa logo.png: la
// figura lima (la persona con los brazos arriba, el arco y el punto) y la
// palabra en tinta. El panel usaba otro símbolo (el arco y el punto naranjas
// de ico.png, que vive en Isotipo.tsx): dos marcas distintas según dónde
// estuvieras. Ahora el panel lleva la figura de logo.png en su versión en
// negativo: figura lima y palabra arena sobre la tinta de la barra lateral.
// También es la figura del icono de la app (public/logo192.png, logo512.png).
//
// La figura no se redibuja: se recorta de logo.png con una máscara (las
// columnas 0–138 de 938 son la figura; la palabra empieza después de un
// hueco), así es exactamente la del sitio público y toma el color que le des.
// Decorativa: el nombre accesible lo lleva el enlace que la envuelve.

import Image from 'next/image';
import type { CSSProperties } from 'react';
import logo from '@/assets/images/logo/logo.png';
import { cn } from '@/lib/utils';

/** La figura dentro de logo.png (938 × 205 px): de la columna 0 a la 138. */
const FIGURA_ANCHO = 139;
const FIGURA_ALTO = 205;

interface SimboloProps {
  /** Alto (y lo que haga falta): el ancho sale de la proporción. Por defecto h-7. */
  className?: string;
  /** Clase de color de fondo: la figura se pinta con él. Por defecto, lima. */
  color?: string;
}

/** La figura de la marca (lima por defecto). Sólo el símbolo, sin la palabra. */
export function SimboloInakat({ className, color = 'bg-lime' }: SimboloProps) {
  return (
    <span
      aria-hidden="true"
      className={cn('ap-simbolo inline-block h-7 flex-none', color, className)}
      style={
        {
          '--ap-simbolo': `url("${logo.src}")`,
          aspectRatio: `${FIGURA_ANCHO} / ${FIGURA_ALTO}`,
        } as CSSProperties
      }
    />
  );
}

/**
 * Marca completa en NEGATIVO (sobre tinta): figura lima + «INAKAT» arena, con
 * las proporciones de logo.png (la palabra mide ~3/4 del alto de la figura).
 */
export default function MarcaInakat({ className }: { className?: string }) {
  return (
    <span className={cn('inline-flex items-center gap-2', className)} aria-hidden="true">
      <SimboloInakat className="h-[26px]" />
      <Image src="/marca/inakat-palabra-arena.png" alt="" width={649} height={134} className="h-[18px] w-auto" priority />
    </span>
  );
}
