# Autenticación, sesión y middleware

[← volver al índice](../AUDITORIA-2026-09.md) · 25 hallazgos — 🟠 4 high · 🟡 10 medium · ⚪ 11 low

## 🟠 high (4)

#### AUTH-001 — Registro sin verificacion de email (emailVerified falso + auto-login) permite apropiarse del correo de otra persona y leer sus postulaciones

- **Severidad:** 🟠 high · **Categoría:** security · **Estado:** nuevo · **Verificación:** sin verificar (reportada por 3 auditores)
- **Ubicación:** `src/app/api/auth/register/route.ts:209` · relacionados: `src/app/api/my-applications/route.ts`, `src/app/api/candidate/applications/route.ts`, `src/app/api/applications/route.ts`
- **Problema:** El registro crea la cuenta para cualquier email sin comprobar que el solicitante lo controla, marca `emailVerified: new Date()` (dato falso) y entrega la cookie de sesion al instante. /api/my-applications y /api/candidate/applications devuelven las Application cuyo `candidateEmail` coincide con el email de la cuenta, y POST /api/applications es publico (invitados postulan solo con su email). my-applications ademas hace `...app`, es decir devuelve telefono, cvUrl (URL publica del CV), coverLetter y el campo interno `notes`.
- **Evidencia:**

```ts
// src/app/api/auth/register/route.ts
          role: 'candidate',
          isActive: true,
          emailVerified: new Date()
// src/app/api/my-applications/route.ts
    const applications = await prisma.application.findMany({
      where: {
        OR: [{ userId: parseInt(userId) }, { candidateEmail: userEmail }]
      },
```

- **Escenario de fallo:** 1) Maria postula como invitada a una vacante con maria@empresa.com (sube CV, telefono, carta). No tiene cuenta. 2) Un atacante que conoce ese correo (su jefe, un ex) hace POST /api/auth/register con email maria@empresa.com y cualquier password valida: recibe 201 y la cookie auth-token. 3) GET /api/my-applications (o /api/candidate/applications) le devuelve todas las postulaciones de Maria con cvUrl, telefono, carta, status y notas internas. 4) Maria ya no puede registrarse ('Este email ya esta registrado') y si usa 'olvide mi contrasena' hereda un perfil creado por el atacante (pre-hijacking). El mismo hueco permite la inyeccion de HTML en el correo de reset descrita en otro hallazgo.
- **Arreglo propuesto:** Crear el usuario con `emailVerified: null`, enviar un enlace de verificacion de un solo uso (mismo mecanismo que forgot-password, guardando el hash del token) y no emitir la cookie (o emitir una sesion restringida) hasta verificar. En my-applications y candidate/applications hacer el match por `candidateEmail` solo si `emailVerified` no es null; mientras tanto solo por `userId`. Excluir `notes` de la respuesta al candidato con un `select` explicito. Dejar de escribir emailVerified en el alta.
- **Otros auditores añaden:** Crear la cuenta con emailVerified: null y enviar un correo de verificacion con token de un solo uso; limitar acciones sensibles (postular, ser visible a reclutadores) hasta verificar. Implementar el pendiente #20/#26 (tokenVersion/passwordChangedAt) para que el reset invalide los JWT previos, y marcar emailVerified al completar un reset por correo. — Implementar verificacion real de email (token por correo, emailVerified=null hasta confirmar) y no vincular por email hasta que este verificado: en my-applications y candidate/applications usar solo userId, y tras verificar el correo ejecutar un 'claim' que haga application.updateMany({where:{candidateEmail, userId:null}, data:{userId}}). En los enriquecimientos por email (company/*, recruiter, specialist, integration) preferir application.userId -> candidate.userId cuando exista.

#### AUTH-002 — Desactivar un usuario o cambiarle el rol no corta su acceso: el middleware y ~20 rutas confian en el JWT sin consultar la DB

- **Severidad:** 🟠 high · **Categoría:** authz · **Estado:** nuevo · **Verificación:** ✅ verificada contra el código
- **Ubicación:** `src/middleware.ts:56` · relacionados: `src/app/api/company/dashboard/route.ts`, `src/app/api/company/applications/[id]/route.ts`, `src/app/api/evaluations/notes/route.ts`, `src/app/api/evaluations/skill-ratings/route.ts`, `src/app/api/jobs/[id]/route.ts`, `src/app/api/jobs/publish/route.ts`, `src/app/api/credits/purchases/route.ts`, `src/app/api/my-applications/route.ts`, `src/app/api/vendor/my-code/route.ts`, `src/app/api/profile/documents/route.ts`, `src/app/api/auth/me/route.ts`, `src/lib/auth.ts`
- **Problema:** El middleware solo valida la firma del JWT (7 dias de vida) y decide el gating por rol con `payload.role`; luego inyecta x-user-id/x-user-email/x-user-role tomados del token. Muchas rutas autorizan SOLO con esos headers o con verifyToken() directo, sin comprobar `isActive` ni el rol actual en DB: company/dashboard, company/applications/[id], company/jobs/[jobId]/candidates, company/interviews, company/interview-requests, company/profile, evaluations/notes, evaluations/skill-ratings, interview-requests/[id], vendor/my-code, vendor/my-sales, my-applications, credits/purchases, profile/documents, profile/experience, jobs/[id] (verifyJobOwnership usa payload.role==='admin'), jobs/publish PUT (carga el user pero no mira isActive). Un grep de `isActive` en esas carpetas devuelve 0 coincidencias. Solo las rutas que usan requireAuth/requireRole respetan la desactivacion. Es distinto del pendiente #20/#26 (reset de password): aqui no hace falta migracion, basta consultar isActive/role.
- **Comprobación:** Confirmado: el middleware decide con el JWT; no consulta `User.isActive` ni el rol vigente.
- **Evidencia:**

```ts
// src/middleware.ts
  const payload = verifyToken(token);
  ...
  if (isAdminRoute && payload.role !== 'admin') {
  ...
  requestHeaders.set('x-user-id', payload.userId.toString());
  requestHeaders.set('x-user-email', payload.email);
  requestHeaders.set('x-user-role', payload.role);
// src/app/api/company/applications/[id]/route.ts
    const userId = request.headers.get('x-user-id');
    const userRole = request.headers.get('x-user-role');
    if (userRole !== 'company') {
```

- **Escenario de fallo:** 1) El admin desactiva a un reclutador despedido o a una empresa fraudulenta con DELETE /api/admin/users?id=N (isActive=false) o le cambia el rol. 2) El navegador de esa persona conserva la cookie auth-token vigente hasta 7 dias. 3) Sigue pudiendo: GET /api/evaluations/notes?applicationId=X y POST skill-ratings (PII y evaluaciones de candidatos), GET /api/company/dashboard y /api/company/jobs/[jobId]/candidates, PATCH /api/company/applications/[id], POST /api/credits/purchases, y si era admin, PUT/PATCH/DELETE /api/jobs/[id] sobre CUALQUIER vacante porque verifyJobOwnership confia en payload.role==='admin'. /api/auth/me devuelve 403/404 (el Navbar lo muestra deslogueado) pero las rutas anteriores siguen respondiendo 200.
- **Arreglo propuesto:** Opcion A (central): el middleware ya corre con runtime 'nodejs'; tras verifyToken hacer `prisma.user.findUnique({ where:{ id: payload.userId }, select:{ isActive:true, role:true, email:true } })`, responder 401 y borrar la cookie si no existe o esta inactivo, y usar role/email de DB para el gating y para los headers x-user-*. Opcion B: reemplazar en cada ruta listada la lectura de headers/verifyToken por requireAuth()/requireRole() de src/lib/auth.ts (que ya valida isActive). En jobs/[id] cambiar verifyJobOwnership para usar requireAuth. En /api/auth/me borrar la cookie cuando el usuario no existe o esta inactivo. Agregar test: desactivar usuario -> 401/403 en /api/company/dashboard y /api/jobs/[id].
- **Otros auditores añaden:** Sustituir la lectura de cabeceras por requireRole()/requireAuth() (ya validan isActive y rol en DB) en: company/dashboard, company/profile, company/interviews, company/interview-requests, company/applications/[id], company/jobs/[jobId]/candidates, evaluations/notes, evaluations/skill-ratings, interview-requests/[id], my-applications, vendor/my-code, vendor/my-sales, applications (GET), applications/[id], company-requests (GET), company-requests/[id] (4 metodos), admin/specialties (GET), admin/specialties/[id] (GET). En jobs/[id] (verifyJobOwnership), jobs/publish PUT, credits/purchases, profile/documents, profile/experience[/id], candidate/applications y applications POST usar requireAuth() en vez de verifyToken a secas. En requireApiKey incluir user: { isActive, role } en el select y rechazar si la empresa esta inactiva. Cuando se implemente el pendiente #20/#26 (tokenVersion), validarlo en el mismo helper.

