# 🚀 INAKAT - Plataforma de Reclutamiento

**INAKAT** es una plataforma moderna de reclutamiento que conecta empresas con talento calificado en México. Combina evaluación humana (psicólogos y especialistas técnicos) con soporte de IA para ofrecer procesos de selección de alta calidad.

> **Versión:** 1.0.0 MVP  
> **Última actualización:** 14 de Diciembre 2024  
> **Tests:** 258 pasando ✅  
> **Estado:** MVP 98% Completo

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

- **Jest 30** - Framework de testing
- **Testing Library** - Testing de componentes
- **258 tests** pasando ✅

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

- Node.js 18+
- npm o yarn
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
cp .env.example .env.local

# Configurar base de datos
npx prisma generate
npx prisma db push
npx prisma db seed

# Ejecutar en desarrollo
npm run dev
```

Abre [http://localhost:3000](http://localhost:3000)

---

## 🔐 Credenciales de Prueba

| Rol              | Email                        | Password         |
| ---------------- | ---------------------------- | ---------------- |
| **Admin**        | admin@inakat.com             | AdminInakat2024! |
| **Empresa**      | contact@techsolutions.mx     | Company123!      |
| **Empresa**      | rh@creativedigital.mx        | Company123!      |
| **Empresa**      | hr@grupofinanciero.mx        | Company123!      |
| **Reclutador**   | reclutador1@inakat.com       | Recruiter2024!   |
| **Reclutador**   | reclutador2@inakat.com       | Recruiter2024!   |
| **Especialista** | especialista.tech@inakat.com | Specialist2024!  |
| **Especialista** | ludim@inakat.com             | Staff2024!       |
| **Candidato**    | candidato.test@gmail.com     | Candidate2024!   |
| **Usuario**      | carlos.dev@gmail.com         | User123!         |

---

## 🔐 Variables de Entorno

```env
# Base de datos (Supabase)
DATABASE_URL="postgresql://..."
DIRECT_URL="postgresql://..."

# Autenticación
JWT_SECRET="tu-secret-key"
JWT_EXPIRES_IN="7d"

# Upload de archivos (Vercel Blob)
BLOB_READ_WRITE_TOKEN="vercel_blob_..."

# MercadoPago
MERCADOPAGO_ACCESS_TOKEN="TEST-..."
MERCADOPAGO_PUBLIC_KEY="TEST-..."

# Admin
ADMIN_EMAIL="admin@inakat.com"
ADMIN_PASSWORD="AdminInakat2024!"

# App
NEXT_PUBLIC_APP_URL="http://localhost:3000"
```

---

## 📦 Scripts Disponibles

```bash
npm run dev          # Desarrollo
npm run build        # Build de producción
npm run start        # Servidor de producción
npm run lint         # Linter
npm test             # Ejecutar tests (258 tests)
npm run test:watch   # Tests en modo watch
npm run test:coverage # Tests con coverage
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
- 258 tests pasando

### 🚧 En Progreso

- Emails automáticos (SendGrid/Resend)
- "Olvidé mi contraseña"

### 📋 Planificado

- Perfil completo de candidato con experiencia
- Chat/mensajería
- Calendario de entrevistas
- IA para matching

---

## 🧪 Testing

```bash
# Ejecutar todos los tests
npm test

# Output esperado:
# Test Suites: 14 passed
# Tests:       258 passed
```

---

## 📖 Documentación

- 📘 [Guía de Instalación](./docs/INSTALLATION.md)
- 👥 [Guía de Usuario](./docs/USER_GUIDE.md)
- 🔌 [Documentación de API](./docs/API.md)
- 🐛 [Troubleshooting](./docs/TROUBLESHOOTING.md)
- 🚀 [Guía de Deploy](./docs/DEPLOYMENT.md)
- 💳 [Guía MercadoPago](./docs/GUIA-MERCADOPAGO.md)

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

_Última actualización: 14 de Diciembre 2024_
