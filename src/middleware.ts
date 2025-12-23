import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { verifyToken } from './lib/auth';

// RUTA: src/middleware.ts
/**
 * Middleware de Next.js para proteger rutas
 * Este middleware se ejecuta antes de las API routes y páginas
 */
export function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  // Excepción: POST a company-requests es público (registro de empresas)
  if (pathname === '/api/company-requests' && request.method === 'POST') {
    return NextResponse.next();
  }

  // Excepción: POST a applications es público (candidatos aplican a vacantes)
  if (pathname === '/api/applications' && request.method === 'POST') {
    return NextResponse.next();
  }

  // Excepción: GET a applications/check es público (verificar si ya aplicó)
  if (pathname === '/api/applications/check' && request.method === 'GET') {
    return NextResponse.next();
  }

  // Obtener token de las cookies
  const token = request.cookies.get('auth-token')?.value;

  // Si no hay token, denegar acceso
  if (!token) {
    if (pathname.startsWith('/api/')) {
      return NextResponse.json(
        {
          success: false,
          error: 'No autenticado. Por favor inicia sesión.'
        },
        { status: 401 }
      );
    }

    // Redirigir a unauthorized en vez de login
    const unauthorizedUrl = new URL('/unauthorized', request.url);
    unauthorizedUrl.searchParams.set('reason', 'no-token');
    unauthorizedUrl.searchParams.set('redirect', pathname);
    return NextResponse.redirect(unauthorizedUrl);
  }

  // Verificar token
  const payload = verifyToken(token);

  if (!payload) {
    if (pathname.startsWith('/api/')) {
      return NextResponse.json(
        {
          success: false,
          error: 'Token inválido o expirado. Por favor inicia sesión de nuevo.'
        },
        { status: 401 }
      );
    }

    const unauthorizedUrl = new URL('/unauthorized', request.url);
    unauthorizedUrl.searchParams.set('reason', 'expired');
    return NextResponse.redirect(unauthorizedUrl);
  }

  // Verificar permisos de ADMIN para rutas específicas
  const isAdminRoute =
    pathname.startsWith('/api/company-requests') ||
    pathname.startsWith('/api/applications') ||
    pathname.startsWith('/api/admin/') ||
    pathname.startsWith('/applications') ||
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

    const unauthorizedUrl = new URL('/unauthorized', request.url);
    unauthorizedUrl.searchParams.set('reason', 'no-permission');
    return NextResponse.redirect(unauthorizedUrl);
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

  // Verificar permisos de RECLUTADOR para rutas específicas
  const isRecruiterRoute =
    pathname.startsWith('/api/recruiter/') || pathname.startsWith('/recruiter/');

  if (
    isRecruiterRoute &&
    payload.role !== 'recruiter' &&
    payload.role !== 'admin'
  ) {
    if (pathname.startsWith('/api/')) {
      return NextResponse.json(
        {
          success: false,
          error: 'No tienes permisos de reclutador para acceder a este recurso.'
        },
        { status: 403 }
      );
    }
    return NextResponse.redirect(
      new URL('/unauthorized?reason=no-permission', request.url)
    );
  }

  // Verificar permisos de ESPECIALISTA para rutas específicas
  const isSpecialistRoute =
    pathname.startsWith('/api/specialist/') ||
    pathname.startsWith('/specialist/');

  if (
    isSpecialistRoute &&
    payload.role !== 'specialist' &&
    payload.role !== 'admin'
  ) {
    if (pathname.startsWith('/api/')) {
      return NextResponse.json(
        {
          success: false,
          error:
            'No tienes permisos de especialista para acceder a este recurso.'
        },
        { status: 403 }
      );
    }
    return NextResponse.redirect(
      new URL('/unauthorized?reason=no-permission', request.url)
    );
  }

  // Verificar permisos de USER para rutas específicas
  const isUserRoute =
    pathname.startsWith('/api/my-applications') ||
    pathname.startsWith('/my-applications');

  if (
    isUserRoute &&
    payload.role !== 'user' &&
    payload.role !== 'candidate' &&
    payload.role !== 'admin'
  ) {
    if (pathname.startsWith('/api/')) {
      return NextResponse.json(
        { success: false, error: 'No tienes permisos de usuario.' },
        { status: 403 }
      );
    }

    return NextResponse.redirect(
      new URL('/unauthorized?reason=no-permission', request.url)
    );
  }

  // Verificar permisos de CANDIDATO para rutas específicas
  const isCandidateRoute =
    pathname.startsWith('/api/candidate/') ||
    pathname.startsWith('/candidate/');

  if (
    isCandidateRoute &&
    payload.role !== 'candidate' &&
    payload.role !== 'admin'
  ) {
    if (pathname.startsWith('/api/')) {
      return NextResponse.json(
        {
          success: false,
          error: 'No tienes permisos de candidato para acceder a este recurso.'
        },
        { status: 403 }
      );
    }

    return NextResponse.redirect(
      new URL('/unauthorized?reason=no-permission', request.url)
    );
  }

  // Rutas de PERFIL - accesibles para cualquier usuario autenticado
  // No necesita verificación adicional de rol, solo autenticación (ya verificada arriba)
  const isProfileRoute =
    pathname.startsWith('/api/profile') || pathname === '/profile';

  // Si es ruta de perfil, solo necesita estar autenticado (ya verificado)
  // No hay restricción de rol adicional

  // Rutas de VENDOR - accesibles para cualquier usuario autenticado
  // Permite que cualquier usuario registrado pueda crear y gestionar su código de descuento
  // La verificación de autenticación ya se realizó arriba

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
    // Base routes (sin :path*) para proteger la ruta raíz
    '/api/company-requests',
    '/api/applications',
    '/api/upload',
    // Sub-routes con :path* para proteger rutas anidadas
    '/api/company-requests/:path*',
    '/api/applications/:path*',
    '/api/admin/:path*',
    '/api/company/:path*',
    '/api/my-applications',
    '/api/candidate/:path*',
    '/api/profile',
    '/api/recruiter/:path*',
    '/api/specialist/:path*',
    '/api/vendor/:path*',
    '/admin/:path*',
    '/applications/:path*',
    '/company/:path*',
    '/my-applications',
    '/candidate/:path*',
    '/recruiter/:path*',
    '/specialist/:path*',
    '/vendor/:path*',
    '/profile'
  ],
  runtime: 'nodejs'
};