#### AUTH-003 — La pagina de compra de creditos pide los paquetes a /api/admin/* y el middleware se lo bloquea a las empresas: se muestran precios hardcodeados y se cobra el precio de la DB

- **Severidad:** 🟠 high · **Categoría:** payments · **Estado:** pendiente conocido de junio · **Verificación:** ✅ verificada contra el código
- **Ubicación:** `src/middleware.ts:84` · relacionados: `src/app/credits/purchase/page.tsx`, `src/app/api/admin/credit-packages/route.ts`, `src/app/api/credits/purchases/route.ts`
- **Problema:** Detalle nuevo del pendiente #28 (no es solo un branch muerto). /credits/purchase llama a /api/admin/credit-packages?activeOnly=true, pero todo /api/admin/ es solo-admin en el middleware, asi que una empresa recibe siempre 403 JSON {success:false}. La pagina cae silenciosamente a DEFAULT_PACKAGES (1/10/15/20 creditos a 4000/35000/50000/65000) y con ese importe inicializa el Brick de MercadoPago, mientras que POST /api/credits/purchases cobra `pkg.price` leido de la DB (`transaction_amount: finalPrice`).
- **Comprobación:** Confirmado: `pathname.startsWith("/api/admin/")` obliga rol admin, y la página de compra pide `/api/admin/credit-packages`.
- **Evidencia:**

```ts
// src/middleware.ts
    pathname.startsWith('/api/admin/') ||
  ...
  if (isAdminRoute && payload.role !== 'admin') {
// src/app/credits/purchase/page.tsx
      const response = await fetch('/api/admin/credit-packages?activeOnly=true');
      const data = await response.json();
      if (data.success && data.data.length > 0) {
        setPackages(data.data);
      } else {
        // Usar paquetes por defecto si no hay en la BD
        setPackages(DEFAULT_PACKAGES);
```

- **Escenario de fallo:** 1) El admin cambia en /admin/credit-packages el Pack 10 de $35,000 a $40,000 (o crea un pack de 5, o desactiva el de 15). 2) Una empresa abre /credits/purchase: el fetch devuelve 403 por el middleware y la UI muestra los precios hardcodeados ($35,000) y los 4 packs fijos. 3) Paga: el servidor crea el pago en MercadoPago por $40,000. La empresa ve un precio en pantalla y se le carga otro. Los packs nuevos nunca aparecen y un pack desactivado se sigue ofreciendo pero falla con 'Paquete no disponible'.
- **Arreglo propuesto:** Crear GET /api/credit-packages (fuera de /api/admin, autenticado para company/admin, solo isActive, agregado al matcher) y consumirlo desde la pagina; eliminar el branch `activeOnly` sin auth del endpoint admin. Quitar DEFAULT_PACKAGES: si la carga falla, mostrar error y deshabilitar el checkout. Enviar `expectedPrice` en POST /api/credits/purchases y rechazar con 409 si difiere del calculado en servidor. Revisar tambien PACKAGE_CREDITS (mapa fijo pack_1/10/15/20) que impide comprar packs creados por el admin.

#### AUTH-004 — /api/vendor/* abierto a cualquier usuario autenticado: una cuenta gratuita crea su propio codigo 10%/10% y anula el anti auto-referido (#34)

