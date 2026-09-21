# Base de datos, migraciones y scripts

[← volver al índice](../AUDITORIA-2026-09.md) · 24 hallazgos — 🟠 2 high · 🟡 13 medium · ⚪ 9 low

## 🟠 high (2)

#### DB-001 — Historial de migraciones incompleto y ahora con una migracion nueva encima: migrate deploy/dev/reset documentados rompen entornos nuevos o pueden resetear la BD

- **Severidad:** 🟠 high · **Categoría:** config · **Estado:** pendiente conocido de junio · **Verificación:** sin verificar (reportada por 1 auditor)
- **Ubicación:** `prisma/migrations/20260713000000_add_worky2_integration_tables/migration.sql:1` · relacionados: `prisma/schema.prisma`, `prisma/archived-sql/README.md`, `docs/DEPLOYMENT.md`, `docs/WORKY2_INTEGRATION.md`, `docs/INSTALLATION.md`, `docs/TROUBLESHOOTING.md`, `docs/CONTRIBUTING.md`, `README.md`
- **Problema:** Pendiente #8 de la auditoria (baseline), con detalle nuevo. Las 7 migraciones solo crean User, CompanyRequest, ContactMessage, Job, Application, IntegrationApiKey e IntegrationWebhook. El schema tiene 22 modelos: faltan 15 tablas (Notification -solo en archived-sql-, PricingMatrix, CreditPackage, CreditPurchase, CreditTransaction, Candidate, Experience, CandidateDocument, Specialty, JobAssignment, EvaluationNote, DiscountCode, DiscountCodeUse, InterviewRequest, SkillRating) y columnas: User.credits/specialty (+resetToken* solo en archived-sql), CompanyRequest.latitud/longitud/logoUrl, y 17 columnas de Job (salaryMin, salaryMax, closedReason, creditCost, profile, subcategory, seniority, educationLevel, habilidades, responsabilidades, resultadosEsperados, valoresActitudes, informacionAdicional, notasInternas, isConfidential, editableUntil, + lat/lng archivadas) con sus indices. Despues de la auditoria se agrego una migracion formal (2026-07-13) sobre ese historial roto, mientras docs/WORKY2_INTEGRATION.md:9 indica aplicarla con 'prisma db push' y docs/DEPLOYMENT.md:236-263 indica 'prisma migrate deploy'; INSTALLATION/CONTRIBUTING/TROUBLESHOOTING indican 'migrate dev' y 'migrate reset'.
- **Evidencia:**

```ts
-- prisma/migrations/20260713000000_add_worky2_integration_tables/migration.sql:1-2
-- CreateTable
CREATE TABLE "IntegrationApiKey" (
// docs/WORKY2_INTEGRATION.md:9
> existen aún en la base. **El dueño del repo corre `npx prisma db push` (o la
// docs/DEPLOYMENT.md:263
npx prisma migrate deploy
// docs/TROUBLESHOOTING.md:167 y 615
npx prisma migrate reset
```

- **Escenario de fallo:** (a) Entorno nuevo (dev, staging, BD de CI para test:integration): 'prisma migrate deploy' termina OK pero crea solo 7 tablas con columnas viejas; el primer prisma.user.findUnique del seed o del login falla con P2022 (column User.credits does not exist). (b) Un dev sigue INSTALLATION.md y corre 'prisma migrate dev' contra una BD creada con db push: Prisma detecta drift y ofrece resetear el esquema ('All data will be lost'); si su .env apunta a la BD compartida/produccion, se pierde todo. En BD vacia, migrate dev genera automaticamente una migracion con las 15 tablas; si se commitea, el siguiente 'migrate deploy' en produccion falla con 'relation already exists' (P3018) y bloquea todos los despliegues de migraciones. (c) Si las tablas Worky2 se aplicaron en prod con db push, 'migrate deploy' posterior falla al intentar CREATE TABLE "IntegrationApiKey".
- **Arreglo propuesto:** Generar el baseline real: 'prisma migrate diff --from-migrations prisma/migrations --to-schema-datamodel prisma/schema.prisma --script' como migracion 0_baseline_drift (o rehacer el historial en una sola 0_init desde el schema), marcarla aplicada en produccion con 'prisma migrate resolve --applied' (accion manual), y verificar con 'prisma migrate status' que prod quede 'up to date'. Unificar la documentacion en un solo flujo (migrate dev en local contra BD local, migrate deploy en CI/CD), borrar las instrucciones de 'migrate reset' y 'db push' para BDs compartidas, y agregar al CI un job que levante Postgres, corra 'migrate deploy' y 'prisma migrate diff --exit-code' contra el schema para detectar drift.

#### DB-002 — Seed crea cuentas reales del staff con una sola contrasena compartida, acepta los placeholders de .env.example y las contrasenas por defecto siguen documentadas en README e historial git

- **Severidad:** 🟠 high · **Categoría:** security · **Estado:** nuevo · **Verificación:** sin verificar (reportada por 1 auditor)
- **Ubicación:** `prisma/seed.ts:2280` · relacionados: `README.md`, `docs/env.example`, `docs/INSTALLATION.md`, `docs/ENVIRONMENT_VARIABLES.md`, `.env.example`, `scripts/verify-ludim.ts`
- **Problema:** seedStaff crea 8 especialistas reales (@inakat.com, 'de la lista de Lalo') y 2 reclutadores con el MISMO hash (SEED_STAFF_PASSWORD) y emailVerified ya marcado; el esquema no tiene ningun campo tipo mustChangePassword, asi que nada fuerza el cambio. validateEnvVars solo comprueba presencia: los valores 'CHANGE_ME_*' publicados en .env.example pasan la validacion. README.md:164-177 publica una tabla 'Credenciales de Prueba' con contrasena en claro para admin@inakat.com, empresas, reclutadores, especialistas (incluido un staff real) y candidato (valores omitidos aqui a proposito), y el historial git (antes del commit 3c9351b, 2026-02-04) contiene 6 literales bcrypt.hash('...') en prisma/seed.ts. scripts/verify-ludim.ts confirma que ese staff existe como usuario real (ID 11) en la BD contra la que se operaba.
- **Evidencia:**

```ts
// prisma/seed.ts:2280
  const defaultPassword = await bcrypt.hash(process.env.SEED_STAFF_PASSWORD!, 10);
// prisma/seed.ts:33 (solo presencia, acepta 'CHANGE_ME_...')
  const missing = requiredVars.filter(v => !process.env[v]);
// prisma/seed.ts:2365-2375
      await prisma.user.create({ data: { email: data.email, password: defaultPassword, ... role: 'specialist', ... emailVerified: new Date() } });
// README.md:164-177: tabla '## Credenciales de Prueba' (Rol | Email | Password) con valores en claro
// docs/env.example:35, docs/INSTALLATION.md:155, docs/ENVIRONMENT_VARIABLES.md:237: ADMIN_PASSWORD="<valor por defecto>"
```

