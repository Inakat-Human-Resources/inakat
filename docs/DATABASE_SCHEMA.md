# 🗄️ Esquema de Base de Datos - INAKAT

Documentación completa del modelo de datos de INAKAT.

---

## 📊 Diagrama de Relaciones

```
┌─────────────┐         ┌──────────────────┐         ┌─────────────┐
│    User     │────────>│ CompanyRequest   │         │     Job     │
│             │ 1:1     │                  │         │             │
│  id (PK)    │         │  id (PK)         │         │  id (PK)    │
│  email      │         │  userId (FK)     │    ┌───>│  companyId  │
│  password   │         │  nombreEmpresa   │    │    │  title      │
│  role       │         │  rfc             │    │    │  location   │
└──────┬──────┘         └──────────────────┘    │    └──────┬──────┘
       │                                         │           │
       │ 1:N                                     │           │ 1:N
       │                                         │           │
       └────────────────────────────────────────┘           │
                                                             │
                                                             v
                                                    ┌─────────────────┐
                                                    │  Application    │
                                                    │                 │
                                                    │  id (PK)        │
                                                    │  jobId (FK)     │
                                                    │  userId (FK)    │
                                                    │  candidateName  │
                                                    │  status         │
                                                    └─────────────────┘

┌──────────────────┐
│ ContactMessage   │
│                  │
│  id (PK)         │
│  nombre          │
│  email           │
│  mensaje         │
└──────────────────┘
```

---

## 📋 Modelos

### 1. User (Usuarios)

**Propósito:** Usuarios del sistema (administradores, empresas, candidatos)

```prisma
model User {
  id                Int       @id @default(autoincrement())
  email             String    @unique
  password          String
  nombre            String
  apellidoPaterno   String?
  apellidoMaterno   String?
  role              String    @default("user")
  isActive          Boolean   @default(true)
  emailVerified     DateTime?
  lastLogin         DateTime?
  createdAt         DateTime  @default(now())
  updatedAt         DateTime  @updatedAt
  
  companyRequest    CompanyRequest?
  jobs              Job[]
  applications      Application[]
}
```

**Campos:**

| Campo | Tipo | Requerido | Descripción |
|-------|------|-----------|-------------|
| `id` | Int | ✅ | ID único auto-incremental |
| `email` | String | ✅ | Email único (índice) |
| `password` | String | ✅ | Hash bcrypt de contraseña |
| `nombre` | String | ✅ | Nombre del usuario |
| `apellidoPaterno` | String | ❌ | Apellido paterno |
| `apellidoMaterno` | String | ❌ | Apellido materno |
| `role` | String | ✅ | Rol: "admin", "company", "user" |
| `isActive` | Boolean | ✅ | Usuario activo (default: true) |
| `emailVerified` | DateTime | ❌ | Fecha de verificación de email |
| `lastLogin` | DateTime | ❌ | Último login |
| `createdAt` | DateTime | ✅ | Fecha de creación |
| `updatedAt` | DateTime | ✅ | Última actualización |

**Relaciones:**
- `companyRequest` → CompanyRequest (1:1)
- `jobs` → Job[] (1:N)
- `applications` → Application[] (1:N)

**Índices:**
- `email` (unique)
- `role`
- `isActive`

**Ejemplo de registro:**
```json
{
  "id": 1,
  "email": "admin@inakat.com",
  "password": "$2a$10$...", // bcrypt hash
  "nombre": "Administrador",
  "apellidoPaterno": null,
  "apellidoMaterno": null,
  "role": "admin",
  "isActive": true,
  "emailVerified": "2025-01-15T10:00:00.000Z",
  "lastLogin": "2025-01-16T08:30:00.000Z",
  "createdAt": "2025-01-10T00:00:00.000Z",
  "updatedAt": "2025-01-16T08:30:00.000Z"
}
```

---

### 2. CompanyRequest (Solicitudes de Empresas)

**Propósito:** Solicitudes de registro de empresas

```prisma
model CompanyRequest {
  id                        Int       @id @default(autoincrement())
  nombre                    String
  apellidoPaterno           String
  apellidoMaterno           String
  nombreEmpresa             String
  correoEmpresa             String
  sitioWeb                  String?
  razonSocial               String
  rfc                       String    @unique
  direccionEmpresa          String
  identificacionUrl         String?
  documentosConstitucionUrl String?
  status                    String    @default("pending")
  rejectionReason           String?
  createdAt                 DateTime  @default(now())
  updatedAt                 DateTime  @updatedAt
  approvedAt                DateTime?
  userId                    Int?      @unique
  user                      User?     @relation(fields: [userId], references: [id])
}
```