- **Severidad:** 🟠 high · **Categoría:** payments · **Estado:** arreglo previo incompleto · **Verificación:** ✅ verificada contra el código
- **Ubicación:** `src/middleware.ts:232` · relacionados: `src/app/api/vendor/my-code/route.ts`, `src/app/api/vendor/my-sales/route.ts`, `src/app/api/credits/purchases/route.ts`, `src/components/commons/Navbar.tsx`, `src/app/vendor/dashboard/page.tsx`
- **Problema:** El middleware no aplica gating de rol a /api/vendor/* ni a /vendor/*. POST /api/vendor/my-code deja que cualquier usuario (por ejemplo un candidato recien autorregistrado, sin verificacion de email) cree un DiscountCode activo con 10% de descuento y 10% de comision. La compra solo comprueba `foundCode.userId === payload.userId`, asi que el arreglo #34 se salta con una segunda cuenta. El resto del sistema asume que vendedor es un rol creado por el admin (POST /api/admin/vendors crea role 'vendor' con porcentajes definidos por el admin; el Navbar solo muestra 'Panel Vendedor' a admin/vendor).
- **Comprobación:** Confirmado: `/api/vendor/` no aparece en ninguna de las listas de rutas por rol del middleware.
- **Evidencia:**

```ts
// src/middleware.ts
  // Rutas de VENDOR - accesibles para cualquier usuario autenticado
  // Permite que cualquier usuario registrado pueda crear y gestionar su código de descuento
// src/app/api/vendor/my-code/route.ts
    const discountCode = await prisma.discountCode.create({
      data: {
        code: normalizedCode,
        userId,
        discountPercent: 10,
        commissionPercent: 10,
        isActive: true
      },
```

- **Escenario de fallo:** 1) El dueno de una empresa registra gratis una cuenta de candidato con otro correo en /register. 2) Con esa sesion hace POST /api/vendor/my-code {code:'MIDESC'} -> 201. 3) Con la cuenta de empresa compra creditos con discountCode 'MIDESC': paga 10% menos en cada compra y ademas se genera un DiscountCodeUse con 10% de comision 'pending' a favor de su segunda cuenta, que aparece en /admin/vendors como comision por pagar. Cualquier empresa puede auto-otorgarse 10% permanente.
- **Arreglo propuesto:** En el middleware agregar `isVendorRoute = pathname.startsWith('/api/vendor/') || pathname.startsWith('/vendor/')` y exigir role 'vendor' o 'admin'. En vendor/my-code y vendor/my-sales usar requireRole(['vendor','admin']) en lugar del header. En POST /api/credits/purchases y /api/discount-codes/validate exigir que el dueno del codigo tenga role vendor/admin e isActive. Desactivar por script los DiscountCode cuyo dueno no sea vendor/admin. Si el programa de referidos abierto es una decision de negocio, al menos exigir email verificado y aprobacion del admin antes de activar el codigo.

## 🟡 medium (10)

#### AUTH-005 — El enlace de reset usa `NEXT_PUBLIC_BASE_URL`, variable que no existe en ningun .env.example ni doc (el resto usa NEXT_PUBLIC_APP_URL)

- **Severidad:** 🟡 medium · **Categoría:** config · **Estado:** nuevo · **Verificación:** sin verificar (reportada por 3 auditores)
- **Ubicación:** `src/app/api/auth/forgot-password/route.ts:45` · relacionados: `src/app/api/company/interview-requests/route.ts`, `src/app/api/credits/purchases/route.ts`, `.env.example`
- **Problema:** Todo el proyecto documenta y usa `NEXT_PUBLIC_APP_URL` (.env.example:89, docs/ENVIRONMENT_VARIABLES.md, credits/purchases/route.ts:164, company/interview-requests/route.ts:128). forgot-password es el unico que lee `NEXT_PUBLIC_BASE_URL`, que no aparece en ningun ejemplo ni guia, por lo que siempre cae al fallback 'https://inakat.com'. En cualquier despliegue cuyo dominio no sea ese (la propia doc pone de ejemplo https://inakat.vercel.app, previews, staging, local) el enlace de reset apunta a otro entorno donde el token no existe.
- **Evidencia:**

```ts
// Construir URL
const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://inakat.com';
const resetUrl = `${baseUrl}/reset-password?token=${resetToken}`;
```

- **Escenario de fallo:** En staging (inakat-staging.vercel.app, con su propia DB) un usuario pide recuperar contrasena. El correo lo manda a https://inakat.com/reset-password?token=... Produccion responde 'token invalido' porque el token vive en la DB de staging. El flujo de recuperacion es imposible de probar fuera de prod.
- **Arreglo propuesto:** Cambiar a `process.env.NEXT_PUBLIC_APP_URL` y centralizar en src/lib/utils.ts un `getAppUrl()` (que en produccion lance si falta la variable, en vez de asumir inakat.com) usado por forgot-password, interview-requests y credits/purchases.
- **Otros auditores añaden:** Usar `process.env.NEXT_PUBLIC_APP_URL` (como credits/purchases y company/interview-requests) y, si falta, derivar el origen de la request (`new URL(request.url).origin`) en lugar de un dominio fijo. Centralizarlo en un helper `getAppUrl()` y documentarlo en el modulo de validacion de env pendiente (#88). — Sustituir por `process.env.NEXT_PUBLIC_APP_URL` y centralizar en un helper `getAppUrl()` en src/lib (usado por forgot-password, credits/purchases e interview-requests). Anadir test que fije NEXT_PUBLIC_APP_URL y verifique el href del correo.

#### AUTH-006 — El correo de recuperacion de contrasena interpola `user.nombre` sin escapeHtml (la remediacion #67/#12 no cubrio esta plantilla)

- **Severidad:** 🟡 medium · **Categoría:** security · **Estado:** arreglo previo incompleto · **Verificación:** sin verificar (reportada por 4 auditores)
- **Ubicación:** `src/app/api/auth/forgot-password/route.ts:55` · relacionados: `src/lib/email.ts`, `src/app/api/auth/register/route.ts`
- **Problema:** email.ts exporta `escapeHtml` y documenta que 'todos los valores controlados por el usuario se pasan por escapeHtml()', pero forgot-password construye su propio HTML inline (sin baseTemplate) e inserta `${user.nombre}` crudo. `nombre` lo controla el usuario: el schema de /api/auth/register solo exige `min(2)` y no sanitiza, y /api/profile permite cambiarlo. No hay verificacion de email en el registro, asi que un atacante puede crear la cuenta con el correo de la victima.
- **Evidencia:**

```ts
await sendEmail({
  to: user.email,
  subject: 'Recuperación de contraseña - INAKAT',
  html: `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #004aad;">Recuperación de contraseña</h2>
      <p>Hola <strong>${user.nombre}</strong>,</p>
```

- **Escenario de fallo:** El atacante se registra con email victima@empresa.com y nombre `</strong><a href="https://evil.tld/login">Tu cuenta fue bloqueada, verifica aqui</a>`. Llama a POST /api/auth/forgot-password con ese email. La victima recibe, desde el dominio legitimo de INAKAT y pasando SPF/DKIM, un correo con el enlace de phishing incrustado.
- **Arreglo propuesto:** Mover la plantilla a email.ts como `sendPasswordReset({email,nombre,resetUrl})` usando `baseTemplate` y `escapeHtml(nombre)` / `escapeHtml(resetUrl)`; en la ruta llamar a ese helper. Agregar un test en __tests__/lib/email.test.ts con un nombre que contenga `<a>`.
- **Otros auditores añaden:** import { sendEmail, escapeHtml } from '@/lib/email' y usar ${escapeHtml(user.nombre)}; mejor aun, mover este correo a un template en src/lib/email.ts sobre baseTemplate (colores de marca). En registerSchema limitar nombre/apellidos con .max(80) y una regex de letras/espacios/guiones. — Importar `escapeHtml` de '@/lib/email' y usar `${escapeHtml(user.nombre)}`; mejor aun, mover la plantilla a email.ts como `sendPasswordResetEmail()` sobre baseTemplate para que todas las plantillas pasen por el mismo escape. En el registro limitar nombre/apellidos con `.max(80)` y una regex de caracteres permitidos.

#### AUTH-007 — Logout no revoca nada: el JWT sigue siendo valido 7 dias; tampoco lo invalidan los 4 puntos donde se cambia la contrasena

- **Severidad:** 🟡 medium · **Categoría:** security · **Estado:** pendiente conocido de junio · **Verificación:** sin verificar (reportada por 1 auditor)
- **Ubicación:** `src/app/api/auth/logout/route.ts:19` · relacionados: `src/lib/auth.ts`, `src/app/api/auth/reset-password/route.ts`, `src/app/api/profile/route.ts`, `src/app/api/admin/users/route.ts`, `src/app/api/admin/candidates/[id]/reset-password/route.ts`, `src/lib/integration-auth.ts`
- **Problema:** Detalle concreto para el pendiente #20/#26. El logout solo borra la cookie en el navegador que lo pide; un token copiado (equipo compartido, extension, proxy, backup del navegador) sigue funcionando hasta que expire. Lo mismo pasa al cambiar la contrasena en cualquiera de estos sitios, que deberian incrementar la version de token: src/app/api/auth/reset-password/route.ts:62, src/app/api/profile/route.ts:226, src/app/api/admin/users/route.ts:284 y src/app/api/admin/candidates/[id]/reset-password/route.ts:69. Hoy ni requireAuth ni el middleware comparan nada contra la DB salvo isActive (y el middleware ni eso).
- **Evidencia:**

```ts
export async function POST() {
  const response = NextResponse.json(
    { success: true, message: 'Sesión cerrada exitosamente' },
    { status: 200 }
  );

  // Eliminar cookie de autenticación
  response.cookies.delete('auth-token');

  return response;
}
```

- **Escenario de fallo:** Una empresa detecta acceso indebido a su cuenta, cierra sesion y cambia la contrasena desde /profile. El atacante, que copio el valor de auth-token, sigue llamando /api/company/dashboard y /api/credits/purchases durante hasta 7 dias: ni el logout ni el cambio de contrasena afectan a su token.
- **Arreglo propuesto:** Migracion: `tokenVersion Int @default(0)` en User. generateToken incluye `tv`. requireAuth/getOptionalAuthUser/requireCompanyUser (y el middleware si se adopta la consulta a DB) rechazan si `payload.tv !== user.tokenVersion`. Incrementar tokenVersion en: logout (requiere leer el token en el handler), reset-password, PUT /api/profile con newPassword, PUT /api/admin/users con password o isActive=false o cambio de role, y admin/candidates/[id]/reset-password. Reducir JWT_EXPIRES_IN (p.ej. 24h con renovacion deslizante).

#### AUTH-008 — El fix #55 (validar esquema de fileUrl) no se aplico al registro publico: documents[].fileUrl, fotoUrl y los links aceptan cualquier string

- **Severidad:** 🟡 medium · **Categoría:** security · **Estado:** arreglo previo incompleto · **Verificación:** sin verificar (reportada por 2 auditores)
- **Ubicación:** `src/app/api/auth/register/route.ts:82` · relacionados: `src/app/api/profile/documents/route.ts`, `src/lib/utils.ts`, `src/components/shared/CandidateProfileModal.tsx`, `src/components/shared/CandidatePhoto.tsx`, `next.config.ts`, `src/app/register/page.tsx`
- **Problema:** La remediacion de Stored XSS #55 añadio isSafeDocumentUrl SOLO en /api/profile/documents. El endpoint publico y sin autenticar /api/auth/register guarda documents[].fileUrl y fotoUrl tal cual (z.string()), y cv/linkedin/portafolio pasan por normalizeUrl, que solo mira startsWith('http'). fileUrl se renderiza como href en CandidateProfileModal, admin/candidates, CandidateForm y profile. React 19 neutraliza 'javascript:' en href (mitigacion del framework, no de la app), pero un actor anonimo puede plantar enlaces externos arbitrarios presentados al staff como 'documentos del candidato' (phishing/malware), un fotoUrl externo que se carga con <img> plano en CandidateForm/profile (pixel de rastreo de IPs de admins) y que rompe next/image en CandidatePhoto (solo se permite *.public.blob.vercel-storage.com). Tampoco hay .max() en strings ni en arrays.
- **Evidencia:**

```ts
  documents: z
    .array(
      z.object({
        name: z.string(),
        fileUrl: z.string()
      })
    )
    .optional(),

  // FEAT-2: Foto de perfil del candidato
  fotoUrl: z.string().optional()
```

- **Escenario de fallo:** Atacante sin cuenta hace POST /api/auth/register con documents:[{name:'Cédula profesional', fileUrl:'https://sitio-malicioso.tld/cedula.pdf.exe'}] y fotoUrl:'https://tracker.tld/p.png', luego se postula a vacantes. El reclutador abre el perfil en CandidateProfileModal y hace clic en el 'documento' (descarga externa); al editar el candidato en /admin/candidates el navegador del admin pide la imagen al servidor del atacante.
- **Arreglo propuesto:** Mover isSafeDocumentUrl a src/lib (p.ej. src/lib/url-safety.ts) y usarlo en registerSchema: fileUrl y fotoUrl con .refine() que exija https y host del Blob store (o ruta /uploads/ en dev); cvUrl/linkedinUrl/portafolioUrl con .refine(isSafeHttpUrl) tras normalizar. Corregir normalizeUrl para comprobar /^https?:\/\//i. Añadir .max() a todos los strings y .max(20) a los arrays. Aplicar lo mismo en /api/admin/candidates.
- **Otros auditores añaden:** Mover isSafeDocumentUrl a src/lib/validations.ts y usarla en el schema del registro: `fileUrl: z.string().refine(isSafeDocumentUrl)`; para fotoUrl, cvUrl y documentos exigir ademas que el host sea el del Blob propio (`*.public.blob.vercel-storage.com`) o `/uploads/` en desarrollo. Aplicar la misma regla en PUT /api/profile (fotoUrl) y en POST /api/applications (cvUrl).

#### AUTH-009 — Enumeracion de usuarios en el registro: el 409 distingue 'email ya registrado' y 'ya existe un candidato'

- **Severidad:** 🟡 medium · **Categoría:** security · **Estado:** nuevo · **Verificación:** sin verificar (reportada por 1 auditor)
- **Ubicación:** `src/app/api/auth/register/route.ts:166` · relacionados: `src/lib/rate-limit.ts`
- **Problema:** La auditoria de junio cerro la enumeracion en login (#24) y en forgot-password, pero el registro sigue siendo un oraculo: responde 409 con mensajes distintos si el email existe como User o como Candidate del banco de talento (personas precargadas por el admin que nunca se registraron). La unica barrera es REGISTER_RATE_LIMIT, que es en memoria por instancia y por IP.
- **Evidencia:**

```ts
    if (existingUser) {
      return NextResponse.json(
        { success: false, error: 'Este email ya está registrado' },
        { status: 409 }
      );
    }
    ...
    if (existingCandidate) {
      return NextResponse.json(
        { success: false, error: 'Ya existe un candidato con ese email' },
        { status: 409 }
```

- **Escenario de fallo:** Un atacante envia POST /api/auth/register con un cuerpo minimo valido y el email a probar. 409 'Este email ya esta registrado' = cuenta existente (objetivo de credential stuffing/phishing); 409 'Ya existe un candidato...' = la persona esta en la base de candidatos de INAKAT aunque nunca se registro (dato sensible: busca empleo). Rotando IPs o aprovechando que cada instancia serverless tiene su propio contador, el limite de 3/h no lo frena.
- **Arreglo propuesto:** Con verificacion de email (ver hallazgo de registro) responder siempre 200/202 generico ('Te enviamos un correo para continuar') y, si el email ya existe, enviar al titular un correo de 'ya tienes cuenta / restablece tu contrasena'. Mientras tanto, unificar ambos 409 en un solo mensaje generico y mover el rate limit a un store compartido (pendiente #89).

#### AUTH-010 — Candidatos cargados por el admin sin cuenta no pueden auto-registrarse: 409 'Ya existe un candidato con ese email' sin salida

- **Severidad:** 🟡 medium · **Categoría:** correctness · **Estado:** nuevo · **Verificación:** sin verificar (reportada por 3 auditores)
- **Ubicación:** `src/app/api/auth/register/route.ts:181` · relacionados: `src/app/api/admin/candidates/route.ts`, `src/app/register/page.tsx`, `src/app/api/auth/forgot-password/route.ts`
- **Problema:** POST /api/admin/candidates permite crear un Candidate sin User (password opcional; fuentes 'linkedin', 'occ', 'manual'). Cuando esa persona intenta registrarse, el API responde 409 y la pagina solo muestra el toast. No puede usar 'Olvidé mi contraseña' (no existe User) ni hay flujo para reclamar el perfil; la unica salida es que un admin use /api/admin/candidates/[id]/reset-password, cosa que el usuario no tiene forma de saber.
- **Evidencia:**

```ts
    const existingCandidate = await prisma.candidate.findUnique({
      where: { email: email.toLowerCase() }
    });

    if (existingCandidate) {
      return NextResponse.json(
        {
          success: false,
          error: 'Ya existe un candidato con ese email'
        },
        { status: 409 }
      );
    }
```

- **Escenario de fallo:** Admin importa a 'Ana' desde LinkedIn al banco de candidatos (sin contraseña). Un reclutador la contacta y le pide registrarse. Ana llena los 6 pasos, pulsa CREAR CUENTA -> toast 'Ya existe un candidato con ese email' que desaparece a los 8 s. Intenta recuperar contraseña -> 'Correo enviado' pero nunca llega nada (no hay User). Abandona.
- **Arreglo propuesto:** Si existingCandidate.userId es null, iniciar un flujo de 'reclamar perfil': crear el User y vincularlo SOLO tras verificar el correo con un token enviado a esa direccion (nunca auto-vincular sin verificacion, porque expondria la PII cargada por el admin). Como minimo, devolver un mensaje accionable ('Ya tenemos tu perfil; te enviamos un correo para activar tu cuenta') y mapearlo al campo email del paso 1.
- **Otros auditores añaden:** Si existe Candidate con `userId: null`, no rechazar: tras verificar el email, crear el User y vincularlo (`candidate.update({ userId })`) fusionando los datos del formulario con el perfil existente (sin sobrescribir notas internas). Solo responder conflicto cuando el Candidate ya tiene userId. Cubrir con test de integracion. — Si existe Candidate con userId null: crear el User en estado no verificado, enviar email de verificacion y, al confirmar el token, vincular candidate.userId y fusionar los datos (nunca vincular sin verificar, o se podria secuestrar el perfil con PII). Responder al cliente con un mensaje generico ('Revisa tu correo para continuar') para no revelar pertenencia al banco.

#### AUTH-011 — Los limites por IP cuentan tambien los intentos exitosos y son muy bajos para IP compartidas; no hay limite por cuenta

- **Severidad:** 🟡 medium · **Categoría:** reliability · **Estado:** nuevo · **Verificación:** sin verificar (reportada por 1 auditor)
- **Ubicación:** `src/lib/rate-limit.ts:121` · relacionados: `src/app/api/auth/login/route.ts`, `src/app/api/auth/register/route.ts`
- **Problema:** applyRateLimit se ejecuta al inicio de login y register para TODA peticion y el contador nunca se reinicia tras un login correcto. Con 7 logins/15 min y 3 registros/hora por IP, un NAT de oficina, una universidad o el CGNAT de un operador movil agotan el cupo con trafico legitimo. A la vez no existe limite por email, asi que un ataque distribuido contra una sola cuenta no se frena (y cada instancia serverless tiene su propio Map, pendiente #89). Si no llega x-forwarded-for ni x-real-ip, todos los clientes comparten la clave 'unknown'. Tomar el primer valor de x-forwarded-for solo es seguro detras de Vercel; en otro hosting es falsificable.
- **Evidencia:**

```ts
/** Login: 7 intentos por 15 minutos por IP */
export const LOGIN_RATE_LIMIT: RateLimitConfig = {
  maxRequests: 7,
  windowSeconds: 15 * 60
};

