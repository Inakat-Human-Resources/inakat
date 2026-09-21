# Reclutador, especialista y evaluaciones

[← volver al índice](../AUDITORIA-2026-09.md) · 27 hallazgos — 🟠 2 high · 🟡 14 medium · ⚪ 11 low

## 🟠 high (2)

#### EVAL-001 — Rama discardApplicationId de los PUT de reclutador y especialista descarta postulaciones en CUALQUIER estado (salta la maquina de estados)

- **Severidad:** 🟠 high · **Categoría:** authz · **Estado:** nuevo · **Verificación:** sin verificar (reportada por 1 auditor)
- **Ubicación:** `src/app/api/recruiter/dashboard/route.ts:408` · relacionados: `src/app/api/specialist/dashboard/route.ts`
- **Problema:** El flujo por pestanas valida `allowedTransitions`, pero la rama `discardApplicationId` (misma funcion PUT) solo comprueba que el usuario este asignado a la vacante y luego fuerza status='discarded' sin mirar el estado actual. La rama existe identica en specialist/dashboard/route.ts:348-380. Ninguna pagina envia `discardApplicationId` (grep en src: solo aparece en las dos rutas), asi que es codigo muerto alcanzable por API.
- **Evidencia:**

```ts
    if (discardApplicationId) {
      const application = await prisma.application.findUnique({
        where: { id: discardApplicationId },
        include: { job: true }
      });
      // ... solo se valida hasAssignment, nunca application.status
      const discardedApp = await prisma.application.update({
        where: { id: discardApplicationId },
        data: {
          status: 'discarded',
          updatedAt: new Date()
        }
      });
```

- **Escenario de fallo:** Un reclutador (o especialista) asignado a la vacante envia PUT /api/recruiter/dashboard con {"discardApplicationId": <id de una postulacion en 'accepted', 'interviewed' o 'company_interested'>}. Responde 200 y la postulacion pasa a 'discarded': la empresa deja de verla (no esta en COMPANY_VISIBLE_STATUSES) y no puede recuperarla (su PATCH responde 'No puedes modificar esta aplicación en su estado actual'). Despues el mismo reclutador puede 'reactivarla' a pending con la transicion discarded->pending. Un candidato ya contratado desaparece del pipeline de la empresa.
- **Arreglo propuesto:** Eliminar la rama en ambos archivos (la UI ya descarta con updateApplicationId + newApplicationStatus='discarded', que si valida). Si se quiere conservar el motivo de descarte, aceptarlo como campo opcional `reason` en la rama validada y guardarlo como EvaluationNote privada ligada a la Application, no concatenado en JobAssignment.recruiterNotes.

#### EVAL-002 — PUT /api/recruiter/dashboard con candidateIds: crea postulaciones para cualquier candidato del banco (cosecha de PII) y regresa a 'sent_to_specialist' postulaciones en estados avanzados

- **Severidad:** 🟠 high · **Categoría:** authz · **Estado:** nuevo · **Verificación:** sin verificar (reportada por 2 auditores)
- **Ubicación:** `src/app/api/recruiter/dashboard/route.ts:530` · relacionados: `src/app/api/specialist/dashboard/route.ts`, `src/app/api/candidate/applications/route.ts`
- **Problema:** La rama legacy assignmentId/status/notes/candidateIds no la usa ninguna pagina (grep: candidateIds solo en estas rutas y en admin/assign-candidates), pero sigue activa. Acepta IDs arbitrarios del banco de candidatos, crea Applications sin consentimiento y reescribe el status de postulaciones existentes sin pasar por allowedTransitions. Ademas: no exige specialistId si no se manda `status`; `candidateIds: []` ejecuta la linea 515 y BORRA candidatesSentToSpecialist; `candidateIds` no-array lanza TypeError -> 500; `status` y `notes` se guardan sin validar (recruiterStatus admite cualquier string). La rama equivalente del especialista (specialist route 476-498) mueve sent_to_specialist -> sent_to_company directo, transicion que sus propios tests declaran prohibida.
- **Evidencia:**

```ts
        if (!existingApp) {
          // Crear Application para candidato del banco
          await prisma.application.create({
            data: {
              jobId: assignment.jobId,
              candidateEmail: candidateEmail,
              candidateName: `${candidate.nombre} ${candidate.apellidoPaterno || ''}`.trim(),
              status: 'sent_to_specialist'
            }
          });
        } else if (existingApp.status !== 'sent_to_specialist' && existingApp.status !== 'sent_to_company') {
```

- **Escenario de fallo:** (a) Un reclutador envia PUT {"assignmentId": <la suya>, "candidateIds": [1,2,...,500]}: se crean 500 Applications en su vacante; el siguiente GET /api/recruiter/dashboard le devuelve candidateProfile completo (telefono, fecha de nacimiento, ubicacion, CV, documentos, notas del admin) de todo el banco, al que no tiene acceso por ninguna otra ruta (/api/admin/candidates es solo admin por middleware). Los candidatos ven en su panel postulaciones que nunca hicieron (candidate/applications busca por email). (b) Si el candidato ya tenia Application en 'accepted', 'interviewed', 'company_interested', 'evaluating' o 'discarded', se regresa a 'sent_to_specialist'.
- **Arreglo propuesto:** Eliminar la rama legacy completa en ambos PUT (todo lo que sigue a `if (!assignmentId)`), junto con los campos candidatesSentToSpecialist/candidatesSentToCompany si ya no se usan. Si el negocio necesita 'enviar desde el banco', moverlo a un endpoint admin. Validar el body de los PUT con zod (enteros positivos, enum de status) y actualizar los tests.
- **Otros auditores añaden:** Eliminar la rama candidateIds de recruiter/dashboard PUT (y la equivalente de specialist/dashboard) si ya no se usa; si se conserva, restringir a candidatos que ya tengan Application en assignment.jobId (filtrar por email contra applications del job) y validar que sean enteros. Validar tambien 'status' contra una lista cerrada en ambas rutas (hoy recruiterStatus/specialistStatus aceptan cualquier string).

## 🟡 medium (14)

#### EVAL-003 — evaluations/* e interview-requests/* confian solo en los headers del JWT: un reclutador/especialista desactivado o degradado conserva acceso hasta 7 dias

- **Severidad:** 🟡 medium · **Categoría:** security · **Estado:** nuevo · **Verificación:** sin verificar (reportada por 1 auditor)
- **Ubicación:** `src/app/api/evaluations/notes/route.ts:18` · relacionados: `src/app/api/evaluations/skill-ratings/route.ts`, `src/app/api/interview-requests/[id]/route.ts`, `src/middleware.ts`, `src/lib/auth.ts`
- **Problema:** Las rutas de dashboard usan requireRole() (consulta la DB y exige isActive). Estas tres rutas leen x-user-id/x-user-role que el middleware rellena desde el payload del JWT sin tocar la DB (middleware.ts:56, 237-240). JWT_EXPIRES_IN es '7d' por defecto y desactivar un usuario no modifica JobAssignment (no hay referencias a jobAssignment en api/admin/users). Relacionado con el pendiente #20/#26, pero aqui el arreglo no requiere migracion.
- **Evidencia:**

```ts
    const userId = request.headers.get('x-user-id');
    const userRole = request.headers.get('x-user-role');

    // Reclutadores, especialistas, admins y empresas pueden ver notas
    if (!userId || !userRole || !['recruiter', 'specialist', 'admin', 'company'].includes(userRole)) {
      return NextResponse.json(
        { success: false, error: 'No autorizado' },
        { status: 403 }
      );
    }
```

