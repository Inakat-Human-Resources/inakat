# Integración Worky2, notificaciones, correo y librerías

[← volver al índice](../AUDITORIA-2026-09.md) · 34 hallazgos — 🔴 1 critical · 🟠 6 high · 🟡 6 medium · ⚪ 21 low

## 🔴 critical (1)

#### PLAT-001 — XSS almacenado sin autenticacion que permite tomar control del admin: URLs javascript: en la solicitud de empresa se abren con window.open

- **Severidad:** 🔴 critical · **Categoría:** security · **Estado:** nuevo · **Verificación:** ✅ verificada contra el código
- **Ubicación:** `src/lib/validations.ts:32` · relacionados: `src/components/sections/admin/RequestDetailModal.tsx`, `src/app/api/company-requests/route.ts`, `src/app/api/company-requests/[id]/route.ts`, `src/app/api/company/profile/route.ts`, `src/app/api/auth/register/route.ts`, `src/app/api/admin/candidates/[id]/documents/route.ts`, `src/app/api/evaluations/notes/route.ts`, `src/app/api/profile/documents/route.ts`
- **Problema:** El registro publico de empresas valida identificacionUrl/documentosConstitucionUrl/sitioWeb con z.string().url(), que en zod 4 solo hace new URL() y por tanto acepta 'javascript:...'. El panel de admin abre esas URLs con window.open(url,'_blank'), un sink que React 19 NO protege (React 19 solo bloquea javascript: en atributos href). El script corre en about:blank heredando el origen de la app y la cookie de sesion del admin. El helper isSafeDocumentUrl (arreglo #55) existe solo en profile/documents; el resto de rutas que guardan URLs no lo usan.
- **Comprobación:** Confirmado: `z.string().url()` acepta `javascript:...`; el arreglo #55 de junio sólo se aplicó a `fileUrl` de documentos (`isSafeDocumentUrl`), no a estos campos.
- **Evidencia:**

```ts
// src/lib/validations.ts:32-33
identificacionUrl: z.string().url().optional().or(z.literal('')),
documentosConstitucionUrl: z.string().url().optional().or(z.literal(''))

// src/components/sections/admin/RequestDetailModal.tsx:137-139 y 346
const openFile = (url: string) => {
  window.open(url, '_blank');
};
...
onClick={() => openFile(request.identificacionUrl!)}
```

- **Escenario de fallo:** 1) Visitante anonimo hace POST /api/company-requests (publico, sin rate limit) con datos validos e identificacionUrl = "javascript:fetch('/api/admin/users',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:'x@evil.com',password:'Passw0rd1',nombre:'x',role:'admin'})})". zod lo acepta y se guarda. 2) El admin entra a /admin/requests, abre la solicitud y pulsa 'Ver identificacion' (flujo normal de aprobacion). 3) window.open ejecuta el javascript: con el origen de INAKAT y la cookie del admin; se crea un usuario admin del atacante. No hay CSP que lo mitigue (pendiente #86).
- **Arreglo propuesto:** Crear src/lib/safe-url.ts con isSafeHttpUrl (mover isSafeDocumentUrl de profile/documents) y usarlo en companyRequestSchema: z.url({ protocol: /^https?$/ }) y, para archivos subidos, exigir ademas hostname *.public.blob.vercel-storage.com (o ruta /uploads/ en dev). En RequestDetailModal validar el protocolo antes de abrir y usar window.open(url,'_blank','noopener,noreferrer') o un <a href target=_blank rel=noopener>. Aplicar el mismo helper en: PUT /api/company-requests/[id] (sitioWeb), PUT /api/company/profile (sitioWeb, logoUrl), POST /api/auth/register (documents[].fileUrl, fotoUrl), POST /api/admin/candidates y /api/admin/candidates/[id]/documents (fileUrl), POST /api/evaluations/notes (documentUrl), PATCH /api/admin/interviews/[id] (meetingUrl), PUT commissions (paymentProofUrl), POST /api/applications (cvUrl). Escribir script de saneo para filas existentes con esquemas no http(s).

## 🟠 high (6)

#### PLAT-002 — Los mensajes del formulario de contacto se guardan pero nadie puede leerlos ni es avisado

- **Severidad:** 🟠 high · **Categoría:** correctness · **Estado:** nuevo · **Verificación:** ✅ verificada contra el código
- **Ubicación:** `src/app/api/contact/route.ts:31` · relacionados: `src/app/contact/page.tsx`, `src/lib/notifications.ts`, `src/lib/email.ts`, `prisma/schema.prisma`
- **Problema:** POST /api/contact solo hace `prisma.contactMessage.create`. En todo `src/` no existe ninguna lectura de `contactMessage` (grep: unicas apariciones son este create y el schema zod), no hay ruta ni pagina admin para verlos, no se llama a `notifyAllAdmins` ni se envia email. El usuario ve 'Mensaje enviado exitosamente! Nos contactaremos contigo pronto', pero el lead queda en una tabla que solo se puede consultar entrando directo a la base de datos.
- **Comprobación:** Confirmado: no hay ninguna lectura de `contactMessage` fuera de la propia ruta ni envío de aviso.
- **Evidencia:**

```ts
const contactMessage = await prisma.contactMessage.create({
  data: {
    nombre,
    email,
    telefono: telefono || null,
    mensaje,
  },
});

return NextResponse.json(
  { success: true, message: "Message received successfully", data: contactMessage },
```

- **Escenario de fallo:** Un director de RH interesado en contratar a INAKAT escribe desde /contact. Recibe confirmacion en pantalla. Ningun admin recibe notificacion, email ni tiene una vista /admin donde aparezca; el lead se pierde.
- **Arreglo propuesto:** Tras el create: `await Promise.allSettled([notifyAllAdmins({type:'new_request'|nuevo tipo 'contact_message', title:'Nuevo mensaje de contacto', message:`${nombre}: ${mensaje.slice(0,120)}`, link:'/admin/contact-messages'}), sendEmail({to: process.env.CONTACT_INBOX || 'info@inakat.com', replyTo: email, subject:'Nuevo mensaje de contacto', html: baseTemplate con escapeHtml})])`. Crear GET /api/admin/contact-messages (paginado, requireRole('admin')) y la pagina /admin/contact-messages enlazada en el menu admin del Navbar.
- **Otros auditores añaden:** Tras el create: `await Promise.allSettled([notifyAllAdmins({type:'contact_message',...}), sendEmail({to: CONTACT_INBOX, replyTo: email, subject, html con escapeHtml})])`, y anadir GET /api/admin/contact-messages + pagina /admin/messages con marcado de leido. No devolver el registro completo en la respuesta publica (basta {success:true}).

#### PLAT-003 — La API key de integracion sigue funcionando aunque la empresa duena este desactivada (bypass del soft-delete de usuarios)

- **Severidad:** 🟠 high · **Categoría:** authz · **Estado:** nuevo · **Verificación:** sin verificar (reportada por 1 auditor)
- **Ubicación:** `src/lib/integration-auth.ts:153` · relacionados: `src/app/api/admin/users/route.ts`, `src/lib/worky2-webhook.ts`, `prisma/schema.prisma`
- **Problema:** `requireApiKey` solo comprueba `IntegrationApiKey.isActive`; no carga ni valida al usuario dueno (`user.isActive`, `user.role`). El admin 'elimina' empresas con soft delete (`DELETE /api/admin/users` -> `isActive:false`, src/app/api/admin/users/route.ts:355-358). Tras eso `requireAuth`/`requireCompanyUser` bloquean la sesion web, pero la API key (que no tiene expiracion) sigue devolviendo nombre, email, telefono, URL de CV y evaluaciones de todos los candidatos aceptados. Como la empresa desactivada ya no puede entrar a revocar la key y el admin no tiene endpoint para revocarla, el acceso queda abierto indefinidamente. `dispatchCandidateAccepted` tampoco valida que la empresa siga activa.
- **Evidencia:**

```ts
const apiKey = await prisma.integrationApiKey.findUnique({
  where: { keyHash },
  select: { id: true, userId: true, name: true, isActive: true }
});

if (!apiKey || !apiKey.isActive) {
  return { error: 'API key inválida', status: 401 };
}
```

- **Escenario de fallo:** 1) La empresa X crea una key. 2) INAKAT detecta fraude y el admin desactiva a X desde /admin/users (isActive=false). 3) X (o quien tenga la key filtrada) sigue llamando GET /api/integration/candidates con X-Api-Key y recibe 200 con la PII de todos los candidatos aceptados, sin limite de tiempo.
- **Arreglo propuesto:** En `requireApiKey` incluir el dueno: `select: { id, userId, name, isActive, user: { select: { isActive: true, role: true } } }` y rechazar con 401 si `!apiKey.user.isActive || apiKey.user.role !== 'company'`. En el DELETE/PUT de admin/users que desactiva, ejecutar en la misma transaccion `integrationApiKey.updateMany({ where:{userId}, data:{isActive:false} })` e `integrationWebhook.updateMany(...)`. Agregar `expiresAt` opcional a la key.

#### PLAT-004 — La integracion exporta `Application.notes` (notas internas) al integrador, reabriendo la fuga #50/#51