/** Register: 3 registros por hora por IP */
export const REGISTER_RATE_LIMIT: RateLimitConfig = {
  maxRequests: 3,
  windowSeconds: 60 * 60
};
```

- **Escenario de fallo:** a) Feria de empleo / laboratorio universitario: 20 candidatos se registran desde la misma IP; a partir del 4o reciben 429 'Demasiadas solicitudes' durante una hora (tambien cuentan los 409/400). b) Oficina de INAKAT: 8 reclutadores/especialistas inician sesion a las 9:00 desde la misma IP; el 8o queda bloqueado 15 minutos aunque todos acertaron su contrasena. c) Un atacante con un pool de IPs prueba contrasenas contra admin@... sin que ningun contador por cuenta lo detenga.
- **Arreglo propuesto:** En login: contar solo los fallos (mover el incremento a despues de authenticateUser o exponer `resetRateLimit(identifier)` y llamarlo al autenticar bien) y anadir un segundo contador por email (`login:email:<hash>`, p.ej. 10 fallos/15 min con backoff). En register: no contar respuestas 400/409 o subir el limite (p.ej. 10/h) y anadir limite por email. Migrar el store a Upstash/Redis (pendiente #89). Usar `request.headers.get('x-vercel-forwarded-for')`/`x-real-ip` cuando exista y no agrupar en 'unknown'.

#### AUTH-012 — Modulos criticos sin ningun test que los ejecute: middleware, upload, publicacion con creditos, puente Worky2, forgot-password

- **Severidad:** 🟡 medium · **Categoría:** tests · **Estado:** nuevo · **Verificación:** sin verificar (reportada por 1 auditor)
- **Ubicación:** `src/middleware.ts:10` · relacionados: `src/app/api/upload/route.ts`, `src/app/api/jobs/publish/route.ts`, `src/lib/integration-auth.ts`, `src/lib/worky2-webhook.ts`, `src/app/api/integration/keys/route.ts`, `src/app/api/auth/forgot-password/route.ts`
- **Problema:** Cruzando todos los imports de __tests__ contra src: ningun test importa src/middleware.ts (toda la autorizacion por rol), src/app/api/upload/route.ts (validacion de tipo #54), src/app/api/jobs/publish/route.ts (transaccion de creditos #6), src/app/api/auth/forgot-password/route.ts, src/app/api/company/applications/[id]/route.ts (transiciones de estado), src/lib/authz-applications.ts, src/lib/pricing.ts, ni nada de src/lib/integration-*.ts, src/lib/worky2-webhook.ts o src/app/api/integration/** (codigo nuevo posterior a la auditoria). feb2026-regression.test.ts solo comprueba por regex que middleware.ts contiene la palabra 'admin'.
- **Evidencia:**

```ts
__tests__/qa/feb2026-regression.test.ts:213-216
  it('middleware should protect /admin routes', () => {
    const content = readFile('src/middleware.ts');
    expect(content).toMatch(/admin/);
  });
