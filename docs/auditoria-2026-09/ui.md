# Shell público, navegación, legales y SEO

[← volver al índice](../AUDITORIA-2026-09.md) · 29 hallazgos — 🟠 1 high · 🟡 6 medium · ⚪ 22 low

## 🟠 high (1)

#### UI-001 — Términos y Condiciones y Política de Privacidad son placeholders "en construcción" mientras los formularios declaran que el usuario los acepta

- **Severidad:** 🟠 high · **Categoría:** copy · **Estado:** nuevo · **Verificación:** ✅ verificada contra el código
- **Ubicación:** `src/app/terms/page.tsx:16` · relacionados: `src/app/privacy/page.tsx`, `src/app/contact/page.tsx`, `src/components/sections/companies/FormRegisterForQuotationSection.tsx`, `src/app/register/page.tsx`, `src/app/sitemap.ts`
- **Problema:** La página /terms solo dice que está en construcción y /privacy dice que "detallará próximamente" el tratamiento de datos. Aun así, el formulario de contacto y el de registro de empresas afirman en texto plano (sin enlace) que al enviar "aceptas términos y condiciones" y "política de privacidad"; el registro de candidato (que recaba CV, teléfono, fecha de nacimiento, etc.) no muestra ningún aviso ni casilla de consentimiento. La plataforma recaba PII y cobra créditos con MercadoPago sin aviso de privacidad integral (LFPDPPP arts. 15-17) ni condiciones de compra/reembolso. Además /privacy promete que los documentos "se manejan con estrictos protocolos de seguridad", lo que contradice el pendiente #56 de la auditoría de junio (CV en URLs públicas permanentes). Ambas páginas placeholder están en el sitemap con fecha "Última actualización: Febrero 2026".
- **Comprobación:** Confirmado: el texto es "Esta página está en construcción".
- **Evidencia:**

```ts
// src/app/terms/page.tsx:15-17
<p>
  Esta página está en construcción. Los términos y condiciones completos de INAKAT estarán disponibles próximamente.
</p>
// src/app/privacy/page.tsx:16
... Esta página detallará próximamente cómo recopilamos, usamos y protegemos tu información personal.
// src/app/contact/page.tsx:299-302
*Al dar click en el botón, aceptas nuestros términos y condiciones y política de privacidad.
// FormRegisterForQuotationSection.tsx:991
*Al dar click, aceptas términos y condiciones.
```

- **Escenario de fallo:** Un candidato se registra en /register subiendo su CV y datos personales: nunca se le pone a disposición un aviso de privacidad. Una empresa envía el formulario de /companies "aceptando" unos términos que no existen y luego compra créditos sin condiciones de reembolso publicadas. Ante una queja ante INAI/PROFECO o un contracargo, INAKAT no puede acreditar consentimiento informado ni condiciones de venta; el consentimiento declarado es nulo.
- **Arreglo propuesto:** 1) Redactar (con validación legal del negocio; dejar constantes para razón social, domicilio y contacto ARCO) el Aviso de Privacidad integral: responsable, datos recabados (incl. CV/documentos/evaluaciones), finalidades primarias y secundarias, transferencias (empresas cliente, reclutadores/especialistas, MercadoPago, Vercel Blob), derechos ARCO y revocación, cookies, cambios. 2) Redactar T&C: cuentas por rol, créditos/precios/vigencia/reembolsos, conducta, propiedad intelectual, limitación de responsabilidad, jurisdicción. 3) En contact/page.tsx:299 y FormRegisterForQuotationSection.tsx:990 convertir el texto en enlaces <Link href="/terms"> y <Link href="/privacy">; en /register añadir casilla obligatoria de consentimiento con ambos enlaces y persistir fecha/versión aceptada. 4) Mientras no haya texto real, exportar metadata robots {index:false} en ambas páginas y quitarlas de sitemap.ts. 5) No afirmar "estrictos protocolos de seguridad" hasta resolver #56.

## 🟡 medium (6)

#### UI-002 — Ninguna página define metadata propia: las 7 URLs del sitemap comparten exactamente el mismo <title> y description

- **Severidad:** 🟡 medium · **Categoría:** config · **Estado:** nuevo · **Verificación:** sin verificar (reportada por 1 auditor)
- **Ubicación:** `src/app/layout.tsx:18` · relacionados: `src/app/about/page.tsx`, `src/app/privacy/page.tsx`, `src/app/terms/page.tsx`, `src/app/sitemap.ts`
- **Problema:** El único export de metadata de todo src/ es el del root layout (grep de "export const metadata|generateMetadata" devuelve solo layout.tsx:18) y no usa title.template. /about, /privacy y /terms son server components que podrían exportar metadata y no lo hacen; /companies y /talents también son server components sin metadata; /contact, /login, /register son 'use client' y necesitarían un layout.tsx de segmento. Resultado: todas las páginas públicas se indexan con el título "INAKAT - Talento Evaluado por Expertos Reales" y la misma descripción orientada a empresas, incluso /talents (candidatos), /privacy y /terms.
- **Evidencia:**

```ts
export const metadata: Metadata = {
  title: "INAKAT - Talento Evaluado por Expertos Reales",
  description:
    "Contrata talento calificado con evaluación dual: psicólogos expertos + especialistas técnicos. IA como apoyo, personas que deciden. Presencia en toda la República Mexicana.",
  openGraph: {
    title: "INAKAT - Talento Evaluado por Expertos Reales",
    ...
    type: "website",
    locale: "es_MX",
  },
};
```

- **Escenario de fallo:** Google rastrea las 7 URLs de sitemap.xml y encuentra títulos y descripciones duplicados: Search Console las marca como duplicadas, la página de vacantes /talents aparece en resultados con el copy "Contrata talento calificado..." dirigido a empresas, y las pestañas del navegador/historial del usuario son indistinguibles entre secciones y paneles.
- **Arreglo propuesto:** En layout.tsx usar title: { default: 'INAKAT - Talento Evaluado por Expertos Reales', template: '%s | INAKAT' }. Exportar metadata (title, description, alternates.canonical, openGraph) en about/page.tsx, privacy/page.tsx, terms/page.tsx, companies/page.tsx y talents/page.tsx. Para páginas 'use client' (contact, login, register, forgot-password, reset-password, unauthorized y paneles) crear layout.tsx por segmento con metadata y robots: { index: false } en las privadas/de auth.

#### UI-003 — No existe error boundary raíz (src/app/error.tsx ni global-error.tsx); solo /admin tiene error.tsx

- **Severidad:** 🟡 medium · **Categoría:** reliability · **Estado:** nuevo · **Verificación:** sin verificar (reportada por 1 auditor)
- **Ubicación:** `src/app/layout.tsx:36` · relacionados: `src/app/admin/error.tsx`, `src/components/commons/Navbar.tsx`
- **Problema:** En src/app solo hay admin/error.tsx. Cualquier excepción de render en páginas públicas o en los paneles de company/recruiter/specialist/candidate/vendor (todas 'use client' y dependientes de datos de API) termina en la pantalla genérica de Next "Application error: a client-side exception has occurred", en inglés, sin Navbar ni forma de volver. Además, Navbar se renderiza dentro del root layout: un error ahí (ver hallazgo de getInitials) solo lo puede capturar global-error.tsx, que tampoco existe.
- **Evidencia:**

```ts
// Glob src/app/**/{error,global-error}.* -> solo:
src/app/admin/error.tsx
// src/app/layout.tsx:36-43
<html lang="es" className={`${outfit.variable} ${dmSans.variable}`}>
  <body className="font-body antialiased pt-14">
    <Navbar />
    {children}
  </body>
</html>
```

