# 🚀 Guía de Deploy - INAKAT

Guía completa para desplegar INAKAT a producción en Vercel.

---

## 📋 Pre-requisitos

Antes de hacer deploy, asegúrate de tener:

- ✅ Código funcionando en desarrollo
- ✅ Cuenta de GitHub
- ✅ Cuenta de Vercel
- ✅ Base de datos Supabase (producción)
- ✅ Vercel Blob Storage configurado

---

## 🎯 Estrategia de Deploy

### Ambientes

**Desarrollo:**
- `localhost:3000`
- Base de datos de desarrollo
- Variables de entorno locales

**Preview (Staging):**
- URLs temporales de Vercel
- Base de datos de staging (recomendado)
- Variables de preview

**Producción:**
- Dominio principal
- Base de datos de producción
- Variables de producción

---

## 🏗️ Preparación

### 1. Crear Proyecto Supabase de Producción

**⚠️ IMPORTANTE:** Usa una base de datos DIFERENTE para producción

1. Ve a https://supabase.com/dashboard
2. Click "New Project"
3. Llena:
   - **Name:** `inakat-production`
   - **Database Password:** (genera una fuerte y guárdala en password manager)
   - **Region:** South America
4. Espera 2-3 minutos

**Obtener URLs:**
- Settings → Database
- Copia `DATABASE_URL` (pooling)
- Copia `DIRECT_URL` (direct)
- Guárdalas para el siguiente paso

---

### 2. Preparar Repositorio GitHub

**Si aún no tienes repo:**

```bash
# Inicializar git
git init

# Agregar archivos
git add .

# Commit inicial
git commit -m "Initial commit - INAKAT platform"

# Crear repo en GitHub
# Ve a https://github.com/new

# Agregar remote
git remote add origin git@github.com:tu-usuario/inakat.git

# Push
git push -u origin main
```

**Verificar .gitignore:**

```bash
# Debe incluir:
.env.local
.env*.local
node_modules/
.next/
.vercel/
```

---

### 3. Verificar Build Local

```bash
# Limpiar
rm -rf .next

# Build
npm run build

# Si hay errores, arreglarlos antes de continuar
```

---

## 🌐 Deploy a Vercel

### Opción A: Deploy desde GitHub (Recomendado)

**Paso 1:** Ve a https://vercel.com/dashboard

**Paso 2:** Click "Add New..." → "Project"

**Paso 3:** Importa tu repositorio
- Click "Import" en tu repo de GitHub
- Autoriza Vercel si es necesario

**Paso 4:** Configurar proyecto

```
Project Name: inakat
Framework Preset: Next.js
Root Directory: ./
Build Command: npm run build (auto-detectado)
Output Directory: .next (auto-detectado)
Install Command: npm install (auto-detectado)
```

**Paso 5:** NO HAGAS DEPLOY TODAVÍA
- Click "Environment Variables" primero

---

### Configurar Variables de Entorno en Vercel

**En la sección "Environment Variables":**

Agrega cada variable:

La lista completa está en `.env.example`. Estas son las que **tienen que estar**
en Vercel para que la aplicación funcione entera:

| Variable | Obligatoria | Nota |
| -------- | ----------- | ---- |
| `DATABASE_URL` | Sí | Pooler en **modo transacción**: puerto **6543** con `?pgbouncer=true&connection_limit=1` |
| `DIRECT_URL` | Sí | Mismo host del pooler, puerto **5432** (modo sesión), para operaciones de esquema |
| `JWT_SECRET` | Sí | Distinto al de desarrollo, mínimo 32 caracteres. La app **no arranca** sin él |
| `JWT_EXPIRES_IN` | No | Por defecto `7d` |
| `BLOB_READ_WRITE_TOKEN` | Sí | Sin él, las subidas intentan escribir en disco (no funciona en serverless) |
| `ADMIN_EMAIL`, `ADMIN_NOMBRE` | Sólo si se siembra | `ADMIN_PASSWORD` ya no se usa |
| `MERCADOPAGO_ACCESS_TOKEN` | Sí (cobros) | Sin él, el checkout responde "Error de configuración" |
| `NEXT_PUBLIC_MERCADOPAGO_PUBLIC_KEY` | Sí (cobros) | **Con** el prefijo `NEXT_PUBLIC_`: sin él no llega al navegador |
| `MERCADOPAGO_WEBHOOK_SECRET` | Sí (cobros) | En producción, sin él el webhook responde **500 "Webhook not configured"** y los pagos nunca se acreditan |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM` | Sí | Sin SMTP, `sendEmail` devuelve false: los correos de reset se pierden en silencio |
| `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` | Sí | Autocompletado de direcciones; restringir la key por dominio |
| `NEXT_PUBLIC_APP_URL` | Sí | URL pública final (enlaces de los correos) |

```env
# Ejemplo de las dos URLs de base de datos
DATABASE_URL="postgresql://postgres.[REF]:[PASSWORD]@aws-0-[REGION].pooler.supabase.com:6543/postgres?pgbouncer=true&connection_limit=1"
DIRECT_URL="postgresql://postgres.[REF]:[PASSWORD]@aws-0-[REGION].pooler.supabase.com:5432/postgres"
```

**Tips:**
- Click "Add Another" para cada variable
- Las `NEXT_PUBLIC_*` y `BLOB_READ_WRITE_TOKEN` conviene ponerlas también en Preview
- ⚠️ Con `DATABASE_URL` en el puerto 5432 (modo sesión), varias lambdas
  concurrentes agotan las conexiones: *"max clients reached in session mode"*
- Después de cambiar una variable hay que **redeployar**: Next incrusta las
  `NEXT_PUBLIC_*` en el build

---

### Registrar el webhook de MercadoPago

Además de las variables, hay un paso en el panel de MercadoPago que no se puede
hacer desde Vercel:

1. MercadoPago → Tu aplicación → **Webhooks**
2. URL de notificación: `https://<tu-dominio>/api/webhooks/mercadopago`
3. Evento: **Pagos** (`payment`)
4. Copia la **clave secreta** que genera y ponla en `MERCADOPAGO_WEBHOOK_SECRET`
5. Verifica con el botón de prueba: debe responder 200, no 500

