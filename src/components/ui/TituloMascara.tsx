// RUTA: src/components/ui/TituloMascara.tsx

import type { CSSProperties, ElementType, ReactNode } from 'react';
import { cn } from '@/lib/utils';

export interface RenglonTitulo {
  /** Texto del renglón (lo que se lee en el aria-label). */
  texto: string;
  /** Cómo se pinta (p. ej. con <em> para la serif). Por defecto, el texto. */
  contenido?: ReactNode;
  className?: string;
}

/**
 * Titular del registro PÚBLICO partido en máscaras: cada renglón sube desde
 * debajo de su máscara al cargar (la animación cuelga de .hm--js; sin JS o con
 * movimiento reducido el titular está quieto y completo).
 *
 * Accesibilidad (trampa ya cobrada en la portada): el nombre accesible va en el
 * encabezado con aria-label y los trozos van aria-hidden, o el lector leería
 * «Contrata talento / que realmente / …» como fragmentos sueltos.
 *
 *   <TituloMascara
 *     como="h1"
 *     className="hm-display"
 *     renglones={[
 *       { texto: 'Conectamos talento' },
 *       { texto: 'con especialistas.', contenido: <em>con especialistas.</em> },
 *     ]}
 *   />
 *
 * Si `como` NO es un encabezado (un <p>, un <span>), aria-label no sirve: el
 * rol «paragraph» no admite nombre y los trozos van aria-hidden, así que el
 * lector no leería nada. Entonces el texto completo va en un sr-only.
 *
 * Necesita <SiteMotion /> montado en la página para que la entrada arranque.
 */
export default function TituloMascara({
  renglones,
  como: Como = 'h2',
  className,
  id,
  retraso = 0,
}: {
  renglones: RenglonTitulo[];
  como?: ElementType;
  className?: string;
  id?: string;
  /** Índice de la primera máscara (para escalonar la entrada tras otro titular). */
  retraso?: number;
}) {
  const texto = renglones.map((r) => r.texto).join(' ');
  const esEncabezado = typeof Como === 'string' && /^h[1-6]$/.test(Como);
  return (
    <Como id={id} className={className} aria-label={esEncabezado ? texto : undefined}>
      {!esEncabezado && <span className="sr-only">{texto}</span>}
      {renglones.map((r, i) => (
        <span key={i} className={cn('hm-line', r.className)} aria-hidden="true">
          <span style={{ '--i': i + retraso } as CSSProperties}>{r.contenido ?? r.texto}</span>
        </span>
      ))}
    </Como>
  );
}
