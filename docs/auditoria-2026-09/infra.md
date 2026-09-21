# Configuración, CI, dependencias, tests y documentación

[← volver al índice](../AUDITORIA-2026-09.md) · 34 hallazgos — 🟠 2 high · 🟡 15 medium · ⚪ 17 low

## 🟠 high (2)

#### INFRA-001 — Contrasenas de admin y de todos los roles seed publicadas en documentacion versionada

- **Severidad:** 🟠 high · **Categoría:** security · **Estado:** nuevo · **Verificación:** sin verificar (reportada por 1 auditor)
- **Ubicación:** `README.md:164` · relacionados: `docs/INSTALLATION.md`, `docs/GUIA_TESTING.md`, `docs/USER_GUIDE.md`, `docs/API.md`, `docs/env.example`, `docs/ENVIRONMENT_VARIABLES.md`, `TOKENS_TO_ROTATE.md`, `prisma/seed.ts`
- **Problema:** El README y otros 6 documentos versionados publican en claro el email y la contrasena de las cuentas seed (2 admins -uno con correo personal de Gmail-, 3 empresas, reclutadores, especialistas, candidato). El seed ya no las hardcodea (usa SEED_*_PASSWORD), pero los docs siguen mostrando los valores historicos con los que se sembraron las bases existentes. TOKENS_TO_ROTATE.md:16 mantiene 'Admin password' SIN marcar como rotada. No copio los valores.
- **Evidencia:**

```ts
README.md:164-177
## Credenciales de Prueba
| Rol | Email | Password |
| **Admin** | admin@inakat.com | <REDACTADO> |
| **Empresa** | contact@techsolutions.mx | <REDACTADO> |
...
Mismo patron en: docs/INSTALLATION.md:209-216, docs/GUIA_TESTING.md:9-12, docs/USER_GUIDE.md:276-288, docs/API.md:41 y 646, docs/env.example:35, docs/ENVIRONMENT_VARIABLES.md:237/318/384
```

- **Escenario de fallo:** Cualquier persona con lectura del repo (hay dos remotos: origin de la organizacion y 'personal'; colaboradores, forks o una fuga) abre /login en produccion y prueba admin@inakat.com con la contrasena documentada. Si produccion se sembro con esos valores y nunca se roto (el checklist de TOKENS_TO_ROTATE.md lo deja sin marcar), obtiene rol admin: PII de todos los candidatos, aprobacion de empresas, creditos y comisiones.
- **Arreglo propuesto:** 1) Eliminar todas las contrasenas de los 7 archivos y sustituirlas por 'definida en SEED_*_PASSWORD de tu .env'. 2) Rotar YA en produccion la contrasena de todas las cuentas seed (2 admins, empresas demo, reclutadores, especialistas, candidato) o desactivar las que sean demo. 3) Anadir un test/lint de CI que falle si README/docs contienen el patron 'Password' seguido de un valor. 4) Limpiar el historial junto con el hallazgo de TOKENS_TO_ROTATE.md.

#### INFRA-002 — Secretos reales siguen en el historial git y la rotacion figura sin completar; TOKENS_TO_ROTATE.md esta trackeado pese a .gitignore

- **Severidad:** 🟠 high · **Categoría:** security · **Estado:** nuevo · **Verificación:** sin verificar (reportada por 1 auditor)
- **Ubicación:** `TOKENS_TO_ROTATE.md:10` · relacionados: `.gitignore`, `.env.example`, `src/lib/auth.ts`
- **Problema:** El propio archivo declara que su version original contenia valores reales de secretos y que fue 'sanitizado', pero (a) los 6 checkboxes de rotacion y el de 'Git history cleaned' siguen sin marcar, (b) el commit original fed13d4 (2026-01-27) sigue en el historial de main y esta empujado a dos remotos (origin y personal), (c) .gitignore:77 lista el archivo pero `git ls-files` lo muestra trackeado, asi que la regla no tiene efecto. El mismo documento indica que .env.example tambien tuvo valores reales en su historial. No abri el contenido historico.
- **Evidencia:**

```ts
TOKENS_TO_ROTATE.md:10  **The original version of this file contained actual secret values and has been sanitized.**
:14 - [ ] Supabase database password
:15 - [ ] JWT_SECRET
:16 - [ ] Admin password
:17 - [ ] Vercel Blob token
:18 - [ ] MercadoPago credentials
:19 - [ ] Google Maps API key
:25 - [ ] Git history cleaned (see below)
.gitignore:76-77  # Security - never commit secret rotation docs with actual values / TOKENS_TO_ROTATE.md
git log -- TOKENS_TO_ROTATE.md -> c6461e8 (sanitize), fed13d4 (alta original)
```

- **Escenario de fallo:** Quien clone cualquiera de los dos remotos puede recuperar la version original del archivo desde el commit fed13d4. Si JWT_SECRET no se roto, puede firmar un auth-token con role 'admin' (src/lib/auth.ts verifyToken solo valida la firma) y entrar a todo /api/admin/*; con la password de Supabase puede volcar la base completa; con el token de MercadoPago puede operar la cuenta de cobro.
- **Arreglo propuesto:** 1) Rotar los 6 secretos ahora y marcar cada casilla con fecha. 2) Despues, reescribir historial en AMBOS remotos (git filter-repo --invert-paths --path TOKENS_TO_ROTATE.md y limpiar las versiones antiguas de .env.example) y pedir re-clone. 3) `git rm --cached TOKENS_TO_ROTATE.md` y mover el checklist fuera del repo. 4) Activar secret scanning + push protection en GitHub.

## 🟡 medium (15)

#### INFRA-003 — 37 de las 73 suites de jest no importan ni leen codigo fuente: prueban constantes locales y sus propios mocks

- **Severidad:** 🟡 medium · **Categoría:** tests · **Estado:** nuevo · **Verificación:** sin verificar (reportada por 1 auditor)
- **Ubicación:** `__tests__/api/auth.test.ts:56` · relacionados: `jest.config.js`, `__tests__/api/jobs.test.ts`, `__tests__/api/role-permissions.test.ts`, `__tests__/api/recruitment-flow.test.ts`, `__tests__/api/credits-hardening.test.ts`
- **Problema:** El dato '1355 tests pasan' da una confianza falsa. Verificado por imports: 37 archivos no tienen ningun import de src ni readFileSync (solo @jest/globals o bcryptjs). Llaman al mock y luego afirman que el mock fue llamado, o definen un array/funcion dentro del test y lo comprueban contra si mismo. Ademas divergen del codigo real: credits-hardening.test.ts:53-55 valida un chequeo 'Configuracion de paquete inconsistente' que NO existe en la ruta real. jest.config.js no define coverageThreshold, asi que nada lo delata. Archivos: api/{auth,jobs,applications,applications-check,assign-candidates,bugfixes-dec14,candidate-applications,candidates,company-dashboard-filter,company-logo,company-requests,confidential-jobs,credit-packages,credits-hardening,data-validation,direct-applications,evaluation-notes,four-tabs-flow,job-edit-credits,jobs-expiration,application-status-validation,pricing,pricing-delete,profile,recruiter-dashboard,recruiter-injected-candidates,recruitment-flow,role-permissions,smoke,specialist-dashboard,users,middleware-exceptions}.test.ts, api/jobs/{jobs-id-auth,confidential-sanitization,publish-confidential}.test.ts, utils/ensureUrl.test.ts, config/next-config.test.ts.
- **Evidencia:**

```ts
__tests__/api/auth.test.ts:56-66
      mockPrismaUser.findUnique.mockResolvedValue(mockUser);
      mockBcrypt.compare.mockResolvedValue(true);
      // Simular flujo de autenticación
      const user = await mockPrismaUser.findUnique({ where: { email: 'test@example.com' } });
      const passwordValid = await mockBcrypt.compare('password123', user.password);
      expect(user).not.toBeNull();
      expect(passwordValid).toBe(true);
__tests__/api/role-permissions.test.ts:31  function checkPermission(userRole, action, resource) { const permissions = {...local...} }
```

- **Escenario de fallo:** Alguien borra la comprobacion de isActive en authenticateUser, o el descuento de creditos en /api/jobs/publish, o cambia el filtro de status del dashboard del reclutador: las suites auth.test.ts, jobs.test.ts, recruiter-dashboard.test.ts y recruitment-flow.test.ts siguen en verde porque nunca ejecutan esos handlers. La regresion llega a produccion con el CI en verde.
- **Arreglo propuesto:** Reescribir estas suites importando el handler real (patron ya usado en __tests__/api/jobs/jobs-owner-view-auth.test.ts y vendors.test.ts: mock de @/lib/prisma + import dinamico de la ruta + Request real) o borrarlas. Anadir en jest.config.js `coverageThreshold` sobre src/app/api y src/lib, y correr `jest --coverage` en CI para que un test que no toca codigo no sume.

#### INFRA-004 — Los tests de candidatos, usuarios y postulaciones directas no importan los handlers: solo verifican sus propios mocks

- **Severidad:** 🟡 medium · **Categoría:** tests · **Estado:** nuevo · **Verificación:** sin verificar (reportada por 1 auditor)
- **Ubicación:** `__tests__/api/candidates.test.ts:23` · relacionados: `__tests__/api/users.test.ts`, `__tests__/api/direct-applications.test.ts`, `__tests__/api/admin-routes-defensive-auth.test.ts`
- **Problema:** __tests__/api/candidates.test.ts, users.test.ts y direct-applications.test.ts mockean @/lib/prisma y luego llaman directamente al mock y comprueban que fue llamado con lo que ellos mismos le pasaron; ninguno importa src/app/api/admin/**/route.ts (grep de imports de route en esos archivos: sin resultados). Solo admin-routes-defensive-auth.test.ts ejercita handlers reales, y unicamente el 401/403. No hay ningun test para specialties, reset-password, documents ni pipeline. Forman parte de los '1355 tests en verde' sin cubrir una sola linea del modulo.
- **Evidencia:**

