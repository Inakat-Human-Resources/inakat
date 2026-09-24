// RUTA: src/app/login/_acceso/MarcoAcceso.tsx
//
// Piezas de PRESENTACIÓN compartidas por las páginas de acceso (/login,
// /register, /forgot-password, /reset-password, /unauthorized). Ninguna tiene
// estado ni llamadas: la lógica sigue en cada página. Estilos: ./acceso.css
// (prefijo ac-), importada por cada page.tsx.
//
// FraseMascara y AvisoAcceso ya son del sistema (TituloMascara como="p" y
// Aviso, en src/components/ui): aquí quedan como nombres de siempre.
import type { CSSProperties, ReactNode } from 'react';
import { cn } from '@/lib/utils';
import TituloMascara from '@/components/ui/TituloMascara';
import Aviso, { type TonoAviso } from '@/components/ui/Aviso';

/**
 * Clases de los botones públicos (píldora de la portada) para ENLACES (<Link>).
 * En un <Button>, usa variante="publico-naranja" / "publico-fantasma".
 */
export const BOTON_NARANJA = 'hm-btn hm-btn--orange';
export const BOTON_FANTASMA = 'hm-btn hm-btn--ghost';

export interface RenglonFrase {
  texto: string;
  /** El remate: <em> (serif itálica en lima sobre tinta). */
  em?: boolean;
}

/**
 * Frase partida en máscaras que NO es un encabezado (un <p>): TituloMascara
 * como="p" pone el texto entero en un sr-only y los renglones, aria-hidden.
 */
export function FraseMascara({
  renglones,
  className,
  retraso = 1,
}: {
  renglones: RenglonFrase[];
  className?: string;
  /** Índice de la primera máscara (para escalonar con el titular). */
  retraso?: number;
}) {
  return (
    <TituloMascara
      como="p"
      className={className}
      retraso={retraso}
      renglones={renglones.map((r) => ({ texto: r.texto, contenido: r.em ? <em>{r.texto}</em> : undefined }))}
    />
  );
}

/**
 * El panel en tinta: antetítulo, la frase grande en serif, una línea al pie y,
 * detrás, los tres arcos del puente con el punto. `children` sustituye al punto
 * por otra escena (el recorrido de /register).
 */
export function PanelAcceso({
  antetitulo,
  frase,
  pie,
  children,
  recorrido = false,
}: {
  antetitulo: string;
  frase: RenglonFrase[];
  pie?: ReactNode;
  children?: ReactNode;
  /** Con el recorrido de /register: los arcos giran con el scroll y el punto se oculta en escritorio. */
  recorrido?: boolean;
}) {
  return (
    <div className={cn('ac-panel', recorrido && 'ac-panel--recorrido')}>
      <div className="ac-panel__escena" aria-hidden="true">
        <div className="ac-panel__arcos">
          <span className="ac-arco ac-arco--a" style={{ '--i': 0 } as CSSProperties} />
          <span className="ac-arco ac-arco--b" style={{ '--i': 1 } as CSSProperties} />
          <span className="ac-arco ac-arco--c" style={{ '--i': 2 } as CSSProperties} />
        </div>
        <span className="ac-punto" />
        {children}
      </div>
      <p className="hm-eyebrow">{antetitulo}</p>
      <FraseMascara renglones={frase} className="ac-frase" />
      {pie && <p className="ac-panel__pie">{pie}</p>}
    </div>
  );
}

/**
 * La composición partida. En el DOM va primero el lado (titular y formulario)
 * y después el panel; el CSS pinta el panel a la izquierda (o arriba en móvil).
 */
export function MarcoAcceso({
  panel,
  children,
  ancho = false,
}: {
  panel: ReactNode;
  children: ReactNode;
  /** Formularios largos (el registro): el lado admite 50rem en vez de 34rem. */
  ancho?: boolean;
}) {
  return (
    <div className="ac-split">
      <div className="ac-lado">
        <div className={cn('ac-lado__inner', ancho && 'ac-lado__inner--ancho')}>{children}</div>
      </div>
      {panel}
    </div>
  );
}

/**
 * Aviso en línea (no flotante): el Aviso del sistema. El error se anuncia al
 * momento (role="alert"); el éxito, con cortesía (role="status"); la
 * información no se anuncia.
 */
export function AvisoAcceso({
  tono,
  titulo,
  children,
  alCerrar,
  className,
}: {
  tono: Exclude<TonoAviso, 'aviso'>;
  titulo?: ReactNode;
  children?: ReactNode;
  /** Con esto aparece la X para descartarlo. */
  alCerrar?: () => void;
  className?: string;
}) {
  return (
    <Aviso tono={tono} titulo={titulo} alCerrar={alCerrar} className={className}>
      {children}
    </Aviso>
  );
}

/**
 * Lo que se ve mientras la página lee la URL (useSearchParams obliga a un
 * límite de Suspense) y, sin JavaScript, en su lugar: huecos del formulario y
 * una línea que explica qué pasa. Sin formulario real: sin JS, un <form> sin
 * action mandaría la contraseña en la URL.
 */
export function FormularioCargando({ campos = 2, className }: { campos?: number; className?: string }) {
  return (
    <div className={cn('ac-tarjeta', className)} role="status" aria-live="polite">
      <span className="sr-only">Cargando el formulario…</span>
      <div aria-hidden="true" className="space-y-5">
        {Array.from({ length: campos }, (_, i) => (
          <div key={i} className="space-y-2">
            <span className="skeleton block h-3.5 w-28 rounded-md" />
            <span className="skeleton block h-12 w-full rounded-lg" />
          </div>
        ))}
        <span className="skeleton block h-[3.25rem] w-full rounded-full" />
      </div>
      <noscript>
        <p className="mt-5 text-sm text-ink-muted">
          Para continuar necesitas activar JavaScript en tu navegador.
        </p>
      </noscript>
    </div>
  );
}
