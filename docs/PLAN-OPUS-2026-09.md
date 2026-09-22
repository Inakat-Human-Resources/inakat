# Plan de trabajo para Opus — INAKAT, septiembre 2026

Encargo de Memo, en sus palabras: *«arréglalo todo, y ponle amor a todo el sistema y todas
las páginas como se lo pusiste a la página principal: que todo lo que se presenta sea
awwwards, pero que la aplicación también sea muy atractiva pero útil — bonita de usar,
enfocada en productividad»*. Y aparte: *«un skill como `sitio-completo` pero enfocado a
apps»*.

Este documento es el parte completo para hacerlo sin volver a investigar. Tiene cuatro
partes: **estado exacto**, **A: arreglos restantes**, **B: diseño de todo el sitio**,
**C: el skill `app-completa`**. Al final, cómo verificar, desplegar y cerrar.

---

## 0. Estado exacto al 22/09/2026 (todo verificado, nada supuesto)

| Qué | Dónde |
|---|---|
| Repo | `github.com/Inakat-Human-Resources/inakat` (remoto `origin`), rama `main` @ `1d18c28` |
| Producción | **https://www.inakat.com** · Vercel team `izalith`, proyecto `inakat` · deploy en vivo `inakat-cwks6360j-izalith` |
| Deploy | `vercel deploy --prod --yes --archive=tgz` desde el directorio del repo (la integración GitHub→Vercel **no** genera previews ni producción sola) |
| Rollback | `vercel rollback <url-del-deploy-anterior>`; el anterior al rediseño de la portada es `inakat-28tg0ux2w-izalith.vercel.app` |
| Árbol | `tsc` 0 · `npm run lint` 0 errores (277 warnings preexistentes) · **1467 tests pasan** (83 suites) · `next build` OK · **CI verde** |
| Auditoría | `docs/AUDITORIA-2026-09.md` (índice, plan) + `docs/auditoria-2026-09/*.md` (483 fichas por módulo) |
| Bitácora | `BITACORA.md` — léela entera antes de empezar; tiene el porqué de cada decisión |
| Memoria del rediseño | `docs/HOME-REVAMP-2026-09.md` — el concepto «Arco» y las trampas que se cobraron |

**Ya arreglado hoy y en producción** (commits `4af863d`…`1d18c28`): CI, dependencias (26→8
vulnerabilidades), cuatro formas de publicar vacantes sin pagar, dos carreras de créditos,
comisiones de ventas no pagadas, cargos sin registro, doble acreditación, precios
inventados en la compra, cinco fugas de notas internas, confidenciales des-anonimizables,
oráculo de `/api/applications/check`, XSS por `javascript:` en URLs, CV que no se subía,
registro de empresa con web vacía, entrevistas (success + fecha 1970), cifras falsas del
panel de admin, listas topadas (20→100).

**Nada de la tanda paralela que se interrumpió llegó al árbol** (0 archivos tocados).

---

## Reglas de la casa (aplican a TODO lo que sigue)

1. **Verifica antes de tocar.** Las fichas «sin verificar» de la auditoría pueden ser falsos
   positivos; varias ya se arreglaron hoy. Abre el archivo, confirma el defecto, y sólo
   entonces cambia. Ejemplo real: `/api/vendor/*` abierto a cualquier usuario parecía un
   agujero y el middleware lo documenta como **decisión deliberada** — no se tocó.
2. **Cada arreglo alto o medio lleva test**, y de comportamiento cuando sea posible
   (`__tests__/lib/validations-urls.test.ts` prueba el schema de verdad). Si el test es de
   código fuente, la aserción mira la **llamada** (`fetch(...)`) o la lógica, **nunca texto
   suelto**: dos veces hoy una aserción dio positivo con el *comentario* que explicaba el
   arreglo.
3. **Los archivos tienen CRLF.** Cambios multilínea con la herramienta Edit; los scripts con
   cadenas fallan en silencio o parcialmente.
4. **Dinero = transacción + reclamo atómico**: `prisma.$transaction` y `updateMany`
   condicionado (`credits: { gte: X }`, `paymentStatus: { not: 'paid' }`, `creditCost:
   originalCost`). Nunca leer-comprobar-escribir en tres llamadas. Modelos ya en el repo:
   `src/app/api/jobs/route.ts` (POST), `src/app/api/jobs/[id]/route.ts` (PUT),
   `src/app/api/credits/purchases/route.ts`.