- **Escenario de fallo:** El admin desactiva a un reclutador despedido (isActive=false). /api/recruiter/dashboard ya le responde 403, pero con la misma cookie sigue pudiendo: GET /api/evaluations/notes?applicationId=N (notas privadas de sus vacantes, que siguen asignadas), POST de notas con isPublic=true que la empresa lee al instante, y PATCH /api/interview-requests/<id> para rechazar solicitudes de entrevista, durante los 7 dias de vida del token.
- **Arreglo propuesto:** En evaluations/notes, evaluations/skill-ratings e interview-requests/[id] sustituir la lectura de headers por `const auth = await requireRole([...])` de src/lib/auth.ts y usar auth.user.id / auth.user.role (rol e isActive actuales de la DB). Ajustar skill-ratings-authz.test.ts para mockear requireRole.

#### EVAL-004 — GET /api/evaluations/notes no aplica a la empresa el filtro de status visibles (si lo hace skill-ratings): lee notas publicas y adjuntos de candidatos aun no presentados o descartados

- **Severidad:** 🟡 medium · **Categoría:** authz · **Estado:** nuevo · **Verificación:** sin verificar (reportada por 2 auditores)
- **Ubicación:** `src/app/api/evaluations/notes/route.ts:58` · relacionados: `src/app/api/evaluations/skill-ratings/route.ts`, `src/lib/authz-applications.ts`, `src/app/api/company/jobs/[jobId]/candidates/route.ts`
- **Problema:** Tras canAccessJob (la empresa es duena de la vacante), notes solo anade isPublic=true. El endpoint hermano skill-ratings bloquea ademas a la empresa si application.status no esta en COMPANY_VISIBLE_STATUSES, y company/jobs/[jobId]/candidates solo entrega notas de postulaciones visibles. Aqui falta ese control. La respuesta es el modelo completo, asi que tambien expone authorId (id interno del staff) y documentUrl.
- **Evidencia:**

```ts
    // Empresas solo ven notas públicas
    const whereClause: { applicationId: number; isPublic?: boolean } = { applicationId: appId };
    if (userRole === 'company') {
      whereClause.isPublic = true;
    }

    const notes = await prisma.evaluationNote.findMany({
      where: whereClause,
      orderBy: { createdAt: 'desc' },
    });
```

- **Escenario de fallo:** El especialista escribe durante 'evaluating' una nota marcada 'Visible para empresa' con el psicometrico adjunto, y luego descarta al candidato. La empresa duena de la vacante recorre GET /api/evaluations/notes?applicationId=N (ids autoincrementales; 403 en ajenas, 200 en las suyas) y obtiene contenido y URL publica del adjunto de un candidato que INAKAT nunca le presento. De paso enumera cuantas postulaciones tiene su vacante.
- **Arreglo propuesto:** Mover COMPANY_VISIBLE_STATUSES a src/lib/authz-applications.ts y aplicar en notes GET el mismo bloque que skill-ratings (403 si role==='company' y status no visible). Para empresa usar `select` explicito (id, authorRole, content, documentUrl, documentName, createdAt) sin authorId.
- **Otros auditores añaden:** Anadir la misma comprobacion que en skill-ratings usando un helper compartido canCompanySeeApplication(application.status) en src/lib/authz-applications.ts.

#### EVAL-005 — GET /api/interview-requests/[id] devuelve adminNotes (notas internas del admin) a la empresa solicitante

- **Severidad:** 🟡 medium · **Categoría:** security · **Estado:** nuevo · **Verificación:** sin verificar (reportada por 1 auditor)
- **Ubicación:** `src/app/api/interview-requests/[id]/route.ts:88` · relacionados: `src/app/api/company/interviews/route.ts`, `src/app/api/company/interview-requests/route.ts`, `prisma/schema.prisma`
- **Problema:** El saneado posterior al fix de IDOR solo limpia application.job; el resto del registro se devuelve con `...rest`, que incluye `adminNotes` (schema.prisma:789 'Notas internas del admin') y confirmedById. Entre los autorizados esta la empresa (requestedById === userId). El mismo spread sin select existe en /api/company/interviews (linea 66 `...ir`) y en el GET de /api/company/interview-requests (findMany sin select).
- **Evidencia:**

```ts
    const { application, ...rest } = interviewRequest;
    const safeData = {
      ...rest,
      application: application
        ? {
            ...application,
            job: application.job
              ? {
                  id: application.job.id,
                  title: application.job.title,
                  company: application.job.company,
                }
```

- **Escenario de fallo:** El admin escribe en /admin/interviews una nota interna sobre la solicitud (p. ej. 'empresa con adeudo, no priorizar'). La empresa hace GET /api/interview-requests/<su id> (o abre /company/interviews y mira la respuesta de red) y lee adminNotes.
- **Arreglo propuesto:** Usar `select` explicito u `omit: { adminNotes: true, confirmedById: true }` (Prisma 6) cuando userRole === 'company'; aplicar lo mismo en company/interviews/route.ts y company/interview-requests/route.ts. Anadir test que afirme que adminNotes no aparece para rol company.

#### EVAL-006 — Ruta paralela PATCH /api/interview-requests/[id] sin consumidor: confirma sin scheduledStart y deja la entrevista invisible en todos los paneles

- **Severidad:** 🟡 medium · **Categoría:** dead-code · **Estado:** nuevo · **Verificación:** sin verificar (reportada por 2 auditores)
- **Ubicación:** `src/app/api/interview-requests/[id]/route.ts:201` · relacionados: `src/app/admin/interviews/page.tsx`, `src/app/company/interviews/page.tsx`
- **Problema:** Ningun componente llama a esta ruta (grep de 'api/interview-requests' solo encuentra el middleware y el propio archivo), pero sigue expuesta a admin y recruiter. Confirma guardando solo `confirmedSlot`, sin scheduledStart/End ni cambio de status de la Application. Tanto admin/interviews como company/interviews exigen `scheduledStart` para las pestanas Agendadas/Pasadas, asi que una entrevista confirmada por esta via no aparece en ninguna pestana.
- **Evidencia:**

```ts
    const updated = await prisma.interviewRequest.update({
      where: { id: parseInt(id) },
      data: {
        status,
        confirmedSlot: confirmedSlot ? JSON.stringify(confirmedSlot) : null,
        confirmedAt: status === 'confirmed' ? new Date() : null,
        confirmedById: status === 'confirmed' ? parseInt(userId) : null,
      }
    });

// admin/interviews/page.tsx:121-123
        return interviews.filter(i =>
          i.status === 'confirmed' && i.scheduledStart && new Date(i.scheduledStart) >= now
```

- **Escenario de fallo:** Un reclutador asignado llama PATCH /api/interview-requests/15 con {status:'confirmed', confirmedSlot:{date,time}}. La solicitud sale de Pendientes y no aparece en Agendadas, Pasadas ni Canceladas, ni para el admin ni para la empresa.
- **Arreglo propuesto:** Eliminar el handler PATCH (o delegarlo en la misma logica que /api/admin/interviews/[id], derivando scheduledStart/End de confirmedSlot + duration) y anadir en ambas UIs un caso para 'confirmed' sin fecha.
- **Otros auditores añaden:** Eliminar el PATCH (dejar la confirmacion solo en admin/interviews/[id]) o alinearlo: exigir que confirmedSlot sea uno de JSON.parse(existing.availableSlots), derivar scheduledStart/End de slot+duration, actualizar la Application como hace admin, notificar a la empresa, validar isNaN(id) y anadir tests del handler.