**Campos:**

| Campo | Tipo | Requerido | Descripción |
|-------|------|-----------|-------------|
| `id` | Int | ✅ | ID único |
| `nombre` | String | ✅ | Nombre del representante |
| `apellidoPaterno` | String | ✅ | Apellido paterno |
| `apellidoMaterno` | String | ✅ | Apellido materno |
| `nombreEmpresa` | String | ✅ | Nombre de la empresa |
| `correoEmpresa` | String | ✅ | Email de la empresa |
| `sitioWeb` | String | ❌ | URL del sitio web |
| `razonSocial` | String | ✅ | Razón social |
| `rfc` | String | ✅ | RFC (único) |
| `direccionEmpresa` | String | ✅ | Dirección completa |
| `identificacionUrl` | String | ❌ | URL del documento de identificación |
| `documentosConstitucionUrl` | String | ❌ | URL del acta constitutiva |
| `status` | String | ✅ | Estado: "pending", "approved", "rejected" |
| `rejectionReason` | String | ❌ | Razón del rechazo |
| `createdAt` | DateTime | ✅ | Fecha de creación |
| `updatedAt` | DateTime | ✅ | Última actualización |
| `approvedAt` | DateTime | ❌ | Fecha de aprobación |
| `userId` | Int | ❌ | ID del usuario (cuando se aprueba) |

**Estados:**
- `pending` - En revisión
- `approved` - Aprobada, cuenta creada
- `rejected` - Rechazada

**Índices:**
- `rfc` (unique)
- `status`
- `createdAt`
- `correoEmpresa`

**Flujo:**
1. Empresa envía solicitud → `status: "pending"`
2. Admin revisa y aprueba → `status: "approved"`, se crea User
3. O admin rechaza → `status: "rejected"` con `rejectionReason`

---

### 3. Job (Vacantes)

**Propósito:** Vacantes de trabajo publicadas

```prisma
model Job {
  id            Int       @id @default(autoincrement())
  title         String
  company       String
  location      String
  salary        String
  jobType       String
  isRemote      Boolean   @default(false)
  description   String    @db.Text
  requirements  String?   @db.Text
  status        String    @default("active")
  companyId     Int?
  company_user  User?     @relation(fields: [companyId], references: [id])
  companyRating Float?
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt
  expiresAt     DateTime?
  applications  Application[]
}
```

**Campos:**

| Campo | Tipo | Requerido | Descripción |
|-------|------|-----------|-------------|
| `id` | Int | ✅ | ID único |
| `title` | String | ✅ | Título de la vacante |
| `company` | String | ✅ | Nombre de la empresa |
| `location` | String | ✅ | Ubicación |
| `salary` | String | ✅ | Rango salarial |
| `jobType` | String | ✅ | Tipo: "Tiempo Completo", "Medio Tiempo", etc. |
| `isRemote` | Boolean | ✅ | Trabajo remoto (default: false) |
| `description` | Text | ✅ | Descripción completa |
| `requirements` | Text | ❌ | Requisitos |
| `status` | String | ✅ | Estado: "active", "closed", "draft" |
| `companyId` | Int | ❌ | ID de la empresa (User) |
| `companyRating` | Float | ❌ | Rating de la empresa (1-5) |
| `createdAt` | DateTime | ✅ | Fecha de creación |
| `updatedAt` | DateTime | ✅ | Última actualización |
| `expiresAt` | DateTime | ❌ | Fecha de expiración |

**Tipos de Trabajo:**
- "Tiempo Completo"
- "Medio Tiempo"
- "Por Proyecto"
- "Temporal"
- "Prácticas"

**Estados:**
- `active` - Activa, aceptando aplicaciones
- `closed` - Cerrada, no acepta aplicaciones
- `draft` - Borrador, no visible públicamente

**Índices:**
- `status`
- `companyId`
- `createdAt`
- `location`
- `jobType`

