# Bitácora — INAKAT

**Qué es:** plataforma de reclutamiento con evaluación dual (psicólogos + especialistas
técnicos). Empresas publican vacantes pagando con créditos; candidatos se postulan;
admin, reclutadores y especialistas evalúan. Hay vendedores con código de descuento y
comisión, y un puente de integración con Worky2.
**Dónde vive:** repo `github.com/Inakat-Human-Resources/inakat` (remoto `origin`; hay
un espejo personal en `memorx/inakat`). Producción: **https://www.inakat.com**, servida
por Vercel (team `izalith`, proyecto `inakat`).
**Stack:** Next.js 15 (App Router) · React 19 · Prisma + PostgreSQL · Tailwind · JWT
propio en cookie · MercadoPago · Vercel Blob.

---

## 📸 ESTADO AL 07/10/2026

*(Esta sección se reescribe completa en cada actualización.)*

**Hecho y funcionando**
- **Producción** corre el despliegue `inakat-4bhp379j9-izalith` (código de `997ecce`, igual al
  de `main`). Comprobado el 06/10:
  - Las páginas públicas dan 200, la app redirige con 307 sin sesión y `/diseno` da 404.
  - De 27 vacantes públicas, ninguna filtra datos internos.
  - Las tarjetas se cobran: 11 compras pagadas, la última del 01/10.
- **El puente con Worky2 está activo.** La migración de sus tablas está aplicada desde el
  10/08 y en producción hay 1 API key y 1 webhook registrados. Una key con formato válido
  da 401, no 500.
- **Rollback:** `vercel rollback inakat-kbmoiljye-izalith` (sin el rediseño) o
  `inakat-28tg0ux2w-izalith` (antes de todo).
- Documentación: `docs/AUDITORIA-2026-09.md`, `docs/DISENO.md` y
  `docs/WORKY2_INTEGRATION.md` (con la sección de tests del puente).

**A medias**
- **Rama `test/integracion-worky` (worktree `inakat-integracion`), sin push.** Trae 5 commits:
  - Tests del puente con Worky2 y archivo de contrato.
  - Apellidos bien separados en las postulaciones sin perfil.
  - El arreglo de la postulación con sesión.
  - El arreglo del Blob.
  - El test que tenía el CI en rojo.

  La suite queda en 2077 tests verdes (134 suites, 7 saltados) y tsc en 0. **Falta el
  push a `main` y el despliegue**, y ver que el CI de GitHub salga verde: lleva rojo desde
  el 23/09.
- **Migración `20260922000000` sin aplicar** en producción (se comprobó el 06/10 con
  `migrate status`). Sin ella falta el índice único que impide postularse dos veces a la
  misma vacante.
- **277 hallazgos de la Parte A saltados con motivo**, sin lista en el repo: hay que
  cruzar `docs/auditoria-2026-09/*.md` con el código.
- `ENFORCE_COMPANY_APPROVAL` está apagado: hay 8 empresas pendientes de aprobar.
  `STRICT_ENV_CHECK` está en modo aviso.

**Bloqueado**
- **En Vercel faltan `MERCADOPAGO_WEBHOOK_SECRET`, `SMTP_USER` y `SMTP_PASS`.** Se vio el
  23/09 y se volvió a comprobar el 06/10.
  - Sin ellas no sale ningún correo y el webhook de pagos responde 500.
  - Hay una compra pendiente desde el 17/01/2026 que nadie confirmó.
  - Depende de Memo.
- **Google Maps sin facturación** (desde el 23/09; el 06/10 seguía dando REQUEST_DENIED).
  Depende de Memo.
- **Decisiones de contenido que esperan a INAKAT** (desde el 21/09):
  - La foto del hero.
  - Las cifras de la portada.
  - La cobertura, que se contradice.
  - `/privacy` y `/terms` siguen como provisionales.
  - Los pendientes menores del rediseño.

**Siguiente paso**
- **Memo decide el push de la rama a `main` y su despliegue**, y en el mismo viaje da de
  alta en Vercel las tres variables. Hay que redesplegar después de darlas de alta.

---

## 07/10/2026 — Revisión antes de producción: tests del puente con Worky2 y tres bloqueantes arreglados

**Qué cambió**
- Tests del puente con los handlers reales, en `__tests__/integracion-worky2/`, 70 tests:
  - Las rutas `/api/integration`.
  - El webhook que sale al aceptar desde el panel de empresa y desde el de admin.
  - `contrato-worky2.json`, que genera el código real. Worky2 reproduce ese mismo archivo
    contra su cliente, su receptor y su importador.
