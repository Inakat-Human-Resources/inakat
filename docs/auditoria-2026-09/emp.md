# Módulo empresa

[← volver al índice](../AUDITORIA-2026-09.md) · 39 hallazgos — 🟠 8 high · 🟡 14 medium · ⚪ 17 low

## 🟠 high (8)

#### EMP-001 — XSS almacenado contra el admin desde el registro publico: identificacionUrl/documentosConstitucionUrl aceptan 'javascript:' y se abren con window.open

- **Severidad:** 🟠 high · **Categoría:** security · **Estado:** nuevo · **Verificación:** sin verificar (reportada por 1 auditor)
- **Ubicación:** `src/app/api/company-requests/route.ts:104` · relacionados: `src/lib/validations.ts`, `src/components/sections/admin/RequestDetailModal.tsx`, `src/middleware.ts`
- **Problema:** POST /api/company-requests es publico (excepcion en middleware). Las URLs de documentos se validan con `z.string().url()`, que en zod 4 solo hace `new URL()` y por tanto acepta cualquier esquema, incluido `javascript:`. El panel de admin abre esas URLs con `window.open(url, '_blank')` (RequestDetailModal.openFile), que ejecuta el script en una ventana about:blank con el origen del opener. React no sanea window.open. Es el mismo patron que #55 (fileUrl sin validar esquema), sin corregir aqui. `sitioWeb` tampoco restringe esquema y se usa como href en el mismo modal; `logoUrl` no se valida en absoluto.
- **Evidencia:**

```ts
// src/lib/validations.ts
  identificacionUrl: z.string().url().optional().or(z.literal('')),
  documentosConstitucionUrl: z.string().url().optional().or(z.literal(''))
// src/components/sections/admin/RequestDetailModal.tsx
  const openFile = (url: string) => {
    window.open(url, '_blank');
  };
```

- **Escenario de fallo:** 1) Un atacante anonimo hace POST /api/company-requests con datos validos e `identificacionUrl: "javascript:fetch('/api/admin/users',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...})})"`. 2) El admin abre la solicitud en /admin/requests y pulsa el boton de la identificacion (flujo normal de revision). 3) El script corre con la sesion del admin: puede aprobar la solicitud, crear usuarios internos o leer PII.
- **Arreglo propuesto:** En companyRequestSchema exigir https y host del blob store: `.refine(u => { const p = new URL(u); return p.protocol === 'https:' && p.hostname.endsWith('.public.blob.vercel-storage.com'); })` (permitiendo `/uploads/` solo en desarrollo). Validar igual `logoUrl` y restringir `sitioWeb` a http(s). En RequestDetailModal.openFile comprobar `['http:','https:'].includes(new URL(url, location.origin).protocol)` y usar `window.open(url, '_blank', 'noopener,noreferrer')`.

#### EMP-002 — El rol 'company' se autoasigna por un endpoint publico y la aprobacion/rechazo del admin no se aplica en ninguna ruta

- **Severidad:** 🟠 high · **Categoría:** authz · **Estado:** nuevo · **Verificación:** sin verificar (reportada por 3 auditores)
- **Ubicación:** `src/app/api/company-requests/route.ts:112` · relacionados: `src/middleware.ts`, `src/app/api/company-requests/[id]/route.ts`, `src/app/api/jobs/route.ts`, `src/app/api/jobs/publish/route.ts`, `src/app/api/credits/purchases/route.ts`, `src/components/sections/companies/FormRegisterForQuotationSection.tsx`
- **Problema:** POST /api/company-requests es una excepcion publica del middleware y crea en el acto un User con role 'company' e isActive true. El middleware solo comprueba `payload.role === 'company'`; ninguna ruta de la API consulta `companyRequest.status` (un grep de 'approved' en src/app/api solo aparece en company-requests/[id], en company/profile para mostrar la fecha y en pagos). PATCH /api/company-requests/[id] con 'rejected' solo cambia el status y manda una notificacion; no desactiva al usuario. La propia API promete lo contrario: 'algunas funciones estaran limitadas hasta que tu cuenta sea aprobada' y, al aprobar, 'Ya puedes publicar vacantes y acceder a todas las funciones'.
- **Evidencia:**

```ts
// src/app/api/company-requests/route.ts
      const user = await tx.user.create({
        data: {
          email: correoEmpresa.toLowerCase(),
          password: hashedPassword,
          ...
          role: "company",
          isActive: true,
// src/middleware.ts
  if (
    isCompanyRoute &&
    payload.role !== 'company' &&
    payload.role !== 'admin'
  ) {
```