- **Escenario de fallo:** Una respuesta inesperada de API hace que un dashboard acceda a una propiedad de undefined durante el render (o Navbar lanza por un nombre mal formado): el usuario ve una página blanca con un mensaje en inglés, sin botón de reintento ni enlace al inicio, y debe recargar o borrar cookies.
- **Arreglo propuesto:** Crear src/app/error.tsx ('use client', props error/reset, mensaje en español con estilo de marca, botón Reintentar y enlace a '/', console.error del digest) y src/app/global-error.tsx (debe incluir sus propios <html> y <body>) para cubrir fallos del root layout/Navbar. Reutilizar el patrón de src/app/admin/error.tsx.

#### UI-004 — Estado de sesión obsoleto en Navbar: créditos y nombre no se refrescan si la ruta no cambia

- **Severidad:** 🟡 medium · **Categoría:** frontend-bug · **Estado:** nuevo · **Verificación:** sin verificar (reportada por 2 auditores)
- **Ubicación:** `src/components/commons/Navbar.tsx:61` · relacionados: `src/app/company/dashboard/page.tsx`, `src/app/profile/page.tsx`
- **Problema:** Navbar solo vuelve a consultar /api/auth/me cuando cambia pathname. No existe ningún mecanismo (evento, contexto, SWR) para que otras pantallas le avisen de cambios. En /company/dashboard, publicar un borrador descuenta créditos y la página refresca su propio contador con fetchDashboardData(), pero el dropdown del Navbar sigue mostrando el saldo anterior: dos saldos distintos en la misma pantalla. Lo mismo pasa al cambiar el nombre en /profile (el avatar y el nombre del dropdown no cambian hasta navegar).
- **Evidencia:**

```ts
// Navbar.tsx:29-61
useEffect(() => {
  const checkAuth = async () => { ... fetch('/api/auth/me' ...) ... };
  checkAuth();
}, [pathname]);
// src/app/company/dashboard/page.tsx:171-173
if (response.ok && result.success) {
  setNotification({ type: 'success', message: `¡Vacante publicada! Se descontaron ${result.creditCost} créditos.` });
  fetchDashboardData();
```

- **Escenario de fallo:** Empresa con 10 créditos publica un borrador de 3 créditos desde /company/dashboard: la barra del dashboard muestra "7 créditos" pero al abrir el menú del avatar sigue viendo "10 créditos" hasta que navega a otra ruta. El usuario cree que no se le cobró o que hay un error de saldo y abre un ticket.
- **Arreglo propuesto:** Extraer la sesión a un AuthProvider/contexto (o hook useAuth con SWR) que exponga refresh(); en Navbar suscribirse también a un CustomEvent global (p. ej. window.addEventListener('inakat:auth-refresh', checkAuth)) y dispararlo tras publicar/pausar vacantes, comprar créditos y guardar el perfil. Revalidar además en visibilitychange/focus para cubrir sesión expirada con la pestaña abierta.
- **Otros auditores añaden:** Crear un AuthProvider (contexto) que resuelva la sesion una sola vez (idealmente leyendo la cookie en un server component del layout y pasando el usuario inicial) y exponga useAuth(); refrescar solo tras login/logout o al recuperar foco. Hacer que /api/auth/me responda 200 { user: null } a anonimos para no ensuciar la consola.

#### UI-005 — getInitials muestra "AUNDEFINED" con nombres con espacios sobrantes y lanza TypeError (tumba toda la app) con nombre de solo espacios

- **Severidad:** 🟡 medium · **Categoría:** frontend-bug · **Estado:** nuevo · **Verificación:** sin verificar (reportada por 1 auditor)
- **Ubicación:** `src/components/commons/Navbar.tsx:147` · relacionados: `src/app/api/profile/route.ts`, `src/app/api/auth/register/route.ts`, `src/app/register/page.tsx`, `src/app/profile/page.tsx`
- **Problema:** getInitials parte user.nombre con split(' ') sin trim ni filtrar vacíos. Con "Ana " (espacio final, típico del autocompletado del teclado móvil) names = ['Ana',''] y names[1][0] es undefined -> el avatar pinta "AUNDEFINED"; con "Juan Carlos" (doble espacio) -> "JUNDEFINED"; con espacio inicial -> "UNDEFINEDA". Si nombre es " " (pasa z.string().min(2) del registro y PUT /api/profile no valida nada), undefined + undefined = NaN y NaN.toUpperCase() lanza TypeError durante el render. Como Navbar vive en el root layout y no existe global-error.tsx, el usuario ve la pantalla genérica de error de Next en TODAS las páginas (incluida /profile, donde podría corregirlo). Ni el registro (src/app/register/page.tsx:444 envía nombre sin trim; schema z.string().min(2)) ni PUT /api/profile (línea 224: updateUserData.nombre = nombre) normalizan el valor.
- **Evidencia:**

```ts
if (user.nombre) {
  const names = user.nombre.split(' ');
  if (names.length >= 2) {
    return (names[0][0] + names[1][0]).toUpperCase();
  }
  return user.nombre.substring(0, 2).toUpperCase();
}
// src/app/api/profile/route.ts:224
if (nombre !== undefined) updateUserData.nombre = nombre;
```

- **Escenario de fallo:** Candidato se registra desde el móvil; el teclado autocompleta "María " con espacio final. Tras el login, el círculo del avatar (w-8 h-8) muestra "MUNDEFINED" desbordado. Variante grave: un usuario guarda en /profile el nombre " " (dos espacios) -> en el siguiente render Navbar lanza "toUpperCase is not a function" y toda la app queda en "Application error" para esa cuenta hasta que soporte corrija la BD.
- **Arreglo propuesto:** En Navbar: const parts = (user.nombre ?? '').trim().split(/\s+/).filter(Boolean); si parts.length >= 2 usar parts[0][0]+parts[1][0]; si es 1 usar parts[0].slice(0,2); si es 0 caer a user.email.slice(0,2). Opcional: usar apellidoPaterno que /api/auth/me ya devuelve. En backend: z.string().trim().min(2) en src/app/api/auth/register/route.ts:27-28 y validar/trim de nombre en PUT src/app/api/profile/route.ts:224 (rechazar vacío). Añadir test unitario de getInitials con 'Ana ', ' Ana', 'Juan Carlos', ' '.

#### UI-006 — El menú de escritorio se activa en md (768px) pero su contenido no cabe hasta ~1000px: enlaces partidos en dos líneas y botón de sesión recortado fuera de pantalla

- **Severidad:** 🟡 medium · **Categoría:** responsive · **Estado:** nuevo · **Verificación:** sin verificar (reportada por 1 auditor)
- **Ubicación:** `src/components/commons/Navbar.tsx:200` · relacionados: `tailwind.config.ts`
- **Problema:** A partir de 768px se oculta la hamburguesa (md:hidden) y se muestra el <ul> de escritorio. tailwind.config.ts redefine container.screens solo con 2xl, así que el contenedor mide 100% del viewport: a 768px quedan 736px útiles (px-4). El cromo fijo es logo 128px (md:w-32) + 6 enlaces con px-4 (192px) + 5 huecos space-x-4 (80px) = 400px, dejando ~336px para 58 caracteres en mayúsculas a 16px (INICIO, SOBRE NOSOTROS, EMPRESAS, TALENTOS, CONTACTO, Iniciar Sesión), es decir ~5.8px por carácter cuando DM Sans en mayúsculas ronda 10px. No cabe: los <li> se encogen a min-content, "SOBRE NOSOTROS" e "Iniciar Sesión" se parten en dos líneas (la píldora rounded-full, al ser un <a> inline, se fragmenta) y aun así la suma de min-content + logo (~830px) supera 736px, por lo que el último elemento desborda a la derecha de un nav position:fixed (inalcanzable, body tiene overflow-x:hidden). Con sesión iniciada hay un <li> más (campana). Además el nav crece a >56px y tapa contenido (body pt-14). Estimación hecha por cálculo de anchos sobre el código, no renderizada.
- **Evidencia:**

```ts
// Navbar.tsx:191-200
<button
  onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
  className="md:hidden p-2 text-title-dark"
...
<ul className="hidden md:flex space-x-4 lg:space-x-6 items-center">
// tailwind.config.ts:11-17
container: {
  center: true,
  padding: "2rem",
  screens: { "2xl": "1400px" },
},
```

