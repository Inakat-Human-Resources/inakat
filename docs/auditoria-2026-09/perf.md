# Perfil de candidato y archivos

[← volver al índice](../AUDITORIA-2026-09.md) · 37 hallazgos — 🟠 1 high · 🟡 16 medium · ⚪ 20 low

## 🟠 high (1)

#### PERF-001 — Subir, reemplazar y eliminar CV desde /profile esta roto: la UI llama a /api/profile/documents con un contrato que la API no implementa

- **Severidad:** 🟠 high · **Categoría:** frontend-bug · **Estado:** nuevo · **Verificación:** ✅ verificada contra el código
- **Ubicación:** `src/app/profile/page.tsx:524` · relacionados: `src/app/api/profile/documents/route.ts`, `src/app/api/profile/route.ts`
- **Problema:** handleCvUpload envia un multipart/FormData (file + type=cv) a POST /api/profile/documents, pero esa ruta hace `await request.json()` y espera {name, fileUrl, fileType}; el parseo lanza y responde 500. Aunque respondiera bien, la UI lee `data.data.url`, campo que la API nunca devuelve (devuelve el documento con `fileUrl`). deleteCv llama a DELETE /api/profile/documents?type=cv, pero la ruta exige `?id=` y responde 400 'ID requerido'. Ademas ninguna de las dos rutas toca Candidate.cvUrl. Resultado: el candidato no puede subir, reemplazar ni borrar su CV desde su perfil.
- **Comprobación:** Confirmado por partida doble: la UI sube con `FormData` y la API hace `request.json()` esperando `{name, fileUrl, fileType}`; y la UI borra con `?type=cv` mientras la API exige `?id=<docId>`.
- **Evidencia:**

```ts
// page.tsx 520-528
const formData = new FormData();
formData.append('file', file);
formData.append('type', 'cv');
const response = await fetch('/api/profile/documents', {
  method: 'POST', credentials: 'include', body: formData });
// page.tsx 550
await fetch('/api/profile/documents?type=cv', { method: 'DELETE', ...
// documents/route.ts 74 y 116-119
const { name, fileUrl, fileType } = await request.json();
const docId = searchParams.get('id');
if (!docId) { return ...'ID requerido' ...400
```

- **Escenario de fallo:** Candidato autenticado entra a /profile, pulsa 'Seleccionar archivo' en 'Mi Curriculum Vitae' y elige un PDF de 1MB -> POST multipart -> request.json() lanza SyntaxError -> 500 -> banner 'Error al crear documento'. Si ya tenia CV y pulsa la papelera -> DELETE ?type=cv -> 400 -> 'ID requerido'. El CV nunca se actualiza.
- **Arreglo propuesto:** En handleCvUpload: subir primero a POST /api/upload, y con la url devuelta hacer PUT /api/profile con { candidateData: { cvUrl: uploadData.url } }; al exito setCvUrl(uploadData.url). En deleteCv: PUT /api/profile con { candidateData: { cvUrl: null } } (la ruta ya soporta cvUrl). Eliminar el campo 'type' muerto. Anadir un test que ejercite el handler real.

## 🟡 medium (16)

#### PERF-002 — URLs de documento, CV y foto aceptan cualquier host: enlaces de phishing almacenados que el staff abre desde la ficha