**Ejemplo:**
```json
{
  "id": 1,
  "title": "Desarrollador Full Stack",
  "company": "TechSolutions México",
  "location": "Monterrey, Nuevo León",
  "salary": "$35,000 - $50,000 / mes",
  "jobType": "Tiempo Completo",
  "isRemote": true,
  "description": "Estamos buscando un desarrollador...",
  "requirements": "3+ años de experiencia con JavaScript...",
  "status": "active",
  "companyId": 5,
  "companyRating": 4.5,
  "createdAt": "2025-01-15T10:00:00.000Z",
  "updatedAt": "2025-01-15T10:00:00.000Z",
  "expiresAt": "2025-03-15T00:00:00.000Z"
}
```

---

### 4. Application (Aplicaciones)

**Propósito:** Aplicaciones de candidatos a vacantes

```prisma
model Application {
  id              Int       @id @default(autoincrement())
  jobId           Int
  job             Job       @relation(fields: [jobId], references: [id])
  userId          Int?
  user            User?     @relation(fields: [userId], references: [id])
  candidateName   String
  candidateEmail  String
  candidatePhone  String?
  cvUrl           String?
  coverLetter     String?   @db.Text
  status          String    @default("pending")
  notes           String?   @db.Text
  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt
  reviewedAt      DateTime?
}
```

**Campos:**

| Campo | Tipo | Requerido | Descripción |
|-------|------|-----------|-------------|
| `id` | Int | ✅ | ID único |
| `jobId` | Int | ✅ | ID de la vacante |
| `userId` | Int | ❌ | ID del usuario (si está registrado) |
| `candidateName` | String | ✅ | Nombre completo |
| `candidateEmail` | String | ✅ | Email de contacto |
| `candidatePhone` | String | ❌ | Teléfono |
| `cvUrl` | String | ❌ | URL del CV |
| `coverLetter` | Text | ❌ | Carta de presentación |
| `status` | String | ✅ | Estado de la aplicación |
| `notes` | Text | ❌ | Notas internas del reclutador |
| `createdAt` | DateTime | ✅ | Fecha de aplicación |
| `updatedAt` | DateTime | ✅ | Última actualización |
| `reviewedAt` | DateTime | ❌ | Fecha de revisión |

**Estados:**
- `pending` - Pendiente de revisión
- `reviewing` - En revisión
- `interviewed` - Entrevistado
- `accepted` - Aceptado/Contratado
- `rejected` - Rechazado

**Índices:**
- `jobId`
- `userId`
- `status`
- `candidateEmail`
- `createdAt`

**Validaciones:**
- Un email solo puede aplicar una vez a cada vacante
- Solo se puede aplicar a vacantes con `status: "active"`

**Ejemplo:**
```json
{
  "id": 1,
  "jobId": 1,
  "userId": null,
  "candidateName": "María González Hernández",
  "candidateEmail": "maria.gonzalez@email.com",
  "candidatePhone": "81 2345 6789",
  "cvUrl": "https://blob.vercel-storage.com/cv-123.pdf",
  "coverLetter": "Estimado equipo, me dirijo a ustedes...",
  "status": "pending",
  "notes": null,
  "createdAt": "2025-01-16T08:30:00.000Z",
  "updatedAt": "2025-01-16T08:30:00.000Z",
  "reviewedAt": null
}
```

---

### 5. ContactMessage (Mensajes de Contacto)

**Propósito:** Mensajes del formulario de contacto

```prisma
model ContactMessage {
  id        Int      @id @default(autoincrement())
  nombre    String
  email     String
  telefono  String?
  mensaje   String
  createdAt DateTime @default(now())
}
```

**Campos:**

| Campo | Tipo | Requerido | Descripción |
|-------|------|-----------|-------------|
| `id` | Int | ✅ | ID único |
| `nombre` | String | ✅ | Nombre del remitente |
| `email` | String | ✅ | Email de contacto |
| `telefono` | String | ❌ | Teléfono (opcional) |
| `mensaje` | String | ✅ | Mensaje |
| `createdAt` | DateTime | ✅ | Fecha de envío |

**Índices:**
- `createdAt`
- `email`

---

## 🔗 Relaciones

### User ↔ CompanyRequest (1:1)

```prisma
// User side
companyRequest  CompanyRequest?

// CompanyRequest side
userId  Int?  @unique
user    User? @relation(fields: [userId], references: [id])
```

**Comportamiento:**
- `onDelete: SetNull` - Si se elimina el User, la CompanyRequest queda sin userId

---

### User ↔ Job (1:N)