5. **Helpers que ya existen y se reutilizan**: `src/lib/auth.ts` (`requireAuth`,
   `requireRole`, `getOptionalAuthUser` — consultan la base y comprueban `isActive`),
   `src/lib/authz-applications.ts`, `src/lib/validations.ts`, `src/lib/sanitize.ts`
   (`isSafeHttpUrl`, `escapeHtml`), `src/lib/pagination.ts` (tope 100), `src/lib/pricing.ts`,
   `src/lib/email.ts` (`sendEmail`).
6. **No se hace a ciegas**: migraciones destructivas, rotación de secretos, majors con riesgo
   (Next 16, mercadopago 3), textos legales, cifras del cliente. Va a «decisiones».
7. **Nunca abrir ni citar `.env` / `.env.local`.**
8. **Antes de cada push**: `npx --no-install tsc --noEmit` · `npm run lint` ·
   `npx --no-install jest --silent` · `npx --no-install next build`. Los cuatro.
9. **Commits atómicos, en español, con el porqué** (mira `git log -8`), y firma
   `Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>` (o la que dé el sistema).
10. **Bitácora al cerrar cada tanda** (skill `bitacora`): qué se decidió, qué se descartó y
    por qué, qué se rompió. El `git log` ya dice qué cambió.
11. **El entorno muerde**: Bash con `dangerouslyDisableSandbox: true` para todo lo de red y
    git; el shell puede tardar minutos en arrancar, agrupa comandos; git con
    `-c core.fsmonitor=false -c core.hooksPath=/dev/null --no-pager` y `GIT_OPTIONAL_LOCKS=0`;
    `node` no entiende rutas `/c/Users/...` (usa `C:/Users/...`); el puerto 4610 está ocupado
    por otro proyecto, el 4733 está libre.

---

## Parte A — Arreglos restantes de la auditoría

### A.1 Los tres altos ya verificados (receta exacta)

**A.1.1 Desactivar a un usuario no le corta el acceso** (`src/middleware.ts:56`, alto).
El middleware decide sólo con el JWT (7 días) y ~16 rutas confían en las cabeceras
`x-user-id` / `x-user-role` que él pone (grep `getUserIdFromHeaders` y `x-user-role` en
`src/app/api/**`). El middleware ya declara `runtime: 'nodejs'`, así que puede consultar
la base. Receta:
- Tras `verifyToken`, `prisma.user.findUnique({ where: { id }, select: { isActive: true,
  role: true } })`. Si no existe o `!isActive` → 401 en `/api/*`, redirect a
  `/login?reason=inactive` en páginas.
- Usar el **rol de la base**, no el del token, para todas las comprobaciones de rol y para
  la cabecera `x-user-role`.
- Comprobar que `next build` compila el middleware con Prisma. Si no compilara, plan B:
  que las rutas que usan cabeceras pasen a `requireAuth`/`requireRole`.
- Test: `__tests__/lib/auth-*.test.ts` como modelo.

**A.1.2 El admin crea cuentas con 6 caracteres y el login exige 8** (`src/lib/validations.ts:11`
+ `src/app/api/admin/users`, `src/app/api/admin/candidates/[id]/reset-password`, alto).
Exportar `PASSWORD_MIN_LENGTH = 8` desde `validations.ts`, usarla en `loginSchema` y en
todo alta/reset bajo `src/app/api/admin/` y en `/api/auth/register` y `/api/auth/reset-password`.
Test de schema.

**A.1.3 Los mensajes de contacto no los lee nadie** (`src/app/api/contact/route.ts:31`, alto).
(1) Tras guardar, `sendEmail` al admin (`process.env.ADMIN_EMAIL`, si no `SMTP_FROM`), con
`escapeHtml`, sin bloquear la respuesta si el correo falla. (2) `GET
/api/admin/contact-messages` (`requireRole('admin')`, paginado con `pagination.ts`, desc).
(3) Página `src/app/admin/contact-messages/page.tsx` — pero **hazla en la Parte B** con
el sistema de diseño, no antes. No inventes columnas (mira si `ContactMessage` tiene
campo de leído; si no, no lo añadas sin migración aditiva).

### A.2 El resto: medios y bajos

- `docs/auditoria-2026-09/*.md`, módulo por módulo. Orden sugerido: `vac`, `pago`, `emp`,
  `perf`, `eval`, `adm` (100 fichas: pártelo en API y páginas), `auth`, `authui`, `plat`,
  `db`, `infra`, `ui`.
- **Prioridad**: altos y medios completos; bajos de categoría `security`, `authz`,
  `data-integrity`, `correctness`, `payments`, `validation`, `reliability`, `frontend-bug`,
  `dead-code`. Los bajos de `a11y`, `ux`, `responsive`, `copy` **se dejan para la Parte B**,
  que rehace las páginas.
