# 🔒 Política de Seguridad - INAKAT

Lineamientos de seguridad y cómo reportar vulnerabilidades.

---

## 🛡️ Medidas de Seguridad Implementadas

### Autenticación y Autorización

**✅ JWT (JSON Web Tokens)**
- Tokens firmados con HS256
- Secret de 32+ caracteres
- Expiración de 7 días
- Almacenamiento en httpOnly cookies (recomendado para producción)

**✅ Passwords**
- Hash con bcrypt (10 rounds)
- Mínimo 8 caracteres
- Validación de complejidad
- Nunca almacenados en texto plano

**✅ Protección de Rutas**
- Middleware de Next.js
- Verificación de tokens en cada request
- Verificación de roles (admin, company, user)

---

### Base de Datos

**✅ Prisma ORM**
- Prevención de SQL injection
- Queries parametrizadas
- Validación de tipos con TypeScript

**✅ Conexiones**
- TLS/SSL habilitado
- Connection pooling de Supabase
- Credenciales en variables de entorno

**✅ Datos Sensibles**
- Passwords hasheados
- RFCs validados y únicos
- Emails validados y únicos

---

### Upload de Archivos

**✅ Validación de Archivos**
```typescript
// Tipos permitidos
const ALLOWED_TYPES = [
  'application/pdf',
  'image/jpeg',
  'image/png',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
];

// Tamaño máximo: 5MB
const MAX_FILE_SIZE = 5 * 1024 * 1024;
```

**⚠️ Almacenamiento (estado real, INFRA-028)**
- Vercel Blob Storage con `access: 'public'` (`src/app/api/upload/route.ts`).
- Las URLs **no** están firmadas ni caducan: quien tenga la URL de un CV o de
  un documento puede descargarlo sin autenticarse. La protección es sólo que
  el nombre del archivo es aleatorio y no se lista en ningún sitio público.
