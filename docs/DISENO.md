# Sistema de diseño de INAKAT — «Arco»

Guía para rehacer las 40 páginas con UNA sola voz. Léela entera antes de tocar
tu primera página: casi todo lo que te va a tentar a improvisar ya está resuelto
aquí, con su porqué.

- Galería viva de todos los componentes: **`/diseno`** (sólo en desarrollo).
- Tu página real con datos simulados: **`/diseno/vista/<ruta real>`** (ver §10).
- Página de referencia de aplicación: **`src/app/admin/page.tsx`** (cópiala).
- Página de referencia pública: **`src/app/page.tsx`** + `src/components/sections/home/*` (la portada, aprobada por el cliente: no se toca).

---

## 0. Reglas que no se discuten

1. **Comportamiento intacto.** Mismas llamadas a las mismas APIs con los mismos
   cuerpos y parámetros, mismos estados, mismas validaciones, mismos permisos y
   redirecciones. Cambias la presentación, no la lógica. Si ves un bug de lógica,
   **no lo arregles en silencio**: anótalo en tu informe.
2. **Nada de colores ni tipos sueltos.** Sólo los tokens de §2. Nada de
   `bg-blue-600`, `text-gray-500`, `bg-white text-white sobre naranja`…
3. **Naranja lleva texto tinta. Siempre.** Blanco sobre `#f48602` da 2.54:1 y no
   pasa AA ni para texto grande.
4. **Estados con color Y texto**, nunca sólo color (`<StatusBadge>` ya lo hace).
5. **Teclado en todo**: lo que se pulsa con ratón se activa con Intro/Espacio; el
   foco se ve; los modales atrapan el foco y cierran con Escape.
6. **Etiqueta visible asociada** en cada campo (`<FormField>`), nombre accesible
   en cada botón de icono (`<IconButton etiqueta="…">`).
7. **Textos de negocio intocables** (FAQ, cifras, testimonios, legales, precios).
   Sí puedes mejorar microtextos de interfaz: botones, estados vacíos, ayudas.
8. **Los tests que asertan apariencia se actualizan conservando su intención**
   (que el enlace X siga, que haya 9 preguntas…). Nunca borres un test para que pase.
9. **Sin git, sin `.env`, sin base de datos.** Nadie ejecuta git en la tanda.

---

## 1. El concepto

El isotipo de INAKAT es **un punto y un arco**: una persona y el puente que la
conecta. Todo el sitio lo extiende; no se inventa un segundo concepto.

| Dónde aparece | Cómo |
|---|---|
| Antetítulos (`hm-eyebrow`, `PageHeader antetitulo`) | el punto naranja delante |
| Barra lateral de la app | ítem activo con una barra lima; la marca (figura de `logo.png`) arriba |
| Estado vacío (`EmptyState`) | un arco con el punto dentro |
| Pasos de un formulario (`Stepper`) | los pasos son puntos unidos por el puente |
| Pie público | dos arcos creciendo desde el borde y la palabra INAKAT cortada |
| Portada | arcos concéntricos, el punto que recorre el arco de las 11 etapas |

**Tipografía dual** (el negocio es evaluación dual): **Outfit** para la
estructura (títulos, cifras, botones), **DM Sans** para leer, e **Instrument
Serif itálica** para la voz humana: el remate de un titular, un estado vacío, una cita.

---

## 2. Tokens

Fuente única: `src/components/ui/tokens.ts` → Tailwind (`tailwind.config.ts`) y
variables CSS en `:root` (`src/app/site.css`). Un test (`__tests__/qa/sistema-diseno.test.ts`)
impide que se separen.

### 2.1 Color

| Token | Hex | Clase Tailwind | Variable CSS | Para qué |
|---|---|---|---|---|
| tinta | `#283739` | `ink` | `--ink` | texto, barra lateral, botón secundario |
| verde azulado | `#2b5d62` | `teal` | `--teal` | enlaces, foco, info, remates serif |
| lima | `#9fbb2f` | `lime` | `--lime` | éxito, ítem activo, avatar |
| naranja | `#f48602` | `orange` | `--orange` | acción principal (con texto tinta) |
| arena | `#e8e7d4` | `sand` | `--sand` | suelo público |
| papel | `#f7f5ee` | `paper` | `--paper` | suelo de la aplicación |

Derivados (todos medidos):

| Clase | Hex | Uso |
|---|---|---|
| `ink-muted` | `#5b6769` | texto secundario, cabeceras de tabla, placeholders |
| `ink-soft` | `#344547` | hover en la barra lateral |
| `line` | `#e4e2d6` | separadores y bordes de tarjeta (decorativo, 1.30:1) |
| `line-strong` | `#7c8482` | borde de campos y botones contorno (3.83:1, WCAG 1.4.11) |
| `mist` | `#ecebe3` | fondo neutro (badge neutro, campo deshabilitado) |
| `teal-tint` / `teal-dark` | `#e2eded` / `#1f4a4e` | fondos y texto «info» |
| `lime-tint` / `lime-dark` | `#eef3d9` / `#3d5010` | fondos y texto «éxito» |
| `orange-tint` / `orange-dark` / `orange-hover` | `#fdecd6` / `#8a4600` / `#ff9f2e` | «aviso», hover del primario |
| `danger` / `danger-dark` / `danger-tint` | `#b42318` / `#9b2a1c` / `#fbe4e0` | error, borrar |
| `sidebar-text` / `sidebar-label` | `#b9c3c3` / `#a9b4b5` | texto de la barra lateral |

### 2.2 Pares aprobados (fórmula WCAG 2.x, medidos)

| Texto / fondo | Ratio | Uso |
|---|---|---|
| tinta / papel | 11.35 | todo el texto de la app |
| tinta / arena | 9.91 | todo el texto público |
| blanco / tinta | 12.38 | barra lateral, suelos tinta |
| blanco / verde azulado | 7.38 | suelos teal |
| tinta / lima | 5.67 | avatar, badge destacado, botón lima |
| tinta / naranja | 4.87 | **botón primario** (hover `orange-hover`: 6.04) |
| lima / verde azulado | 3.38 | **sólo titulares grandes** (≥ 24 px) |
| ink-muted / blanco · papel · arena | 5.85 · 5.36 · 4.68 | texto secundario |
| teal / blanco · papel · arena | 7.38 · 6.77 · 5.91 | enlaces |
| blanco / danger | 6.57 | botón peligro |
| danger / blanco | 6.57 | mensajes de error |
| lime-dark / lime-tint | 7.84 | badge éxito |
| orange-dark / orange-tint | 6.14 | badge aviso |
| teal-dark / teal-tint | 8.18 | badge info |
| danger-dark / danger-tint | 6.30 | badge peligro |
| sidebar-text / tinta | 6.87 | ítems de la barra lateral |

**Prohibidos**: blanco / naranja **2.54** · blanco / lima **2.18** · `line` como borde
de un control (1.30).

**Cualquier par nuevo se mide antes de usarlo** (luminancia relativa WCAG; AA:
4.5 texto normal, 3 texto grande y bordes de control). Script de una línea:

```js
const L=h=>{const c=h.match(/../g).map(x=>parseInt(x,16)/255).map(v=>v<=.03928?v/12.92:((v+.055)/1.055)**2.4);return .2126*c[0]+.7152*c[1]+.0722*c[2]};
const r=(a,b)=>{const[x,y]=[L(a),L(b)].sort((m,n)=>n-m);return((x+.05)/(y+.05)).toFixed(2)};
console.log(r('283739','f48602')); // 4.87
```

### 2.3 Nombres heredados → nombres nuevos

Los nombres viejos **siguen vivos** en `tailwind.config.ts` hasta que cada
página se rehaga; al rehacer la tuya, cámbialos:

| Viejo | Nuevo |
|---|---|
| `button-orange` | `orange` (y el texto encima, `text-ink`) |
| `title-dark`, `button-title`, `text-black`, `black` | `ink` |
| `custom-beige` | `sand` |
| `soft-beige`, `background-beige`, `bg-gray-50` | `paper` |
| `number-green`, `soft-green`, `button-dark-green` | `teal` |
| `button-green`, `lemon-green`, `primary-light-green` | `lime` |
| `text-gray-500/600` | `text-ink-muted` |
| `border-gray-200/300` | `border-line` (separador) · `border-line-strong` (campo) |
| `bg-blue-*`, `text-blue-*`, `primary-dark-blue` | `teal` / `teal-tint` |
| `bg-green-100 text-green-800` | `<StatusBadge>` o `bg-lime-tint text-lime-dark` |
| `bg-red-*` | `danger` / `danger-tint` |

### 2.4 Tipo, radios, sombras

| Qué | Clase |
|---|---|
| Estructura | `font-display` (Outfit) |
| Texto | `font-body` (DM Sans, ya en `<body>`) |
| Voz humana | `font-serif italic` (Instrument Serif, `--font-serif`, cargada en el layout raíz) |
| h1 de página de app | lo pinta `PageHeader`: 28 → 32 → 34 px |
| h2 de tarjeta | `font-display text-base font-semibold` (lo pinta `Card`) |
| Cifras | `font-display tabular-nums` |
| Radios | `rounded-lg` (controles) · `rounded-xl` (tarjetas) · `rounded-2xl` (modales) · `rounded-full` (badges) |
| Sombras | `shadow-ap-1` (tarjeta) · `shadow-ap-2` (flotante) · `shadow-ap-3` (modal, cajón) |
| Ancho máximo del contenido | `max-w-app` (1400 px; ya lo pone el AppShell) |
| Ancho de lectura | `max-w-lectura` (52 rem): una bandeja o un mensaje que se lee (notificaciones). Se estrecha **lo de dentro**, nunca la página: el `PageHeader` va a todo el ancho, o el borde derecho salta al navegar (`/notifications` medía 1176 px frente a 1408) |
| Curva de marca | `ease-marca` / `var(--ease)` = `cubic-bezier(0.16, 1, 0.3, 1)` |

