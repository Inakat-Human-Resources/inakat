# 🐛 Troubleshooting - INAKAT

Guía para resolver problemas comunes en INAKAT.

---

## 📋 Tabla de Contenidos

1. [Problemas de Instalación](#problemas-de-instalación)
2. [Problemas de Base de Datos](#problemas-de-base-de-datos)
3. [Problemas de Autenticación](#problemas-de-autenticación)
4. [Problemas con Archivos](#problemas-con-archivos)
5. [Errores del Servidor](#errores-del-servidor)
6. [Problemas de Frontend](#problemas-de-frontend)
7. [Problemas de Deploy](#problemas-de-deploy)

---

## 🔧 Problemas de Instalación

### Error: "Cannot find module"

**Síntomas:**
```
Error: Cannot find module 'next'
Error: Cannot find module '@prisma/client'
```

**Solución:**

```bash
# Borrar node_modules y package-lock.json
rm -rf node_modules package-lock.json

# Reinstalar dependencias
npm install

# Si persiste, limpiar caché de npm
npm cache clean --force
npm install
```

---

### Error: "Port 3000 already in use"

**Síntomas:**
```
Error: listen EADDRINUSE: address already in use :::3000
```

**Solución en Windows:**

```bash
# Ver qué proceso usa el puerto
netstat -ano | findstr :3000

# Matar el proceso (reemplaza PID con el número que aparece)
taskkill /PID [PID] /F
```

**Solución en Mac/Linux:**

```bash
# Matar proceso en puerto 3000
lsof -ti:3000 | xargs kill -9
```

**Alternativa:**

```bash
# Usar otro puerto
PORT=3001 npm run dev
```

---

### Error: "EACCES: permission denied"

**Síntomas:**
```
EACCES: permission denied, mkdir '/usr/local/lib/node_modules'
```

**Solución:**

```bash
# En Mac/Linux, usar sudo
sudo npm install -g [paquete]

# O configurar npm para no usar sudo
mkdir ~/.npm-global
npm config set prefix '~/.npm-global'
echo 'export PATH=~/.npm-global/bin:$PATH' >> ~/.bashrc
source ~/.bashrc
```

---

## 🗄️ Problemas de Base de Datos

### Error: "Cannot connect to database"

**Síntomas:**
```
PrismaClientInitializationError: Can't reach database server
```

**Solución 1:** Verificar variables de entorno

```bash
# Verificar que .env.local existe
cat .env.local | grep DATABASE_URL

# Verificar formato correcto
# Debe ser: postgresql://...
```

**Solución 2:** Verificar conexión a Supabase

```bash
# Intentar conectar con psql
psql "postgresql://postgres.xxx:[PASSWORD]@aws-1-us-west-1.pooler.supabase.com:5432/postgres"
```

**Solución 3:** Regenerar cliente de Prisma

```bash
npx prisma generate
```

---

### Error: "P1001: Can't reach database server"

**Síntomas:**
```
Error: P1001: Can't reach database server at `aws-x-xx-west-x.pooler.supabase.com`:`5432`
```

**Causa:** URL de conexión incorrecta o firewall bloqueando

**Solución:**

1. Verifica que la URL es correcta (copia de nuevo desde Supabase)
2. Verifica que tu IP no está bloqueada
3. Intenta desde otra red (WiFi diferente)
4. Verifica que Supabase está activo: https://status.supabase.com

---

### Error: "Table does not exist"

**Síntomas:**
```
Invalid `prisma.user.findMany()` invocation:
The table `public.User` does not exist
```

**Solución:**

```bash
# Sincronizar el esquema con la base
npx prisma db push

# Regenerar cliente
npx prisma generate
```

> ⚠️ **No uses `prisma migrate dev` ni `prisma migrate reset` en este proyecto.**
> El historial de `prisma/migrations` todavía no tiene baseline: sólo cubre una
> parte de los modelos y el resto se aplicó con `db push`. `migrate dev` detecta
> *drift* y ofrece **resetear el esquema** (borra todos los datos; si tu
> `DATABASE_URL` apunta a una base compartida, se los borra a todos).
> Mientras el baseline siga pendiente, el camino soportado es `db push`.

---

### Error: "Unique constraint failed"

**Síntomas:**
```
Unique constraint failed on the fields: (`email`)
```

**Causa:** Intentando crear registro con email/RFC que ya existe

**Solución:**

```bash
# Ver datos existentes
npx prisma studio

# Buscar el registro duplicado
# Eliminarlo o usar otro email
```

---

## 🔐 Problemas de Autenticación

### Error: "Invalid token"

**Síntomas:**
```
{
  "success": false,
  "error": "Token inválido"
}
```

**Solución:**

1. Verificar que `JWT_SECRET` está configurado en `.env.local`
2. Generar nuevo secret:
   ```bash
   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
   ```
3. Reiniciar servidor
4. Hacer login de nuevo

---

### Error: "Credenciales inválidas"

**Síntomas:**
Login falla con mensaje de credenciales incorrectas

**Solución:**

```bash
# Verificar que el usuario existe
npx prisma studio
# Ir a tabla User y verificar email

# Si olvidaste la contraseña, resetear:
npx prisma db seed
# Esto creará los usuarios admin por defecto
```

---

### Error: "No autorizado" en rutas protegidas

**Síntomas:**
```
403 Forbidden
401 Unauthorized
```

**Solución:**

1. Verificar que estás enviando el token:
   ```javascript
   headers: {
     'Authorization': 'Bearer ' + token
   }
   ```

2. Verificar que el token no expiró
3. Hacer login de nuevo para obtener token fresco

---

## 📁 Problemas con Archivos

### Error: "File too large"

**Síntomas:**
```
{
  "success": false,
  "error": "Archivo muy grande. Máximo 5MB"
}
```

**Solución:**

1. Comprimir el archivo
2. Para PDFs: usar herramientas online de compresión
3. Para imágenes: reducir calidad/tamaño

---

### Error: "BLOB_READ_WRITE_TOKEN not found"

**Síntomas:**
```
Error: Missing BLOB_READ_WRITE_TOKEN environment variable
```

**Solución:**

```bash
# Verificar que la variable está en .env.local
cat .env.local | grep BLOB_READ_WRITE_TOKEN

# Si falta, obtenerla de Vercel:
# 1. Ve a tu proyecto en Vercel
# 2. Storage → Blob
# 3. Copia el token
# 4. Agrégalo a .env.local

# Reiniciar servidor
npm run dev
```

---

### Error: Upload falla sin mensaje

**Solución:**

```bash
# Verificar logs del servidor
# En la terminal donde corre npm run dev

# Verificar formato del archivo
# Soportados: .pdf, .doc, .docx, .jpg, .jpeg, .png

# Verificar tamaño
# Máximo: 5MB
```

---

## 🖥️ Errores del Servidor

### Error: "Internal Server Error 500"

**Síntomas:**
```
GET /api/... 500 (Internal Server Error)
```

**Solución:**

1. **Ver logs del servidor** en la terminal
2. **Errores comunes:**

   - Prisma not generated:
     ```bash
     npx prisma generate
     ```

   - Variable de entorno faltante:
     ```bash
     # Verificar .env.local
     cat .env.local
     ```

   - Error de sintaxis en código:
     ```bash
     npm run build
     # Esto mostrará errores de TypeScript
     ```

3. **Reiniciar servidor:**
   ```bash
   # Ctrl+C para detener
   rm -rf .next
   npm run dev
   ```

---

### Error: "Module not found" en producción

**Síntomas:**
Funciona en desarrollo pero falla en build

**Solución:**

```bash
# Verificar imports:
# ❌ Mal:
import Component from './Component'

# ✅ Bien:
import Component from './Component.tsx'

# Limpiar y rebuild
rm -rf .next
npm run build
npm run start
```

---

### Error: "Middleware not working"

**Síntomas:**
Rutas protegidas accesibles sin login

**Solución:**

1. Verificar que `src/middleware.ts` existe
2. Verificar configuración:
   ```typescript
   export const config = {
     matcher: ['/admin/:path*', '/companies/:path*']
   }
   ```
3. Reiniciar servidor

---

## 🎨 Problemas de Frontend

### Error: "Hydration failed"

**Síntomas:**
```
Error: Hydration failed because the initial UI does not match what was rendered on the server
```

**Solución:**

```bash
# Causas comunes:
# 1. Usar Date/Math.random en componentes sin 'use client'
# 2. HTML inválido (ej: <p> dentro de <p>)
# 3. localStorage en server components

# Solución:
# Agregar 'use client' al componente
# O mover lógica a useEffect
```

---

### Error: Estilos de Tailwind no se aplican

**Síntomas:**
Clases de Tailwind no funcionan

**Solución:**

```bash
# 1. Verificar que el archivo está en content de tailwind.config
# Ver tailwind.config.ts:
content: [
  './src/**/*.{js,ts,jsx,tsx,mdx}',
]

# 2. Reiniciar servidor
npm run dev

# 3. Si persiste, reinstalar Tailwind
npm install -D tailwindcss postcss autoprefixer
npx tailwindcss init -p
```

---

### Error: "localStorage is not defined"

**Síntomas:**
```
ReferenceError: localStorage is not defined
```

**Causa:** Usando localStorage en server component

**Solución:**

```typescript
// Agregar al inicio del componente
'use client'

// O usar dentro de useEffect
useEffect(() => {
  const data = localStorage.getItem('key')
}, [])
```

---

## 🚀 Problemas de Deploy

### Error: Build falla en Vercel

**Síntomas:**
Deploy falla con errores de TypeScript

**Solución:**

```bash
# 1. Verificar localmente
npm run build

# 2. Arreglar errores de TypeScript

# 3. Verificar variables de entorno en Vercel
# Settings → Environment Variables

# 4. Agregar todas las variables de .env.local
```

---

### Error: "DATABASE_URL not found" en producción

**Síntomas:**
App deployada pero no conecta a BD

**Solución:**

1. En Vercel → Settings → Environment Variables
2. Agregar todas las variables:
   - `DATABASE_URL`
   - `DIRECT_URL`
   - `JWT_SECRET`
   - `BLOB_READ_WRITE_TOKEN`
3. Redeploy

---

### Error: Rutas 404 después de deploy

**Síntomas:**
Rutas funcionan local pero 404 en producción

**Solución:**

```bash
# Verificar estructura de carpetas
# Next.js 14 usa App Router:
src/app/ruta/page.tsx  # ✅
src/pages/ruta.tsx     # ❌ (pages router antiguo)

# Rebuild
npm run build
```

---

## 🔍 Herramientas de Debugging

### Logs del Servidor

```bash
# Ver logs detallados
NODE_ENV=development npm run dev

# Ver logs de Prisma
DEBUG=prisma:* npm run dev
```

---

### Prisma Studio

```bash
# Interface visual para la BD
npx prisma studio

# Se abre en http://localhost:5555
```

---

### DevTools de React

1. Instala React DevTools en Chrome/Firefox
2. Abre DevTools (F12)
3. Tab "Components" para ver árbol de componentes
4. Tab "Profiler" para medir performance

---

### Network Tab

1. Abre DevTools (F12)
2. Tab "Network"
3. Ver requests a APIs
4. Ver status codes y responses

---

## 📞 Cuando Todo Falla

Si ninguna solución funciona:

1. **Reset completo:**
   ```bash
   # Borrar todo
   rm -rf node_modules .next package-lock.json
   
   # Reinstalar
   npm install
   npx prisma generate
   npx prisma db push
   
   # Reiniciar
   npm run dev
   ```

2. **Crear issue en GitHub:**
   - Describe el problema
   - Incluye logs de error
   - Menciona pasos para reproducir

3. **Contactar soporte:**
   - 📧 soporte@inakat.com
   - 💬 Discord: https://discord.gg/inakat

---

## 🔄 Comandos Útiles de Rescate

```bash
# Limpiar todo y empezar fresco
npm run clean      # (si existe el script)
rm -rf node_modules .next
npm install

# Sincronizar el esquema con la base (desarrollo)
npx prisma db push

# NO uses `npx prisma migrate reset`: borra todos los datos y el historial de
# migraciones de este proyecto aún no tiene baseline.

# Ver info de Node/npm
node --version
npm --version

# Ver variables de entorno cargadas
node -e "require('dotenv').config({path:'.env.local'}); console.log(process.env)"

# Test de conexión a BD
npx prisma db pull
```

---

## 📊 Checklist de Debugging

Cuando algo no funciona, revisa:

- [ ] ¿Servidor corriendo? (`npm run dev`)
- [ ] ¿Variables de entorno en `.env`? (Prisma CLI no lee `.env.local`)
- [ ] ¿Prisma client generado? (`npx prisma generate`)
- [ ] ¿Esquema sincronizado? (`npx prisma db push`)
- [ ] ¿Puerto 3000 libre?
- [ ] ¿Conexión a internet OK?
- [ ] ¿Supabase activo? (https://status.supabase.com)
- [ ] ¿Logs del servidor muestran errores?
- [ ] ¿Console del navegador muestra errores?
- [ ] ¿Probaste reiniciar el servidor?

---

**Última actualización:** Enero 2025
