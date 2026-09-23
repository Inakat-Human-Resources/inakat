// RUTA: src/app/api/auth/reset-password/route.ts

import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { hashPassword, hashResetToken } from '@/lib/auth';
import { applyRateLimit, RESET_PASSWORD_RATE_LIMIT } from '@/lib/rate-limit';

// Misma política de contraseña que el registro: mín 8, una mayúscula y un número.
const resetPasswordSchema = z.object({
  token: z.string().min(1, 'Token requerido'),
  password: z
    .string()
    .min(8, 'La contraseña debe tener al menos 8 caracteres')
    .regex(/[A-Z]/, 'Debe contener al menos una mayúscula')
    .regex(/[0-9]/, 'Debe contener al menos un número')
});

/**
 * POST /api/auth/reset-password
 * Recibe token + nueva contraseña y actualiza
 */
export async function POST(request: Request) {
  try {
    const rateLimited = applyRateLimit(request, 'reset-password', RESET_PASSWORD_RATE_LIMIT);
    if (rateLimited) return rateLimited;

    // VALIDACIÓN (AUTH-015): cuerpo no-JSON → 400, no 500.
    const body = await request.json().catch(() => null);
    const validation = resetPasswordSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        {
          success: false,
          error: validation.error.issues[0]?.message || 'Datos inválidos'
        },
        { status: 400 }
      );
    }

    const { token, password } = validation.data;

    // Hash de la nueva contraseña
    const hashedPassword = await hashPassword(password);

    // CONSUMO ATÓMICO (AUTH-021)
    // Antes era findFirst → hash → update por id: dos peticiones simultáneas
    // con el mismo token pasaban ambas la comprobación, así que el enlace no
    // era realmente de un solo uso. Con un updateMany condicionado, la
    // condición y la escritura son la misma operación: sólo una gana, y la
    // segunda ve count === 0. Se comprueba además `isActive`: un usuario
    // desactivado no debe poder recuperar el acceso por correo.
    //
    // El token viaja en claro por correo pero en la base vive su SHA-256, así
    // que la búsqueda es por el hash.
    const resultado = await prisma.user.updateMany({
      where: {
        resetToken: hashResetToken(token),
        resetTokenExpiry: { gt: new Date() },
        isActive: true
      },
      data: {
        password: hashedPassword,
        resetToken: null,
        resetTokenExpiry: null
      }
    });

    if (resultado.count !== 1) {
      return NextResponse.json(
        { success: false, error: 'Token inválido o expirado' },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Contraseña actualizada correctamente'
    });
  } catch (error) {
    console.error('Error in reset-password:', error);
    return NextResponse.json(
      { success: false, error: 'Error al restablecer contraseña' },
      { status: 500 }
    );
  }
}