- Prueba en vivo sin efectos: `scripts/smoke-integracion-worky2.mjs`.
- Al reproducir el contrato salieron tres fallos:
  - **INAKAT:** «Juan Carlos Pérez López» sin perfil viajaba como nombre «Juan» y paterno
    «Carlos». Ahora los apellidos se toman del final.
  - **Worky2:** sólo leía la primera página.
  - **Worky2:** un candidato sin apellido le tumbaba la lista entera.
- **Un candidato con sesión no podía postularse desde el modal** (pasaba desde el 22/09).
  `/api/applications/check` caía en la regla «sólo admin» del middleware y respondía 403.
- **Cualquier cuenta de candidato podía borrar archivos ajenos del Blob.** Bastaba con
  registrar la URL de un logo o un CV como documento propio y luego borrarlo. Ahora
  `blob-en-uso.ts` sólo borra lo que ninguna otra fila referencia. De paso, cambiar el CV
  ya no rompe el CV enlazado en las postulaciones anteriores.
- **CI rojo desde el 23/09:** un test daba 503 porque en el CI no hay token de
  MercadoPago. En local pasaba porque `next/jest` carga el `.env`.

**Decisiones y descartes**
- No se hizo una prueba de punta a punta con los dos servidores. El anti-SSRF del webhook
  rechaza `localhost` a propósito, y abrirlo para la prueba debilitaba la defensa. En su
  lugar quedaron el contrato generado y la prueba en vivo.
- El Blob no se protege fijando el host del store: la URL la manda el cliente y el host
  no prueba quién es el dueño. Se protege comprobando que nadie más use el archivo.

**Lo que salió mal**
- La bitácora del 24/09 decía «árbol verde». Era cierto en local, pero el CI de GitHub
  llevaba rojo desde el 23/09. **«Verde» se comprueba en el CI, no sólo en local.**
- El meta-test INFRA-003 quita los comentarios con una regex: un comentario con
  «/api/integration/*» abrió un falso bloque `/*` y escondió los imports. Se reescribió
  el comentario.
- El `.env` local apunta a la base de producción y `next/jest` lo carga en cada corrida.
  No hay test que escriba en ella, pero conviene un `.env.test`. Queda pendiente.

**Datos duros** (revisión del 06/10, sólo SELECT)
- 8 empresas aprobadas y 8 pendientes.
- `npm audit --omit=dev`: 10 vulnerabilidades (7 altas, 3 moderadas, 0 críticas).
- `https://inakat.com` redirige a www con un 307, no con un 308.

---

## 23/09/2026 — Parte B en producción

**Qué cambió**
- El rediseño completo salió a producción en 9 commits (`eb22dd9..997ecce`) y el
  despliegue `inakat-4bhp379j9-izalith`.
- `/diseno` (el banco de pruebas con datos de ejemplo) respondía **200 en producción**:
  su layout llama a `notFound()`, pero el `loading.tsx` raíz abre el streaming antes y
  el estado ya salió. Ahora lo corta el middleware: 404 duro en producción, paso libre
  sin sesión en desarrollo. Con test, y comprobado con `next start` y en vivo.

**Cómo lo sabemos**
- En producción: públicas 200, app 307, `/xyz` 404, `/diseno` 404; capturas de
  `/`, `/companies`, `/about` y `/register` a 1440 y 390 px sin desbordes ni errores
  de consola.

---

## 23/09/2026 — Parte B: integración de la tanda de rediseño «Arco»

**Qué cambió**
- 13 bloques en paralelo (9 de aplicación, 4 públicos) rehicieron las 40 páginas con el sistema de diseño; un integrador revisó sus 74 handoffs (aplicó la gran mayoría; los que no, con motivo) y dejó el árbol verde: `tsc` 0 · lint 0 errores (sin warnings nuevos) · **1924 tests pasan, 124 suites** · `next build` OK.
- **Subió a `src/components/ui` lo que cada bloque había copiado**: `Switch`, `Aviso`/`AvisoError`, `useConfirmacion` (había dos), `ConfirmarModal`, `MenuAcciones`, `EtapasPipeline`, `CampoContrasena` (había tres), `SelectorArchivo`, `CampoArchivo`, `TarjetaRepetible`, `ErrorDePanel`, `Dato`/`Seccion`, `IconLink`. Y amplió los de siempre: selección múltiple en `DataTable`, «aplicar al enviar» y filtros plegables en `FilterToolbar`, `sufijo` en `Input`, `anunciarError` y «obligatorio sólo a la vista» en `FormField`, `compacta` en `StatCard`, `mantenerMontado` en `PanelPestana`, `pasoMaximo` en `Stepper`, piel pública en `Button`, `externo` en `ButtonLink`. Todo documentado en `docs/DISENO.md` §4 y en la galería `/diseno`.
- **Arreglado un fallo que afectaba a todo el sistema**: `cn()` (tailwind-merge 3, pensado para Tailwind 4) borraba `focus-visible:outline` cuando iba con `outline-2`; los `<label>` de subir archivo se quedaban sin anillo de foco. Ajustado en `src/lib/utils.ts`, con test.
- Borrado el código muerto que ya no importaba nadie (verificado con grep): `CompanyRequestTable`, `RequestDetailModal`, `RejectModal`, `ApplicationsManagementPanel` (su test VAC-014 ya lo cubre `b7-aplicaciones-cv`), `CTAFinalSection`, `HowItWorksSection` y dos imágenes de `6-login`.
- `/admin/direct-applications` ya lee la paginación de la API (el TODO de la ruta): la primera página se pide igual que siempre y el contador dice el total del servidor.
- Los PUT de `/api/recruiter/dashboard` y `/api/specialist/dashboard` responden «Candidato movido a «En proceso»» en vez del código crudo; `/api/admin/vendors*` añaden `total`/`hasNext`/`hasPrev` sin quitar `totalCount`.

**Decisiones y descartes**
- **/about**: la foto de `AboutUsSection` lleva un alt honesto («Fotografía de archivo: dos profesionales revisan una tableta»): no se presenta como el equipo real. /about tiene su propio cierre (`AboutCloseSection`) en lugar de `CTAFinalSection`, que pintaba blanco sobre naranja (2.54:1).
- **/privacy y /terms** muestran «Provisional» y el aviso de que el texto definitivo está pendiente: así están hoy los dos textos (lista de decisiones del cliente en `docs/PLAN-OPUS-2026-09.md`, A.3). La maqueta vive ahora en `src/app/privacy/_documento` (`DocumentoLegal` + `ContactoLegal`, `documento.css`, prefijo `dl-`; `/terms` la importa de ahí).
- **No se aplicó** (decide INAKAT): el texto del modal de borrar precio («solo si no hay vacantes activas») no coincide con la API, que también bloquea con pausadas o en borrador; el campo «departamento» del registro de empresa se pide pero no se guarda (añadirlo exige migración); si `/applications` («Gestión de aplicaciones», sólo admin) merece un enlace en el menú o es una pantalla heredada.
- `/talents` y el resto de páginas públicas no están en el banco `/diseno/vista`: el banco monta el AppShell; una vista pública necesita su propio marco.