#### EVAL-007 — mode: 'insensitive' sobre Candidate.email anula el indice unico en 8 lookups aunque todos los emails se guardan en minusculas

- **Severidad:** 🟡 medium · **Categoría:** performance · **Estado:** nuevo · **Verificación:** sin verificar (reportada por 1 auditor)
- **Ubicación:** `src/app/api/recruiter/dashboard/route.ts:90` · relacionados: `src/app/api/company/dashboard/route.ts`, `src/app/api/specialist/dashboard/route.ts`, `src/app/api/admin/assign-candidates/route.ts`, `src/app/api/company/jobs/[jobId]/candidates/route.ts`, `src/app/api/company/applications/[id]/route.ts`, `src/app/api/applications/[id]/route.ts`, `src/lib/integration-candidate.ts`, `src/app/api/admin/jobs/[id]/pipeline/route.ts`
- **Problema:** El vinculo Application<->Candidate se resuelve por email en 8 lugares usando mode: 'insensitive' (ILIKE / LOWER), lo que impide usar el btree unico de Candidate.email y fuerza scan secuencial. Es innecesario: todas las escrituras normalizan a minusculas (auth/register, admin/candidates POST y PUT, applications POST, assign-candidates). La inconsistencia lo confirma: admin/jobs/[id]/pipeline hace el mismo join con `in` sensible a mayusculas y funciona.
- **Evidencia:**

```ts
// recruiter/dashboard/route.ts:88
await prisma.candidate.findMany({
  where: { email: { in: uniqueEmails, mode: 'insensitive' } },
// mismos patrones en:
// company/dashboard/route.ts:134, specialist/dashboard/route.ts:128,
// admin/assign-candidates/route.ts:238, company/jobs/[jobId]/candidates/route.ts:104,
// company/applications/[id]/route.ts:323, applications/[id]/route.ts:223,
// lib/integration-candidate.ts:128
// contraste: admin/jobs/[id]/pipeline/route.ts:80 -> where: { email: { in: candidateEmails } }
```

- **Escenario de fallo:** Con 100,000 candidatos en el banco, cada carga de dashboard de reclutador/especialista/empresa ejecuta un scan completo de Candidate (y en las rutas N+1, uno por aplicacion). Bajo carga concurrente de varios reclutadores las lecturas secuenciales compiten por I/O y las respuestas pasan de ms a segundos.
- **Arreglo propuesto:** Quitar mode: 'insensitive' y comparar contra emails ya en minusculas (uniqueEmails ya lo estan). Ejecutar una migracion de datos que haga UPDATE ... SET email = lower(email) en Candidate, User y Application.candidateEmail para registros legados. Centralizar en un helper findCandidatesByEmails(emails) en src/lib para que las 8 rutas compartan la implementacion. A mediano plazo agregar Application.candidateId (FK).

#### EVAL-008 — Dashboard del reclutador: los candidatos desaparecen de 'Enviados' y de las estadisticas cuando la empresa los marca 'company_interested' o 'interviewed'

- **Severidad:** 🟡 medium · **Categoría:** correctness · **Estado:** nuevo · **Verificación:** sin verificar (reportada por 1 auditor)
- **Ubicación:** `src/app/api/recruiter/dashboard/route.ts:208` · relacionados: `src/app/recruiter/dashboard/page.tsx`, `src/app/api/company/applications/[id]/route.ts`
- **Problema:** La cadena if/else que arma `sentApplications` y los contadores cubre sent_to_specialist, evaluating, sent_to_company, hired/accepted y rejected/company_rejected, pero no 'company_interested' ni 'interviewed' (status reales que escribe /api/company/applications/[id] y admin/interviews). En cambio compara contra 'hired' y 'company_rejected', que no existen en el esquema ni los escribe ninguna ruta. 'archived' tampoco cae en ninguna pestana.
- **Evidencia:**

```ts
        } else if (app.status === 'sent_to_company') {
          sentToCompanyCount++;
          // ...
        } else if (app.status === 'hired' || app.status === 'accepted') {
          hiredCount++;
          // ...
        } else if (app.status === 'rejected' || app.status === 'company_rejected') {
          rejectedCount++;
          // ...
        } else if (app.status === 'discarded') {
          discardedCount++;
        }
```

- **Escenario de fallo:** El reclutador envia un candidato; el especialista lo manda a la empresa y aparece en 'Enviados' como 'Enviado a Empresa'. La empresa pulsa 'Me interesa' (status company_interested): el candidato desaparece de la pestana 'Enviados' y de totalSent, justo cuando mas interesa seguirlo. Reaparece solo si termina en accepted o rejected.
- **Arreglo propuesto:** Anadir ramas para 'company_interested' e 'interviewed' (contadores propios e inclusion en sentApplications) y sus etiquetas en getStatusBadge de recruiter/dashboard/page.tsx; eliminar 'hired'/'company_rejected' o mapearlos en una constante compartida de status. Sustituir las 5 copias del push por una funcion `toSentApplication(app, assignment)`.

#### EVAL-009 — recruiterStatus/specialistStatus nunca se actualizan en el flujo por candidato: el panel de asignaciones del admin nunca muestra 'en progreso' ni 'completado'

- **Severidad:** 🟡 medium · **Categoría:** data-integrity · **Estado:** nuevo · **Verificación:** sin verificar (reportada por 1 auditor)
- **Ubicación:** `src/app/api/recruiter/dashboard/route.ts:379` · relacionados: `src/app/api/specialist/dashboard/route.ts`, `src/app/api/admin/assignments/route.ts`, `src/app/admin/assignments/page.tsx`
- **Problema:** El flujo que usa la UI (updateApplicationId) solo toca JobAssignment al enviar al especialista, y ahi resetea `specialistStatus: 'pending'` en cada envio. La ruta del especialista, al pasar a evaluating o sent_to_company, solo escribe followUpDate (lineas 319-325), nunca specialistStatus; el reclutador nunca escribe recruiterStatus='reviewing'. Sin embargo /api/admin/assignments (lineas 84-95 y 134-142) y admin/assignments/page.tsx (216-246) derivan 'in_progress', 'completed' y los badges de esos flags. /api/applications/[id]:454 si preserva specialistStatus; aqui no.
- **Evidencia:**

```ts
      if (newApplicationStatus === 'sent_to_specialist' && hasAssignment) {
        await prisma.jobAssignment.update({
          where: { id: hasAssignment.id },
          data: {
            recruiterStatus: 'sent_to_specialist',
            specialistStatus: 'pending'
          }
        });
```

- **Escenario de fallo:** El especialista evalua y envia candidatos a la empresa desde su UI. En /admin/assignments la vacante sigue con badge 'Con Especialista', la tarjeta 'Completadas' y el filtro status=completed quedan en 0 para siempre, y 'En progreso' tambien (nadie escribe 'reviewing'/'evaluating'). El admin no puede distinguir vacantes ya entregadas de las atascadas.
- **Arreglo propuesto:** Opcion A (preferida): que /api/admin/assignments calcule el progreso con un groupBy de Application.status por jobId y dejar de usar los flags. Opcion B: mantenerlos: en recruiter PUT, pending->reviewing pone recruiterStatus='reviewing'; al enviar no pisar specialistStatus si ya no es 'pending'; en specialist PUT, ->evaluating pone 'evaluating' y ->sent_to_company pone 'sent_to_company'. Envolver las dos escrituras en prisma.$transaction para no dejar la postulacion en sent_to_specialist con la asignacion sin marcar (invisible para el especialista y sin transicion de vuelta para el reclutador).