Grep de 'integration|worky2' en __tests__: solo coincidencias no relacionadas (notifications, multiple-education, distance).
```

- **Escenario de fallo:** Se reordena un `startsWith` en el middleware o se anade una ruta nueva fuera del matcher (ya ocurre con /api/integration/*, que se autentica sola): nada falla en CI. O se rompe la comparacion de hash de API key en requireApiKey y Worky2 deja de autenticar / autentica de mas, sin test que lo cubra.
- **Arreglo propuesto:** Anadir suites con el handler real: (1) middleware: tabla ruta x rol x metodo -> 401/403/next y cabeceras x-user-*; (2) upload: extension+MIME, 5MB, vacio, sin token en prod -> 503; (3) jobs/publish: creditos insuficientes, descuento atomico, doble click; (4) integration: keys (hash, revocar, ownership), candidates (key invalida/inactiva, aislamiento entre empresas), webhooks (firma HMAC con vector conocido, timeout); (5) forgot/reset-password de punta a punta.

#### AUTH-013 — GET /api/applications/check es publico y sin rate limit: permite averiguar si una persona postulo a una vacante y en que estado va

- **Severidad:** 🟡 medium · **Categoría:** security · **Estado:** nuevo · **Verificación:** sin verificar (reportada por 1 auditor)
- **Ubicación:** `src/middleware.ts:24` · relacionados: `src/app/api/applications/check/route.ts`, `src/components/sections/talents/ApplyJobModal.tsx`
- **Problema:** El middleware exceptua de autenticacion GET /api/applications/check. La ruta recibe jobId y email por query y devuelve hasApplied, el id de la aplicacion, el status real y la fecha, sin sesion ni applyRateLimit. El unico consumidor (ApplyJobModal) la llama despues de obtener /api/profile, es decir siempre con sesion, por lo que la exposicion publica es innecesaria. Ademas `parseInt(jobId)` con un valor no numerico produce NaN y Prisma lanza -> 500.
- **Evidencia:**

```ts
// src/middleware.ts
  if (pathname === '/api/applications/check' && request.method === 'GET') {
    return NextResponse.next();
  }