**Lo que salió mal**
- Nada bloqueante. Al integrar, un test que leía el archivo del ojo de la contraseña cambió de ruta (ahora vive en `ui/CampoContrasena`): se actualizó conservando su intención.

---

## 23/09/2026 — Parte A: 327 hallazgos más arreglados y en producción

**Qué cambió**
- 15 agentes en paralelo, uno por módulo con archivos disjuntos, más un integrador: 327 hallazgos arreglados, 277 saltados con motivo, 79 handoffs aplicados. 1778 tests pasan (117 suites; 57 nuevas). Deploy `inakat-501e4tsx1-izalith`.
- Verificado en producción: `/api/auth/me` sin sesión da 200 con `user: null` (antes 401 en la consola de cada visitante); `/api/admin/contact-messages` y `/api/applications/check` exigen sesión; las 2 vacantes confidenciales salen sin `userId` ni coordenadas.

**Decisiones y descartes**
- **El bloqueo a empresas no aprobadas se implementó pero se dejó APAGADO** (`ENFORCE_COMPANY_APPROVAL`). Afecta publicar, comprar créditos y ver candidatos; hay empresas operando sin aprobación formal y encenderlo las dejaría sin servicio. Antes de activarlo, aprobarlas en /admin/requests.
- **La validación de entorno del build avisa en vez de fallar** (`STRICT_ENV_CHECK=true` la endurece). Al activarla se descubrió que en Vercel faltan `MERCADOPAGO_WEBHOOK_SECRET`, `SMTP_USER` y `SMTP_PASS`: en producción **no sale ningún correo** y **el webhook de pagos responde 500**, así que los pagos OXXO/SPEI nunca se confirman solos. Tumbar el deploy habría bloqueado todos los arreglos.
- La CSP va en *Report-Only*: avisa, no bloquea. Pasarla a enforce requiere revisar la consola con Maps y MercadoPago.
- Migración `20260922000000` aditiva e idempotente, **no aplicada** (el build no migra). Sin columnas nuevas: una columna en el schema sin migrar haría fallar los SELECT con P2022.

