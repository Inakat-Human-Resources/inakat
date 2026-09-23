// RUTA: src/lib/rate-limit.ts

import { NextResponse } from 'next/server';

/**
 * Rate limiter en memoria para protección básica.
 *
 * NOTA: En Vercel serverless, cada instancia tiene su propio Map.
 * Esto NO es distribuido, pero protege contra abuso básico.
 * Para producción escalada, migrar a @upstash/ratelimit con Redis.
 */

interface RateLimitEntry {
  count: number;
  resetTime: number;
}

// Map global por instancia de función
const rateLimitMap = new Map<string, RateLimitEntry>();

// Limpiar entradas expiradas cada 60 segundos
const CLEANUP_INTERVAL = 60 * 1000;
let lastCleanup = Date.now();

function cleanupExpired() {
  const now = Date.now();
  if (now - lastCleanup < CLEANUP_INTERVAL) return;
  lastCleanup = now;

  for (const [key, entry] of rateLimitMap.entries()) {
    if (now > entry.resetTime) {
      rateLimitMap.delete(key);
    }
  }
}

export interface RateLimitConfig {
  /** Número máximo de requests permitidos en la ventana */
  maxRequests: number;
  /** Ventana de tiempo en segundos */
  windowSeconds: number;
}

export interface RateLimitResult {
  success: boolean;
  remaining: number;
  resetInSeconds: number;
}

/**
 * Verifica rate limit para un identificador dado (típicamente IP o IP+ruta).
 *
 * @param identifier - Clave única (ej: "login:192.168.1.1")
 * @param config - Configuración de límites
 * @returns Resultado indicando si el request es permitido
 */
export function checkRateLimit(
  identifier: string,
  config: RateLimitConfig
): RateLimitResult {
  cleanupExpired();

  const now = Date.now();
  const entry = rateLimitMap.get(identifier);

  // Si no hay entrada o expiró, crear nueva
  if (!entry || now > entry.resetTime) {
    rateLimitMap.set(identifier, {
      count: 1,
      resetTime: now + (config.windowSeconds * 1000)
    });
    return {
      success: true,
      remaining: config.maxRequests - 1,
      resetInSeconds: config.windowSeconds
    };
  }

  // Incrementar contador
  entry.count++;

  const resetInSeconds = Math.ceil((entry.resetTime - now) / 1000);

  if (entry.count > config.maxRequests) {
    return {
      success: false,
      remaining: 0,
      resetInSeconds
    };
  }

  return {
    success: true,
    remaining: config.maxRequests - entry.count,
    resetInSeconds
  };
}

/**
 * Mira el estado del contador SIN incrementarlo.
 *
 * Sirve para límites que sólo deben gastarse con una operación efectiva (p. ej.
 * un alta creada de verdad): se consulta antes de trabajar y se consume después
 * del éxito con `consumeRateLimit`.
 */
export function peekRateLimit(
  identifier: string,
  config: RateLimitConfig
): RateLimitResult {
  cleanupExpired();

  const now = Date.now();
  const entry = rateLimitMap.get(identifier);

  if (!entry || now > entry.resetTime) {
    return {
      success: true,
      remaining: config.maxRequests,
      resetInSeconds: config.windowSeconds
    };
  }

  const resetInSeconds = Math.ceil((entry.resetTime - now) / 1000);

  return {
    success: entry.count < config.maxRequests,
    remaining: Math.max(0, config.maxRequests - entry.count),
    resetInSeconds
  };
}

/**
 * Incrementa el contador de un identificador (sin decidir nada).
 * Pensado para contar sólo lo que importa: intentos FALLIDOS de login, altas
 * creadas de verdad, etc.
 */
export function consumeRateLimit(
  identifier: string,
  config: RateLimitConfig
): void {
  checkRateLimit(identifier, config);
}

/**
 * Borra el contador de un identificador.
 *
 * FIABILIDAD (AUTH-011/AUTH-018): los contadores se incrementaban en TODA
 * petición, también en las que terminaban bien. Ocho reclutadores de la misma
 * oficina entrando a las 9:00 agotaban los 7 intentos/15 min aunque todos
 * acertaran su contraseña. Tras un login correcto se limpia el contador de esa
 * IP para que sólo penalicen los fallos.
 */
export function resetRateLimit(identifier: string): void {
  rateLimitMap.delete(identifier);
}

/**
 * Clave estable y corta para limitar por cuenta sin escribir el email en
 * memoria (PII). No necesita ser criptográfica: sólo repartir.
 */
export function hashIdentifier(value: string): string {
  const normalized = String(value ?? '').trim().toLowerCase();
  let hash = 0;

  for (let i = 0; i < normalized.length; i++) {
    hash = (hash << 5) - hash + normalized.charCodeAt(i);
    hash |= 0; // a 32 bits
  }

  return Math.abs(hash).toString(36);
}

/**
 * Extrae IP del request (compatible con Vercel).
 * Vercel setea x-forwarded-for con la IP real del cliente.
 */
