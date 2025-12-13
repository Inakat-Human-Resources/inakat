# Reporte de Bugs - INAKAT

Fecha: 2025-12-13
Analizado por: Claude Code

---

## Bug 1: Registro de Empresa falla

### Problema reportado
Usuario reporta: "debe autenticarse" y "Error en el documento de identificación"

### Archivos afectados
- `src/components/sections/companies/FormRegisterForQuotationSection.tsx` (líneas 148-262)
- `src/app/api/company-requests/route.ts`
- `src/app/api/upload/route.ts`

### Causa raíz identificada

**NO es un bug de autenticación.** El endpoint `/api/company-requests` NO requiere autenticación (es público).

El problema real está en el **flujo de subida de archivos**:

1. **El formulario requiere archivos pero el API los marca como opcionales:**
   - En `FormRegisterForQuotationSection.tsx` líneas 154-161, valida que `identificacion` y `documentosConstitucion` sean requeridos
   - Sin embargo, en `company-requests/route.ts` líneas 79-80, los campos `identificacionUrl` y `documentosConstitucionUrl` son opcionales

2. **El error "Error en el documento de identificación" ocurre cuando:**
   - El upload a `/api/upload` falla (línea 185-190)
   - Posibles causas:
     - Token de Vercel Blob no configurado en producción
     - Archivo excede 5MB
     - Tipo MIME no permitido (solo PDF, JPG, PNG)

3. **El mensaje "debe autenticarse" podría ocurrir si:**
   - La API de upload en Vercel Blob requiere autenticación que no está configurada
   - El error genérico del catch muestra un mensaje confuso

### Propuesta de fix

1. **Agregar mejor manejo de errores en upload:**
```typescript
// En FormRegisterForQuotationSection.tsx, después de línea 190
if (!idUploadRes.ok) {
  const errorData = await idUploadRes.json();
  throw new Error(errorData.error || 'Error al subir identificación');
}
```

2. **Verificar variable de entorno `BLOB_READ_WRITE_TOKEN`** esté configurada en producción

3. **Agregar validación de tamaño en frontend** antes de subir:
```typescript
if (formData.identificacion && formData.identificacion.size > 5 * 1024 * 1024) {
  setErrors({ identificacion: 'El archivo excede 5MB' });
  return;
}
```

---

## Bug 2: Postulación de Candidato no se registra

### Problema reportado
Usuario aplica pero no se guarda la aplicación

### Archivos afectados
- `src/components/sections/talents/ApplyJobModal.tsx`
- `src/components/sections/talents/SearchPositionsSection.tsx`
- `src/app/api/applications/route.ts`

### Causa raíz identificada

**El código del frontend y backend está correcto.** Después de revisar:

1. `ApplyJobModal.tsx` - El flujo de submit es correcto (líneas 34-98)
2. `SearchPositionsSection.tsx` - Pasa el `jobId` correctamente (línea 181)
3. `applications/route.ts` - Crea la aplicación correctamente

**Posibles causas del problema reportado:**

1. **Error silencioso en el upload de CV:**
   - Si el usuario sube un CV y el upload falla, el error podría no mostrarse correctamente
   - El try-catch en líneas 47-58 podría fallar silenciosamente

2. **El usuario ya había aplicado antes:**
   - El API valida duplicados (líneas 112-127) y retorna error si ya existe una aplicación con el mismo email para la misma vacante
   - El mensaje "Ya has aplicado a esta vacante anteriormente" podría no mostrarse claramente

3. **Vacante no está activa:**
   - Si la vacante cambió a `closed` mientras el usuario llenaba el formulario

4. **Problema con `parseInt(jobId)`:**
   - En `route.ts` línea 93 y 114, se usa `parseInt(jobId)` pero el modal envía `jobId` como número directamente
   - Esto NO debería causar problema, pero vale la pena verificar

### Propuesta de fix

1. **Agregar logging en producción** para debug:
```typescript
// En ApplyJobModal.tsx, después de línea 74
console.log('Application response:', data);
```

2. **Mejorar manejo de errores del API:**
```typescript
// En ApplyJobModal.tsx, línea 88
if (data.success) {
  // ...
} else {
  console.error('Application failed:', data);
  setError(data.error || 'Error al enviar aplicación');
}
```

