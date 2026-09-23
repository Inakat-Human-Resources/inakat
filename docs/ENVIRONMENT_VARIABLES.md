# 🔐 Variables de Entorno - INAKAT

Guía completa de todas las variables de entorno necesarias para INAKAT.

---

> **Fuente de verdad:** [`.env.example`](../.env.example) en la raíz del
> repositorio. Este documento explica cada variable; la lista completa y
> actualizada es la de ese archivo. Si algo no coincide, manda el cambio aquí.

## 📋 Tabla de Contenidos

1. [Archivo .env](#archivo-env)
2. [Base de Datos](#base-de-datos)
3. [Autenticación](#autenticación)
4. [Almacenamiento](#almacenamiento)
5. [Configuración de Admin](#configuración-de-admin)
6. [Contraseñas del seed](#contraseñas-del-seed)
7. [Pagos, correo y mapas](#pagos-correo-y-mapas)
8. [Aplicación](#aplicación)
9. [Producción vs Desarrollo](#producción-vs-desarrollo)

---

## 📄 Archivo .env

Copia la plantilla de la raíz:

```bash
cp .env.example .env
```

⚠️ **Usa `.env`, no `.env.local`.** Next lee los dos, pero el CLI de Prisma
(`db push`, `db seed`, `studio`, `migrate`) **sólo lee `.env`**: con las
variables en `.env.local` el primer `npx prisma db push` falla con
*"Environment variable not found: DATABASE_URL"*.

Si prefieres mantener `.env.local` para Next, ejecuta Prisma así:

```bash
npx dotenv -e .env.local -- prisma db push
```

⚠️ **IMPORTANTE:** ni `.env` ni `.env.local` se commitean a Git.

Verificar que `.gitignore` incluye:
```
.env
.env.local
.env*.local
```

---

## 🗄️ Base de Datos

### DATABASE_URL

**Propósito:** URL de conexión pooled a PostgreSQL para queries regulares

**Origen:** Supabase → Project Settings → Database → Connection String → Connection pooling

**Formato:**
```env
DATABASE_URL="postgresql://postgres.xxx:[PASSWORD]@aws-1-us-west-1.pooler.supabase.com:5432/postgres"
```

**Componentes:**
- `postgres.xxx` - ID único de tu proyecto Supabase
- `[PASSWORD]` - Contraseña de tu base de datos
- `aws-1-us-west-1.pooler.supabase.com` - Host del pooler
- `5432` - Puerto de PostgreSQL
- `postgres` - Nombre de la base de datos

**Ejemplo:**
```env
DATABASE_URL="postgresql://postgres.abcdefghijklmn:MySecurePass123@aws-1-us-west-1.pooler.supabase.com:5432/postgres"
```

**⚠️ Notas:**
- Usa connection pooling para mejor performance
- Supabase limita conexiones directas a 60
- Con pooling puedes tener 10,000+ conexiones

---

### DIRECT_URL

**Propósito:** URL de conexión directa para migraciones de Prisma

**Origen:** Supabase → Project Settings → Database → Connection String → Direct connection

**Formato:**
```env
DIRECT_URL="postgresql://postgres.xxx:[PASSWORD]@aws-1-us-west-1.compute.amazonaws.com:5432/postgres"
```

**Diferencia con DATABASE_URL:**
- Usa `.compute.amazonaws.com` en lugar de `.pooler.supabase.com`
- Conexión directa sin pooling
- Requerida para `prisma migrate`

**Ejemplo:**
```env
DIRECT_URL="postgresql://postgres.abcdefghijklmn:MySecurePass123@aws-1-us-west-1.compute.amazonaws.com:5432/postgres"
```

**⚠️ Notas:**
- Solo usar para migraciones
- No usar en queries de la aplicación
- Conexiones limitadas a 60

---

### Obtener Credenciales de Supabase

**Paso a paso:**

1. Ve a https://supabase.com/dashboard
2. Selecciona tu proyecto
3. Click en **Settings** (⚙️) → **Database**
4. Baja hasta **Connection string**
5. Copia ambas URLs:
   - **Connection pooling** → `DATABASE_URL`
   - **Direct connection** → `DIRECT_URL`
6. Reemplaza `[YOUR-PASSWORD]` con tu contraseña de BD

**Contraseña olvidada:**
- Settings → Database → Database password → Reset password

---

## 🔐 Autenticación

### JWT_SECRET

**Propósito:** Clave secreta para firmar y verificar tokens JWT

**Generación:**

```bash
# Opción 1: Con Node.js
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# Opción 2: Con OpenSSL
openssl rand -hex 32

# Opción 3: Online (menos seguro)
# https://www.grc.com/passwords.htm
```

**Formato:**
```env
JWT_SECRET="a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6"
```

**Requisitos:**
- ✅ Mínimo 32 caracteres
- ✅ Hexadecimal (0-9, a-f)
- ✅ Generado aleatoriamente
- ✅ Único por ambiente

**Ejemplo:**
```env
JWT_SECRET="8f4c2a9d7e6b5a3c1f0e9d8c7b6a5f4e3d2c1b0a9f8e7d6c5b4a3f2e1"
```

**⚠️ Seguridad:**
- 🔴 **NUNCA** compartir este valor
- 🔴 **NUNCA** commitear a Git
- 🔴 **NUNCA** usar valores por defecto
- ✅ Diferente para cada ambiente (dev, staging, prod)
- ✅ Rotar cada 3-6 meses

**¿Qué pasa si se filtra?**
- Todos los tokens existentes quedan comprometidos
- Atacante puede generar tokens válidos
- **Acción:** Cambiar inmediatamente y forzar re-login de todos

---

## 📦 Almacenamiento

### BLOB_READ_WRITE_TOKEN

**Propósito:** Token para subir archivos a Vercel Blob Storage

**Origen:** Vercel Project → Storage → Blob → .env.local tab

**Formato:**
```env
BLOB_READ_WRITE_TOKEN="vercel_blob_rw_A1b2C3d4E5f6_G7H8I9J0K1L2M3N4O5P6Q7R8S9T0"
```

**Obtención:**

1. Ve a https://vercel.com
2. Selecciona tu proyecto
3. **Storage** → **Create Database** → **Blob**
4. Click en **Create**
5. En la pestaña **.env.local** copia el token

**Ejemplo:**
```env
BLOB_READ_WRITE_TOKEN="vercel_blob_rw_x7k2mP9qR4tL1nB5wC8vD3sF6hJ0gM2aY4zE7"
```

**⚠️ Notas:**
- Permite lectura Y escritura
- Vercel también ofrece tokens de solo lectura
- Token tiene acceso a TODOS los archivos del proyecto

**Límites (Plan Free):**
- 1GB de almacenamiento
- 100GB de ancho de banda/mes

**Alternativas:**
- AWS S3
- Cloudinary
- Uploadthing

---

## 👨‍💼 Configuración de Admin

Variables para crear usuario admin por defecto al ejecutar el seed.

### ADMIN_EMAIL

**Propósito:** Email del usuario administrador por defecto

**Formato:**
```env
ADMIN_EMAIL="admin@inakat.com"
```

**Ejemplo:**
```env
ADMIN_EMAIL="admin@tuempresa.com"
```

**⚠️ Notas:**
- Se crea al ejecutar `npx prisma db seed`
- Puedes cambiarlo antes del seed
- Después del seed, cambiar en la base de datos

---

### ~~ADMIN_PASSWORD~~ (obsoleta)

**El seed ya no lee `ADMIN_PASSWORD`.** Definirla no tiene ningún efecto: la
contraseña del admin sale de `SEED_ADMIN_PASSWORD` (ver la sección siguiente).

---

### ADMIN_NOMBRE

**Propósito:** Nombre del usuario administrador

**Formato:**
```env
ADMIN_NOMBRE="Administrador"
```

**Ejemplo:**
```env
ADMIN_NOMBRE="Juan Pérez"
```

---

## 🔑 Contraseñas del seed

`prisma/seed.ts` **exige estas 8 variables** y aborta con `process.exit(1)`
listando las que falten. No hay valores por defecto y **no se publican en la
documentación**: cada entorno genera las suyas.

| Variable                   | Cuentas que crea                          |
| -------------------------- | ----------------------------------------- |
| `SEED_ADMIN_PASSWORD`      | Admin principal (el de `ADMIN_EMAIL`)     |
| `SEED_ADMIN2_PASSWORD`     | Segundo admin                             |
| `SEED_COMPANY_PASSWORD`    | Usuarios de empresa de ejemplo            |
| `SEED_RECRUITER_PASSWORD`  | Reclutadores                              |
| `SEED_SPECIALIST_PASSWORD` | Especialistas                             |
| `SEED_CANDIDATE_PASSWORD`  | Candidatos con cuenta                     |
| `SEED_USER_PASSWORD`       | Usuarios normales                         |
| `SEED_STAFF_PASSWORD`      | Staff adicional                           |

Generar una contraseña fuerte:

```bash
node -e "console.log(require('crypto').randomBytes(16).toString('base64'))"
```

**⚠️ Seguridad:**
- Las contraseñas se guardan hasheadas con bcrypt.
- Distintas por entorno; **nunca** sembrar producción con las de desarrollo.
- Si una contraseña de seed llegó a estar publicada, hay que rotarla en la base
  o desactivar esas cuentas.

---

## 💳 Pagos, correo y mapas

| Variable | Para qué | ¿Obligatoria? |
| -------- | -------- | ------------- |
| `MERCADOPAGO_ACCESS_TOKEN` | Crear preferencias de pago (servidor) | Sí para vender créditos |
| `NEXT_PUBLIC_MERCADOPAGO_PUBLIC_KEY` | SDK del checkout en el navegador. **Ojo:** el nombre lleva el prefijo `NEXT_PUBLIC_`; sin él la página de compra muestra "Error de configuración" | Sí para vender créditos |
| `MERCADOPAGO_WEBHOOK_SECRET` | Validar la firma de los webhooks. En producción, sin ella el webhook responde 500 y **los pagos nunca se acreditan** | Sí en producción |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM` | Correos (reset de contraseña, avisos). Sin SMTP el envío falla **en silencio** | Sí en producción |
| `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` | Autocompletado de direcciones y distancias | Sí para el alta de vacantes/empresas |

> `MERCADOPAGO_PUBLIC_KEY` (sin `NEXT_PUBLIC_`) **no existe** en el código.

---

## 🌐 Aplicación

### NEXT_PUBLIC_APP_URL

**Propósito:** URL base de la aplicación

**Formato:**
```env
# Desarrollo
NEXT_PUBLIC_APP_URL="http://localhost:3000"

# Producción
NEXT_PUBLIC_APP_URL="https://inakat.vercel.app"
```

**Uso:**
- Links absolutos en emails
- Redirects después de login
- Compartir links

**⚠️ Prefijo `NEXT_PUBLIC_`:**
- Se expone al cliente (navegador)
- Accesible vía `process.env.NEXT_PUBLIC_APP_URL`
- No incluir datos sensibles

---

## 🔄 Producción vs Desarrollo

### Archivo .env (Desarrollo)

```env
# Supabase Dev
DATABASE_URL="postgresql://...pooler.supabase.com:6543/postgres?pgbouncer=true"
DIRECT_URL="postgresql://...pooler.supabase.com:5432/postgres"

# JWT Dev (diferente a producción!)
JWT_SECRET="dev-secret-32-chars-minimum-length"

# Vercel Blob Dev
BLOB_READ_WRITE_TOKEN="vercel_blob_rw_..."

# Admin
ADMIN_EMAIL="admin@inakat.com"
ADMIN_NOMBRE="Administrador"

# Seed (las 8, generadas localmente)
SEED_ADMIN_PASSWORD="..."
SEED_ADMIN2_PASSWORD="..."
SEED_COMPANY_PASSWORD="..."
SEED_RECRUITER_PASSWORD="..."
SEED_SPECIALIST_PASSWORD="..."
SEED_CANDIDATE_PASSWORD="..."
SEED_USER_PASSWORD="..."
SEED_STAFF_PASSWORD="..."

# Pagos / correo / mapas
MERCADOPAGO_ACCESS_TOKEN="TEST-..."
NEXT_PUBLIC_MERCADOPAGO_PUBLIC_KEY="TEST-..."
MERCADOPAGO_WEBHOOK_SECRET="..."
SMTP_HOST="smtp.zoho.com"
SMTP_PORT="465"
SMTP_USER="noreply@inakat.com"
SMTP_PASS="..."
SMTP_FROM="INAKAT <noreply@inakat.com>"
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY="..."

# App
NEXT_PUBLIC_APP_URL="http://localhost:3000"
```

---

### Variables en Vercel (Producción)

**Configurar en:** Vercel Project → Settings → Environment Variables

```env
# Supabase Prod (proyecto diferente!)
DATABASE_URL="postgresql://..."
DIRECT_URL="postgresql://..."

# JWT Prod (¡DIFERENTE a dev!)
JWT_SECRET="prod-secret-must-be-different-32-chars-min"

# Vercel Blob Prod
BLOB_READ_WRITE_TOKEN="vercel_blob_rw_..."

# Admin Prod
ADMIN_EMAIL="admin@inakat.com"
ADMIN_NOMBRE="Administrador"

# Pagos / correo / mapas (obligatorias en producción)
MERCADOPAGO_ACCESS_TOKEN="APP_USR-..."
NEXT_PUBLIC_MERCADOPAGO_PUBLIC_KEY="APP_USR-..."
MERCADOPAGO_WEBHOOK_SECRET="..."
SMTP_HOST="smtp.zoho.com"
SMTP_PORT="465"
SMTP_USER="noreply@inakat.com"
SMTP_PASS="..."
SMTP_FROM="INAKAT <noreply@inakat.com>"
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY="..."

# App Prod
NEXT_PUBLIC_APP_URL="https://inakat.com"
```

**⚠️ Importante:**
- Usar bases de datos SEPARADAS para dev y prod
- JWT_SECRET DIFERENTE en cada ambiente
- Nunca usar datos de producción en desarrollo
- Las `SEED_*` sólo hacen falta si se va a ejecutar el seed en ese entorno

---

## 📝 Plantilla Completa

**No se duplica aquí**: la plantilla completa, con comentarios y todos los
grupos, es [`.env.example`](../.env.example).

```bash
cp .env.example .env
```

Cualquier variable nueva se añade primero a `.env.example` y después se explica
en este documento.

---

## ✅ Checklist de Configuración

- [ ] `.env` creado a partir de `.env.example`
- [ ] `DATABASE_URL` configurado (pooler 6543 + `pgbouncer=true`) y probado
- [ ] `DIRECT_URL` configurado (5432)
- [ ] `JWT_SECRET` generado aleatoriamente (32+ chars)
- [ ] `BLOB_READ_WRITE_TOKEN` obtenido de Vercel
- [ ] `ADMIN_EMAIL` / `ADMIN_NOMBRE` configurados
- [ ] Las 8 `SEED_*_PASSWORD` generadas (si vas a correr el seed)
- [ ] MercadoPago: access token, `NEXT_PUBLIC_MERCADOPAGO_PUBLIC_KEY` y webhook secret
- [ ] SMTP configurado (si no, los correos se descartan en silencio)
- [ ] `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` configurada y restringida por dominio
- [ ] `NEXT_PUBLIC_APP_URL` correcto
- [ ] `.env` y `.env.local` en `.gitignore`
- [ ] Conexión a BD verificada: `npx prisma db pull`
- [ ] Servidor reiniciado después de cambios

---

## 🐛 Debugging

### Ver variables cargadas

```bash
# Comprobar que una variable está definida (sin imprimir su valor)
node -e "require('dotenv').config(); console.log('DATABASE_URL definida:', !!process.env.DATABASE_URL)"

# Ver qué variables hay cargadas (sólo los nombres, nunca los valores)
node -e "require('dotenv').config(); console.log(Object.keys(process.env).filter(k => /^(DATABASE|DIRECT|JWT|SEED|SMTP|MERCADOPAGO|BLOB|NEXT_PUBLIC)/.test(k)))"
```

⚠️ No imprimas valores de secretos en la terminal ni los pegues en tickets,
chats o documentos: acaban en historiales y capturas.

### Verificar conexión a BD

```bash
npx prisma db pull
# Si funciona, la conexión es correcta
```

### Probar JWT Secret

```typescript
// test-jwt.ts
import * as jose from 'jose';

const secret = process.env.JWT_SECRET!;
const token = await new jose.SignJWT({ userId: 1 })
  .setProtectedHeader({ alg: 'HS256' })
  .sign(new TextEncoder().encode(secret));

console.log('Token generated:', token);
```

---

## 🔒 Seguridad

### ❌ NUNCA:

- Commitear `.env.local` a Git
- Compartir credenciales por email/chat
- Usar valores por defecto en producción
- Reusar JWT_SECRET entre ambientes
- Hardcodear valores en código

### ✅ SIEMPRE:

- Usar `.gitignore` para `.env*`
- Variables diferentes por ambiente
- Rotar secretos periódicamente
- Usar secrets managers en prod (Vercel Env Vars)
- Mínimo privilegio (tokens con permisos justos)

---

## 📚 Referencias

- [Next.js Environment Variables](https://nextjs.org/docs/basic-features/environment-variables)
- [Prisma Connection URLs](https://www.prisma.io/docs/reference/database-reference/connection-urls)
- [Vercel Environment Variables](https://vercel.com/docs/concepts/projects/environment-variables)
- [Supabase Connection Pooling](https://supabase.com/docs/guides/database/connecting-to-postgres#connection-pool)

---

**Última actualización:** Enero 2025
