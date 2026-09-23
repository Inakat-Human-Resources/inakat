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

## 📸 ESTADO AL 22/09/2026

*(Esta sección se reescribe completa en cada actualización.)*

**Hecho y funcionando**
- **La portada rediseñada está en producción** y verificada en vivo. Aguanta las
  condiciones que rompen este tipo de páginas: cinco anchos sin desbordes,
  `prefers-reduced-motion` con 0 animaciones corriendo, y **legible sin JavaScript**.
- **El árbol está verde otra vez**: `tsc` 0 · `npm run lint` 0 errores · **1457 tests
  pasan** · `next build` OK · **CI en verde en `main`** desde `c2e0fbc`.
- **Dependencias: de 26 vulnerabilidades a 8**, ninguna crítica (next 15.5.10 → 15.5.25,
  prisma 6.6 → 6.19, nodemailer 8 → 10).
- **Arreglado y desplegado, con test cada uno** (despliegue `inakat-kbmoiljye-izalith`):
  cuatro formas de publicar vacantes sin pagar; dos carreras de créditos; comisiones de
  ventas nunca cobradas contadas como ingresos; cargos de tarjeta que podían quedarse
  sin registro; doble acreditación de créditos; precios de compra que podían no ser los
  cobrados; cinco fugas de notas internas hacia la empresa y el integrador; el oráculo
  público de postulaciones; la des-anonimización de vacantes confidenciales; el XSS
  almacenado contra el admin (`javascript:` en URLs del registro); subir y borrar el CV;
  el registro de empresa con el sitio web vacío; y las entrevistas, que siempre decían
  «Error al guardar» y guardaban 1970 como fecha.
- **Comprobado en producción, no sólo en el código:** `/api/applications/check` responde
  401, `/api/credit-packages` sirve los paquetes reales, y de las 27 vacantes públicas
  las 2 confidenciales salen sin `userId` ni coordenadas y ninguna trae `notasInternas`.
- **La auditoría integral está documentada**: 483 hallazgos en 166 archivos
  (1 crítico, 51 altos, 189 medios, 242 bajos) en `docs/AUDITORIA-2026-09.md` y
  `docs/auditoria-2026-09/`.

**A medias**
- **Quedan hallazgos de la auditoría sin tocar**, entre ellos varios altos ya
  verificados: listas topadas a 20/30 registros en seis pantallas (los registros 21+
  son inalcanzables), desactivar un usuario no le corta el acceso hasta que caduque su
  JWT, el login exige 8 caracteres pero el admin puede crear cuentas con 6, y los
  mensajes del formulario de contacto se guardan sin que nadie los lea ni reciba aviso.
- **La verificación adversarial automática de la auditoría nunca corrió** (se agotó el
  límite de gasto del modelo a mitad). Se verificaron a mano los 31 hallazgos más
  graves —los 31 ciertos— y el resto quedó marcado como «sin verificar». Falta también
  la cobertura de 4 barridos transversales que fallaron: integridad de datos, frontend,
  validación de entrada y accesibilidad.

**Bloqueado**
- **Tres decisiones esperan a INAKAT** (desde el 21/09/2026):
  1. La foto del hero es generada por IA. Ya no se presenta como el equipo real, pero
     está publicada; hace falta una fotografía de verdad.
  2. Las cifras de la portada (100 %, 150+ especialistas, 15+ estados, 11 etapas) no
     son verificables desde el código.
  3. La cobertura se contradice sola: la FAQ dice «Monterrey, Morelia, CDMX, Puebla y
     Guadalajara»; el mapa y los chips dicen CDMX, Monterrey, Guadalajara, Puebla,
     Querétaro, León y Mérida.

**Siguiente paso**
- **Memo:** dar de alta en Vercel `MERCADOPAGO_WEBHOOK_SECRET`, `SMTP_USER` y `SMTP_PASS` (sin ellas no hay correos ni confirmación de pagos asíncronos). Después, Parte B del plan: sistema de diseño y rediseño de las 40 páginas.

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
