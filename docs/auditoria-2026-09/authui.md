# Páginas de acceso y registro

[← volver al índice](../AUDITORIA-2026-09.md) · 29 hallazgos — 🟡 8 medium · ⚪ 21 low

## 🟡 medium (8)

#### AUTHUI-001 — El parametro ?redirect= que envian 11 pantallas y el middleware se ignora: tras login siempre se va al destino fijo por rol

- **Severidad:** 🟡 medium · **Categoría:** frontend-bug · **Estado:** nuevo · **Verificación:** sin verificar (reportada por 1 auditor)
- **Ubicación:** `src/app/login/page.tsx:49` · relacionados: `src/app/unauthorized/page.tsx`, `src/middleware.ts`, `src/components/sections/talents/ApplyJobModal.tsx`, `src/components/sections/talents/SearchPositionsSection.tsx`, `src/app/company/profile/page.tsx`, `src/app/admin/direct-applications/page.tsx`, `src/app/my-applications/page.tsx`
- **Problema:** Once pantallas hacen router.push('/login?redirect=...') (company/profile, admin/direct-applications, my-applications, ApplyJobModal, SearchPositionsSection, recruiter/specialist/company dashboards...) y el middleware añade ?redirect=<pathname> al mandar a /unauthorized, pero LoginPage nunca lee searchParams y /unauthorized no propaga el parametro a su enlace de login. Es funcionalidad a medias: el deep-link siempre se pierde. (Nota positiva: hoy no hay open redirect precisamente porque el parametro no se usa; al implementarlo hay que validarlo.)
- **Evidencia:**

```ts
// src/app/login/page.tsx:48-61
      if (response.ok) {
        const role = data.user.role;

        if (role === 'admin') {
          window.location.href = '/admin/requests';
        } else if (role === 'company') {
          window.location.href = '/company/dashboard';
        ...
        } else {
          window.location.href = '/talents';
        }
// src/app/admin/direct-applications/page.tsx:69
        router.push('/login?redirect=/admin/direct-applications');
```

- **Escenario de fallo:** Admin con sesion expirada abre /admin/direct-applications -> la pagina hace push a /login?redirect=/admin/direct-applications -> inicia sesion -> aterriza en /admin/requests y debe volver a navegar. Empresa que abre un enlace de correo a /company/jobs/12/candidates sin sesion -> /unauthorized?reason=no-token&redirect=/company/jobs/12/candidates -> 'Iniciar Sesión' lleva a /login a secas -> termina en /company/dashboard.
- **Arreglo propuesto:** En LoginPage leer useSearchParams().get('redirect') (envolver en <Suspense>). Validar estrictamente: debe empezar con '/' y NO con '//' ni '/\\', sin '://' ni saltos de linea (p.ej. /^\/(?![\/\\])[^\s]*$/), y el prefijo debe estar permitido para el rol (mapa rol -> prefijos); si no pasa, usar el destino por rol. En src/app/unauthorized/page.tsx construir href={`/login?redirect=${encodeURIComponent(redirect)}`} cuando reason sea no-token/expired, con la misma validacion.

#### AUTHUI-002 — Login descarta los errores de validacion del API (errors[]) y muestra un mensaje generico

- **Severidad:** 🟡 medium · **Categoría:** frontend-bug · **Estado:** nuevo · **Verificación:** sin verificar (reportada por 1 auditor)
- **Ubicación:** `src/app/login/page.tsx:63` · relacionados: `src/app/api/auth/login/route.ts`, `src/lib/validations.ts`
- **Problema:** Cuando falla la validacion zod, /api/auth/login responde 400 con la clave `errors` (array de {field, message}) y SIN clave `error`. La pagina solo lee `data.error`, asi que cualquier fallo de validacion (contraseña < 8, email que zod rechaza pero el navegador acepta, p.ej. 'user@localhost') termina en 'Error al iniciar sesión' sin explicar que pasa.
- **Evidencia:**

```ts
// src/app/login/page.tsx:62-64
      } else {
        setError(data.error || 'Error al iniciar sesión');
      }
// src/app/api/auth/login/route.ts:23-30
    if (!validation.success) {
      return NextResponse.json(
        {
          success: false,
          errors: validation.errors
        },
        { status: 400 }
```

- **Escenario de fallo:** Usuario teclea una contraseña de 7 caracteres por error de dedo -> POST /api/auth/login -> 400 {errors:[{field:'password',message:'La contraseña debe tener al menos 8 caracteres'}]} -> la UI muestra 'Error al iniciar sesión', indistinguible de una caida del servidor. El usuario reintenta y consume el rate-limit (7 por 15 min).
- **Arreglo propuesto:** const msg = data.error || (Array.isArray(data.errors) && data.errors[0]?.message) || 'Error al iniciar sesión'; setError(msg). Idealmente unificar el contrato: que el API de login devuelva siempre `error` (string) ademas de `errors`.

#### AUTHUI-003 — Registro: el error al subir el CV nunca se muestra (errors.cvUrl no se renderiza) y se descarta el motivo real del servidor

- **Severidad:** 🟡 medium · **Categoría:** frontend-bug · **Estado:** nuevo · **Verificación:** sin verificar (reportada por 1 auditor)
- **Ubicación:** `src/app/register/page.tsx:165` · relacionados: `src/app/api/upload/route.ts`
- **Problema:** handleCvUpload guarda el fallo en errors.cvUrl, pero en el paso 5 no existe ningun <p>{errors.cvUrl}</p>; el unico efecto es el borde rojo del input de URL via inputClass('cvUrl'). Ademas se reemplaza el mensaje util del API ('Archivo muy grande (6.20MB)...', 'Tipo de archivo no permitido', 429) por uno generico. Tampoco hay validacion previa de tamaño (el texto dice max 5MB) como si la hay para foto y documentos.
- **Evidencia:**

```ts
// :163-166
    } catch (error) {
      console.error('Error uploading CV:', error);
      setErrors(prev => ({ ...prev, cvUrl: 'Error al subir el archivo' }));
    } finally {
// :1172-1178 (unico uso de errors.cvUrl: el borde)
                      <input
                        type="text"
                        value={cvUrl}
                        onChange={(e) => setCvUrl(e.target.value)}
                        className={inputClass('cvUrl')}
```

- **Escenario de fallo:** Candidato sube un CV escaneado de 7 MB -> /api/upload responde 400 'Archivo muy grande (7.00MB)...' -> la etiqueta vuelve a 'Subir archivo' y el campo de URL (vacio) se pone con borde rojo, sin ningun texto. El usuario no entiende que paso, continua y se registra sin CV.
- **Arreglo propuesto:** Renderizar {errors.cvUrl && <p role="alert" className="text-red-300 text-xs mt-1">{errors.cvUrl}</p>} bajo el bloque del CV; usar error.message del servidor; validar file.size <= limite antes de subir; limpiar errors.cvUrl al subir con exito.

