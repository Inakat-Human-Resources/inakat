# Integración INAKAT ↔ Worky2

Puente que permite a Worky2 (sistema de RH multi-tenant) importar los
candidatos que una empresa aceptó/contrató en INAKAT, y recibir el evento en
tiempo real cuando eso ocurre.

> **Tablas en la base (actualizado 2026-09-22, INFRA-013/INFRA-029):** los
> modelos `IntegrationApiKey` e `IntegrationWebhook` tienen su migración
> versionada, `prisma/migrations/20260713000000_add_worky2_integration_tables`.
> El build de Vercel **no** aplica migraciones, así que antes de habilitar la
> integración en un entorno hay que comprobar que las tablas existen:
>
> ```sql
> SELECT to_regclass('"IntegrationApiKey"'), to_regclass('"IntegrationWebhook"');
> ```
>
> Si alguna sale `NULL`, las rutas `/api/integration/*` responden 500 (P2021,
> tabla inexistente) y `dispatchCandidateAccepted` falla en silencio. Cómo
> crearlas depende del estado del historial de migraciones de ese entorno (ver
> la sección de migraciones de `docs/DATABASE_SCHEMA.md`): mientras la base se
> sincronice con `db push`, es `npx prisma db push`; si ya se sincroniza con
> `migrate deploy`, la migración anterior se aplica sola. **No** mezcles los dos
> caminos en la misma base sin marcar antes la migración como aplicada
> (`npx prisma migrate resolve --applied 20260713000000_add_worky2_integration_tables`).

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
  notasAdicionales?: string | null,       // SIEMPRE null: ver nota de privacidad
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

> **Privacidad — `notasAdicionales`.** El campo existe en el contrato pero
> INAKAT emite siempre `null`. `Application.notes` son las notas INTERNAS de
> INAKAT sobre el candidato («pide 20% más que la banda», «referencia negativa»),
> y por eso el panel de la empresa tampoco las muestra (#50/#51). Si en algún
> momento hay que mandar notas, serán las `EvaluationNote` marcadas como
> públicas, que ya viajan en `evaluacionPsicologica` / `evaluacionTecnica`.

## 1. Crear una API key (empresa, sesión INAKAT)

La forma soportada es la **pantalla de Integraciones de INAKAT**
(`/company/integrations`, en el menú de la empresa): desde ahí se crean y
revocan las keys y se dan de alta los webhooks. La sesión web usa la cookie
`auth-token`, que es `httpOnly`: el JWT NO se puede copiar desde el navegador,
así que los `curl` de abajo sólo sirven para un cliente que ya tenga un token
emitido fuera del navegador.

Autenticación: JWT de un usuario con `role="company"` y empresa **aprobada**, en
la cookie `auth-token` (sesión web normal) o en `Authorization: Bearer <jwt>`.

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
curl "https://<inakat>/api/integration/candidates?status=accepted&page=1&limit=50" \
  -H "X-Api-Key: inak_<32 hex>"
# → { success: true, data: CandidatoInakat[], pagination: { page, limit, total, totalPages, hasNext, hasPrev } }
```

- El único `status` soportado en v1 es `accepted` (default si se omite).
- La key identifica a la empresa: solo devuelve Applications de **sus** Jobs.
- Cada uso actualiza `lastUsedAt` de la key.
- **Paginado obligatorio**: `page` (1 por defecto) y `limit` (50 por defecto,
  máximo 100). Recorre las páginas mientras `pagination.hasNext` sea `true`.
- **Sincronización incremental**: `?since=<ISO 8601>` filtra por `reviewedAt`,
  para no volver a traer todo el histórico en cada poll.
- Rate limits: 600 requests/min por IP (cortafuegos; Worky2 es multi-tenant y
  llama desde pocas IPs) y **60 requests/min por API key**, que es la cuota
  funcional de cada empresa.
- La key deja de funcionar en cuanto la empresa dueña se desactiva en INAKAT.

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

Requisitos de la URL receptora (el cuerpo lleva la PII completa del candidato):

- **`https://` obligatorio en producción** (`http://` sólo se admite fuera de
  producción, para pruebas locales).
- Sin credenciales embebidas (`https://user:pass@…`) y sólo puertos 80/443.
- El host no puede resolver a loopback, red privada, link-local
  (`169.254.169.254`) ni rangos reservados. Se comprueba al registrar **y otra
  vez justo antes de cada entrega**, por si el DNS cambia después.
- Máximo 5 webhooks activos por empresa; máximo 10 API keys activas.
- Alta y baja limitadas a 20 operaciones por hora y por IP.

## 4. Evento saliente `candidate.accepted`

Cuando una Application pasa a `accepted` (desde el panel de empresa o desde el
panel admin), INAKAT hace POST a cada webhook activo de la empresa. La entrega
se ejecuta con `after()` de Next (waitUntil), así que la función serverless
sigue viva hasta terminarla; timeout de 5 s, sin reintentos en v1, y las
redirecciones 3xx se tratan como fallo (reenviar el cuerpo y la firma a otro
host sería filtrar la PII):

```
POST <webhook.url>
Content-Type: application/json
X-Inakat-Timestamp: <epoch en segundos>
X-Inakat-Delivery: <uuid de la entrega>
X-Inakat-Signature: v1=<hex>

{
  "event": "candidate.accepted",
  "id": "<uuid de la entrega>",
  "createdAt": "<ISO 8601>",
  "candidate": CandidatoInakat
}
```

`id` / `X-Inakat-Delivery` sirven para deduplicar en el receptor si llega dos
veces el mismo evento.

Verificación de la firma (lado Worky2):

```
esperado = "v1=" + hex( HMAC_SHA256( secret, `${X-Inakat-Timestamp}.${bodyCrudo}` ) )
```

Comparar con `X-Inakat-Signature` en tiempo constante y rechazar timestamps
viejos (p. ej. > 5 min) para evitar replay.

Si el webhook falla, Worky2 sigue pudiendo importar por polling con el
endpoint de candidatos (sección 2): el webhook es un acelerador, no la fuente
de verdad.