- **Escenario de fallo:** Visitante abre inakat.com en un iPad en vertical (768/810/820/834px) o en una ventana de escritorio a media pantalla (~960px): ve "SOBRE / NOSOTROS" en dos renglones con el fondo de la píldora roto y el botón naranja "Iniciar Sesión" (o el avatar) cortado por el borde derecho, sin scroll horizontal posible.
- **Arreglo propuesto:** Cambiar el breakpoint del menú de escritorio de md a lg (o xl): botón hamburguesa y drawer con lg:hidden, <ul> con hidden lg:flex; añadir whitespace-nowrap a los enlaces y convertirlos en inline-flex/inline-block para que la píldora no se fragmente; reducir gaps (space-x-2 en lg, space-x-4 en xl). Verificar en 768, 820, 1024 y 1280px con y sin sesión (el caso con sesión añade la campana).

#### UI-007 — Rol vendor sin soporte en Navbar: sin enlace a Panel Vendedor en el menú móvil, "Dashboard" apunta a "/" y etiqueta de rol vacía

- **Severidad:** 🟡 medium · **Categoría:** frontend-bug · **Estado:** nuevo · **Verificación:** sin verificar (reportada por 1 auditor)
- **Ubicación:** `src/components/commons/Navbar.tsx:334` · relacionados: `src/app/login/page.tsx`, `src/app/api/admin/vendors/route.ts`, `__tests__/qa/feb2026-regression.test.ts`
- **Problema:** El rol 'vendor' existe (lo crea src/app/api/admin/vendors/route.ts:237) pero getDashboardLink, getDashboardLabel y getRoleLabel no tienen case 'vendor': caen en default -> enlace "Dashboard" que lleva a '/', y etiqueta de rol ''. El enlace a /vendor/dashboard solo existe en el dropdown de escritorio (línea 334-355); el bloque móvil (líneas 651-799) tiene bloques para admin y company pero ninguno para vendor, así que tampoco el admin ve "Panel Vendedor" en móvil. El login manda al vendor a /talents (src/app/login/page.tsx:59-61), por lo que en móvil no hay ninguna ruta de UI hacia su panel. Causa raíz: el menú está duplicado a mano (escritorio y móvil); ya ocurrió antes con los enlaces admin (ver __tests__/qa/feb2026-regression.test.ts:259 "Mobile menu was missing ALL admin links").
- **Evidencia:**

```ts
// líneas 111-117
      case 'candidate':
        return '/candidate/applications';
      case 'user':
        return '/my-applications';
      default:
        return '/';
// línea 334 (solo dropdown de escritorio; no hay equivalente en el drawer móvil)
{['admin', 'vendor'].includes(user.role) && (
  <Link
    href="/vendor/dashboard"
```

- **Escenario de fallo:** Un vendedor dado de alta por el admin inicia sesión en su teléfono: aterriza en /talents, abre el menú hamburguesa y ve "Dashboard" (que lo lleva a la home), "Notificaciones", "Mi Perfil" y "Cerrar Sesión"; no existe ningún enlace a /vendor/dashboard para ver su código y sus comisiones. En escritorio ve un "Dashboard" inútil que abre '/' y el renglón de rol vacío.
- **Arreglo propuesto:** Añadir case 'vendor' en getDashboardLink ('/vendor/dashboard'), getDashboardLabel ('Panel Vendedor') y getRoleLabel ('Vendedor'), y ocultar entonces el enlace duplicado para vendor. Añadir en el drawer móvil el bloque {['admin','vendor'].includes(user.role) && <Link href="/vendor/dashboard">}. Mejor: extraer una única estructura de datos menuByRole consumida por ambos menús para que no vuelvan a divergir (actualizar los tests de __tests__/qa/feb2026-regression.test.ts que hacen grep del código fuente). Añadir también redirect de vendor a /vendor/dashboard en login/page.tsx.

## ⚪ low (22)

#### UI-008 — Restos de create-react-app servidos en producción: /index.html público, más src/App.css, src/index.css y src/logo.svg sin importar

- **Severidad:** ⚪ low · **Categoría:** dead-code · **Estado:** nuevo · **Verificación:** sin verificar (reportada por 2 auditores)
- **Ubicación:** `public/index.html:10` · relacionados: `src/index.css`, `src/App.css`, `src/logo.svg`
- **Problema:** public/index.html es la plantilla original de CRA con los marcadores %PUBLIC_URL% sin resolver, lang="en", descripción "Web site created using create-react-app" y un <div id="root"> vacío. Next sirve todo public/ en la raíz, así que https://inakat.com/index.html responde 200 con una página en blanco titulada "Inakat". En src/ quedan App.css, index.css y logo.svg de CRA que nadie importa (grep sin resultados); index.css duplica directivas @tailwind y un padding-top de body distinto al real, lo que confunde sobre cuál es la hoja vigente (la real es src/app/globals.css).
- **Evidencia:**

```ts
<meta
  name="description"
  content="Web site created using create-react-app"
/>
<link rel="apple-touch-icon" href="%PUBLIC_URL%/logo192.png" />
...
<title>Inakat</title>
...
<noscript>You need to enable JavaScript to run this app.</noscript>
<div id="root"></div>
```

- **Escenario de fallo:** Cualquiera (o un rastreador) que pida https://inakat.com/index.html recibe una página en blanco en inglés con la descripción de create-react-app, indexable porque robots.txt no la excluye; un desarrollador edita src/index.css creyendo que es la hoja global y sus cambios nunca se aplican.
- **Arreglo propuesto:** Eliminar public/index.html, src/App.css, src/index.css y src/logo.svg (verificando antes con grep que nada los importa). Mantener favicon.ico, logo192.png, logo512.png y robots.txt.
- **Otros auditores añaden:** Borrar public/index.html, logo192.png, logo512.png y manifest.json (o sustituir el manifest por src/app/manifest.ts con los datos reales de marca).

#### UI-009 — manifest.json heredado de CRA (name "Landing Page", colores negro/blanco) y no enlazado; el layout no declara icons ni apple-touch-icon

- **Severidad:** ⚪ low · **Categoría:** config · **Estado:** nuevo · **Verificación:** sin verificar (reportada por 1 auditor)
- **Ubicación:** `public/manifest.json:3` · relacionados: `src/app/layout.tsx`, `public/logo192.png`, `public/logo512.png`
- **Problema:** El manifest conserva "name": "Landing Page", theme_color #000000 y background_color #ffffff, ajenos a la marca (beige #e8e7d4 / verde #2b5d62). El metadata del root layout no declara manifest ni icons, por lo que el archivo es código muerto y los iconos de marca logo192.png/logo512.png (que sí existen en public/) no se usan: iOS toma una captura de pantalla al "Añadir a pantalla de inicio" y Android no ofrece instalación.
- **Evidencia:**

```ts
{
  "short_name": "Inakat",
  "name": "Landing Page",
  ...
  "start_url": ".",
  "display": "standalone",
  "theme_color": "#000000",
  "background_color": "#ffffff"
}
```

- **Escenario de fallo:** Un candidato añade INAKAT a la pantalla de inicio de su iPhone: el icono es una miniatura de la página en vez del logo. Si alguien enlaza el manifest tal cual, la app instalada se llamaría "Landing Page" con barra de estado negra.
- **Arreglo propuesto:** Sustituir por src/app/manifest.ts (MetadataRoute.Manifest) con name 'INAKAT - Talento Evaluado por Expertos', short_name 'INAKAT', start_url '/', theme_color '#2b5d62', background_color '#e8e7d4' e iconos 192/512; borrar public/manifest.json. En layout.tsx añadir icons: { icon: '/favicon.ico', apple: '/logo192.png' } y export const viewport = { themeColor: '#2b5d62' }.

#### UI-010 — /about importa CTAFinalSection desde sections/home/**, módulo que se está rediseñando en paralelo: acoplamiento que puede romper el build