- **Paralelizar sólo con archivos disjuntos**: un agente por módulo, dueño exclusivo de los
  archivos que aparecen como «Ubicación» en su documento; los cambios en archivos ajenos se
  devuelven como *handoff* y los aplica un integrador al final (que corre los cuatro
  comandos). Nadie ejecuta git ni `next build` dentro de la tanda.
- **`db`**: sólo migraciones aditivas e idempotentes (índices, unicidades nuevas). El
  historial de migraciones está desincronizado (ver «decisiones»).
- **`infra`**: sin majors, sin tocar secretos.
- **Paginación real**: hoy las listas piden `limit=100` (tope de los helpers). Con más de 100
  vacantes activas vuelve el problema. La paginación de verdad (UI) va en la Parte B, en
  `DataTable`.

### A.3 Decisiones que NO puede tomar quien ejecuta (se dejan por escrito, no se hacen)

Verificación de email (hoy el email es la llave y nunca se verifica) · aprobación de
empresas (`CompanyRequest.status` no lo comprueba ninguna ruta) · Términos y Aviso de
Privacidad en «construcción» mientras se recogen INE y actas · reembolsos/contracargos de
MercadoPago · CV en URLs públicas permanentes · baseline de migraciones Prisma ·
`/api/vendor/*` abierto (deliberado) · cifras de la portada («150+ especialistas», «15+
estados») · la contradicción de cobertura (FAQ: 5 ciudades; mapa y chips: 7) · la foto del
hero, que es generada por IA · rotación de los secretos de `TOKENS_TO_ROTATE.md`.

---

## Parte B — Diseño de todo el sitio

### B.1 El concepto ya existe: «Arco»

El isotipo de INAKAT es **un punto y un arco** (una persona y el puente). La portada ya lo
usa y Memo lo aprobó. **No se inventa un segundo concepto**: se extiende. Léete
`docs/HOME-REVAMP-2026-09.md` y `src/app/home.css` enteros antes de escribir una línea.

Paleta (contrastes medidos): tinta `#283739` · teal `#2b5d62` · lima `#9fbb2f` · naranja
`#f48602` · arena `#e8e7d4` · papel `#f7f5ee`. Pares aprobados: tinta/arena 9.91 ·
blanco/tinta 12.38 · blanco/teal 7.38 · tinta/lima 5.67 · tinta/naranja 4.87 · lima/teal
3.38 (**sólo titulares grandes**). **Blanco sobre naranja da 2.54 y no pasa AA**: en toda
la app los botones naranjas llevan **texto tinta**, nunca blanco.

Tipografía: Outfit (estructura, ya en `layout.tsx`), DM Sans (texto), **Instrument Serif
itálica** para la voz humana — hoy sólo carga en `/` (`src/app/page.tsx`); súbela a
`layout.tsx` como `--font-serif` para que exista en todo el sitio.

### B.2 Dos registros, una familia

| | Público (lo que «se presenta») | Aplicación (lo que se usa) |
|---|---|---|
| Objetivo | impresionar y convencer | **productividad**: encontrar, leer, actuar, sin fricción |
| Escala tipográfica | grande, se sale del encuadre | contenida; `h1` de página 28–36 px |
| Movimiento | scroll-driven (`animation-timeline`), revelados, paralaje | **ninguno ligado al scroll**; sólo micro-interacciones: hover, foco, transición de estado, skeletons |
| Suelos | alternan (arena/tinta/papel/teal/naranja/lima) | papel casi siempre; tinta/teal sólo en la barra lateral y en cabeceras |
| Densidad | aire | densa pero legible: tablas con filas de 44–48 px, columnas alineadas, números tabulares |
| Serif itálica | remates de títulos, testimonios | sólo en cabeceras de página y estados vacíos, como guiño |
| Referencias | los skills `sitio-awwwards` y `sitio-capas` | Linear, Vercel dashboard, Stripe: claridad, jerarquía, teclado |

### B.3 El sistema de diseño se escribe UNA vez, antes de tocar página alguna

Si veinte agentes rediseñan veinte páginas sin sistema, salen veinte estilos. Primero esto,
por una sola mano, y después el fan-out.

**Archivos:**
- `src/app/site.css` — generaliza `home.css` para las páginas públicas (prefijo `st-`, o
  reutiliza `hm-` renombrando; decide y sé consistente). Mismos tokens, mismas máscaras,
  mismos revelados, mismo candado `.hm--js` con `visibilityState`.
- `src/app/app.css` — el registro de aplicación (prefijo `ap-`): tokens compartidos,
  superficies, sombras suaves, radios, tipografía de app, foco visible, `prefers-reduced-motion`.