#### EVAL-010 — El especialista pierde de vista a sus candidatos en cuanto la empresa actua sobre ellos

- **Severidad:** 🟡 medium · **Categoría:** correctness · **Estado:** nuevo · **Verificación:** sin verificar (reportada por 1 auditor)
- **Ubicación:** `src/app/api/specialist/dashboard/route.ts:56` · relacionados: `src/app/specialist/jobs/[jobId]/page.tsx`
- **Problema:** El GET solo trae postulaciones en ['sent_to_specialist','evaluating','sent_to_company','discarded'] y la pestana 'Enviadas' filtra por 'sent_to_company'. Cuando la empresa pasa la postulacion a company_interested / interviewed / accepted / rejected, deja de venir en la respuesta: baja el contador sentToCompany y el especialista no puede conocer el resultado de su evaluacion.
- **Evidencia:**

```ts
              where: {
                status: { in: ['sent_to_specialist', 'evaluating', 'sent_to_company', 'discarded'] }
              },
// specialist/jobs/[jobId]/page.tsx:232-233
      case 'sent':
        return applications.filter(app => app.status === 'sent_to_company');
```

- **Escenario de fallo:** El especialista envia 3 candidatos a la empresa (pestana 'Enviadas': 3). La empresa marca 'Me interesa' en uno y rechaza otro. Al recargar, 'Enviadas' muestra 1 y 'candidatos' del dashboard baja; los otros dos no aparecen en ninguna pestana.
- **Arreglo propuesto:** Incluir en el where 'company_interested','interviewed','accepted','rejected'; en la pagina, que la pestana 'Enviadas' agrupe esos status con un badge de solo lectura del estado actual, y sumarlos en las stats.

#### EVAL-011 — El especialista ve (con PII completa) y puede reactivar candidatos que el reclutador descarto sin enviarselos nunca; el reclutador puede arrebatar los descartados por el especialista

- **Severidad:** 🟡 medium · **Categoría:** authz · **Estado:** nuevo · **Verificación:** sin verificar (reportada por 1 auditor)
- **Ubicación:** `src/app/api/specialist/dashboard/route.ts:57` · relacionados: `src/app/api/recruiter/dashboard/route.ts`, `src/app/specialist/jobs/[jobId]/page.tsx`, `src/app/recruiter/jobs/[jobId]/page.tsx`, `prisma/schema.prisma`
- **Problema:** El comentario de la ruta dice 'Solo mostrar las que ya pasaron por el reclutador', pero el filtro incluye TODAS las postulaciones 'discarded' de la vacante. El status 'discarded' es unico y el esquema no guarda quien descarto ni desde que etapa. Combinado con las transiciones 'discarded' -> ['evaluating','sent_to_specialist'] del especialista, este puede saltarse el filtro del reclutador. Simetricamente, el reclutador ve en 'Descartados' lo que descarto el especialista y puede moverlo a pending/reviewing.
- **Evidencia:**

```ts
            applications: {
              where: {
                status: { in: ['sent_to_specialist', 'evaluating', 'sent_to_company', 'discarded'] }
              },
// ... PUT:
        'discarded': ['evaluating', 'sent_to_specialist'] // Permite reactivar a cualquier estado anterior
```

- **Escenario de fallo:** El reclutador descarta a un candidato en 'Por revisar' (nunca llego al especialista). El especialista de la vacante lo ve en su pestana 'Descartados' con email, telefono, CV, perfil y documentos; pulsa 'En proceso' (discarded -> evaluating, 200) y luego 'Enviar' (evaluating -> sent_to_company): el candidato rechazado por el reclutador llega a la empresa sin revision.
- **Arreglo propuesto:** Anadir a Application campos `discardedByRole` y `discardedFromStatus` (migracion no destructiva), rellenarlos al descartar, y: (1) en el GET del especialista incluir 'discarded' solo si discardedByRole==='specialist'; (2) en el GET/pestana del reclutador mostrar solo los suyos; (3) al reactivar, permitir volver unicamente a discardedFromStatus. Alternativa sin migracion: usar dos status distintos ('discarded' / 'specialist_discarded') y actualizar los conteos de admin.

#### EVAL-012 — La pagina de detalle de vacante de recruiter/specialist descarga el dashboard ENTERO y lo vuelve a descargar tras cada accion

- **Severidad:** 🟡 medium · **Categoría:** performance · **Estado:** nuevo · **Verificación:** sin verificar (reportada por 2 auditores)
- **Ubicación:** `src/app/recruiter/jobs/[jobId]/page.tsx:176` · relacionados: `src/app/specialist/jobs/[jobId]/page.tsx`, `src/app/api/recruiter/dashboard/route.ts`, `src/app/api/specialist/dashboard/route.ts`
- **Problema:** Para mostrar UNA vacante, el cliente llama GET /api/recruiter/dashboard (o specialist), que devuelve todas las asignaciones del usuario con todas sus aplicaciones (sin select: incluye coverLetter, notes) y el perfil completo de cada candidato con todas sus experiencias y documentos, y despues hace assignments.find(a => a.jobId === jobId). Tras cada movimiento de candidato (handleMoveApplication) se llama de nuevo fetchJobData(), repitiendo la descarga completa. El endpoint no tiene paginacion ni filtro por jobId.
- **Evidencia:**

```ts
// recruiter/jobs/[jobId]/page.tsx:176
const response = await fetch('/api/recruiter/dashboard');
...
const foundAssignment = data.data.assignments.find(
  (a: AssignmentData) => a.jobId === parseInt(jobId)
);
...
if (data.success) {
  setSuccess(data.message);
  fetchJobData();
// api/recruiter/dashboard/route.ts:53
applications: { orderBy: { createdAt: 'desc' } }
```

- **Escenario de fallo:** Un reclutador con 30 vacantes asignadas y ~50 aplicaciones por vacante abre una vacante y mueve 20 candidatos de 'pending' a 'reviewing': son 21 descargas de 1,500 aplicaciones + 1,500 perfiles con experiencias y documentos (respuestas de varios MB, cercanas al limite de 4.5 MB). La UI muestra spinner de pantalla completa en cada click (setIsLoading(true)) y pierde el scroll.
- **Arreglo propuesto:** Aceptar ?jobId= en GET /api/recruiter/dashboard y /api/specialist/dashboard (where.jobId) o crear GET /api/recruiter/jobs/[jobId]; en el listado general devolver solo conteos por status (application.groupBy) en vez de filas completas, y usar select explicito en applications. En el cliente aplicar actualizacion optimista del status local en lugar de refetch total.
- **Otros auditores añaden:** Crear GET /api/recruiter/jobs/[jobId] y /api/specialist/jobs/[jobId] (filtrando por recruiterId/specialistId + jobId; 404 si no es suya). Tras mover un candidato, actualizar el estado local con el `data` que ya devuelve el PUT en lugar de refetch; si se refresca, usar un flag isRefreshing que no dispare el early return.

#### EVAL-013 — Cualquier error de una accion sustituye la pagina de detalle por una pantalla de error; la alerta inline descartable es codigo inalcanzable

