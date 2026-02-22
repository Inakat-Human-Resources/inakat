// RUTA: src/app/api/auth/reset-password/route.ts

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { hashPassword } from '@/lib/auth';

/**
 * POST /api/auth/reset-password
 * Recibe token + nueva contraseña y actualiza
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { token, password } = body;

    if (!token || !password) {
      return NextResponse.json(
        { success: false, error: 'Token y contraseña son requeridos' },
        { status: 400 }
      );
    }

    if (password.length < 6) {
      return NextResponse.json(
        { success: false, error: 'La contraseña debe tener al menos 6 caracteres' },
        { status: 400 }
      );
    }

    // Buscar usuario con token válido y no expirado
    const user = await prisma.user.findFirst({
      where: {
        resetToken: token,
        resetTokenExpiry: { gt: new Date() }
      }
    });

    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Token inválido o expirado' },
        { status: 400 }
      );
    }

    // Hash de la nueva contraseña
    const hashedPassword = await hashPassword(password);

    // Actualizar contraseña y limpiar token
    await prisma.user.update({
      where: { id: user.id },
      data: {
        password: hashedPassword,
        resetToken: null,
        resetTokenExpiry: null
      }
    });

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
