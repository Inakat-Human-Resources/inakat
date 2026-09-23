# 📘 Guía de Instalación - INAKAT

Esta guía te llevará paso a paso por la instalación completa de INAKAT en tu entorno local.

---

## ⚙️ Prerequisitos

Antes de comenzar, asegúrate de tener instalado:

### Software Requerido

- **Node.js** v22.0.0 o superior (hay dependencias, como `@vercel/blob`, que exigen >= 20;
  CI y producción usan la major del `.nvmrc`)
  - Verifica: `node --version`
  - Descarga: https://nodejs.org/

- **npm** v9.0.0 o superior (viene con Node.js)
  - Verifica: `npm --version`

- **Git**
  - Verifica: `git --version`
  - Descarga: https://git-scm.com/

### Cuentas Necesarias

1. **Supabase** (Base de datos PostgreSQL)
   - Crea cuenta en: https://supabase.com
   - Plan gratuito disponible

2. **Vercel** (Deploy y Blob Storage)
   - Crea cuenta en: https://vercel.com
   - Plan gratuito disponible

---

## 🚀 Instalación Paso a Paso

### 1. Clonar el Repositorio

```bash
# HTTPS
git clone https://github.com/tu-usuario/inakat.git

# SSH (recomendado si tienes SSH keys)
git clone git@github.com:tu-usuario/inakat.git

# Entrar al directorio
cd inakat
```

---

### 2. Instalar Dependencias

```bash
npm install
```

Esto instalará todas las dependencias listadas en `package.json`:
- Next.js 15 (App Router)
- React 19
- Prisma 6
- TypeScript 5
- Tailwind CSS
- Y más...

**Tiempo estimado:** 2-5 minutos

---

### 3. Configurar Supabase (Base de Datos)

#### A) Crear Proyecto en Supabase

1. Ve a https://supabase.com/dashboard
2. Click en "New Project"
3. Llena los datos:
   - **Name:** inakat-dev
   - **Database Password:** (genera una segura y guárdala)
   - **Region:** South America (más cercana a México)
4. Click "Create new project"
5. Espera 2-3 minutos a que se cree

#### B) Obtener Connection Strings

1. En tu proyecto, ve a **Settings** → **Database**
2. Baja hasta "Connection string"
3. Copia ambas URLs:

**Connection Pooling — `DATABASE_URL` (la que usa la app, modo transacción):**
```
postgresql://postgres.xxx:[PASSWORD]@aws-1-us-west-1.pooler.supabase.com:6543/postgres?pgbouncer=true&connection_limit=1
```

**Direct Connection — `DIRECT_URL` (la que usa Prisma para el esquema, modo sesión):**
```
postgresql://postgres.xxx:[PASSWORD]@aws-1-us-west-1.pooler.supabase.com:5432/postgres
```

4. Reemplaza `[PASSWORD]` con tu contraseña de BD

> El puerto **6543 con `pgbouncer=true`** es obligatorio para `DATABASE_URL` en
> entornos serverless: con el puerto 5432 (modo sesión) varias lambdas agotan las
> conexiones ("max clients reached in session mode").

---

### 4. Configurar Vercel Blob (Almacenamiento)

#### A) Crear Cuenta y Proyecto

1. Ve a https://vercel.com
2. Crea cuenta o inicia sesión
3. Importa tu repositorio de GitHub
4. En el proyecto, ve a **Storage**
5. Click "Create Database"
6. Selecciona "Blob"
7. Click "Create"

#### B) Obtener Token

1. En la página de Blob Storage
2. Ve a ".env.local" tab
3. Copia el valor de `BLOB_READ_WRITE_TOKEN`

---

### 5. Configurar Variables de Entorno

La plantilla completa y **única fuente de verdad** es `.env.example`. Cópiala a
`.env` (no a `.env.local`: el CLI de Prisma — `db push`, `db seed`, `studio` —
sólo lee `.env`):

```bash
cp .env.example .env
```

Edita `.env` y rellena, como mínimo:

