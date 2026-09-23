// RUTA: __tests__/api/pago-firma-webhook.test.ts

/**
 * La firma del webhook de MercadoPago es la ÚNICA barrera que impide que un POST
 * falso acredite créditos, y no tenía ni un test: la suite de idempotencia corre
 * sin MERCADOPAGO_WEBHOOK_SECRET, es decir, saltándose la validación entera.
 *
 * El defecto que motiva estos tests: `ts` se comparaba con `parseInt(ts)` contra
 * `Date.now()`. La documentación de MercadoPago muestra el `ts` en SEGUNDOS, y
 * un valor de ~1.7e9 siempre es menor que `Date.now() - 5min` (~1.7e12), así que
 * el 100% de los webhooks firmados se rechazaba con "Timestamp too old" y ningún
 * pago pendiente (OXXO/SPEI/3DS) se acreditaba jamás.
 */

import crypto from 'crypto';
import {
  validateMercadoPagoSignature,
  normalizarTimestamp,
  TOLERANCIA_TIMESTAMP_MS
} from '@/lib/mercadopago-signature';

const SECRET = 'secreto-de-prueba-del-webhook';
const DATA_ID = '1234567890';
const REQUEST_ID = 'req-abc-123';

/** Firma correcta para el manifest que espera la función. */
function firmar(ts: string, dataId = DATA_ID, requestId = REQUEST_ID): string {
  const manifest = `id:${dataId};request-id:${requestId};ts:${ts};`;
  const v1 = crypto.createHmac('sha256', SECRET).update(manifest).digest('hex');
  return `ts=${ts},v1=${v1}`;
}

describe('normalizarTimestamp', () => {
  it('convierte segundos (10 dígitos) a milisegundos', () => {
    expect(normalizarTimestamp('1704908010')).toBe(1704908010 * 1000);
  });

  it('deja los milisegundos como están', () => {
    expect(normalizarTimestamp('1704908010000')).toBe(1704908010000);
  });

  it('rechaza lo que no es un número positivo', () => {
    expect(normalizarTimestamp('abc')).toBeNull();
    expect(normalizarTimestamp('')).toBeNull();
    expect(normalizarTimestamp('-5')).toBeNull();
    expect(normalizarTimestamp('0')).toBeNull();
  });
});

describe('validateMercadoPagoSignature', () => {
  const ahora = 1_704_908_010_000; // ms

  it('acepta una firma válida con ts en MILISEGUNDOS', () => {
    const ts = String(ahora);
    const resultado = validateMercadoPagoSignature(
      firmar(ts),
      REQUEST_ID,
      DATA_ID,
      SECRET,
      ahora
    );
    expect(resultado.isValid).toBe(true);
  });

  it('acepta una firma válida con ts en SEGUNDOS (el formato real de MercadoPago)', () => {
    // Éste es el caso que el código antiguo rechazaba SIEMPRE.
    const ts = String(Math.floor(ahora / 1000));
    const resultado = validateMercadoPagoSignature(
      firmar(ts),
      REQUEST_ID,
      DATA_ID,
      SECRET,
      ahora
    );
    expect(resultado.isValid).toBe(true);
  });

  it('rechaza una firma alterada', () => {
    const ts = String(ahora);
    const firmaMala = firmar(ts).replace(/v1=./, 'v1=0');
    const resultado = validateMercadoPagoSignature(
      firmaMala,
      REQUEST_ID,
      DATA_ID,
      SECRET,
      ahora
    );
    expect(resultado.isValid).toBe(false);
  });

  it('rechaza si el manifest no cuadra (otro data.id)', () => {
    const ts = String(ahora);
    const resultado = validateMercadoPagoSignature(
      firmar(ts, '999'),
      REQUEST_ID,
      DATA_ID,
      SECRET,
      ahora
    );
    expect(resultado.isValid).toBe(false);
    expect(resultado.reason).toBe('Signature mismatch');
  });

  it('rechaza si falta x-request-id', () => {
    const ts = String(ahora);
    const resultado = validateMercadoPagoSignature(firmar(ts), null, DATA_ID, SECRET, ahora);
    expect(resultado.isValid).toBe(false);
    expect(resultado.reason).toBe('Missing x-request-id header');
  });

  it('rechaza si falta x-signature', () => {
    const resultado = validateMercadoPagoSignature(null, REQUEST_ID, DATA_ID, SECRET, ahora);
    expect(resultado.isValid).toBe(false);
    expect(resultado.reason).toBe('Missing x-signature header');
  });

  it('rechaza un x-signature con formato inválido', () => {
    const resultado = validateMercadoPagoSignature(
      'esto-no-tiene-ts-ni-v1',
      REQUEST_ID,
      DATA_ID,
      SECRET,
      ahora
    );
    expect(resultado.isValid).toBe(false);
    expect(resultado.reason).toBe('Invalid x-signature format');
  });

  it('rechaza un ts anterior a la ventana de tolerancia (replay), en segundos', () => {
    const tsViejoSegundos = String(
      Math.floor((ahora - TOLERANCIA_TIMESTAMP_MS - 60_000) / 1000)
    );
    const resultado = validateMercadoPagoSignature(
      firmar(tsViejoSegundos),
      REQUEST_ID,
      DATA_ID,
      SECRET,
      ahora
    );
    expect(resultado.isValid).toBe(false);
    expect(resultado.reason).toContain('Timestamp too old');
  });

  it('acepta un reintento de hace 10 minutos (dentro de la tolerancia)', () => {
    const ts = String(Math.floor((ahora - 10 * 60 * 1000) / 1000));
    const resultado = validateMercadoPagoSignature(
      firmar(ts),
      REQUEST_ID,
      DATA_ID,
      SECRET,
      ahora
    );
    expect(resultado.isValid).toBe(true);
  });

  it('rechaza un ts que no es numérico aunque la firma cuadre', () => {
    const resultado = validateMercadoPagoSignature(
      firmar('no-es-un-numero'),
      REQUEST_ID,
      DATA_ID,
      SECRET,
      ahora
    );
    expect(resultado.isValid).toBe(false);
    expect(resultado.reason).toBe('Invalid timestamp');
  });
});

describe('El webhook no filtra el motivo del rechazo', () => {
  const fs = require('fs');
  const path = require('path');

  it('la respuesta 401 devuelve sólo "Invalid signature", sin reason', () => {
    const fuente = fs.readFileSync(
      path.join(process.cwd(), 'src/app/api/webhooks/mercadopago/route.ts'),
      'utf-8'
    );

    // El detalle sigue yendo al log del servidor...
    expect(fuente).toContain('reason: validation.reason');
    // ...pero la RESPUESTA ya no lo lleva.
    expect(fuente).not.toMatch(/\{\s*error:\s*'Invalid signature',\s*reason:/);
    expect(fuente).toMatch(/\{\s*error:\s*'Invalid signature'\s*\}/);
  });
});
