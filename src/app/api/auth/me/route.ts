// RUTA: src/app/api/auth/me/route.ts

import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

/**
 * GET /api/auth/me
 * Obtiene la información del usuario autenticado actual
 */
export async function GET() {
  try {
    // Obtener token de las cookies
    const cookieStore = await cookies();
    const token = cookieStore.get('auth-token')?.value;

    // UI-017: un visitante anónimo no es un error. Cada página pública pedía
    // /api/auth/me desde el Navbar y dejaba un 401 en consola (Lighthouse lo
    // penaliza). Sin cookie se responde 200 con user null; el 401 queda para
    // un token inválido o expirado.
    if (!token) {
      return NextResponse.json({ success: true, user: null });
    }

    // Verificar token
    const payload = verifyToken(token);

    if (!payload) {
      const response = NextResponse.json(
        {
          success: false,
          error: 'Token inválido o expirado'
        },
        { status: 401 }
      );
      response.cookies.delete('auth-token');
      return response;
    }

    // Obtener usuario actualizado de la base de datos
    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
      select: {
        id: true,
        email: true,
        nombre: true,
        apellidoPaterno: true,
        apellidoMaterno: true,
        role: true,
        credits: true, // 💰 AGREGAR CRÉDITOS
        isActive: true,
        emailVerified: true,
        lastLogin: true,
        createdAt: true
      }
    });

    // SESIÓN (AUTH-002): usuario borrado o desactivado → además de negar, se
    // borra la cookie. Si no, el navegador seguía mandando durante días un
    // token que ya no representa a nadie.
    if (!user) {
      const response = NextResponse.json(
        {
          success: false,
          error: 'Usuario no encontrado'
        },
        { status: 404 }
      );
      response.cookies.delete('auth-token');
      return response;
    }

    if (!user.isActive) {
      const response = NextResponse.json(
        {
          success: false,
          error: 'Usuario desactivado'
        },
        { status: 403 }
      );
      response.cookies.delete('auth-token');
      return response;
    }

    return NextResponse.json({
      success: true,
      user
    });
  } catch (error) {
    console.error('Error in /api/auth/me:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Error al verificar autenticación'
      },
      { status: 500 }
    );
  }
}
