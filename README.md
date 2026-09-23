# 🚀 INAKAT - Plataforma de Reclutamiento

**INAKAT** es una plataforma moderna de reclutamiento que conecta empresas con talento calificado en México. Combina evaluación humana (psicólogos y especialistas técnicos) con soporte de IA para ofrecer procesos de selección de alta calidad.

> **Versión:** 1.0.0 MVP  
> **Última actualización:** 22 de Septiembre 2026  
> **Tests:** `npm test` (el conteo exacto lo imprime jest; no se documenta aquí para no quedar desfasado)  
> **Estado:** en producción · auditoría 2026-09 en remediación (ver `docs/AUDITORIA-2026-09.md`)

---

## ✨ Características Principales

### 👤 Para Candidatos

- ✅ Búsqueda avanzada de vacantes con filtros
- ✅ Aplicación rápida con CV y carta de presentación
- ✅ Seguimiento del estado de aplicaciones
- ✅ Perfil editable con información personal
- ✅ Login con credenciales propias
- 🚧 Perfil completo con experiencia laboral (en progreso)

### 🏢 Para Empresas

- ✅ Registro y aprobación de empresas
- ✅ Publicación de vacantes con sistema de créditos
- ✅ Dashboard con métricas de sus vacantes
- ✅ Gestión de candidatos aprobados por especialistas
- ✅ Visualización de notas de evaluadores
- ✅ Sistema de créditos con MercadoPago

### 👨‍💼 Para Reclutadores (Psicólogos)

- ✅ Dashboard de vacantes asignadas
- ✅ Evaluación psicológica de candidatos
- ✅ Envío de candidatos a especialistas
- ✅ Notas de evaluación
- ✅ Filtrado de candidatos del banco

### 🔧 Para Especialistas (Técnicos)

- ✅ Dashboard de vacantes asignadas
- ✅ Evaluación técnica de candidatos
- ✅ Envío de candidatos a empresas
- ✅ Notas técnicas de evaluación
- ✅ Visualización de notas del reclutador

### 👑 Para Administradores

- ✅ Gestión completa de usuarios (CRUD)
- ✅ Aprobación/rechazo de empresas
- ✅ Asignación de reclutadores y especialistas a vacantes
- ✅ Inyección de candidatos (LinkedIn, OCC, manual)
- ✅ Bandeja de aplicaciones directas
- ✅ Gestión de matriz de precios
- ✅ Dashboard con estadísticas globales
- ✅ CRUD de especialidades

---

## 🛠️ Stack Tecnológico

### Frontend

- **Next.js 15** - Framework React con App Router
- **TypeScript** - Tipado estático
- **Tailwind CSS** - Estilos utility-first
- **Lucide React** - Iconos
- **Framer Motion** - Animaciones

### Backend

- **Next.js API Routes** - Endpoints RESTful
- **Prisma ORM 6.6** - Base de datos
- **PostgreSQL** - Base de datos (Supabase)
- **JWT** - Autenticación con jsonwebtoken
- **bcryptjs** - Hash de contraseñas
- **MercadoPago** - Pagos

### Infraestructura

- **Vercel** - Hosting y deployment
- **Vercel Blob** - Almacenamiento de archivos
- **Supabase** - Base de datos PostgreSQL
- **GitHub** - Control de versiones

### Testing

- **Jest 30** - Framework de testing (unitarios y de API)
- **Testing Library** - Testing de componentes
- **Playwright** - Pruebas end-to-end (`npm run test:e2e`)

---

## 👥 Roles del Sistema

| Rol            | Descripción               | Acceso                             |
| -------------- | ------------------------- | ---------------------------------- |
| **admin**      | Administrador del sistema | `/admin/*`                         |
| **company**    | Empresa registrada        | `/company/*`                       |
| **recruiter**  | Reclutador/Psicólogo      | `/recruiter/*`                     |
| **specialist** | Especialista técnico      | `/specialist/*`                    |
| **candidate**  | Candidato con cuenta      | `/candidate/*`, `/my-applications` |
| **user**       | Usuario general           | `/talents`, `/profile`             |
| **vendor**     | Vendedor (comisiones)     | `/vendor/*`                        |

---

## 🔄 Flujo de Reclutamiento

```
Empresa publica vacante (con créditos)
         ↓
Admin asigna Reclutador + Especialista
         ↓
Candidatos aplican O Admin inyecta del banco
         ↓
Reclutador evalúa psicológicamente → sent_to_specialist
         ↓
Especialista evalúa técnicamente → sent_to_company
         ↓
Empresa ve candidatos aprobados + notas de evaluadores
         ↓
Empresa entrevista y decide
```

