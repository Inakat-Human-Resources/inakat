# Revamp de la portada — septiembre 2026

Rama `feat/home-revamp`. Rediseño completo de `/` dentro del stack que ya existe
(Next.js 15 + React 19 + Tailwind), sin añadir una sola dependencia de animación.

## El concepto: «Arco»

El isotipo de INAKAT son **un punto y un arco**: una persona y el puente que la
conecta con algo. Todo el movimiento de la portada sale de esas dos formas, y de
ahí salen también las decisiones que no son decorativas:

| Gesto | Dónde | Qué dice |
|---|---|---|
| Tres arcos concéntricos detrás del título | portada | el puente, a escala de página |
| La foto **entre** la línea 2 y la línea 3 del título | portada | hay espacio detrás de la pantalla |
| El punto naranja **recorre el arco**, una etapa por tramo | proceso de selección | las 11 etapas son un trayecto, no una lista |
| Dos hojas de color que se apilan | empresas / candidatos | dos públicos, dos mundos |
| Arco invertido descendiendo | testimonios | el puente ya cruzado |
| Dos arcos creciendo desde el pie | cierre | la invitación |

**Tipografía dual para una empresa que vende evaluación dual:** Outfit (la sans
geométrica emparentada con el logotipo) para la estructura, e **Instrument Serif
en itálica** para la voz humana — el remate de cada título, los testimonios, los
subtítulos de las cifras. Es la misma idea del negocio dicha con tipos: máquina y
persona, en la misma frase.

## Qué cambió de verdad

Antes eran doce secciones construidas casi todas con el mismo patrón —título
centrado + rejilla de tarjetas blancas con sombra— alternando dos colores de
fondo, y **ningún título de sección pasaba de 48 px** (todos eran
`text-3xl md:text-4xl lg:text-5xl`) mientras la portada tenía 129 px disponibles.
Un scroll de 13 pantallas con dos composiciones se lee como papel pintado.

Ahora:

- **Escala:** el título de portada llega a `clamp(1.95rem, min(9.4vw - 6px, 17svh), 10rem)`
  — 129 px a 1440, y se sale del encuadre como debe. Los títulos de sección, a
  `clamp(2.3rem, 6.6vw - 4px, 6.75rem)`.
- **Ritmo de suelos:** arena → tinta → papel → verde azulado → naranja → lima →
  arena → tinta → papel → verde azulado → arena → papel → tinta. Ninguna racha
  supera dos pantallas.
- **Siete patrones distintos** de composición: portada emparedada, marquesina,
  manifiesto a dos columnas con cabecera fija, escena fijada, hojas apiladas,
  lista editorial numerada y rejilla de cifras.
- **Ocho mecanismos de movimiento ligados al scroll**, todos con `animation-timeline`
  nativo: planos de la portada a velocidades distintas, palabras que se encienden
  de izquierda a derecha, el punto recorriendo el arco, hojas que se hunden,
  números en contorno que se rellenan, la palabra fantasma en paralaje, el arco de
  testimonios y la ventana fija del cierre.

## Reglas que respeta (y cómo se comprobó)

Medido con Chrome real en cinco anchos (1440, 1024, 820 vertical, 390, 360) más
movimiento reducido y sin JavaScript:

| Comprobación | Resultado |
|---|---|
| Desbordes horizontales en los 5 anchos | **ninguno** |
| Elementos sin revelar | **ninguno** |
| Encabezados en el árbol de accesibilidad | **los 32**, incluidas las 11 etapas de la escena fijada |
| `prefers-reduced-motion: reduce` | **0 animaciones corriendo, 0 elementos invisibles** |
| Sin JavaScript | **91 elementos clave visibles, 0 ocultos**; `h1` presente |
| Errores de consola | sólo el `401` de `/api/auth/me` del navbar, preexistente |
| `tsc --noEmit` · `eslint` | **0 errores** |
| Contraste de los pares de color usados | tinta/arena **9.91:1** · blanco/tinta **12.38:1** · blanco/teal **7.38:1** · tinta/lima **5.67:1** · tinta/naranja **4.87:1** · lima/teal **3.38:1** (sólo en titulares) |
| Tests | 19 nuevos (`__tests__/qa/home-revamp-sep2026.test.ts`) + los 90 de QA del cliente, **todos verdes** |

Cómo repetirlo:

```bash
npx next dev -p 4733
node C:/Users/guill/.claude/skills/sitio-capas/scripts/qa.mjs http://localhost:4733
npx jest __tests__/qa
```

## Decisiones de contenido