---

## 3. Dos registros, una familia

| | PÚBLICO (lo que se presenta) | APLICACIÓN (lo que se usa) |
|---|---|---|
| Rutas | `/`, `/about`, `/companies`, `/talents`, `/contact`, `/login`, `/register`, `/forgot-password`, `/reset-password`, `/privacy`, `/terms`, `/unauthorized`, 404 | todo lo que cuelga de `RUTAS_APP` en `src/lib/nav-app.ts` |
| Armazón | `PublicNav` (lo pone el layout raíz) + tu `<main className="hm">` + `<Footer />` | `AppShell` (lo pone el `layout.tsx` de la sección) |
| Hojas | `site.css` (prefijo `hm-`) | Tailwind + `app.css` (prefijo `ap-`) + `src/components/ui` |
| Escala | tipo que llena el encuadre | h1 28–34 px, texto 14 px |
| Suelos | alternan: arena · tinta · papel · teal · naranja · lima | papel; tinta sólo en la barra lateral |
| Movimiento | revelados y máscaras ligados al scroll (`animation-timeline`) | **nada ligado al scroll**; hover/foco/estado en 150–200 ms, esqueletos |
| Serif | remates de titulares, citas | remate del h1 (`remate`), estados vacíos |
| Referencias | la portada, skills `sitio-awwwards` y `sitio-capas` | Linear, Vercel, Stripe |

---

## 4. Componentes de aplicación (`src/components/ui`)

Todos son tipados, accesibles y usan la paleta. Importa cada uno de su archivo:
`import Button from '@/components/ui/Button'`. Los ves funcionando en `/diseno`.

### AppShell — no lo montes tú

Lo montan los `layout.tsx` de sección (`admin`, `company`, `recruiter`,
`specialist`, `vendor`, `profile`, `my-applications`, `candidate`,
`notifications`, `credits`, `create-job`, `applications`). Te da:

- barra lateral de 248 px en tinta con la marca, la navegación del rol
  (`src/lib/nav-app.ts`), ítem activo con barra lima, grupos con encabezado,
  «Ir al sitio público» y la tarjeta del usuario con «Cerrar sesión» (si la
  sesión caduca con la pestaña abierta, lo dice y ofrece «Iniciar sesión»);
- la marca es la MISMA del sitio público: `MarcaInakat` (la figura de
  `logo.png` en lima + la palabra en arena, en negativo sobre la tinta) y
  `SimboloInakat` (sólo la figura, recortada de `logo.png` con una máscara y
  pintada con el color de fondo que le pases). No uses el `Isotipo` como marca:
  es un motivo (ver «Avatar, Isotipo»);
- cabecera fija de 56 px (`h-14`) con la sección actual, el saldo de créditos
  (empresa) y la campanita;
- el `<main id="contenido">` con papel, `max-w-app` y relleno;
- en móvil (< 1024 px): barra superior + cajón con la misma navegación;
- el proveedor de avisos (`useAvisos`) y la sesión (`useSesionApp`).

**Tu página NO pinta** `<main>`, ni `min-h-screen`, ni `bg-gray-50`, ni
`container mx-auto px-4 py-8`: ya los pone el armazón. Lo que fijes con `sticky`
va en `top-14` (= `var(--ap-top)`), debajo de la cabecera.

```tsx
import { useSesionApp } from '@/components/ui/AppShell';
import { notifyAuthChanged } from '@/lib/auth-events';

const sesion = useSesionApp();          // { usuario: { nombre, role, credits… } }
// Tras una acción que cambia créditos o nombre (publicar, comprar, guardar perfil):
notifyAuthChanged();                     // el saldo de la cabecera se actualiza
```

No vuelvas a pedir `/api/auth/me` sólo para pintar el nombre o el saldo: si la
página YA lo pedía (para decidir algo), déjalo igual (regla 1).

### PageHeader — la cabecera de toda página de app

```tsx
<PageHeader
  antetitulo="Reclutamiento"                 // sección, con el punto naranja
  titulo="Vacantes"                          // el h1 (uno por página)
  remate="de todas las empresas"             // opcional: serif itálica teal
  descripcion="37 empresas con vacantes publicadas"
  acciones={<Button icono={Plus}>Nueva vacante</Button>}   // el primario, el último
  migas={[{ etiqueta: 'Vista general', href: '/admin' }, { etiqueta: vacante.title }]} // en detalles: el nombre del ítem del menú
/>
```

### Button / ButtonLink / IconButton

```tsx
<Button onClick={guardar} cargando={guardando}>Guardar</Button>          // primario: naranja + tinta
<Button variante="secundario" icono={Send}>Enviar a especialista</Button> // tinta
<Button variante="contorno" icono={RefreshCw}>Actualizar</Button>         // neutras: Cancelar, Exportar
<Button variante="fantasma" tamano="sm">Ver más</Button>                 // terciarias en tablas
<Button variante="peligro" icono={Trash2}>Eliminar</Button>              // lo que no se deshace
<ButtonLink href="/create-job" icono={Plus}>Publicar vacante</ButtonLink> // NAVEGA (es un <a>)
<IconButton etiqueta="Editar vacante" icono={Pencil} onClick={editar} /> // sin etiqueta no compila
```

- **Un primario por vista.** Tamaños `sm` 32 · `md` 40 · `lg` 48 px.
- `type="button"` por defecto; en formularios, `type="submit"` explícito.
- `cargando` deshabilita, pone el giro y `aria-busy`. `textoCargando="Publicando…"` opcional.
- ¿Necesitas las clases en otro elemento (`<label>`, `<summary>`)? `clasesBoton({ variante, tamano })`.
  Para un botón de icono: `clasesIconButton({ variante, tamano })`.
- Un enlace que parece botón es `ButtonLink`, no `<Button onClick={() => router.push()}>`
  — **salvo** que la página ya navegara con `router.push` (regla 1: déjalo).
- Un enlace EXTERNO con aspecto de botón de icono (LinkedIn, descargar un
  documento): `<IconLink href={url} etiqueta="LinkedIn de Ana" icono={Linkedin} tamano="sm" />`
  (abre en pestaña nueva con `rel="noopener noreferrer"` y lo dice al lector;
  valida tú el `href` con `isSafeHttpUrl` si viene de un usuario).
- Registro PÚBLICO (login, registro, contacto): `variante="publico-naranja"` o
  `"publico-fantasma"` pinta la píldora de la portada (`hm-btn`) con el mismo
  `cargando`/`aria-busy`. En un `<Link>` usa `clasesBoton({ variante: 'publico-naranja' })`.

### Switch — activo / inactivo

```tsx
<Switch activo={p.isActive} alCambiar={() => alternar(p)} objeto={p.name} />          // «Activo: Pack 10»
<Switch activo={u.isActive} alCambiar={() => alternar(u)} describidoPor={`nombre-${u.id}`} tono="lima-oscuro" />
<Switch activo={v.isActive} alCambiar={…} textos={{ activo: 'Activa', inactivo: 'Inactiva' }} cargando={guardando} />
```

`button role="switch"` + `aria-checked`, el estado ESCRITO al lado, pista teal
(7.38) o lima oscuro (8.92) encendida y `line-strong` (3.83) apagada. No cambia
nada solo: llama a `alCambiar` y la página confirma y guarda como antes.

### MenuAcciones — el «⋯» de una fila

```tsx
<MenuAcciones etiqueta={`Más acciones para ${v.title}`} opciones={[
  { id: 'pausar', etiqueta: 'Pausar', icono: Pause, alElegir: () => pausar(v.id) },
  { id: 'cancelar', etiqueta: 'Cancelar vacante', icono: Ban, peligro: true, alElegir: … },
]} />
```

Patrón WAI-ARIA de botón de menú (flechas, Inicio/Fin, Escape devuelve el foco).
Se pinta en un portal con posición fija (no lo recortan Card ni DataTable) y
corta la propagación del clic: elegir una opción no abre la fila clicable.

### useConfirmacion — sustituto de `confirm()`

```tsx
const { confirmar, dialogo } = useConfirmacion();
if (!(await confirmar({ titulo: '¿Pausar la vacante?', descripcion: '…', textoConfirmar: 'Pausar', variante: 'peligro' }))) return;
// …el flujo de siempre…
return <>{…}{dialogo}</>;
```

Devuelve una promesa sí/no como `confirm()`: el manejador sigue en la misma
línea (regla de §4 Toast: sólo se sustituye si la acción posterior es idéntica).
Cancelar, Escape, la X y el fondo responden `false`; el foco va al diálogo.

### Aviso / AvisoError — avisos en línea

```tsx
{error && <AvisoError mensaje={error} alReintentar={cargar} />}              // error de carga (§5), con su mb-6
<Aviso tono="exito" titulo="Listo">Te enviamos el correo.</Aviso>            // role="status"
<Aviso tono="info" alCerrar={() => setInfo(null)}>…</Aviso>                  // no se anuncia
<Aviso compacto mensaje={errorSubida} />                                      // dentro de un modal o formulario
```

Error = `role="alert"`; éxito y aviso = `role="status"`; info sin rol. Icono,
color y texto (pares 6.30 · 7.84 · 8.18 · 6.14). «Reintentar» llama a LA MISMA
función que cargó.

