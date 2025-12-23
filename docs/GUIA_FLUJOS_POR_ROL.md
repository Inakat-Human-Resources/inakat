# GUIA DE FLUJOS POR ROL

## Documento para el Equipo de QA y Producto

---

## ADMIN

### Acceso
- URL: `/admin`
- Credenciales: Ver seed.ts o .env

### Funciones Principales

#### 1. Gestionar Solicitudes de Empresas
- Ruta: `/admin/requests`
- Acciones: Ver, Editar, Aprobar, Rechazar
- Al aprobar: Se crea User con role='company'

#### 2. Gestionar Usuarios
- Ruta: `/admin/users`
- Acciones: Ver, Crear, Editar, Cambiar rol, Desactivar
- Roles asignables: admin, company, recruiter, specialist, candidate, user

#### 3. Banco de Candidatos
- Ruta: `/admin/candidates`
- Acciones: Crear, Editar, Agregar experiencias
- Fuentes: manual, linkedin, occ, referido

#### 4. Inyectar Candidatos a Vacantes
- Ruta: `/admin/assign-candidates`
- Flujo:
  1. Seleccionar vacante
  2. Filtrar candidatos del banco
  3. Seleccionar candidatos
  4. Inyectar -> Se crea Application con status 'injected_by_admin'

#### 5. Asignar Reclutador/Especialista
- Ruta: `/admin/assignments`
- Flujo:
  1. Ver vacantes publicadas
  2. Seleccionar reclutador (psicologo)
  3. Seleccionar especialista (tecnico)
  4. Guardar asignacion

#### 6. Gestionar Aplicaciones Directas
- Ruta: `/admin/direct-applications`
- Ver aplicaciones con status 'pending'
- Mover a 'reviewing' o 'discarded'

#### 7. Configurar Precios
- Ruta: `/admin/pricing`
- Editar matriz de creditos por perfil/seniority/workMode

#### 8. Gestionar Vendedores
- Ruta: `/admin/vendors`
- Ver codigos de descuento
- Ver comisiones pendientes
- Marcar comisiones como pagadas

---

## EMPRESA

### Acceso
- URL: `/company/dashboard`
- Credenciales: Se crean al aprobar solicitud

### Funciones Principales

#### 1. Ver Dashboard
- Estadisticas de vacantes
- Estadisticas de candidatos
- Creditos disponibles

#### 2. Gestionar Vacantes
- Tabs: Activas, Pausadas, Expiradas, Borradores, Cerradas
- Acciones por vacante:
  - Ver detalles
  - Pausar/Reanudar
  - Cerrar
  - Editar (si es borrador)

#### 3. Crear Vacante
- Flujo:
  1. Llenar formulario
  2. Ver costo en creditos
  3. Guardar como borrador o publicar
  4. Si publica: Se descuentan creditos

#### 4. Revisar Candidatos
- Tabs: Por revisar, Me interesan, Descartados
- Acciones por candidato:
  - Ver perfil completo
  - Ver notas de reclutador
  - Ver notas de especialista
  - Marcar "Me interesa" -> status: company_interested
  - Descartar -> status: rejected
  - Marcar entrevistado -> status: interviewed
  - Aceptar -> status: accepted

#### 5. Comprar Creditos
- Seleccionar paquete
- Aplicar codigo de descuento (opcional)
- Pagar con tarjeta via Mercado Pago

---

## RECLUTADOR (Psicologo)

### Acceso
- URL: `/recruiter/dashboard`
- Rol requerido: recruiter

### Funciones Principales

#### 1. Ver Vacantes Asignadas
- Solo ve vacantes donde es el reclutador asignado
- Estados: Pendientes, En revision, Enviadas a especialista

#### 2. Revisar Candidatos
- Ve candidatos con status: pending, reviewing, injected_by_admin
- Por cada candidato puede:
  - Ver CV y carta
  - Ver perfil del banco (si existe)
  - Agregar notas de evaluacion psicologica
  - Marcar como "En revision"
  - Descartar
  - Enviar a especialista

#### 3. Enviar a Especialista
- Requisito: Debe haber especialista asignado a la vacante
- Accion: Seleccionar candidatos -> Enviar
- Resultado: status cambia a 'sent_to_specialist'
- Error si no hay especialista: "No hay especialista asignado a esta vacante"

#### 4. Ver Banco de Candidatos Disponibles
- Puede ver candidatos disponibles del banco
- Para inyectarlos, debe solicitar al admin

---

## ESPECIALISTA (Tecnico)

### Acceso
- URL: `/specialist/dashboard`
- Rol requerido: specialist

### Funciones Principales

#### 1. Ver Vacantes Asignadas
- Solo ve vacantes donde es el especialista asignado
- Solo ve candidatos que el reclutador envio

