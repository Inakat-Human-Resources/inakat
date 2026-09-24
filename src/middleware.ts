import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { verifyToken } from './lib/auth';
import { prisma } from './lib/prisma';

// RUTA: src/middleware.ts
/**
 * Middleware de Next.js para proteger rutas
 * Este middleware se ejecuta antes de las API routes y páginas
 *
 * SEGURIDAD (AUTH-002): el JWT vive 7 días y antes era la ÚNICA fuente de
 * verdad aquí: desactivar a un usuario (isActive=false) o cambiarle el rol no
 * surtía efecto hasta que el token caducaba, y las ~16 rutas que autorizan con
 * las cabeceras x-user-* que pone este middleware seguían respondiendo 200.
 * Ahora, tras validar la firma, se consulta el estado vigente en la base
 * (`isActive` y `role`) y ese rol —no el del token— es el que manda tanto en
 * las comprobaciones de abajo como en la cabecera x-user-role.
 *
 * Por eso el middleware declara `runtime: 'nodejs'` (ver `config`): necesita
 * Prisma, que no corre en el runtime edge.
 */
export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  // El banco de pruebas de diseño (/diseno) sólo existe en desarrollo. Su layout
  // ya llama a notFound() en producción, pero el loading.tsx raíz abre el
  // streaming antes y la respuesta sale con estado 200 (página 404 con noindex).
  // Aquí se corta antes de renderizar nada: 404 de verdad.
  if (pathname === '/diseno' || pathname.startsWith('/diseno/')) {
    // En desarrollo pasa sin sesión: el banco renderiza con datos de ejemplo.
    return process.env.NODE_ENV === 'production'
      ? new NextResponse('Not Found', { status: 404 })
      : NextResponse.next();
  }

  // Excepción: POST a company-requests es público (registro de empresas)
  if (pathname === '/api/company-requests' && request.method === 'POST') {
    return NextResponse.next();
  }

  // Excepción: POST a applications es público (candidatos aplican a vacantes)
  if (pathname === '/api/applications' && request.method === 'POST') {
    return NextResponse.next();
  }

  // PRIVACIDAD: `applications/check` YA NO es público. Recibía un email por
  // query y respondía si esa persona había postulado a una vacante y en qué
  // estado iba: un oráculo para cualquiera con una lista de correos. Su único
  // consumidor (ApplyJobModal) está autenticado y consulta su propio correo,
  // que ahora sale de la sesión.

  // Excepción: POST a upload es público (para registro de empresas)
  if (pathname === '/api/upload' && request.method === 'POST') {
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

  // Un token firmado pero sin userId numérico no identifica a nadie: sin esta
  // guarda, `findUnique({ where: { id: undefined } })` lanzaría y se
  // respondería 503 en vez de cortar la sesión.
  if (!payload || !Number.isInteger(payload.userId)) {
    // La cookie ya no sirve: borrarla evita que el navegador siga mandando un
    // token muerto en cada petición (y que la sesión "reviva" si JWT_EXPIRES_IN
    // es mayor que el maxAge de la cookie, o al revés).
    return denySession(request, pathname, 'expired');
  }

  // ESTADO VIGENTE EN BASE DE DATOS (AUTH-002)
  // El token puede decir "company" o "activo" y la realidad ser otra.
  let dbUser: { email: string; role: string; isActive: boolean } | null = null;

  try {
    dbUser = await prisma.user.findUnique({
      where: { id: payload.userId },
      select: { email: true, role: true, isActive: true }
    });
  } catch (error) {
    // Fallar cerrado: si no podemos comprobar el estado de la cuenta, no
    // dejamos pasar con el token a secas (sería volver al agujero original).
    console.error(
      '[Middleware] No se pudo verificar la sesión contra la base:',
      error instanceof Error ? error.message : 'Error desconocido'
    );

    if (pathname.startsWith('/api/')) {
      return NextResponse.json(
        {
          success: false,
          error: 'No se pudo verificar la sesión. Intenta de nuevo.'
        },
        { status: 503 }
      );
    }

    const retryUrl = new URL('/unauthorized', request.url);
    retryUrl.searchParams.set('reason', 'expired');
    return NextResponse.redirect(retryUrl);
  }

  // Usuario borrado o desactivado: se corta la sesión aunque el JWT siga vivo.
  if (!dbUser || !dbUser.isActive) {
    return denySession(request, pathname, 'expired');
  }

  // A partir de aquí el rol que manda es el de la base, nunca el del token.
  const role = dbUser.role;
  const email = dbUser.email;

  // AUTH-014 / PERF-016: /api/admin/candidates/[id]/documents es SOLO de admin.
  // Reclutadores y especialistas gestionan documentos por
  // /api/evaluations/candidates/[id]/documents, que comprueba que estén
  // asignados a una vacante del candidato. No se abre ninguna excepción aquí:
  // el handler de admin no comprueba pertenencia y reabriría el IDOR.

  // Verificar permisos de ADMIN para rutas específicas
  const isAdminRoute =
    pathname.startsWith('/api/company-requests') ||
    // NOTA: /api/applications y sub-rutas están restringidas a admin en middleware.
    // Companies/recruiters/specialists acceden a applications vía sus propias rutas:
    // - /api/company/applications/[id]
    // - /api/recruiter/dashboard
    // - /api/specialist/dashboard
    // NO mover esta restricción sin verificar esas rutas alternativas.
    pathname.startsWith('/api/applications') ||
    pathname.startsWith('/api/admin/') ||
    pathname.startsWith('/applications') ||
    pathname.startsWith('/admin');

  if (isAdminRoute && role !== 'admin') {
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
  // /create-job y /credits/* son páginas de empresa aunque no cuelguen de
  // /company/: antes no estaban ni en el matcher, así que una sesión caducada o
  // un candidato llegaban hasta el formulario de vacante o hasta capturar la
  // tarjeta en el Brick de Mercado Pago y sólo entonces recibían el 401/403
  // (AUTH-024 / AUTH-025).
  const isCompanyRoute =
    pathname.startsWith('/api/company/') ||
    pathname.startsWith('/company/') ||
    pathname === '/create-job' ||
    pathname === '/credits' ||
    pathname.startsWith('/credits/');

  if (isCompanyRoute && role !== 'company' && role !== 'admin') {
    if (pathname.startsWith('/api/')) {
      return NextResponse.json(
        {
          success: false,
          error: 'No tienes permisos de empresa para acceder a este recurso.'
        },
        { status: 403 }
      );
    }

    // Mismo destino que el resto de roles: mandar a '/' dejaba al usuario en el
    // inicio sin ninguna explicación (AUTH-023).
    return NextResponse.redirect(
      new URL('/unauthorized?reason=no-permission', request.url)
    );
  }

  // Verificar permisos de RECLUTADOR para rutas específicas
  const isRecruiterRoute =
    pathname.startsWith('/api/recruiter/') || pathname.startsWith('/recruiter/');

  if (isRecruiterRoute && role !== 'recruiter' && role !== 'admin') {
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

  if (isSpecialistRoute && role !== 'specialist' && role !== 'admin') {
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
    role !== 'user' &&
    role !== 'candidate' &&
    role !== 'admin'
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

  if (isCandidateRoute && role !== 'candidate' && role !== 'admin') {
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

  // Rutas de PERFIL: sólo requieren estar autenticado (ya verificado arriba),
  // no hay restricción de rol adicional.

  // Verificar permisos de VENDEDOR para rutas específicas
  // DINERO (AUTH-004): estas rutas estaban abiertas a cualquier usuario
  // autenticado, así que una cuenta gratuita de candidato podía crear su propio
  // DiscountCode con 10% de descuento y 10% de comisión y usarlo desde la
  // cuenta de empresa (auto-referido). El rol 'vendor' lo da el admin
  // (POST /api/admin/vendors); nadie se lo puede dar a sí mismo.
  const isVendorRoute =
    pathname.startsWith('/api/vendor/') || pathname.startsWith('/vendor/');

  if (isVendorRoute && role !== 'vendor' && role !== 'admin') {
    if (pathname.startsWith('/api/')) {
      return NextResponse.json(
        {
          success: false,
          error: 'No tienes permisos de vendedor para acceder a este recurso.'
        },
        { status: 403 }
      );
    }

    return NextResponse.redirect(
      new URL('/unauthorized?reason=no-permission', request.url)
    );
  }

  // Continuar con la request, con los datos VIGENTES del usuario en cabeceras
  return withUserHeaders(request, payload.userId, email, role);
}

/**
 * Deja pasar la request añadiendo las cabeceras x-user-* que consumen las API
 * routes. El rol y el email salen de la base, no del token (AUTH-002).
 */
function withUserHeaders(
  request: NextRequest,
  userId: number,
  email: string,
  role: string
) {
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-user-id', userId.toString());
  requestHeaders.set('x-user-email', email);
  requestHeaders.set('x-user-role', role);

  return NextResponse.next({
    request: {
      headers: requestHeaders
    }
  });
}

/**
 * Corta la sesión: 401 en API, redirección a /unauthorized en páginas, y en
 * ambos casos borra la cookie auth-token para que el navegador deje de mandar
 * un token que ya no vale (token expirado/inválido, usuario borrado o
 * desactivado).
 */
function denySession(request: NextRequest, pathname: string, reason: string) {
  const response = pathname.startsWith('/api/')
    ? NextResponse.json(
        {
          success: false,
          error: 'Token inválido o expirado. Por favor inicia sesión de nuevo.'
        },
        { status: 401 }
      )
    : (() => {
        const unauthorizedUrl = new URL('/unauthorized', request.url);
        unauthorizedUrl.searchParams.set('reason', reason);
        unauthorizedUrl.searchParams.set('redirect', pathname);
        return NextResponse.redirect(unauthorizedUrl);
      })();

  response.cookies.delete('auth-token');
  return response;
}

/**
 * Configuración del middleware
 * Define qué rutas deben ser protegidas
 */
export const config = {
  matcher: [
    // Banco de pruebas de diseño: 404 duro en producción (ver arriba)
    '/diseno',
    '/diseno/:path*',
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
    '/api/profile/:path*',
    '/api/recruiter/:path*',
    '/api/specialist/:path*',
    '/api/evaluations/:path*',
    '/api/interview-requests/:path*',
    '/api/credits/:path*',
    '/api/vendor/:path*',
    '/api/notifications',
    '/api/notifications/:path*',
    '/admin/:path*',
    '/create-job',
    '/credits/:path*',
    '/applications/:path*',
    '/company/:path*',
    '/my-applications',
    '/candidate/:path*',
    '/recruiter/:path*',
    '/specialist/:path*',
    '/vendor/:path*',
    '/notifications',
    '/profile'
  ],
  runtime: 'nodejs'
};
