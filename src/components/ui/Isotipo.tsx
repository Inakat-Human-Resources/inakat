// RUTA: src/components/ui/Isotipo.tsx
//
// El isotipo de INAKAT: un ARCO (el puente) y un PUNTO (la persona). Trazado
// en SVG a partir de src/assets/images/logo/ico.png (823×1265) para que se vea
// nítido a cualquier tamaño y tome el color que le pidas.
//
// Es el MOTIVO del sistema (estados vacíos, ilustraciones), no la marca: la
// marca, en el sitio y en el panel, es la figura de logo.png (MarcaInakat.tsx).

interface IsotipoProps {
  className?: string;
  /** Color del arco y del punto. Por defecto, el naranja de la marca. */
  color?: string;
  /** Color del punto si debe distinguirse del arco. */
  colorPunto?: string;
  /** Nombre accesible; sin él, el isotipo es decorativo. */
  titulo?: string;
}

export default function Isotipo({
  className,
  color = '#f48602',
  colorPunto,
  titulo,
}: IsotipoProps) {
  return (
    <svg
      viewBox="0 0 823 1265"
      className={className}
      role={titulo ? 'img' : undefined}
      aria-label={titulo}
      aria-hidden={titulo ? undefined : true}
      focusable="false"
    >
      {/* Medio anillo: exterior r=632, interior r=376, abierto a la derecha */}
      <path
        d="M646 0 V256 A376 376 0 0 0 646 1008 V1265 A632.5 632.5 0 0 1 646 0 Z"
        fill={color}
      />
      <circle cx="646" cy="632.5" r="176" fill={colorPunto ?? color} />
    </svg>
  );
}