- **Severidad:** 🟡 medium · **Categoría:** ux · **Estado:** nuevo · **Verificación:** sin verificar (reportada por 1 auditor)
- **Ubicación:** `src/app/recruiter/jobs/[jobId]/page.tsx:333` · relacionados: `src/app/specialist/jobs/[jobId]/page.tsx`
- **Problema:** `handleMoveApplication` guarda los errores de accion en el mismo estado `error` que usa la carga inicial. El early return `if (error || !assignment)` se evalua antes del render principal, por lo que la alerta inline con boton '×' (lineas 420-426) nunca se muestra. Patron identico en specialist/jobs/[jobId]/page.tsx (lineas 281, 343, 445-451).
- **Evidencia:**

```ts
      } else {
        setError(data.error);
      }
// ...
  if (error || !assignment) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
// ... inalcanzable:
        {error && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-red-700">
```

- **Escenario de fallo:** El reclutador pulsa una accion que la API rechaza (p. ej. los botones 'Enviar' rotos, o un 400 'No hay especialista asignado', o un fallo de red). Desaparecen cabecera, pestanas y lista; queda una pantalla con el mensaje y un unico boton 'Volver al dashboard'. Pierde la pestana y el scroll y debe volver a entrar a la vacante.
- **Arreglo propuesto:** Separar estados: `loadError` (fatal, early return) y `actionError` (alerta inline). En handleMoveApplication usar setActionError; el early return debe ser `if (loadError || !assignment)`. Aplicar en ambas paginas.

#### EVAL-014 — Botones 'Enviar' de las pestanas 'Por revisar' y 'Descartados' del reclutador piden transiciones que la API rechaza siempre (400)

- **Severidad:** 🟡 medium · **Categoría:** frontend-bug · **Estado:** nuevo · **Verificación:** sin verificar (reportada por 1 auditor)
- **Ubicación:** `src/app/recruiter/jobs/[jobId]/page.tsx:624` · relacionados: `src/app/api/recruiter/dashboard/route.ts`, `__tests__/api/recruiter-dashboard.test.ts`
- **Problema:** La UI ofrece enviar al especialista directamente desde 'pending'/'injected_by_admin' (linea 624) y desde 'discarded' (linea 722). La API solo permite sent_to_specialist desde 'reviewing'. Los tests del repo documentan que la regla de la API es la intencionada ('NO debería permitir pending → sent_to_specialist (debe pasar por reviewing)', 'NO debería permitir discarded → sent_to_specialist directamente').
- **Evidencia:**

```ts
// page.tsx:608-624 (activeTab === 'pending')
                              onClick={() => handleMoveApplication(app.id, 'sent_to_specialist')}
// api/recruiter/dashboard/route.ts:343-348
      const allowedTransitions: Record<string, string[]> = {
        'pending': ['reviewing', 'discarded'],
        'injected_by_admin': ['reviewing', 'discarded'],
        'reviewing': ['sent_to_specialist', 'discarded', 'pending'], // pending para revertir
        'discarded': ['reviewing', 'pending'] // Permite reactivar a cualquier estado anterior
      };
```

- **Escenario de fallo:** El reclutador, en la pestana 'Por revisar', pulsa el boton verde 'Enviar' de un candidato. PUT con newApplicationStatus='sent_to_specialist' responde 400 'No se puede mover de "pending" a "sent_to_specialist"'. Por el hallazgo de la pantalla de error, ademas toda la pagina se sustituye por una pantalla de error. Lo mismo con 'Enviar' en 'Descartados'.
- **Arreglo propuesto:** Quitar los dos botones 'Enviar' de las pestanas pending y discarded (dejarlo solo en 'En proceso'), o, si negocio quiere el atajo, ampliar allowedTransitions y los tests. Mejor: exportar las tablas de transiciones desde un modulo compartido (p. ej. src/lib/pipeline-transitions.ts) y que la pagina renderice los botones a partir de esa tabla.

#### EVAL-015 — 'Agregar documento' desde el modal de reclutador/especialista siempre falla con 403: el endpoint vive bajo /api/admin/ y el middleware lo restringe a admin

- **Severidad:** 🟡 medium · **Categoría:** correctness · **Estado:** nuevo · **Verificación:** sin verificar (reportada por 1 auditor)
- **Ubicación:** `src/app/recruiter/jobs/[jobId]/page.tsx:757` · relacionados: `src/app/specialist/jobs/[jobId]/page.tsx`, `src/components/shared/CandidateProfileModal.tsx`, `src/middleware.ts`, `src/app/api/admin/candidates/[id]/documents/route.ts`
- **Problema:** Ambas paginas de detalle pasan `canAddDocuments={true}` al CandidateProfileModal. El modal sube el archivo a /api/upload y luego hace POST a `/api/admin/candidates/${candidateId}/documents`. El handler permite requireRole(['admin','recruiter','specialist']), pero el middleware corta antes: todo lo que empieza por /api/admin/ exige role==='admin'. El archivo ya subido queda huerfano y publico en Vercel Blob.
- **Evidencia:**

```ts
// CandidateProfileModal.tsx:653
      const docResponse = await fetch(`/api/admin/candidates/${candidateId}/documents`, {
        method: 'POST',
// middleware.ts:84-88
    pathname.startsWith('/api/admin/') ||
    // ...
  if (isAdminRoute && payload.role !== 'admin') {
// recruiter/jobs/[jobId]/page.tsx:757
        canAddDocuments={true}
```

- **Escenario de fallo:** Un reclutador abre /recruiter/jobs/12, abre el perfil de un candidato, pulsa 'Agregar', elige un PDF y guarda. POST /api/upload responde 200 (blob publico creado) y POST /api/admin/candidates/55/documents responde 403 'No tienes permisos de administrador para acceder a este recurso.'. El documento nunca se asocia y el blob queda huerfano. Igual para el especialista (specialist/jobs/[jobId]/page.tsx:805).
- **Arreglo propuesto:** Crear una ruta fuera de /api/admin (p. ej. /api/candidates/[id]/documents), anadirla al matcher del middleware, con requireRole(['admin','recruiter','specialist']) MAS comprobacion de que el reclutador/especialista esta asignado a una vacante donde ese candidato (por email) tiene Application. Validar fileUrl con el isSafeDocumentUrl de profile/documents. Hacer que el modal elija la URL segun userRole. No basta con abrir una excepcion en el middleware: el handler actual deja a cualquier reclutador/especialista anadir o BORRAR documentos de cualquier candidato.

#### EVAL-016 — Boton 'Enviar' en 'Descartados' del especialista pide discarded -> sent_to_company, que la API rechaza siempre (400)

- **Severidad:** 🟡 medium · **Categoría:** frontend-bug · **Estado:** nuevo · **Verificación:** sin verificar (reportada por 1 auditor)
- **Ubicación:** `src/app/specialist/jobs/[jobId]/page.tsx:769` · relacionados: `src/app/api/specialist/dashboard/route.ts`, `__tests__/api/specialist-dashboard.test.ts`
- **Problema:** En la pestana 'Descartados' el especialista tiene un boton 'Enviar a empresa', pero la API solo permite desde 'discarded' ir a 'evaluating' o 'sent_to_specialist'. El test del repo lo confirma: 'NO debería permitir discarded → sent_to_company directamente'.
- **Evidencia:**

```ts
// page.tsx:768-770 (activeTab === 'discarded')
                            <button
                              onClick={() => handleMoveApplication(app.id, 'sent_to_company')}
// api/specialist/dashboard/route.ts:290-294
      const allowedTransitions: Record<string, string[]> = {
        'sent_to_specialist': ['evaluating', 'discarded'],
        'evaluating': ['sent_to_company', 'discarded', 'sent_to_specialist'], // sent_to_specialist para revertir
        'discarded': ['evaluating', 'sent_to_specialist'] // Permite reactivar a cualquier estado anterior
      };
```

