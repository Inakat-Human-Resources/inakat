import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { verifyToken } from './lib/auth';

/**
 * Middleware de Next.js para proteger rutas
 * Este middleware se ejecuta antes de las API routes y páginas
 */
export function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  // Obtener token de las cookies
  const token = request.cookies.get('auth-token')?.value;

  // Si no hay token, denegar acceso
  if (!token) {
    // Para rutas de API, devolver 401
    if (pathname.startsWith('/api/')) {
      return NextResponse.json(
        {
          success: false,
          error: 'No autenticado. Por favor inicia sesión.'
        },
        { status: 401 }
      );
    }

    // Para páginas, redirigir a login
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('redirect', pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Verificar token
  const payload = verifyToken(token);

  if (!payload) {
    // Token inválido o expirado
    if (pathname.startsWith('/api/')) {
      return NextResponse.json(
        {
          success: false,
          error: 'Token inválido o expirado. Por favor inicia sesión de nuevo.'
        },
        { status: 401 }
      );
    }

    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('redirect', pathname);
    loginUrl.searchParams.set('reason', 'expired');
    return NextResponse.redirect(loginUrl);
  }

  // Verificar permisos de ADMIN para rutas específicas
  const isAdminRoute =
    pathname.startsWith('/api/company-requests') ||
    pathname.startsWith('/admin');

  if (isAdminRoute && payload.role !== 'admin') {
    if (pathname.startsWith('/api/')) {
      return NextResponse.json(
        {
          success: false,
          error:
            'No tienes permisos de administrador para acceder a este recurso.'
        },
        { status: 403 }
      );
    }

    // Redirigir a página de error o home
    return NextResponse.redirect(new URL('/', request.url));
  }

  // Verificar permisos de EMPRESA para rutas específicas
  const isCompanyRoute =
    pathname.startsWith('/api/company/') || pathname.startsWith('/company/');

  if (
    isCompanyRoute &&
    payload.role !== 'company' &&
    payload.role !== 'admin'
  ) {
    if (pathname.startsWith('/api/')) {
      return NextResponse.json(
        {
          success: false,
          error: 'No tienes permisos de empresa para acceder a este recurso.'
        },
        { status: 403 }
      );
    }

    // Redirigir a página de error o home
    return NextResponse.redirect(new URL('/', request.url));
  }

  // Agregar información del usuario a los headers para uso en API routes
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-user-id', payload.userId.toString());
  requestHeaders.set('x-user-email', payload.email);
  requestHeaders.set('x-user-role', payload.role);

  // Continuar con la request
  return NextResponse.next({
    request: {
      headers: requestHeaders
    }
  });
}

/**
 * Configuración del middleware
 * Define qué rutas deben ser protegidas
 */
export const config = {
  matcher: [
    '/api/company-requests/:path*',
    '/api/company/:path*',
    '/admin/:path*',
    '/company/:path*'
  ],
  runtime: 'nodejs'
};