- **Severidad:** 🟠 high · **Categoría:** security · **Estado:** arreglo previo incompleto · **Verificación:** ✅ verificada contra el código
- **Ubicación:** `src/lib/integration-candidate.ts:197` · relacionados: `src/app/api/company/dashboard/route.ts`, `src/app/api/applications/[id]/route.ts`, `src/app/api/company/jobs/[jobId]/candidates/route.ts`, `docs/WORKY2_INTEGRATION.md`
- **Problema:** La auditoria de junio clasifico `Application.notes` como campo de notas internas y lo elimino de la respuesta del dashboard de empresa (src/app/api/company/dashboard/route.ts:153-155: 'SEGURIDAD (#50/#51): no exponer Application.notes'). El mapper del contrato Worky2, agregado despues, lo publica como `notasAdicionales` tanto en GET /api/integration/candidates como en el payload del webhook. Ese campo lo escribe el admin via PATCH /api/applications/[id] (`updateData.notes = notes`), por lo que comentarios internos de INAKAT sobre el candidato salen a la empresa y a un sistema de terceros. El comentario del propio archivo afirma respetar 'la misma visibilidad que su panel', lo cual es falso para este campo.
- **Comprobación:** Confirmado: `notasAdicionales: application.notes ?? null`.
- **Evidencia:**

```ts
// src/lib/integration-candidate.ts:195-198
    evaluacionPsicologica,
    evaluacionTecnica,
    notasAdicionales: application.notes ?? null,
    puesto: application.job.title ?? null,

// src/app/api/company/dashboard/route.ts:153-155
// SEGURIDAD (#50/#51): no exponer Application.notes (campo de notas internas)
// a la empresa. Se elimina del spread.
const { notes: _internalNotes, ...appPublic } = app;
```

- **Escenario de fallo:** Un admin anota en la aplicacion 123 'pide 20% mas de sueldo que la banda, negociar; referencia negativa del ex-jefe'. La empresa acepta al candidato. Worky2 (o cualquiera con la API key de la empresa) recibe ese texto en `notasAdicionales` via webhook y via GET /api/integration/candidates, aunque el panel de empresa lo oculta deliberadamente.
- **Arreglo propuesto:** Quitar `notasAdicionales: application.notes` del mapper (enviar null) o alimentarlo solo con EvaluationNote `isPublic:true`. Si la empresa necesita sus propias notas, separar el campo en `Application.companyNotes` (escrito por la empresa) e `internalNotes` (admin/recruiter) con migracion, y exportar unicamente el primero. Actualizar docs/WORKY2_INTEGRATION.md:41.
- **Otros auditores añaden:** Eliminar `notasAdicionales` del mapeo (devolver null) o alimentarlo solo con EvaluationNote isPublic=true; actualizar docs/WORKY2_INTEGRATION.md:41; anadir un test que cree una Application con notes y verifique que ni GET /api/integration/candidates ni el payload del webhook lo contienen.

#### PLAT-005 — El login exige contraseña de 8+ caracteres, pero el admin crea usuarios con 6-7: esas cuentas nunca pueden iniciar sesion

- **Severidad:** 🟠 high · **Categoría:** correctness · **Estado:** nuevo · **Verificación:** ✅ verificada contra el código
- **Ubicación:** `src/lib/validations.ts:11` · relacionados: `src/app/api/auth/login/route.ts`, `src/app/login/page.tsx`, `src/app/api/admin/users/route.ts`, `src/app/admin/users/page.tsx`, `src/app/api/admin/vendors/route.ts`, `src/app/admin/vendors/page.tsx`
- **Problema:** loginSchema aplica la POLITICA de contraseña (min 8) al formulario de login. Pero otras rutas crean cuentas con contraseñas mas cortas: POST/PUT /api/admin/users acepta >= 6 (y su UI tiene minLength={6}), y POST /api/admin/vendors no valida longitud (su UI dice 'Minimo 6 caracteres'). Cualquier reclutador, especialista, admin o vendor creado con 6-7 caracteres queda bloqueado en /login: el API responde 400 antes de comparar el hash, y ademas la pagina muestra un mensaje generico (ver hallazgo de errors[]). Un login solo debe validar presencia, nunca politica.
- **Comprobación:** Confirmado: `loginSchema` exige `min(8)`.
- **Evidencia:**

```ts
// src/lib/validations.ts:9-12
export const loginSchema = z.object({
  email: z.string().email('Email inválido'),
  password: z.string().min(8, 'La contraseña debe tener al menos 8 caracteres')
});
// src/app/api/admin/users/route.ts:155
    if (password.length < 6) {
// src/app/admin/users/page.tsx:567
                    minLength={6}
// src/app/admin/vendors/page.tsx:981
                    placeholder="Mínimo 6 caracteres"
```

- **Escenario de fallo:** 1) Admin entra a /admin/users y crea un reclutador con contraseña 'reclu1' (la UI y el API lo aceptan). 2) El reclutador va a /login, escribe su email y 'reclu1'. 3) POST /api/auth/login -> validate(loginSchema) falla -> 400 {success:false, errors:[{field:'password',...}]}. 4) La pagina muestra 'Error al iniciar sesión' (generico). El usuario jamas puede entrar aunque sus credenciales son correctas; el admin no recibe ninguna pista.
- **Arreglo propuesto:** En loginSchema dejar password como z.string().min(1, 'La contraseña es requerida'). Crear un passwordSchema compartido (8+, 1 mayuscula, 1 numero) en src/lib/validations.ts y usarlo en register, reset-password, profile, admin/users (POST y PUT), admin/vendors y admin/candidates; actualizar minLength/placeholder en src/app/admin/users/page.tsx y src/app/admin/vendors/page.tsx a 8.
- **Otros auditores añaden:** En `loginSchema` dejar `password: z.string().min(1, 'La contraseña es requerida')`. Unificar la politica de creacion: en admin/users POST y PUT exigir el mismo minimo (8) que register/reset-password, idealmente exportando un `passwordSchema` unico desde validations.ts. En login/page.tsx mostrar `data.errors?.[0]?.message`. — En loginSchema dejar `password: z.string().min(1, 'La contraseña es requerida').max(200)`; la politica de complejidad solo aplica al crear/cambiar contrasena. Unificar esa politica en un `passwordSchema` exportado desde validations.ts y usarlo en register, reset-password, admin/users (POST y PUT), admin/vendors, admin/candidates, company-requests y profile. En login/page.tsx mostrar `data.error ?? data.errors?.[0]?.message`.

#### PLAT-006 — Registro de empresas roto: el schema zod rechaza el `sitioWeb: null` que envia el formulario (y URLs sin protocolo)

- **Severidad:** 🟠 high · **Categoría:** correctness · **Estado:** arreglo previo incompleto · **Verificación:** ✅ verificada contra el código
- **Ubicación:** `src/lib/validations.ts:23` · relacionados: `src/components/sections/companies/FormRegisterForQuotationSection.tsx`, `src/app/api/company-requests/route.ts`
- **Problema:** La remediacion #9/#52 de junio empezo a aplicar `companyRequestSchema` en POST /api/company-requests, pero el schema no coincide con lo que manda la UI. El formulario envia `sitioWeb: formData.sitioWeb || null` cuando el campo (marcado como opcional) esta vacio. En zod 4 `.optional()` solo acepta `undefined`; `null` no es string ni el literal ''. Resultado: 400 'Datos invalidos'. Ademas el front valida la URL con una regex que acepta 'www.empresa.com' o 'empresa.com' sin protocolo, y `z.string().url()` (new URL) las rechaza. La UI solo muestra `data.error` ('Datos invalidos'), nunca el arreglo `errors`, asi que la empresa no sabe que campo falla, y para entonces ya subio identificacion y acta a Blob (archivos huerfanos por cada intento). Efecto secundario: `razonSocial.min(5)` rechaza razones sociales de 3-4 caracteres que el front acepta, y en desarrollo sin BLOB token `identificacionUrl: '/uploads/...'` tampoco pasa `.url()`.
- **Comprobación:** Confirmado: `sitioWeb: z.string().url().optional().or(z.literal(""))` — `.optional()` admite `undefined`, nunca `null`.
- **Evidencia:**

```ts
// src/lib/validations.ts:23
sitioWeb: z.string().url('URL inválida').optional().or(z.literal('')),

// src/components/sections/companies/FormRegisterForQuotationSection.tsx:425
sitioWeb: formData.sitioWeb || null,

// src/app/api/company-requests/route.ts:46
const validation = validate(companyRequestSchema, body);
if (!validation.success) {
  return NextResponse.json({ error: "Datos inválidos", errors: validation.errors }, { status: 400 });
```

- **Escenario de fallo:** Una empresa sin sitio web llena el formulario de /companies, deja vacio 'Sitio web (opcional)' y envia. El front sube los 2 documentos y hace POST /api/company-requests con `sitioWeb: null`. zod falla (invalid_union) -> 400. La UI muestra el toast 'Datos invalidos' sin indicar el campo. La empresa no puede registrarse nunca salvo que invente una URL con https://. Lo mismo si escribe 'www.miempresa.com'.
- **Arreglo propuesto:** En validations.ts normalizar antes de validar: `sitioWeb: z.preprocess(v => (v == null || v === '') ? undefined : (typeof v === 'string' && !/^https?:\/\//i.test(v.trim()) ? `https://${v.trim()}` : v), z.string().url('URL inválida').optional())`; aplicar `.nullish()` equivalente a identificacionUrl/documentosConstitucionUrl y aceptar rutas relativas solo en desarrollo. En el formulario mostrar `data.errors?.[0]?.message` ademas de `data.error`. Agregar un test que haga parse del payload EXACTO que arma el formulario (con sitioWeb null y con 'www.x.com').

#### PLAT-007 — El webhook candidate.accepted se dispara con `void` (fire-and-forget) y en Vercel serverless se pierde al congelarse la funcion

