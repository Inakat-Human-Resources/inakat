# 👥 Guía de Usuario - INAKAT

Guía completa para usar INAKAT según tu rol.

---

## 🎭 Roles en INAKAT

1. **👨‍💼 Candidato** - Busca y aplica a vacantes
2. **🏢 Empresa** - Publica vacantes y gestiona aplicaciones
3. **⚙️ Administrador** - Gestiona la plataforma

---

## 👨‍💼 Guía para Candidatos

### 1. Buscar Vacantes

**Paso 1:** Ve a la página de talentos

```
http://localhost:3000/talents
```

**Paso 2:** Usa los filtros de búsqueda

- **Buscar:** Escribe palabras clave (puesto, empresa, tecnología)
- **Ubicación:** Filtra por ciudad o estado
- **Modalidad:** Selecciona tipo de trabajo (Tiempo Completo, Remoto, etc.)

**Paso 3:** Click en "BUSCAR"

---

### 2. Ver Detalles de Vacante

**Paso 1:** Click en cualquier vacante de la lista

La vacante seleccionada se resaltará y verás:
- ✅ Descripción completa del puesto
- ✅ Requisitos necesarios
- ✅ Salario ofrecido
- ✅ Tipo de trabajo (Remoto, Presencial)
- ✅ Rating de la empresa

---

### 3. Aplicar a una Vacante

**Paso 1:** Con la vacante seleccionada, click en "POSTULARME"

**Paso 2:** Llena el formulario

**Campos requeridos:**
- Nombre Completo *
- Email *

**Campos opcionales:**
- Teléfono
- CV (PDF, DOC, DOCX - máx. 5MB)
- Carta de Presentación

**Paso 3:** Click en "Enviar Aplicación"

✅ Verás un mensaje de confirmación

**⚠️ IMPORTANTE:**
- Solo puedes aplicar UNA VEZ a cada vacante
- Si intentas aplicar de nuevo, verás un error
- Guarda el email que usaste para seguimiento

---

### 4. Seguimiento de Aplicaciones

**Estados posibles:**

| Estado | Significado |
|--------|-------------|
| 🟡 Pendiente | Tu aplicación fue recibida |
| 🔵 En Revisión | El reclutador está revisando tu perfil |
| 🟣 Entrevistado | Fuiste seleccionado para entrevista |
| 🟢 Aceptado | ¡Felicidades! Fuiste contratado |
| 🔴 Rechazado | No fuiste seleccionado esta vez |

**Nota:** El panel de candidatos ya existe: con sesión iniciada, en
`/my-applications` (y `/candidate/*` para las cuentas con rol candidato) puedes
seguir el estado de cada postulación.

---

### 5. Consejos para Candidatos

**✅ DO:**
- Escribe una carta de presentación personalizada
- Menciona por qué te interesa la posición
- Destaca tu experiencia relevante
- Sube un CV actualizado y profesional
- Revisa ortografía antes de enviar

**❌ DON'T:**
- Enviar cartas genéricas tipo "Me interesa el puesto"
- Aplicar sin leer los requisitos
- Usar emails no profesionales (ej: gatito123@email.com)
- Mentir sobre tu experiencia

---

## 🏢 Guía para Empresas

### 1. Registrar tu Empresa

**Paso 1:** Ve a la página de registro

```
http://localhost:3000/companies
```

**Paso 2:** Llena el formulario

**Información del Representante:**
- Nombre
- Apellido Paterno
- Apellido Materno

**Información de la Empresa:**
- Nombre de la Empresa
- Correo Electrónico Empresarial
- Sitio Web (opcional)
- Razón Social
- RFC
- Dirección

**Documentos:**
- Identificación Oficial (PDF, JPG - máx. 5MB)
- Acta Constitutiva (PDF - máx. 5MB)

**Paso 3:** Click en "Enviar Solicitud"

✅ Tu solicitud será revisada por el equipo de INAKAT

**Tiempo de revisión:** 24-48 horas hábiles

---

### 2. Estado de tu Solicitud

Tu solicitud puede tener estos estados:

| Estado | Significado |
|--------|-------------|
| 🟡 Pendiente | En revisión por el equipo |
| 🟢 Aprobada | ¡Cuenta creada! Recibirás credenciales |
| 🔴 Rechazada | Solicitud no aprobada (verás el motivo) |

