# 🚀 SISTEMA DE APLICACIONES - GUÍA DE INSTALACIÓN

> ⚠️ **Documento histórico.** Describe cómo se incorporó el sistema de
> aplicaciones en su día; hoy ya forma parte del código. No lo sigas para montar
> un entorno (usa `docs/INSTALLATION.md`) y, en particular, **no ejecutes
> `prisma migrate dev`**: sobre una base sincronizada con `db push` detecta
> *drift* y ofrece borrar el esquema (INFRA-013).

## 📦 ARCHIVOS CREADOS

### APIs (Backend)

1. `applications-route.ts` → `src/app/api/applications/route.ts`
2. `applications-id-route.ts` → `src/app/api/applications/[id]/route.ts`

### Componentes (Frontend)

3. `ApplyJobModal.tsx` → `src/components/sections/talents/ApplyJobModal.tsx`
4. `SearchPositionsSection-WithApplications.tsx` → `src/components/sections/talents/SearchPositionsSection.tsx`
5. `ApplicationsManagementPanel.tsx` → `src/components/sections/applications/ApplicationsManagementPanel.tsx`

### Páginas

6. `applications-page.tsx` → `src/app/applications/page.tsx`

---

## 🗄️ PASO 1: ACTUALIZAR PRISMA SCHEMA

```bash
nano prisma/schema.prisma
```

**AL FINAL del archivo, AGREGAR:**

```prisma
// =============================================
// APLICACIONES A VACANTES
// =============================================
model Application {
  id              Int       @id @default(autoincrement())

  // Relaciones
  jobId           Int
  job             Job       @relation(fields: [jobId], references: [id], onDelete: Cascade)

  userId          Int?
  user            User?     @relation(fields: [userId], references: [id], onDelete: SetNull)

  // Información del candidato
  candidateName   String
  candidateEmail  String
  candidatePhone  String?

  // Documentos
  cvUrl           String?
  coverLetter     String?   @db.Text

  // Estado
  status          String    @default("pending")
  notes           String?   @db.Text

  // Timestamps
  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt
  reviewedAt      DateTime?

  @@index([jobId])
  @@index([userId])
  @@index([status])
  @@index([candidateEmail])
  @@index([createdAt])
}
```

**ACTUALIZAR modelo User (agregar dentro del modelo):**

```prisma
model User {
  // ... campos existentes ...
  jobs              Job[]
  applications      Application[]      // ← AGREGAR ESTA LÍNEA
}
```

**ACTUALIZAR modelo Job (agregar dentro del modelo):**

```prisma
model Job {
  // ... campos existentes ...
  applications    Application[]      // ← AGREGAR ESTA LÍNEA
}
```

**Guardar:** Ctrl+X, Y, Enter

---

## 🔄 PASO 2: CREAR MIGRACIÓN

```bash
npx prisma migrate dev --name add_applications
npx prisma generate
```

---

## 📁 PASO 3: INSTALAR API ROUTES

```bash
# Crear directorios
mkdir -p src/app/api/applications/[id]

# Copiar archivos
cp ~/Downloads/applications-route.ts src/app/api/applications/route.ts
cp ~/Downloads/applications-id-route.ts src/app/api/applications/[id]/route.ts
```

---

## 🎨 PASO 4: INSTALAR COMPONENTES

```bash
# Crear directorio para componentes de aplicaciones
mkdir -p src/components/sections/applications

# Copiar modal de aplicación
cp ~/Downloads/ApplyJobModal.tsx src/components/sections/talents/ApplyJobModal.tsx

# Reemplazar SearchPositionsSection con la nueva versión
cp src/components/sections/talents/SearchPositionsSection.tsx src/components/sections/talents/SearchPositionsSection.tsx.backup
cp ~/Downloads/SearchPositionsSection-WithApplications.tsx src/components/sections/talents/SearchPositionsSection.tsx

# Copiar panel de gestión
cp ~/Downloads/ApplicationsManagementPanel.tsx src/components/sections/applications/ApplicationsManagementPanel.tsx
```

---

## 📄 PASO 5: CREAR PÁGINA DE APLICACIONES

