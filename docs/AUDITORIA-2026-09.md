# Auditoría INAKAT — septiembre 2026

Encargo: *«una mega revisada a Inakat, encontrar cualquier posible error a arreglar, en todos los módulos y todas las páginas»*.
Este documento es el **parte de trabajo para Opus 5**: cada ficha se basta sola (archivo, línea, evidencia, escenario y arreglo) para poder repartirlas entre ramas sin volver a investigar.

**Fuera de alcance deliberado:** `src/app/page.tsx` y `src/components/sections/home/**` — la portada se rediseñó en paralelo en la rama `feat/home-revamp` y sus hallazgos ya están corregidos ahí (ver `docs/HOME-REVAMP-2026-09.md`).

## Cómo se produjo (y qué fiabilidad tiene)

- **22 auditores en paralelo** (16 por módulo + 6 barridos transversales) leyeron los 176 archivos de `src/` más `prisma/`, `scripts/`, config y docs. **614 hallazgos brutos → 483 tras fusionar duplicados** (93 los reportó más de un auditor de forma independiente).
- ⚠️ **La verificación adversarial automática no llegó a correr**: se agotó el límite de gasto del modelo a mitad del proceso. En su lugar **verifiqué a mano contra el código los 31 hallazgos más graves**; los 31 resultaron ciertos, sin un solo falso positivo, lo que da buena señal sobre el resto del lote — pero no lo demuestra.
- Por eso cada ficha lleva **Verificación: ✅ verificada** o **sin verificar**. Las «sin verificar» son puntos de partida fiables pero **hay que comprobarlas antes de tocar código**; espera un porcentaje de falsos positivos entre las de severidad baja.
- Los 4 barridos transversales que fallaron (integridad de datos, frontend, validación de entrada y accesibilidad) **no se reemplazaron**: esas lentes están cubiertas sólo por lo que vieron los auditores de módulo. Queda cobertura por recoger ahí.

## Resumen

| Severidad | Cuántos | Qué significa |
|---|---|---|
| 🔴 critical | 1 | compromiso de cuentas, dinero o datos de todos |
| 🟠 high | 51 | fuga de datos personales, salto de permisos, pérdida de datos o flujo principal roto |
| 🟡 medium | 189 | bug funcional acotado, UX rota, validación ausente con impacto |
| ⚪ low | 242 | pulido, accesibilidad menor, deuda técnica |
| **Total** | **483** | en 166 archivos |

## Estado del árbol al empezar (medido el 2026-09-21 sobre `main` @ 2d5b4f2, tras `npm ci`)

| Check | Resultado |
|---|---|
| `npx tsc --noEmit` | ✅ 0 errores |
| `npm run lint` | ✅ 0 errores · ⚠️ 202 warnings |
| `npx jest` | ❌ **1 suite roja, 4 tests fallan** (1351 pasan, 7 skip) |
| `npm audit` | ❌ **26 vulnerabilidades: 2 critical, 17 high, 5 moderate, 2 low** |

> `node_modules/` estaba **vacío** al empezar: nadie había instalado dependencias en este checkout. Antes de tocar nada, `npm ci`.

### BASE-01 — 🟠 `main` está en rojo: 4 tests apuntan a un SQL que se borró

