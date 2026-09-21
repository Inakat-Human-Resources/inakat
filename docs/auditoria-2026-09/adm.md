# Panel y API de administración

[← volver al índice](../AUDITORIA-2026-09.md) · 100 hallazgos — 🟠 9 high · 🟡 43 medium · ⚪ 48 low

## 🟠 high (9)

#### ADM-001 — Seis pantallas consumen APIs paginadas sin UI de paginacion: los registros 21+/31+ son inalcanzables

- **Severidad:** 🟠 high · **Categoría:** frontend-bug · **Estado:** nuevo · **Verificación:** sin verificar (reportada por 3 auditores)
- **Ubicación:** `src/app/admin/assign-candidates/page.tsx:268` · relacionados: `src/app/admin/candidates/page.tsx`, `src/app/admin/users/page.tsx`, `src/app/admin/interviews/page.tsx`, `src/app/admin/vendors/page.tsx`, `src/app/vendor/dashboard/page.tsx`, `src/app/api/admin/candidates/route.ts`, `src/app/api/admin/users/route.ts`, `src/app/api/admin/interviews/route.ts`, `src/app/api/admin/vendors/route.ts`, `src/app/api/vendor/my-sales/route.ts`
- **Problema:** El backend pagina (jobs 20, admin/candidates 30, admin/users 30, admin/interviews 20, admin/vendors 20, admin/vendors/commissions 20, vendor/my-sales 20) pero la UNICA pagina del repo que lee data.pagination o envia page/limit es /notifications. En el resto el cliente hace setX(data.data) y asume lista completa. En assign-candidates ademas se filtra por status en JS DESPUES de paginar (quedan menos de 30) y el deep link ?jobId= falla en silencio si la vacante no esta en las primeras 20.
- **Evidencia:**

```ts
// admin/assign-candidates/page.tsx:268
const response = await fetch('/api/jobs?status=active');
...
setJobs(data.data);
// :296
const response = await fetch(`/api/admin/candidates?${params}`);
// admin/candidates/page.tsx:158 -> setCandidates(data.data)
// admin/users/page.tsx:108 -> setUsers(data.data)
// admin/interviews/page.tsx:100 -> fetch('/api/admin/interviews')
// admin/vendors/page.tsx:153,178 ; vendor/dashboard/page.tsx:116
```

- **Escenario de fallo:** Con 25 vacantes activas, el admin entra a /admin/assign-candidates: el selector solo lista 20; las 5 mas antiguas no pueden recibir candidatos inyectados, y el boton de /admin que navega a /admin/assign-candidates?jobId=<id antiguo> abre la pagina sin vacante seleccionada. En /admin/candidates (banco de talento) con 500 candidatos solo se ven los 30 mas nuevos; en /admin/interviews la solicitud pendiente numero 21 nunca se agenda; un vendor con 45 ventas solo ve 20.
- **Arreglo propuesto:** Crear un componente <Pagination> compartido y un hook usePaginatedFetch; en cada pantalla enviar page/limit, leer pagination.total/totalPages y renderizar controles. En assign-candidates usar un selector de vacantes con busqueda server-side (o limit alto acotado + busqueda) y enviar el filtro de status del candidato (status in available,in_process) al servidor en lugar de filtrar en JS. Para ?jobId= cargar la vacante por GET /api/jobs/{id} si no esta en la pagina actual.
- **Otros auditores añaden:** Consumir un endpoint admin sin paginar (reutilizar GET /api/admin/assignments, que ya devuelve todas las activas con empresa real, o crear /api/admin/jobs), anadir buscador de vacantes y, si `jobId` no se encuentra, cargarla por id y mostrar aviso explicito. — Usar un endpoint admin para la lista de vacantes (ver hallazgo de paginacion) o hacer que /api/jobs trate `authUser.role === 'admin'` como vista completa aunque no venga userId.

#### ADM-002 — El panel de entrevistas solo carga las 20 solicitudes mas recientes; las pendientes antiguas desaparecen y los contadores son falsos

- **Severidad:** 🟠 high · **Categoría:** correctness · **Estado:** nuevo · **Verificación:** sin verificar (reportada por 1 auditor)
- **Ubicación:** `src/app/admin/interviews/page.tsx:100` · relacionados: `src/app/api/admin/interviews/route.ts`
- **Problema:** GET /api/admin/interviews pagina con limit por defecto 20 (maximo 100) ordenado por createdAt desc. La pagina llama sin `page`/`limit`/`status`, ignora `data.pagination` y reparte en pestanas en el cliente. No hay paginador ni "cargar mas".
- **Evidencia:**

```ts
// page.tsx:100
      const res = await fetch('/api/admin/interviews');

// src/app/api/admin/interviews/route.ts:14-16
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const limit = Math.max(1, Math.min(100, parseInt(searchParams.get('limit') || '20', 10)));
    const skip = (page - 1) * limit;

// page.tsx:138
    pending: interviews.filter(i => i.status === 'pending').length,
```

- **Escenario de fallo:** Existen 25 InterviewRequest; las 5 mas antiguas siguen 'pending'. El admin abre /admin/interviews: solo llegan las 20 mas nuevas, la pestana Pendientes no muestra esas 5 y su contador tampoco las cuenta. Esas empresas nunca reciben respuesta y no hay forma de llegar a ellas desde la UI.
- **Arreglo propuesto:** Filtrar en servidor por pestana (`status` + `scheduledStart gte/lt now`), devolver los 4 contadores con `count`/`groupBy` en la misma respuesta y anadir paginacion real en la UI usando `data.pagination`. Como minimo inmediato: pedir `?status=pending&limit=100` para la pestana Pendientes.

#### ADM-003 — Dashboard admin: estadisticas falsas y topadas (20/30) por usar .length sobre respuestas paginadas, y descarga TODAS las aplicaciones solo para contarlas

- **Severidad:** 🟠 high · **Categoría:** correctness · **Estado:** nuevo · **Verificación:** sin verificar (reportada por 2 auditores)
- **Ubicación:** `src/app/admin/page.tsx:145` · relacionados: `src/app/api/jobs/route.ts`, `src/app/api/admin/candidates/route.ts`, `src/app/api/applications/route.ts`, `src/app/api/company-requests/route.ts`
- **Problema:** fetch('/api/jobs') sin parametros aplica status='active' y limit 20 por defecto, asi que 'Vacantes Totales' nunca pasa de 20, y draftJobs/pausedJobs/closedJobs siempre valen 0 (el filtro de Estado 'Pausadas/Borradores/Cerradas' siempre sale vacio). fetch('/api/admin/candidates') devuelve 30 y se usa data.length como total de candidatos. fetch('/api/applications') no tiene paginacion y trae todas las filas con include de job y user solo para hacer .length. fetch('/api/company-requests') trae todas las solicitudes para contar las pending en JS. Ademas la tabla hace sortedJobs.slice(0, 20) sin forma de ver el resto.
- **Evidencia:**

```ts
const results = await Promise.allSettled([
  fetch('/api/jobs').then(r => r.json()),
  fetch('/api/company-requests').then(r => r.json()),
  fetch('/api/admin/candidates').then(r => r.json()),
  fetch('/api/applications').then(r => r.json())
]);
...
totalJobs: allJobs.length,
draftJobs: allJobs.filter((j: Job) => j.status === 'draft').length,
...
setStats(prev => ({ ...prev, totalCandidates: candidatesData.data?.length || 0 }));
setStats(prev => ({ ...prev, totalApplications: applicationsData.data?.length || 0 }));
```

- **Escenario de fallo:** La plataforma tiene 120 vacantes (40 borradores), 900 candidatos y 15,000 aplicaciones. El admin abre /admin: ve 'Vacantes Totales 20 — 20 activas, 0 borradores', 'Candidatos 30'. La llamada a /api/applications serializa 15k filas con joins (varios MB); al superar el limite de respuesta de 4.5 MB de Vercel la funcion falla y 'Aplicaciones' muestra 0. Cada click en 'Actualizar' repite la descarga completa.
- **Arreglo propuesto:** Crear GET /api/admin/stats que use prisma.job.groupBy({by:['status'],_count}), prisma.candidate.count(), prisma.application.count(), prisma.companyRequest.count({where:{status:'pending'}}) y devuelva solo numeros. Para la tabla de vacantes llamar /api/jobs?includeDrafts=true&page=N&limit=20 con paginacion real (usar pagination.total) y mover filtros empresa/especialidad/estado al servidor.
- **Otros auditores añaden:** En el fetch del dashboard pedir todas las vacantes independientemente del status, p.ej. `fetch('/api/jobs?includeDrafts=true&limit=100')` (verificar que includeDrafts devuelve todos los estados) o crear un endpoint admin que no filtre por status. Ajustar también el conteo para usar `pagination.total`.

#### ADM-004 — La API de candidatos pagina a 30 y ninguna pantalla consumidora pagina: el Banco de Candidatos, el dashboard y Asignar Candidatos solo ven los 30 mas recientes

- **Severidad:** 🟠 high · **Categoría:** correctness · **Estado:** nuevo · **Verificación:** sin verificar (reportada por 1 auditor)
- **Ubicación:** `src/app/api/admin/candidates/route.ts:113` · relacionados: `src/app/admin/candidates/page.tsx`, `src/app/admin/page.tsx`, `src/app/admin/assign-candidates/page.tsx`, `src/app/admin/users/page.tsx`, `src/app/api/admin/users/route.ts`
- **Problema:** GET /api/admin/candidates aplica getPaginationParams(searchParams, 30) y devuelve ademas un campo count = longitud de la pagina ('backward compatibility'). Ninguno de los tres consumidores envia page/limit ni lee pagination.total: /admin/candidates pinta data.data y calcula las estadisticas (Total/Disponibles/En proceso/Contratados) sobre esa pagina; /admin (dashboard) usa candidatesData.data?.length como 'total de candidatos'; /admin/assign-candidates solo ofrece para asignar los 30 mas recientes (y encima filtra por status en cliente, quedando menos de 30). En src/app/admin no existe ninguna referencia a pagination/hasNext/page= (grep sin resultados). El mismo patron afecta a /api/admin/users (limite 30, pagina de usuarios sin paginador).
- **Evidencia:**

```ts
const pagination = getPaginationParams(searchParams, 30);
...
const response = buildPaginatedResponse(candidatesWithAge, total, pagination);
return NextResponse.json({
  success: true,
  ...response,
  count: candidatesWithAge.length  // backward compatibility
});
// src/app/admin/page.tsx:192
setStats(prev => ({ ...prev, totalCandidates: candidatesData.data?.length || 0 }));
```

- **Escenario de fallo:** Con 31+ candidatos en BD, el admin abre /admin/candidates: ve 'Total 30' y 'Mostrando 30 candidatos', sin forma de llegar al candidato 31 salvo adivinando una busqueda. En /admin/assign-candidates no puede seleccionar candidatos antiguos para una vacante. El dashboard muestra 30 candidatos totales para siempre.
- **Arreglo propuesto:** En las tres pantallas leer data.pagination (total, totalPages, hasNext) y anadir paginador/scroll infinito enviando page y limit; en el dashboard usar pagination.total (o un endpoint de conteo). En assign-candidates mover el filtro de status al where del API (status in ['available','in_process']) para que la pagina no se vacie. Eliminar el campo count enganoso o documentarlo. Aplicar lo mismo a /admin/users.

#### ADM-005 — CandidateForm no persiste cartaPresentacion (ni al crear ni al editar)

- **Severidad:** 🟠 high · **Categoría:** data-integrity · **Estado:** nuevo · **Verificación:** sin verificar (reportada por 1 auditor)
- **Ubicación:** `src/app/api/admin/candidates/route.ts:182`
- **Problema:** El formulario envía `cartaPresentacion` en el body tanto en POST como en PUT (CandidateForm.tsx línea 474), pero ninguna de las dos rutas API la desestructura ni la guarda. En POST (route.ts líneas 182-205) no aparece `cartaPresentacion` en el destructuring ni en `prisma.candidate.create`. En PUT ([id]/route.ts líneas 149-171) tampoco. El campo existe en el schema (Candidate.cartaPresentacion) y se muestra a las empresas en el pipeline, pero el dato del admin se descarta silenciosamente.
- **Evidencia:**

```ts
const {
  nombre, apellidoPaterno, apellidoMaterno, email, telefono, sexo,
  fechaNacimiento, universidad, carrera, nivelEstudios, educacion,
  profile, seniority, cvUrl, portafolioUrl, linkedinUrl, source,
  notas, experiences, documents, password, fotoUrl
} = body; // <- falta cartaPresentacion
```

- **Escenario de fallo:** Admin crea/edita un candidato, escribe su carta de presentación (visible para empresas según el propio label del form), guarda con éxito. Al reabrir el candidato la carta está vacía; el pipeline y la ficha de empresa nunca muestran esa carta porque nunca se guardó.
- **Arreglo propuesto:** Añadir `cartaPresentacion` al destructuring y a `data` en el create de POST, y en PUT agregar `if (cartaPresentacion !== undefined) updateData.cartaPresentacion = cartaPresentacion || null;`.

#### ADM-006 — La pagina de compra nunca recibe los paquetes del admin (403 del middleware): muestra precios hardcodeados distintos a los que el servidor cobra

- **Severidad:** 🟠 high · **Categoría:** payments · **Estado:** pendiente conocido de junio · **Verificación:** ✅ verificada contra el código
- **Ubicación:** `src/app/api/admin/credit-packages/route.ts:17` · relacionados: `src/middleware.ts`, `src/app/credits/purchase/page.tsx`, `src/app/api/credits/purchases/route.ts`, `__tests__/api/credit-packages.test.ts`
- **Problema:** El GET con ?activeOnly=true pretende ser publico para la pagina de compra, pero vive bajo /api/admin/, que el middleware restringe a role=admin. Una empresa recibe 403 {success:false}, y src/app/credits/purchase/page.tsx cae SIEMPRE a DEFAULT_PACKAGES (precios fijos 4000/35000/50000/65000). En cambio POST /api/credits/purchases cobra pkg.price leido de la BD. Todo lo que el admin configura en /admin/credit-packages (precio, nombre, badge, orden, paquetes nuevos, desactivaciones) jamas llega a la UI de compra, pero el precio SI se aplica al cargo. El pendiente #28 lo catalogo como 'branch muerto menor'; el detalle nuevo es que produce discrepancia entre precio mostrado y precio cobrado.
- **Comprobación:** Confirmado: mismo defecto visto desde la API (sólo alcanzable por admin).
- **Evidencia:**

```ts
// src/app/api/admin/credit-packages/route.ts
    // Si es activeOnly, no requiere auth (para página pública de compra)
    if (!activeOnly) {
      const auth = await requireRole('admin');

// src/middleware.ts
    pathname.startsWith('/api/admin/') ||
  ...
  if (isAdminRoute && payload.role !== 'admin') {

// src/app/credits/purchase/page.tsx
      const response = await fetch('/api/admin/credit-packages?activeOnly=true');
      ...
        setPackages(DEFAULT_PACKAGES);
```

- **Escenario de fallo:** 1) El admin edita 'Pack 10' de $35,000 a $38,000 en /admin/credit-packages. 2) Una empresa abre /credits/purchase: el fetch devuelve 403, la pagina usa DEFAULT_PACKAGES y muestra $35,000 (el Brick de MercadoPago tambien se inicializa con amount 35000). 3) Al pagar, /api/credits/purchases hace findFirst({credits:10,isActive:true}) y manda transaction_amount=38000. La empresa ve $35,000 y se le cargan $38,000. A la inversa, una promocion configurada por el admin nunca se muestra.
- **Arreglo propuesto:** Crear un endpoint fuera de /api/admin/ (p. ej. GET /api/credits/packages, ya cubierto por el matcher '/api/credits/:path*' => requiere sesion) que devuelva solo paquetes activos con select de campos publicos; hacer que la pagina de compra lo consuma y eliminar DEFAULT_PACKAGES (si la API falla, bloquear la compra con mensaje de error en vez de inventar precios). Eliminar la rama activeOnly del route admin. Ademas, que la pagina envie packageId + expectedPrice y que /api/credits/purchases responda 409 si expectedPrice != pkg.price.
- **Otros auditores añaden:** Crear una ruta no-admin, p. ej. src/app/api/credit-packages/route.ts (GET, solo isActive, select de campos publicos, con requireAuth si se desea), apuntar la pagina de compra a ella y eliminar la rama activeOnly de la ruta admin. Quitar el fallback DEFAULT_PACKAGES (mostrar error en vez de precios inventados) y devolver desde el servidor el importe a cobrar para inicializar el Brick. Reemplazar el test tautologico por uno que ejecute el middleware con rol company.

#### ADM-007 — "Cancelar solicitud" sobre una pendiente sin fechas siempre da 400: `null` se parsea como 1970-01-01

- **Severidad:** 🟠 high · **Categoría:** correctness · **Estado:** arreglo previo incompleto · **Verificación:** ✅ verificada contra el código
- **Ubicación:** `src/app/api/admin/interviews/[id]/route.ts:126` · relacionados: `src/app/admin/interviews/page.tsx`
- **Problema:** La validacion de fechas anadida por el hallazgo #33 solo distingue `undefined`. La UI envia SIEMPRE `scheduledStart` y `scheduledEnd`, con valor `null` cuando el campo esta vacio. `new Date(null)` es una fecha valida (epoch 1970), asi que ambas quedan en epoch y la comprobacion `parsedStart >= parsedEnd` devuelve 400. Ademas, si solo una viene en null se persistiria 1970-01-01 en BD.
- **Comprobación:** Confirmado el defecto de parseo: `new Date(null)` da 1970-01-01 y `Number.isNaN` no lo detecta. Ojo: el síntoma real es que se guarda 1970-01-01, no un 400 (el 400 sólo salta con una fecha no parseable).
- **Evidencia:**

```ts
    const parseValidDate = (value: unknown): Date | null => {
      const d = new Date(value as string);
      return Number.isNaN(d.getTime()) ? null : d;
    };
    ...
    if (scheduledStart !== undefined) {
      const d = parseValidDate(scheduledStart);
    ...
    if (parsedStart && parsedEnd && parsedStart >= parsedEnd) {
      return NextResponse.json(
        { error: 'scheduledStart debe ser anterior a scheduledEnd' },

// page.tsx:219-220
        scheduledStart: formScheduledStart ? new Date(formScheduledStart).toISOString() : null,
```

- **Escenario de fallo:** Admin abre una solicitud pendiente (sin scheduledStart/End, el caso normal) y pulsa "Cancelar solicitud" sin tocar las fechas. El body lleva scheduledStart:null y scheduledEnd:null -> ambas se convierten en epoch -> epoch >= epoch -> 400 "scheduledStart debe ser anterior a scheduledEnd". La solicitud no se puede cancelar salvo que el admin invente fechas.
- **Arreglo propuesto:** Tratar `null`/'' como "limpiar": `if (scheduledStart !== undefined) { if (scheduledStart === null || scheduledStart === '') parsedStart = null; else { ...validar... } }`, escribir `updateData.scheduledStart = parsedStart` cuando `!== undefined`, y comparar solo si ambas son `Date`. En la UI, para `newStatus === 'cancelled'` enviar solo `{ status, adminNotes }`.
- **Otros auditores añaden:** Tratar null y '' como 'limpiar': `if (scheduledStart === null || scheduledStart === '') updateData.scheduledStart = null; else if (scheduledStart !== undefined) { if (typeof scheduledStart !== 'string') return 400; ...parse... }` (igual para scheduledEnd). Comparar start<end solo cuando ambos son fechas reales. En la rama 'confirmed' usar las fechas parseadas en vez de los valores crudos. Anadir test con ambos null + status 'cancelled'.

#### ADM-008 — PATCH de entrevistas responde `{ interview }` sin `success`: la UI siempre muestra "Error al guardar" aunque el cambio SI se guardo

- **Severidad:** 🟠 high · **Categoría:** correctness · **Estado:** nuevo · **Verificación:** ✅ verificada contra el código
- **Ubicación:** `src/app/api/admin/interviews/[id]/route.ts:196` · relacionados: `src/app/admin/interviews/page.tsx`, `__tests__/qa/feb2026-regression.test.ts`
- **Problema:** La pagina admin/interviews decide exito con `data.success`, pero el handler PATCH (y el GET por id) devuelven `{ interview }` sin campo `success`. Resultado: toda confirmacion, edicion o cancelacion se persiste en BD pero el modal muestra "Error al guardar", no se cierra y la lista no se refresca. El mismo bug ya se corrigio en feb-2026 para la ruta de LISTADO (ver __tests__/qa/feb2026-regression.test.ts, bloque P1-09a: "API retornaba {interviews} pero frontend esperaba {success, data}"), pero la ruta [id] quedo con el formato viejo.
- **Comprobación:** Confirmado: la API responde `{ interview }` y la UI comprueba `if (data.success)` (src/app/admin/interviews/page.tsx:238).
- **Evidencia:**

```ts
// src/app/api/admin/interviews/[id]/route.ts:196
    return NextResponse.json({ interview });

// src/app/admin/interviews/page.tsx:237-244
      const data = await res.json();
      if (data.success) {
        setModalOpen(false);
        setSelectedInterview(null);
        fetchInterviews();
      } else {
        setModalError(data.error || 'Error al guardar');
      }
```

