# 🔌 Documentación de API - INAKAT

API REST de INAKAT construida con Next.js API Routes.

**Base URL:** `http://localhost:3000/api` (desarrollo)

---

## 🔐 Autenticación

La mayoría de endpoints requieren sesión. La sesión **no** viaja en una cabecera
`Authorization`: `POST /api/auth/login` responde con una **cookie httpOnly**
llamada `auth-token` y es esa cookie la que lee `src/middleware.ts`.

### Headers Requeridos

```http
Content-Type: application/json
Cookie: auth-token=<jwt>        # lo pone el navegador automáticamente
```

Desde un cliente HTTP hay que conservar la cookie:

```bash
curl -c cookies.txt -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"...","password":"..."}'

curl -b cookies.txt http://localhost:3000/api/my-applications
```

> La única superficie que acepta `Authorization: Bearer` / `X-Api-Key` es el
> puente de integración `/api/integration/*`; ver
> [WORKY2_INTEGRATION.md](./WORKY2_INTEGRATION.md).

### Códigos de error transversales

| Código | Cuándo |
| ------ | ------ |
| 401 | Sin cookie `auth-token`, o token inválido/expirado |
| 403 | Autenticado pero sin el rol necesario para la ruta |
| 429 | Rate limit por IP superado (ver la sección de Rate Limiting) |

### Obtener la cookie de sesión

Ver endpoint [POST /api/auth/login](#post-apiauthlogin)

---

## 📚 Endpoints

### Autenticación

#### POST /api/auth/login

Iniciar sesión. Devuelve el usuario y **establece la cookie httpOnly
`auth-token`**; el JWT NO viene en el cuerpo de la respuesta.

**Rate limit:** 7 intentos fallidos por 15 minutos por IP y 10 por cuenta (un login correcto reinicia el contador).

**Request:**
```http
POST /api/auth/login
Content-Type: application/json

{
  "email": "tu-usuario@dominio.com",
  "password": "<tu contraseña>"
}
```

**Response 200:**
```json
{
  "success": true,
  "message": "Login exitoso",
  "user": {
    "id": 1,
    "email": "admin@inakat.com",
    "nombre": "Administrador",
    "role": "admin"
  }
}
```
```http
Set-Cookie: auth-token=<jwt>; HttpOnly; Path=/; SameSite=Lax; Max-Age=<JWT_EXPIRES_IN en segundos>
```

**Response 400:** cuerpo inválido (`errors` con los campos).

**Response 401:**
```json
{
  "success": false,
  "error": "Credenciales inválidas"
}
```

**Response 429:** demasiados intentos desde la misma IP.

---

### Vacantes (Jobs)

#### GET /api/jobs

Listar vacantes activas con filtros opcionales.

**Query Parameters:**
- `status` (string, optional): Estado de la vacante (default: "active")
- `search` (string, optional): Buscar en título, empresa o descripción
- `location` (string, optional): Filtrar por ubicación
- `jobType` (string, optional): Filtrar por tipo de trabajo

**Request:**
```http
GET /api/jobs?status=active&location=Monterrey&jobType=Tiempo%20Completo
```

**Response 200:**
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "title": "Desarrollador Full Stack",
      "company": "TechSolutions México",
      "location": "Monterrey, Nuevo León",
      "salary": "$35,000 - $50,000 / mes",
      "jobType": "Tiempo Completo",
      "isRemote": true,
      "companyRating": 4.5,
      "description": "Estamos buscando...",
      "requirements": "3+ años de experiencia...",
      "status": "active",
      "createdAt": "2025-01-15T10:00:00.000Z",
      "updatedAt": "2025-01-15T10:00:00.000Z"
    }
  ],
  "count": 1
}
```

---

#### GET /api/jobs/[id]

Obtener detalles de una vacante específica.

**Request:**
```http
GET /api/jobs/1
```

**Response 200:**
```json
{
  "success": true,
  "data": {
    "id": 1,
    "title": "Desarrollador Full Stack",
    "company": "TechSolutions México",
    "location": "Monterrey, Nuevo León",
    "salary": "$35,000 - $50,000 / mes",
    "jobType": "Tiempo Completo",
    "isRemote": true,
    "companyRating": 4.5,
    "description": "Estamos buscando...",
    "requirements": "3+ años de experiencia...",
    "status": "active",
    "createdAt": "2025-01-15T10:00:00.000Z"
  }
}
```

**Response 404:**
```json
{
  "success": false,
  "error": "Job not found"
}
```

---

#### POST /api/jobs

Crear nueva vacante.

**🔒 Requiere autenticación**

**Request:**
```http
POST /api/jobs
Cookie: auth-token=<jwt>
Content-Type: application/json