**Cuando seas aprobado:**
- ✅ Se creará tu cuenta automáticamente
- ✅ Recibirás un email con tus credenciales
- ✅ Podrás iniciar sesión y publicar vacantes

---

### 3. Iniciar Sesión

**Paso 1:** Ve a login

```
http://localhost:3000/login
```

**Paso 2:** Usa tus credenciales

```
Email: [correo de tu empresa]
Password: [contraseña recibida por email]
```

**Paso 3:** Click en "Iniciar Sesión"

---

### 4. Publicar una Vacante

**Paso 1:** Ve a crear vacante

```
http://localhost:3000/create-job
```

**Paso 2:** Llena el formulario

**Información Básica:**
- Título del Puesto *
- Nombre de la Empresa *
- Ubicación *
- Salario *
- Rating de la Empresa (1-5, opcional)

**Tipo de Trabajo:**
- Tiempo Completo / Medio Tiempo / Por Proyecto
- ☑️ Trabajo Remoto (opcional)

**Descripción:**
- Descripción del Puesto * (detallada)
- Requisitos (opcional pero recomendado)

**Paso 3:** Click en "PUBLICAR VACANTE"

✅ Tu vacante se publicará inmediatamente

---

### 5. Ver Aplicaciones a tus Vacantes

**Paso 1:** Ve al panel de aplicaciones

```
http://localhost:3000/applications
```

**Paso 2:** Filtra por estado

- **Todas** - Ver todas las aplicaciones
- **Pendientes** - Nuevas aplicaciones sin revisar
- **En Revisión** - Aplicaciones que estás evaluando
- **Entrevistados** - Candidatos ya entrevistados
- **Aceptados** - Candidatos contratados
- **Rechazados** - Candidatos no seleccionados

**Paso 3:** Click en "Ver Detalles" para ver información completa

---

### 6. Gestionar Candidatos

**Ver Detalles de Candidato:**

En el modal verás:
- ✅ Nombre completo
- ✅ Email de contacto
- ✅ Teléfono (si lo proporcionó)
- ✅ CV (descargable)
- ✅ Carta de presentación
- ✅ Vacante a la que aplicó

**Cambiar Estado:**

Click en el botón del estado deseado:
- 🟡 **Pendiente** - Recién recibida
- 🔵 **En Revisión** - Evaluando perfil
- 🟣 **Entrevistado** - Ya fue entrevistado
- 🟢 **Aceptar** - Contratar candidato
- 🔴 **Rechazar** - No seleccionar

---

### 7. Consejos para Empresas

**Descripción de Vacantes:**
- ✅ Sé específico sobre responsabilidades
- ✅ Lista requisitos claros y realistas
- ✅ Menciona beneficios y cultura
- ✅ Incluye rango salarial honesto
- ✅ Especifica si es remoto, híbrido o presencial

**Gestión de Candidatos:**
- ✅ Responde rápido (24-48 horas ideal)
- ✅ Da feedback constructivo
- ✅ Mantén estados actualizados
- ✅ Sé profesional y respetuoso

---

## ⚙️ Guía para Administradores

### 1. Iniciar Sesión como Admin

**Credenciales:**

Las cuentas de administrador se crean con el seed. El email es el de la variable
`ADMIN_EMAIL` y la contraseña la de `SEED_ADMIN_PASSWORD` (el segundo admin usa
`SEED_ADMIN2_PASSWORD`). Están en el `.env` del entorno; **no se publican en la
documentación**.

En producción, pide el acceso al responsable del sistema: no hay contraseñas
"por defecto".

---

### 2. Panel de Administración

**Ruta:**
```
http://localhost:3000/admin
```

**Funciones disponibles:**

- ✅ Ver todas las solicitudes de empresas
- ✅ Aprobar/rechazar empresas
- ✅ Ver documentos de empresas
- ✅ Dashboard con estadísticas
- ✅ Búsqueda de solicitudes

---

### 3. Revisar Solicitudes de Empresas

**Paso 1:** En el panel admin verás todas las solicitudes

**Filtros disponibles:**
- 🟡 Pendientes
- 🟢 Aprobadas
- 🔴 Rechazadas
- 📊 Todas

