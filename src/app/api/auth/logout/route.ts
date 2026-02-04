// RUTA: src/app/api/auth/logout/route.ts

import { NextResponse } from 'next/server';

/**
 * POST /api/auth/logout
 * Cierra sesión eliminando la cookie de autenticación
 */
export async function POST() {
  const response = NextResponse.json(
    {
      success: true,
      message: 'Sesión cerrada exitosamente'
    },
    { status: 200 }
  );

  // Eliminar cookie de autenticación
  response.cookies.delete('auth-token');

  return response;
}