{
  "title": "Ingeniero DevOps",
  "company": "Tech Corp",
  "location": "Ciudad de México",
  "salary": "$45,000 - $65,000 / mes",
  "jobType": "Tiempo Completo",
  "isRemote": false,
  "description": "Únete a nuestro equipo...",
  "requirements": "4+ años en roles DevOps...",
  "companyRating": 4.7,
  "expiresAt": "2025-03-15T00:00:00.000Z"
}
```

**Response 201:**
```json
{
  "success": true,
  "message": "Vacante creada exitosamente",
  "data": {
    "id": 19,
    "title": "Ingeniero DevOps",
    ...
  }
}
```

**Response 400:**
```json
{
  "success": false,
  "error": "Faltan campos requeridos: title, company, location, salary, jobType, description"
}
```

---

#### PATCH /api/jobs/[id]

Actualizar una vacante existente.

**🔒 Requiere autenticación**

**Request:**
```http
PATCH /api/jobs/1
Cookie: auth-token=<jwt>
Content-Type: application/json

{
  "status": "closed",
  "salary": "$50,000 - $70,000 / mes"
}
```

**Response 200:**
```json
{
  "success": true,
  "message": "Job updated successfully",
  "data": {
    "id": 1,
    "status": "closed",
    "salary": "$50,000 - $70,000 / mes",
    ...
  }
}
```

---

#### DELETE /api/jobs/[id]

Eliminar una vacante.

**🔒 Requiere autenticación**

**Request:**
```http
DELETE /api/jobs/1
Cookie: auth-token=<jwt>
```

**Response 200:**
```json
{
  "success": true,
  "message": "Job deleted successfully"
}
```

---

### Aplicaciones (Applications)

#### GET /api/applications

Listar aplicaciones con filtros opcionales.

**🔒 Requiere autenticación**

**Query Parameters:**
- `jobId` (number, optional): Filtrar por vacante
- `status` (string, optional): Filtrar por estado
- `candidateEmail` (string, optional): Filtrar por email

**Request:**
```http
GET /api/applications?status=pending&jobId=1
Cookie: auth-token=<jwt>
```

**Response 200:**
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "jobId": 1,
      "candidateName": "María González Hernández",
      "candidateEmail": "maria.gonzalez@email.com",
      "candidatePhone": "81 2345 6789",
      "cvUrl": "https://blob.vercel-storage.com/cv-123.pdf",
      "coverLetter": "Estimado equipo...",
      "status": "pending",
      "notes": null,
      "createdAt": "2025-01-16T08:30:00.000Z",
      "job": {
        "id": 1,
        "title": "Desarrollador Full Stack",
        "company": "TechSolutions México",
        "location": "Monterrey, Nuevo León",
        "salary": "$35,000 - $50,000 / mes"
      }
    }
  ],
  "count": 1
}
```

---

#### GET /api/applications/[id]

Obtener detalles de una aplicación específica.

**🔒 Requiere autenticación**

**Request:**
```http
GET /api/applications/1
Cookie: auth-token=<jwt>
```

**Response 200:**
```json
{
  "success": true,
  "data": {
    "id": 1,
    "candidateName": "María González Hernández",
    "candidateEmail": "maria.gonzalez@email.com",
    "candidatePhone": "81 2345 6789",
    "cvUrl": "https://blob.vercel-storage.com/cv-123.pdf",
    "coverLetter": "Estimado equipo...",
    "status": "pending",
    "notes": null,
    "createdAt": "2025-01-16T08:30:00.000Z",
    "job": {
      "id": 1,
      "title": "Desarrollador Full Stack",
      "company": "TechSolutions México"
    }
  }
}
```

---

#### POST /api/applications

Crear nueva aplicación a vacante.

**Request:**
```http
POST /api/applications
Content-Type: application/json

{
  "jobId": 1,
  "candidateName": "Juan Pérez García",
  "candidateEmail": "juan.perez@email.com",
  "candidatePhone": "81 1234 5678",
  "cvUrl": "https://blob.vercel-storage.com/cv-456.pdf",
  "coverLetter": "Me dirijo a ustedes..."
}
```

