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
import dns from 'dns/promises';
import { prisma } from './prisma';
import { loadCandidatoInakat, type CandidatoInakat } from './integration-candidate';

const WEBHOOK_TIMEOUT_MS = 5000;

// =============================================
// SSRF: VALIDACIÓN DE LA URL RECEPTORA
// =============================================
//
// El cuerpo del webhook lleva la PII completa del candidato (nombre, email,
// teléfono, URL del CV y evaluaciones). Aceptar cualquier http(s) permitía
// apuntarlo a 169.254.169.254, a localhost o a la red interna, y con `http://`
// esa PII viajaba en claro. Se valida al registrar Y otra vez antes de
// despachar, porque el DNS puede cambiar entre ambos momentos (rebinding).

/** ¿La IP cae en un rango privado, loopback, link-local o reservado? */
export function esIpNoPublica(ip: string): boolean {
  const limpia = ip.replace(/^\[|\]$/g, '').toLowerCase();

  // IPv6 mapeada a IPv4 (::ffff:127.0.0.1): se evalúa la parte v4.
  const mapeada = limpia.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  if (mapeada) return esIpNoPublica(mapeada[1]);

  if (limpia.includes(':')) {
    // IPv6: ::, ::1, ULA (fc00::/7) y link-local (fe80::/10).
    if (limpia === '::' || limpia === '::1') return true;
    const prefijo = parseInt(limpia.split(':')[0] || '0', 16);
    if ((prefijo & 0xfe00) === 0xfc00) return true; // fc00::/7
    if ((prefijo & 0xffc0) === 0xfe80) return true; // fe80::/10
    return false;
  }

  const octetos = limpia.split('.').map((o) => Number.parseInt(o, 10));
  if (octetos.length !== 4 || octetos.some((o) => !Number.isInteger(o) || o < 0 || o > 255)) {
    // No es una IPv4 reconocible: por prudencia se trata como no pública.
    return true;
  }
  const [a, b] = octetos;

  if (a === 0) return true; // 0.0.0.0/8
  if (a === 10) return true; // 10/8
  if (a === 127) return true; // loopback
  if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT 100.64/10
  if (a === 169 && b === 254) return true; // link-local (metadata EC2)
  if (a === 172 && b >= 16 && b <= 31) return true; // 172.16/12
  if (a === 192 && b === 0) return true; // 192.0.0/24 y 192.0.2/24
  if (a === 192 && b === 168) return true; // 192.168/16
  if (a === 198 && (b === 18 || b === 19)) return true; // benchmarking
  if (a >= 224) return true; // multicast y reservado

  return false;
}

/**
 * Comprobaciones que no necesitan red. Devuelve el motivo del rechazo o null.
 */
export function motivoUrlWebhookInvalida(valor: string): string | null {
  let url: URL;
  try {
    url = new URL(valor);
  } catch {
    return 'URL inválida';
  }

  const enProduccion = process.env.NODE_ENV === 'production';

  if (url.protocol !== 'https:' && url.protocol !== 'http:') {
    return 'La URL debe ser http(s)';
  }
  if (url.protocol === 'http:' && enProduccion) {
    return 'La URL debe usar https:// (el evento lleva datos personales del candidato)';
  }
  if (url.username || url.password) {
    return 'La URL no puede incluir credenciales';
  }
  if (url.port && url.port !== '80' && url.port !== '443') {
    return 'La URL no puede apuntar a un puerto no estándar';
  }

  const host = url.hostname.toLowerCase().replace(/^\[|\]$/g, '');
  if (host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.internal')) {
    return 'La URL no puede apuntar a la red interna';
  }
  // Host que ya es una IP literal: se comprueba sin resolver.
  if (/^[\d.]+$/.test(host) || host.includes(':')) {
    if (esIpNoPublica(host)) {
      return 'La URL no puede apuntar a una dirección privada o de loopback';
    }
  }

  return null;
}

/**
 * Validación completa: reglas de formato + resolución DNS del host, rechazando
 * los nombres que apuntan a rangos privados/loopback/link-local.
 */
export async function motivoUrlWebhookInvalidaConDns(valor: string): Promise<string | null> {
  const motivo = motivoUrlWebhookInvalida(valor);
  if (motivo) return motivo;

  const host = new URL(valor).hostname.replace(/^\[|\]$/g, '');
  if (/^[\d.]+$/.test(host) || host.includes(':')) return null; // ya validada arriba

  try {
    const direcciones = await dns.lookup(host, { all: true });
    if (direcciones.length === 0) return 'No se pudo resolver el host de la URL';
    if (direcciones.some((d) => esIpNoPublica(d.address))) {
      return 'La URL no puede apuntar a una dirección privada o de loopback';
    }
  } catch {
    return 'No se pudo resolver el host de la URL';
  }

  return null;
}

interface CandidateAcceptedPayload {
  event: 'candidate.accepted';
  /** Identificador único de esta entrega: permite deduplicar en el receptor. */
  id: string;
  createdAt: string;
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
 * de la vacante. Nunca lanza: la aceptación del candidato no depende de que el
 * webhook llegue.
 *
 * ENTREGA (importante): NO invocar con `void` desnudo. En Vercel la instancia
 * se congela en cuanto la ruta devuelve la respuesta, así que las 3 consultas a
 * la base y el fetch de 5 s que hay aquí dentro se perdían en silencio. Los
 * callers deben usar `after(() => dispatchCandidateAccepted(id))` de
 * 'next/server' —que se apoya en waitUntil— o esperar la promesa con `await`.
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

    const deliveryId = crypto.randomUUID();
    const payload: CandidateAcceptedPayload = {
      event: 'candidate.accepted',
      id: deliveryId,
      createdAt: new Date().toISOString(),
      candidate: candidato
    };
    const body = JSON.stringify(payload);
    const timestamp = Math.floor(Date.now() / 1000);

    await Promise.allSettled(
      webhooks.map(async (webhook) => {
        // Se revalida justo antes de enviar: la URL se guardó hace tiempo y su
        // DNS pudo cambiar para apuntar a la red interna (rebinding).
        const motivo = await motivoUrlWebhookInvalidaConDns(webhook.url);
        if (motivo) {
          console.warn(
            `[Worky2Webhook] Webhook ${webhook.id} descartado: ${motivo} (application ${applicationId})`
          );
          return;
        }

        try {
          const response = await fetch(webhook.url, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'X-Inakat-Timestamp': timestamp.toString(),
              'X-Inakat-Delivery': deliveryId,
              'X-Inakat-Signature': signWebhookPayload(webhook.secret, timestamp, body)
            },
            body,
            // Una redirección 307/308 reenviaría el cuerpo (PII del candidato)
            // y la firma a un host que nadie validó: se trata como fallo.
            redirect: 'error',
            signal: AbortSignal.timeout(WEBHOOK_TIMEOUT_MS)
          });

          if (!response.ok) {
            console.warn(
              `[Worky2Webhook] Webhook ${webhook.id} respondió ${response.status} (application ${applicationId})`
            );
          }
        } catch (error: unknown) {
          console.warn(
            `[Worky2Webhook] Fallo al entregar webhook ${webhook.id} (application ${applicationId}):`,
            error instanceof Error ? error.message : 'Unknown'
          );
        }
      })
    );
  } catch (error) {
    // Nunca propagar: la aceptación del candidato NO depende del webhook
    console.error(
      '[Worky2Webhook] Error inesperado en dispatchCandidateAccepted:',
      error instanceof Error ? error.message : 'Unknown'
    );
  }
}
