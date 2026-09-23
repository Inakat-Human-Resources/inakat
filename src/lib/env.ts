// RUTA: src/lib/env.ts

import { z } from 'zod';

/**
 * Validación central de variables de entorno.
 *
 * CONFIG (#PAGO): sólo JWT_SECRET fallaba al arrancar. Todo lo demás degradaba
 * en SILENCIO, y siempre en el peor momento:
 *
 * - `MERCADOPAGO_ACCESS_TOKEN` se leía con `!` a nivel de módulo: ausente, el
 *   SDK se construye igual y el fallo aparece como un 500 genérico al pagar.
 * - `MERCADOPAGO_WEBHOOK_SECRET` ausente en producción: 500 en cada
 *   notificación, así que ningún pago pendiente se acredita nunca.
 * - `NEXT_PUBLIC_APP_URL` ausente o con 'localhost': el pago se crea SIN
 *   notification_url, de modo que OXXO/SPEI no se confirman jamás.
 * - `SMTP_USER`/`SMTP_PASS` ausentes: sendEmail devuelve false y
 *   forgot-password responde "recibirás un enlace" sin enviar nada.
 * - `BLOB_READ_WRITE_TOKEN` ausente: 503 en las subidas.
 *
 * Nada de esto se detectaba en build ni en CI. Este módulo da el esquema y dos
 * formas de usarlo: `assertServerEnv()` para fallar pronto (build/arranque) y
 * `requireEnv()` para que un handler responda 503 con un mensaje claro en vez
 * de un 500 opaco.
 */

/** Variables que DEBEN existir en producción. */
export const serverEnvSchema = z.object({
  DATABASE_URL: z.string().min(1, 'DATABASE_URL es requerida'),
  DIRECT_URL: z.string().min(1, 'DIRECT_URL es requerida'),
  JWT_SECRET: z.string().min(32, 'JWT_SECRET debe tener al menos 32 caracteres'),
  MERCADOPAGO_ACCESS_TOKEN: z.string().min(1, 'MERCADOPAGO_ACCESS_TOKEN es requerida'),
  MERCADOPAGO_WEBHOOK_SECRET: z.string().min(1, 'MERCADOPAGO_WEBHOOK_SECRET es requerida'),
  NEXT_PUBLIC_MERCADOPAGO_PUBLIC_KEY: z
    .string()
    .min(1, 'NEXT_PUBLIC_MERCADOPAGO_PUBLIC_KEY es requerida'),
  NEXT_PUBLIC_APP_URL: z
    .string()
    .url('NEXT_PUBLIC_APP_URL debe ser una URL absoluta')
    .refine(
      (valor) => !valor.includes('localhost'),
      'NEXT_PUBLIC_APP_URL no puede apuntar a localhost en producción: sin ella no se envía notification_url y los pagos pendientes nunca se confirman'
    ),
  BLOB_READ_WRITE_TOKEN: z.string().min(1, 'BLOB_READ_WRITE_TOKEN es requerida'),
  SMTP_USER: z.string().min(1, 'SMTP_USER es requerida'),
  SMTP_PASS: z.string().min(1, 'SMTP_PASS es requerida'),
  NEXT_PUBLIC_GOOGLE_MAPS_API_KEY: z
    .string()
    .min(1, 'NEXT_PUBLIC_GOOGLE_MAPS_API_KEY es requerida')
});

export type ServerEnv = z.infer<typeof serverEnvSchema>;

export interface ResultadoValidacionEnv {
  ok: boolean;
  /** Mensajes de las variables que faltan o no cumplen. */
  faltantes: string[];
}

/**
 * Comprueba el entorno sin lanzar. Útil para un endpoint de diagnóstico o para
 * loguear el estado al arrancar.
 */
export function validarServerEnv(
  origen: NodeJS.ProcessEnv = process.env
): ResultadoValidacionEnv {
  const resultado = serverEnvSchema.safeParse(origen);

  if (resultado.success) {
    return { ok: true, faltantes: [] };
  }

  return {
    ok: false,
    // El nombre de la variable va SIEMPRE por delante: cuando falta del todo,
    // zod devuelve "Invalid input: expected string, received undefined" y sin el
    // path el mensaje no dice cuál de las once variables es.
    faltantes: resultado.error.issues.map((issue) => {
      const variable = issue.path.join('.');
      return variable ? `${variable}: ${issue.message}` : issue.message;
    })
  };
}

/**
 * Falla si el entorno de PRODUCCIÓN está incompleto.
 *
 * Pensado para importarse desde next.config.ts y romper el build antes de
 * desplegar un entorno al que le falta, por ejemplo, SMTP_PASS. Fuera de
 * producción sólo avisa por consola.
 */
export function assertServerEnv(origen: NodeJS.ProcessEnv = process.env): void {
  const { ok, faltantes } = validarServerEnv(origen);
  if (ok) return;

  const detalle = faltantes.map((m) => `  - ${m}`).join('\n');

  if (origen.NODE_ENV === 'production') {
    throw new Error(`Configuración de entorno incompleta:\n${detalle}`);
  }

  console.warn(`[env] Variables de entorno incompletas (no es producción):\n${detalle}`);
}

/**
 * Devuelve una variable obligatoria o `null` si falta.
 *
 * Para handlers que prefieren responder 503 "servicio no configurado" antes que
 * arrastrar un `undefined` hasta un 500 genérico.
 */
export function requireEnv(
  nombre: keyof ServerEnv,
  origen: NodeJS.ProcessEnv = process.env
): string | null {
  const valor = origen[nombre];
  return typeof valor === 'string' && valor.length > 0 ? valor : null;
}