- Pasar a blobs privados servidos por una ruta autenticada es un pendiente
  conocido (ver `docs/AUDITORIA-2026-06.md`, #56).
- Sin `BLOB_READ_WRITE_TOKEN` (desarrollo) los archivos van a `public/uploads`,
  que está en `.gitignore`.

---

### API Endpoints

**✅ Validación de Inputs**
- Zod schemas para validación (`src/lib/validations.ts`)
- Sanitización de datos (`src/lib/sanitize.ts`)
- Validación de tipos

**✅ Rate Limiting (`src/lib/rate-limit.ts`)**
- Implementado **en memoria por instancia**: en Vercel cada lambda lleva su
  propio contador, así que el límite efectivo es aproximado.
- Login: 7 intentos fallidos / 15 min por IP y 10 / 15 min por cuenta.
- Registro, recuperación y cambio de contraseña, subidas (15 / h por IP),
  contacto, postulaciones y validación de códigos de descuento tienen su propio
  límite. Al superarlo se responde **429**.

**CORS**
- No hay configuración CORS propia: se aplica la política same-origin del
  navegador. La API de integración (`/api/integration/*`) se consume
  servidor-a-servidor con `Authorization: Bearer` / `X-Api-Key`.

---

### Headers de Seguridad

Definidas en `next.config.ts` (y comprobadas por
`__tests__/config/next-config.test.ts`):

| Cabecera | Valor |
|----------|-------|
| `X-Frame-Options` | `SAMEORIGIN` |
| `X-Content-Type-Options` | `nosniff` |
| `Referrer-Policy` | `strict-origin-when-cross-origin` |
| `Strict-Transport-Security` | `max-age=63072000; includeSubDomains; preload` |
| `Permissions-Policy` | `camera=(), microphone=(), geolocation=(self), browsing-topics=()` |
| `Content-Security-Policy-Report-Only` | política con los orígenes de Mercado Pago, Google Maps y Vercel Blob |

La CSP está en modo **Report-Only** (avisa, no bloquea). Pasarla a
`Content-Security-Policy` es una acción manual pendiente, tras recorrer en
staging el checkout y los formularios con mapa sin violaciones. Además
`poweredByHeader: false` quita `X-Powered-By`.

---

## 🚨 Reportar Vulnerabilidades

### Proceso de Reporte

Si encuentras una vulnerabilidad de seguridad:

**1. NO crear issue público**
   - Las vulnerabilidades no deben ser públicas hasta ser resueltas

**2. Enviar reporte privado**
   - Email: security@inakat.com
   - Asunto: [SECURITY] Descripción breve

**3. Incluir en el reporte:**
   - Descripción detallada
   - Pasos para reproducir
   - Impacto potencial
   - Versión afectada
   - Screenshots/videos (si aplica)

**4. Tiempo de respuesta:**
   - Acuse de recibo: 24 horas
   - Evaluación inicial: 72 horas
   - Plan de acción: 1 semana
   - Fix en producción: según severidad

---

### Clasificación de Severidad

**🔴 CRÍTICA**
- Ejecución remota de código
- Inyección SQL
- Exposición de credenciales
- Bypass de autenticación

**🟠 ALTA**
- XSS (Cross-Site Scripting)
- CSRF (Cross-Site Request Forgery)
- Escalación de privilegios
- Exposición de datos sensibles

**🟡 MEDIA**
- Información sensible en logs
- Validación de inputs insuficiente
- Rate limiting ausente
- Configuración insegura

**🟢 BAJA**
- Información sobre versiones
- Problemas menores de configuración
- Mejoras generales de seguridad

---

### Programa de Recompensas

**Actualmente no hay programa formal**

En el futuro planeamos:
- Reconocimiento público (Hall of Fame)
- Recompensas monetarias para vulnerabilidades críticas

---

## 🔐 Mejores Prácticas para Desarrolladores

### Variables de Entorno

**❌ NUNCA:**
```typescript
// Hardcodear secrets
const secret = "mi-super-secreto-123";

// Commitear .env.local
git add .env.local
```

**✅ SIEMPRE:**
```typescript
// Usar variables de entorno
const secret = process.env.JWT_SECRET;

// Verificar existencia
if (!secret) {
  throw new Error('JWT_SECRET not configured');
}
```

---

### Manejo de Passwords

**❌ MAL:**
```typescript
// Almacenar en texto plano
await prisma.user.create({
  data: {
    password: plainPassword
  }
});
```

**✅ BIEN:**
```typescript
// Hash antes de guardar
import bcrypt from 'bcryptjs';

const hashedPassword = await bcrypt.hash(plainPassword, 10);

await prisma.user.create({
  data: {
    password: hashedPassword
  }
});
```

---

### Validación de Inputs

**❌ MAL:**
```typescript
// Sin validación
const { email, password } = req.body;
// Usar directamente
```

**✅ BIEN:**
```typescript
import { z } from 'zod';

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(8)
});

const { email, password } = schema.parse(req.body);
```

---

### Queries a Base de Datos

**❌ MAL:**
```typescript
// String interpolation (vulnerable a SQL injection)
const query = `SELECT * FROM users WHERE email = '${email}'`;
```

**✅ BIEN:**
```typescript
// Usar Prisma ORM
const user = await prisma.user.findUnique({
  where: { email }
});
```

---

### Autenticación

**❌ MAL:**
```typescript
// Token en localStorage (vulnerable a XSS)
localStorage.setItem('token', token);

// Sin verificación de expiración
const user = jwt.decode(token);
```

**✅ BIEN:**
```typescript
// Token en cookie httpOnly (así lo hace src/app/api/auth/login/route.ts)
response.cookies.set('auth-token', result.token, getAuthCookieOptions());

// Verificar token y estado vigente del usuario (src/lib/auth.ts, jsonwebtoken):
// requireAuth/requireRole consultan la base y rechazan cuentas inactivas.
const auth = await requireRole('admin');
if ('error' in auth) {
  return NextResponse.json({ success: false, error: auth.error }, { status: auth.status });
}
```

---

### Upload de Archivos

**❌ MAL:**
```typescript
// Sin validación
const file = req.file;
await uploadFile(file);
```

**✅ BIEN:**
```typescript
// Validar tipo y tamaño
const ALLOWED_TYPES = ['application/pdf', 'image/jpeg'];
const MAX_SIZE = 5 * 1024 * 1024; // 5MB

if (!ALLOWED_TYPES.includes(file.type)) {
  throw new Error('File type not allowed');
}

if (file.size > MAX_SIZE) {
  throw new Error('File too large');
}

await uploadFile(file);
```

---

## 🔍 Auditorías de Seguridad

### Herramientas Recomendadas

**npm audit**
```bash
# Verificar vulnerabilidades en dependencias
npm audit

# Fix automático
npm audit fix
```

**Snyk**
```bash
# Instalar
npm install -g snyk

# Verificar
snyk test

# Monitorear
snyk monitor
```

**OWASP ZAP**
- Scanner de vulnerabilidades web
- https://www.zaproxy.org/

---

### Checklist de Seguridad

**Antes de Deploy:**
- [ ] npm audit sin vulnerabilidades críticas
- [ ] Variables de entorno configuradas
- [ ] JWT_SECRET único por ambiente
- [ ] Passwords de BD fuertes
- [ ] HTTPS habilitado en producción
- [ ] Headers de seguridad configurados
- [ ] Rate limiting habilitado
- [ ] Logs no exponen datos sensibles
- [ ] Error messages no revelan información interna
- [ ] CORS configurado correctamente

**Mensual:**
- [ ] Rotar JWT_SECRET
- [ ] Revisar logs de acceso
- [ ] Actualizar dependencias
- [ ] Backup de base de datos
- [ ] Revisar usuarios activos

**Trimestral:**
- [ ] Auditoría de código
- [ ] Penetration testing
- [ ] Revisar permisos de usuarios
- [ ] Actualizar documentación de seguridad

---

## 🚧 Vulnerabilidades Conocidas

### Versión Actual

Hay riesgos conocidos y aceptados temporalmente. La lista viva está en:

- `docs/AUDITORIA-2026-06.md` — acciones manuales pendientes (entre ellas los
  blobs públicos, #56, y la baseline de migraciones, #8).
- `docs/AUDITORIA-2026-09.md` — auditoría en remediación.

Resumen de los que afectan a datos personales:

- Documentos subidos (CV, identificaciones, actas) accesibles por URL pública
  sin autenticación (ver "Almacenamiento").
- `POST /api/upload` es público para permitir el registro de empresas; su único
  freno es el rate limit en memoria.
- CSP todavía en modo Report-Only.

---

## 📚 Recursos de Seguridad

### Documentación
- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [Next.js Security](https://nextjs.org/docs/advanced-features/security-headers)
- [Prisma Security](https://www.prisma.io/docs/concepts/components/prisma-client/security)

### Cursos
- [Web Security Academy](https://portswigger.net/web-security)
- [OWASP WebGoat](https://owasp.org/www-project-webgoat/)

### Comunidades
- [r/netsec](https://reddit.com/r/netsec)
- [HackerOne](https://hackerone.com)

---

## 🔄 Actualizaciones de Seguridad

### Versión 1.0.0 (Enero 2025)
- ✅ Autenticación JWT implementada
- ✅ Passwords hasheados con bcrypt
- ✅ Validación de inputs con Zod
- ✅ Upload de archivos seguro
- ✅ Protección de rutas con middleware
- ✅ Headers de seguridad configurados

### 2026
- ✅ Rate limiting en memoria (login, registro, subidas, contacto...)
- ✅ Cabeceras de seguridad (#86) y CSP en Report-Only (INFRA-014)

### Pendiente
- 2FA (Two-Factor Authentication)
- Logs de auditoría
- Session management mejorado
- Content Security Policy (CSP)

---

## 📧 Contacto

**Seguridad:**
- 📧 Email: security@inakat.com
- 🔐 PGP Key: [Disponible próximamente]

**Soporte General:**
- 📧 Email: soporte@inakat.com
- 💬 Discord: https://discord.gg/inakat

---

## ⚖️ Divulgación Responsable

Agradecemos a los investigadores de seguridad que reportan vulnerabilidades de manera responsable.

**Compromisos:**
- Acuse de recibo en 24 horas
- No tomar acción legal contra reportes de buena fe
- Mantener confidencialidad hasta resolución
- Reconocimiento público (con permiso)

---

**Última actualización:** Enero 2025  
**Versión:** 1.0.0