```bash
# Crear directorio
mkdir -p src/app/applications

# Copiar página
cp ~/Downloads/applications-page.tsx src/app/applications/page.tsx
```

---

## 🚀 PASO 6: REINICIAR SERVIDOR

```bash
npm run dev
```

---

## 🧪 PRUEBAS

### 1. Probar aplicación a vacante

- Ve a: `http://localhost:3000/talents`
- Click en cualquier vacante
- Click en "POSTULARME"
- Llena el formulario
- ✅ Deberías ver mensaje de éxito

### 2. Ver aplicaciones en el panel admin

- Ve a: `http://localhost:3000/applications`
- Deberías ver la aplicación que acabas de crear
- Click en "Ver Detalles"
- Prueba cambiar el estado

### 3. Verificar en base de datos

```bash
npx prisma studio
```

- Ve a la tabla `Application`
- Verifica que la aplicación se guardó correctamente

---

## ✅ FUNCIONALIDADES INCLUIDAS

### Para Candidatos (/talents):

- ✅ Ver vacantes disponibles
- ✅ Aplicar a vacantes con formulario modal
- ✅ Subir CV (opcional)
- ✅ Escribir carta de presentación (opcional)
- ✅ Validación de aplicaciones duplicadas
- ✅ Mensaje de confirmación

### Para Admin/Empresas (/applications):

- ✅ Ver todas las aplicaciones
- ✅ Filtrar por estado (Pendiente, En Revisión, etc.)
- ✅ Estadísticas en tiempo real
- ✅ Ver detalles completos de candidatos
- ✅ Descargar CV
- ✅ Cambiar estado de aplicación
- ✅ Panel con métricas

### API:

- ✅ GET /api/applications - Listar aplicaciones
- ✅ GET /api/applications?jobId=1 - Filtrar por vacante
- ✅ GET /api/applications?status=pending - Filtrar por estado
- ✅ POST /api/applications - Crear aplicación
- ✅ GET /api/applications/[id] - Ver aplicación específica
- ✅ PATCH /api/applications/[id] - Actualizar estado/notas
- ✅ DELETE /api/applications/[id] - Eliminar aplicación

---

## 🎯 ESTADOS DE APLICACIÓN

- **pending** - Pendiente (recién enviada)
- **reviewing** - En Revisión (reclutador la está revisando)
- **interviewed** - Entrevistado (candidato fue entrevistado)
- **accepted** - Aceptado (candidato contratado)
- **rejected** - Rechazado (no pasó el proceso)

---

## 🔐 SEGURIDAD

- ✅ Validación de campos requeridos
- ✅ Validación de email
- ✅ Prevención de aplicaciones duplicadas
- ✅ Validación de vacantes activas
- ✅ Upload de archivos con validación

---

## 📊 PRÓXIMOS PASOS OPCIONALES

1. Notificaciones por email al aplicar
2. Panel para empresas (ver solo sus vacantes)
3. Sistema de favoritos para candidatos
4. Chat entre reclutador y candidato
5. Calendario de entrevistas

---

## 🐛 SOLUCIÓN DE PROBLEMAS

### Error: "Application already exists"

- El candidato ya aplicó a esa vacante
- Es normal, el sistema previene duplicados

### No aparecen las aplicaciones

- Verifica que hiciste la migración
- Revisa la consola del navegador
- Verifica que el servidor esté corriendo

### Error al subir CV

- Verifica que `/api/upload` funcione
- Revisa el límite de tamaño del archivo
- Verifica Vercel Blob está configurado

---

## 💡 TIPS

- Las aplicaciones se muestran más recientes primero
- Los candidatos pueden aplicar sin cuenta de usuario
- Si tienen cuenta, se vincula automáticamente
- Los CVs se suben a Vercel Blob Storage
- El panel de aplicaciones es accesible para admins

---

## 🎉 ¡LISTO!

Sistema de aplicaciones completamente funcional instalado.

**URLs importantes:**

- Vacantes: `http://localhost:3000/talents`
- Panel Admin: `http://localhost:3000/applications`
- Crear Vacantes: `http://localhost:3000/create-job`