### ErrorDePanel — el `error.tsx` de una sección

`<ErrorDePanel titulo="Error en el panel de reclutador" alReintentar={reset} />`:
dentro del AppShell (sin pantalla completa), título y texto en `role="alert"`,
«Recargar página» y «Reintentar». Lo usan admin, company, recruiter y specialist.

### Card

```tsx
<Card titulo="Últimas compras" descripcion="Pagos de los últimos 30 días"
      acciones={<Button variante="contorno" tamano="sm">Exportar</Button>}
      pie={<span className="text-[13px] text-ink-muted">Actualizado hace 2 min</span>}>
  …
</Card>
<Card titulo="Vacantes" sinRelleno>{/* tablas y listas que llegan al borde */}</Card>
```

Es un `<section>` con `[overflow:clip]` (recorta esquinas sin matar el `sticky` de
dentro, ver trampas). `como="div"` / `nivelTitulo={3}` si hace falta.

### StatCard — una cifra

```tsx
<div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
  <StatCard etiqueta="Vacantes totales" valor={n.toLocaleString('es-MX')}
            detalle="96 activas, 21 borradores" alerta="7 pausadas"
            icono={Briefcase} tono="teal" />
  <StatCard etiqueta="Solicitudes pendientes" valor={5} icono={Building2} tono="orange"
            enlace={{ href: '/admin/requests', etiqueta: 'Ver solicitudes' }} />
  <StatCard etiqueta="Candidatos" valor={0} cargando icono={Users} />
</div>
```

Dos por fila hasta 1280 px (con la barra lateral no caben cuatro), cuatro desde
`xl`. Tonos: `teal`, `orange`, `lime`, `ink`. Formatea tú la cifra.
Cifras largas (dinero con centavos: «$1,262,050.00»): `compacta` las achica
donde la tarjeta es estrecha; se activa sola con un texto de más de 10
caracteres. Si una fila mezcla largas y cortas, pásalo a todas.

### EtapasPipeline — un embudo en una línea

`<EtapasPipeline etapas={[{ id: 'pend', etiqueta: 'Pendientes', valor: 3, punto: 'bg-orange' }, …]} />`:
un `<dl>` de etapas pintadas como puntos sobre el puente (el isotipo aplicado a
un pipeline), con su cifra y su nombre; una etapa vacía deja el punto hueco.
En móvil, rejilla de cuatro.

### DataTable — toda lista de registros

```tsx
const columnas: Columna<Vacante>[] = [
  { id: 'title', encabezado: 'Vacante', ordenable: true, enTarjeta: 'titulo', className: 'min-w-[12rem]',
    celda: (v) => <p className="font-semibold">{v.title}</p> },
  { id: 'company', encabezado: 'Empresa', ordenable: true, enTarjeta: 'meta',
    truncarEn: '14rem', tituloCelda: (v) => v.company, celda: (v) => v.company },
  { id: 'location', encabezado: 'Ubicación', ocultarBajo: 'xl', enTarjeta: 'meta',
    truncarEn: '12rem', tituloCelda: (v) => v.location, celda: (v) => v.location },
  { id: 'total', encabezado: 'Candidatos', numerica: true, enTarjeta: 'meta',
    celda: (v) => <>{v._count.applications}<span data-solo-tarjeta> candidatos</span></> },
  { id: 'salary', encabezado: 'Salario', ocultarBajo: 'lg', unaLinea: true, celda: (v) => v.salary },
  { id: 'status', encabezado: 'Estado', enTarjeta: 'meta', celda: (v) => <StatusBadge estado={v.status} contexto="vacante" /> },
  { id: 'acciones', encabezado: 'Acciones', encabezadoOculto: true, alinear: 'fin', enTarjeta: 'acciones',
    className: 'w-px whitespace-nowrap',   // ancho de ESCRITORIO: en tarjetas no cuenta
    celda: (v) => <IconButton etiqueta={`Ver ${v.title}`} icono={Eye} onClick={() => abrir(v)} /> },
];

<DataTable
  etiqueta="Vacantes"                         // caption para lectores de pantalla
  columnas={columnas}
  filas={filas}
  claveFila={(v) => v.id}
  cargando={cargando}
  orden={{ columna: campo, direccion }}       // el orden lo lleva la página
  alOrdenar={ordenarPor}
  alActivarFila={abrir}                       // fila clicable: ratón en toda la fila, Intro con teclado
  paginacion={pagination}                     // el bloque `pagination` de la API, tal cual
  alCambiarPagina={setPagina}
  etiquetaTotal="vacantes"
  vacio={<EmptyState frase="Todavía nada por aquí." titulo="No hay vacantes con estos filtros" />}
/>
```

- **Densidad**: `compacta` por defecto (filas de 44 px, listados); `densidad="normal"`
  las deja en 48 px. Dentro de la tabla, `Button`, `ButtonLink` e `IconButton`
  salen en `sm` (32 px) si la página no pide otro `tamano` (ContextoTabla): una
  fila con acciones no pasa de 48 px. Cifras tabulares.
- **Cada celda va envuelta en UN `.ap-celda`** (lo pone DataTable). En la tabla
  no pinta caja (`display: contents`); en tarjetas es el «valor» de «etiqueta |
  valor», así una celda con varios nodos («7» y «años») no se parte.
- **Una línea**: `unaLinea: true` para lo que nunca debe partir en la tabla
  (salarios «$55,000 – $65,000 MXN», fechas, cifras con unidad; en tarjetas sí
  parte). `truncarEn: '12rem'` corta en una línea con «…» a partir de ese ancho
  (empresa, ubicación, nombres largos): ponle también `tituloCelda: (fila) => texto`
  para que el valor completo salga en el `title` de la celda (el lector lo lee
  entero igual). Una celda que parte en 2–3 renglones («Guadalajara, / Jal.»)
  sube la fila a 87 px: es lo primero que se corrige.
- **`ocultarBajo`**: `'md' | 'lg' | 'xl' | '2xl'` (tabla de menos de 800 / 960 /
  1100 / 1280 px). Ver §7.
- **Tabla que desborda**: si aun así no cabe, se desplaza de lado; la caja lleva
  `data-desborda` y una sombra estrecha en el borde derecho (sin eventos) dice
  que hay más mientras no se llegue al final. Una columna fija a la derecha
  puede pintar su sombra izquierda con `[.ap-tabla-caja[data-desborda]_&]:shadow-…`
  (ver `CLASES_ACCIONES_FIJAS` en `/admin/candidates`).
- Los botones y enlaces de una fila clicable funcionan solos (su clic no abre la fila).
- **Paginación real**: pasa el `pagination` que devuelve la API (`buildPaginatedResponse`,
  `total`/`totalPages`). Si la página pagina en el cliente (una lista ya descargada),
  `paginacionLocal(total, pagina, porPagina)`. Con una sola página no se pinta.
- Cabecera fija bajo la barra del AppShell desde 1024 px. Si la tabla no cabe a
  lo ancho, la tabla lo detecta sola, se desplaza en horizontal y suelta la
  cabecera fija. **No lo diseñes así**: esconde columnas (ver §7).
- Estados: `cargando` pinta filas esqueleto; sin filas pinta `vacio`. El error
  NO es un vacío: va en un aviso `role="alert"` encima (ver §5).
- `filaSeleccionada` resalta UNA fila (la abierta en un panel: `aria-current`).
  Para selección MÚLTIPLE, `seleccion`: primera columna de casillas, clic en la
  fila marca (si no es clicable), fila marcada en verde azulado, fila
  `deshabilitada` apagada, y la casilla «todos» en una barra sobre la tabla
  (también se ve en tarjetas). La página decide qué es «todos»:

  ```tsx
  seleccion={{
    marcada: (c) => elegidos.has(c.id),
    alAlternar: (c) => alternar(c.id),
    deshabilitada: (c) => yaAsignados.has(c.email),
    etiquetaFila: (c) => `Seleccionar a ${c.nombre}`,
    todas: { etiqueta: `Seleccionar todos (${n} en esta página)`, alAlternar: alternarTodos, extra: '3 ya asignados' },
  }}
  ```
- `claseFila={(fila) => …}`: clases propias por fila (estados de la página).
- **Tarjetas (móvil)**: `enTarjeta` (`titulo`, `acciones`, `meta`, `completa`,
  `oculta`), `accionesAbajo`, `data-solo-tarjeta` y `data-solo-tabla`: ver §7.

### Pagination

La usa DataTable; suelta sirve para listas que no son tabla:
`<Pagination pagination={data.pagination} alCambiar={setPagina} etiqueta="candidatos" />`.
`src/app/admin/_components/Paginacion` es un puente con la firma vieja: al rehacer
tu página, importa `@/components/ui/Pagination`.

### FilterToolbar / FiltroSelect

```tsx
<div className="border-b border-line px-5 py-4">
  <FilterToolbar
    busqueda={{ valor: q, alCambiar: setQ, etiqueta: 'Buscar candidatos', placeholder: 'Nombre o correo' }}
    activos={[estado, empresa].filter(Boolean).length}
    alLimpiar={() => { setEstado(''); setEmpresa(''); }}
    resumen={`${filas.length} de ${total} candidatos`}
    acciones={<Button variante="contorno" tamano="sm" icono={Download}>Exportar</Button>}
  >
    <FiltroSelect etiqueta="Estado" value={estado} onChange={(e) => setEstado(e.target.value)}>
      <option value="">Todos</option>
    </FiltroSelect>
  </FilterToolbar>
</div>
```

