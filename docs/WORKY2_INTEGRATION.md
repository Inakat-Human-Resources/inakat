# Integración INAKAT ↔ Worky2

Puente que permite a Worky2 (sistema de RH multi-tenant) importar los
candidatos que una empresa aceptó/contrató en INAKAT, y recibir el evento en
tiempo real cuando eso ocurre.

> **Nota para el merge:** los modelos `IntegrationApiKey` e
> `IntegrationWebhook` ya están en `prisma/schema.prisma`, pero las tablas no
> existen aún en la base. **El dueño del repo corre `npx prisma db push` (o la
> migración equivalente) al mergear este branch.** Hasta entonces, las rutas
> `/api/integration/*` fallarán con error de tabla inexistente.

## Piezas

| Pieza | Archivo |
| --- | --- |
| Modelos Prisma | `prisma/schema.prisma` (`IntegrationApiKey`, `IntegrationWebhook`) |
| Auth de integración | `src/lib/integration-auth.ts` |
| Mapper del contrato | `src/lib/integration-candidate.ts` |
| Webhook saliente | `src/lib/worky2-webhook.ts` |
| Rutas | `src/app/api/integration/{keys,candidates,webhooks}/route.ts` |
| Disparo del evento | `src/app/api/company/applications/[id]/route.ts` y `src/app/api/applications/[id]/route.ts` (transición a `accepted`) |

Las rutas `/api/integration/*` **no** pasan por `src/middleware.ts` (su matcher
no las cubre, a propósito): cada ruta se autentica sola con los helpers de
`integration-auth.ts`.

## Contrato compartido: `CandidatoInakat`

```ts
{
  inakatCandidateId: number,        // = Application.id de INAKAT
  nombre: string,
  apellidoPaterno: string,
  apellidoMaterno?: string | null,
  email: string,
  telefono?: string | null,
  cvUrl?: string | null,
  evaluacionPsicologica?: string | null,  // notas públicas de recruiter
  evaluacionTecnica?: string | null,      // notas públicas de specialist + SkillRatings
  notasAdicionales?: string | null,       // Application.notes
  puesto?: string | null,                 // Job.title
  universidad?: string | null,            // del perfil Candidate (match por email)
  carrera?: string | null,
  experienciaAnios?: number | null,
  salarioMensualPropuesto?: number | null, // Job.salaryMax ?? Job.salaryMin
  fechaAceptacion?: string | null          // ISO 8601 (reviewedAt ?? updatedAt)
}
```

Se consideran "aceptados/contratados" las Applications con status `accepted`
(estado final de la máquina de estados) y, defensivamente, el legado `hired`.

## 1. Crear una API key (empresa, sesión INAKAT)

Autenticación: JWT de un usuario con `role="company"`, en la cookie
`auth-token` (sesión web normal) o en `Authorization: Bearer <jwt>`.

```bash
# Crear (la key en claro SOLO se muestra en esta respuesta)
curl -X POST https://<inakat>/api/integration/keys \
  -H "Authorization: Bearer <jwt>" \
  -H "Content-Type: application/json" \
  -d '{"name": "Worky2 producción"}'
# → { success: true, data: { id, name, key: "inak_<32 hex>", ... } }

# Listar (enmascaradas: en DB solo vive el SHA-256 de la key)
curl https://<inakat>/api/integration/keys -H "Authorization: Bearer <jwt>"

# Revocar
curl -X DELETE "https://<inakat>/api/integration/keys?id=123" \
  -H "Authorization: Bearer <jwt>"
```

La key generada (`inak_` + 32 hex) se pega en la pantalla de Integraciones de
Worky2. INAKAT guarda únicamente su hash SHA-256 (`keyHash`).

## 2. Consultar candidatos aceptados (Worky2 → INAKAT)

```bash
curl "https://<inakat>/api/integration/candidates?status=accepted" \
  -H "X-Api-Key: inak_<32 hex>"
# → { success: true, data: CandidatoInakat[] }
```

- El único `status` soportado en v1 es `accepted` (default si se omite).
- La key identifica a la empresa: solo devuelve Applications de **sus** Jobs.
- Cada uso actualiza `lastUsedAt` de la key.
- Rate limit: 60 requests/min por IP.

## 3. Registrar el webhook (empresa, con datos que da Worky2)

Worky2 muestra en su pantalla de Integraciones la URL receptora y el secreto
compartido; la empresa los registra en INAKAT:

```bash
curl -X POST https://<inakat>/api/integration/webhooks \
  -H "Authorization: Bearer <jwt>" \
  -H "Content-Type: application/json" \
  -d '{"url": "https://<worky2>/api/webhooks/inakat", "secret": "<secreto de Worky2>"}'

# Listar (secreto enmascarado) / desactivar
curl https://<inakat>/api/integration/webhooks -H "Authorization: Bearer <jwt>"
curl -X DELETE "https://<inakat>/api/integration/webhooks?id=45" -H "Authorization: Bearer <jwt>"
```

## 4. Evento saliente `candidate.accepted`

Cuando una Application pasa a `accepted` (desde el panel de empresa o desde el
panel admin), INAKAT hace POST a cada webhook activo de la empresa
(fire-and-forget, timeout 5 s, sin reintentos en v1):

```
POST <webhook.url>
Content-Type: application/json
X-Inakat-Timestamp: <epoch en segundos>
X-Inakat-Signature: v1=<hex>

{ "event": "candidate.accepted", "candidate": CandidatoInakat }
```

Verificación de la firma (lado Worky2):

```
esperado = "v1=" + hex( HMAC_SHA256( secret, `${X-Inakat-Timestamp}.${bodyCrudo}` ) )
```

Comparar con `X-Inakat-Signature` en tiempo constante y rechazar timestamps
viejos (p. ej. > 5 min) para evitar replay.

Si el webhook falla, Worky2 sigue pudiendo importar por polling con el
endpoint de candidatos (sección 2): el webhook es un acelerador, no la fuente
de verdad.