- **Severidad:** ⚪ low · **Categoría:** reliability · **Estado:** nuevo · **Verificación:** sin verificar (reportada por 1 auditor)
- **Ubicación:** `src/app/about/page.tsx:6` · relacionados: `src/components/sections/home/CTAFinalSection.tsx`
- **Problema:** La página Sobre Nosotros reutiliza un componente que vive dentro de la carpeta de la home. Si el rediseño de la home renombra, elimina o cambia el contrato/estilo de CTAFinalSection, /about deja de compilar (Module not found) o hereda un CTA con un diseño incoherente con el resto de la página, sin que nadie que trabaje en la home lo perciba.
- **Evidencia:**

```ts
import SelectionProcessSection from "@/components/sections/aboutus/SelectionProcessSection";
import CTAFinalSection from "@/components/sections/home/CTAFinalSection";
import Footer from "@/components/commons/Footer";
```

- **Escenario de fallo:** El rediseño de la home sustituye CTAFinalSection.tsx por un componente nuevo y borra el archivo: next build falla en src/app/about/page.tsx con "Module not found: Can't resolve '@/components/sections/home/CTAFinalSection'" y bloquea el deploy.
- **Arreglo propuesto:** Mover el CTA compartido a src/components/commons/CTAFinalSection.tsx (o crear un CTA propio en sections/aboutus) y actualizar ambos imports; coordinar con el rediseño de la home para que mantenga ese export.

#### UI-011 — Todo el contenido de /about (y secciones con animate-on-scroll) nace con opacity:0 y depende de JS: invisible hasta hidratar y en blanco sin JavaScript

- **Severidad:** ⚪ low · **Categoría:** performance · **Estado:** nuevo · **Verificación:** sin verificar (reportada por 1 auditor)
- **Ubicación:** `src/app/globals.css:98` · relacionados: `src/hooks/useInView.ts`, `src/components/sections/aboutus/AboutUsSection.tsx`
- **Problema:** La clase .animate-on-scroll deja los elementos con opacity: 0 en el HTML servido; solo useInView (IntersectionObserver dentro de useEffect) añade in-view. En /about las cuatro secciones aplican la clase a prácticamente todo su contenido (imagen, títulos, párrafos, tarjetas, pasos). El SSR pierde su beneficio: hasta que se descargan e hidratan los bundles, el primer pantallazo es un fondo beige vacío; si JS falla o está bloqueado (o IntersectionObserver no existe, caso en que el efecto lanza ReferenceError) el contenido nunca aparece. No hay <noscript> ni fallback CSS.
- **Evidencia:**

```ts
/* globals.css:98-107 */
.animate-on-scroll {
  opacity: 0;
  transform: translateY(30px);
  transition: opacity 0.6s ease-out, transform 0.6s ease-out;
}
.animate-on-scroll.in-view {
  opacity: 1;
  transform: translateY(0);
}
// useInView.ts:8
const observer = new IntersectionObserver(
```

- **Escenario de fallo:** Usuario con conexión lenta abre /about: el HTML llega de inmediato pero ve secciones vacías varios segundos hasta que hidrata React; con un bloqueador que impida los chunks de _next, la página queda en blanco de forma permanente salvo navbar y footer.
- **Arreglo propuesto:** Ocultar solo cuando JS está disponible: añadir en layout un script inline mínimo que ponga document.documentElement.classList.add('js') y cambiar el selector a .js .animate-on-scroll { opacity: 0; ... }; añadir <noscript><style>.animate-on-scroll{opacity:1!important;transform:none!important}</style></noscript>. En useInView, si typeof IntersectionObserver === 'undefined' hacer setIsInView(true) y salir. No aplicar el reveal al contenido del primer pantallazo (hero de /about).

#### UI-012 — Metadata social/canónica incompleta: sin metadataBase, canonical, og:image, og:url, siteName ni twitter card

- **Severidad:** ⚪ low · **Categoría:** config · **Estado:** nuevo · **Verificación:** sin verificar (reportada por 1 auditor)
- **Ubicación:** `src/app/layout.tsx:22` · relacionados: `public/manifest.json`
- **Problema:** El bloque openGraph solo tiene title, description, type y locale. No hay metadataBase, alternates.canonical, openGraph.url/siteName/images ni twitter. En public/ no existe ninguna imagen OG (solo favicon.ico, logo192.png, logo512.png). Para una bolsa de trabajo cuyos enlaces se comparten por WhatsApp/LinkedIn, las vistas previas salen sin imagen, y sin canonical las variantes www / parámetros de campaña compiten como URLs distintas.
- **Evidencia:**

```ts
openGraph: {
  title: "INAKAT - Talento Evaluado por Expertos Reales",
  description:
    "Contrata talento calificado con evaluación dual: psicólogos expertos + especialistas técnicos. Presencia en toda la República Mexicana.",
  type: "website",
  locale: "es_MX",
},
```

- **Escenario de fallo:** Un reclutador pega https://inakat.com/talents en un grupo de WhatsApp o en LinkedIn: la tarjeta de vista previa aparece sin imagen (solo texto gris), con mucho menor tasa de clic; Facebook Sharing Debugger reporta og:image y og:url ausentes.
- **Arreglo propuesto:** Añadir en layout.tsx: metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL ?? 'https://inakat.com'), alternates: { canonical: '/' }, openGraph.url, openGraph.siteName: 'INAKAT', openGraph.images con una imagen 1200x630 (crear src/app/opengraph-image.png o public/og.png), twitter: { card: 'summary_large_image' }, e icons (icon + apple: '/logo192.png').

#### UI-013 — El Navbar fijo mide más que el padding del body (60px en móvil y ~64px con sesión vs pt-14 = 56px): tapa los primeros 4-8px de cada página

- **Severidad:** ⚪ low · **Categoría:** responsive · **Estado:** nuevo · **Verificación:** sin verificar (reportada por 1 auditor)
- **Ubicación:** `src/app/layout.tsx:38` · relacionados: `src/app/globals.css`, `src/components/commons/Navbar.tsx`
- **Problema:** La compensación del navbar fijo está hardcodeada como pt-14 (56px) y en globals.css como scroll-padding-top: 4rem (64px), dos valores distintos para lo mismo. La altura real del nav es py-2 (16px) + el hijo más alto: en móvil el botón hamburguesa p-2 + icono 28px = 44px -> 60px; en escritorio con sesión el botón del avatar py-2 + círculo h-8 = 48px -> 64px. Sin sesión en escritorio cabe en 56px. Por eso el contenido empieza 4-8px por debajo del borde del nav. src/index.css (resto de CRA, no importado) aún conserva el comentario "padding-top: 3em; /* o lo que mida tu navbar */".
- **Evidencia:**

```ts
// src/app/layout.tsx:38
<body className="font-body antialiased pt-14">
// src/app/globals.css:61-64
html {
  scroll-behavior: smooth;
  scroll-padding-top: 4rem;
}
// Navbar.tsx:183,193,196,241,243
<nav className="fixed top-0 left-0 w-full bg-custom-beige py-2 z-50">
className="md:hidden p-2 text-title-dark" ... <Menu size={28} />
... px-4 py-2 rounded-full ... <div className="w-8 h-8 ...
```

- **Escenario de fallo:** En un teléfono, cualquier página cuyo primer elemento no tenga padding superior (p. ej. la barra del dashboard de empresa o cabeceras de paneles) aparece con su borde superior cortado 4px bajo el nav; con sesión en escritorio son 8px.
- **Arreglo propuesto:** Definir una sola fuente de verdad: en globals.css :root { --navbar-h: 4rem; }, dar al nav altura fija h-[var(--navbar-h)] con items-center (quitando py-2), y usar body { padding-top: var(--navbar-h) } y scroll-padding-top: var(--navbar-h). Eliminar pt-14 del layout.

#### UI-014 — min-h-screen dentro de un body con pt-14 genera scroll fantasma de 56px en loading, 404, login, etc.; el spinner global no tiene role="status"