// src/app/api/applications/check/route.ts
    const existingApplication = await prisma.application.findFirst({
      where: {
        jobId: parseInt(jobId),
        candidateEmail: email.toLowerCase()
      },
      select: { id: true, status: true, createdAt: true }
```

- **Escenario de fallo:** Un empleador sospecha que su empleado busca trabajo: recorre los jobId activos (publicos en /api/jobs) con GET /api/applications/check?jobId=N&email=empleado@empresa.com. Sin sesion ni limite obtiene en que vacantes postulo, cuando, y si fue 'accepted' o 'rejected'. Con una lista de correos se puede perfilar toda la base de postulantes.
- **Arreglo propuesto:** Quitar la excepcion del middleware; en la ruta usar requireAuth() y tomar el email de la sesion (ignorar el query param) o, si se quiere mantener para invitados, responder solo `{hasApplied:boolean}` sin id/status/fecha y aplicar applyRateLimit por IP. Validar jobId con Number.isInteger y responder 400. Actualizar __tests__/api/middleware-exceptions.test.ts.

#### AUTH-014 — El middleware devuelve 403 a reclutadores y especialistas en /api/admin/candidates/[id]/documents aunque el handler los autoriza: 'Agregar documento' nunca funciona y deja archivos huerfanos

- **Severidad:** 🟡 medium · **Categoría:** correctness · **Estado:** nuevo · **Verificación:** sin verificar (reportada por 1 auditor)
- **Ubicación:** `src/middleware.ts:88` · relacionados: `src/app/api/admin/candidates/[id]/documents/route.ts`, `src/components/shared/CandidateProfileModal.tsx`, `src/app/recruiter/jobs/[jobId]/page.tsx`, `src/app/specialist/jobs/[jobId]/page.tsx`
- **Problema:** El handler de documentos permite requireRole(['admin','recruiter','specialist']) y las paginas de reclutador y especialista montan CandidateProfileModal con canAddDocuments={true}, pero la ruta vive bajo /api/admin/, que el middleware restringe a role 'admin' antes de llegar al handler. El modal primero sube el archivo a /api/upload (publico) y despues hace el POST que falla.
- **Evidencia:**

```ts
// src/middleware.ts
  if (isAdminRoute && payload.role !== 'admin') {
    if (pathname.startsWith('/api/')) {
      return NextResponse.json(
        { success: false, error: 'No tienes permisos de administrador para acceder a este recurso.' },
        { status: 403 }
// src/app/api/admin/candidates/[id]/documents/route.ts
    const auth = await requireRole(['admin', 'recruiter', 'specialist']);
// src/app/recruiter/jobs/[jobId]/page.tsx
        canAddDocuments={true}
```

- **Escenario de fallo:** Un reclutador abre el perfil de un candidato en /recruiter/jobs/[jobId], pulsa 'Agregar', elige un PDF y guarda. 1) POST /api/upload sube el archivo a Vercel Blob con URL publica. 2) POST /api/admin/candidates/ID/documents -> 403 del middleware; el modal muestra 'No tienes permisos de administrador...'. El documento nunca se asocia y el archivo (PII del candidato) queda huerfano y publico. Igual para especialistas; lo mismo con GET/DELETE de esos documentos.
- **Arreglo propuesto:** Mover la ruta fuera de /api/admin (p.ej. /api/candidates/[id]/documents, agregada al matcher) o anadir en el middleware una excepcion explicita para `/api/admin/candidates/*/documents` que permita recruiter/specialist. En el handler, ademas de requireRole, validar con authz-applications que el reclutador/especialista esta asignado a una vacante donde participa ese candidato (hoy podria adjuntar a cualquier candidateId). En el modal, hacer primero la comprobacion de permisos o borrar el blob si el segundo paso falla.

## ⚪ low (11)

#### AUTH-015 — Cuerpos invalidos devuelven 500 en las rutas de auth (JSON mal formado, email no string)

- **Severidad:** ⚪ low · **Categoría:** validation · **Estado:** nuevo · **Verificación:** sin verificar (reportada por 1 auditor)
- **Ubicación:** `src/app/api/auth/forgot-password/route.ts:18` · relacionados: `src/app/api/auth/login/route.ts`, `src/app/api/auth/register/route.ts`, `src/app/api/auth/reset-password/route.ts`
- **Problema:** login, register, forgot-password y reset-password hacen `await request.json()` dentro del try general: un cuerpo vacio o no JSON lanza y se responde 500. En forgot-password, ademas, `email` no se valida como string ni como email: `email.toLowerCase()` lanza TypeError si llega un numero, objeto o array. Cada caso escribe un console.error, generando ruido de 'errores de servidor' que en realidad son errores de cliente.
- **Evidencia:**

```ts
    const body = await request.json();
    const { email } = body;

    if (!email) {
      return NextResponse.json(
        { success: false, error: 'El correo es requerido' },
        { status: 400 }
      );
    }
    ...
      where: { email: email.toLowerCase().trim() }
```

- **Escenario de fallo:** `curl -X POST /api/auth/forgot-password -d '{"email":123}'` -> 500 'Error al procesar solicitud'. `curl -X POST /api/auth/login -d 'hola'` -> 500. Un escaner automatizado llena los logs/alertas de 5xx y distorsiona las metricas de disponibilidad.
- **Arreglo propuesto:** Envolver el parseo: `const body = await request.json().catch(() => null); if (!body) return 400`. En forgot-password validar con zod `z.object({ email: z.string().trim().toLowerCase().email() })` y responder 400 si falla. Reutilizar un helper `parseJsonBody(request, schema)` en las 4 rutas.

#### AUTH-016 — forgot-password: canal lateral de tiempo (solo espera al SMTP si el usuario existe) y sin throttle por email (bombing e invalidacion del enlace anterior)

- **Severidad:** ⚪ low · **Categoría:** security · **Estado:** nuevo · **Verificación:** sin verificar (reportada por 4 auditores)
- **Ubicación:** `src/app/api/auth/forgot-password/route.ts:33` · relacionados: `src/lib/rate-limit.ts`, `src/lib/email.ts`
- **Problema:** La respuesta es identica en contenido, pero cuando el usuario existe la ruta hace un UPDATE y `await sendEmail(...)` (handshake SMTP con Zoho, cientos de ms a segundos) antes de responder; cuando no existe responde de inmediato. La diferencia de latencia revela si el correo esta registrado. El unico limite es por IP (3/h, en memoria): no hay limite por destinatario, y cada solicitud sobrescribe resetToken, invalidando el enlace que la victima acaba de recibir.
- **Evidencia:**

```ts
    if (user) {
      // Generar token seguro
      const resetToken = crypto.randomBytes(32).toString('hex');
      ...
      await prisma.user.update({
        where: { id: user.id },
        data: { resetToken, resetTokenExpiry }
      });
      ...
      await sendEmail({
```

- **Escenario de fallo:** a) Un atacante mide el tiempo de POST /api/auth/forgot-password: ~50 ms = no registrado, ~1.5 s = registrado. b) Desde varias IPs (o instancias frias distintas) dispara decenas de solicitudes para victima@x.com: le llena la bandeja y, como cada una regenera el token, el enlace que la victima intenta usar ya no es valido ('Token invalido o expirado').
- **Arreglo propuesto:** Responder primero y enviar despues: usar `after()` de 'next/server' (Next 15) para el update+sendEmail, o igualar tiempos. Anadir un limite por email (p.ej. 3/h con clave `forgot:email:<hash>`) y no regenerar el token si ya existe uno vigente emitido hace menos de N minutos (reenviar el mismo).
- **Otros auditores añaden:** const sent = await sendEmail(...); if (!sent) console.error('[ForgotPassword] No se pudo enviar el correo de reset', { userId: user.id }) y disparar alerta/monitor; opcionalmente limpiar resetToken. En la pagina añadir 'Si no llega en unos minutos revisa spam o escríbenos a soporte'. — Guardar el token con await, pero enviar el correo fuera del camino de respuesta con `after(() => sendPasswordReset(...))` de 'next/server', de modo que ambos casos respondan en tiempo similar. Opcionalmente anadir un retardo aleatorio pequeno en la rama sin usuario.

#### AUTH-017 — register/route.test.ts no importa ni ejecuta el handler: 440 lineas de tests que no cubren la ruta

- **Severidad:** ⚪ low · **Categoría:** tests · **Estado:** nuevo · **Verificación:** sin verificar (reportada por 1 auditor)
- **Ubicación:** `src/app/api/auth/register/route.test.ts:40` · relacionados: `src/app/api/auth/register/route.ts`
- **Problema:** El archivo mockea prisma y auth pero nunca importa `POST` de './route'. Copia localmente calcularAñosExperiencia y valida regex/literales definidos en el propio test (p.ej. `expect(userData.role).toBe('candidate')` sobre un objeto creado en la linea anterior). `createMocks` se importa y no se usa. Ningun test comprobaria una regresion real en el registro (rol, cookie, 409, rate limit, emailVerified).
- **Evidencia:**

```ts
// Test helper functions
function calcularAñosExperiencia(
  experiences?: {
    fechaInicio: string;
    fechaFin?: string;
    esActual: boolean;
  }[]
): number {
  if (!experiences || experiences.length === 0) return 0;
```

- **Escenario de fallo:** Alguien cambia en route.ts `role: 'candidate'` por un valor tomado del body, o elimina la comprobacion de email duplicado: `npm test` sigue en verde (1355 tests) porque ninguna asercion toca el codigo de la ruta. El numero de tests da una falsa sensacion de cobertura sobre el modulo mas sensible.
- **Arreglo propuesto:** Reescribir el test importando `POST` de './route' y ejecutandolo con `new Request(...)`: casos 201 (role forzado a candidate aunque el body envie role:'admin', cookie httpOnly presente), 400 por password debil, 409 por User y por Candidate existente, 429 tras superar el limite, y P2002 -> 409. Exportar calcularAñosExperiencia desde un modulo de lib para testearla sin duplicarla.

#### AUTH-018 — El rate-limit de registro cuenta intentos fallidos (400/409) contra el cupo de '3 registros por hora por IP'

- **Severidad:** ⚪ low · **Categoría:** reliability · **Estado:** nuevo · **Verificación:** sin verificar (reportada por 1 auditor)
- **Ubicación:** `src/app/api/auth/register/route.ts:119` · relacionados: `src/lib/rate-limit.ts`, `src/app/api/auth/login/route.ts`
- **Problema:** applyRateLimit se ejecuta antes de validar y suma cada request, no cada registro exitoso. Con 3/h por IP, un usuario que recibe un 409 (email existente) y un 400 (email que zod rechaza) agota su cupo; en IPs compartidas (CGNAT de datos moviles, WiFi de universidad o feria de empleo) el cuarto candidato queda bloqueado una hora. El comentario dice '3 registros' pero son 3 requests. Lo mismo aplica a login (7/15 min incluyendo logins exitosos). Complementa el pendiente #89 (limiter distribuido) con un defecto distinto: que se cuenta.
- **Evidencia:**

```ts
    // Rate limiting: 3 registros por hora por IP
    const rateLimited = applyRateLimit(request, 'register', REGISTER_RATE_LIMIT);
    if (rateLimited) return rateLimited;

    const body = await request.json();
```

- **Escenario de fallo:** Candidata con email 'peña@correo.com': 1er envio -> 400 'Email inválido' (zod rechaza la ñ que el regex del cliente acepta). Corrige a otro correo ya usado -> 409. 3er intento con un correo nuevo: si en la misma instancia alguien de su misma IP hizo un request, recibe 429 'Demasiadas solicitudes' y debe esperar hasta 1 hora; si recarga pierde los 6 pasos capturados.
- **Arreglo propuesto:** Contar solo registros exitosos (incrementar tras crear el usuario) o usar dos cubos: uno amplio para requests (p.ej. 20/h) y otro de 3-5/h para altas exitosas; incluir el email en la clave ademas de la IP. En el cliente, ante 429 conservar el estado y mostrar el tiempo de espera (retryAfterSeconds).

#### AUTH-019 — Registro: fechas sin validar y colecciones sin tope terminan en 500 o en escrituras enormes

- **Severidad:** ⚪ low · **Categoría:** validation · **Estado:** nuevo · **Verificación:** sin verificar (reportada por 1 auditor)
- **Ubicación:** `src/app/api/auth/register/route.ts:223`
- **Problema:** fechaNacimiento, experiences[].fechaInicio y fechaFin son `z.string()` sin formato. `new Date('texto')` produce Invalid Date: Prisma lanza y la ruta responde 500 generico; en calcularAñosExperiencia el resultado es NaN (Math.max(0, NaN) = NaN) y añosExperiencia: NaN tambien hace fallar el create. No hay `.max()` en ningun string ni en los arrays educacion/experiences/documents, asi que un solo request anonimo puede crear miles de filas anidadas dentro de la transaccion.
- **Evidencia:**

```ts
          fechaNacimiento: fechaNacimiento ? new Date(fechaNacimiento) : null,
...
                    fechaInicio: new Date(exp.fechaInicio),
                    fechaFin: exp.fechaFin ? new Date(exp.fechaFin) : null,
...
    const start = new Date(exp.fechaInicio);
    const end = exp.fechaFin ? new Date(exp.fechaFin) : today;
```

- **Escenario de fallo:** POST /api/auth/register con experiences:[{empresa:'A',puesto:'B',fechaInicio:'2020-13-45',esActual:true}] -> 500 'Error al procesar el registro' (deberia ser 400 con el campo senalado; ademas ya consumio 1 de los 3 intentos/hora). Un cliente malicioso envia 50,000 experiencias de 1 MB de descripcion: la transaccion ocupa la conexion y llena la tabla.
- **Arreglo propuesto:** Usar `z.string().date()` / `z.coerce.date()` con refinements (fechaFin >= fechaInicio, fechaNacimiento en rango razonable), `.max()` en todos los strings (nombre 80, descripcion 2000, etc.) y `.max(20)` en los arrays. Devolver 400 con fieldErrors.

#### AUTH-020 — Carrera en el registro: dos altas simultaneas con el mismo email acaban en 500 en vez de 409

- **Severidad:** ⚪ low · **Categoría:** correctness · **Estado:** nuevo · **Verificación:** sin verificar (reportada por 1 auditor)
- **Ubicación:** `src/app/api/auth/register/route.ts:317` · relacionados: `src/app/api/company-requests/route.ts`
- **Problema:** La unicidad se comprueba con findUnique antes de la transaccion (check-then-act). Si dos requests pasan la comprobacion, el segundo create viola el indice unico (P2002) y cae en el catch generico. company-requests si maneja P2002; register no.
- **Evidencia:**

```ts
  } catch (error) {
    console.error('Error in /api/auth/register:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Error al procesar el registro'
      },
      { status: 500 }
    );
  }
```

- **Escenario de fallo:** El usuario hace doble clic/reintento por red lenta en el ultimo paso: el primer request crea la cuenta, el segundo responde 500 'Error al procesar el registro'. La UI muestra error aunque la cuenta si se creo; el usuario reintenta y ahora ve 'Este email ya esta registrado', sin haber recibido nunca la cookie en esa pestana.
- **Arreglo propuesto:** En el catch detectar `error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002'` y responder 409 con el mismo mensaje de duplicado. Deshabilitar el boton de envio mientras isSubmitting (ya existe el estado) y hacer el alta idempotente.

#### AUTH-021 — El token de reset se guarda en claro y su consumo no es atomico

- **Severidad:** ⚪ low · **Categoría:** security · **Estado:** nuevo · **Verificación:** sin verificar (reportada por 1 auditor)
- **Ubicación:** `src/app/api/auth/reset-password/route.ts:44` · relacionados: `src/app/api/auth/forgot-password/route.ts`, `prisma/schema.prisma`
- **Problema:** forgot-password guarda `resetToken` tal cual en User.resetToken y reset-password lo busca por igualdad. Cualquier lectura de la tabla (backup, replica, acceso de soporte, una futura consulta sin `select`) da tokens utilizables durante 1 hora para tomar cuentas, incluidas las de admin. Ademas el flujo es findFirst -> hash -> update por id: dos peticiones simultaneas con el mismo token pasan ambas la comprobacion (el token deja de ser de 'un solo uso' bajo concurrencia). Tampoco se comprueba isActive.
- **Evidencia:**

```ts
    const user = await prisma.user.findFirst({
      where: {
        resetToken: token,
        resetTokenExpiry: { gt: new Date() }
      }
    });
    ...
    await prisma.user.update({
      where: { id: user.id },
      data: { password: hashedPassword, resetToken: null, resetTokenExpiry: null }
```

- **Escenario de fallo:** Alguien con acceso de lectura a la DB (o a un dump) dispara forgot-password para el email del admin, lee User.resetToken y hace POST /api/auth/reset-password con ese token: toma la cuenta sin acceso al buzon. Con el token hasheado ese acceso de lectura no bastaria.
- **Arreglo propuesto:** Guardar `sha256(token)` en resetToken (enviar el token en claro solo por correo) y buscar por el hash. Consumirlo de forma atomica: `const r = await prisma.user.updateMany({ where:{ resetToken: hash, resetTokenExpiry:{ gt: new Date() }, isActive: true }, data:{ password, resetToken:null, resetTokenExpiry:null } }); if (r.count !== 1) -> 400`. Al completar, incrementar tokenVersion (pendiente #20/#26).

#### AUTH-022 — JWT_EXPIRES_IN es configurable pero la cookie tiene maxAge fijo de 7 dias en login y register

- **Severidad:** ⚪ low · **Categoría:** config · **Estado:** nuevo · **Verificación:** sin verificar (reportada por 1 auditor)
- **Ubicación:** `src/lib/auth.ts:24` · relacionados: `src/app/api/auth/login/route.ts`, `src/app/api/auth/register/route.ts`, `src/middleware.ts`
- **Problema:** La vida del token sale de la variable de entorno JWT_EXPIRES_IN (default '7d'), mientras que la cookie que lo transporta tiene `maxAge: 60 * 60 * 24 * 7` hardcodeado en login/route.ts:63 y register/route.ts:312. Cambiar la variable (por ejemplo al acortar sesiones para mitigar el pendiente #20/#26) desincroniza ambos relojes.
- **Evidencia:**

```ts
// src/lib/auth.ts
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';
// src/app/api/auth/login/route.ts
      maxAge: 60 * 60 * 24 * 7, // 7 días
```

- **Escenario de fallo:** Se configura JWT_EXPIRES_IN=1d. La cookie sigue viviendo 7 dias: desde el dia 2 el navegador envia un token expirado, el middleware redirige toda pagina protegida a /unauthorized?reason=expired y las APIs responden 401 sin que nada borre la cookie. Con JWT_EXPIRES_IN=30d ocurre lo contrario: la cookie muere a los 7 dias y la configuracion no tiene efecto.
- **Arreglo propuesto:** Exportar desde auth.ts un `AUTH_COOKIE_OPTIONS`/`getAuthCookieMaxAge()` derivado del mismo valor (parsear JWT_EXPIRES_IN a segundos con `ms`) y usarlo en login y register; o fijar ambos desde una unica constante. En el middleware, cuando el token es invalido/expirado, borrar la cookie en la respuesta (`response.cookies.delete('auth-token')`).

#### AUTH-023 — Middleware: el parametro ?redirect= nunca se consume, variable isProfileRoute sin uso y redireccion incoherente para rutas de empresa

- **Severidad:** ⚪ low · **Categoría:** dead-code · **Estado:** nuevo · **Verificación:** sin verificar (reportada por 1 auditor)
- **Ubicación:** `src/middleware.ts:51` · relacionados: `src/app/unauthorized/page.tsx`, `src/app/login/page.tsx`
- **Problema:** El middleware anade `redirect=<pathname>` al mandar a /unauthorized, pero ni /unauthorized ni /login leen ese parametro (grep de 'redirect' en src/app/login, src/app/unauthorized y src/app/register: 0 coincidencias): la funcionalidad de 'volver a donde estabas' quedo a medias. `isProfileRoute` (lineas 226-227) se calcula y no se usa. Para rutas de empresa con rol incorrecto se redirige a '/' (linea 125) mientras que el resto de roles va a /unauthorized?reason=no-permission.
- **Evidencia:**

```ts
    const unauthorizedUrl = new URL('/unauthorized', request.url);
    unauthorizedUrl.searchParams.set('reason', 'no-token');
    unauthorizedUrl.searchParams.set('redirect', pathname);
    return NextResponse.redirect(unauthorizedUrl);
...
  const isProfileRoute =
    pathname.startsWith('/api/profile') || pathname === '/profile';
...
    return NextResponse.redirect(new URL('/', request.url));
```

- **Escenario de fallo:** Una empresa recibe por correo el enlace /company/jobs/15/candidates con la sesion caducada: llega a 'Acceso denegado', pulsa 'Iniciar sesion', entra y aterriza siempre en /company/dashboard; debe volver a buscar el enlace. Un candidato que abre /company/dashboard es devuelto al inicio sin ningun mensaje.
- **Arreglo propuesto:** En /unauthorized propagar el parametro al boton (`/login?redirect=...`) y en login/page.tsx, tras el login, navegar a `redirect` solo si empieza por '/' y no por '//' (evitar open redirect); si no, usar el destino por rol. Eliminar isProfileRoute. Unificar la redireccion de empresa a /unauthorized?reason=no-permission.

#### AUTH-024 — /credits/purchase no esta protegida por el middleware ni comprueba rol: se descubre el 401/403 despues de capturar la tarjeta

- **Severidad:** ⚪ low · **Categoría:** authz · **Estado:** nuevo · **Verificación:** sin verificar (reportada por 1 auditor)
- **Ubicación:** `src/middleware.ts:273` · relacionados: `src/app/credits/purchase/page.tsx`
- **Problema:** El matcher incluye '/api/credits/:path*' pero no '/credits/:path*'. La pagina es un client component sin verificacion de sesion, asi que un visitante sin sesion, con el JWT expirado o con rol distinto de company ve paquetes, aplica codigo y rellena la tarjeta; el rechazo llega solo al enviar ('No autenticado' / 'Solo empresas').
- **Evidencia:**

```ts
'/api/credits/:path*',
'/api/vendor/:path*',
'/api/notifications',
'/api/notifications/:path*',
'/admin/:path*',
'/applications/:path*',
'/company/:path*',
```

- **Escenario de fallo:** La sesion de la empresa expira mientras compara paquetes. Pulsa 'Continuar al Pago', captura la tarjeta y al pagar recibe 'No autenticado. Por favor inicia sesion.'; pierde lo capturado.
- **Arreglo propuesto:** Anadir '/credits/:path*' al matcher y tratarla como ruta de empresa (company/admin) con redirect a login conservando ?redirect=/credits/purchase; opcionalmente comprobar /api/auth/me al montar.

#### AUTH-025 — /create-job y /credits/purchase no estan en el matcher: paginas de empresa accesibles sin sesion ni rol

- **Severidad:** ⚪ low · **Categoría:** ux · **Estado:** nuevo · **Verificación:** sin verificar (reportada por 1 auditor)
- **Ubicación:** `src/middleware.ts:277` · relacionados: `src/app/create-job/page.tsx`, `src/app/credits/purchase/page.tsx`, `src/components/sections/jobs/CreateJobForm.tsx`
- **Problema:** El matcher protege /company/*, /admin/*, etc., pero no /create-job ni /credits/purchase, que son paginas exclusivas de empresa/admin y tampoco tienen guard en cliente (create-job/page.tsx solo monta el formulario; CreateJobForm trata el fallo de /api/auth/me como 'silent fail'). Las APIs si rechazan, pero solo al final del flujo.
- **Evidencia:**

```ts
    '/admin/:path*',
    '/applications/:path*',
    '/company/:path*',
    '/my-applications',
    '/candidate/:path*',
    '/recruiter/:path*',
    '/specialist/:path*',
    '/vendor/:path*',
    '/notifications',
    '/profile'
```

- **Escenario de fallo:** Una empresa con la sesion expirada (o un visitante/candidato que llega por URL) abre /create-job, rellena el formulario largo de vacante y al publicar recibe un error generico por el 401; o abre /credits/purchase, introduce los datos de su tarjeta en el Brick de MercadoPago y solo despues del tokenizado recibe 'No autorizado'/'Solo empresas'.
- **Arreglo propuesto:** Anadir '/create-job' y '/credits/:path*' al matcher y tratarlas como rutas de empresa en `isCompanyRoute` (company o admin). Alternativamente moverlas bajo /company/ (p.ej. /company/jobs/new, /company/credits).