---

### Ejecutar Deploy

**Paso 6:** Click "Deploy"

Vercel hará:
1. ✅ Clonar código
2. ✅ Instalar dependencias
3. ✅ Ejecutar build
4. ✅ Deploy a CDN global

**Tiempo:** 2-5 minutos

---

### Verificar Deploy

**Paso 7:** Cuando termine

Verás:
```
🎉 Deployment Ready
https://inakat-xxxxx.vercel.app
```

Click en el link y verifica:
- ✅ Home carga
- ✅ Estilos se ven bien
- ✅ No hay errores en console (F12)

---

## 🗄️ Configurar Base de Datos en Producción

### Aplicar el esquema

> ⚠️ **`prisma migrate deploy` NO funciona hoy en este proyecto.** El historial
> de migraciones no tiene baseline: sólo cubre parte de las tablas y el resto se
> creó con `db push`. `migrate deploy` fallaría con *"relation already exists"*.
> Hasta que se genere la baseline (ver `docs/DATABASE_SCHEMA.md`), el esquema se
> aplica con `db push` contra `DIRECT_URL`, **con respaldo previo**.

**Desde local, apuntando a producción (con cuidado):**

```bash
# 1. Respaldo de la base ANTES de tocar nada
# 2. Traer las variables de producción
vercel env pull .env.production

# 3. Revisar qué cambiaría (no aplica nada)
npx dotenv -e .env.production -- prisma migrate diff \
  --from-url "$DIRECT_URL" --to-schema-datamodel prisma/schema.prisma

# 4. Antes de aplicar: comprobar que no hay postulaciones duplicadas.
#    Si esta consulta devuelve filas, `db push` no puede crear
#    @@unique([jobId, candidateEmail]) en Application: hay que deduplicarlas antes.
#    SELECT "jobId", "candidateEmail", COUNT(*) FROM "Application"
#    GROUP BY 1,2 HAVING COUNT(*) > 1;

# 5. Aplicar (usa DIRECT_URL, no el pooler)
npx dotenv -e .env.production -- prisma db push

# 6. Reaplicar los índices únicos parciales (DB-009, DB-022). El schema no puede
#    declararlos, así que `db push` puede borrarlos. El script es idempotente.
npx dotenv -e .env.production -- prisma db execute   --file prisma/migrations/20260922000000_baseline_drift_e_indices/migration.sql   --schema prisma/schema.prisma
```

**Tras el deploy**, verifica que las tablas de la integración existen:

```sql
SELECT to_regclass('"IntegrationApiKey"'), to_regclass('"IntegrationWebhook"');
```

---

### Catálogos en una base remota (sin datos de ejemplo)

**No se siembran datos demo en producción.** El seed se niega a correr con
`NODE_ENV=production` o contra un host que no sea local, salvo que se exporte
`SEED_ALLOW_REMOTE=1` (DB-010).

Para cargar **sólo el admin y los catálogos** (especialidades, matriz de
precios, paquetes) en una base remota, hay que pedirlo de forma explícita:

```bash
SEED_ONLY_CATALOGS=1 SEED_ALLOW_REMOTE=1 npx prisma db seed
```

---

## 🌍 Configurar Dominio Personalizado

### Agregar Dominio

**Paso 1:** En Vercel Dashboard → Tu Proyecto

**Paso 2:** Settings → Domains

**Paso 3:** Agregar dominio
```
inakat.com
www.inakat.com
```

**Paso 4:** Configurar DNS

En tu proveedor de dominio (GoDaddy, Namecheap, etc.):

**Para dominio raíz (inakat.com):**
```
Type: A
Name: @
Value: 76.76.21.21
```

**Para www:**
```
Type: CNAME
Name: www
Value: cname.vercel-dns.com
```

**Paso 5:** Esperar propagación (2-48 horas)

---

### Actualizar NEXT_PUBLIC_APP_URL

**Paso 6:** En Vercel → Settings → Environment Variables

Actualizar:
```env
NEXT_PUBLIC_APP_URL
Old: https://inakat-xxxxx.vercel.app
New: https://inakat.com
```