- **Severidad:** 🟡 medium · **Categoría:** security · **Estado:** nuevo · **Verificación:** sin verificar (reportada por 1 auditor)
- **Ubicación:** `src/app/api/profile/documents/route.ts:13` · relacionados: `src/app/api/profile/route.ts`, `src/components/shared/CandidatePhoto.tsx`, `src/components/shared/CandidateProfileModal.tsx`
- **Problema:** isSafeDocumentUrl (#55) solo exige esquema http(s); no comprueba que la URL pertenezca al almacenamiento propio. En PUT /api/profile, cvUrl solo pasa por normalizeUrl y fotoUrl no se valida en absoluto (route.ts 296-299). Un candidato puede registrar enlaces a un sitio externo que reclutadores, especialistas, admins y empresas abren con un clic desde un contexto de confianza.
- **Evidencia:**

```ts
13 function isSafeDocumentUrl(value: unknown): value is string {
...
21   return parsed.protocol === 'http:' || parsed.protocol === 'https:';
22 }
// api/profile/route.ts 296-299
if (cvUrl !== undefined) updateCandidateData.cvUrl = normalizeUrl(cvUrl);
// FEAT-2: Actualizar foto de perfil
if (fotoUrl !== undefined) updateCandidateData.fotoUrl = fotoUrl;
```

- **Escenario de fallo:** Candidato envia POST /api/profile/documents {name:'Cedula profesional', fileUrl:'https://login-inakat.example/sesion-expirada'} y PUT /api/profile {candidateData:{cvUrl:'https://login-inakat.example/cv'}}. El reclutador pulsa 'Ver CV' en la ficha y aterriza en una pagina clonada de login.
- **Arreglo propuesto:** Para fileUrl, cvUrl y fotoUrl aceptar solo URLs cuyo hostname termine en '.public.blob.vercel-storage.com' (y '/uploads/' en desarrollo). Centralizar en un helper `isOwnStorageUrl` y usarlo tambien en /api/admin/candidates/[id]/documents y en notas de evaluacion. En CandidatePhoto anadir onError con fallback al icono.

#### PERF-003 — Eliminar un documento (o reemplazar foto/CV) no borra el blob: el archivo con PII sigue publico para siempre

- **Severidad:** 🟡 medium · **Categoría:** security · **Estado:** pendiente conocido de junio · **Verificación:** sin verificar (reportada por 1 auditor)
- **Ubicación:** `src/app/api/profile/documents/route.ts:139` · relacionados: `src/app/api/profile/route.ts`, `src/app/api/admin/candidates/[id]/documents/route.ts`, `src/app/api/upload/route.ts`
- **Problema:** DELETE solo elimina la fila CandidateDocument; nunca llama a `del()` de @vercel/blob. Igual al reemplazar la foto (handleFotoUpload) y en el DELETE de la ruta admin. El candidato cree haber borrado su documento pero la URL publica sigue viva. Detalle concreto nuevo sobre el pendiente #56 y relevante para el derecho de cancelacion (LFPDPPP).
- **Evidencia:**

```ts
131 const doc = await prisma.candidateDocument.findUnique({
132   where: { id: parseInt(docId) }
133 });
135 if (!doc || doc.candidateId !== candidate.id) {
136   return ... 'No autorizado' ... 403
139 await prisma.candidateDocument.delete({ where: { id: parseInt(docId) } });
141 return NextResponse.json({ success: true, message: 'Documento eliminado' });
```

- **Escenario de fallo:** Candidata sube su INE por error como documento, lo elimina desde /profile y ve 'Documento eliminado'. La URL https://<store>.public.blob.vercel-storage.com/... (ya vista por un reclutador o en historial) sigue devolviendo el archivo indefinidamente.
- **Arreglo propuesto:** Tras borrar la fila, si doc.fileUrl pertenece al store propio, llamar `await del(doc.fileUrl)` de @vercel/blob (best-effort con log). Hacer lo mismo con la fotoUrl/cvUrl anterior al reemplazarlas en PUT /api/profile y en el DELETE de /api/admin/candidates/[id]/documents.

#### PERF-004 — Las rutas de experiencia y documentos no comprueban isActive: un usuario desactivado sigue operando con su JWT hasta 7 dias

- **Severidad:** 🟡 medium · **Categoría:** authz · **Estado:** nuevo · **Verificación:** sin verificar (reportada por 1 auditor)
- **Ubicación:** `src/app/api/profile/experience/route.ts:9` · relacionados: `src/app/api/profile/experience/[id]/route.ts`, `src/app/api/profile/documents/route.ts`, `src/lib/auth.ts`
- **Problema:** /api/profile usa requireAuth(), que rechaza usuarios con isActive=false. /api/profile/experience, /api/profile/experience/[id] y /api/profile/documents implementan su propia autenticacion con verifyToken + consulta sin mirar isActive. El middleware solo verifica la firma del JWT. La funcion getAuthenticatedCandidate esta duplicada literalmente en dos archivos.
- **Evidencia:**

```ts
9  async function getAuthenticatedCandidate() {
...
17   const payload = verifyToken(token);
22   const user = await prisma.user.findUnique({
23     where: { id: payload.userId },
24     include: { candidate: true }
25   });
27   if (!user) { return { error: 'Usuario no encontrado', status: 404 }; }
31   if (!user.candidate) { ... 403 }
35   return { user, candidate: user.candidate };
```

- **Escenario de fallo:** Admin desactiva la cuenta de un candidato por fraude. Con la cookie auth-token aun vigente, el candidato recibe 403 en GET /api/profile pero puede seguir haciendo POST /api/profile/experience y POST /api/profile/documents, modificando una ficha que el staff sigue viendo.
- **Arreglo propuesto:** Sustituir la autenticacion ad-hoc por requireAuth() de src/lib/auth.ts y despues cargar el candidato por userId. Extraer un helper compartido `requireCandidate()` y eliminar las copias duplicadas (incluido recalculateYearsOfExperience).

#### PERF-005 — PUT /api/profile no es transaccional: la contrasena/nombre se confirman aunque falle la actualizacion del candidato y la respuesta sea 500

- **Severidad:** 🟡 medium · **Categoría:** data-integrity · **Estado:** nuevo · **Verificación:** sin verificar (reportada por 1 auditor)
- **Ubicación:** `src/app/api/profile/route.ts:230`
- **Problema:** prisma.user.update (nombre y password) se ejecuta y confirma antes de prisma.candidate.update. Si esta segunda lanza (p. ej. añosExperiencia null, latitude no numerica, fecha invalida), el catch devuelve 500 'Error al actualizar perfil' pero la contrasena ya cambio. La UI no limpia los campos de contrasena en error, asi que el reintento falla con 'Contrasena actual incorrecta'.
- **Evidencia:**

```ts
230 const updatedUser = await prisma.user.update({
231   where: { id: user.id },
232   data: updateUserData,
...
247 if (candidateData && user.candidate) {
...
317   await prisma.candidate.update({
318     where: { id: user.candidate.id },
319     data: updateCandidateData
320   });
```

- **Escenario de fallo:** Candidato escribe contrasena actual + nueva y, en el mismo guardado, deja vacio 'Anos de Experiencia'. El user.update cambia la contrasena; el candidate.update lanza; la UI muestra 'Error al actualizar perfil'. El usuario reintenta con su contrasena 'actual' (ya antigua) y recibe 'Contrasena actual incorrecta'; cree que su cuenta esta rota.
- **Arreglo propuesto:** Validar todo el body antes de escribir y envolver ambas escrituras en `prisma.$transaction([...])`. Devolver 400 con mensaje especifico para errores de validacion en lugar de 500.

#### PERF-006 — PUT /api/profile guarda `educacion` sin validar: un candidato puede dejar datos que rompen el render de la ficha para reclutador, especialista, empresa y admin

- **Severidad:** 🟡 medium · **Categoría:** validation · **Estado:** nuevo · **Verificación:** sin verificar (reportada por 1 auditor)
- **Ubicación:** `src/app/api/profile/route.ts:305` · relacionados: `src/components/shared/CandidateProfileModal.tsx`
- **Problema:** `educacion` se serializa tal cual. Solo el primer elemento pasa un control implicito. Un array con un elemento null u objetos con campos no string se almacena. CandidateProfileModal.parseEducacion solo comprueba Array.isArray y luego hace `educaciones.map((edu) => ... edu.id ... {edu.carrera || 'Sin carrera'}`: con null lanza TypeError, con objeto lanza 'Objects are not valid as a React child'. Solo existe error boundary en src/app/admin/error.tsx, por lo que en recruiter/specialist/company la pagina entera cae.
- **Evidencia:**

```ts
305 if (educacion !== undefined) {
306   updateCandidateData.educacion = JSON.stringify(educacion);
// CandidateProfileModal.tsx 527-530
const parsed = JSON.parse(data.educacion);
if (Array.isArray(parsed) && parsed.length > 0) {
  return parsed;
// 819-823
{educaciones.map((edu, index) => (
  <div key={edu.id || index} ...>
    <h4 ...>{edu.carrera || 'Sin carrera'}</h4>
```

- **Escenario de fallo:** Candidato autenticado envia PUT /api/profile con {"candidateData":{"educacion":[{"id":1,"nivel":"Licenciatura","institucion":"X","carrera":"Y"},null]}} -> 200. Cuando el reclutador abre su ficha o llega a el con 'Siguiente', el modal lanza 'Cannot read properties of null (reading id)' y la pagina muestra 'Application error'.
- **Arreglo propuesto:** Validar con zod: z.array(z.object({ id: z.number(), nivel: z.string().max(50), institucion: z.string().max(200), carrera: z.string().max(200), añoInicio: z.number().int().min(1950).max(2100).nullable(), añoFin: ..., estatus: z.enum([...]) })).max(15). En parseEducacion filtrar elementos no-objeto y coaccionar campos a string. Anadir error.tsx en recruiter/specialist/company.

#### PERF-007 — No se puede eliminar la ultima entrada de educacion: reaparece tras guardar por el fallback a campos legacy

- **Severidad:** 🟡 medium · **Categoría:** correctness · **Estado:** nuevo · **Verificación:** sin verificar (reportada por 1 auditor)
- **Ubicación:** `src/app/api/profile/route.ts:308` · relacionados: `src/components/shared/CandidateProfileModal.tsx`
- **Problema:** En PUT, cuando `educacion` es un array vacio se guarda '[]' pero NO se limpian universidad/carrera/nivelEstudios (solo se sincronizan si length > 0). En GET, si el array parseado esta vacio y existen campos legacy, se fabrica una entrada a partir de ellos. CandidateProfileModal.parseEducacion hace el mismo fallback, asi que reclutadores y empresas tambien siguen viendola.
- **Evidencia:**

```ts
305 if (educacion !== undefined) {
306   updateCandidateData.educacion = JSON.stringify(educacion);
308   if (Array.isArray(educacion) && educacion.length > 0) {
309     const primeraEducacion = educacion[0];
310     updateCandidateData.universidad = primeraEducacion.institucion || null;
...
// GET 110
if (educacionArray.length === 0 && (user.candidate.universidad || user.candidate.carrera)) {
  educacionArray = [{ id: 1, nivel: user.candidate.nivelEstudios || 'Licenciatura', ...
```

- **Escenario de fallo:** Candidato con una sola entrada de educacion la elimina con la papelera y pulsa 'Guardar Cambios' -> 'Perfil actualizado exitosamente' -> fetchProfile() -> la entrada vuelve a aparecer (ahora con estatus 'Completa' y sin anos).
- **Arreglo propuesto:** En PUT, si Array.isArray(educacion) && educacion.length === 0, poner universidad, carrera y nivelEstudios a null. En GET aplicar el fallback legacy solo cuando candidate.educacion sea null (nunca guardado), no cuando sea '[]'. Replicar la regla en parseEducacion del modal.

#### PERF-008 — Vaciar el campo 'Anos de Experiencia' hace fallar todo el guardado del perfil con 500 (null en columna Int no nullable)

- **Severidad:** 🟡 medium · **Categoría:** correctness · **Estado:** nuevo · **Verificación:** sin verificar (reportada por 1 auditor)
- **Ubicación:** `src/app/profile/page.tsx:314` · relacionados: `src/app/api/profile/route.ts`, `prisma/schema.prisma`
- **Problema:** La UI envia `añosExperiencia: null` cuando el input esta vacio. En prisma/schema.prisma la columna es `añosExperiencia Int @default(0)` (no nullable) y la API asigna el valor tal cual, por lo que prisma.candidate.update lanza PrismaClientValidationError y la ruta responde 500 generico. Ademas el campo es editable aunque el schema indica 'se calcula automaticamente' y cada CRUD de experiencia lo recalcula y pisa, generando dos fuentes de verdad.
- **Evidencia:**

```ts
// page.tsx 314
añosExperiencia: añosExperiencia === '' ? null : añosExperiencia,
// api/profile/route.ts 291
if (añosExperiencia !== undefined) updateCandidateData.añosExperiencia = añosExperiencia;
// prisma/schema.prisma 430
añosExperiencia Int       @default(0)
```

- **Escenario de fallo:** Candidato borra el '0' del campo 'Anos de Experiencia' y lo deja vacio, edita su telefono y pulsa 'Guardar Cambios' -> PUT con añosExperiencia:null -> 500 'Error al actualizar perfil'. No se guarda ningun dato del candidato y el mensaje no indica la causa.
- **Arreglo propuesto:** Quitar el input editable y mostrar el valor calculado como solo lectura (no enviarlo en candidateData). Si se mantiene: en la API validar con zod `z.number().int().min(0).max(60)` e ignorar null/''; en la UI enviar undefined en vez de null.

#### PERF-009 — Los errores de validacion de los modales del perfil se pintan detras del overlay (y los del formulario, arriba de una pagina larga): el boton Guardar 'no hace nada'

- **Severidad:** 🟡 medium · **Categoría:** ux · **Estado:** nuevo · **Verificación:** sin verificar (reportada por 1 auditor)
- **Ubicación:** `src/app/profile/page.tsx:378`
- **Problema:** Todos los mensajes usan un unico banner renderizado al inicio de la pagina (lineas 844-857). Los modales de experiencia, educacion y documento son overlays fixed z-50 sin zona de error propia: cuando saveExperience/saveEducation/handleAddDocument hacen setError(...), el banner queda tapado. Igual con 'Las contrasenas nuevas no coinciden': la seccion de contrasena y el boton estan al final y el banner arriba, sin scroll ni foco.
- **Evidencia:**

```ts
377 const saveExperience = async () => {
378   if (!expForm.empresa || !expForm.puesto || !expForm.fechaInicio) {
379     setError('Empresa, puesto y fecha de inicio son requeridos');
380     return;
381   }
// 844-848 (unico lugar donde se pinta)
{error && (
  <div className="bg-red-50 text-red-700 p-4 rounded-lg mb-6 ...">
    <span>{error}</span>
```

- **Escenario de fallo:** Candidato abre 'Nueva Experiencia', olvida la fecha de inicio y pulsa Guardar: no ocurre nada visible. Al cerrar el modal descubre un banner rojo antiguo arriba.
- **Arreglo propuesto:** Anadir estado de error local por modal (expError, eduError, docError) y renderizarlo dentro del modal con role="alert". Para el formulario principal, hacer scrollIntoView/focus del banner o usar un toast fijo. Limpiar el error al abrir cada modal.

#### PERF-010 — Guardar o borrar una experiencia recarga todo el perfil y descarta sin aviso los cambios no guardados (incluida la educacion agregada localmente)

- **Severidad:** 🟡 medium · **Categoría:** data-integrity · **Estado:** nuevo · **Verificación:** sin verificar (reportada por 1 auditor)
- **Ubicación:** `src/app/profile/page.tsx:412`
- **Problema:** La pagina mezcla dos modelos de persistencia: experiencia/documentos/foto se guardan al instante; datos personales y educacion solo con 'Guardar Cambios' (la UI lo dice: 'Guarda tu perfil para aplicar los cambios'). Tras saveExperience y deleteExperience se llama fetchProfile(), que pisa TODOS los estados del formulario con lo que hay en servidor (setEducacion(c.educacion || []), setTelefono, etc.) y ademas pone loading=true, desmontando el formulario y perdiendo el scroll.
- **Evidencia:**

```ts
409 if (data.success) {
410   setShowExpModal(false);
411   setSuccess(editingExp ? 'Experiencia actualizada' : 'Experiencia agregada');
412   fetchProfile();
...
// fetchProfile 256-257
setExperiences(c.experiences || []);
setEducacion(c.educacion || []);
```

- **Escenario de fallo:** Candidato agrega una maestria en 'Educacion' (queda solo en estado local), corrige su telefono y, antes de pulsar 'Guardar Cambios', agrega una experiencia laboral. Al guardarla, fetchProfile() restaura educacion y telefono desde el servidor: la maestria y el telefono nuevo desaparecen sin mensaje.
- **Arreglo propuesto:** Tras el CRUD de experiencia actualizar solo `experiences` (con data.data de la respuesta o GET /api/profile/experience) y `añosExperiencia`; no llamar a fetchProfile(). Separar un flag `refreshing` de `loading` para no desmontar el formulario. Opcional: persistir educacion inmediatamente como las experiencias.

#### PERF-011 — Fechas de experiencia se muestran un mes antes (y la edad cambia un dia antes) por parsear medianoche UTC y formatear en hora local

- **Severidad:** 🟡 medium · **Categoría:** frontend-bug · **Estado:** nuevo · **Verificación:** sin verificar (reportada por 1 auditor)
- **Ubicación:** `src/app/profile/page.tsx:738` · relacionados: `src/components/shared/CandidateProfileModal.tsx`
- **Problema:** La API guarda `new Date('2020-03-01')` = 2020-03-01T00:00:00Z. formatDate (page.tsx) y formatExperienceDate (modal, lineas 482-487) usan toLocaleDateString sin `timeZone: 'UTC'`. En Mexico (UTC-6) esa fecha es 29-feb 18:00, por lo que se muestra 'febrero de 2020'. Afecta a toda experiencia que empiece o termine el dia 1. El modal de edicion usa split('T')[0] y muestra la fecha correcta, de modo que lista y formulario se contradicen. calculateAge (page 745-754 y modal 583-593) tiene el mismo desfase de un dia.
- **Evidencia:**

```ts
738 const formatDate = (dateString: string) => {
739   return new Date(dateString).toLocaleDateString('es-MX', {
740     year: 'numeric',
741     month: 'long'
742   });
743 };
// CandidateProfileModal.tsx 482-486
return new Date(dateString).toLocaleDateString('es-MX', {
  year: 'numeric', month: 'short' });
```

- **Escenario de fallo:** Candidato en Monterrey registra una experiencia con inicio 01/03/2020 y fin 01/09/2022. En su perfil y en la ficha que ven reclutador y empresa aparece 'febrero de 2020 - agosto de 2022'. Al abrir 'Editar', el formulario muestra 2020-03-01.
- **Arreglo propuesto:** Anadir `timeZone: 'UTC'` a las opciones de toLocaleDateString en formatDate y formatExperienceDate. En calculateAge usar getUTCFullYear/getUTCMonth/getUTCDate para la fecha de nacimiento. Extraer a un helper compartido en src/lib.

#### PERF-012 — Vocabulario de 'estatus' de educacion incompatible entre registro, perfil y vistas de reclutador/empresa/admin

- **Severidad:** 🟡 medium · **Categoría:** correctness · **Estado:** nuevo · **Verificación:** sin verificar (reportada por 1 auditor)
- **Ubicación:** `src/app/profile/page.tsx:1776` · relacionados: `src/app/register/page.tsx`, `src/components/shared/CandidateProfileModal.tsx`, `src/components/company/CompanyApplicationsTable.tsx`, `src/app/admin/candidates/page.tsx`
- **Problema:** El registro guarda Cursando/Terminado/Trunco/Titulado; el perfil ofrece Completa/En curso/Trunca; el modal, CompanyApplicationsTable y admin/candidates colorean solo Titulado/Terminado/Cursando. Consecuencias: (1) lo guardado desde /profile siempre sale gris en las vistas del staff; (2) al editar en /profile una entrada creada en registro, el <select> controlado recibe value='Titulado' que no es ninguna opcion: muestra 'Completa' pero el estado conserva 'Titulado'; (3) la regla `disabled={eduForm.estatus === 'En curso'}` no aplica a 'Cursando'. Los niveles tambien difieren (registro: 4 niveles; perfil: 7).
- **Evidencia:**

```ts
// profile/page.tsx 1776-1778
<option value="Completa">Completa</option>
<option value="En curso">En curso</option>
<option value="Trunca">Trunca</option>
// register/page.tsx 896-899
<option value="Cursando">Cursando</option> ... <option value="Titulado">Titulado</option>
// CandidateProfileModal.tsx 828-830
edu.estatus === 'Titulado' ? 'bg-green-100 text-green-800' :
edu.estatus === 'Terminado' ? 'bg-blue-100 text-blue-800' :
edu.estatus === 'Cursando' ? 'bg-yellow-100 text-yellow-800' :
```

- **Escenario de fallo:** Candidato registrado con 'Titulado' abre Editar educacion en /profile: el desplegable muestra 'Completa'. Un candidato que marca 'En curso' en /profile aparece ante la empresa con badge gris.
- **Arreglo propuesto:** Definir una unica constante compartida (src/lib/constants) con niveles y estatus, usarla en register, profile, CandidateForm y en los mapas de color. Migrar valores existentes (Completa->Terminado/Titulado, En curso->Cursando, Trunca->Trunco) con un script de datos.

#### PERF-013 — Modal: al navegar Anterior/Siguiente no se reinician borradores ni se cancelan fetches; la nota (y su visibilidad para la empresa) puede acabar en el candidato equivocado

- **Severidad:** 🟡 medium · **Categoría:** frontend-bug · **Estado:** nuevo · **Verificación:** sin verificar (reportada por 2 auditores)
- **Ubicación:** `src/components/shared/CandidateProfileModal.tsx:234`
- **Problema:** El efecto solo limpia newNoteContent/noteDocument/isNotePublic cuando isOpen pasa a false. Al cambiar application.id con el modal abierto se relanzan los fetch pero (a) el borrador, el adjunto y el check 'Visible para empresa' persisten; (b) skillRatings del candidato anterior siguen en estado hasta que llega la respuesta (o para siempre si falla) y 'Guardar Calificaciones' los enviaria con el applicationId nuevo; (c) no hay AbortController, asi que respuestas fuera de orden muestran notas de otro candidato.
- **Evidencia:**

```ts
234 useEffect(() => {
235   if (isOpen && application?.id && canViewEvaluationNotes) {
236     fetchEvaluationNotes(application.id);
237   }
238   // Limpiar notas cuando se cierra
239   if (!isOpen) {
240     setEvaluationNotes([]);
241     setNewNoteContent('');
242     setNoteDocument(null);
243     setIsNotePublic(false);
244   }
245 }, [isOpen, application?.id, canViewEvaluationNotes]);
```

- **Escenario de fallo:** Reclutador marca 'Visible para empresa' y empieza una nota para la candidata A, pulsa 'Siguiente' sin guardar, termina la nota ya viendo al candidato B y guarda: la nota (con isPublic=true) queda en la aplicacion de B y visible para la empresa.
- **Arreglo propuesto:** Anadir un efecto dependiente de application?.id que resetee newNoteContent, noteDocument, isNotePublic, evaluationNotes, skillRatings, savedSkillRatings y showAddDocModal. En los fetch usar AbortController o un flag `ignore` en el cleanup. Alternativa: `key={application?.id}` en un subcomponente interno.
- **Otros auditores añaden:** En las paginas pasar `key={selectedApplication?.id}` al CandidateProfileModal, o anadir un useEffect dependiente de application?.id que reinicie newNoteContent, noteDocument, isNotePublic, skillRatings y savedSkillRatings. Opcional: confirmar si hay borrador sin guardar antes de navegar.

#### PERF-014 — Guardar nota y guardar calificaciones fallan en silencio (solo console.error): el evaluador no sabe si se guardo

- **Severidad:** 🟡 medium · **Categoría:** ux · **Estado:** nuevo · **Verificación:** sin verificar (reportada por 1 auditor)
- **Ubicación:** `src/components/shared/CandidateProfileModal.tsx:318` · relacionados: `src/app/api/upload/route.ts`
- **Problema:** handleSaveSkillRatings y handleSaveNote no muestran ni exito ni error: si la respuesta no es success o el upload lanza, solo se escribe en consola. El selector de archivo de la nota no valida tamano en cliente, mientras /api/upload limita a 5 MB.
- **Evidencia:**

```ts
      const data = await res.json();
      if (data.success) {
        // Recargar para obtener datos actualizados
        await fetchSkillRatings(application.id);
      }
    } catch (error) {
      console.error('Error guardando skill ratings:', error);
    } finally {
      setSavingSkillRatings(false);
    }
```

- **Escenario de fallo:** (1) El reclutador adjunta un PDF de 8 MB y pulsa 'Guardar nota': /api/upload responde 400 'Archivo muy grande', handleSaveNote hace throw, el catch solo loguea; el boton deja de girar y no pasa nada mas. (2) El especialista pulsa 'Guardar Calificaciones' y la API responde 403/500: ningun aviso; como el exito tampoco muestra confirmacion, asume que se guardo y envia al candidato a la empresa sin calificaciones.
- **Arreglo propuesto:** Anadir estados noteError/ratingsError y un mensaje de exito ('Calificaciones guardadas'); renderizarlos junto a los botones. En el catch de handleSaveNote mostrar error.message. Validar file.size <= 5MB al seleccionar el adjunto y mostrar el limite en el label.

#### PERF-015 — Modal: guardar nota de evaluacion o calificaciones falla en silencio (sin mensaje de error ni de exito)

- **Severidad:** 🟡 medium · **Categoría:** ux · **Estado:** nuevo · **Verificación:** sin verificar (reportada por 1 auditor)
- **Ubicación:** `src/components/shared/CandidateProfileModal.tsx:391`
- **Problema:** handleSaveNote y handleSaveSkillRatings solo hacen console.error ante cualquier fallo y no tratan `data.success === false`. Si el adjunto supera el limite o es de tipo no permitido, el throw se traga. Si la subida devuelve 200 sin url, la nota se guarda SIN adjunto sin avisar. Tampoco hay confirmacion de exito al guardar calificaciones.
- **Evidencia:**

```ts
383 const data = await res.json();
384 if (data.success) {
385   setEvaluationNotes(prev => [data.data, ...prev]);
...
390   }
391 } catch (error) {
392   console.error('Error guardando nota:', error);
393 } finally {
394   setSavingNote(false);
395 }
```

- **Escenario de fallo:** Especialista escribe su evaluacion, adjunta un PDF de 7MB y pulsa 'Guardar nota': el spinner aparece y desaparece, la nota sigue en el textarea, no hay mensaje. Tras tres intentos abandona creyendo que se guardo.
- **Arreglo propuesto:** Anadir estados noteError/ratingsError (y ratingsSaved) mostrados junto a los botones con role="alert"; tratar `!res.ok` y `!data.success` mostrando data.error; validar tamano/extension del adjunto en cliente; abortar si la subida no devuelve url.

#### PERF-016 — Reclutadores y especialistas no pueden adjuntar documentos: el modal llama a /api/admin/candidates/[id]/documents, que el middleware reserva a admin

- **Severidad:** 🟡 medium · **Categoría:** authz · **Estado:** nuevo · **Verificación:** sin verificar (reportada por 2 auditores)
- **Ubicación:** `src/components/shared/CandidateProfileModal.tsx:653` · relacionados: `src/app/api/admin/candidates/[id]/documents/route.ts`, `src/middleware.ts`, `src/app/recruiter/jobs/[jobId]/page.tsx`, `src/app/specialist/jobs/[jobId]/page.tsx`
- **Problema:** El handler permite requireRole(['admin','recruiter','specialist']), pero al estar bajo /api/admin/ el middleware devuelve 403 antes de llegar. Las paginas recruiter/jobs/[jobId] y specialist/jobs/[jobId] pasan canAddDocuments={true}, asi que el boton existe y siempre falla, dejando ademas un archivo huerfano en Blob (la subida a /api/upload ocurre antes). Si se 'arregla' solo abriendo el middleware, el handler permitiria a cualquier recruiter leer/crear/borrar documentos de CUALQUIER candidato (no valida asignacion) y guarda fileUrl sin validar.
- **Evidencia:**

```ts
// src/components/shared/CandidateProfileModal.tsx:653-655
const docResponse = await fetch(`/api/admin/candidates/${candidateId}/documents`, {
  method: 'POST',

// src/app/api/admin/candidates/[id]/documents/route.ts:67
const auth = await requireRole(['admin', 'recruiter', 'specialist']);

// src/middleware.ts:84,88
pathname.startsWith('/api/admin/') ... if (isAdminRoute && payload.role !== 'admin') { ...403
```

- **Escenario de fallo:** Reclutador abre el perfil de un candidato en /recruiter/jobs/12, pulsa 'Agregar' documento, elige un PDF y guarda: el archivo se sube a Blob y despues aparece 'No tienes permisos de administrador para acceder a este recurso'. El documento nunca queda asociado.
- **Arreglo propuesto:** Crear /api/evaluations/candidates/[id]/documents (GET/POST) con requireRole(['recruiter','specialist','admin']) y comprobacion de que el candidato tiene una Application en una vacante asignada al usuario (JobAssignment.recruiterId/specialistId), validando fileUrl con el helper http(s). Apuntar CandidateProfileModal a esa ruta y dejar la de /api/admin solo con requireRole('admin').
- **Otros auditores añaden:** Crear una ruta fuera de /api/admin (p. ej. /api/candidates/[id]/documents) con requireRole(['admin','recruiter','specialist']) + verificacion de asignacion (el recruiter/specialist debe tener una JobAssignment con una Application de ese candidato), validar fileUrl con isSafeDocumentUrl, y apuntar el modal a ella. Tras guardar, refrescar tambien selectedApplication en la pagina padre.

#### PERF-017 — Regresion del fix a11y #59: cualquier clic dentro del sub-modal 'Agregar Documento' cierra todo el modal de perfil

- **Severidad:** 🟡 medium · **Categoría:** frontend-bug · **Estado:** arreglo previo incompleto · **Verificación:** sin verificar (reportada por 1 auditor)
- **Ubicación:** `src/components/shared/CandidateProfileModal.tsx:1398` · relacionados: `src/app/recruiter/jobs/[jobId]/page.tsx`, `src/app/specialist/jobs/[jobId]/page.tsx`
- **Problema:** El commit 211ac1a (#59) anadio `onClick={onClose}` al overlay externo y `stopPropagation` solo en el div role=dialog. El sub-modal 'Agregar Documento' se renderiza como HIJO del overlay externo pero HERMANO del dialog, sin stopPropagation. Todo clic dentro de el (input de nombre, selector de archivo, Guardar, Cancelar) burbujea hasta el overlay y dispara onClose. Como el componente permanece montado en las paginas de recruiter/specialist, `showAddDocModal` queda en true y al abrir el siguiente candidato el sub-modal reaparece encima.
- **Evidencia:**

```ts
687 <div
688   className="fixed inset-0 bg-black bg-opacity-50 ... z-50 p-4 fade-in-fast"
689   onClick={onClose}
690 >
691   <div role="dialog" ... onClick={(e) => e.stopPropagation()} ...>
...
1395   </div>
1397   {/* Modal de Agregar Documento */}
1398   {showAddDocModal && (
1399     <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60] p-4">
1400       <div className="bg-white rounded-lg w-full max-w-md">
```

- **Escenario de fallo:** Reclutador en /recruiter/jobs/5 abre la ficha de un candidato, pulsa 'Agregar' en Documentos y hace clic en el input 'Nombre del documento' para escribir: el clic burbujea al overlay -> closeProfileModal() -> el modal entero desaparece. Al abrir otro candidato, el sub-modal aparece abierto de inmediato.
- **Arreglo propuesto:** Mover el sub-modal fuera del overlay externo (fragmento hermano) o anadir `onClick={(e) => e.stopPropagation()}` en el div overlay del sub-modal (linea 1399). Resetear showAddDocModal/newDocName/newDocFile/docError en el efecto de `!isOpen`. Para el cierre por overlay usar onMouseDown con `e.target === e.currentTarget` en vez de onClick.

## ⚪ low (20)

#### PERF-018 — En desarrollo (sin BLOB token) el fix #55 rompe el alta de documentos y ensureUrl/normalizeUrl corrompen las URLs locales /uploads/...

- **Severidad:** ⚪ low · **Categoría:** config · **Estado:** arreglo previo incompleto · **Verificación:** sin verificar (reportada por 1 auditor)
- **Ubicación:** `src/app/api/profile/documents/route.ts:80` · relacionados: `src/app/api/upload/route.ts`, `src/lib/utils.ts`, `src/components/shared/CandidateProfileModal.tsx`
- **Problema:** Sin BLOB_READ_WRITE_TOKEN y NODE_ENV=development, /api/upload devuelve una URL relativa '/uploads/<archivo>'. isSafeDocumentUrl exige URL absoluta, asi que el POST responde 400. normalizeUrl y ensureUrl convierten '/uploads/x.pdf' en 'https:///uploads/x.pdf' (enlace roto).
- **Evidencia:**

```ts
// documents/route.ts 80-81
if (!isSafeDocumentUrl(fileUrl)) {
  return ...'URL del archivo inválida. Debe ser una URL http(s) absoluta.' ... 400
// upload/route.ts 47-48
// Retornar URL relativa para acceso público
return `/uploads/${uniqueFileName}`;
// CandidateProfileModal.tsx 6
const ensureUrl = (url: string) => url.startsWith('http') ? url : `https://${url}`;
```

- **Escenario de fallo:** Desarrollador levanta el proyecto en local sin token de Blob, entra como candidato y agrega un documento: 'URL del archivo invalida'. No puede probar el flujo sin credenciales de produccion.
- **Arreglo propuesto:** En isSafeDocumentUrl aceptar rutas que empiecen por '/uploads/' cuando NODE_ENV !== 'production'; en ensureUrl/normalizeUrl no prefijar si la URL empieza por '/'. O devolver en dev una URL absoluta basada en request.url.

#### PERF-019 — /api/profile/documents: id no numerico -> 500; POST sin limites de tipo, longitud ni cantidad

- **Severidad:** ⚪ low · **Categoría:** validation · **Estado:** nuevo · **Verificación:** sin verificar (reportada por 1 auditor)
- **Ubicación:** `src/app/api/profile/documents/route.ts:131`
- **Problema:** DELETE hace parseInt(docId) sin comprobar NaN; Prisma lanza y se responde 500. En POST, `name` y `fileType` no se validan (tipo/longitud) y no hay tope de documentos ni rate limit.
- **Evidencia:**

```ts
131 const doc = await prisma.candidateDocument.findUnique({
132   where: { id: parseInt(docId) }
133 });
...
76 if (!name || !fileUrl) {
...
84 const doc = await prisma.candidateDocument.create({
85   data: { candidateId: candidate.id, name, fileUrl, fileType: fileType || null }
```

- **Escenario de fallo:** DELETE /api/profile/documents?id=abc -> 500. Un script autenticado crea 50.000 documentos para su candidato; cada listado de recruiter/company con `documents: true` los arrastra.
- **Arreglo propuesto:** Validar `const id = Number(docId); if (!Number.isInteger(id) || id <= 0) return 400`. En POST: name string trim 1..120, fileType string max 20, maximo ~20 documentos por candidato (count previo) y applyRateLimit.

#### PERF-020 — PUT /api/profile/experience/[id] no valida campos: strings vacios aceptados, fechas invalidas -> 500, fechaInicio:null -> 1970

- **Severidad:** ⚪ low · **Categoría:** validation · **Estado:** nuevo · **Verificación:** sin verificar (reportada por 1 auditor)
- **Ubicación:** `src/app/api/profile/experience/[id]/route.ts:190` · relacionados: `src/app/api/profile/experience/route.ts`
- **Problema:** A diferencia del POST, el PUT no exige empresa/puesto no vacios. `new Date('abc')` da Invalid Date y Prisma lanza -> 500. `fechaInicio: null` pasa `!== undefined` y `new Date(null)` es 1970-01-01, que se guarda y dispara el recalculo. El POST tambien devuelve 500 con fechas no parseables. Sin limites de longitud.
- **Evidencia:**

```ts
190 const updateData: any = {};
191 if (empresa !== undefined) updateData.empresa = empresa;
192 if (puesto !== undefined) updateData.puesto = puesto;
193 if (ubicacion !== undefined) updateData.ubicacion = ubicacion;
194 if (fechaInicio !== undefined) updateData.fechaInicio = new Date(fechaInicio);
195 if (fechaFin !== undefined || esActual !== undefined) updateData.fechaFin = finalFechaFin ? new Date(finalFechaFin) : null;
```

- **Escenario de fallo:** PUT /api/profile/experience/9 con {"fechaInicio":null,"esActual":true} -> 200; la experiencia pasa a empezar el 1-ene-1970 y añosExperiencia se recalcula a 57.
- **Arreglo propuesto:** Schema zod compartido POST/PUT: empresa/puesto string trim min 1 max 150; ubicacion max 150; descripcion max 3000; fechaInicio/fechaFin z.coerce.date() con refine (no futuras, fin >= inicio); esActual boolean. Responder 400 en fallos.

#### PERF-021 — recalculateYearsOfExperience suma periodos solapados y cuenta hasta hoy las experiencias no actuales sin fecha de fin

- **Severidad:** ⚪ low · **Categoría:** correctness · **Estado:** nuevo · **Verificación:** sin verificar (reportada por 1 auditor)
- **Ubicación:** `src/app/api/profile/experience/route.ts:148` · relacionados: `src/app/api/profile/experience/[id]/route.ts`
- **Problema:** El calculo suma los meses de cada experiencia de forma independiente (dos empleos simultaneos cuentan doble) y trata `!exp.fechaFin` como 'hasta hoy' aunque esActual sea false; la UI permite guardar una experiencia no actual sin Fecha Fin. El resultado alimenta añosExperiencia, usado en filtros min/maxExperience del banco. La funcion esta duplicada en experience/route.ts y experience/[id]/route.ts.
- **Evidencia:**

```ts
148 for (const exp of experiences) {
149   const start = new Date(exp.fechaInicio);
150   const end = exp.esActual || !exp.fechaFin ? now : new Date(exp.fechaFin);
152   const months = (end.getFullYear() - start.getFullYear()) * 12 +
153                  (end.getMonth() - start.getMonth());
154   totalMonths += Math.max(0, months);
155 }
157 const years = Math.round(totalMonths / 12);
```

- **Escenario de fallo:** Candidata con 6 anos de carrera registra empleo 2020-presente y freelance paralelo 2020-presente, mas una practica de 2015 sin fecha fin: el sistema le asigna ~23 anos y aparece en busquedas de '+15 anos'.
- **Arreglo propuesto:** Unir intervalos antes de sumar (ordenar por inicio y fusionar solapes). Exigir fechaFin cuando esActual es false (API y UI). Mover la funcion a src/lib y reutilizarla en register, admin/candidates y ambas rutas.

#### PERF-022 — GET /api/profile inventa nivel 'Licenciatura' y estatus 'Completa' para educacion legacy, y el siguiente guardado los persiste como reales

- **Severidad:** ⚪ low · **Categoría:** data-integrity · **Estado:** nuevo · **Verificación:** sin verificar (reportada por 1 auditor)
- **Ubicación:** `src/app/api/profile/route.ts:110` · relacionados: `src/app/profile/page.tsx`
- **Problema:** Para candidatos sin JSON de educacion (creados por admin o antiguos), el GET fabrica una entrada con valores por defecto no declarados. Como handleSubmit siempre reenvia `educacion`, cualquier guardado escribe esa entrada inventada y ademas sobrescribe nivelEstudios legacy con 'Licenciatura', que se usa en filtros.
- **Evidencia:**

```ts
110 if (educacionArray.length === 0 && (user.candidate.universidad || user.candidate.carrera)) {
111   educacionArray = [{
112     id: 1,
113     nivel: user.candidate.nivelEstudios || 'Licenciatura',
114     institucion: user.candidate.universidad || '',
115     carrera: user.candidate.carrera || '',
...
118     estatus: 'Completa'
119   }];
```

- **Escenario de fallo:** Admin da de alta a un candidato con universidad='CONALEP' y sin nivel. El candidato entra a /profile, cambia su telefono y guarda: su ficha pasa a decir 'Licenciatura - Completa' y nivelEstudios='Licenciatura'; ahora aparece en filtros de licenciados.
- **Arreglo propuesto:** En el fallback usar `nivel: nivelEstudios || ''` y `estatus: ''`, y marcar la entrada como legacy para que la UI pida completarla. En la UI enviar `educacion` solo si el usuario la modifico (flag dirty).

#### PERF-023 — PUT /api/profile es un oraculo de contrasena sin rate limit

- **Severidad:** ⚪ low · **Categoría:** security · **Estado:** nuevo · **Verificación:** sin verificar (reportada por 1 auditor)
- **Ubicación:** `src/app/api/profile/route.ts:205` · relacionados: `src/lib/rate-limit.ts`
- **Problema:** El login tiene rate limit (7/15 min), pero la verificacion de currentPassword en PUT /api/profile no usa applyRateLimit. Con una sesion robada o un equipo desatendido se puede probar la contrasena actual sin limite para averiguarla y luego cambiarla dejando fuera al dueno.
- **Evidencia:**

```ts
204 // Verificar password actual
205 const isValidPassword = await bcrypt.compare(currentPassword, user.password);
206 if (!isValidPassword) {
207   return NextResponse.json(
208     { success: false, error: 'Contraseña actual incorrecta' },
209     { status: 400 }
```

- **Escenario de fallo:** Atacante con la cookie auth-token de la victima lanza un script con PUT /api/profile {currentPassword:<diccionario>, newPassword:'Xxxxxxx1'}; sin 429, hasta acertar y tomar control permanente.
- **Arreglo propuesto:** Aplicar applyRateLimit(request, 'profile-password', { maxRequests: 5, windowSeconds: 900 }) solo cuando el body incluye newPassword, idealmente con clave por userId ademas de IP.

#### PERF-024 — El cambio de contrasena desde el perfil no aplica la politica de registro/reset (mayuscula + numero)

- **Severidad:** ⚪ low · **Categoría:** security · **Estado:** arreglo previo incompleto · **Verificación:** sin verificar (reportada por 1 auditor)
- **Ubicación:** `src/app/api/profile/route.ts:214` · relacionados: `src/app/api/auth/reset-password/route.ts`, `src/app/profile/page.tsx`
- **Problema:** La fase 1 unifico la politica en reset-password ('Misma politica que el registro: min 8, una mayuscula y un numero'), pero PUT /api/profile solo exige longitud >= 8, igual que la UI (page.tsx 284). Si newPassword no es string, `.length` es undefined, la comparacion es false y bcrypt.hash lanza -> 500. Como detalle del pendiente #20/#26: este cambio tampoco invalida otras sesiones ni rota la cookie.
- **Evidencia:**

```ts
213 // Validar nuevo password
214 if (newPassword.length < 8) {
215   return NextResponse.json(
216     { success: false, error: 'La nueva contraseña debe tener al menos 8 caracteres' },
// reset-password/route.ts 12-16
password: z.string().min(8, ...)
  .regex(/[A-Z]/, 'Debe contener al menos una mayúscula')
  .regex(/[0-9]/, 'Debe contener al menos un número')
```

- **Escenario de fallo:** Usuario registrado con 'Segura2026' entra a /profile y cambia su contrasena a 'aaaaaaaa': aceptada, saltandose la politica.
- **Arreglo propuesto:** Extraer el schema de contrasena a src/lib/validations y reutilizarlo en register, reset-password y PUT /api/profile (y en handleSubmit). Validar typeof newPassword === 'string'.

#### PERF-025 — candidateData sin validacion de esquema en PUT /api/profile: nombres vacios, carta sin limite, enums y coordenadas arbitrarias, tipos erroneos -> 500

- **Severidad:** ⚪ low · **Categoría:** validation · **Estado:** nuevo · **Verificación:** sin verificar (reportada por 1 auditor)
- **Ubicación:** `src/app/api/profile/route.ts:275` · relacionados: `src/app/profile/page.tsx`
- **Problema:** Ningun campo se valida. La UI marca 'Nombre *' y 'Apellido Paterno *' pero sin `required` ni comprobacion en handleSubmit, y la API acepta '' (columnas String no nullables). cartaPresentacion esta limitada a 1000 caracteres solo en el cliente. sexo/seniority/profile aceptan cualquier string; latitude/longitude cualquier numero; tipos incorrectos provocan error Prisma -> 500 en lugar de 400. fechaNacimiento admite fechas futuras.
- **Evidencia:**

```ts
275 if (candidateNombre !== undefined) updateCandidateData.nombre = candidateNombre;
276 if (apellidoPaterno !== undefined) updateCandidateData.apellidoPaterno = apellidoPaterno;
...
282 if (sexo !== undefined) updateCandidateData.sexo = sexo;
286 if (latitude !== undefined) updateCandidateData.latitude = latitude;
293 if (seniority !== undefined) updateCandidateData.seniority = seniority;
302 if (cartaPresentacion !== undefined) updateCandidateData.cartaPresentacion = cartaPresentacion;
```

- **Escenario de fallo:** Candidato borra el campo 'Nombre' y guarda: Candidate.nombre queda '' y aparece sin nombre en el banco de candidatos. Con un PUT manual, cartaPresentacion de 2MB se almacena y viaja en cada listado de recruiter/company.
- **Arreglo propuesto:** Definir un schema zod para candidateData (nombre/apellidoPaterno min 1 y trim, telefono con la regex existente, sexo enum M/F/Otro, seniority enum, cartaPresentacion max 1000, lat [-90,90], lng [-180,180], fechaNacimiento pasada). Responder 400 con el primer issue. Anadir `required` en los inputs de la UI.

#### PERF-026 — Upload: `formData.get('file') as File` sin comprobar tipo; un campo de texto o un body no multipart produce 500 en vez de 400

- **Severidad:** ⚪ low · **Categoría:** validation · **Estado:** nuevo · **Verificación:** sin verificar (reportada por 1 auditor)
- **Ubicación:** `src/app/api/upload/route.ts:58`
- **Problema:** formData.get puede devolver un string. El cast oculta el caso: con un string, `file.name` es undefined y `file.name.split` lanza TypeError -> catch -> 500. Igual si el Content-Type no es multipart (request.formData() lanza).
- **Evidencia:**

```ts
57 const formData = await request.formData();
58 const file = formData.get('file') as File;
60 if (!file) {
...
77 const fileExtension = '.' + file.name.split('.').pop()?.toLowerCase();
```

- **Escenario de fallo:** POST /api/upload con -F 'file=hola' (texto) -> 500 'Error al subir el archivo' y traza en logs, en lugar de 400.
- **Arreglo propuesto:** `const file = formData.get('file'); if (!(file instanceof File)) return 400`. Envolver request.formData() en try/catch propio que devuelva 400. Truncar sanitizedName a ~100 caracteres.

#### PERF-027 — Upload: no se verifica el contenido real del archivo; el caso 'HTML renombrado a .pdf' que el fix #54 dice bloquear sigue pasando

- **Severidad:** ⚪ low · **Categoría:** security · **Estado:** arreglo previo incompleto · **Verificación:** sin verificar (reportada por 1 auditor)
- **Ubicación:** `src/app/api/upload/route.ts:76`
- **Problema:** La validacion sigue basandose solo en file.name y file.type, ambos del cliente. Un HTML renombrado a .pdf llega con type 'application/pdf' (el navegador lo deriva de la extension), asi que pasa ambos controles. No se inspeccionan magic bytes. La ruta es publica. Impacto acotado porque Blob sirve el Content-Type segun la extension (no hay XSS), pero permite alojar contenido arbitrario y adjuntar basura como 'CV'.
- **Evidencia:**

```ts
76 const GENERIC_MIME_TYPES = ['', 'application/octet-stream'];
77 const fileExtension = '.' + file.name.split('.').pop()?.toLowerCase();
78 const isValidExtension = ALLOWED_EXTENSIONS.includes(fileExtension);
79 const isAllowedMime = ALLOWED_MIME_TYPES.includes(file.type);
80 const isGenericMime = GENERIC_MIME_TYPES.includes(file.type);
82 if (!isValidExtension || (!isAllowedMime && !isGenericMime)) {
```

- **Escenario de fallo:** Cliente anonimo: curl -F 'file=@payload.bin;filename=cv.pdf;type=application/pdf' https://sitio/api/upload -> 200 con URL publica. El binario queda alojado bajo el store de la empresa.
- **Arreglo propuesto:** Leer los primeros bytes y comprobar la firma segun la extension: %PDF- (pdf), FF D8 FF (jpg), 89 50 4E 47 (png), RIFF....WEBP, D0 CF 11 E0 (doc/xls), PK\x03\x04 (docx/xlsx). Rechazar con 400 si no coincide. Corregir el comentario de la linea 69-75.

#### PERF-028 — El limite de 5 MB del upload es inalcanzable en Vercel (tope de 4.5 MB por request) y el archivo se bufferiza completo antes de validar

- **Severidad:** ⚪ low · **Categoría:** reliability · **Estado:** nuevo · **Verificación:** sin verificar (reportada por 2 auditores)
- **Ubicación:** `src/app/api/upload/route.ts:93` · relacionados: `src/app/register/page.tsx`, `src/app/profile/page.tsx`, `src/components/sections/admin/CandidateForm.tsx`
- **Problema:** La ruta recibe el archivo a traves de la funcion serverless (request.formData() carga todo en memoria) y valida tamano despues. Las funciones de Vercel rechazan cuerpos mayores a 4.5 MB con un 413 de plataforma antes de ejecutar el handler, asi que los archivos entre 4.5 y 5 MB que la UI anuncia como validos fallan con una respuesta no JSON. Ademas cada subida viaja dos veces (cliente->funcion->Blob).
- **Evidencia:**

```ts
const formData = await request.formData();
const file = formData.get('file') as File;
...
// Validar tamaño (máximo 5MB)
const maxSize = 5 * 1024 * 1024; // 5MB
if (file.size > maxSize) {
```

- **Escenario de fallo:** Un candidato sube un CV escaneado de 4.8 MB desde /register (la UI dice 'maximo 5MB'): Vercel responde 413 FUNCTION_PAYLOAD_TOO_LARGE en texto plano, el cliente hace res.json() sobre esa respuesta, lanza excepcion y muestra un error generico de conexion; el candidato no puede completar el registro.
- **Arreglo propuesto:** Migrar a subida directa al Blob con @vercel/blob/client (upload() en el navegador + handleUpload() en la ruta para emitir el token con allowedContentTypes y maximumSizeInBytes), lo que elimina el tope de 4.5 MB y el doble salto. Como medida inmediata bajar el limite anunciado y validado a 4 MB en cliente y servidor y manejar respuestas no JSON en los fetch de upload.
- **Otros auditores añaden:** Bajar el limite efectivo a 4MB en servidor y en todos los textos/validaciones de cliente, o migrar a subidas directas con @vercel/blob/client (handleUpload + token firmado) que no pasan por la funcion.

#### PERF-029 — La URL publica de los archivos depende de Math.random (6 caracteres) e incluye el nombre original; con @vercel/blob 2.x no se anade sufijo aleatorio

- **Severidad:** ⚪ low · **Categoría:** security · **Estado:** pendiente conocido de junio · **Verificación:** sin verificar (reportada por 1 auditor)
- **Ubicación:** `src/app/api/upload/route.ts:118`
- **Problema:** Mientras siga pendiente #56, lo unico que protege CVs, identificaciones y constancias es lo inadivinable de la URL. El nombre se compone de Date.now() + 6 caracteres base36 de Math.random() (no criptografico) + el nombre original (que suele contener el nombre de la persona). En @vercel/blob ^2.0.0 addRandomSuffix es false por defecto.
- **Evidencia:**

```ts
117 const timestamp = Date.now();
118 const randomStr = Math.random().toString(36).substring(2, 8);
119 const sanitizedName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
120 const uniqueFileName = `${timestamp}-${randomStr}-${sanitizedName}`;
...
141 const blob = await put(uniqueFileName, file, {
142   access: 'public'
143 });
```

- **Escenario de fallo:** Quien conozca la hora aproximada de una postulacion y el patron de nombre del CV reduce la busqueda a ~2^31 combinaciones por milisegundo; ademas el nombre de la persona queda expuesto en la URL que viaja en logs, referers y correos.
- **Arreglo propuesto:** Usar `crypto.randomUUID()` como nombre (`${uuid}${fileExtension}`), pasar `addRandomSuffix: true` a put(), y guardar el nombre original solo en BD. Resolver #56 con URLs firmadas.

#### PERF-030 — Modal de educacion sin validacion de anos: min/max no se aplican (esta fuera del <form>) y se acepta fin < inicio

- **Severidad:** ⚪ low · **Categoría:** validation · **Estado:** nuevo · **Verificación:** sin verificar (reportada por 1 auditor)
- **Ubicación:** `src/app/profile/page.tsx:471`
- **Problema:** Los modales se renderizan fuera del <form> y 'Guardar' es type=button, por lo que min=1950/max=2030 nunca se validan. saveEducation solo comprueba nivel e institucion; la API tampoco valida. Ademas max=2030 esta hardcodeado.
- **Evidencia:**

```ts
471 const saveEducation = () => {
472   if (!eduForm.nivel || !eduForm.institucion) {
473     setError('Nivel de estudios e institución son requeridos');
474     return;
475   }
...
482   añoInicio: eduForm.añoInicio ? Number(eduForm.añoInicio) : null,
483   añoFin: eduForm.añoFin ? Number(eduForm.añoFin) : null,
```

- **Escenario de fallo:** Candidato teclea Ano de inicio '20222' y Ano de fin '2018': se guarda y la ficha ante la empresa muestra '20222 - 2018'.
- **Arreglo propuesto:** En saveEducation validar enteros en [1950, anoActual+8] y añoFin >= añoInicio, con error dentro del modal; replicar la regla en el schema zod de la API. Calcular `max` dinamicamente.

#### PERF-031 — Errores reales del servidor al subir documento/foto se sustituyen por 'Error de conexion' / mensaje generico

- **Severidad:** ⚪ low · **Categoría:** ux · **Estado:** nuevo · **Verificación:** sin verificar (reportada por 1 auditor)
- **Ubicación:** `src/app/profile/page.tsx:657`
- **Problema:** En handleAddDocument, si /api/upload responde 400/429 se hace `throw new Error(errorData.error)`, pero el catch ignora `err` y pone 'Error de conexion'. Se pierden 'Archivo muy grande', 'Tipo de archivo no permitido' y 'Demasiadas solicitudes'. handleFotoUpload hace lo mismo con 'Error al subir foto'. Tampoco hay validacion de tamano en cliente para documentos.
- **Evidencia:**

```ts
657 if (!uploadResponse.ok) {
658   const errorData = await uploadResponse.json().catch(() => ({}));
659   throw new Error(errorData.error || 'Error al subir archivo');
660 }
...
697 } catch (err) {
698   setError('Error de conexión');
699 } finally {
```

- **Escenario de fallo:** Candidato intenta agregar un documento .heic: el servidor responde 400 'Tipo de archivo no permitido...', pero la UI muestra 'Error de conexion'; reintenta varias veces creyendo que es su internet y acaba en 429.
- **Arreglo propuesto:** En los catch usar `setError(err instanceof Error ? err.message : 'Error de conexión')`, o sustituir los throw por setError(...) + return como ya hace CandidateProfileModal. Validar tamano y extension en cliente antes de subir.

#### PERF-032 — fileType se guarda como el subtipo MIME completo: los .docx/.xlsx muestran 'VND.OPENXMLFORMATS-OFFICEDOCUMENT...' en la ficha

- **Severidad:** ⚪ low · **Categoría:** ux · **Estado:** nuevo · **Verificación:** sin verificar (reportada por 1 auditor)
- **Ubicación:** `src/app/profile/page.tsx:677` · relacionados: `src/components/shared/CandidateProfileModal.tsx`
- **Problema:** Se envia `newDocFile.type.split('/')[1]`; para Office ese valor es una cadena enorme que el modal pinta en mayusculas sin truncar (modal 1163-1165). El modal tiene la misma logica en la linea 659. Si type viene vacio se guarda 'file'.
- **Evidencia:**

```ts
674 body: JSON.stringify({
675   name: newDocName.trim(),
676   fileUrl: uploadData.url,
677   fileType: newDocFile.type.split('/')[1] || 'file'
678 })
// CandidateProfileModal.tsx 1163-1164
{doc.fileType && (
  <p className="text-xs text-gray-500 uppercase">{doc.fileType}</p>
```

- **Escenario de fallo:** Candidato sube 'Titulo.docx'; en la ficha del reclutador la tarjeta muestra 'VND.OPENXMLFORMATS-OFFICEDOCUMENT.WORDPROCESSINGML.DOCUMENT' y descuadra la cuadricula.
- **Arreglo propuesto:** Derivar de la extension: `newDocFile.name.split('.').pop()?.toLowerCase()`. Anadir `truncate` al <p> del modal.

#### PERF-033 — Editar a mano 'Ubicacion cercana' deja las coordenadas anteriores: el badge de distancia se calcula con la ubicacion vieja

- **Severidad:** ⚪ low · **Categoría:** correctness · **Estado:** nuevo · **Verificación:** sin verificar (reportada por 1 auditor)
- **Ubicación:** `src/app/profile/page.tsx:1027`
- **Problema:** latitude/longitude solo se actualizan en onPlaceChanged. El onChange del input cambia el texto pero no invalida las coordenadas; al guardar se envian el texto nuevo y las coordenadas antiguas. Igual si se borra el campo (ubicacionCercana -> null, lat/lng intactos).
- **Evidencia:**

```ts
1024 <input
1025   type="text"
1026   value={ubicacionCercana}
1027   onChange={(e) => setUbicacionCercana(e.target.value)}
...
// handleSubmit 311-313
ubicacionCercana: ubicacionCercana || null,
latitude: candidateLatitude,
longitude: candidateLongitude,
```

- **Escenario de fallo:** Candidato que vivia en Monterrey se muda a CDMX, escribe 'Roma Norte, CDMX' sin elegir la sugerencia y guarda. La ficha muestra 'Roma Norte, CDMX' pero DistanceBadge calcula la distancia desde Monterrey.
- **Arreglo propuesto:** En el onChange manual poner setCandidateLatitude(null) y setCandidateLongitude(null); solo fijar coordenadas desde onPlaceChanged.

#### PERF-034 — Modales e iconos de /profile sin semantica accesible: sin role=dialog, sin Escape, botones de icono sin nombre, labels no asociados

- **Severidad:** ⚪ low · **Categoría:** a11y · **Estado:** nuevo · **Verificación:** sin verificar (reportada por 1 auditor)
- **Ubicación:** `src/app/profile/page.tsx:1540`
- **Problema:** El sweep #59/#60 no cubrio esta pagina. Los tres modales no tienen role="dialog"/aria-modal/aria-labelledby, no cierran con Escape ni gestionan foco. Botones solo-icono sin aria-label: cerrar (1540, 1678, 1810), editar/eliminar educacion (1100-1113), experiencia (1420-1433), eliminar CV (1268-1274) y documento (1348-1354), descartar banner '×' (847, 855), mostrar contrasena (1465, 1485). Ningun <label> usa htmlFor/id salvo 'esActual'. Los inputs file ocultos con `hidden` no son alcanzables por teclado.
- **Evidencia:**

```ts
1533 {showExpModal && (
1534   <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
1535     <div className="bg-white rounded-lg max-w-lg w-full max-h-[90vh] overflow-y-auto">
...
1540       <button onClick={() => setShowExpModal(false)} className="text-gray-400 hover:text-gray-600">
1541         <X size={24} />
1542       </button>
```

- **Escenario de fallo:** Usuario de lector de pantalla abre 'Nueva Experiencia': el foco sigue en el boton detras del overlay, el lector anuncia 'boton' sin nombre y Escape no cierra.
- **Arreglo propuesto:** Extraer un componente <Modal> compartido con role=dialog, aria-modal, aria-labelledby, Escape, foco inicial/restauracion y trampa de foco. Anadir aria-label a los botones de icono. Asociar labels con htmlFor/id. Sustituir `hidden` por `sr-only` en los inputs file.

#### PERF-035 — CandidateProfileModal declara aria-modal pero no gestiona el foco; el sub-modal carece de role=dialog y Escape cierra el modal padre

- **Severidad:** ⚪ low · **Categoría:** a11y · **Estado:** arreglo previo incompleto · **Verificación:** sin verificar (reportada por 1 auditor)
- **Ubicación:** `src/components/shared/CandidateProfileModal.tsx:271`
- **Problema:** El fix #59 anadio role=dialog/aria-modal/Escape, pero no mueve el foco al dialogo al abrir, no lo atrapa ni lo restaura, y no bloquea el scroll del body. El sub-modal 'Agregar Documento' no tiene role/aria y el listener global de Escape llama a onClose del padre aunque el sub-modal este abierto (dejando showAddDocModal=true).
- **Evidencia:**

```ts
271 useEffect(() => {
272   if (!isOpen) return;
273   const onKey = (e: KeyboardEvent) => {
274     if (e.key === 'Escape') onClose();
275   };
276   document.addEventListener('keydown', onKey);
277   return () => document.removeEventListener('keydown', onKey);
278 }, [isOpen, onClose]);
```

- **Escenario de fallo:** Reclutador navegando con teclado abre la ficha: Tab sigue recorriendo los botones de la lista tapada. Con 'Agregar Documento' abierto pulsa Escape para cancelar solo ese paso y se cierra toda la ficha; al reabrir otra, el sub-modal reaparece.
- **Arreglo propuesto:** En el handler: `if (showAddDocModal) { cerrar sub-modal; return; }`. Al abrir, enfocar el contenedor (tabIndex=-1, ref) y restaurar el foco al cerrar; trampa de foco; `document.body.style.overflow='hidden'` mientras isOpen. Dar role=dialog/aria-modal/aria-label al sub-modal.

#### PERF-036 — El modal de perfil muestra el status crudo en ingles para estados sin etiqueta (injected_by_admin, company_interested, interviewed, accepted, rejected, archived)

- **Severidad:** ⚪ low · **Categoría:** copy · **Estado:** nuevo · **Verificación:** sin verificar (reportada por 2 auditores)
- **Ubicación:** `src/components/shared/CandidateProfileModal.tsx:503` · relacionados: `src/app/recruiter/dashboard/page.tsx`
- **Problema:** getStatusBadge solo traduce pending, reviewing, sent_to_specialist, evaluating, sent_to_company, hired, discarded y los status del banco. Para el resto cae en `labels[status] || status`. La pestana 'Por revisar' del reclutador incluye postulaciones 'injected_by_admin', y el dashboard envia 'rejected' en 'Enviados'.
- **Evidencia:**

```ts
    const labels: Record<string, string> = {
      pending: 'Pendiente',
      reviewing: 'En revisión',
      sent_to_specialist: 'Enviado a especialista',
      evaluating: 'En evaluación técnica',
      sent_to_company: 'Enviado a empresa',
      hired: 'Contratado',
      discarded: 'Descartado',
```

- **Escenario de fallo:** El reclutador abre el perfil de un candidato inyectado por el admin: la insignia junto al nombre dice literalmente 'injected_by_admin' en gris. En 'Enviados', un candidato rechazado por la empresa muestra 'rejected'.
- **Arreglo propuesto:** Completar ambos mapas (injected_by_admin: 'Asignado por INAKAT', company_interested: 'Interesa a la empresa', interviewed: 'Entrevistado', accepted: 'Contratado', rejected: 'Rechazado por empresa', archived: 'Archivado') o centralizar etiquetas y colores de status en src/lib y reutilizarlos en dashboards y modal.
- **Otros auditores añaden:** Anadir los estados faltantes a `badges` y `labels` (company_interested: 'Interesa a la empresa', interviewed: 'Entrevistado', accepted: 'Contratado', rejected: 'Rechazado', injected_by_admin: 'Agregado por admin', archived: 'Archivado'), idealmente desde una constante compartida.

#### PERF-037 — Cierre por clic en overlay con onClick: arrastrar una seleccion de texto hasta fuera del dialogo cierra el modal y borra el borrador de nota

- **Severidad:** ⚪ low · **Categoría:** ux · **Estado:** arreglo previo incompleto · **Verificación:** sin verificar (reportada por 1 auditor)
- **Ubicación:** `src/components/shared/CandidateProfileModal.tsx:689`
- **Problema:** Cuando mousedown ocurre dentro del dialogo y mouseup sobre el overlay, el navegador despacha `click` sobre el ancestro comun (el overlay), que no pasa por el stopPropagation del dialog. onClose se ejecuta y el efecto de cierre hace setNewNoteContent('').
- **Evidencia:**

```ts
687 <div
688   className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 fade-in-fast"
689   onClick={onClose}
690 >
691   <div
692     role="dialog"
...
695     onClick={(e) => e.stopPropagation()}
```

- **Escenario de fallo:** Especialista selecciona con el raton parte de su nota larga arrastrando hacia la derecha y suelta el boton fuera de la tarjeta blanca: el modal se cierra y el texto se pierde.
- **Arreglo propuesto:** Sustituir por `onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}` y quitar el stopPropagation del dialog. Pedir confirmacion si hay borrador sin guardar.
