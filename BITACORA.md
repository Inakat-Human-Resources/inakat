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
- **La portada rediseñada está en producción** y verificada en vivo: `/`, `/about`,
  `/companies`, `/talents`, `/login`, `/contact` y `/api/jobs` responden 200.
  Despliegue en vivo: `inakat-hk9vyq8wj-izalith`.
- La home aguanta las condiciones que rompen este tipo de páginas: cinco anchos sin
  desbordes, `prefers-reduced-motion` con 0 animaciones corriendo, y **legible sin
  JavaScript** (91 elementos clave visibles).
- **215 tests de QA en verde** (`__tests__/qa/`), 19 de ellos nuevos y específicos del
  rediseño.
- **La auditoría integral está documentada**: 483 hallazgos en 166 archivos
  (1 crítico, 51 altos, 189 medios, 242 bajos) en `docs/AUDITORIA-2026-09.md` y
  `docs/auditoria-2026-09/`.

**A medias**
- **La auditoría no tiene ni un hallazgo corregido.** Es diagnóstico, no arreglo.
  El plan por fases está en `docs/AUDITORIA-2026-09.md`.
- **La verificación adversarial automática de la auditoría nunca corrió** (se agotó el
  límite de gasto del modelo a mitad). Se verificaron a mano los 31 hallazgos más
  graves —los 31 ciertos— y el resto quedó marcado como «sin verificar». Falta también
  la cobertura de 4 barridos transversales que fallaron: integridad de datos, frontend,
  validación de entrada y accesibilidad.

**Bloqueado**
- **`main` está en rojo desde el PR #6 (antes de este trabajo).** Cuatro tests de
  `__tests__/api/auth-reset-password.test.ts:216` exigen
  `prisma/migrations/_archived/20260514_reset_token.sql`, que ese PR movió a
  `prisma/archived-sql/`. Como `ci.yml` corre `npm test` de forma bloqueante, falla en
  `main` y en todo PR nuevo. No depende de nadie externo: es media hora de trabajo.
- **Tres decisiones esperan a INAKAT** (desde el 21/09/2026):
  1. La foto del hero es generada por IA. Ya no se presenta como el equipo real, pero
     está publicada; hace falta una fotografía de verdad.
  2. Las cifras de la portada (100 %, 150+ especialistas, 15+ estados, 11 etapas) no
     son verificables desde el código.
  3. La cobertura se contradice sola: la FAQ dice «Monterrey, Morelia, CDMX, Puebla y
     Guadalajara»; el mapa y los chips dicen CDMX, Monterrey, Guadalajara, Puebla,
     Querétaro, León y Mérida.

**Siguiente paso**
- Arreglar lo roto empezando por el árbol verde (CI + `npm audit`), y de ahí seguir el
  plan por fases de la auditoría: dinero y permisos, fuga de datos personales, flujos
  rotos de cara al usuario.

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