- **Escenario de fallo:** Cualquier persona con lectura del repo (colaborador, ex-colaborador, fork/clon filtrado) prueba en produccion las credenciales de la tabla del README o las del historial git contra admin@inakat.com y las cuentas @inakat.com del staff. Si la BD de produccion se sembro alguna vez con esos valores (antes de febrero 2026 eran literales en el seed) y nadie las roto, obtiene sesion de admin o de especialista con acceso a PII de todos los candidatos. Igual si alguien copia .env.example tal cual y corre el seed contra una BD compartida: queda un admin con contrasena publica 'CHANGE_ME_...'.
- **Arreglo propuesto:** 1) Rotar YA en produccion las contrasenas de todas las cuentas creadas por seed (admin, staff @inakat.com, empresas demo) o desactivar las demo. 2) Borrar la tabla de credenciales del README y las referencias a ADMIN_PASSWORD con valor en docs. 3) En validateEnvVars rechazar valores que empiecen con 'CHANGE_ME' o con longitud < 12. 4) No crear staff real desde el seed: crearlo por /admin/users con contrasena individual + flujo forgot-password; si se mantiene, agregar User.mustChangePassword y forzarlo en login. 5) Considerar limpiar el historial (git filter-repo) o asumir esas contrasenas como quemadas.

## 🟡 medium (13)

#### DB-003 — companyRating es un valor que la propia empresa envia y se muestra publicamente como '★ 4.5'; no existe ningun sistema de resenas que lo respalde

- **Severidad:** 🟡 medium · **Categoría:** validation · **Estado:** nuevo · **Verificación:** sin verificar (reportada por 1 auditor)
- **Ubicación:** `prisma/schema.prisma:186` · relacionados: `src/app/api/jobs/route.ts`, `src/app/api/jobs/publish/route.ts`, `src/app/api/jobs/[id]/route.ts`, `src/components/sections/talents/SearchPositionsSection.tsx`, `prisma/seed.ts`
- **Problema:** Job.companyRating Float? @default(5.0) se rellena con body.companyRating sin rango ni origen en POST /api/jobs, /api/jobs/publish, PUT y PATCH. La bolsa publica lo pinta junto al nombre de la empresa. No hay modelo Review/Rating en el schema; el seed lo inventa (4.0-4.7).
- **Evidencia:**

```ts
// prisma/schema.prisma:186
  companyRating   Float?    @default(5.0)
// src/app/api/jobs/route.ts:356
        companyRating: companyRating || null,
// src/components/sections/talents/SearchPositionsSection.tsx:510-511
                        {job.company}{' '}
                        {job.companyRating && `★ ${job.companyRating}`}
```

- **Escenario de fallo:** Una empresa envia POST /api/jobs con companyRating: 5 (o 99, o -3: no hay validacion de rango) y su vacante aparece en /talents como 'Empresa X ★ 5', una calificacion que los candidatos interpretan como reputacion verificada por INAKAT. Con companyRating: 'abc' Prisma lanza y, en POST /api/jobs con publishNow, los creditos ya se descontaron (ver hallazgo de no-atomicidad).
- **Arreglo propuesto:** Eliminar companyRating del body aceptado en todas las rutas de jobs y dejar de mostrarlo hasta que exista un sistema real de resenas; si se conserva como dato curado por INAKAT, permitir escribirlo solo a admin con validacion 0-5. Quitar el @default(5.0) del schema.

#### DB-004 — Job.profile / Candidate.profile / User.specialty son strings sin FK a Specialty: renombrar una especialidad solo actualiza PricingMatrix y deja huerfano lo demas

- **Severidad:** 🟡 medium · **Categoría:** data-integrity · **Estado:** nuevo · **Verificación:** sin verificar (reportada por 1 auditor)
- **Ubicación:** `prisma/schema.prisma:192` · relacionados: `src/app/api/admin/specialties/[id]/route.ts`, `src/lib/pricing.ts`, `src/app/api/jobs/[id]/route.ts`, `src/app/api/admin/assignments/route.ts`
- **Problema:** La especialidad se guarda copiando el nombre en cuatro tablas. PUT /api/admin/specialties/[id] al renombrar solo hace updateMany sobre PricingMatrix (y ni siquiera en la misma transaccion que el update de Specialty). Job.profile, Candidate.profile y User.specialty conservan el nombre viejo.
- **Evidencia:**

```ts
// prisma/schema.prisma:192
  profile         String?   // "Tecnología", "Diseño Gráfico", etc. (del catálogo de especialidades)
// src/app/api/admin/specialties/[id]/route.ts:139-143
      // Actualizar el profile en PricingMatrix
      await prisma.pricingMatrix.updateMany({
        where: { profile: oldName },
        data: { profile: name.trim() }
      });
```

- **Escenario de fallo:** El admin renombra 'Tecnología' a 'Tecnología e IT'. Todas las vacantes existentes quedan con profile='Tecnología': los borradores, al publicarse via /api/jobs/publish, no encuentran precio y se cobran a 5 creditos (DEFAULT) en vez de hasta 18; editar cualquiera de esas vacantes devuelve 400 'La especialidad seleccionada no es válida'; el filtro publico ?profile= deja de encontrarlas; la asignacion de especialistas muestra advertencias falsas de 'especialidad no coincide' y DELETE de la especialidad ya no detecta vacantes que la usan (cuenta por el nombre nuevo).
- **Arreglo propuesto:** Modelar specialtyId Int? con FK a Specialty en Job, Candidate, User y PricingMatrix (backfill por nombre) y dejar el nombre solo en Specialty. Como parche inmediato: en el PUT, dentro de un prisma.$transaction, propagar el rename tambien a job.updateMany, candidate.updateMany y user.updateMany junto con el update de Specialty.

#### DB-005 — DELETE /api/jobs/[id] + onDelete: Cascade borra en silencio todo el pipeline de la vacante (postulaciones, notas, calificaciones, entrevistas, asignacion)

- **Severidad:** 🟡 medium · **Categoría:** data-integrity · **Estado:** nuevo · **Verificación:** sin verificar (reportada por 1 auditor)
- **Ubicación:** `prisma/schema.prisma:241` · relacionados: `src/app/api/jobs/[id]/route.ts`
- **Problema:** Application.job, JobAssignment.job, y en cadena EvaluationNote, SkillRating e InterviewRequest tienen onDelete: Cascade. El handler DELETE hace un hard delete sin comprobar estado ni existencia de postulaciones, y lo puede invocar la empresa duena. CreditTransaction.jobId (sin FK) queda apuntando a una vacante inexistente y no hay reembolso ni registro.
- **Evidencia:**

```ts
// prisma/schema.prisma:241
  job             Job       @relation(fields: [jobId], references: [id], onDelete: Cascade)
// src/app/api/jobs/[id]/route.ts:643-646
    // Eliminar vacante
    await prisma.job.delete({
      where: { id: jobId }
    });
```

- **Escenario de fallo:** Una empresa con una vacante activa que ya tiene 30 postulaciones, notas del reclutador, calificaciones del especialista y una entrevista confirmada ejecuta 'fetch("/api/jobs/57", {method:"DELETE"})' desde la consola con su sesion. La vacante y TODO su historial desaparecen: los candidatos dejan de ver su postulacion en 'Mis postulaciones', reclutador y especialista pierden su trabajo, la integracion Worky2 ya no puede devolver los candidatos aceptados de esa vacante, y el ledger conserva un 'spend' con jobId huerfano.
- **Arreglo propuesto:** Convertir el borrado en soft delete (status 'closed' + closedReason 'cancelled' o un campo deletedAt) y permitir hard delete solo a admin y solo para drafts sin postulaciones (responder 409 en otro caso). En el schema, cambiar Application.job a onDelete: Restrict para que la BD impida perder postulaciones por accidente.