Los filtros filtran igual que antes (mismos parámetros a la API, o mismo filtro
en el cliente): sólo cambia cómo se ven.

Búsqueda en el SERVIDOR que se aplica al pulsar «Buscar» (o Intro en cualquier
campo): `alAplicar` convierte la barra en el `<form>` y añade «Buscar» y el
aviso «Sin aplicar» (región viva). `plegableEnMovil` esconde los filtros bajo
640 px tras un botón «Filtros» con contador. `debajo` es un panel (filtros
avanzados) dentro de la misma barra y del mismo formulario.

```tsx
<FilterToolbar className="border-b border-line px-5 py-4"
  alAplicar={applyFilters} sinAplicar={firma !== firmaAplicada} aplicando={cargando}
  plegableEnMovil debajo={avanzados && <div id="filtros-avanzados">…</div>} …>…</FilterToolbar>
```

### Badge / StatusBadge

```tsx
<StatusBadge estado={postulacion.status} contexto="postulacion" />   // «Por revisar»
<StatusBadge estado={compra.paymentStatus} contexto="pago" />
<StatusBadge estado={x} etiqueta="Texto que ya usaba la pantalla" />  // conserva su vocabulario
<Badge tono="info" sinPunto>Tecnología</Badge>                       // etiqueta, no estado
<Badge tono="neutro" icono={Users}>12 candidatos</Badge>
```

```tsx
<StatusBadge estado={app.status} contexto="empresa" />              // lo que ve la empresa: «Por revisar», «Me interesa»…
<RolBadge rol={usuario.role} tamano="sm" />                         // rol: icono Y texto, el mismo en todo el panel
```

`ESTADOS` (en `Badge.tsx`) cubre todos los estados de la app: postulación
(`pending`, `injected_by_admin`, `reviewing`, `evaluating`, `sent_to_specialist`,
`sent_to_company`, `company_interested`, `interested`, `interviewed`, `accepted`,
`rejected`, `discarded`, `archived`), vacante (`active`, `paused`, `closed`,
`draft`), pago (`pending`, `paid`, `failed`, `refunded`, `approved`, `rejected`,
`cancelled`, `in_process`, `charged_back`, `in_mediation`, `authorized`),
solicitud, entrevista (`confirmed`, `scheduled`, `expired`), candidato del banco
(`available`, `in_process`, `hired`, `inactive`), comisión, `sent`, `read`/`unread`.
Contextos que cambian la etiqueta: `vacante`, `postulacion`, `pago`, `solicitud`,
`entrevista`, `candidato`, `comision`, `asignacion` y `empresa` (el vocabulario
de la empresa sobre sus candidatos, que también cambia el tono: lo enviado es
«Por revisar» en naranja, un descartado es neutro; lo usan su lista de
candidatos y la ficha abierta por la empresa). Un estado desconocido sale
neutro y con su nombre crudo: si ves uno, añádelo al mapa.

Roles: `INSIGNIA_ROL` + `<RolBadge rol>` (la etiqueta sale de `etiquetaRol`,
`src/lib/nav-app.ts`). No copies el mapa en tu página.

Tonos: `exito` (lima) · `aviso` (naranja) · `info` (teal) · `peligro` · `neutro`
· `destacado` (lima sólida: contratado) · `marca` (le interesa a la empresa).

### EmptyState

```tsx
<EmptyState
  frase="Todavía nada por aquí."            // la voz humana, serif itálica (opcional)
  titulo="No hay postulaciones"              // qué no hay, dicho claro
  descripcion="Cuando alguien se postule, aparecerá aquí."
  accion={<ButtonLink href="/create-job" tamano="sm" icono={Plus}>Publicar vacante</ButtonLink>}
/>
<EmptyState compacto icono={Inbox} titulo="Bandeja vacía" />   // dentro de tarjetas
```

Distingue siempre **«no hay datos»** (EmptyState) de **«no se pudieron cargar»**
(aviso `role="alert"` con un botón «Reintentar» que llame a la misma función).

### Skeleton

`<SkeletonPagina />` mientras carga la página entera (cabecera + cifras + tabla;
`conCifras={false}` si no hay cifras). `<Skeleton className="h-4 w-40" />` y
`<SkeletonTexto lineas={3} />` para huecos sueltos. Son decorativos
(`aria-hidden`); `SkeletonPagina` ya anuncia «Cargando…».

### Toast / useAvisos

```tsx
const { avisar } = useAvisos();                        // dentro del AppShell
avisar({ tono: 'exito', mensaje: 'Vacante publicada' });
avisar({ tono: 'error', mensaje: 'No se pudo guardar. Revisa tu conexión.' });

<Toast tono="error" mensaje={error} alCerrar={() => setError(null)} />  // controlado por la página
```

Error = `role="alert"` (se anuncia al momento); lo demás = `role="status"`.
`src/components/shared/ErrorToast` es un puente con la firma vieja (`message`,
`onClose`): al rehacer, importa `@/components/ui/Toast`. Un `alert()` del
navegador que ya existía **es comportamiento**: puedes cambiarlo por un aviso
sólo si el flujo que sigue es idéntico (no espera respuesta del usuario).
Un `confirm()` decide el flujo: sustitúyelo por un `Modal` de confirmación
sólo si la acción posterior es exactamente la misma.

### FormField + Input / Select / Textarea / Checkbox

```tsx
<FormField etiqueta="Correo de contacto" requerido
           ayuda="Te escribiremos aquí cuando haya candidatos."
           error={errores.email}>
  <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
</FormField>

<FormField etiqueta="Especialidad"><Select value={v} onChange={…}>…</Select></FormField>
<FormField etiqueta="Descripción" opcional><Textarea rows={5} … /></FormField>
<Checkbox etiqueta="Vacante confidencial" descripcion="No se muestra el nombre de la empresa."
          checked={c} onChange={(e) => setC(e.target.checked)} />
<Input prefijo={<Search />} … />   <Input prefijo={<span className="text-sm">$</span>} … />
```

FormField reparte al control su `id`, `aria-describedby` (error + ayuda),
`aria-invalid` y `required`: no los pases a mano. **El placeholder no es una
etiqueta.** `etiquetaOculta` sólo para un buscador con icono y contexto obvio.
Conserva los `name`, `autoComplete`, `maxLength`, `min`… que ya tuviera el campo.

- **Obligatorio sólo a la vista**: `<FormField requerido>` con el control en
  `required={false}` pone el `*`, «(obligatorio)» y `aria-required`, SIN la
  validación nativa del navegador (que el formulario no tenía).
- `anunciarError`: el `<p>` del error lleva `role="alert"`. Para errores que
  llegan sin que la persona pulse nada (falla la subida de una foto o un CV).
- `sufijo` en Input: un botón o texto dentro del campo, a la derecha, con su
  hueco reservado (no es decorativo: un botón ahí se alcanza con Tab).

```tsx
<FormField etiqueta="Contraseña" requerido>
  <CampoContrasena value={pw} onChange={…} visible={ver} alAlternar={() => setVer(!ver)} autoComplete="new-password" />
</FormField>
<SelectorArchivo accept="image/*" cargando={subiendo} textoCargando="Subiendo…" onChange={…}>Subir foto</SelectorArchivo>
<FormField etiqueta="Identificación" requerido error={errores.identificacion}>
  <CampoArchivo archivo={archivo} inputRef={ref} accept=".pdf" alCambiar={…} alQuitar={…} nombre="Identificación" />
</FormField>
```

- `CampoContrasena`: el ojo de mostrar/ocultar dentro del campo (`aria-pressed`,
  el nombre cambia: «Mostrar/Ocultar contraseña»). `tamanoBoton="md"` en los
  campos altos de acceso.
- `SelectorArchivo`: un `<label>` con aspecto de botón y el `<input type="file">`
  dentro, `sr-only` (alcanzable con Tab); el anillo de foco lo pinta el label.
- `CampoArchivo`: un documento dentro de un FormField (se engancha con
  `useCampo()`), con nombre y tamaño del archivo y «Quitar» que devuelve el foco.

### Modal / Drawer / Capa

```tsx
<Modal abierto={abierto} alCerrar={cerrar} titulo="Eliminar vacante" tamano="sm"
       descripcion="Esta acción no se puede deshacer."
       pie={<>
         <Button variante="contorno" onClick={cerrar}>Cancelar</Button>
         <Button variante="peligro" onClick={eliminar} cargando={eliminando}>Eliminar</Button>
       </>}>
  …
</Modal>

<Drawer abierto={!!sel} alCerrar={() => setSel(null)} titulo={sel?.nombre}>…</Drawer>
```

- `role="dialog"`, `aria-modal`, título y descripción enlazados, foco atrapado,
  Escape cierra, el foco vuelve al botón que abrió, scroll de fondo bloqueado,
  se pinta al final de `<body>`.
- Al abrir, el foco va al **primer campo** del cuerpo; sin campos, al propio
  diálogo (una confirmación nunca abre con el foco en «Eliminar»).
- `tamano`: `sm` 448 · `md` 576 · `lg` 768 · `xl` 1024 px. En móvil sube desde abajo.
- `cerrarAlPulsarFondo={false}` si hay un formulario a medias.
- `iconoTitulo` (un icono, una foto, un logo) va FUERA del `<h2>` y con
  `aria-hidden`: no entra en el nombre del diálogo, y el subtítulo y la
  descripción se alinean con el texto del título.