---

## 🚀 Inicio Rápido

### Prerequisitos

- Node.js 22 o superior (`@vercel/blob` exige >= 20; producción y CI usan 22)
- npm
- Cuenta de Supabase
- Cuenta de Vercel
- Cuenta de MercadoPago (sandbox)

### Instalación

```bash
# Clonar el repositorio
git clone https://github.com/Inakat-Human-Resources/inakat.git
cd inakat

# Instalar dependencias
npm install

# Configurar variables de entorno
# (debe ser .env: el CLI de Prisma NO lee .env.local)
cp .env.example .env

# Configurar base de datos
npx prisma generate
npx prisma db push   # el historial de migraciones aún no tiene baseline: NO usar migrate dev
npx prisma db seed   # requiere las 8 variables SEED_*_PASSWORD del .env

# Ejecutar en desarrollo
npm run dev
```

Abre [http://localhost:3000](http://localhost:3000)

---

## 🔐 Cuentas de Prueba (seed local)

⚠️ **Las contraseñas del seed NO se publican en la documentación.** Cada entorno
define las suyas en `.env` mediante las variables `SEED_*_PASSWORD` (ver
`.env.example`). El seed aborta si falta alguna.

| Rol              | Email                        | Contraseña                   |
| ---------------- | ---------------------------- | ---------------------------- |
| **Admin**        | `ADMIN_EMAIL` (o `admin@inakat.com`) | `SEED_ADMIN_PASSWORD`  |
| **Empresa**      | contact@techsolutions.mx     | `SEED_COMPANY_PASSWORD`      |
| **Empresa**      | rh@creativedigital.mx        | `SEED_COMPANY_PASSWORD`      |
| **Empresa**      | hr@grupofinanciero.mx        | `SEED_COMPANY_PASSWORD`      |
| **Reclutador**   | reclutador1@inakat.com       | `SEED_RECRUITER_PASSWORD`    |
| **Reclutador**   | reclutador2@inakat.com       | `SEED_RECRUITER_PASSWORD`    |
| **Especialista** | especialista.tech@inakat.com | `SEED_SPECIALIST_PASSWORD`   |
| **Especialista** | ludim@inakat.com             | `SEED_STAFF_PASSWORD`        |
| **Candidato**    | candidato.test@example.com   | `SEED_CANDIDATE_PASSWORD`    |
| **Usuario**      | carlos.dev@example.com       | `SEED_USER_PASSWORD`         |

Estas cuentas son **sólo para entornos locales o de prueba**. Nunca siembres una
base de producción con contraseñas compartidas.

---

## 🔐 Variables de Entorno

La **única fuente de verdad** es [`.env.example`](./.env.example): cópialo a
`.env` y rellena los valores. Resumen de los grupos que hay que definir:

| Grupo             | Variables                                                                                                   | ¿Obligatorio?                       |
| ----------------- | ----------------------------------------------------------------------------------------------------------- | ----------------------------------- |
| Base de datos     | `DATABASE_URL` (pooler 6543 + `pgbouncer=true`), `DIRECT_URL` (5432)                                          | Sí                                  |
| Autenticación     | `JWT_SECRET` (mínimo 32 caracteres), `JWT_EXPIRES_IN`                                                          | Sí                                  |
| Admin inicial     | `ADMIN_EMAIL`, `ADMIN_NOMBRE`                                                                                  | Sí para el seed                     |
| Seed              | `SEED_ADMIN_PASSWORD`, `SEED_ADMIN2_PASSWORD`, `SEED_COMPANY_PASSWORD`, `SEED_RECRUITER_PASSWORD`, `SEED_SPECIALIST_PASSWORD`, `SEED_CANDIDATE_PASSWORD`, `SEED_USER_PASSWORD`, `SEED_STAFF_PASSWORD` | Sí para `prisma db seed` |
| Archivos          | `BLOB_READ_WRITE_TOKEN`                                                                                        | Sí en producción                    |
| Pagos             | `MERCADOPAGO_ACCESS_TOKEN`, `NEXT_PUBLIC_MERCADOPAGO_PUBLIC_KEY`, `MERCADOPAGO_WEBHOOK_SECRET`                  | Sí para créditos/checkout           |
| Correo            | `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM`                                                | Sí en producción (si no, se descarta el correo en silencio) |
| Mapas             | `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`                                                                              | Sí para autocompletado de direcciones |
| App               | `NEXT_PUBLIC_APP_URL`                                                                                          | Sí                                  |

> `MERCADOPAGO_PUBLIC_KEY` **no existe**: el navegador lee
> `NEXT_PUBLIC_MERCADOPAGO_PUBLIC_KEY`. `ADMIN_PASSWORD` tampoco se usa ya: el
> seed lee `SEED_ADMIN_PASSWORD`.

---

## 📦 Scripts Disponibles

```bash
npm run dev          # Desarrollo
npm run build        # Build de producción
npm run start        # Servidor de producción
npm run lint         # Linter
npm test             # Ejecutar tests de jest
npm run test:watch   # Tests en modo watch
npm run test:coverage # Tests con coverage
npm run test:e2e     # Tests end-to-end (Playwright; requiere .env.e2e)
npx prisma db seed   # Sembrar la base (requiere las variables SEED_*)
```

---

## 🗄️ Modelos de Datos

| Modelo                | Descripción                             |
| --------------------- | --------------------------------------- |
| **User**              | Usuarios del sistema (6 roles)          |
| **CompanyRequest**    | Solicitudes de registro de empresas     |
| **Job**               | Vacantes publicadas                     |
| **Application**       | Aplicaciones de candidatos              |
| **Candidate**         | Candidatos del banco (inyectados)       |
| **Experience**        | Experiencia laboral de candidatos       |
| **JobAssignment**     | Asignaciones de reclutador/especialista |
| **PricingMatrix**     | Matriz de precios por perfil/seniority  |
| **CreditPurchase**    | Compras de créditos                     |
| **CreditTransaction** | Historial de créditos                   |
| **Specialty**         | Especialidades/perfiles                 |
| **ContactMessage**    | Mensajes de contacto                    |

---

## 📊 Estado del Proyecto

### ✅ Completado (MVP)

- Sistema de autenticación JWT
- 6 roles de usuario
- Gestión de empresas (registro, aprobación)
- Publicación de vacantes con créditos
- Sistema de créditos con MercadoPago
- Flujo completo: Reclutador → Especialista → Empresa
- Inyección de candidatos (LinkedIn, OCC, manual)
- Bandeja de aplicaciones directas
- Status "Descartado" en todo el flujo
- Empresa ve notas de evaluadores
- Correos automáticos con nodemailer/SMTP
- "Olvidé mi contraseña" (reset por token)
- Notificaciones en la aplicación
- Solicitudes y agenda de entrevistas
- Rol vendor (comisiones por venta de créditos)
- Puente de integración Worky2 (`/api/integration/*`, API keys y webhooks firmados)

### 🚧 En Progreso

- Remediación de la auditoría 2026-09 (ver `docs/AUDITORIA-2026-09.md`)
- Rediseño de las páginas públicas

### 📋 Planificado

- Chat/mensajería
- IA para matching

---

## 🧪 Testing

```bash
# Ejecutar todos los tests de jest
npm test

# Sólo los smoke tests
npm run test:smoke

# End-to-end (requiere .env.e2e y una base sembrada)
npm run test:e2e
```

El conteo de suites y de tests cambia en cada iteración: el número bueno es el
que imprime jest, no el que esté escrito en un documento.

---

## 📖 Documentación

- 📘 [Guía de Instalación](./docs/INSTALLATION.md)
- 👥 [Guía de Usuario](./docs/USER_GUIDE.md)
- 🔌 [Documentación de API](./docs/API.md)
- 🐛 [Troubleshooting](./docs/TROUBLESHOOTING.md)
- 🚀 [Guía de Deploy](./docs/DEPLOYMENT.md)
- 💳 [Guía MercadoPago](./docs/GUIA-MERCADOPAGO.md)
- 🔌 [Integración Worky2](./docs/WORKY2_INTEGRATION.md)
- 🔍 [Auditoría 2026-09](./docs/AUDITORIA-2026-09.md)

---

## 👥 Equipo

- **Guillermo Sánchez (Memo)** - Lead Developer
- **Lalo** - Product Owner
- **Ludim** - DevOps & Code Review
- **Eduardo** - QA & Feedback

---

## 📧 Contacto

- Website: [www.inakat.com](https://www.inakat.com)
- Email: contacto@inakat.com

---

**Made with ❤️ in México**

_Última actualización: 22 de Septiembre 2026_