| Variable(s)                                                                 | Para qué                                              |
| --------------------------------------------------------------------------- | ----------------------------------------------------- |
| `DATABASE_URL`, `DIRECT_URL`                                                  | Base de datos (ver el paso anterior)                   |
| `JWT_SECRET` (mínimo 32 caracteres), `JWT_EXPIRES_IN`                         | Autenticación                                          |
| `BLOB_READ_WRITE_TOKEN`                                                       | Subida de archivos (sin él se escribe en `public/uploads`) |
| `ADMIN_EMAIL`, `ADMIN_NOMBRE`                                                 | Datos del admin que crea el seed                       |
| `SEED_ADMIN_PASSWORD`, `SEED_ADMIN2_PASSWORD`, `SEED_COMPANY_PASSWORD`, `SEED_RECRUITER_PASSWORD`, `SEED_SPECIALIST_PASSWORD`, `SEED_CANDIDATE_PASSWORD`, `SEED_USER_PASSWORD`, `SEED_STAFF_PASSWORD` | Contraseñas de las cuentas del seed (las 8 son obligatorias) |
| `MERCADOPAGO_ACCESS_TOKEN`, `NEXT_PUBLIC_MERCADOPAGO_PUBLIC_KEY`, `MERCADOPAGO_WEBHOOK_SECRET` | Compra de créditos y webhook de pagos    |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM`               | Correos (reset de contraseña, avisos)                  |
| `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`                                             | Autocompletado de direcciones                          |
| `NEXT_PUBLIC_APP_URL`                                                         | URL pública de la app                                  |

**⚠️ IMPORTANTE:**

- `ADMIN_PASSWORD` ya **no se usa**: el seed lee `SEED_ADMIN_PASSWORD`.
- Genera un `JWT_SECRET` seguro:
  ```bash
  node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
  ```
- Genera contraseñas de seed fuertes y distintas por entorno:
  ```bash
  node -e "console.log(require('crypto').randomBytes(16).toString('base64'))"
  ```
- **NUNCA** comitees `.env` ni `.env.local` a Git, ni publiques estas
  contraseñas en la documentación.
- Si trabajas con `.env.local` para Next, ejecuta los comandos de Prisma con
  `npx dotenv -e .env.local -- prisma ...`.

---

### 6. Configurar Base de Datos

#### A) Generar Cliente de Prisma

```bash
npx prisma generate
```

Esto genera el cliente de Prisma basado en tu `schema.prisma`.

#### B) Crear las Tablas

```bash
npx prisma db push
```

Esto crea en tu base de datos todas las tablas de `schema.prisma`.

> ⚠️ **No uses `prisma migrate dev` ni `prisma migrate reset`.** El historial de
> `prisma/migrations` todavía no tiene baseline (sólo cubre una parte de los
> modelos), así que `migrate dev` detecta *drift* y ofrece **borrar el esquema
> completo**. Hasta que se genere la baseline, el camino soportado en desarrollo
> es `db push`.

#### C) Poblar con Datos de Ejemplo

```bash
npx prisma db seed
```

El seed aborta con la lista de variables faltantes si no están definidas las 8
`SEED_*_PASSWORD`.

Esto creará:
- ✅ 2 usuarios admin
- ✅ Empresas, reclutadores, especialistas y candidatos de ejemplo
- ✅ Vacantes y aplicaciones de ejemplo

**Credenciales de Admin:** el email es el de `ADMIN_EMAIL` y la contraseña la que
pusiste en `SEED_ADMIN_PASSWORD` (el segundo admin usa `SEED_ADMIN2_PASSWORD`).
No se documentan contraseñas en este repositorio.

---

### 7. Ejecutar en Desarrollo

```bash
npm run dev
```

Deberías ver:

```
▲ Next.js 15.x
- Local:        http://localhost:3000
- Network:      http://192.168.1.x:3000

✓ Ready in 2.5s
```

---

### 8. Verificar Instalación

Abre tu navegador en http://localhost:3000

#### Probar estas rutas:

**✅ Home**
```
http://localhost:3000
```

**✅ Búsqueda de Vacantes**
```
http://localhost:3000/talents
```
Deberías ver 18 vacantes

**✅ Login Admin**
```
http://localhost:3000/login
```
Usa el `ADMIN_EMAIL` y el `SEED_ADMIN_PASSWORD` de tu `.env`.

**✅ Panel Admin**
```
http://localhost:3000/admin
```
Deberías ver el dashboard

**✅ Panel de Aplicaciones**
```
http://localhost:3000/applications
```
Deberías ver 12 aplicaciones

**✅ Crear Vacante**
```
http://localhost:3000/create-job
```

---

## 🛠️ Herramientas Útiles

### Prisma Studio

Interface visual para tu base de datos:

```bash
npx prisma studio
```

Abre: http://localhost:5555

### Ver Logs

```bash
# Logs en tiempo real
npm run dev

# Ver logs con detalles
NODE_OPTIONS='--inspect' npm run dev
```

---

## 🐛 Problemas Comunes

### Error: "Cannot connect to database"

**Solución:**
1. Verifica que `DATABASE_URL` y `DIRECT_URL` sean correctas
2. Verifica que la contraseña no tenga caracteres especiales sin escapar
3. Verifica que tu IP esté permitida en Supabase (debería estar por defecto)

### Error: "Module not found"

**Solución:**
```bash
# Borrar node_modules y reinstalar
rm -rf node_modules
npm install
```

### Error: "Port 3000 already in use"

**Solución:**
```bash
# Matar proceso en puerto 3000
# Windows:
netstat -ano | findstr :3000
taskkill /PID [PID] /F

# Mac/Linux:
lsof -ti:3000 | xargs kill -9

# O usar otro puerto:
PORT=3001 npm run dev
```

### Error: Prisma relacionado

**Solución:**
```bash
# Regenerar cliente de Prisma
npx prisma generate

# Sincronizar el esquema con la base (desarrollo)
npx prisma db push
```

> No ejecutes `prisma migrate reset` ni `prisma migrate dev` mientras el
> historial de migraciones no tenga baseline: borran datos y generan
> migraciones que luego fallan en producción con "relation already exists".

---

## ✅ Checklist de Instalación

- [ ] Node.js 22+ instalado
- [ ] Repositorio clonado
- [ ] Dependencias instaladas
- [ ] Proyecto Supabase creado
- [ ] Vercel Blob configurado
- [ ] `.env` creado a partir de `.env.example` (incluidas las 8 `SEED_*_PASSWORD`)
- [ ] Prisma client generado
- [ ] Esquema sincronizado con `npx prisma db push`
- [ ] Seed ejecutado
- [ ] Servidor corriendo en http://localhost:3000
- [ ] Home carga correctamente
- [ ] Login funciona
- [ ] Vacantes se muestran
- [ ] Panel admin accesible

---

## 🎉 ¡Instalación Completa!

Si todos los checks están ✅, tu instalación está lista.

**Próximos pasos:**

1. Lee la [Guía de Usuario](./USER_GUIDE.md)
2. Revisa la [Documentación de API](./API.md)
3. Empieza a desarrollar

---

## 📞 ¿Necesitas Ayuda?

- 📧 Email: soporte@inakat.com
- 💬 Discord: [INAKAT Community](https://discord.gg/inakat)
- 📖 Docs: [docs.inakat.com](https://docs.inakat.com)

---

**¡Feliz desarrollo! 🚀**