- Dos `Modal` apilados (el pipeline y encima la ficha, `CandidateProfileModal`,
  que ya es un Modal del sistema): cada uno se lleva a sí mismo al final de
  `<body>` al abrirse, así que el último que se abre queda encima y sólo él
  atiende Escape. `<Capa>` sólo hace falta para un modal HEREDADO que no use
  `Modal` (ya no queda ninguno en `src/`).
- Drawer: el detalle de una fila sin salir de la lista, o filtros en móvil.
- Ficha de detalle larga dentro de un Modal (el patrón de `CandidateProfileModal`):
  la columna lateral de datos de contacto, por debajo de 1024 px, se vuelve una
  franja con lo esencial más un `<details>` con el resto; las pestañas van
  `sticky` y de borde a borde (`className="-mx-5 px-5"` pasado a `Tabs`). Así
  el móvil no gasta su primera pantalla en teléfonos y correos. Úsalo en las
  fichas de vacante o de empresa.

### Tabs / PanelPestana

```tsx
<Tabs idBase="perfil" etiqueta="Secciones del perfil" activa={tab} alCambiar={setTab}
      pestanas={[{ id: 'datos', etiqueta: 'Datos' }, { id: 'docs', etiqueta: 'Documentos', contador: 2 }]} />
<PanelPestana idBase="perfil" id="datos" activa={tab}>…</PanelPestana>
```

Patrón WAI-ARIA (flechas, Inicio/Fin). Si la pantalla ya guardaba la pestaña en
la URL o en estado, conserva ese mecanismo y sólo cambia la presentación.

Si no caben (móvil, un modal estrecho), la fila se desplaza de lado y **el
borde que esconde más pestañas se desvanece** (un degradado de 3 rem:
`data-desborde="inicio|fin|ambos"` + `.ap-pestanas` en `app.css`); la pestaña
activa se desplaza a la vista al elegirla o al cargar. Antes se cortaban en seco
(«Docu», «Pasadas 2» a medias, «Canceladas» fuera) y nada decía que había más.
No lo arregles por página con clases sueltas.
Si los paneles son partes de UN mismo `<form>` (el perfil), `mantenerMontado`:
el panel inactivo se queda con `hidden` y el envío y la validación ven todos
los campos, como antes de partirlo en pestañas.

### Stepper — formularios por pasos (§6)

`<Stepper pasos={PASOS} actual={paso} alIrA={setPaso} />` — puntos unidos por el
puente; en móvil «Paso 2 de 5 · Nombre». Sólo deja volver a pasos hechos.
Con `pasoMaximo` (el paso más lejano ya alcanzado validando) también deja saltar
ADELANTE hasta él: de «Revisión» → «Editar» → otra vez «Revisión» sin pulsar
«Continuar» en cada paso. Quien lo pasa valida en `alIrA` los pasos que se
salta, como «Continuar» (ver `saltarAPaso` en el registro de empresa).

### Avatar, Isotipo

`<Avatar nombre="Ana Ruiz" email="…" />` (iniciales, tinta sobre lima; decorativo:
el nombre va en texto al lado).

`<Isotipo className="h-7 w-auto" color="#2b5d62" colorPunto="#9fbb2f" />` es el
arco y el punto de `ico.png`: el **motivo** del sistema (estados vacíos,
ilustraciones), **no la marca**. La marca, en el sitio y en el panel, es la
figura de `logo.png`: `<MarcaInakat />` (figura + palabra, en negativo sobre
tinta; la pinta el AppShell) y `<SimboloInakat className="h-7" color="bg-lime" />`
(sólo la figura). Antes el panel llevaba el isotipo como marca: dos marcas
distintas según dónde estuvieras.

### Hooks (`src/hooks`)

- `useFocoAtrapado(ref, activo, { alEscape, focoInicial })` — para una capa propia.
- `useBloqueoScroll(activo)` — con contador: dos capas no se pisan.
- `useSesion()` — lo que usan PublicNav y AppShell; en páginas usa `useSesionApp()`.
- `useFalloMapa(refEnvoltorioMapa, mapaVisible)` — `true` si Google rechaza la
  clave de Maps (facturación apagada, dominio no permitido): el script carga,
  pero Google tapa el mapa con su diálogo en inglés y apaga el autocompletado.
  Cae entonces al respaldo (campo de texto simple, `MapaNoDisponible` o un
  `Aviso` informativo). Lo usan `/create-job`, `/company/profile`, `/companies`
  y `/profile`; el rechazo se recuerda para toda la sesión.

### Fechas (`src/lib/fechas.ts`) — un solo formateador

En el mismo panel convivían «25 de febrero de 2026», «23 sep 2026», «23-sep» y
«23/9/2026». Ninguna página formatea fechas por su cuenta (nada de
`toLocaleDateString` local):

```tsx
import { fechaCorta, fechaHora, fechaLarga, hora, fechaIso } from '@/lib/fechas';

fechaCorta(v)                  // «23 sep 2026»           tablas, listas, tarjetas
fechaHora(v)                   // «23 sep 2026, 18:22»    cuándo pasó algo (notas, mensajes)
fechaLarga(v)                  // «23 de septiembre de 2026»  SÓLO en un detalle o en un title
fechaCorta(v, { utc: true })   // fechas SIN hora (nacimiento, periodos, vigencias)
<time dateTime={fechaIso(v)} title={fechaLarga(v)}>{fechaCorta(v)}</time>
```

- Aceptan ISO, número o `Date`; sin fecha válida devuelven «—» (o `vacio`):
  `new Date(null)` es 1970 e `Invalid Date` no llega a pantalla.
- `utc: true` para lo guardado a medianoche UTC: sin él, en México (UTC-6)
  «01/01/2020» se leía «31 dic 2019».
- Los meses van escritos en el módulo, no salen de `Intl`: el ICU de Node dice
  «sept» y el del navegador «sep», y eso rompe la hidratación.
- Excepciones que se quedan: el mes y año de un periodo de experiencia (en UTC)
  y las fechas de calendario con día de la semana («mar 23 sep») de entrevistas.

Tipo de trabajo de una vacante: `etiquetaTipoTrabajo(job.jobType)`
(`src/lib/tipos-trabajo.ts`): el valor guardado es «Tiempo Completo», lo que se
lee es «Tiempo completo». El formulario y los listados usan el mismo mapa.

### app.css (prefijo `ap-`)

Sólo lo que Tailwind no resuelve bien: la tabla que pasa a tarjetas, las
container queries de columnas, la barra lima del ítem activo, las entradas de
capas, «Saltar al contenido». **No añadas estilos de página aquí**: si lo
necesitas, es que falta un componente; dilo en tu informe.

---

## 5. Patrón de página de aplicación (copia `/admin`)

```tsx
'use client';
// … imports de siempre + los de ui

export default function MiPagina() {
  // 1. TODO el estado y TODAS las funciones de antes, sin tocar:
  //    mismos fetch (URL, método, cuerpo), mismos setX, mismos efectos.

  if (isLoading) return <SkeletonPagina />;          // antes: spinner a pantalla completa

  return (
    <>
      <PageHeader antetitulo="Sección" titulo="Título" remate="remate opcional"
                  descripcion="Qué hay aquí, en una línea."
                  acciones={<Button variante="contorno" icono={RefreshCw} onClick={recargar}>Actualizar</Button>} />

      {error && <AvisoError mensaje={error} alReintentar={recargar} />}   {/* role="alert", mb-6 */}

      <div className="mb-6 grid grid-cols-2 gap-3 sm:gap-4 lg:mb-8 xl:grid-cols-4">
        <StatCard … />
      </div>

      <Card titulo="Lista" descripcion="…" sinRelleno>
        <div className="border-b border-line px-5 py-4"><FilterToolbar …>…</FilterToolbar></div>
        <DataTable … />
      </Card>

      <Modal …>…</Modal>
    </>
  );
}
```

Lista de comprobación:

- [ ] Ni `<main>`, ni `min-h-screen`, ni `container`, ni fondos de página: los pone el AppShell.
- [ ] Un `PageHeader` con un solo `h1`. Secciones con `Card` (h2).
- [ ] Todos los colores son tokens; ningún naranja con texto blanco.
- [ ] Todos los estados con `StatusBadge` (o `Badge` + texto).
- [ ] Carga con esqueleto, vacío con `EmptyState`, error con `role="alert"`.
- [ ] Cada campo en `FormField`; cada botón de icono con `etiqueta`.
- [ ] Los campos van a **16 px en móvil** (14 px desde `sm`): iOS Safari hace
      zoom al enfocar un campo de menos de 16 px y descuadra el formulario.
      `Input`/`Select`/`Textarea` ya lo hacen (`text-base sm:text-sm`) y
      `globals.css` lo garantiza para los campos sueltos. Si achicas uno en una
      tabla, hazlo desde `sm` (`className="h-8 sm:text-[13px]"`), nunca con un
      `text-[13px]` a secas.
- [ ] Tabla con `DataTable`; paginación real si la API pagina.
- [ ] Modales con `Modal`; `confirm()` con `useConfirmacion`; acciones secundarias de fila en `MenuAcciones`.
- [ ] Teclado: recorre la página con Tab; todo se ve y se activa.
- [ ] Nada ligado al scroll; transiciones de 150–200 ms.
- [ ] Probada en `/diseno/vista/<ruta>` a 1440 y 390 (y a 1024: con la barra lateral queda poco).
- [ ] Las llamadas de red son las mismas (compáralas en la pestaña Red del navegador o con un test).

---

## 6. Patrón de formulario largo por pasos