#### DB-006 — Application se enlaza con Candidate/User por email en texto (sin FK): cambiar el email de un candidato rompe todo su historial

- **Severidad:** 🟡 medium · **Categoría:** data-integrity · **Estado:** nuevo · **Verificación:** sin verificar (reportada por 1 auditor)
- **Ubicación:** `prisma/schema.prisma:248` · relacionados: `src/app/api/admin/candidates/[id]/route.ts`, `src/app/api/admin/users/route.ts`, `src/app/api/candidate/applications/route.ts`, `src/app/api/recruiter/dashboard/route.ts`, `src/app/api/specialist/dashboard/route.ts`, `src/app/api/company/dashboard/route.ts`, `src/app/api/admin/jobs/[id]/pipeline/route.ts`
- **Problema:** Application no tiene candidateId; todos los dashboards (recruiter, specialist, company, admin pipeline, candidate/applications) reconstruyen la relacion comparando Application.candidateEmail con Candidate.email. PUT /api/admin/candidates/[id] permite cambiar Candidate.email sin propagar a Application.candidateEmail ni a User.email; PUT /api/admin/users permite cambiar User.email sin propagar a Candidate.email.
- **Evidencia:**

```ts
// prisma/schema.prisma:246-249
  // Información del candidato
  candidateName   String
  candidateEmail  String
// src/app/api/admin/candidates/[id]/route.ts:196
    if (email !== undefined) updateData.email = email.toLowerCase();
// src/app/api/candidate/applications/route.ts:68-71
    const applications = await prisma.application.findMany({
      where: { candidateEmail: candidate.email.toLowerCase() },
```

- **Escenario de fallo:** El admin corrige un typo en el correo de un candidato (juan@gmial.com -> juan@gmail.com). Desde ese momento: 'Mis postulaciones' del candidato queda vacio (busca por el email nuevo), reclutador/especialista/empresa ven sus postulaciones sin perfil (candidateProfile null, sin CV ni experiencia), el chequeo de duplicados deja de reconocerlo y puede postularse otra vez a las mismas vacantes, y el candidato sigue iniciando sesion con el correo viejo porque User.email no se toco.
- **Arreglo propuesto:** Agregar Application.candidateId Int? con FK a Candidate (onDelete: SetNull) + indice, poblarlo con un backfill por email, y hacer que los dashboards usen include: { candidate } en vez de mapas por email. Mientras tanto, en el PUT de candidato ejecutar en una transaccion updateMany de Application.candidateEmail y update de User.email cuando cambie el correo (validando unicidad en User).

#### DB-007 — Estados como String libre (pendiente #8): ya hay valores que el codigo lee pero nadie escribe, y mapeos que olvidan estados reales

- **Severidad:** 🟡 medium · **Categoría:** correctness · **Estado:** pendiente conocido de junio · **Verificación:** sin verificar (reportada por 2 auditores)
- **Ubicación:** `prisma/schema.prisma:256` · relacionados: `src/app/api/candidate/applications/route.ts`, `src/app/api/applications/check/route.ts`, `src/lib/integration-candidate.ts`, `src/app/api/auth/register/route.ts`
- **Problema:** Detalle nuevo sobre el pendiente de pasar role/status a enums. Application.status admite 12 valores segun el comentario; como no hay enum ni constante compartida, cada ruta mantiene su propia lista: 'hired' se consulta en integration-candidate.ts, recruiter/dashboard y assign-candidates pero no se escribe nunca; /api/candidate/applications y /api/applications/check no mapean 'evaluating', 'company_interested', 'discarded' ni 'archived'; Candidate.source recibe 'registro' (no esta en la lista documentada); el comentario de roles de la linea 580 omite 'vendor'; CreditPurchase.packageType documenta 'single' pero el codigo usa 'pack_1'.
- **Evidencia:**

```ts
// prisma/schema.prisma:256
  status          String    @default("pending") // "pending", "reviewing", "evaluating", ... "discarded", "archived"
// src/app/api/candidate/applications/route.ts:168-170
        default:
          statusLabel = 'En revisión';
          statusColor = 'yellow';
// src/lib/integration-candidate.ts:40
export const ACCEPTED_APPLICATION_STATUSES = ['accepted', 'hired'];
```

- **Escenario de fallo:** Un candidato descartado por el reclutador ('discarded') o archivado por el admin ve indefinidamente 'En revisión' en su panel, y uno en evaluacion tecnica ('evaluating') o marcado 'Me interesa' por la empresa tambien ve 'En revisión' en vez de 'En proceso'. Un typo en cualquier ruta (p. ej. 'sent_to_specialst') se guardaria sin error y la postulacion desapareceria de todas las pestanas.
- **Arreglo propuesto:** Declarar enums Prisma (ApplicationStatus, JobStatus, UserRole, CandidateStatus, PaymentStatus, CommissionStatus, InterviewStatus) y, como paso previo sin migracion, un modulo src/lib/statuses.ts con las listas y un mapa unico de etiquetas para candidato; eliminar 'hired' o empezar a escribirlo; completar los mapeos faltantes.
- **Otros auditores añaden:** Agregar a Application las columnas discardedByRole (enum admin|recruiter|specialist|company), discardedFromStatus y discardedAt. En specialist/dashboard filtrar 'discarded' por discardedByRole='specialist' y restaurar a discardedFromStatus; idem en recruiter/dashboard. Aprovechar para pasar status a enum Prisma.

#### DB-008 — Application no tiene unicidad (jobId, candidateEmail): las 3 rutas que crean postulaciones usan check-then-create

- **Severidad:** 🟡 medium · **Categoría:** data-integrity · **Estado:** nuevo · **Verificación:** sin verificar (reportada por 1 auditor)
- **Ubicación:** `prisma/schema.prisma:273` · relacionados: `src/app/api/applications/route.ts`, `src/app/api/admin/assign-candidates/route.ts`, `src/app/api/recruiter/dashboard/route.ts`
- **Problema:** El modelo Application solo declara indices simples; no existe @@unique([jobId, candidateEmail]). La deduplicacion se hace en codigo con findFirst + create (POST /api/applications, admin/assign-candidates con createMany sin skipDuplicates, y recruiter/dashboard), lo cual no es atomico.
- **Evidencia:**

```ts
// prisma/schema.prisma:273-277
  @@index([jobId])
  @@index([userId])
  @@index([status])
  @@index([candidateEmail])
  @@index([createdAt])
// src/app/api/applications/route.ts:133-151
const existingApplication = await prisma.application.findFirst({ where: { jobId: parseInt(jobId), candidateEmail: candidateEmail.toLowerCase() } });
...
const application = await prisma.application.create({
```

- **Escenario de fallo:** Un candidato hace doble clic en 'Postularme' (o envia desde dos pestanas). Dos POST /api/applications concurrentes ejecutan el findFirst antes de que exista la fila, ambos pasan y se crean 2 Application para el mismo job/email. El reclutador ve al candidato duplicado, los contadores _count.applications se inflan y la empresa puede recibir al mismo candidato dos veces con estados distintos.
- **Arreglo propuesto:** Agregar @@unique([jobId, candidateEmail]) en Application (migracion: primero deduplicar con SQL conservando la fila mas antigua). En POST /api/applications capturar P2002 y responder 409 'Ya has aplicado'. En admin/assign-candidates usar createMany({ skipDuplicates: true }) y en recruiter/dashboard usar upsert sobre la clave compuesta.