**Lo que salió mal**
- El integrador falló la primera vez por límite de sesión y quedaron 19 tests rojos por choques entre agentes; al reanudar el workflow, los 15 agentes salieron de caché y sólo corrió el integrador.

---

## 22/09/2026 — Árbol verde y primera tanda de arreglos en producción

**Qué cambió**
- `main` vuelve a estar en verde y el CI con él. Dependencias: 26 vulnerabilidades → 8,
  ninguna crítica.
- Cuatro tandas de arreglos, cada una con sus tests y desplegada a producción: dinero
  (publicación de vacantes y créditos), pagos (comisiones, cobros, precios), privacidad
  (notas internas, confidenciales, oráculo) y flujos rotos (CV, registro de empresa,
  entrevistas). 1457 tests en verde, 62 nuevos.

**Por qué**
- Sin árbol verde no se puede validar ningún arreglo: el CI llevaba rojo desde el PR #6
  y cualquier PR nuevo nacía en rojo, así que dejaba de ser una señal.
- Lo demás salió de la auditoría, atacando primero lo que toca dinero y datos
  personales.

**Decisiones y descartes**
- **`creditCost > 0` NO sirve como prueba de que una vacante se pagó.** Fue lo primero
  que se probó para cerrar el rodeo draft → paused → active, y un test existente lo
  tumbó: las vacantes anteriores al cobro tienen 0 y su dueño se habría quedado sin
  poder reanudarlas. Se cerró por el otro lado: un borrador no sale de borrador salvo
  por `/api/jobs/publish`, que cobra.
- **Los campos que fijan el precio salen de la whitelist de PATCH** en vez de duplicar
  ahí la lógica de cobro. El formulario de edición usa PUT, que sí recalcula; PATCH lo
  usa la UI sólo para cambiar el estado, así que no se rompe ningún flujo real.
- **No se añadió una columna para `external_reference`.** MercadoPago ya guarda ese
  campo, así que basta con crear la compra antes de cobrar y mandar su id: se evita una
  migración sobre una base en producción.
- **`/api/vendor/*` abierto a cualquier usuario autenticado se dejó como está.** El
  middleware lo documenta como decisión deliberada («cualquier usuario registrado puede
  crear y gestionar su código»), los porcentajes son fijos en el servidor (10/10) y el
  auto-referido ya se cerró en junio: es un programa de referidos, no un agujero. Es un
  ejemplo de hallazgo de la auditoría que al verificarse resultó ser intencional.
- **El fallback de precios de la página de compra se eliminó en vez de corregirlo.**
  Enseñar un precio que puede no ser el que se cobra es peor que decir «no pudimos
  cargar los paquetes».

**Lo que salió mal**
- Dos aserciones de tests nuevos fallaron por dar positivo con el **comentario** que
  explicaba el arreglo, no con el código. Al escribir un test que comprueba ausencia,
  la aserción tiene que mirar la llamada (`fetch(...)`), no el texto suelto.
- Los parches por script con cadenas multilínea fallan en este repo porque los archivos
  tienen CRLF. Para eso, la herramienta de edición; los scripts, sólo para cambios de
  una línea o con separador detectado.

**Datos duros**
- Verificado en producción tras desplegar: `/api/applications/check` → 401;
  `/api/credit-packages` sirve los cuatro paquetes reales de la base; de 27 vacantes
  públicas, las 2 confidenciales salen con `userId`, `latitude` y `longitude` en null y
  ninguna incluye `notasInternas`.
- Commits: `4af863d` (CI), `c2e0fbc` (deps), `71988a7` (vacantes), `2f71964` (pagos),
  `95c0015` (privacidad), `40400b1` (flujos).

---

## 21/09/2026 — Rediseño de la portada en producción y auditoría de 483 hallazgos

**Qué cambió**
- La portada se rehízo entera con el concepto **«Arco»** (el isotipo es un punto y un
  arco) y se publicó en `www.inakat.com`. Detalle en `docs/HOME-REVAMP-2026-09.md`.
- Se documentó una auditoría de todo el proyecto: 614 hallazgos brutos → 483 tras
  fusionar duplicados.
- `SelectionProcessSection` ganó una prop `variant` (`'grid' | 'arc'`) para que la home
  y `/about` compartan una sola fuente de las 11 etapas.

**Por qué**
- La home anterior repetía el mismo patrón —título centrado + tarjetas blancas— en doce
  secciones, con dos colores de fondo alternándose y ningún título de sección por
  encima de 48 px. Un scroll de trece pantallas con dos composiciones se lee como papel
  pintado.
- La auditoría se pidió como diagnóstico previo a una tanda de arreglos, para poder
  repartir el trabajo sin volver a investigar cada defecto.

