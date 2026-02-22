// RUTA: src/app/api/auth/forgot-password/route.ts

import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { prisma } from '@/lib/prisma';
import { sendEmail } from '@/lib/email';

/**
 * POST /api/auth/forgot-password
 * Envía email con enlace de reset si el correo existe
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { email } = body;

    if (!email) {
      return NextResponse.json(
        { success: false, error: 'El correo es requerido' },
        { status: 400 }
      );
    }

    // Buscar usuario (no revelar si existe o no)
    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase().trim() }
    });

    if (user) {
      // Generar token seguro
      const resetToken = crypto.randomBytes(32).toString('hex');
      const resetTokenExpiry = new Date(Date.now() + 3600000); // 1 hora

      // Guardar en DB
      await prisma.user.update({
        where: { id: user.id },
        data: { resetToken, resetTokenExpiry }
      });

      // Construir URL
      const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://inakat.com';
      const resetUrl = `${baseUrl}/reset-password?token=${resetToken}`;

      // Enviar email
      await sendEmail({
        to: user.email,
        subject: 'Recuperación de contraseña - INAKAT',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #004aad;">Recuperación de contraseña</h2>
            <p>Hola <strong>${user.nombre}</strong>,</p>
            <p>Recibimos una solicitud para restablecer tu contraseña.</p>
            <p>
              <a href="${resetUrl}"
                 style="background: #004aad; color: white; padding: 12px 24px;
                        text-decoration: none; border-radius: 6px; display: inline-block;">
                Restablecer contraseña
              </a>
            </p>
            <p style="color: #666; font-size: 14px;">
              Este enlace expira en <strong>1 hora</strong>.
            </p>
            <p style="color: #999; font-size: 12px;">
              Si no solicitaste este cambio, ignora este correo.
            </p>
          </div>
        `
      });
    }

    // Siempre responder igual (seguridad)
    return NextResponse.json({
      success: true,
      message: 'Si el correo está registrado, recibirás un enlace de recuperación.'
    });
  } catch (error) {
    console.error('Error in forgot-password:', error);
    return NextResponse.json(
      { success: false, error: 'Error al procesar solicitud' },
      { status: 500 }
    );
  }
}
