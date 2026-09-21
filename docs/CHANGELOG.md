# 📝 Changelog - INAKAT

Todos los cambios notables de este proyecto serán documentados en este archivo.

El formato está basado en [Keep a Changelog](https://keepachangelog.com/es-ES/1.0.0/),
y este proyecto adhiere a [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [Unreleased]

### 🎨 Rediseño de la portada — 2026-09-21 (rama `feat/home-revamp`)

Concepto **«Arco»**, sacado del isotipo (un punto y un arco): siete patrones de
composición distintos, escala tipográfica que llega a 129 px y ocho mecanismos de
movimiento ligados al scroll con `animation-timeline` nativo — sin añadir ninguna
dependencia. Detalle completo, decisiones y trampas en
[`docs/HOME-REVAMP-2026-09.md`](./HOME-REVAMP-2026-09.md).

- **Agregado:** `src/app/home.css` (estilos de la home, todo con prefijo `hm-`);
  `src/components/sections/home/ProcessArc.tsx` (escena fijada de las 11 etapas);
  `src/components/sections/home/HomeCloseSection.tsx`;
  `src/components/sections/home/HomeMotion.tsx` (paralaje del puntero, botones
  imantados y la clase `.hm--js`); 19 tests en
  `__tests__/qa/home-revamp-sep2026.test.ts`.
- **Cambiado:** las 12 secciones de `src/components/sections/home/`;
  `SelectionProcessSection` ahora acepta `variant="grid" | "arc"` para que la home y
  `/about` compartan una sola fuente de las 11 etapas.
- **Corregido:** la foto del hero (generada por IA, con rótulos quemados) ya no se
  presenta como el equipo real de INAKAT; el acordeón de FAQ y el de especialidades
  pasan a `<details>` nativos (teclado y sin-JS gratis); las cifras se pintan desde el
  servidor en vez de con un contador JS; el título partido lleva `aria-label`.
- **Verificado:** Chrome real en 1440/1024/820v/390/360 sin desbordes, `reduce`
  motion con 0 animaciones corriendo, sin JS con 91 elementos clave visibles, los 32
  encabezados en el árbol de accesibilidad, `tsc` y `eslint` en 0.

#### Correcciones posteriores, ya en producción

- **La portada se quedaba en blanco al abrirse en una pestaña de fondo.** En una
  pestaña que no está al frente el reloj de animación no avanza, y
  `animation-fill-mode: both` deja el título y la foto clavados en su fotograma
  inicial. Ahora la clase `.hm--js` se pone sólo con `visibilityState === 'visible'`.
- **El mapa de México se veía roto:** los estados sin cobertura del PNG son
  (224,224,208) y el suelo de la sección es `#e8e7d4` — 1.07:1 de contraste, medio
  país invisible. Se re-tiñó ese color a (193,190,172) (1.50:1) sin tocar el verde ni
  el naranja de marca.
- **Los pines del mapa estaban puestos a ojo** y caían amontonados lejos de sus
  ciudades. Ahora salen de la proyección real del mapa, derivada de los tres estados
  que el PNG ya marcaba en naranja (CDMX, Jalisco y Nuevo León) usados como anclas.
- **La imagen del hero se veía borrosa:** es 1920×1280 (horizontal) dentro de un arco
  vertical, así que `object-fit: cover` la ampliaba 1.73×. Se recortó en origen a
  retrato 4:5 (752×940), sin la franja de rótulos quemados.

### 🔍 Auditoría integral — 2026-09-21

483 hallazgos en 166 archivos (1 crítico, 51 altos), con el parte de trabajo en
[`docs/AUDITORIA-2026-09.md`](./AUDITORIA-2026-09.md) y una ficha por defecto en
`docs/auditoria-2026-09/`. **Nada de esto está arreglado todavía.** Lo primero de la
lista es que `main` está en rojo: 4 tests de `__tests__/api/auth-reset-password.test.ts`
apuntan a un SQL que borró el PR #6, y CI corre `npm test` de forma bloqueante.

### Planificado
- Sistema de notificaciones por email
- Panel completo para empresas
- Chat entre reclutador y candidato
- Sistema de favoritos para candidatos
- Calendario de entrevistas
- Notificaciones in-app

---

## [1.0.0] - 2025-01-15

### 🎉 Lanzamiento Inicial

Primera versión estable de INAKAT con funcionalidad completa para MVP.

### ✨ Agregado

#### Autenticación y Usuarios
- Sistema completo de autenticación con JWT
- Roles de usuario (admin, company, user)
- Middleware de protección de rutas
- Hashing de contraseñas con bcrypt (10 rounds)
- Sistema de login con validación

#### Gestión de Empresas
- Formulario de registro de empresas
- Upload de documentos legales (ID, Acta Constitutiva)
- Sistema de aprobación/rechazo por admin
- Creación automática de cuenta al aprobar
- Validación de RFC único

#### Gestión de Vacantes
- CRUD completo de vacantes
- Filtros de búsqueda (ubicación, tipo, modalidad)
- Sistema de estados (active, closed, draft)
- Rating de empresas
- Fecha de expiración de vacantes
- 18 vacantes de ejemplo pre-cargadas

#### Sistema de Aplicaciones
- Formulario de aplicación a vacantes
- Upload de CV (PDF, DOC, DOCX)
- Carta de presentación opcional
- Validación de aplicación única por email/vacante
- Estados de aplicación (pending, reviewing, interviewed, accepted, rejected)
- Panel de gestión para reclutadores
- Filtros por estado
- Vista detallada de candidatos
- 12 aplicaciones de ejemplo pre-cargadas

#### Panel de Administración
- Dashboard con estadísticas
- Gestión de solicitudes de empresas
- Vista de todas las aplicaciones
- Descarga de documentos
- Sistema de notas internas

#### Base de Datos
- Schema completo con Prisma
- Migraciones configuradas
- Seed script con datos de ejemplo
- Índices optimizados
- Relaciones entre modelos

#### Infraestructura
- Next.js 14 con App Router
- TypeScript para type safety
- Tailwind CSS para estilos
- PostgreSQL (Supabase) como base de datos
- Vercel Blob para almacenamiento de archivos
- Deploy automático a Vercel

#### Seguridad
- Validación de inputs con Zod
- Headers de seguridad configurados
- Sanitización de archivos
- Protección contra SQL injection (Prisma)
- Variables de entorno para secrets
- Conexiones TLS a base de datos

#### Documentación
- README completo
- Guía de instalación
- Documentación de API
- Guía de usuario por roles
- Troubleshooting guide
- Variables de entorno documentadas
- Guía de deploy
- Esquema de base de datos
- Política de seguridad

---

## [0.3.0] - 2025-01-10

### ✨ Agregado
- Sistema completo de aplicaciones a vacantes
- Modal de aplicación en página de talentos
- Validación de duplicados
- Panel de gestión de aplicaciones para admin

### 🔧 Modificado
- Mejorado el componente de búsqueda de vacantes
- Optimizado el layout del dashboard admin
- Actualizado el schema de Prisma

### 🐛 Corregido
- Error al cargar aplicaciones sin CV
- Problema de validación en formulario de empresa
- Bug en filtros de búsqueda

---

## [0.2.0] - 2025-01-05

### ✨ Agregado
- Sistema de registro de empresas
- Upload de documentos con Vercel Blob
- Panel de admin para aprobar empresas
- Validación de RFC

### 🔧 Modificado
- Migrado de React Router a Next.js App Router
- Actualizado sistema de autenticación para usar jose
- Mejorada la UI del formulario de empresas

### 🐛 Corregido
- Error de middleware en rutas protegidas
- Problema con conexión pooling de Supabase
- Bug en generación de Prisma Client

---

## [0.1.0] - 2024-12-20

### ✨ Agregado
- Prototipo inicial con React
- Landing page
- Página de búsqueda de vacantes
- Diseño inicial de UI

### 🔧 Modificado
- Estructura de componentes
- Sistema de enrutamiento

---

## Tipos de Cambios

- `✨ Agregado` - Nueva funcionalidad
- `🔧 Modificado` - Cambios en funcionalidad existente
- `🗑️ Deprecado` - Funcionalidad que será removida
- `🐛 Corregido` - Bug fixes
- `🔒 Seguridad` - Fixes de seguridad
- `⚡ Performance` - Mejoras de rendimiento
- `📚 Documentación` - Cambios en documentación
- `🎨 Estilos` - Cambios de UI/UX

---

## Versionado

INAKAT sigue [Semantic Versioning](https://semver.org/):

- **MAJOR** (X.0.0) - Cambios incompatibles con versiones anteriores
- **MINOR** (1.X.0) - Nueva funcionalidad compatible
- **PATCH** (1.0.X) - Bug fixes compatibles

---

## Roadmap

### Q1 2025 (Enero - Marzo)

**v1.1.0 - Sistema de Notificaciones**
- [ ] Emails transaccionales (SendGrid/Resend)
- [ ] Notificaciones de nueva aplicación
- [ ] Notificaciones de cambio de estado
- [ ] Templates de email profesionales
- [ ] Configuración de preferencias

**v1.2.0 - Panel para Empresas**
- [ ] Dashboard con métricas
- [ ] Gestión de sus vacantes
- [ ] Vista de aplicaciones a sus vacantes
- [ ] Perfil de empresa editable
- [ ] Estadísticas de vacantes

**v1.3.0 - Mejoras de Búsqueda**
- [ ] Búsqueda full-text
- [ ] Filtros avanzados
- [ ] Guardar búsquedas
- [ ] Alertas de nuevas vacantes
- [ ] Recomendaciones personalizadas

---

### Q2 2025 (Abril - Junio)

**v1.4.0 - Sistema de Chat**
- [ ] Chat en tiempo real
- [ ] Mensajería entre reclutador y candidato
- [ ] Notificaciones de mensajes
- [ ] Historial de conversaciones

**v1.5.0 - Panel para Candidatos**
- [ ] Perfil de candidato
- [ ] Historial de aplicaciones
- [ ] Sistema de favoritos
- [ ] CV builder integrado

**v1.6.0 - Mobile App**
- [ ] App iOS (React Native)
- [ ] App Android (React Native)
- [ ] Push notifications
- [ ] Aplicación rápida desde móvil

---

### Q3 2025 (Julio - Septiembre)

**v2.0.0 - IA y Automatización**
- [ ] Matching inteligente con IA
- [ ] Recomendaciones automáticas
- [ ] Screening inicial de CVs
- [ ] Análisis de compatibilidad
- [ ] Sugerencias de mejora de CV

**v2.1.0 - Integraciones**
- [ ] LinkedIn integration
- [ ] Indeed integration
- [ ] Google Calendar sync
- [ ] Zoom/Meet integration
- [ ] ATS integration

---

### Q4 2025 (Octubre - Diciembre)

**v2.2.0 - Analytics Avanzado**
- [ ] Dashboard de métricas
- [ ] Reportes personalizados
- [ ] Análisis de tendencias
- [ ] Benchmarking de industria
- [ ] Export de datos

**v2.3.0 - Monetización**
- [ ] Planes de suscripción
- [ ] Featured jobs
- [ ] Promoción de vacantes
- [ ] Analytics premium
- [ ] Soporte prioritario

---

## Mantenimiento

### Actualizaciones Regulares

**Seguridad:**
- Actualización de dependencias: mensual
- Auditoría de seguridad: trimestral
- Rotación de secrets: semestral

**Performance:**
- Optimización de queries: trimestral
- Auditoría de bundle size: mensual
- Performance testing: continuo

**Dependencias:**
- Next.js: actualizar con cada versión estable
- Prisma: actualizar trimestralmente
- React: actualizar semestralmente
- Otras: según necesidad

---

## Deprecated

### Funcionalidades Descontinuadas

Actualmente no hay funcionalidades deprecadas.

Cuando se deprecie funcionalidad, se listará aquí con:
- Versión en que se deprecó
- Razón de deprecación
- Alternativa recomendada
- Fecha estimada de remoción

---

## Links

- [Repositorio](https://github.com/tu-usuario/inakat)
- [Issues](https://github.com/tu-usuario/inakat/issues)
- [Pull Requests](https://github.com/tu-usuario/inakat/pulls)
- [Releases](https://github.com/tu-usuario/inakat/releases)

---

## Contribuidores

Gracias a todos los que han contribuido al proyecto:

- **Guillermo Sánchez** - Desarrollo principal
- **INAKAT Team** - Product & Design

Ver lista completa: [CONTRIBUTORS.md](./CONTRIBUTORS.md)

---

**Última actualización:** Enero 2025
