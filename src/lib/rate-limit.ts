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
 * Extrae IP del request (compatible con Vercel).
 * Vercel setea x-forwarded-for con la IP real del cliente.
 */
export function getClientIP(request: Request): string {
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

/** Login: 7 intentos por 15 minutos por IP */
export const LOGIN_RATE_LIMIT: RateLimitConfig = {
  maxRequests: 7,
  windowSeconds: 15 * 60
};

/** Register: 3 registros por hora por IP */
export const REGISTER_RATE_LIMIT: RateLimitConfig = {
  maxRequests: 3,
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
    return NextResponse.json(
      {
        success: false,
        error: 'Demasiadas solicitudes. Por favor espera unos minutos antes de intentar de nuevo.',
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

  return null;
}
