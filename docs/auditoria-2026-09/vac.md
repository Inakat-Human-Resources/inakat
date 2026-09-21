# Vacantes, publicación y postulaciones

[← volver al índice](../AUDITORIA-2026-09.md) · 54 hallazgos — 🟠 10 high · 🟡 23 medium · ⚪ 21 low

## 🟠 high (10)

#### VAC-001 — /api/applications/check es un oráculo público: cualquiera consulta si un email postuló y en qué estado va

- **Severidad:** 🟠 high · **Categoría:** security · **Estado:** nuevo · **Verificación:** ✅ verificada contra el código
- **Ubicación:** `src/app/api/applications/check/route.ts:26` · relacionados: `src/middleware.ts`, `src/components/sections/talents/ApplyJobModal.tsx`
- **Problema:** El middleware exceptúa explícitamente GET /api/applications/check de la autenticación (middleware.ts l.24) y la ruta no valida sesión ni aplica rate limit. Recibe jobId y email por query y devuelve existencia, status, etiqueta y fecha de la postulación. El único consumidor (ApplyJobModal) sólo la llama cuando ya hay sesión, así que el acceso anónimo no es necesario.
- **Comprobación:** Confirmado: el middleware exime explícitamente `GET /api/applications/check` (línea 24) y el handler no exige sesión.
- **Evidencia:**

```ts
const existingApplication = await prisma.application.findFirst({
  where: {
    jobId: parseInt(jobId),
    candidateEmail: email.toLowerCase()
  },
  select: { id: true, status: true, createdAt: true }
});
```

- **Escenario de fallo:** Un empleador (o cualquiera) itera los ids de vacantes activas con GET /api/applications/check?jobId=N&email=empleado@empresa.com sin cookie: descubre que su empleado está buscando trabajo, a qué vacantes postuló, cuándo, y si fue 'Aceptado' o 'No seleccionado'. Sin límite de peticiones.
- **Arreglo propuesto:** Quitar la excepción del middleware y exigir sesión en la ruta; ignorar el parámetro `email` y usar el email/ID de la sesión (`OR: [{ userId }, { candidateEmail: sessionEmail }]`). Permitir email arbitrario sólo a admin. Añadir applyRateLimit. No devolver el `id` interno ni el status crudo, sólo statusLabel.
- **Otros auditores añaden:** Exigir sesion (requireAuth) y usar el email de la sesion en vez del query param; quitar la excepcion del middleware (lineas 23-26). El flujo anonimo no lo necesita: POST /api/applications ya responde con error de duplicado. Si se mantiene publico, devolver solo {hasApplied:boolean} y aplicar applyRateLimit.

#### VAC-002 — Bypass del fix #39: borrador -> paused/closed -> active publica gratis

- **Severidad:** 🟠 high · **Categoría:** payments · **Estado:** arreglo previo incompleto · **Verificación:** ✅ verificada contra el código
- **Ubicación:** `src/app/api/jobs/[id]/route.ts:222` · relacionados: `src/app/company/dashboard/page.tsx`
- **Problema:** El fix #39 sólo bloquea la transición directa draft->active. PATCH acepta draft->paused y draft->closed (ambos en validJobStatuses) y después paused/closed->active está permitido como 'reanudar vacante que YA pagó'. El código asume que todo lo pausado/cerrado pagó, pero nunca lo comprueba (creditCost sigue en 0 y editableUntil en null).
- **Comprobación:** Confirmado: el guard sólo cubre `draft → active`; no hay máquina de estados, así que `draft → paused → active` lo rodea.
- **Evidencia:**

```ts
const validJobStatuses = ['active', 'paused', 'closed', 'draft'];
...
if (
  body.status === 'active' &&
  existingJob.status === 'draft' &&
  auth.role !== 'admin'
) {
  return NextResponse.json({ success: false, error: 'Para publicar/activar esta vacante usa el flujo de publicación ...' }, { status: 403 });
}
```

- **Escenario de fallo:** Empresa con 0 créditos guarda un borrador. 1) PATCH /api/jobs/{id} {"status":"paused"} -> 200. 2) PATCH /api/jobs/{id} {"status":"active"} -> 200. La vacante queda activa y pública sin cobro, con creditCost=0 y editableUntil=null (además editable para siempre).
- **Arreglo propuesto:** Definir tabla de transiciones explícita para no-admin: draft->(ninguna vía PATCH), active->paused|closed, paused->active|closed, closed->(ninguna o active sólo admin). Además, para cualquier ->active exigir que la vacante haya sido publicada (añadir columna publishedAt, o como mínimo `existingJob.editableUntil !== null`). Añadir test real del handler para draft->paused->active.
- **Otros auditores añaden:** Para rol != admin, permitir desde 'draft' unicamente seguir en 'draft' (rechazar paused/closed/active), o mejor: permitir -> 'active' solo si existingJob.creditCost > 0 o existe un CreditTransaction 'spend' con ese jobId (es decir, ya se pago). Anadir test que cubra draft->paused->active.

#### VAC-003 — PATCH /api/jobs/[id] permite cambiar profile/seniority/workMode de una vacante ya pagada sin recalcular creditos: Job.creditCost queda desincronizado

- **Severidad:** 🟠 high · **Categoría:** payments · **Estado:** nuevo · **Verificación:** ✅ verificada contra el código
- **Ubicación:** `src/app/api/jobs/[id]/route.ts:291` · relacionados: `prisma/schema.prisma`, `src/lib/pricing.ts`
- **Problema:** El PUT (formulario de edicion) recalcula el costo y cobra/devuelve la diferencia, pero el PATCH acepta en su whitelist los mismos campos que determinan el precio y hace job.update directo. creditCost es una columna denormalizada que nadie vuelve a validar. El PATCH tambien acepta 'company' y 'companyRating'.
- **Comprobación:** Confirmado: `allowedPatchFields` incluye `profile`, `seniority` y `workMode`, y PATCH no recalcula `creditCost`.
- **Evidencia:**

```ts
    const allowedPatchFields = ['status', 'closedReason', 'title', 'company', 'location',
      'latitude', 'longitude', 'salary', 'salaryMin', 'salaryMax', 'jobType', 'workMode',
      'description', 'requirements', 'companyRating', 'profile', 'subcategory', 'seniority',
      'educationLevel', 'habilidades', ...];
    const updateData: Record<string, any> = {};
    for (const field of allowedPatchFields) {
      if (body[field] !== undefined) updateData[field] = body[field];
    }
    ...
    const updatedJob = await prisma.job.update({ where: { id: jobId }, data: updateData });
```

- **Escenario de fallo:** Una empresa publica 'Educación / Practicante / remote' (3 creditos). Dentro de las 4 horas de edicion envia PATCH /api/jobs/88 { profile: 'Tecnología', seniority: 'Director', workMode: 'hybrid', title: 'CTO' }. La vacante queda publicada como Director de Tecnologia (18 creditos segun la matriz) habiendo pagado 3; creditCost sigue en 3 y no se genera ningun asiento.
- **Arreglo propuesto:** Quitar profile, subcategory, seniority y workMode (y company/companyRating) de allowedPatchFields para role company, o hacer que el PATCH delegue en la misma rutina del PUT que recalcula y cobra la diferencia en transaccion. Dejar el PATCH solo para status/closedReason.
- **Otros auditores añaden:** Quitar 'profile', 'seniority' y 'workMode' de allowedPatchFields cuando existingJob.status === 'active' y el rol no es admin (obligar a usar PUT), o extraer la logica de ajuste de creditos de PUT a una funcion comun y llamarla tambien desde PATCH. — Quitar profile, seniority y workMode de allowedPatchFields (que sólo se editen por PUT), y en PUT aplicar el ajuste de créditos a toda vacante ya pagada (status active o paused / creditCost>0), no sólo a 'active'.

#### VAC-004 — PUT /api/jobs/[id]: reembolsos de creditos sin transaccion ni guard -> peticiones paralelas duplican la devolucion (creditos gratis)

- **Severidad:** 🟠 high · **Categoría:** payments · **Estado:** nuevo · **Verificación:** ✅ verificada contra el código
- **Ubicación:** `src/app/api/jobs/[id]/route.ts:513` · relacionados: `src/app/api/jobs/publish/route.ts`, `src/app/api/jobs/route.ts`
- **Problema:** Al editar una vacante activa y bajar seniority/workMode/profile, la ruta calcula difference a partir de existingJob.creditCost leido al inicio, incrementa User.credits y solo al final actualiza Job.creditCost, sin transaccion, sin lock y sin update condicional. N peticiones concurrentes leen el mismo creditCost original y cada una reembolsa la diferencia completa. El mismo defecto en la rama de cobro permite saldo negativo, y el ledger (balanceBefore/After) se calcula con un saldo obsoleto.
- **Comprobación:** Confirmado: `user.update({increment})` + `creditTransaction.create` sueltos, con `company.credits` leído antes.
- **Evidencia:**

```ts
const originalCost = existingJob.creditCost || 0;
...
} else if (difference < 0) {
  const refundAmount = Math.abs(difference);
  await prisma.user.update({
    where: { id: existingJob.userId! },
    data: { credits: { increment: refundAmount } }
  });
  await prisma.creditTransaction.create({ ... balanceBefore: company.credits, ...
...
const updatedJob = await prisma.job.update({ where: { id: jobId }, data: { ..., ...(newCreditCost !== undefined && { creditCost: newCreditCost }) } });
```

- **Escenario de fallo:** Una empresa publica una vacante Director/remote (12 creditos). Dentro de la ventana de edicion de 4 horas lanza 10 PUT /api/jobs/55 en paralelo con seniority 'Jr' (6 creditos). Las 10 leen creditCost=12 y seniority='Director', las 10 ejecutan increment 6: la empresa recibe 60 creditos por una diferencia real de 6. Repite con otra vacante y publica gratis indefinidamente.
- **Arreglo propuesto:** Envolver todo en prisma.$transaction y reclamar el cambio de forma atomica: tx.job.updateMany({ where:{ id: jobId, creditCost: originalCost, seniority: currentSeniority, workMode: currentWorkMode, profile: currentProfile }, data:{ creditCost: newCost, ... } }) y continuar solo si count === 1 (si no, responder 409). Para el cobro usar tx.user.updateMany({ where:{ id, credits:{ gte: difference } }, data:{ credits:{ decrement: difference } } }) y validar count. Calcular balanceBefore/After desde el usuario devuelto por el update dentro de la transaccion.
- **Otros auditores añaden:** Envolver todo en prisma.$transaction y reclamar la vacante de forma optimista: tx.job.updateMany({ where: { id: jobId, creditCost: originalCost }, data: { creditCost: newCost, ...campos } }); si count===0 abortar con 409. Para el cargo usar updateMany con credits: { gte: difference }. Derivar balanceBefore/After del usuario devuelto por el update. — Envolver todo en prisma.$transaction y reclamar el estado previo de forma optimista: `tx.job.updateMany({ where: { id, creditCost: originalCost, profile: currentProfile, seniority: currentSeniority, workMode: currentWorkMode }, data: {...nuevos campos, creditCost: newCost} })`; si count===0 abortar con 409. Para cobros usar `tx.user.updateMany({ where: { id, credits: { gte: difference } }, data: { credits: { decrement: difference } } })` y verificar count===1. Registrar el ledger dentro de la misma transacción con el saldo devuelto por el update.

#### VAC-005 — /api/jobs/publish: el chequeo de saldo dentro de la transacción no bloquea y la activación del borrador queda fuera

- **Severidad:** 🟠 high · **Categoría:** payments · **Estado:** arreglo previo incompleto · **Verificación:** ✅ verificada contra el código
- **Ubicación:** `src/app/api/jobs/publish/route.ts:363` · relacionados: `src/app/api/jobs/route.ts`, `prisma/schema.prisma`
- **Problema:** El comentario dice 'Leer usuario dentro de la transacción para bloqueo', pero un findUnique en Postgres READ COMMITTED no toma lock: dos transacciones leen el mismo saldo, ambas pasan el if y ambos decrement se aplican (no hay CHECK credits>=0 en el esquema). Además en PUT la comprobación `job.status !== 'draft'` (l.344) y el `prisma.job.update` a 'active' (l.419) están fuera de la transacción: dos PUT del mismo borrador cobran dos veces, y si el update falla se pierden los créditos con la vacante aún en draft. Aplica también al POST 'arreglado' (l.209-214).
- **Comprobación:** Confirmado: hay `$transaction`, pero el `findUnique` dentro no bloquea la fila (READ COMMITTED), así que la comprobación de saldo es TOCTOU.
- **Evidencia:**

```ts
const result = await prisma.$transaction(async (tx) => {
  // Leer usuario dentro de la transacción para bloqueo
  const freshUser = await tx.user.findUnique({ where: { id: user.id } });
  if (!freshUser || freshUser.credits < creditCost) {
    throw new Error('INSUFFICIENT_CREDITS');
  }
  const updatedUser = await tx.user.update({
    where: { id: user.id },
    data: { credits: { decrement: creditCost } }
  });
```