- `src/components/ui/` — componentes de app, todos con `aria` correcta y teclado:
  `AppShell` (barra lateral por rol con el isotipo como marca, cabecera con búsqueda/usuario,
  responsive: la barra se vuelve cajón en móvil), `PageHeader` (título + descripción serif +
  acciones), `DataTable` (**paginación real** con `pagination.total` de las APIs, orden,
  filtros, fila clicable con teclado, `overflow-x` en móvil), `StatCard` (ya existe en
  `src/components/company/StatCard.tsx`: absórbelo), `EmptyState`, `Skeleton`,
  `Toast`/`ErrorToast` (ya existe `src/components/shared/ErrorToast.tsx`), `Badge` de
  estado (pending/active/paused/closed/paid/failed… con color y texto, nunca sólo color),
  `FormField` (label visible asociado, ayuda, error, `aria-describedby`), `Button`
  (primario naranja+tinta, secundario ghost, peligro), `Modal` (foco atrapado, Escape,
  `role=dialog`), `Tabs`, `Drawer`.
- `src/components/commons/Navbar.tsx` (818 líneas) se **parte**: `PublicNav` (para el
  registro público: barra de cristal que aparece con el scroll, como en `sitio-capas`
  §2.10) y el `AppShell` para todo lo que va con sesión. Hoy el navbar se rompe en dos
  líneas a 820 px y el botón «Iniciar Sesión» se sale.

### B.4 Inventario de páginas (40) y su registro

**Público / awwwards** (`sitio-awwwards` + `sitio-capas`; mide con la sonda de
`sitio-awwwards` §1 antes y después): `/about` (no tiene `h1`), `/companies` (formulario
de cotización de 1000 líneas: que sea un formulario por pasos, con progreso y validación
en línea), `/talents` (la bolsa: buscador + tarjetas con teclado; hoy `SearchPositionsSection`
tiene 716 líneas), `/contact`, `/login`, `/register` (1412 líneas; por pasos), `/forgot-password`,
`/reset-password`, `/privacy` y `/terms` (placeholders — diséñalos, el texto es decisión de
INAKAT), `/unauthorized`, `not-found`.

**Aplicación / productividad** (`AppShell` + `ui/`):
- Admin (13): `/admin` (dashboard: `StatCard`s con `/api/admin/stats` + tabla), `candidates`
  (1255 líneas), `users`, `requests`, `direct-applications`, `assign-candidates` (1049),
  `assignments`, `interviews`, `specialties`, `vendors` (1073), `pricing`, `credit-packages`,
  y la nueva `contact-messages`.
- Empresa (5): `/company/dashboard`, `/company/jobs/[jobId]/candidates`, `/company/interviews`,
  `/company/profile`, `/create-job` (`CreateJobForm`, 1782 líneas: por pasos, con la
  calculadora de costo visible en todo momento).
- Reclutador (2), Especialista (2), Vendedor (1), Candidato: `/profile` (1895 líneas, por
  pestañas), `/my-applications`, `/candidate/applications`, `/notifications`,
  `/credits/purchase`, `/applications`.
- Componentes grandes que se rehacen con el sistema: `CandidateForm` (1529),
  `CandidateProfileModal` (1497), `CompanyApplicationsTable` (660), `ApplyJobModal` (753).

**Orden**: sistema de diseño → `AppShell` + `/admin` (la página que más se usa) → resto de
admin → empresa → candidato → reclutador/especialista/vendedor → público (`/talents` y
`/companies` primero: son las que convierten) → legales y errores.

### B.5 Reglas de la Parte B

1. **Comportamiento intacto**: mismas llamadas a las mismas APIs, mismos estados. Un
   rediseño que rompe un flujo no es un rediseño.
2. **Los tests de código fuente van a chillar** (`__tests__/qa/*.test.ts` asertan cosas como
   `grid-cols-1 md:grid-cols-` o nombres de secciones). Conserva la **intención** del test
   (que el testimonio real siga, que la FAQ tenga 9 preguntas) y actualiza la aserción de
   implementación. No borres tests.
