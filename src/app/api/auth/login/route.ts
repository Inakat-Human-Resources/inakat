// RUTA: src/app/api/auth/login/route.ts

import { NextResponse } from 'next/server';
import { authenticateUser, getAuthCookieOptions } from '@/lib/auth';
import { validate, loginSchema } from '@/lib/validations';
import {
  consumeRateLimit,
  getClientIP,
  hashIdentifier,
  peekRateLimit,
  rateLimitResponse,
  resetRateLimit,
  LOGIN_RATE_LIMIT,
  LOGIN_EMAIL_RATE_LIMIT
} from '@/lib/rate-limit';

/**
 * POST /api/auth/login
 * Autentica un usuario y establece una cookie con el token
 */
export async function POST(request: Request) {
  try {
    // Rate limiting: 7 intentos FALLIDOS por 15 minutos por IP.
    // Se consulta sin incrementar; el cupo lo gastan sólo los fallos, más abajo.
    const ip = getClientIP(request);
    const ipKey = `login:${ip}`;
    const ipLimit = peekRateLimit(ipKey, LOGIN_RATE_LIMIT);
    if (!ipLimit.success) return rateLimitResponse(ipLimit);

    // VALIDACIÓN (AUTH-015): un cuerpo vacío o que no es JSON es un error del
    // cliente (400), no un 500 que ensucia las métricas de disponibilidad.
    const body = await request.json().catch(() => null);

    if (!body || typeof body !== 'object') {
      return NextResponse.json(
        { success: false, error: 'Cuerpo de la solicitud inválido' },
        { status: 400 }
      );
    }

    // Validar datos de entrada
    const validation = validate(loginSchema, body);

    if (!validation.success) {
      return NextResponse.json(
        {
          success: false,
          errors: validation.errors
        },
        { status: 400 }
      );
    }

    const { email, password } = validation.data;

    const emailKey = `login:email:${hashIdentifier(email)}`;

    // Límite POR CUENTA: frena la fuerza bruta distribuida contra un email
    // concreto, que el límite por IP no ve (AUTH-011).
    const emailLimit = peekRateLimit(emailKey, LOGIN_EMAIL_RATE_LIMIT);
    if (!emailLimit.success) {
      return rateLimitResponse(
        emailLimit,
        'Demasiados intentos para esta cuenta. Por favor espera unos minutos antes de intentar de nuevo.'
      );
    }

    // Autenticar usuario
    const result = await authenticateUser(email, password);

    if (!result.success) {
      // Sólo los fallos consumen cupo, por IP y por cuenta.
      consumeRateLimit(ipKey, LOGIN_RATE_LIMIT);
      consumeRateLimit(emailKey, LOGIN_EMAIL_RATE_LIMIT);

      return NextResponse.json(
        {
          success: false,
          error: result.error
        },
        { status: 401 }
      );
    }

    // Login correcto: el usuario legítimo no debe gastar el cupo de su IP ni el
    // de su cuenta (AUTH-011).
    resetRateLimit(ipKey);
    resetRateLimit(emailKey);

    // Crear respuesta con los datos del usuario
    const response = NextResponse.json(
      {
        success: true,
        message: 'Login exitoso',
        user: result.user
      },
      { status: 200 }
    );

    // Establecer cookie httpOnly con el token.
    // El maxAge sale de JWT_EXPIRES_IN, no de un 7 escrito a mano (AUTH-022).
    response.cookies.set('auth-token', result.token, getAuthCookieOptions());

    return response;
  } catch (error) {
    console.error('[Auth] Login error:', error instanceof Error ? error.message : 'Unknown error');
    return NextResponse.json(
      {
        success: false,
        error: 'Error al procesar la solicitud'
      },
      { status: 500 }
    );
  }
}