Para `/companies` (cotización), `/register`, `/create-job` (`CreateJobForm`),
`CandidateForm`. La regla de oro: **los pasos son presentación**. El estado del
formulario sigue siendo el mismo objeto; el envío final construye el MISMO
cuerpo con la MISMA llamada; las validaciones son las mismas, sólo que se
muestran al intentar avanzar en vez de sólo al final.

```tsx
const PASOS = [
  { id: 'empresa', etiqueta: 'Tu empresa', descripcion: 'Nombre, RFC y contacto' },
  { id: 'puesto', etiqueta: 'El puesto', descripcion: 'Qué buscas' },
  { id: 'revision', etiqueta: 'Revisión', descripcion: 'Confirma y envía' },
];
const CAMPOS_POR_PASO: Record<string, Array<keyof typeof formData>> = {
  empresa: ['nombreEmpresa', 'rfc', 'email'],
  puesto: ['puesto', 'descripcion'],
  revision: [],
};

const [paso, setPaso] = useState(0);

// Reutiliza la validación QUE YA EXISTE (la función o el schema de siempre) y
// quédate sólo con los errores de los campos de este paso.
const avanzar = () => {
  const todos = validar(formData);                         // la de siempre
  const delPaso = CAMPOS_POR_PASO[PASOS[paso].id].filter((c) => todos[c]);
  if (delPaso.length) {
    setErrores(todos);
    document.getElementById(`campo-${delPaso[0]}`)?.focus(); // lleva al primer error
    return;
  }
  setPaso((p) => p + 1);
  tituloRef.current?.focus();                               // el lector anuncia el paso nuevo
};

<Stepper pasos={PASOS} actual={paso} alIrA={setPaso} className="mb-8" />
<form onSubmit={handleSubmit} noValidate>                    {/* el submit de SIEMPRE */}
  <h2 ref={tituloRef} tabIndex={-1} className="font-display text-xl font-semibold outline-none">
    {PASOS[paso].etiqueta}
  </h2>
  {paso === 0 && (<>
    <FormField etiqueta="Nombre de la empresa" requerido error={errores.nombreEmpresa} id="campo-nombreEmpresa">
      <Input name="nombreEmpresa" value={formData.nombreEmpresa} onChange={handleChange} />
    </FormField>
    …
  </>)}
  …
  <div className="mt-8 flex justify-between gap-3">
    <Button variante="contorno" onClick={() => setPaso((p) => p - 1)} disabled={paso === 0}>Anterior</Button>
    {paso < PASOS.length - 1
      ? <Button onClick={avanzar} iconoFinal={ArrowRight}>Siguiente</Button>
      : <Button type="submit" cargando={enviando}>Enviar solicitud</Button>}
  </div>
</form>
```

- Los campos de los pasos ocultos **no se desmontan si guardaban estado propio**
  (un `<input type="file">`, un mapa): usa `hidden` en vez de condicional, o
  guarda el valor en el estado del formulario como ya se hacía.
- El paso final repite un resumen de lo capturado (lectura, no edición).
- Si el formulario tenía una calculadora (p. ej. el costo de `/create-job`),
  **siempre visible**: en escritorio en una columna lateral `sticky top-20`
  (dentro de un contenedor sin `overflow`), en móvil en una barra fija abajo.
- En el registro público, el formulario va dentro del registro público (suelo,
  titular) pero con los mismos `FormField`: la legibilidad no se negocia.

---

## 7. Tablas en móvil y en anchos medios

Las columnas se esconden según el ancho de **la tabla**, no el de la ventana
(container queries en `app.css`): a 1280 px de ventana, con la barra lateral,
la tabla sólo tiene ~970 px.

| `ocultarBajo` | se esconde si la TABLA mide menos de |
|---|---|
| `'2xl'` | 1280 px |
| `'xl'` | 1100 px |
| `'lg'` | 960 px |
| `'md'` | 800 px |
| (tarjetas) | 600 px |

Por debajo de 600 px la MISMA tabla se ve como tarjetas (un solo DOM). Objetivo:
**90–120 px por tarjeta**, no un par «etiqueta: valor» por columna (había
tarjetas de 230–330 px por registro y en móvil no se podía trabajar). La
tarjeta se ordena así:

1. `enTarjeta: 'titulo'`: encabeza la tarjeta, sin etiqueta, y comparte la
   primera línea con las acciones de icono;
2. `'acciones'`: arriba a la derecha si son botones de icono (o un `Switch`);
3. `'meta'`: bajo el título, TODAS en UNA línea separadas por « · » y sin
   etiqueta («Grupo Andes · Monterrey, NL · 23 sep 2026»). Si no caben,
   envuelven: la meta que empieza renglón no lleva « · » delante (DataTable la
   marca con `data-meta-inicio`). Aun así, 2–3 metas cortas leen mejor que 6;
   las cifras llevan su unidad con `data-solo-tarjeta` («4 por revisar»);
4. el resto (`'normal'`, por defecto), «Encabezado: valor» con la etiqueta de
   ancho fijo (los valores de todas las filas empiezan en la misma x), y
   `'completa'` a lo ancho sin etiqueta;
5. al pie, a lo ancho: las `'acciones'` que llevan un `Button` con texto
   («Aprobar», «Guardar») o un campo (`select`, `input`). Lo decide solo
   (`accionesAbajo` sin indicar); `accionesAbajo` fuerza el pie (`true`) o la
   esquina (`false`) en toda la tabla.

`'oculta'` no sale en la tarjeta: las columnas secundarias (precio original,
descuento, ingresos…). En tarjetas se ven también las columnas escondidas con
`ocultarBajo`, así que decide para cada una si es meta, normal u oculta.

Los anchos que la página da a la columna (`w-px`, `min-w-[12rem]`) son del
ESCRITORIO: en tarjetas no cuentan (antes una celda de acciones `w-px` medía
1 px y sus botones se montaban encima del título). Tampoco hace falta
`flex-nowrap`/`flex-wrap` especial para la tarjeta.

Textos que sólo van en una de las dos vistas (dentro de una celda):

- `data-solo-tarjeta`: sólo en la tarjeta. La unidad que en la tabla da la
  cabecera («4 <span data-solo-tarjeta>candidatos</span>») o el nombre de una
  cifra en la línea meta («Venta $4,500»).
- `data-solo-tabla`: su inverso, sólo en la tabla. Lo que en la tabla va
  apilado y en la meta va seguido: el renglón de abajo lleva `data-solo-tabla` y
  su copia en línea, `data-solo-tarjeta` (ver el código de `/admin/vendors`).
- `data-solo-bajo="md|lg|xl|2xl"`: sólo mientras la columna de ese nivel está
  escondida (en tarjetas no se ve: ahí salen todas las columnas).

- ¿El dato de una columna escondida hace falta en la fila? Súbelo a la celda
  principal con `data-solo-bajo`: sólo se ve mientras esa columna está escondida.

```tsx
{ id: 'title', …, celda: (v) => (<>
    <p className="font-semibold">{v.title}</p>
    <span data-solo-bajo="xl" className="inline-flex"><Badge tono="info" sinPunto tamano="sm">{v.profile}</Badge></span>
  </>) },
{ id: 'profile', encabezado: 'Especialidad', ocultarBajo: 'xl', celda: … },
```

- Tablas donde la tarjeta no tiene sentido (una matriz de precios): `movil="desplazar"`.
- Objetivo: que la tabla quepa **sin desplazarse de lado** a 1440, 1280, 1024 y
  820 px. `/admin` lo cumple con 8 columnas: úsala de modelo (acciones juntas en
  una columna `w-px whitespace-nowrap`, fechas y salarios con `unaLinea`,
  empresa y ubicación con `truncarEn` + `tituloCelda`, el nivel EN LÍNEA con el
  título y no debajo). Filas de 44–48 px: 8–10 registros a la vista a 1440×900.

---

## 8. Patrón de página pública (copia la portada)

```tsx
// src/app/<ruta>/page.tsx — componente de servidor; metadata como ya estaba
import SiteMotion from '@/components/ui/SiteMotion';
import TituloMascara from '@/components/ui/TituloMascara';
import Footer from '@/components/commons/Footer';

export default function Pagina() {
  return (
    <>
      <main className="hm">
        <section className="hm-seccion hm-suelo--arena relative">
          <div className="pointer-events-none absolute inset-0" aria-hidden="true">
            <span className="hm-arc hm-arc--b" /><span className="hm-arc hm-arc--c" />
          </div>
          <div className="hm-wrap relative">
            <p className="hm-eyebrow">Para empresas</p>
            <TituloMascara como="h1" className="hm-display mt-4" renglones={[
              { texto: 'Talento evaluado' },
              { texto: 'por expertos reales.', contenido: <em>por expertos reales.</em> },
            ]} />
            <p className="hm-lead mt-6">Entradilla…</p>
            <div className="mt-10 flex flex-wrap gap-3">
              <Link href="/companies#register" className="hm-btn hm-btn--orange">Registra tu empresa <ArrowRight aria-hidden="true" /></Link>
              <Link href="/contact" className="hm-btn hm-btn--ghost">Habla con nosotros</Link>
            </div>
          </div>
        </section>

        <section className="hm-seccion hm-suelo--tinta" aria-labelledby="t-proceso">
          <div className="hm-wrap">
            <h2 id="t-proceso" className="hm-h2">Once etapas <em>antes de presentarte a alguien.</em></h2>
            <ol className="mt-12 grid gap-6 md:grid-cols-3">
              <li className="hm-rv">…</li>
            </ol>
          </div>
        </section>
      </main>
      <Footer />
      <SiteMotion />
    </>
  );
}
```

