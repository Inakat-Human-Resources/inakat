# Auditoría integral INAKAT — Junio 2026

Auditoría multi-agente por capas (base de datos → motor de negocio/cálculo →
validadores → API/endpoints → autenticación/autorización → UI/accesibilidad →
tests → arquitectura/infra), con **verificación adversarial** de cada hallazgo
(3 refutadores independientes por hallazgo; sólo sobreviven los confirmados por
≥2). De **110 hallazgos brutos, 92 sobrevivieron** la verificación; 18 se
descartaron por no resistir el refutado.

Remediación organizada en **4 fases**, una rama y un PR por fase (apilados):

| Fase | PR | Rama | Foco |
|------|----|------|------|
| 1 | #1 | `audit/fase-1-seguridad` | 🔒 Seguridad y cumplimiento |
| 2 | #2 | `audit/fase-2-fiabilidad` | 🛡️ Fiabilidad, correctness y árbol verde |
| 3 | #3 | `audit/fase-3-ci` | 🏗️ CI + ESLint |
| 4 | #4 | `audit/fase-4-ui` | ♿ UI/accesibilidad + CSS dinámico |

## Estado del árbol (con las 4 fases aplicadas)

| Check | Antes | Después |
|-------|-------|---------|
| `tsc --noEmit` | ❌ 432 errores | ✅ **0** |
| `npm run lint` | ❌ sin config (interactivo) | ✅ **0 errores** |
| `npm test` | ❌ 11 fallos / 2 suites | ✅ **1355 pasan / 7 skip** |
| CI | ❌ inexistente | ✅ `.github/workflows/ci.yml` bloqueante |

---

## Fase 1 — 🔒 Seguridad y cumplimiento

- **IDOR / fuga de datos (HIGH):** `GET /api/jobs` y `/api/jobs/publish` decidían
  la "vista de propietario" por el query param `?userId` sin autenticar →
  exponían `notasInternas` y de-anonimizaban vacantes confidenciales a cualquier
  visitante. Ahora gateado por sesión real (`getOptionalAuthUser`). **#14/#40, #15/#41**
- **IDOR cross-tenant** en evaluaciones (`skill-ratings`, `notes`) e
  `interview-requests`: autorizaban sólo por status/rol → lectura/escritura de
  aplicaciones ajenas (incl. PII de candidatos). Nuevo helper
  `src/lib/authz-applications.ts` (ownership/asignación). **#17/#42/#43, #18/#44/#46, #45/#47**
- **Creación/publicación de vacante sin auth ni cobro:** `POST /api/jobs(/publish)`
  permitía vacantes anónimas; `PATCH /api/jobs/[id]` activaba un borrador gratis.
  **#16/#49, #39**
- **Suplantación:** `POST /api/applications` confiaba en `body.userId`. **#48**
- **Stored XSS:** `fileUrl` de documentos sin validar esquema (se renderiza como
  `href`). Ahora exige `http(s)`. **#55**
- **Fuga de notas internas** a la empresa en el dashboard (`Candidate.notas`,
  notas de recruiter/specialist, `Job.notasInternas`, `Application.notes`). **#50/#51**
- **Pagos:** HMAC del webhook no constant-time (`timingSafeEqual`); auto-referido
  de código de descuento (vendor = comprador); rate-limit + fuga de nombre de
  vendor en validación; upload con validación de tipo por OR; errores crudos al
  cliente. **#34, #36, #37, #54, #58/#90/#91**
- **Auth:** enumeración de usuarios (mensaje "desactivado" antes de validar
  password); política de contraseña del reset; rate-limit en forgot/reset. **#24, #13/#25/#27, #21/#23**
- **Validación real** en `company-requests`/`contact` (los schemas zod existían
  pero no se usaban); regex de teléfono; escape HTML + anti-CRLF en emails;
  cabeceras de seguridad HTTP en `next.config`. **#9/#52, #10/#57, #11, #12/#67/#68, #86**

## Fase 2 — 🛡️ Fiabilidad, correctness y árbol verde

- **tsc 432 → 0** (todos en tests): tipos de `@testing-library/jest-dom`;
  `export {}` en 23 tests que eran scripts globales; regex `/s`; self-reference
  del mock del smoke; anotaciones en literales parciales. **#73, #74, #83**
- **jest 100% verde:** tests de integración contra DB real gateados
  (`describe.skip` salvo `RUN_INTEGRATION_TESTS`/`npm run test:integration`);
  script `test:unit` roto (`--ignore` inexistente) corregido. **#71/#72, #82/#87**
- **Webhook MercadoPago idempotente** bajo concurrencia (reclamo atómico vía
  `updateMany` condicional → no doble acreditación) + notificación/email con
  `await`+`Promise.allSettled` (entrega garantizada en serverless). **#7, #35, #70**