#### DB-009 — PricingMatrix: el @@unique con location NULL no evita duplicados, skipDuplicates no tiene efecto y el sync hace una query por especialidad

- **Severidad:** 🟡 medium · **Categoría:** data-integrity · **Estado:** nuevo · **Verificación:** sin verificar (reportada por 3 auditores)
- **Ubicación:** `prisma/schema.prisma:303` · relacionados: `src/app/api/admin/pricing/sync/route.ts`, `src/app/api/pricing/calculate/route.ts`, `src/lib/pricing.ts`
- **Problema:** Todas las filas generadas usan location: null. En PostgreSQL los NULL son distintos entre si dentro de un indice unico, por lo que @@unique([profile, seniority, workMode, location]) no restringe nada y createMany({ skipDuplicates: true }) en admin/pricing/sync nunca salta filas. El sync ademas consulta pricingMatrix.findMany dentro de un for por especialidad (N+1), y GET /api/pricing/calculate (publico, sin cache) ejecuta 4 findMany distinct en serie.
- **Evidencia:**

```ts
// schema.prisma:303
@@unique([profile, seniority, workMode, location])
// admin/pricing/sync/route.ts:110
for (const specialty of specialties) {
  const existingPricing = await prisma.pricingMatrix.findMany({
    where: { profile: specialty.name },
  ...
  missingPricing.push({ profile: specialty.name, seniority, workMode, location: null, credits, isActive: true });
  ...
  await prisma.pricingMatrix.createMany({ data: missingPricing, skipDuplicates: true });
```

- **Escenario de fallo:** El admin hace doble click en 'Sincronizar precios' (o dos admins a la vez): ambas ejecuciones ven las mismas combinaciones faltantes y cada una inserta las 12 filas por especialidad; la matriz queda con precios duplicados, el admin edita una copia y calculateJobCreditCost (findFirst orderBy id asc) sigue cobrando segun la otra.
- **Arreglo propuesto:** Hacer location no nulo con default '' (o crear un indice unico parcial/NULLS NOT DISTINCT via migracion SQL) y limpiar duplicados existentes. En el sync cargar toda la matriz con un solo findMany({ select:{profile,seniority,workMode} }) y calcular faltantes en memoria dentro de una transaccion. En GET /api/pricing/calculate usar Promise.all y Cache-Control s-maxage.
- **Otros auditores añaden:** Guardar location como '' en vez de NULL, o crear por migracion SQL un indice unico parcial `CREATE UNIQUE INDEX ... ON "PricingMatrix"(profile, seniority, "workMode") WHERE location IS NULL` (o NULLS NOT DISTINCT en PG15+). Deduplicar antes de aplicarlo. — Hacer location NOT NULL con default '' (o eliminar la columna: el codigo de precios nunca filtra por ciudad) y mantener el @@unique; alternativa: indice unico parcial por SQL 'CREATE UNIQUE INDEX ... ON "PricingMatrix"(profile, seniority, "workMode") WHERE location IS NULL' o 'NULLS NOT DISTINCT' (PG15+). Antes, deduplicar filas existentes. En el seed usar upsert/findFirst explicito en vez de try/catch ciego.

#### DB-010 — El seed no tiene guard de entorno: corre contra cualquier DATABASE_URL, crea un admin personal hardcodeado y DEPLOYMENT.md lo ofrece para produccion

- **Severidad:** 🟡 medium · **Categoría:** config · **Estado:** nuevo · **Verificación:** sin verificar (reportada por 1 auditor)
- **Ubicación:** `prisma/seed.ts:44` · relacionados: `docs/DEPLOYMENT.md`, `.env.example`
- **Problema:** main() solo valida que existan las variables SEED_*; no comprueba NODE_ENV ni el host de DATABASE_URL, ni pide confirmacion. Siempre crea un segundo admin con un correo personal hardcodeado en el codigo versionado, 3 empresas demo con 50 creditos gratis y contrasena compartida, 5 usuarios demo con dominios @gmail.com reales, 18 vacantes demo activas (visibles publicamente) y 2 solicitudes pendientes. ADMIN_EMAIL tampoco se normaliza a minusculas aunque login busca email.toLowerCase().
- **Evidencia:**

```ts
async function main() {
  // Validar variables de entorno antes de continuar
  validateEnvVars();
  ...
  const admins = [
    { email: process.env.ADMIN_EMAIL || 'admin@inakat.com', password: process.env.SEED_ADMIN_PASSWORD!, ... },
    { email: '<correo personal hardcodeado>', password: process.env.SEED_ADMIN2_PASSWORD!, nombre: 'Guillermo Sánchez' }
  ];
// docs/DEPLOYMENT.md:270-272
# Solo si quieres datos de ejemplo en producción
npx prisma db seed
```

- **Escenario de fallo:** Un desarrollador con el .env apuntando a Supabase de produccion (el mismo .env que usan los scripts/ de diagnostico) ejecuta 'npx prisma db seed' para probar algo: en produccion aparecen 18 vacantes falsas en la bolsa publica, 3 empresas demo con 50 creditos y contrasena conocida por todo el equipo (pueden publicar gratis), un admin extra y usuarios con correos @gmail.com de terceros. Si ADMIN_EMAIL viene con mayusculas, el admin creado nunca puede iniciar sesion (login busca en minusculas y el unique es case-sensitive).
- **Arreglo propuesto:** Al inicio de main(): abortar si NODE_ENV==='production' o si DATABASE_URL no es localhost/una BD de dev, salvo SEED_ALLOW_REMOTE=1 explicito; separar 'seed de catalogos' (especialidades, matriz, paquetes) de 'seed demo' (usuarios, vacantes, postulaciones) con un flag; mover el segundo admin a variables de entorno; normalizar ADMIN_EMAIL con toLowerCase().trim(); usar dominios reservados (example.com) para datos demo; quitar la seccion de seed en produccion de DEPLOYMENT.md.

#### DB-011 — createSampleApplications adjunta postulaciones falsas a las primeras 18 vacantes de la BD, sin orderBy ni filtro por vacantes del seed

- **Severidad:** 🟡 medium · **Categoría:** data-integrity · **Estado:** nuevo · **Verificación:** sin verificar (reportada por 1 auditor)
- **Ubicación:** `prisma/seed.ts:1104`
- **Problema:** Las postulaciones de ejemplo se asignan por indice (jobs[0], jobs[6], jobs[12]...) sobre el resultado de job.findMany({ take: 18 }) sin where ni orderBy. El seed asume que esas 18 filas son sus propias vacantes y en el orden en que las creo; PostgreSQL no garantiza orden sin ORDER BY y, si la BD ya tiene vacantes, las primeras 18 son ajenas al seed.
- **Evidencia:**

```ts
  const jobs = await prisma.job.findMany({ take: 18 });
  ...
    {
      jobId: jobs[0]?.id,
      userId: carlos?.id,
      candidateName: 'Carlos Ramírez López',
      candidateEmail: 'carlos.dev@gmail.com',
```