- **Severidad:** ⚪ low · **Categoría:** ux · **Estado:** nuevo · **Verificación:** sin verificar (reportada por 1 auditor)
- **Ubicación:** `src/app/loading.tsx:4` · relacionados: `src/app/not-found.tsx`, `src/app/login/page.tsx`, `src/app/layout.tsx`
- **Problema:** El body ya tiene padding-top de 56px por el navbar fijo; los contenedores con min-h-screen (100vh) hacen que el documento mida 100vh + 56px. En src/app/loading.tsx esto provoca que durante cada transición aparezca una barra de scroll vertical que desaparece al cargar la página real (salto horizontal de ~15px en Windows) y que el spinner quede 28px por debajo del centro visual. El mismo patrón afecta a not-found.tsx, login, register y unauthorized. Además el indicador es un <div> decorativo sin role="status"/aria-live, así que un lector de pantalla no anuncia la carga.
- **Evidencia:**

```ts
export default function Loading() {
  return (
    <div className="min-h-screen bg-custom-beige flex items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <div className="w-10 h-10 border-4 border-button-green border-t-transparent rounded-full animate-spin" />
        <p className="text-text-black/50 text-sm">Cargando...</p>
```

- **Escenario de fallo:** En un escritorio Windows, al navegar entre secciones se muestra el loading global: aparece una barra de scroll vertical innecesaria y todo el navbar se desplaza unos píxeles a la izquierda, volviendo a su sitio al terminar la carga; en /login siempre hay 56px de scroll sobrante.
- **Arreglo propuesto:** Usar min-h-[calc(100vh-3.5rem)] (o calc(100dvh - var(--navbar-h)) si se adopta la variable) en loading.tsx, not-found.tsx y las páginas de auth; añadir role="status" aria-live="polite" al contenedor y aria-hidden al círculo animado.

#### UI-015 — sitemap.ts con dominio hardcodeado y lastModified = new Date() para todas las URLs; robots.txt no cubre /forgot-password, /reset-password ni /notifications

- **Severidad:** ⚪ low · **Categoría:** config · **Estado:** nuevo · **Verificación:** sin verificar (reportada por 1 auditor)
- **Ubicación:** `src/app/sitemap.ts:6` · relacionados: `public/robots.txt`, `src/app/api/auth/forgot-password/route.ts`, `src/app/api/credits/purchases/route.ts`
- **Problema:** Las 7 entradas repiten 'https://inakat.com' literal en lugar de derivarlo de la variable de entorno que ya usa el resto del código (NEXT_PUBLIC_APP_URL / NEXT_PUBLIC_BASE_URL, que además son dos nombres para lo mismo), por lo que un despliegue de preview o un cambio a www publica URLs incorrectas. lastModified: new Date() marca todas las páginas (incluidos los textos legales "yearly") como modificadas en cada build, señal que Google termina ignorando por poco fiable. public/robots.txt bloquea /login y /register pero deja rastreables /forgot-password, /reset-password (URLs con token) y /notifications.
- **Evidencia:**

```ts
return [
  { url: 'https://inakat.com', lastModified: new Date(), changeFrequency: 'weekly', priority: 1 },
  { url: 'https://inakat.com/about', lastModified: new Date(), changeFrequency: 'monthly', priority: 0.8 },
  ...
  { url: 'https://inakat.com/terms', lastModified: new Date(), changeFrequency: 'yearly', priority: 0.3 },
  { url: 'https://inakat.com/privacy', lastModified: new Date(), changeFrequency: 'yearly', priority: 0.3 },
];
```

- **Escenario de fallo:** Cada deploy regenera sitemap.xml con <lastmod> de hoy para /terms y /privacy aunque no cambien desde febrero; en un entorno de staging con otro dominio, el sitemap sigue anunciando URLs de producción. Un enlace de restablecimiento filtrado (/reset-password?token=...) puede ser rastreado porque la ruta no está en Disallow.
- **Arreglo propuesto:** const base = (process.env.NEXT_PUBLIC_APP_URL ?? 'https://inakat.com').replace(/\/$/, ''); generar las entradas desde un array de rutas con fechas reales de última edición (constantes) en lugar de new Date(). Unificar NEXT_PUBLIC_APP_URL/NEXT_PUBLIC_BASE_URL en una sola variable. Migrar robots a src/app/robots.ts usando la misma base y añadir Disallow para /forgot-password, /reset-password, /notifications e /index.html.

#### UI-016 — Parpadeo de "Iniciar Sesión" para usuarios autenticados en cada carga completa (no hay estado de carga de sesión)

- **Severidad:** ⚪ low · **Categoría:** ux · **Estado:** nuevo · **Verificación:** sin verificar (reportada por 1 auditor)
- **Ubicación:** `src/components/commons/Navbar.tsx:24` · relacionados: `src/app/layout.tsx`
- **Problema:** user arranca en null y el render trata null como "no autenticado": hasta que responde /api/auth/me (una función serverless con consulta a BD) se pinta el botón naranja "Iniciar Sesión" y después se sustituye por campana + avatar, con salto de layout en el nav. Ocurre en cada carga dura, incluida la posterior al login/registro, que usan window.location.href.
- **Evidencia:**

```ts
const [user, setUser] = useState<UserData | null>(null);
...
{user ? (
  // User Dropdown
  <div className="relative" ref={dropdownRef}>
...
) : (
  // Login Button
  <Link
    href="/login"
```

- **Escenario de fallo:** Una empresa inicia sesión; login hace window.location.href = '/company/dashboard'. Durante 300-800 ms el Navbar muestra "Iniciar Sesión" aunque ya está autenticada; si hace clic en ese lapso llega de nuevo a /login. Luego el botón se transforma en campana + avatar desplazando los enlaces.
- **Arreglo propuesto:** Añadir estado authStatus: 'loading' | 'authenticated' | 'anonymous'; mientras sea 'loading' renderizar un placeholder del mismo ancho (skeleton circular) en lugar del botón de login. Alternativa mejor: leer la cookie en el root layout (server) con verifyToken y pasar initialUser a Navbar como prop para que el primer render ya sea correcto.

#### UI-017 — Navbar consulta /api/auth/me en cada navegación y el endpoint responde 401 a todo visitante anónimo (error de consola + invocación serverless por página vista)

- **Severidad:** ⚪ low · **Categoría:** performance · **Estado:** nuevo · **Verificación:** sin verificar (reportada por 1 auditor)
- **Ubicación:** `src/components/commons/Navbar.tsx:33` · relacionados: `src/app/api/auth/me/route.ts`
- **Problema:** Como la cookie es httpOnly, el cliente no puede saber si hay sesión y dispara GET /api/auth/me en cada cambio de pathname. Para visitantes anónimos (la mayoría del tráfico del sitio público) el endpoint devuelve 401, que el navegador registra como error de red en consola en cada página; Lighthouse lo penaliza en Best Practices ("Browser errors were logged to the console") y cada página vista genera una invocación de función. Para usuarios autenticados cada navegación implica además una consulta a BD, sin caché ni deduplicación.
- **Evidencia:**

```ts
// Navbar.tsx:33-36
const response = await fetch('/api/auth/me', {
  method: 'GET',
  credentials: 'include' // Importante: incluir cookies
});
// src/app/api/auth/me/route.ts:18-26
if (!token) {
  return NextResponse.json(
    { success: false, error: 'No autenticado' },
    { status: 401 }
  );
}
```

- **Escenario de fallo:** Un visitante anónimo recorre Inicio -> Empresas -> Talentos -> Contacto: la consola acumula 4 errores "GET /api/auth/me 401 (Unauthorized)" y se ejecutan 4 funciones serverless sin utilidad; una auditoría Lighthouse del home marca errores de consola.
- **Arreglo propuesto:** Hacer que /api/auth/me devuelva 200 { success: true, user: null } cuando no hay cookie (reservar 401 para token inválido/expirado) y adaptar Navbar (y cualquier otro consumidor de /api/auth/me) a user null. Cachear la sesión en un contexto/SWR con dedupe para no re-consultar en cada pathname, revalidando por evento y por foco. Mejor aún: hidratar la sesión desde el root layout en servidor.