- **Escenario de fallo:** El especialista abre 'Descartados' y pulsa 'Enviar' en un candidato. El PUT responde 400 'No se puede mover de "discarded" a "sent_to_company"' y la pagina entera se sustituye por la pantalla de error con 'Volver al dashboard'.
- **Arreglo propuesto:** Eliminar el boton 'Enviar' de la pestana discarded (lineas 768-780) o derivar los botones de la misma tabla de transiciones compartida con la API.

## ⚪ low (11)

#### EVAL-017 — IDs no numericos producen 500 en lugar de 400 (notes, skill-ratings, interview-requests y PUT de dashboards)

- **Severidad:** ⚪ low · **Categoría:** validation · **Estado:** nuevo · **Verificación:** sin verificar (reportada por 1 auditor)
- **Ubicación:** `src/app/api/evaluations/notes/route.ts:39` · relacionados: `src/app/api/evaluations/skill-ratings/route.ts`, `src/app/api/interview-requests/[id]/route.ts`, `src/app/api/recruiter/dashboard/route.ts`, `src/app/api/specialist/dashboard/route.ts`
- **Problema:** Se usa parseInt sin comprobar NaN y el valor va directo a Prisma, que lanza un error de validacion capturado por el catch generico -> 500 y console.error ruidoso. Ocurre en notes GET (39) y POST (114; ademas `content.trim()` lanza TypeError si content no es string), skill-ratings GET (46) y POST (149), interview-requests GET/PATCH (34, 153) y en los PUT de dashboards con updateApplicationId/assignmentId no numericos. admin/interviews/[id] si valida isNaN -> 400.
- **Evidencia:**

```ts
    const appId = parseInt(applicationId);

    // Autorización por ownership/asignación sobre la Application
    const application = await loadApplicationForAuth(appId);
```

- **Escenario de fallo:** GET /api/evaluations/notes?applicationId=abc o GET /api/interview-requests/abc con sesion valida responde 500 'Error interno' y deja una traza de error de Prisma en los logs, enmascarando errores reales en el monitoreo; deberia ser 400.
- **Arreglo propuesto:** Helper comun `parseId(value): number | null` (Number.isInteger y > 0) y responder 400 'ID inválido' cuando sea null en las rutas citadas; validar `typeof content === 'string'` antes de trim; en los PUT validar el body con zod.

#### EVAL-018 — sanitizeMultilineText corrompe notas de evaluacion que contienen '<' y '>' y permite guardar notas vacias

- **Severidad:** ⚪ low · **Categoría:** data-integrity · **Estado:** nuevo · **Verificación:** sin verificar (reportada por 1 auditor)
- **Ubicación:** `src/app/api/evaluations/notes/route.ts:141` · relacionados: `src/lib/sanitize.ts`
- **Problema:** El contenido se pasa por sanitizeText, cuyo regex /<[^>]*>/g (src/lib/sanitize.ts:13) elimina todo lo que quede entre un '<' y el siguiente '>'. Las notas se renderizan como texto en React (ya escapado), asi que el filtrado no aporta seguridad y destruye contenido legitimo, muy habitual en evaluaciones tecnicas. La comprobacion de vacio se hace ANTES de sanitizar.
- **Evidencia:**

```ts
        content: sanitizeMultilineText(content),
// src/lib/sanitize.ts:12-13
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<[^>]*>/g, '')
```

- **Escenario de fallo:** El especialista escribe 'Domina List<String> y Map<K,V>; pide < 30k y tiene > 5 anos de experiencia'. Se guarda 'Domina List y Map; pide 5 anos de experiencia': desaparecen tipos genericos y todo el tramo entre '<' y '>'. Una nota cuyo unico contenido es '<pendiente>' pasa la validacion y se guarda como cadena vacia.
- **Arreglo propuesto:** Para campos de texto plano no eliminar '<...>': guardar content.trim() con longitud maxima (p. ej. 5000) y confiar en el escape de React, o limitar el regex a etiquetas HTML reales (/<\/?[a-z][^>]*>/gi). Revalidar que el contenido no quede vacio despues de sanitizar.

#### EVAL-019 — documentUrl de las notas se guarda sin validar esquema ni host y se renderiza como href (el fix #55 solo cubrio profile/documents)

- **Severidad:** ⚪ low · **Categoría:** security · **Estado:** arreglo previo incompleto · **Verificación:** sin verificar (reportada por 1 auditor)
- **Ubicación:** `src/app/api/evaluations/notes/route.ts:142` · relacionados: `src/components/shared/CandidateProfileModal.tsx`, `src/app/api/profile/documents/route.ts`
- **Problema:** POST acepta cualquier valor en documentUrl/documentName y el modal lo pinta como enlace en CandidateProfileModal.tsx:1243-1245 (`href={note.documentUrl}`, sin ensureUrl). La auditoria de junio anadio isSafeDocumentUrl solo en /api/profile/documents. React 19 bloquea los href `javascript:` en el render, lo que mitiga el XSS directo, pero el valor queda almacenado para otros consumidores y no se exige http(s) ni que el host sea el del Blob propio.
- **Evidencia:**

```ts
        content: sanitizeMultilineText(content),
        documentUrl: documentUrl || null,
        documentName: documentName || null,
        isPublic: isPublic === true,
```

- **Escenario de fallo:** Una cuenta de reclutador/especialista (o comprometida) hace POST con {documentUrl:'https://evil.example/login', documentName:'Reporte psicometrico.pdf', isPublic:true}. La empresa y el admin ven en la nota un enlace 'Reporte psicometrico.pdf' que abre un sitio externo de phishing. Con documentUrl no-string (objeto) Prisma lanza y responde 500.
- **Arreglo propuesto:** Mover isSafeDocumentUrl a src/lib (p. ej. src/lib/url-safety.ts) y usarlo aqui; exigir ademas que el host sea *.public.blob.vercel-storage.com o ruta /uploads/ en desarrollo; limitar documentName a 255 caracteres. Reutilizar el helper en la ruta de documentos de candidatos.

#### EVAL-020 — No existe forma de editar, despublicar ni borrar una nota de evaluacion: una nota marcada publica por error queda expuesta a la empresa (y a Worky2) para siempre

- **Severidad:** ⚪ low · **Categoría:** correctness · **Estado:** nuevo · **Verificación:** sin verificar (reportada por 1 auditor)
- **Ubicación:** `src/app/api/evaluations/notes/route.ts:144` · relacionados: `src/components/shared/CandidateProfileModal.tsx`, `src/lib/integration-candidate.ts`
- **Problema:** La ruta solo exporta GET y POST; no hay /api/evaluations/notes/[id] ni endpoint de admin que actualice o borre EvaluationNote (grep de evaluationNote en src: solo lecturas y este create). isPublic se fija al crear. Las notas publicas se muestran a la empresa y se exportan en la integracion Worky2 (integration-candidate.ts:58-62).
- **Evidencia:**

```ts
    const note = await prisma.evaluationNote.create({
      data: {
        authorId: parseInt(userId),
        authorRole: userRole,
        applicationId: parseInt(applicationId),
        content: sanitizeMultilineText(content),
        documentUrl: documentUrl || null,
        documentName: documentName || null,
        isPublic: isPublic === true,
      },
    });
```