- **Escenario de fallo:** Se corre el seed en staging/produccion donde ya existen vacantes reales (ids 1..N). findMany devuelve esas vacantes reales y el seed les crea 13 Application falsas ('Carlos Ramírez López', 'Ana Martínez García'...) con estados 'accepted', 'interviewed', 'rejected' y notas internas. Las empresas reales ven candidatos inventados en su pipeline y se disparan contadores/estadisticas falsas. En dev, el desorden hace que la carta de 'DevOps' quede en la vacante de 'Contador General'.
- **Arreglo propuesto:** Guardar los ids devueltos por job.create en el bucle de sampleJobs (Map por title) y construir las postulaciones contra esos ids; si la vacante no fue creada por el seed, no crear postulaciones. Como minimo: where: { userId: { in: [company1.id, company2.id, company3.id] } }, orderBy: { id: 'asc' }.

#### DB-012 — Reglas de precio contradictorias: en el seed 'remote' es la modalidad mas barata; en la auto-generacion (crear especialidad / sync) es la mas cara

- **Severidad:** 🟡 medium · **Categoría:** payments · **Estado:** nuevo · **Verificación:** sin verificar (reportada por 1 auditor)
- **Ubicación:** `prisma/seed.ts:1333` · relacionados: `src/app/api/admin/specialties/route.ts`, `src/app/api/admin/pricing/sync/route.ts`
- **Problema:** La matriz sembrada cobra menos por remoto que por hibrido/presencial (Tecnología Jr: remote 5, hybrid 6, presential 6). En cambio, al crear una especialidad desde el admin o al correr /api/admin/pricing/sync, los precios se generan con bonus presential +0, hybrid +1, remote +2. Ademas sync omite el seniority 'Practicante' (genera 12 filas y GET sync espera 12), mientras que crear especialidad genera 15 y el seed 15.
- **Evidencia:**

```ts
// prisma/seed.ts:1333-1352 (Tecnología Jr)
      workMode: 'remote',   credits: 5
      workMode: 'hybrid',   credits: 6
      workMode: 'presential', location: 'Monterrey', credits: 6
// src/app/api/admin/specialties/route.ts:158-162
    const workModeBonus: Record<string, number> = {
      'presential': 0,
      'hybrid': 1,
      'remote': 2
    };
// src/app/api/admin/pricing/sync/route.ts:87
    const seniorityLevels = ['Director', 'Sr', 'Middle', 'Jr'];
```

- **Escenario de fallo:** El admin crea la especialidad 'Legal' desde /admin/specialties: una vacante Sr remota cuesta 10 creditos y la presencial 8. Para 'Tecnología' (sembrada) es al reves: remota 12, presencial 14. Dos empresas pagan con logicas opuestas segun como se creo la especialidad. Si se usa sync, las vacantes 'Practicante' de esas especialidades no tienen fila y se cobran 5 creditos (mas que un Jr presencial = 4).
- **Arreglo propuesto:** Definir la regla de negocio una sola vez (modulo src/lib/pricing-defaults.ts con baseCredits por seniority y bonus por modalidad, incluyendo 'Practicante') y usarla en el seed, en POST /api/admin/specialties y en pricing/sync (expected = 15). Confirmar con negocio si remoto es mas caro o mas barato y corregir los datos existentes.

#### DB-013 — Seed: los 'profile' de PricingMatrix no coinciden con los nombres de Specialty; 5 de 10 especialidades quedan sin precio y caen a DEFAULT_CREDITS=5

- **Severidad:** 🟡 medium · **Categoría:** correctness · **Estado:** nuevo · **Verificación:** sin verificar (reportada por 1 auditor)
- **Ubicación:** `prisma/seed.ts:1634` · relacionados: `src/lib/pricing.ts`, `src/app/api/jobs/route.ts`, `src/app/api/admin/pricing/sync/route.ts`
- **Problema:** La matriz se siembra con 'Prod Audiovisual' y 'Admin de Oficina', pero el catalogo de Specialty (que es de donde el formulario toma Job.profile y contra el que valida la API) usa 'Producción Audiovisual' y 'Administración de Oficina'. Ademas 'Marketing', 'Ingeniería' y 'Salud' no tienen ninguna fila de precio. calculateJobCreditCost hace match exacto por string y, si no encuentra, devuelve 5 creditos fijos. Las vacantes de ejemplo tambien usan profile 'Admin de Oficina', que no existe en el catalogo, y un especialista se siembra con specialty 'Project Management' (tampoco existe).
- **Evidencia:**

```ts
// prisma/seed.ts:1634 y 1848 (matriz)
      profile: 'Prod Audiovisual',
      profile: 'Admin de Oficina',
// prisma/seed.ts:2135 y 2168 (catalogo Specialty)
    name: 'Producción Audiovisual',
    name: 'Administración de Oficina',
// src/lib/pricing.ts:20,73-74
  const DEFAULT_CREDITS = 5;
  // No se encontró precio, usar valor por defecto
  return { credits: DEFAULT_CREDITS, found: false };
```

- **Escenario de fallo:** En un entorno recien sembrado, una empresa publica una vacante 'Administración de Oficina' / Director / hibrido. La API valida el profile contra Specialty (ok), busca precio con profile='Administración de Oficina', no encuentra nada y cobra 5 creditos en vez de los 13 configurados para 'Admin de Oficina'. Lo mismo para Producción Audiovisual, Marketing, Ingeniería y Salud (cualquier seniority = 5 creditos). Ademas, editar una vacante seed con profile 'Admin de Oficina' devuelve 400 'La especialidad seleccionada no es válida'.
- **Arreglo propuesto:** Generar la matriz del seed a partir de specialtiesData (mismos name) en vez de strings sueltos; renombrar 'Prod Audiovisual'->'Producción Audiovisual' y 'Admin de Oficina'->'Administración de Oficina' (en matriz y en sampleJobs), agregar filas para Marketing/Ingeniería/Salud y corregir 'Project Management'. En pricing.ts, cuando found=false y el usuario es empresa, rechazar la publicacion (409 'precio no configurado') en vez de cobrar un default silencioso.

#### DB-014 — seedStaff sobrescribe el rol de usuarios existentes: re-ejecutar el seed puede degradar a un admin real a 'specialist'

- **Severidad:** 🟡 medium · **Categoría:** authz · **Estado:** nuevo · **Verificación:** sin verificar (reportada por 1 auditor)
- **Ubicación:** `prisma/seed.ts:2352` · relacionados: `docs/DEPLOYMENT.md`
- **Problema:** Para cada correo de la lista de staff, si el usuario YA existe el seed hace update incondicional de role (y specialty). No comprueba el rol actual ni pide confirmacion. Lo mismo para reclutador1/2 (role: 'recruiter'). Ademas, la seccion 2.5 ya habia hecho upsert de reclutador1/2 con otros nombres y otra contrasena (SEED_RECRUITER_PASSWORD), pero el resumen imprime 'Password para todos: $SEED_STAFF_PASSWORD', que es falso para esas dos cuentas.
- **Evidencia:**

```ts
    if (existing) {
      // Actualizar rol y especialidad si ya existe
      await prisma.user.update({
        where: { email: data.email },
        data: {
          role: 'specialist',
          specialty: data.specialty
        }
      });
```

- **Escenario de fallo:** En produccion el dueno del negocio (p. ej. lalo@inakat.com) fue promovido a admin desde /admin/users. Alguien re-ejecuta 'npx prisma db seed' (docs/DEPLOYMENT.md:268-273 lo ofrece como opcional en produccion) para poblar paquetes o especialidades: el seed lo encuentra y le pone role='specialist'. En su siguiente login el JWT sale con rol specialist y el middleware le niega /admin; recuperarlo exige acceso directo a la BD.
- **Arreglo propuesto:** En seedStaff no tocar usuarios existentes (solo create si no existe), o como minimo no modificar role cuando existing.role === 'admin'. Eliminar la duplicidad de reclutador1/2 entre la seccion 2.5 y seedStaff y corregir el mensaje de credenciales.

