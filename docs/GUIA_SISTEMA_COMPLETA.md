# GUIA COMPLETA DEL SISTEMA INAKAT

## Version 1.0 - Diciembre 2024

---

## INDICE

1. [Introduccion](#introduccion)
2. [Arquitectura del Sistema](#arquitectura)
3. [Roles y Permisos](#roles)
4. [Flujos de Trabajo](#flujos)
5. [APIs del Sistema](#apis)
6. [Base de Datos](#base-de-datos)
7. [Sistema de Creditos](#creditos)
8. [Sistema de Vendedores](#vendedores)
9. [Guia de Desarrollo](#desarrollo)
10. [Troubleshooting](#troubleshooting)

---

## 1. Introduccion

INAKAT es una plataforma de reclutamiento integral para el mercado mexicano que conecta empresas con talento calificado a traves de un proceso de evaluacion multi-etapa.

### Caracteristicas Principales

- Sistema de creditos para publicacion de vacantes
- Evaluacion dual: psicologos + especialistas tecnicos
- Banco de candidatos con inyeccion desde LinkedIn/OCC
- Dashboard especifico para cada rol
- Sistema de vendedores con codigos de descuento
- Integracion con Mercado Pago

### Stack Tecnologico

| Componente | Tecnologia |
|------------|------------|
| Frontend | Next.js 15, React 19, TypeScript |
| Estilos | Tailwind CSS 3.4 |
| Backend | Next.js API Routes |
| Base de Datos | PostgreSQL (Supabase) |
| ORM | Prisma 5.22 |
| Autenticacion | JWT + bcrypt |
| Pagos | Mercado Pago |
| Almacenamiento | Vercel Blob |
| Deploy | Vercel |

---

## 2. Arquitectura del Sistema

### Estructura de Carpetas

```
inakat/
├── src/
│   ├── app/                    # App Router de Next.js
│   │   ├── api/                # API Routes
│   │   │   ├── admin/          # APIs de administrador
│   │   │   ├── auth/           # Login, logout, registro
│   │   │   ├── company/        # APIs de empresa
│   │   │   ├── recruiter/      # APIs de reclutador
│   │   │   ├── specialist/     # APIs de especialista
│   │   │   ├── candidate/      # APIs de candidato
│   │   │   ├── vendor/         # APIs de vendedor
│   │   │   ├── applications/   # Gestion de aplicaciones
│   │   │   ├── jobs/           # Gestion de vacantes
│   │   │   └── ...
│   │   ├── admin/              # Paginas de admin
│   │   ├── company/            # Paginas de empresa
│   │   ├── recruiter/          # Paginas de reclutador
│   │   ├── specialist/         # Paginas de especialista
│   │   └── ...
│   ├── components/             # Componentes React
│   │   ├── commons/            # Header, Footer, etc.
│   │   ├── sections/           # Secciones por pagina
│   │   └── shared/             # Componentes compartidos
│   ├── lib/                    # Utilidades
│   │   ├── prisma.ts           # Cliente Prisma
│   │   ├── auth.ts             # Funciones de auth
│   │   ├── pricing.ts          # Calculo de precios
│   │   └── validations.ts      # Schemas Zod
│   └── middleware.ts           # Proteccion de rutas
├── prisma/
│   ├── schema.prisma           # Modelos de BD
│   └── seed.ts                 # Datos iniciales
├── __tests__/                  # Tests
└── docs/                       # Documentacion
```

### Flujo de Datos

```
[Cliente] -> [Middleware] -> [API Route] -> [Prisma] -> [PostgreSQL]
                |
         [Verificar JWT]
                |
         [Verificar Rol]
```

---

## 3. Roles y Permisos

### Tabla de Roles

| Rol | Descripcion | Acceso |
|-----|-------------|--------|
| admin | Administrador del sistema | Todo |
| company | Empresa que publica vacantes | /company/* |
| recruiter | Psicologo/Reclutador | /recruiter/* |
| specialist | Especialista tecnico | /specialist/* |
| candidate | Candidato registrado | /candidate/* |
| user | Usuario general | /my-applications |
| vendor | Vendedor (cualquier usuario) | /vendor/* |

### Matriz de Permisos por API

| API | admin | company | recruiter | specialist | candidate | publico |
|-----|-------|---------|-----------|------------|-----------|---------|
| GET /api/jobs | Si | Si | Si | Si | Si | Si |
| POST /api/applications | Si | No | No | No | No | Si |
| GET /api/applications | Si | No | No | No | No | No |
| /api/admin/* | Si | No | No | No | No | No |
| /api/company/* | Si | Si | No | No | No | No |
| /api/recruiter/* | Si | No | Si | No | No | No |
| /api/specialist/* | Si | No | No | Si | No | No |

---

## 4. Flujos de Trabajo

### Flujo Principal: Candidato -> Empresa

```
    CANDIDATO                                           ADMIN
        |                                                 |
        v                                                 v
   +---------+                                      +----------+
   | Aplica  |                                      | Inyecta  |
   | online  |                                      | desde    |
   |         |                                      | LinkedIn |
   +----+----+                                      +----+-----+
        |                                                |
        | status: pending                                | status: injected_by_admin
        |                                                |
        +------------------+-----------------------------+
                           |
                           v
                    +-------------+
                    | RECLUTADOR  |
                    | (Psicologo) |
                    |             |
                    | Evalua:     |
                    | - Actitud   |
                    | - Valores   |
                    | - Fit       |
                    +------+------+
                           |
                           | status: sent_to_specialist
                           v
                    +-------------+
                    | ESPECIALISTA|
                    | (Tecnico)   |
                    |             |
                    | Evalua:     |
                    | - Skills    |
                    | - Exp.      |
                    | - Nivel     |
                    +------+------+
                           |
                           | status: sent_to_company
                           v
                    +-------------+
                    |   EMPRESA   |
                    |             |
                    | Decide:     |
                    | - Interes   |
                    | - Entrevista|
                    | - Contrata  |
                    +-------------+
```

### Estados de Application

```
  pending --------------+
                        |
  injected_by_admin ----+---> reviewing ---> sent_to_specialist
                        |                           |
                        |                           v
                        |                      evaluating
                        |                           |
                        |                           v
                        |                    sent_to_company
                        |                           |
                        |           +---------------+---------------+
                        |           |               |               |
                        |           v               v               v
                        |   company_interested  rejected       accepted
                        |           |               ^               ^
                        |           v               |               |
                        |      interviewed --------+---------------+
                        |
                        +---> discarded / archived
```

### Estados de Job

```
  draft ---> active <--> paused
               |
               |
               v
            closed
               |
               v
           (archived)

  * expired: calculado automaticamente cuando expiresAt < now
```

---

## 5. APIs del Sistema

### Autenticacion

| Metodo | Ruta | Descripcion |
|--------|------|-------------|
| POST | /api/auth/login | Iniciar sesion |
| POST | /api/auth/logout | Cerrar sesion |
| POST | /api/auth/register | Registrar usuario |
| GET | /api/auth/me | Obtener usuario actual |

### Vacantes

| Metodo | Ruta | Descripcion | Auth |
|--------|------|-------------|------|
| GET | /api/jobs | Listar vacantes activas | No |
| GET | /api/jobs/[id] | Obtener vacante | No |
| POST | /api/jobs | Crear vacante (borrador) | Si |
| PATCH | /api/jobs/[id] | Actualizar vacante | Si |
| DELETE | /api/jobs/[id] | Eliminar vacante | Admin |

### Aplicaciones

| Metodo | Ruta | Descripcion | Auth |
|--------|------|-------------|------|
| GET | /api/applications | Listar todas | Admin |
| POST | /api/applications | Crear aplicacion | No |
| GET | /api/applications/check | Verificar duplicado | No |
| PATCH | /api/applications/[id] | Actualizar status | Si |

### Admin

| Metodo | Ruta | Descripcion |
|--------|------|-------------|
| GET/POST | /api/admin/candidates | CRUD candidatos |
| POST | /api/admin/assign-candidates | Inyectar a vacante |
| GET/PUT | /api/admin/assignments | Asignar reclutador/especialista |
| GET/PATCH | /api/admin/direct-applications | Gestionar aplicaciones directas |
| GET/POST/PUT | /api/admin/users | Gestion de usuarios |
| GET/POST/PUT | /api/admin/pricing | Matriz de precios |

### Dashboards

| Metodo | Ruta | Rol |
|--------|------|-----|
| GET/PUT | /api/recruiter/dashboard | recruiter |
| GET/PUT | /api/specialist/dashboard | specialist |
| GET | /api/company/dashboard | company |
| PATCH | /api/company/applications/[id] | company |
| GET | /api/vendor/my-code | any |
| GET | /api/vendor/my-sales | any |

---

## 6. Base de Datos

### Modelos Principales

#### User
```prisma
model User {
  id              Int       @id @default(autoincrement())
  email           String    @unique
  password        String    // Hasheada con bcrypt
  nombre          String
  role            String    @default("user")
  // Roles: admin, company, user, recruiter, specialist, candidate, vendor
  credits         Int       @default(0)
  specialty       String?   // Para especialistas
  // Relaciones...
}
```

#### Job
```prisma
model Job {
  id          Int       @id @default(autoincrement())
  title       String
  company     String
  location    String
  salary      String
  jobType     String
  workMode    String    @default("presential")
  description String
  status      String    @default("active")
  // Status: active, paused, closed, draft
  profile     String?   // Categoria
  seniority   String?   // Nivel
  creditCost  Int       @default(0)
  expiresAt   DateTime?
  // Relaciones...
}
```

#### Application
```prisma
model Application {
  id              Int       @id @default(autoincrement())
  jobId           Int
  candidateName   String
  candidateEmail  String
  candidatePhone  String?
  cvUrl           String?
  coverLetter     String?
  status          String    @default("pending")
  // Status: pending, reviewing, evaluating, sent_to_specialist, sent_to_company,
  //         company_interested, interviewed, rejected, accepted,
  //         injected_by_admin, discarded, archived
  notes           String?
  // Timestamps...
}
```

#### Candidate (Banco de Candidatos)
```prisma
model Candidate {
  id              Int       @id @default(autoincrement())
  nombre          String
  apellidoPaterno String
  email           String    @unique
  sexo            String?
  fechaNacimiento DateTime?
  universidad     String?
  carrera         String?
  anosExperiencia Int       @default(0)
  profile         String?
  seniority       String?
  source          String    @default("manual")
  // Source: manual, linkedin, occ, referido
  status          String    @default("available")
  // Status: available, in_process, hired, inactive
  // Relaciones...
}
```

---

## 7. Sistema de Creditos

### Funcionamiento

1. **Empresa compra creditos** via Mercado Pago
2. **Se aplica descuento** si usa codigo de vendedor
3. **Creditos se agregan** al balance
4. **Al publicar vacante**, se calculan creditos segun matriz
5. **Se descuentan creditos** del balance

### Matriz de Precios (Ejemplo)

| Perfil | Practicante | Jr | Middle | Sr | Director |
|--------|-------------|-------|--------|--------|----------|
| Tecnologia | 1 | 2 | 3 | 4 | 5 |
| Diseno | 1 | 2 | 3 | 4 | 5 |
| Admin | 1 | 1 | 2 | 3 | 4 |

*Nota: Los precios se configuran en /admin/pricing*

### Paquetes de Creditos

| Paquete | Creditos | Precio MXN | Precio/Credito |
|---------|----------|------------|----------------|
| Single | 1 | $4,000 | $4,000 |
| Pack 10 | 10 | $35,000 | $3,500 |
| Pack 15 | 15 | $50,000 | $3,333 |
| Pack 20 | 20 | $65,000 | $3,250 |

---

## 8. Sistema de Vendedores

### Funcionamiento

1. **Cualquier usuario** puede crear un codigo de descuento
2. **Codigo ofrece 10% descuento** al comprador
3. **Vendedor recibe 10% comision** de la venta
4. **Comision se paga** en 4 meses
5. **Admin puede gestionar** pagos de comisiones

### APIs de Vendedor

- `GET /api/vendor/my-code` - Ver mi codigo
- `POST /api/vendor/my-code` - Crear codigo
- `PATCH /api/vendor/my-code` - Activar/desactivar
- `GET /api/vendor/my-sales` - Ver mis ventas

---

## 9. Guia de Desarrollo

### Configuracion Inicial

```bash
# Clonar repositorio
git clone [repo]

# Instalar dependencias
npm install

# Configurar variables de entorno
cp .env.example .env.local
# Editar .env.local con tus valores

# Generar cliente Prisma
npx prisma generate

# Ejecutar migraciones
npx prisma migrate dev

# Sembrar datos
npm run seed

# Iniciar desarrollo
npm run dev
```

### Variables de Entorno

```env
# Base de datos
DATABASE_URL="postgresql://..."
DIRECT_URL="postgresql://..."

# Auth
JWT_SECRET="..."

# Mercado Pago
MERCADOPAGO_ACCESS_TOKEN="..."
MERCADOPAGO_PUBLIC_KEY="..."

# Vercel Blob
BLOB_READ_WRITE_TOKEN="..."

# App
NEXT_PUBLIC_APP_URL="http://localhost:3000"
```

### Comandos Utiles

```bash
# Desarrollo
npm run dev           # Servidor de desarrollo
npm run build         # Build de produccion
npm run start         # Servidor de produccion

# Base de datos
npx prisma studio     # GUI de BD
npx prisma migrate dev # Nueva migracion
npm run seed          # Sembrar datos

# Tests
npm test              # Ejecutar tests
npm test -- --watch   # Tests en modo watch

# Calidad
npm run lint          # Verificar codigo
```

---

## 10. Troubleshooting

### Error: "No tienes permisos de administrador"

**Causa:** Intentando acceder a ruta protegida sin el rol correcto.

**Solucion:** Verificar que el usuario tiene el rol adecuado en la BD.

### Error: "Token invalido o expirado"

**Causa:** El JWT expiro o es invalido.

**Solucion:** Cerrar sesion y volver a iniciar.

### Error: "Creditos insuficientes"

**Causa:** La empresa no tiene suficientes creditos para publicar.

**Solucion:** Comprar mas creditos en el checkout.

### Error al subir archivo

**Causa:** El archivo excede 5MB o tiene formato no permitido.

**Solucion:** Usar PDF, JPG, PNG o WEBP menor a 5MB.

### Vacante no aparece en busqueda

**Posibles causas:**
1. Status no es 'active'
2. Fecha de expiracion pasada
3. No se publico (esta en 'draft')

**Solucion:** Verificar status y fecha en el dashboard de empresa.

### Candidato inyectado no aparece para reclutador

**Causa:** El filtro no incluia status 'injected_by_admin'.

**Solucion:** Verificar que el status esta en ['pending', 'reviewing', 'injected_by_admin'].

### No se puede enviar a especialista

**Causa:** No hay especialista asignado a la vacante.

**Solucion:** Admin debe asignar especialista en /admin/assignments.

---

## Contacto

- **Desarrollo:** Memo (Lead Developer)
- **Producto:** Lalo (Product Owner)
- **QA:** Eduardo
- **DevOps:** Ludim

---

*Documentacion generada: Diciembre 2024*
*Version del sistema: 1.0.0*
