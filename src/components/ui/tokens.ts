// RUTA: src/components/ui/tokens.ts
//
// Paleta de la marca: fuente única para tailwind.config.ts (clases) y para los
// componentes que necesitan el valor en JS. Las mismas seis cifras viven como
// variables CSS en src/app/site.css (:root); un test comprueba que no se
// separen (__tests__/qa/sistema-diseno.test.ts).
//
// Contrastes MEDIDOS con la fórmula WCAG 2.x (no supuestos). AA exige 4.5:1
// para texto normal, 3:1 para texto grande (≥ 24 px, o ≥ 18.66 px en negrita)
// y 3:1 para bordes que identifican un control.
//
//   tinta sobre arena ........ 9.91   blanco sobre tinta ...... 12.38
//   tinta sobre papel ........ 11.35  blanco sobre verde azulado 7.38
//   tinta sobre lima ......... 5.67   tinta sobre naranja ...... 4.87
//   lima sobre verde azulado . 3.38  (SÓLO titulares grandes)
//   BLANCO SOBRE NARANJA ..... 2.54  ✗ NO PASA: el naranja lleva texto tinta.
//   blanco sobre lima ........ 2.18  ✗ NO PASA: la lima lleva texto tinta.
//
// Derivados para la aplicación (medidos):
//   ink.muted  #5b6769  5.85 sobre blanco · 5.36 sobre papel · 4.68 sobre arena
//   line.strong #7c8482 3.83 sobre blanco · 3.51 sobre papel (borde de campo)
//   line        #e4e2d6 1.30 sobre blanco — SÓLO decorativo (separadores)
//   orange.hover #ff9f2e tinta encima 6.04
//   danger      #b42318 blanco encima 6.57
//   ink.soft    #344547 blanco encima 10.06 (hover en la barra lateral)
//   sidebar.text #b9c3c3 6.87 sobre tinta · 5.58 sobre ink.soft
//   sidebar.label #a9b4b5 5.83 sobre tinta (encabezados de grupo)
//   Tonos de estado (texto sobre fondo): éxito 7.84 · aviso 6.14 · info 8.18 ·
//   peligro 6.30 · neutro 6.44 · destacado (tinta sobre lima) 5.67

export const marca = {
  ink: '#283739',
  teal: '#2b5d62',
  lime: '#9fbb2f',
  orange: '#f48602',
  sand: '#e8e7d4',
  paper: '#f7f5ee',
} as const;

/** Colores con nombre semántico que se exponen como clases de Tailwind. */
export const colores = {
  ink: {
    DEFAULT: marca.ink,
    soft: '#344547',
    muted: '#5b6769',
  },
  teal: {
    DEFAULT: marca.teal,
    dark: '#1f4a4e',
    tint: '#e2eded',
  },
  lime: {
    DEFAULT: marca.lime,
    dark: '#3d5010',
    tint: '#eef3d9',
  },
  orange: {
    DEFAULT: marca.orange,
    hover: '#ff9f2e',
    dark: '#8a4600',
    tint: '#fdecd6',
  },
  sand: marca.sand,
  paper: marca.paper,
  line: {
    DEFAULT: '#e4e2d6',
    strong: '#7c8482',
  },
  mist: '#ecebe3',
  danger: {
    DEFAULT: '#b42318',
    dark: '#9b2a1c',
    tint: '#fbe4e0',
  },
  sidebar: {
    text: '#b9c3c3',
    label: '#a9b4b5',
  },
} as const;