#### DB-015 — El seed sobrescribe configuracion editada por el admin: precios/isActive de CreditPackage y datos de Specialty

- **Severidad:** 🟡 medium · **Categoría:** payments · **Estado:** nuevo · **Verificación:** sin verificar (reportada por 1 auditor)
- **Ubicación:** `prisma/seed.ts:2511` · relacionados: `src/app/api/credits/purchases/route.ts`, `src/app/api/admin/credit-packages/[id]/route.ts`
- **Problema:** seedCreditPackages busca por credits y, si existe, hace update con todo el objeto del seed (price, pricePerCredit, badge, sortOrder, isActive: true). seedSpecialties hace lo mismo con name/slug/description/icon/color/sortOrder/subcategories. Son tablas que el admin administra desde /admin/credit-packages y /admin/specialties, asi que cada re-ejecucion del seed revierte en silencio sus cambios y reactiva paquetes que habia desactivado.
- **Evidencia:**

```ts
    if (existing) {
      await prisma.creditPackage.update({
        where: { id: existing.id },
        data: pkg
      });
      updated++;
// prisma/seed.ts:2262-2265
      await prisma.specialty.update({
        where: { name: specialty.name },
        data: specialty
      });
```

- **Escenario de fallo:** El admin sube 'Pack 10' a $40,000 y desactiva 'Pack 20'. Semanas despues alguien corre el seed para crear una especialidad nueva: Pack 10 vuelve a $35,000 y Pack 20 vuelve a estar activo y comprable; POST /api/credits/purchases cobra el precio revertido. Las subcategorias que el admin agrego a 'Tecnología' desaparecen y las vacantes que las usaban fallan la validacion de subcategoria al editarse.
- **Arreglo propuesto:** En el seed, para tablas administrables usar 'create si no existe' y nunca update (o upsert con update: {}). Si se necesita un reset explicito, ponerlo detras de un flag (SEED_FORCE_RESET=true) que ademas exija no estar en produccion.

## ⚪ low (9)

#### DB-016 — Indices redundantes sobre columnas que ya tienen indice unico (y duplicados en la migracion inicial)

- **Severidad:** ⚪ low · **Categoría:** performance · **Estado:** nuevo · **Verificación:** sin verificar (reportada por 1 auditor)
- **Ubicación:** `prisma/schema.prisma:71` · relacionados: `prisma/migrations/20251114040307_initial_setup/migration.sql`, `src/app/api/jobs/route.ts`, `src/app/api/admin/candidates/route.ts`
- **Problema:** @unique/@@unique ya crea un indice btree. El schema declara ademas @@index sobre las mismas columnas: User.email, Candidate.email, Candidate.userId, DiscountCode.code, Specialty.slug, CreditPurchase.paymentId. La migracion inicial crea User_email_key y User_email_idx. Por otro lado, indices como Candidate.universidad o Job.location no sirven a las consultas reales, que usan contains + mode: 'insensitive' (ILIKE '%x%').
- **Evidencia:**

```ts
// prisma/schema.prisma:19 y 71
  email             String    @unique
  @@index([email])
// prisma/migrations/20251114040307_initial_setup/migration.sql:56-59
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
CREATE INDEX "User_email_idx" ON "User"("email");
// src/app/api/jobs/route.ts:83
      where.location = { contains: location, mode: 'insensitive' };
```

- **Escenario de fallo:** Cada INSERT/UPDATE de User, Candidate, DiscountCode, Specialty y CreditPurchase mantiene dos btree identicos (coste de escritura y almacenamiento sin beneficio), y 'prisma migrate diff' contra produccion mostrara ruido cuando se genere el baseline. Las busquedas de la bolsa y del banco de candidatos hacen seq scan pese a los indices declarados, lo que se notara al crecer Candidate/Job.
- **Arreglo propuesto:** Eliminar los @@index redundantes listados. Para las busquedas por texto, crear indices GIN pg_trgm por SQL (title, company, location, Candidate.nombre/email) o quitar los btree inutiles. Agregar los compuestos que si se usan: Application(jobId, status) y CreditTransaction(userId, createdAt).

#### DB-017 — Importes monetarios modelados como Float y pricePerCredit derivado con tres valores distintos para el mismo paquete

- **Severidad:** ⚪ low · **Categoría:** payments · **Estado:** nuevo · **Verificación:** sin verificar (reportada por 1 auditor)
- **Ubicación:** `prisma/schema.prisma:318` · relacionados: `src/app/api/credits/purchases/route.ts`, `src/app/api/admin/credit-packages/route.ts`, `src/app/credits/purchase/page.tsx`, `prisma/seed.ts`
- **Problema:** CreditPackage.price/pricePerCredit, CreditPurchase.pricePerCredit/totalPrice, DiscountCode.*Percent y DiscountCodeUse.originalPrice/discountAmount/finalPrice/commissionAmount son Float (DOUBLE PRECISION). pricePerCredit es un dato derivado que se calcula de tres formas: toFixed(2) en el admin, division cruda en la compra y literal en seed/fallback de UI.
- **Evidencia:**

```ts
// prisma/schema.prisma:318-319, 342-343, 732-735
  price           Float    // Precio en MXN
  pricePerCredit  Float    // Precio por crédito (calculado)
  totalPrice      Float    // Precio total pagado
  commissionAmount  Float     // Comisión para el vendor
// src/app/api/credits/purchases/route.ts:181
        pricePerCredit: finalPrice / pkg.credits, // Precio por crédito después de descuento
// prisma/seed.ts:2487
      pricePerCredit: 3333.33,
```

- **Escenario de fallo:** Pack 15 ($50,000): CreditPackage guarda 3333.33 (seed), CreditPurchase guarda 3333.3333333333335 y la UI de fallback muestra 3333; 15 x 3333.33 = 49,999.95 no cuadra con lo cobrado en ningun reporte. Si el admin fija un precio con centavos (p. ej. 3,499.90), el descuento se redondea a pesos con Math.round y las sumas _sum de comisiones en Float acumulan error binario, de modo que el total 'por pagar' a vendors no coincide al centavo con la suma de sus filas.
- **Arreglo propuesto:** Migrar los importes a Decimal(12,2) (@db.Decimal) o a enteros en centavos y operar con Prisma.Decimal/enteros; eliminar pricePerCredit de las tablas (calcularlo al mostrar) o calcularlo siempre con el mismo helper; redondear descuento y comision a 2 decimales de forma consistente.

#### DB-018 — onDelete incoherente en las relaciones de User: borrar un usuario destruye compras/comisiones/notas en cascada o falla por Restrict segun la tabla

- **Severidad:** ⚪ low · **Categoría:** data-integrity · **Estado:** nuevo · **Verificación:** sin verificar (reportada por 1 auditor)
- **Ubicación:** `prisma/schema.prisma:338`
- **Problema:** Hoy la app solo hace soft delete de usuarios (isActive=false), por lo que el riesgo es latente (borrado desde Prisma Studio/SQL o una futura baja ARCO). CreditPurchase.user, DiscountCode.user y EvaluationNote.author son Cascade; InterviewRequest.requestedBy y SkillRating.ratedBy no declaran onDelete (Restrict por ser requeridas); JobAssignment.recruiter/specialist quedan en SetNull implicito; Job.user es SetNull; CreditTransaction no tiene FK.
- **Evidencia:**