```prisma
// User side
jobs  Job[]

// Job side
companyId    Int?
company_user User? @relation(fields: [companyId], references: [id])
```

**Comportamiento:**
- `onDelete: SetNull` - Si se elimina el User, la Job queda sin companyId

---

### User ↔ Application (1:N)

```prisma
// User side
applications  Application[]

// Application side
userId  Int?
user    User? @relation(fields: [userId], references: [id])
```

**Comportamiento:**
- `onDelete: SetNull` - Si se elimina el User, la Application queda sin userId

---

### Job ↔ Application (1:N)

```prisma
// Job side
applications  Application[]

// Application side
jobId  Int
job    Job @relation(fields: [jobId], references: [id])
```

**Comportamiento:**
- `onDelete: Cascade` - Si se elimina la Job, todas las Applications se eliminan

---

## 📊 Estadísticas de Base de Datos

### Conteos Típicos

**Desarrollo (con seed):**
- Users: 2
- CompanyRequests: 0-5
- Jobs: 18
- Applications: 12
- ContactMessages: 0-10

**Producción (estimado primer año):**
- Users: 500-1,000
- CompanyRequests: 200-500
- Jobs: 500-1,500
- Applications: 5,000-20,000
- ContactMessages: 1,000-3,000

---

## 🔍 Queries Comunes

### Obtener vacantes activas

```typescript
const jobs = await prisma.job.findMany({
  where: {
    status: 'active'
  },
  orderBy: {
    createdAt: 'desc'
  }
});
```

### Aplicaciones de una vacante

```typescript
const applications = await prisma.application.findMany({
  where: {
    jobId: 1
  },
  include: {
    job: {
      select: {
        title: true,
        company: true
      }
    }
  }
});
```

### Solicitudes pendientes

```typescript
const pending = await prisma.companyRequest.findMany({
  where: {
    status: 'pending'
  },
  orderBy: {
    createdAt: 'asc'
  }
});
```

### Estadísticas de aplicaciones

```typescript
const stats = await prisma.application.groupBy({
  by: ['status'],
  _count: {
    status: true
  }
});
```

---

## 🔐 Seguridad

### Passwords

- ✅ Hash con bcrypt (10 rounds)
- ✅ Nunca almacenar en texto plano
- ✅ Validar complejidad antes de hash

### Datos Sensibles

- `User.password` - Hasheado
- `User.email` - Índice único, validado
- `CompanyRequest.rfc` - Índice único, validado
- `Application.cvUrl` - URLs firmadas de Vercel Blob

---

## 🚀 Migraciones

> ⚠️ **Estado actual: el historial de migraciones NO representa el esquema.**
> `prisma/migrations` sólo crea una parte de las tablas; el resto se aplicó con
> `db push`, también en producción. Hasta que se genere la migración *baseline*
> y se marque como aplicada en producción, **no se usan los comandos
> `migrate`**: ni `dev`, ni `reset`, ni `deploy`.

### Cambiar el esquema (desarrollo)

```bash
# 1. Editar prisma/schema.prisma
# 2. Sincronizar la base
npx prisma db push
# 3. Regenerar el cliente
npx prisma generate
```

### Aplicar en producción

Hoy se hace con `db push` contra `DIRECT_URL`, igual que en desarrollo, y con
respaldo previo. `migrate deploy` fallaría con *"relation already exists"*.

### Pendiente: generar la baseline

```bash
# Genera el SQL del esquema completo contra una base vacía
npx prisma migrate diff \
  --from-empty \
  --to-schema-datamodel prisma/schema.prisma \
  --script > prisma/migrations/0_baseline/migration.sql

# Marcarla como aplicada donde el esquema ya existe
npx prisma migrate resolve --applied 0_baseline
```

Mientras eso no esté hecho y verificado, `migrate reset` **borra todos los
datos** y `migrate dev` ofrece hacerlo por *drift*.

---

## 📈 Optimizaciones Futuras

### Índices Adicionales

```prisma
// Para búsquedas de texto
@@index([title, company, description(ops: raw("gin_trgm_ops"))])

// Para queries geográficas
@@index([location])
```

### Particionamiento

Para tablas grandes (Applications, ContactMessages):
- Particionar por fecha
- Archivar datos antiguos

### Caching

```typescript
// Redis para queries frecuentes
const jobs = await redis.get('active_jobs') 
  || await prisma.job.findMany(...);
```

---

**Última actualización:** Enero 2025
