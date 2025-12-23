# GUIA DE TESTING - INAKAT

## Credenciales de Prueba

### Usuarios del Seed

| Rol | Email | Password |
|-----|-------|----------|
| Admin | admin@inakat.com | AdminInakat2024! |
| Admin | guillermo.sanchezy@gmail.com | Guillermo2024! |
| Empresa | contact@techsolutions.mx | Company123! |
| Empresa | rh@innovamex.com | Company123! |
| Reclutador | (crear en /admin/users) | - |
| Especialista | (crear en /admin/users) | - |

### Tarjeta de Prueba (Mercado Pago)

| Campo | Valor |
|-------|-------|
| Numero | 5031 7557 3453 0604 |
| Vencimiento | 11/25 |
| CVV | 123 |
| Nombre | APRO |
| DNI | 12345678 |

---

## Tests Automatizados

### Ejecutar Tests

```bash
# Todos los tests
npm test

# Tests especificos
npm test -- recruiter
npm test -- specialist
npm test -- company

# Con cobertura
npm test -- --coverage

# En modo watch
npm test -- --watch
```

### Archivos de Test

| Archivo | Descripcion |
|---------|-------------|
| auth.test.ts | Login, logout, registro |
| applications.test.ts | CRUD de aplicaciones |
| applications-check.test.ts | Verificar duplicados |
| jobs.test.ts | CRUD de vacantes |
| candidates.test.ts | Banco de candidatos |
| assign-candidates.test.ts | Inyeccion de candidatos |
| recruiter-dashboard.test.ts | Dashboard reclutador |
| specialist-dashboard.test.ts | Dashboard especialista |
| company-dashboard-filter.test.ts | Filtros de empresa |
| company-requests.test.ts | Solicitudes de empresa |
| pricing.test.ts | Matriz de precios |
| credit-packages.test.ts | Compra de creditos |
| vendors.test.ts | Sistema de vendedores |
| recruiter-injected-candidates.test.ts | Candidatos inyectados |
| application-status-validation.test.ts | Validacion de status |
| middleware-exceptions.test.ts | Excepciones del middleware |
| jobs-expiration.test.ts | Filtro de vacantes expiradas |

---

## Testing Manual

### Checklist Pre-Deploy

#### Autenticacion
- [ ] Login con credenciales correctas
- [ ] Login con credenciales incorrectas
- [ ] Logout limpia sesion
- [ ] Registro de nuevo usuario
- [ ] Token expira despues de 7 dias

#### Flujo de Candidato
- [ ] Buscar vacantes sin login
- [ ] Aplicar a vacante sin login
- [ ] Aplicar a vacante con login
- [ ] Ver "Ya aplicaste" si aplico antes
- [ ] Ver estado de aplicaciones

#### Flujo de Empresa
- [ ] Registrar empresa
- [ ] Admin aprueba empresa
- [ ] Comprar creditos
- [ ] Aplicar codigo de descuento
- [ ] Crear vacante borrador
- [ ] Publicar vacante (descuenta creditos)
- [ ] Pausar/Reanudar vacante
- [ ] Cerrar vacante
- [ ] Ver candidatos enviados
- [ ] Marcar candidato "Me interesa"
- [ ] Rechazar candidato

#### Flujo Admin -> Reclutador -> Especialista
- [ ] Admin asigna reclutador a vacante
- [ ] Admin asigna especialista a vacante
- [ ] Admin inyecta candidato del banco
- [ ] Reclutador ve candidato inyectado
- [ ] Reclutador envia a especialista
- [ ] Especialista ve candidato
- [ ] Especialista envia a empresa
- [ ] Empresa ve candidato

---

## Casos Edge

### Validaciones
- [ ] RFC duplicado en registro empresa
- [ ] Email duplicado en registro
- [ ] Vacante sin creditos suficientes
- [ ] Enviar a especialista sin asignar -> ERROR
- [ ] Aplicar a vacante cerrada
- [ ] Aplicar a vacante expirada

### Seguridad
- [ ] Acceder a /admin sin ser admin -> 403
- [ ] Acceder a /company sin ser empresa -> 403
- [ ] GET /api/applications sin login -> 401
- [ ] POST /api/applications sin login -> OK (publico)
- [ ] POST /api/upload sin login -> 401

---

## Estructura de Tests

### Test de Validacion de Status

```typescript
describe('Validacion de Status de Application', () => {
  const VALID_STATUSES = [
    'pending',
    'reviewing',
    'evaluating',
    'sent_to_specialist',
    'sent_to_company',
    'company_interested',
    'interviewed',
    'rejected',
    'accepted',
    'injected_by_admin',
    'discarded',
    'archived'
  ];

  it('deberia tener exactamente 12 status validos', () => {
    expect(VALID_STATUSES).toHaveLength(12);
  });
});
```

### Test de Excepciones de Middleware

```typescript
describe('Middleware - Excepciones Publicas', () => {
  const PUBLIC_EXCEPTIONS = [
    { pathname: '/api/company-requests', method: 'POST' },
    { pathname: '/api/applications', method: 'POST' },
    { pathname: '/api/applications/check', method: 'GET' }
  ];

  it('POST /api/applications debe ser publico', () => {
    const isPublic = PUBLIC_EXCEPTIONS.some(
      exc => exc.pathname === '/api/applications' && exc.method === 'POST'
    );
    expect(isPublic).toBe(true);
  });
});
```

### Test de Filtro de Vacantes Expiradas

```typescript
describe('Filtro de Vacantes Expiradas', () => {
  const now = new Date();
  const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);

  const filterActiveJobs = (jobs) => {
    return jobs.filter(
      job => job.status === 'active' &&
             (job.expiresAt === null || new Date(job.expiresAt) > now)
    );
  };

  it('NO deberia mostrar vacantes expiradas', () => {
    const jobs = [{ id: 1, status: 'active', expiresAt: yesterday }];
    const active = filterActiveJobs(jobs);
    expect(active).toHaveLength(0);
  });
});
```

---

## Reportar Bugs

### Formato de Reporte

```
## Titulo
[Descripcion breve del bug]

## Pasos para Reproducir
1. Ir a...
2. Hacer click en...
3. Observar que...

## Comportamiento Esperado
[Que deberia pasar]

## Comportamiento Actual
[Que pasa realmente]

## Evidencia
[Screenshot o video]

## Ambiente
- Browser: Chrome/Firefox/Safari
- OS: Windows/Mac/Linux
- Version: 1.0.0
```

---

## Comandos Utiles

```bash
# Ejecutar todos los tests
npm test

# Ejecutar tests con cobertura
npm test -- --coverage

# Ejecutar tests en modo watch
npm test -- --watch

# Ejecutar tests de un archivo especifico
npm test -- recruiter-injected

# Ejecutar tests que coincidan con un patron
npm test -- --testNamePattern="Reclutador"

# Ver tests fallidos solamente
npm test -- --onlyFailures
```

---

*Ultima actualizacion: Diciembre 2024*