**Response 201:**
```json
{
  "success": true,
  "message": "Aplicación enviada exitosamente",
  "data": {
    "id": 13,
    "candidateName": "Juan Pérez García",
    "status": "pending",
    ...
  }
}
```

**Response 400 (Duplicado):**
```json
{
  "success": false,
  "error": "Ya has aplicado a esta vacante anteriormente"
}
```

**Response 400 (Vacante inactiva):**
```json
{
  "success": false,
  "error": "Esta vacante ya no está activa"
}
```

---

#### PATCH /api/applications/[id]

Actualizar estado de aplicación.

**🔒 Requiere autenticación**

**Request:**
```http
PATCH /api/applications/1
Cookie: auth-token=<jwt>
Content-Type: application/json

{
  "status": "interviewed",
  "notes": "Candidato prometedor, agendar segunda entrevista"
}
```

**Estados válidos:**
- `pending` - Pendiente
- `reviewing` - En Revisión
- `interviewed` - Entrevistado
- `accepted` - Aceptado
- `rejected` - Rechazado

**Response 200:**
```json
{
  "success": true,
  "message": "Application updated successfully",
  "data": {
    "id": 1,
    "status": "interviewed",
    "notes": "Candidato prometedor...",
    "reviewedAt": "2025-01-16T15:30:00.000Z"
  }
}
```

---

#### DELETE /api/applications/[id]

Eliminar aplicación.

**🔒 Requiere autenticación**

**Request:**
```http
DELETE /api/applications/1
Cookie: auth-token=<jwt>
```

**Response 200:**
```json
{
  "success": true,
  "message": "Application deleted successfully"
}
```

---

### Empresas (Companies)

> ⚠️ Las rutas son `/api/company-requests` y `/api/company-requests/[id]`.
> `/api/companies` **no existe** (responde 404).

#### POST /api/company-requests

Registrar solicitud de empresa. **Ruta pública** (excepción del middleware) con
rate limit por IP.

**Request:**
```http
POST /api/company-requests
Content-Type: application/json

{
  "nombre": "Juan",
  "apellidoPaterno": "Pérez",
  "apellidoMaterno": "García",
  "nombreEmpresa": "Tech Solutions SA de CV",
  "correoEmpresa": "contacto@techsolutions.mx",
  "sitioWeb": "https://techsolutions.mx",
  "razonSocial": "Tech Solutions SA de CV",
  "rfc": "TSO123456ABC",
  "direccionEmpresa": "Av. Constitución 123, Monterrey, NL",
  "identificacionUrl": "https://blob.vercel-storage.com/id-123.pdf",
  "documentosConstitucionUrl": "https://blob.vercel-storage.com/const-123.pdf"
}
```

**Response 201:**
```json
{
  "success": true,
  "message": "Solicitud enviada exitosamente. Te notificaremos cuando sea revisada.",
  "data": {
    "id": 5,
    "status": "pending",
    ...
  }
}
```

**Response 400:**
```json
{
  "success": false,
  "error": "El RFC ya está registrado"
}
```

---

#### GET /api/company-requests

Listar solicitudes de empresas (Admin).

**🔒 Requiere autenticación de Admin** (el middleware devuelve 403 a cualquier
otro rol)

**Query Parameters:**
- `status` (string, optional): pending, approved, rejected

**Request:**
```http
GET /api/company-requests?status=pending
Cookie: auth-token=<jwt de un usuario admin>
```

**Response 200:**
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "nombreEmpresa": "Tech Solutions SA de CV",
      "correoEmpresa": "contacto@techsolutions.mx",
      "rfc": "TSO123456ABC",
      "status": "pending",
      "createdAt": "2025-01-15T10:00:00.000Z"
    }
  ]
}
```

---

#### PATCH /api/company-requests/[id]

Aprobar o rechazar solicitud (Admin). El cuerpo lleva **`status`**, no `action`:
los valores válidos son `pending`, `approved` y `rejected` (cualquier otro
devuelve 400).

**🔒 Requiere autenticación de Admin**

**Request (Aprobar):**
```http
PATCH /api/company-requests/1
Cookie: auth-token=<jwt de un usuario admin>
Content-Type: application/json

{
  "status": "approved"
}
```

**Request (Rechazar):**
```http
PATCH /api/company-requests/1
Cookie: auth-token=<jwt de un usuario admin>
Content-Type: application/json