3. **Trampas verificadas en este repo**:
   - `globals.css` declara `section { overflow: hidden }` y **mata todo `position: sticky`**
     dentro de una `<section>`. Devuelve `overflow: visible` donde haga falta o usa `clip`.
   - Animaciones de entrada con `both` en **pestaña de fondo** dejan el contenido invisible:
     la clase que las arma se pone sólo con `document.visibilityState === 'visible'`
     (`HomeMotion.tsx`).
   - El `h1` partido en máscaras lleva `aria-label`; los trozos, `aria-hidden`.
   - `--nav` no mide lo mismo en todos los anchos (44/64/60 px); mídelo, no lo supongas.
   - Para juzgar nitidez de imágenes, **descarga el archivo servido** (`/_next/image?...&w=`)
     y mide con sharp; `naturalWidth` en el navegador reutiliza variantes cacheadas y el dev
     server sirve miniaturas.
   - `z.string().url()` acepta `javascript:`; `.optional()` no acepta `null`;
     `new Date(null)` es 1970; el middleware bloquea `/api/admin/*` **antes** del handler.
4. **Cada página termina con la sonda** (`node C:/Users/guill/.claude/skills/sitio-capas/scripts/qa.mjs
   http://localhost:4733 <rutas sin barra inicial>`): 5 anchos sin desbordes, consola limpia
   (el `401` de `/api/auth/me` en anónimo es preexistente; arréglalo de paso: que el navbar
   no pida sesión si no hay cookie), reduced-motion `corriendo: []`, sin JS legible,
   árbol de accesibilidad con todos los encabezados. Las páginas con sesión se prueban con
   la cookie de un usuario de cada rol (`COOKIE=auth-token=...` sobre una base local o
   con `.env.e2e`; **nunca con producción**).
5. **Un PR por bloque** (sistema · admin · empresa · candidato · público), cada uno con
   los cuatro comandos verdes y capturas escritorio + móvil de cada página en la
   descripción. Producción sólo con `vercel deploy --prod` tras el merge.
6. **Contraste AA en todo par nuevo**, medido, no supuesto.

---

## Parte C — El skill `app-completa`

Crear `C:\Users\guill\.claude\skills\app-completa\SKILL.md` con el formato de la casa
(frontmatter `name` + `description` con frases disparadoras en español, como
`sitio-completo`). Es el orquestador para **mejorar una aplicación existente**, no para
hacer un sitio de cero. Debe contener, con lo aprendido aquí como referencia viva
(`C:\Users\guill\dev\inakat\Inakatt\inakat`):

0. Prompt de arranque (como `sitio-completo` §0).
1. En qué se diferencia de un sitio: registro de productividad vs registro de impresión
   (la tabla de B.2).
2. Orden de trabajo: línea base medida (`tsc`, lint, tests, `npm audit`, `node_modules`
   presente) → auditoría por módulos con verificación (si la adversarial automática falla,
   verificar a mano los altos y **decirlo**) → arreglos por fases con test y deploy por fase
   (dinero y permisos → datos personales → flujos rotos → correctness → pulido) → sistema
   de diseño una sola vez → aplicar por página → QA → bitácora.
3. Cómo se audita sin inventar: fichas autosuficientes (archivo:línea, evidencia literal,
   escenario, arreglo), dedup por archivo+línea, un documento por módulo, y la lista de
   decisiones que no toma quien ejecuta.
4. Cómo se arregla en paralelo sin pisarse: dueño exclusivo de archivos, handoffs,
   integrador, nadie hace git dentro de la tanda.
5. El sistema de diseño de app (B.3) y sus componentes mínimos.
6. Las trampas verificadas (B.5.3 y las de dinero de «Reglas de la casa» 4).
7. QA: sonda por página, cookie por rol, verificación en producción por HTTP contra datos
   reales (ejemplo: `/api/jobs` devolvía 27 vacantes y se comprobó que las 2 confidenciales
   salían sin `userId`), rollback en un comando.
8. Entorno Windows (Reglas de la casa 11).
9. Cierre: bitácora, CHANGELOG, y el parte al usuario en tres listas — hecho y verificado /
   sin arreglar / decisiones que no son del desarrollo.

Skills relacionados que se citan, no se duplican: `sitio-completo`, `sitio-awwwards`,
`sitio-capas`, `sitio-revision`, `bitacora`, `auditoria-integral`, `pre-pr`.

---

## Prompt de arranque (para pegar en Opus)

```
Lee docs/PLAN-OPUS-2026-09.md, BITACORA.md y docs/HOME-REVAMP-2026-09.md enteros.
Ejecuta la Parte A completa (arreglos restantes, empezando por los tres altos), con tests,
un PR por fase, los cuatro comandos verdes y deploy a producción tras cada merge.
Después la Parte B: primero el sistema de diseño, luego página por página en el orden
indicado, con sonda y capturas, un PR por bloque. Al final la Parte C (el skill).
Bitácora al cerrar cada tanda. No te pares en los gates: decide, anótalo con su motivo,
y lo que sea decisión de negocio va a la lista, no al código.
```