#### 2. Evaluar Candidatos
- Ve candidatos con status: sent_to_specialist, evaluating
- Por cada candidato puede:
  - Ver CV y perfil
  - Ver notas del reclutador
  - Agregar notas tecnicas
  - Marcar como "Evaluando"
  - Descartar
  - Enviar a empresa

#### 3. Enviar a Empresa
- Seleccionar candidatos evaluados
- Confirmar envio
- Resultado: status cambia a 'sent_to_company'

---

## CANDIDATO

### Acceso
- URL: `/candidate/applications` (si tiene role='candidate')
- URL: `/my-applications` (si tiene role='user')

### Funciones Principales

#### 1. Buscar Vacantes
- Ruta: `/talents`
- Filtrar por: ubicacion, tipo, modalidad, perfil
- Ver detalles de vacante

#### 2. Aplicar a Vacante
- Llenar formulario (o usar datos del perfil)
- Subir CV
- Agregar carta de presentacion
- Enviar aplicacion
- NO requiere estar logueado

#### 3. Ver Mis Aplicaciones
- Lista de todas las aplicaciones
- Ver estado de cada una
- Estados visibles para candidato:
  - "En revision" (pending, injected_by_admin)
  - "En proceso" (reviewing, sent_to_specialist)
  - "Enviado a empresa" (sent_to_company)
  - "Entrevistado" (interviewed)
  - "Aceptado" (accepted)
  - "No seleccionado" (rejected)

#### 4. Editar Perfil
- Datos personales
- Experiencias laborales
- Documentos (CV, portafolio, LinkedIn)

---

## VENDEDOR

### Acceso
- URL: `/vendor/dashboard`
- Cualquier usuario autenticado puede ser vendedor

### Funciones Principales

#### 1. Crear Codigo de Descuento
- Generar codigo unico
- Descuento: 10% para el comprador
- Comision: 10% para el vendedor

#### 2. Ver Mis Ventas
- Lista de empresas que usaron el codigo
- Monto de cada venta
- Comision por venta
- Estado de pago de comision

#### 3. Activar/Desactivar Codigo
- Pausar codigo temporalmente
- Reactivar cuando desee

---

## CHECKLIST DE PRUEBAS

### Flujo Completo

- [ ] Empresa se registra
- [ ] Admin aprueba empresa
- [ ] Empresa compra creditos
- [ ] Empresa publica vacante
- [ ] Admin asigna reclutador y especialista
- [ ] Candidato aplica a vacante (SIN LOGIN)
- [ ] Admin ve aplicacion directa
- [ ] Reclutador ve candidato
- [ ] Reclutador envía a especialista
- [ ] Especialista ve candidato
- [ ] Especialista envia a empresa
- [ ] Empresa ve candidato
- [ ] Empresa marca "Me interesa"
- [ ] Empresa entrevista
- [ ] Empresa acepta

### Flujo con Inyeccion

- [ ] Admin crea candidato en banco
- [ ] Admin inyecta candidato a vacante
- [ ] Reclutador ve candidato inyectado (status: injected_by_admin)
- [ ] (continua igual que flujo normal)

### Validaciones de Seguridad

- [ ] POST /api/applications funciona sin login
- [ ] GET /api/applications/check funciona sin login
- [ ] GET /api/applications requiere admin
- [ ] POST /api/company-requests funciona sin login
- [ ] GET /api/company-requests requiere admin
- [ ] POST /api/upload requiere login

### Validaciones de Negocio

- [ ] No se puede enviar a especialista sin asignar
- [ ] Vacantes expiradas no aparecen en busqueda
- [ ] Status 'evaluating' es valido
- [ ] Candidatos inyectados visibles para reclutador

---

## MATRIZ DE TRANSICIONES DE STATUS

### Application Status

| Status Actual | Roles que pueden cambiar | Status Permitidos |
|---------------|--------------------------|-------------------|
| pending | recruiter, admin | reviewing, discarded |
| injected_by_admin | recruiter, admin | reviewing, sent_to_specialist, discarded |
| reviewing | recruiter, admin | sent_to_specialist, discarded |
| sent_to_specialist | specialist, admin | evaluating, sent_to_company, discarded |
| evaluating | specialist, admin | sent_to_company, discarded |
| sent_to_company | company, admin | company_interested, rejected |
| company_interested | company, admin | interviewed, accepted, rejected |
| interviewed | company, admin | accepted, rejected |
| accepted | - (final) | - |
| rejected | - (final) | - |

### Job Status

| Status Actual | Roles que pueden cambiar | Status Permitidos |
|---------------|--------------------------|-------------------|
| draft | company, admin | active, (delete) |
| active | company, admin | paused, closed |
| paused | company, admin | active, closed |
| closed | admin | (reopen as active) |

---

*Documento para uso interno del equipo*
*Ultima actualizacion: Diciembre 2024*
