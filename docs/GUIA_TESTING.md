# GUIA DE TESTING - INAKAT

## Cuentas de Prueba

### Usuarios del Seed

Las contraseñas **no se publican aquí**: cada entorno define las suyas en `.env`
con las variables `SEED_*_PASSWORD` (ver `.env.example`). El seed aborta si falta
alguna.

| Rol | Email | Contraseña |
|-----|-------|------------|
| Admin | el de `ADMIN_EMAIL` | `SEED_ADMIN_PASSWORD` |
| Admin (opcional) | el de `ADMIN2_EMAIL`, si se define | `SEED_ADMIN2_PASSWORD` |
| Empresa | contact@techsolutions.mx | `SEED_COMPANY_PASSWORD` |
| Empresa | rh@creativedigital.mx | `SEED_COMPANY_PASSWORD` |
| Reclutador | reclutador1@inakat.com | `SEED_RECRUITER_PASSWORD` |
| Especialista | especialista.tech@inakat.com | `SEED_SPECIALIST_PASSWORD` |
| Candidato | candidato.test@example.com | `SEED_CANDIDATE_PASSWORD` |

Para la suite end-to-end, las mismas cuentas se configuran en `.env.e2e`
(`E2E_*_PASSWORD`); ver `.env.e2e.example`.

### Suite end-to-end (Playwright)

1. Base **local** sembrada: `npx prisma db push && npx prisma db seed`.
2. `cp .env.e2e.example .env.e2e` y en cada `E2E_<ROL>_PASSWORD` la misma
   contraseña que su `SEED_<ROL>_PASSWORD` (admin, company, recruiter,
   specialist, candidate). Si definiste `ADMIN_EMAIL`, ponlo también en
   `E2E_ADMIN_EMAIL`.
3. `npm run test:e2e`. `playwright.config.ts` carga `.env.e2e` y levanta el
   servidor local. Si `E2E_BASE_URL` apunta a staging, no levanta ninguno y
   hay que dar también los `E2E_<ROL>_EMAIL` de staging.

Si falta una `E2E_*_PASSWORD`, el test que la necesita falla diciendo cuál.
Detalle en `__tests__/e2e/helpers/seed.ts`.

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
- [ ] POST /api/upload sin login -> **OK (publico a proposito)**: lo usa el
      registro de empresa/candidato antes de que exista la sesion. El unico
      freno es el rate-limit por IP. Si algun dia se cierra, hay que cambiar
      tambien `src/middleware.ts` y `__tests__/api/middleware-exceptions.test.ts`.
- [ ] GET /api/upload sin login -> 401 (solo el POST es excepcion)
- [ ] GET /api/applications/check sin login -> 401 (ya no es publico)

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

Un test que compara un array local consigo mismo no prueba nada: hay que
ejecutar el middleware real con un `NextRequest` real.

```typescript
/**
 * @jest-environment node
 */
import { NextRequest } from 'next/server';
import { middleware } from '@/middleware';

it('POST /api/applications debe ser publico', async () => {
  const res = await middleware(
    new NextRequest('http://localhost:3000/api/applications', { method: 'POST' })
  );
  // NextResponse.next() -> 200 + cabecera interna
  expect(res.headers.get('x-middleware-next')).toBe('1');
});

it('GET /api/applications sin cookie debe dar 401', async () => {
  const res = await middleware(
    new NextRequest('http://localhost:3000/api/applications')
  );
  expect(res.status).toBe(401);
});
```

Las tres excepciones publicas reales son `POST /api/company-requests`,
`POST /api/applications` y `POST /api/upload`; ver
`__tests__/api/middleware-exceptions.test.ts`.

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