#### AUTHUI-004 — Registro: borrar una experiencia no limpia expErrors (indexado por posicion) y deja un bloqueo invisible que impide crear la cuenta

- **Severidad:** 🟡 medium · **Categoría:** frontend-bug · **Estado:** nuevo · **Verificación:** sin verificar (reportada por 1 auditor)
- **Ubicación:** `src/app/register/page.tsx:236`
- **Problema:** expErrors es un Record<indice, mensaje>. removeExperience filtra el array pero no toca expErrors, de modo que (a) si se borra la experiencia con error y era la ultima, la clave queda huerfana y handleSubmit bloquea para siempre sin mostrar ningun error visible; (b) si se borra una anterior, el error se 'hereda' a la experiencia que ocupa ese indice.
- **Evidencia:**

```ts
// :236-238
  const removeExperience = (index: number) => {
    setExperiences(experiences.filter((_, i) => i !== index));
  };
// :427-430
    if (Object.keys(expErrors).length > 0) {
      setGeneralError('Corrige los errores en las fechas de experiencia antes de continuar');
      return;
    }
```

- **Escenario de fallo:** Candidato agrega Experiencia 1 (valida) y Experiencia 2 con fecha fin anterior a la de inicio -> expErrors = {1: '...'}. En vez de corregirla, la elimina con el bote de basura. Llega al paso 6, pulsa CREAR CUENTA -> toast 'Corrige los errores en las fechas de experiencia' -> vuelve al paso 4 y no hay ningun error que corregir. No puede registrarse (salvo que agregue otra experiencia en el indice 1 y le cambie las fechas).
- **Arreglo propuesto:** Eliminar el estado expErrors y derivarlo con useMemo a partir de `experiences` (errores = experiences.map(validarFechas)); o, como minimo, en removeExperience reconstruir expErrors quitando `index` y desplazando -1 las claves mayores. Dar a cada experiencia un id estable y usarlo como key en vez de key={index}.

#### AUTHUI-005 — Registro: updateDocument escribe un snapshot viejo tras el await del upload y pisa cambios hechos mientras subia (nombre borrado, documentos que desaparecen o quedan en 'Subiendo...' eterno)

- **Severidad:** 🟡 medium · **Categoría:** frontend-bug · **Estado:** nuevo · **Verificación:** sin verificar (reportada por 1 auditor)
- **Ubicación:** `src/app/register/page.tsx:272`
- **Problema:** updateDocument copia `documents` al inicio (`updated`), muta el objeto de estado en sitio, espera hasta 30 s el upload y luego hace setDocuments([...updated]) con ese snapshot. Todo lo que el usuario cambie durante la subida se pierde: el nombre tecleado (el handler de 'name' crea un objeto nuevo, pero el snapshot sigue apuntando al viejo con name:''), documentos agregados despues (desaparecen), documentos eliminados (reaparecen) y, con dos subidas concurrentes + edicion de nombre, una tarjeta queda con uploading:true para siempre e input deshabilitado.
- **Evidencia:**

```ts
// :272
    const updated = [...documents];
// :281-282
      updated[index].uploading = true;
      setDocuments([...updated]);
// :290-293
        const url = await Promise.race([uploadPromise, timeoutPromise]);
        updated[index].file = value;
        updated[index].fileUrl = url;
        updated[index].uploading = false;
// :303
      setDocuments([...updated]);
```

- **Escenario de fallo:** Paso 6: el candidato pulsa 'Agregar Documento', elige primero el PDF (empieza a subir) y mientras sube escribe el nombre 'Título universitario'. Al terminar el upload, setDocuments([...updated]) restaura el objeto viejo con name:'' -> el campo de nombre se vacia. Si no lo nota y pulsa CREAR CUENTA, el filtro `doc.name && doc.fileUrl` descarta el documento en silencio y la cuenta se crea sin el.
- **Arreglo propuesto:** Usar siempre actualizaciones funcionales e inmutables identificando el documento por un id estable (no por indice): setDocuments(prev => prev.map(d => d.id === id ? { ...d, uploading: true } : d)) antes del await y setDocuments(prev => prev.map(d => d.id === id ? { ...d, file, fileUrl: url, uploading: false } : d)) despues. Añadir `id` al crear el documento y usar key={doc.id}. Aplicar el mismo patron a educations/experiences.

#### AUTHUI-006 — Registro: experiencias, documentos y educacion incompletos se descartan en silencio pese a tener campos marcados con '*'

- **Severidad:** 🟡 medium · **Categoría:** validation · **Estado:** nuevo · **Verificación:** sin verificar (reportada por 1 auditor)
- **Ubicación:** `src/app/register/page.tsx:465` · relacionados: `src/app/api/auth/register/route.ts`
- **Problema:** Los pasos 2-6 no tienen ninguna validacion (validateStep solo cubre el paso 1). En el submit, las experiencias sin empresa/puesto/fechaInicio, los documentos sin nombre o sin archivo y la educacion sin nivel/institucion/carrera se filtran sin avisar, aunque las etiquetas dicen 'Empresa *', 'Puesto *', 'Fecha Inicio *', 'Nombre del documento *', 'Archivo *'. El usuario ve '¡Registro exitoso!' y su informacion no se guardo.
- **Evidencia:**

```ts
// :455
          educacion: educations.filter(e => e.institucion || e.carrera || e.nivel),
// :465-471
          experiences: experiences.filter(
            exp => exp.empresa && exp.puesto && exp.fechaInicio
          ),
          // Documentos (filtrar sin URL)
          documents: documents
            .filter(doc => doc.name && doc.fileUrl)
            .map(doc => ({ name: doc.name, fileUrl: doc.fileUrl }))
```

- **Escenario de fallo:** Candidato captura 3 experiencias con empresa, puesto y descripcion, pero olvida 'Fecha Inicio' en dos. Avanza sin ningun aviso, crea la cuenta y ve el mensaje de exito. Su perfil queda con 1 experiencia y añosExperiencia mal calculado, lo que lo saca de los filtros de reclutadores. Igual: sube un PDF sin escribirle nombre -> el documento no se guarda.
- **Arreglo propuesto:** Extender validateStep: en paso 4, por cada experiencia parcialmente llena exigir empresa, puesto, fechaInicio (y fechaFin si no es actual) mostrando el error junto al campo; en paso 6 exigir nombre y archivo por documento; en paso 2 exigir al menos nivel+institucion. Solo descartar filas totalmente vacias. Bloquear 'Siguiente'/'CREAR CUENTA' mientras haya filas invalidas.

