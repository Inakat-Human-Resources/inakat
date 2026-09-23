// RUTA: src/app/api/auth/forgot-password/route.ts

import { NextResponse, after } from 'next/server';
import crypto from 'crypto';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { sendPasswordResetEmail } from '@/lib/email';
import { hashResetToken } from '@/lib/auth';
import { getAppUrl } from '@/lib/utils';
import {
  applyRateLimit,
  checkRateLimit,
  hashIdentifier,
  FORGOT_PASSWORD_RATE_LIMIT,
  FORGOT_PASSWORD_EMAIL_RATE_LIMIT
} from '@/lib/rate-limit';

/**
 * VALIDACIÓN (AUTH-015): `email` no se comprobaba como string, así que un
 * cuerpo como {"email":123} reventaba en `email.toLowerCase()` y la ruta
 * respondía 500 — un error de cliente contado como error de servidor.
 */
const forgotPasswordSchema = z.object({
  email: z.string().trim().max(254).email()
});

/** Respuesta única, exista o no la cuenta. */
const RESPUESTA_GENERICA = {
  success: true,
  message: 'Si el correo está registrado, recibirás un enlace de recuperación.'
};

/**
 * POST /api/auth/forgot-password
 * Envía email con enlace de reset si el correo existe
 */
export async function POST(request: Request) {
  try {
    const rateLimited = applyRateLimit(request, 'forgot-password', FORGOT_PASSWORD_RATE_LIMIT);
    if (rateLimited) return rateLimited;

    const body = await request.json().catch(() => null);
    const validation = forgotPasswordSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { success: false, error: 'El correo es requerido' },
        { status: 400 }
      );
    }

    const email = validation.data.email.toLowerCase();

    // Límite POR DESTINATARIO (AUTH-016): el límite por IP no impide que desde
    // varias IPs (o instancias serverless distintas) se llene el buzón de una
    // víctima, y cada solicitud regeneraba el token invalidando el enlace que
    // la persona acababa de recibir. Se responde lo de siempre para que el 429
    // no se convierta en un oráculo de qué correos existen.
    const emailLimit = checkRateLimit(
      `forgot:email:${hashIdentifier(email)}`,
      FORGOT_PASSWORD_EMAIL_RATE_LIMIT
    );

    if (!emailLimit.success) {
      return NextResponse.json(RESPUESTA_GENERICA);
    }

    // Buscar usuario (no revelar si existe o no)
    const user = await prisma.user.findUnique({
      where: { email },
      select: { id: true, email: true, nombre: true, isActive: true }
    });

    if (user && user.isActive) {
      // Generar token seguro
      const resetToken = crypto.randomBytes(32).toString('hex');
      const resetTokenExpiry = new Date(Date.now() + 3600000); // 1 hora

      // SEGURIDAD (AUTH-021): en la base se guarda el SHA-256, nunca el token.
      // Con el token en claro, cualquier lectura de la tabla —un backup, una
      // réplica, un volcado de soporte— servía para tomar cuentas, incluida la
      // del admin, durante una hora. El valor en claro sólo viaja por correo.
      await prisma.user.update({
        where: { id: user.id },
        data: { resetToken: hashResetToken(resetToken), resetTokenExpiry }
      });

      const resetUrl = `${getAppUrl(request.url)}/reset-password?token=${resetToken}`;
      const destinatario = user.email;
      const nombre = user.nombre;
      const userId = user.id;

      // TIEMPOS (AUTH-016): el envío (handshake SMTP con Zoho: de cientos de ms
      // a segundos) se hace DESPUÉS de responder. Antes, la rama "el usuario
      // existe" tardaba segundos y la otra contestaba al instante: cronometrar
      // la petición decía si el correo estaba registrado, justo lo que la
      // respuesta genérica quería evitar.
      after(async () => {
        // `sendPasswordResetEmail` devuelve false (no lanza) si SMTP no está
        // configurado o el envío falla: sin este log, la respuesta prometía un
        // correo que nunca salió y no quedaba rastro para diagnosticarlo.
        const enviado = await sendPasswordResetEmail({
          email: destinatario,
          nombre,
          resetUrl
        });

        if (!enviado) {
          // Sin PII: sólo el id, para poder correlacionar en los logs.
          console.error(
            `[ForgotPassword] email no enviado (usuario ${userId}): revisa la configuración SMTP`
          );
        }
      });
    }

    // Siempre responder igual (seguridad)
    return NextResponse.json(RESPUESTA_GENERICA);
  } catch (error) {
    console.error('Error in forgot-password:', error);
    return NextResponse.json(
      { success: false, error: 'Error al procesar solicitud' },
      { status: 500 }
    );
  }
}