1. **La foto del hero ya no se presenta como el equipo de INAKAT.** `hero-inakat.jpg`
   es una imagen generada por IA, con rótulos quemados y faltas de ortografía
   («Éducación», «Gènero», «Ingenieria»), y su `alt` decía *«Equipo INAKAT -
   Profesionales de reclutamiento»*. Ahora el `alt` dice «Ilustración» y el recorte
   del arco deja fuera la franja de texto. **Pendiente del cliente:** sustituirla por
   una fotografía real.
2. **Ninguna cifra nueva.** Las cuatro de la portada (100 %, 150+, 15+, 11) son las
   que ya estaban; ninguna es verificable desde el código. **Pendiente del cliente:**
   confirmarlas o quitarlas.
3. **Contradicción de cobertura, sin resolver.** La FAQ dice presencia en «Monterrey,
   Morelia, Ciudad de México, Puebla y Guadalajara»; el mapa lista «CDMX, Monterrey,
   Guadalajara, Puebla, Querétaro, León, Mérida»; y las cifras dicen «15+ estados».
   Se respetaron ambas listas tal cual. **Pendiente del cliente:** una sola lista real.
4. **Las 11 etapas siguen teniendo una única fuente.** `SelectionProcessSection` ganó
   una prop `variant`: `'grid'` (la de siempre, que usa `/about`) y `'arc'` (la escena
   fijada de la home). Los datos no se duplicaron.
5. **Las cifras se pintan desde el servidor.** Se quitó el contador `useCountUp`: se
   leen igual sin JavaScript y con movimiento reducido.

## Notas técnicas para quien siga tocando esto

- 🚨 **`globals.css` declara `section { overflow: hidden }`**, y eso convierte a cada
  `<section>` en contenedor de scroll, lo que **mata todo `position: sticky` que viva
  dentro**. Por eso `home.css` devuelve `overflow: visible` a las secciones que fijan
  algo, y las que recortan usan `overflow: clip` (recorta igual, pero no crea
  contenedor de scroll). Si añades una sección con `sticky`, acuérdate.
- 🚨 **Las animaciones de entrada cuelgan de `.hm--js`**, y esa clase la pone
  `HomeMotion` **sólo cuando `document.visibilityState === 'visible'`**; si no, espera
  a `visibilitychange`. Las dos mitades del candado se pagaron por separado:
  - *sin el candado*, sin JavaScript no había nada que completara la animación;
  - *sin la condición de visibilidad*, *con* JavaScript tampoco: **en una pestaña de
    fondo el reloj de animación no avanza**, y `animation-fill-mode: both` deja el
    elemento clavado en su fotograma inicial — que aquí es «fuera de la máscara» o
    `opacity: 0`. Se vio en el primer preview de Vercel: la portada salía con los
    arcos y nada más. Pasa con ctrl+click, al restaurar la sesión de pestañas y en
    cualquier captura automática.

  Se comprueba falseando `visibilityState` antes de cargar (`page.evaluateOnNewDocument`):
  con la pestaña oculta el título, la foto y el CTA deben salir con opacidad 1 y sin
  desplazar, y la clase no debe estar.
- El `h1` **no lleva `transform` ni `opacity`**: si creara contexto de apilamiento,
  la foto dejaría de poder quedar *entre* las líneas del título. Las animaciones van
  en cada línea, que son máscaras.
- La foto se posiciona en **cuerpos del título** (`--tf`), no en `vw`: así sigue al
  título cuando cambia el ancho en vez de irse por su cuenta.
- El alto real de la barra de navegación **no es 56 px en todas partes**: mide 44 en
  escritorio, 64 en tablet y 60 en móvil, aunque el `body` siempre reserve `pt-14`.
  `--nav` se ajusta por ancho.
- Todo lo de la home lleva prefijo `hm-` y vive en `src/app/home.css`, que sólo carga
  `/`. No toca ninguna otra página.

## Lo que la portada dejó ver del resto de la app

Tres cosas que se vieron al trabajar aquí, están en la auditoría y **no se arreglaron
en esta rama** porque son globales:

- El **navbar se rompe en dos líneas a 820 px** y el botón «Iniciar Sesión» se sale
  del borde.
- `/api/auth/me` devuelve **401 en cada carga anónima** y ensucia la consola de todos
  los visitantes.
- **Blanco sobre el naranja de marca `#f48602` da 2.54:1** de contraste, que no pasa
  AA ni siquiera para texto grande (exige 3:1). Afecta a todos los botones naranjas de
  la app. En la home se resolvió poniendo texto tinta `#283739` sobre el naranja
  (**4.87:1**, pasa AA para texto normal), pero el resto de la app sigue igual.
