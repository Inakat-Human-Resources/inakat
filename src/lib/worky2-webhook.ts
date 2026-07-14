// RUTA: src/lib/worky2-webhook.ts
// Webhook saliente del puente INAKAT → Worky2.
//
// Cuando una Application pasa a 'accepted', se notifica a cada webhook activo
// registrado por la empresa dueña de la vacante con el evento
// candidate.accepted, firmado con HMAC-SHA256 (contrato compartido):
//
//   POST <webhook.url>
//   X-Inakat-Timestamp: <ts>            (epoch en segundos)
//   X-Inakat-Signature: v1=<hex>        hex = HMAC_SHA256(secret, `${ts}.${body}`)
//   body: { event: 'candidate.accepted', candidate: CandidatoInakat }

import crypto from 'crypto';
import { prisma } from './prisma';
import { loadCandidatoInakat, type CandidatoInakat } from './integration-candidate';

const WEBHOOK_TIMEOUT_MS = 5000;

interface CandidateAcceptedPayload {
  event: 'candidate.accepted';
  candidate: CandidatoInakat;
}

/** Firma el body con el secreto compartido: `v1=` + HMAC_SHA256(secret, `${ts}.${body}`). */
export function signWebhookPayload(
  secret: string,
  timestamp: number,
  body: string
): string {
  const hmac = crypto
    .createHmac('sha256', secret)
    .update(`${timestamp}.${body}`)
    .digest('hex');
  return `v1=${hmac}`;
}

/**
 * Dispara candidate.accepted a todos los webhooks activos de la empresa dueña
 * de la vacante. FIRE-AND-FORGET: nunca lanza; los callers deben invocarlo con
 * `void dispatchCandidateAccepted(id)` (o `.catch`) para no bloquear ni romper
 * la respuesta HTTP que provocó la aceptación.
 */
export async function dispatchCandidateAccepted(
  applicationId: number
): Promise<void> {
  try {
    const loaded = await loadCandidatoInakat(applicationId);
    if (!loaded) {
      console.warn('[Worky2Webhook] Application no encontrada:', applicationId);
      return;
    }

    const { candidato, companyUserId } = loaded;
    if (!companyUserId) {
      // Vacante huérfana (job.userId es SetNull): no hay empresa a quien notificar
      return;
    }

    const webhooks = await prisma.integrationWebhook.findMany({
      where: { userId: companyUserId, isActive: true },
      select: { id: true, url: true, secret: true }
    });

    if (webhooks.length === 0) return;

    const payload: CandidateAcceptedPayload = {
      event: 'candidate.accepted',
      candidate: candidato
    };
    const body = JSON.stringify(payload);
    const timestamp = Math.floor(Date.now() / 1000);

    await Promise.allSettled(
      webhooks.map((webhook) =>
        fetch(webhook.url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Inakat-Timestamp': timestamp.toString(),
            'X-Inakat-Signature': signWebhookPayload(webhook.secret, timestamp, body)
          },
          body,
          signal: AbortSignal.timeout(WEBHOOK_TIMEOUT_MS)
        })
          .then((response) => {
            if (!response.ok) {
              console.warn(
                `[Worky2Webhook] Webhook ${webhook.id} respondió ${response.status} (application ${applicationId})`
              );
            }
          })
          .catch((error: unknown) => {
            console.warn(
              `[Worky2Webhook] Fallo al entregar webhook ${webhook.id} (application ${applicationId}):`,
              error instanceof Error ? error.message : 'Unknown'
            );
          })
      )
    );
  } catch (error) {
    // Nunca propagar: la aceptación del candidato NO depende del webhook
    console.error(
      '[Worky2Webhook] Error inesperado en dispatchCandidateAccepted:',
      error instanceof Error ? error.message : 'Unknown'
    );
  }
}