export function getClientIP(request: Request): string {
  // En Vercel, x-vercel-forwarded-for lo pone la plataforma y no es falsificable
  // por el cliente; x-forwarded-for sí lo es en otros hostings.
  const vercelForwarded = request.headers.get('x-vercel-forwarded-for');
  if (vercelForwarded) {
    return vercelForwarded.split(',')[0].trim();
  }

  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) {
    // x-forwarded-for puede ser "ip1, ip2, ip3" — tomar la primera
    return forwarded.split(',')[0].trim();
  }

  const realIp = request.headers.get('x-real-ip');
  if (realIp) return realIp;

  return 'unknown';
}

// =============================================
// CONFIGURACIONES PRE-DEFINIDAS
// =============================================

/** Login: 7 intentos FALLIDOS por 15 minutos por IP (un login correcto limpia el contador) */
export const LOGIN_RATE_LIMIT: RateLimitConfig = {
  maxRequests: 7,
  windowSeconds: 15 * 60
};

/**
 * Login por cuenta: 10 fallos por 15 minutos contra el mismo email.
 * Sin esto, un atacante con un pool de IPs prueba contraseñas contra una cuenta
 * concreta sin que ningún contador lo frene (AUTH-011).
 */
export const LOGIN_EMAIL_RATE_LIMIT: RateLimitConfig = {
  maxRequests: 10,
  windowSeconds: 15 * 60
};

/** Register: 3 registros CREADOS por hora por IP */
export const REGISTER_RATE_LIMIT: RateLimitConfig = {
  maxRequests: 3,
  windowSeconds: 60 * 60
};

/**
 * Register (intentos): 20 peticiones por hora por IP.
 *
 * Cubo ancho para abuso automatizado. El cupo estrecho de 3/h sólo cuenta altas
 * creadas: antes un 400 de zod y un 409 de email repetido gastaban el cupo y
 * dejaban fuera una hora a toda una IP compartida —feria de empleo, WiFi de
 * universidad, CGNAT móvil— (AUTH-011/AUTH-018).
 */
export const REGISTER_ATTEMPT_RATE_LIMIT: RateLimitConfig = {
  maxRequests: 20,
  windowSeconds: 60 * 60
};

/** Upload: 15 uploads por hora por IP */
export const UPLOAD_RATE_LIMIT: RateLimitConfig = {
  maxRequests: 15,
  windowSeconds: 60 * 60
};

/** Contact: 5 mensajes por hora por IP */
export const CONTACT_RATE_LIMIT: RateLimitConfig = {
  maxRequests: 5,
  windowSeconds: 60 * 60
};

/** Applications (público): 10 por hora por IP */
export const APPLICATION_RATE_LIMIT: RateLimitConfig = {
  maxRequests: 10,
  windowSeconds: 60 * 60
};

/** Forgot password: 3 por hora por IP (evita email bombing y enumeración) */
export const FORGOT_PASSWORD_RATE_LIMIT: RateLimitConfig = {
  maxRequests: 3,
  windowSeconds: 60 * 60
};

/**
 * Forgot password por destinatario: 3 por hora contra el mismo email.
 * El límite por IP no impide que desde varias IPs se llene el buzón de una
 * víctima —y cada solicitud invalidaba el enlace anterior— (AUTH-016).
 */
export const FORGOT_PASSWORD_EMAIL_RATE_LIMIT: RateLimitConfig = {
  maxRequests: 3,
  windowSeconds: 60 * 60
};

/** Reset password: 5 por 15 minutos por IP */
export const RESET_PASSWORD_RATE_LIMIT: RateLimitConfig = {
  maxRequests: 5,
  windowSeconds: 15 * 60
};

/** Validación de código de descuento (público): 10 por 15 minutos por IP (evita fuerza bruta/enumeración) */
export const DISCOUNT_VALIDATE_RATE_LIMIT: RateLimitConfig = {
  maxRequests: 10,
  windowSeconds: 15 * 60
};

/**
 * Helper que verifica rate limit y retorna respuesta 429 si se excede.
 * Retorna null si el request es permitido.
 *
 * Uso en un route handler:
 *   const blocked = applyRateLimit(request, 'login', LOGIN_RATE_LIMIT);
 *   if (blocked) return blocked;
 */
export function applyRateLimit(
  request: Request,
  routePrefix: string,
  config: RateLimitConfig
): NextResponse | null {
  const ip = getClientIP(request);
  const identifier = `${routePrefix}:${ip}`;
  const result = checkRateLimit(identifier, config);

  if (!result.success) {
    return rateLimitResponse(result);
  }

  return null;
}

/**
 * Respuesta 429 estándar a partir de un resultado de rate limit.
 * Se usa también desde las rutas que llevan su propio contador (login por
 * cuenta, registro por altas creadas).
 */
export function rateLimitResponse(
  result: RateLimitResult,
  message = 'Demasiadas solicitudes. Por favor espera unos minutos antes de intentar de nuevo.'
): NextResponse {
  return NextResponse.json(
    {
      success: false,
      error: message,
      retryAfterSeconds: result.resetInSeconds
    },
    {
      status: 429,
      headers: {
        'Retry-After': result.resetInSeconds.toString(),
        'X-RateLimit-Remaining': '0',
        'X-RateLimit-Reset': result.resetInSeconds.toString()
      }
    }
  );
}