3. **Verificar en la base de datos** si las aplicaciones SÍ se están guardando (el usuario podría no ver la confirmación)

---

## Bug 3: Botón Editar Vacante lleva a Crear

### Problema reportado
Al hacer clic en "Editar" en una vacante, lleva a la página de crear vacante nueva en lugar de editar la existente.

### Archivos afectados
- `src/components/company/CompanyJobsTable.tsx` (línea 173)
- `src/app/company/dashboard/page.tsx` (líneas 101-103)
- `src/app/create-job/page.tsx`
- `src/components/sections/jobs/CreateJobForm.tsx`

### Causa raíz identificada

**El bug está confirmado.** El problema es:

1. **En `CompanyJobsTable.tsx`:**
   - El botón de editar llama a `onEdit(job.id)` correctamente (línea 173)

2. **En `dashboard/page.tsx`:**
   - `handleEditJob` navega a `/create-job?edit=${jobId}` (líneas 101-103)
   - Esto es correcto, pasa el ID en query params

3. **El problema está en `CreateJobForm.tsx`:**
   - **NO lee el parámetro `edit` de la URL**
   - El componente siempre muestra un formulario vacío
   - No hay lógica para cargar datos de una vacante existente
   - No usa `useSearchParams()` para obtener el ID

### Propuesta de fix

1. **En `CreateJobForm.tsx`, agregar:**
```typescript
'use client';
import { useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';

const CreateJobForm = () => {
  const searchParams = useSearchParams();
  const editJobId = searchParams.get('edit');
  const [isEditing, setIsEditing] = useState(false);

  // Cargar datos de la vacante si estamos editando
  useEffect(() => {
    if (editJobId) {
      setIsEditing(true);
      fetchJobData(editJobId);
    }
  }, [editJobId]);

  const fetchJobData = async (jobId: string) => {
    try {
      const response = await fetch(`/api/jobs/${jobId}`);
      const data = await response.json();
      if (data.success) {
        setFormData({
          title: data.data.title,
          company: data.data.company,
          location: data.data.location,
          // ... resto de campos
        });
      }
    } catch (error) {
      console.error('Error loading job:', error);
    }
  };
```

2. **Modificar el submit para usar PUT en modo edición:**
```typescript
const handleSubmit = async (e, publishNow) => {
  // ...
  const method = isEditing ? 'PUT' : 'POST';
  const url = isEditing ? `/api/jobs/${editJobId}` : '/api/jobs';

  const response = await fetch(url, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(/* ... */)
  });
```

3. **Actualizar el título del formulario:**
```tsx
<h2 className="text-3xl font-bold">
  {isEditing ? 'Editar Vacante' : 'Publicar Nueva Vacante'}
</h2>
```

---

## Resumen de Prioridades

| Bug | Severidad | Esfuerzo | Recomendación |
|-----|-----------|----------|---------------|
| Bug 1 | Alta | Medio | Verificar config de Vercel Blob y mejorar mensajes de error |
| Bug 2 | Media | Bajo | Agregar logging y verificar en DB |
| Bug 3 | Alta | Alto | Implementar modo edición en CreateJobForm |

---

## Bugs adicionales encontrados

### Bug 4: RFC duplicado no manejado correctamente
- **Archivo:** `src/app/api/company-requests/route.ts`
- **Problema:** Si se envía un RFC duplicado, el error P2002 de Prisma no se maneja específicamente
- **Fix:** Agregar catch específico para error de constraint único

### Bug 5: Validación de RFC inconsistente
- **Archivos:**
  - `src/components/sections/companies/FormRegisterForQuotationSection.tsx` (línea 69)
  - `src/lib/validations.ts` (línea 27)
- **Problema:** El regex de validación de RFC es diferente en frontend vs backend
- **Frontend:** `/^[A-ZÑ&]{3,4}[0-9]{6}[A-Z0-9]{3}$/`
- **Backend:** `/^[A-ZÑ&]{3,4}\d{6}[A-V1-9][A-Z1-9][0-9A]$/`
- **Fix:** Unificar la validación en ambos lugares