- **Severidad:** 🟠 high · **Categoría:** reliability · **Estado:** nuevo · **Verificación:** sin verificar (reportada por 1 auditor)
- **Ubicación:** `src/lib/worky2-webhook.ts:43` · relacionados: `src/app/api/company/applications/[id]/route.ts`, `src/app/api/applications/[id]/route.ts`, `docs/WORKY2_INTEGRATION.md`
- **Problema:** `dispatchCandidateAccepted` hace 3 consultas a DB y despues un fetch con timeout de 5 s, pero el contrato documentado obliga a los callers a invocarlo con `void` sin esperar. Ambos callers devuelven la respuesta HTTP casi de inmediato. En Vercel la instancia se congela al terminar la respuesta y las promesas pendientes no tienen garantia de ejecutarse (no se usa `after()` de next/server ni `waitUntil`; grep confirma que no existen en el repo). La propia auditoria de junio (#70) reconocio este problema y lo corrigio SOLO en el webhook de MercadoPago con await+Promise.allSettled 'entrega garantizada en serverless'. Aqui el evento principal de la integracion con Worky2 queda a la suerte del runtime y, como no hay reintentos ni registro de entregas, la perdida es silenciosa.
- **Evidencia:**

```ts
// src/lib/worky2-webhook.ts:37-45
 * de la vacante. FIRE-AND-FORGET: nunca lanza; los callers deben invocarlo con
 * `void dispatchCandidateAccepted(id)` (o `.catch`) para no bloquear ni romper
 * la respuesta HTTP que provocó la aceptación.
 */
export async function dispatchCandidateAccepted(

// src/app/api/company/applications/[id]/route.ts:184-186
if (status === 'accepted') {
  void dispatchCandidateAccepted(applicationId);
}
```

- **Escenario de fallo:** La empresa pulsa 'En proceso de contratacion' en su panel -> PATCH /api/company/applications/123 {status:'accepted'}. La ruta actualiza la Application, lanza `void dispatch...` y responde en ~50 ms. La lambda se congela antes de que terminen loadCandidatoInakat + findMany de webhooks + fetch a Worky2. Worky2 nunca recibe candidate.accepted, no queda log de fallo y el alta del empleado en Worky2 no ocurre hasta que alguien haga polling manual.
- **Arreglo propuesto:** En los dos callers reemplazar `void dispatchCandidateAccepted(id)` por `after(() => dispatchCandidateAccepted(id))` importando `after` de 'next/server' (estable en Next 15.1+, usa waitUntil en Vercel), o bien `await` directo dado que la funcion ya nunca lanza y tiene timeout de 5 s. Actualizar el docblock de worky2-webhook.ts para prohibir el `void` desnudo y exportar `maxDuration` suficiente en ambas rutas.

## 🟡 medium (6)

#### PLAT-008 — La integracion no es usable por una empresa real: no hay pantalla de Integraciones y el JWT que pide la doc es inalcanzable (cookie httpOnly)

- **Severidad:** 🟡 medium · **Categoría:** ux · **Estado:** nuevo · **Verificación:** sin verificar (reportada por 1 auditor)
- **Ubicación:** `src/app/api/integration/keys/route.ts:28` · relacionados: `docs/WORKY2_INTEGRATION.md`, `src/components/commons/Navbar.tsx`, `src/app/api/auth/login/route.ts`, `src/app/api/integration/webhooks/route.ts`
- **Problema:** Las rutas /api/integration/keys y /webhooks solo se consumen desde docs/WORKY2_INTEGRATION.md via curl con `Authorization: Bearer <jwt>`. No existe ninguna pagina bajo src/app/company/ (solo dashboard, profile, interviews, jobs/[jobId]/candidates) ni componente que las llame (grep de 'api/integration' en src solo devuelve los propios archivos). El login nunca devuelve el token en el cuerpo y la cookie es httpOnly, asi que la empresa no tiene forma soportada de obtener el JWT que exige la documentacion. Funcionalidad a medias: backend completo sin UI.
- **Evidencia:**

```ts
/**
 * POST /api/integration/keys
 * Crea una API key nueva. Devuelve la key en claro SOLO en esta respuesta.
 * Body: { name: string }
 */

// docs/WORKY2_INTEGRATION.md:61-62
curl -X POST https://<inakat>/api/integration/keys \
  -H "Authorization: Bearer <jwt>" \

// src/app/api/auth/login/route.ts:59-60
response.cookies.set('auth-token', result.token, {
  httpOnly: true,
```

- **Escenario de fallo:** El responsable de RH de una empresa quiere conectar Worky2. Entra a INAKAT, no encuentra ninguna opcion 'Integraciones' en el menu ni en el perfil. La documentacion le pide un JWT que no puede copiar (httpOnly, no viene en la respuesta de login). Tiene que pedir a soporte tecnico que cree la key por el con DevTools.
- **Arreglo propuesto:** Crear src/app/company/integrations/page.tsx (protegida por el matcher '/company/:path*' ya existente) con: listado/creacion/revocacion de API keys mostrando la key en claro una sola vez con boton copiar, y alta/baja de webhooks (url+secret). Usar fetch con `credentials:'include'` contra las rutas existentes. Enlazarla en el menu de empresa del Navbar (desktop y movil). Corregir la doc para no depender de un Bearer que el usuario no puede obtener.

#### PLAT-009 — SSRF y fuga de PII en webhooks salientes: se acepta cualquier URL http(s), incluidas internas, y fetch sigue redirecciones

- **Severidad:** 🟡 medium · **Categoría:** security · **Estado:** nuevo · **Verificación:** sin verificar (reportada por 3 auditores)
- **Ubicación:** `src/app/api/integration/webhooks/route.ts:11` · relacionados: `src/lib/worky2-webhook.ts`, `src/lib/integration-auth.ts`, `src/app/api/company-requests/route.ts`
- **Problema:** El schema solo exige que la URL empiece por http:// o https://. No bloquea localhost, 127.0.0.0/8, ::1, 10/8, 172.16/12, 192.168/16, 169.254.169.254, ni hostnames que resuelven a esos rangos. El despacho (`fetch(webhook.url, ...)` en worky2-webhook.ts:75) usa `redirect: 'follow'` por defecto, por lo que un 307/308 reenvia el POST con el cuerpo (PII completa del candidato) y la firma a cualquier host. Ademas se permite `http://`, enviando nombre, email, telefono, CV y evaluaciones en claro. Agravante: cualquier visitante puede auto-registrarse como `role:'company'` activo sin aprobacion (POST publico /api/company-requests) y `requireCompanyUser` no exige `CompanyRequest.status==='approved'`, asi que registrar webhooks no requiere ser una empresa verificada.
- **Evidencia:**

```ts
const createWebhookSchema = z.object({
  url: z
    .string()
    .trim()
    .url('URL inválida')
    .refine(
      (value) => value.startsWith('https://') || value.startsWith('http://'),
      'La URL debe ser http(s)'
    ),

// src/lib/worky2-webhook.ts:75
fetch(webhook.url, { method: 'POST', headers: {...}, body, signal: AbortSignal.timeout(WEBHOOK_TIMEOUT_MS) })
```

- **Escenario de fallo:** Una empresa registra `http://169.254.169.254/latest/...` o `http://localhost:3000/api/...` o `https://legit.example/redirect` que responde 307 hacia un host interno. Al aceptar un candidato, el servidor de INAKAT emite el POST hacia la red interna/loopback, o entrega la PII del candidato a un tercero via redireccion. Con `http://` la PII viaja sin cifrar.
- **Arreglo propuesto:** En el schema exigir `https://` (permitir http solo si NODE_ENV!=='production'), rechazar URLs con credenciales y puertos no estandar, y validar el host: resolver con `dns.promises.lookup(host,{all:true})` y rechazar IPs privadas/loopback/link-local/ULA tanto al registrar como justo antes de despachar. En el fetch usar `redirect: 'error'` (o 'manual' tratando 3xx como fallo). En `requireCompanyUser` exigir `companyRequest.status === 'approved'`.
- **Otros auditores añaden:** Exigir https:// en produccion, resolver el host y rechazar rangos privados/loopback/link-local (y `redirect: 'error'` en el fetch de worky2-webhook.ts); documentarlo en docs/WORKY2_INTEGRATION.md. — Exigir https:// y rechazar hosts que resuelvan a rangos privados/loopback/link-local (validar al registrar y de nuevo antes del fetch, con redirect: 'manual'). Exigir empresa aprobada para registrar webhooks/API keys.

#### PLAT-010 — Formulario de contacto: el placeholder del telefono sugiere un formato que la API rechaza y el error no indica el campo

- **Severidad:** 🟡 medium · **Categoría:** ux · **Estado:** nuevo · **Verificación:** sin verificar (reportada por 1 auditor)
- **Ubicación:** `src/app/contact/page.tsx:275` · relacionados: `src/lib/validations.ts`, `src/app/api/contact/route.ts`
- **Problema:** El input de telefono muestra `placeholder="+52 000 000 0000"` y la misma pagina imprime el telefono de INAKAT como '+52 811 631 2490' (con espacios). El schema `contactMessageSchema` valida con `/^(\+?52)?\d{10}$/`, que no admite espacios, guiones ni parentesis. La API devuelve `{ error: 'Datos inválidos', errors: [{field:'telefono', ...}] }`, pero la pagina hace `throw new Error(data.error || ...)` e ignora `errors`, de modo que el usuario solo ve 'Datos invalidos'.
- **Evidencia:**

```ts
// src/app/contact/page.tsx:269-276
<input type="tel" id="telefono" name="telefono" ...
  placeholder="+52 000 000 0000"

// src/app/contact/page.tsx:63
throw new Error(data.error || 'Error al enviar el mensaje');

// src/lib/validations.ts:48
/^(\+?52)?\d{10}$/,
```

- **Escenario de fallo:** Un visitante escribe su telefono tal como lo sugiere el placeholder: '+52 811 123 4567'. Envia -> 400 -> banner rojo 'Datos invalidos' sin decir que el problema es el telefono ni el formato esperado. Tras 5 intentos queda bloqueado 1 hora por el rate limit.
- **Arreglo propuesto:** En la ruta (o con `z.preprocess`) normalizar antes de validar: `telefono.replace(/[\s\-().]/g, '')`. En la pagina mostrar `data.errors?.map(e => e.message).join(' ')` cuando exista y cambiar el placeholder a '10 digitos, ej. 8112345678'. Agregar `maxLength`/`pattern` al input.

#### PLAT-011 — sendCompanyApproved y sendCandidateSentToCompany nunca se llaman: la empresa no recibe correo al ser aprobada ni cuando le llega un candidato, aunque los docs lo prometen

- **Severidad:** 🟡 medium · **Categoría:** correctness · **Estado:** nuevo · **Verificación:** sin verificar (reportada por 2 auditores)
- **Ubicación:** `src/lib/email.ts:168` · relacionados: `src/app/api/company-requests/[id]/route.ts`, `src/app/api/specialist/dashboard/route.ts`, `docs/USER_GUIDE.md`, `__tests__/lib/email.test.ts`
- **Problema:** Grep de todo src: las dos funciones solo aparecen en su definicion (y en __tests__/lib/email.test.ts, que prueba codigo muerto). PATCH /api/company-requests/[id] solo crea una notificacion in-app; el envio a empresa desde el dashboard del especialista no manda correo. docs/USER_GUIDE.md:154-157 y :349 aseguran que la empresa 'recibira un email', y .env.example:94 declara SMTP 'REQUIRED in production'. README.md:260 sigue listando los emails como 'En progreso'.
- **Evidencia:**

```ts
src/lib/email.ts:168  export async function sendCompanyApproved(params: {...
src/lib/email.ts:195  export async function sendCandidateSentToCompany(params: {...
Grep 'sendCompanyApproved\(|sendCandidateSentToCompany\(' en src -> solo esas dos definiciones
src/app/api/company-requests/[id]/route.ts:59-60
    // Notificar a la empresa si tiene userId asociado (fire-and-forget)
    if (updatedRequest.userId && (status === 'approved' || status === 'rejected')) {   // solo createNotification
```

- **Escenario de fallo:** Una empresa se registra en /companies y espera las 24-48 h anunciadas. El admin la aprueba: no sale ningun correo; la empresa solo se entera si vuelve a iniciar sesion por su cuenta. Igual al rechazarla (no conoce el motivo) y cuando el especialista le envia candidatos: el embudo se detiene en silencio.
- **Arreglo propuesto:** En PATCH company-requests/[id]: `await sendCompanyApproved(...)` adaptado al flujo actual (sin contrasena, con enlace a /login) y un sendCompanyRejected con el motivo; en el PUT del dashboard del especialista, `await sendCandidateSentToCompany(...)` tras la transicion a sent_to_company, con Promise.allSettled como en el webhook de MercadoPago. Eliminar el parametro `password` de la plantilla y actualizar README/USER_GUIDE.
- **Otros auditores añaden:** En company-requests/[id] PATCH, tras el update y con await: enviar `sendCompanyApproved` reescrita SIN el parametro `password` (solo nombreEmpresa + loginUrl) y crear `sendCompanyRejected` con el motivo. En specialist/dashboard (lineas 329 y 525) llamar `sendCandidateSentToCompany` con el email de `job.user`. Construir las URLs con una unica variable (ver hallazgo de NEXT_PUBLIC_BASE_URL).

#### PLAT-012 — GET /api/integration/candidates: N+1 con ILIKE sin indice y sin paginacion; agota el pool de Prisma

- **Severidad:** 🟡 medium · **Categoría:** performance · **Estado:** nuevo · **Verificación:** sin verificar (reportada por 2 auditores)
- **Ubicación:** `src/lib/integration-candidate.ts:106` · relacionados: `src/app/api/integration/candidates/route.ts`, `src/app/api/company/dashboard/route.ts`
- **Problema:** `loadCandidatosAceptados` trae TODAS las aplicaciones aceptadas de la empresa sin `take` ni filtro `since`, y por cada una `buildCandidato` ejecuta `prisma.candidate.findFirst({ email: { equals, mode: 'insensitive' } })` (ILIKE, no usa el indice de email) dentro de un `Promise.all`. Con N aceptados se lanzan N consultas concurrentes contra un pool que en serverless suele ser de 1-5 conexiones. El dashboard de empresa ya resolvio el mismo problema con una sola consulta batch (company/dashboard/route.ts:126-147), pero aqui no se reutilizo. El endpoint admite 60 req/min.
- **Evidencia:**

```ts
const applications = await prisma.application.findMany({
  where: {
    status: { in: ACCEPTED_APPLICATION_STATUSES },
    job: { userId: companyUserId }
  },
  include: applicationInclude,
  orderBy: { reviewedAt: 'desc' }
});

return Promise.all(applications.map((app) => buildCandidato(app)));
```

- **Escenario de fallo:** Una empresa con 300 contrataciones historicas: Worky2 hace polling cada minuto. Cada request dispara 1 findMany con 2 includes + 300 findFirst ILIKE en paralelo -> 'Timed out fetching a new connection from the connection pool' (P2024), 500 para Worky2 y degradacion del resto de la app que comparte el pool. La respuesta ademas crece sin limite.
- **Arreglo propuesto:** Cargar los candidatos en una sola consulta: `const emails=[...new Set(apps.map(a=>a.candidateEmail.toLowerCase()))]; const cands=await prisma.candidate.findMany({where:{email:{in:emails,mode:'insensitive'}},select:{...}})`, construir un Map y hacer `buildCandidato` sincronico. Agregar paginacion (`page`/`limit` con tope 100, reutilizando getPaginationParams corregido) y filtro `?since=<ISO>` sobre reviewedAt; devolver `pagination` en la respuesta y documentarlo.
- **Otros auditores añaden:** Hacer batch: recolectar emails, un solo candidate.findMany({ where:{ email:{ in } }, select }) y mapear en memoria (buildCandidato recibe el candidate ya resuelto). Agregar paginacion por cursor (?limit=100&after=<applicationId>) y filtro ?since=<ISO> sobre reviewedAt; bajar el rate limit a algo razonable para sync (p. ej. 10/min).

#### PLAT-013 — `sanitizeText` destruye texto legitimo: borra 'JavaScript:' y todo lo que quede entre '<' y '>'

- **Severidad:** 🟡 medium · **Categoría:** data-integrity · **Estado:** nuevo · **Verificación:** sin verificar (reportada por 1 auditor)
- **Ubicación:** `src/lib/sanitize.ts:13` · relacionados: `src/app/api/evaluations/notes/route.ts`, `src/app/api/company/interview-requests/route.ts`, `src/app/api/admin/candidates/[id]/route.ts`, `src/app/api/contact/route.ts`, `__tests__/lib/sanitize.test.ts`
- **Problema:** El sanitizador por regex se aplica a texto plano que React ya escapa al renderizar (no hay ningun `dangerouslySetInnerHTML` en src/). En una bolsa de trabajo tecnologica sus reglas corrompen datos de forma silenciosa: `/javascript\s*:/gi` elimina la cadena 'JavaScript:' de cualquier nota o mensaje, y `/<[^>]*>/g` borra todo el tramo entre un '<' y el siguiente '>'. Se usa en notas de evaluacion (evaluations/notes), mensaje de solicitud de entrevista, notas de candidato del admin y el formulario de contacto. Aun asi no aporta seguridad real: `<img src=x onerror=alert(1)` (sin '>' de cierre y sin comillas) pasa intacto.
- **Evidencia:**

```ts
return input
  .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
  .replace(/<[^>]*>/g, '')
  .replace(/on\w+\s*=\s*["'][^"']*["']/gi, '')
  .replace(/javascript\s*:/gi, '')
  .replace(/data\s*:\s*text\/html/gi, '')
```

- **Escenario de fallo:** Un especialista guarda la nota publica: 'JavaScript: avanzado. Experiencia React < 2 anios, Node > 3 anios'. Se persiste como ' avanzado. Experiencia React 3 anios'. La empresa (y Worky2 via evaluacionTecnica) recibe una evaluacion falsa: se perdio el lenguaje evaluado y el dato '< 2 anios' de React.
- **Arreglo propuesto:** Dejar de mutilar texto plano: reducir `sanitizeText` a quitar caracteres de control y hacer trim (`input.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g,'').trim()`), confiando en el escape de React y en `escapeHtml` para emails. Si se quiere conservar la eliminacion de tags, limitarla a tags reales (`/<\/?[a-z][a-z0-9]*\b[^>]*>/gi`) y eliminar las reglas de `javascript:` y `data:`. Actualizar __tests__/lib/sanitize.test.ts con los casos 'JavaScript: avanzado' y 'a < b y c > d'.

## ⚪ low (21)

#### PLAT-014 — /api/contact responde en ingles y devuelve la fila completa de la base de datos

- **Severidad:** ⚪ low · **Categoría:** copy · **Estado:** nuevo · **Verificación:** sin verificar (reportada por 1 auditor)
- **Ubicación:** `src/app/api/contact/route.ts:40` · relacionados: `src/app/contact/page.tsx`
- **Problema:** Los mensajes 'Message received successfully' y 'Failed to send message' estan en ingles; este ultimo SI llega al usuario porque la pagina muestra `data.error` ante un 500. La respuesta 201 incluye `data: contactMessage` (id autoincremental y createdAt), exponiendo innecesariamente el volumen de mensajes recibidos. El resto de la API responde en espanol con `{success:false,error}`; aqui el 400 ni siquiera incluye `success:false`.
- **Evidencia:**

```ts
return NextResponse.json(
  {
    success: true,
    message: "Message received successfully",
    data: contactMessage,
  },
  { status: 201 }
);
...
{ error: "Failed to send message" },
```

- **Escenario de fallo:** La DB no responde: el visitante ve en el banner rojo de /contact el texto 'Failed to send message' en ingles. En el caso de exito cualquier bot puede leer `data.id` y estimar cuantos leads recibe INAKAT.
- **Arreglo propuesto:** Responder `{ success: true, message: 'Mensaje recibido' }` sin `data`; en el catch `{ success:false, error:'No pudimos enviar tu mensaje. Intenta de nuevo.' }`; agregar `success:false` al 400.

#### PLAT-015 — El rate limit de /api/integration/candidates es por IP: todos los tenants de Worky2 comparten la misma cuota

- **Severidad:** ⚪ low · **Categoría:** reliability · **Estado:** nuevo · **Verificación:** sin verificar (reportada por 1 auditor)
- **Ubicación:** `src/app/api/integration/candidates/route.ts:24` · relacionados: `src/lib/rate-limit.ts`, `docs/WORKY2_INTEGRATION.md`
- **Problema:** Worky2 es un sistema multi-tenant (segun docs/WORKY2_INTEGRATION.md) que llama desde sus propios servidores, es decir, desde una o pocas IPs para todas las empresas. El limite de 60 req/min se aplica con la clave `integration-candidates:<ip>` antes de autenticar, de modo que el consumo de una empresa agota la cuota de las demas. No existe limite por API key.
- **Evidencia:**

```ts
const blocked = applyRateLimit(request, 'integration-candidates', INTEGRATION_RATE_LIMIT);
if (blocked) return blocked;

const auth = await requireApiKey(request);
```

- **Escenario de fallo:** Worky2 sincroniza 80 empresas cliente al inicio de cada minuto desde la misma IP. A partir de la peticion 61 (cuando caen en la misma instancia caliente) las empresas restantes reciben 429 'Demasiadas solicitudes' aunque cada una hizo una sola llamada.
- **Arreglo propuesto:** Mantener un limite alto por IP contra fuerza bruta (p.ej. 600/min) y, tras `requireApiKey`, aplicar el limite funcional por key: `checkRateLimit(`integration-key:${auth.apiKey.id}`, INTEGRATION_RATE_LIMIT)`. Documentar ambos en WORKY2_INTEGRATION.md.

#### PLAT-016 — El secreto HMAC del webhook se guarda en claro y el listado revela sus 4 primeros caracteres y su longitud exacta

- **Severidad:** ⚪ low · **Categoría:** security · **Estado:** nuevo · **Verificación:** sin verificar (reportada por 1 auditor)
- **Ubicación:** `src/app/api/integration/webhooks/route.ts:31` · relacionados: `src/lib/worky2-webhook.ts`, `prisma/schema.prisma`
- **Problema:** A diferencia de la API key (solo SHA-256), `IntegrationWebhook.secret` se almacena en texto plano (linea 75). Una fuga de la DB o de un backup permite falsificar eventos candidate.accepted firmados hacia el Worky2 de cada empresa. Ademas `maskSecret` devuelve los 4 primeros caracteres reales y tantos asteriscos como caracteres restantes, revelando prefijo y longitud a cualquiera con la sesion de la empresa.
- **Evidencia:**

```ts
function maskSecret(secret: string): string {
  return `${secret.slice(0, 4)}${'*'.repeat(Math.max(secret.length - 4, 4))}`;
}
...
data: {
  userId: auth.user.id,
  url: parsed.data.url,
  secret: parsed.data.secret
},
```

- **Escenario de fallo:** Un dump de la base (o acceso de solo lectura a Postgres) expone todos los secretos compartidos; el atacante envia a Worky2 POSTs con firma valida dando de alta 'candidatos' falsos en la nomina de cualquier empresa cliente.
- **Arreglo propuesto:** Cifrar el secreto en reposo con AES-256-GCM usando una clave de entorno (`INTEGRATION_SECRET_KEY`), descifrando solo en `dispatchCandidateAccepted`. Cambiar la mascara a una constante (`'••••••••'`) mas, como mucho, los 2 ultimos caracteres. Ofrecer rotacion de secreto sin recrear el webhook.

#### PLAT-017 — Sin tope de API keys/webhooks por empresa ni rate limit en los endpoints de gestion: permite amplificar trafico saliente

- **Severidad:** ⚪ low · **Categoría:** validation · **Estado:** nuevo · **Verificación:** sin verificar (reportada por 1 auditor)
- **Ubicación:** `src/app/api/integration/webhooks/route.ts:59` · relacionados: `src/app/api/integration/keys/route.ts`, `src/lib/worky2-webhook.ts`
- **Problema:** POST /api/integration/webhooks y POST /api/integration/keys no aplican `applyRateLimit` ni limitan el numero de registros por usuario. La unica proteccion es el duplicado exacto de URL activa (comprobacion no atomica, sin indice unico). Cada aceptacion de candidato dispara un fetch por cada webhook activo en paralelo.
- **Evidencia:**

```ts
// Evitar duplicados exactos activos para la misma empresa
const existing = await prisma.integrationWebhook.findFirst({
  where: { userId: auth.user.id, url: parsed.data.url, isActive: true }
});
...
const webhook = await prisma.integrationWebhook.create({
```

- **Escenario de fallo:** Una cuenta de empresa (o un script con su cookie) registra 2.000 webhooks https://victima.com/?n=1..2000. Cada vez que acepta un candidato, INAKAT lanza 2.000 POST simultaneos contra la victima desde sus IPs, y la funcion consume su tiempo maximo abriendo sockets.
- **Arreglo propuesto:** Antes de crear: `const count = await prisma.integrationWebhook.count({ where:{ userId, isActive:true } }); if (count >= 5) return 409`. Igual para keys (p.ej. max 10 activas). Aplicar `applyRateLimit(request,'integration-manage',{maxRequests:20,windowSeconds:3600})` en POST/DELETE de ambas rutas y un indice unico parcial (userId,url) para webhooks activos.

#### PLAT-018 — API de notificaciones: parametros no numericos, JSON invalido o ids no numericos producen 500 (sin try/catch ni validacion)

- **Severidad:** ⚪ low · **Categoría:** validation · **Estado:** nuevo · **Verificación:** sin verificar (reportada por 1 auditor)
- **Ubicación:** `src/app/api/notifications/route.ts:18` · relacionados: `src/app/api/notifications/count/route.ts`
- **Problema:** Ninguno de los 3 handlers (GET, PATCH, count) tiene try/catch. En GET, `parseInt('abc')` da NaN y `Math.max(1, NaN)` es NaN, que llega a Prisma como `skip`/`take` -> excepcion -> 500 sin cuerpo JSON. En PATCH, `await request.json()` sin catch lanza con cuerpo vacio o invalido; `body` null (`JSON null`) provoca TypeError en `body.all`; `body.ids.map(Number)` con valores no numericos mete NaN en `in: [...]`; y no hay tope al tamano de `ids`. Todos deberian ser 400.
- **Evidencia:**

```ts
const page = Math.max(1, parseInt(searchParams.get('page') || '1'));
const limit = Math.min(50, Math.max(1, parseInt(searchParams.get('limit') || '20')));
...
const body = await request.json();

if (body.all === true) {
...
  id: { in: body.ids.map(Number) },
```

- **Escenario de fallo:** Un usuario autenticado abre /api/notifications?page=abc -> 500. Un cliente envia PATCH /api/notifications con cuerpo 'null' o {ids:['x']} -> 500 y stack en los logs de Vercel en lugar de un 400 con mensaje.
- **Arreglo propuesto:** Envolver los handlers en try/catch devolviendo `{success:false,error}` 500. Parsear con un helper seguro (`const n = Number.parseInt(v ?? '', 10); return Number.isFinite(n) && n > 0 ? n : def`). En PATCH: `const body = await request.json().catch(() => null)` y validar con zod: `z.union([z.object({all: z.literal(true)}), z.object({ids: z.array(z.number().int().positive()).min(1).max(100)})])` -> 400 si falla.

#### PLAT-019 — El catalogo publico /api/specialties se cachea 10 min en CDN (SWR 1 dia) y no se invalida tras mutaciones del admin

- **Severidad:** ⚪ low · **Categoría:** config · **Estado:** nuevo · **Verificación:** sin verificar (reportada por 2 auditores)
- **Ubicación:** `src/app/api/specialties/route.ts:42` · relacionados: `src/app/admin/assign-candidates/page.tsx`, `src/app/api/admin/specialties/route.ts`
- **Problema:** Crear, renombrar o desactivar una especialidad en /admin/specialties no invalida la respuesta cacheada. Asignar Candidatos y los formularios publicos consumen ese endpoint, por lo que el admin ve datos viejos justo despues de su propio cambio. POST /api/jobs valida contra BD, asi que una opcion obsoleta produce un 400 inesperado.
- **Evidencia:**

```ts
      {
        headers: {
          'Cache-Control': 'public, s-maxage=600, stale-while-revalidate=86400'
        }
      }
```

- **Escenario de fallo:** Admin desactiva "Arquitectura" y crea "Logistica". Va a Asignar Candidatos: el filtro Perfil sigue mostrando Arquitectura y no Logistica durante ~10 minutos. Una empresa que en ese lapso elige "Arquitectura" recibe "La especialidad seleccionada no es valida o no esta activa".
- **Arreglo propuesto:** Bajar a `s-maxage=60` o usar `revalidateTag('specialties')` desde POST/PUT/DELETE admin; en la pagina de asignacion consumir /api/admin/specialties?active=true, que no esta cacheado.
- **Otros auditores añaden:** Reducir s-maxage (p. ej. 60) y quitar o acortar stale-while-revalidate, o servir el catalogo con revalidateTag('specialties') y llamar a revalidateTag desde POST/PUT/DELETE de /api/admin/specialties.

#### PLAT-020 — El aviso de consentimiento del formulario de contacto no enlaza a los Terminos ni a la Politica de Privacidad

- **Severidad:** ⚪ low · **Categoría:** copy · **Estado:** nuevo · **Verificación:** sin verificar (reportada por 1 auditor)
- **Ubicación:** `src/app/contact/page.tsx:299` · relacionados: `src/app/terms/page.tsx`, `src/app/privacy/page.tsx`
- **Problema:** El texto legal bajo el formulario afirma que al enviar se aceptan terminos y politica de privacidad, pero es texto plano sin enlaces, a pesar de que existen las paginas src/app/terms/page.tsx y src/app/privacy/page.tsx. Se recaban nombre, email y telefono sin poner el aviso de privacidad a disposicion en el punto de captura.
- **Evidencia:**

```ts
<p className="text-xs text-text-black/50">
  *Al dar click en el botón, aceptas nuestros términos y
  condiciones y política de privacidad.
</p>
```

- **Escenario de fallo:** Un visitante quiere leer la politica antes de dejar su telefono; no hay enlace en el formulario y debe buscarla en el footer. El consentimiento informado que afirma el texto no es verificable.
- **Arreglo propuesto:** Reemplazar por `aceptas nuestros <Link href="/terms" className="underline">términos y condiciones</Link> y <Link href="/privacy" className="underline">política de privacidad</Link>` (con target="_blank").

#### PLAT-021 — Notificaciones: la UI marca como leido sin comprobar `res.ok` y un fallo de carga se muestra como 'No hay notificaciones'

- **Severidad:** ⚪ low · **Categoría:** frontend-bug · **Estado:** nuevo · **Verificación:** sin verificar (reportada por 1 auditor)
- **Ubicación:** `src/app/notifications/page.tsx:52` · relacionados: `src/components/shared/NotificationBell.tsx`
- **Problema:** En la pagina y en la campanita, `markAllRead`/`markOneRead`/`handleNotificationClick` hacen `await fetch(...)` y actualizan el estado local sin mirar el status: `fetch` no lanza con 4xx/5xx, asi que un 500/401 deja la UI diciendo 'leido' hasta el siguiente poll, cuando el contador reaparece. En la carga, si la respuesta no es ok o hay excepcion ('silencioso'), `notifications` queda en [] y se renderiza el estado vacio 'No hay notificaciones / Aqui apareceran tus notificaciones', que es indistinguible de no tener avisos. Ademas la pagina y la campanita mantienen contadores separados: marcar leido en /notifications no actualiza el badge hasta 30 s despues.
- **Evidencia:**

```ts
const res = await fetch(`/api/notifications?${params}`, { credentials: 'include' });
if (res.ok) {
  const data = await res.json();
  if (data.success) {
    setNotifications(data.data);
    setPagination(data.pagination);
  }
}
} catch {
  // silencioso
}
```

- **Escenario de fallo:** La DB tiene un pico de latencia y GET /api/notifications devuelve 500. El reclutador ve 'No hay notificaciones' y asume que no tiene candidatos asignados. O pulsa 'Marcar todas leidas', el PATCH falla, la UI las muestra leidas y 30 s despues el badge vuelve a '7'.
- **Arreglo propuesto:** Agregar estado `error` y renderizar 'No pudimos cargar tus notificaciones. Reintentar' cuando `!res.ok` o en el catch. En las mutaciones: `const res = await fetch(...); if (!res.ok) throw new Error()` antes de tocar el estado, y mostrar ErrorToast en el catch. Emitir `window.dispatchEvent(new Event('notifications:changed'))` tras marcar y escucharlo en NotificationBell para llamar a `fetchCount()`.

#### PLAT-022 — 'Marcar todas leidas' en /notifications depende de los no leidos de la pagina actual, no del total

- **Severidad:** ⚪ low · **Categoría:** frontend-bug · **Estado:** nuevo · **Verificación:** sin verificar (reportada por 1 auditor)
- **Ubicación:** `src/app/notifications/page.tsx:121` · relacionados: `src/app/api/notifications/route.ts`
- **Problema:** `unreadCount` se calcula con `notifications.filter(n => !n.read).length`, es decir, solo sobre los 20 elementos de la pagina visible. El boton (que en el servidor marca TODAS) se oculta si en esa pagina no hay no leidos aunque existan en otras, y con el filtro 'Leidas' nunca aparece. Tras marcar, con el filtro 'No leidas' la lista no se recarga y siguen listadas como leidas con la paginacion desfasada.
- **Evidencia:**

```ts
const unreadCount = notifications.filter((n) => !n.read).length;
...
{unreadCount > 0 && (
  <button
    onClick={markAllRead}
    className="flex items-center gap-1.5 text-sm text-button-green hover:underline"
  >
```

- **Escenario de fallo:** Un admin con 60 notificaciones abre la pagina 1 (ya leidas las 20 mas recientes porque las abrio desde la campanita); las 40 de las paginas 2-3 siguen sin leer y el badge marca 40, pero el boton 'Marcar todas leidas' no aparece en la pagina 1.
- **Arreglo propuesto:** Obtener el total real: llamar a /api/notifications/count al montar (o devolver `unreadTotal` en la respuesta de GET /api/notifications) y usarlo para mostrar el boton. Tras `markAllRead`/`markOneRead` con filtro distinto de 'all', llamar a `fetchNotifications()` para refrescar lista y paginacion.

#### PLAT-023 — CompanyLogo no tiene fallback `onError` y `logoUrl` se guarda sin validar: imagen rota en produccion y excepcion en desarrollo

- **Severidad:** ⚪ low · **Categoría:** frontend-bug · **Estado:** nuevo · **Verificación:** sin verificar (reportada por 1 auditor)
- **Ubicación:** `src/components/shared/CompanyLogo.tsx:37` · relacionados: `src/app/api/company/profile/route.ts`, `src/app/api/company-requests/route.ts`, `next.config.ts`, `src/components/sections/talents/SearchPositionsSection.tsx`
- **Problema:** `next.config.ts` solo autoriza `*.public.blob.vercel-storage.com` en `images.remotePatterns`. `logoUrl` se persiste tal cual llega del cliente: `updateData.logoUrl = body.logoUrl` (src/app/api/company/profile/route.ts:212-214) y `logoUrl: logoUrl || null` en el POST publico de company-requests (linea 106). Con cualquier otro host, el optimizador /_next/image responde 400 en produccion y el componente muestra el icono de imagen rota (nunca cae al fallback Building2 porque no hay `onError`); en desarrollo next/image lanza 'hostname is not configured' y tumba la pagina que lo renderiza, incluida la lista publica de vacantes de /talents. El comentario del fallback promete 'inicial de empresa' que no se pinta.
- **Evidencia:**

```ts
if (logoUrl) {
  return (
    <div className={`${container} relative rounded-lg overflow-hidden bg-gray-100 flex-shrink-0 ${className}`}>
      <Image
        src={logoUrl}
        alt={`Logo de ${companyName}`}
        fill
        className="object-cover"
```

- **Escenario de fallo:** Una empresa envia PUT /api/company/profile con `logoUrl: 'https://miempresa.com/logo.png'` (o un blob borrado que ya responde 404). Todas sus vacantes en /talents muestran una imagen rota en lugar del icono de edificio; en local la pagina /talents entera lanza excepcion.
- **Arreglo propuesto:** En CompanyLogo: `const [failed, setFailed] = useState(false)`; renderizar `<Image ... onError={() => setFailed(true)} />` solo si `logoUrl && !failed`, y en caso contrario el fallback. En company/profile y company-requests validar `logoUrl` con zod: `z.string().url().refine(u => new URL(u).hostname.endsWith('.public.blob.vercel-storage.com'))` (o ruta '/uploads/' en desarrollo) o null.

#### PLAT-024 — ErrorToast: el `setTimeout` interno de 300 ms no se limpia y puede cerrar un error NUEVO recien mostrado

- **Severidad:** ⚪ low · **Categoría:** frontend-bug · **Estado:** nuevo · **Verificación:** sin verificar (reportada por 1 auditor)
- **Ubicación:** `src/components/shared/ErrorToast.tsx:22` · relacionados: `src/components/sections/companies/FormRegisterForQuotationSection.tsx`
- **Problema:** El cleanup del efecto solo hace `clearTimeout(timer)` del temporizador externo. El temporizador anidado que llama a `onClose` tras la animacion de salida (y el equivalente de `handleClose`) queda huerfano. Si el `message` cambia durante esos 300 ms, el efecto se re-ejecuta y muestra el nuevo error, pero el timeout huerfano dispara `onCloseRef.current()` y el padre pone el mensaje a null.
- **Evidencia:**

```ts
const timer = setTimeout(() => {
  setIsVisible(false);
  setTimeout(() => onCloseRef.current(), 300);
}, duration);
return () => clearTimeout(timer);
```

- **Escenario de fallo:** En el registro de empresa aparece el toast 'Datos invalidos'. A los 8 s empieza a desvanecerse; el usuario reenvia justo entonces y llega un error distinto ('Ya existe una cuenta con este correo'). El nuevo toast aparece y desaparece en menos de 300 ms; el usuario no llega a leerlo.
- **Arreglo propuesto:** Guardar ambos ids en refs (`closeTimerRef`) y limpiarlos en el cleanup y al inicio del efecto: `return () => { clearTimeout(timer); if (closeTimerRef.current) clearTimeout(closeTimerRef.current); }`. Hacer lo mismo en `handleClose`.

#### PLAT-025 — ErrorToast no se anuncia a tecnologias asistivas (falta role="alert"/aria-live)

- **Severidad:** ⚪ low · **Categoría:** a11y · **Estado:** nuevo · **Verificación:** sin verificar (reportada por 1 auditor)
- **Ubicación:** `src/components/shared/ErrorToast.tsx:41`
- **Problema:** El contenedor del toast es un `<div>` sin `role="alert"` ni `aria-live`. La Fase 4 de junio solo anadio `aria-label="Cerrar aviso"` al boton. Los errores de formularios clave (login, registro, registro de empresa, creacion de vacante) se muestran unicamente de forma visual y durante 8 s.
- **Evidencia:**

```ts
<div className={`fixed top-4 left-1/2 transform -translate-x-1/2 z-[9999] max-w-lg w-[calc(100%-2rem)] transition-all duration-300 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-4 pointer-events-none'}`}>
  <div className="bg-red-600 text-white px-6 py-4 rounded-xl shadow-2xl flex items-start gap-3 border border-red-700">
```

- **Escenario de fallo:** Un usuario con lector de pantalla envia el login con credenciales incorrectas: el toast rojo aparece y desaparece sin que el lector anuncie nada; el usuario no sabe por que sigue en la misma pantalla.
- **Arreglo propuesto:** Anadir `role="alert" aria-live="assertive" aria-atomic="true"` al div interior que contiene el mensaje y `aria-hidden="true"` al icono AlertCircle.

#### PLAT-026 — NotificationBell hace polling cada 30 s sin pausar en pestanas ocultas y cada poll cuesta 2 queries

- **Severidad:** ⚪ low · **Categoría:** performance · **Estado:** nuevo · **Verificación:** sin verificar (reportada por 2 auditores)
- **Ubicación:** `src/components/shared/NotificationBell.tsx:43` · relacionados: `src/app/api/notifications/count/route.ts`, `src/components/commons/Navbar.tsx`, `src/lib/auth.ts`
- **Problema:** El Navbar (layout raiz) monta NotificationBell para todo usuario autenticado en todas las paginas. El intervalo no se detiene con document.hidden ni aplica backoff ante errores/401. Cada llamada a /api/notifications/count pasa por el middleware (verifica JWT) y luego requireAuth vuelve a verificar el JWT y hace user.findUnique antes del count: 2 queries y 1 invocacion serverless por pestana cada 30 s, las 24 h si la pestana queda abierta.
- **Evidencia:**

```ts
useEffect(() => {
  fetchCount();
  const interval = setInterval(fetchCount, POLL_INTERVAL);
  return () => clearInterval(interval);
}, [fetchCount]);
// api/notifications/count/route.ts
const auth = await requireAuth();   // user.findUnique
...
const count = await getUnreadCount(auth.user.id);   // notification.count
```

- **Escenario de fallo:** 80 usuarios internos y empresas dejan 2-3 pestanas abiertas todo el dia: ~200 pestanas x 2,880 polls/dia = 576,000 invocaciones y 1.15 M de queries diarias sin que nadie mire la pantalla; tras expirar el JWT (7 dias) cada pestana sigue generando 401 cada 30 s indefinidamente.
- **Arreglo propuesto:** Pausar el intervalo con el evento visibilitychange (y refrescar al volver a visible), detener el polling tras un 401, subir el intervalo a 60-120 s con backoff exponencial ante errores, y en la ruta count usar el x-user-id que ya inyecta el middleware para evitar el user.findUnique extra.
- **Otros auditores añaden:** Dentro del efecto: no llamar a fetchCount si `document.hidden`; suscribirse a `visibilitychange` para refrescar al volver; si `res.status === 401 || res.status === 403` hacer `clearInterval`. Subir POLL_INTERVAL a 60 s y en /api/notifications/count evitar la doble verificacion (usar el `x-user-id` que ya inyecta el middleware para el count).

#### PLAT-027 — Accesibilidad de la campanita: `aria-label` tapa el contador, sin `aria-expanded`/Escape, e items sin enlace no operables por teclado

- **Severidad:** ⚪ low · **Categoría:** a11y · **Estado:** nuevo · **Verificación:** sin verificar (reportada por 1 auditor)
- **Ubicación:** `src/components/shared/NotificationBell.tsx:161` · relacionados: `src/app/notifications/page.tsx`
- **Problema:** El boton tiene `aria-label="Notificaciones"`, que sustituye al contenido como nombre accesible: el numero del badge no se anuncia a lectores de pantalla. No expone `aria-expanded` ni `aria-haspopup`, el dropdown no se cierra con Escape (la Fase 4 de junio lo anadio a modales pero no aqui) y las notificaciones sin `link` son `<div onClick>` sin `role`, `tabIndex` ni manejador de teclado (linea 228; igual en src/app/notifications/page.tsx:222-226), por lo que no pueden marcarse como leidas sin raton.
- **Evidencia:**

```ts
<button
  onClick={handleToggle}
  className="relative p-2 text-title-dark hover:bg-white/50 rounded-full transition-colors"
  aria-label="Notificaciones"
>
...
<div key={notif.id} onClick={() => handleNotificationClick(notif)}>
  {content}
</div>
```

- **Escenario de fallo:** Un usuario de lector de pantalla oye solo 'Notificaciones, boton' aunque tenga 5 sin leer; al abrir no sabe si el panel esta expandido; con teclado no puede activar las notificaciones que no son enlace ni cerrar el panel con Escape.
- **Arreglo propuesto:** `aria-label={unreadCount > 0 ? `Notificaciones, ${unreadCount} sin leer` : 'Notificaciones'}`, `aria-expanded={isOpen}`, `aria-haspopup="true"`. Agregar listener de `keydown` Escape que cierre y devuelva el foco al boton. Convertir los items sin link en `<button type="button" className="w-full text-left">` (tambien en la pagina).

#### PLAT-028 — Transporter SMTP sin timeouts y el resultado de `sendEmail` se ignora: fallos de correo silenciosos o funciones colgadas

- **Severidad:** ⚪ low · **Categoría:** reliability · **Estado:** nuevo · **Verificación:** sin verificar (reportada por 1 auditor)
- **Ubicación:** `src/lib/email.ts:28` · relacionados: `src/app/api/auth/forgot-password/route.ts`, `src/app/api/webhooks/mercadopago/route.ts`
- **Problema:** `createTransport` no define `connectionTimeout`, `greetingTimeout` ni `socketTimeout`; los valores por defecto de nodemailer son 2 min, 30 s y 10 min. Los envios que SI se esperan (forgot-password; webhook de MercadoPago, que exporta `maxDuration = 10`) pueden retener la funcion hasta que la plataforma la mate. Por otro lado `sendEmail` devuelve `false` si SMTP no esta configurado o falla, y ningun caller comprueba ese valor: forgot-password responde 'recibiras un enlace' aunque el correo no haya salido.
- **Evidencia:**

```ts
transporter = nodemailer.createTransport({
  host: SMTP_HOST,
  port: SMTP_PORT,
  secure: SMTP_PORT === 465,
  auth: {
    user: SMTP_USER,
    pass: SMTP_PASS,
  },
});
```

- **Escenario de fallo:** Zoho acepta la conexion TCP pero no responde al saludo. El webhook de MercadoPago espera el envio dentro de Promise.allSettled, supera sus 10 s y Vercel lo aborta con 504; MP reintenta la notificacion varias veces. En forgot-password el usuario espera ~30 s para recibir un 'te enviamos un enlace' que nunca llega.
- **Arreglo propuesto:** Anadir `connectionTimeout: 5000, greetingTimeout: 5000, socketTimeout: 10000` al transporter. En forgot-password registrar `console.error('[ForgotPassword] email no enviado')` cuando `sendEmail` devuelva false y exponer una alerta (p.ej. notifyAllAdmins una vez al dia) cuando SMTP no este configurado en produccion.

#### PLAT-029 — La integracion propaga a un tercero las URLs publicas permanentes de CV (pendiente #56), haciendolas irrevocables

- **Severidad:** ⚪ low · **Categoría:** security · **Estado:** pendiente conocido de junio · **Verificación:** sin verificar (reportada por 1 auditor)
- **Ubicación:** `src/lib/integration-candidate.ts:194` · relacionados: `docs/AUDITORIA-2026-06.md`, `src/app/api/upload/route.ts`
- **Problema:** El pendiente #56 ya reconoce que los CV viven en URLs publicas permanentes de Vercel Blob. Detalle nuevo: desde julio el mapper de Worky2 exporta esa URL (`cvUrl`) en el API y en el webhook (que ademas admite http://), por lo que queda copiada en sistemas externos. Cuando se migre a almacenamiento privado/signed URLs, las URLs ya exportadas seguiran siendo validas mientras el blob exista, y el contrato con Worky2 tendra que cambiar.
- **Evidencia:**

```ts
email: application.candidateEmail,
telefono: application.candidatePhone ?? candidate?.telefono ?? null,
cvUrl: application.cvUrl ?? candidate?.cvUrl ?? null,
```

- **Escenario de fallo:** Worky2 almacena la URL del CV del candidato. Un empleado de la empresa cliente la reenvia por correo; cualquiera con el enlace descarga el CV (domicilio, telefono, historial) sin autenticacion y sin caducidad, aun despues de que el candidato pida la baja de sus datos en INAKAT.
- **Arreglo propuesto:** Al resolver #56, hacer que el mapper emita una URL firmada de corta duracion (p.ej. GET /api/integration/candidates/{id}/cv autenticado con X-Api-Key que haga stream o redirija a una signed URL de 5 min) en lugar de la URL cruda del blob; planificar la rotacion/borrado de los blobs ya expuestos y versionar el contrato (v2).

#### PLAT-030 — `getPaginationParams` propaga NaN y enteros fuera de rango a Prisma: GET publico /api/jobs?page=abc responde 500

- **Severidad:** ⚪ low · **Categoría:** validation · **Estado:** nuevo · **Verificación:** sin verificar (reportada por 2 auditores)
- **Ubicación:** `src/lib/pagination.ts:30` · relacionados: `src/app/api/jobs/route.ts`, `src/app/api/admin/candidates/route.ts`, `src/app/api/admin/users/route.ts`, `__tests__/lib/pagination.test.ts`
- **Problema:** `Math.max(1, NaN)` devuelve NaN, asi que `page`, `limit`, `skip` y `take` quedan en NaN con cualquier valor no numerico; tampoco hay tope superior para `page`, por lo que `page=99999999999999` genera un `skip` que desborda Int32. Prisma rechaza ambos casos y las rutas que lo usan (/api/jobs publica, /api/admin/candidates, /api/admin/users) devuelven 500. El test existente reconoce el bug y lo tapa: solo comprueba `expect(result).toBeDefined()` con el comentario 'Math.max(1, NaN) = NaN en JS'.
- **Evidencia:**

```ts
const page = Math.max(1, parseInt(searchParams.get('page') || '1'));
const rawLimit = parseInt(searchParams.get('limit') || String(defaultLimit));
const limit = Math.min(Math.max(1, rawLimit), maxLimit);
const skip = (page - 1) * limit;

// __tests__/lib/pagination.test.ts:82-84
// parseInt('abc') = NaN, Math.max(1, NaN) = NaN en JS
// Verificar que no crashea
expect(result).toBeDefined();
```

- **Escenario de fallo:** Un crawler o un enlace mal formado pide /api/jobs?page=abc (endpoint publico del listado de vacantes). `skip: NaN` -> PrismaClientValidationError -> catch generico -> 500 'Failed to fetch jobs' en vez de servir la pagina 1.
- **Arreglo propuesto:** `const toInt = (v: string|null, def: number) => { const n = Number.parseInt(v ?? '', 10); return Number.isFinite(n) ? n : def; }; const page = Math.min(Math.max(1, toInt(get('page'), 1)), 100000); const limit = Math.min(Math.max(1, toInt(get('limit'), defaultLimit)), maxLimit);`. Cambiar el test para exigir `page===1` y `limit===20` con 'abc'/'xyz'.
- **Otros auditores añaden:** Normalizar: const p = parseInt(...); const page = Number.isFinite(p) && p > 0 ? p : 1; y lo mismo para limit con defaultLimit como respaldo.

#### PLAT-031 — `src/lib/test-helpers.ts` es codigo muerto dentro de src/lib (nadie lo importa, ni los tests)

- **Severidad:** ⚪ low · **Categoría:** dead-code · **Estado:** nuevo · **Verificación:** sin verificar (reportada por 1 auditor)
- **Ubicación:** `src/lib/test-helpers.ts:11` · relacionados: `__tests__/api/notifications.test.ts`
- **Problema:** grep de 'test-helpers' en todo el repo (excluyendo node_modules) solo devuelve el propio archivo. No se importa en produccion (no hay riesgo de bundle), pero tampoco lo usa ningun test: los tests de API existentes leen el codigo fuente como texto en vez de ejecutar handlers. `createMockAuthHeader` genera una cookie `auth-token=mock-<rol>-token` que `verifyToken` rechazaria, asi que tampoco serviria tal cual.
- **Evidencia:**

```ts
export function createTestRequest(
  url: string,
  options: { method?: string; body?: unknown; headers?: Record<string, string>; searchParams?: Record<string, string>; } = {}
): Request {
...
export function createMockAuthHeader(role: string = 'admin'): Record<string, string> {
  return { Cookie: `auth-token=mock-${role}-token` };
}
```

- **Escenario de fallo:** Un desarrollador nuevo asume que existe infraestructura para testear route handlers y que esta en uso; en realidad es un helper huerfano en el arbol de codigo de produccion, que ademas sugiere un patron de cookie que no autentica.
- **Arreglo propuesto:** Moverlo a `__tests__/helpers/request.ts` y usarlo de verdad en tests de comportamiento para /api/notifications, /api/contact y /api/integration/* (con `jest.mock('@/lib/prisma')` y un JWT real firmado con el JWT_SECRET de test), o eliminarlo.

#### PLAT-032 — `normalizeUrl` distingue mayusculas: 'Https://…' (autocapitalizacion movil) se convierte en 'https://Https://…'

- **Severidad:** ⚪ low · **Categoría:** correctness · **Estado:** nuevo · **Verificación:** sin verificar (reportada por 1 auditor)
- **Ubicación:** `src/lib/utils.ts:14` · relacionados: `src/app/api/auth/register/route.ts`, `src/app/api/profile/route.ts`
- **Problema:** La comprobacion `!url.startsWith('http')` es sensible a mayusculas y no hace trim. Los teclados moviles capitalizan la primera letra en inputs de texto, por lo que 'Https://linkedin.com/in/ana' o ' https://…' reciben un segundo prefijo. Tambien rompe rutas relativas: en desarrollo /api/upload devuelve '/uploads/cv.pdf' y queda 'https:///uploads/cv.pdf'. Se usa para `cvUrl`, `linkedinUrl` y `portafolioUrl` en auth/register (lineas 235-237) y profile (294-296).
- **Evidencia:**

```ts
export const normalizeUrl = (url: string | undefined): string | undefined =>
  url && !url.startsWith('http') ? `https://${url}` : url;
```

- **Escenario de fallo:** Un candidato se registra desde el celular y pega su LinkedIn; el teclado lo deja como 'Https://www.linkedin.com/in/ana'. Se guarda 'https://Https://www.linkedin.com/in/ana'. El reclutador hace clic en el perfil y el navegador abre un host inexistente.
- **Arreglo propuesto:** `export const normalizeUrl = (url?: string | null) => { const v = url?.trim(); if (!v) return undefined; if (v.startsWith('/')) return v; if (/^https?:\/\//i.test(v)) return v.replace(/^https?/i, (m) => m.toLowerCase()); return `https://${v}`; }` y validar despues con `new URL()` rechazando esquemas que no sean http/https.

#### PLAT-033 — `contactMessageSchema` sigue sin longitudes maximas pese a que la remediacion #10/#57 afirma validar longitudes

- **Severidad:** ⚪ low · **Categoría:** validation · **Estado:** arreglo previo incompleto · **Verificación:** sin verificar (reportada por 1 auditor)
- **Ubicación:** `src/lib/validations.ts:39` · relacionados: `src/app/api/contact/route.ts`
- **Problema:** El comentario de la ruta dice 'validar formato (email, telefono, longitudes) con zod', pero el schema solo define minimos. `nombre`, `email` y `mensaje` aceptan cadenas de tamano arbitrario (hasta el limite de cuerpo de la plataforma, ~4.5 MB en Vercel) que se insertan tal cual en columnas `String`. El endpoint es publico y el rate limit es en memoria por instancia (pendiente #89). Lo mismo ocurre en `companyRequestSchema` (todos los campos de texto).
- **Evidencia:**

```ts
export const contactMessageSchema = z.object({
  nombre: z.string().min(2, 'Nombre muy corto'),
  email: z.string().email('Email inválido'),
  telefono: z.string().regex(/^(\+?52)?\d{10}$/, ...).optional().or(z.literal('')),
  mensaje: z.string().min(10, 'Mensaje debe tener al menos 10 caracteres')
});
```

- **Escenario de fallo:** Un script envia a /api/contact mensajes de 4 MB rotando IP/instancias: cada uno se guarda integro en ContactMessage, inflando la base y cualquier listado futuro de mensajes.
- **Arreglo propuesto:** Agregar `.trim().max(120)` a nombre, `.max(254)` a email, `.max(5000)` a mensaje; y en companyRequestSchema `.max()` razonables (nombre/apellidos 80, nombreEmpresa/razonSocial 200, direccion 400, URLs 2048).

#### PLAT-034 — Webhook saliente sin reintentos, sin registro de entregas y sin identificador de evento

- **Severidad:** ⚪ low · **Categoría:** reliability · **Estado:** nuevo · **Verificación:** sin verificar (reportada por 1 auditor)
- **Ubicación:** `src/lib/worky2-webhook.ts:73` · relacionados: `prisma/schema.prisma`, `docs/WORKY2_INTEGRATION.md`
- **Problema:** Cada entrega se intenta una sola vez con timeout de 5 s; un 5xx, un timeout o un fallo de DNS solo generan `console.warn`. No se persiste nada (ni ultimo estado ni contador de fallos en IntegrationWebhook), la empresa no puede saber que su webhook lleva semanas fallando y un endpoint muerto nunca se desactiva. El payload no incluye `eventId`/`deliveryId`, y como la ruta de empresa no protege contra doble PATCH concurrente, Worky2 no puede deduplicar salvo por `inakatCandidateId`. La doc lo asume ('sin reintentos en v1'), pero combinado con el fire-and-forget no queda ningun rastro recuperable.
- **Evidencia:**

```ts
await Promise.allSettled(
  webhooks.map((webhook) =>
    fetch(webhook.url, { ... signal: AbortSignal.timeout(WEBHOOK_TIMEOUT_MS) })
      .then((response) => {
        if (!response.ok) {
          console.warn(
            `[Worky2Webhook] Webhook ${webhook.id} respondió ${response.status} (application ${applicationId})`
          );
```

- **Escenario de fallo:** Worky2 esta desplegando y responde 503 durante 20 s. La empresa acepta a un candidato en ese momento: el evento se descarta, solo queda un warn en los logs de Vercel (retencion corta) y nadie se entera de que el alta en Worky2 no ocurrio.
- **Arreglo propuesto:** Agregar a IntegrationWebhook `lastDeliveryAt`, `lastStatus`, `consecutiveFailures` y actualizarlos tras cada intento; reintentar 2 veces con backoff corto dentro del presupuesto de `after()`; desactivar tras N fallos y notificar a la empresa con createNotification. Incluir en el body `id: crypto.randomUUID()` y `createdAt`, y el header `X-Inakat-Delivery`. Mostrar el estado en la futura pantalla de Integraciones.
