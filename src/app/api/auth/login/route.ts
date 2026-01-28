import { NextResponse } from 'next/server';
import { authenticateUser } from '@/lib/auth';
import { validate, loginSchema } from '@/lib/validations';

/**
 * POST /api/auth/login
 * Autentica un usuario y establece una cookie con el token
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();

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

    // Autenticar usuario
    const result = await authenticateUser(email, password);

    if (!result.success) {
      return NextResponse.json(
        {
          success: false,
          error: result.error
        },
        { status: 401 }
      );
    }

    // Crear respuesta con los datos del usuario
    const response = NextResponse.json(
      {
        success: true,
        message: 'Login exitoso',
        user: result.user
      },
      { status: 200 }
    );

    // Establecer cookie httpOnly con el token
    response.cookies.set('auth-token', result.token, {
      httpOnly: true, // No accesible desde JavaScript (seguridad contra XSS)
      secure: process.env.NODE_ENV === 'production', // Solo HTTPS en producción
      sameSite: 'lax', // Protección CSRF
      maxAge: 60 * 60 * 24 * 7, // 7 días
      path: '/' // Disponible en todas las rutas
    });

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