**Decisiones y descartes**
- **Sin librería de animación.** Todo el movimiento va con `animation-timeline` nativo
  y una hoja propia (`src/app/home.css`, prefijo `hm-`). Se descartó framer-motion
  —que ya está en el proyecto— porque obligaba a marcar cada sección como client
  component y no aporta nada que el CSS no haga aquí.
- **Se quitó el contador `useCountUp` de las cifras.** Ahora se pintan desde el
  servidor: se leen igual sin JavaScript y con movimiento reducido.
- **FAQ y especialidades pasaron a `<details>` nativos** en vez de acordeones con
  estado en React: teclado y funcionamiento sin JS salen gratis.
- **No se tocó ni una cifra ni un texto de la FAQ**, aunque la cobertura se contradice.
  Cambiar afirmaciones del cliente sobre su propia presencia no es decisión del
  desarrollo.

**Lo que salió mal, y cómo se arregló**
- 🚨 **La portada se quedaba en blanco al abrirla en una pestaña de fondo.** Se vio en
  el primer preview de Vercel: salían los arcos y nada más. En una pestaña que no está
  al frente el reloj de animación no avanza, y `animation-fill-mode: both` deja el
  título y la foto clavados en su fotograma inicial —que para una animación de entrada
  es «fuera de la máscara» u `opacity: 0`. Pasa con ctrl+click y al restaurar la sesión
  de pestañas. Arreglado poniendo la clase `.hm--js` sólo cuando
  `document.visibilityState === 'visible'`, y esperando a `visibilitychange` si no.
  Comprobado falseando `visibilityState` antes de cargar.
- 🚨 **`globals.css` declara `section { overflow: hidden }`**, lo que convierte cada
  `<section>` en contenedor de scroll y **mata todo `position: sticky` que viva
  dentro**. Costó una escena fijada que salía en blanco. `home.css` devuelve
  `overflow: visible` a las secciones que fijan algo.
- **El mapa de México se veía roto** y los pines estaban puestos a ojo. Los estados sin
  cobertura del PNG son `(224,224,208)` y el suelo de la sección `#e8e7d4`: **1.07:1 de
  contraste**, medio país invisible. Se re-tiñó sólo ese color a `(193,190,172)`
  (1.50:1). Para los pines se analizó el PNG por color: los tres estados que ya venían
  en naranja (CDMX, Jalisco, Nuevo León) sirvieron de ancla y de ahí salió la
  proyección del mapa, `x% = 56.9 + (lon + 99.13) × 3.46`,
  `y% = 74.9 − (lat − 19.43) × 5.90`. **Si se cambia la imagen del mapa hay que rehacer
  esas cuentas.**
- **La imagen del hero se veía borrosa.** Es 1920×1280 (horizontal) dentro de un arco
  vertical: `object-fit: cover` la ampliaba **1.73×**. No faltaba resolución, sobraba
  estiramiento. Se recortó en origen a retrato 4:5 (752×940) —dejando fuera la franja
  de rótulos quemados— y se quitó el `height: 140%`.
- **Error propio de medición:** al comprobar la nitidez, `naturalWidth` daba números
  que no existían en el `srcset` (374, 799) porque el navegador reutiliza variantes
  cacheadas entre recargas. Se resolvió descargando directamente los archivos que
  sirve producción: `w=750` → 750×938, `w=828` → la original, mapa `w=1920` → 1837×1263.
  **Para juzgar nitidez, medir el archivo servido, no lo que reporta el DOM.**

**Datos duros**
- Línea base medida antes de tocar nada, sobre `main` @ `2d5b4f2` tras `npm ci`
  (`node_modules/` estaba vacío): `tsc --noEmit` 0 errores · `npm run lint` 0 errores y
  202 avisos · `npx jest` **1 suite roja, 4 tests fallando** · `npm audit` **26
  vulnerabilidades (2 críticas, 17 altas, 5 moderadas, 2 bajas)**.
- Contrastes de la paleta usada en la home: tinta/arena 9.91:1 · blanco/tinta 12.38:1 ·
  blanco/teal 7.38:1 · tinta/lima 5.67:1 · tinta/naranja 4.87:1 · lima/teal 3.38:1
  (sólo en titulares). **Blanco sobre el naranja de marca da 2.54:1 y no pasa AA ni
  para texto grande**: afecta a los botones naranjas de toda la app, no sólo a la home.
- Para volver al sitio anterior al rediseño: `vercel rollback https://inakat-28tg0ux2w-izalith.vercel.app`.
  No hay migraciones de por medio, el cambio es sólo de frontend.