- **Escenario de fallo:** Admin abre una solicitud pendiente, elige horario y pulsa "Confirmar Entrevista". El servidor responde 200 `{interview:{...}}`, marca la entrevista como confirmed y la Application como 'interviewed'. La UI ve `data.success === undefined`, muestra "Error al guardar" y deja el modal abierto. El admin reintenta (re-ejecuta confirmedAt y el update de la Application) o abandona creyendo que fallo; la pestana Pendientes sigue mostrando la solicitud hasta recargar la pagina.
- **Arreglo propuesto:** En PATCH y GET de [id] devolver `{ success: true, data: interview, interview }` y en todos los errores `{ success: false, error }` (igual que el resto de /api/admin/*). En la pagina usar `if (res.ok && data.success)`. Anadir un test que importe el handler PATCH y verifique el shape de la respuesta.
- **Otros auditores añaden:** Unificar el contrato: devolver `{ success: true, data: interview, interview }` en PATCH y GET por id, y `{ success: false, error }` en todas las respuestas de error de este archivo y de interviews/route.ts. Anadir un test que ejecute el handler y verifique `success === true`.

#### ADM-009 — Desactivar o degradar un usuario desde /api/admin/users no revoca su acceso en rutas que solo confian en los headers del middleware (JWT valido 7 dias)

- **Severidad:** 🟠 high · **Categoría:** authz · **Estado:** pendiente conocido de junio · **Verificación:** sin verificar (reportada por 3 auditores)
- **Ubicación:** `src/app/api/admin/users/route.ts:354` · relacionados: `src/middleware.ts`, `src/lib/auth.ts`, `src/app/api/evaluations/notes/route.ts`, `src/app/api/evaluations/skill-ratings/route.ts`, `src/app/api/admin/vendors/route.ts`
- **Problema:** El unico mecanismo de baja es el soft delete (isActive=false) y el cambio de rol via PUT. requireAuth/requireRole si consultan isActive y el rol en BD, pero el middleware solo valida la firma del JWT y usa payload.role. Hay 16 rutas que autentican unicamente con x-user-id/x-user-role (p. ej. src/app/api/evaluations/notes/route.ts, evaluations/skill-ratings, company/*, my-applications, admin/vendors/*) y nunca miran isActive. Ademas la desactivacion no toca los JobAssignment del usuario, por lo que canAccessJob sigue concediendo acceso. Relacionado con la accion pendiente #20/#26 (invalidacion de sesiones), aqui con el escenario concreto de baja de personal.
- **Evidencia:**

```ts
// Soft delete: desactivar en lugar de eliminar
await prisma.user.update({
  where: { id: parseInt(id) },
  data: { isActive: false }
});
// src/app/api/evaluations/notes/route.ts:18
const userId = request.headers.get('x-user-id');
const userRole = request.headers.get('x-user-role');
if (!userId || !userRole || !['recruiter', 'specialist', 'admin', 'company'].includes(userRole)) {
```

- **Escenario de fallo:** El admin despide a un reclutador y pulsa 'Desactivar'. El reclutador conserva su cookie auth-token (expira en 7 dias): GET/POST /api/evaluations/notes?applicationId=X sigue respondiendo 200 con notas y PII de candidatos de sus vacantes asignadas, y puede seguir escribiendo notas. Igual con un admin degradado a recruiter: su JWT sigue diciendo role=admin y pasa el middleware de /api/admin/* en los handlers que solo leen x-user-role (admin/vendors/*).
- **Arreglo propuesto:** Implementar tokenVersion/passwordChangedAt (pendiente #20/#26) e incrementarlo en DELETE y en PUT cuando cambien isActive, role o password. Mientras tanto: sustituir la lectura de headers por requireAuth()/requireRole() en las 16 rutas header-only, y al desactivar limpiar o reasignar los JobAssignment del usuario.
- **Otros auditores añaden:** En PUT y DELETE: rechazar con 400 si parseInt(id) === auth.user.id y el cambio implica isActive=false o un rol distinto de admin; y antes de desactivar o degradar a un admin, contar admins activos restantes y rechazar si quedaria 0. En la UI ocultar esas acciones en la fila del usuario actual y pedir confirmacion en el toggle. — En PUT y DELETE: si parseInt(id) === auth.user.id y el cambio implica isActive=false o role !== 'admin', responder 400. Ademas, antes de desactivar/degradar a un admin, comprobar prisma.user.count({where:{role:'admin', isActive:true, id:{not:targetId}}}) > 0. Ocultar los botones en la fila propia en src/app/admin/users/page.tsx.

## 🟡 medium (43)

#### ADM-010 — Banco de candidatos limitado a 30 sin paginador; el filtro de status se aplica en cliente despues de paginar y "Seleccionar todos" solo cubre esa pagina

- **Severidad:** 🟡 medium · **Categoría:** correctness · **Estado:** nuevo · **Verificación:** sin verificar (reportada por 1 auditor)
- **Ubicación:** `src/app/admin/assign-candidates/page.tsx:296` · relacionados: `src/app/api/admin/candidates/route.ts`
- **Problema:** GET /api/admin/candidates pagina con 30 por defecto. La pagina no envia `page`/`limit`, ignora `data.pagination` y despues descarta hired/inactive en cliente, de modo que pueden quedar menos de 30 visibles. El contador de la pestana y "Seleccionar todos (N)" reflejan solo esa pagina. Ademas la respuesta incluye experiences y documents de cada candidato, que la vista no usa.
- **Evidencia:**

```ts
      const response = await fetch(`/api/admin/candidates?${params}`);
      const data = await response.json();

      if (data.success) {
        const filteredCandidates = data.data.filter(
          (c: Candidate) => !c.status || c.status === 'available' || c.status === 'in_process'
        );
        setCandidates(filteredCandidates);

// src/app/api/admin/candidates/route.ts:113
    const pagination = getPaginationParams(searchParams, 30);
```

- **Escenario de fallo:** El banco tiene 400 candidatos. El admin filtra Perfil=Tecnologia (120 coincidencias) y pulsa refrescar: ve como maximo 30 (menos si alguno esta hired/inactive), "Seleccionar todos" marca solo esos, y no hay forma de ver del 31 en adelante salvo adivinando el nombre en el buscador.
- **Arreglo propuesto:** Enviar `status=available,in_process` (soportar lista en la API) para filtrar en servidor, usar `data.pagination` con paginador o scroll infinito, mostrar "N de TOTAL" y pedir una proyeccion ligera sin experiences/documents.

#### ADM-011 — Para pintar el contador "N vacantes" se descarga la tabla COMPLETA de applications en cada carga de candidatos

- **Severidad:** 🟡 medium · **Categoría:** performance · **Estado:** nuevo · **Verificación:** sin verificar (reportada por 1 auditor)
- **Ubicación:** `src/app/admin/assign-candidates/page.tsx:323` · relacionados: `src/app/api/applications/route.ts`
- **Problema:** `fetchCandidateAssignments` llama GET /api/applications sin filtros. Ese handler hace `findMany` sin paginar ni `select`, con include de job y user, y devuelve todas las filas con PII, coverLetter y notes. Se ejecuta en cada cambio de vacante, busqueda, refresco y tras cada asignacion, y el spinner de candidatos espera a que termine (`await` dentro del try). Despues cuenta con `emails.includes` dentro de un bucle (O(n*m)). El numero mostrado incluye aplicaciones rechazadas/archivadas y de vacantes cerradas.
- **Evidencia:**

```ts
      const emails = candidateList.map(c => c.email.toLowerCase());
      const response = await fetch('/api/applications');
      const data = await response.json();

      if (data.success) {
        const counts: Record<string, number> = {};
        for (const app of data.data) {
          const email = app.candidateEmail?.toLowerCase();
          if (email && emails.includes(email)) {

// src/app/api/applications/route.ts:32
    const applications = await prisma.application.findMany({ where, include: {...}, orderBy: {...} });
```

- **Escenario de fallo:** Con ~20.000 applications la respuesta supera el limite de 4.5 MB de una funcion serverless de Vercel: la peticion falla, `response.json()` lanza, aparece "Error al cargar las asignaciones." en cada interaccion y la lista tarda segundos en salir del spinner. Antes de ese punto ya se transfieren varios MB de PII por clic.
- **Arreglo propuesto:** Crear un endpoint admin que reciba los emails (o candidateIds) visibles y devuelva `groupBy({ by:['candidateEmail'], where:{ candidateEmail:{in}, status:{notIn:[...cerrados]} }, _count:true })`, o incluir el conteo en /api/admin/candidates. No bloquear el listado esperando el contador.

#### ADM-012 — La seleccion multiple sobrevive al cambio de vacante y de busqueda; "Seleccionar todos" compara tamanos, no pertenencia

- **Severidad:** 🟡 medium · **Categoría:** frontend-bug · **Estado:** nuevo · **Verificación:** sin verificar (reportada por 1 auditor)
- **Ubicación:** `src/app/admin/assign-candidates/page.tsx:374`
- **Problema:** `selectedCandidates` solo se vacia cuando `selectedJob` pasa a null o tras asignar. Al cambiar de la vacante A a la B, o al buscar/filtrar, los ids marcados persisten aunque ya no sean visibles. El pie con el boton "Asignar" se muestra en cualquier pestana (tambien Pipeline). `handleSelectAll` decide marcar o desmarcar comparando `selectedCandidates.size` con la cantidad visible, por lo que una seleccion oculta puede coincidir por casualidad (y con 0 disponibles el icono aparece marcado).
- **Evidencia:**

```ts
  const handleSelectAll = () => {
    const availableCandidates = candidates.filter(
      c => !alreadyAssigned.has(c.email.toLowerCase())
    );

    if (selectedCandidates.size === availableCandidates.length) {
      setSelectedCandidates(new Set());
    } else {
      setSelectedCandidates(new Set(availableCandidates.map(c => c.id)));
    }
  };
```

- **Escenario de fallo:** Admin marca 3 candidatos para la vacante A y, sin asignar, hace clic en la vacante B para ver su pipeline. El pie sigue diciendo "3 candidato(s) seleccionado(s) - Para: B"; al pulsar Asignar se crean 3 Applications en B, los candidatos pasan a in_process y se notifica al reclutador de B. La pagina no ofrece deshacer.
- **Arreglo propuesto:** Vaciar `selectedCandidates` dentro del efecto de `[selectedJob]` y al cambiar filtros/busqueda (o listar explicitamente los seleccionados no visibles). En `handleSelectAll` usar `availableCandidates.every(c => selectedCandidates.has(c.id))` y mostrar el pie solo en la pestana 'assign'.

#### ADM-013 — Los filtros Perfil / Nivel / Subcategoria no recargan la lista: solo cambian estado

- **Severidad:** 🟡 medium · **Categoría:** frontend-bug · **Estado:** nuevo · **Verificación:** sin verificar (reportada por 1 auditor)
- **Ubicación:** `src/app/admin/assign-candidates/page.tsx:689`
- **Problema:** Los `onChange` de los tres selects solo hacen setState. `fetchCandidates` solo se dispara al cambiar de vacante, al pulsar Enter en el buscador o al hacer clic en el boton de refrescar (icono sin texto ni title). No hay boton "Aplicar".
- **Evidencia:**

```ts
                          <select
                            value={profileFilter}
                            onChange={(e) => {
                              setProfileFilter(e.target.value);
                              setSubcategoryFilter(''); // Limpiar subcategoría al cambiar perfil
                            }}

// lineas 233-237: unico efecto que recarga
  useEffect(() => {
    if (selectedJob) {
      fetchCandidates();
  ...
  }, [selectedJob]);
```

- **Escenario de fallo:** Admin abre Filtros, elige Perfil="Diseno Grafico" y Nivel="Sr". La lista no cambia; concluye que el filtro no funciona o que todos cumplen, y asigna candidatos que no corresponden al perfil.
- **Arreglo propuesto:** Anadir `useEffect(() => { if (selectedJob) fetchCandidates(); }, [profileFilter, seniorityFilter, subcategoryFilter])` (con debounce para el texto) o un boton explicito "Aplicar filtros"; dar `aria-label`/`title` al boton de refrescar.

#### ADM-014 — Guardar una fila en Gestion de Vacantes recarga toda la pagina y borra las selecciones no guardadas de las demas filas

- **Severidad:** 🟡 medium · **Categoría:** frontend-bug · **Estado:** nuevo · **Verificación:** sin verificar (reportada por 1 auditor)
- **Ubicación:** `src/app/admin/assignments/page.tsx:137`
- **Problema:** Cada fila tiene su propio boton Guardar, pero tras guardar se llama `fetchAssignments()`, que pone `isLoading=true` (la pagina entera se sustituye por un spinner y se pierde el scroll) y reconstruye `selections` desde el servidor con `setSelections(initialSelections)`, descartando los cambios pendientes de otras vacantes. Lo mismo ocurre al cambiar de filtro.
- **Evidencia:**

```ts
        // Inicializar selecciones con valores actuales
        const initialSelections: any = {};
        data.data.forEach((job: Job) => {
          if (job.assignment) {
            initialSelections[job.id] = { ... };
          }
        });
        setSelections(initialSelections);

// lineas 172-175
      if (data.success) {
        setSuccess('Asignación guardada');
        fetchAssignments();
```

- **Escenario de fallo:** Admin elige reclutador y especialista en 5 vacantes sin asignar y pulsa Guardar en la primera. Tras el spinner las otras 4 vuelven a "Sin asignar"; al pulsar Guardar en la segunda obtiene "Selecciona al menos un reclutador o especialista" y debe rehacer todo.
- **Arreglo propuesto:** Tras guardar, actualizar solo esa vacante en `jobs`/`stats` con `data.data` de la respuesta (sin `isLoading` global) o, al recargar, fusionar: `setSelections(prev => ({ ...initialSelections, ...filasSucias(prev) }))`. Usar un indicador de carga no bloqueante.

#### ADM-015 — Reclutador/especialista desactivado: el select muestra "Sin asignar" pero el estado conserva su id y la API lo vuelve a aceptar

- **Severidad:** 🟡 medium · **Categoría:** correctness · **Estado:** nuevo · **Verificación:** sin verificar (reportada por 1 auditor)
- **Ubicación:** `src/app/admin/assignments/page.tsx:588` · relacionados: `src/app/api/admin/assignments/route.ts`
- **Problema:** Las opciones salen de `recruiters`/`specialists` filtrados por `isActive: true`, pero `selections` se inicializa con el id guardado aunque ese usuario este desactivado. Un select controlado cuyo value no coincide con ninguna opcion muestra la primera ("Sin asignar"). Al guardar se reenvia el id oculto y el POST solo valida el rol, no `isActive`; ademas le crea otra notificacion.
- **Evidencia:**

```ts
                          <select
                            value={selections[job.id]?.recruiterId || ''}
                            ...
                            <option value="">Sin asignar</option>
                            {recruiters.map((r) => (

// src/app/api/admin/assignments/route.ts:111-112 y 203
    const recruiters = await prisma.user.findMany({
      where: { role: 'recruiter', isActive: true },
      if (!recruiter || recruiter.role !== 'recruiter') {
```

- **Escenario de fallo:** Se desactiva a la reclutadora Laura, que tenia 6 vacantes. En /admin/assignments esas filas muestran Reclutador="Sin asignar" con badge "Con Reclutador". El admin cambia solo el especialista y guarda: se reenvia el id de Laura, la vacante sigue asignada a una cuenta que no puede iniciar sesion y nadie la atiende.
- **Arreglo propuesto:** En el GET incluir en la respuesta el usuario asignado aunque este inactivo y pintarlo como opcion "(desactivado)" con alerta visual; en el POST rechazar con 400 si `!recruiter.isActive` / `!specialist.isActive`. Al desactivar un usuario, avisar de sus asignaciones vivas.

#### ADM-016 — admin/candidates sin paginación: candidatos más allá de los primeros 30 son inalcanzables

- **Severidad:** 🟡 medium · **Categoría:** ux · **Estado:** nuevo · **Verificación:** sin verificar (reportada por 1 auditor)
- **Ubicación:** `src/app/admin/candidates/page.tsx:140`
- **Problema:** fetchCandidates arma los query params de filtros pero nunca envía `page`/`limit`, y la UI no renderiza ningún control de paginación. El endpoint devuelve máximo 30 (getPaginationParams default 30) e incluye `pagination`, pero la página usa solo `data.data` y muestra 'Mostrando {candidates.length} candidatos'. Las tarjetas de stats (total/available/inProcess/hired) también se calculan sobre ese subconjunto.
- **Evidencia:**

```ts
const response = await fetch(`/api/admin/candidates?${params}`);
const data = await response.json();
if (response.ok && data.success) {
  setCandidates(data.data);
}
```

- **Escenario de fallo:** Con 50 candidatos en el banco, el admin solo ve los 30 más recientes. No hay forma de navegar a los 20 restantes salvo acotando con filtros que él debe adivinar; la tarjeta 'Total' muestra 30 en lugar de 50.
- **Arreglo propuesto:** Añadir estado de página y controles de paginación (anterior/siguiente) que envíen `?page=N`, usar `pagination.total`/`pagination.totalPages` de la respuesta, y mostrar el total real.

#### ADM-017 — XSS almacenado: /admin/direct-applications renderiza cvUrl sin validar esquema

- **Severidad:** 🟡 medium · **Categoría:** security · **Estado:** nuevo · **Verificación:** sin verificar (reportada por 1 auditor)
- **Ubicación:** `src/app/admin/direct-applications/page.tsx:282`
- **Problema:** La página pinta el CV como `<a href={app.cvUrl}>` con la URL cruda. `cvUrl` proviene de `POST /api/applications`, que es público (excepción en middleware.ts líneas 19-21) y NO valida el esquema de la URL (applications/route.ts línea 158 guarda `cvUrl || null` sin verificación). Un atacante anónimo puede enviar `cvUrl: 'javascript:...'`. A diferencia de /admin/candidates que usa `ensureUrl` (que neutraliza esquemas no-http), aquí el href se usa tal cual.
- **Evidencia:**

```ts
{app.cvUrl && (
  <a href={app.cvUrl} target="_blank" rel="noopener noreferrer" ...>
    <FileText className="w-4 h-4" /> Ver CV
  </a>
)}
```

- **Escenario de fallo:** Atacante hace POST público a /api/applications con cvUrl='javascript:fetch("/api/admin/users")...'. Cuando el admin abre 'Aplicaciones Directas' y hace clic en 'Ver CV', el javascript: se ejecuta en el origen autenticado del admin (los navegadores ejecutan javascript: en anchors aunque tengan target=_blank), permitiendo acciones con su sesión.
- **Arreglo propuesto:** Validar el esquema de cvUrl en `POST /api/applications` (solo http/https, reutilizar `isSafeDocumentUrl` de profile/documents) y además, en la UI, envolver el href con un helper que rechace esquemas no http(s) antes de renderizar.

#### ADM-018 — La pagina de postulaciones directas revienta si la vacante no tiene usuario: el API devuelve job.user = null y la UI lo desreferencia

- **Severidad:** 🟡 medium · **Categoría:** frontend-bug · **Estado:** nuevo · **Verificación:** sin verificar (reportada por 1 auditor)
- **Ubicación:** `src/app/admin/direct-applications/page.tsx:304` · relacionados: `src/app/api/admin/direct-applications/route.ts`, `prisma/schema.prisma`
- **Problema:** Job.userId es opcional (Int?, onDelete: SetNull) y la auditoria de junio documento que POST /api/jobs permitia vacantes anonimas, por lo que pueden existir filas con userId null. El GET del API incluye job.user tal cual (null). La interfaz TypeScript de la pagina lo declara no nulo y accede a app.job.user.companyRequest sin optional chaining sobre user.
- **Evidencia:**

```ts
<p className="text-sm text-gray-600">
  {app.job.user.companyRequest?.nombreEmpresa ||
    app.job.company}{' '}
  • {app.job.location}
</p>
```

- **Escenario de fallo:** Existe una aplicacion pending sobre una vacante heredada sin userId. El admin abre /admin/direct-applications: el render lanza 'Cannot read properties of null (reading companyRequest)' y toda la pagina cae, impidiendo procesar CUALQUIER postulacion directa mientras esa fila exista.
- **Arreglo propuesto:** Usar app.job.user?.companyRequest?.nombreEmpresa y tipar user como `| null` en la interfaz Application. Opcionalmente normalizar en el API devolviendo companyName ya resuelto.

#### ADM-019 — Métricas del dashboard subestimadas por leer .length de respuestas paginadas

- **Severidad:** 🟡 medium · **Categoría:** correctness · **Estado:** nuevo · **Verificación:** sin verificar (reportada por 1 auditor)
- **Ubicación:** `src/app/admin/page.tsx:173`
- **Problema:** El dashboard toma el total de entidades desde `data.data.length` de endpoints paginados en lugar de `pagination.total`. `/api/jobs` limita a 20 por página (getPaginationParams default 20) y `/api/admin/candidates` a 30. Así `stats.totalJobs = allJobs.length` se topa en 20 y `stats.totalCandidates = candidatesData.data?.length` se topa en 30, aunque la respuesta trae `pagination.total` con el número real.
- **Evidencia:**

```ts
totalJobs: allJobs.length,
// ...
if (candidatesData.success) {
  setStats(prev => ({ ...prev, totalCandidates: candidatesData.data?.length || 0 }));
}
```

- **Escenario de fallo:** Con 45 candidatos y 25 vacantes en BD, el dashboard muestra 'Candidatos: 30' y 'Vacantes Totales: 20'. Los filtros de Empresa/Especialidad de la tabla se arman solo con las primeras 20 vacantes, ocultando empresas reales.
- **Arreglo propuesto:** Usar el campo `pagination.total` que ya devuelven ambos endpoints para las tarjetas de conteo, y pedir un `limit` suficiente (o un endpoint de solo-conteo) para poblar los selectores de filtro con el universo completo.

#### ADM-020 — Desactivar (un clic, sin confirmacion) o eliminar una entrada no bloquea la combinacion: la publicacion cae a 5 creditos por defecto y se salta el salario minimo

- **Severidad:** 🟡 medium · **Categoría:** payments · **Estado:** nuevo · **Verificación:** sin verificar (reportada por 1 auditor)
- **Ubicación:** `src/app/admin/pricing/page.tsx:193` · relacionados: `src/lib/pricing.ts`, `src/app/api/jobs/route.ts`, `src/app/api/admin/pricing/route.ts`
- **Problema:** El pill de Estado hace PUT isActive=false al instante, sin confirmacion y sin la comprobacion de vacantes activas que si hace DELETE. calculateJobCreditCost solo busca filas isActive:true y, si no encuentra, devuelve DEFAULT_CREDITS=5 con found:false; POST /api/jobs usa ese 5 para cobrar y su validacion de minSalary tambien filtra isActive:true. Es decir, 'Inactivo' no deshabilita nada: cambia el precio a 5 y elimina el salario minimo. La UI no lo advierte en ningun sitio.
- **Evidencia:**

```ts
// page.tsx
  const handleToggleActive = async (entry: PricingEntry) => {
    try {
      const response = await fetch('/api/admin/pricing', {
        method: 'PUT',
        ...
        body: JSON.stringify({
          id: entry.id,
          isActive: !entry.isActive
        })

// src/lib/pricing.ts
  const DEFAULT_CREDITS = 5;
  ...
```

- **Escenario de fallo:** El admin hace clic (queriendo o no) en el pill 'Activo' de 'Tecnología / Director / Remoto' (12 creditos, minSalary $60,000). Desde ese momento las empresas publican vacantes Director-remoto por 5 creditos y con cualquier salario. A la inversa, desactivar 'Practicante / Presencial' (2 creditos) sube su precio a 5.
- **Arreglo propuesto:** Pedir confirmacion explicando el efecto; en PUT, al pasar a isActive=false, aplicar la misma comprobacion de vacantes que DELETE. Definir la regla de negocio: si found === false, rechazar la publicacion (422 'Combinación no disponible') en vez de cobrar 5 en silencio, o que las filas inactivas sigan fijando precio y solo se oculten de las opciones.

#### ADM-021 — Boton de limpiar filtros recarga con los filtros viejos (closure obsoleta)

- **Severidad:** 🟡 medium · **Categoría:** frontend-bug · **Estado:** nuevo · **Verificación:** sin verificar (reportada por 1 auditor)
- **Ubicación:** `src/app/admin/pricing/page.tsx:356`
- **Problema:** El onClick llama a los tres setState y en la misma pasada a fetchPricing(), que lee filterProfile/filterSeniority/filterWorkMode del closure del render actual (valores anteriores). Los selects se vacian pero la peticion sale con los filtros previos.
- **Evidencia:**

```ts
            <button
              onClick={() => {
                setFilterProfile('');
                setFilterSeniority('');
                setFilterWorkMode('');
                fetchPricing();
              }}
```

- **Escenario de fallo:** El admin filtra por Perfil='Tecnología' y luego pulsa el boton de refrescar/limpiar: los selects muestran 'Todos los perfiles' pero la tabla y el contador siguen mostrando solo Tecnología. Tiene que pulsar 'Filtrar' otra vez para ver la matriz completa.
- **Arreglo propuesto:** Hacer que fetchPricing acepte los filtros como argumento (fetchPricing({ profile: '', seniority: '', workMode: '' })) o disparar la carga desde un useEffect dependiente de los tres filtros.

#### ADM-022 — Campo Créditos: vacio se convierte en 0 y se puede guardar (required inutil); la API acepta 0 aunque su mensaje exige 'positivo'

- **Severidad:** 🟡 medium · **Categoría:** validation · **Estado:** nuevo · **Verificación:** sin verificar (reportada por 1 auditor)
- **Ubicación:** `src/app/admin/pricing/page.tsx:521` · relacionados: `src/app/api/admin/pricing/route.ts`, `src/lib/pricing.ts`
- **Problema:** parseInt(e.target.value) || 0 convierte el campo vacio en 0, que el input muestra como '0'. Con min="0" el valor es valido, asi que required nunca protege y Enter envia el formulario. La API solo rechaza credits < 0. Con credits=0, calculateJobCreditCost devuelve {credits:0, found:true} y POST /api/jobs publica la vacante sin descontar creditos.
- **Evidencia:**

```ts
// page.tsx
  type="number"
  value={formData.credits}
  onChange={(e) => setFormData({ ...formData, credits: parseInt(e.target.value) || 0 })}
  min="0"
  ...
  required

// src/app/api/admin/pricing/route.ts
    if (credits !== undefined && (typeof credits !== 'number' || credits < 0)) {
      return NextResponse.json(
        { success: false, error: 'Credits debe ser un número positivo' },
```

- **Escenario de fallo:** El admin abre 'Editar Créditos' de 'Finanzas / Sr / Híbrido' (9), selecciona el numero y lo borra para reescribirlo: el campo pasa a '0'. Pulsa Enter sin querer: se guarda credits=0 con 'Créditos actualizados exitosamente'. Todas las empresas publican esa combinacion gratis hasta que alguien lo note.
- **Arreglo propuesto:** Guardar el valor como string, validar en submit Number.isInteger(n) && n >= 1 (o confirmacion explicita si 0 es un caso de negocio real) y alinear la API: credits < 1 => 400, o corregir el mensaje si 0 es valido.

#### ADM-023 — Editar solicitud de empresa no refresca la lista (falta prop onUpdate)

- **Severidad:** 🟡 medium · **Categoría:** ux · **Estado:** nuevo · **Verificación:** sin verificar (reportada por 1 auditor)
- **Ubicación:** `src/app/admin/requests/page.tsx:325`
- **Problema:** RequestDetailModal implementa edición inline (handleSave hace PUT a /api/company-requests/[id] y luego llama `if (onUpdate) onUpdate()`), pero en requests/page.tsx el modal se monta SIN pasar `onUpdate`. Por tanto tras guardar, la lista de solicitudes no se recarga y sigue mostrando los datos viejos hasta que el admin refresca manualmente.
- **Evidencia:**

```ts
<RequestDetailModal
  request={selectedRequest}
  onClose={() => setSelectedRequest(null)}
  onApprove={handleApprove}
  onReject={handleRejectClick}
/> // <- no se pasa onUpdate
```

- **Escenario de fallo:** Admin abre una solicitud pendiente, pulsa Editar, corrige el RFC/correo, Guardar Cambios → PUT 200 y el modal se cierra. La tabla sigue mostrando el RFC/correo anteriores; el admin cree que el cambio no se aplicó y puede reintentar o reportar un bug inexistente.
- **Arreglo propuesto:** Pasar `onUpdate={fetchRequests}` al RequestDetailModal en requests/page.tsx para que tras guardar se recargue la lista.

#### ADM-024 — Las pantallas admin usan listas de especialidades escritas a mano en lugar del catalogo de BD, y el API de usuarios no valida specialty

- **Severidad:** 🟡 medium · **Categoría:** frontend-bug · **Estado:** nuevo · **Verificación:** sin verificar (reportada por 1 auditor)
- **Ubicación:** `src/app/admin/users/page.tsx:66` · relacionados: `src/components/sections/admin/CandidateForm.tsx`, `src/app/admin/candidates/page.tsx`, `src/app/api/admin/users/route.ts`, `src/app/api/admin/assignments/route.ts`
- **Problema:** Existe un CRUD de especialidades (/admin/specialties) y un endpoint de catalogo, pero /admin/users (SPECIALTIES), CandidateForm (profiles, linea 121) y /admin/candidates (profiles del filtro, linea 116) llevan la misma lista fija de 7 nombres. /api/admin/users acepta cualquier string en specialty sin contrastarlo con la tabla Specialty.
- **Evidencia:**

```ts
const SPECIALTIES = [
  'Tecnología',
  'Arquitectura',
  'Diseño Gráfico',
  'Producción Audiovisual',
  'Educación',
  'Administración de Oficina',
  'Finanzas'
];
```

- **Escenario de fallo:** El admin crea la especialidad 'Marketing' y se publican vacantes de Marketing. Al dar de alta al especialista no puede elegir 'Marketing' (no esta en el select), asi que cada asignacion muestra el aviso 'La especialidad del especialista no coincide con el perfil de la vacante'. Tampoco puede clasificar ni filtrar candidatos por 'Marketing'. Si renombra una de las 7, editar a un especialista existente obliga a cambiarle la especialidad porque su valor ya no esta en el select required.
- **Arreglo propuesto:** Cargar las opciones desde /api/admin/specialties?active=true en las tres pantallas (un hook useSpecialties compartido) y en POST/PUT de /api/admin/users validar que specialty exista y este activa en prisma.specialty.

#### ADM-025 — admin/users sin paginación: usuarios más allá de los primeros 30 son inalcanzables

- **Severidad:** 🟡 medium · **Categoría:** ux · **Estado:** nuevo · **Verificación:** sin verificar (reportada por 1 auditor)
- **Ubicación:** `src/app/admin/users/page.tsx:98`
- **Problema:** fetchUsers envía solo search/role/isActive, sin `page`/`limit`, y la tabla no tiene paginador. El endpoint /api/admin/users limita a 30 (getPaginationParams default 30) y devuelve `pagination`, pero la UI usa `data.data` y muestra 'Mostrando {users.length} usuarios'. Los stats (total/admins/recruiters/specialists/active) se calculan sobre la página cargada.
- **Evidencia:**

```ts
const response = await fetch(`/api/admin/users?${params}`);
const data = await response.json();
if (data.success) {
  setUsers(data.data);
}
```

- **Escenario de fallo:** Con 35 reclutadores/especialistas, el admin solo ve 30 y no puede editar ni desactivar a los 5 restantes; la tarjeta 'Total' reporta 30. Como el orden es por rol asc + createdAt desc, ciertos usuarios quedan sistemáticamente fuera de vista.
- **Arreglo propuesto:** Agregar controles de paginación que envíen `?page=N&limit=...`, y usar los campos de `pagination` de la respuesta para el conteo y la navegación.

#### ADM-026 — Inyeccion de candidatos sin transaccion ni restriccion unica (jobId, candidateEmail): duplicados bajo concurrencia y estados a medias

- **Severidad:** 🟡 medium · **Categoría:** data-integrity · **Estado:** nuevo · **Verificación:** sin verificar (reportada por 2 auditores)
- **Ubicación:** `src/app/api/admin/assign-candidates/route.ts:94` · relacionados: `prisma/schema.prisma`, `src/app/api/applications/route.ts`
- **Problema:** El flujo es comprobar-luego-crear: `findMany` de existentes, `createMany`, `updateMany` de candidatos y otro `findMany`, todo fuera de `$transaction`. El modelo Application no tiene `@@unique([jobId, candidateEmail])`. Dos peticiones simultaneas (dos admins, dos pestanas, o el candidato aplicando por POST /api/applications a la vez) pasan ambas la comprobacion. Si `updateMany` falla, las Applications quedan creadas, el candidato sigue 'available' y el cliente recibe 500.
- **Evidencia:**

```ts
    const applications = await prisma.application.createMany({
      data: candidatesToAssign.map(candidate => ({
        jobId: parseInt(jobId),
        ...
    // Actualizar el status de los candidatos a "in_process"
    await prisma.candidate.updateMany({

// prisma/schema.prisma (model Application): solo indices, sin unique compuesto
  @@index([jobId])
  @@index([candidateEmail])
```

- **Escenario de fallo:** Dos admins tienen abierta la misma vacante y asignan al mismo candidato con segundos de diferencia: ambas pasan el chequeo de `existingEmails` y se crean dos Applications del mismo email en la misma vacante; el reclutador ve al candidato duplicado.
- **Arreglo propuesto:** Anadir `@@unique([jobId, candidateEmail])` (migracion previa deduplicando) y usar `createMany({ skipDuplicates: true })` dentro de `prisma.$transaction` junto con el `updateMany`.
- **Otros auditores añaden:** Ejecutar chequeo + createMany + updateMany dentro de `prisma.$transaction(async (tx) => {...})`. Anadir `@@unique([jobId, candidateEmail])` en Application (migracion con deduplicacion previa) y usar `skipDuplicates: true`, tomando `assignedCount` de `applications.count`.

#### ADM-027 — La nota interna de inyeccion se guarda en Application.notes y /my-applications se la muestra al candidato como "Nota de la empresa"

- **Severidad:** 🟡 medium · **Categoría:** security · **Estado:** nuevo · **Verificación:** sin verificar (reportada por 1 auditor)
- **Ubicación:** `src/app/api/admin/assign-candidates/route.ts:102` · relacionados: `src/app/api/my-applications/route.ts`, `src/app/my-applications/page.tsx`, `src/app/api/candidate/applications/route.ts`
- **Problema:** Al inyectar, el POST escribe texto interno en `Application.notes`. GET /api/my-applications devuelve la aplicacion completa (`...app`) buscando por userId O por email, y la pagina /my-applications renderiza `application.notes` bajo el rotulo "Nota de la empresa". /api/candidate/applications si anula `notes` ("No mostrar notas internas al candidato"), pero /api/my-applications no; el middleware permite esa ruta a roles user, candidate y admin. Tambien se expone el status crudo 'injected_by_admin'.
- **Evidencia:**

```ts
        status: 'injected_by_admin',
        notes: `Candidato inyectado por Admin. Fuente original: ${candidate.source}. Perfil: ${candidate.profile || 'N/A'}. Seniority: ${candidate.seniority || 'N/A'}.`

// src/app/api/my-applications/route.ts:85
      return { ...app, job: jobWithoutUser };

// src/app/my-applications/page.tsx:394-398
                    {application.notes && (
                      ...
                          <strong>Nota de la empresa:</strong>{' '}
                          {application.notes}
```

- **Escenario de fallo:** Admin inyecta a maria@x.com (fuente 'linkedin') en una vacante. Maria tiene cuenta con ese email, abre /my-applications y lee: "Nota de la empresa: Candidato inyectado por Admin. Fuente original: linkedin. Perfil: Tecnologia. Seniority: Sr." en una vacante a la que nunca aplico.
- **Arreglo propuesto:** En /api/my-applications poner `notes: null` y mapear el status a una etiqueta publica (como hace /api/candidate/applications). No guardar metadatos de inyeccion en `notes`: usar un campo interno (p. ej. `source`/`injectedById`) o el modelo de notas de evaluacion.

#### ADM-028 — Candidate.status no tiene ciclo de vida: se pone 'in_process' al inyectar y nunca pasa a 'hired' ni vuelve a 'available'

- **Severidad:** 🟡 medium · **Categoría:** correctness · **Estado:** nuevo · **Verificación:** sin verificar (reportada por 1 auditor)
- **Ubicación:** `src/app/api/admin/assign-candidates/route.ts:107` · relacionados: `prisma/schema.prisma`, `src/app/api/company/applications/[id]/route.ts`, `src/app/admin/candidates/page.tsx`
- **Problema:** El schema define available/in_process/hired/inactive. El unico codigo que lo cambia es la inyeccion del admin (-> in_process). Cuando la empresa acepta al candidato (Application 'accepted') o cuando se descarta/rechaza/cierra la vacante, nadie actualiza Candidate.status. 'hired' no se escribe en ningun lugar del codigo (solo edicion manual).
- **Evidencia:**

```ts
// src/app/api/admin/assign-candidates/route.ts:106-114
    // Actualizar el status de los candidatos a "in_process"
    await prisma.candidate.updateMany({
      where: { id: { in: candidatesToAssign.map(c => c.id) } },
      data: { status: 'in_process' }
    });
// src/app/api/company/applications/[id]/route.ts:184-186 (al aceptar solo se dispara el webhook)
    if (status === 'accepted') {
      void dispatchCandidateAccepted(applicationId);
    }
```

- **Escenario de fallo:** El admin inyecta a un candidato en una vacante; el reclutador lo descarta al dia siguiente. El candidato queda 'En Proceso' para siempre en el Banco de Candidatos, y las tarjetas de /admin/candidates muestran 'Contratado: 0' aunque haya 10 contrataciones (Application accepted), porque nada escribe 'hired'. El admin filtra por 'Disponible' para cubrir otra vacante y no encuentra a candidatos que en realidad estan libres.
- **Arreglo propuesto:** Centralizar en un helper (p. ej. syncCandidateStatus(email|candidateId)) que recalcule el estado tras cada cambio de Application: 'hired' si tiene alguna 'accepted', 'in_process' si tiene alguna activa, 'available' en otro caso; invocarlo desde company/applications PATCH, applications/[id] PUT, recruiter/specialist dashboard y assign-candidates. Alternativa: eliminar la columna y derivar el estado por consulta.

#### ADM-029 — Filtros y estadisticas de asignaciones incoherentes con los badges: una vacante con solo reclutador no cae en ningun filtro

- **Severidad:** 🟡 medium · **Categoría:** correctness · **Estado:** nuevo · **Verificación:** sin verificar (reportada por 2 auditores)
- **Ubicación:** `src/app/api/admin/assignments/route.ts:77` · relacionados: `src/app/admin/assignments/page.tsx`
- **Problema:** 'unassigned' significa que no existe fila JobAssignment; 'assigned' exige reclutador Y especialista. Una asignacion parcial (permitida por la UI) no aparece en "Sin Asignar" ni en "Asignadas" aunque su badge diga "Asignado". 'in_progress' ignora `recruiterStatus === 'sent_to_specialist'` (badge "Con Especialista"). 'assigned' se solapa con en proceso y completadas, por lo que las tarjetas no suman el total.
- **Evidencia:**

```ts
    if (status === 'unassigned') {
      filteredJobs = jobs.filter((j) => !j.assignment);
    } else if (status === 'assigned') {
      filteredJobs = jobs.filter(
        (j) =>
          j.assignment && j.assignment.recruiterId && j.assignment.specialistId
      );
    } else if (status === 'in_progress') {
      filteredJobs = jobs.filter(
        (j) =>
          j.assignment &&
          (j.assignment.recruiterStatus === 'reviewing' ||
            j.assignment.specialistStatus === 'evaluating')
```

- **Escenario de fallo:** Admin asigna solo reclutador a 8 vacantes por falta de especialistas. Una semana despues filtra "Sin Asignar" para completar equipos: no aparecen; en "Asignadas" tampoco. Solo las encuentra revisando "Todas" fila por fila.
- **Arreglo propuesto:** Definir estados excluyentes derivados en un solo helper compartido por filtro, stats y badge: sin_asignar (sin fila o ambos null), parcial (falta uno), asignada (ambos y todo pending), en_proceso (reviewing | sent_to_specialist | evaluating), completada. Anadir el filtro "Incompletas".
- **Otros auditores añaden:** Definir estados exhaustivos: unassigned = sin fila o sin ningun id; partial = exactamente uno; assigned = ambos. Anadir 'partial' a filtros, stats y UI. Incluir `recruiterStatus === 'sent_to_specialist'` en in_progress. Mover el filtrado al `where` de Prisma.

#### ADM-030 — Reclutadores y especialistas no pueden agregar documentos: el handler los permite pero el middleware bloquea /api/admin/* a todo rol que no sea admin

- **Severidad:** 🟡 medium · **Categoría:** authz · **Estado:** nuevo · **Verificación:** sin verificar (reportada por 1 auditor)
- **Ubicación:** `src/app/api/admin/candidates/[id]/documents/route.ts:67` · relacionados: `src/middleware.ts`, `src/components/shared/CandidateProfileModal.tsx`, `src/app/recruiter/jobs/[jobId]/page.tsx`, `src/app/specialist/jobs/[jobId]/page.tsx`
- **Problema:** Los tres handlers (GET/POST/DELETE) declaran requireRole(['admin','recruiter','specialist']), pero src/middleware.ts marca como isAdminRoute todo lo que empieza por /api/admin/ y responde 403 si payload.role !== 'admin'. CandidateProfileModal hace POST a esta ruta y las paginas de reclutador y especialista lo abren con canAddDocuments={true}. El archivo si se sube antes a /api/upload (POST publico), por lo que cada intento deja un blob huerfano. Ojo al arreglar: el handler no tiene control de pertenencia, si se abre la ruta tal cual cualquier reclutador/especialista podria leer, crear o borrar documentos de CUALQUIER candidato por ID (IDOR).
- **Evidencia:**

```ts
const auth = await requireRole(['admin', 'recruiter', 'specialist']);
// src/middleware.ts:84-88
pathname.startsWith('/api/admin/') ||
...
if (isAdminRoute && payload.role !== 'admin') {
// src/components/shared/CandidateProfileModal.tsx:653
const docResponse = await fetch(`/api/admin/candidates/${candidateId}/documents`, {
// src/app/recruiter/jobs/[jobId]/page.tsx:757
canAddDocuments={true}
```

- **Escenario de fallo:** Un reclutador abre el perfil de un candidato en /recruiter/jobs/12, pulsa 'Agregar' documento, elige un PDF. El PDF se sube a Vercel Blob (queda publico y huerfano) y a continuacion el POST devuelve 403 'No tienes permisos de administrador para acceder a este recurso.'. El documento nunca queda ligado al candidato. Lo mismo para el especialista.
- **Arreglo propuesto:** Crear una ruta fuera de /api/admin (p. ej. /api/candidates/[id]/documents) protegida con requireRole(['admin','recruiter','specialist']) y que ademas verifique que el candidato tiene una Application en una vacante asignada al usuario (reutilizar canAccessJob de src/lib/authz-applications.ts); apuntar CandidateProfileModal a esa ruta. Dejar la ruta admin solo con requireRole('admin'). Subir el archivo solo despues de validar permisos, o borrar el blob si el segundo paso falla.

#### ADM-031 — PUT de candidato descarta en silencio fotoUrl, cartaPresentacion y documents que el formulario envia; POST descarta cartaPresentacion

- **Severidad:** 🟡 medium · **Categoría:** correctness · **Estado:** nuevo · **Verificación:** sin verificar (reportada por 2 auditores)
- **Ubicación:** `src/app/api/admin/candidates/[id]/route.ts:149` · relacionados: `src/components/sections/admin/CandidateForm.tsx`, `src/app/api/admin/candidates/route.ts`
- **Problema:** CandidateForm envia en crear y en editar: fotoUrl, cartaPresentacion y documents (pestana 'Documentos'). El PUT solo desestructura nombre, apellidos, email, telefono, sexo, fechaNacimiento, universidad, carrera, nivelEstudios, educacion, profile, subcategory, seniority, cvUrl, portafolioUrl, linkedinUrl, source, notas, status y experiences; el resto se ignora y aun asi responde 'Candidato actualizado exitosamente'. El POST (route.ts:182-205) acepta fotoUrl y documents pero no cartaPresentacion ni subcategory/ciudad/estado. La carta se anuncia en la UI como 'Visible para empresas que revisen el perfil' y el pipeline la devuelve, pero desde admin nunca se guarda.
- **Evidencia:**

```ts
const {
  nombre, apellidoPaterno, apellidoMaterno, email, telefono, sexo,
  fechaNacimiento, universidad, carrera, nivelEstudios,
  educacion, // FEATURE: Educación múltiple (array)
  profile, subcategory, seniority, cvUrl, portafolioUrl, linkedinUrl,
  source, notas, status,
  experiences // Array de experiencias (opcional)
} = body;
// CandidateForm.tsx:464,474,478
fotoUrl: fotoUrl || null,
cartaPresentacion: cartaPresentacion || null,
documents: documents.filter(...)
```

- **Escenario de fallo:** El admin edita un candidato, cambia la foto, escribe la carta de presentacion y agrega un titulo en la pestana Documentos, pulsa 'Actualizar': ve exito y el modal se cierra, pero al reabrir no hay foto nueva, ni carta, ni documento. Al crear un candidato nuevo la carta tambien se pierde.
- **Arreglo propuesto:** En PUT anadir fotoUrl, cartaPresentacion, ciudad, estado, ubicacionCercana al destructuring y a updateData; sincronizar documents (crear los que no traen id, borrar los ausentes) dentro de la misma transaccion, o quitar la pestana Documentos del modo edicion y remitir al modal de vista. En POST anadir cartaPresentacion y subcategory.
- **Otros auditores añaden:** En PUT agregar manejo de `fotoUrl` (`if (fotoUrl !== undefined) updateData.fotoUrl = fotoUrl || null;`) y de `documents` con una estrategia clara (p.ej. borrar y recrear como se hace con experiences, o upsert por id), replicando lo que hace POST.

#### ADM-032 — PUT de candidato acepta nombre, apellido y email vacios (y status/email sin validar); el boton Guardar del formulario esta fuera del <form> y salta los required

- **Severidad:** 🟡 medium · **Categoría:** validation · **Estado:** nuevo · **Verificación:** sin verificar (reportada por 1 auditor)
- **Ubicación:** `src/app/api/admin/candidates/[id]/route.ts:193` · relacionados: `src/components/sections/admin/CandidateForm.tsx`, `src/app/api/admin/candidates/route.ts`
- **Problema:** POST exige nombre, apellidoPaterno y email, pero PUT solo comprueba !== undefined. Un string vacio pasa: la comprobacion de unicidad se salta porque `email &&` es falso y luego se guarda ''. status admite cualquier string y email no se valida como email en ninguno de los dos metodos (en POST con password se crea un User con ese 'email'). En la UI, el boton del footer de CandidateForm (linea 1506) esta fuera del <form> y llama a handleSubmit por onClick, asi que los atributos required/type=email nunca se evaluan.
- **Evidencia:**

```ts
if (nombre !== undefined) updateData.nombre = nombre;
if (apellidoPaterno !== undefined) updateData.apellidoPaterno = apellidoPaterno;
if (apellidoMaterno !== undefined) updateData.apellidoMaterno = apellidoMaterno || null;
if (email !== undefined) updateData.email = email.toLowerCase();
...
if (status !== undefined) updateData.status = status;
```

- **Escenario de fallo:** El admin edita un candidato, borra por error el campo email y pulsa 'Actualizar': no hay validacion de navegador, el PUT guarda email=''. El candidato pierde el vinculo con sus postulaciones; al repetirse con un segundo candidato la restriccion unique de '' hace que el PUT devuelva 500 'Error al actualizar candidato' sin explicacion.
- **Arreglo propuesto:** Validar el body de PUT y POST con un esquema zod compartido (nombre/apellidoPaterno min 2, email z.string().email() con trim, status en ['available','in_process','hired','inactive'], sexo en enum, URLs http(s)). En CandidateForm dar al boton type='submit' y form='<id del form>' (o moverlo dentro del form) para recuperar la validacion nativa.

#### ADM-033 — Application y Candidate se unen por email (string): cambiar el email de un candidato rompe el vinculo con todas sus postulaciones

- **Severidad:** 🟡 medium · **Categoría:** data-integrity · **Estado:** nuevo · **Verificación:** sin verificar (reportada por 2 auditores)
- **Ubicación:** `src/app/api/admin/candidates/[id]/route.ts:196` · relacionados: `src/app/api/candidate/applications/route.ts`, `src/app/api/recruiter/dashboard/route.ts`, `prisma/schema.prisma`
- **Problema:** No existe Application.candidateId; las 8 rutas de dashboards/pipeline resuelven el perfil del candidato con Candidate.email = Application.candidateEmail. El PUT de admin permite cambiar Candidate.email sin actualizar Application.candidateEmail, de modo que las aplicaciones existentes quedan sin perfil (candidateProfile: null) en recruiter, specialist, company y pipeline, y GET /api/candidate/applications (que busca por candidate.email) deja de listar las postulaciones previas del candidato.
- **Evidencia:**

```ts
// admin/candidates/[id]/route.ts:196
if (email !== undefined) updateData.email = email.toLowerCase();
// candidate/applications/route.ts:68
const applications = await prisma.application.findMany({
  where: { candidateEmail: candidate.email.toLowerCase() },
// recruiter/dashboard/route.ts:135
candidateProfile: candidateMap.get(app.candidateEmail.toLowerCase()) || null
```

- **Escenario de fallo:** El admin corrige un typo en el email de una candidata que ya esta en 'sent_to_company' para 3 vacantes. Desde ese momento la empresa y el especialista ven sus aplicaciones sin foto, CV, experiencia ni educacion (perfil null), y la candidata entra a /candidate/applications y ve 'no tienes postulaciones'.
- **Arreglo propuesto:** Corto plazo: en el PUT, dentro de una transaccion, ejecutar application.updateMany({ where:{ candidateEmail: emailAnterior }, data:{ candidateEmail: emailNuevo } }) (y actualizar User.email si hay cuenta vinculada). Mediano plazo: agregar Application.candidateId Int? con FK a Candidate, poblarlo por migracion de datos y usarlo en los joins en lugar del email.
- **Otros auditores añaden:** En una transaccion: si cambia el email, comprobar unicidad tambien en User, actualizar User.email del usuario vinculado y hacer application.updateMany({ where: { candidateEmail: viejo }, data: { candidateEmail: nuevo } }). A medio plazo anadir Application.candidateId como FK y dejar de enlazar por email.

#### ADM-034 — PUT de candidato reemplaza las experiencias sin transaccion: un fallo posterior borra todo el historial laboral

- **Severidad:** 🟡 medium · **Categoría:** data-integrity · **Estado:** nuevo · **Verificación:** sin verificar (reportada por 1 auditor)
- **Ubicación:** `src/app/api/admin/candidates/[id]/route.ts:231` · relacionados: `src/app/api/auth/register/route.ts`
- **Problema:** Si body.experiences !== undefined se ejecuta experience.deleteMany, luego createMany y despues candidate.update, tres operaciones independientes. No se valida que experiences sea un array ni que fechaInicio/empresa/puesto sean validos. Cualquier excepcion despues del deleteMany (fecha invalida -> Invalid Date, campo requerido undefined, experiences=null -> null.length, email duplicado por carrera en candidate.update, timeout de conexion en serverless) deja al candidato sin experiencias y con añosExperiencia desactualizado, y la API responde 500 generico.
- **Evidencia:**

```ts
if (experiences !== undefined) {
  // Eliminar experiencias existentes
  await prisma.experience.deleteMany({
    where: { candidateId }
  });
  // Crear nuevas experiencias
  if (experiences.length > 0) {
    await prisma.experience.createMany({
      data: experiences.map((exp: any) => ({
        candidateId,
        empresa: exp.empresa,
```

- **Escenario de fallo:** PUT /api/admin/candidates/7 con experiences:[{empresa:'X', puesto:'Y', fechaInicio:'31/12/2020'}] -> deleteMany borra las 5 experiencias reales, new Date('31/12/2020') es Invalid Date, createMany lanza, respuesta 500. El candidato queda con 0 experiencias. Mismo resultado con experiences:null o con un corte de conexion entre ambas consultas.
- **Arreglo propuesto:** Validar el body con zod (array de objetos, fechas parseables, strings no vacios) ANTES de tocar la BD y envolver deleteMany + createMany + candidate.update en prisma.$transaction, igual que hace /api/auth/register.

#### ADM-035 — Eliminar un Candidate desde el admin deja huerfana su cuenta User: puede iniciar sesion sin perfil y no puede volver a registrarse

- **Severidad:** 🟡 medium · **Categoría:** data-integrity · **Estado:** nuevo · **Verificación:** sin verificar (reportada por 2 auditores)
- **Ubicación:** `src/app/api/admin/candidates/[id]/route.ts:337` · relacionados: `prisma/schema.prisma`, `src/app/api/candidate/applications/route.ts`, `src/app/api/auth/register/route.ts`
- **Problema:** La relacion esta modelada con la FK en Candidate.userId (onDelete: SetNull), asi que borrar el Candidate no toca al User. El handler solo borra el Candidate. El User queda activo con role='candidate'; ademas las Application siguen existiendo enlazadas por candidateEmail pero ya sin perfil.
- **Evidencia:**

```ts
    // Eliminar candidato (las experiencias y documentos se eliminan por cascade)
    await prisma.candidate.delete({
      where: { id: candidateId }
    });
// prisma/schema.prisma:466-467
  userId          Int?      @unique
  user            User?     @relation(fields: [userId], references: [id], onDelete: SetNull)
```

- **Escenario de fallo:** El admin elimina desde /admin/candidates a un candidato que se registro por si mismo. El candidato inicia sesion con normalidad, pero GET /api/candidate/applications responde 404 'No tienes un perfil de candidato asociado' y su perfil aparece vacio. Si intenta registrarse de nuevo, POST /api/auth/register responde 409 'Este email ya está registrado' porque el User sigue existiendo. En los dashboards de reclutador/especialista/empresa sus postulaciones quedan con candidateProfile: null.
- **Arreglo propuesto:** En DELETE usar una transaccion: si candidate.userId existe, desactivar (isActive=false) o eliminar tambien el User, y decidir que pasa con sus Application (archivarlas). Mejor aun: soft delete de Candidate (status 'inactive') y reservar el hard delete para solicitudes ARCO con un procedimiento que limpie User + Application + blobs.
- **Otros auditores añaden:** En una transaccion: si candidate.userId existe y el User tiene role='candidate', desactivarlo o borrarlo junto con el candidato; decidir explicitamente que hacer con las Application (anonimizar o impedir el borrado si hay procesos activos) y avisarlo en el confirm. Alternativamente, en POST y en reset-password re-vincular un User huerfano (role candidate, sin Candidate) en vez de devolver 409.

#### ADM-036 — La busqueda de candidatos no encuentra nombres completos ni ignora acentos

- **Severidad:** 🟡 medium · **Categoría:** correctness · **Estado:** nuevo · **Verificación:** sin verificar (reportada por 1 auditor)
- **Ubicación:** `src/app/api/admin/candidates/route.ts:43` · relacionados: `src/app/api/admin/users/route.ts`, `src/app/admin/assign-candidates/page.tsx`
- **Problema:** El termino completo se compara con `contains` contra cada columna por separado (nombre, apellidoPaterno, apellidoMaterno, email, carrera). 'Juan Pérez' no esta contenido en ninguna columna individual, asi que devuelve 0 resultados; mode:'insensitive' solo ignora mayusculas, no acentos ('perez' no encuentra 'Pérez'). Como la lista esta limitada a 30, la busqueda es la unica via para llegar a candidatos antiguos. El mismo patron esta en /api/admin/users (lineas 45-51).
- **Evidencia:**

```ts
if (search) {
  where.OR = [
    { nombre: { contains: search, mode: 'insensitive' } },
    { apellidoPaterno: { contains: search, mode: 'insensitive' } },
    { apellidoMaterno: { contains: search, mode: 'insensitive' } },
    { email: { contains: search, mode: 'insensitive' } },
    { carrera: { contains: search, mode: 'insensitive' } }
  ];
}
```

- **Escenario de fallo:** El admin escribe 'Maria Lopez' en 'Buscar por nombre, email, carrera...' para asignarla a una vacante: 'No hay candidatos registrados', aunque María López existe.
- **Arreglo propuesto:** Dividir search por espacios y exigir que cada token aparezca en alguna columna: where.AND = tokens.map(t => ({ OR: [...columnas contains t] })). Para acentos, usar la extension unaccent con una columna normalizada (searchText) o una consulta raw.

#### ADM-037 — POST de candidato con contrasena crea el User fuera de transaccion: si falla la creacion del Candidate queda un User huerfano que bloquea el email

- **Severidad:** 🟡 medium · **Categoría:** data-integrity · **Estado:** nuevo · **Verificación:** sin verificar (reportada por 1 auditor)
- **Ubicación:** `src/app/api/admin/candidates/route.ts:262` · relacionados: `src/app/api/admin/candidates/[id]/reset-password/route.ts`, `src/app/api/auth/register/route.ts`
- **Problema:** Cuando viene password se hace prisma.user.create y, bastante despues, prisma.candidate.create con experiencias y documentos anidados sin validar. Si el segundo create falla (fecha de experiencia invalida -> añosExperiencia NaN, documento sin name, carrera de unicidad, error transitorio de BD) el User ya existe. El registro publico (/api/auth/register) si usa $transaction para exactamente este par. El mismo patron no atomico esta en reset-password/route.ts:95-111 (user.create + candidate.update).
- **Evidencia:**

```ts
const newUser = await prisma.user.create({
  data: {
    email: email.toLowerCase(),
    password: hashedPassword,
    ...
    role: 'candidate',
    isActive: true
  }
});
userId = newUser.id;
...
const candidate = await prisma.candidate.create({
```

- **Escenario de fallo:** POST con password valido y experiences:[{empresa:'A', puesto:'B', fechaInicio:'no-fecha'}]: se crea el User, candidate.create lanza y devuelve 500 'Error al crear candidato'. El admin corrige y reintenta: ahora recibe 409 'Ya existe un usuario con ese email' y no puede crear al candidato con cuenta; si lo crea sin contrasena, 'Crear cuenta de acceso' tambien da 409.
- **Arreglo propuesto:** Validar todo el body antes de escribir y envolver user.create + candidate.create en prisma.$transaction (mismo patron que src/app/api/auth/register/route.ts:198). Hacer lo mismo en reset-password para user.create + candidate.update. Mapear P2002 a 409.

#### ADM-038 — El admin puede crear/editar paquetes con cualquier cantidad de creditos, pero la compra solo acepta pack_1/10/15/20

- **Severidad:** 🟡 medium · **Categoría:** payments · **Estado:** nuevo · **Verificación:** sin verificar (reportada por 3 auditores)
- **Ubicación:** `src/app/api/admin/credit-packages/route.ts:73` · relacionados: `src/app/api/credits/purchases/route.ts`, `src/app/api/admin/credit-packages/[id]/route.ts`, `src/app/credits/purchase/page.tsx`
- **Problema:** La validacion admin solo exige credits > 0 y el formulario permite cualquier entero. El endpoint de compra tiene una whitelist hardcodeada PACKAGE_CREDITS {pack_1, pack_10, pack_15, pack_20}: cualquier otro tamano devuelve 400 'Tipo de paquete inválido', y si el admin cambia los creditos de un paquete existente, el tamano original deja de existir en BD y la compra falla con 'Paquete no disponible'.
- **Evidencia:**

```ts
// src/app/api/admin/credit-packages/route.ts
    if (credits <= 0) {
      return NextResponse.json(
        { success: false, error: 'La cantidad de créditos debe ser mayor a 0' },

// src/app/api/credits/purchases/route.ts
const PACKAGE_CREDITS: Record<string, number> = {
  pack_1: 1,
  pack_10: 10,
  pack_15: 15,
  pack_20: 20
};
...
    if (!credits) {
```

- **Escenario de fallo:** El admin edita 'Pack 15' y lo deja en 12 creditos. La empresa (que ve los paquetes por defecto) elige '15 créditos $50,000', llena los datos de tarjeta y al enviar recibe 400 'Paquete no disponible. Contacta al administrador.' Venta perdida. Cuando se corrija la carga de paquetes, un 'Pack 5' o 'Pack 50' creado por el admin fallara con 'Tipo de paquete inválido'.
- **Arreglo propuesto:** Eliminar PACKAGE_CREDITS y resolver el paquete por packageId (la UI ya lo envia); packageType puede derivarse como `pack_${pkg.credits}` solo para registro. Mientras tanto, restringir credits en el admin a los valores soportados.
- **Otros auditores añaden:** En purchases/route.ts resolver el paquete por id: `prisma.creditPackage.findFirst({ where: { id: Number(packageId), isActive: true } })` y eliminar PACKAGE_CREDITS. Mientras no se haga, en POST/PUT admin rechazar con 409 un segundo paquete activo con la misma cantidad de creditos. — En /api/credits/purchases buscar por id: findFirst({ where: { id: packageId, isActive: true } }) y derivar credits/price de esa fila. En POST/PUT admin rechazar con 409 si ya existe otro paquete activo con los mismos credits (o indice unico parcial sobre credits WHERE isActive).

#### ADM-039 — PUT de postulaciones directas no comprueba que la aplicacion siga en 'pending': pisa estados avanzados y no marca reviewedAt

- **Severidad:** 🟡 medium · **Categoría:** correctness · **Estado:** nuevo · **Verificación:** sin verificar (reportada por 1 auditor)
- **Ubicación:** `src/app/api/admin/direct-applications/route.ts:134` · relacionados: `src/app/api/recruiter/dashboard/route.ts`, `src/app/api/applications/[id]/route.ts`, `src/app/admin/direct-applications/page.tsx`
- **Problema:** El endpoint solo valida que newStatus sea reviewing/discarded/archived; no mira existingApplication.status. El dashboard del reclutador tambien procesa aplicaciones 'pending' y tiene maquina de estados (recruiter/dashboard/route.ts:344-347), por lo que ambos flujos compiten. Ademas, a diferencia de /api/applications/[id] (linea 411-412), no fija reviewedAt al pasar a 'reviewing', y applicationId no se valida como entero (un string provoca 500 de Prisma).
- **Evidencia:**

```ts
const existingApplication = await prisma.application.findUnique({
  where: { id: applicationId }
});
if (!existingApplication) { ... 404 ... }
// Actualizar el status
const updatedApplication = await prisma.application.update({
  where: { id: applicationId },
  data: {
    status: newStatus,
    updatedAt: new Date()
  },
```

- **Escenario de fallo:** El admin tiene abierta /admin/direct-applications. Mientras tanto el reclutador mueve la aplicacion 40 a reviewing y luego a sent_to_specialist (queda en candidatesSentToSpecialist). El admin, con la lista desactualizada, pulsa 'Descartar': la aplicacion pasa a 'discarded' aunque el especialista ya la esta evaluando, y JobAssignment queda inconsistente. En 'Mis postulaciones' del candidato nunca aparece la fecha 'Revisado' para las que pasan por este flujo.
- **Arreglo propuesto:** Hacer el cambio condicional y atomico: prisma.application.updateMany({ where: { id, status: 'pending' }, data: { status: newStatus, ...(newStatus === 'reviewing' && { reviewedAt: new Date() }) } }) y devolver 409 si count === 0. Validar Number.isInteger(applicationId).

#### ADM-040 — meetingUrl y demas campos de la entrevista sin validacion: una liga sin https:// se sirve a la empresa como enlace relativo roto

- **Severidad:** 🟡 medium · **Categoría:** validation · **Estado:** nuevo · **Verificación:** sin verificar (reportada por 1 auditor)
- **Ubicación:** `src/app/api/admin/interviews/[id]/route.ts:160` · relacionados: `src/app/company/interviews/page.tsx`, `src/app/admin/interviews/page.tsx`
- **Problema:** topic, location, meetingUrl, confirmedSlot, participants y adminNotes se guardan tal cual, sin tipo, longitud ni esquema. `meetingUrl` se renderiza como `href` en src/app/company/interviews/page.tsx:266 y src/app/admin/interviews/page.tsx:372. El input del modal es type="url" pero no esta dentro de un <form>, asi que no hay validacion del navegador. Un valor no-string hace que Prisma lance y se responda 500.
- **Evidencia:**

```ts
    if (location !== undefined) updateData.location = location;
    if (meetingUrl !== undefined) updateData.meetingUrl = meetingUrl;
    if (confirmedSlot !== undefined) updateData.confirmedSlot = confirmedSlot;
    if (participants !== undefined) updateData.participants = participants;
    if (adminNotes !== undefined) updateData.adminNotes = adminNotes;
```

- **Escenario de fallo:** El admin pega 'meet.google.com/abc-defg-hij' y confirma. En /company/interviews el boton de unirse apunta a /company/meet.google.com/abc-defg-hij (404) a la hora de la entrevista. PATCH {participants:[{...}]} (array en vez de string JSON) -> 500.
- **Arreglo propuesto:** Validar con zod: meetingUrl `z.string().url()` con protocolo http/https o null; topic/location con max; participants como string JSON de [{nombre,email}] o array serializado en servidor; adminNotes con max. Responder 400 con mensaje claro.

#### ADM-041 — Confirmar, reagendar o cancelar una entrevista no notifica a nadie; los participantes capturados nunca se usan

- **Severidad:** 🟡 medium · **Categoría:** correctness · **Estado:** nuevo · **Verificación:** sin verificar (reportada por 3 auditores)
- **Ubicación:** `src/app/api/admin/interviews/[id]/route.ts:167` · relacionados: `src/lib/notifications.ts`, `src/lib/email.ts`, `src/components/company/InterviewRequestModal.tsx`
- **Problema:** El PATCH solo actualiza BD. No crea Notification para la empresa (`existing.requestedById`), no envia correo al candidato ni a los `participants` (nombre+email) que el admin captura en el modal. En src/lib solo existe `sendInterviewRequestToAdmin`; `participants` no se usa en ningun envio. El modal de empresa promete que INAKAT "coordinara los horarios con el candidato".
- **Evidencia:**

```ts
    if (status === 'confirmed') {
      ...
      updateData.confirmedAt = new Date();
      updateData.confirmedById = auth.user.id;

      // Update the related application status to 'interviewed'
      await prisma.application.update({
        where: { id: existing.applicationId },
        data: { status: 'interviewed' },
      });
    }

    // For 'cancelled' status, we intentionally do NOT update the Application status
```

- **Escenario de fallo:** Admin confirma la entrevista para manana 10:00 con liga de Meet y 3 participantes. La empresa no recibe notificacion ni correo (solo lo ve si entra a /company/interviews por su cuenta); el candidato y los participantes no reciben nada. Si despues el admin cambia la hora con "Guardar Cambios", tampoco se avisa.
- **Arreglo propuesto:** Tras el update, con `await Promise.allSettled([...])`: createNotification a `existing.requestedById` (nuevos tipos 'interview_confirmed' / 'interview_cancelled' / 'interview_rescheduled' en NotificationType, NotificationBell y notifications/page) y correo a empresa, candidato (`application.candidateEmail`) y participantes con fecha, lugar o liga.
- **Otros auditores añaden:** Usar `prisma.$transaction`. Solo promover si el estado lo permite: `tx.application.updateMany({ where: { id, status: { in: ['sent_to_company','company_interested'] } }, data: { status: 'interviewed' } })`; si esta 'accepted'/'rejected' devolver 409 o confirmar sin tocar la aplicacion. No repetir la promocion si `existing.status` ya era 'confirmed'. — Envolver ambos updates en `prisma.$transaction` y cambiar el status solo si el actual esta en una lista permitida (p. ej. 'sent_to_company', 'company_interested'); en otro caso responder 409 explicando el estado.

#### ADM-042 — Confirmar o cancelar una entrevista no notifica a la empresa ni al candidato (flujo a medias)

- **Severidad:** 🟡 medium · **Categoría:** ux · **Estado:** nuevo · **Verificación:** sin verificar (reportada por 1 auditor)
- **Ubicación:** `src/app/api/admin/interviews/[id]/route.ts:190` · relacionados: `src/lib/notifications.ts`, `src/lib/email.ts`
- **Problema:** El PATCH no envia email ni crea notificacion in-app. src/lib/notifications.ts solo define 'interview_requested' (no hay tipo para confirmada/cancelada) y src/lib/email.ts solo exporta `sendInterviewRequestToAdmin`. El aviso existe en el sentido empresa->admin pero no en el contrario.
- **Evidencia:**

```ts
    // For 'cancelled' status, we intentionally do NOT update the Application status

    const interview = await prisma.interviewRequest.update({
      where: { id: interviewId },
      data: updateData,
      include: interviewInclude,
    });

    return NextResponse.json({ interview });
```

- **Escenario de fallo:** El admin agenda la entrevista para manana a las 10:00 con liga de Meet. Ni la empresa ni el candidato reciben nada; la empresa solo se entera si abre /company/interviews y el candidato no tiene donde verlo. La entrevista no ocurre salvo que el admin avise por fuera del sistema.
- **Arreglo propuesto:** Tras el update, `await Promise.allSettled([...])` con createNotification a `existing.requestedById` (nuevos tipos 'interview_confirmed'/'interview_cancelled'), email a la empresa y al `application.candidateEmail` con fecha, lugar o liga y participantes; anadir las plantillas en src/lib/email.ts.

#### ADM-043 — El admin solo ve las 20 solicitudes de entrevista mas recientes: la API pagina por defecto y la UI no pagina

- **Severidad:** 🟡 medium · **Categoría:** ux · **Estado:** nuevo · **Verificación:** sin verificar (reportada por 1 auditor)
- **Ubicación:** `src/app/api/admin/interviews/route.ts:14` · relacionados: `src/app/admin/interviews/page.tsx`
- **Problema:** El GET aplica `limit` 20 por defecto ordenando por createdAt desc. src/app/admin/interviews/page.tsx:100 llama sin parametros, ignora `pagination` y calcula pestanas y contadores en cliente sobre esas 20 filas. Ademas `parseInt('abc')` da NaN y `Math.max(1, NaN)` es NaN, por lo que ?page=abc produce skip NaN y un 500.
- **Evidencia:**

```ts
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const limit = Math.max(1, Math.min(100, parseInt(searchParams.get('limit') || '20', 10)));
    const skip = (page - 1) * limit;
// UI (admin/interviews/page.tsx:100):
      const res = await fetch('/api/admin/interviews');
```

- **Escenario de fallo:** Con 25 solicitudes en total, las 5 mas antiguas no aparecen en ninguna pestana aunque sigan 'pending'. El contador 'Pendientes' es incorrecto y esas entrevistas nunca se agendan; la empresa tampoco puede volver a solicitarlas porque ya existe una pendiente.
- **Arreglo propuesto:** En la UI pedir por pestana con `?status=...&page=N` y anadir paginacion, o anadir al endpoint los conteos globales por estado y permitir `limit` suficiente. Sanear con `Number.isFinite` antes de Math.max para responder 400 en vez de 500.

#### ADM-044 — Desactivar o eliminar una entrada de precios no bloquea la combinacion: la vacante pasa a costar 5 creditos por defecto

- **Severidad:** 🟡 medium · **Categoría:** payments · **Estado:** nuevo · **Verificación:** sin verificar (reportada por 1 auditor)
- **Ubicación:** `src/app/api/admin/pricing/route.ts:145` · relacionados: `src/lib/pricing.ts`, `src/app/api/jobs/publish/route.ts`, `src/app/api/pricing/calculate/route.ts`
- **Problema:** El PUT permite `isActive: false` y el DELETE borra la fila si no hay vacantes existentes. Pero `calculateJobCreditCost` (src/lib/pricing.ts:28-35 y 73-74) filtra `isActive: true` y, si no encuentra fila, devuelve DEFAULT_CREDITS = 5 con `found: false`; src/app/api/jobs/publish/route.ts:165-169 usa `pricingResult.credits` sin mirar `found`. El toggle 'Activo/Inactivo' en realidad cambia el precio a 5.
- **Evidencia:**

```ts
    const updateData: { credits?: number; isActive?: boolean; minSalary?: number | null } = {};
    if (credits !== undefined) updateData.credits = credits;
    if (isActive !== undefined) updateData.isActive = isActive;
    if (minSalary !== undefined) updateData.minSalary = minSalary;
// src/lib/pricing.ts:73-74
  // No se encontró precio, usar valor por defecto
  return { credits: DEFAULT_CREDITS, found: false };
```

- **Escenario de fallo:** El admin desactiva 'Tecnologia / Director / remote' (12 creditos) para dejar de ofrecerla. Una empresa publica esa combinacion: /api/pricing/calculate responde 5 creditos y /api/jobs/publish descuenta 5 en lugar de 12. Tambien desaparece la validacion de minSalary de esa fila. Al reves, desactivar 'Jr presencial' (4) la encarece a 5.
- **Arreglo propuesto:** Decidir la semantica: si una combinacion inactiva no debe publicarse, en jobs/publish, jobs y jobs/[id] rechazar con 400 cuando `found === false`. Si el default es intencional, hacerlo configurable y advertirlo en la UI al desactivar/eliminar. Como minimo el DELETE/PUT admin debe informar del efecto.

#### ADM-045 — Eliminar una entrada es irreversible: POST esta deshabilitado y /api/admin/pricing/sync no tiene ninguna UI que lo invoque

- **Severidad:** 🟡 medium · **Categoría:** dead-code · **Estado:** nuevo · **Verificación:** sin verificar (reportada por 1 auditor)
- **Ubicación:** `src/app/api/admin/pricing/sync/route.ts:75` · relacionados: `src/app/api/admin/pricing/route.ts`, `src/app/admin/pricing/page.tsx`
- **Problema:** La pagina permite borrar filas de la matriz ('Esta acción no se puede deshacer'). POST /api/admin/pricing devuelve 403 ('creación manual deshabilitada') y el unico mecanismo de regeneracion, GET/POST /api/admin/pricing/sync, no es llamado desde ningun archivo de src (la unica coincidencia de 'pricing/sync' es el propio route). Funcionalidad a medias: endpoint huerfano.
- **Evidencia:**

```ts
// src/app/api/admin/pricing/route.ts
export async function POST() {
  return NextResponse.json(
    {
      success: false,
      error: 'La creación manual de precios está deshabilitada. Los precios se generan automáticamente al crear especialidades.'
    },
    { status: 403 }

// src/app/api/admin/pricing/sync/route.ts
/**
 * POST /api/admin/pricing/sync
 * Generar precios faltantes para especialidades existentes
 */
```

- **Escenario de fallo:** El admin elimina por error 'Tecnología / Sr / Remoto' (10 creditos). No existe boton para recrearla ni para sincronizar; desde entonces esas vacantes cuestan el default de 5 creditos y pierden su minSalary. La unica solucion es insertar la fila a mano en la BD o llamar al endpoint con curl.
- **Arreglo propuesto:** Agregar en /admin/pricing un boton 'Sincronizar precios faltantes' que llame a GET sync (mostrar faltantes) y POST sync; o sustituir el borrado fisico por desactivacion. Si sync no se va a usar, eliminarlo.

#### ADM-046 — Renombrar una especialidad no es atomico y no valida el slug: un fallo deja la matriz de precios huerfana bajo el nombre nuevo

- **Severidad:** 🟡 medium · **Categoría:** data-integrity · **Estado:** nuevo · **Verificación:** sin verificar (reportada por 1 auditor)
- **Ubicación:** `src/app/api/admin/specialties/[id]/route.ts:122` · relacionados: `src/lib/pricing.ts`, `src/app/api/admin/specialties/route.ts`
- **Problema:** En PUT, cuando cambia el nombre se ejecuta primero pricingMatrix.updateMany (profile viejo -> nuevo) y despues specialty.update, sin transaccion. POST verifica unicidad de slug pero PUT no; ademas la unicidad de nombre es sensible a mayusculas/acentos mientras que generateSlug normaliza, asi que dos nombres distintos pueden colisionar en slug (unique) y specialty.update lanza P2002 -> 500 con los precios ya movidos. Segundo camino: name=' ' (solo espacios, pasa el required del input) es truthy, genera slug '' y mueve los precios a profile '', mientras el nombre se conserva por `name?.trim() || existing.name`.
- **Evidencia:**

```ts
if (name && name.trim() !== existing.name) {
  const duplicate = await prisma.specialty.findFirst({
    where: { name: name.trim(), id: { not: specialtyId } }
  });
  ...
  newSlug = generateSlug(name);
  // Actualizar el profile en PricingMatrix
  await prisma.pricingMatrix.updateMany({
    where: { profile: oldName },
    data: { profile: name.trim() }
  });
}
```

- **Escenario de fallo:** Existe 'Diseño Gráfico' (slug diseno-grafico). El admin renombra 'Arte' a 'Diseno Grafico' (sin acentos): el chequeo de nombre pasa, las 15 filas de precios de 'Arte' pasan a profile 'Diseno Grafico', y specialty.update revienta por slug duplicado -> 500. 'Arte' sigue existiendo pero sin precios: calculateJobCreditCost no encuentra fila y cobra el DEFAULT de 5 creditos a cualquier vacante de 'Arte', sea Director o Practicante.
- **Arreglo propuesto:** Validar primero (trim, nombre no vacio, slug no vacio y unico con id distinto -> 409) y ejecutar pricingMatrix.updateMany + specialty.update dentro de prisma.$transaction. Comparar nombres de forma case/accent-insensitive o basar la unicidad en el slug.

#### ADM-047 — PUT de especialidad sin transaccion ni chequeo de slug unico: un rename que colisiona da 500 tras haber renombrado ya la PricingMatrix

- **Severidad:** 🟡 medium · **Categoría:** data-integrity · **Estado:** nuevo · **Verificación:** sin verificar (reportada por 1 auditor)
- **Ubicación:** `src/app/api/admin/specialties/[id]/route.ts:137` · relacionados: `src/lib/pricing.ts`, `src/app/api/admin/specialties/route.ts`
- **Problema:** El POST verifica unicidad del slug, el PUT no. `generateSlug` elimina acentos y simbolos, asi que nombres distintos comparten slug ("Tecnologia"/"Tecnología", "C++"/"C#"). El orden es: (1) `pricingMatrix.updateMany` al nombre nuevo, (2) `specialty.update`, que lanza P2002 por `slug @unique` y cae al catch generico. Queda la especialidad con el nombre viejo y sus 15 precios con el nuevo; `calculateJobCreditCost` ya no encuentra fila y aplica DEFAULT_CREDITS=5, saltandose tambien el salario minimo.
- **Evidencia:**

```ts
      newSlug = generateSlug(name);

      // Actualizar el profile en PricingMatrix
      await prisma.pricingMatrix.updateMany({
        where: { profile: oldName },
        data: { profile: name.trim() }
      });
    }

    const specialty = await prisma.specialty.update({
      where: { id: specialtyId },
      data: {
        name: name?.trim() || existing.name,
        slug: newSlug,
```

- **Escenario de fallo:** Existe la especialidad inactiva "Tecnologia" (sin acento). El admin renombra "TI" a "Tecnología": el slug 'tecnologia' colisiona, la UI muestra "Error al actualizar especialidad", pero los precios de "TI" ya se llaman "Tecnología". Desde ese momento publicar una vacante Director/remoto de perfil "TI" cuesta 5 creditos en lugar de 12.
- **Arreglo propuesto:** Comprobar el slug antes de tocar nada (409 "Ya existe una especialidad equivalente") y envolver el rename de la matriz, las propagaciones y el `specialty.update` en `prisma.$transaction`.

#### ADM-048 — Renombrar una especialidad solo propaga a PricingMatrix: Job.profile, Candidate.profile y User.specialty quedan con el nombre viejo

- **Severidad:** 🟡 medium · **Categoría:** data-integrity · **Estado:** nuevo · **Verificación:** sin verificar (reportada por 3 auditores)
- **Ubicación:** `src/app/api/admin/specialties/[id]/route.ts:140` · relacionados: `src/app/api/jobs/[id]/route.ts`, `src/app/api/jobs/route.ts`, `src/lib/pricing.ts`, `src/app/api/admin/assignments/route.ts`, `prisma/schema.prisma`
- **Problema:** La especialidad se referencia por NOMBRE (string) en Job.profile, Candidate.profile y User.specialty. PUT solo actualiza PricingMatrix.profile. Tras renombrar: (1) validateSpecialty en /api/jobs/[id] busca specialty por name=job.profile y falla, asi que las vacantes existentes no se pueden editar; (2) calculateJobCreditCost(profile viejo) ya no encuentra precio y cae al default de 5 creditos; (3) la guarda de DELETE (job.count where profile = specialty.name) cuenta 0 y permite borrar una especialidad en uso; (4) el aviso de asignacion compara specialist.specialty !== job.profile con nombres desalineados.
- **Evidencia:**

```ts
// Actualizar el profile en PricingMatrix
await prisma.pricingMatrix.updateMany({
  where: { profile: oldName },
  data: { profile: name.trim() }
});
// src/app/api/jobs/[id]/route.ts:128-136
const specialtyExists = await prisma.specialty.findFirst({
  where: { name: profile, isActive: true }
});
if (!specialtyExists) {
  return { valid: false, error: 'La especialidad seleccionada no es válida o no está activa' };
```

- **Escenario de fallo:** El admin renombra 'Tecnología' a 'Tecnología e IT'. Una empresa intenta editar su vacante activa de 'Tecnología': el PUT responde 'La especialidad seleccionada no es válida o no está activa'. Despues el admin elimina 'Tecnología e IT': la guarda dice 0 vacantes (todas siguen con 'Tecnología') y borra la especialidad y sus 15 precios con vacantes vivas.
- **Arreglo propuesto:** En la misma transaccion del rename ejecutar job.updateMany, candidate.updateMany y user.updateMany (where profile/specialty = oldName). En DELETE comprobar tambien candidatos y especialistas que la usen. A medio plazo referenciar por specialtyId (FK) en lugar de por nombre (deuda #2/#3/#4 de la auditoria previa).
- **Otros auditores añaden:** Dentro de la misma transaccion ejecutar `updateMany` sobre Job.profile, Candidate.profile y User.specialty (where = oldName). A medio plazo sustituir los strings por `specialtyId` con FK (deuda #2/#3/#4 ya listada como pendiente). — En el PUT, dentro de prisma.$transaction, propagar el renombre con updateMany a Job.profile, Candidate.profile y User.specialty ademas de PricingMatrix y actualizar Specialty. A mediano plazo reemplazar los strings por specialtyId (FK) como parte de la deuda de modelado ya listada.

#### ADM-049 — DELETE de especialidad solo comprueba vacantes: no mira candidatos ni especialistas que la usan y borra precios y especialidad sin transaccion

- **Severidad:** 🟡 medium · **Categoría:** data-integrity · **Estado:** nuevo · **Verificación:** sin verificar (reportada por 2 auditores)
- **Ubicación:** `src/app/api/admin/specialties/[id]/route.ts:213` · relacionados: `prisma/schema.prisma`
- **Problema:** La guarda solo cuenta Job.profile. Candidate.profile y User.specialty (especialistas) quedan apuntando a un nombre inexistente. pricingMatrix.deleteMany y specialty.delete son dos operaciones separadas: si la segunda falla, la especialidad sobrevive sin precios.
- **Evidencia:**

```ts
const jobsWithProfile = await prisma.job.count({
  where: { profile: specialty.name }
});
if (jobsWithProfile > 0) { ... 409 ... }
// Eliminar precios asociados primero
const deletedPricing = await prisma.pricingMatrix.deleteMany({
  where: { profile: specialty.name }
});
// Eliminar especialidad
await prisma.specialty.delete({ where: { id: specialtyId } });
```

- **Escenario de fallo:** Se elimina 'Educación' (sin vacantes). Los 3 especialistas con specialty='Educación' y los candidatos con ese profile quedan con un valor que ya no existe en ningun select: al editarlos el desplegable aparece vacio y los filtros por perfil dejan de encontrarlos.
- **Arreglo propuesto:** Contar tambien candidate (profile) y user (specialty, role specialist) y devolver 409 con el desglose, o ofrecer reasignacion; ejecutar deleteMany + delete en $transaction. Considerar desactivar (isActive=false) en lugar de borrar.
- **Otros auditores añaden:** Contar tambien candidatos y usuarios y responder 409 con el desglose; ofrecer "desactivar" como alternativa. Ejecutar el borrado de precios y de la especialidad en una transaccion.

#### ADM-050 — La politica de contrasenas unificada en la Fase 1 no se aplico a las altas desde admin: staff con 6 caracteres y candidatos con 8 sin complejidad

- **Severidad:** 🟡 medium · **Categoría:** security · **Estado:** arreglo previo incompleto · **Verificación:** sin verificar (reportada por 3 auditores)
- **Ubicación:** `src/app/api/admin/users/route.ts:155` · relacionados: `src/app/api/admin/candidates/route.ts`, `src/app/api/admin/candidates/[id]/reset-password/route.ts`, `src/app/api/auth/reset-password/route.ts`, `src/app/admin/users/page.tsx`, `src/lib/validations.ts`
- **Problema:** Registro y reset publico exigen min 8 + una mayuscula + un numero (auth/register/route.ts:20-24, auth/reset-password/route.ts:12-16, con el comentario 'Misma politica de contrasena que el registro'). Las rutas admin quedaron fuera: /api/admin/users POST/PUT acepta 6 caracteres para cuentas admin/recruiter/specialist, que son las que ven PII de todos los candidatos; /api/admin/candidates POST y reset-password aceptan 8 caracteres sin complejidad. Tampoco se valida typeof password === 'string' (un numero provoca 500 en bcrypt).
- **Evidencia:**

```ts
// Validar password mínimo
if (password.length < 6) {
  return NextResponse.json(
    { success: false, error: 'La contraseña debe tener al menos 6 caracteres' },
    { status: 400 }
  );
}
// candidates/[id]/reset-password/route.ts:38
if (!password || password.length < 8) {
```

- **Escenario de fallo:** El admin crea un nuevo administrador con la contrasena 'abc123'. La API lo acepta. Esa cuenta, con acceso total a PII, creditos y usuarios, queda protegida por una contrasena que el propio flujo de registro de candidatos rechazaria.
- **Arreglo propuesto:** Extraer a src/lib/validations.ts un passwordSchema unico (min 8, mayuscula, numero) y usarlo en admin/users POST y PUT, admin/candidates POST y admin/candidates/[id]/reset-password; alinear minLength y textos de ayuda en src/app/admin/users/page.tsx y CandidateForm.tsx (y en src/app/reset-password/page.tsx:26, que aun valida 6).
- **Otros auditores añaden:** Unificar el mínimo a 8 caracteres (o la política que se defina) en /api/admin/users POST y PUT y en el `minLength` del input del modal, alineándolo con el resto de la app. — Exportar un unico passwordSchema (min 8 + mayuscula + numero) desde src/lib/validations.ts y usarlo en auth/register, auth/reset-password, profile PUT, company-requests POST, admin/users POST/PUT, admin/vendors POST, admin/candidates POST y admin/candidates/[id]/reset-password. En admin/users PUT devolver 400 si llega password invalida en vez de ignorarla. En loginSchema dejar solo min(1) para no bloquear cuentas existentes con contrasenas antiguas.

#### ADM-051 — admin/users permite auto-desactivarse o desactivar al último admin (lockout)

- **Severidad:** 🟡 medium · **Categoría:** authz · **Estado:** nuevo · **Verificación:** sin verificar (reportada por 1 auditor)
- **Ubicación:** `src/app/api/admin/users/route.ts:321`
- **Problema:** El DELETE (soft-delete que pone isActive=false) y el PUT (que puede poner isActive=false o cambiar el rol) no impiden que un admin se desactive a sí mismo, desactive al único admin activo, o se cambie el propio rol a recruiter/specialist. requireAuth exige un usuario activo, de modo que quedarse sin ningún admin activo bloquea el acceso administrativo por completo.
- **Evidencia:**

```ts
// DELETE: soft delete sin verificar si es el propio usuario ni si es el último admin
await prisma.user.update({
  where: { id: parseInt(id) },
  data: { isActive: false }
});
```

- **Escenario de fallo:** El único admin (o un admin distraído) pulsa 'Desactivar' sobre su propia fila en /admin/users, o cambia su rol a 'recruiter'. La cuenta admin queda inactiva; en el siguiente request requireAuth devuelve 403 y ya nadie puede entrar al panel admin ni reactivar cuentas.
- **Arreglo propuesto:** En PUT/DELETE, obtener el id del actor (requireRole ya devuelve `auth.user`) y rechazar la auto-desactivación/cambio de rol propio; además, antes de desactivar o degradar a un admin, verificar con un count que quede al menos otro admin activo.

#### ADM-052 — Los valores de 'estatus' de educación del CandidateForm no coinciden con los badges de las vistas

- **Severidad:** 🟡 medium · **Categoría:** correctness · **Estado:** nuevo · **Verificación:** sin verificar (reportada por 1 auditor)
- **Ubicación:** `src/components/sections/admin/CandidateForm.tsx:1120`
- **Problema:** El CandidateForm guarda `estatus` con las opciones 'Completa', 'En curso', 'Trunca' (líneas 1120-1123). Pero la vista de detalle en admin/candidates/page.tsx (líneas 1022-1027) y CandidateProfileModal colorean el badge comparando contra 'Titulado', 'Terminado', 'Cursando'. Además el registro público (register/page.tsx) usa un tercer juego: 'Cursando','Terminado','Trunco','Titulado'. Los conjuntos son incompatibles.
- **Evidencia:**

```ts
// CandidateForm:
<option value="Completa">Completa</option>
<option value="En curso">En curso</option>
<option value="Trunca">Trunca</option>
// admin/candidates/page.tsx badge:
edu.estatus === 'Titulado' ? 'bg-green-100 text-green-700' :
edu.estatus === 'Terminado' ? 'bg-blue-100 text-blue-700' :
edu.estatus === 'Cursando' ? 'bg-yellow-100 text-yellow-700' :
```

- **Escenario de fallo:** Admin crea un candidato con educación 'Completa'. Al verlo, el badge de estatus siempre cae al gris por defecto porque ninguna vista reconoce 'Completa'/'En curso'/'Trunca'. Un candidato registrado (que guarda 'Titulado') sí colorea, produciendo comportamiento inconsistente según el origen del dato.
- **Arreglo propuesto:** Unificar el vocabulario de `estatus` en una constante compartida (p.ej. Cursando/Terminado/Trunco/Titulado) y usarla en CandidateForm, register, y en las comparaciones de badge de admin/candidates y CandidateProfileModal.

## ⚪ low (48)

#### ADM-053 — El pipeline no reconoce 'interviewed', 'company_interested' ni 'archived': badge con texto crudo y estadisticas que no suman el total

- **Severidad:** ⚪ low · **Categoría:** frontend-bug · **Estado:** nuevo · **Verificación:** sin verificar (reportada por 1 auditor)
- **Ubicación:** `src/app/admin/assign-candidates/page.tsx:155` · relacionados: `src/app/api/admin/assign-candidates/route.ts`, `prisma/schema.prisma`
- **Problema:** El schema lista esos status y el propio modulo de entrevistas pone la Application en 'interviewed' al confirmar. El mapa de etiquetas/estilos no los incluye (se muestra el string en ingles) y `pipelineStats` en la API no los cuenta en ningun grupo. Ademas la UI no pinta la cifra `rejected`, asi que las 5 cajas no cuadran con el total de la pestana.
- **Evidencia:**

```ts
    const labels: Record<string, string> = {
      pending: 'Pendiente',
      injected_by_admin: 'Inyectado',
      reviewing: 'En Revisión',
      sent_to_specialist: 'Con Especialista',
      evaluating: 'En Evaluación',
      sent_to_company: 'Enviado a Empresa',
      hired: 'Contratado',
      accepted: 'Contratado',
      rejected: 'Rechazado',
      discarded: 'Descartado',
      company_rejected: 'Rechazado por Empresa'
    };
```

- **Escenario de fallo:** Admin confirma una entrevista en /admin/interviews. En el pipeline de esa vacante el candidato aparece con el badge gris "interviewed" y deja de contarse en "Enviados"; la pestana dice 8 y las cajas suman 6.
- **Arreglo propuesto:** Centralizar etiquetas/colores de Application.status en un modulo compartido (src/lib) con todos los valores del schema, anadir cajas "Entrevista" y "Rechazados" y contar 'company_interested'/'interviewed'/'archived' en `pipelineStats`.

#### ADM-054 — Condicion de carrera al cambiar de vacante: respuestas fuera de orden pintan el pipeline y los "ya asignados" de otra vacante

- **Severidad:** ⚪ low · **Categoría:** frontend-bug · **Estado:** nuevo · **Verificación:** sin verificar (reportada por 1 auditor)
- **Ubicación:** `src/app/admin/assign-candidates/page.tsx:234`
- **Problema:** El efecto de `[selectedJob]` lanza tres fetch sin AbortController ni comprobacion de que la respuesta corresponde a la vacante actual. `alreadyAssigned` tampoco se reinicia antes de pedir el nuevo, y si esa peticion falla o llega con `success:false` se conserva el set de la vacante anterior.
- **Evidencia:**

```ts
  useEffect(() => {
    if (selectedJob) {
      fetchCandidates();
      fetchAlreadyAssigned(selectedJob.id);
      fetchPipelineCandidates(selectedJob.id);
    } else {

// lineas 182-185 (sin verificar jobId vigente)
      if (data.success) {
        setPipelineCandidates(data.data || []);
        setPipelineStats(data.pipelineStats || null);
        setJobAssignment(data.jobAssignment || null);
```

- **Escenario de fallo:** Admin hace clic en la vacante A (pipeline grande, respuesta lenta) y enseguida en B. Llega primero B y despues A: bajo el encabezado y pestanas de B se muestran candidatos, estadisticas y equipo de A, y las marcas "Ya en esta vacante" corresponden a A.
- **Arreglo propuesto:** Usar AbortController por efecto (abort en el cleanup) o guardar el jobId solicitado en un ref e ignorar respuestas que no coincidan; reiniciar `alreadyAssigned` y `pipeline*` al iniciar el cambio de vacante.

#### ADM-055 — El mensaje de exito de asignacion nunca se limpia y sigue visible al cambiar de vacante

- **Severidad:** ⚪ low · **Categoría:** ux · **Estado:** nuevo · **Verificación:** sin verificar (reportada por 1 auditor)
- **Ubicación:** `src/app/admin/assign-candidates/page.tsx:401`
- **Problema:** `setSuccess(data.message)` no tiene temporizador ni se resetea al seleccionar otra vacante; `fetchCandidates` limpia `error` pero no `success`. El banner verde puede convivir con un banner rojo posterior.
- **Evidencia:**

```ts
      if (data.success) {
        setSuccess(data.message);
        setSelectedCandidates(new Set());
        // Recargar candidatos, asignados y pipeline
        fetchCandidates();
        fetchAlreadyAssigned(selectedJob.id);
        fetchPipelineCandidates(selectedJob.id);
```

- **Escenario de fallo:** Admin asigna 3 candidatos a la vacante A y pasa a la B: arriba sigue "3 candidato(s) asignado(s) exitosamente", lo que induce a creer que ya se asigno en B.
- **Arreglo propuesto:** Limpiar `success` al cambiar de vacante y con un timeout (como en assignments y specialties), o convertirlo en toast.

#### ADM-056 — Tarjetas de candidato seleccionables solo con raton (`div onClick`) y boton de refrescar sin nombre accesible

- **Severidad:** ⚪ low · **Categoría:** a11y · **Estado:** nuevo · **Verificación:** sin verificar (reportada por 1 auditor)
- **Ubicación:** `src/app/admin/assign-candidates/page.tsx:924`
- **Problema:** Cada candidato es un `div` con onClick, sin role, tabIndex, manejo de teclado ni aria-checked; la seleccion multiple es inoperable con teclado o lector de pantalla. El boton de refrescar (linea 674), que ademas es la unica forma de aplicar los filtros, solo contiene un icono sin `aria-label` ni `title`. La auditoria #63 corrigio este mismo patron solo en las tarjetas de vacante publicas.
- **Evidencia:**

```ts
                            <div
                              key={candidate.id}
                              onClick={() => !isAlreadyAssigned && handleSelectCandidate(candidate.id)}
                              className={`p-4 rounded-lg border-2 transition-all ${

// lineas 674-679
                      <button
                        onClick={fetchCandidates}
                        className="px-4 py-2 bg-gray-100 rounded-lg hover:bg-gray-200"
                      >
                        <RefreshCw size={20} />
                      </button>
```

- **Escenario de fallo:** Un admin que navega con teclado tabula por la pestana "Asignar Nuevos": el foco salta del buscador al pie sin poder marcar ningun candidato.
- **Arreglo propuesto:** Convertir cada tarjeta en `<label>` con `<input type="checkbox">` real (o `role="checkbox" tabIndex={0} aria-checked aria-disabled` + Enter/Espacio) y anadir `aria-label="Actualizar lista"` al boton.

#### ADM-057 — Codigo muerto en las cuatro paginas: `useRouter` sin usar, iconos importados sin uso, ternario sin efecto y ramas inalcanzables

- **Severidad:** ⚪ low · **Categoría:** dead-code · **Estado:** nuevo · **Verificación:** sin verificar (reportada por 1 auditor)
- **Ubicación:** `src/app/admin/assignments/page.tsx:85` · relacionados: `src/app/admin/interviews/page.tsx`, `src/app/admin/specialties/page.tsx`, `src/app/admin/assign-candidates/page.tsx`, `src/app/api/admin/assignments/route.ts`
- **Problema:** assignments, interviews y specialties declaran `const router = useRouter()` sin utilizarlo. Imports sin uso: assignments (ChevronDown, Send, Eye, ExternalLink), interviews (LinkIcon, ExternalLink), assign-candidates (Send, XCircle). En la API de assignments, `recruiterStatus: recruiterId ? 'pending' : 'pending'` es un ternario sin efecto; los query params `recruiterId`/`specialistId` del GET no los usa ninguna UI; los badges paused/draft/closed de `getJobStatusBadge` son inalcanzables porque el GET solo devuelve `status:'active'`. En specialties se pinta el icono `GripVertical` (asa de arrastre) sin que exista reordenamiento.
- **Evidencia:**

```ts
export default function AssignmentsPage() {
  const router = useRouter();

// src/app/api/admin/assignments/route.ts:246
        recruiterStatus: recruiterId ? 'pending' : 'pending',

// src/app/api/admin/assignments/route.ts:29-31
      where: {
        status: 'active'
      },
```

- **Escenario de fallo:** Ruido de lint (hoy en nivel warn) y pistas falsas para quien mantiene el codigo: el titulo "Gestion de Vacantes" y los badges sugieren que se gestionan vacantes pausadas o cerradas, y el asa sugiere drag-and-drop, pero nada de eso existe.
- **Arreglo propuesto:** Eliminar imports y `router` sin uso, simplificar el ternario, y decidir: o el GET acepta `jobStatus` para incluir pausadas/cerradas, o se borran los badges inalcanzables; quitar GripVertical o implementar el reordenamiento.

#### ADM-058 — No se puede retirar por completo el equipo de una vacante: la UI bloquea guardar con ambos selects en "Sin asignar"

- **Severidad:** ⚪ low · **Categoría:** ux · **Estado:** nuevo · **Verificación:** sin verificar (reportada por 1 auditor)
- **Ubicación:** `src/app/admin/assignments/page.tsx:150`
- **Problema:** La validacion de cliente exige al menos un id, aunque la API acepta ambos en null. Una asignacion hecha por error solo puede sustituirse por otra persona, nunca eliminarse.
- **Evidencia:**

```ts
    const selection = selections[jobId];
    if (!selection?.recruiterId && !selection?.specialistId) {
      setError('Selecciona al menos un reclutador o especialista');
      return;
    }
```

- **Escenario de fallo:** Admin asigna por error reclutador y especialista a la vacante equivocada. Pone ambos en "Sin asignar" y guarda: recibe "Selecciona al menos un reclutador o especialista"; la vacante sigue apareciendo en los dashboards de esas dos personas.
- **Arreglo propuesto:** Permitir guardar ambos vacios cuando la vacante ya tiene `assignment` (con confirmacion) enviando nulls, o anadir accion "Quitar asignacion" con DELETE.

#### ADM-059 — handleView en admin/candidates deja documentos obsoletos si falla el fetch

- **Severidad:** ⚪ low · **Categoría:** frontend-bug · **Estado:** nuevo · **Verificación:** sin verificar (reportada por 1 auditor)
- **Ubicación:** `src/app/admin/candidates/page.tsx:233`
- **Problema:** fetchDocuments solo hace `setDocuments(data.data)` cuando `data.success` es true; no limpia el estado al iniciar. Si el usuario abre un candidato B tras un candidato A y la petición de documentos de B falla (o devuelve success:false), el modal de B sigue mostrando los documentos de A cargados previamente. El estado solo se limpia al cerrar el modal, no al cambiar de candidato.
- **Evidencia:**

```ts
const fetchDocuments = async (candidateId: number) => {
  try {
    setIsLoadingDocs(true);
    const response = await fetch(`/api/admin/candidates/${candidateId}/documents`);
    const data = await response.json();
    if (data.success) {
      setDocuments(data.data);
    }
  } catch (error) { /* ... */ }
};
```

- **Escenario de fallo:** Admin ve candidato A (con 2 documentos), cierra, ve candidato B cuyo GET de documentos falla temporalmente. El modal de B muestra los 2 documentos de A, sugiriendo al admin que pertenecen a B.
- **Arreglo propuesto:** Al iniciar fetchDocuments (o en handleView antes de llamarla) hacer `setDocuments([])`, y en caso de error dejar la lista vacía en lugar de conservar la anterior.

#### ADM-060 — Fechas de experiencia mostradas un dia antes: se guardan como medianoche UTC y se pintan en hora local de Mexico

- **Severidad:** ⚪ low · **Categoría:** frontend-bug · **Estado:** nuevo · **Verificación:** sin verificar (reportada por 1 auditor)
- **Ubicación:** `src/app/admin/candidates/page.tsx:1063` · relacionados: `src/app/api/admin/candidates/route.ts`, `src/app/api/admin/candidates/[id]/route.ts`
- **Problema:** El API guarda new Date('YYYY-MM-DD') (00:00 UTC). La vista de detalle usa new Date(exp.fechaInicio).toLocaleDateString('es-MX') sin timeZone:'UTC', y en America/Mexico_City (UTC-6) eso cae en el dia anterior. El formulario de edicion no tiene el problema porque usa toISOString().split('T')[0].
- **Evidencia:**

```ts
<p className="text-xs text-gray-400">
  {new Date(exp.fechaInicio).toLocaleDateString(
    'es-MX'
  )}{' '}
  -
  {exp.esActual
    ? ' Actual'
    : exp.fechaFin
    ? ` ${new Date(exp.fechaFin).toLocaleDateString('es-MX')}`
```

- **Escenario de fallo:** El admin captura una experiencia del 01/01/2020 al 31/12/2022. En 'Ver detalles' aparece '31/12/2019 - 30/12/2022'.
- **Arreglo propuesto:** Usar toLocaleDateString('es-MX', { timeZone: 'UTC' }) para campos de solo fecha (o un helper formatDateOnly compartido) en todas las vistas que pinten fechaInicio/fechaFin/fechaNacimiento.

#### ADM-061 — El pill de Estado desactiva un paquete con un clic, sin confirmacion ni aviso (la papelera si confirma la misma accion)

- **Severidad:** ⚪ low · **Categoría:** ux · **Estado:** nuevo · **Verificación:** sin verificar (reportada por 1 auditor)
- **Ubicación:** `src/app/admin/credit-packages/page.tsx:170`
- **Problema:** handleDelete pide confirm() para desactivar; handleToggleActive hace exactamente lo mismo (isActive=false) sin confirmacion y sin mensaje de exito. Desactivar un paquete hace que /api/credits/purchases responda 'Paquete no disponible' para ese tamano.
- **Evidencia:**

```ts
  const handleToggleActive = async (pkg: CreditPackage) => {
    try {
      const response = await fetch(`/api/admin/credit-packages/${pkg.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !pkg.isActive })
      });
```

- **Escenario de fallo:** El admin hace clic sin querer en 'Activo' de 'Pack 10' al desplazarse por la tabla. No hay dialogo ni notificacion, la fila solo se atenua. Las empresas que eligen 10 creditos reciben 'Paquete no disponible. Contacta al administrador.' hasta que alguien lo detecte.
- **Arreglo propuesto:** Pedir confirmacion al desactivar (reutilizando un modal propio en vez de window.confirm) y mostrar mensaje de exito; ocultar la papelera en paquetes ya inactivos.

#### ADM-062 — El formulario admite centavos (step 0.01) pero la tabla y la pagina de compra formatean con 0 decimales; la compra resta floats sin redondear a 2 decimales

- **Severidad:** ⚪ low · **Categoría:** payments · **Estado:** nuevo · **Verificación:** sin verificar (reportada por 1 auditor)
- **Ubicación:** `src/app/admin/credit-packages/page.tsx:190` · relacionados: `src/app/credits/purchase/page.tsx`, `src/app/api/credits/purchases/route.ts`
- **Problema:** price es Float y el input permite step="0.01", pero formatCurrency usa maximumFractionDigits: 0 (igual que formatPrice en la pagina de compra): el importe mostrado se redondea y difiere del cobrado. Ademas /api/credits/purchases calcula finalPrice = originalPrice - Math.round(descuento) sin redondear a centavos; con precios con centavos la resta entre binadas distintas puede producir valores como 31500.550000000003 que se envian como transaction_amount.
- **Evidencia:**

```ts
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-MX', {
      style: 'currency',
      currency: 'MXN',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
  };
...
                    step="0.01"
```

- **Escenario de fallo:** El admin guarda un paquete a $34,999.50. La tabla admin muestra '$35,000' y 'Precio/Crédito $3,500'; el resumen de compra muestra $35,000 y el cargo real es $34,999.50. El admin no puede verificar en la tabla el precio exacto que guardo.
- **Arreglo propuesto:** Decidir la unidad: si solo pesos enteros, usar step="1" y validar Number.isInteger en la API; si se admiten centavos, mostrar 2 decimales en ambas pantallas y redondear en purchases con Math.round(x * 100) / 100 (idealmente guardar en centavos como Int).

#### ADM-063 — Modales de entrevistas y especialidades sin role=dialog, sin Escape, sin foco gestionado y con botones de cerrar sin nombre accesible

- **Severidad:** ⚪ low · **Categoría:** a11y · **Estado:** arreglo previo incompleto · **Verificación:** sin verificar (reportada por 1 auditor)
- **Ubicación:** `src/app/admin/interviews/page.tsx:427` · relacionados: `src/app/admin/specialties/page.tsx`
- **Problema:** El sweep de a11y de la Fase 4 (#59/#60) cubrio ApplyJobModal, CandidateProfileModal y 8 modales/toasts, pero no estos. Los tres modales (agendar entrevista, crear/editar especialidad, confirmar borrado) son `div` fijos sin `role="dialog"`/`aria-modal`, no cierran con Escape, los botones X no tienen `aria-label` y los `<label>` no estan asociados a sus inputs (sin htmlFor/id).
- **Evidencia:**

```ts
      {modalOpen && selectedInterview && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            ...
              <button onClick={() => setModalOpen(false)} className="text-gray-400 hover:text-gray-600 p-1">
                <X size={20} />
              </button>

// specialties/page.tsx:277
            <button onClick={() => setError(null)} className="ml-auto">
              <X size={18} />
```

- **Escenario de fallo:** Un admin con lector de pantalla abre "Agendar": no se anuncia dialogo, el foco sigue detras del overlay, el boton de cerrar se lee como "boton" sin nombre y Escape no hace nada.
- **Arreglo propuesto:** Aplicar el mismo patron que ApplyJobModal: `role="dialog" aria-modal="true" aria-labelledby`, listener de Escape, foco inicial y retorno de foco, `aria-label="Cerrar"` en los botones X y `htmlFor`/`id` en labels de ambos formularios.

#### ADM-064 — Se pueden confirmar entrevistas en el pasado: los slots propuestos vencidos siguen ofreciendose y la API no valida fecha futura

- **Severidad:** ⚪ low · **Categoría:** validation · **Estado:** nuevo · **Verificación:** sin verificar (reportada por 1 auditor)
- **Ubicación:** `src/app/admin/interviews/page.tsx:462` · relacionados: `src/app/api/admin/interviews/[id]/route.ts`
- **Problema:** El modal pinta todos los `availableSlots` como botones sin comparar con la fecha actual, y el PATCH solo comprueba start < end. Una solicitud pendiente de hace una semana ofrece unicamente horarios ya pasados.
- **Evidencia:**

```ts
                        const slots = JSON.parse(selectedInterview.availableSlots);
                        return slots.map((slot: { date: string; time: string }, i: number) => (
                          <button
                            key={i}
                            type="button"
                            onClick={() => selectSlot(slot)}
```

- **Escenario de fallo:** Admin abre una solicitud creada hace 8 dias, pulsa el primer horario propuesto (ya pasado) y confirma. La API lo acepta; la entrevista aparece directamente en "Pasadas" y la empresa la ve como "Realizada".
- **Arreglo propuesto:** Deshabilitar/etiquetar como "vencido" los slots con `new Date(`${slot.date}T${slot.time}`) < new Date()` y en el PATCH rechazar `status==='confirmed'` con `parsedStart < new Date()`.

#### ADM-065 — La liga de videoconferencia no se valida (el `type=url` no actua sin submit de form) y se puede confirmar sin liga ni lugar

- **Severidad:** ⚪ low · **Categoría:** validation · **Estado:** nuevo · **Verificación:** sin verificar (reportada por 1 auditor)
- **Ubicación:** `src/app/admin/interviews/page.tsx:536` · relacionados: `src/app/api/admin/interviews/[id]/route.ts`, `src/app/company/interviews/page.tsx`
- **Problema:** El input `type="url"` no esta dentro de un `<form>` que se envie (los botones son `type=button` con onClick), asi que el navegador nunca valida. `handleSave` solo exige fechas y la API guarda `meetingUrl` tal cual, sin exigir http(s). El valor se renderiza como `href` en admin (linea 372) y en company/interviews. Tampoco se exige liga para 'videocall' ni lugar para 'presential'. La auditoria #55 corrigio la misma clase (esquema de URL) para documentos, no aqui.
- **Evidencia:**

```ts
                  <input
                    type="url"
                    value={formMeetingUrl}
                    onChange={(e) => setFormMeetingUrl(e.target.value)}

// page.tsx:208
    if (statusToSet === 'confirmed' && (!formScheduledStart || !formScheduledEnd)) {

// api/admin/interviews/[id]/route.ts:161
    if (meetingUrl !== undefined) updateData.meetingUrl = meetingUrl;
```

- **Escenario de fallo:** Admin pega "meet.google.com/abc-defg" (sin https://) y confirma. La empresa pulsa la liga en /company/interviews y el navegador la resuelve como ruta relativa (/company/meet.google.com/abc-defg) -> 404 a la hora de la entrevista. Alternativamente confirma una videollamada sin liga alguna.
- **Arreglo propuesto:** En `handleSave` y en el PATCH validar con `new URL(meetingUrl)` que el protocolo sea http: o https: (reutilizar la validacion introducida en #55) y, al confirmar, exigir `meetingUrl` si type==='videocall' o `location` si type==='presential'.

#### ADM-066 — No existe forma de cancelar una entrevista ya confirmada desde la UI, y "Cancelar solicitud" no pide confirmacion

- **Severidad:** ⚪ low · **Categoría:** ux · **Estado:** nuevo · **Verificación:** sin verificar (reportada por 1 auditor)
- **Ubicación:** `src/app/admin/interviews/page.tsx:616`
- **Problema:** El boton de cancelar solo se renderiza cuando `status === 'pending'`; para 'confirmed' se pinta un `<div />` vacio aunque la API acepta `status:'cancelled'`. Ademas la cancelacion de una pendiente se ejecuta con un solo clic, sin dialogo, y no hay accion para reabrirla.
- **Evidencia:**

```ts
              {selectedInterview.status === 'pending' && (
                <button
                  type="button"
                  onClick={() => handleSave('cancelled')}
                  disabled={saving}
                  ...
                >
                  Cancelar solicitud
                </button>
              )}
              {selectedInterview.status !== 'pending' && <div />}
```

- **Escenario de fallo:** La empresa avisa que ya no podra asistir a una entrevista confirmada. El admin abre "Editar": solo hay "Guardar Cambios" y "Cerrar"; la entrevista queda como Agendada y luego pasa a "Pasadas" (la empresa la ve como "Realizada") aunque nunca ocurrio.
- **Arreglo propuesto:** Mostrar "Cancelar entrevista" tambien para status 'confirmed' (enviando solo `{status:'cancelled', adminNotes}`), con dialogo de confirmacion en ambos casos.

#### ADM-067 — Los errores de guardado se pintan detras del overlay del modal (pricing y credit-packages)

- **Severidad:** ⚪ low · **Categoría:** ux · **Estado:** nuevo · **Verificación:** sin verificar (reportada por 1 auditor)
- **Ubicación:** `src/app/admin/pricing/page.tsx:184` · relacionados: `src/app/admin/credit-packages/page.tsx`
- **Problema:** Cuando el PUT/POST falla, handleSubmit llama a setError, cuyo banner se renderiza en el contenedor de la pagina, debajo del overlay fixed inset-0 z-50 bg-opacity-50 del modal, que permanece abierto. Si la pagina tiene scroll, el banner queda fuera de vista. El modal de eliminacion de pricing si muestra su error dentro (deleteError); los de edicion no.
- **Evidencia:**

```ts
      } else {
        setError(data.error || 'Error al guardar');
      }
    } catch (err) {
      setError('Error de conexión');
    } finally {
      setIsSubmitting(false);
    }
```

- **Escenario de fallo:** En /admin/credit-packages el admin edita un paquete y la API responde 400 'El precio debe ser mayor a 0' (o 500): el boton deja de girar y el modal sigue igual, sin mensaje visible. El admin reintenta varias veces sin saber que ocurre.
- **Arreglo propuesto:** Agregar un estado modalError y renderizarlo dentro del formulario del modal (como ya se hace con deleteError), limpiandolo al abrir y cerrar.

#### ADM-068 — Codigo muerto en las tres paginas (estado, constantes, calculos e imports sin usar)

- **Severidad:** ⚪ low · **Categoría:** dead-code · **Estado:** nuevo · **Verificación:** sin verificar (reportada por 1 auditor)
- **Ubicación:** `src/app/admin/pricing/page.tsx:264` · relacionados: `src/app/admin/vendors/page.tsx`, `src/app/admin/credit-packages/page.tsx`
- **Problema:** pricing/page.tsx: groupedEntries se recalcula en cada render y nunca se usa (264-270); el estado customProfile se escribe y nunca se lee (92, 144, 152); LOCATIONS (65-73) no se usa; FormData/INITIAL_FORM arrastran campos de un formulario de creacion que ya no existe. vendors/page.tsx: imports Filter, ExternalLink y Upload sin usar (12-16); el valor 'all' de commissionFilter nunca se selecciona (102, 177). credit-packages/page.tsx: import DollarSign sin usar. Son restos del alta manual de precios ya deshabilitada.
- **Evidencia:**

```ts
  // Agrupar por perfil para visualización
  const groupedEntries = entries.reduce((acc, entry) => {
    if (!acc[entry.profile]) {
      acc[entry.profile] = [];
    }
    acc[entry.profile].push(entry);
    return acc;
  }, {} as Record<string, PricingEntry[]>);
```

- **Escenario de fallo:** Cada render de la matriz recorre todas las entradas para construir un objeto que se descarta; quien mantenga la pagina asume que existe agrupacion por perfil o alta con perfil personalizado, que no existen.
- **Arreglo propuesto:** Eliminar groupedEntries, customProfile, LOCATIONS, los campos sobrantes de FormData/INITIAL_FORM, los imports no usados y el literal 'all'; subir @typescript-eslint/no-unused-vars a error en estas rutas.

#### ADM-069 — Los errores al guardar una especialidad se pintan detras del modal abierto

- **Severidad:** ⚪ low · **Categoría:** ux · **Estado:** nuevo · **Verificación:** sin verificar (reportada por 1 auditor)
- **Ubicación:** `src/app/admin/specialties/page.tsx:162`
- **Problema:** `handleSubmit` usa `setError`, cuyo banner vive en el flujo de la pagina, por debajo del overlay `fixed inset-0 bg-black bg-opacity-50 z-50` del modal. El modal permanece abierto sin mensaje propio y el banner queda oscurecido o fuera de vista si la pagina tiene scroll.
- **Evidencia:**

```ts
      } else {
        setError(data.error || 'Error al guardar');
      }

// lineas 273-276: el banner esta en la pagina, no en el modal
        {error && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-red-700">

// linea 575
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
```

- **Escenario de fallo:** Admin crea "Tecnologia" cuando ya existe: la API responde 409. El boton deja de girar y el modal sigue igual, sin texto de error visible; pulsa "Crear Especialidad" varias veces creyendo que no responde.
- **Arreglo propuesto:** Anadir estado `modalError` renderizado dentro del formulario (como hace interviews con `modalError`) con `role="alert"`, y limpiarlo al abrir/cerrar.

#### ADM-070 — assign-candidates no valida estado de la vacante ni del candidato, y los ids no numericos producen 500

- **Severidad:** ⚪ low · **Categoría:** validation · **Estado:** nuevo · **Verificación:** sin verificar (reportada por 1 auditor)
- **Ubicación:** `src/app/api/admin/assign-candidates/route.ts:40` · relacionados: `src/app/admin/assign-candidates/page.tsx`
- **Problema:** Solo se comprueba que la vacante exista: se puede inyectar en vacantes 'closed', 'paused' o 'draft' (sin pagar). No se filtra por `candidate.status`: un candidato 'hired' o 'inactive' se inyecta y su status se sobrescribe a 'in_process' (lineas 107-114). La UI filtra en cliente (page.tsx:302-304), el servidor no. `parseInt(jobId)` o un candidateId no numerico da NaN -> Prisma lanza -> 500 (tambien en el GET, linea 201).
- **Evidencia:**

```ts
    const job = await prisma.job.findUnique({
      where: { id: parseInt(jobId) }
    });

    if (!job) {
    ...
    const candidates = await prisma.candidate.findMany({
      where: {
        id: { in: candidateIds.map((id: number) => parseInt(String(id))) }
      }
    });
```

- **Escenario de fallo:** POST {jobId: 12, candidateIds:[7]} donde la vacante 12 esta 'closed' y el candidato 7 esta 'hired': se crea la Application, el candidato vuelve a 'in_process' (se pierde el estado 'hired') y el reclutador recibe una notificacion de una vacante cerrada. POST {jobId:'abc'} -> 500 en vez de 400.
- **Arreglo propuesto:** Validar `Number.isInteger` en jobId y cada candidateId (400). Rechazar si `job.status !== 'active'` (409). Filtrar `status: { in: ['available','in_process'] }` en el findMany de candidatos e informar los omitidos; aplicar updateMany solo a los 'available'.

#### ADM-071 — Entradas no numericas producen 500 en vez de 400 en assign-candidates y assignments; tampoco se comprueba que la vacante este activa

- **Severidad:** ⚪ low · **Categoría:** validation · **Estado:** nuevo · **Verificación:** sin verificar (reportada por 1 auditor)
- **Ubicación:** `src/app/api/admin/assign-candidates/route.ts:41` · relacionados: `src/app/api/admin/assignments/route.ts`
- **Problema:** `parseInt(jobId)` y `parseInt(String(id))` pueden dar NaN y Prisma lanza error de validacion, que cae al catch generico (500). En POST /api/admin/assignments `jobId`, `recruiterId` y `specialistId` se pasan a Prisma sin comprobar tipo (un string provoca 500). Ninguna de las dos rutas verifica `job.status === 'active'`, por lo que via API se inyecta o asigna sobre vacantes cerradas o en borrador.
- **Evidencia:**

```ts
    const job = await prisma.job.findUnique({
      where: { id: parseInt(jobId) }
    });
    ...
        id: { in: candidateIds.map((id: number) => parseInt(String(id))) }

// src/app/api/admin/assignments/route.ts:186-188
    const job = await prisma.job.findUnique({
      where: { id: jobId }
    });
```

- **Escenario de fallo:** GET /api/admin/assign-candidates?jobId=abc -> 500 "Error al obtener candidatos asignados". POST /api/admin/assignments con {"jobId":"12"} -> 500 "Error al guardar asignacion" en lugar de un 400 accionable.
- **Arreglo propuesto:** Validar con zod (`z.coerce.number().int().positive()` y `z.array(...).min(1).max(200)`), responder 400 con mensaje claro y rechazar con 409 si `job.status !== 'active'`.

#### ADM-072 — Las notas de reclutador/especialista son de la vacante pero se repiten en la tarjeta de cada candidato como si fueran individuales

- **Severidad:** ⚪ low · **Categoría:** ux · **Estado:** nuevo · **Verificación:** sin verificar (reportada por 1 auditor)
- **Ubicación:** `src/app/api/admin/assign-candidates/route.ts:288` · relacionados: `src/app/admin/assign-candidates/page.tsx`
- **Problema:** El GET copia `jobAssignment.recruiterNotes` y `specialistNotes` en cada elemento de `data` (el propio comentario lo reconoce) y la UI las pinta en cursiva bajo el nombre del reclutador/especialista dentro de cada tarjeta de candidato.
- **Evidencia:**

```ts
        // Notas del equipo (a nivel de vacante, no de candidato individual)
        recruiterNotes: jobAssignment?.recruiterNotes || null,
        specialistNotes: jobAssignment?.specialistNotes || null,

// page.tsx:820-825
                              {candidate.recruiterNotes && (
                                ...
                                  <p className="text-xs text-gray-500 italic line-clamp-2">
                                    {candidate.recruiterNotes}
```

- **Escenario de fallo:** El reclutador escribe en la vacante "Descarto a Juan por pretension salarial". En el pipeline esa frase aparece identica bajo Juan, Ana y Luis; el admin que mira la tarjeta de Ana cree que la nota se refiere a ella.
- **Arreglo propuesto:** Quitar esas dos claves de cada application y mostrar las notas una sola vez en el bloque "Info del equipo asignado" (ya llegan en `jobAssignment`); para notas por candidato usar EvaluationNote.

#### ADM-073 — pipelineStats no cuenta 'company_interested', 'interviewed' ni 'archived': los candidatos mas avanzados desaparecen de los contadores

- **Severidad:** ⚪ low · **Categoría:** correctness · **Estado:** nuevo · **Verificación:** sin verificar (reportada por 1 auditor)
- **Ubicación:** `src/app/api/admin/assign-candidates/route.ts:297` · relacionados: `src/app/admin/assign-candidates/page.tsx`, `src/app/api/admin/jobs/[id]/pipeline/route.ts`
- **Problema:** Los buckets cubren pending, injected, reviewing, sent_to_specialist, evaluating, sent_to_company, hired/accepted y rechazados. Los estados reales 'company_interested', 'interviewed' (que este mismo modulo asigna al confirmar una entrevista) y 'archived' no caen en ninguno. 'hired' y 'company_rejected' no existen como estado de Application.
- **Evidencia:**

```ts
      sentToCompany: applications.filter(a => a.status === 'sent_to_company').length,
      hired: applications.filter(a => a.status === 'hired' || a.status === 'accepted').length,
      rejected: applications.filter(a => a.status === 'rejected' || a.status === 'discarded' || a.status === 'company_rejected').length
```

- **Escenario de fallo:** Una vacante con 5 candidatos enviados a la empresa: la empresa marca 'Me interesa' en 3 y el admin confirma entrevista de 1. En /admin/assign-candidates 'Enviados' baja a 1 y ningun otro contador sube: 4 candidatos activos no aparecen en ninguna tarjeta aunque `total` diga 5. El badge tampoco tiene etiqueta para esos estados.
- **Arreglo propuesto:** Anadir `companyInterested` e `interviewed` (y `archived`) a pipelineStats y sus tarjetas/etiquetas en la UI; eliminar los estados inexistentes. Idealmente reutilizar el calculo de src/app/api/admin/jobs/[id]/pipeline/route.ts.

#### ADM-074 — POST de asignaciones: ids sin validar tipo (500), acepta usuarios inactivos y vacantes no activas

- **Severidad:** ⚪ low · **Categoría:** validation · **Estado:** nuevo · **Verificación:** sin verificar (reportada por 1 auditor)
- **Ubicación:** `src/app/api/admin/assignments/route.ts:186`
- **Problema:** `jobId`, `recruiterId` y `specialistId` se pasan directo a Prisma: un string provoca error de validacion y 500. Se valida el rol pero no `isActive` (el GET solo ofrece activos). No se comprueba `job.status`.
- **Evidencia:**

```ts
    const job = await prisma.job.findUnique({
      where: { id: jobId }
    });
    ...
      const recruiter = await prisma.user.findUnique({
        where: { id: recruiterId }
      });

      if (!recruiter || recruiter.role !== 'recruiter') {
```

- **Escenario de fallo:** POST {jobId:'15', recruiterId:3} -> 500 'Error al guardar asignacion' en lugar de 400. POST con un reclutador desactivado (isActive=false) -> 200: la vacante queda asignada a alguien que no puede iniciar sesion.
- **Arreglo propuesto:** Validar `Number.isInteger(Number(x))` y convertir; rechazar `!recruiter.isActive` / `!specialist.isActive` con 400; rechazar vacantes 'closed'/'draft' con 409.

#### ADM-075 — Cada guardado de asignacion re-notifica 'Nueva vacante asignada' a reclutador y especialista aunque no hayan cambiado

- **Severidad:** ⚪ low · **Categoría:** ux · **Estado:** nuevo · **Verificación:** sin verificar (reportada por 1 auditor)
- **Ubicación:** `src/app/api/admin/assignments/route.ts:266` · relacionados: `src/app/admin/assignments/page.tsx`
- **Problema:** Tras el upsert se notifica siempre a `recruiterId` y `specialistId` si vienen en el body, sin comparar con la asignacion previa. La UI envia SIEMPRE ambos ids (page.tsx:163-167). Tampoco se avisa al miembro removido.
- **Evidencia:**

```ts
    // Notificar al reclutador y especialista asignados (fire-and-forget)
    if (recruiterId && assignment.job) {
      createNotification({
        userId: recruiterId,
        type: 'assignment',
        title: 'Nueva vacante asignada',
```

- **Escenario de fallo:** Lunes: el admin asigna a la reclutadora Ana (notificacion correcta). Martes: anade al especialista Luis y guarda -> Ana recibe otra 'Nueva vacante asignada' por la misma vacante. Cada cambio posterior duplica el aviso a quien no cambio.
- **Arreglo propuesto:** Leer la asignacion previa (`findUnique({ where: { jobId } })`) antes del upsert y notificar solo si `prev?.recruiterId !== recruiterId` (idem especialista).

#### ADM-076 — Notificaciones fire-and-forget en serverless (mismo patron que #70, no corregido en este modulo)

- **Severidad:** ⚪ low · **Categoría:** reliability · **Estado:** nuevo · **Verificación:** sin verificar (reportada por 2 auditores)
- **Ubicación:** `src/app/api/admin/assignments/route.ts:267` · relacionados: `src/app/api/admin/assign-candidates/route.ts`, `src/lib/notifications.ts`
- **Problema:** `createNotification(...).catch(() => {})` se lanza sin await justo antes de devolver la respuesta, en assignments/route.ts:267-286 y assign-candidates/route.ts:146-155. La auditoria de junio corrigio este patron solo en el webhook (#70). En Vercel la funcion puede congelarse al responder y el insert no completarse; ademas el catch vacio oculta cualquier error.
- **Evidencia:**

```ts
    if (recruiterId && assignment.job) {
      createNotification({
        userId: recruiterId,
        type: 'assignment',
        title: 'Nueva vacante asignada',
        message: `Se te asignó la vacante "${assignment.job.title}".`,
        link: '/recruiter/dashboard',
        metadata: { jobId: jobId, jobTitle: assignment.job.title },
      }).catch(() => {});
    }
```

- **Escenario de fallo:** El admin asigna una vacante; la respuesta 200 sale antes de que termine el INSERT de Notification y la lambda se congela: el reclutador no recibe aviso y no queda log del fallo.
- **Arreglo propuesto:** `await Promise.allSettled([...])` con las notificaciones antes de responder (como en el webhook) y registrar los rechazos con console.error.
- **Otros auditores añaden:** Leer la asignacion previa antes del upsert y notificar solo si `prev?.recruiterId !== recruiterId` (idem especialista); notificar al usuario removido con un tipo de "reasignacion".

#### ADM-077 — Notificaciones fire-and-forget con `.catch(() => {})`: en serverless pueden no enviarse y el error se traga sin log

- **Severidad:** ⚪ low · **Categoría:** reliability · **Estado:** nuevo · **Verificación:** sin verificar (reportada por 1 auditor)
- **Ubicación:** `src/app/api/admin/assignments/route.ts:275` · relacionados: `src/app/api/admin/assign-candidates/route.ts`
- **Problema:** Las promesas de `createNotification` no se esperan antes de devolver la respuesta y cualquier fallo se descarta sin registro. En Vercel la funcion puede congelarse al responder y el insert no llegar a ejecutarse. La auditoria #70 corrigio exactamente este patron en el webhook de MercadoPago (await + Promise.allSettled), pero aqui y en assign-candidates (lineas 146-154) sigue igual.
- **Evidencia:**

```ts
      }).catch(() => {});
    }
    if (specialistId && assignment.job) {
      createNotification({
        userId: specialistId,
        ...
      }).catch(() => {});
    }

    return NextResponse.json({
      success: true,
```

- **Escenario de fallo:** Admin asigna una vacante; la respuesta 200 sale antes de que termine el insert y la instancia se suspende: el reclutador nunca recibe el aviso y no queda rastro en logs.
- **Arreglo propuesto:** `const results = await Promise.allSettled([...]); results.filter(r => r.status === 'rejected').forEach(r => console.error('[assignments] notif', r.reason));` antes del return (o `waitUntil` de @vercel/functions). Aplicar lo mismo en assign-candidates.

#### ADM-078 — La notificacion al especialista enlaza a un dashboard donde la vacante recien asignada todavia no aparece

- **Severidad:** ⚪ low · **Categoría:** ux · **Estado:** nuevo · **Verificación:** sin verificar (reportada por 1 auditor)
- **Ubicación:** `src/app/api/admin/assignments/route.ts:277` · relacionados: `src/app/api/specialist/dashboard/route.ts`
- **Problema:** Se notifica al especialista en el momento de asignar con link a /specialist/dashboard, pero ese dashboard solo lista asignaciones con `recruiterStatus: 'sent_to_specialist'`.
- **Evidencia:**

```ts
    if (specialistId && assignment.job) {
      createNotification({
        userId: specialistId,
        type: 'assignment',
        title: 'Nueva vacante asignada',
        message: `Se te asignó la vacante "${assignment.job.title}".`,
        link: '/specialist/dashboard',

// src/app/api/specialist/dashboard/route.ts:29-33
    const whereClause: Record<string, unknown> = {
      specialistId: user.id,
      recruiterStatus: 'sent_to_specialist'
    };
```

- **Escenario de fallo:** El especialista recibe "Se te asigno la vacante Backend Sr", pulsa la notificacion y su dashboard no muestra esa vacante; reporta un bug o ignora avisos futuros.
- **Arreglo propuesto:** Cambiar el texto a algo como "Fuiste asignado a X; la veras cuando el reclutador envie candidatos" o mostrar en el dashboard una seccion "Proximas" con asignaciones aun no enviadas.

#### ADM-079 — La validacion http(s) de fileUrl (#55) solo se aplico a /api/profile/documents; las rutas admin siguen guardando cualquier esquema

- **Severidad:** ⚪ low · **Categoría:** security · **Estado:** arreglo previo incompleto · **Verificación:** sin verificar (reportada por 2 auditores)
- **Ubicación:** `src/app/api/admin/candidates/[id]/documents/route.ts:98` · relacionados: `src/app/api/profile/documents/route.ts`, `src/app/api/admin/candidates/route.ts`, `src/app/api/admin/candidates/[id]/route.ts`, `src/components/sections/admin/CandidateForm.tsx`
- **Problema:** isSafeDocumentUrl vive como funcion local en src/app/api/profile/documents/route.ts. El POST de documentos admin y el create anidado de documents en POST /api/admin/candidates (route.ts:339-343) guardan fileUrl sin validar, y tampoco se validan cvUrl, portafolioUrl, linkedinUrl ni fotoUrl. CandidateForm ofrece un campo libre 'URL del documento' y su boton de guardar no pasa por la validacion nativa type=url. doc.fileUrl se renderiza como href para reclutadores, especialistas y empresas. Requiere un admin (rol de confianza), por eso severidad baja, pero el arreglo de la Fase 1 quedo incompleto.
- **Evidencia:**

```ts
const body = await request.json();
const { name, fileUrl, fileType } = body;

if (!name || !fileUrl) {
  return NextResponse.json(
    { success: false, error: 'Nombre y URL del archivo son requeridos' },
    { status: 400 }
  );
}

const document = await prisma.candidateDocument.create({
```

- **Escenario de fallo:** Una cuenta admin comprometida (o un pegado erroneo) guarda un documento con fileUrl 'javascript:...'. Cuando la empresa o el especialista abre el perfil del candidato y pulsa el enlace del documento, el script se ejecuta en su sesion.
- **Arreglo propuesto:** Mover isSafeDocumentUrl a src/lib (p. ej. src/lib/url-safety.ts) y usarla en admin/candidates POST (documents[].fileUrl, cvUrl, portafolioUrl, linkedinUrl, fotoUrl), en admin/candidates/[id] PUT y en admin/candidates/[id]/documents POST; validar tambien name como string no vacio con longitud maxima.
- **Otros auditores añaden:** Mover isSafeDocumentUrl (mejor la variante que exige el host del Blob propio) a src/lib y aplicarla tambien aqui; validar name/fileType.

#### ADM-080 — Borrar un documento o un candidato no borra el archivo de Vercel Blob: la PII sigue publica por URL

- **Severidad:** ⚪ low · **Categoría:** security · **Estado:** pendiente conocido de junio · **Verificación:** sin verificar (reportada por 1 auditor)
- **Ubicación:** `src/app/api/admin/candidates/[id]/documents/route.ts:184` · relacionados: `src/app/api/upload/route.ts`, `src/app/api/admin/candidates/[id]/route.ts`
- **Problema:** Detalle nuevo sobre la accion pendiente #56 (CV/documentos en URLs publicas permanentes): en todo src/ el unico uso de @vercel/blob es `put` en src/app/api/upload/route.ts; no existe ninguna llamada a `del`. DELETE de documento, DELETE de candidato (cascade) y el reemplazo de foto solo eliminan la fila; el blob (identificaciones, titulos, CV) permanece accesible indefinidamente para quien tenga la URL. Los intentos fallidos de subida de reclutadores/especialistas (403 en el segundo paso) tambien dejan blobs huerfanos.
- **Evidencia:**

```ts
await prisma.candidateDocument.delete({
  where: { id: docId }
});

return NextResponse.json({
  success: true,
  message: 'Documento eliminado exitosamente'
});
```

- **Escenario de fallo:** Un candidato ejerce su derecho de cancelacion; el admin elimina su registro. La URL del CV y de su identificacion, ya compartida con empresas, sigue devolviendo el archivo meses despues.
- **Arreglo propuesto:** Al borrar un CandidateDocument o un Candidate, llamar a del(fileUrl) de @vercel/blob para las URLs que pertenezcan al store propio (dentro de try/catch para no bloquear el borrado), e incluir cvUrl y fotoUrl. Combinar con la decision pendiente de signed URLs.

#### ADM-081 — El reset de contrasena hecho por el admin no invalida el resetToken pendiente del usuario

- **Severidad:** ⚪ low · **Categoría:** security · **Estado:** nuevo · **Verificación:** sin verificar (reportada por 1 auditor)
- **Ubicación:** `src/app/api/admin/candidates/[id]/reset-password/route.ts:69` · relacionados: `src/app/api/admin/users/route.ts`, `src/app/api/auth/reset-password/route.ts`
- **Problema:** El flujo publico limpia resetToken/resetTokenExpiry al cambiar la contrasena (auth/reset-password/route.ts:62-68). El reset desde admin solo escribe password, igual que el cambio de contrasena en PUT /api/admin/users (linea 283-285). Un enlace de recuperacion emitido antes sigue siendo valido despues de que el admin 'asegure' la cuenta. (La invalidacion de sesiones JWT es la accion pendiente #20/#26 y tambien aplica aqui.) Tampoco queda registro de que admin hizo el cambio.
- **Evidencia:**

```ts
await prisma.user.update({
  where: { id: candidate.userId },
  data: { password: hashedPassword }
});
```

- **Escenario de fallo:** Alguien con acceso temporal al correo del candidato solicita 'olvide mi contrasena' y guarda el enlace. El candidato avisa a INAKAT y el admin le resetea la contrasena. El intruso usa el enlace aun vigente en /reset-password y vuelve a fijar su propia contrasena.
- **Arreglo propuesto:** Incluir resetToken: null y resetTokenExpiry: null en el data de ambos updates (reset-password admin y PUT users con password) y registrar auth.user.id + fecha en un log de auditoria.

#### ADM-082 — Notas internas: POST no sanea y PUT si, y el saneador destruye texto legitimo que contenga '<' y '>'

- **Severidad:** ⚪ low · **Categoría:** data-integrity · **Estado:** nuevo · **Verificación:** sin verificar (reportada por 1 auditor)
- **Ubicación:** `src/app/api/admin/candidates/[id]/route.ts:212` · relacionados: `src/lib/sanitize.ts`, `src/app/api/admin/candidates/route.ts`
- **Problema:** PUT pasa notas por sanitizeMultilineText; POST (route.ts:318) guarda notas tal cual. sanitizeText elimina todo lo que encaje en /<[^>]*>/g y la cadena 'javascript:'. Como React ya escapa al renderizar, el saneado no aporta seguridad y si corrompe contenido normal de un reclutador.
- **Evidencia:**

```ts
if (notas !== undefined) updateData.notas = notas ? sanitizeMultilineText(notas) : null;
// src/lib/sanitize.ts:13
.replace(/<[^>]*>/g, '')
```

- **Escenario de fallo:** El admin escribe en notas 'Pretension < 25k y experiencia > 3 anos' y guarda la edicion: se almacena 'Pretension 3 anos'. La nota original se pierde sin aviso. Si la misma nota se hubiera escrito al crear el candidato, se habria guardado intacta.
- **Arreglo propuesto:** Unificar el tratamiento en POST y PUT: guardar el texto tal cual (limitando longitud) y confiar en el escape de React, o sustituir el regex por un escape de entidades en lugar de un borrado.

#### ADM-083 — Eliminar un candidato deja huérfana su cuenta de usuario vinculada

- **Severidad:** ⚪ low · **Categoría:** data-integrity · **Estado:** nuevo · **Verificación:** sin verificar (reportada por 1 auditor)
- **Ubicación:** `src/app/api/admin/candidates/[id]/route.ts:301`
- **Problema:** El DELETE hace `prisma.candidate.delete` sin tocar el `User` vinculado (Candidate.userId). La relación en el schema es onDelete: SetNull del lado Candidate, así que el User con role='candidate' permanece activo pero ya sin perfil Candidate asociado. Ese usuario puede seguir iniciando sesión y navegando rutas de candidato apuntando a un perfil inexistente.
- **Evidencia:**

```ts
await prisma.candidate.delete({
  where: { id: candidateId }
});
```

- **Escenario de fallo:** Admin elimina un candidato que tenía cuenta de acceso (userId no nulo). El registro Candidate desaparece pero el User sigue activo; ese usuario puede loguearse y las vistas que buscan su Candidate por userId no encontrarán nada, produciendo estados vacíos o errores.
- **Arreglo propuesto:** Decidir la política: o borrar/desactivar también el User vinculado dentro de una transacción al eliminar el candidato, o bloquear la eliminación de candidatos con cuenta y exigir desactivarla primero.

#### ADM-084 — Filtros numericos de candidatos sin validar: minExperience, maxExperience, minAge o maxAge no numericos producen 500

- **Severidad:** ⚪ low · **Categoría:** validation · **Estado:** nuevo · **Verificación:** sin verificar (reportada por 1 auditor)
- **Ubicación:** `src/app/api/admin/candidates/route.ts:83`
- **Problema:** parseInt(minExperience) se pasa directo a where.añosExperiencia.gte y parseInt(maxAge) a setFullYear; con entrada no numerica se genera NaN / Invalid Date y Prisma lanza. El catch lo convierte en 500 generico.
- **Evidencia:**

```ts
if (minExperience || maxExperience) {
  where.añosExperiencia = {};
  if (minExperience) {
    where.añosExperiencia.gte = parseInt(minExperience);
  }
  ...
minBirthDate.setFullYear(today.getFullYear() - parseInt(maxAge) - 1);
where.fechaNacimiento = { ...where.fechaNacimiento, gte: minBirthDate };
```

- **Escenario de fallo:** GET /api/admin/candidates?minAge=veinte -> maxBirthDate es Invalid Date -> Prisma lanza -> 500 'Error al obtener candidatos'.
- **Arreglo propuesto:** Parsear con un helper que devuelva undefined si no es entero finito >= 0 e ignorar el filtro (o responder 400 con el nombre del parametro).

#### ADM-085 — API de paquetes: NaN y tipos invalidos pasan las validaciones y terminan en 500; credits decimal desajusta pricePerCredit

- **Severidad:** ⚪ low · **Categoría:** validation · **Estado:** nuevo · **Verificación:** sin verificar (reportada por 1 auditor)
- **Ubicación:** `src/app/api/admin/credit-packages/[id]/route.ts:108` · relacionados: `src/app/api/admin/credit-packages/route.ts`
- **Problema:** PUT: parseInt(credits)/parseFloat(price) pueden dar NaN y 'NaN <= 0' es false, asi que pasa la validacion y Prisma lanza (500). name puede quedar '' o solo espacios; isActive no se valida como boolean; parseInt(sortOrder) puede ser NaN. POST: las comparaciones se hacen sobre el valor crudo y luego se aplica parseInt; con credits=1.5 se guarda credits=1 pero pricePerCredit=price/1.5; sortOrder se guarda sin parsear.
- **Evidencia:**

```ts
    const finalCredits = credits !== undefined ? parseInt(credits) : existing.credits;
    const finalPrice = price !== undefined ? parseFloat(price) : existing.price;

    if (credits !== undefined || price !== undefined) {
      if (finalCredits <= 0) {
```

- **Escenario de fallo:** PUT /api/admin/credit-packages/3 con {"credits":"abc"} => 500 'Error al actualizar paquete' en vez de 400. POST con {name:' ', credits:1.5, price:6000} crea un paquete sin nombre visible, credits=1 y pricePerCredit=4000.
- **Arreglo propuesto:** Validar con zod en POST y PUT: name string trim 1..60, credits entero >= 1, price numero finito > 0, sortOrder entero >= 0, isActive boolean, badge enum; calcular pricePerCredit despues de normalizar.

#### ADM-086 — credit-packages POST/PUT: sin validacion de tipos (NaN -> 500), creditos decimales con pricePerCredit incoherente y nombre vacio permitido

- **Severidad:** ⚪ low · **Categoría:** validation · **Estado:** nuevo · **Verificación:** sin verificar (reportada por 1 auditor)
- **Ubicación:** `src/app/api/admin/credit-packages/route.ts:66` · relacionados: `src/app/api/admin/credit-packages/[id]/route.ts`
- **Problema:** POST compara `credits <= 0` y `price <= 0` sobre valores sin tipar: 'abc' pasa ('abc' <= 0 es false) y `parseInt('abc')` da NaN -> Prisma lanza -> 500. Con credits 2.5 se guarda 2 pero pricePerCredit se calculo con 2.5. `sortOrder: sortOrder || 0` con string -> 500. En PUT ([id]/route.ts:103-128) `NaN <= 0` es false, asi que credits/price NaN pasan la validacion; `name: ''` e `isActive: 'false'` se aceptan o revientan en Prisma.
- **Evidencia:**

```ts
    if (!name || !credits || !price) {
      ...
    }

    if (credits <= 0) {
      ...
    }
    ...
    // Calcular precio por crédito automáticamente
    const pricePerCredit = price / credits;
```

- **Escenario de fallo:** POST {name:'Pack', credits:'diez', price:100} -> 500 'Error al crear paquete'. POST {credits:2.5, price:10000} -> credits=2 y pricePerCredit=4000 (deberia ser 5000). PUT {name:''} deja un paquete sin nombre.
- **Arreglo propuesto:** Esquema zod compartido por POST y PUT: name `string().trim().min(1).max(60)`, credits `number().int().positive()`, price `number().positive().finite()`, sortOrder `number().int().min(0)`, isActive `boolean()`, badge enum; calcular pricePerCredit con los valores ya normalizados.

#### ADM-087 — Codigo muerto: segunda verificacion de admin por header x-user-role despues de requireRole('admin')

- **Severidad:** ⚪ low · **Categoría:** dead-code · **Estado:** nuevo · **Verificación:** sin verificar (reportada por 1 auditor)
- **Ubicación:** `src/app/api/admin/direct-applications/route.ts:23` · relacionados: `__tests__/api/admin-routes-defensive-auth.test.ts`
- **Problema:** GET (lineas 23-31) y PUT (101-109) repiten la comprobacion de rol leyendo x-user-role tras haber pasado requireRole('admin'). La rama es inalcanzable en produccion y acopla el handler al middleware: llamado sin el (tests de handler, cambio del matcher) devuelve 403 a un admin legitimo. El comentario 'el middleware ya valida esto' confirma que es un resto.
- **Evidencia:**

```ts
// Verificar que es admin (el middleware ya valida esto)
const userRole = request.headers.get('x-user-role');

if (userRole !== 'admin') {
  return NextResponse.json(
    { success: false, error: 'Acceso denegado - Solo administradores' },
    { status: 403 }
  );
}
```

- **Escenario de fallo:** Un test de integracion que invoque GET directamente con una cookie de admin valida recibe 403 porque no existe el header inyectado por el middleware; quien lo depure asumira un fallo de permisos inexistente.
- **Arreglo propuesto:** Eliminar ambos bloques y quedarse con requireRole('admin'), que es la fuente de verdad (BD).

#### ADM-088 — Listados sin limite: GET de postulaciones directas y GET del pipeline cargan todas las filas con includes pesados

- **Severidad:** ⚪ low · **Categoría:** performance · **Estado:** nuevo · **Verificación:** sin verificar (reportada por 1 auditor)
- **Ubicación:** `src/app/api/admin/direct-applications/route.ts:34` · relacionados: `src/app/api/admin/jobs/[id]/pipeline/route.ts`, `src/lib/pagination.ts`
- **Problema:** direct-applications hace findMany de TODAS las aplicaciones 'pending' de la plataforma con job, assignment, recruiter, user y companyRequest, sin take. POST /api/applications es publico (excepcion del middleware), asi que el volumen de 'pending' lo controla cualquiera. El pipeline (jobs/[id]/pipeline/route.ts:54-85) carga todas las aplicaciones de la vacante con evaluationNotes+author y, para cada email, el Candidate completo con experiences y documents.
- **Evidencia:**

```ts
const applications = await prisma.application.findMany({
  where: {
    status: 'pending'
  },
  include: {
    job: {
      select: { ... assignment: {...}, user: {...} }
    }
  },
  orderBy: { createdAt: 'desc' }
});
```

- **Escenario de fallo:** Tras una campana o un bot contra /api/applications hay 5.000 aplicaciones pending: /admin/direct-applications tarda decenas de segundos o supera el limite de la funcion serverless, y el admin no puede procesar ninguna.
- **Arreglo propuesto:** Usar getPaginationParams/buildPaginatedResponse en ambos endpoints (y paginador en la UI); en el pipeline devolver los conteos con groupBy y cargar el detalle de aplicaciones por etapa bajo demanda.

#### ADM-089 — El pipeline empareja aplicacion y perfil de candidato por email con comparacion exacta, a diferencia de assign-candidates que lo hace insensible a mayusculas

- **Severidad:** ⚪ low · **Categoría:** correctness · **Estado:** nuevo · **Verificación:** sin verificar (reportada por 1 auditor)
- **Ubicación:** `src/app/api/admin/jobs/[id]/pipeline/route.ts:78` · relacionados: `src/app/api/admin/assign-candidates/route.ts`
- **Problema:** assign-candidates/route.ts:235-262 normaliza con toLowerCase() y usa mode:'insensitive', lo que indica que hay (o hubo) emails con mayusculas en BD. El pipeline usa `in` exacto y un Map con clave c.email sin normalizar, de modo que cualquier fila heredada con distinto casing sale con candidateProfile: null (sin CV, foto, experiencia ni documentos en el modal del admin).
- **Evidencia:**

```ts
const candidateEmails = applications.map(a => a.candidateEmail);
const candidates = await prisma.candidate.findMany({
  where: { email: { in: candidateEmails } },
  include: { experiences: true, documents: true }
});
const candidateMap = new Map(candidates.map(c => [c.email, c]));
```

- **Escenario de fallo:** Una aplicacion antigua guardo 'Juan.Perez@Gmail.com' y el Candidate tiene 'juan.perez@gmail.com'. En Asignar Candidatos aparece correctamente enlazado, pero en el pipeline del dashboard admin el mismo candidato aparece sin perfil.
- **Arreglo propuesto:** Normalizar igual que en assign-candidates: emails en minusculas, where { email: { in, mode: 'insensitive' } }, Map con c.email.toLowerCase() y get(app.candidateEmail.toLowerCase()). Idealmente migrar los datos a minusculas.

#### ADM-090 — El pipeline no contempla el estado 'archived': el total no cuadra con las etapas y las aplicaciones archivadas quedan invisibles

- **Severidad:** ⚪ low · **Categoría:** correctness · **Estado:** nuevo · **Verificación:** sin verificar (reportada por 1 auditor)
- **Ubicación:** `src/app/api/admin/jobs/[id]/pipeline/route.ts:134` · relacionados: `src/app/admin/page.tsx`, `src/app/api/admin/direct-applications/route.ts`
- **Problema:** El objeto stages agrupa pending/injected_by_admin, reviewing, sent_to_specialist, discarded, evaluating, sent_to_company, company_interested, interviewed, rejected y accepted. 'archived' (que el propio modulo asigna desde direct-applications) no esta en ninguna etapa, pero total = applications.length si lo incluye. La UI de /admin solo permite desplegar por las claves de stages.
- **Evidencia:**

```ts
const stages = {
  recruiter: {
    pending: (countByStatus['pending'] || 0) + (countByStatus['injected_by_admin'] || 0),
    reviewing: countByStatus['reviewing'] || 0,
    sent_to_specialist: countByStatus['sent_to_specialist'] || 0,
    discarded: countByStatus['discarded'] || 0
  },
  ...
total: applications.length,
```

- **Escenario de fallo:** Una vacante tiene 10 aplicaciones, 3 archivadas desde Postulaciones Directas. El modal de pipeline muestra '10 candidatos en total' pero las tres columnas suman 7 y no hay forma de ver ni recuperar las 3 archivadas.
- **Arreglo propuesto:** Anadir archived al desglose (p. ej. stages.recruiter.archived o un bloque 'otros') y a la lista de filtros de la UI, o excluir archived del total de forma explicita y mostrarlo aparte.

#### ADM-091 — PUT de pricing acepta 0 creditos y decimales; id o isActive invalidos producen 500

- **Severidad:** ⚪ low · **Categoría:** validation · **Estado:** nuevo · **Verificación:** sin verificar (reportada por 2 auditores)
- **Ubicación:** `src/app/api/admin/pricing/route.ts:130` · relacionados: `src/app/admin/pricing/page.tsx`
- **Problema:** La validacion dice 'numero positivo' pero acepta 0 (publicacion gratis) y no exige entero: 2.5 pasa y Prisma (campo Int) lanza -> 500. `parseInt(id)` NaN -> 500 (lineas 118-120). `isActive` no se valida como boolean. En la UI, vaciar el campo de creditos lo convierte en 0 (`parseInt(...) || 0`, page.tsx:521) y `required` no lo detiene.
- **Evidencia:**

```ts
    if (credits !== undefined && (typeof credits !== 'number' || credits < 0)) {
      return NextResponse.json(
        { success: false, error: 'Credits debe ser un número positivo' },
        { status: 400 }
      );
    }
```

- **Escenario de fallo:** El admin abre 'Editar', borra el numero para escribir otro y pulsa Guardar por error: se guardan 0 creditos y esa combinacion se publica gratis. PUT {id:'x', credits:3} -> 500. PUT {id:4, credits:2.5} -> 500.
- **Arreglo propuesto:** `Number.isInteger(credits) && credits >= 1` (o confirmacion explicita para 0), `Number.isInteger(minSalary)`, `typeof isActive === 'boolean'`, y validar `Number.isInteger(Number(id))` devolviendo 400. En la UI usar min="1" y no convertir vacio en 0.
- **Otros auditores añaden:** Schema zod: id entero positivo, credits entero 0..1000, minSalary entero 0..10_000_000 o null, isActive boolean; responder 400 con el detalle. Agregar max a los inputs.

#### ADM-092 — /api/admin/pricing/sync es un endpoint huerfano y desincronizado con el generador de especialidades (12 vs 15 combinaciones, sin 'Practicante')

- **Severidad:** ⚪ low · **Categoría:** dead-code · **Estado:** nuevo · **Verificación:** sin verificar (reportada por 1 auditor)
- **Ubicación:** `src/app/api/admin/pricing/sync/route.ts:86` · relacionados: `src/app/api/admin/specialties/route.ts`, `src/app/admin/pricing/page.tsx`
- **Problema:** Ninguna pagina ni script del repo llama a /api/admin/pricing/sync. Su tabla duplica la de src/app/api/admin/specialties/route.ts:145-155 pero diverge: specialties genera 5 seniorities x 3 modalidades = 15 (incluye 'Practicante'), sync solo 4 x 3 = 12 y considera 'completo' `_count >= 12` contando todas las filas del perfil (incluidas las de Practicante o con location). Ademas `totalCreated += missingPricing.length` cuenta lo intentado, no `createMany().count`, y `profilesWithPricing` (linea 33) no se usa.
- **Evidencia:**

```ts
    const workModes = ['presential', 'hybrid', 'remote'];
    const seniorityLevels = ['Director', 'Sr', 'Middle', 'Jr'];

    const baseCredits: Record<string, number> = {
      'Director': 10,
      'Sr': 8,
      'Middle': 6,
      'Jr': 4
    };
// GET, linea 44:
      } else if (pricingEntry._count.id < 12) {
```

- **Escenario de fallo:** Una especialidad sin filas de Practicante: GET sync la reporta completa (12 >= 12) y POST sync nunca las crea -> las vacantes de Practicante cuestan el default 5, mas que un Jr presencial (4). Una especialidad con 3 filas de Practicante + 9 del resto tambien suma 12 y se reporta 'completa' aunque falten 3 combinaciones.
- **Arreglo propuesto:** Extraer la tabla a un modulo compartido (p. ej. src/lib/pricing-defaults.ts) usado por specialties y sync; calcular la completitud por combinacion, no por conteo; usar `result.count`. Exponer el boton 'Sincronizar precios' en /admin/pricing o eliminar el endpoint.

#### ADM-093 — sync genera 12 combinaciones (sin 'Practicante') mientras la creacion de especialidad genera 15

- **Severidad:** ⚪ low · **Categoría:** correctness · **Estado:** nuevo · **Verificación:** sin verificar (reportada por 1 auditor)
- **Ubicación:** `src/app/api/admin/pricing/sync/route.ts:87` · relacionados: `src/app/api/admin/specialties/route.ts`
- **Problema:** POST /api/admin/specialties crea 5 seniorities x 3 modalidades = 15 filas (incluye Practicante, base 2). sync usa 4 seniorities y el GET considera completa una especialidad con >= 12 filas. Una fila 'Practicante' borrada nunca se regenera y el diagnostico dice que todo esta completo. Hoy solo es alcanzable llamando al endpoint directamente (no hay UI), pero quedara activo en cuanto se conecte.
- **Evidencia:**

```ts
// sync/route.ts
    const workModes = ['presential', 'hybrid', 'remote'];
    const seniorityLevels = ['Director', 'Sr', 'Middle', 'Jr'];
...
      } else if (pricingEntry._count.id < 12) {

// src/app/api/admin/specialties/route.ts
    // Auto-generar 15 combinaciones en PricingMatrix (5 seniorities × 3 workModes)
    const seniorityLevels = ['Director', 'Sr', 'Middle', 'Jr', 'Practicante'];
```

- **Escenario de fallo:** Se elimina 'Diseño Gráfico / Practicante / Remoto' (4 creditos). GET sync reporta la especialidad como completa (14 >= 12) y POST sync no crea nada; publicar una vacante de practicante remoto cuesta 5 creditos (default) en lugar de 4.
- **Arreglo propuesto:** Extraer a src/lib/pricing.ts una unica fuente (SENIORITIES, WORK_MODES, baseCredits, workModeBonus, generateDefaultPricing(profile)) usada por specialties y sync; expected = SENIORITIES.length * WORK_MODES.length.

#### ADM-094 — GET /api/admin/specialties y GET /api/admin/specialties/[id] no llaman a requireRole (unicos handlers del modulo sin verificacion en BD)

- **Severidad:** ⚪ low · **Categoría:** authz · **Estado:** nuevo · **Verificación:** sin verificar (reportada por 1 auditor)
- **Ubicación:** `src/app/api/admin/specialties/route.ts:21` · relacionados: `src/app/api/admin/specialties/[id]/route.ts`, `src/middleware.ts`
- **Problema:** Todos los demas handlers del modulo hacen requireRole('admin') como defensa en profundidad. Estos dos GET dependen solo del middleware, que valida el JWT pero no isActive ni el rol actual en BD. Un admin desactivado o degradado conserva acceso de lectura (catalogo completo incluidas inactivas y, en [id], la matriz de precios) hasta que expire su token. Impacto bajo por el tipo de dato, pero rompe la regla de verificar rol en cada handler y quedaria expuesto si cambia el matcher del middleware.
- **Evidencia:**

```ts
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const activeOnly = searchParams.get('active') === 'true';
    const includeSubcategories = searchParams.get('subcategories') !== 'false';

    const where = activeOnly ? { isActive: true } : {};
```

- **Escenario de fallo:** Se desactiva a un admin. Con su cookie aun valida hace GET /api/admin/specialties/3 y obtiene la especialidad con toda su matriz de precios, mientras que el resto de /api/admin/* ya le devuelve 403.
- **Arreglo propuesto:** Anadir al inicio de ambos GET el mismo bloque `const auth = await requireRole('admin'); if ('error' in auth) return ...` que usan POST/PUT/DELETE.

#### ADM-095 — Alta de especialidad no atomica: si falla la generacion de precios queda creada sin matriz y el reintento da 409; skipDuplicates no protege porque location es NULL

- **Severidad:** ⚪ low · **Categoría:** data-integrity · **Estado:** nuevo · **Verificación:** sin verificar (reportada por 1 auditor)
- **Ubicación:** `src/app/api/admin/specialties/route.ts:131` · relacionados: `src/lib/pricing.ts`, `prisma/schema.prisma`, `prisma/seed.ts`
- **Problema:** specialty.create y pricingMatrix.createMany van sueltos. Si createMany falla, la respuesta es 500 'Error al crear especialidad' aunque la especialidad ya existe; al reintentar, 409 'Ya existe una especialidad con ese nombre'. Ademas: (a) skipDuplicates:true no hace nada aqui porque el unique [profile, seniority, workMode, location] lleva location=null y en PostgreSQL los NULL son distintos entre si, asi que si ya existen filas para ese profile se duplican las 15; (b) generateSlug devuelve '' para nombres sin caracteres a-z0-9 (p. ej. '###'), la primera se crea con slug '' y la siguiente da 'Ya existe una especialidad con ese slug'; (c) subcategories, sortOrder, isActive y color no se validan de tipo (valor incorrecto -> 500).
- **Evidencia:**

```ts
const specialty = await prisma.specialty.create({
  data: { name: name.trim(), slug, ... }
});
...
pricingData.push({ profile: specialty.name, seniority, workMode, location: null, credits, isActive: true });
...
await prisma.pricingMatrix.createMany({
  data: pricingData,
  skipDuplicates: true
});
```

- **Escenario de fallo:** POST {name:'Marketing'} y la conexion a BD se corta tras el primer insert: el admin ve error, reintenta y recibe 409. 'Marketing' aparece en el catalogo sin precios; las empresas publican vacantes de Marketing a 5 creditos (default) sea cual sea el seniority, hasta que alguien ejecute manualmente la sincronizacion de precios.
- **Arreglo propuesto:** Envolver create + createMany en prisma.$transaction; rechazar slug vacio con 400; validar tipos del body con zod (subcategories: string[], sortOrder: int, isActive: boolean, color: /^#[0-9a-f]{6}$/i). Para evitar duplicados, comprobar con findFirst antes de insertar cada combinacion o anadir un indice unico parcial con NULLS NOT DISTINCT.

#### ADM-096 — IDs no numericos provocan 500 en lugar de 400 en usuarios (PUT/DELETE) y en borrado de documentos

- **Severidad:** ⚪ low · **Categoría:** validation · **Estado:** nuevo · **Verificación:** sin verificar (reportada por 1 auditor)
- **Ubicación:** `src/app/api/admin/users/route.ts:246` · relacionados: `src/app/api/admin/candidates/[id]/documents/route.ts`
- **Problema:** users PUT y DELETE hacen parseInt(id) sin comprobar NaN antes de findUnique; documents DELETE hace parseInt(documentId) sin comprobar NaN (documents/route.ts:167). Las rutas [id] de candidatos y especialidades si validan isNaN, por lo que el comportamiento es inconsistente. En PUT, email.toLowerCase() con email no string e isActive no booleano tambien acaban en 500.
- **Evidencia:**

```ts
// Verificar que el usuario existe
const existingUser = await prisma.user.findUnique({
  where: { id: parseInt(id) }
});
// documents/route.ts:167
const docId = parseInt(documentId);
```

- **Escenario de fallo:** DELETE /api/admin/users?id=abc -> findUnique({ where: { id: NaN } }) lanza -> 500 'Error al desactivar usuario' en vez de 400 'ID invalido'.
- **Arreglo propuesto:** const userId = Number(id); if (!Number.isInteger(userId) || userId <= 0) return 400. Igual para documentId. Validar tipos de email (string) e isActive (boolean).

#### ADM-097 — PUT /api/admin/users responde exito aunque ignore la contrasena corta o el rol invalido; no exige especialidad al pasar a specialist ni la limpia al dejar de serlo

- **Severidad:** ⚪ low · **Categoría:** validation · **Estado:** nuevo · **Verificación:** sin verificar (reportada por 1 auditor)
- **Ubicación:** `src/app/api/admin/users/route.ts:278` · relacionados: `src/app/admin/users/page.tsx`
- **Problema:** En PUT los valores invalidos se descartan en silencio en lugar de devolver 400: un password de menos de 6 caracteres o un role fuera de ALLOWED_ROLES no se aplican, pero la respuesta es 'Usuario actualizado exitosamente'. A diferencia de POST, PUT no exige specialty cuando role pasa a 'specialist' y no pone specialty=null cuando el rol deja de ser specialist (el formulario conserva el valor previo en su estado y lo reenvia).
- **Evidencia:**

```ts
if (role && ALLOWED_ROLES.includes(role)) updateData.role = role;
if (specialty !== undefined) updateData.specialty = specialty || null;
if (isActive !== undefined) updateData.isActive = isActive;

// Si se proporciona nueva contraseña, hashearla
if (password && password.length >= 6) {
  updateData.password = await bcrypt.hash(password, 10);
}
```

- **Escenario de fallo:** Un cliente/integracion envia PUT {id: 5, password: 'abc'}: recibe success=true y cree que la contrasena cambio; el usuario sigue con la anterior. Por la UI: el admin cambia a un especialista de 'Tecnologia' a rol Reclutador; se guarda role='recruiter' con specialty='Tecnologia' y la tabla lo muestra con especialidad.
- **Arreglo propuesto:** Devolver 400 con mensaje especifico cuando password o role no cumplan; calcular el rol final y forzar specialty requerido si es 'specialist' y null en caso contrario (misma regla que POST, linea 182). Validar typeof isActive === 'boolean'.

#### ADM-098 — Se puede desactivar o cambiar de rol a un reclutador/especialista con vacantes asignadas sin aviso ni reasignacion

- **Severidad:** ⚪ low · **Categoría:** reliability · **Estado:** nuevo · **Verificación:** sin verificar (reportada por 1 auditor)
- **Ubicación:** `src/app/api/admin/users/route.ts:355` · relacionados: `src/app/admin/users/page.tsx`, `src/app/api/admin/assignments/route.ts`
- **Problema:** El GET ya calcula _count de recruiterAssignments/specialistAssignments, pero DELETE y PUT no lo consultan. Al desactivar o cambiar el rol, los JobAssignment siguen apuntando a ese usuario; /api/admin/assignments solo lista usuarios activos para nuevas asignaciones pero no detecta las existentes huerfanas.
- **Evidencia:**

```ts
await prisma.user.update({
  where: { id: parseInt(id) },
  data: { isActive: false }
});

return NextResponse.json({
  success: true,
  message: 'Usuario desactivado exitosamente'
});
```

- **Escenario de fallo:** Se desactiva a una reclutadora con 8 vacantes activas. Las 8 siguen 'asignadas' a alguien que no puede entrar: las postulaciones se acumulan en 'Por revisar' y nadie recibe aviso hasta que una empresa reclama.
- **Arreglo propuesto:** Antes de desactivar o cambiar de rol, contar asignaciones de vacantes no cerradas; devolver 409 con el numero (o aceptar un reassignTo y reasignar en transaccion). Mostrar ese numero en el confirm de la UI.

#### ADM-099 — El enlace 'Buscar en Banco de Candidatos' del error 409 no filtra nada: la pagina ignora ?search=

- **Severidad:** ⚪ low · **Categoría:** frontend-bug · **Estado:** nuevo · **Verificación:** sin verificar (reportada por 1 auditor)
- **Ubicación:** `src/components/sections/admin/CandidateForm.tsx:638` · relacionados: `src/app/admin/candidates/page.tsx`, `src/app/api/admin/candidates/route.ts`
- **Problema:** Cuando POST devuelve 409 con existingCandidateId, el formulario ofrece un Link a /admin/candidates?search=<email>. La pagina /admin/candidates inicializa search con useState('') y no usa useSearchParams, asi que el parametro se ignora; ademas el admin ya esta en esa misma pagina, por lo que el clic solo cierra el modal. Con la lista limitada a 30, el candidato existente puede ni siquiera estar visible.
- **Evidencia:**

```ts
<Link
  href={`/admin/candidates?search=${encodeURIComponent(email)}`}
  className="inline-flex items-center gap-1 px-3 py-1.5 bg-blue-600 ..."
  onClick={onClose}
>
  <ExternalLink size={14} />
  Buscar en Banco de Candidatos
</Link>
```

- **Escenario de fallo:** El admin intenta crear a ana@correo.com, recibe 'Ya existe un candidato con ese email (ID: 57)', pulsa 'Buscar en Banco de Candidatos': el modal se cierra y la lista sigue igual, sin filtrar; tiene que reescribir el email a mano.
- **Arreglo propuesto:** En /admin/candidates leer useSearchParams().get('search') para inicializar el estado y disparar fetchCandidates cuando cambie; o pasar al formulario un callback onSearchExisting(email) que fije el filtro y recargue.

#### ADM-100 — RequestDetailModal abre y linkea sitioWeb sin validar esquema

- **Severidad:** ⚪ low · **Categoría:** security · **Estado:** nuevo · **Verificación:** sin verificar (reportada por 1 auditor)
- **Ubicación:** `src/components/sections/admin/RequestDetailModal.tsx:305`
- **Problema:** El sitio web de la empresa se renderiza como `<a href={request.sitioWeb}>` sin normalizar ni validar el esquema. El PUT de edición de la solicitud (company-requests/[id] PUT) guarda `sitioWeb` sin validación, y la validación en el registro usa zod `.url()` que acepta esquemas peligrosos como `javascript:`. Los documentos se abren con `window.open(url, '_blank')` (línea 138) igualmente sin validación y sin `noopener`.
- **Evidencia:**

```ts
<a
  href={request.sitioWeb}
  target="_blank"
  rel="noopener noreferrer"
  ...
>
  {request.sitioWeb}
  <ExternalLink className="w-4 h-4" />
</a>
```

- **Escenario de fallo:** Una empresa registra sitioWeb='javascript:...'. El admin abre el detalle de la solicitud y hace clic en el enlace del sitio web, ejecutando el script en su sesión. Con window.open(url) sin 'noopener' para los documentos, además hay riesgo de reverse tabnabbing.
- **Arreglo propuesto:** Validar esquema http(s) de sitioWeb tanto en el POST de registro como en el PUT de edición (reutilizar isSafeDocumentUrl), y en la UI normalizar/verificar el href antes de renderizar; pasar `noopener,noreferrer` en window.open.