- **Escenario de fallo:** Empresa con 10 créditos y 5 borradores de 10 créditos lanza 5 PUT /api/jobs/publish en paralelo: las 5 transacciones leen credits=10, pasan el chequeo y decrementan -> saldo -40 y 5 vacantes activas. Doble clic/reintento sobre el mismo borrador: ambos pasan el chequeo de draft y se cobra dos veces una sola vacante.
- **Arreglo propuesto:** Dentro de una única transacción: 1) reclamar el borrador con `tx.job.updateMany({ where: { id: jobId, status: 'draft' }, data: { status: 'active', creditCost, editableUntil } })` y abortar si count===0; 2) descontar con `tx.user.updateMany({ where: { id, credits: { gte: creditCost } }, data: { credits: { decrement: creditCost } } })` y abortar si count===0; 3) crear el asiento. Añadir CHECK (credits >= 0) en una migración como red de seguridad.

#### VAC-006 — Vacantes confidenciales se de-anonimizan y los borradores son publicos: GET /api/jobs y /api/jobs/publish (fuera del matcher) siguen aceptando includeDrafts/status/userId sin sesion

- **Severidad:** 🟠 high · **Categoría:** security · **Estado:** arreglo previo incompleto · **Verificación:** ✅ verificada contra el código
- **Ubicación:** `src/app/api/jobs/route.ts:10` · relacionados: `src/app/api/jobs/publish/route.ts`, `src/app/api/jobs/[id]/route.ts`
- **Problema:** El arreglo #14/#40 y #15/#41 solo condiciono a sesion la entrega de notasInternas y de los datos reales de confidenciales. Siguen sin auth: (a) `includeDrafts=true` y `status=draft|paused|closed`, que listan vacantes no publicadas de cualquier empresa; (b) el filtro `?userId=N`. Ademas sanitizeConfidentialJob solo pisa company, location y logoUrl: la respuesta publica conserva `userId`, `latitude` y `longitude` de la vacante confidencial, lo que permite correlacionarla con las vacantes no confidenciales del mismo userId (con nombre de empresa) o con las coordenadas exactas de la oficina. En /api/jobs/publish GET ni siquiera se llama a getOptionalAuthUser.
- **Comprobación:** Confirmado: `sanitizeConfidentialJob` sólo reescribe `company`, `location` y `logoUrl`; el resto del objeto pasa con `...job`.
- **Evidencia:**

```ts
function sanitizeConfidentialJob(job: any, isOwnerOrAdmin: boolean) {
  if (!job.isConfidential || isOwnerOrAdmin) {
    return job;
  }
  return {
    ...job,
    company: 'Empresa Confidencial',
    location: job.location ? job.location.split(',').pop()?.trim() || 'México' : 'México', // Solo estado/país
    logoUrl: null, // Ocultar logo en vacantes confidenciales
  };
}
...
    if (!includeDrafts) {
      where.status = status;
```

- **Escenario de fallo:** Visitante anonimo: GET /api/jobs -> ve la vacante confidencial X con company 'Empresa Confidencial' pero userId 12 y lat/long exactas; en la misma respuesta la vacante Y tiene userId 12 y company 'ACME SA'. Queda identificada la empresa que queria publicar en confidencial (p.ej. para reemplazar a alguien). GET /api/jobs?includeDrafts=true o GET /api/jobs/publish?userId=12&includeDrafts=true lista ademas borradores, pausadas y cerradas de cualquier empresa (titulo, descripcion, salario).
- **Arreglo propuesto:** En sanitizeConfidentialJob (jobs/route.ts, jobs/[id]/route.ts y jobs/publish/route.ts) eliminar tambien userId, latitude, longitude y cualquier otro identificador (usar un `select` explicito de campos publicos en vez de spread). Aceptar `includeDrafts`, `status` distinto de 'active' y `userId` solo cuando getOptionalAuthUser() devuelve al propietario o a un admin; para el resto forzar status='active' y no aplicar userId. Aplicar lo mismo al GET de /api/jobs/publish (o eliminarlo si es duplicado) y a /api/my-applications, que aplica su propia sanitizacion.
- **Otros auditores añaden:** Sustituir el spread por un DTO público con whitelist de campos (id, title, company, location, salary*, jobType, workMode, description, requirements, profile, subcategory, seniority, educationLevel, habilidades..., createdAt, logoUrl). Para confidenciales devolver latitude/longitude = null y nunca userId/creditCost/editableUntil/closedReason. Extraer la función a src/lib/jobs-public.ts y usarla en las tres rutas; ampliar __tests__/api/confidential-jobs.test.ts para afirmar que esos campos no salen. — En sanitizeConfidentialJob (las tres copias: jobs/route.ts, jobs/[id]/route.ts, jobs/publish/route.ts; idealmente moverla a src/lib/jobs-public.ts) eliminar tambien userId, latitude, longitude, creditCost, editableUntil. Mejor: construir la respuesta publica con un select/whitelist explicito de campos para TODAS las vacantes (userId no debe salir nunca en la vista publica). Ignorar el query param userId cuando !isOwnerView, o excluir confidenciales del resultado filtrado por userId.

#### VAC-007 — Publicación gratis o rebajada omitiendo/falseando profile, seniority o workMode

- **Severidad:** 🟠 high · **Categoría:** payments · **Estado:** nuevo · **Verificación:** ✅ verificada contra el código
- **Ubicación:** `src/app/api/jobs/route.ts:283` · relacionados: `src/app/api/jobs/publish/route.ts`, `src/lib/pricing.ts`
- **Problema:** El costo sólo se calcula si llegan los tres campos; si falta alguno creditCost queda en 0 y la publicación procede (`user.credits >= 0`). Ninguno de los tres es obligatorio en el servidor (sólo title, company, location, salary, jobType, description). Además seniority y workMode no se validan contra ningún catálogo: un valor inventado hace que calculateJobCreditCost devuelva found:false y el DEFAULT_CREDITS=5. El mismo patrón está en /api/jobs/publish POST (l.165-169) y PUT (l.352-356), donde el costo sale de los campos guardados en el borrador.
- **Comprobación:** Confirmado: los campos obligatorios son title/company/location/salary/jobType/description; `profile`, `seniority` y `workMode` no lo son, y `creditCost` sólo se calcula `if (profile && seniority && workMode)`.
- **Evidencia:**

```ts
let creditCost = 0;
if (profile && seniority && workMode) {
  const pricingResult = await calculateJobCreditCost(profile, seniority, workMode);
  creditCost = pricingResult.credits;
}
...
} else if (user.role === 'company') {
  if (user.credits >= creditCost) {
    initialStatus = 'active';
```

- **Escenario de fallo:** Empresa con 0 créditos envía POST /api/jobs con publishNow:true y sin `seniority` -> vacante 'active' con costo 0. Variante: seniority:'Director.' (con punto) -> no hay fila en PricingMatrix -> cobra 5 en vez del precio real. Variante borrador: PUT /api/jobs/{id} con seniority:'' sobre un draft y luego PUT /api/jobs/publish -> costo 0.
- **Arreglo propuesto:** Al publicar (POST con publishNow y PUT /publish) exigir profile, seniority y workMode no vacíos; validar workMode ∈ {remote,hybrid,presential} y seniority contra los valores de PricingMatrix; si `pricingResult.found === false` responder 400 en vez de usar el default; rechazar creditCost<=0 para rol company. Centralizar en una función `resolvePublishCost()` usada por las tres rutas.
- **Otros auditores añaden:** En los tres puntos de publicacion (POST /api/jobs, POST y PUT /api/jobs/publish): si se va a publicar (publishNow o PUT publish) y falta profile/seniority/workMode, responder 400. Validar seniority y workMode contra listas cerradas. Nunca aceptar creditCost<=0 para rol company. — En ambas rutas, cuando publishNow sea true (y en el PUT de publicar borrador) exigir profile, seniority y workMode validos (400 si faltan) y rechazar la publicacion de empresa si el costo calculado es <= 0 o found=false. Considerar hacer profile/seniority NOT NULL para vacantes no-draft mediante validacion zod compartida.

#### VAC-008 — El fix de atomicidad #6 no se aplico a POST /api/jobs, que es la ruta que realmente usa el formulario: saldo negativo y creditos perdidos