#### AUTHUI-007 — Registro: 'CREAR CUENTA' no se bloquea mientras hay archivos subiendo; la foto, el CV o el documento en curso se pierden sin aviso

- **Severidad:** 🟡 medium · **Categoría:** frontend-bug · **Estado:** nuevo · **Verificación:** sin verificar (reportada por 1 auditor)
- **Ubicación:** `src/app/register/page.tsx:1362`
- **Problema:** El boton de submit solo se deshabilita con isSubmitting/stepTransitioning. No considera fotoUploading, cvUploading ni documents[].uploading. Como el payload toma fotoUrl/cvUrl/doc.fileUrl del estado en ese instante, cualquier archivo que aun este subiendo se omite (los documentos sin fileUrl se filtran) y el registro 'exitoso' queda incompleto.
- **Evidencia:**

```ts
// :1360-1363
                  <button
                    type="submit"
                    disabled={isSubmitting || stepTransitioning}
// :469-471
          documents: documents
            .filter(doc => doc.name && doc.fileUrl)
            .map(doc => ({ name: doc.name, fileUrl: doc.fileUrl }))
```

- **Escenario de fallo:** En el paso 6 (el mismo donde esta el boton naranja) el candidato selecciona su titulo en PDF de 4 MB con datos moviles y de inmediato pulsa CREAR CUENTA mientras la tarjeta dice 'Subiendo...'. La cuenta se crea con documents:[] y se redirige a /talents; el upload termina huerfano en Blob. Igual con el CV si salta del paso 5 al 6 y envia antes de que termine.
- **Arreglo propuesto:** const anyUploading = fotoUploading || cvUploading || documents.some(d => d.uploading); deshabilitar el submit con anyUploading, mostrar 'Espera a que terminen de subir tus archivos' y repetir la guarda al inicio de handleSubmit.

#### AUTHUI-008 — reset-password sigue anunciando y validando 'minimo 6 caracteres' mientras el API exige 8 + mayuscula + numero