- **Escenario de fallo:** 1) Un tercero envia POST /api/company-requests con datos inventados que pasen el regex de RFC. 2) Recibe una cuenta company activa, hace login y entra a /company/dashboard. 3) Compra creditos (POST /api/credits/purchases) y publica con POST /api/jobs {publishNow:true}: la vacante sale publica en /talents y empieza a recibir postulaciones/CVs. 4) El admin pulsa 'Rechazar' en /admin/requests: la cuenta sigue operando exactamente igual (publicar, ver candidatos enviados, pedir entrevistas, crear API keys de integracion). El flujo de aprobacion es puramente decorativo; una empresa falsa (estafa de empleo) puede captar datos de candidatos.
- **Arreglo propuesto:** Crear en src/lib/auth.ts un helper `requireApprovedCompany()` que cargue `user.companyRequest.status` y exija 'approved' (admin exento) y aplicarlo en POST /api/jobs, POST/PUT /api/jobs/publish, POST /api/credits/purchases, /api/company/interview-requests, /api/company/applications/[id], /api/company/jobs/[jobId]/candidates y /api/integration/keys|webhooks. En PATCH /api/company-requests/[id]: al rechazar poner user.isActive=false (y reactivar al aprobar) dentro de la misma transaccion. En el dashboard de empresa mostrar un banner 'pendiente de aprobacion' con las acciones deshabilitadas. Corregir el copy de FormRegisterForQuotationSection ('Ya puedes acceder a la plataforma').
- **Otros auditores añaden:** Crear en src/lib un helper `requireApprovedCompany(userId)` que cargue companyRequest.status y devuelva 403 con codigo 'COMPANY_NOT_APPROVED' si no es 'approved'. Aplicarlo en POST /api/jobs, POST/PUT /api/jobs/publish, POST /api/credits/purchases, PATCH /api/company/applications/[id] y POST /api/company/interview-requests. Al rechazar, poner User.isActive=false o bloquear en login. Devolver `status` y `rejectionReason` en /api/company/dashboard y mostrar un banner de 'pendiente/rechazada'. — Crear helper requireApprovedCompany() en src/lib/auth.ts (requireRole('company') + companyRequest.status === 'approved'; admin exento) y usarlo en POST /api/jobs, POST/PUT /api/jobs/publish, PUT/PATCH /api/jobs/[id] (al menos para publicar/reanudar), POST /api/credits/purchases, todas las rutas /api/company/* que devuelven candidatos y /api/integration/keys|webhooks. En PATCH /api/company-requests/[id] con status 'rejected' y en DELETE, poner user.isActive=false (o bloquear DELETE si hay userId). En el frontend mostrar banner 'cuenta en revision' usando profile.status.

#### EMP-003 — Notas internas siguen filtrandose a la empresa en 4 rutas (el fix #50/#51 solo se aplico a una parte de company/dashboard)

- **Severidad:** 🟠 high · **Categoría:** security · **Estado:** arreglo previo incompleto · **Verificación:** ✅ verificada contra el código
- **Ubicación:** `src/app/api/company/applications/[id]/route.ts:340` · relacionados: `src/app/api/company/jobs/[jobId]/candidates/route.ts`, `src/app/api/company/dashboard/route.ts`, `src/lib/integration-candidate.ts`
- **Problema:** La auditoria de junio retiro Application.notes, Candidate.notas y recruiterNotes/specialistNotes de la respuesta de company/dashboard, pero al comparar las rutas hermanas el mismo dato sigue saliendo: (1) GET company/applications/[id] devuelve ...application (incluye notes), notas: candidate.notas y recruiterNotes/specialistNotes del JobAssignment; (2) GET company/jobs/[jobId]/candidates devuelve notes: app.notes y notas: candidate.notas; (3) en el propio company/dashboard, allJobs conserva el arreglo applications embebido con todas sus columnas, incluida notes; (4) la integracion Worky2 exporta notasAdicionales: application.notes al sistema externo de la empresa. Ademas PATCH company/applications/[id] deja a la empresa sobrescribir Application.notes.
- **Comprobación:** Confirmado: la respuesta incluye `notas`, `recruiterNotes` y `specialistNotes`.
- **Evidencia:**

```ts
// company/applications/[id]/route.ts:339
data: {
  ...application,
  candidateProfile: candidate ? {
    ...
    notas: candidate.notas,
  } : null,
  recruiterNotes: jobAssignment?.recruiterNotes || null,
  specialistNotes: jobAssignment?.specialistNotes || null
// company/jobs/[jobId]/candidates/route.ts:147  notes: app.notes,  :168  notas: candidate.notas,
// lib/integration-candidate.ts:197  notasAdicionales: application.notes ?? null,
```

- **Escenario de fallo:** El reclutador descarta a un candidato con razon interna y el admin anota en Candidate.notas 'pide 20% mas que el tope del cliente; referencias negativas'. La empresa duena de la vacante abre /company/jobs/12/candidates (o llama GET /api/company/applications/345, o recibe el webhook candidate.accepted) y lee esas notas internas, incluidas las lineas '[DESCARTADO: Nombre] motivo' de otros candidatos acumuladas en recruiterNotes.
- **Arreglo propuesto:** Crear un serializador unico toCompanyApplicationDTO()/toCompanyCandidateDTO() en src/lib y usarlo en las 4 salidas: excluir Application.notes, Candidate.notas, recruiterNotes y specialistNotes; en company/dashboard reemplazar include applications por _count. En integration-candidate mapear notasAdicionales solo desde notas isPublic. En PATCH de empresa guardar comentarios en un campo propio (p. ej. companyNotes) en vez de notes. Agregar un test que falle si alguna respuesta /api/company/* contiene las claves notes/notas/recruiterNotes/specialistNotes.
- **Otros auditores añaden:** Si el GET no se usa, eliminarlo. Si se conserva: sustituir `...application` por un select explicito sin `notes`, quitar `notas`, y quitar `recruiterNotes`/`specialistNotes` (y la consulta a jobAssignment). Devolver solo EvaluationNote con isPublic=true, como ya hace la ruta de candidatos. — En el GET: destructurar `const { notes: _n, ...appPublic } = application`, eliminar `notas`, `recruiterNotes` y `specialistNotes` de la respuesta y borrar la query a prisma.jobAssignment. Si la empresa debe ver comentarios, devolver solo EvaluationNote con isPublic=true (igual que company/jobs/[jobId]/candidates). Quitar tambien el bloque 'Notas del Equipo de Seleccion' de CompanyApplicationsTable.tsx:598-636 o alimentarlo con notas publicas. Anadir test que importe el handler y afirme que esas claves no existen.

#### EMP-004 — El dashboard sigue filtrando Application.notes dentro de allJobs[].applications[]

- **Severidad:** 🟠 high · **Categoría:** security · **Estado:** arreglo previo incompleto · **Verificación:** ✅ verificada contra el código
- **Ubicación:** `src/app/api/company/dashboard/route.ts:288` · relacionados: `__tests__/api/company-dashboard-filter.test.ts`
- **Problema:** El fix #50/#51 quito `notes` de `allApplications`, pero `jobs` se consulta con `include: { applications: ... }` (filas completas de Application, con `notes`, `coverLetter`, `cvUrl`, etc.) y `allJobs` solo descarta `notasInternas` del job. El resto (`...jobPublic`) conserva el array `applications` integro, asi que `notes` sale igual por otra rama del mismo JSON.
- **Comprobación:** Confirmado: `allJobs` quita `notasInternas` del job, pero `job.applications` viene del `include` completo y conserva `notes`. El filtro de la línea 155 sólo cubre `enrichedApplications`.
- **Evidencia:**

```ts
    const jobs = await prisma.job.findMany({
      where: { userId: companyUserId },
      include: {
        applications: {
          where: { status: { in: COMPANY_VISIBLE_STATUSES } }
        }
      },
...
          const { notasInternas: _notasInternas, ...jobPublic } = job;
          return {
            ...jobPublic,
            applicationCount: job.applications.length
```

- **Escenario de fallo:** La empresa abre /company/dashboard, mira la respuesta de /api/company/dashboard en la pestana Network y en `data.allJobs[0].applications[0].notes` lee las notas internas que el admin escribio sobre el candidato.
- **Arreglo propuesto:** En la consulta de jobs usar `_count: { select: { applications: { where: { status: { in: COMPANY_VISIBLE_STATUSES } } } } }` en vez de incluir las filas, o al mapear allJobs hacer `const { notasInternas, applications, ...jobPublic } = job`. Agregar test que recorra recursivamente la respuesta y falle si aparece la clave `notes`.

#### EMP-005 — La empresa puede obtener nombre, email y telefono de postulantes que INAKAT aun no le ha enviado, solicitando entrevista por applicationId

- **Severidad:** 🟠 high · **Categoría:** authz · **Estado:** nuevo · **Verificación:** sin verificar (reportada por 2 auditores)
- **Ubicación:** `src/app/api/company/interview-requests/route.ts:57` · relacionados: `src/lib/authz-applications.ts`, `src/app/api/company/interviews/route.ts`, `src/app/api/evaluations/notes/route.ts`
- **Problema:** Todas las demas rutas de empresa limitan la visibilidad a COMPANY_VISIBLE_STATUSES (sent_to_company en adelante). POST /api/company/interview-requests solo comprueba que la vacante sea de la empresa, no el status de la aplicacion, y tanto su respuesta como los listados GET devuelven candidateName, candidateEmail y candidatePhone. Los IDs de Application son autoincrementales.
- **Evidencia:**

```ts
// src/app/api/company/interview-requests/route.ts:72-77, 136, 169-175
if (application.job.userId !== parseInt(userId)) {
  return NextResponse.json({ ...'No tienes permiso sobre esta aplicación' }, { status: 403 });
}
// (no hay comprobacion de application.status)
...
message: `Solicitud de entrevista enviada para ${application.candidateName}`
...
application: { select: { id: true, candidateName: true, candidateEmail: true, candidatePhone: true, status: true,
```

- **Escenario de fallo:** Una empresa (incluso recien auto-registrada y sin aprobar) publica una vacante, espera postulaciones y recorre POST /api/company/interview-requests con applicationId=1..N, type='videocall', availableSlots=[{...}]. Para cada aplicacion de sus vacantes en status 'pending' o 'reviewing' se crea la solicitud; luego GET /api/company/interview-requests le devuelve nombre, email y telefono de todos los postulantes, saltandose el filtro de reclutador/especialista (el servicio que INAKAT cobra). Cada intento ademas envia un email a todos los admins.
- **Arreglo propuesto:** Tras el check de ownership anadir: if (!COMPANY_VISIBLE_STATUSES.includes(application.status)) return 403. Mover COMPANY_VISIBLE_STATUSES a src/lib/authz-applications.ts y exponer canCompanySeeApplication(); usarlo tambien en GET /api/evaluations/notes. Anadir rate limit a este POST.
- **Otros auditores añaden:** Tras la comprobacion de ownership agregar: `if (!['sent_to_company','company_interested','interviewed'].includes(application.status)) return 403`. Mover COMPANY_VISIBLE_STATUSES a un modulo compartido (hoy esta duplicado en 4 archivos) y reutilizarlo.

#### EMP-006 — Las "Notas internas (solo admin)" de la entrevista se entregan a la empresa en las APIs de company

- **Severidad:** 🟠 high · **Categoría:** security · **Estado:** nuevo · **Verificación:** ✅ verificada contra el código
- **Ubicación:** `src/app/api/company/interviews/route.ts:65` · relacionados: `src/app/api/company/interview-requests/route.ts`, `src/app/company/interviews/page.tsx`, `src/app/admin/interviews/page.tsx`
- **Problema:** El admin escribe `adminNotes` en un campo rotulado "Notas internas (solo admin)". GET /api/company/interviews hace spread del registro completo (`...ir`) y GET /api/company/interview-requests devuelve el findMany sin `select`, por lo que `adminNotes` (y `confirmedById`) viajan en el JSON a cualquier usuario con rol company. La interfaz de src/app/company/interviews/page.tsx incluso declara `adminNotes`. Misma clase de fuga que #50/#51 de la auditoria de junio, que no cubrio InterviewRequest.
- **Comprobación:** Confirmado: el `include` no usa `select` sobre `InterviewRequest`, así que el spread `...ir` entrega `adminNotes` ("Notas internas del admin" en el esquema).
- **Evidencia:**

```ts
// src/app/api/company/interviews/route.ts:65-70
    const data = interviewRequests.map((ir) => ({
      ...ir,
      participants: safeJsonParse(ir.participants, null),
      availableSlots: safeJsonParse(ir.availableSlots, [] as unknown[]),
      confirmedSlot: safeJsonParse(ir.confirmedSlot, null),
    }));

// src/app/admin/interviews/page.tsx:603
<label ...>Notas internas (solo admin)</label>
```

- **Escenario de fallo:** Admin anota en la entrevista "El candidato tiene otra oferta; la empresa paga por debajo del mercado". Un usuario de la empresa abre /company/interviews, mira la respuesta de /api/company/interviews en DevTools y lee `adminNotes` completo.
- **Arreglo propuesto:** En ambas rutas company usar `select` explicito o eliminar los campos internos antes de responder: `const { adminNotes, confirmedById, ...safe } = ir;`. Quitar `adminNotes` de la interfaz de company/interviews/page.tsx y anadir un test que verifique que la respuesta no contiene la clave.
- **Otros auditores añaden:** En ambos endpoints de empresa usar `select` explicito (id, type, duration, participants, availableSlots, message, status, confirmedSlot, topic, scheduledStart, scheduledEnd, location, meetingUrl, createdAt, application) o excluir con `const { adminNotes, confirmedById, ...safe } = ir`. Quitar `adminNotes` de la interfaz de la pagina de empresa. Anadir test que verifique que la respuesta no contiene la clave. — En ambas rutas usar `select` explicito (id, applicationId, type, duration, participants, availableSlots, message, status, confirmedSlot, topic, scheduledStart, scheduledEnd, location, meetingUrl, createdAt, application{...}) sin adminNotes/confirmedById. Quitar `adminNotes` de la interfaz de src/app/company/interviews/page.tsx. Eliminar el GET de interview-requests si no se usa.

#### EMP-007 — Fuga de notas internas a la empresa: /api/company/jobs/[jobId]/candidates sigue enviando Application.notes y Candidate.notas, y el modal las pinta sin filtrar por rol

- **Severidad:** 🟠 high · **Categoría:** security · **Estado:** arreglo previo incompleto · **Verificación:** ✅ verificada contra el código
- **Ubicación:** `src/app/api/company/jobs/[jobId]/candidates/route.ts:147` · relacionados: `src/components/shared/CandidateProfileModal.tsx`, `src/app/company/jobs/[jobId]/candidates/page.tsx`, `src/components/company/CompanyApplicationsTable.tsx`, `src/app/api/company/dashboard/route.ts`
- **Problema:** La remediacion #50/#51 de junio solo se aplico en /api/company/dashboard. La ruta que alimenta la pagina /company/jobs/[jobId]/candidates sigue devolviendo `notes: app.notes` (notas internas de la aplicacion, p. ej. razones de descarte del reclutador) y `candidateProfile.notas` (notas del admin). Esa pagina pasa el objeto tal cual a CandidateProfileModal con userRole='company', y el modal renderiza las secciones 'Notas del Admin' (lineas 1331-1342) y 'Notas de la Aplicacion' (1344-1355) sin ninguna comprobacion de rol. CompanyApplicationsTable.tsx (linea 523) tambien pinta candidateProfile.notas.
- **Comprobación:** Confirmado: la respuesta incluye `notes: app.notes` y `notas: candidate.notas`.
- **Evidencia:**

```ts
// company/jobs/[jobId]/candidates/route.ts
145  cvUrl: app.cvUrl,
146  coverLetter: app.coverLetter,
147  notes: app.notes,
...
168  notas: candidate.notas,
// CandidateProfileModal.tsx 1332-1339
{data.adminNotas && (
  ... Notas del Admin ...
  <p ...>{data.adminNotas}</p>
// 1345
{data.notes && ( ... Notas de la Aplicación
```

- **Escenario de fallo:** Usuario con rol company abre /company/jobs/12/candidates y hace clic en un candidato: el modal muestra 'Notas del Admin' y 'Notas de la Aplicacion' con comentarios internos de INAKAT sobre el candidato. Tambien basta con mirar la respuesta JSON de GET /api/company/jobs/12/candidates en DevTools.
- **Arreglo propuesto:** En la ruta: eliminar `notes: app.notes` y `notas: candidate.notas` de la respuesta (igual que se hizo en company/dashboard con el destructuring `{ notes: _internalNotes, ...appPublic }`). En el modal, como defensa en profundidad, renderizar adminNotas/notes solo si userRole es 'admin' | 'recruiter' | 'specialist'. Quitar el bloque de notas de CompanyApplicationsTable.
- **Otros auditores añaden:** Eliminar `notes: app.notes` y `notas: candidate.notas` de la respuesta (igual que se hizo en dashboard/route.ts). En CandidateProfileModal envolver los bloques 'Notas del Admin' y 'Notas de la Aplicacion' en `userRole !== 'company'` como defensa en profundidad. Agregar un test que importe el handler GET y afirme que la respuesta no contiene las claves `notes` ni `notas`. — En candidates/route.ts quitar 'notes' y 'notas' del objeto devuelto; en company/applications/[id] GET desestructurar {notes, ...appPublic} y quitar notas, recruiterNotes y specialistNotes (la empresa ya recibe publicEvaluationNotes con isPublic). En integration-candidate.ts dejar notasAdicionales en null o construirlo solo con notas isPublic. Crear un mapper unico toCompanyApplicationDTO() usado por las 3 rutas de empresa y la integracion, con test que falle si aparece cualquiera de esos campos.

#### EMP-008 — El registro de empresa falla con 400 'Datos invalidos' cuando el sitio web se deja vacio (el form envia null y zod no lo acepta)

- **Severidad:** 🟠 high · **Categoría:** correctness · **Estado:** arreglo previo incompleto · **Verificación:** sin verificar (reportada por 1 auditor)
- **Ubicación:** `src/components/sections/companies/FormRegisterForQuotationSection.tsx:425` · relacionados: `src/lib/validations.ts`, `src/app/api/company-requests/route.ts`, `__tests__/api/company-requests.test.ts`
- **Problema:** El fix #9/#52 activo companyRequestSchema en el POST, pero el schema define `sitioWeb: z.string().url().optional().or(z.literal(''))`, que acepta string, undefined o '' y NO null. El formulario manda `sitioWeb: formData.sitioWeb || null`, es decir null cuando el campo 'Sitio web (opcional)' queda vacio. Ademas el regex del cliente acepta 'www.empresa.com' sin protocolo, que `z.url()` rechaza. Resultado: solo se puede registrar quien escriba una URL completa con https://. El test que dice cubrir 'solicitud sin sitioWeb' llama al mock de prisma, no a la ruta, por eso no lo detecto.
- **Evidencia:**

```ts
// FormRegisterForQuotationSection.tsx
          correoEmpresa: formData.correoEmpresa,
          sitioWeb: formData.sitioWeb || null,
          razonSocial: formData.razonSocial,
// src/lib/validations.ts
  sitioWeb: z.string().url('URL inválida').optional().or(z.literal('')),
```

- **Escenario de fallo:** Una empresa llena /companies, deja vacio 'Sitio web (opcional)' y envia. Primero se suben identificacion y constancia a Blob; luego POST /api/company-requests responde 400 {error:'Datos inválidos'}. El usuario ve solo 'Datos inválidos' sin saber que campo falla, reintenta, y tras 5 intentos queda bloqueado por el rate limit de uploads (15/h). No puede registrarse.
- **Arreglo propuesto:** En el form enviar `sitioWeb: formData.sitioWeb.trim() || undefined` y normalizar anteponiendo 'https://' si falta protocolo. En el schema usar `.nullish()` / `z.preprocess(v => v === null ? undefined : v, ...)` para tolerar null. Agregar test que importe `POST` de la ruta y envie exactamente el payload del formulario con sitioWeb vacio.

## 🟡 medium (14)

#### EMP-009 — Las notificaciones in-app se crean sin await en 10 sitios; el arreglo serverless de junio (#70) solo se aplico al webhook de MercadoPago

- **Severidad:** 🟡 medium · **Categoría:** reliability · **Estado:** arreglo previo incompleto · **Verificación:** sin verificar (reportada por 1 auditor)
- **Ubicación:** `src/app/api/company-requests/[id]/route.ts:69` · relacionados: `src/lib/notifications.ts`, `src/app/api/applications/route.ts`, `src/app/api/company-requests/route.ts`, `src/app/api/company/applications/[id]/route.ts`, `src/app/api/admin/assignments/route.ts`, `src/app/api/admin/assign-candidates/route.ts`, `src/app/api/recruiter/dashboard/route.ts`, `src/app/api/specialist/dashboard/route.ts`
- **Problema:** `createNotification`/`notifyAllAdmins` hacen 1-2 consultas a DB. Todos los callers salvo el webhook de MercadoPago las invocan como `fn(...).catch(() => {})` sin esperar y responden de inmediato. En Vercel la funcion puede congelarse antes de que el INSERT llegue a Postgres, y el `.catch(() => {})` vacio oculta cualquier error (ni siquiera se loguea). La auditoria de junio documento exactamente este riesgo y lo corrigio con `await Promise.allSettled` solo en un sitio. Sitios afectados: applications/route.ts:173, company-requests/route.ts:131, company-requests/[id]/route.ts:69, company/applications/[id]/route.ts:205, admin/assignments/route.ts:268 y 278, admin/assign-candidates/route.ts:147, recruiter/dashboard/route.ts:389, specialist/dashboard/route.ts:329 y 525.
- **Evidencia:**

```ts
createNotification({
  userId: updatedRequest.userId,
  type: notifType,
  title: notifTitle,
  message: notifMessage,
  link: status === 'approved' ? '/company/dashboard' : undefined,
  metadata: { requestId: updatedRequest.id },
}).catch(() => {});
```

- **Escenario de fallo:** El admin aprueba a una empresa. La ruta responde 200 en milisegundos y la lambda se congela antes del INSERT. La empresa nunca ve '¡Tu empresa ha sido aprobada!' (y, como tampoco se envia email -ver hallazgo de plantillas muertas-, no se entera por ningun canal). Igual para 'Nueva vacante asignada' al reclutador o 'Candidato disponible' a la empresa.
- **Arreglo propuesto:** Crear en src/lib/notifications.ts un helper `notifyInBackground(fn)` que use `after()` de 'next/server' (o simplemente `await` dentro de try/catch con `console.error`) y reemplazar los 10 `.catch(() => {})`. Como minimo: `await createNotification(...).catch((e) => console.error('[NOTIF]', e))` — el costo es un INSERT (<20 ms).

#### EMP-010 — DELETE de solicitud deja un usuario empresa huerfano y activo; el dashboard crashea con companyInfo null

- **Severidad:** 🟡 medium · **Categoría:** data-integrity · **Estado:** nuevo · **Verificación:** sin verificar (reportada por 1 auditor)
- **Ubicación:** `src/app/api/company-requests/[id]/route.ts:252` · relacionados: `src/app/company/dashboard/page.tsx`, `src/app/api/company/dashboard/route.ts`
- **Problema:** DELETE borra solo la fila CompanyRequest. El User (role company, isActive true), sus vacantes y creditos siguen vivos y puede iniciar sesion. /api/company/dashboard devuelve entonces `companyInfo: null` y la pagina accede a `data.company.companyInfo.logoUrl` y `.nombreEmpresa` sin null-check, lanzando TypeError (pantalla de error de cliente). /api/company/profile responde 404 'No tienes una empresa registrada'. El endpoint no tiene boton en el panel admin, pero esta expuesto.
- **Evidencia:**

```ts
// company-requests/[id]/route.ts
    await prisma.companyRequest.delete({
      where: { id: requestId }
    });
// company/dashboard/page.tsx
              <CompanyLogo
                logoUrl={data.company.companyInfo.logoUrl}
                companyName={data.company.companyInfo.nombreEmpresa}
```

- **Escenario de fallo:** Un admin limpia una solicitud duplicada con DELETE /api/company-requests/15. El usuario de esa empresa inicia sesion, es redirigido a /company/dashboard y ve 'Application error: a client-side exception has occurred'. Aun asi puede publicar vacantes por API porque su cuenta sigue activa.
- **Arreglo propuesto:** En DELETE: si existingRequest.userId existe, rechazar con 409 cuando el usuario tenga vacantes o compras, o desactivar el User en la misma transaccion. En dashboard/page.tsx usar `data.company.companyInfo?.logoUrl` y un estado 'Tu empresa no tiene solicitud asociada, contacta soporte' cuando companyInfo sea null.

#### EMP-011 — POST /api/company-requests (publico) no tiene rate limit: alta masiva de cuentas company, spam a admins y enumeracion de correos

- **Severidad:** 🟡 medium · **Categoría:** security · **Estado:** nuevo · **Verificación:** sin verificar (reportada por 3 auditores)
- **Ubicación:** `src/app/api/company-requests/route.ts:38` · relacionados: `src/lib/rate-limit.ts`, `src/middleware.ts`
- **Problema:** A diferencia de /api/auth/register (REGISTER_RATE_LIMIT), el alta publica de empresas no llama a applyRateLimit. Cada request valido ejecuta bcrypt, crea CompanyRequest + User activo y dispara notifyAllAdmins (una notificacion por admin). La respuesta 409 'Ya existe una cuenta con este correo electronico.' confirma que un email esta registrado sin ningun limite de intentos.
- **Evidencia:**

```ts
// POST new company request
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { password, logoUrl } = body; // password/logoUrl no están en el schema
    ...
    if (existingUser) {
      return NextResponse.json(
        { error: "Ya existe una cuenta con este correo electrónico." },
        { status: 409 }
```

- **Escenario de fallo:** Un script envia miles de POST /api/company-requests con RFC sinteticamente validos y correos distintos: se crean miles de usuarios company activos (que ademas pueden operar, ver hallazgo de aprobacion), /admin/requests y la campanita de todos los admins quedan inundadas y la funcion gasta CPU en bcrypt. Con una lista de correos, el 409 sirve de oraculo de cuentas existentes sin throttling.
- **Arreglo propuesto:** Agregar `const blocked = applyRateLimit(request, 'company-request', REGISTER_RATE_LIMIT); if (blocked) return blocked;` al inicio del POST (y un limite por correoEmpresa). Considerar captcha/honeypot validado en servidor. Unificar el mensaje de duplicado con una respuesta generica tipo 'Si el correo es valido recibiras instrucciones'.
- **Otros auditores añaden:** Agregar al inicio `const limited = applyRateLimit(request, 'company-register', REGISTER_RATE_LIMIT); if (limited) return limited;`. Considerar captcha/honeypot real validado en servidor (el honeypot actual del form no se comprueba). — Anadir const rateLimited = applyRateLimit(request, 'company-request', REGISTER_RATE_LIMIT) al inicio del POST (y captcha/turnstile en el formulario de /companies). Validar logoUrl con el helper de URL segura e incluirlo en companyRequestSchema.

#### EMP-012 — La empresa puede sobrescribir Application.notes (campo de notas internas) al cambiar el status de un candidato

- **Severidad:** 🟡 medium · **Categoría:** authz · **Estado:** nuevo · **Verificación:** sin verificar (reportada por 2 auditores)
- **Ubicación:** `src/app/api/company/applications/[id]/route.ts:158` · relacionados: `src/app/api/my-applications/route.ts`, `src/lib/integration-candidate.ts`
- **Problema:** El mismo campo que el arreglo #50/#51 oculta a la empresa por ser interno es escribible por ella: el PATCH reemplaza notes con lo que venga en el body, pisando lo que hubieran escrito admin o el inyector de candidatos. Ese texto acaba mostrandose al candidato en /my-applications y exportandose por la integracion.
- **Evidencia:**

```ts
// src/app/api/company/applications/[id]/route.ts:55, 158-160
const { status, notes, closeJob } = body;
...
if (notes !== undefined) {
  updateData.notes = notes;
}
```

- **Escenario de fallo:** Admin anota en la aplicacion 'Referencias verificadas, pretension 45k'. La empresa descarta con PATCH /api/company/applications/15 {status:'rejected', notes:''}: la nota interna se borra. O escribe texto ofensivo que el candidato lee despues como 'Nota de la empresa'.
- **Arreglo propuesto:** Separar campos: anadir Application.companyNotes (migracion) y que este PATCH escriba solo ahi, con sanitizeMultilineText y limite de longitud; dejar Application.notes exclusivo de admin/staff. Mientras no haya migracion, ignorar 'notes' en este endpoint.
- **Otros auditores añaden:** Eliminar `notes` del destructuring y de updateData en esta ruta. Si se quiere que la empresa deje comentarios, crear un campo separado (p. ej. Application.companyNotes) con sanitizeMultilineText y limite de longitud.

#### EMP-013 — 11 notificaciones/emails/webhooks siguen en fire-and-forget en serverless; el fix #70 solo cubrio el webhook de MercadoPago

- **Severidad:** 🟡 medium · **Categoría:** reliability · **Estado:** arreglo previo incompleto · **Verificación:** sin verificar (reportada por 3 auditores)
- **Ubicación:** `src/app/api/company/applications/[id]/route.ts:185` · relacionados: `src/app/api/recruiter/dashboard/route.ts`, `src/app/api/specialist/dashboard/route.ts`, `src/app/api/admin/assignments/route.ts`, `src/app/api/admin/assign-candidates/route.ts`, `src/app/api/applications/route.ts`, `src/app/api/company-requests/route.ts`, `src/app/api/company-requests/[id]/route.ts`, `src/app/api/company/interview-requests/route.ts`, `src/app/api/applications/[id]/route.ts`, `src/lib/worky2-webhook.ts`
- **Problema:** En Vercel la funcion puede congelarse en cuanto se envia la respuesta, por lo que las promesas no esperadas pueden no completarse. La auditoria lo corrigio en webhooks/mercadopago con await + Promise.allSettled, pero el mismo patron persiste en 11 sitios, incluido el mas costoso: void dispatchCandidateAccepted() hace 2+ queries y un fetch externo con timeout de 5 s despues de responder. No se usa after() de next/server ni waitUntil en ningun punto del repo.
- **Evidencia:**

```ts
if (status === 'accepted') {
  void dispatchCandidateAccepted(applicationId);
}
...
notifyAllAdmins({ ... }).catch(() => {});
// mismo patron: recruiter/dashboard/route.ts:396, specialist/dashboard/route.ts:336 y :532,
// admin/assignments/route.ts:275 y :285, admin/assign-candidates/route.ts:154,
// applications/route.ts:179, company-requests/route.ts:137, company-requests/[id]/route.ts:76,
// company/interview-requests/route.ts:129 (emails a admins), applications/[id]/route.ts:440
```

- **Escenario de fallo:** La empresa marca a un candidato como 'accepted'. La respuesta 200 sale en ~150 ms y la instancia se congela antes de que dispatchCandidateAccepted termine sus queries y el POST a Worky2: el evento candidate.accepted nunca llega y no hay reintento ni registro. Igual con el especialista que no recibe 'Candidato enviado para evaluacion' o los admins que no reciben el email de solicitud de entrevista; los .catch(() => {}) ocultan ademas cualquier error.
- **Arreglo propuesto:** Usar after() de 'next/server' (estable en Next 15.1+) o waitUntil de @vercel/functions para todo trabajo posterior a la respuesta: after(() => dispatchCandidateAccepted(id)); after(() => notifyAllAdmins(...)). Crear un helper runAfterResponse(fn, etiqueta) en src/lib que registre errores con console.error en vez de tragarlos, y reemplazar los 11 sitios. Para el webhook Worky2 agregar una tabla de entregas con reintento.
- **Otros auditores añaden:** Envolver los efectos en `after(() => Promise.allSettled([...]))` de 'next/server' (estable desde Next 15.1) o hacer `await Promise.allSettled([...])` antes de responder, como en el webhook. Sustituir `.catch(() => {})` por un catch que haga console.error con contexto. — Usar `after(() => dispatchCandidateAccepted(applicationId))` de 'next/server' (estable en Next 15.1+) o `waitUntil` de @vercel/functions en ambas rutas; registrar cada intento (tabla IntegrationWebhookDelivery con status/response) y anadir un reintento con backoff; actualizar la seccion 4 del doc.

#### EMP-014 — GET /api/company/dashboard carga las aplicaciones dos veces, sin limites, y calcula estadisticas filtrando en JS

- **Severidad:** 🟡 medium · **Categoría:** performance · **Estado:** nuevo · **Verificación:** sin verificar (reportada por 1 auditor)
- **Ubicación:** `src/app/api/company/dashboard/route.ts:75` · relacionados: `src/app/company/dashboard/page.tsx`
- **Problema:** Primero trae todas las vacantes con include de TODAS las filas completas de applications (solo para usar .length), y luego vuelve a traer las mismas aplicaciones en allApplications con otro join. Despues calcula conteos por status con 6 filter() globales y, por cada vacante, otro filter() sobre todas las aplicaciones (O(jobs x apps)). La respuesta incluye allApplications con perfil completo, recentApplications (duplicado) y allJobs con el arreglo applications embebido (triplicado).
- **Evidencia:**

```ts
const jobs = await prisma.job.findMany({
  where: { userId: companyUserId },
  include: {
    applications: { where: { status: { in: COMPANY_VISIBLE_STATUSES } } }
  },
  orderBy: { createdAt: 'desc' }
});
...
const allApplications = await prisma.application.findMany({
  where: { jobId: { in: jobIds }, status: { in: COMPANY_VISIBLE_STATUSES } },
...
const jobStats = jobs.map((job) => {
  const jobApplications = allApplications.filter((app) => app.jobId === job.id);
```

- **Escenario de fallo:** Una empresa con 80 vacantes historicas y 2,000 candidatos enviados abre /company/dashboard: se leen 4,000 filas de Application (2 veces las mismas, con coverLetter/notes), 2,000 perfiles con experiencias, se ejecutan 160k comparaciones en JS y se serializa un JSON con cada aplicacion repetida hasta 3 veces; el tiempo de carga crece linealmente y se acerca al limite de payload.
- **Arreglo propuesto:** En jobs usar _count: { select: { applications: { where: { status: { in: COMPANY_VISIBLE_STATUSES } } } } } en vez de include. Obtener stats con prisma.application.groupBy({ by:['jobId','status'], where:{ job:{ userId } }, _count:true }). Devolver solo recentApplications (take 5) y paginar la tabla de aplicaciones con un endpoint propio; no embeber applications en allJobs.

#### EMP-015 — Solicitud de entrevista sin validacion de participants/availableSlots y 500 con applicationId no numerico

- **Severidad:** 🟡 medium · **Categoría:** validation · **Estado:** nuevo · **Verificación:** sin verificar (reportada por 1 auditor)
- **Ubicación:** `src/app/api/company/interview-requests/route.ts:42` · relacionados: `src/components/company/InterviewRequestModal.tsx`
- **Problema:** `availableSlots` solo se valida como array no vacio; sus elementos, cantidad, formato de fecha/hora y que sean futuros no se comprueban. `participants` se serializa tal cual (cualquier JSON, cualquier tamano, emails sin validar; en el modal el input type=email no valida porque no hay submit de form). `parseInt(applicationId)` con un valor no numerico da NaN y prisma.findUnique lanza, devolviendo 500 en vez de 400. Tampoco hay atomicidad entre el findFirst de 'pending' y el create (dos clics rapidos crean duplicados).
- **Evidencia:**

```ts
    if (!Array.isArray(availableSlots) || availableSlots.length === 0) {
...
    const application = await prisma.application.findUnique({
      where: { id: parseInt(applicationId) },
...
        participants: participants ? JSON.stringify(participants) : null,
        availableSlots: JSON.stringify(availableSlots),
```

- **Escenario de fallo:** Una empresa envia availableSlots:[{date:'ayer', time:'99:99'}] y participants con 50.000 objetos. Se guarda todo; en /admin/interviews el admin ve 'Invalid Date' y una fila de varios MB. Con applicationId:'abc' la API responde 500 'Error interno del servidor'.
- **Arreglo propuesto:** Validar con zod: applicationId entero positivo; availableSlots array de 1..30 de {date: /^\d{4}-\d{2}-\d{2}$/, time: /^\d{2}:\d{2}$/} con fecha >= hoy; participants array max 10 de {nombre: string 1..100, email: email}. Responder 400 con detalle. Evitar duplicados con indice unico parcial (applicationId where status='pending') o transaccion.

#### EMP-016 — Solicitud de entrevista: los emails a admins se lanzan sin await y el tipo de notificacion `interview_requested` nunca se emite

- **Severidad:** 🟡 medium · **Categoría:** reliability · **Estado:** nuevo · **Verificación:** sin verificar (reportada por 1 auditor)
- **Ubicación:** `src/app/api/company/interview-requests/route.ts:121` · relacionados: `src/lib/notifications.ts`, `src/lib/email.ts`, `src/components/shared/NotificationBell.tsx`
- **Problema:** Al crear una InterviewRequest se envia un email SMTP por admin dentro de un `for` sin await; el handshake con Zoho tarda 1-3 s y la ruta responde de inmediato, por lo que en serverless el envio se corta. No hay respaldo in-app: el tipo `'interview_requested'` esta declarado en NotificationType (src/lib/notifications.ts:19) y tiene icono en NotificationBell.tsx:152 y notifications/page.tsx:36, pero grep confirma que ningun codigo lo emite. Los admins dependen al 100% de un email que probablemente no sale.
- **Evidencia:**

```ts
for (const admin of adminUsers) {
  sendInterviewRequestToAdmin({
    adminEmail: admin.email,
    companyName: companyRequest?.nombreEmpresa || 'Empresa',
    candidateName: application.candidateName,
    jobTitle: application.job.title,
    interviewType: type,
    adminUrl: `${process.env.NEXT_PUBLIC_APP_URL || 'https://inakat.com'}/admin/interviews`,
  }).catch(err => console.error('[InterviewRequest] Error sending admin email:', err));
}
```

- **Escenario de fallo:** La empresa solicita entrevista con 3 horarios propuestos. Responde 201 y la lambda se congela a mitad del handshake SMTP. Ningun admin recibe email ni campanita; los horarios propuestos caducan sin que nadie agende.
- **Arreglo propuesto:** Sustituir el bucle por `await Promise.allSettled([notifyAllAdmins({type:'interview_requested', title:'Nueva solicitud de entrevista', message:`${companyName} solicito entrevista con ${candidateName} para "${jobTitle}"`, link:'/admin/interviews', metadata:{interviewRequestId}}), ...adminUsers.map(a => sendInterviewRequestToAdmin({...}))])` (o envolverlo en `after()`), y definir `maxDuration` en la ruta.

#### EMP-017 — N+1 concurrente en GET /api/company/jobs/[jobId]/candidates: 2 queries por aplicacion dentro de Promise.all

- **Severidad:** 🟡 medium · **Categoría:** performance · **Estado:** nuevo · **Verificación:** sin verificar (reportada por 2 auditores)
- **Ubicación:** `src/app/api/company/jobs/[jobId]/candidates/route.ts:100` · relacionados: `src/app/api/company/dashboard/route.ts`
- **Problema:** El dashboard de empresa, recruiter y specialist fueron optimizados a batch queries (comentario 'OPTIMIZADO: Eliminadas queries N+1'), pero esta ruta hermana quedo con el patron viejo: por cada aplicacion lanza candidate.findFirst (con mode insensitive, que no usa el indice unico de email y provoca seq scan) y evaluationNote.findMany, todo en paralelo con Promise.all, saturando el pool de conexiones de Prisma.
- **Evidencia:**

```ts
const enrichedApplications = await Promise.all(
  applications.map(async (app) => {
    const candidate = await prisma.candidate.findFirst({
      where: { email: { equals: app.candidateEmail, mode: 'insensitive' } },
      include: { experiences: { orderBy: { fechaInicio: 'desc' }, take: 3 }, documents: true }
    });
    const publicNotes = await prisma.evaluationNote.findMany({
      where: { applicationId: app.id, isPublic: true },
```

- **Escenario de fallo:** Una empresa abre /company/jobs/77/candidates con 40 candidatos enviados: se disparan 80+ queries simultaneas (mas las sub-queries de include) contra un pool serverless pequeno. Con la tabla Candidate grande cada findFirst es un scan secuencial; las queries encolan, aparecen errores P2024 (timed out fetching a new connection from the pool) y la pagina devuelve 500 'Error al obtener candidatos' justo en el flujo principal de la empresa.
- **Arreglo propuesto:** Replicar el patron de company/dashboard: un solo prisma.candidate.findMany({ where:{ email:{ in: emailsLower } }, include... }) y un solo prisma.evaluationNote.findMany({ where:{ applicationId:{ in: ids }, isPublic:true }, include:{author...} }), construir Map por email y por applicationId y enriquecer en memoria (3 queries en total).
- **Otros auditores añaden:** Reutilizar el patron del dashboard: un `candidate.findMany({ where: { email: { in: emails, mode: 'insensitive' } }, include: {...} })` y un `evaluationNote.findMany({ where: { applicationId: { in: ids }, isPublic: true } })`, agrupando en Maps. En la pagina, actualizar el estado local del candidato en vez de recargar todo.

#### EMP-018 — La empresa recibe URLs publicas permanentes de TODOS los documentos del candidato

- **Severidad:** 🟡 medium · **Categoría:** security · **Estado:** pendiente conocido de junio · **Verificación:** sin verificar (reportada por 1 auditor)
- **Ubicación:** `src/app/api/company/jobs/[jobId]/candidates/route.ts:110` · relacionados: `src/app/api/upload/route.ts`, `src/components/shared/CandidateProfileModal.tsx`
- **Problema:** Detalle nuevo sobre el pendiente #56. La ruta incluye `documents: true` y devuelve `candidate.documents` completo (name, fileUrl, fileType) ademas de cvUrl y fotoUrl. Al ser blobs con access 'public' y URL permanente, la empresa conserva acceso a cualquier documento que el candidato haya subido a su perfil (no solo al CV de esa postulacion) aun despues de descartarlo o de cerrar la vacante, y puede reenviar los enlaces.
- **Evidencia:**

```ts
          include: {
            experiences: {
              orderBy: { fechaInicio: 'desc' },
              take: 3
            },
            documents: true
          }
...
                documents: candidate.documents,
```

- **Escenario de fallo:** Un candidato sube a su perfil su titulo, cedula y comprobante de domicilio para otra postulacion. La empresa X lo recibe para una vacante distinta, lo descarta, y aun asi se queda con los enlaces directos a todos esos archivos, abribles sin sesion.
- **Arreglo propuesto:** Limitar a la empresa los documentos necesarios (CV de la postulacion y los que el candidato o el reclutador marquen como compartibles) con `select` explicito. Al resolver #56, servirlos mediante un endpoint autenticado que verifique ownership y estado visible y emita URL firmada de corta duracion.

#### EMP-019 — Contrato shell/página: la barra "sticky top-0 z-30" del dashboard de empresa queda oculta bajo el Navbar fijo (z-50)

- **Severidad:** 🟡 medium · **Categoría:** frontend-bug · **Estado:** nuevo · **Verificación:** sin verificar (reportada por 1 auditor)
- **Ubicación:** `src/app/company/dashboard/page.tsx:296` · relacionados: `src/app/layout.tsx`, `src/components/commons/Navbar.tsx`, `src/app/globals.css`
- **Problema:** El root layout monta un Navbar position:fixed top-0 z-50 de ~64px de alto con sesión iniciada. El dashboard de empresa define su cabecera (logo, saldo de créditos y botón "Crear Vacante") como sticky top-0 z-30: al hacer scroll se pega en y=0, exactamente debajo del Navbar, que la tapa casi por completo (solo asoma la franja inferior). El sticky no cumple su función y el CTA principal desaparece al desplazarse.
- **Evidencia:**

```ts
// src/app/company/dashboard/page.tsx:295-296
{/* Barra sticky */}
<div className="sticky top-0 z-30 bg-custom-beige border-b border-gray-200 shadow-sm">
// src/components/commons/Navbar.tsx:183
<nav className="fixed top-0 left-0 w-full bg-custom-beige py-2 z-50">
```

- **Escenario de fallo:** Empresa con 15 vacantes hace scroll en /company/dashboard: la barra con "Crear Vacante" y el contador de créditos se desliza bajo el Navbar y queda tapada; para crear una vacante debe volver hasta arriba.
- **Arreglo propuesto:** Exponer la altura del navbar como variable CSS en globals.css (--navbar-h: 4rem) usada por body padding-top, scroll-padding-top y los sticky de página; en el dashboard usar className="sticky top-[var(--navbar-h)] z-30". Revisar cualquier otro sticky de página con el mismo criterio.

#### EMP-020 — La empresa nunca es avisada cuando el admin confirma, rechaza o cancela su entrevista, aunque la UI lo promete

- **Severidad:** 🟡 medium · **Categoría:** ux · **Estado:** nuevo · **Verificación:** sin verificar (reportada por 1 auditor)
- **Ubicación:** `src/app/company/interviews/page.tsx:228` · relacionados: `src/app/api/admin/interviews/[id]/route.ts`, `src/app/api/company/interview-requests/route.ts`, `src/lib/notifications.ts`
- **Problema:** La pagina dice 'Te notificaremos cuando se confirme la fecha y hora', pero PATCH /api/admin/interviews/[id] no crea notificacion ni envia email (grep de createNotification|notify|send en src/app/api/admin/interviews: sin resultados). El tipo 'interview_requested' existe en lib/notifications y en NotificationBell pero nunca se emite: al crear la solicitud tampoco hay notificacion in-app a los admins, solo el email sin await. Para estado 'rejected' la tarjeta no muestra ninguna explicacion (solo 'cancelled' tiene bloque).
- **Evidencia:**

```ts
                        <p className="text-sm text-yellow-800">
                          Tu solicitud está siendo coordinada por <strong>INAKAT</strong>. Te notificaremos cuando se confirme la fecha y hora.
                        </p>