- **Severidad:** 🟠 high · **Categoría:** data-integrity · **Estado:** arreglo previo incompleto · **Verificación:** ✅ verificada contra el código
- **Ubicación:** `src/app/api/jobs/route.ts:300` · relacionados: `src/app/api/jobs/publish/route.ts`, `src/components/sections/jobs/CreateJobForm.tsx`
- **Problema:** CreateJobForm publica con POST /api/jobs (no con /api/jobs/publish, donde se hizo el fix #6). Aqui el chequeo de saldo, el decremento, el asiento del ledger y la creacion de la vacante son cuatro operaciones sueltas sin transaccion: (a) dos requests concurrentes pasan ambos user.credits >= creditCost y dejan saldo negativo; (b) si prisma.job.create lanza despues del decremento (p. ej. expiresAt invalido -> Invalid Date, o un campo con tipo incorrecto), el catch vacio responde 500 y los creditos ya se descontaron, con un asiento 'spend' huerfano (jobId null); (c) balanceBefore/balanceAfter se calculan con el saldo leido antes, no con el real; (d) el jobId se enlaza despues con updateMany por description+jobId null, que puede enlazar asientos de otra vacante con el mismo titulo.
- **Comprobación:** Confirmado: `findUnique` → `user.update({decrement})` → `creditTransaction.create` → `job.create`, todo fuera de `$transaction`.
- **Evidencia:**

```ts
if (user.credits >= creditCost) {
  initialStatus = 'active';

  await prisma.user.update({
    where: { id: userId },
    data: { credits: { decrement: creditCost } }
  });

  await prisma.creditTransaction.create({
    data: { userId: userId, type: 'spend', amount: -creditCost,
      balanceBefore: user.credits, balanceAfter: user.credits - creditCost,
```

- **Escenario de fallo:** Empresa con 10 creditos lanza en paralelo 3 POST /api/jobs de vacantes Sr (10 creditos c/u, publishNow). Las tres leen credits=10, pasan el if y decrementan: saldo final -20 y tres vacantes activas pagando una. Variante accidental: envio con expiresAt:'abc' -> se descuentan 10 creditos, job.create lanza, respuesta 500 'Failed to create job' y no hay vacante.
- **Arreglo propuesto:** Reutilizar la logica transaccional de publish/route.ts pero con decremento condicional: dentro de prisma.$transaction hacer tx.user.updateMany({ where: { id: userId, credits: { gte: creditCost } }, data: { credits: { decrement: creditCost } } }); si count===0 -> 402. Luego tx.job.create y tx.creditTransaction.create con jobId directo y balances derivados del saldo posterior. Eliminar el updateMany por description.
- **Otros auditores añaden:** Reutilizar la transacción de publish/route.ts pero con decremento condicional: dentro de prisma.$transaction hacer `tx.user.updateMany({ where: { id: userId, credits: { gte: creditCost } }, data: { credits: { decrement: creditCost } } })` (count===1 o lanzar INSUFFICIENT_CREDITS), `tx.job.create`, y `tx.creditTransaction.create` con jobId. Eliminar el updateMany por descripción (l.377-386). Validar expiresAt/latitude antes de tocar créditos. — Reutilizar en POST /api/jobs la misma logica transaccional de /api/jobs/publish (extraerla a src/lib/publish-job.ts): dentro de prisma.$transaction hacer updateMany({ where: { id: userId, credits: { gte: creditCost } }, data: { credits: { decrement: creditCost } } }) y abortar si count===0, crear el Job y crear el CreditTransaction ya con jobId. Eliminar el updateMany por description.

#### VAC-009 — El email es la llave de identidad pero nunca se verifica: registrarse con el correo de otra persona expone sus postulaciones anonimas (telefono, CV, carta y notas internas)

- **Severidad:** 🟠 high · **Categoría:** security · **Estado:** nuevo · **Verificación:** sin verificar (reportada por 1 auditor)
- **Ubicación:** `src/app/api/my-applications/route.ts:26` · relacionados: `src/app/api/auth/register/route.ts`, `src/app/api/applications/route.ts`, `prisma/schema.prisma`
- **Problema:** POST /api/applications es publico y permite postular sin cuenta (userId null) con cualquier candidateEmail. POST /api/auth/register crea el User con emailVerified: new Date() sin enviar ningun correo de verificacion. GET /api/my-applications devuelve todas las Application cuyo candidateEmail coincide con el email de la sesion y hace spread de la fila completa (...app), incluyendo candidatePhone, cvUrl (blob publico), coverLetter y notes (notas internas de admin/empresa, que /api/candidate/applications si anula).
- **Evidencia:**

```ts
// src/app/api/my-applications/route.ts:24-27
    const applications = await prisma.application.findMany({
      where: {
        OR: [{ userId: parseInt(userId) }, { candidateEmail: userEmail }]
      },
// src/app/api/my-applications/route.ts:85
      return { ...app, job: jobWithoutUser };
// src/app/api/auth/register/route.ts:207-209
          role: 'candidate',
          isActive: true,
          emailVerified: new Date()
```

- **Escenario de fallo:** Maria postula sin cuenta a 3 vacantes con maria@ejemplo.com. Un tercero que conoce su correo se registra en /register con maria@ejemplo.com y una contrasena propia (no hay verificacion; el registro solo falla si ya existe User o Candidate). Inicia sesion, llama GET /api/my-applications y obtiene las 3 postulaciones de Maria con su telefono, la URL publica de su CV, su carta de presentacion y las notas internas ('Sin experiencia requerida...'). Ademas Maria ya no puede crear su cuenta (409).
- **Arreglo propuesto:** Implementar verificacion real de correo (token de un solo uso; emailVerified null hasta confirmar) y no enlazar postulaciones por email para usuarios sin emailVerified; en my-applications filtrar solo por userId (y por candidateId cuando exista la FK) y devolver un select explicito sin notes. Al confirmar el correo, reclamar las Application anonimas de ese email asignandoles userId.

#### VAC-010 — La bolsa publica (/talents) solo muestra las 20 vacantes mas recientes: el cliente ignora la paginacion de GET /api/jobs

- **Severidad:** 🟠 high · **Categoría:** frontend-bug · **Estado:** nuevo · **Verificación:** sin verificar (reportada por 2 auditores)
- **Ubicación:** `src/components/sections/talents/SearchPositionsSection.tsx:132` · relacionados: `src/app/api/jobs/route.ts`, `src/lib/pagination.ts`
- **Problema:** GET /api/jobs esta paginado (default 20, max 100) pero el job board lo llama sin page/limit, guarda data.data como si fuera el universo completo y filtra/ordena en el cliente. No hay UI de paginacion ni 'cargar mas' y nunca se lee data.pagination. La API ya soporta search/location/jobType/profile en servidor, pero el cliente no los envia. Es el unico consumidor publico del listado, asi que cualquier vacante fuera de las 20 mas recientes es invisible e inencontrable.
- **Evidencia:**

```ts
// SearchPositionsSection.tsx:132
const response = await fetch('/api/jobs?status=active');
const data = await response.json();
if (data.success) {
  setJobs(data.data);

// api/jobs/route.ts:98
const pagination = getPaginationParams(searchParams, 20);
...
  skip: pagination.skip,
  take: pagination.take,
```

- **Escenario de fallo:** Hay 35 vacantes activas. Una empresa pago creditos por una vacante publicada hace 3 semanas (posicion 28 por createdAt desc). Un candidato entra a /talents y escribe el titulo exacto en el buscador: el filtro corre solo sobre las 20 cargadas y devuelve 'No se encontraron vacantes'. La vacante pagada nunca recibe postulaciones.
- **Arreglo propuesto:** Mover el filtrado al servidor: enviar search, location, jobType, profile, page y limit como query params (con debounce de 300 ms), usar data.pagination.hasNext/total para paginar o hacer infinite scroll, y agregar orden (sort) como parametro de la API en lugar de ordenar en cliente. Mantener selectedJob por id.
- **Otros auditores añaden:** Mover búsqueda/filtros al servidor: enviar search, location, jobType, profile, page y limit como query params (la API ya los soporta), con debounce, y añadir paginación o scroll infinito usando `pagination.hasNext`. Añadir soporte de `sort` en la API para que el orden sea global.

## 🟡 medium (23)

#### VAC-011 — GET /api/applications sin paginacion ni select, y el cliente lo descarga completo para contar asignaciones por candidato

- **Severidad:** 🟡 medium · **Categoría:** performance · **Estado:** nuevo · **Verificación:** sin verificar (reportada por 1 auditor)
- **Ubicación:** `src/app/api/applications/route.ts:32` · relacionados: `src/app/admin/assign-candidates/page.tsx`, `src/app/admin/page.tsx`, `src/components/sections/applications/ApplicationsManagementPanel.tsx`
- **Problema:** El listado de aplicaciones no tiene take/skip y trae todas las columnas (coverLetter y notes son @db.Text) mas include de job y user. Lo consumen tres clientes: ApplicationsManagementPanel (/applications), el dashboard admin (solo para .length) y assign-candidates, que lo descarga COMPLETO cada vez que se selecciona una vacante o se asignan candidatos, solo para contar cuantas aplicaciones tiene cada uno de los 30 candidatos visibles, con un bucle O(N*M) usando emails.includes().
- **Evidencia:**

```ts
// api/applications/route.ts:32
const applications = await prisma.application.findMany({
  where,
  include: { job: { select: {...} }, user: { select: {...} } },
  orderBy: { createdAt: 'desc' }
});
// admin/assign-candidates/page.tsx:323
const response = await fetch('/api/applications');
...
for (const app of data.data) {
  const email = app.candidateEmail?.toLowerCase();
  if (email && emails.includes(email)) {
```

- **Escenario de fallo:** Con 20,000 aplicaciones, cada vez que el admin cambia de vacante en /admin/assign-candidates se ejecuta un findMany de 20k filas con dos joins, se serializan varios MB (por encima del limite de 4.5 MB de respuesta en Vercel la llamada falla y aparece 'Error al cargar las asignaciones') y el navegador recorre 20k x 30 comparaciones. Lo mismo al pulsar 'Asignar'.
- **Arreglo propuesto:** Agregar paginacion obligatoria (getPaginationParams) y un select minimo a GET /api/applications. Para los conteos crear un endpoint POST /api/admin/candidates/assignment-counts que reciba los emails visibles y responda prisma.application.groupBy({ by:['candidateEmail'], where:{ candidateEmail:{ in: emails } }, _count:true }). En fetchAlreadyAssigned pedir solo select candidateEmail.

#### VAC-012 — Sin unicidad (jobId, candidateEmail): el check findFirst + create genera postulaciones duplicadas bajo concurrencia

- **Severidad:** 🟡 medium · **Categoría:** data-integrity · **Estado:** nuevo · **Verificación:** sin verificar (reportada por 2 auditores)
- **Ubicación:** `src/app/api/applications/route.ts:133` · relacionados: `prisma/schema.prisma`, `src/app/api/admin/assign-candidates/route.ts`, `src/app/api/recruiter/dashboard/route.ts`
- **Problema:** Tres rutas crean Application despues de un 'ya existe?' no atomico y el esquema solo tiene indices simples sobre jobId y candidateEmail, sin @@unique. POST /api/applications hace findFirst y luego create; admin/assign-candidates hace findMany y luego createMany sin skipDuplicates; recruiter/dashboard PUT hace findFirst + create dentro de un for secuencial (N+1, sin transaccion). Los duplicados despues inflan conteos del pipeline y aparecen dos veces en los dashboards.
- **Evidencia:**

```ts
const existingApplication = await prisma.application.findFirst({
  where: { jobId: parseInt(jobId), candidateEmail: candidateEmail.toLowerCase() }
});
if (existingApplication) { return ... 'Ya has aplicado a esta vacante anteriormente' }
const application = await prisma.application.create({ data: { ... } });
// schema.prisma:273-277  @@index([jobId]) @@index([userId]) @@index([status]) @@index([candidateEmail]) @@index([createdAt])
// admin/assign-candidates/route.ts:94  prisma.application.createMany({ data: ... })  (sin skipDuplicates)
```

- **Escenario de fallo:** Un candidato hace doble click en 'POSTULARME' (o el admin inyecta al candidato en el mismo instante en que este se postula): ambas peticiones pasan el findFirst y se insertan dos Application para el mismo email y vacante. El reclutador ve al candidato duplicado, mueve una copia a 'discarded' y la otra sigue a la empresa; los admins reciben dos notificaciones.
- **Arreglo propuesto:** Agregar @@unique([jobId, candidateEmail]) a Application (previa limpieza de duplicados existentes con una migracion revisada), capturar P2002 en POST /api/applications y responder 409, usar skipDuplicates: true en createMany de assign-candidates, y reemplazar el bucle del recruiter por upsert/createMany + updateMany dentro de una transaccion.
- **Otros auditores añaden:** Normalizar `candidateEmail.trim().toLowerCase()`, añadir `@@unique([jobId, candidateEmail])` (con migración que deduplique antes) y capturar P2002 devolviendo 409.

#### VAC-013 — POST /api/applications acepta cualquier candidateEmail aunque haya sesion: se puede postular en nombre de terceros y bloquearles la vacante

- **Severidad:** 🟡 medium · **Categoría:** authz · **Estado:** arreglo previo incompleto · **Verificación:** sin verificar (reportada por 2 auditores)
- **Ubicación:** `src/app/api/applications/route.ts:151` · relacionados: `src/components/sections/talents/ApplyJobModal.tsx`
- **Problema:** El arreglo #48 dejo de confiar en body.userId, pero candidateName/candidateEmail siguen viniendo del body incluso cuando hay sesion de candidato. La unicidad se controla por (jobId, candidateEmail), asi que quien llegue primero con un email ajeno ocupa el lugar de esa persona.
- **Evidencia:**

```ts
// src/app/api/applications/route.ts:133-137, 151-157
const existingApplication = await prisma.application.findFirst({
  where: { jobId: parseInt(jobId), candidateEmail: candidateEmail.toLowerCase() }
});
...
data: {
  jobId: parseInt(jobId),
  userId: sessionUserId,
  candidateName,
  candidateEmail: candidateEmail.toLowerCase(),
```

- **Escenario de fallo:** Un competidor por una vacante (con o sin cuenta) envia POST /api/applications {jobId: 50, candidateName: 'Rival', candidateEmail: 'rival@correo.com', cvUrl: 'https://.../cv-malo.pdf'}. Cuando el rival real intenta postular recibe 'Ya has aplicado a esta vacante anteriormente'; la postulacion falsa aparece en su /my-applications y el reclutador ve un CV que no es suyo.
- **Arreglo propuesto:** Si hay sesion con rol candidate/user: ignorar candidateEmail/candidateName del body y tomarlos del User/Candidate de la sesion (usar requireAuth para leer email real). Si hay sesion de otro rol (company, recruiter...) rechazar con 403. Para el flujo anonimo, exigir confirmacion por email (token) antes de pasar la aplicacion a 'pending', o al menos no bloquear al usuario autenticado real: la comprobacion de duplicado para usuarios logueados debe ser por userId.
- **Otros auditores añaden:** Exigir sesión (la UI ya obliga a iniciar sesión: SearchPositionsSection muestra 'INICIA SESIÓN PARA POSTULARTE'), cargar el usuario, permitir sólo roles candidate/user y forzar candidateEmail = user.email (y nombre/CV desde el perfil). Quitar la excepción de POST /api/applications del middleware y el formulario 'Aplicar sin cuenta', o bien exigir verificación de email para postulaciones anónimas.

#### VAC-014 — cvUrl de la postulación se guarda sin validar esquema y se renderiza como href crudo

- **Severidad:** 🟡 medium · **Categoría:** security · **Estado:** arreglo previo incompleto · **Verificación:** sin verificar (reportada por 1 auditor)
- **Ubicación:** `src/app/api/applications/route.ts:158` · relacionados: `src/app/admin/direct-applications/page.tsx`, `src/app/admin/assign-candidates/page.tsx`
- **Problema:** El fix #55 exigió http(s) sólo en fileUrl de documentos. POST /api/applications (público) acepta cualquier string en cvUrl. Varias vistas lo pasan por ensureUrl, pero src/app/admin/direct-applications/page.tsx l.282 y admin/assign-candidates l.777 usan `href={app.cvUrl}` directo. React 19 bloquea javascript:, pero no enlaces externos arbitrarios ni data:.
- **Evidencia:**

```ts
cvUrl: cvUrl || null,
coverLetter: coverLetter || null,
status: 'pending'
```

- **Escenario de fallo:** Atacante anónimo postula con cvUrl:'https://evil.example/cv.pdf.exe' (o una página de phishing que imita el login de INAKAT). El admin hace clic en 'Ver CV' en /admin/direct-applications y descarga malware o entrega credenciales.
- **Arreglo propuesto:** Validar en el servidor que cvUrl sea https y pertenezca al host de Vercel Blob propio (o a una allowlist); rechazar con 400 en otro caso. Usar ensureUrl/validador común en todos los href de CV. Limitar longitud de coverLetter, candidateName y validar formato de email.

#### VAC-015 — Notificación a admins y webhook candidate.accepted son fire-and-forget en serverless

- **Severidad:** 🟡 medium · **Categoría:** reliability · **Estado:** nuevo · **Verificación:** sin verificar (reportada por 1 auditor)
- **Ubicación:** `src/app/api/applications/route.ts:173` · relacionados: `src/app/api/applications/[id]/route.ts`, `src/lib/worky2-webhook.ts`
- **Problema:** notifyAllAdmins se lanza sin await y, en applications/[id]/route.ts l.439-441, `void dispatchCandidateAccepted(applicationId)` (que hace varias consultas y un fetch de hasta 5 s) también. En Vercel la función puede congelarse al enviar la respuesta, por lo que el trabajo pendiente se pierde. Es el mismo patrón que #70 corrigió en el webhook de MercadoPago.
- **Evidencia:**

```ts
// Notificar a admins (fire-and-forget)
notifyAllAdmins({
  type: 'new_application',
  title: 'Nueva aplicación recibida',
  ...
}).catch(() => {});
```

- **Escenario de fallo:** Admin marca 'Aceptar' en /applications: la respuesta 200 sale en ms, la lambda se suspende y el POST firmado a Worky2 nunca se envía; la empresa integrada no recibe la contratación. Igualmente se pierden notificaciones de nuevas postulaciones.
- **Arreglo propuesto:** Usar `after(() => dispatchCandidateAccepted(id))` / `after(() => notifyAllAdmins(...))` de 'next/server' (estable en Next 15.1+) o hacer await con Promise.allSettled antes de responder. Registrar entregas fallidas para reintento.

#### VAC-016 — Estados evaluating, company_interested, discarded y archived no están mapeados: el candidato ve un estado falso

- **Severidad:** 🟡 medium · **Categoría:** correctness · **Estado:** nuevo · **Verificación:** sin verificar (reportada por 1 auditor)
- **Ubicación:** `src/app/api/candidate/applications/route.ts:168` · relacionados: `src/app/api/applications/check/route.ts`, `src/app/my-applications/page.tsx`, `src/app/candidate/applications/page.tsx`
- **Problema:** El switch de etiquetas cubre 8 de los 12 estados; el resto cae en default 'En revisión'. /api/applications/check usa otro mapa (default 'En proceso') y /my-applications usa `badges[status] || badges.pending` ('Pendiente'). Recruiter y specialist ponen 'discarded' (recruiter/dashboard l.437, specialist/dashboard l.377) y la empresa pone 'company_interested'.
- **Evidencia:**

```ts
case 'rejected':
  statusLabel = 'No seleccionado';
  statusColor = 'gray';
  break;
default:
  statusLabel = 'En revisión';
  statusColor = 'yellow';
```

- **Escenario de fallo:** Un reclutador descarta al candidato: en /candidate/applications seguirá viendo 'En revisión' indefinidamente (nunca 'No seleccionado'). Cuando la empresa marca interés (sent_to_company -> company_interested) la etiqueta retrocede de 'Enviado a empresa' a 'En revisión'. El mismo registro dice 'En proceso' en el modal de postulación y 'Pendiente' en /my-applications. Las tarjetas de estadísticas no suman el total.
- **Arreglo propuesto:** Crear src/lib/application-status.ts con un único mapa candidato-facing para los 12 estados (evaluating->'En proceso', company_interested->'Empresa interesada', discarded/archived->'No seleccionado' o 'Proceso finalizado') y usarlo en las dos rutas, en check y en ambas páginas.

#### VAC-017 — Las rutas de vacantes autorizan sólo con el JWT: un usuario desactivado sigue editando, borrando y publicando

- **Severidad:** 🟡 medium · **Categoría:** authz · **Estado:** nuevo · **Verificación:** sin verificar (reportada por 1 auditor)
- **Ubicación:** `src/app/api/jobs/[id]/route.ts:24` · relacionados: `src/app/api/jobs/publish/route.ts`, `src/lib/auth.ts`
- **Problema:** verifyJobOwnership compara job.userId con payload.userId sin consultar la BD (isActive, rol actual). PUT /api/jobs/publish sí carga el usuario pero no mira isActive (l.302-311). En cambio POST /api/jobs usa requireRole, que sí lo valida. El token dura 7 días. Distinto del pendiente #20/#26 (reset de contraseña): aquí basta con usar los helpers existentes.
- **Evidencia:**

```ts
const payload = verifyToken(token);
if (!payload?.userId) {
  return { authenticated: false, authorized: false, error: 'Token inválido' };
}
const isAdmin = payload.role === 'admin';
const isOwner = jobUserId === payload.userId;
```

- **Escenario de fallo:** Admin desactiva una empresa por fraude (isActive=false). Con su cookie aún vigente la empresa sigue pudiendo PATCH/PUT/DELETE sus vacantes y publicar borradores vía PUT /api/jobs/publish durante hasta 7 días. Un admin degradado a otro rol conserva el bypass de admin hasta que expire el token.
- **Arreglo propuesto:** Sustituir verifyJobOwnership y el bloque manual de PUT /publish por requireAuth()/requireRole(['company','admin']) de src/lib/auth.ts (validan isActive y rol en BD) y después comparar job.userId con auth.user.id.

#### VAC-018 — La empresa puede borrar una vacante con postulaciones: el DELETE en cascada destruye aplicaciones, notas de evaluacion, calificaciones y entrevistas

- **Severidad:** 🟡 medium · **Categoría:** data-integrity · **Estado:** nuevo · **Verificación:** sin verificar (reportada por 2 auditores)
- **Ubicación:** `src/app/api/jobs/[id]/route.ts:644` · relacionados: `prisma/schema.prisma`
- **Problema:** DELETE solo comprueba ownership. Application tiene onDelete: Cascade respecto a Job, y EvaluationNote/SkillRating/InterviewRequest cascada respecto a Application, de modo que el trabajo de reclutadores y especialistas y el historial del candidato desaparecen. CreditTransaction.jobId queda apuntando a una vacante inexistente.
- **Evidencia:**

```ts
// src/app/api/jobs/[id]/route.ts:643-646
// Eliminar vacante
await prisma.job.delete({
  where: { id: jobId }
});

// prisma/schema.prisma:241
job  Job  @relation(fields: [jobId], references: [id], onDelete: Cascade)
```

- **Escenario de fallo:** Una empresa en disputa con INAKAT (o por error) envia DELETE /api/jobs/88 sobre una vacante activa con 40 postulaciones en proceso: desaparecen de los dashboards de admin, reclutador, especialista y de /my-applications de los 40 candidatos, sin posibilidad de recuperacion ni rastro de auditoria.
- **Arreglo propuesto:** Para rol company permitir DELETE solo si status === 'draft' y _count.applications === 0; en otro caso responder 409 e indicar cerrar la vacante (status 'closed'). Para admin, implementar borrado logico (status 'archived' / deletedAt).
- **Otros auditores añaden:** Permitir borrado físico sólo de borradores sin postulaciones; para el resto hacer soft-delete (status 'closed'/'deleted' + deletedAt) o responder 409 si `_count.applications > 0`. Exigir confirmación de admin para borrado definitivo.

#### VAC-019 — GET /api/jobs/publish: endpoint publico, sin paginacion, sin consumidores, que expone borradores y vacantes cerradas de todas las empresas

- **Severidad:** 🟡 medium · **Categoría:** security · **Estado:** nuevo · **Verificación:** sin verificar (reportada por 1 auditor)
- **Ubicación:** `src/app/api/jobs/publish/route.ts:44` · relacionados: `src/app/api/jobs/route.ts`, `src/middleware.ts`
- **Problema:** Es una copia antigua de GET /api/jobs que quedo viva: /api/jobs no esta en el matcher del middleware, asi que es anonimo; no tiene take/skip (a diferencia de /api/jobs), devuelve description completa y acepta ?includeDrafts=true, ?status=draft y ?userId=, con lo que cualquiera lista borradores, pausadas y cerradas de cualquier empresa. Ningun cliente del repo usa este GET (solo se usa el PUT). GET /api/jobs comparte la fuga de borradores via includeDrafts/status, aunque paginada, y tampoco filtra vacantes expiradas en esta copia.
- **Evidencia:**

```ts
// Si pide incluir drafts, no filtrar por status
if (!includeDrafts) {
  where.status = status;
}
// Filtrar por usuario específico
if (userId) {
  where.userId = parseInt(userId);
}
...
const jobs = await prisma.job.findMany({
  where,
  orderBy: { createdAt: 'desc' },
  include: { _count: { select: { applications: true } } }
});
```

- **Escenario de fallo:** Un competidor (sin sesion) ejecuta curl '/api/jobs/publish?includeDrafts=true' en bucle: cada llamada hace un full scan de Job con todos los campos @db.Text y serializa toda la tabla (DoS barato sin rate limit), y ademas obtiene los borradores aun no publicados de cada empresa (puesto, salario, descripcion) filtrando por ?userId=.
- **Arreglo propuesto:** Eliminar el handler GET de /api/jobs/publish (no tiene consumidores). En GET /api/jobs permitir includeDrafts y status distinto de 'active' solo cuando isOwnerView sea true (sesion = userId solicitado o admin); para anonimos forzar status='active' + filtro de expiracion. Agregar applyRateLimit al listado publico.

#### VAC-020 — La transaccion de /api/jobs/publish no bloquea la fila (findUnique no es SELECT FOR UPDATE) y User.credits no tiene CHECK >= 0: doble gasto concurrente deja saldo negativo

- **Severidad:** 🟡 medium · **Categoría:** payments · **Estado:** arreglo previo incompleto · **Verificación:** sin verificar (reportada por 3 auditores)
- **Ubicación:** `src/app/api/jobs/publish/route.ts:211` · relacionados: `prisma/schema.prisma`, `src/app/api/jobs/route.ts`
- **Problema:** El comentario afirma que leer dentro de la transaccion 'bloquea la fila', pero en PostgreSQL (READ COMMITTED) un SELECT normal no toma lock. Dos transacciones leen el mismo saldo, ambas pasan la comprobacion y ambos decrement se aplican en serie. El esquema no define ninguna restriccion que impida credits < 0. El mismo patron esta en el PUT de publicar borrador (lineas 363-377).
- **Evidencia:**

```ts
        job = await prisma.$transaction(async (tx) => {
          // Leer dentro de la transacción para bloquear la fila del usuario.
          const freshUser = await tx.user.findUnique({ where: { id: userId } });
          if (!freshUser || freshUser.credits < creditCost) {
            throw new Error('INSUFFICIENT_CREDITS');
          }
          const updatedUser = await tx.user.update({
            where: { id: userId },
            data: { credits: { decrement: creditCost } },
          });
```

- **Escenario de fallo:** Una empresa con 10 creditos lanza a la vez dos publicaciones de 10 creditos (dos pestanas o un script). T1 y T2 leen credits=10 y pasan el if; T1 descuenta (0) y confirma; T2, que esperaba el lock de la fila en el UPDATE, aplica credits = credits - 10 sobre el valor ya confirmado: saldo -10 y dos vacantes activas pagando una. El ledger de T2 registra balanceBefore 0 / balanceAfter -10.
- **Arreglo propuesto:** Sustituir leer+update por un decremento condicional atomico: const r = await tx.user.updateMany({ where: { id: userId, credits: { gte: creditCost } }, data: { credits: { decrement: creditCost } } }); if (r.count === 0) throw INSUFFICIENT_CREDITS. Agregar por migracion SQL 'ALTER TABLE "User" ADD CONSTRAINT user_credits_nonneg CHECK (credits >= 0)' como red de seguridad y corregir el comentario.
- **Otros auditores añaden:** Sustituir lectura+update por decremento condicional: const r = await tx.user.updateMany({ where: { id: userId, credits: { gte: creditCost } }, data: { credits: { decrement: creditCost } } }); if (r.count === 0) throw new Error('INSUFFICIENT_CREDITS'); y leer despues el saldo para el ledger. (Alternativa: SELECT ... FOR UPDATE via $queryRaw o isolationLevel Serializable con reintento.) — Sustituir el par findUnique+update por un decremento condicional atomico: const r = await tx.user.updateMany({ where:{ id:userId, credits:{ gte: creditCost } }, data:{ credits:{ decrement: creditCost } } }); if (r.count === 0) throw new Error('INSUFFICIENT_CREDITS'); y leer el saldo resultante despues. En el PUT, ademas, mover el job.update(status:'active') DENTRO de la misma transaccion con where { id, status:'draft' } para evitar publicar dos veces el mismo borrador.

#### VAC-021 — PUT /api/jobs/publish: el chequeo de 'draft' y la activacion quedan fuera de la transaccion (doble cobro por la misma vacante / creditos cobrados sin publicar)

- **Severidad:** 🟡 medium · **Categoría:** data-integrity · **Estado:** arreglo previo incompleto · **Verificación:** sin verificar (reportada por 1 auditor)
- **Ubicación:** `src/app/api/jobs/publish/route.ts:419` · relacionados: `src/app/company/dashboard/page.tsx`
- **Problema:** El estado 'draft' se valida en L344 con una lectura previa y la vacante se activa en L419 con un update separado, ambos fuera de la transaccion que descuenta creditos (L363-393). Dos PUT concurrentes del mismo jobId pasan ambos el chequeo y cobran dos veces; y si job.update falla tras confirmar el descuento, los creditos se pierden con la vacante aun en borrador (el mismo defecto que #6 corrigio solo en POST).
- **Evidencia:**

```ts
// Actualizar vacante a activa
const updatedJob = await prisma.job.update({
  where: { id: jobId },
  data: {
    status: 'active',
    creditCost: creditCost,
    editableUntil // Ahora sí inicia el cronómetro de 4 horas
  }
});
```

- **Escenario de fallo:** En el dashboard la empresa hace doble clic en 'Publicar' (o dos pestanas). Ambos PUT leen status 'draft', ambos descuentan 10 creditos y crean asiento 'spend'; la vacante queda activa una sola vez: 20 creditos cobrados por una publicacion.
- **Arreglo propuesto:** Mover la activacion dentro de la transaccion y hacerla condicional: const c = await tx.job.updateMany({ where: { id: jobId, status: 'draft' }, data: { status: 'active', creditCost, editableUntil } }); if (c.count === 0) throw new Error('ALREADY_PUBLISHED') ANTES de descontar creditos.

#### VAC-022 — La ubicación pública de una vacante confidencial se reduce a 'México' y no es filtrable por ciudad

- **Severidad:** 🟡 medium · **Categoría:** correctness · **Estado:** nuevo · **Verificación:** sin verificar (reportada por 1 auditor)
- **Ubicación:** `src/app/api/jobs/route.ts:19` · relacionados: `src/components/sections/jobs/CreateJobForm.tsx`, `src/app/api/jobs/[id]/route.ts`, `src/app/api/my-applications/route.ts`
- **Problema:** La sanitización toma el último segmento tras la última coma. CreateJobForm guarda `place.formatted_address` de Google con restricción country:'mx', cuyo último segmento es siempre 'México'. El formulario promete 'solo la ciudad/estado'. Si la ubicación no tiene comas se devuelve el string completo (posible dirección). CreateJobForm ya extrae ciudad y estado de address_components (l.172-184) pero los descarta.
- **Evidencia:**

```ts
location: job.location ? job.location.split(',').pop()?.trim() || 'México' : 'México', // Solo estado/país
```

- **Escenario de fallo:** Vacante confidencial en 'Av. Lázaro Cárdenas 2400, San Pedro Garza García, N.L., México' se muestra con ubicación 'México'. Un candidato que filtra por 'Monterrey' o 'N.L.' en /talents nunca la encuentra (el filtro de ubicación es en cliente sobre el valor saneado). Si la empresa tecleó 'Av Reforma 222 CDMX' sin comas, se publica la dirección completa.
- **Arreglo propuesto:** Persistir city y state como columnas propias al crear/editar (ya disponibles en onPlaceChanged/onMapClick) y construir la ubicación pública de las confidenciales como `${city}, ${state}`; sin esos datos devolver sólo 'México'. No devolver nunca el string original sin comas.

#### VAC-023 — Borradores, vacantes pausadas y cerradas de todas las empresas son publicos via ?status=, ?includeDrafts=true y GET /api/jobs/[id]

- **Severidad:** 🟡 medium · **Categoría:** authz · **Estado:** nuevo · **Verificación:** sin verificar (reportada por 2 auditores)
- **Ubicación:** `src/app/api/jobs/route.ts:51` · relacionados: `src/app/api/jobs/[id]/route.ts`, `src/app/api/jobs/publish/route.ts`
- **Problema:** El estado a listar lo decide el cliente. includeDrafts=true elimina el filtro de status sin exigir sesion ni ser propietario; status=draft tambien funciona. GET /api/jobs/[id] devuelve cualquier vacante sin mirar su status, y GET /api/jobs/publish repite el patron sin paginacion.
- **Evidencia:**

```ts
// src/app/api/jobs/route.ts:28, 35, 51-52
const status = searchParams.get('status') || 'active';
const includeDrafts = searchParams.get('includeDrafts') === 'true';
...
if (!includeDrafts) {
  where.status = status;

// src/app/api/jobs/[id]/route.ts:70-72 -> findUnique({ where: { id: jobId } }) sin filtro de status
```

- **Escenario de fallo:** Un competidor o scraper llama GET /api/jobs?includeDrafts=true&limit=100 sin cookie y recibe todos los borradores (planes de contratacion no publicados, salarios), vacantes cerradas y pausadas de todas las empresas. Tambien puede enumerar GET /api/jobs/1..N.
- **Arreglo propuesto:** En GET /api/jobs y GET /api/jobs/publish: si !isOwnerView forzar where.status='active' + no expirada e ignorar status/includeDrafts. En GET /api/jobs/[id]: si la vacante no esta 'active' (o esta expirada) y el solicitante no es owner/admin, responder 404. Valorar eliminar GET /api/jobs/publish (duplicado sin paginar).
- **Otros auditores añaden:** Si !isOwnerView forzar status='active' + filtro de expiración e ignorar `status`/`includeDrafts`. En GET /api/jobs/[id] responder 404 cuando status !== 'active' y el solicitante no es propietario ni admin. Eliminar el GET de /api/jobs/publish.

#### VAC-024 — Los filtros search/location/userId de GET /api/jobs des-anonimizan vacantes confidenciales

- **Severidad:** 🟡 medium · **Categoría:** security · **Estado:** nuevo · **Verificación:** sin verificar (reportada por 1 auditor)
- **Ubicación:** `src/app/api/jobs/route.ts:66`
- **Problema:** La búsqueda se ejecuta en BD contra los valores reales de company y location y sólo después se enmascara el resultado. El parámetro userId filtra para cualquiera (sólo la vista de propietario está protegida). Una coincidencia confirma qué empresa/dirección hay detrás de 'Empresa Confidencial'.
- **Evidencia:**

```ts
if (requestedUserId !== null && !Number.isNaN(requestedUserId)) {
  where.userId = requestedUserId;
}
if (search) {
  where.AND = [ ...,
    { OR: [
      { title: { contains: search, mode: 'insensitive' } },
      { company: { contains: search, mode: 'insensitive' } },
      ...
if (location) {
  where.location = { contains: location, mode: 'insensitive' };
```

- **Escenario de fallo:** Anónimo pide GET /api/jobs?search=AcmeCorp: recibe una vacante con company:'Empresa Confidencial' que sólo pudo coincidir por el nombre real -> confirma que Acme está contratando en secreto ese puesto. Igual con ?location=Av.+Constitución+123 o ?userId=57.
- **Arreglo propuesto:** Si no es vista de propietario: aplicar el match de company/location sólo a vacantes no confidenciales (`{ AND: [{ isConfidential: false }, { company: { contains } }] }`), para confidenciales comparar location únicamente contra el estado/ciudad público, e ignorar `userId` salvo isOwnerView.

#### VAC-025 — El dashboard admin y assign-candidates consumen /api/jobs como si devolviera todo: sólo reciben 20 vacantes activas

- **Severidad:** 🟡 medium · **Categoría:** correctness · **Estado:** nuevo · **Verificación:** sin verificar (reportada por 1 auditor)
- **Ubicación:** `src/app/api/jobs/route.ts:98` · relacionados: `src/app/admin/page.tsx`, `src/app/admin/assign-candidates/page.tsx`
- **Problema:** Contrato roto entre la API y sus consumidores admin. src/app/admin/page.tsx l.145 llama `fetch('/api/jobs')` sin parámetros: la API aplica status='active' por defecto y limit 20, pero la página calcula pausedJobs, draftJobs, closedJobs y totalJobs sobre esa lista. admin/assign-candidates l.268 llena el selector de vacantes con `/api/jobs?status=active` (máx. 20).
- **Evidencia:**

```ts
const status = searchParams.get('status') || 'active';
...
const pagination = getPaginationParams(searchParams, 20);
```

- **Escenario de fallo:** Admin abre /admin: 'Pausadas', 'Borradores' y 'Cerradas' siempre marcan 0 y 'Total' nunca pasa de 20. En /admin/assign-candidates, con más de 20 vacantes activas las más antiguas no aparecen y no se les pueden inyectar candidatos.
- **Arreglo propuesto:** Crear/usar un endpoint admin (p. ej. /api/admin/jobs) sin filtro de status y con paginación real o conteos agregados (groupBy status), y que ambas páginas lo consuman; o aceptar `all=true` sólo con sesión admin y paginar en el cliente.

#### VAC-026 — Una empresa puede publicar vacantes a nombre de cualquier otra empresa

- **Severidad:** 🟡 medium · **Categoría:** validation · **Estado:** nuevo · **Verificación:** sin verificar (reportada por 1 auditor)
- **Ubicación:** `src/app/api/jobs/route.ts:344` · relacionados: `src/app/api/jobs/[id]/route.ts`, `src/components/sections/jobs/CreateJobForm.tsx`
- **Problema:** En la UI el campo 'Nombre de la Empresa' es readOnly para el rol company (se precarga de companyRequest.nombreEmpresa), pero el servidor persiste `company` tal cual llega en POST, PUT y PATCH ('company' está en allowedPatchFields).
- **Evidencia:**

```ts
const job = await prisma.job.create({
  data: {
    title,
    company,
    location,
```

- **Escenario de fallo:** La empresa 'X SA' envía POST /api/jobs con company:'Google México' -> la vacante aparece en /talents como de Google (con el logo de X). Sirve para phishing de candidatos o para dañar a un competidor.
- **Arreglo propuesto:** Para rol company ignorar body.company y usar el nombre de su CompanyRequest aprobada (consulta por userId) en POST/PUT; quitar 'company' de allowedPatchFields para no-admin.

#### VAC-027 — expiresAt nunca se asigna: las vacantes no expiran y el estado 'expirada' es código muerto

- **Severidad:** 🟡 medium · **Categoría:** correctness · **Estado:** nuevo · **Verificación:** sin verificar (reportada por 1 auditor)
- **Ubicación:** `src/app/api/jobs/route.ts:357` · relacionados: `src/app/api/jobs/publish/route.ts`, `src/app/api/applications/route.ts`, `src/components/company/CompanyJobsTable.tsx`
- **Problema:** El único origen de expiresAt es el body del POST; CreateJobForm no lo envía y PUT /publish no lo fija al publicar. Ninguna otra ruta ni cron lo escribe (grep en src). El filtro de expiración de GET /api/jobs, los contadores de expiradas en api/company/dashboard y isExpired de CompanyJobsTable nunca se activan. POST /api/applications tampoco comprueba expiresAt. Un cliente API sí puede mandar una fecha arbitraria o inválida.
- **Evidencia:**

```ts
expiresAt: expiresAt ? new Date(expiresAt) : null,
```

- **Escenario de fallo:** Una empresa paga una vez y su vacante permanece activa y visible indefinidamente (además puede reactivar una cerrada con PATCH closed->active sin costo). Si alguien envía expiresAt:'mañana' por API, new Date da Invalid Date y Prisma lanza después de haber descontado créditos (ver hallazgo de atomicidad).
- **Arreglo propuesto:** Decidir la vigencia de negocio (p. ej. 30/45 días) y fijar expiresAt en el servidor al publicar (POST con publishNow y PUT /publish), ignorando el valor del cliente; rechazar postulaciones a vacantes expiradas en POST /api/applications; ofrecer 'renovar' con cobro en el dashboard.

#### VAC-028 — /api/my-applications entrega Application.notes (notas internas) al candidato y la pagina las muestra como 'Nota de la empresa'

- **Severidad:** 🟡 medium · **Categoría:** security · **Estado:** nuevo · **Verificación:** sin verificar (reportada por 2 auditores)
- **Ubicación:** `src/app/api/my-applications/route.ts:72` · relacionados: `src/app/my-applications/page.tsx`, `src/app/api/candidate/applications/route.ts`, `src/app/api/admin/assign-candidates/route.ts`
- **Problema:** La ruta gemela /api/candidate/applications anula el campo ('No mostrar notas internas al candidato'), pero /api/my-applications hace spread de la aplicacion completa. Application.notes lo escriben el admin (PATCH /api/applications/[id]), la empresa (PATCH /api/company/applications/[id]) y el inyector de candidatos con texto interno.
- **Evidencia:**

```ts
// src/app/api/my-applications/route.ts:72-85
if (app.job?.isConfidential) {
  return { ...app, job: { ... } };
}
return { ...app, job: jobWithoutUser };

// src/app/my-applications/page.tsx:394-398
{application.notes && ( ... <strong>Nota de la empresa:</strong>{' '}{application.notes}

// src/app/api/admin/assign-candidates/route.ts:102
notes: `Candidato inyectado por Admin. Fuente original: ${candidate.source}. ...`
```

- **Escenario de fallo:** Un candidato captado desde OCC e inyectado por el admin crea su cuenta y abre /my-applications: ve 'Nota de la empresa: Candidato inyectado por Admin. Fuente original: occ. Perfil: ... Seniority: ...'. Si la empresa descarto con una nota ('pide demasiado', comentarios personales), el candidato la lee literal.
- **Arreglo propuesto:** En my-applications/route.ts devolver un DTO explicito (id, status, createdAt, job) y notes: null, igual que candidate/applications; eliminar el bloque 'Nota de la empresa' de my-applications/page.tsx o alimentarlo de un campo nuevo publicNote. Unificar ambas rutas en un solo handler para evitar que vuelvan a divergir.
- **Otros auditores añaden:** En la ruta construir un DTO explícito (id, status->etiqueta de candidato, createdAt, reviewedAt, job) sin `notes`, candidatePhone interno ni status crudo; borrar el bloque 'Nota de la empresa' de src/app/my-applications/page.tsx (l.394-401). Idealmente unificar /my-applications y /candidate/applications en una sola ruta/página.

#### VAC-029 — CreateJobForm borra la sub-especialidad al cargar una vacante para editar

- **Severidad:** 🟡 medium · **Categoría:** frontend-bug · **Estado:** nuevo · **Verificación:** sin verificar (reportada por 1 auditor)
- **Ubicación:** `src/components/sections/jobs/CreateJobForm.tsx:262`
- **Problema:** El efecto que limpia subcategory depende de formData.profile. En modo edición fetchJobData hace un setFormData que cambia profile de '' al valor guardado, el efecto se dispara tras ese render y pone subcategory en ''. Al guardar, PUT envía subcategory:'' y la API lo persiste como null.
- **Evidencia:**

```ts
// Limpiar subcategoría cuando cambia el perfil
useEffect(() => {
  setFormData((prev) => ({ ...prev, subcategory: '' }));
}, [formData.profile]);
```

- **Escenario de fallo:** Empresa abre /create-job?edit=12 de una vacante Tecnología / Backend sólo para corregir un typo en la descripción y guarda: la vacante pierde subcategory ('Backend' -> null) sin que el usuario lo note.
- **Arreglo propuesto:** Eliminar el efecto y limpiar la subcategoría en el onChange del select de especialidad: `setFormData({ ...formData, profile: e.target.value, subcategory: '' })`.

#### VAC-030 — Se guardan las coordenadas por defecto de CDMX cuando el usuario nunca eligió un punto en el mapa

- **Severidad:** 🟡 medium · **Categoría:** data-integrity · **Estado:** nuevo · **Verificación:** sin verificar (reportada por 1 auditor)
- **Ubicación:** `src/components/sections/jobs/CreateJobForm.tsx:584` · relacionados: `src/app/api/recruiter/dashboard/route.ts`
- **Problema:** markerPosition se inicializa con defaultCenter (19.4326, -99.1332) y el submit siempre lo envía. Si el usuario escribe la ubicación a mano (input controlado, o Google Maps no cargó) o edita el texto después de elegir un lugar, la vacante se guarda con coordenadas que no corresponden. Esas coordenadas las consumen recruiter/specialist (jobLatitude/jobLongitude para distancia al candidato).
- **Evidencia:**

```ts
const [markerPosition, setMarkerPosition] = useState(defaultCenter);
...
latitude: markerPosition?.lat || null,
longitude: markerPosition?.lng || null,
```

- **Escenario de fallo:** Empresa de Monterrey teclea 'Monterrey, Nuevo León' sin seleccionar sugerencia y publica: la vacante queda con lat/lng del Zócalo de CDMX; el reclutador ve ~700 km de distancia para candidatos regiomontanos y un mapa equivocado.
- **Arreglo propuesto:** Inicializar markerPosition en null (el mapa puede seguir centrado en defaultCenter), asignarlo sólo en onPlaceChanged/onMapClick, ponerlo a null cuando el usuario edita el texto manualmente, y enviar null si no hay selección.

#### VAC-031 — Editar una vacante activa cobra o devuelve créditos sin avisar ni confirmar

- **Severidad:** 🟡 medium · **Categoría:** payments · **Estado:** nuevo · **Verificación:** sin verificar (reportada por 1 auditor)
- **Ubicación:** `src/components/sections/jobs/CreateJobForm.tsx:609` · relacionados: `src/app/api/jobs/[id]/route.ts`
- **Problema:** PUT /api/jobs/[id] cobra la diferencia si cambian profile/seniority/workMode en una vacante activa. En modo edición el formulario oculta el costo (`!isEditing && calculatedCost > 0`, l.1229), rotula la sección como 'Categorización', no pide confirmación y tras guardar descarta data.message y data.creditChange.
- **Evidencia:**

```ts
if (data.success) {
  if (isEditing) {
    // Para edición, mostrar modal de éxito
    setSuccessData({ creditCost: 0, action: 'updated' });
    setShowSuccessModal(true);
  } else if (data.status === 'active') {
```

- **Escenario de fallo:** Empresa edita su vacante recién publicada y cambia 'Jr' por 'Sr': se le descuentan p. ej. 10 créditos y el modal sólo dice 'Los cambios se han guardado correctamente'. Lo descubre después en su saldo.
- **Arreglo propuesto:** En edición de vacantes activas calcular el nuevo costo, mostrar el delta contra job.creditCost ('Este cambio costará N créditos' / 'Se te devolverán N'), pedir confirmación antes del PUT, y mostrar data.message + refrescar créditos en el modal de éxito.

#### VAC-032 — 'Comprar créditos y guardar en borrador' termina en /company/dashboard: un setTimeout pisa la navegación a la compra

- **Severidad:** 🟡 medium · **Categoría:** frontend-bug · **Estado:** nuevo · **Verificación:** sin verificar (reportada por 1 auditor)
- **Ubicación:** `src/components/sections/jobs/CreateJobForm.tsx:630`
- **Problema:** Al guardar un borrador handleSubmit programa `router.push('/company/dashboard')` a 1500 ms y devuelve true. El botón del modal de créditos insuficientes usa ese mismo handleSubmit y, al recibir true, navega de inmediato a /credits/purchase. El timeout no se cancela (no hay ref ni clearTimeout) y el router de App Router sigue vivo tras desmontar.
- **Evidencia:**

```ts
setTimeout(() => {
  router.push('/company/dashboard');
}, 1500);
...
if (saved) {
  setShowInsufficientCreditsModal(false);
  router.push('/credits/purchase');
}
```

- **Escenario de fallo:** Empresa sin créditos pulsa 'COMPRAR CRÉDITOS' -> modal -> 'Comprar Créditos y Guardar en Borrador'. Llega a /credits/purchase y 1,5 s después es redirigida a /company/dashboard, abandonando el embudo de pago.
- **Arreglo propuesto:** Añadir un parámetro a handleSubmit (p. ej. `{ redirectAfterDraft: false }`) para no programar el timeout desde el modal, o guardar el id en un useRef y hacer clearTimeout antes de navegar a la compra y en el cleanup del componente.

#### VAC-033 — /talents no usa SSR ni cache: el listado se pide en cliente, /api/jobs no envia Cache-Control y las vacantes no tienen URL propia ni entran al sitemap

- **Severidad:** 🟡 medium · **Categoría:** performance · **Estado:** nuevo · **Verificación:** sin verificar (reportada por 1 auditor)
- **Ubicación:** `src/components/sections/talents/SearchPositionsSection.tsx:95` · relacionados: `src/app/talents/page.tsx`, `src/app/api/jobs/route.ts`, `src/app/sitemap.ts`
- **Problema:** La pagina servidor /talents solo monta un componente 'use client' de 716 lineas que, al montar, dispara 3 fetch (/api/auth/me, /api/jobs, /api/specialties) ademas del /api/auth/me del Navbar. El HTML inicial no contiene ninguna vacante (solo 'Cargando vacantes...'), cada visita anonima ejecuta findMany + count en la DB porque GET /api/jobs no envia cabeceras de cache (a diferencia de /api/specialties, que si usa s-maxage), no existe /jobs/[id] ni JSON-LD JobPosting, y sitemap.ts es una lista fija de 7 URLs. El redirect a login pierde la vacante elegida.
- **Evidencia:**

```ts
// Cargar vacantes desde la API
useEffect(() => {
  fetchJobs();
}, []);
...
const response = await fetch('/api/jobs?status=active');
...
onClick={() => window.location.href = '/login?redirect=/talents'}
// api/specialties/route.ts:42 (contraste): 'Cache-Control': 'public, s-maxage=600, stale-while-revalidate=86400'
// app/sitemap.ts: 7 URLs estaticas, ninguna vacante
```

- **Escenario de fallo:** Google rastrea /talents y no encuentra ninguna vacante en el HTML, por lo que las ofertas por las que las empresas pagaron no aparecen en buscadores ni en Google for Jobs. Un candidato anonimo elige la vacante #15, pulsa 'INICIA SESION PARA POSTULARTE', inicia sesion y vuelve a /talents con la vacante #1 seleccionada; tampoco puede compartir el enlace de una vacante. Una campana con 5,000 visitas genera 5,000 findMany+count identicos.
- **Arreglo propuesto:** Convertir el listado en server component: en app/talents/page.tsx leer searchParams, consultar prisma directamente con revalidate (p. ej. export const revalidate = 60 o unstable_cache con tag 'jobs' invalidado al publicar/editar) y pasar initialJobs a un componente cliente pequeno para filtros y modal. Crear app/jobs/[id]/page.tsx con generateMetadata y JSON-LD JobPosting, incluir las vacantes activas en sitemap.ts, y usar /login?redirect=/jobs/{id}. Para anonimos responder /api/jobs con Cache-Control: public, s-maxage=60, stale-while-revalidate=300.

## ⚪ low (21)

#### VAC-034 — Ramas de permisos inalcanzables en /api/applications/[id], helper duplicado y archivo vacío

- **Severidad:** ⚪ low · **Categoría:** dead-code · **Estado:** nuevo · **Verificación:** sin verificar (reportada por 1 auditor)
- **Ubicación:** `src/app/api/applications/[id]/route.ts:102` · relacionados: `src/middleware.ts`, `src/lib/authz-applications.ts`, `src/app/applications/ApplicationsManagementPanel.tsx`
- **Problema:** El middleware restringe todo /api/applications/* a admin, de modo que las ramas de checkApplicationPermission y canModify para candidate, user, company, recruiter y specialist nunca se ejecutan; duplican además src/lib/authz-applications.ts. El comentario de cabecera sugiere acceso multi-rol. Si alguien relaja el middleware, el GET entregaría candidateProfile.notas y documents al propio candidato. Además src/app/applications/ApplicationsManagementPanel.tsx es un archivo de 0 bytes (el real está en components/sections/applications).
- **Evidencia:**

```ts
// El candidato puede ver su propia aplicación (por userId o email)
if (user.role === 'candidate' || user.role === 'user') {
  if (application.userId === user.userId) {
    return { hasPermission: true };
  }
```

- **Escenario de fallo:** Un desarrollador lee la ruta, cree que los candidatos pueden consultarla, la enlaza desde la UI de candidato y obtiene 403 del middleware; o abre el middleware y expone notas internas del candidato.
- **Arreglo propuesto:** Reducir la ruta a admin-only explícito (requireRole('admin')) o usar canAccessJob de authz-applications.ts y quitar `notas` del select para no-admin; borrar el archivo vacío.

#### VAC-035 — PATCH admin de postulaciones sin máquina de estados: re-aceptar duplica el webhook candidate.accepted

- **Severidad:** ⚪ low · **Categoría:** correctness · **Estado:** nuevo · **Verificación:** sin verificar (reportada por 1 auditor)
- **Ubicación:** `src/app/api/applications/[id]/route.ts:439` · relacionados: `src/components/sections/applications/ApplicationsManagementPanel.tsx`, `src/app/api/company/applications/[id]/route.ts`
- **Problema:** La ruta acepta cualquier transición entre los 12 estados (la ruta de empresa sí valida transiciones). El webhook se dispara siempre que el estado anterior no sea 'accepted', y el panel ofrece los botones 'Pendiente' y 'Aceptar' sobre cualquier postulación. Esta vía tampoco notifica al candidato ni comprueba que la vacante siga abierta.
- **Evidencia:**

```ts
if (status === 'accepted' && existingApplication.status !== 'accepted') {
  void dispatchCandidateAccepted(applicationId);
}
```

- **Escenario de fallo:** Admin pulsa 'Aceptar', luego 'Pendiente' por error y de nuevo 'Aceptar': Worky2 recibe dos eventos candidate.accepted del mismo candidato (alta duplicada). También puede aceptar una postulación 'discarded' de una vacante cerrada.
- **Arreglo propuesto:** Definir un mapa de transiciones válidas compartido (src/lib/application-status.ts) y aplicarlo también aquí; hacer el webhook idempotente (guardar acceptedAt/webhookSentAt y no reenviar).

#### VAC-036 — Parámetros numéricos sin validar: parseInt -> NaN -> excepción de Prisma -> 500

- **Severidad:** ⚪ low · **Categoría:** validation · **Estado:** nuevo · **Verificación:** sin verificar (reportada por 1 auditor)
- **Ubicación:** `src/app/api/applications/route.ts:113` · relacionados: `src/app/api/applications/check/route.ts`, `src/app/api/jobs/publish/route.ts`, `src/lib/pagination.ts`
- **Problema:** Varias rutas pasan parseInt de entrada del usuario directo a Prisma: POST y GET de /api/applications (l.21 y 114), /api/applications/check (l.28), GET /api/jobs/publish (l.50, userId) y getPaginationParams (pagination.ts l.30-32: Math.max(1, NaN) es NaN, así que skip/take quedan NaN).
- **Evidencia:**

```ts
const job = await prisma.job.findUnique({
  where: { id: parseInt(jobId) }
});
```

- **Escenario de fallo:** GET /api/jobs?page=abc, GET /api/applications/check?jobId=x&email=a@b.c o POST /api/applications con jobId:'abc' responden 500 genérico (y ensucian los logs) en lugar de 400.
- **Arreglo propuesto:** Helper `parseId(value)` que devuelva null si !Number.isInteger o <=0 y responder 400; en getPaginationParams usar `Number.isFinite(n) ? n : default`.

#### VAC-037 — /api/candidate/applications busca sólo por Candidate.email, pero la postulación rápida se guarda con User.email

- **Severidad:** ⚪ low · **Categoría:** correctness · **Estado:** nuevo · **Verificación:** sin verificar (reportada por 1 auditor)
- **Ubicación:** `src/app/api/candidate/applications/route.ts:68` · relacionados: `src/components/sections/talents/ApplyJobModal.tsx`, `src/app/api/admin/candidates/[id]/route.ts`
- **Problema:** ApplyJobModal envía candidateEmail: profile.email (email del User) y la API lo guarda junto con userId; esta ruta lista únicamente por candidate.email. PUT /api/admin/candidates/[id] (l.196) permite cambiar Candidate.email sin tocar User.email, con lo que ambos divergen.
- **Evidencia:**

```ts
const applications = await prisma.application.findMany({
  where: {
    candidateEmail: candidate.email.toLowerCase()
  },
```

- **Escenario de fallo:** Admin corrige el email del candidato en /admin/candidates. El candidato postula desde /talents: la postulación se guarda con el email de su User y no aparece en 'Mis Postulaciones'. El check de duplicado sí la detecta ('Ya te postulaste') pero el listado está vacío.
- **Arreglo propuesto:** Filtrar por `OR: [{ userId: payload.userId }, { candidateEmail: candidate.email.toLowerCase() }, { candidateEmail: user.email.toLowerCase() }]` y sincronizar User.email cuando admin cambie el email del candidato.

#### VAC-038 — En edición no se cargan ni se guardan coordenadas: PUT ignora latitude/longitude

- **Severidad:** ⚪ low · **Categoría:** data-integrity · **Estado:** nuevo · **Verificación:** sin verificar (reportada por 1 auditor)
- **Ubicación:** `src/app/api/jobs/[id]/route.ts:388` · relacionados: `src/components/sections/jobs/CreateJobForm.tsx`
- **Problema:** fetchJobData no inicializa mapCenter/markerPosition con job.latitude/longitude (el mapa muestra CDMX aunque la vacante esté en otra ciudad) y el PUT no desestructura ni persiste latitude/longitude aunque el formulario los envía.
- **Evidencia:**

```ts
const {
  title,
  company,
  location,
  salary,
  salaryMin,
  salaryMax,
  jobType,
  workMode,
```

- **Escenario de fallo:** Empresa edita la vacante y cambia la ubicación de Monterrey a Guadalajara con el autocompletado: el texto se actualiza pero en BD quedan las coordenadas de Monterrey; el cálculo de distancia del reclutador sigue usando la sede anterior.
- **Arreglo propuesto:** En fetchJobData hacer setMapCenter/setMarkerPosition si el job trae coordenadas; en PUT aceptar latitude/longitude validando que sean números en rango (-90..90 / -180..180) y persistirlos.

#### VAC-039 — Editar una vacante activa propiedad de un admin intenta cobrarle creditos al admin (402) o le 'reembolsa' creditos que nunca pago

- **Severidad:** ⚪ low · **Categoría:** correctness · **Estado:** nuevo · **Verificación:** sin verificar (reportada por 1 auditor)
- **Ubicación:** `src/app/api/jobs/[id]/route.ts:474` · relacionados: `src/app/api/jobs/route.ts`
- **Problema:** POST /api/jobs guarda creditCost calculado tambien para publicaciones de admin (que no pagan). En PUT, el ajuste por cambio de seniority/perfil/modalidad no distingue el rol del propietario: 'company' es existingJob.userId aunque sea un admin con 0 creditos. Al subir de nivel responde 402; al bajar, incrementa creditos del admin y crea un asiento 'refund' ficticio.
- **Evidencia:**

```ts
if (difference > 0) {
  // Cobrar diferencia - verificar créditos suficientes
  if (company.credits < difference) {
    return NextResponse.json(
      {
        success: false,
        error: `Créditos insuficientes. Necesitas ${difference} créditos adicionales para este cambio.`,
```

- **Escenario de fallo:** Un admin publica una vacante 'Jr' y a la hora la corrige a 'Sr': PUT responde 402 'Creditos insuficientes. Necesitas 5 creditos adicionales' y no puede guardar. Si la baja a 'Practicante', su usuario admin recibe +1 credito y un asiento 'refund' en el ledger.
- **Arreglo propuesto:** Cargar el rol del propietario y saltar todo el bloque de ajuste de creditos cuando el dueno es admin (solo actualizar creditCost), igual que hace la publicacion.

#### VAC-040 — GET y POST de /api/jobs/publish no tienen consumidores y son versiones más débiles de /api/jobs

- **Severidad:** ⚪ low · **Categoría:** dead-code · **Estado:** nuevo · **Verificación:** sin verificar (reportada por 1 auditor)
- **Ubicación:** `src/app/api/jobs/publish/route.ts:109`
- **Problema:** Sólo se usa el PUT (company/dashboard l.156). El GET es público, sin paginación, sin filtro de expiración y con includeDrafts. El POST crea/publica sin validar especialidad, rango salarial, salario mínimo de PricingMatrix ni soportar isConfidential/subcategory/campos extendidos, es decir, permite saltarse por API las reglas que sí aplica POST /api/jobs.
- **Evidencia:**

```ts
// POST - Crear nueva vacante (como borrador por defecto)
export async function POST(request: Request) {
  ...
  const { title, company, location, salary, jobType, workMode, description,
    requirements, companyRating, expiresAt, profile, seniority, publishNow } = body;
```

- **Escenario de fallo:** Empresa envía POST /api/jobs/publish con un salario por debajo del mínimo de su especialidad y un profile inexistente: se publica, cuando POST /api/jobs lo habría rechazado con 400.
- **Arreglo propuesto:** Eliminar los handlers GET y POST de este archivo y dejar sólo PUT; mover sus tests a /api/jobs.

#### VAC-041 — Las reglas salariales del servidor se evitan omitiendo salaryMin/salaryMax; PUT nunca valida el salario mínimo

- **Severidad:** ⚪ low · **Categoría:** validation · **Estado:** nuevo · **Verificación:** sin verificar (reportada por 1 auditor)
- **Ubicación:** `src/app/api/jobs/route.ts:208` · relacionados: `src/app/api/jobs/[id]/route.ts`
- **Problema:** El rango (máx. $10,000 de diferencia) sólo se valida si llegan ambos campos y el mínimo de PricingMatrix sólo si llega salaryMin (l.256); `salary` es texto libre obligatorio. PUT y PATCH de /api/jobs/[id] no comprueban nunca pricingEntry.minSalary.
- **Evidencia:**

```ts
if (salaryMin !== undefined && salaryMax !== undefined) {
  const minNum = parseInt(salaryMin) || 0;
  ...
// Validar salario mínimo configurado en PricingMatrix
if (profile && seniority && workMode && salaryMin) {
```

- **Escenario de fallo:** Empresa envía POST /api/jobs con salary:'$3,000 - $80,000 / mes' y sin salaryMin/salaryMax: pasa todas las validaciones. O crea con salario válido y luego PUT con salaryMin por debajo del mínimo de la especialidad.
- **Arreglo propuesto:** Hacer salaryMin y salaryMax obligatorios (enteros > 0), construir `salary` en el servidor a partir de ellos y extraer la validación (rango + mínimo de matriz) a una función usada por POST, PUT y PATCH.

#### VAC-042 — companyRating (estrellas visibles a candidatos) lo fija la propia empresa desde el body

- **Severidad:** ⚪ low · **Categoría:** validation · **Estado:** nuevo · **Verificación:** sin verificar (reportada por 2 auditores)
- **Ubicación:** `src/app/api/jobs/route.ts:356` · relacionados: `src/app/api/jobs/[id]/route.ts`, `src/app/api/jobs/publish/route.ts`, `src/components/sections/talents/SearchPositionsSection.tsx`
- **Problema:** POST /api/jobs, POST /api/jobs/publish, PUT y PATCH /api/jobs/[id] aceptan companyRating del cliente sin rango ni control de rol, y /talents lo muestra como '★ {companyRating}'.
- **Evidencia:**

```ts
// src/app/api/jobs/route.ts:356
companyRating: companyRating || null,
// src/app/api/jobs/[id]/route.ts:293 -> 'companyRating' en allowedPatchFields
// src/components/sections/talents/SearchPositionsSection.tsx:511
{job.companyRating && `★ ${job.companyRating}`}
```

- **Escenario de fallo:** Una empresa envia PATCH /api/jobs/9 {companyRating: 5} (o 9.9) y su vacante aparece con la maxima valoracion frente a los candidatos, sin que exista ningun sistema real de resenas.
- **Arreglo propuesto:** Ignorar companyRating para rol company en las cuatro rutas (solo admin puede fijarlo, validando 0-5), o eliminar el campo de la vista publica hasta que exista un sistema de valoraciones.
- **Otros auditores añaden:** Ignorar companyRating para rol company (sólo admin, validado 0-5) en las tres rutas, o eliminar el campo de la UI pública hasta que exista un sistema real de reseñas.

#### VAC-043 — /create-job no está protegida: anónimos y candidatos ven y rellenan el formulario completo

- **Severidad:** ⚪ low · **Categoría:** authz · **Estado:** nuevo · **Verificación:** sin verificar (reportada por 1 auditor)
- **Ubicación:** `src/app/create-job/page.tsx:21` · relacionados: `src/middleware.ts`, `src/components/sections/jobs/CreateJobForm.tsx`
- **Problema:** La ruta no figura en el matcher del middleware ni tiene guard en cliente. fetchUserInfo falla en silencio y el usuario sólo se entera al enviar (401 'No autenticado' o 403). No hay fuga de datos, pero sí un flujo roto.
- **Evidencia:**

```ts
export default function CreateJobPage() {
  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4">
      <Suspense fallback={<CreateJobFormFallback />}>
        <CreateJobForm />
```

- **Escenario de fallo:** Una empresa con la sesión caducada abre /create-job, rellena ~20 campos, pulsa 'GUARDAR BORRADOR' y recibe un toast 'No autenticado'; pierde todo lo escrito al ir al login.
- **Arreglo propuesto:** Añadir '/create-job' al matcher del middleware restringido a company/admin (redirigiendo a /login?redirect=/create-job), o un guard en el componente que redirija en cuanto /api/auth/me no devuelva un rol válido.

#### VAC-044 — Panel /applications: fallos silenciosos, estados sin etiqueta, tabla recortada y modal sin semántica

- **Severidad:** ⚪ low · **Categoría:** ux · **Estado:** nuevo · **Verificación:** sin verificar (reportada por 1 auditor)
- **Ubicación:** `src/components/sections/applications/ApplicationsManagementPanel.tsx:111`
- **Problema:** updateApplicationStatus no informa cuando la API falla (sólo console.error) y fetchApplications tampoco. getStatusLabel cubre 6 de 12 estados, el resto se muestra crudo ('sent_to_company', 'injected_by_admin') y no hay filtros para ellos. La tabla vive en un contenedor overflow-hidden sin overflow-x-auto (l.284). El modal de detalle (l.367) no tiene role=dialog, aria-modal ni cierre con Escape (el barrido #59/#60 no lo cubrió).
- **Evidencia:**

```ts
const data = await response.json();

if (data.success) {
  // Actualizar la lista
  fetchApplications();
  setIsDetailModalOpen(false);
}
} catch (error) {
  console.error('Error updating application:', error);
```

- **Escenario de fallo:** El admin pulsa 'Aceptar' con el token vencido (401): el modal se queda abierto sin mensaje y cree que el cambio se guardó. En un móvil las columnas Estado/Acciones quedan cortadas e inaccesibles.
- **Arreglo propuesto:** Mostrar toast de error (ErrorToast ya existe) en ambos fetch; usar el mapa de estados compartido; envolver la tabla en overflow-x-auto; añadir role='dialog', aria-modal, aria-labelledby y handler de Escape al modal.

#### VAC-045 — habilidades con JSON inválido rompe la edición y se reporta como 'Error de conexión'

- **Severidad:** ⚪ low · **Categoría:** frontend-bug · **Estado:** nuevo · **Verificación:** sin verificar (reportada por 1 auditor)
- **Ubicación:** `src/components/sections/jobs/CreateJobForm.tsx:297` · relacionados: `src/app/api/jobs/route.ts`
- **Problema:** JSON.parse sin protección dentro del try general de fetchJobData. La API acepta cualquier string en `habilidades` (POST/PUT/PATCH sin validar), así que un valor no JSON deja la vacante imposible de editar desde la UI. SearchPositionsSection sí lo protege con try/catch.
- **Evidencia:**

```ts
const parsedHabilidades = job.habilidades
  ? JSON.parse(job.habilidades)
  : [];
...
} catch {
  setLoadError('Error de conexión. Intenta de nuevo.');
```

- **Escenario de fallo:** Vacante con habilidades:'React, Node' (dato legado o escrito por API): /create-job?edit=ID muestra 'Error de conexión. Intenta de nuevo.' para siempre.
- **Arreglo propuesto:** Parsear con try/catch propio (fallback: split por comas o []), y validar en la API que habilidades sea un array JSON de strings.

#### VAC-046 — Un 402 al editar muestra el modal de 'publicar' con cifras incorrectas y un botón que entra en bucle

- **Severidad:** ⚪ low · **Categoría:** ux · **Estado:** nuevo · **Verificación:** sin verificar (reportada por 1 auditor)
- **Ubicación:** `src/components/sections/jobs/CreateJobForm.tsx:594`
- **Problema:** Ante 402 siempre se abre el modal de créditos insuficientes, que usa calculatedCost (costo total) y el texto 'para publicar esta vacante', ignorando data.required/data.available. En edición lo que falta es la diferencia. El botón 'Comprar Créditos y Guardar en Borrador' reenvía handleSubmit, que en edición repite el mismo PUT -> 402 -> cierra el modal sin navegar.
- **Evidencia:**

```ts
if (response.status === 402) {
  // Créditos insuficientes
  setShowInsufficientCreditsModal(true);
  return false;
}
```

- **Escenario de fallo:** Vacante Jr (5 créditos) editada a Sr (15) con saldo 8: el modal dice 'Necesitas 15 créditos... Te faltan 7' cuando faltan 2; al pulsar el botón verde no pasa nada visible y no hay forma de ir a comprar créditos desde ahí.
- **Arreglo propuesto:** Guardar data.required y data.available del 402 y pintarlos; en modo edición cambiar el texto a 'para aplicar este cambio' y que el botón navegue a /credits/purchase sin reenviar el formulario.

#### VAC-047 — Cualquier 403 al guardar se muestra como 'No tienes permiso para editar esta vacante'

- **Severidad:** ⚪ low · **Categoría:** ux · **Estado:** nuevo · **Verificación:** sin verificar (reportada por 1 auditor)
- **Ubicación:** `src/components/sections/jobs/CreateJobForm.tsx:600`
- **Problema:** El handler sustituye el mensaje del servidor. La API devuelve 403 también por ventana de 4 h vencida y, al crear, por rol no permitido o usuario desactivado. El formulario tampoco comprueba editableUntil al cargar, así que se puede rellenar todo y fallar al final.
- **Evidencia:**

```ts
if (response.status === 403) {
  setSubmitStatus({
    type: 'error',
    message: 'No tienes permiso para editar esta vacante.'
  });
  return false;
}
```

- **Escenario de fallo:** La empresa deja abierto el formulario de edición y guarda a las 4 h 05 min: ve 'No tienes permiso para editar esta vacante' en vez de 'El tiempo para editar esta vacante ha expirado'. Un candidato que llega a /create-job y envía recibe el mismo mensaje sobre 'editar'.
- **Arreglo propuesto:** Mostrar `data.error` cuando exista. En fetchJobData, si editableUntil ya pasó, mostrar aviso y deshabilitar el guardado.

#### VAC-048 — CreateJobForm: etiquetas sin asociar a sus controles y modales sin semántica de diálogo

- **Severidad:** ⚪ low · **Categoría:** a11y · **Estado:** nuevo · **Verificación:** sin verificar (reportada por 1 auditor)
- **Ubicación:** `src/components/sections/jobs/CreateJobForm.tsx:806`
- **Problema:** Ningún <label> del formulario usa htmlFor/id ni envuelve al input, por lo que los campos no tienen nombre accesible (el placeholder no lo es) y el clic en la etiqueta no enfoca. Los modales de créditos insuficientes (l.1609) y de éxito (l.1677) carecen de role='dialog', aria-modal, gestión de foco y Escape; el barrido #59/#60 de junio no incluyó este componente. Tampoco hay aria-invalid/aria-describedby en los errores de campo.
- **Evidencia:**

```ts
<label className="block text-sm font-semibold mb-2">
  Título del Puesto *
</label>
<input
  type="text"
  value={formData.title}
```

- **Escenario de fallo:** Con lector de pantalla los campos se anuncian como 'edición, ej. Desarrollador Full Stack' y los selects como 'cuadro combinado' sin nombre; al abrirse el modal de créditos el foco queda detrás y no se puede cerrar con Escape.
- **Arreglo propuesto:** Añadir id a cada control y htmlFor a su label; aria-invalid y aria-describedby apuntando al mensaje de error; role='dialog', aria-modal, aria-labelledby, foco inicial y cierre con Escape en ambos modales (reutilizar el patrón de ApplyJobModal).

#### VAC-049 — El costo mostrado puede estar obsoleto: el botón PUBLICAR no se bloquea mientras se recalcula

- **Severidad:** ⚪ low · **Categoría:** frontend-bug · **Estado:** nuevo · **Verificación:** sin verificar (reportada por 1 auditor)
- **Ubicación:** `src/components/sections/jobs/CreateJobForm.tsx:1569`
- **Problema:** calculateCost es asíncrono, sin AbortController ni control de orden de respuestas. Mientras isCalculating es true el panel muestra '...' pero el botón conserva el costo anterior y sigue habilitado; respuestas fuera de orden pueden dejar fijado un costo viejo.
- **Evidencia:**

```ts
disabled={isSubmitting || !calculatedCost || !!salaryError}
```

- **Escenario de fallo:** El usuario cambia 'Jr' por 'Director' y pulsa de inmediato 'PUBLICAR (5 créditos)': el servidor cobra el precio de Director (p. ej. 25). La comprobación local de saldo también usó el costo viejo.
- **Arreglo propuesto:** Añadir `|| isCalculating` al disabled, mostrar '...' en la etiqueta del botón mientras calcula y descartar respuestas antiguas con AbortController o un contador de petición.

#### VAC-050 — ApplyJobModal: un error de red muestra 'Inicia sesión para aplicar' a un usuario logueado y los códigos HTTP no coinciden con la API

- **Severidad:** ⚪ low · **Categoría:** ux · **Estado:** nuevo · **Verificación:** sin verificar (reportada por 1 auditor)
- **Ubicación:** `src/components/sections/talents/ApplyJobModal.tsx:200` · relacionados: `src/app/api/applications/route.ts`
- **Problema:** El catch de loadProfileAndCheck pone view='not_logged_in', vista que no renderiza `error`. Además el modal distingue 409 (duplicado) y 404 (vacante no disponible), pero la API responde 400 en ambos casos (duplicado l.140-147, vacante inactiva l.125-130), por lo que esas ramas nunca se ejecutan.
- **Evidencia:**

```ts
} catch (err) {
  console.error('Error loading profile:', err);
  setError('Error al cargar los datos');
  setView('not_logged_in');
}
```

- **Escenario de fallo:** Falla /api/applications/check (500 o red): un candidato con sesión ve la pantalla 'Inicia sesión para aplicar' con la opción 'Aplicar sin cuenta', sin mensaje de error; si elige esa vía envía una postulación manual con datos distintos a su perfil.
- **Arreglo propuesto:** Añadir una vista 'error' con botón Reintentar; en la API devolver 409 para duplicado y 409/410 para vacante no activa, y alinear el modal.

#### VAC-051 — El panel de detalle no se sincroniza con los filtros: muestra una vacante que ya no está en la lista

- **Severidad:** ⚪ low · **Categoría:** frontend-bug · **Estado:** nuevo · **Verificación:** sin verificar (reportada por 1 auditor)
- **Ubicación:** `src/components/sections/talents/SearchPositionsSection.tsx:192`
- **Problema:** applyFilters actualiza filteredJobs pero nunca revisa si selectedJob sigue dentro del resultado.
- **Evidencia:**

```ts
    }

    setFilteredJobs(filtered);
  };
```

- **Escenario de fallo:** Con la primera vacante seleccionada (Tiempo Completo) el candidato filtra 'Medio Tiempo': la lista izquierda cambia, pero a la derecha sigue el detalle y el botón POSTULARME de la vacante de tiempo completo, sin ninguna tarjeta resaltada.
- **Arreglo propuesto:** Tras filtrar: `if (!filtered.some(j => j.id === selectedJob?.id)) setSelectedJob(filtered[0] ?? null);`.

#### VAC-052 — El filtro rotulado 'Modalidad de trabajo' filtra por tipo de contrato y le faltan opciones

- **Severidad:** ⚪ low · **Categoría:** ux · **Estado:** nuevo · **Verificación:** sin verificar (reportada por 1 auditor)
- **Ubicación:** `src/components/sections/talents/SearchPositionsSection.tsx:294` · relacionados: `src/components/sections/jobs/CreateJobForm.tsx`
- **Problema:** El select opera sobre job.jobType, pero su etiqueta es la misma que CreateJobForm usa para presencial/híbrido/remoto. Sólo ofrece 3 de los 5 tipos que el formulario permite crear ('Temporal' y 'Prácticas' no están) y no existe filtro por workMode pese a que la API lo soporta.
- **Evidencia:**

```ts
<option value="all">Modalidad de trabajo</option>
<option value="Tiempo Completo">Tiempo Completo</option>
<option value="Medio Tiempo">Medio Tiempo</option>
<option value="Por Proyecto">Por Proyecto</option>
```

- **Escenario de fallo:** Un estudiante que busca 'Prácticas' no puede filtrarlas; alguien que quiere trabajo remoto abre 'Modalidad de trabajo' y sólo encuentra tipos de jornada.
- **Arreglo propuesto:** Renombrar a 'Tipo de trabajo', añadir 'Temporal' y 'Prácticas' (idealmente desde una constante compartida con CreateJobForm) y añadir un select de modalidad (Presencial/Híbrido/Remoto).

#### VAC-053 — Controles sin funcionalidad para candidatos: Guardados / Postulados / Vencidos, Bookmark y menú

- **Severidad:** ⚪ low · **Categoría:** dead-code · **Estado:** nuevo · **Verificación:** sin verificar (reportada por 1 auditor)
- **Ubicación:** `src/components/sections/talents/SearchPositionsSection.tsx:399`
- **Problema:** Los tres botones y los iconos Bookmark/MoreVertical (l.488-493 y 535-540) no tienen onClick ni estado asociado; 'Guardados' aparece siempre como activo. No existe modelo ni API de vacantes guardadas. Los iconos tampoco son focusables ni tienen nombre accesible.
- **Evidencia:**

```ts
{user && user.role === 'candidate' && (
  <div className="flex gap-2">
    <button className="... bg-button-green text-white">
      Guardados
    </button>
    <button className="...">
      Postulados
    </button>
```

- **Escenario de fallo:** Un candidato pulsa 'Postulados' o el icono de guardar esperando filtrar/guardar y no ocurre nada.
- **Arreglo propuesto:** Retirarlos hasta implementar la función, o implementarla ('Postulados' puede filtrar con /api/candidate/applications; 'Guardados' requiere un modelo SavedJob).

#### VAC-054 — En móvil, tocar una vacante no lleva al detalle: queda debajo de toda la lista

- **Severidad:** ⚪ low · **Categoría:** responsive · **Estado:** nuevo · **Verificación:** sin verificar (reportada por 1 auditor)
- **Ubicación:** `src/components/sections/talents/SearchPositionsSection.tsx:464`
- **Problema:** En <md el layout es flex-col: primero todas las tarjetas y al final el detalle. Al tocar una tarjeta sólo cambia el borde; no hay scroll ni vista de detalle propia, y el botón POSTULARME queda tras N tarjetas.
- **Evidencia:**

```ts
<div className="flex flex-col md:flex-row gap-6 md:h-[calc(100vh-220px)]">
  {/* Columna Izquierda: Lista */}
  <div className="w-full md:w-1/2 space-y-4 md:overflow-y-auto md:pr-2">
    {filteredJobs.map((job) => (
      <div ... onClick={() => setSelectedJob(job)}
```

- **Escenario de fallo:** En un teléfono con 20 vacantes el candidato toca la tercera: aparentemente no ocurre nada; tiene que desplazarse hasta el final de la lista para ver la descripción y postularse.
- **Arreglo propuesto:** En pantallas <md hacer scrollIntoView del panel de detalle al seleccionar, o abrir el detalle en un drawer/modal a pantalla completa con su botón POSTULARME.