{
  "status": "rejected",
  "rejectionReason": "Documentos incompletos"
}
```

**Response 200:**
```json
{
  "success": true,
  "message": "Solicitud aprobada. Se ha creado la cuenta de la empresa.",
  "user": {
    "id": 5,
    "email": "contacto@techsolutions.mx",
    "role": "company"
  }
}
```

---

### Upload de Archivos

#### POST /api/upload

Subir archivo a Vercel Blob Storage.

**Request:**
```http
POST /api/upload
Content-Type: multipart/form-data

file: [binary data]
```

**Formatos aceptados:**
- PDF: `.pdf`
- Imágenes: `.jpg`, `.jpeg`, `.png`
- Documentos: `.doc`, `.docx`

**Tamaño máximo:** 5MB

**Response 200:**
```json
{
  "success": true,
  "url": "https://blob.vercel-storage.com/file-abc123.pdf"
}
```

**Response 400:**
```json
{
  "success": false,
  "error": "Archivo muy grande. Máximo 5MB"
}
```

---

## 🔒 Códigos de Estado

| Código | Significado |
|--------|-------------|
| 200 | OK - Solicitud exitosa |
| 201 | Created - Recurso creado exitosamente |
| 400 | Bad Request - Error en los datos enviados |
| 401 | Unauthorized - No autenticado |
| 403 | Forbidden - No autorizado (sin permisos) |
| 404 | Not Found - Recurso no encontrado |
| 409 | Conflict - Duplicado o recurso en uso |
| 429 | Too Many Requests - Rate limit por IP superado |
| 500 | Internal Server Error - Error del servidor |

---

## 📝 Ejemplos con cURL

### Login (guarda la cookie de sesión en cookies.txt)
```bash
curl -c cookies.txt -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"TU_EMAIL","password":"TU_PASSWORD"}'
```

### Listar Vacantes
```bash
curl http://localhost:3000/api/jobs?status=active
```

### Crear Vacante
```bash
curl -b cookies.txt -X POST http://localhost:3000/api/jobs \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Backend Developer",
    "company": "Tech Corp",
    "location": "CDMX",
    "salary": "$40,000 / mes",
    "jobType": "Tiempo Completo",
    "description": "Buscamos...",
    "requirements": "3+ años..."
  }'
```

### Aplicar a Vacante
```bash
curl -X POST http://localhost:3000/api/applications \
  -H "Content-Type: application/json" \
  -d '{
    "jobId": 1,
    "candidateName": "Ana López",
    "candidateEmail": "ana@email.com",
    "coverLetter": "Me interesa..."
  }'
```

---

## 🧪 Testing manual

No hay colección de Postman versionada en el repo. Para probar a mano:

1. Haz login con `curl -c cookies.txt` (ver ejemplos) y reutiliza `cookies.txt`.
2. En Postman/Insomnia, activa el manejo de cookies: la sesión es una cookie
   httpOnly, no una cabecera `Authorization`.
3. Los roles importan: el middleware devuelve 403 antes de llegar al handler.

---

## 📚 Rate Limiting

**Sí hay rate limiting** (en memoria, por IP y por instancia; ver
`src/lib/rate-limit.ts`). Al superarlo la respuesta es **429**.

| Endpoint | Límite |
|----------|--------|
| `POST /api/auth/login` | 7 fallidos por 15 min por IP; 10 fallidos por 15 min por cuenta |
| `POST /api/auth/register` | 3 por hora |
| `POST /api/auth/forgot-password` | 3 por hora |
| `POST /api/auth/reset-password` | 5 por 15 min |
| `POST /api/upload` | 15 por hora |
| `POST /api/applications` (público) | 10 por hora |
| `POST /api/contact` | 5 por hora |
| Validación de código de descuento | 10 por 15 min |

> Es un contador en memoria: cada instancia serverless lleva el suyo, así que el
> límite efectivo se multiplica por el número de instancias. Para un límite duro
> hace falta un almacén compartido.

---

## 🐛 Manejo de Errores

Todos los errores siguen este formato:

```json
{
  "success": false,
  "error": "Mensaje descriptivo del error"
}
```

---

## 📞 Soporte

¿Problemas con la API?

- 📧 Email: api@inakat.com
- 📖 Docs: https://docs.inakat.com/api
- 💬 Discord: https://discord.gg/inakat

---

**Última actualización:** Septiembre 2026

> Este documento cubre sólo una parte de las rutas. La referencia definitiva son
> los `route.ts` bajo `src/app/api/`. Si encuentras una diferencia entre este
> documento y el código, manda el cambio al documento: el código es el contrato.