#### UI-018 — Logout muestra la sesión como cerrada aunque la petición falle; la cookie httpOnly sigue viva

- **Severidad:** ⚪ low · **Categoría:** security · **Estado:** nuevo · **Verificación:** sin verificar (reportada por 1 auditor)
- **Ubicación:** `src/components/commons/Navbar.tsx:90` · relacionados: `src/app/api/auth/logout/route.ts`
- **Problema:** handleLogout limpia el estado local y redirige a '/' dentro de finally, tanto si el POST /api/auth/logout responde OK como si falla por red o devuelve error (solo hace console.error). La cookie auth-token es httpOnly con maxAge de 7 días, así que el cliente no puede borrarla por su cuenta: la UI dice "Iniciar Sesión" pero la sesión continúa. En cuanto cambie pathname, checkAuth vuelve a autenticar al usuario.
- **Evidencia:**

```ts
  if (!response.ok) {
    console.error('Error logging out: response not ok');
  }
} catch (error) {
  console.error('Error logging out:', error);
} finally {
  // Limpiar estado local y redirigir
  setUser(null);
  setDropdownOpen(false);
  router.push('/');
  router.refresh();
}
```

- **Escenario de fallo:** Candidato en un equipo compartido (cibercafé, biblioteca) pulsa "Cerrar Sesión" justo con un corte de red: ve la home con el botón "Iniciar Sesión" y se va. La siguiente persona navega a /talents: Navbar re-consulta /api/auth/me, la cookie sigue válida y aparece autenticada como el candidato anterior, con acceso a /profile y su CV.
- **Arreglo propuesto:** Solo limpiar estado y redirigir si response.ok; en caso contrario mostrar un aviso visible ("No se pudo cerrar la sesión, inténtalo de nuevo") y mantener al usuario como autenticado. Opcional: reintento automático una vez.

#### UI-019 — El menú móvil no se cierra al navegar por el logo o con atrás/adelante, ni con Escape o click fuera, y no bloquea el scroll

- **Severidad:** ⚪ low · **Categoría:** ux · **Estado:** nuevo · **Verificación:** sin verificar (reportada por 1 auditor)
- **Ubicación:** `src/components/commons/Navbar.tsx:186`
- **Problema:** mobileMenuOpen solo pasa a false en el onClick de cada enlace del drawer y en el botón hamburguesa. El <Link href="/"> del logo no lo cierra, no hay efecto que lo cierre al cambiar pathname (navegación con botón atrás, o redirecciones), el listener de click fuera solo cubre dropdownRef (el dropdown de escritorio) y no hay manejo de Escape. El drawer es absolute bajo un nav fixed y el body sigue desplazándose detrás.
- **Evidencia:**

```ts
<Link href="/">
  <Image src={logo} alt="INAKAT" className="w-24 md:w-32" priority />
</Link>
...
const handleClickOutside = (event: MouseEvent) => {
  if (
    dropdownRef.current &&
    !dropdownRef.current.contains(event.target as Node)
  ) {
    setDropdownOpen(false);
  }
};
```

- **Escenario de fallo:** En el móvil, el usuario abre el menú en /about y toca el logo para ir al inicio: la ruta cambia a '/' pero el drawer sigue desplegado cubriendo hasta el 80% de la nueva página; tocar fuera del menú no lo cierra, solo el icono X.
- **Arreglo propuesto:** Añadir useEffect(() => { setMobileMenuOpen(false); setDropdownOpen(false); }, [pathname]); onClick={() => setMobileMenuOpen(false)} en el Link del logo; un listener keydown que cierre ambos menús con Escape (devolviendo el foco al botón); un ref para el drawer + botón en el handler de click fuera; y bloquear el scroll del body (overflow hidden) mientras mobileMenuOpen sea true.

#### UI-020 — En movil la campanita se monta oculta (hace polling) pero el usuario nunca ve el contador de no leidas

- **Severidad:** ⚪ low · **Categoría:** responsive · **Estado:** nuevo · **Verificación:** sin verificar (reportada por 1 auditor)
- **Ubicación:** `src/components/commons/Navbar.tsx:228` · relacionados: `src/components/shared/NotificationBell.tsx`
- **Problema:** `<NotificationBell />` vive dentro de `<ul className="hidden md:flex ...">` (linea 200): en pantallas < md queda con display:none pero React la monta igual, asi que ejecuta el polling y gasta peticiones sin mostrar nada. El menu movil solo ofrece un enlace de texto 'Notificaciones' (lineas 668-676) sin badge de no leidas, por lo que un candidato o reclutador en el telefono no tiene ningun indicio de que tiene avisos nuevos.
- **Evidencia:**

```ts
<ul className="hidden md:flex space-x-4 lg:space-x-6 items-center">
  ...
  {user && (
    <li>
      <NotificationBell />
    </li>
  )}

{/* Notificaciones (mobile) */}
<Link href="/notifications" onClick={() => setMobileMenuOpen(false)} ...>
  <Bell className="w-4 h-4" />
  Notificaciones
</Link>
```

- **Escenario de fallo:** Una empresa recibe 'Candidato disponible para revision' y consulta INAKAT desde el celular: la barra superior solo muestra logo y hamburguesa, sin badge. No abre el menu, no se entera y el candidato espera dias.
- **Arreglo propuesto:** Sacar la campanita del `<ul>` de escritorio y renderizarla junto al boton hamburguesa (visible en todos los anchos), o elevar `unreadCount` a un hook `useUnreadCount()` compartido y pintar el badge tanto en el icono hamburguesa como en el enlace 'Notificaciones' del menu movil. Asi hay una sola fuente de polling.

#### UI-021 — A11y del Navbar: botón de usuario sin nombre accesible ni aria-expanded, hamburguesa con aria-label en inglés y sin estado, sin aria-current ni enlace de salto