`__tests__/api/auth-reset-password.test.ts:216` exige `prisma/migrations/_archived/20260514_reset_token.sql`, pero el commit `de565fd` («saca los SQL archivados de prisma/migrations», PR #6) eliminó esa carpeta. Como `.github/workflows/ci.yml` corre `npm test` de forma bloqueante, **CI está rojo en main y en todo PR nuevo**.
**Arreglo:** sustituir ese `describe` por aserciones contra `prisma/schema.prisma` (que `resetToken` exista, sea `@unique`, y que exista `resetTokenExpiry`), que es lo que el test quería garantizar de verdad. Hazlo **antes que nada**: sin árbol verde no se puede validar ningún otro arreglo.

### BASE-02 — 🟠 26 vulnerabilidades en dependencias

Directas: **`next` (critical)**, `prisma` (high), `postcss` (high), `nodemailer` (high, el parche es major → 10.x). Transitivas high/critical: `handlebars` (critical), `@prisma/config`, `brace-expansion`, `browserslist`, `deepmerge-ts`, `defu`, `effect`, `flatted`, `js-yaml`, `minimatch`, `nanoid`, `picomatch`, `sharp`, `undici`, `ws`.
**Arreglo:** `npm audit fix` (sin `--force`) en rama propia; subir `next` al último parche 15.5.x y alinear `eslint-config-next` (hoy 15.5.5 contra `next ^15.5.7`). `nodemailer` 10 va aparte porque rompe API. Después: `tsc` + `lint` + `jest` + `next build`.

## Plan de trabajo sugerido (una rama y un PR por fase)

| Fase | Foco | Qué incluye |
|---|---|---|
| **0** | Árbol verde | BASE-01, BASE-02 |
| **1** | 🔴🟠 Dinero y permisos | publicación gratis de vacantes, atomicidad de créditos, comisiones de compras no pagadas, `/api/vendor/*` sin rol, paquetes de crédito con precios falsos |
| **2** | 🟠 Fuga de datos personales | notas internas que llegan a la empresa y al integrador, oráculo público de postulaciones, de-anonimización de vacantes confidenciales |
| **3** | 🟠 Flujos rotos de cara al usuario | subir/borrar CV, registro de empresa, guardado de entrevistas, listas topadas a 20/30 registros |
| **4** | 🟡 Correctness y validación | el grueso de los medium |
| **5** | ⚪ Pulido, accesibilidad y deuda | los low |

**Reglas para quien ejecute:**
1. Lee la ficha, **abre el archivo y confirma que el defecto sigue ahí** antes de tocar nada (las líneas pueden haberse movido; las «sin verificar» pueden ser falsos positivos).
2. Reutiliza los helpers que ya existen: `src/lib/auth.ts`, `src/lib/authz-applications.ts`, `src/lib/validations.ts`, `src/lib/sanitize.ts`, `src/lib/pagination.ts`, `src/lib/pricing.ts`.
3. Cada arreglo de severidad alta o crítica va con su test en `__tests__/`.
4. `npx tsc --noEmit` + `npm run lint` + `npx jest` verdes antes de cada PR.
5. Nada de migraciones destructivas ni rotación de secretos a ciegas: eso va a la lista de decisiones del final.

---

## Los módulos

| Módulo | Hallazgos | 🔴 | 🟠 | 🟡 | ⚪ |
|---|---|---|---|---|---|
| [Autenticación, sesión y middleware](auditoria-2026-09/auth.md) | 25 | · | 4 | 10 | 11 |
| [Páginas de acceso y registro](auditoria-2026-09/authui.md) | 29 | · | · | 8 | 21 |
| [Créditos, pagos, precios, descuentos y vendedores](auditoria-2026-09/pago.md) | 51 | · | 6 | 21 | 24 |
| [Vacantes, publicación y postulaciones](auditoria-2026-09/vac.md) | 54 | · | 10 | 23 | 21 |
| [Módulo empresa](auditoria-2026-09/emp.md) | 39 | · | 8 | 14 | 17 |
| [Perfil de candidato y archivos](auditoria-2026-09/perf.md) | 37 | · | 1 | 16 | 20 |
| [Reclutador, especialista y evaluaciones](auditoria-2026-09/eval.md) | 27 | · | 2 | 14 | 11 |
| [Panel y API de administración](auditoria-2026-09/adm.md) | 100 | · | 9 | 43 | 48 |
| [Integración Worky2, notificaciones, correo y librerías](auditoria-2026-09/plat.md) | 34 | 1 | 6 | 6 | 21 |
| [Base de datos, migraciones y scripts](auditoria-2026-09/db.md) | 24 | · | 2 | 13 | 9 |
| [Shell público, navegación, legales y SEO](auditoria-2026-09/ui.md) | 29 | · | 1 | 6 | 22 |
| [Configuración, CI, dependencias, tests y documentación](auditoria-2026-09/infra.md) | 34 | · | 2 | 15 | 17 |

## Los 52 prioritarios (🔴 + 🟠)

| ID | Sev | Qué falla | Dónde | Verificado |
|---|---|---|---|---|
| [PLAT-001](auditoria-2026-09/plat.md#plat-001--xss-almacenado-sin-autenticacion-que-permite-tomar-control-del-admin-urls-javascript-en-la-solicitud-de-empresa-se-abren-con-windowopen) | 🔴 | XSS almacenado sin autenticacion que permite tomar control del admin: URLs javascript: en la sol | `lib/validations.ts:32` | ✅ |
| [ADM-001](auditoria-2026-09/adm.md#adm-001--seis-pantallas-consumen-apis-paginadas-sin-ui-de-paginacion-los-registros-2131-son-inalcanzables) | 🟠 | Seis pantallas consumen APIs paginadas sin UI de paginacion: los registros 21+/31+ son inalcanza | `admin/assign-candidates/page.tsx:268` | — |
| [ADM-002](auditoria-2026-09/adm.md#adm-002--el-panel-de-entrevistas-solo-carga-las-20-solicitudes-mas-recientes-las-pendientes-antiguas-desaparecen-y-los-contadores-son-falsos) | 🟠 | El panel de entrevistas solo carga las 20 solicitudes mas recientes; las pendientes antiguas des | `admin/interviews/page.tsx:100` | — |
| [ADM-003](auditoria-2026-09/adm.md#adm-003--dashboard-admin-estadisticas-falsas-y-topadas-2030-por-usar-length-sobre-respuestas-paginadas-y-descarga-todas-las-aplicaciones-solo-para-contarlas) | 🟠 | Dashboard admin: estadisticas falsas y topadas (20/30) por usar .length sobre respuestas paginad | `admin/page.tsx:145` | — |
| [ADM-004](auditoria-2026-09/adm.md#adm-004--la-api-de-candidatos-pagina-a-30-y-ninguna-pantalla-consumidora-pagina-el-banco-de-candidatos-el-dashboard-y-asignar-candidatos-solo-ven-los-30-mas-recientes) | 🟠 | La API de candidatos pagina a 30 y ninguna pantalla consumidora pagina: el Banco de Candidatos,  | `api/admin/candidates/route.ts:113` | — |
| [ADM-005](auditoria-2026-09/adm.md#adm-005--candidateform-no-persiste-cartapresentacion-ni-al-crear-ni-al-editar) | 🟠 | CandidateForm no persiste cartaPresentacion (ni al crear ni al editar) | `api/admin/candidates/route.ts:182` | — |
| [ADM-006](auditoria-2026-09/adm.md#adm-006--la-pagina-de-compra-nunca-recibe-los-paquetes-del-admin-403-del-middleware-muestra-precios-hardcodeados-distintos-a-los-que-el-servidor-cobra) | 🟠 | La pagina de compra nunca recibe los paquetes del admin (403 del middleware): muestra precios ha | `api/admin/credit-packages/route.ts:17` | ✅ |
| [ADM-007](auditoria-2026-09/adm.md#adm-007--cancelar-solicitud-sobre-una-pendiente-sin-fechas-siempre-da-400-null-se-parsea-como-19700101) | 🟠 | "Cancelar solicitud" sobre una pendiente sin fechas siempre da 400: `null` se parsea como 1970-0 | `api/admin/interviews/[id]/route.ts:126` | ✅ |
| [ADM-008](auditoria-2026-09/adm.md#adm-008--patch-de-entrevistas-responde-interview-sin-success-la-ui-siempre-muestra-error-al-guardar-aunque-el-cambio-si-se-guardo) | 🟠 | PATCH de entrevistas responde `{ interview }` sin `success`: la UI siempre muestra "Error al gua | `api/admin/interviews/[id]/route.ts:196` | ✅ |
| [ADM-009](auditoria-2026-09/adm.md#adm-009--desactivar-o-degradar-un-usuario-desde-apiadminusers-no-revoca-su-acceso-en-rutas-que-solo-confian-en-los-headers-del-middleware-jwt-valido-7-dias) | 🟠 | Desactivar o degradar un usuario desde /api/admin/users no revoca su acceso en rutas que solo co | `api/admin/users/route.ts:354` | — |
| [AUTH-001](auditoria-2026-09/auth.md#auth-001--registro-sin-verificacion-de-email-emailverified-falso-autologin-permite-apropiarse-del-correo-de-otra-persona-y-leer-sus-postulaciones) | 🟠 | Registro sin verificacion de email (emailVerified falso + auto-login) permite apropiarse del cor | `api/auth/register/route.ts:209` | — |
| [AUTH-002](auditoria-2026-09/auth.md#auth-002--desactivar-un-usuario-o-cambiarle-el-rol-no-corta-su-acceso-el-middleware-y-20-rutas-confian-en-el-jwt-sin-consultar-la-db) | 🟠 | Desactivar un usuario o cambiarle el rol no corta su acceso: el middleware y ~20 rutas confian e | `middleware.ts:56` | ✅ |
| [AUTH-003](auditoria-2026-09/auth.md#auth-003--la-pagina-de-compra-de-creditos-pide-los-paquetes-a-apiadmin-y-el-middleware-se-lo-bloquea-a-las-empresas-se-muestran-precios-hardcodeados-y-se-cobra-el-precio-de-la-db) | 🟠 | La pagina de compra de creditos pide los paquetes a /api/admin/* y el middleware se lo bloquea a | `middleware.ts:84` | ✅ |
| [AUTH-004](auditoria-2026-09/auth.md#auth-004--apivendor-abierto-a-cualquier-usuario-autenticado-una-cuenta-gratuita-crea-su-propio-codigo-1010-y-anula-el-anti-autoreferido-34) | 🟠 | /api/vendor/* abierto a cualquier usuario autenticado: una cuenta gratuita crea su propio codigo | `middleware.ts:232` | ✅ |
| [DB-001](auditoria-2026-09/db.md#db-001--historial-de-migraciones-incompleto-y-ahora-con-una-migracion-nueva-encima-migrate-deploydevreset-documentados-rompen-entornos-nuevos-o-pueden-resetear-la-bd) | 🟠 | Historial de migraciones incompleto y ahora con una migracion nueva encima: migrate deploy/dev/r | `prisma/migrations/20260713000000_add_worky2_integration_tables/migration.sql:1` | — |
| [DB-002](auditoria-2026-09/db.md#db-002--seed-crea-cuentas-reales-del-staff-con-una-sola-contrasena-compartida-acepta-los-placeholders-de-envexample-y-las-contrasenas-por-defecto-siguen-documentadas-en-readme-e-historial-git) | 🟠 | Seed crea cuentas reales del staff con una sola contrasena compartida, acepta los placeholders d | `prisma/seed.ts:2280` | — |
| [EMP-001](auditoria-2026-09/emp.md#emp-001--xss-almacenado-contra-el-admin-desde-el-registro-publico-identificacionurldocumentosconstitucionurl-aceptan-javascript-y-se-abren-con-windowopen) | 🟠 | XSS almacenado contra el admin desde el registro publico: identificacionUrl/documentosConstituci | `api/company-requests/route.ts:104` | — |
| [EMP-002](auditoria-2026-09/emp.md#emp-002--el-rol-company-se-autoasigna-por-un-endpoint-publico-y-la-aprobacionrechazo-del-admin-no-se-aplica-en-ninguna-ruta) | 🟠 | El rol 'company' se autoasigna por un endpoint publico y la aprobacion/rechazo del admin no se a | `api/company-requests/route.ts:112` | — |
| [EMP-003](auditoria-2026-09/emp.md#emp-003--notas-internas-siguen-filtrandose-a-la-empresa-en-4-rutas-el-fix-5051-solo-se-aplico-a-una-parte-de-companydashboard) | 🟠 | Notas internas siguen filtrandose a la empresa en 4 rutas (el fix #50/#51 solo se aplico a una p | `api/company/applications/[id]/route.ts:340` | ✅ |
| [EMP-004](auditoria-2026-09/emp.md#emp-004--el-dashboard-sigue-filtrando-applicationnotes-dentro-de-alljobsapplications) | 🟠 | El dashboard sigue filtrando Application.notes dentro de allJobs[].applications[] | `api/company/dashboard/route.ts:288` | ✅ |
| [EMP-005](auditoria-2026-09/emp.md#emp-005--la-empresa-puede-obtener-nombre-email-y-telefono-de-postulantes-que-inakat-aun-no-le-ha-enviado-solicitando-entrevista-por-applicationid) | 🟠 | La empresa puede obtener nombre, email y telefono de postulantes que INAKAT aun no le ha enviado | `api/company/interview-requests/route.ts:57` | — |
| [EMP-006](auditoria-2026-09/emp.md#emp-006--las-notas-internas-solo-admin-de-la-entrevista-se-entregan-a-la-empresa-en-las-apis-de-company) | 🟠 | Las "Notas internas (solo admin)" de la entrevista se entregan a la empresa en las APIs de compa | `api/company/interviews/route.ts:65` | ✅ |
| [EMP-007](auditoria-2026-09/emp.md#emp-007--fuga-de-notas-internas-a-la-empresa-apicompanyjobsjobidcandidates-sigue-enviando-applicationnotes-y-candidatenotas-y-el-modal-las-pinta-sin-filtrar-por-rol) | 🟠 | Fuga de notas internas a la empresa: /api/company/jobs/[jobId]/candidates sigue enviando Applica | `api/company/jobs/[jobId]/candidates/route.ts:147` | ✅ |
| [EMP-008](auditoria-2026-09/emp.md#emp-008--el-registro-de-empresa-falla-con-400-datos-invalidos-cuando-el-sitio-web-se-deja-vacio-el-form-envia-null-y-zod-no-lo-acepta) | 🟠 | El registro de empresa falla con 400 'Datos invalidos' cuando el sitio web se deja vacio (el for | `components/sections/companies/FormRegisterForQuotationSection.tsx:425` | — |
| [EVAL-001](auditoria-2026-09/eval.md#eval-001--rama-discardapplicationid-de-los-put-de-reclutador-y-especialista-descarta-postulaciones-en-cualquier-estado-salta-la-maquina-de-estados) | 🟠 | Rama discardApplicationId de los PUT de reclutador y especialista descarta postulaciones en CUAL | `api/recruiter/dashboard/route.ts:408` | — |
| [EVAL-002](auditoria-2026-09/eval.md#eval-002--put-apirecruiterdashboard-con-candidateids-crea-postulaciones-para-cualquier-candidato-del-banco-cosecha-de-pii-y-regresa-a-senttospecialist-postulaciones-en-estados-avanzados) | 🟠 | PUT /api/recruiter/dashboard con candidateIds: crea postulaciones para cualquier candidato del b | `api/recruiter/dashboard/route.ts:530` | — |
| [INFRA-001](auditoria-2026-09/infra.md#infra-001--contrasenas-de-admin-y-de-todos-los-roles-seed-publicadas-en-documentacion-versionada) | 🟠 | Contrasenas de admin y de todos los roles seed publicadas en documentacion versionada | `README.md:164` | — |
| [INFRA-002](auditoria-2026-09/infra.md#infra-002--secretos-reales-siguen-en-el-historial-git-y-la-rotacion-figura-sin-completar-tokenstorotatemd-esta-trackeado-pese-a-gitignore) | 🟠 | Secretos reales siguen en el historial git y la rotacion figura sin completar; TOKENS_TO_ROTATE. | `TOKENS_TO_ROTATE.md:10` | — |
| [PAGO-001](auditoria-2026-09/pago.md#pago-001--comisiones-de-compras-no-pagadas-rechazadaspendientesfallidas-aparecen-como-pagables-y-se-suman-a-ventas-e-ingresos) | 🟠 | Comisiones de compras NO pagadas (rechazadas/pendientes/fallidas) aparecen como pagables y se su | `api/admin/vendors/commissions/route.ts:44` | ✅ |
| [PAGO-002](auditoria-2026-09/pago.md#pago-002--se-cobra-en-mercadopago-antes-de-registrar-la-compra-cualquier-fallo-posterior-deja-cargo-sin-registro-ni-creditos) | 🟠 | Se cobra en MercadoPago ANTES de registrar la compra: cualquier fallo posterior deja cargo sin r | `api/credits/purchases/route.ts:170` | ✅ |
| [PAGO-003](auditoria-2026-09/pago.md#pago-003--discountcodeuse-comision-del-vendor-se-crea-antes-de-que-el-pago-se-apruebe-y-ninguna-consulta-de-comisiones-filtra-por-estado-del-pago) | 🟠 | DiscountCodeUse (comision del vendor) se crea antes de que el pago se apruebe y ninguna consulta | `api/credits/purchases/route.ts:192` | ✅ |
| [PAGO-004](auditoria-2026-09/pago.md#pago-004--compra-de-creditos-el-camino-sincrono-approved-no-usa-el-reclamo-atomico-del-webhook-posible-doble-acreditacion) | 🟠 | Compra de creditos: el camino sincrono 'approved' no usa el reclamo atomico del webhook -> posib | `api/credits/purchases/route.ts:217` | ✅ |
| [PAGO-005](auditoria-2026-09/pago.md#pago-005--cualquier-usuario-autenticado-p-ej-un-candidato-autoregistrado-puede-crear-un-codigo-1010-el-bloqueo-de-autoreferido-34-se-evade-con-una-segunda-cuenta) | 🟠 | Cualquier usuario autenticado (p. ej. un candidato auto-registrado) puede crear un codigo 10%/10 | `api/vendor/my-code/route.ts:72` | ✅ |
| [PAGO-006](auditoria-2026-09/pago.md#pago-006--la-pagina-de-compra-recibe-403-del-middleware-al-pedir-los-paquetes-y-cae-a-precios-hardcodeados-que-pueden-diferir-del-monto-realmente-cobrado) | 🟠 | La pagina de compra recibe 403 del middleware al pedir los paquetes y cae a precios hardcodeados | `credits/purchase/page.tsx:68` | ✅ |
| [PERF-001](auditoria-2026-09/perf.md#perf-001--subir-reemplazar-y-eliminar-cv-desde-profile-esta-roto-la-ui-llama-a-apiprofiledocuments-con-un-contrato-que-la-api-no-implementa) | 🟠 | Subir, reemplazar y eliminar CV desde /profile esta roto: la UI llama a /api/profile/documents c | `profile/page.tsx:524` | ✅ |
| [PLAT-002](auditoria-2026-09/plat.md#plat-002--los-mensajes-del-formulario-de-contacto-se-guardan-pero-nadie-puede-leerlos-ni-es-avisado) | 🟠 | Los mensajes del formulario de contacto se guardan pero nadie puede leerlos ni es avisado | `api/contact/route.ts:31` | ✅ |
| [PLAT-003](auditoria-2026-09/plat.md#plat-003--la-api-key-de-integracion-sigue-funcionando-aunque-la-empresa-duena-este-desactivada-bypass-del-softdelete-de-usuarios) | 🟠 | La API key de integracion sigue funcionando aunque la empresa duena este desactivada (bypass del | `lib/integration-auth.ts:153` | — |
| [PLAT-004](auditoria-2026-09/plat.md#plat-004--la-integracion-exporta-applicationnotes-notas-internas-al-integrador-reabriendo-la-fuga-5051) | 🟠 | La integracion exporta `Application.notes` (notas internas) al integrador, reabriendo la fuga #5 | `lib/integration-candidate.ts:197` | ✅ |
| [PLAT-005](auditoria-2026-09/plat.md#plat-005--el-login-exige-contrasena-de-8-caracteres-pero-el-admin-crea-usuarios-con-67-esas-cuentas-nunca-pueden-iniciar-sesion) | 🟠 | El login exige contraseña de 8+ caracteres, pero el admin crea usuarios con 6-7: esas cuentas nu | `lib/validations.ts:11` | ✅ |
| [PLAT-006](auditoria-2026-09/plat.md#plat-006--registro-de-empresas-roto-el-schema-zod-rechaza-el-sitioweb-null-que-envia-el-formulario-y-urls-sin-protocolo) | 🟠 | Registro de empresas roto: el schema zod rechaza el `sitioWeb: null` que envia el formulario (y  | `lib/validations.ts:23` | ✅ |
| [PLAT-007](auditoria-2026-09/plat.md#plat-007--el-webhook-candidateaccepted-se-dispara-con-void-fireandforget-y-en-vercel-serverless-se-pierde-al-congelarse-la-funcion) | 🟠 | El webhook candidate.accepted se dispara con `void` (fire-and-forget) y en Vercel serverless se  | `lib/worky2-webhook.ts:43` | — |
| [UI-001](auditoria-2026-09/ui.md#ui-001--terminos-y-condiciones-y-politica-de-privacidad-son-placeholders-en-construccion-mientras-los-formularios-declaran-que-el-usuario-los-acepta) | 🟠 | Términos y Condiciones y Política de Privacidad son placeholders "en construcción" mientras los  | `terms/page.tsx:16` | ✅ |
| [VAC-001](auditoria-2026-09/vac.md#vac-001--apiapplicationscheck-es-un-oraculo-publico-cualquiera-consulta-si-un-email-postulo-y-en-que-estado-va) | 🟠 | /api/applications/check es un oráculo público: cualquiera consulta si un email postuló y en qué  | `api/applications/check/route.ts:26` | ✅ |
| [VAC-002](auditoria-2026-09/vac.md#vac-002--bypass-del-fix-39-borrador-pausedclosed-active-publica-gratis) | 🟠 | Bypass del fix #39: borrador -> paused/closed -> active publica gratis | `api/jobs/[id]/route.ts:222` | ✅ |
| [VAC-003](auditoria-2026-09/vac.md#vac-003--patch-apijobsid-permite-cambiar-profileseniorityworkmode-de-una-vacante-ya-pagada-sin-recalcular-creditos-jobcreditcost-queda-desincronizado) | 🟠 | PATCH /api/jobs/[id] permite cambiar profile/seniority/workMode de una vacante ya pagada sin rec | `api/jobs/[id]/route.ts:291` | ✅ |
| [VAC-004](auditoria-2026-09/vac.md#vac-004--put-apijobsid-reembolsos-de-creditos-sin-transaccion-ni-guard-peticiones-paralelas-duplican-la-devolucion-creditos-gratis) | 🟠 | PUT /api/jobs/[id]: reembolsos de creditos sin transaccion ni guard -> peticiones paralelas dupl | `api/jobs/[id]/route.ts:513` | ✅ |
| [VAC-005](auditoria-2026-09/vac.md#vac-005--apijobspublish-el-chequeo-de-saldo-dentro-de-la-transaccion-no-bloquea-y-la-activacion-del-borrador-queda-fuera) | 🟠 | /api/jobs/publish: el chequeo de saldo dentro de la transacción no bloquea y la activación del b | `api/jobs/publish/route.ts:363` | ✅ |
| [VAC-006](auditoria-2026-09/vac.md#vac-006--vacantes-confidenciales-se-deanonimizan-y-los-borradores-son-publicos-get-apijobs-y-apijobspublish-fuera-del-matcher-siguen-aceptando-includedraftsstatususerid-sin-sesion) | 🟠 | Vacantes confidenciales se de-anonimizan y los borradores son publicos: GET /api/jobs y /api/job | `api/jobs/route.ts:10` | ✅ |
| [VAC-007](auditoria-2026-09/vac.md#vac-007--publicacion-gratis-o-rebajada-omitiendofalseando-profile-seniority-o-workmode) | 🟠 | Publicación gratis o rebajada omitiendo/falseando profile, seniority o workMode | `api/jobs/route.ts:283` | ✅ |
| [VAC-008](auditoria-2026-09/vac.md#vac-008--el-fix-de-atomicidad-6-no-se-aplico-a-post-apijobs-que-es-la-ruta-que-realmente-usa-el-formulario-saldo-negativo-y-creditos-perdidos) | 🟠 | El fix de atomicidad #6 no se aplico a POST /api/jobs, que es la ruta que realmente usa el formu | `api/jobs/route.ts:300` | ✅ |
| [VAC-009](auditoria-2026-09/vac.md#vac-009--el-email-es-la-llave-de-identidad-pero-nunca-se-verifica-registrarse-con-el-correo-de-otra-persona-expone-sus-postulaciones-anonimas-telefono-cv-carta-y-notas-internas) | 🟠 | El email es la llave de identidad pero nunca se verifica: registrarse con el correo de otra pers | `api/my-applications/route.ts:26` | — |
| [VAC-010](auditoria-2026-09/vac.md#vac-010--la-bolsa-publica-talents-solo-muestra-las-20-vacantes-mas-recientes-el-cliente-ignora-la-paginacion-de-get-apijobs) | 🟠 | La bolsa publica (/talents) solo muestra las 20 vacantes mas recientes: el cliente ignora la pag | `components/sections/talents/SearchPositionsSection.tsx:132` | — |

---

## Decisiones que no puede tomar quien ejecute

Estas requieren a la dueña o dueño del negocio, datos reales o acceso a producción; están en las fichas pero **no se arreglan a ciegas**:

1. **Verificación de correo electrónico.** Hoy el email es la llave de identidad (las postulaciones se enlazan por `candidateEmail`) y nunca se verifica. Arreglarlo cambia el alta de usuarios.
2. **Aprobación de empresas.** `CompanyRequest.status` no lo comprueba ninguna ruta: el rol `company` se autoasigna desde un endpoint público. Decidir si la aprobación debe bloquear el acceso y qué pasa con las cuentas ya creadas.
3. **Términos y Condiciones y Aviso de Privacidad** son placeholders «en construcción» mientras los formularios ya recogen datos personales y documentos (INE, actas constitutivas). Esto es exposición legal, no deuda técnica.
4. **Reembolsos y contracargos** de MercadoPago: los créditos se conservan tras un refund. Falta definir el proceso.
5. **Almacenamiento de CV y documentos**: hoy son URLs públicas permanentes con datos personales. Decidir URLs firmadas.
6. **Baseline de migraciones Prisma**: el historial sigue desincronizado y ahora hay una migración nueva encima. Marcarla como aplicada en producción es acción manual.
7. **Cifras de la portada y cobertura**: «150+ especialistas», «15+ estados», y la lista de ciudades (la FAQ dice Monterrey/Morelia/CDMX/Puebla/Guadalajara y el mapa listaba otras). Nadie puede confirmarlas desde el código.
8. **Secretos**: `TOKENS_TO_ROTATE.md` sigue versionado y marca la rotación como incompleta; `README.md` publica contraseñas de las cuentas seed. Rotar es acción manual.
9. **Rate limiter distribuido**: el actual vive en memoria por instancia serverless; para que sirva de verdad hace falta Redis/Upstash.

## Apéndice — hallazgos por archivo

Los 15 archivos con más hallazgos, por si conviene atacarlos de una pasada:

| Archivo | Hallazgos |
|---|---|
| `src/app/register/page.tsx` | 17 |
| `prisma/schema.prisma` | 14 |
| `src/components/commons/Navbar.tsx` | 12 |
| `src/app/api/jobs/route.ts` | 11 |
| `src/app/profile/page.tsx` | 11 |
| `src/app/api/credits/purchases/route.ts` | 9 |
| `src/middleware.ts` | 9 |
| `src/app/admin/vendors/page.tsx` | 9 |
| `src/app/admin/assign-candidates/page.tsx` | 9 |
| `src/app/api/recruiter/dashboard/route.ts` | 9 |
| `src/components/sections/jobs/CreateJobForm.tsx` | 9 |
| `src/components/shared/CandidateProfileModal.tsx` | 8 |
| `src/app/api/admin/vendors/route.ts` | 7 |
| `src/app/api/admin/assign-candidates/route.ts` | 7 |
| `src/app/credits/purchase/page.tsx` | 7 |