Primitivas de `site.css` (todas con prefijo `hm-`):

| Clase | Qué es |
|---|---|
| `hm` | raíz de la página (en `<main>`): arena, tinta, `overflow-x: clip`; todo `<em>` dentro es serif itálica |
| `hm-wrap` | contenedor: 1480 px y medianil fluido `--gut` |
| `hm-seccion` | aire vertical de sección |
| `hm-suelo--arena/papel/tinta/teal/naranja/lima` | suelos que alternan (ninguna racha pasa de dos pantallas) |
| `hm-eyebrow` | antetítulo con el punto |
| `hm-display` | h1 de página interior (menor que el de la portada, igual de grande que el encuadre) |
| `hm-h2` | titular de sección; su `<em>` es el remate serif (lima sobre tinta/teal) |
| `hm-lead` | entradilla |
| `hm-btn` + `--orange/--lime/--ink/--ghost` | botones públicos (píldora); `data-hm-magnet` los imanta. El anillo de foco es `currentColor`, salvo sobre suelo naranja/lima (tinta) y el lima/naranja sobre tinta/teal (blanco) |
| `hm-arc` + `--a/--b/--c` | los tres arcos del puente (dentro de un contenedor posicionado) |
| `hm-dot` | el punto |
| `hm-line` (vía `TituloMascara`) | titular partido en máscaras, sube al cargar |
| `hm-entra` (+ `style={{'--i': n}}`) | fundido de entrada para lo que acompaña al titular |
| `hm-rv` | revelado ligado al scroll |
| `hm-mask` | máscara ligada al scroll: `<span class="hm-mask"><span>renglón</span></span>`. Cada máscara es un renglón (bloque) también sin scroll timelines |
| `hm-plane` (+ `--f` en el elemento) | paralaje del puntero: SiteMotion escribe `--mx/--my` en cualquier `[data-hm-hero]` |
| `hm-plus` | el + que gira a − en un `<details>` |
| `hm-progress` | barra de progreso de lectura (`<div className="hm-progress" aria-hidden="true" />`) |

Piezas públicas que ya comparten varias páginas (úsalas antes de copiar):

- `src/app/privacy/_documento/DocumentoLegal` (+ `ContactoLegal`, `documento.css`,
  prefijo `dl-`): la maqueta de `/privacy` y `/terms`. Un solo aviso de
  documento provisional al margen (fijo desde 1024 px) e índice opcional con la
  prop `indice`, que se pinta con dos secciones o más.
- `src/app/_estados` (`estados.css`, prefijo `es-`, y `SalidaPanel`): la 404, el
  error y la carga raíz.
- Candidatas a primitiva `hm-` si otra página las pide (hoy sólo en `/about`,
  `about.css`): la ventana en arco con anillos (`.ab-ventana`/`.ab-anillo`), el
  carril con el punto viajero ligado al scroll (`.ab-carril`) y la tarjeta de
  retrato en arco (`.ab-experto__ventana`). Al segundo uso, se suben a `site.css`.

Reglas del registro público:

- **Sin JS, con movimiento reducido o sin `animation-timeline`, todo se lee**: el
  estado natural es el final. Lo ligado al scroll va SIEMPRE dentro de
  `@supports (animation-timeline: view())` y `@media (prefers-reduced-motion: no-preference)`.
- Las entradas al cargar cuelgan de `.hm--js`, que pone `<SiteMotion />` sólo con
  la pestaña visible. Monta `SiteMotion` una vez por página.
- Sólo se animan `transform`, `opacity` y `clip-path`.
- Titular partido en máscaras = `aria-label` en el encabezado y `aria-hidden` en
  los trozos (`TituloMascara` lo hace). Si NO es un encabezado (`como="p"`, una
  frase en máscaras), `aria-label` no da nombre: `TituloMascara` pone entonces
  el texto completo en un `sr-only`.
- Lo que fijes con `sticky` va en `top: var(--nav)` (56 px, el alto real de la barra).
- Estilos propios de tu página: una hoja `src/app/<ruta>/<ruta>.css` importada
  desde su `page.tsx`, con prefijo propio o `hm-`; no toques `site.css` ni
  `home.css` (si falta una primitiva compartida, pídela en tu informe).
- La barra (`PublicNav`) y el pie (`Footer`) no se tocan. El pie va **después**
  de `</main>` (dentro no cuenta como «información del sitio» para el lector).
- Mide antes y después con la sonda de `sitio-capas` (§11).

---

## 9. Navegación

- `src/lib/nav-app.ts` — `NAV_POR_ROL` (qué ve cada rol en la barra lateral),
  `RUTAS_APP` (prefijos del registro de aplicación: allí no hay barra pública),
  `inicioDeRol`, `itemActivo`. **Contiene TODOS los enlaces que tenía el Navbar
  antiguo**; un test lo comprueba. Si añades una página de app:
  1. su enlace en el grupo del rol;
  2. si cuelga de un prefijo nuevo, ese prefijo en `RUTAS_APP` y un `layout.tsx` con `<AppShell>`;
  3. su envoltorio en `src/app/diseno/vista/<misma ruta>/page.tsx`.
- **El lateral, la cabecera del AppShell (`grupo.titulo / etiqueta`), las migas y
  el h1 dicen lo mismo.** El panel de cada rol va en un primer grupo SIN título
  («Panel», «Vista general»): así la cabecera dice sólo su nombre. Una página sin
  enlace propio (`/applications`) cuelga de un ítem con `tambien: ['/ruta']`.
- `src/lib/nav-publica.ts` — enlaces públicos, CTA «Registra tu empresa»
  (`/companies#register`: quien rehaga `/companies` conserva el `id="register"`) y
  datos de contacto.
- El layout raíz pinta `PublicNav` en todas las rutas; en las de `RUTAS_APP`
  devuelve `null` y no pide la sesión. El `body` ya no lleva `pt-14`: el alto lo
  reserva la barra pública.
- **La 404 de una ruta de aplicación** (`/admin/loquesea`) se pinta con el layout
  raíz y SIN barra: `PublicNav` no sale en `RUTAS_APP` y el AppShell no llega
  (no hay página). Quien rehaga `not-found.tsx`: que la página lleve su propia
  salida visible («Volver al inicio» y, si hay sesión, «Ir a mi panel» con
  `inicioDeRol`) y no dependa de la barra.
- El cajón móvil de `PublicNav` es un diálogo que incluye la barra (la X que lo
  cierra queda DENTRO del `aria-modal`). No lo partas.

---

## 10. Banco de pruebas: probar tu página sin sesión

- **`/diseno`** — galería de componentes y enlaces a cada página.
- **`/diseno/vista/<ruta real>`** — tu página REAL, dentro del AppShell de su rol,
  con `window.fetch` simulado. `?rol=company` (admin, company, candidate, user,
  recruiter, specialist, vendor) fuerza el rol. Los segmentos dinámicos se llaman
  igual que en la ruta real (`/diseno/vista/company/jobs/101/candidates`), así
  `useParams` funciona.
- En producción todo `/diseno` llama a `notFound()`: sirve la página 404 con
  `noindex` y nada de la galería ni de las fixtures (medido con `next start`).
  No está en el sitemap y robots lo excluye. El estado HTTP sale 200 (el
  `loading.tsx` raíz abre el streaming antes): ver `src/app/diseno/layout.tsx`.

La barra negra de abajo a la derecha dice el rol y, en naranja, **cuántas
peticiones no encontraron fixture** (despliégala para ver cuáles). Tu trabajo
empieza por dejar ese contador en cero para tu página.

### Añadir fixtures

Cada bloque tiene su hoja en `src/app/diseno/fixtures/` (`b1-admin-core.ts` …
`b9-modal-perfil.ts`); **escribe sólo en la tuya**. Las de bloque van antes que
las base (`base.ts`: `/api/auth/me` por rol, notificaciones, `/api/specialties`,
`/api/admin/stats`, `/api/jobs`, pipeline): si repites un patrón, gana el tuyo.
Reutiliza sus datos (`import { VACANTES, ESPECIALIDADES, USUARIOS } from './base'`)
para que las pantallas cuenten la misma historia.

Estado tras la integración de la tanda de rediseño (23/09/2026): cada página
de `/diseno/vista` tiene SU hoja con lo que pide al cargar y con sus acciones
(guardar, aprobar, subir, borrar, PATCH de estado…). Comprobado leyendo las
hojas y con las pruebas de jest que las usan (`empresa-paginas.test.tsx`); el
contador naranja en el navegador queda por mirar página a página.

| Página | Hoja |
|---|---|
| `/admin` · `/notifications` | `base` (y `b7` para marcar leídas) |
| `/admin/users` · `/admin/requests` · `/admin/contact-messages` | `b1-admin-core` (GET/POST/PUT/DELETE `/api/admin/users`, GET `/api/company-requests`, PATCH/PUT `/api/company-requests/:id`, GET `/api/admin/contact-messages`) |
| `/admin/candidates` | `b2-admin-candidatos` (GET/POST `/api/admin/candidates`, PUT/DELETE `…/:id`, documentos, reset-password, `/api/upload`) |
| `/admin/assign-candidates` · `/admin/assignments` · `/admin/direct-applications` · `/admin/interviews` | `b3-admin-operacion` (la búsqueda `status=available,in_process` es suya; b2 la deja pasar) |
| `/admin/specialties` · `/admin/pricing` · `/admin/credit-packages` · `/admin/vendors` | `b4-admin-catalogo` |
| `/company/*` | `b5-empresa` (su saldo es el de `USUARIOS.company`: publicar baja el de la cabecera) |
| `/create-job` · `/create-job?edit=<id>` | `b6-vacante` (también `GET /api/jobs/:id`) |
| `/profile` · `/my-applications` · `/candidate/applications` · `/applications` | `b7-candidato` |
| `/recruiter/*` · `/specialist/*` · `/vendor/dashboard` · `/credits/purchase` | `b8-staff` (también `GET /api/credit-packages`) |
| La ficha de candidato (desde cualquier panel) | `b9-modal-perfil` (notas, calificaciones y documentos para cualquier id de postulación) |