- **Escenario de fallo:** El reclutador escribe una observacion confidencial (pretension salarial real, motivo de salida) con el check 'Visible para empresa' marcado por error, o la guarda en el candidato equivocado. La empresa la lee de inmediato. Ni el autor ni el admin tienen UI o API para retirarla: solo editando la base de datos.
- **Arreglo propuesto:** Anadir PATCH y DELETE en src/app/api/evaluations/notes/[id]/route.ts (autor o admin; validar asignacion con canAccessJob) para editar contenido, alternar isPublic y borrar; mostrar esos controles en el modal para las notas propias.

#### EVAL-021 — POST /api/evaluations/skill-ratings: rating no entero o string produce 500, skillName arbitrario sin limite y upserts en Promise.all sin transaccion

- **Severidad:** ⚪ low · **Categoría:** validation · **Estado:** nuevo · **Verificación:** sin verificar (reportada por 1 auditor)
- **Ubicación:** `src/app/api/evaluations/skill-ratings/route.ts:140` · relacionados: `src/lib/integration-candidate.ts`
- **Problema:** La validacion acepta 4.5, '5' o true (no fallan la comparacion), pero SkillRating.rating es Int y Prisma lanza -> 500. skillName no se recorta, no tiene longitud maxima ni se contrasta con job.habilidades; `ratings` no tiene tope; `comment` no se valida como string. Los upserts van en Promise.all sin $transaction: dos entradas con el mismo skillName compiten sobre el unique (applicationId, skillName) y pueden dar P2002 con escrituras parciales. Tampoco se limita por status: el especialista puede calificar postulaciones que aun no le enviaron o cambiar notas tras 'accepted'. Estas filas se muestran a la empresa y se exportan a Worky2 (integration-candidate.ts:170).
- **Evidencia:**

```ts
      if (!r.rating || r.rating < 1 || r.rating > 5) {
        return NextResponse.json(
          { success: false, error: `Rating para "${r.skillName}" debe ser entre 1 y 5` },
          { status: 400 }
        );
      }
// ...
    const results = await Promise.all(
      ratings.map(r =>
        prisma.skillRating.upsert({
```

- **Escenario de fallo:** POST {applicationId: 10, ratings:[{skillName:'React', rating: 4.5}]} responde 500 'Error interno' en vez de 400. POST con 5,000 skills inventadas crea 5,000 filas que la empresa ve como 'Habilidades evaluadas' y que viajan a Worky2. POST con la misma skill dos veces puede responder 500 habiendo guardado solo parte.
- **Arreglo propuesto:** Validar con zod: ratings array 1..50, skillName string trim 1..100 que pertenezca a JSON.parse(job.habilidades) (cargar habilidades en loadApplicationForAuth o en una query aparte), rating z.number().int().min(1).max(5), comment string max 500; deduplicar por skillName; ejecutar prisma.$transaction(upserts); para rol specialist exigir application.status en ['sent_to_specialist','evaluating'].

#### EVAL-022 — Campos que la UI espera y la API no devuelve: logoUrl, subcategory, cartaPresentacion y datos de la postulacion en 'Enviados'

- **Severidad:** ⚪ low · **Categoría:** frontend-bug · **Estado:** nuevo · **Verificación:** sin verificar (reportada por 1 auditor)
- **Ubicación:** `src/app/api/recruiter/dashboard/route.ts:45` · relacionados: `src/app/api/specialist/dashboard/route.ts`, `src/app/recruiter/jobs/[jobId]/page.tsx`, `src/app/specialist/jobs/[jobId]/page.tsx`, `src/app/recruiter/dashboard/page.tsx`, `src/components/shared/CandidateProfileModal.tsx`
- **Problema:** (1) Las paginas de detalle leen `job.user?.companyRequest?.logoUrl` (recruiter page:369, specialist page:380) pero ambos GET solo seleccionan nombreEmpresa y correoEmpresa: CompanyLogo siempre muestra el icono generico. (2) El select de candidatos de ambas rutas omite `subcategory` y `cartaPresentacion`, que el modal pinta (CandidateProfileModal.tsx:421 y 435): nunca aparecen para reclutador/especialista. (3) `sentApplications` no incluye cvUrl, candidatePhone, coverLetter ni createdAt, asi que el modal abierto desde 'Enviados' no muestra el CV subido con la postulacion, el telefono, la carta ni la fecha.
- **Evidencia:**

```ts
                companyRequest: {
                  select: {
                    nombreEmpresa: true,
                    correoEmpresa: true
                  }
                }
// recruiter/jobs/[jobId]/page.tsx:368-369
              <CompanyLogo
                logoUrl={job.user?.companyRequest?.logoUrl}
```

- **Escenario de fallo:** El reclutador abre cualquier vacante de una empresa con logo cargado: ve siempre el icono gris. Abre un candidato desde 'Enviados' que aplico subiendo su CV pero sin CV en su perfil del banco: el boton 'Ver CV' no aparece.
- **Arreglo propuesto:** Anadir `logoUrl: true` al select de companyRequest en ambos GET; anadir `subcategory: true, cartaPresentacion: true` al select de candidatos; incluir cvUrl, candidatePhone, coverLetter y createdAt en sentApplications y en openCandidateProfile de recruiter/dashboard/page.tsx.

#### EVAL-023 — GET de dashboards sin select/paginacion, con perfiles duplicados en la respuesta y una query (candidatesById) cuyo resultado no usa ninguna pagina

- **Severidad:** ⚪ low · **Categoría:** performance · **Estado:** nuevo · **Verificación:** sin verificar (reportada por 1 auditor)
- **Ubicación:** `src/app/api/recruiter/dashboard/route.ts:53` · relacionados: `src/app/api/specialist/dashboard/route.ts`, `src/app/recruiter/dashboard/page.tsx`, `src/app/specialist/dashboard/page.tsx`
- **Problema:** Reclutador: `applications` se incluye sin select ni take (trae coverLetter y notes de todas las postulaciones de todas las vacantes) y `sentApplications` vuelve a incluir `candidateProfile` completo por cada postulacion enviada, duplicandolo en el JSON. Las paginas de listado solo usan conteos. Especialista: `candidatesById` hace include de experiences y documents con TODAS las columnas de Candidate y se devuelve como `candidates`, que ninguna pagina lee; `...assignment` deja ademas `job.applications` sin enriquecer junto a `applications`.
- **Evidencia:**

```ts
            applications: {
              orderBy: { createdAt: 'desc' }
            }
// ...
          sentApplications.push({
            id: app.id,
            // ...
            candidateProfile: app.candidateProfile,
```

- **Escenario de fallo:** Con el crecimiento normal (cientos de postulaciones por reclutador) cada carga de /recruiter/dashboard serializa varios MB solo para mostrar tarjetas con contadores; en Vercel se paga en latencia, memoria y riesgo de timeout, multiplicado por el refetch tras cada accion.
- **Arreglo propuesto:** En el listado devolver solo contadores por vacante (prisma.application.groupBy por jobId+status). Mover el detalle a los endpoints por vacante. Usar `select` explicito en applications, eliminar candidatesById/`candidates` y el job.applications duplicado, y en sentApplications enviar solo los campos que usa la tarjeta, paginando 'Enviados'.

#### EVAL-024 — La rama 'admin' de los PUT/GET de dashboards esta rota: la asignacion se busca por recruiterId/specialistId = id del admin