**Paso 7:** Redeploy
- Deployments → tres puntos → "Redeploy"

---

## 🔄 Proceso de Deploy Continuo

### Deploy Automático

Vercel hace deploy automático cuando:

1. **Push a `main`** → Deploy a Producción
2. **Push a otra branch** → Deploy Preview
3. **Pull Request** → Deploy Preview con URL única

---

### Deploy Manual

```bash
# Instalar Vercel CLI
npm i -g vercel

# Deploy a producción
vercel --prod

# Deploy preview
vercel
```

---

### Revertir Deploy

**Si algo sale mal:**

1. Deployments → Deploy anterior
2. Click en tres puntos
3. "Promote to Production"

O desde CLI:
```bash
vercel rollback
```

---

## 🔒 Seguridad Post-Deploy

### 1. Cambiar Contraseña de Admin

```bash
# Login en producción
https://tu-dominio.com/login

# Ir a perfil y cambiar contraseña
```

### 2. Habilitar Protección de Branch

En GitHub:
- Settings → Branches
- Add rule para `main`
- ☑️ Require pull request reviews
- ☑️ Require status checks

### 3. Configurar Secrets Rotation

**Cada 3-6 meses:**
- Regenerar JWT_SECRET
- Actualizar en Vercel
- Forzar logout de todos los usuarios

---

## 📊 Monitoreo

### Vercel Analytics

1. En tu proyecto → Analytics
2. Ver:
   - Requests por segundo
   - Response times
   - Error rates
   - Top pages

### Logs

```bash
# Ver logs en tiempo real
vercel logs

# Logs de producción
vercel logs --prod

# Seguir logs
vercel logs --follow
```

### Alerts

1. Project → Settings → Notifications
2. Configurar:
   - Deploy failed
   - Build failed
   - High error rate

---

## 🐛 Troubleshooting Deploy

### Build Falla

**Error:** TypeScript errors

**Solución:**
```bash
# Verificar localmente
npm run build

# Arreglar errores
# Commit y push
```

---

### Runtime Error: "Cannot connect to database"

**Solución:**

1. Verificar variables en Vercel
2. Probar conexión:
```bash
# Con tu DIRECT_URL de prod
psql "postgresql://..."
```

3. Verificar IP whitelisting en Supabase (debe ser 0.0.0.0/0)

---

### "Module not found" en producción

**Solución:**

Verificar que todas las dependencias están en `package.json`:
```bash
npm install --save [paquete-faltante]
git add package.json package-lock.json
git commit -m "Add missing dependency"
git push
```

---

### Slow Cold Starts

**Causa:** Vercel Serverless Functions en región incorrecta

**Solución:**
1. Settings → Functions
2. Cambiar region a la más cercana a usuarios

---

## 🚦 Checklist de Producción

### Pre-Deploy
- [ ] Build exitoso localmente
- [ ] Tests pasando
- [ ] Variables de entorno configuradas
- [ ] Base de datos de prod creada
- [ ] Dominio registrado (si aplica)

### Durante Deploy
- [ ] Deploy sin errores
- [ ] Migraciones ejecutadas
- [ ] Health check: `https://tu-url.com`
- [ ] Login funciona
- [ ] APIs responden

### Post-Deploy
- [ ] Contraseña admin cambiada
- [ ] Dominio configurado
- [ ] Analytics habilitado
- [ ] Alerts configuradas
- [ ] Backups de BD configurados
- [ ] Monitoreo activo

---

## 📈 Optimizaciones

### Performance

**1. Habilitar Compression**
```javascript
// next.config.js
module.exports = {
  compress: true,
}
```

**2. Optimizar Imágenes**
```typescript
// Usar Next.js Image
import Image from 'next/image'

<Image 
  src="/logo.png" 
  width={200} 
  height={50}
  alt="Logo"
/>
```

**3. Caching**
```typescript
// En API routes
export const revalidate = 3600; // 1 hour
```

---

### Costo

**Plan Gratuito Vercel:**
- ✅ 100GB bandwidth/mes
- ✅ 6,000 build minutos/mes
- ✅ Serverless functions ilimitadas
- ✅ Deploy automático

**Si excedes:**
- Considerar plan Pro ($20/mes)
- O optimizar uso

---

## 🔄 Pipeline Recomendado

```
Development → Testing → Staging → Production
     ↓            ↓         ↓           ↓
  localhost    CI/CD    Preview     Main Deploy
```

**Branches:**
```
main (producción)
├── develop (staging)
│   ├── feature/login
│   ├── feature/jobs
│   └── feature/applications
```

---

## 📞 Soporte

**Deploy issues:**
- 📧 Email: deploy@inakat.com
- 💬 Vercel Discord: https://vercel.com/discord
- 📖 Docs: https://vercel.com/docs

---

## 🎉 ¡Deploy Completo!

Tu aplicación está ahora en producción y accesible globalmente.

**Próximos pasos:**
1. Monitorear errores primeros días
2. Configurar backups
3. Planear estrategia de updates
4. Establecer proceso de hotfix

---

**Última actualización:** Enero 2025
