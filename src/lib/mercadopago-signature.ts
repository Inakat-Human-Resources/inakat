// RUTA: src/lib/mercadopago-signature.ts

import crypto from 'crypto';

export interface ResultadoValidacionFirma {
  isValid: boolean;
  /** Motivo del rechazo. SÓLO para el log del servidor: nunca se devuelve al llamante. */
  reason?: string;
}

/**
 * Tolerancia de antigüedad del webhook.
 *
 * Era de 5 minutos. MercadoPago reintenta las notificaciones durante bastante
 * más que eso, y un reintento legítimo llega con el `ts` de la notificación
 * original, así que la ventana corta convertía un reintento normal en un 401.
 * La defensa real contra el replay es la idempotencia (el reclamo atómico de la
 * compra), no esta ventana.
 */
export const TOLERANCIA_TIMESTAMP_MS = 15 * 60 * 1000;

/**
 * Normaliza el `ts` de la cabecera `x-signature` a milisegundos.
 *
 * DINERO (#PAGO): el código comparaba `parseInt(ts)` directamente contra
 * `Date.now()`. La documentación de MercadoPago muestra el `ts` en SEGUNDOS
 * (10 dígitos): un valor de ~1.7e9 siempre es menor que `Date.now() - 5min`
 * (~1.7e12), así que el 100% de los webhooks firmados se rechazaba con
 * "Timestamp too old" y ningún pago pendiente (OXXO/SPEI/3DS) se acreditaba
 * jamás. Aquí se acepta cualquiera de las dos unidades y se rechaza lo que no
 * sea un número positivo.
 *
 * @returns el timestamp en milisegundos, o `null` si no es un número válido.
 */
export function normalizarTimestamp(ts: string): number | null {
  const valor = Number(ts);
  if (!Number.isFinite(valor) || valor <= 0) return null;
  // Menos de 1e12 sólo puede ser segundos (1e12 ms = año 2001).
  return valor < 1e12 ? valor * 1000 : valor;
}

/**
 * Valida la firma HMAC que MercadoPago envía en `x-signature`.
 *
 * Formato de la cabecera: `ts=<timestamp>,v1=<hmac-sha256-hex>`
 * Manifest firmado: `id:<data.id>;request-id:<x-request-id>;ts:<ts>;`
 *
 * Docs: https://www.mercadopago.com.mx/developers/es/docs/your-integrations/notifications/webhooks
 *
 * @param ahora - inyectable para poder probar la ventana de antigüedad.
 */
export function validateMercadoPagoSignature(
  xSignature: string | null,
  xRequestId: string | null,
  dataId: string,
  secret: string,
  ahora: number = Date.now()
): ResultadoValidacionFirma {
  if (!xSignature) {
    return { isValid: false, reason: 'Missing x-signature header' };
  }

  if (!xRequestId) {
    return { isValid: false, reason: 'Missing x-request-id header' };
  }

  // Parsear x-signature (formato: "ts=xxx,v1=xxx")
  const parts = xSignature.split(',');
  const tsMatch = parts.find((p) => p.trim().startsWith('ts='));
  const v1Match = parts.find((p) => p.trim().startsWith('v1='));

  if (!tsMatch || !v1Match) {
    return { isValid: false, reason: 'Invalid x-signature format' };
  }

  const ts = tsMatch.trim().replace('ts=', '');
  const v1 = v1Match.trim().replace('v1=', '');

  // El manifest se firma con el `ts` TAL CUAL viene, sin normalizar.
  const manifest = `id:${dataId};request-id:${xRequestId};ts:${ts};`;

  const hmac = crypto.createHmac('sha256', secret).update(manifest).digest('hex');

  // SECURITY: comparación en tiempo constante para evitar timing attacks.
  // Comparar longitud primero (timingSafeEqual lanza si difieren los buffers).
  const hmacBuffer = Buffer.from(hmac, 'utf8');
  const v1Buffer = Buffer.from(v1, 'utf8');

  if (
    hmacBuffer.length !== v1Buffer.length ||
    !crypto.timingSafeEqual(hmacBuffer, v1Buffer)
  ) {
    return { isValid: false, reason: 'Signature mismatch' };
  }

  // Anti-replay: el timestamp no puede ser muy antiguo. Se normaliza la unidad
  // antes de comparar (ver normalizarTimestamp).
  const timestampMs = normalizarTimestamp(ts);
  if (timestampMs === null) {
    return { isValid: false, reason: 'Invalid timestamp' };
  }

  if (timestampMs < ahora - TOLERANCIA_TIMESTAMP_MS) {
    return { isValid: false, reason: 'Timestamp too old (possible replay attack)' };
  }

  return { isValid: true };
}