- **Severidad:** ⚪ low · **Categoría:** correctness · **Estado:** nuevo · **Verificación:** sin verificar (reportada por 1 auditor)
- **Ubicación:** `src/app/api/recruiter/dashboard/route.ts:331` · relacionados: `src/app/api/specialist/dashboard/route.ts`
- **Problema:** requireRole(['recruiter','admin']) y el middleware dejan pasar al admin, y el codigo lo exime del 403 (`user.role !== 'admin'`), pero hasAssignment se busca con recruiterId: user.id, que para un admin es null. Consecuencias: enviar al especialista responde siempre 400 'No hay especialista asignado'; en el especialista, el admin puede mover a sent_to_company pero se omiten followUpDate y la notificacion a la empresa (ambos dentro de `&& hasAssignment`); y los GET filtran por user.id, asi que /recruiter/dashboard y /specialist/dashboard siempre salen vacios para admin.
- **Evidencia:**

```ts
      const hasAssignment = await prisma.jobAssignment.findFirst({
        where: { jobId: application.jobId, recruiterId: user.id }
      });

      if (!hasAssignment && user.role !== 'admin') {
// ...
      if (newApplicationStatus === 'sent_to_specialist' && !hasAssignment?.specialistId) {
```

- **Escenario de fallo:** Un admin que cubre a un reclutador ausente llama PUT {updateApplicationId, newApplicationStatus:'sent_to_specialist'} sobre una vacante que SI tiene especialista: recibe 400 'No hay especialista asignado a esta vacante'.
- **Arreglo propuesto:** Para admin buscar la asignacion solo por jobId (`where: user.role === 'admin' ? { jobId } : { jobId, recruiterId: user.id }`), igual en la ruta del especialista; o retirar 'admin' de requireRole en estas rutas si debe operar solo desde /api/applications/[id].

#### EVAL-025 — Notificaciones al especialista y a la empresa en fire-and-forget sin await: en serverless pueden perderse y los errores se tragan sin log

- **Severidad:** ⚪ low · **Categoría:** reliability · **Estado:** nuevo · **Verificación:** sin verificar (reportada por 1 auditor)
- **Ubicación:** `src/app/api/recruiter/dashboard/route.ts:389` · relacionados: `src/app/api/specialist/dashboard/route.ts`, `src/lib/notifications.ts`
- **Problema:** createNotification(...) se lanza sin await y con `.catch(() => {})` justo antes de devolver la respuesta. En Vercel la funcion puede congelarse al responder, antes de que termine el INSERT, y cualquier error queda oculto. La auditoria de junio corrigio este mismo patron solo en el webhook de MercadoPago (#70). Se repite en specialist/dashboard/route.ts:329-336 y 525-532.
- **Evidencia:**

```ts
        if (hasAssignment.specialistId) {
          createNotification({
            userId: hasAssignment.specialistId,
            type: 'sent_to_specialist',
            title: 'Candidato enviado para evaluación',
            // ...
          }).catch(() => {});
        }
```

- **Escenario de fallo:** El reclutador envia un candidato al especialista; la respuesta 200 sale y la lambda se suspende antes de completar el insert: el especialista no recibe aviso y el candidato espera en su bandeja. Si la tabla o la conexion fallan, nadie lo sabe porque el catch esta vacio.
- **Arreglo propuesto:** Usar `await createNotification(...)` dentro de try/catch con console.error, o `after(() => createNotification(...))` de next/server (estable en Next 15.1+) para garantizar la ejecucion tras la respuesta.

#### EVAL-026 — Seguimiento de 45 dias a medio implementar: followUpDate se escribe pero nada lo lee; followUpCompleted y followUpNotes no se usan; el filtro ?status= de los GET es codigo muerto

- **Severidad:** ⚪ low · **Categoría:** dead-code · **Estado:** nuevo · **Verificación:** sin verificar (reportada por 1 auditor)
- **Ubicación:** `src/app/api/specialist/dashboard/route.ts:320` · relacionados: `prisma/schema.prisma`, `src/app/api/recruiter/dashboard/route.ts`
- **Problema:** Cada envio a empresa recalcula JobAssignment.followUpDate = hoy + 45 dias (se pisa con cada candidato posterior, lineas 320-325, 438-440 y 511-515), pero grep en src muestra que followUpDate solo aparece en esta ruta y followUpCompleted/followUpNotes en ningun sitio: no hay recordatorio, vista ni cron. Tampoco ninguna pagina usa el parametro `?status=` de ambos GET (recruiter route 26-35, specialist 26-37).
- **Evidencia:**

```ts
      if (newApplicationStatus === 'sent_to_company' && hasAssignment) {
        const followUpDate = new Date();
        followUpDate.setDate(followUpDate.getDate() + 45);
        await prisma.jobAssignment.update({
          where: { id: hasAssignment.id },
          data: { followUpDate }
        });
```

- **Escenario de fallo:** El negocio cree que existe un seguimiento a 45 dias tras entregar candidatos (hay columnas y logica que lo sugieren), pero nadie recibe aviso ni ve esa fecha. Ademas, al ser por vacante y no por candidato, enviar un segundo candidato un mes despues borra la fecha del primero.
- **Arreglo propuesto:** Decidir: (a) implementarlo de verdad (fecha por Application, vista 'Seguimientos' para especialista/admin y notificacion programada) o (b) eliminar la escritura de followUpDate y las columnas followUp* en una migracion revisada; retirar el filtro ?status= o usarlo desde la UI.

#### EVAL-027 — Tarjetas de vacante y filas de 'Enviados' son <div onClick> sin rol ni foco; las pestanas pierden su etiqueta en movil

- **Severidad:** ⚪ low · **Categoría:** a11y · **Estado:** nuevo · **Verificación:** sin verificar (reportada por 1 auditor)
- **Ubicación:** `src/app/recruiter/dashboard/page.tsx:321` · relacionados: `src/app/specialist/dashboard/page.tsx`, `src/app/recruiter/jobs/[jobId]/page.tsx`, `src/app/specialist/jobs/[jobId]/page.tsx`
- **Problema:** La unica via para entrar a una vacante es un <div> con onClick sin role, tabIndex ni onKeyDown (recruiter/dashboard/page.tsx:321-325 y 454-458; specialist/dashboard/page.tsx:216-220). La Fase 4 de junio (#63) hizo operables por teclado las tarjetas publicas, no estas. En las paginas de detalle, las etiquetas de las pestanas y de los botones de accion llevan `hidden sm:inline`: en movil quedan icono + numero sin nombre accesible ni role=tab/aria-selected, y varios botones solo tienen `title`, que no se muestra en tactil.
- **Evidencia:**

```ts
                  <div
                    key={job.id}
                    onClick={() => router.push(`/recruiter/jobs/${job.jobId}`)}
                    className="bg-white rounded-lg shadow-sm border p-4 hover:shadow-md hover:border-green-300 transition-all cursor-pointer group"
                  >
```

- **Escenario de fallo:** Un reclutador que navega con teclado o lector de pantalla no puede enfocar ni activar ninguna vacante: Tab salta de las pestanas al final de la pagina y nunca llega a /recruiter/jobs/[id]. En movil, un lector de pantalla anuncia las pestanas solo como 'boton 3', 'boton 0'.
- **Arreglo propuesto:** Convertir las tarjetas en <Link href=...> (o <button>) con los mismos estilos; para las filas de 'Enviados' usar <button> o role='button' tabIndex={0} y onKeyDown Enter/Espacio. En las pestanas anadir role='tablist'/'tab', aria-selected y aria-label={tab.label}; anadir aria-label a los botones de accion solo-icono.