Si tocas una página, deja su contador en cero también para las acciones.
En el banco, los `router.push` de la página a una ruta de aplicación también se
quedan en `/diseno/vista/…` (BancoVista reescribe el router).

```ts
// src/app/diseno/fixtures/b5-empresa.ts
import type { Fixture } from './tipos';
import { VACANTES } from './base';            // reutiliza datos base si te sirven

export const fixtures: Fixture[] = [
  // Respuesta fija
  { metodo: 'GET', patron: '/api/company/dashboard', respuesta: { success: true, data: { … } } },

  // Calculada: params del patrón, query, cuerpo y rol
  { metodo: 'GET', patron: '/api/company/jobs/:jobId/candidates',
    respuesta: ({ params, url, rol }) => ({ success: true, data: candidatos(+params.jobId, url.searchParams.get('status')) }) },

  // Escrituras: devuelve lo que devolvería la API (y comprueba el cuerpo si quieres)
  { metodo: 'PATCH', patron: '/api/company/applications/:id', respuesta: ({ cuerpo }) => ({ success: true, data: cuerpo }) },

  // Ver el estado de carga y el de error
  { metodo: 'GET', patron: '/api/company/interview-requests', retraso: 1500, respuesta: { success: true, data: [] } },
  { metodo: 'POST', patron: '/api/jobs', estado: 400, respuesta: { success: false, error: 'Créditos insuficientes' } },

  // RegExp: se compara con pathname + query
  { metodo: 'GET', patron: /^\/api\/applications\?jobId=\d+/, respuesta: { success: true, data: [] } },
];
```

- `patron` de texto: se compara con el pathname SIN query; `:nombre` captura un
  tramo, `*` cualquier cosa.
- Copia la FORMA exacta de la respuesta de la API (lee su `route.ts`): `success`,
  `data`, `pagination`… Si la forma no coincide, la página se rompe en el banco
  y te engaña.
- Datos inventados y verosímiles (nombres ficticios, `@correo.mx`). **Nunca**
  datos reales de producción.
- Límite: las páginas que son componentes de servidor y consultan la base antes
  de pintar (hoy `/create-job`) se envuelven pintando lo mismo que pintan
  después de esa comprobación (ver su envoltorio).

---

## 11. Verificación

```bash
npx --no-install tsc --noEmit          # 0
npm run lint                           # 0 errores
npx --no-install jest --silent         # 0 fallos
npx --no-install next build            # compila (antes, mata el servidor de desarrollo)
npx --no-install next dev -p 4733      # comprueba antes que el puerto está libre
```

Capturas con puppeteer-core (`createRequire('C:/Users/guill/dev/KarlaDentista/package.json')`,
Chrome en `C:/Program Files/Google/Chrome/Application/chrome.exe`): `page.bringToFront()`
y una captura de calentamiento antes de medir, o la página no pinta. Anchos
mínimos: 1440×900 y 390×844 (y 1024 para la app, 820 para lo público). Mira
las capturas; mide `scrollWidth - clientWidth` (0 = sin desborde horizontal).

Sonda del registro público:
`node C:/Users/guill/.claude/skills/sitio-capas/scripts/qa.mjs http://localhost:4733 <rutas sin barra inicial>`
(5 anchos sin desbordes, consola limpia, movimiento reducido `corriendo: []`, sin JS legible).

---

## 12. Trampas ya cobradas en este repo

1. **`globals.css` declara `section { overflow: hidden }`**: convierte cada
   `<section>` en contenedor de scroll y **mata todo `position: sticky`** de dentro.
   Devuelve `overflow: visible` (o `[overflow:clip]`, que recorta sin crear
   contenedor) donde fijes algo. `Card` ya lo hace.
2. **Animaciones de entrada con `both` en una pestaña de fondo quedan invisibles**
   (el reloj no avanza). Se arman sólo con `document.visibilityState === 'visible'`:
   cuelga las tuyas de `.hm--js` y monta `<SiteMotion />`.
3. **Titular partido en máscaras**: `aria-label` en el encabezado, `aria-hidden`
   en los trozos (o se lee a pedazos). Usa `TituloMascara`.
4. **Un `backdrop-filter` (o `transform`, `filter`) en un ancestro** convierte a
   sus hijos `position: fixed` en prisioneros de ese ancestro. El cristal de la
   barra va en un pseudo-elemento; los modales van en un portal (`Capa`).
5. **`z.string().url()` acepta `javascript:`** (usa `isSafeHttpUrl` de
   `src/lib/sanitize.ts`); **`.optional()` de zod no acepta `null`**;
   **`new Date(null)` es 1970**: comprueba la fecha antes de formatearla.
6. **Blanco sobre naranja 2.54:1**: el naranja lleva texto tinta.
7. **Los archivos tienen CRLF**: cambios de varias líneas con la herramienta
   Edit, no con scripts de cadenas (fallan en silencio o a medias).
8. **`node` no entiende `/c/Users/...`**: usa `C:/Users/...`. Y en Git Bash, un
   argumento que empieza por `/` (`/diseno/vista/admin`) se convierte en ruta de
   Windows: antepón `MSYS_NO_PATHCONV=1` al lanzar tus scripts.
9. **El servidor de desarrollo no siempre recarga `tailwind.config.ts`** (importa
   `tokens.ts`): si una clase de token no pinta (`bg-ink` sin color), reinicia
   `next dev` antes de buscar el fallo en tu código.
10. **El middleware bloquea `/api/admin/*` antes del handler**: una 401/403 en el
    banco no la verás (el banco simula), en local sí.
11. **`--nav` = 56 px** en todos los anchos (lo mide la barra pública). No lo
    corrijas por ancho en tu hoja.
12. **Tablas anchas en `lg`**: con la barra lateral, a 1024 px el contenido sólo
    tiene ~710 px. Esconde columnas (§7) en vez de dejar que la tabla se desplace.
13. **`useEffect` que llama a `fetch` sin dependencias estables** se dispara dos
    veces en desarrollo (Strict Mode). Es normal; no «lo arregles» cambiando la lógica.
14. **`site.css` (y `app.css`) se cargan DESPUÉS de las utilidades de Tailwind**:
    si una clase `hm-`/`ap-` declara una propiedad, gana a la utilidad de esa
    misma propiedad (misma especificidad, va después). Por eso las primitivas de
    texto (`hm-h2`, `hm-display`, `hm-lead`) no declaran `margin` y `mt-4` les
    funciona; pero `hm-seccion py-0` NO quita el aire (declara `padding-block`) y
    `hm-btn px-2` no cambia su relleno. Para ajustar una primitiva, envuélvela o
    usa tu hoja; no subas la especificidad con `!`.
15. **El indicador de desarrollo de Next** (una «N» en un círculo, abajo a la
    izquierda) tapa en las capturas la tarjeta del usuario del AppShell. No es un
    fallo de la página; en producción no existe.
16. **La trampa 14 también se cobra con utilidades con variante.** Una clase de
    página que declara `position` (o cualquier propiedad que también pone una
    utilidad responsiva, como `lg:sticky`) le gana a la utilidad, porque la hoja
    va después de Tailwind. Y entonces `lg:top-[…]` DESPLAZA el elemento en vez
    de fijarlo: en /talents `.tl-detalle { position: relative }` frente a
    `lg:sticky` hacía bajar el panel 72 px sin fijarse. Si una clase propia y una
    utilidad tocan la misma propiedad, deja una sola (la utilidad, o todo en la hoja).
17. **`cn()` usa tailwind-merge 3, que sigue la semántica de Tailwind 4; este
    repo usa Tailwind 3.** En Tailwind 4 `outline` es un ancho; en Tailwind 3 es
    un estilo. Sin el ajuste de `src/lib/utils.ts`, `cn('focus-visible:outline
    focus-visible:outline-2 …')` quitaba el `outline` y el elemento se quedaba
    sin anillo (los botones lo conservaban sólo por la regla de `globals.css`).
    Ya está corregido; si ves otra fusión rara de clases, mira ese ajuste antes
    de buscar el fallo en tu componente.
18. **`globals.css` «hunde» los botones al pulsar** (`transform` en `:active`).
    En un botón con la zona de clic estirada (`::after` que cubre la tarjeta
    entera) el `transform` lo vuelve bloque contenedor de su `::after` y la zona
    encoge un instante: ponle `data-sin-hundir` (ver `TarjetaVacante`).

---

## 13. Qué NO hacer

- Pintar un `<main>`, un navbar o un pie dentro de una página de app.
- Inventar un componente paralelo (otra tabla, otro modal, otro botón): si le
  falta algo a uno de `ui/`, dilo en tu informe; lo amplía una sola mano.
- Cambiar un endpoint, un parámetro, un cuerpo, un orden de llamadas, un texto
  de negocio o una validación «de paso».
- Usar movimiento ligado al scroll en la aplicación.
- Poner información sólo en color, sólo en un `title`, o sólo en un placeholder.
- Quitar un `aria-*`, un `id` que otro enlaza (`#register`) o un `data-*` que usa un test.