- **Publicación de vacante atómica** (créditos + creación + ledger en una sola
  transacción). **#6**
- `JSON.parse` tolerante por fila en `company/interviews` (un dato corrupto ya no
  tumba el listado). **#53**
- Cotas `[0,100]` en descuento/comisión (0% ya no se vuelve 10%; sin precio
  negativo). **#8/#29**
- Validación de enum/fechas en `PATCH admin/interviews/[id]`. **#33**

## Fase 3 — 🏗️ CI + ESLint

- **`eslint.config.mjs`** (ESLint 9 flat config con `next/core-web-vitals` +
  `next/typescript`). Antes NO existía config → `next lint` era interactivo. Deuda
  preexistente en `warn`; resto en `error` → `npm run lint` = **0 errores**.
- 2 errores `react/no-unescaped-entities` corregidos.
- **`.github/workflows/ci.yml`**: `tsc --noEmit` + `npm run lint` + `npm test`
  bloqueantes en push a `main` y cada PR.

## Fase 4 — ♿ UI/accesibilidad + CSS dinámico

- Capa **global** de micro-interacciones en `globals.css` (afecta toda la app):
  transiciones suaves en `a/button/[role=button]`, foco visible accesible,
  feedback de "press", utilidades (`.hover-lift`, `.cta-glow`, `.fade-in`,
  `.skeleton`, `.link-underline`) y `@media (prefers-reduced-motion: reduce)`.
- A11y del audit: FAQ con `aria-expanded`/`aria-controls`/`aria-hidden` **#66**;
  tarjetas de vacante operables por teclado **#63**; botón BUSCAR funcional **#64**;
  modal de aplicación con Escape + `role=dialog`/`aria-modal`/`aria-label` **#59/#60**.
- `StatCard` (todos los dashboards) con elevación y micro-zoom.

---

## ⏳ Acciones manuales pendientes (requieren decisión de negocio, datos reales o acceso a producción)

> No se ejecutaron por la regla de no tocar nada que requiera datos reales,
> migraciones destructivas, rotación de secretos o cifras legales/regulatorias a
> ciegas.

1. **Invalidación de sesiones JWT tras reset de contraseña (#20/#26).** Requiere
   columna en DB (`passwordChangedAt`/`tokenVersion`) y validarla en
   `verifyToken`/`requireAuth`. Implica migración de esquema.
2. **Content-Security-Policy estricta (#86).** Se añadieron las cabeceras seguras
   (X-Frame-Options, HSTS, etc.) pero la CSP estricta debe probarse en staging
   con Google Maps y el SDK de Mercado Pago antes de activarla.
3. **Almacenamiento de CV/documentos (#56).** Hoy se guardan en URLs públicas
   permanentes (PII). Decidir almacenamiento con acceso restringido (signed URLs).
4. **Reembolsos/contracargos del webhook (#38).** Los créditos se conservan tras
   refund/chargeback; definir el proceso de negocio.
5. **Visibilidad de notas a la empresa (#51).** Decidir qué notas de evaluación
   (sólo `isPublic`?) debe ver la empresa en el dashboard.
6. **Auditoría de comisiones pagadas (#32).** Registrar actor/admin y validar
   `paymentProofUrl` al marcar una comisión como pagada.
7. **Rate limiter distribuido (#89).** El actual es en memoria por instancia
   serverless; para enforcement real, aprovisionar Redis/Upstash.
8. **Baseline de migraciones Prisma (#1) y deuda de modelado (#2/#3/#4).** El
   historial de migraciones está desincronizado (~15 tablas sin migración formal,
   aplicadas a prod con `db push`). Generar la migración baseline con
   `prisma migrate diff` es automatizable, pero marcarla como aplicada en
   **producción** (`migrate resolve --applied`) es acción manual. Igualmente, pasar
   `role`/`status` a enums, añadir FKs al ledger y reemplazar listas CSV por
   relaciones requiere migraciones revisadas.
9. **A11y restante de Fase 4 (no bloqueante):** labels asociados a inputs
   (#61/#62), nombre accesible de las estrellas de calificación (#65), y aplicar
   las utilidades de elevación/entrada a más componentes por página.
10. **Menores diferidos:** branch muerto en `credit-packages` por el middleware
    (#28); módulo central de validación de variables de entorno (#88).

## Hallazgos descartados

18 de los 110 hallazgos brutos **no sobrevivieron** la verificación adversarial
(≥2 de 3 refutadores los tumbaron) y no se actuó sobre ellos, evitando falsos
positivos plausibles.

## Cómo correr los checks localmente

```bash
npx tsc --noEmit          # type-check (0 errores)
npm run lint              # ESLint (0 errores)
npm test                  # jest unit/integration mockeado (1355 pasan, 7 skip)
npm run test:integration  # tests contra DB real (requiere DATABASE_URL alcanzable)
```