```ts
// :338  CreditPurchase
  user            User     @relation(fields: [userId], references: [id], onDelete: Cascade)
// :658  EvaluationNote
  author        User      @relation("EvaluationNoteAuthor", fields: [authorId], references: [id], onDelete: Cascade)
// :693  DiscountCode
  user              User      @relation("VendorCodes", fields: [userId], references: [id], onDelete: Cascade)
// :764  InterviewRequest (sin onDelete -> Restrict)
  requestedBy     User      @relation("InterviewRequester", fields: [requestedById], references: [id])
```

- **Escenario de fallo:** Alguien elimina desde Prisma Studio a un vendor que ya no colabora: se borran en cascada su DiscountCode y todos sus DiscountCodeUse (historial de descuentos aplicados y comisiones pagadas de compras reales). Si borra a un reclutador, desaparecen todas sus notas de evaluacion de candidatos. Si intenta borrar a una empresa que alguna vez pidio una entrevista, falla con violacion de FK (Restrict), pero si no tenia entrevistas se borran todas sus CreditPurchase (registros contables) y sus vacantes quedan activas con userId null.
- **Arreglo propuesto:** Definir la politica explicitamente: registros financieros y de auditoria (CreditPurchase, DiscountCode, DiscountCodeUse, EvaluationNote, SkillRating, InterviewRequest) con onDelete: Restrict; datos personales derivados (Notification, IntegrationApiKey/Webhook) con Cascade. Documentar un procedimiento de baja que anonimice al User en vez de borrarlo.

#### DB-019 — Comentarios obsoletos en el schema: pagos 'Conekta', packageType 'single', bloque 'AGREGAR AL MODELO User' ya aplicado y lista de roles sin 'vendor'

- **Severidad:** ⚪ low · **Categoría:** docs · **Estado:** nuevo · **Verificación:** sin verificar (reportada por 1 auditor)
- **Ubicación:** `prisma/schema.prisma:346` · relacionados: `src/app/api/credits/purchases/route.ts`
- **Problema:** El schema es la unica documentacion viva de los valores permitidos (todo es String), pero varios comentarios contradicen el codigo: CreditPurchase dice integrarse con Conekta cuando se usa MercadoPago; packageType documenta 'single' y el codigo envia 'pack_1'; las lineas 631-648 son instrucciones de un paso ya hecho; la nota de roles de la linea 578-580 omite 'vendor'; Specialty.subcategories dice 'JSON array' pero es String[] nativo.
- **Evidencia:**

```ts
  packageType     String?  // "single", "pack_10", "pack_15", "pack_20"
  // Información de pago (Conekta)
  paymentStatus   String   @default("pending") // "pending", "paid", "failed", "refunded"
  paymentId       String?  @unique // ID de Conekta
...
// AGREGAR AL MODELO User (relaciones):
// Agregar estos campos al modelo User existente:
```

