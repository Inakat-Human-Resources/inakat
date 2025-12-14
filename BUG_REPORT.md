# 🐛 Reporte de Bugs - INAKAT

**Última actualización:** 14 de Diciembre 2024  
**Analizado por:** Claude (Supervisor) + Claude Code  
**Tests actuales:** 258 pasando ✅

---

## 📊 Resumen de Estado

| Fecha       | Bugs Reportados | Resueltos | Pendientes |
| ----------- | --------------- | --------- | ---------- |
| 12 Dic 2024 | 13              | ✅ 13     | 0          |
| 13 Dic 2024 | 15              | 🚧 0      | 15         |

---

# ✅ BUGS RESUELTOS (12-13 Dic 2024)

## Fase 1: Bugs Iniciales de Eduardo

### ✅ Bug 1: Botón Editar Vacante llevaba a Crear

- **Archivo:** `src/components/sections/jobs/CreateJobForm.tsx`
- **Fix:** Implementado `useSearchParams()` para detectar modo edición y cargar datos de vacante existente

### ✅ Bug 2: RFC validación inconsistente

- **Archivos:** Frontend y backend
- **Fix:** Unificado regex de validación en ambos lugares

### ✅ Bug 3: Upload sin validación de tamaño

- **Archivo:** `src/app/api/upload/route.ts`
- **Fix:** Validación de 5MB implementada

### ✅ Bug 4: Postulaciones sin logging

- **Archivo:** `src/app/api/applications/route.ts`
- **Fix:** Console.log agregados para debug

### ✅ Bug 5: RFC duplicado sin mensaje claro

- **Archivo:** `src/app/api/company-requests/route.ts`
- **Fix:** Manejo específico de error P2002 con mensaje amigable

---

## Fase 2-4: Flujo Conectado

### ✅ Bug 6: validStatuses incompleto

- **Archivo:** `src/app/api/applications/[id]/route.ts`
- **Fix:** Agregados: `sent_to_specialist`, `sent_to_company`, `injected_by_admin`, `discarded`, `archived`

### ✅ Bug 7: Reclutador NO actualizaba Application.status

- **Archivo:** `src/app/api/recruiter/dashboard/route.ts`
- **Fix:** Al enviar a especialista, actualiza status a `sent_to_specialist`

### ✅ Bug 8: Especialista NO actualizaba Application.status

- **Archivo:** `src/app/api/specialist/dashboard/route.ts`
- **Fix:** Al enviar a empresa, actualiza status a `sent_to_company`

### ✅ Bug 9: Middleware no protegía recruiter/specialist

- **Archivo:** `src/middleware.ts`
- **Fix:** Agregadas rutas al matcher y verificación de roles

### ✅ Bug 10: Reclutador buscaba status 'active' (incorrecto)

- **Archivo:** `src/app/api/recruiter/dashboard/route.ts`
- **Fix:** Cambiado a buscar status `available` o `in_process`

### ✅ Bug 11: Aprobar empresa NO creaba User

- **Archivo:** `src/app/api/company-requests/[id]/route.ts`
- **Fix:** Ahora crea User automáticamente con password temporal

### ✅ Bug 12: Candidatos del banco sin Application

- **Archivo:** `src/app/api/recruiter/dashboard/route.ts`
- **Fix:** Crea Application automáticamente si no existe

### ✅ Bug 13: Empresa no veía créditos

- **Archivos:** API y dashboard de empresa
- **Fix:** Agregado campo `credits` al response y UI

---

# 🔴 BUGS PENDIENTES (13 Dic 2024 - Reporte de Eduardo)

## 🔴 Prioridad CRÍTICA

### Bug P1: Error al subir archivo en registro de empresa

**Módulo:** Empresa  
**Reportado por:** Eduardo  
**Descripción:** Al registrarse como empresa, sigue dando error al subir archivo de identificación

**Archivos a revisar:**

- `src/app/api/upload/route.ts`
- `src/app/api/company-requests/route.ts`
- `src/components/sections/companies/FormRegisterForQuotationSection.tsx`

**Posibles causas:**

- Token de Vercel Blob no configurado
- Validación de tipo MIME muy estricta
- Error en manejo de FormData

**Propuesta de fix:**

```typescript
// Agregar mejor logging y manejo de errores
try {
  const blob = await put(filename, file, { access: 'public' });
  console.log('Upload exitoso:', blob.url);
} catch (error) {
  console.error('Error detallado upload:', error);
  // Retornar mensaje específico
}
```

---

### Bug P2: Calculadora de créditos incorrecta

**Módulo:** Empresa  
**Reportado por:** Eduardo  
**Descripción:** La calculadora mostró 5 créditos pero se descontaron 6

**Archivos a revisar:**

- `src/components/sections/jobs/CreateJobForm.tsx` (cálculo frontend)
- `src/app/api/jobs/route.ts` (descuento backend)
- `src/app/api/pricing/route.ts` (consulta de precios)

**Causa probable:**

- Frontend y backend usan lógicas diferentes para calcular
- Fallback diferente cuando no encuentra precio exacto

**Propuesta de fix:**

- Unificar la función de cálculo en un solo lugar (`src/lib/pricing.ts`)
- Importarla tanto en frontend como backend
- Asegurar que ambos usen el mismo fallback

---

### Bug P3: Reclutador/Especialista solo pueden enviar una vez

**Módulo:** Reclutador, Especialista  
**Reportado por:** Eduardo  
**Descripción:** Después de enviar candidatos, los que no seleccioné ya no puedo enviarlos