```

- **Escenario de fallo:** La empresa solicita entrevista el lunes. El admin la confirma para el miercoles 10:00 con liga de Meet. La empresa no recibe campana ni correo; si no entra por su cuenta a /company/interviews no se entera y falta a la entrevista.
- **Arreglo propuesto:** En PATCH /api/admin/interviews/[id], cuando status cambie a confirmed/rejected/cancelled, llamar createNotification({userId: existing.requestedById, type:'interview_requested', link:'/company/interviews', ...}) y enviar email con fecha, hora y liga. En POST /api/company/interview-requests agregar notifyAllAdmins con type 'interview_requested'. Anadir bloque explicativo para 'rejected'.

#### EMP-021 — Los horarios propuestos guardan la fecha en UTC pero muestran etiqueta local: despues de las 18:00 (Mexico) el dia queda corrido +1

- **Severidad:** 🟡 medium · **Categoría:** correctness · **Estado:** nuevo · **Verificación:** sin verificar (reportada por 2 auditores)
- **Ubicación:** `src/components/company/InterviewRequestModal.tsx:55` · relacionados: `src/app/admin/interviews/page.tsx`
- **Problema:** `getNextBusinessDays` calcula dia de la semana y etiqueta con metodos locales, pero el valor `date` que se guarda sale de `toISOString()` (UTC). En UTC-6, de 18:00 a 23:59 la fecha UTC es el dia siguiente. El admin interpreta `slot.date` como fecha local (`${slot.date}T${slot.time}`), asi que agenda un dia despues del que la empresa eligio; incluso puede caer en sabado.
- **Evidencia:**

```ts
    const dayOfWeek = current.getDay();
    // Solo lunes a viernes (1-5)
    if (dayOfWeek >= 1 && dayOfWeek <= 5) {
      const dateStr = current.toISOString().split('T')[0];
      days.push({
        date: dateStr,
        label: `${current.getDate()} ${monthNames[current.getMonth()]}`,
        dayName: dayNames[dayOfWeek],
      });

// admin/interviews/page.tsx:198
    const dateStr = `${slot.date}T${slot.time}`;
```

- **Escenario de fallo:** Lunes 21-sep 19:00 CDMX: la empresa abre el modal y marca la columna "Mar 22 sep" a las 10:00. `current` = martes 22 19:00 local = miercoles 23 01:00 UTC -> se guarda {date:'2026-09-23', time:'10:00'}. El admin ve "23 sep - 10:00", lo selecciona y confirma la entrevista el miercoles; la empresa esperaba el martes.
- **Arreglo propuesto:** Construir la fecha con componentes locales: `const dateStr = `${current.getFullYear()}-${String(current.getMonth()+1).padStart(2,'0')}-${String(current.getDate()).padStart(2,'0')}`;`. Idealmente documentar ademas la zona horaria del slot en el payload.
- **Otros auditores añaden:** Construir la fecha con componentes locales: `const dateStr = `${current.getFullYear()}-${String(current.getMonth()+1).padStart(2,'0')}-${String(current.getDate()).padStart(2,'0')}``. Agregar un test unitario de getNextBusinessDays con la hora del sistema fijada a las 23:00.

#### EMP-022 — El formulario sube identificacion y constancia fiscal ANTES de validar la solicitud: documentos huerfanos en Blob publico y rate limit agotado

- **Severidad:** 🟡 medium · **Categoría:** data-integrity · **Estado:** nuevo · **Verificación:** sin verificar (reportada por 1 auditor)
- **Ubicación:** `src/components/sections/companies/FormRegisterForQuotationSection.tsx:370` · relacionados: `src/app/api/upload/route.ts`, `src/app/api/company-requests/route.ts`
- **Problema:** handleSubmit sube 2-3 archivos a /api/upload (Blob con access 'public') y solo despues llama a POST /api/company-requests. Si esa llamada falla (409 correo duplicado, 400 de zod como el caso de sitioWeb null, 500), los documentos de identidad ya quedaron publicados sin ninguna fila que los referencie ni mecanismo de borrado. Cada reintento vuelve a subirlos; el limite de 15 uploads/hora por IP se agota en 5 intentos y el usuario queda bloqueado. Agrava el pendiente #56 (URLs publicas permanentes).
- **Evidencia:**

```ts
      const idUploadRes = await fetch('/api/upload', {
        method: 'POST',
        body: idFormData
      });
...
      const docUploadRes = await fetch('/api/upload', {
        method: 'POST',
        body: docFormData
      });
```

- **Escenario de fallo:** Un representante se registra con un correo que ya existe. Se suben su INE y su constancia fiscal; la API responde 409. Corrige el correo y reenvia: se suben otra vez. Quedan 4 archivos con PII accesibles por URL publica para siempre y sin dueno en la base de datos.
- **Arreglo propuesto:** Agregar un endpoint de pre-validacion (o un flag dryRun en POST /api/company-requests) que ejecute zod + comprobacion de correo duplicado antes de subir. Alternativamente enviar todo en un solo multipart y subir a Blob en el servidor dentro del flujo, borrando con `del()` si la transaccion falla. Cachear en estado las URLs ya subidas para no re-subir en reintentos.

## ⚪ low (17)

#### EMP-023 — La empresa no ve el estado de su solicitud ni el motivo de rechazo, y la aprobacion no envia correo

- **Severidad:** ⚪ low · **Categoría:** ux · **Estado:** nuevo · **Verificación:** sin verificar (reportada por 1 auditor)
- **Ubicación:** `src/app/api/company-requests/[id]/route.ts:60` · relacionados: `src/lib/email.ts`, `src/app/company/profile/page.tsx`, `src/app/company/dashboard/page.tsx`
- **Problema:** Al aprobar o rechazar solo se crea una notificacion in-app (sin await). `sendCompanyApproved` existe en src/lib/email.ts pero nadie lo llama (y su plantilla incluiria la contrasena en claro). /api/company/profile devuelve `status` pero profile/page.tsx no lo muestra; el dashboard no recibe status ni rejectionReason. El modal de exito dice 'Ya puedes acceder a la plataforma' mientras la pagina dice 'nuestro equipo te contactara' y la API 'funciones limitadas hasta aprobacion'.
- **Evidencia:**

```ts
    if (updatedRequest.userId && (status === 'approved' || status === 'rejected')) {
...
      createNotification({
        userId: updatedRequest.userId,
        type: notifType,
...
      }).catch(() => {});
    }
```

- **Escenario de fallo:** El admin rechaza la solicitud por 'constancia fiscal ilegible'. La empresa no recibe correo; si no abre la campana de notificaciones nunca conoce el motivo, y en su perfil y dashboard no hay indicacion de que esta rechazada.
- **Arreglo propuesto:** Enviar email en aprobacion y rechazo (plantilla nueva sin contrasena; eliminar `password` de sendCompanyApproved). Incluir `status` y `rejectionReason` en /api/company/dashboard y mostrar banner en dashboard y perfil. Unificar los tres textos del flujo de registro.

#### EMP-024 — PUT admin de solicitud sin validacion y sin sincronizar el correo de login

- **Severidad:** ⚪ low · **Categoría:** validation · **Estado:** arreglo previo incompleto · **Verificación:** sin verificar (reportada por 1 auditor)
- **Ubicación:** `src/app/api/company-requests/[id]/route.ts:153` · relacionados: `src/components/sections/admin/RequestDetailModal.tsx`, `src/lib/validations.ts`
- **Problema:** La remediacion #9/#52 aplico zod solo al POST. El PUT de edicion (usado por RequestDetailModal) escribe nombre, correo, RFC, razon social y direccion sin ninguna validacion de formato, y guarda sitioWeb '' en vez de null. Si el admin corrige `correoEmpresa`, User.email (correo de login, creado en el registro) no cambia: la empresa sigue entrando con el correo antiguo mientras los correos de pago van al nuevo.
- **Evidencia:**

```ts
      data: {
        nombre: nombre || existingRequest.nombre,
...
        correoEmpresa: correoEmpresa || existingRequest.correoEmpresa,
        sitioWeb: sitioWeb !== undefined ? sitioWeb : existingRequest.sitioWeb,
        razonSocial: razonSocial || existingRequest.razonSocial,
        rfc: rfc || existingRequest.rfc,
```

- **Escenario de fallo:** La empresa se registro con 'rh@acmee.com' por error. El admin lo corrige a 'rh@acme.com' en el modal. La empresa intenta entrar con el correo correcto y recibe credenciales invalidas; el RFC editado 'abc' se guarda sin formato valido.
- **Arreglo propuesto:** Validar el body con `companyRequestSchema.partial()`. Si cambia correoEmpresa y existe userId, actualizar User.email en la misma transaccion comprobando unicidad (409 si ya existe). Normalizar sitioWeb vacio a null.

#### EMP-025 — Politica de contrasena del registro de empresa mas debil en servidor que en el resto de la app

- **Severidad:** ⚪ low · **Categoría:** validation · **Estado:** nuevo · **Verificación:** sin verificar (reportada por 1 auditor)
- **Ubicación:** `src/app/api/company-requests/route.ts:54` · relacionados: `src/app/api/auth/register/route.ts`, `src/app/api/auth/reset-password/route.ts`
- **Problema:** El servidor solo exige longitud >= 8. /api/auth/register y /api/auth/reset-password exigen ademas mayuscula y numero via zod; el formulario de empresa muestra esa misma regla pero solo en cliente. La remediacion #13/#25/#27 unifico la politica en reset pero no en esta via de alta.
- **Evidencia:**

```ts
    if (!password || typeof password !== "string" || password.length < 8) {
      return NextResponse.json(
        { error: "La contraseña debe tener al menos 8 caracteres" },
        { status: 400 }
      );
    }
```

- **Escenario de fallo:** Un cliente que llama a la API directamente crea una cuenta empresa con password 'aaaaaaaa', que el resto de flujos de la plataforma rechazarian.
- **Arreglo propuesto:** Extraer a src/lib/validations.ts un `passwordSchema` (min 8, /[A-Z]/, /[0-9]/) y usarlo en register, reset-password y company-requests; incluir `password` dentro de companyRequestSchema.

#### EMP-026 — Saludo del dashboard duplica el apellido: User.nombre ya contiene el apellido paterno

- **Severidad:** ⚪ low · **Categoría:** frontend-bug · **Estado:** nuevo · **Verificación:** sin verificar (reportada por 1 auditor)
- **Ubicación:** `src/app/api/company/dashboard/route.ts:258` · relacionados: `src/app/api/company-requests/route.ts`, `src/app/api/company/profile/route.ts`
- **Problema:** En el registro se guarda `nombre: `${nombre} ${apellidoPaterno}`` y ademas `apellidoPaterno` por separado. El dashboard compone `userName` concatenando de nuevo el apellido. Cualquier otro lugar que arme el nombre completo desde User tiene el mismo efecto para usuarios empresa. Ademas PUT /api/company/profile actualiza solo CompanyRequest, asi que cambiar el representante no cambia el saludo.
- **Evidencia:**

```ts
// company-requests/route.ts
          nombre: `${nombre} ${apellidoPaterno}`,
          apellidoPaterno,
// company/dashboard/route.ts
          userName: `${user.nombre} ${user.apellidoPaterno || ''}`,
```

- **Escenario de fallo:** Juan Perez Lopez registra su empresa. En /company/dashboard lee 'Bienvenido, Juan Perez Perez'.
- **Arreglo propuesto:** En el registro guardar `nombre` sin el apellido (los apellidos ya tienen columnas propias) y migrar los usuarios company existentes quitando el sufijo. En PUT /api/company/profile sincronizar User.nombre/apellidoPaterno/apellidoMaterno dentro de una transaccion.

#### EMP-027 — El dashboard calcula y envia PII de todos los candidatos y estadisticas que la pagina no usa

- **Severidad:** ⚪ low · **Categoría:** performance · **Estado:** nuevo · **Verificación:** sin verificar (reportada por 1 auditor)
- **Ubicación:** `src/app/api/company/dashboard/route.ts:281` · relacionados: `src/app/company/dashboard/page.tsx`
- **Problema:** dashboard/page.tsx solo consume `data.company` y `data.allJobs`. La API ademas consulta todas las aplicaciones, hace la consulta batch de candidatos con experiencias y devuelve `recentApplications`, `allApplications` (con telefono, fecha de nacimiento, sexo, CV, coordenadas), `topJobs`, `jobStats` y `stats`, ninguno renderizado. Es trabajo y exposicion de PII innecesarios en cada carga y en cada refresco tras pausar/publicar.
- **Evidencia:**

```ts
        recentApplications,
        allApplications: enrichedApplications,
        topJobs,
        jobStats,
        allJobs: jobs.map((job) => {
```

- **Escenario de fallo:** Una empresa con 30 vacantes y 600 candidatos descarga varios MB de JSON con PII cada vez que abre o refresca el dashboard, para pintar unicamente la tabla de vacantes.
- **Arreglo propuesto:** Reducir la respuesta a `company` + `allJobs` con `_count` de aplicaciones visibles (y `stats` si se va a mostrar). Eliminar allApplications/recentApplications/jobStats/topJobs o moverlos a un endpoint aparte cuando exista la UI.

#### EMP-028 — PUT /api/company/profile sin validacion de tipos ni de URLs; permite vaciar campos obligatorios

- **Severidad:** ⚪ low · **Categoría:** validation · **Estado:** nuevo · **Verificación:** sin verificar (reportada por 1 auditor)
- **Ubicación:** `src/app/api/company/profile/route.ts:200` · relacionados: `src/components/shared/CompanyLogo.tsx`, `next.config.ts`
- **Problema:** Los campos se usan con `.trim()` sin comprobar que sean string (un numero u objeto provoca TypeError y 500). `nombre`, `apellidoPaterno` y `direccionEmpresa` pueden guardarse como cadena vacia (solo nombreEmpresa y razonSocial se comprueban). `latitud`/`longitud` aceptan cualquier tipo o rango. `logoUrl` y `sitioWeb` se guardan sin validar esquema ni host: un logoUrl externo hace que next/image lance 'hostname is not configured' en desarrollo y muestre imagen rota en produccion en todas las vistas que pintan el logo. Tampoco hay limites de longitud, y nombreEmpresa/razonSocial (verificados por el admin contra documentos) se pueden cambiar tras la aprobacion sin revision ni registro.
- **Evidencia:**

```ts
    if (nombre !== undefined) updateData.nombre = nombre.trim();
    if (apellidoPaterno !== undefined) updateData.apellidoPaterno = apellidoPaterno.trim();
...
    if (latitud !== undefined) updateData.latitud = latitud;
    if (longitud !== undefined) updateData.longitud = longitud;

    // FEAT-1b: Permitir actualizar logoUrl
    if (body.logoUrl !== undefined) {
      updateData.logoUrl = body.logoUrl;
    }
```

- **Escenario de fallo:** PUT con {nombre: 123} devuelve 500. PUT con {nombre:'', direccionEmpresa:''} deja la empresa sin representante ni direccion. PUT con {logoUrl:'https://otro-host.com/x.png'} rompe el logo de la empresa en la bolsa publica y en el panel de reclutadores.
- **Arreglo propuesto:** Definir `companyProfileUpdateSchema` en zod (strings trim con min/max, email, sitioWeb http(s), latitud -90..90, longitud -180..180, logoUrl https del host de Blob o ruta /uploads/) y usar `validate()`. Devolver 400 con detalle.

#### EMP-029 — Pantalla de error del dashboard siempre ofrece 'Ir al Login'; el aviso de creditos insuficientes no llega a verse

- **Severidad:** ⚪ low · **Categoría:** ux · **Estado:** nuevo · **Verificación:** sin verificar (reportada por 1 auditor)
- **Ubicación:** `src/app/company/dashboard/page.tsx:282`
- **Problema:** Cualquier fallo (403 para un admin que entra a /company/dashboard, 500, red) muestra el mismo bloque con boton 'Ir al Login', aunque la sesion sea valida, y sin opcion de reintentar. En handlePublishJob, ante 402 se llama a setNotification y en la linea siguiente router.push('/credits/purchase'), de modo que el mensaje con los creditos requeridos nunca se ve.
- **Evidencia:**

```ts
          <button
            onClick={() => router.push('/login')}
            className="px-6 py-2 bg-button-orange text-white rounded-lg hover:bg-opacity-90 transition-colors"
          >
            Ir al Login
          </button>
```

- **Escenario de fallo:** La base de datos tarda y /api/company/dashboard responde 500. La empresa, con sesion valida, ve 'Error al cargar' y un boton que la manda a /login. Al publicar un borrador sin creditos es redirigida a la compra sin saber cuantos creditos necesita.
- **Arreglo propuesto:** Mostrar 'Reintentar' (volver a llamar fetchDashboardData) para errores que no sean 401, y 'Ir al Login' solo en 401. Para 402, pasar los datos por query (`/credits/purchase?required=..&available=..`) o mostrar el aviso con un boton 'Comprar creditos' en lugar de redirigir de inmediato.

#### EMP-030 — Perfil de empresa: si Google Maps no carga, el campo de direccion no existe

- **Severidad:** ⚪ low · **Categoría:** ux · **Estado:** nuevo · **Verificación:** sin verificar (reportada por 1 auditor)
- **Ubicación:** `src/app/company/profile/page.tsx:552` · relacionados: `src/components/sections/companies/FormRegisterForQuotationSection.tsx`
- **Problema:** El input de direccion solo se renderiza dentro de la rama `isMapLoaded`. Con la API key ausente o invalida, o el script bloqueado, `loadError` muestra 'Error al cargar el mapa' y debajo queda 'Cargando mapa...' indefinidamente; no hay forma de editar la direccion. El formulario de registro tiene el mismo 'Cargando mapa...' eterno, aunque alli los campos de direccion son independientes.
- **Evidencia:**

```ts
                {mapLoadError && (
                  <p className="text-red-500 text-sm mb-2">Error al cargar el mapa</p>
                )}

                {!isMapLoaded ? (
                  <div className="w-full h-[250px] bg-gray-100 rounded-lg flex items-center justify-center">
                    <p className="text-gray-500">Cargando mapa...</p>
                  </div>
                ) : (
```

- **Escenario de fallo:** En un entorno sin NEXT_PUBLIC_GOOGLE_MAPS_API_KEY, o con un bloqueador que impide maps.googleapis.com, la empresa abre /company/profile: ve 'Error al cargar el mapa' y un recuadro 'Cargando mapa...' permanente, sin campo para cambiar su direccion.
- **Arreglo propuesto:** Renderizar siempre el input de direccion fuera del condicional y envolver solo Autocomplete/GoogleMap en `isMapLoaded && !mapLoadError`. Con `mapLoadError`, sustituir el placeholder por un texto de fallback.

#### EMP-031 — Codigo muerto en el modulo: componentes, endpoints y plantilla de email sin uso (uno pinta notas internas)

- **Severidad:** ⚪ low · **Categoría:** dead-code · **Estado:** nuevo · **Verificación:** sin verificar (reportada por 1 auditor)
- **Ubicación:** `src/components/company/CompanyApplicationsTable.tsx:98` · relacionados: `src/components/company/StatCard.tsx`, `src/components/sections/companies/CompanyTestimonialsSection.tsx`, `src/app/api/company/applications/[id]/route.ts`, `src/app/api/company/interview-requests/route.ts`, `src/lib/email.ts`
- **Problema:** No tienen ningun import ni consumidor: CompanyApplicationsTable (660 lineas; renderiza candidateProfile.notas, recruiterNotes y specialistNotes, es decir reintroduciria la fuga #50/#51 si alguien lo reconecta), src/components/company/StatCard.tsx, CompanyTestimonialsSection (testimonios ficticios retirados de la pagina), GET /api/company/applications/[id], GET /api/company/interview-requests, y sendCompanyApproved en src/lib/email.ts. Tambien las props companyName/companyEmail de InterviewRequestModal, que ningun llamador pasa.
- **Evidencia:**

```ts
                          {/* Notas del admin sobre el candidato */}
                          {application.candidateProfile.notas && (
...
                          {application.recruiterNotes ? (
                            <p className="text-sm text-gray-700 bg-blue-50 p-3 rounded-lg">
                              {application.recruiterNotes}
```

- **Escenario de fallo:** Un desarrollador reutiliza CompanyApplicationsTable para una vista 'todos mis candidatos' alimentandola con la ruta de candidatos (que aun devuelve `notas`): las notas internas vuelven a mostrarse a la empresa con el rotulo 'Notas del perfil'.
- **Arreglo propuesto:** Eliminar los tres componentes, los dos handlers GET sin consumidor y sendCompanyApproved (o reescribirla sin contrasena si se va a usar). Quitar las props no usadas del modal.

#### EMP-032 — Vacantes con expiresAt vencido desaparecen de todas las pestanas de 'Mis Vacantes'

- **Severidad:** ⚪ low · **Categoría:** frontend-bug · **Estado:** nuevo · **Verificación:** sin verificar (reportada por 1 auditor)
- **Ubicación:** `src/components/company/CompanyJobsTable.tsx:81` · relacionados: `src/app/api/company/dashboard/route.ts`
- **Problema:** La pestana 'Expiradas' esta comentada con un TODO, pero la pestana 'Activas' sigue excluyendo los jobs con `isExpired`. Un job activo con expiresAt pasado no aparece en ninguna pestana, aunque cuenta en '{jobs.length} total' y el API lo contabiliza en stats.jobs.expired. Hoy el form de creacion no envia expiresAt, pero POST /api/jobs y /api/jobs/publish lo aceptan en el body.
- **Evidencia:**

```ts
    active: jobs.filter(job => job.status === 'active' && !isExpired(job)),
    paused: jobs.filter(job => job.status === 'paused'),
    expired: jobs.filter(job => isExpired(job)),
...
    // { key: 'expired', label: 'Expiradas', count: categorizedJobs.expired.length, color: 'orange' }, // TODO: Habilitar cuando se implemente expiración automática
```

- **Escenario de fallo:** Una vacante creada por API o integracion con expiresAt a 30 dias vence. En el dashboard el contador dice '5 total' pero sumando las pestanas solo hay 4; la empresa no puede verla, pausarla ni cerrarla.
- **Arreglo propuesto:** Mientras no exista la pestana 'Expiradas', no filtrar por isExpired en 'Activas' y mostrar el badge 'Expirada'; o rehabilitar la pestana. Decidir si expiresAt se soporta: si no, dejar de aceptarlo en las rutas de jobs.

#### EMP-033 — Modales del modulo empresa sin role=dialog, Escape ni foco; celdas de horario sin nombre accesible

- **Severidad:** ⚪ low · **Categoría:** a11y · **Estado:** nuevo · **Verificación:** sin verificar (reportada por 1 auditor)
- **Ubicación:** `src/components/company/InterviewRequestModal.tsx:175` · relacionados: `src/components/company/JobDetailModal.tsx`, `src/components/sections/companies/FormRegisterForQuotationSection.tsx`, `src/app/company/jobs/[jobId]/candidates/page.tsx`
- **Problema:** La fase 4 (#59) agrego Escape + role=dialog/aria-modal solo a ApplyJobModal y CandidateProfileModal. InterviewRequestModal, JobDetailModal y el modal de exito del registro siguen siendo un div sin rol, sin cierre con Escape y sin gestion de foco. La cuadricula de horarios son 65 botones cuyo unico contenido es '·' o '✓', sin aria-label ni aria-pressed. El boton de eliminar participante tampoco tiene nombre accesible. En la lista de candidatos la tarjeta clicable es un div con onClick sin teclado.
- **Evidencia:**

```ts
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
...
                          {selected ? '✓' : '·'}
```

- **Escenario de fallo:** Un usuario de lector de pantalla abre 'Solicitar Entrevista': no se anuncia un dialogo, el foco queda detras, y al tabular por los horarios escucha 65 veces 'boton, punto' sin saber dia ni hora; no puede cerrar con Escape.
- **Arreglo propuesto:** Anadir role="dialog" aria-modal="true" aria-labelledby, listener de Escape y foco inicial/retorno en los tres modales. En cada celda: `aria-label={`${day.dayName} ${day.label} ${time}`}` y `aria-pressed={selected}`. aria-label='Quitar participante' en el boton de papelera.

#### EMP-034 — JobDetailModal del dashboard nunca muestra el logo y no traduce el estado 'paused'

- **Severidad:** ⚪ low · **Categoría:** frontend-bug · **Estado:** nuevo · **Verificación:** sin verificar (reportada por 1 auditor)
- **Ubicación:** `src/components/company/JobDetailModal.tsx:55` · relacionados: `src/app/company/dashboard/page.tsx`
- **Problema:** El modal espera `job.logoUrl`, pero los jobs de /api/company/dashboard no traen ese campo y el dashboard no lo inyecta, asi que siempre se ve el icono generico aunque la empresa tenga logo. Los mapas de badges/labels solo contemplan active/closed/draft: una vacante pausada muestra el texto crudo 'paused' en gris.
- **Evidencia:**

```ts
    const badges: Record<string, string> = {
      active: 'bg-green-100 text-green-800',
      closed: 'bg-gray-100 text-gray-800',
      draft: 'bg-yellow-100 text-yellow-800'
    };

    const labels: Record<string, string> = {
      active: 'Activa',
      closed: 'Cerrada',
      draft: 'Borrador'
    };
```

- **Escenario de fallo:** La empresa pausa una vacante y pulsa 'Ver': el encabezado muestra la etiqueta 'paused' en ingles y un edificio gris en lugar de su logo.
- **Arreglo propuesto:** Agregar `paused: 'En pausa'` con clases amarillas. En dashboard/page.tsx pasar `job={selectedJob ? { ...selectedJob, logoUrl: data.company.companyInfo?.logoUrl } : null}`.

#### EMP-035 — CTA 'Cotiza en tiempo real' lleva al mismo formulario (no hay cotizador) y 'terminos y condiciones' sin enlace ni aviso de privacidad

- **Severidad:** ⚪ low · **Categoría:** copy · **Estado:** nuevo · **Verificación:** sin verificar (reportada por 1 auditor)
- **Ubicación:** `src/components/sections/companies/CompaniesHeroSection.tsx:49` · relacionados: `src/components/sections/companies/FormRegisterForQuotationSection.tsx`, `src/app/companies/page.tsx`
- **Problema:** Los dos botones del hero apuntan a `#register`; en /companies no hay ningun cotizador, el calculo de costo solo existe dentro de /create-job tras registrarse. El formulario, que recoge identificacion oficial y constancia fiscal, cierra con '*Al dar click, aceptas terminos y condiciones.' como texto plano, sin enlace a /terms ni a /privacy (ambas paginas existen).
- **Evidencia:**

```ts
              <Link
                href="#register"
                className="inline-flex items-center justify-center border-2 border-button-green ..."
              >
                Cotiza en tiempo real
              </Link>
```

- **Escenario de fallo:** Un visitante pulsa 'Cotiza en tiempo real' esperando ver precios y aterriza en un formulario que le pide INE, RFC y contrasena, sin poder leer los terminos ni el aviso de privacidad que supuestamente acepta.
- **Arreglo propuesto:** Eliminar o renombrar el segundo CTA hasta que exista un cotizador publico (p. ej. widget que llame a /api/pricing/calculate). En el form enlazar 'terminos y condiciones' a /terms y anadir enlace al aviso de privacidad /privacy, idealmente con checkbox de consentimiento.

#### EMP-036 — No hay code-splitting en todo el repo: Google Maps se carga al entrar a /companies y modales de 1,500 lineas viajan en el bundle inicial

- **Severidad:** ⚪ low · **Categoría:** performance · **Estado:** nuevo · **Verificación:** sin verificar (reportada por 1 auditor)
- **Ubicación:** `src/components/sections/companies/FormRegisterForQuotationSection.tsx:88` · relacionados: `src/app/companies/page.tsx`, `src/components/shared/CandidateProfileModal.tsx`, `src/components/sections/jobs/CreateJobForm.tsx`, `src/app/company/profile/page.tsx`, `src/app/profile/page.tsx`
- **Problema:** No existe ningun uso de next/dynamic ni React.lazy en src. La landing publica /companies importa de forma estatica el formulario de registro (1,067 lineas) que ejecuta useLoadScript de @react-google-maps/api al montar, descargando el SDK de Maps + Places aunque el visitante nunca baje al formulario. Igualmente CandidateProfileModal (1,497 lineas), CreateJobForm (1,782) y CandidateForm (1,529) se incluyen en el chunk inicial de cada dashboard aunque solo se abren bajo demanda.
- **Evidencia:**

```ts
import { useLoadScript, GoogleMap, Marker, Autocomplete } from '@react-google-maps/api';
...
const libraries: ("places")[] = ["places"];
...
const { isLoaded, loadError } = useLoadScript({
  googleMapsApiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || '',
  libraries,
});
// app/companies/page.tsx:4  import FormRegisterForQuotationSection from '...'
```

- **Escenario de fallo:** Un visitante movil en 4G abre /companies desde un anuncio: ademas del JS de la pagina descarga y ejecuta el SDK de Google Maps (cientos de KB y una carga facturable de Maps JS API) antes de ver el hero, empeorando LCP/TBT y generando costo de Maps por cada visita aunque menos del 5% llegue al formulario.
- **Arreglo propuesto:** Cargar el formulario con next/dynamic(() => import(...), { ssr:false, loading: <Skeleton/> }) y montarlo cuando la seccion entre en viewport (IntersectionObserver) o al enfocar el campo de direccion; extraer un componente <AddressMapPicker> compartido por las 4 pantallas que usan Maps. Aplicar next/dynamic a CandidateProfileModal, JobDetailModal, InterviewRequestModal y CreateJobForm en los dashboards.

#### EMP-037 — Validacion de nombres demasiado restrictiva y apellido materno obligatorio

- **Severidad:** ⚪ low · **Categoría:** validation · **Estado:** nuevo · **Verificación:** sin verificar (reportada por 1 auditor)
- **Ubicación:** `src/components/sections/companies/FormRegisterForQuotationSection.tsx:106` · relacionados: `src/lib/validations.ts`
- **Problema:** validateName solo admite letras A-Z, vocales acentuadas, n con tilde y espacios. Rechaza dieresis (Gueemes con u-dieresis, Arguelles), apostrofos (D'Angelo), guiones (Maria-Jose) y puntos (Ma. Fernanda), y el error bloquea el envio porque handleSubmit aborta si `errors` no esta vacio. Ademas `apellidoMaterno` es required en cliente y min(2) en servidor, mientras que el registro de candidatos lo tiene opcional: un representante extranjero con un solo apellido no puede registrarse.
- **Evidencia:**

```ts
  const validateName = (value: string) =>
    /^[A-Za-zÁáÉéÍíÓóÚúÑñ\s]+$/.test(value);
```

- **Escenario de fallo:** 'Begona Arguelles' (con dieresis) escribe su apellido: aparece 'Solo se permiten letras' y 'ENVIAR' responde 'Por favor corrige los errores en el formulario'. 'John Smith' no puede avanzar porque 'Apellido Materno *' es obligatorio.
- **Arreglo propuesto:** Usar `/^[\p{L}\p{M}'’.\- ]+$/u` para nombres. Hacer apellidoMaterno opcional en el form (quitar `required` y el asterisco), en companyRequestSchema (`.optional().or(z.literal(''))`) y aceptar cadena vacia en el create.

#### EMP-038 — El formulario recoge 'departamento' y coordenadas del mapa pero nunca se guardan

- **Severidad:** ⚪ low · **Categoría:** data-integrity · **Estado:** nuevo · **Verificación:** sin verificar (reportada por 1 auditor)
- **Ubicación:** `src/components/sections/companies/FormRegisterForQuotationSection.tsx:422` · relacionados: `src/app/api/company-requests/route.ts`, `src/lib/validations.ts`, `prisma/schema.prisma`
- **Problema:** `departamento` se envia en el body pero CompanyRequest no tiene esa columna y zod la descarta sin aviso (los tests hablan de 'RFC compartido entre departamentos', luego el dato importa). El mapa mantiene `markerPosition`, pero el body no incluye latitud/longitud y la ruta POST tampoco las acepta, aunque el modelo tiene `latitud`/`longitud`. Toda empresa nueva queda con coordenadas null hasta que edita su perfil.
- **Evidencia:**

```ts
          apellidoMaterno: formData.apellidoMaterno,
          departamento: formData.departamento || null,
          nombreEmpresa: formData.nombreEmpresa,
...
          direccionEmpresa: direccionCompleta,
          identificacionUrl: idData.url,
```

- **Escenario de fallo:** Dos areas de la misma empresa (RH y Finanzas) se registran con el mismo RFC indicando su departamento. En /admin/requests ambas solicitudes son indistinguibles porque el departamento se perdio. La ubicacion marcada en el mapa tampoco aparece en /company/profile, que abre centrado en CDMX.
- **Arreglo propuesto:** Agregar `departamento String?` a CompanyRequest (migracion), incluirlo en companyRequestSchema y en el create. Enviar `latitud: markerPosition.lat, longitud: markerPosition.lng` solo cuando el usuario haya movido el marcador o elegido un lugar, validarlas como numeros en rango y persistirlas.

#### EMP-039 — El formulario descarta el detalle de errores de validacion del servidor

- **Severidad:** ⚪ low · **Categoría:** ux · **Estado:** nuevo · **Verificación:** sin verificar (reportada por 1 auditor)
- **Ubicación:** `src/components/sections/companies/FormRegisterForQuotationSection.tsx:470` · relacionados: `src/app/api/company-requests/route.ts`, `src/lib/validations.ts`
- **Problema:** Ante un 400 la API devuelve `{ error: 'Datos inválidos', errors: [{field, message}] }`, pero el cliente solo usa `data.error`. Como las reglas de cliente y servidor difieren (URL con/sin protocolo, razonSocial min 5, direccion min 10, nombres min 2), el usuario recibe un generico 'Datos inválidos' sin saber que corregir.
- **Evidencia:**

```ts
      if (data.success) {
...
      } else {
        throw new Error(data.error || 'Error al enviar solicitud');
      }
```

- **Escenario de fallo:** El usuario escribe razon social 'ACME' (4 caracteres, el cliente no lo valida). El servidor responde 400 con errors:[{field:'razonSocial', message:'Razón social muy corta'}] y en pantalla solo se lee 'Datos inválidos'.
- **Arreglo propuesto:** Si `Array.isArray(data.errors)`, volcar cada item en `setErrors({[field]: message})` para pintarlo bajo el input correspondiente y componer el mensaje del toast con los mensajes concretos. Anadir las mismas longitudes minimas en la validacion de cliente.