- **Severidad:** ⚪ low · **Categoría:** a11y · **Estado:** nuevo · **Verificación:** sin verificar (reportada por 1 auditor)
- **Ubicación:** `src/components/commons/Navbar.tsx:239` · relacionados: `src/app/layout.tsx`
- **Problema:** El botón que abre el menú de usuario solo contiene las iniciales y un chevron: un lector de pantalla anuncia "GS, botón" sin indicar que es un menú ni si está abierto (faltan aria-label, aria-haspopup y aria-expanded); el dropdown no se cierra con Escape. El botón hamburguesa usa aria-label="Toggle menu" (inglés en sitio lang="es") y tampoco expone aria-expanded/aria-controls. El enlace activo solo cambia de estilo (cursor-default) sin aria-current="page". El layout no ofrece enlace "Saltar al contenido", por lo que con teclado hay que recorrer 6-8 elementos del nav en cada página. La auditoría de junio (#59/#60) cubrió modales y botones de cerrar, no el Navbar.
- **Evidencia:**

```ts
<button
  onClick={() => setDropdownOpen(!dropdownOpen)}
  className="flex items-center gap-2 bg-button-orange text-white px-4 py-2 rounded-full hover:bg-opacity-90 transition-colors"
>
...
<button
  onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
  className="md:hidden p-2 text-title-dark"
  aria-label="Toggle menu"
>
```

- **Escenario de fallo:** Una persona usuaria de NVDA/VoiceOver llega al botón del avatar y escucha solo dos letras; al activarlo no recibe anuncio de que se abrió un menú y no puede cerrarlo con Escape; en móvil escucha "Toggle menu" en inglés sin saber si está abierto o cerrado.
- **Arreglo propuesto:** Botón de usuario: aria-label={`Menú de cuenta de ${user.nombre || user.email}`}, aria-haspopup="menu", aria-expanded={dropdownOpen}, aria-controls; cerrar con Escape y devolver foco. Hamburguesa: aria-label={mobileMenuOpen ? 'Cerrar menú' : 'Abrir menú'}, aria-expanded, aria-controls="mobile-menu" e id en el drawer. Añadir aria-current={pathname === path ? 'page' : undefined} a los enlaces. En layout.tsx añadir un enlace sr-only focus:not-sr-only "Saltar al contenido" y un id destino.

#### UI-022 — El dropdown de usuario (admin) no tiene max-height ni scroll: "Cerrar Sesión" y los últimos enlaces quedan inalcanzables en viewports bajos

- **Severidad:** ⚪ low · **Categoría:** responsive · **Estado:** nuevo · **Verificación:** sin verificar (reportada por 1 auditor)
- **Ubicación:** `src/components/commons/Navbar.tsx:255`
- **Problema:** El drawer móvil tiene max-h-[80vh] overflow-y-auto, pero el dropdown de escritorio no. Para admin suma: bloque de usuario (~72px) + Mi Perfil + Panel Vendedor (72px) + rejilla admin con 3 cabeceras y 7 filas (~330px) + separadores + Cerrar Sesión ≈ 550px, que más el navbar (~64px) exige ~620px de alto. Como el dropdown cuelga de un nav position:fixed, lo que exceda el viewport no se puede alcanzar con scroll.
- **Evidencia:**

```ts
{dropdownOpen && (
  <div className="absolute right-0 mt-2 w-[min(420px,90vw)] bg-white rounded-lg shadow-lg py-2 border border-gray-200">
// frente al drawer móvil (línea 600):
<div className="md:hidden absolute top-full left-0 w-full bg-custom-beige shadow-lg border-t border-gray-200 max-h-[80vh] overflow-y-auto">
```

- **Escenario de fallo:** Admin en un portátil 1366x768 con escala de Windows al 125% (viewport ~1093x520) o en un teléfono en horizontal de más de 768px de ancho (p. ej. 932x430) abre el menú del avatar: "Usuarios", "Especialidades" y "Cerrar Sesión" quedan por debajo del borde inferior y no hay forma de desplazarse hasta ellos.
- **Arreglo propuesto:** Añadir al contenedor del dropdown max-h-[calc(100vh-5rem)] overflow-y-auto overscroll-contain (igual criterio que el drawer móvil).

#### UI-023 — En móvil no hay indicador de notificaciones no leídas: NotificationBell solo se monta en el menú de escritorio

- **Severidad:** ⚪ low · **Categoría:** ux · **Estado:** nuevo · **Verificación:** sin verificar (reportada por 1 auditor)
- **Ubicación:** `src/components/commons/Navbar.tsx:668` · relacionados: `src/components/shared/NotificationBell.tsx`
- **Problema:** El componente NotificationBell (badge con contador y polling cada 30 s) solo se renderiza dentro del <ul className="hidden md:flex">. En el drawer móvil hay un enlace plano "Notificaciones" sin contador y el botón hamburguesa tampoco muestra badge. La mayoría de candidatos usa teléfono, así que nunca ven que tienen notificaciones salvo que abran el menú y entren a /notifications por iniciativa propia.
- **Evidencia:**

```ts
{/* Notificaciones (mobile) */}
<Link
  href="/notifications"
  onClick={() => setMobileMenuOpen(false)}
  className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-lg"
>
  <Bell className="w-4 h-4" />
  Notificaciones
</Link>
```

- **Escenario de fallo:** A un candidato le cambian el estado de su postulación (notificación application_status). Entra desde el móvil: ningún elemento de la interfaz indica que hay novedades; no se entera hasta abrir el menú y tocar "Notificaciones".
- **Arreglo propuesto:** Renderizar <NotificationBell /> también en la barra móvil junto a la hamburguesa (p. ej. un contenedor md:hidden con ambos), o levantar el contador a Navbar (hook useUnreadCount compartido) y mostrarlo como badge sobre la hamburguesa y junto al enlace "Notificaciones" del drawer. Evitar dos instancias haciendo polling a la vez.

#### UI-024 — Prioridades de carga de imagen invertidas en /about: la imagen principal (LCP) va con loading="lazy" y 4 fotos bajo el pliegue van con priority

- **Severidad:** ⚪ low · **Categoría:** performance · **Estado:** nuevo · **Verificación:** sin verificar (reportada por 1 auditor)
- **Ubicación:** `src/components/sections/aboutus/AboutUsSection.tsx:26` · relacionados: `src/components/sections/aboutus/ExpertsSection.tsx`
- **Problema:** AboutUsSection es la primera sección de /about y su imagen ocupa la mitad izquierda del primer pantallazo en escritorio (candidata a LCP), pero se marca loading="lazy", lo que retrasa su descarga hasta después del layout. En cambio ExpertsSection, tercera sección (muy por debajo del pliegue), marca priority en sus 4 primeras fotos, que se precargan en el <head> compitiendo por ancho de banda con la imagen realmente visible.
- **Evidencia:**

```ts
// AboutUsSection.tsx:22-27
<Image
  src={aboutImage}
  alt="Equipo INAKAT"
  className="w-full rounded-2xl shadow-2xl"
  loading="lazy"
/>
// ExpertsSection.tsx:132-133
priority={index < 4}
loading={index < 4 ? undefined : 'lazy'}
```

- **Escenario de fallo:** Visitante con 4G abre /about: el navegador precarga primero 4 retratos que no se ven hasta hacer scroll y pospone la imagen del hero; el LCP de la página empeora y PageSpeed reporta "Largest Contentful Paint image was lazily loaded".
- **Arreglo propuesto:** En AboutUsSection sustituir loading="lazy" por priority y añadir sizes="(min-width: 768px) 50vw, 100vw". En ExpertsSection quitar priority y dejar todas las fotos con carga diferida por defecto.

#### UI-025 — La página /about no tiene <h1> (y OurCompromiseSection salta a <h3> sin <h2>)

- **Severidad:** ⚪ low · **Categoría:** a11y · **Estado:** nuevo · **Verificación:** sin verificar (reportada por 1 auditor)
- **Ubicación:** `src/components/sections/aboutus/AboutUsSection.tsx:32` · relacionados: `src/components/sections/aboutus/OurCompromiseSection.tsx`, `src/app/about/page.tsx`
- **Problema:** El primer encabezado de /about es un <h2> ("¿Quiénes Somos?"); ExpertsSection y SelectionProcessSection también usan <h2> y OurCompromiseSection arranca directamente con <h3> sin un <h2> de sección. No hay ningún <h1> en la página, a diferencia de /terms, /privacy y 404. Rompe la jerarquía de encabezados para lectores de pantalla y resta una señal SEO básica en una de las páginas del sitemap con prioridad 0.8.
- **Evidencia:**

```ts
<h2
  className={`animate-on-scroll ${isInView ? 'in-view' : ''} font-display text-4xl md:text-5xl font-bold text-title-dark mb-8`}
>
  ¿Quiénes <span className="gradient-text">Somos</span>?
</h2>
```

- **Escenario de fallo:** Usuario de lector de pantalla pulsa la tecla de salto a h1 en /about: no hay ninguno; la lista de encabezados empieza en nivel 2 y luego muestra h3 huérfanos. Las herramientas de auditoría SEO (Lighthouse/Ahrefs) reportan "Page has no h1".
- **Arreglo propuesto:** Convertir el encabezado de AboutUsSection en <h1> (misma clase visual) y añadir un <h2> (puede ser sr-only, p. ej. "Nuestro compromiso") al inicio de OurCompromiseSection.

#### UI-026 — Contenido a medias en Expertos: dos perfiles con bio vacía y rol genérico, y botón "Video próximamente" deshabilitado en los 10 (videoUrl nunca se define: rama muerta)

- **Severidad:** ⚪ low · **Categoría:** copy · **Estado:** nuevo · **Verificación:** sin verificar (reportada por 1 auditor)
- **Ubicación:** `src/components/sections/aboutus/ExpertsSection.tsx:71`
- **Problema:** Alejandro Martínez y Denisse Tamez Escamilla tienen bio '' (esta última con rol literal 'Especialista'), por lo que su modal muestra "Descripción próximamente.". Ningún experto define videoUrl, así que la rama <a>Ver video</a> (líneas 189-198) es código muerto y todos los modales muestran un botón gris deshabilitado "Video próximamente". En una página cuyo argumento comercial es la credibilidad de los expertos, esto delata funcionalidad sin terminar.
- **Evidencia:**

```ts
{
  name: 'Alejandro Martínez',
  role: 'Ing. Electrónico · Sistemas Embebidos',
  image: imgAlejandro,
  bio: '',
},
{
  name: 'Denisse Tamez Escamilla',
  role: 'Especialista',
  image: imgDenisse,
  bio: '',
},
```

- **Escenario de fallo:** Una empresa prospecto abre /about, hace clic en "Denisse Tamez Escamilla — Especialista" y ve "Descripción próximamente." más un botón deshabilitado "Video próximamente"; lo mismo (botón muerto) en los otros 9 expertos.
- **Arreglo propuesto:** No renderizar el botón de video cuando no hay videoUrl (eliminar la rama disabled). Para perfiles sin bio: completar el contenido con el negocio o, mientras tanto, no abrir modal para ellos (tarjeta no clicable) y exigir rol específico. Mover el array experts a un archivo de datos tipado donde bio sea obligatorio no vacío.

#### UI-027 — El efecto hover de las tarjetas de expertos no funciona: .animate-on-scroll.in-view fija transform y el transitionDelay inline persiste

- **Severidad:** ⚪ low · **Categoría:** frontend-bug · **Estado:** nuevo · **Verificación:** sin verificar (reportada por 1 auditor)
- **Ubicación:** `src/components/sections/aboutus/ExpertsSection.tsx:121` · relacionados: `src/app/globals.css`, `src/components/sections/aboutus/SelectionProcessSection.tsx`
- **Problema:** Las reglas .animate-on-scroll / .animate-on-scroll.in-view están fuera de @layer y después de @tailwind utilities en globals.css, así que a igual especificidad (0,2,0) ganan a las utilidades de Tailwind. .animate-on-scroll.in-view impone transform: translateY(0), que anula hover:-translate-y-1 (.hover\:-translate-y-1:hover también es 0,2,0 pero va antes en la cascada): la tarjeta nunca se eleva. Además el shorthand transition de .animate-on-scroll sustituye a transition-all (la sombra hover:shadow-lg aparece de golpe) y el style inline transitionDelay: index*80ms sigue activo tras el reveal, retrasando hasta 720 ms cualquier transición de transform/opacity en la última tarjeta. El mismo patrón anula transition-colors en SelectionProcessSection.tsx:112.
- **Evidencia:**

```ts
// ExpertsSection.tsx:121-122
className={`animate-on-scroll ${isInView ? 'in-view' : ''} bg-white rounded-2xl p-6 md:p-7 shadow-sm hover:shadow-lg transition-all text-center cursor-pointer hover:-translate-y-1`}
style={{ transitionDelay: `${index * 80}ms` }}
// globals.css:98-107 (sin @layer, después de @tailwind utilities)
.animate-on-scroll {
  opacity: 0;
  transform: translateY(30px);
  transition: opacity 0.6s ease-out, transform 0.6s ease-out;
}
.animate-on-scroll.in-view {
  opacity: 1;
  transform: translateY(0);
}
```

- **Escenario de fallo:** En /about, al pasar el ratón por cualquier tarjeta de experto la sombra cambia bruscamente pero la tarjeta no se eleva como indica hover:-translate-y-1; el efecto diseñado nunca se ve.
- **Arreglo propuesto:** Separar responsabilidades: aplicar animate-on-scroll a un wrapper <div> (con su transitionDelay) y dejar el <button> interior con hover:-translate-y-1 transition-all; o mover las reglas de reveal a @layer components para que las utilidades puedan sobrescribirlas y limpiar el transitionDelay al terminar (onTransitionEnd).

#### UI-028 — Modal de detalle de experto sin Escape, role="dialog"/aria-modal, gestión de foco ni bloqueo de scroll

- **Severidad:** ⚪ low · **Categoría:** a11y · **Estado:** nuevo · **Verificación:** sin verificar (reportada por 1 auditor)
- **Ubicación:** `src/components/sections/aboutus/ExpertsSection.tsx:148`
- **Problema:** La auditoría de junio (#59) añadió Escape + role=dialog/aria-modal a ApplyJobModal y CandidateProfileModal, pero este modal de la página pública /about quedó fuera. El overlay es un <div> con onClick, sin role ni aria-modal ni aria-labelledby; no hay listener de Escape; al abrir no se mueve el foco al diálogo ni se devuelve a la tarjeta al cerrar; no hay trampa de foco y el fondo sigue desplazándose.
- **Evidencia:**

```ts
{selectedExpert && (
  <div
    className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
    onClick={() => setSelectedExpert(null)}
  >
    <div
      className="bg-white rounded-2xl p-6 md:p-8 max-w-lg w-full max-h-[90vh] overflow-y-auto relative"
      onClick={(e) => e.stopPropagation()}
    >
```

- **Escenario de fallo:** Usuario de teclado pulsa Enter sobre la tarjeta de un experto: el modal se abre pero el foco sigue en la tarjeta de fondo; Tab recorre los elementos de detrás del overlay, Escape no cierra, y un lector de pantalla no anuncia que se abrió un diálogo.
- **Arreglo propuesto:** Añadir role="dialog" aria-modal="true" aria-labelledby al panel (id en el <h3> del nombre), useEffect con keydown Escape -> setSelectedExpert(null), mover el foco al botón Cerrar al abrir y restaurarlo a la tarjeta origen al cerrar, bloquear scroll del body mientras esté abierto. Idealmente extraer un componente Modal compartido reutilizando lo hecho en #59.

#### UI-029 — useCountUp no cancela requestAnimationFrame, ignora prefers-reduced-motion y el HTML servido contiene 0 como valor

- **Severidad:** ⚪ low · **Categoría:** frontend-bug · **Estado:** nuevo · **Verificación:** sin verificar (reportada por 1 auditor)
- **Ubicación:** `src/hooks/useCountUp.ts:17` · relacionados: `src/components/sections/home/StatsSection.tsx`, `src/app/globals.css`
- **Problema:** El efecto lanza un bucle rAF sin función de limpieza: si el componente se desmonta durante los 2 s de animación el bucle sigue llamando setCount, y si end/duration cambian a mitad se solapan dos bucles que escriben valores distintos (parpadeo). globals.css declara respetar prefers-reduced-motion, pero esta animación es JS y no se ve afectada. El estado inicial es 0, así que el HTML de servidor (y lo que ve un usuario sin JS o un rastreador sin render) es "0%", "0+" en las cifras de StatsSection.
- **Evidencia:**

```ts
useEffect(() => {
  if (!start) return;

  let startTime: number;
  const step = (timestamp: number) => {
    if (!startTime) startTime = timestamp;
    const progress = Math.min((timestamp - startTime) / duration, 1);
    setCount(Math.floor(progress * end));
    if (progress < 1) requestAnimationFrame(step);
  };

  requestAnimationFrame(step);
}, [end, duration, start]);
```

- **Escenario de fallo:** Usuario con "reducir movimiento" activado entra a la home: las cifras siguen contando durante 2 s pese a la preferencia. Usuario que navega a otra página antes de que termine el conteo deja ~100 llamadas setState sobre un componente desmontado. Vista sin JS: "0% evaluados por humanos".
- **Arreglo propuesto:** Guardar el id (let raf = requestAnimationFrame(step)) y devolver () => cancelAnimationFrame(raf); si window.matchMedia('(prefers-reduced-motion: reduce)').matches hacer setCount(end) directamente; inicializar useState(end) en servidor y reiniciar a 0 solo en cliente justo antes de animar (o renderizar el valor final dentro de <noscript>).