**Archivos a revisar:**

- `src/app/api/recruiter/dashboard/route.ts`
- `src/app/api/specialist/dashboard/route.ts`

**Causa probable:**

- El query filtra candidatos por status y excluye los que ya están "en proceso"
- Después de enviar algunos, el status de los demás cambia

**Propuesta de fix:**

```typescript
// En lugar de filtrar por status específico, filtrar por "no enviado"
where: {
  status: {
    notIn: ['sent_to_specialist', 'sent_to_company', 'discarded'];
  }
}
```

---

## 🟠 Prioridad ALTA

### Bug P4: Admin - Definir precios de paquetes de créditos

**Módulo:** Admin  
**Tipo:** Feature nuevo  
**Descripción:** Admin debe poder configurar precios de paquetes:

- 1 crédito = $4,000 MXN
- 10 créditos = $35,000 MXN ("MÁS POPULAR")
- 15 créditos = $50,000 MXN
- 20 créditos = $65,000 MXN ("PROMOCIÓN")

**Archivos a crear:**

- `prisma/schema.prisma` - Modelo CreditPackage
- `src/app/api/admin/credit-packages/route.ts`
- `src/app/admin/credit-packages/page.tsx`

---

### Bug P5: Reclutador no ve info completa del candidato

**Módulo:** Reclutador  
**Descripción:** Solo ve nombre y email, necesita ver CV, universidad, experiencia

**Archivos a modificar:**

- `src/app/api/recruiter/dashboard/route.ts` - Incluir más campos
- `src/app/recruiter/dashboard/page.tsx` - Mostrar modal con detalles

---

### Bug P6: Especialista no ve info completa del candidato

**Módulo:** Especialista  
**Descripción:** Igual que reclutador, más las notas del reclutador

**Archivos a modificar:**

- `src/app/api/specialist/dashboard/route.ts`
- `src/app/specialist/dashboard/page.tsx`

---

## 🟡 Prioridad MEDIA

### Bug P7: Empresa - No pedir nombre al crear vacante

**Módulo:** Empresa  
**Descripción:** La empresa tiene que escribir su nombre otra vez al crear vacante

**Archivo:** `src/components/sections/jobs/CreateJobForm.tsx`
**Fix:** Pre-llenar campo `company` desde el usuario logueado

---

### Bug P8: Empresa - Redirigir después de crear vacante

**Módulo:** Empresa  
**Descripción:** Después de crear vacante, no redirige a ningún lado

**Archivo:** `src/components/sections/jobs/CreateJobForm.tsx`
**Fix:** `router.push('/company/dashboard')` después de éxito

---

### Bug P9: Admin - Ordenar tabla de vacantes

**Módulo:** Admin  
**Descripción:** Poder ordenar por Vacante, Empresa, Ubicación, Fecha

**Archivo:** `src/app/admin/page.tsx`
**Fix:** Headers clickeables con estado de ordenamiento

---

### Bug P10: Admin - Opciones en dos columnas

**Módulo:** Admin  
**Descripción:** Con zoom, no se ven todas las opciones

**Archivo:** `src/app/admin/page.tsx`
**Fix:** Grid de 2 columnas responsive

---

### Bug P11: Candidato - Perfil completo editable

**Módulo:** Candidato  
**Descripción:** Poder editar: Nombre, Apellidos, Edad, Celular, Correo, Password, Ubicación

**Archivos:**

- `src/app/profile/page.tsx`
- `src/app/api/profile/route.ts`

---

### Bug P12: Candidato - Experiencia laboral en perfil

**Módulo:** Candidato  
**Descripción:** Poder agregar/editar experiencia laboral

**Archivos a crear:**

- `src/app/api/profile/experience/route.ts`
- Componente de CRUD de experiencias

---

### Bug P13: Candidato - Anexar documentos

**Módulo:** Candidato  
**Descripción:** Poder subir CV, Cartas de Recomendación, Otros

**Archivos:**

- `src/app/profile/page.tsx`
- `src/app/api/profile/documents/route.ts`

---

### Bug P14: Candidato - Usar datos del perfil al postularse

**Módulo:** Candidato  
**Descripción:** Al postularse, incluir automáticamente la info del perfil

**Archivo:** `src/app/api/applications/route.ts`
**Fix:** Si el usuario tiene Candidate, usar esos datos

---

### Bug P15: Status "Enviado a especialista" irreversible

**Módulo:** Reclutador  
**Descripción:** Una vez enviado, no se puede cambiar a otro status

**Nota de Eduardo:** "Ya se envió, ya se chingó" - Esto es comportamiento esperado según Lalo

---

## 📋 Próximos Pasos

1. **Resolver bugs P1-P3** (críticos) - Bloquean funcionalidad core
2. **Implementar P4** (paquetes de créditos) - Feature solicitado
3. **Resolver P5-P6** (info de candidato) - Mejora importante
4. **Resolver P7-P14** (mejoras UX) - Pueden esperar

---

## 📝 Notas de Referencia

Eduardo compartió capturas de OCC (www.occ.com.mx) como referencia de UX:

- Dashboard de empresa con vacantes
- Vista de candidatos con tabs: "Por revisar", "Me interesan", "Descartados"
- Acciones por candidato: "Me interesa", "Descartar"
- Lista de vacantes: Activas, En pausa, Expiradas, Borradores

---

_Generado el 14 de Diciembre 2024_