```ts
mockPrismaCandidate.findMany.mockResolvedValue([]);

await mockPrismaCandidate.findMany({
  where: { sexo: 'M' },
});

expect(mockPrismaCandidate.findMany).toHaveBeenCalledWith({
  where: { sexo: 'M' },
});
```

- **Escenario de fallo:** Alguien rompe el filtro por sexo, quita la validacion de email unico o borra el requireRole del PUT de candidatos: la suite sigue al 100% en verde y el CI deja pasar el cambio.
- **Arreglo propuesto:** Reescribirlos importando GET/POST/PUT/DELETE de cada route.ts, mockeando prisma y requireRole, construyendo Request reales y afirmando status y cuerpo. Casos minimos: 409 por email duplicado, transaccion user+candidate, PUT con experiences invalidas no borra las existentes, rename de especialidad con slug duplicado, direct-applications sobre aplicacion no pending, reset-password con y sin userId.

#### INFRA-005 — Los tests de reclutador, especialista y notas son tautologicos (no importan los handlers) y llegan a contradecir el codigo; interview-requests no tiene ningun test

- **Severidad:** 🟡 medium · **Categoría:** tests · **Estado:** nuevo · **Verificación:** sin verificar (reportada por 1 auditor)
- **Ubicación:** `__tests__/api/evaluation-notes.test.ts:37` · relacionados: `__tests__/api/recruiter-dashboard.test.ts`, `__tests__/api/specialist-dashboard.test.ts`, `__tests__/api/recruiter-injected-candidates.test.ts`, `__tests__/api/notifications.test.ts`
- **Problema:** recruiter-dashboard.test.ts, specialist-dashboard.test.ts, evaluation-notes.test.ts y recruiter-injected-candidates.test.ts no importan ninguna ruta (grep de import/require de route en esos archivos: 0 resultados): redefinen localmente allowedTransitions o listas de roles y afirman sobre esas copias o sobre los mocks. evaluation-notes.test.ts afirma que 'company' NO esta autorizado cuando notes/route.ts:22 si lo autoriza. Otros tests (notifications.test.ts G7/G8) leen el archivo fuente y buscan strings. /api/interview-requests/[id], donde se corrigio un IDOR (#45/#47), no tiene tests. Solo skill-ratings-authz.test.ts importa el handler real.
- **Evidencia:**

```ts
    it('debe rechazar acceso si no es recruiter/specialist/admin', () => {
      const invalidRoles = ['candidate', 'company', 'user', ''];

      invalidRoles.forEach((role) => {
        const isAuthorized = ['recruiter', 'specialist', 'admin'].includes(role);
        expect(isAuthorized).toBe(false);
      });
    });
```

- **Escenario de fallo:** Alguien borra la validacion de transiciones o el canAccessJob de una ruta: los 1355 tests siguen en verde y el CI bloqueante no detecta nada. Por eso mismo no se detectaron las divergencias UI/API de los botones 'Enviar'.
- **Arreglo propuesto:** Reescribir estos tests importando { GET, PUT, POST, PATCH } de cada route.ts con prisma y requireRole mockeados (patron de __tests__/api/evaluations/skill-ratings-authz.test.ts): 403 sin asignacion, 400 en transiciones prohibidas, company solo isPublic, adminNotes ausente para company. Extraer las tablas de transiciones a un modulo compartido y testearlo junto con los botones que renderiza la UI.

#### INFRA-006 — Los tests de seguridad de /api/jobs/[id] son tautologías que no ejecutan el handler

- **Severidad:** 🟡 medium · **Categoría:** tests · **Estado:** nuevo · **Verificación:** sin verificar (reportada por 1 auditor)
- **Ubicación:** `__tests__/api/jobs/jobs-id-auth.test.ts:19`
- **Problema:** Todo el archivo afirma constantes locales (`expect(true).toBe(true)`) o compara una copia pegada de la whitelist; nunca importa la ruta. Da cobertura aparente a auth/ownership de PATCH/PUT/DELETE sin verificar nada, y por eso el bypass draft->paused->active y el cambio de seniority por PATCH pasan con CI en verde. La copia de allowedPatchFields ya difiere de la real (faltan latitude, longitude, notasInternas).
- **Evidencia:**

```ts
it('debe requerir autenticación', () => {
  // PATCH sin cookie debe retornar 401
  const requiresAuth = true;
  expect(requiresAuth).toBe(true);
});
```

- **Escenario de fallo:** Alguien elimina la llamada a verifyJobOwnership en PATCH o reintroduce el spread del body: `npm test` sigue pasando 1355 tests y el CI bloqueante no detecta la regresión.
- **Arreglo propuesto:** Reescribir importando { PATCH, PUT, DELETE } de la ruta con prisma y next/headers mockeados: 401 sin cookie, 403 no propietario, 403 draft->active, 403 draft->paused->active, PATCH de seniority rechazado, campos peligrosos ignorados, 403 tras editableUntil.

#### INFRA-007 — El test y los checklists de QA afirman que POST /api/upload requiere login; el middleware real lo hace publico (y el test dice 3 excepciones cuando hay 4)

- **Severidad:** 🟡 medium · **Categoría:** tests · **Estado:** nuevo · **Verificación:** sin verificar (reportada por 2 auditores)
- **Ubicación:** `__tests__/api/middleware-exceptions.test.ts:24` · relacionados: `src/middleware.ts`, `docs/GUIA_TESTING.md`, `docs/GUIA_FLUJOS_POR_ROL.md`, `src/app/api/upload/route.ts`
- **Problema:** El test de 'excepciones del middleware' no importa src/middleware.ts: compara un array local consigo mismo. Ademas documenta lo contrario de lo que hace el codigo: lista /api/upload como ruta protegida y afirma 'exactamente 3 excepciones publicas', mientras src/middleware.ts tiene 4 y la cuarta es justamente POST /api/upload sin autenticacion. docs/GUIA_TESTING.md:130 y docs/GUIA_FLUJOS_POR_ROL.md:269 repiten 'POST /api/upload sin login -> 401'.
- **Evidencia:**

```ts
__tests__/api/middleware-exceptions.test.ts:24
    { pathname: '/api/upload', method: 'POST', requiredRole: 'any' },
:42-44
    it('debería haber exactamente 3 excepciones públicas', () => {
      expect(PUBLIC_EXCEPTIONS).toHaveLength(3);
src/middleware.ts:28-31
  // Excepción: POST a upload es público (para registro de empresas)
  if (pathname === '/api/upload' && request.method === 'POST') {
    return NextResponse.next();
  }
```

- **Escenario de fallo:** QA ejecuta el checklist 'POST /api/upload sin login -> 401' y obtiene 200 con una URL publica de Vercel Blob; o un desarrollador, confiando en el test verde, asume que la subida esta autenticada. En realidad cualquier anonimo puede subir PDF/DOC/imagenes de 5 MB al blob publico de INAKAT con un unico freno: un rate-limit en memoria por instancia (15/h/IP).
- **Arreglo propuesto:** Reescribir el test importando `middleware` y `config` reales y ejecutandolos con NextRequest (sin cookie -> 401; con cookie de rol X -> 403/next) para cada ruta, incluido /api/upload. Decidir el contrato: si la subida anonima solo hace falta para el registro de empresa/candidato, exigir un token efimero de formulario o separar /api/upload/public con limites mas estrictos; y corregir los dos documentos.
- **Otros auditores añaden:** Testear el middleware de verdad: importar `middleware` y `config`, construir `new NextRequest(url, { method, headers: { cookie } })` con JWT firmados por rol (generateToken) y afirmar status/redirect para cada ruta: sin token -> 401; token candidate en /api/admin/users -> 403; POST /api/upload sin token -> pasa; etc. Incluir un test que recorra src/app/api/**/route.ts y falle si una ruta nueva no esta ni en el matcher ni en una lista explicita de publicas.

#### INFRA-008 — La suite e2e supera el rate-limit de login (7 por 15 min por IP): a partir del octavo login recibe 429

- **Severidad:** 🟡 medium · **Categoría:** tests · **Estado:** nuevo · **Verificación:** sin verificar (reportada por 1 auditor)
- **Ubicación:** `__tests__/e2e/recruitment-flow.spec.ts:17` · relacionados: `src/lib/rate-limit.ts`, `__tests__/e2e/auth-flows.spec.ts`, `playwright.config.ts`
- **Problema:** Cada test hace login por UI. auth-flows.spec.ts hace 2 POST /api/auth/login y recruitment-flow.spec.ts 7: 9 por proyecto, y hay 2 proyectos (chromium + mobile) con workers:1 contra el mismo `npm run dev`, es decir 18 logins desde la misma IP en pocos minutos. LOGIN_RATE_LIMIT permite 7 por ventana de 15 min y no tiene bypass para test.
- **Evidencia:**

```ts
src/lib/rate-limit.ts:121-124
export const LOGIN_RATE_LIMIT: RateLimitConfig = {
  maxRequests: 7,
  windowSeconds: 15 * 60
};
playwright.config.ts:19-28  projects: [ { name: 'chromium' ... }, { name: 'mobile' ... } ]
__tests__/e2e/helpers/auth.ts:11-14  await page.click('button[type="submit"]'); await page.waitForURL((url) => !url.pathname.includes('/login'), { timeout: 10000 });
```

- **Escenario de fallo:** Con cuentas correctas, `npm run test:e2e`: los primeros 7 logins pasan; el 8o recibe 429 'Demasiadas solicitudes', la pagina se queda en /login, waitForURL agota 10 s y fallan el resto de tests de recruitment-flow y todo el proyecto 'mobile'. Reintentar no ayuda porque la ventana es de 15 min.
- **Arreglo propuesto:** Autenticar una vez por rol en un `globalSetup` y reutilizar `storageState` por proyecto (elimina ~16 logins), y/o permitir desactivar el rate-limit solo con una variable explicita de test (p. ej. DISABLE_RATE_LIMIT=1 rechazada si NODE_ENV==='production').

#### INFRA-009 — Tests de jest (bloqueantes en CI) y e2e acoplados al texto fuente de la home: el rediseno en curso pondra el CI en rojo

- **Severidad:** 🟡 medium · **Categoría:** tests · **Estado:** nuevo · **Verificación:** sin verificar (reportada por 1 auditor)
- **Ubicación:** `__tests__/qa/lalo-marzo2026-landing.test.ts:22` · relacionados: `__tests__/qa/feb2026-regression.test.ts`, `__tests__/e2e/public-pages.spec.ts`
- **Problema:** Dos suites leen con fs.readFileSync, a nivel de describe, archivos de src/components/sections/home/** y src/app/page.tsx, y afirman literales de copy y de implementacion (9 preguntas de FAQ, nombres de testimonios, regex de clases grid, 'hero-inakat', que page.tsx contenga 'SelectionProcessSection'). Como npm test es bloqueante, renombrar o reescribir esos componentes rompe el CI; readFileSync de un archivo borrado lanza al cargar la suite y tumba tambien los tests no relacionados del mismo archivo (middleware, admin).
- **Evidencia:**

```ts
__tests__/qa/lalo-marzo2026-landing.test.ts:22
  const content = readFile('src/components/sections/home/FAQSection.tsx');
:86
  const content = readFile('src/components/sections/home/TestimonialsSection.tsx');
__tests__/qa/feb2026-regression.test.ts:193-195
    const content = readFile('src/components/sections/home/HeroSection.tsx');
    expect(content).toMatch(/import.*hero.*from/i);
:236-237
    const content = readFile('src/app/page.tsx');
    expect(content).toContain('SelectionProcessSection');
(tambien :152, :350, :379, :405, :428 y __tests__/e2e/public-pages.spec.ts:5-24)
```

- **Escenario de fallo:** El PR del rediseno de la home elimina o renombra FAQSection.tsx/TestimonialsSection.tsx/HeroSection.tsx/StatsSection.tsx o cambia page.tsx: `npm test` falla con ENOENT o con aserciones de copy, y el workflow CI bloquea el merge aunque la home nueva funcione.
- **Arreglo propuesto:** En el mismo PR del rediseno: borrar los bloques de estas dos suites que apuntan a sections/home y app/page.tsx (Batch 2A, 2C, P4-09a, P5-09a, P1-ed9 y los de :350/:379/:405/:428) y sustituirlos por tests de comportamiento (render con Testing Library de la home nueva: h1 visible, FAQ abre/cierra, CTA enlaza a /companies). Actualizar los dos primeros tests de public-pages.spec.ts a selectores por rol/data-testid en vez de copy literal.

#### INFRA-010 — El CI no ejecuta next build, ni e2e, ni validacion de Prisma, ni escaneo de dependencias

- **Severidad:** 🟡 medium · **Categoría:** config · **Estado:** nuevo · **Verificación:** sin verificar (reportada por 1 auditor)
- **Ubicación:** `.github/workflows/ci.yml:42` · relacionados: `package.json`, `playwright.config.ts`, `prisma/schema.prisma`
- **Problema:** El workflow 'bloqueante' solo corre tsc, next lint y jest. No hay `npm run build`, no hay job de Playwright (los 4 specs de __tests__/e2e nunca se ejecutan en ningun sitio), no hay `prisma validate`/`prisma migrate diff` (con un historial de migraciones que se sabe desincronizado), no hay `npm audit` ni dependabot.yml, y no declara `permissions:` para el GITHUB_TOKEN.
- **Evidencia:**

```ts
.github/workflows/ci.yml:42-49
      - name: Typecheck (tsc)
        run: npx tsc --noEmit
      - name: Lint (eslint)
        run: npm run lint
      - name: Tests (jest)
        run: npm test
(.github/ solo contiene workflows/ci.yml)
```

- **Escenario de fallo:** Un PR anade useSearchParams() en una pagina sin <Suspense>, o importa un modulo solo-servidor (prisma, fs) desde un componente 'use client', o rompe el prerender de una pagina estatica: tsc, eslint y jest pasan en verde, se mergea a main y el build de Vercel falla; produccion se queda en la version anterior sin que el CI avisara. Igual con un cambio en schema.prisma sin migracion.
- **Arreglo propuesto:** Anadir pasos: `npx prisma validate`, `npm run build` (con las env dummy ya definidas mas NEXT_PUBLIC_* dummy), `npm audit --omit=dev --audit-level=high`; un job e2e aparte (servicio postgres + `prisma db push` + seed e2e + `npx playwright install --with-deps chromium` + `npm run test:e2e`, subiendo el reporte como artefacto); `permissions: contents: read`; y .github/dependabot.yml para npm y github-actions.

#### INFRA-011 — public/uploads no esta en .gitignore: los CV e identificaciones subidos en desarrollo se pueden commitear

- **Severidad:** 🟡 medium · **Categoría:** security · **Estado:** nuevo · **Verificación:** sin verificar (reportada por 1 auditor)
- **Ubicación:** `.gitignore:65` · relacionados: `src/app/api/upload/route.ts`, `docs/CONTRIBUTING.md`
- **Problema:** Cuando no hay BLOB_READ_WRITE_TOKEN (desarrollo/test), /api/upload escribe los archivos en public/uploads. Esa carpeta no esta ignorada (`git check-ignore public/uploads/x.pdf` -> no ignorado) y docs/CONTRIBUTING.md:188 instruye `git add .`. El bloque 'Temporary files' del .gitignore solo cubre tmp/ y temp/.
- **Evidencia:**

```ts
src/app/api/upload/route.ts:35-36
async function saveToLocalStorage(file: File, uniqueFileName: string): Promise<string> {
  const uploadDir = path.join(process.cwd(), 'public', 'uploads');
.gitignore:65-67
# Temporary files
tmp/
temp/
docs/CONTRIBUTING.md:188
git add .
```

- **Escenario de fallo:** Un desarrollador prueba el registro de empresa o de candidato en local con documentos reales (INE, acta constitutiva, CV) sin token de Blob; los archivos quedan en public/uploads; hace `git add . && git commit && git push` como indica CONTRIBUTING.md y sube PII al repositorio (dos remotos), de donde ya no sale sin reescribir el historial.
- **Arreglo propuesto:** Anadir `/public/uploads/` a .gitignore (y un public/uploads/.gitkeep si se quiere conservar la carpeta); mejor aun, escribir el fallback local fuera de public (p. ej. .uploads/) y servirlo por una ruta solo-dev.

#### INFRA-012 — docs/DEPLOYMENT.md omite las variables de pagos, webhook, correo y mapas, y recomienda el pooler en modo sesion (5432)

- **Severidad:** 🟡 medium · **Categoría:** docs · **Estado:** nuevo · **Verificación:** sin verificar (reportada por 1 auditor)
- **Ubicación:** `docs/DEPLOYMENT.md:147` · relacionados: `.env.example`, `docs/ENVIRONMENT_VARIABLES.md`, `src/app/api/webhooks/mercadopago/route.ts`, `src/lib/email.ts`
- **Problema:** La lista de variables a configurar en Vercel solo incluye DATABASE_URL, DIRECT_URL, JWT_SECRET, BLOB, ADMIN_* y NEXT_PUBLIC_APP_URL. Faltan MERCADOPAGO_ACCESS_TOKEN, NEXT_PUBLIC_MERCADOPAGO_PUBLIC_KEY, MERCADOPAGO_WEBHOOK_SECRET, SMTP_* y NEXT_PUBLIC_GOOGLE_MAPS_API_KEY. Ademas indica DATABASE_URL '...pooler.supabase.com:5432' (modo sesion, sin pgbouncer=true) mientras .env.example:16 usa 6543 con pgbouncer=true, que es lo correcto para serverless; y el host de DIRECT_URL '...compute.amazonaws.com' no corresponde a Supabase.
- **Evidencia:**

```ts
docs/DEPLOYMENT.md:148-151
# Base de datos
DATABASE_URL
Value: postgresql://postgres.xxx:[PASSWORD]@...pooler.supabase.com:5432/postgres
(:157-183 JWT_SECRET, BLOB_READ_WRITE_TOKEN, ADMIN_EMAIL, ADMIN_PASSWORD, ADMIN_NOMBRE, NEXT_PUBLIC_APP_URL; ninguna de MercadoPago/SMTP/Maps)
src/app/api/webhooks/mercadopago/route.ts:125-130
      if (process.env.NODE_ENV === 'production') { ... return NextResponse.json({ error: 'Webhook not configured' }, { status: 500 });
```

- **Escenario de fallo:** Se despliega siguiendo la guia: el checkout muestra 'Error de configuracion'; cada notificacion de MercadoPago recibe 500 'Webhook not configured' y los pagos pendientes nunca se acreditan; los correos de reset se descartan en silencio (sendEmail devuelve false); el autocompletado de direcciones no carga. Con el pooler en modo sesion, varias lambdas concurrentes agotan las conexiones ('max clients reached in session mode').
- **Arreglo propuesto:** Reescribir la seccion a partir de .env.example marcando cada variable como obligatoria/opcional y su entorno; usar el puerto 6543 con `?pgbouncer=true&connection_limit=1` para DATABASE_URL y 5432 para DIRECT_URL; anadir el paso de registrar la URL y el secreto del webhook en el panel de MercadoPago.

#### INFRA-013 — Seis documentos ordenan `prisma migrate dev/reset/deploy` sobre un historial de migraciones que no representa el esquema; WORKY2_INTEGRATION.md pide `db push` aunque ya existe la migracion

- **Severidad:** 🟡 medium · **Categoría:** data-integrity · **Estado:** pendiente conocido de junio · **Verificación:** sin verificar (reportada por 1 auditor)
- **Ubicación:** `docs/TROUBLESHOOTING.md:164` · relacionados: `docs/INSTALLATION.md`, `docs/CONTRIBUTING.md`, `docs/DEPLOYMENT.md`, `docs/DATABASE_SCHEMA.md`, `docs/GUIA_SISTEMA_COMPLETA.md`, `docs/WORKY2_INTEGRATION.md`, `prisma/migrations/20260713000000_add_worky2_integration_tables/migration.sql`
- **Problema:** Pendiente manual #8 (baseline). Detalle nuevo: prisma/migrations solo crea 7 tablas (User, CompanyRequest, ContactMessage, Job, Application, IntegrationApiKey, IntegrationWebhook) de los 22 modelos de schema.prisma; el resto se aplico con db push. Aun asi INSTALLATION.md:188, CONTRIBUTING.md:135, GUIA_SISTEMA_COMPLETA.md:432/472, DATABASE_SCHEMA.md:557-570, TROUBLESHOOTING.md:164-167/589/615 y DEPLOYMENT.md:236/263 ordenan migrate dev, migrate reset y migrate deploy. README.md:153 dice db push. docs/WORKY2_INTEGRATION.md:7-11 sigue diciendo que las tablas no existen y que se corra `npx prisma db push`, cuando ya existe prisma/migrations/20260713000000_add_worky2_integration_tables. El build (package.json:7) no ejecuta migrate deploy.
- **Evidencia:**

```ts
docs/TROUBLESHOOTING.md:162-167
# Ejecutar migraciones
npx prisma migrate dev

# Si no funciona, reset completo (⚠️ borra datos)
npx prisma migrate reset
docs/WORKY2_INTEGRATION.md:9-10
> existen aún en la base. **El dueño del repo corre `npx prisma db push` (o la
> migración equivalente) al mergear este branch.**
```

- **Escenario de fallo:** (a) Un dev con DATABASE_URL apuntando a la base compartida ejecuta `npx prisma migrate dev` como dice TROUBLESHOOTING: Prisma detecta drift (15 tablas sin migracion) y ofrece resetear el esquema; si acepta, borra todos los datos. (b) En una BD limpia, migrate dev genera una migracion local con las 15 tablas; si se commitea, `migrate deploy` en produccion falla con 'relation already exists'. (c) Si las tablas Worky2 se crean con db push como dice el doc, un futuro `migrate deploy` falla en 20260713000000 hasta hacer `migrate resolve --applied`.
- **Arreglo propuesto:** Generar la baseline (`prisma migrate diff --from-empty --to-schema-datamodel` en una migracion 0_baseline que sustituya a las 6 antiguas) y marcarla aplicada en produccion; hasta entonces, cambiar TODOS los docs a `npx prisma db push` para desarrollo, eliminar las recomendaciones de migrate reset, actualizar la nota de WORKY2_INTEGRATION.md y anadir al CI `prisma migrate diff --from-migrations --to-schema-datamodel --exit-code` contra una shadow DB.

#### INFRA-014 — CSP ausente: detalle de origenes reales que necesita la app para poder activarla (y X-Powered-By sigue expuesto)

- **Severidad:** 🟡 medium · **Categoría:** security · **Estado:** pendiente conocido de junio · **Verificación:** sin verificar (reportada por 1 auditor)
- **Ubicación:** `next.config.ts:7` · relacionados: `src/app/credits/purchase/page.tsx`, `src/components/sections/jobs/CreateJobForm.tsx`, `src/app/company/profile/page.tsx`, `src/app/profile/page.tsx`, `src/components/sections/companies/FormRegisterForQuotationSection.tsx`
- **Problema:** Pendiente manual #86. Detalle nuevo para desbloquearlo: tras revisar el codigo, los unicos origenes externos son (1) https://sdk.mercadopago.com/js/v2 cargado SOLO en /credits/purchase, (2) Google Maps via @react-google-maps/api useLoadScript en 4 sitios (company/profile, CreateJobForm, profile, FormRegisterForQuotationSection), (3) imagenes de *.public.blob.vercel-storage.com. Las fuentes son next/font (autoalojadas), no hay dangerouslySetInnerHTML ni otros scripts de terceros. Tampoco se define poweredByHeader:false.
- **Evidencia:**

```ts
next.config.ts:3-6
// SEGURIDAD (#86): cabeceras HTTP de seguridad. Antes no se enviaba ninguna.
// Nota: una Content-Security-Policy estricta queda como acción manual pendiente
// porque la app carga Google Maps y el SDK de Mercado Pago ...
:7-20  const securityHeaders = [ X-Frame-Options, X-Content-Type-Options, Referrer-Policy, HSTS, Permissions-Policy, X-DNS-Prefetch-Control ]  (sin Content-Security-Policy)
```

- **Escenario de fallo:** Cualquier XSS almacenado que escape a los saneos por regex (src/lib/sanitize.ts) o un href javascript: en un campo de URL se ejecuta sin restriccion y puede llamar a la API con la cookie de sesion de un admin (la cookie es httpOnly pero las peticiones same-origin la envian). Sin CSP tampoco hay frame-ancestors moderno ni bloqueo de exfiltracion via connect-src.
- **Arreglo propuesto:** Anadir primero `Content-Security-Policy-Report-Only` y despues enforce con: default-src 'self'; script-src 'self' 'unsafe-inline' https://sdk.mercadopago.com https://http2.mlstatic.com https://maps.googleapis.com; connect-src 'self' https://api.mercadopago.com https://*.mercadopago.com https://maps.googleapis.com https://*.public.blob.vercel-storage.com; img-src 'self' data: blob: https://*.public.blob.vercel-storage.com https://maps.gstatic.com https://*.googleapis.com https://*.ggpht.com https://*.mlstatic.com; frame-src https://*.mercadopago.com https://*.mercadolibre.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; frame-ancestors 'self'; base-uri 'self'; form-action 'self'. Idealmente con nonce via middleware. Anadir `poweredByHeader: false`.

#### INFRA-015 — La suite e2e no puede pasar: .env.e2e nunca se carga y las cuentas que usa no existen en el seed

- **Severidad:** 🟡 medium · **Categoría:** tests · **Estado:** nuevo · **Verificación:** sin verificar (reportada por 1 auditor)
- **Ubicación:** `playwright.config.ts:14` · relacionados: `__tests__/e2e/helpers/auth.ts`, `__tests__/e2e/helpers/seed.ts`, `.env.e2e.example`, `prisma/seed.ts`
- **Problema:** .env.e2e.example indica 'Copiar a .env.e2e', pero playwright.config.ts no importa dotenv ni carga ese archivo (Playwright no lee .env por si solo), asi que E2E_BASE_URL y E2E_*_PASSWORD definidos ahi se ignoran. Los helpers caen a contrasenas por defecto hardcodeadas que no coinciden con SEED_*_PASSWORD, y usan emails (empresa@test.com, reclutador@test.com, especialista@test.com, candidato@test.com) que no existen en prisma/seed.ts ni en ningun script. El helper menciona scripts/seed-e2e.ts, que no existe.
- **Evidencia:**

```ts
playwright.config.ts:13-15
  use: {
    baseURL: process.env.E2E_BASE_URL || 'http://localhost:3000',
__tests__/e2e/helpers/auth.ts:26-29
  company: {
    email: 'empresa@test.com',
    password: process.env.E2E_COMPANY_PASSWORD || '<REDACTADO>',
  },
__tests__/e2e/helpers/seed.ts:15-16
 * Usar el script existente: npx tsx prisma/seed.ts
 * O crear: npx tsx scripts/seed-e2e.ts ...
```

- **Escenario de fallo:** Un dev sigue las instrucciones: copia .env.e2e, corre el seed y `npm run test:e2e`. Los 7 tests de recruitment-flow.spec.ts y el login de auth-flows.spec.ts fallan por timeout en waitForURL porque empresa@test.com no existe y la contrasena del admin no es la del seed.
- **Arreglo propuesto:** En playwright.config.ts: `import dotenv from 'dotenv'; dotenv.config({ path: '.env.e2e' });`. Crear scripts/seed-e2e.ts que haga upsert de las 5 cuentas con las contrasenas de E2E_*_PASSWORD (o cambiar TEST_ACCOUNTS a los emails del seed), eliminar los fallbacks de contrasena hardcodeados (fallar con mensaje claro si falta la variable) y documentarlo en docs/GUIA_TESTING.md.

#### INFRA-016 — La documentacion de instalacion no permite ejecutar el seed: usa ADMIN_PASSWORD (obsoleta), no menciona las SEED_* y manda copiar a .env.local, que Prisma CLI no lee

- **Severidad:** 🟡 medium · **Categoría:** docs · **Estado:** nuevo · **Verificación:** sin verificar (reportada por 2 auditores)
- **Ubicación:** `README.md:149` · relacionados: `docs/INSTALLATION.md`, `docs/ENVIRONMENT_VARIABLES.md`, `docs/env.example`, `.env.example`, `prisma/seed.ts`
- **Problema:** El seed exige 8 variables SEED_*_PASSWORD y hace process.exit(1) si falta alguna. README, docs/INSTALLATION.md, docs/ENVIRONMENT_VARIABLES.md y docs/env.example solo documentan ADMIN_EMAIL/ADMIN_PASSWORD (que el seed ya no lee) y ninguna menciona SEED_*. README indica 'cp .env.example .env.local' seguido de 'npx prisma db push' y 'npx prisma db seed'; Prisma CLI solo carga .env (el propio .env.example dice 'cp .env.example .env'). docs/env.example ademas propone el puerto 5432 para DATABASE_URL mientras .env.example usa el pooler 6543 con pgbouncer=true.
- **Evidencia:**

```ts
# Configurar variables de entorno
cp .env.example .env.local

# Configurar base de datos
npx prisma generate
npx prisma db push
npx prisma db seed
// prisma/seed.ts:35-40
  if (missing.length > 0) {
    console.error('❌ ERROR: Faltan variables de entorno requeridas para el seed:\n');
    ...
    process.exit(1);
```

- **Escenario de fallo:** Un desarrollador nuevo sigue el README: 'npx prisma db push' falla con 'Environment variable not found: DATABASE_URL' porque sus variables estan en .env.local. Si sigue docs/INSTALLATION.md (que usa .env con ADMIN_PASSWORD), el seed aborta con 'Faltan variables de entorno requeridas' listando 8 variables que ninguna guia explica.
- **Arreglo propuesto:** Unificar en README e INSTALLATION: 'cp .env.example .env' (o documentar dotenv-cli para .env.local), reemplazar ADMIN_PASSWORD por la lista SEED_*, eliminar docs/env.example (duplicado desactualizado de .env.example) y enlazar a una sola fuente de verdad de variables.
- **Otros auditores añaden:** Unificar en los tres documentos: `cp .env.example .env` (Next tambien lee .env), o documentar `npx dotenv -e .env.local -- prisma ...`. Revisar igualmente docs/DOCUMENTATION_INDEX.md:237 y docs/ENVIRONMENT_VARIABLES.md:19-25.

#### INFRA-017 — Los docs usan nombres de variables y scripts que el codigo no reconoce (MERCADOPAGO_PUBLIC_KEY, ADMIN_PASSWORD, npm run seed)

- **Severidad:** 🟡 medium · **Categoría:** docs · **Estado:** nuevo · **Verificación:** sin verificar (reportada por 1 auditor)
- **Ubicación:** `README.md:197` · relacionados: `docs/GUIA_SISTEMA_COMPLETA.md`, `docs/ENVIRONMENT_VARIABLES.md`, `docs/env.example`, `package.json`, `src/app/credits/purchase/page.tsx`
- **Problema:** El codigo lee NEXT_PUBLIC_MERCADOPAGO_PUBLIC_KEY (purchase/page.tsx:182) y el seed exige SEED_ADMIN_PASSWORD y otras 7 SEED_*; README y GUIA_SISTEMA_COMPLETA documentan MERCADOPAGO_PUBLIC_KEY y ADMIN_PASSWORD, omiten MERCADOPAGO_WEBHOOK_SECRET, SMTP_*, NEXT_PUBLIC_GOOGLE_MAPS_API_KEY y SEED_*. GUIA_SISTEMA_COMPLETA ordena `npm run seed`, script que no existe en package.json. docs/env.example es una segunda plantilla divergente de .env.example (sin MercadoPago, Maps ni SEED_*).
- **Evidencia:**

```ts
README.md:195-201
# MercadoPago
MERCADOPAGO_ACCESS_TOKEN="TEST-..."
MERCADOPAGO_PUBLIC_KEY="TEST-..."
# Admin
ADMIN_EMAIL="admin@inakat.com"
ADMIN_PASSWORD="<REDACTADO>"
src/app/credits/purchase/page.tsx:182
      const publicKey = process.env.NEXT_PUBLIC_MERCADOPAGO_PUBLIC_KEY;
docs/GUIA_SISTEMA_COMPLETA.md:435  npm run seed
package.json:5-21 (scripts: no existe 'seed')
```

- **Escenario de fallo:** Quien configura un entorno con el README define MERCADOPAGO_PUBLIC_KEY: la variable no lleva prefijo NEXT_PUBLIC_, no llega al navegador y el checkout muestra 'Error de configuracion. Por favor contacta al administrador.' `npm run seed` responde 'Missing script: seed'. Definir ADMIN_PASSWORD no tiene ningun efecto y el seed aborta.
- **Arreglo propuesto:** Hacer de .env.example la unica fuente: borrar docs/env.example, regenerar las secciones de variables de README.md, docs/GUIA_SISTEMA_COMPLETA.md:443-460 y docs/ENVIRONMENT_VARIABLES.md a partir de ella, y anadir el script `"seed": "prisma db seed"` o corregir el doc a `npx prisma db seed`.

## ⚪ low (17)

#### INFRA-018 — Los tests de company-requests y dashboard no ejecutan las rutas: prueban el mock de prisma

- **Severidad:** ⚪ low · **Categoría:** tests · **Estado:** nuevo · **Verificación:** sin verificar (reportada por 1 auditor)
- **Ubicación:** `__tests__/api/company-requests.test.ts:257` · relacionados: `__tests__/api/company-dashboard-filter.test.ts`, `__tests__/api/company-interviews-jsonparse.test.ts`
- **Problema:** De los tests del modulo solo company-interviews-jsonparse importa un handler real. company-requests.test.ts y company-dashboard-filter.test.ts llaman directamente a los jest.fn() de prisma y afirman sobre lo que ellos mismos mockearon. Por eso 'deberia aceptar solicitud sin sitioWeb' pasa en verde mientras la ruta real responde 400, y ningun test detecta que la respuesta sigue incluyendo `notes`.
- **Evidencia:**

```ts
    it('debería aceptar solicitud sin sitioWeb', async () => {
...
      mockPrismaCompanyRequest.create.mockResolvedValue(newRequest);

      const request = await mockPrismaCompanyRequest.create({
        data: {
...
          sitioWeb: null,
```

- **Escenario de fallo:** Se cambia companyRequestSchema o la forma de la respuesta del dashboard; los 1355 tests siguen pasando y CI queda verde con el registro de empresas roto en produccion.
- **Arreglo propuesto:** Reescribir estos tests importando `POST`/`GET` de las rutas (como hace company-interviews-jsonparse.test.ts), construyendo un Request con el payload exacto del formulario y afirmando status y cuerpo. Anadir casos: sitioWeb null/''/'www.x.com', identificacionUrl 'javascript:...', y ausencia de claves `notes`/`notas`/`adminNotes` en respuestas de /api/company/*.

#### INFRA-019 — Las suites de credit-packages y pricing no ejecutan codigo de produccion (solo llaman a sus propios mocks) e incluyen asserts tautologicos

- **Severidad:** ⚪ low · **Categoría:** tests · **Estado:** nuevo · **Verificación:** sin verificar (reportada por 2 auditores)
- **Ubicación:** `__tests__/api/credit-packages.test.ts:549` · relacionados: `__tests__/api/pricing.test.ts`, `__tests__/api/pricing-delete.test.ts`, `src/middleware.ts`
- **Problema:** credit-packages.test.ts, pricing.test.ts y pricing-delete.test.ts no importan ningun handler de src/app/api (comprobado con grep: sin import/require/await GET|POST|PUT|DELETE; solo jest.mock de prisma). Los tests invocan mockPrisma.findMany() y comprueban lo que el propio mock devuelve. El bloque 'Seguridad' afirma que ?activeOnly=true es publico con un assert que siempre es true, justo lo que el middleware impide en la realidad. Inflan el total de tests en verde sin cubrir nada de este modulo.
- **Evidencia:**

```ts
    it('debería permitir acceso público a GET con ?activeOnly=true', () => {
      // Este endpoint es público para la página de compra
      const isPublicAccess = true;
      const activeOnlyParam = 'true';

      expect(isPublicAccess && activeOnlyParam === 'true').toBe(true);
    });
```

- **Escenario de fallo:** Se puede borrar toda la validacion de precio/creditos de los routes, o romper el acceso de la pagina de compra, y estas suites siguen en verde; CI no detecta ninguna regresion en precios ni paquetes.
- **Arreglo propuesto:** Reescribir las suites siguiendo el patron de __tests__/api/vendors.test.ts: importar GET/POST/PUT/DELETE de los routes, mockear requireRole y prisma, y afirmar status y body (400 con credits<=0, 409 en DELETE con vacantes, recalculo de pricePerCredit). Agregar un test del middleware para /api/admin/credit-packages?activeOnly=true con role=company.
- **Otros auditores añaden:** Sustituirlos por tests que importen `middleware` de src/middleware.ts con un NextRequest y cookie JWT de rol company/admin contra la ruta de paquetes, y tests de handler que mockeen requireRole devolviendo 401/403.

#### INFRA-020 — `npm run test:integration` borra y crea registros en la base que indique .env, sin comprobar que no sea produccion

- **Severidad:** ⚪ low · **Categoría:** tests · **Estado:** nuevo · **Verificación:** sin verificar (reportada por 1 auditor)
- **Ubicación:** `__tests__/api/multiple-education.test.ts:49` · relacionados: `package.json`, `jest.config.js`
- **Problema:** next/jest carga automaticamente .env/.env.local, por lo que el test de integracion usa el DATABASE_URL real del desarrollador. El gate solo mira RUN_INTEGRATION_TESTS o el nombre del script; no hay verificacion de host/entorno. El historial del proyecto indica que produccion se ha operado desde maquinas locales (db push, SQL manual).
- **Evidencia:**

```ts
__tests__/api/multiple-education.test.ts:47-54
  beforeAll(async () => {
    // Limpiar datos de prueba previos
    await prisma.candidate.deleteMany({
      where: { email: { contains: 'test-edu-multiple' } }
    });
    await prisma.user.deleteMany({
      where: { email: { contains: 'test-edu-multiple' } }
    });
package.json:16  "test:integration": "jest __tests__/api/multiple-education.test.ts",
```

- **Escenario de fallo:** Un dev con el .env apuntando a la base de produccion ejecuta `npm run test:integration` (el comando que recomienda docs/AUDITORIA-2026-06.md): se crean candidatos/usuarios de prueba en produccion y, si el test falla a mitad, quedan huerfanos visibles en el banco de candidatos del admin.
- **Arreglo propuesto:** Exigir una variable dedicada (TEST_DATABASE_URL) y abortar si no existe o si su host coincide con el de produccion; instanciar PrismaClient con `datasources: { db: { url: process.env.TEST_DATABASE_URL } }` en ese test; correrlo en CI contra un servicio postgres efimero.

#### INFRA-021 — El modulo de integracion Worky2 no tiene ni un test, y los 'tests' de notificaciones solo comparan cadenas del codigo fuente

- **Severidad:** ⚪ low · **Categoría:** tests · **Estado:** nuevo · **Verificación:** sin verificar (reportada por 1 auditor)
- **Ubicación:** `__tests__/api/notifications.test.ts:72` · relacionados: `src/lib/integration-auth.ts`, `src/lib/integration-candidate.ts`, `src/lib/worky2-webhook.ts`, `src/app/api/notifications/route.ts`
- **Problema:** grep en __tests__ de 'worky2|integration-auth|integration-candidate|requireApiKey|signWebhookPayload' no devuelve nada: la autenticacion por API key, el filtrado por empresa, el mapper de PII y la firma HMAC (todo codigo de seguridad anadido tras la auditoria) estan sin cobertura. El test de notificaciones lee los .ts con `fs.readFileSync` y hace `toContain('export async function ...')`; no ejecuta ningun handler, por lo que no verifica ownership (`userId: auth.user.id`) ni los casos de error.
- **Evidencia:**

```ts
it('should export createNotification, notifyAllAdmins, getUnreadCount', () => {
  const content = readFile('src/lib/notifications.ts');
  expect(content).toContain('export async function createNotification');
  expect(content).toContain('export async function notifyAllAdmins');
  expect(content).toContain('export async function getUnreadCount');
});
```

- **Escenario de fallo:** Alguien refactoriza PATCH /api/notifications y elimina `userId: auth.user.id` del where, o cambia `requireApiKey` y deja pasar keys revocadas: los 1355 tests siguen en verde y el CI bloqueante no lo detecta.
- **Arreglo propuesto:** Agregar tests de comportamiento con prisma mockeado: (1) requireApiKey: sin header, formato invalido, key revocada, dueno inactivo, key valida; (2) loadCandidatosAceptados filtra por job.userId y no incluye `notes`; (3) signWebhookPayload contra un vector HMAC conocido; (4) PATCH /api/notifications siempre incluye userId en el where y devuelve 400 con cuerpo invalido.

#### INFRA-022 — __tests__/api/profile.test.ts es tautologico: no importa el handler; ninguna ruta de perfil/experiencia/upload tiene test real

- **Severidad:** ⚪ low · **Categoría:** tests · **Estado:** nuevo · **Verificación:** sin verificar (reportada por 1 auditor)
- **Ubicación:** `__tests__/api/profile.test.ts:53`
- **Problema:** El unico import del archivo es bcryptjs; los tests llaman a los propios mocks y comprueban literales. No se importa src/app/api/profile/route.ts, ni experience, ni upload. Por eso bugs de contrato como el del CV roto, el 500 por añosExperiencia null o la educacion que reaparece pasan con '1355 tests verdes'.
- **Evidencia:**

```ts
51 mockPrismaUser.findUnique.mockResolvedValue(mockUser);
53 const user = await mockPrismaUser.findUnique({
54   where: { id: 1 },
55   include: { candidate: true }
56 });
58 expect(user).not.toBeNull();
...
183 expect(shortPassword.length >= 8).toBe(false);
```

- **Escenario de fallo:** Un desarrollador cambia el contrato de PUT /api/profile o rompe la validacion de contrasena: la suite sigue en verde porque ningun test ejecuta el handler.
- **Arreglo propuesto:** Reescribir importando GET/PUT/POST/DELETE reales con prisma y next/headers mockeados (patron de __tests__/api/profile-documents-xss.test.ts). Casos minimos: PUT con educacion [] limpia legacy; añosExperiencia null -> 400; password sin mayuscula -> 400; ownership en experience/[id]; upload con firma invalida -> 400; usuario inactivo -> 403.

#### INFRA-023 — __tests__/config/next-config.test.ts no importa next.config.ts: no protege ni remotePatterns ni las cabeceras de seguridad

- **Severidad:** ⚪ low · **Categoría:** tests · **Estado:** nuevo · **Verificación:** sin verificar (reportada por 1 auditor)
- **Ubicación:** `__tests__/config/next-config.test.ts:6` · relacionados: `next.config.ts`
- **Problema:** El test declara un array local con el hostname esperado y verifica que ese array local contiene el hostname. Nunca carga la configuracion real, asi que pasaria aunque next.config.ts permitiera cualquier dominio o perdiera todas las cabeceras anadidas en #86.
- **Evidencia:**

```ts
__tests__/config/next-config.test.ts:19-23
  it('should not allow arbitrary external domains', () => {
    // Solo Vercel Blob debe estar permitido
    const allowedHostnames = ['*.public.blob.vercel-storage.com'];
    expect(allowedHostnames).toHaveLength(1);
  });
```

- **Escenario de fallo:** Un PR cambia images.remotePatterns a hostname '**' o elimina el bloque headers() de next.config.ts: el test sigue verde y se pierde HSTS/X-Frame-Options en produccion sin que nada lo detecte.
- **Arreglo propuesto:** `import nextConfig from '../../next.config'` y afirmar sobre nextConfig.images.remotePatterns y sobre `await nextConfig.headers()` (que existan X-Frame-Options, nosniff, HSTS, Referrer-Policy, Permissions-Policy y, cuando se anada, CSP).

#### INFRA-024 — Sin tests de handler para PATCH de entrevistas, POST de asignaciones ni PUT/DELETE de especialidades; el test existente solo busca strings en el codigo fuente

- **Severidad:** ⚪ low · **Categoría:** tests · **Estado:** nuevo · **Verificación:** sin verificar (reportada por 1 auditor)
- **Ubicación:** `__tests__/qa/feb2026-regression.test.ts:24` · relacionados: `src/app/api/admin/interviews/[id]/route.ts`
- **Problema:** La unica cobertura del modulo de entrevistas admin lee el archivo de la ruta de LISTADO como texto y comprueba que contenga 'success: true'. Ningun test importa ni referencia src/app/api/admin/interviews/[id]/route.ts (grep en __tests__ sin resultados), motivo por el que el desajuste `{ interview }` vs `data.success` y el caso `null -> 1970` no se detectaron. Tampoco hay tests de handler para admin/assignments ni admin/specialties/[id].
- **Evidencia:**

```ts
describe('P1-09a: Admin interviews API returns correct format', () => {
  it('should return success field in response', () => {
    const content = readFile('src/app/api/admin/interviews/route.ts');
    expect(content).toContain('success: true');
  });
  ...
  it('frontend should check for success or interviews field', () => {
    const content = readFile('src/app/admin/interviews/page.tsx');
    expect(content).toMatch(/data\.(success|interviews)/);
```

- **Escenario de fallo:** Cualquier refactor puede volver a romper el contrato UI<->API de entrevistas con CI en verde, como ocurre hoy con la ruta [id].
- **Arreglo propuesto:** Anadir tests que importen los handlers con prisma y requireRole mockeados: PATCH confirm devuelve `success:true` + data; cancel con fechas null devuelve 200; rename con slug duplicado devuelve 409 sin tocar PricingMatrix; DELETE con candidatos en uso devuelve 409; POST assignments con usuario inactivo devuelve 400.

#### INFRA-025 — Los tests del Navbar son greps sobre el código fuente, no pruebas de comportamiento; hooks y shell público sin cobertura

- **Severidad:** ⚪ low · **Categoría:** tests · **Estado:** nuevo · **Verificación:** sin verificar (reportada por 1 auditor)
- **Ubicación:** `__tests__/qa/feb2026-regression.test.ts:263` · relacionados: `src/components/commons/Navbar.tsx`
- **Problema:** La única cobertura del Navbar lee Navbar.tsx como texto y comprueba que ciertas cadenas ('/admin/assignments', etc.) aparezcan tras 'mobileMenuOpen && ('. No se renderiza el componente ni se verifica qué ve cada rol, ni logout, ni getInitials, ni cierre de menús; por eso defectos como la ausencia de enlace vendor en móvil o "AUNDEFINED" pasan con la suite en verde. useInView, useCountUp, Footer, sitemap y las páginas legales no tienen ningún test. Además estos greps se romperán en cuanto el menú se refactorice a una estructura de datos.
- **Evidencia:**

```ts
describe('P2-ed9: Navbar mobile menu has admin links', () => {
  const navbar = readFile('src/components/commons/Navbar.tsx');
  const mobileSection = navbar.slice(navbar.indexOf('mobileMenuOpen && ('));

  it('mobile menu should have Vacantes link for admin', () => {
    expect(mobileSection).toContain('/admin"');
  });
```

- **Escenario de fallo:** Un desarrollador elimina por error el bloque de enlaces de company del drawer móvil o rompe getInitials: npm test sigue en verde porque solo se buscan cadenas de admin; el fallo llega a producción.
- **Arreglo propuesto:** Añadir tests con @testing-library/react (ya presente en el proyecto) que rendericen Navbar mockeando fetch('/api/auth/me') para cada rol (anon, admin, company, recruiter, specialist, candidate, user, vendor) y verifiquen enlaces en escritorio y móvil, getInitials con nombres con espacios, logout con respuesta OK/fallida y cierre por Escape/cambio de ruta. Sustituir los greps de código fuente por estas aserciones.

#### INFRA-026 — Version de Node sin fijar: CI en Node 20 (fin de vida desde abril de 2026), docs dicen 18+, y @vercel/blob exige >=20

- **Severidad:** ⚪ low · **Categoría:** config · **Estado:** nuevo · **Verificación:** sin verificar (reportada por 1 auditor)
- **Ubicación:** `.github/workflows/ci.yml:35` · relacionados: `package.json`, `README.md`, `docs/INSTALLATION.md`, `package-lock.json`
- **Problema:** package.json no declara `engines` y no hay .nvmrc. README.md:132 e INSTALLATION.md:13 piden 'Node.js 18+'/'v18.0.0', pero @vercel/blob 2.0.1 declara engines node >=20.0.0 (package-lock.json:3950-3952). El CI usa Node 20, que dejo de tener soporte el 2026-04-30; Vercel usara la version configurada en el proyecto (22/24), distinta de la del CI.
- **Evidencia:**

```ts
.github/workflows/ci.yml:33-36
        uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm
README.md:132  - Node.js 18+
package-lock.json:3950-3952  "engines": { "node": ">=20.0.0" }   (@vercel/blob)
```

- **Escenario de fallo:** Un dev con Node 18 sigue el README: npm avisa EBADENGINE y las subidas a Blob pueden fallar por APIs ausentes. Un fallo que solo se da en Node 22/24 (version de produccion) no aparece en un CI que corre en 20, y viceversa.
- **Arreglo propuesto:** Anadir `"engines": { "node": ">=22 <25" }` y un .nvmrc con la misma major que el proyecto de Vercel; en ci.yml usar `node-version-file: .nvmrc`; corregir README e INSTALLATION.

#### INFRA-027 — docs/API.md describe una API que no existe: auth por Bearer, `token` en la respuesta de login, rutas /api/companies y 'sin rate limiting'

- **Severidad:** ⚪ low · **Categoría:** docs · **Estado:** nuevo · **Verificación:** sin verificar (reportada por 1 auditor)
- **Ubicación:** `docs/API.md:13` · relacionados: `src/middleware.ts`, `src/app/api/auth/login/route.ts`, `src/lib/rate-limit.ts`
- **Problema:** El middleware solo lee la cookie httpOnly 'auth-token' (src/middleware.ts:34) y el login no devuelve el token en el cuerpo (login/route.ts:49-56). Las rutas reales son /api/company-requests y /api/company-requests/[id] con body {status}, no /api/companies ni {action}. La API si tiene rate limiting (src/lib/rate-limit.ts). Solo el puente /api/integration/* acepta Authorization: Bearer.
- **Evidencia:**

````ts
docs/API.md:15-18
```http
Authorization: Bearer <token>
Content-Type: application/json
```
:50    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
:462   #### POST /api/companies
:694   Actualmente no hay rate limiting implementado.
src/middleware.ts:34
  const token = request.cookies.get('auth-token')?.value;
````

- **Escenario de fallo:** Un integrador (p. ej. el equipo de Worky2) sigue API.md: hace login, busca `token` en la respuesta (no existe), envia Authorization: Bearer a /api/applications y recibe 401 'No autenticado'; o hace POST /api/companies y obtiene 404.
- **Arreglo propuesto:** Regenerar API.md desde las rutas reales (65 route.ts): documentar la cookie auth-token, los limites de rate-limit por endpoint, los codigos 401/403/429, las rutas por rol y enlazar docs/WORKY2_INTEGRATION.md como la unica superficie con Bearer/X-Api-Key. Quitar las credenciales de los ejemplos.

#### INFRA-028 — docs/SECURITY.md declara controles que el codigo no tiene (URLs firmadas, sin acceso publico, CORS, X-Frame-Options DENY, 'ninguna vulnerabilidad conocida')

- **Severidad:** ⚪ low · **Categoría:** docs · **Estado:** nuevo · **Verificación:** sin verificar (reportada por 1 auditor)
- **Ubicación:** `docs/SECURITY.md:66` · relacionados: `src/app/api/upload/route.ts`, `next.config.ts`, `docs/AUDITORIA-2026-06.md`
- **Problema:** La politica publica afirma 'URLs firmadas con expiracion / No acceso publico directo' cuando upload/route.ts:141-143 sube con access:'public' (pendiente #56); dice que el rate limiting esta 'planificado' cuando existe; afirma 'CORS configurado para dominios especificos' sin que exista configuracion CORS; muestra X-Frame-Options DENY y geolocation=() frente a SAMEORIGIN y geolocation=(self) reales; y 'Ninguna vulnerabilidad conocida actualmente' frente a las 10 acciones pendientes de docs/AUDITORIA-2026-06.md. Tambien recomienda la libreria jose, que no esta instalada.
- **Evidencia:**

```ts
docs/SECURITY.md:66-69
**✅ Almacenamiento Seguro**
- Vercel Blob Storage
- URLs firmadas con expiración
- No acceso público directo
src/app/api/upload/route.ts:141-143
      const blob = await put(uniqueFileName, file, {
        access: 'public'
      });
```

- **Escenario de fallo:** En una revision de cumplimiento (LFPDPPP) o una due diligence de un cliente, INAKAT entrega SECURITY.md afirmando que los CV no son accesibles publicamente; cualquiera con la URL del blob descarga el CV sin autenticarse. La declaracion falsa agrava la responsabilidad frente al riesgo tecnico ya conocido.
- **Arreglo propuesto:** Reescribir SECURITY.md con el estado real (cabeceras de next.config.ts, rate-limit en memoria, blobs publicos como riesgo aceptado/pendiente) y enlazar la lista de pendientes de AUDITORIA-2026-06.md en 'Vulnerabilidades conocidas'.

#### INFRA-029 — docs/WORKY2_INTEGRATION.md sigue indicando `prisma db push` aunque ya existe la migracion; choca con el baseline pendiente (#1)

- **Severidad:** ⚪ low · **Categoría:** docs · **Estado:** pendiente conocido de junio · **Verificación:** sin verificar (reportada por 1 auditor)
- **Ubicación:** `docs/WORKY2_INTEGRATION.md:7` · relacionados: `prisma/migrations/20260713000000_add_worky2_integration_tables/migration.sql`, `docs/AUDITORIA-2026-06.md`
- **Problema:** La nota de merge afirma que las tablas 'no existen aun' y que el dueno debe correr `npx prisma db push`, pero el repo ya contiene prisma/migrations/20260713000000_add_worky2_integration_tables/migration.sql (coincide con el schema). Como el historial de migraciones sigue desincronizado (accion manual pendiente #8/#1: ~15 tablas sin migracion, prod con db push), `prisma migrate deploy` fallaria en produccion antes de llegar a esta migracion, y seguir usando `db push` deja esta migracion como otra mas 'no aplicada' formalmente. La doc no aclara cual de los dos caminos es el vigente ni como verificar que las tablas existen antes de habilitar la integracion.
- **Evidencia:**

```ts
> **Nota para el merge:** los modelos `IntegrationApiKey` e
> `IntegrationWebhook` ya están en `prisma/schema.prisma`, pero las tablas no
> existen aún en la base. **El dueño del repo corre `npx prisma db push` (o la
> migración equivalente) al mergear este branch.** Hasta entonces, las rutas
> `/api/integration/*` fallarán con error de tabla inexistente.
```

- **Escenario de fallo:** Se despliega a produccion sin que nadie ejecute el paso manual: la primera empresa que intente crear una API key recibe 500 'Error al crear la API key' (P2021 tabla inexistente) y `dispatchCandidateAccepted` falla en silencio en cada aceptacion.
- **Arreglo propuesto:** Actualizar la nota: referenciar la migracion 20260713000000, indicar el comando exacto segun el estado del baseline (`prisma migrate resolve --applied` de las previas + `migrate deploy`, o `db push` mientras #1 siga pendiente) y anadir una verificacion post-deploy (p.ej. `SELECT to_regclass('"IntegrationApiKey"')`). Incluir esta migracion en el plan del baseline #1.

#### INFRA-030 — ESLint nunca falla por warnings: any, variables sin usar y exhaustive-deps pasan el CI; `next lint` esta deprecado

- **Severidad:** ⚪ low · **Categoría:** config · **Estado:** nuevo · **Verificación:** sin verificar (reportada por 1 auditor)
- **Ubicación:** `eslint.config.mjs:24` · relacionados: `package.json`, `.github/workflows/ci.yml`, `src/app/credits/purchase/page.tsx`
- **Problema:** La Fase 3 degrado no-explicit-any y no-unused-vars a 'warn' y react-hooks/exhaustive-deps ya es 'warn' en next/core-web-vitals. `npm run lint` es `next lint` sin --max-warnings, asi que cualquier numero de warnings sale con codigo 0. Ademas `next lint` esta deprecado desde Next 15.5 y se elimina en Next 16, y eslint.config.mjs importa @eslint/eslintrc que no esta declarado en package.json (funciona solo por hoisting de npm).
- **Evidencia:**

```ts
eslint.config.mjs:24-32
    rules: {
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/no-unused-vars": [
        "warn",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
    },
package.json:9
    "lint": "next lint",
```

- **Escenario de fallo:** src/app/credits/purchase/page.tsx tiene efectos con dependencias incompletas (p. ej. :169-178 llama a initMercadoPago, que cierra sobre finalPrice, sin declararlo) y `(window as any)`/`useState<any>`: todo son warnings que el CI ignora. Un closure obsoleto nuevo en un formulario de pago entra a main con el lint 'en verde'. Al subir a Next 16, `npm run lint` deja de existir y el paso de CI falla.
- **Arreglo propuesto:** Cambiar el script a `eslint . --max-warnings=<N actual>` e ir bajando N (ratchet); subir react-hooks/exhaustive-deps a 'error' en src/app/credits/** y src/components/**; anadir @eslint/eslintrc a devDependencies; alinear eslint-config-next con la version de next.

#### INFRA-031 — Todos los tests de API corren en jsdom con un Request/Response falso cuyo `headers` es un Map sensible a mayusculas

- **Severidad:** ⚪ low · **Categoría:** tests · **Estado:** nuevo · **Verificación:** sin verificar (reportada por 1 auditor)
- **Ubicación:** `jest.setup.js:11` · relacionados: `jest.config.js`, `__tests__/smoke/api-endpoints.test.ts`
- **Problema:** jest.config.js fija testEnvironment jsdom para todo. Como jsdom no trae fetch API, jest.setup.js instala MockRequest/MockResponse: sin formData(), sin cookies, sin clone(), con `headers = new Map(...)` (get('X-Api-Key') !== get('x-api-key')) y json() que hace JSON.parse de un body que puede ser undefined. NextResponse acaba extendiendo esa clase falsa (por eso el smoke test tiene que parchear Response.json). Los tests de rutas no ejercitan la semantica real de Request/Headers.
- **Evidencia:**

```ts
jest.setup.js:11-21
class MockRequest {
  constructor(url, options = {}) {
    this.url = url
    this.method = options.method || 'GET'
    this.headers = new Map(Object.entries(options.headers || {}))
    this._body = options.body
  }
  async json() {
    return JSON.parse(this._body)
  }
```

- **Escenario de fallo:** No se puede escribir un test de /api/upload (request.formData no existe) ni de requireApiKey con el header tal como lo envia Worky2 ('X-Api-Key'): con el Map falso `headers.get('x-api-key')` devuelve undefined y el test falla o, peor, se adapta al mock y deja de reflejar produccion, donde Headers es case-insensitive.
- **Arreglo propuesto:** Separar proyectos en jest.config.js: `projects: [{ displayName:'api', testEnvironment:'node', testMatch:['<rootDir>/__tests__/{api,lib,smoke}/**'] }, { displayName:'ui', testEnvironment:'jsdom', ... }]` y eliminar MockRequest/MockResponse y el polyfill de Response.json (Node 20+ ya trae Request/Response/Headers/FormData reales).

#### INFRA-032 — images.remotePatterns admite CUALQUIER store de Vercel Blob y las URLs de logo/foto no se validan antes de pasarlas a next/image

- **Severidad:** ⚪ low · **Categoría:** config · **Estado:** nuevo · **Verificación:** sin verificar (reportada por 1 auditor)
- **Ubicación:** `next.config.ts:27` · relacionados: `src/components/shared/CompanyLogo.tsx`, `src/components/shared/CandidatePhoto.tsx`, `src/app/api/company/profile/route.ts`, `src/app/api/auth/register/route.ts`, `src/app/api/company-requests/route.ts`
- **Problema:** El comodin '*.public.blob.vercel-storage.com' cubre los stores de todos los clientes de Vercel, no solo el de INAKAT, de modo que /_next/image actua como optimizador abierto para imagenes alojadas por terceros. En sentido contrario, logoUrl y fotoUrl se guardan sin validar host (company/profile PUT, company-requests POST, register, profile) y se renderizan con <Image src={...}> en CompanyLogo/CandidatePhoto.
- **Evidencia:**

```ts
next.config.ts:24-29
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '*.public.blob.vercel-storage.com',
      },
    ],
src/app/api/company/profile/route.ts:212-214
    if (body.logoUrl !== undefined) {
      updateData.logoUrl = body.logoUrl;
    }
```

- **Escenario de fallo:** (a) Un tercero sube imagenes pesadas a su propio store de Blob y enlaza https://inakat.com/_next/image?url=https://<su-store>.public.blob.vercel-storage.com/x.png&w=3840&q=100 en bucle: consume la cuota de optimizacion de imagenes de la cuenta Vercel de INAKAT. (b) Una empresa hace PUT /api/company/profile con logoUrl 'https://otro-dominio/x.png': en produccion /_next/image responde 400 y el listado publico /talents muestra el logo roto; en `next dev` next/image lanza 'hostname is not configured' y tumba la pagina para todos.
- **Arreglo propuesto:** Fijar el hostname exacto del store (`<storeId>.public.blob.vercel-storage.com`, configurable por env), y validar en las 4 rutas que logoUrl/fotoUrl sean null o una URL https cuyo host sea ese store (o una ruta /uploads/ en desarrollo); en CompanyLogo/CandidatePhoto hacer fallback al icono con onError.

#### INFRA-033 — Playwright siempre levanta `npm run dev` en localhost aunque E2E_BASE_URL apunte a staging

- **Severidad:** ⚪ low · **Categoría:** tests · **Estado:** nuevo · **Verificación:** sin verificar (reportada por 1 auditor)
- **Ubicación:** `playwright.config.ts:30` · relacionados: `.env.e2e.example`
- **Problema:** baseURL es configurable pero webServer esta fijo a localhost:3000. Si se apunta la suite a staging, Playwright igualmente arranca (y espera hasta 120 s) un servidor local que necesita .env completo, y en CI (`reuseExistingServer: false`) falla si el puerto esta ocupado.
- **Evidencia:**

```ts
playwright.config.ts:30-35
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 120000,
  },
```

- **Escenario de fallo:** E2E_BASE_URL=https://staging... en un runner sin .env: `next dev` lanza al cargar src/lib/auth.ts por falta de JWT_SECRET o no conecta a la BD, el webServer no responde en 120 s y la suite aborta sin haber probado staging.
- **Arreglo propuesto:** `webServer: process.env.E2E_BASE_URL ? undefined : { command: 'npm run build && npm run start', url: 'http://localhost:3000', ... }` (mejor build+start que dev para que el e2e pruebe el artefacto real).

#### INFRA-034 — README y docs de estado desactualizados: 258 tests, 'Olvide mi contrasena en progreso', guia de MercadoPago vacia, CHANGELOG sin nada posterior a enero 2025

- **Severidad:** ⚪ low · **Categoría:** docs · **Estado:** nuevo · **Verificación:** sin verificar (reportada por 1 auditor)
- **Ubicación:** `README.md:5` · relacionados: `docs/GUIA-MERCADOPAGO.md`, `docs/CHANGELOG.md`, `docs/INSTALLATION.md`, `docs/USER_GUIDE.md`, `BUG_REPORT.md`, `docs/GUIA_SISTEMA_COMPLETA.md`
- **Problema:** README dice version de diciembre 2024, '258 tests' (la auditoria reporta 1355), 'Emails automaticos (SendGrid/Resend)' y 'Olvide mi contrasena' como 'En progreso' (ambos existen con nodemailer), no menciona vendor, integracion Worky2, notificaciones ni entrevistas, y enlaza docs/GUIA-MERCADOPAGO.md, que es un archivo de 0 bytes. docs/CHANGELOG.md y docs/INSTALLATION.md hablan de Next.js 14 / React 18 / jose; docs/GUIA_SISTEMA_COMPLETA.md:43 de Prisma 5.22; docs/USER_GUIDE.md:86 dice que no hay panel de candidatos. BUG_REPORT.md:88 describe un fallback de subidas en /tmp/uploads con ruta /api/uploads/[filename] que no existe (el codigo usa public/uploads).
- **Evidencia:**

```ts
README.md:5-8
> **Versión:** 1.0.0 MVP
> **Última actualización:** 14 de Diciembre 2024
> **Tests:** 258 pasando ✅
README.md:258-261
### 🚧 En Progreso
- Emails automáticos (SendGrid/Resend)
- "Olvidé mi contraseña"
README.md:292  - 💳 [Guía MercadoPago](./docs/GUIA-MERCADOPAGO.md)   (archivo vacio)
```

- **Escenario de fallo:** Quien deba configurar los cobros abre la guia de MercadoPago enlazada y encuentra un archivo vacio, por lo que no sabe que debe registrar el webhook ni su secreto. Un desarrollador nuevo descarta funcionalidades que si existen o busca librerias (jose, SendGrid) que no se usan.
- **Arreglo propuesto:** Actualizar README (estado real, conteo de tests generado por script, roles y modulos actuales), escribir GUIA-MERCADOPAGO.md (credenciales, NEXT_PUBLIC key, URL y secreto del webhook, tarjetas de prueba) o quitar el enlace, anadir al CHANGELOG las fases de la auditoria y el puente Worky2, y archivar BUG_REPORT.md, MIGRATION_GUIDE.md e INSTALACION-SISTEMA-APLICACIONES.md en docs/archive/.