- **Severidad:** 🟡 medium · **Categoría:** validation · **Estado:** arreglo previo incompleto · **Verificación:** sin verificar (reportada por 2 auditores)
- **Ubicación:** `src/app/reset-password/page.tsx:26` · relacionados: `src/app/api/auth/reset-password/route.ts`, `src/app/register/page.tsx`
- **Problema:** El fix de junio (#13/#25/#27) endurecio la politica SOLO en el API (/api/auth/reset-password: min 8, 1 mayuscula, 1 numero). La pagina quedo con la politica vieja: validacion JS < 6, minLength={6} en ambos inputs y placeholder 'Mínimo 6 caracteres'. El usuario descubre las reglas a prueba y error, una por request, y cada intento consume el rate-limit (5 por 15 min) con un token que expira en 1 hora.
- **Evidencia:**

```ts
// src/app/reset-password/page.tsx:26-29
    if (password.length < 6) {
      setError('La contraseña debe tener al menos 6 caracteres');
      return;
    }
// :114 y :118
                    minLength={6}
                    placeholder="Mínimo 6 caracteres"
// src/app/api/auth/reset-password/route.ts:12-16
  password: z
    .string()
    .min(8, 'La contraseña debe tener al menos 8 caracteres')
    .regex(/[A-Z]/, 'Debe contener al menos una mayúscula')
    .regex(/[0-9]/, 'Debe contener al menos un número')
```

- **Escenario de fallo:** Usuario abre el enlace del correo, escribe 'abc123' (cumple lo que dice la pagina) -> 400 'La contraseña debe tener al menos 8 caracteres'. Escribe 'abcdefgh' -> 400 'Debe contener al menos una mayúscula'. 'Abcdefgh' -> 400 'Debe contener al menos un número'. Con dos errores de dedo mas llega al 6o request -> 429 'Demasiadas solicitudes' y debe esperar 15 min.
- **Arreglo propuesto:** Replicar en el cliente la misma regla (idealmente importando un passwordSchema compartido desde src/lib/validations.ts): validar 8+, /[A-Z]/ y /[0-9]/ antes del fetch, cambiar minLength a 8, placeholder a 'Mínimo 8 caracteres' y añadir el texto de ayuda '8+ caracteres, 1 mayúscula, 1 número' como en /register.
- **Otros auditores añaden:** Replicar en la pagina la misma validacion que /register (8+, /[A-Z]/, /[0-9]/), actualizar minLength a 8 y el placeholder/ayuda ('Minimo 8 caracteres, una mayuscula y un numero'). Idealmente importar un `passwordSchema` compartido desde src/lib/validations.ts en cliente y servidor.

## ⚪ low (21)

#### AUTHUI-009 — forgot-password y reset-password no usan los tokens de marca (azul generico vs verde/naranja INAKAT); el correo de reset tampoco usa baseTemplate

- **Severidad:** ⚪ low · **Categoría:** ux · **Estado:** nuevo · **Verificación:** sin verificar (reportada por 1 auditor)
- **Ubicación:** `src/app/forgot-password/page.tsx:94` · relacionados: `src/app/reset-password/page.tsx`, `src/app/api/auth/forgot-password/route.ts`, `src/lib/email.ts`
- **Problema:** Login y registro usan bg-custom-beige, bg-soft-green, bg-button-green/orange y el logo; forgot/reset son tarjetas blancas sobre gray-50 con botones y enlaces blue-600, sin logo. El correo de recuperacion usa #004aad y HTML propio en vez de baseTemplate (#2b5d62). El flujo de recuperacion parece de otro producto, lo que en un flujo sensible resta confianza.
- **Evidencia:**

```ts
                className="w-full bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center gap-2"
```

- **Escenario de fallo:** Usuario pasa de /login (verde INAKAT con logo) a '¿Olvidaste tu contraseña?' y cae en una pantalla azul sin logo; despues recibe un correo azul distinto al resto de correos de INAKAT y duda de su legitimidad.
- **Arreglo propuesto:** Reutilizar el layout de tarjeta de login (extraer un componente AuthCard con logo y tokens bg-soft-green/bg-button-green/focus:ring-button-green) en forgot-password y reset-password; mover el correo de reset a un template de src/lib/email.ts sobre baseTemplate.

#### AUTHUI-010 — Las 5 paginas de acceso comparten el <title> de la home y no declaran noindex

- **Severidad:** ⚪ low · **Categoría:** a11y · **Estado:** nuevo · **Verificación:** sin verificar (reportada por 1 auditor)
- **Ubicación:** `src/app/login/page.tsx:3` · relacionados: `src/app/layout.tsx`, `src/app/register/page.tsx`, `src/app/forgot-password/page.tsx`, `src/app/reset-password/page.tsx`, `src/app/unauthorized/page.tsx`
- **Problema:** Todas son 'use client' y no pueden exportar metadata; tampoco existe layout.tsx en login/, register/, forgot-password/, reset-password/ ni unauthorized/. Resultado: todas muestran 'INAKAT - Talento Evaluado por Expertos Reales' (WCAG 2.4.2: el titulo debe describir la pagina; pestañas e historial indistinguibles) y /reset-password, /unauthorized quedan indexables.
- **Evidencia:**

```ts
// src/app/login/page.tsx:3
'use client';
// src/app/layout.tsx:18-19 (unico metadata que aplica)
export const metadata: Metadata = {
  title: "INAKAT - Talento Evaluado por Expertos Reales",
```

- **Escenario de fallo:** Usuario con lector de pantalla abre el enlace del correo de recuperacion: el titulo anunciado es el slogan de la home, no 'Restablecer contraseña'; con varias pestañas abiertas no puede distinguir login de registro.
- **Arreglo propuesto:** Crear un layout.tsx (server component) minimo en cada carpeta que exporte metadata: { title: 'Iniciar sesión | INAKAT' } / 'Crear cuenta' / 'Recuperar contraseña' / 'Restablecer contraseña' / 'Acceso denegado', con robots: { index: false } en reset-password, forgot-password y unauthorized.

#### AUTHUI-011 — Tras el login, el rol 'vendor' cae en el else y se le envia a /talents

- **Severidad:** ⚪ low · **Categoría:** ux · **Estado:** nuevo · **Verificación:** sin verificar (reportada por 2 auditores)
- **Ubicación:** `src/app/login/page.tsx:59` · relacionados: `src/components/commons/Navbar.tsx`
- **Problema:** La cadena de redireccion por rol contempla admin, company, recruiter y specialist; cualquier otro (candidate, user y tambien vendor) va a /talents. Los vendedores creados por el admin tienen su panel en /vendor/dashboard, y Navbar.getDashboardLink() tampoco contempla 'vendor' (default '/').
- **Evidencia:**

```ts
        } else if (role === 'specialist') {
          window.location.href = '/specialist/dashboard';
        } else {
          window.location.href = '/talents';
        }
```

- **Escenario de fallo:** Un vendedor recien dado de alta en /admin/vendors inicia sesion y aterriza en el buscador de vacantes para candidatos; no hay indicacion de donde esta su panel salvo abrir el menu del avatar y encontrar 'Panel Vendedor'.
- **Arreglo propuesto:** Anadir `else if (role === 'vendor') window.location.href = '/vendor/dashboard';` y el caso 'vendor' en getDashboardLink/getDashboardLabel/getRoleLabel de Navbar.tsx. Extraer un unico mapa rol->home compartido por login y Navbar.
- **Otros auditores añaden:** Extraer un mapa compartido ROLE_HOME en src/lib (admin:'/admin/requests', company:'/company/dashboard', recruiter:'/recruiter/dashboard', specialist:'/specialist/dashboard', vendor:'/vendor/dashboard', candidate:'/talents', user:'/talents') y usarlo en LoginPage y en Navbar.getDashboardLink.

#### AUTHUI-012 — min-h-screen + body pt-14: todas las paginas de acceso miden 100vh + 56px y siempre muestran scroll vertical

- **Severidad:** ⚪ low · **Categoría:** responsive · **Estado:** nuevo · **Verificación:** sin verificar (reportada por 1 auditor)
- **Ubicación:** `src/app/login/page.tsx:74` · relacionados: `src/app/layout.tsx`, `src/app/register/page.tsx`, `src/app/forgot-password/page.tsx`, `src/app/reset-password/page.tsx`, `src/app/unauthorized/page.tsx`
- **Problema:** El layout raiz aplica pt-14 al body para compensar la Navbar fija, y cada pagina de este modulo usa min-h-screen en su contenedor. La altura total del documento es 100vh + 3.5rem, de modo que login, forgot-password, reset-password y unauthorized siempre tienen barra de scroll y el contenido 'centrado' queda desplazado 28px hacia abajo; en movil (teclado abierto) empeora.
- **Evidencia:**

```ts
// src/app/login/page.tsx:74
    <section className="bg-custom-beige min-h-screen flex items-center justify-center px-4">
// src/app/layout.tsx:38
      <body className="font-body antialiased pt-14">
```

- **Escenario de fallo:** En un laptop 1366x768 la tarjeta de login cabe completa, pero la pagina muestra scrollbar y permite desplazar 56px de fondo vacio; en iPhone el formulario de /forgot-password rebota verticalmente sin motivo.
- **Arreglo propuesto:** Sustituir min-h-screen por min-h-[calc(100dvh-3.5rem)] en login (:74), register (:517), forgot-password (:42), reset-password (:62, :77, :184) y unauthorized (:61).

#### AUTHUI-013 — Login muestra el mismo error dos veces a la vez (ErrorToast fijo + bloque inline)

- **Severidad:** ⚪ low · **Categoría:** ux · **Estado:** nuevo · **Verificación:** sin verificar (reportada por 1 auditor)
- **Ubicación:** `src/app/login/page.tsx:75` · relacionados: `src/components/shared/ErrorToast.tsx`, `src/app/register/page.tsx`
- **Problema:** El mismo estado `error` alimenta el ErrorToast global y el div rojo dentro del formulario, asi que cada fallo aparece duplicado. En /register el bloque inline se quito y quedo solo el toast: los dos formularios hermanos se comportan distinto.
- **Evidencia:**

```ts
      <ErrorToast
        message={error}
        onClose={() => setError(null)}
      />
      ...
            {error && (
              <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
                {error}
              </div>
            )}
```

- **Escenario de fallo:** Usuario escribe mal su contraseña: ve 'Credenciales inválidas' en un toast rojo arriba y simultaneamente en una caja roja sobre el campo Email; a los 8 s el toast llama onClose -> setError(null) y tambien borra el mensaje inline.
- **Arreglo propuesto:** Elegir un solo patron para los formularios de acceso: conservar el bloque inline con role="alert" (persistente hasta que el usuario edite) y eliminar el ErrorToast de login, o viceversa, y aplicarlo igual en register.

#### AUTHUI-014 — Los mensajes de error/exito de login, forgot, reset y registro no se anuncian (sin role="alert"/aria-live)

- **Severidad:** ⚪ low · **Categoría:** a11y · **Estado:** nuevo · **Verificación:** sin verificar (reportada por 1 auditor)
- **Ubicación:** `src/app/login/page.tsx:117` · relacionados: `src/components/shared/ErrorToast.tsx`, `src/app/forgot-password/page.tsx`, `src/app/reset-password/page.tsx`, `src/app/register/page.tsx`
- **Problema:** Los contenedores de error inline (login :116-120, forgot-password :66-70, reset-password :97-101), los errores por campo y el mensaje de exito del registro (:612-616), y el componente compartido ErrorToast no tienen role="alert"/"status" ni aria-live. Tras enviar el formulario, un usuario de lector de pantalla no recibe ninguna notificacion del resultado.
- **Evidencia:**

```ts
            {error && (
              <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
                {error}
              </div>
            )}
```

- **Escenario de fallo:** Usuario ciego envia credenciales incorrectas: el boton vuelve a decir 'INGRESAR' y nada mas se anuncia; cree que el sitio no responde. En /forgot-password el cambio a 'Correo enviado' tampoco se anuncia ni mueve el foco.
- **Arreglo propuesto:** Añadir role="alert" a los contenedores de error (y al div interno de ErrorToast), role="status" a los de exito, y mover el foco al encabezado de confirmacion en forgot/reset (ref + tabIndex={-1}).

#### AUTHUI-015 — Cobertura de tests: login, forgot, reset y unauthorized sin ningun test; el test de registro no verifica el payload enviado

- **Severidad:** ⚪ low · **Categoría:** tests · **Estado:** nuevo · **Verificación:** sin verificar (reportada por 1 auditor)
- **Ubicación:** `src/app/register/page.test.tsx:308` · relacionados: `src/app/login/page.tsx`, `src/app/reset-password/page.tsx`, `src/app/forgot-password/page.tsx`, `src/app/unauthorized/page.tsx`
- **Problema:** En el modulo solo existe register/page.test.tsx. El test de envio comprueba unicamente method y headers, no el body, asi que la clase de bug 'campos que no se envian o se pierden' (filtros silenciosos, uploads en curso, race de documentos, expErrors huerfano) no tiene red. No hay pruebas del redirect por rol, del manejo de errors[], ni de la politica de contraseña del reset.
- **Evidencia:**

```ts
        expect(mockFetch).toHaveBeenCalledWith(
          '/api/auth/register',
          expect.objectContaining({
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
          })
        );
```

- **Escenario de fallo:** Un cambio que deje de enviar `subcategory` o `fotoUrl`, o que rompa el redirect de 'recruiter', pasa CI en verde porque ningun test inspecciona JSON.parse(body) ni window.location.
- **Arreglo propuesto:** Añadir: (1) register: asercion del body completo tras llenar los 6 pasos, borrar experiencia con error y poder enviar, no enviar con upload en curso, nombre de documento preservado tras upload; (2) login/page.test.tsx: redirect por cada rol (incl. vendor), ?redirect valido e invalido (//evil.com), errors[] y 429; (3) reset-password: politica 8+/mayuscula/numero, token ausente/expirado; (4) forgot-password y unauthorized: estados y mensajes por reason.

#### AUTHUI-016 — Si /api/specialties falla, el paso 'Profesional' queda con el select vacio sin mensaje ni reintento

- **Severidad:** ⚪ low · **Categoría:** reliability · **Estado:** nuevo · **Verificación:** sin verificar (reportada por 1 auditor)
- **Ubicación:** `src/app/register/page.tsx:133` · relacionados: `src/app/api/specialties/route.ts`
- **Problema:** La carga de especialidades no revisa res.ok, ignora success:false y solo hace console.error. El candidato ve 'Seleccionar área' sin opciones y no puede declarar su perfil, que es el campo principal de matching (Candidate.profile).
- **Evidencia:**

```ts
    fetch('/api/specialties?subcategories=true')
      .then((res) => res.json())
      .then((data) => {
        if (data.success) {
          setSpecialties(data.data);
        }
      })
      .catch(console.error);
```

- **Escenario de fallo:** La BD tarda o responde 500 en el primer render -> specialties=[] -> en el paso 3 el desplegable solo muestra 'Seleccionar área'. El candidato asume que no aplica, termina el registro con profile=null y no aparece en busquedas por especialidad.
- **Arreglo propuesto:** Estado specialtiesStatus ('loading'|'error'|'ready'); en error mostrar 'No pudimos cargar las áreas' con boton Reintentar; deshabilitar el select con texto 'Cargando...' mientras carga.

#### AUTHUI-017 — uploadFile asume respuesta JSON: con 413/504 de la plataforma muestra un SyntaxError crudo; el limite anunciado de 5MB supera el limite de body de Vercel (4.5MB)

- **Severidad:** ⚪ low · **Categoría:** reliability · **Estado:** nuevo · **Verificación:** sin verificar (reportada por 1 auditor)
- **Ubicación:** `src/app/register/page.tsx:147` · relacionados: `src/app/api/upload/route.ts`
- **Problema:** uploadFile hace res.json() sin revisar res.ok ni content-type. La UI y /api/upload anuncian 5 MB, pero las Vercel Functions rechazan cuerpos > 4.5 MB con 413 FUNCTION_PAYLOAD_TOO_LARGE (respuesta no JSON) antes de llegar al handler, asi que archivos de 4.5-5 MB fallan con un mensaje tecnico en ingles dentro de un alert().
- **Evidencia:**

```ts
  const uploadFile = async (file: File): Promise<string> => {
    const formData = new FormData();
    formData.append('file', file);
    const res = await fetch('/api/upload', { method: 'POST', body: formData });
    const data = await res.json();
    if (!data.success) throw new Error(data.error);
    return data.url;
  };
```

- **Escenario de fallo:** Candidato sube un documento de 4.8 MB (pasa el chequeo cliente de 5 MB) -> Vercel responde 413 en texto plano -> res.json() lanza SyntaxError -> alert: 'Error al subir "titulo.pdf": Unexpected token ... is not valid JSON'.
- **Arreglo propuesto:** En uploadFile: si !res.ok o el content-type no es JSON, lanzar un Error en español segun status (413 -> 'El archivo es demasiado grande', 429 -> 'Demasiadas subidas, espera unos minutos'). Bajar el limite anunciado/validado a 4 MB o migrar a subida directa cliente->Blob (@vercel/blob/client handleUpload) para no pasar el archivo por la function. Sustituir los alert() por errores inline.

#### AUTHUI-018 — Registro: Enter en el paso 6 (p. ej. en 'Nombre del documento') crea la cuenta de inmediato y descarta el documento a medio capturar

- **Severidad:** ⚪ low · **Categoría:** frontend-bug · **Estado:** nuevo · **Verificación:** sin verificar (reportada por 1 auditor)
- **Ubicación:** `src/app/register/page.tsx:416`
- **Problema:** El fix BUG-008 solo intercepta la sumision implicita en pasos < 6. En el paso 6 los inputs de texto de los documentos siguen dentro del <form>, asi que Enter dispara handleSubmit completo. Como el documento aun no tiene archivo, el filtro lo elimina y la cuenta se crea sin el.
- **Evidencia:**

```ts
    // BUG-008 FIX: Solo permitir submit desde el último paso (6 - Documentos)
    // Evita que Enter en pasos anteriores envíe el formulario prematuramente
    if (currentStep < 6) {
      handleNext();
      return;
    }
```

- **Escenario de fallo:** Candidato pulsa 'Agregar Documento', escribe 'Certificación AWS' y presiona Enter por costumbre antes de elegir el archivo -> se envia el registro -> '¡Registro exitoso!' y redireccion a /talents; el documento no se guardo.
- **Arreglo propuesto:** En los inputs de texto del paso 6 añadir onKeyDown={(e) => e.key === 'Enter' && e.preventDefault()}, o en handleSubmit abortar con error visible si existe algun documento incompleto (nombre sin archivo o archivo sin nombre) o en subida.

#### AUTHUI-019 — Registro: los errores del servidor se muestran mal (409 solo en un toast de 8 s en el paso 6; errors como arrays; claves sin UI) y quedo un bloque 'Error general' vacio

- **Severidad:** ⚪ low · **Categoría:** ux · **Estado:** nuevo · **Verificación:** sin verificar (reportada por 1 auditor)
- **Ubicación:** `src/app/register/page.tsx:484` · relacionados: `src/app/api/auth/register/route.ts`, `src/components/shared/ErrorToast.tsx`
- **Problema:** (1) El 409 de email duplicado, el error mas comun, solo va a generalError -> ErrorToast que se autodescarta a los 8 s; el usuario sigue en el paso 6, a cinco pantallas del campo email. El bloque inline fue eliminado y quedo el comentario huerfano {/* Error general */} (:610). (2) data.errors viene de zod flatten().fieldErrors (Record<string,string[]>) pero se guarda en FormErrors (string): con 2 mensajes se renderizan pegados sin separador. (3) Si el error es de una clave sin UI de error (sexo, educacion, experiences, documents, telefono), se salta al paso 1 y no se muestra nada.
- **Evidencia:**

```ts
        if (data.errors) {
          setErrors(data.errors);
          setCurrentStep(1);
          // Scroll hacia arriba para mostrar los errores
          window.scrollTo({ top: 0, behavior: 'smooth' });
        } else {
          setGeneralError(data.error || 'Error al registrarse');
        }
```

- **Escenario de fallo:** Candidato ya registrado repite el alta: en el paso 6 ve un toast rojo que desaparece a los 8 s mientras revisa el telefono; al volver la pantalla esta igual, sin mensaje; vuelve a pulsar y gasta su cupo de rate-limit.
- **Arreglo propuesto:** En 409: setErrors({ email: data.error }); setCurrentStep(1); y ofrecer enlaces a /login y /forgot-password. Normalizar data.errors a { [campo]: mensajes[0] }; si ninguna clave pertenece al paso 1, mostrar un resumen persistente. Reponer un bloque inline role="alert" donde hoy esta el comentario vacio.

#### AUTHUI-020 — Doble submit: el finally reactiva el boton tras un registro/login exitoso mientras se espera la redireccion

- **Severidad:** ⚪ low · **Categoría:** frontend-bug · **Estado:** nuevo · **Verificación:** sin verificar (reportada por 1 auditor)
- **Ubicación:** `src/app/register/page.tsx:497` · relacionados: `src/app/login/page.tsx`
- **Problema:** En registro, tras el 201 se muestra el exito y se programa la redireccion a 1.5 s, pero el finally pone isSubmitting=false de inmediato: el boton CREAR CUENTA vuelve a estar activo. Tampoco hay guarda sincronica (ref) contra dos submits antes del re-render (Enter doble). Login tiene el mismo patron (:68-70) mientras navega con window.location.href.
- **Evidencia:**

```ts
        setTimeout(() => {
          window.location.href = '/talents';
        }, 1500);
      ...
    } finally {
      setIsSubmitting(false);
    }
```

- **Escenario de fallo:** Candidato impaciente pulsa CREAR CUENTA otra vez durante el segundo y medio de espera -> segundo POST -> 409 -> aparece el toast rojo 'Este email ya está registrado' encima del mensaje verde de exito, y se consume otro intento del rate-limit de 3/h.
- **Arreglo propuesto:** No reactivar el boton en el camino de exito (setIsSubmitting(false) solo en error/catch) y añadir una guarda con useRef (if (submittingRef.current) return; submittingRef.current = true) al inicio de handleSubmit en register y login.

#### AUTHUI-021 — Los inputs de archivo usan className="hidden" (display:none): subir foto, CV y documentos es imposible con teclado

- **Severidad:** ⚪ low · **Categoría:** a11y · **Estado:** nuevo · **Verificación:** sin verificar (reportada por 1 auditor)
- **Ubicación:** `src/app/register/page.tsx:641`
- **Problema:** Los tres <input type="file"> (foto :641, CV :1183, documentos :1304) tienen display:none, por lo que salen del orden de tabulacion, y el <label> que los envuelve no es enfocable. Un usuario que navega solo con teclado o con switch no puede activar ninguna subida (WCAG 2.1.1). El label de la foto tampoco tiene texto: solo un icono Upload.
- **Evidencia:**

```ts
                      <label className="absolute bottom-0 right-0 w-8 h-8 bg-button-green rounded-full flex items-center justify-center cursor-pointer hover:bg-green-700 shadow-lg">
                        ...
                        <input
                          type="file"
                          accept="image/jpeg,image/png,image/webp"
                          className="hidden"
```

- **Escenario de fallo:** Candidato con discapacidad motriz tabula por el paso 5: el foco pasa del campo de URL del CV directo a LinkedIn; 'Subir archivo' nunca recibe foco, asi que no puede adjuntar su CV ni documentos.
- **Arreglo propuesto:** Cambiar className="hidden" por "sr-only" y dar al label estilos de foco con peer/focus-within (focus-within:ring-2), o sustituir el label por un <button type="button" onClick={() => inputRef.current?.click()}> con aria-label ('Subir foto de perfil', 'Subir CV', `Seleccionar archivo del documento ${index+1}`).

#### AUTHUI-022 — Registro: 33 <label> sin htmlFor/id y los inputs sin name, autoComplete, aria-invalid ni aria-describedby (detalle del pendiente #62)

- **Severidad:** ⚪ low · **Categoría:** a11y · **Estado:** pendiente conocido de junio · **Verificación:** sin verificar (reportada por 1 auditor)
- **Ubicación:** `src/app/register/page.tsx:661` · relacionados: `src/app/register/page.test.tsx`
- **Problema:** Detalle concreto del pendiente #62: los 33 labels del formulario (lineas 626, 661, 674, 687, 700, 713, 726, 739, 751, 761, 771, 787, 812, 874, 889, 905, 916, 928, 940, 976, 996, 1013, 1067, 1077, 1090, 1100, 1109, 1137, 1170, 1202, 1213, 1267, 1280) no estan asociados a su control. Ademas ningun input tiene id, name ni autoComplete (email, tel, given-name, family-name, bday, new-password), lo que impide el autocompletado del navegador y que los gestores de contraseñas guarden la credencial al registrarse; los errores de campo no se vinculan con aria-describedby/aria-invalid. Sintoma: los tests usan getByPlaceholderText porque getByLabelText no funcionaria. La objecion anotada en la auditoria (aria-label vs 'label in name') no aplica si se usa htmlFor/id, que conserva el texto visible como nombre accesible.
- **Evidencia:**

```ts
                      <label className="block text-white text-sm mb-1">Nombre *</label>
                      <input
                        type="text"
                        value={nombre}
                        onChange={(e) => setNombre(e.target.value)}
                        className={inputClass('nombre')}
                        placeholder="Tu nombre"
                      />
```

- **Escenario de fallo:** Usuario de lector de pantalla tabula por el paso 1: escucha 'edicion, Tu nombre' (placeholder) y pierde el asterisco/obligatoriedad; en selects (Sexo, Nivel de Estudios, Estatus) y fechas no hay placeholder, asi que solo escucha 'cuadro combinado' sin nombre. Al fallar la validacion, el error no se anuncia ni se asocia al campo.
- **Arreglo propuesto:** Asignar id/htmlFor campo por campo (useId para prefijo; en listas dinamicas `edu-${edu.id}-nivel`, `exp-${exp.id}-empresa`, `doc-${doc.id}-name`), añadir name y autoComplete adecuados (autoComplete="new-password" en ambas contraseñas), aria-required en obligatorios y aria-invalid + aria-describedby={`${id}-error`} cuando haya error. Migrar los tests a getByLabelText.

#### AUTHUI-023 — El telefono del candidato no se valida ni en cliente ni en servidor

- **Severidad:** ⚪ low · **Categoría:** validation · **Estado:** nuevo · **Verificación:** sin verificar (reportada por 1 auditor)
- **Ubicación:** `src/app/register/page.tsx:714` · relacionados: `src/app/api/auth/register/route.ts`, `src/lib/validations.ts`
- **Problema:** El campo Teléfono acepta cualquier texto y el schema del registro lo declara z.string().optional(). La auditoria de junio corrigio el regex de telefono (#11) para company-requests/contact, pero el registro de candidato no lo usa. Es el dato con el que reclutadores contactan al candidato.
- **Evidencia:**

```ts
// src/app/register/page.tsx:714-720
                      <input
                        type="tel"
                        value={telefono}
                        onChange={(e) => setTelefono(e.target.value)}
                        className={inputClass('telefono')}
                        placeholder="81 1234 5678"
                      />
// src/app/api/auth/register/route.ts:30
  telefono: z.string().optional(),
```

- **Escenario de fallo:** Candidato escribe '811234567' (9 digitos) o 'el de mi mamá 8112...' -> se guarda tal cual -> el reclutador no puede llamarlo ni enviarle WhatsApp; el dato tambien se muestra a la empresa.
- **Arreglo propuesto:** Reutilizar el regex/schema de telefono de src/lib/validations.ts en registerSchema (opcional pero, si viene, 10 digitos MX tras quitar espacios/guiones, o formato E.164) y validar igual en validateStep(1) mostrando errors.telefono; añadir inputMode="tel" y autoComplete="tel".

#### AUTHUI-024 — Fechas sin limites en el cliente y sin validacion de formato en el servidor (nacimiento futuro, experiencia terminada sin fecha fin, 500 en vez de 400)

- **Severidad:** ⚪ low · **Categoría:** validation · **Estado:** nuevo · **Verificación:** sin verificar (reportada por 1 auditor)
- **Ubicación:** `src/app/register/page.tsx:740` · relacionados: `src/app/api/auth/register/route.ts`
- **Problema:** El input de fecha de nacimiento no tiene min/max; los de experiencia tampoco. En el API son z.string() y se convierten con new Date(...) sin comprobar validez: una cadena no parseable produce Invalid Date, Prisma lanza y se responde 500 generico. Tampoco se exige fechaFin cuando esActual=false (el servidor la cuenta 'hasta hoy' en añosExperiencia) ni se revalida fechaFin >= fechaInicio en servidor.
- **Evidencia:**

```ts
// src/app/register/page.tsx:740-745
                      <input
                        type="date"
                        value={fechaNacimiento}
                        onChange={(e) => setFechaNacimiento(e.target.value)}
                        className={inputClass('fechaNacimiento')}
                      />
// src/app/api/auth/register/route.ts:32 y :223
  fechaNacimiento: z.string().optional(),
          fechaNacimiento: fechaNacimiento ? new Date(fechaNacimiento) : null,
```

- **Escenario de fallo:** Candidato teclea 2099 en el año de nacimiento -> se guarda sin aviso y contamina los filtros demograficos por edad. Deja una experiencia pasada sin 'Fecha Fin' y sin marcar 'Trabajo actual' -> se cuenta hasta hoy e infla añosExperiencia. POST directo con fechaNacimiento:'abc' -> 500 'Error al procesar el registro' en lugar de 400 con el campo señalado.
- **Arreglo propuesto:** Cliente: max = hoy - 15 años y min='1930-01-01' en nacimiento; max = hoy en fechas de experiencia; exigir fechaFin si no es actual. Servidor: z.string().date() (zod 4) + refine de rango para fechaNacimiento; en experiences validar formato, fechaFin >= fechaInicio y fechaFin requerida cuando !esActual; responder 400 con el campo.

#### AUTHUI-025 — Botones solo-icono sin nombre accesible (mostrar/ocultar contraseña y eliminar educacion/experiencia/documento)

- **Severidad:** ⚪ low · **Categoría:** a11y · **Estado:** nuevo · **Verificación:** sin verificar (reportada por 1 auditor)
- **Ubicación:** `src/app/register/page.tsx:796` · relacionados: `src/app/reset-password/page.tsx`
- **Problema:** El sweep #60 cubrio botones de cerrar en modales/toasts, pero no estos: en /register los toggles de contraseña (:796, :821) y los botes de basura (:863, :1056, :1256); en /reset-password el toggle (:120). Solo contienen un icono de lucide sin aria-label ni texto oculto, y los toggles no exponen estado (aria-pressed).
- **Evidencia:**

```ts
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500"
                        >
                          {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                        </button>
```

- **Escenario de fallo:** Un usuario de lector de pantalla encuentra 'boton' sin nombre junto a la contraseña y tres 'boton' sin nombre en cada tarjeta de experiencia; no sabe cual elimina la tarjeta y puede borrar datos por error.
- **Arreglo propuesto:** aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'} + aria-pressed={showPassword}; en los botes aria-label={`Eliminar educación ${index + 1}`} (idem experiencia/documento); aria-hidden en los iconos. Aplicar igual en src/app/reset-password/page.tsx:120.

#### AUTHUI-026 — Años de educacion: min/max nunca se aplican ('Siguiente' es type=button) y no se valida fin >= inicio

- **Severidad:** ⚪ low · **Categoría:** validation · **Estado:** nuevo · **Verificación:** sin verificar (reportada por 1 auditor)
- **Ubicación:** `src/app/register/page.tsx:929` · relacionados: `src/app/api/auth/register/route.ts`
- **Problema:** Los inputs Año Inicio/Fin declaran min=1950 max=2030, pero la validacion nativa solo corre en un submit del form y en los pasos 1-5 se avanza con un boton type="button"; en el paso 6 esos inputs ya no estan montados. validateStep no cubre el paso 2 y el servidor acepta z.number() sin int ni cotas. Ademas el max fijo 2030 quedara obsoleto.
- **Evidencia:**

```ts
                              <input
                                type="number"
                                value={edu.añoInicio || ''}
                                onChange={(e) => updateEducation(index, 'añoInicio', e.target.value ? parseInt(e.target.value) : null)}
                                className="w-full px-3 py-2 rounded-lg border border-gray-300"
                                placeholder="2020"
                                min="1950"
                                max="2030"
                              />
```

- **Escenario de fallo:** Candidato teclea '20' en Año Inicio y '2' en Año Fin (o fin 2015 con inicio 2019), pulsa Siguiente -> avanza sin aviso y el JSON de educacion se guarda con esos valores, que luego se muestran al reclutador en el perfil.
- **Arreglo propuesto:** En validateStep(2) validar enteros entre 1950 y añoActual+8 y añoFin >= añoInicio mostrando el error en la tarjeta; en el servidor z.number().int().min(1950).max(new Date().getFullYear() + 8) con refine fin >= inicio; calcular max dinamicamente.

#### AUTHUI-027 — Registro: tras un upload fallido no se puede reintentar con el mismo archivo (el input file no se resetea)

- **Severidad:** ⚪ low · **Categoría:** frontend-bug · **Estado:** nuevo · **Verificación:** sin verificar (reportada por 1 auditor)
- **Ubicación:** `src/app/register/page.tsx:1308`
- **Problema:** Ninguno de los tres <input type="file"> (foto :645, CV :1187, documentos :1308) limpia e.target.value despues de leer el archivo. Si la subida falla (timeout de 30 s, red, 429) y el usuario vuelve a elegir el MISMO archivo, el navegador no dispara 'change' porque el valor no cambio, y no ocurre nada.
- **Evidencia:**

```ts
                                  onChange={(e) => {
                                    const file = e.target.files?.[0];
                                    if (file) updateDocument(index, 'file', file);
                                  }}
                                  disabled={doc.uploading}
```

- **Escenario de fallo:** Con mala señal, la subida de 'titulo.pdf' agota los 30 s -> alert de error -> la tarjeta vuelve a 'Seleccionar archivo'. El candidato hace clic y elige otra vez 'titulo.pdf' -> no pasa nada (sin evento change). Cree que el formulario se trabo.
- **Arreglo propuesto:** En los tres handlers: const input = e.target; const file = input.files?.[0]; input.value = ''; if (file) ...

#### AUTHUI-028 — reset-password: con token expirado solo se ve el error despues de llenar el formulario y no se ofrece 'Solicitar nuevo enlace'

- **Severidad:** ⚪ low · **Categoría:** ux · **Estado:** nuevo · **Verificación:** sin verificar (reportada por 1 auditor)
- **Ubicación:** `src/app/reset-password/page.tsx:51` · relacionados: `src/app/api/auth/reset-password/route.ts`
- **Problema:** La pagina no verifica el token al cargar; el usuario escribe dos veces la contraseña y entonces recibe 'Token inválido o expirado'. En ese estado el unico enlace disponible es 'Volver al login'; el enlace a /forgot-password solo se renderiza cuando falta el parametro token (:60-74).
- **Evidencia:**

```ts
      } else {
        setError(data.error || 'Error al restablecer contraseña');
      }
```

- **Escenario de fallo:** Usuario abre el correo de recuperacion 2 horas despues (el token dura 1 h), escribe y confirma su nueva contraseña -> 'Token inválido o expirado' -> no hay accion para pedir otro enlace; vuelve al login y debe encontrar de nuevo '¿Olvidaste tu contraseña?'.
- **Arreglo propuesto:** Cuando res.status === 400 y el error sea de token, renderizar el mismo bloque de 'enlace inválido' con el Link a /forgot-password. Mejor: validar el token al montar con un GET ligero (con rate-limit) y mostrar ese estado antes de pedir la contraseña.

#### AUTHUI-029 — /unauthorized ofrece 'Iniciar Sesión' a quien ya tiene sesion (reason=no-permission) y login/register no detectan sesion activa

- **Severidad:** ⚪ low · **Categoría:** ux · **Estado:** nuevo · **Verificación:** sin verificar (reportada por 1 auditor)
- **Ubicación:** `src/app/unauthorized/page.tsx:42` · relacionados: `src/app/login/page.tsx`, `src/app/register/page.tsx`, `src/middleware.ts`
- **Problema:** Para reason=no-permission el usuario YA esta autenticado con otro rol; la CTA principal lo manda a /login, que no consulta /api/auth/me y le muestra el formulario como si no tuviera sesion. No se ofrece 'Ir a mi panel' ni 'Cambiar de cuenta' (logout). /register tampoco detecta sesion: una empresa logueada puede crear ahi una cuenta de candidato y su cookie se sobrescribe sin aviso.
- **Evidencia:**

```ts
        <Link
          href="/login"
          className="inline-flex items-center justify-center bg-button-orange text-white font-semibold px-8 py-3 rounded-full hover:scale-105 hover:shadow-lg transition-all duration-300"
        >
          Iniciar Sesión
        </Link>
```

- **Escenario de fallo:** Un reclutador pega una URL /admin/... que le compartio un admin -> middleware -> /unauthorized?reason=no-permission -> pulsa 'Iniciar Sesión' -> ve el login vacio aunque la Navbar muestra su avatar; no sabe si se cerro su sesion.
- **Arreglo propuesto:** Segun reason: en no-permission mostrar 'Ir a mi panel' (destino por rol via /api/auth/me y el mapa ROLE_HOME) y 'Cambiar de cuenta' (POST /api/auth/logout y luego /login); en no-token/expired mantener 'Iniciar Sesión' propagando ?redirect. En login y register consultar /api/auth/me al montar y redirigir al panel si ya hay sesion.