- **Escenario de fallo:** Quien implemente reembolsos (pendiente #4) o un reporte de ventas filtra packageType = 'single' siguiendo el comentario y no encuentra ninguna compra de 1 credito (se guardan como 'pack_1'); o busca el paymentId en el panel de Conekta. 'refunded' figura como estado valido pero ningun codigo lo escribe.
- **Arreglo propuesto:** Actualizar los comentarios (MercadoPago, 'pack_1', roles con 'vendor', String[]), borrar el bloque 631-648 y, al introducir enums, eliminar las listas en comentarios.

#### DB-020 — Ledger de creditos: CreditTransaction/CreditPurchase son solo-escritura (ninguna ruta los lee) y siguen sin FKs

- **Severidad:** ⚪ low · **Categoría:** data-integrity · **Estado:** pendiente conocido de junio · **Verificación:** sin verificar (reportada por 1 auditor)
- **Ubicación:** `prisma/schema.prisma:368` · relacionados: `src/app/api/jobs/route.ts`, `src/app/api/jobs/publish/route.ts`, `src/app/api/credits/purchases/route.ts`, `src/app/api/webhooks/mercadopago/route.ts`
- **Problema:** Detalle nuevo sobre el pendiente #8 (FKs al ledger). CreditTransaction no tiene relacion con User, Job ni CreditPurchase (userId/jobId/purchaseId son Int sueltos; purchaseId ni siquiera tiene indice), DiscountCodeUse.companyUserId e InterviewRequest.confirmedById tampoco. Ademas, en todo src/ no existe ningun findMany/aggregate/count sobre creditTransaction ni creditPurchase: solo se insertan. El tipo 'admin_adjustment' documentado no lo escribe nadie.
- **Evidencia:**

```ts
model CreditTransaction {
  id            Int      @id @default(autoincrement())
  // Relación con empresa
  userId        Int
  ...
  // Referencias
  jobId         Int?     // Si se gastó en una vacante
  purchaseId    Int?     // Si fue una compra
// grep 'creditTransaction|creditPurchase' en src/: solo .create/.update/.updateMany/.findUnique(paymentId)
```

- **Escenario de fallo:** Una empresa reclama que le faltan creditos: ni ella (no hay pantalla de historial de compras/movimientos) ni el admin (no hay vista del ledger) pueden consultarlo desde la app; hay que entrar a la BD. Al hacerlo, los asientos de vacantes eliminadas apuntan a jobId inexistentes y no se puede hacer join con integridad. El admin tampoco puede ajustar saldo: no hay endpoint que escriba 'admin_adjustment'.
- **Arreglo propuesto:** Agregar relaciones: CreditTransaction.user (onDelete: Restrict), .job (SetNull), .purchase (SetNull) + @@index([purchaseId]); DiscountCodeUse.companyUser e InterviewRequest.confirmedBy. Crear GET /api/credits/transactions (empresa: propio; admin: por userId) y una vista en el dashboard, y un endpoint admin de ajuste que escriba 'admin_adjustment' en transaccion.

#### DB-021 — Seguimiento a 45 dias a medias: followUpDate se escribe pero nada lo lee; followUpCompleted y followUpNotes no se usan en ningun sitio

- **Severidad:** ⚪ low · **Categoría:** dead-code · **Estado:** nuevo · **Verificación:** sin verificar (reportada por 1 auditor)
- **Ubicación:** `prisma/schema.prisma:620` · relacionados: `src/app/api/specialist/dashboard/route.ts`
- **Problema:** JobAssignment tiene tres columnas para el seguimiento post-colocacion. specialist/dashboard calcula followUpDate = hoy + 45 dias al enviar candidatos a la empresa, pero no existe cron, notificacion, endpoint ni UI que consulte esa fecha, y los otros dos campos no aparecen en src/.
- **Evidencia:**

```ts
  // Seguimiento 45 días
  followUpDate      DateTime?
  followUpCompleted Boolean   @default(false)
  followUpNotes     String?
// src/app/api/specialist/dashboard/route.ts:320-324
        const followUpDate = new Date();
        followUpDate.setDate(followUpDate.getDate() + 45);
        await prisma.jobAssignment.update({ where: { id: hasAssignment.id }, data: { followUpDate } });
```

- **Escenario de fallo:** INAKAT ofrece seguimiento a 45 dias de la contratacion. Llega el dia 45 de una colocacion: nadie recibe aviso, no hay lista de 'seguimientos pendientes' y no hay donde registrar el resultado; la fecha ademas se sobrescribe cada vez que el especialista envia otro candidato de la misma vacante, y se calcula desde el envio a la empresa, no desde la aceptacion.
- **Arreglo propuesto:** Decidir: o se implementa (calcular la fecha al pasar Application a 'accepted', tarea programada/Vercel Cron que notifique al reclutador y admin, UI para marcar followUpCompleted + notas) o se eliminan las tres columnas y el codigo que escribe followUpDate.

#### DB-022 — Unicidades que el codigo asume pero la BD no garantiza: un codigo por vendor y un webhook por URL

- **Severidad:** ⚪ low · **Categoría:** data-integrity · **Estado:** nuevo · **Verificación:** sin verificar (reportada por 1 auditor)
- **Ubicación:** `prisma/schema.prisma:692` · relacionados: `src/app/api/vendor/my-code/route.ts`, `src/app/api/vendor/my-sales/route.ts`, `src/app/api/integration/webhooks/route.ts`
- **Problema:** vendor/my-code y vendor/my-sales tratan DiscountCode como 1:1 con el usuario (findFirst({ where: { userId } }) y 'ya tienes un codigo'), pero DiscountCode.userId no es @unique. integration/webhooks evita duplicados con findFirst + create, sin @@unique([userId, url]).
- **Evidencia:**

```ts
// prisma/schema.prisma:691-693
  // Vendor que creó el código
  userId            Int
  user              User      @relation("VendorCodes", fields: [userId], references: [id], onDelete: Cascade)
// src/app/api/vendor/my-sales/route.ts:24-26
    const discountCode = await prisma.discountCode.findFirst({
      where: { userId }
    });
```

- **Escenario de fallo:** Un usuario envia dos POST /api/vendor/my-code simultaneos con codigos distintos: ambos pasan el 'existingCode' y se crean dos codigos. Las ventas hechas con el segundo nunca aparecen en su panel ni en sus totales (my-sales solo mira el primero), aunque el admin si debe pagarlas. Con webhooks, un doble clic registra dos veces la misma URL y Worky2 recibe cada candidate.accepted duplicado.
- **Arreglo propuesto:** Agregar @unique a DiscountCode.userId (o cambiar my-sales/my-code para soportar varios codigos) y un indice unico parcial (userId, url) WHERE isActive en IntegrationWebhook; capturar P2002 y responder 409.

#### DB-023 — Scripts one-off con IDs de produccion hardcodeados (uno muta datos), dependencias sin uso y archivos locales trackeados

- **Severidad:** ⚪ low · **Categoría:** dead-code · **Estado:** nuevo · **Verificación:** sin verificar (reportada por 2 auditores)
- **Ubicación:** `scripts/fix-assignment-status.ts:15` · relacionados: `scripts/verify-ludim.ts`, `scripts/debug-assignments.ts`, `package.json`, `.claude/settings.local.json`, `.gitignore`
- **Problema:** scripts/fix-assignment-status.ts actualiza JobAssignment del jobId 19 y scripts/verify-ludim.ts consulta specialistId 11: parches puntuales de una incidencia pasada que siguen versionados y dentro del type-check. package.json mantiene ts-jest, ts-node, node-mocks-http (dev) y dotenv (prod) sin ningun import en src/, prisma/, scripts/ ni __tests__ (jest usa next/jest con SWC). .claude/settings.local.json (permisos locales con rutas absolutas del equipo del dev) y .vscode/settings.json estan trackeados aunque .gitignore:54 ignora .vscode/.
- **Evidencia:**

```ts
scripts/fix-assignment-status.ts:14-16
    // Buscar el JobAssignment de Machine Learning (jobId: 19)
    const assignment = await prisma.jobAssignment.findFirst({
      where: { jobId: 19 },
:40-45  await prisma.jobAssignment.update({ ... data: { recruiterStatus: 'sent_to_specialist', specialistStatus: 'pending' } })
package.json:62,66,67  "node-mocks-http", "ts-jest", "ts-node"
```

- **Escenario de fallo:** Alguien ejecuta `npx tsx scripts/fix-assignment-status.ts` contra otra base (staging o una produccion donde el job 19 ya es otra vacante) y cambia el estado de una asignacion ajena, haciendo aparecer candidatos en el dashboard de un especialista que no corresponde.
- **Arreglo propuesto:** Borrar los tres scripts (o moverlos a docs/archive con el parametro por argumento y modo --dry-run); `npm uninstall ts-jest ts-node node-mocks-http dotenv` (reinstalar dotenv como devDependency si se usa para Playwright); `git rm --cached .claude/settings.local.json .vscode/settings.json` y anadir .claude/settings.local.json a .gitignore.
- **Otros auditores añaden:** Eliminar el script (ya cumplio su funcion; el flujo de recruiter/dashboard ahora actualiza recruiterStatus). Si se quieren conservar parches de datos, moverlos a scripts/one-off/ con: argumento --job-id obligatorio, verificacion del titulo esperado, flag --apply (dry-run por defecto), impresion del host de la BD con confirmacion y process.exitCode = 1 en error.

#### DB-024 — scripts/verify-ludim.ts y debug-assignments.ts: IDs de produccion hardcodeados, sin manejo de errores y volcado de PII a consola

- **Severidad:** ⚪ low · **Categoría:** dead-code · **Estado:** nuevo · **Verificación:** sin verificar (reportada por 1 auditor)
- **Ubicación:** `scripts/verify-ludim.ts:9` · relacionados: `scripts/debug-assignments.ts`, `tsconfig.json`
- **Problema:** verify-ludim.ts consulta specialistId: 11 fijo (una persona concreta), no tiene try/catch ni finally: si la consulta lanza, queda un unhandled rejection y $disconnect no se ejecuta. debug-assignments.ts imprime nombres y correos del staff, nombres de todos los candidatos y su estado por vacante; su catch tambien oculta el fallo (exit 0). Ninguno esta referenciado en package.json; tsconfig los incluye en el typecheck ('**/*.ts').
- **Evidencia:**

```ts
// scripts/verify-ludim.ts:5-11
async function verify() {
  // Simular la query del dashboard del especialista para Ludim (ID: 11)
  const assignments = await prisma.jobAssignment.findMany({
    where: {
      specialistId: 11,
      recruiterStatus: 'sent_to_specialist'
    },
// scripts/debug-assignments.ts:156
          console.log(`       ${icon} ${app.candidateName} | ${app.status}`);
```

- **Escenario de fallo:** Un desarrollador corre 'npx tsx scripts/debug-assignments.ts' con el .env de produccion en una terminal compartida o en un job de CI: la salida (nombres de candidatos, estados de su proceso, correos del staff) queda en el scrollback/log del pipeline, fuera del control de acceso de la app. En otra BD, verify-ludim reporta '❌ Ludim NO puede ver ninguna vacante' porque el ID 11 es otro usuario, llevando a un diagnostico erroneo.
- **Arreglo propuesto:** Borrar verify-ludim.ts; convertir debug-assignments.ts en una herramienta parametrizada (--specialist-email, --job-id) que enmascare PII por defecto, con try/finally + process.exitCode=1, o sustituirla por una vista de diagnostico en /admin/assignments. Excluir scripts/ del build/typecheck si se mantienen como utilitarios.