**Paso 2:** Click en "Ver Detalles" de una solicitud

Verás:
- Información del representante
- Información de la empresa
- Documentos (Identificación y Acta Constitutiva)

**Paso 3:** Descargar y revisar documentos

Click en "Descargar Identificación" y "Descargar Acta Constitutiva"

**Verificar:**
- ✅ Documentos legibles y completos
- ✅ RFC válido
- ✅ Datos consistentes
- ✅ Empresa legítima

---

### 4. Aprobar una Empresa

**Paso 1:** En el modal de detalles, click en "Aprobar"

**Paso 2:** Confirmar acción

✅ Se creará automáticamente:
- Cuenta de usuario (role: "company")
- Email: correo de la empresa
- Password: temporal aleatorio

**Paso 3:** La empresa recibirá sus credenciales por email

---

### 5. Rechazar una Empresa

**Paso 1:** En el modal de detalles, click en "Rechazar"

**Paso 2:** Escribir razón del rechazo

Ejemplos:
- "Documentos ilegibles o incompletos"
- "RFC inválido o no coincide"
- "Empresa no verificable"

**Paso 3:** Confirmar

❌ La solicitud quedará marcada como rechazada

---

### 6. Gestión de Aplicaciones

**Ruta:**
```
http://localhost:3000/applications
```

Como admin, puedes:
- ✅ Ver TODAS las aplicaciones de TODAS las empresas
- ✅ Cambiar estados de aplicaciones
- ✅ Agregar notas internas
- ✅ Descargar CVs

---

### 7. Gestión de Vacantes

**Ruta:**
```
http://localhost:3000/create-job
```

Como admin, puedes:
- ✅ Crear vacantes para cualquier empresa
- ✅ Editar vacantes existentes
- ✅ Cerrar/eliminar vacantes

---

### 8. Dashboard y Estadísticas

El panel admin muestra:

**Solicitudes de Empresas:**
- Total de solicitudes
- Pendientes
- Aprobadas
- Rechazadas

**Aplicaciones:**
- Total de aplicaciones
- Por estado
- Últimas aplicaciones

**Vacantes:**
- Total de vacantes
- Activas
- Cerradas

---

## 🔧 Configuración de Cuenta

### Cambiar Contraseña

**Paso 1:** Ve a tu perfil (próximamente)

```
http://localhost:3000/profile
```

**Paso 2:** Click en "Cambiar Contraseña"

**Paso 3:** Ingresa:
- Contraseña actual
- Nueva contraseña
- Confirmar nueva contraseña

**Requisitos:**
- Mínimo 8 caracteres
- Al menos 1 mayúscula
- Al menos 1 número

---

## 🎨 Personalización

### Temas (Próximamente)

INAKAT soportará modo claro y oscuro.

### Notificaciones (Próximamente)

Configura qué notificaciones deseas recibir:
- Email cuando alguien aplica
- Email cuando cambia estado
- Notificaciones in-app

---

## 📱 App Móvil (Roadmap)

Planeada para Q2 2025:
- App iOS y Android
- Notificaciones push
- Aplicación rápida
- Chat en tiempo real

---

## ❓ Preguntas Frecuentes

### ¿Puedo aplicar múltiples veces a la misma vacante?

No, solo puedes aplicar una vez por vacante.

### ¿Cuánto tiempo tarda en revisarse mi aplicación?

Depende de la empresa, usualmente 24-72 horas.

### ¿Puedo editar mi aplicación después de enviarla?

No actualmente. Asegúrate de revisar bien antes de enviar.

### ¿Cómo sé si mi solicitud de empresa fue aprobada?

Recibirás un email con tus credenciales de acceso.

### ¿Puedo cerrar una vacante publicada?

Sí, desde el panel de empresa puedes cambiar el estado a "closed".

### ¿Los datos están seguros?

Sí, usamos encriptación y mejores prácticas de seguridad.

---

## 📞 Soporte

¿Necesitas ayuda?

- 📧 Email: soporte@inakat.com
- 💬 Chat: Disponible en la plataforma
- 📞 Teléfono: +52 81 1234 5678
- 🕐 Horario: Lun-Vie 9:00-18:00 CST

---

**Última actualización:** Enero 2025
