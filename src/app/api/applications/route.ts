// RUTA: src/app/api/applications/route.ts

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { applyRateLimit, APPLICATION_RATE_LIMIT } from '@/lib/rate-limit';
import { notifyAllAdmins, runAfterResponse } from '@/lib/notifications';
import { getOptionalAuthUser } from '@/lib/auth';
import { isSafeHttpUrl } from '@/lib/sanitize';
import { getPaginationParams, buildPaginatedResponse, parseId } from '@/lib/pagination';

/** Topes de longitud de lo que llega del formulario público. */
const MAX_NOMBRE = 200;
const MAX_EMAIL = 320;
const MAX_TELEFONO = 50;
const MAX_CV_URL = 2000;
const MAX_CARTA = 5000;

/** Comprobación de formato de correo, deliberadamente laxa pero no vacía. */
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// GET - Listar aplicaciones (filtradas por job o por usuario admin)
// (el middleware restringe /api/applications/* a rol admin)
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const jobId = searchParams.get('jobId');
    const status = searchParams.get('status');
    const candidateEmail = searchParams.get('candidateEmail');

    const where: any = {};

    if (jobId) {
      // `parseInt('abc')` es NaN y Prisma lanzaba: 500 genérico en vez de 400.
      const id = parseId(jobId);
      if (id === null) {
        return NextResponse.json(
          { success: false, error: 'jobId inválido' },
          { status: 400 }
        );
      }
      where.jobId = id;
    }

    if (status) {
      where.status = status;
    }

    if (candidateEmail) {
      where.candidateEmail = candidateEmail.trim().toLowerCase();
    }

    // RENDIMIENTO (#VAC): el listado no tenía take/skip y arrastraba coverLetter
    // y notes (ambos @db.Text) más dos joins. Con decenas de miles de
    // postulaciones la respuesta supera el límite de 4.5 MB de Vercel y la
    // llamada falla entera. Ahora hay tope duro (y `pagination` en la respuesta
    // para que el cliente pueda recorrer el resto).
    const pagination = getPaginationParams(searchParams, 500, 1000);

    const [applications, total] = await Promise.all([
      prisma.application.findMany({
        where,
        include: {
          job: {
            select: {
              id: true,
              title: true,
              company: true,
              location: true,
              salary: true
            }
          },
          user: {
            select: {
              id: true,
              nombre: true,
              email: true
            }
          }
        },
        orderBy: {
          createdAt: 'desc'
        },
        skip: pagination.skip,
        take: pagination.take
      }),
      prisma.application.count({ where })
    ]);

    const response = buildPaginatedResponse(applications, total, pagination);

    return NextResponse.json({
      success: true,
      ...response,
      count: applications.length,
      total
    });
  } catch (error) {
    console.error('Error fetching applications:', error);
    return NextResponse.json(
      { success: false, error: 'Error al obtener las aplicaciones. Intenta de nuevo.' },
      { status: 500 }
    );
  }
}

// POST - Crear nueva aplicación
export async function POST(request: Request) {
  try {
    // Rate limiting: 10 aplicaciones por hora por IP
    const rateLimited = applyRateLimit(request, 'application', APPLICATION_RATE_LIMIT);
    if (rateLimited) return rateLimited;

    const body = await request.json();
    const {
      jobId: jobIdRaw,
      candidateName: nombreBody,
      candidateEmail: emailBody,
      candidatePhone,
      cvUrl,
      coverLetter
    } = body;

    // SEGURIDAD (#48): NUNCA confiar en body.userId (permitiría suplantar a otro usuario).
    // Si hay sesión válida, la aplicación se asocia al id de la sesión; si no, queda anónima (null).
    //
    // SUPLANTACIÓN (#VAC): el arreglo #48 dejó de confiar en body.userId, pero
    // `candidateName` y `candidateEmail` seguían viniendo del body AUNQUE
    // hubiera sesión. Como la unicidad de una postulación se controla por
    // (jobId, candidateEmail), quien llegara primero con el correo de otra
    // persona le ocupaba el sitio: el rival real recibía "ya aplicaste", la
    // postulación falsa aparecía en su /my-applications y el reclutador veía un
    // CV que no era suyo. Con sesión, nombre y correo salen de la sesión.
    const authUser = await getOptionalAuthUser();

    let sessionUserId: number | null = null;
    let candidateName: string;
    let candidateEmail: string;

    if (authUser) {
      if (authUser.role !== 'candidate' && authUser.role !== 'user') {
        return NextResponse.json(
          {
            success: false,
            error: 'Esta sesión no puede postularse a vacantes. Inicia sesión con tu cuenta de candidato.'
          },
          { status: 403 }
        );
      }

      sessionUserId = authUser.id;
      candidateEmail = authUser.email.trim().toLowerCase();
      candidateName =
        [authUser.nombre, authUser.apellidoPaterno, authUser.apellidoMaterno]
          .filter(Boolean)
          .join(' ')
          .trim() || authUser.nombre;
    } else {
      if (typeof nombreBody !== 'string' || typeof emailBody !== 'string') {
        return NextResponse.json(
          {
            success: false,
            error:
              'Faltan campos requeridos: jobId, candidateName, candidateEmail'
          },
          { status: 400 }
        );
      }
      candidateName = nombreBody.trim();
      candidateEmail = emailBody.trim().toLowerCase();
    }

    const jobId = parseId(jobIdRaw);

    // Validaciones básicas
    if (jobId === null || !candidateName || !candidateEmail) {
      return NextResponse.json(
        {
          success: false,
          error:
            'Faltan campos requeridos: jobId, candidateName, candidateEmail'
        },
        { status: 400 }
      );
    }

    if (!EMAIL_RE.test(candidateEmail) || candidateEmail.length > MAX_EMAIL) {
      return NextResponse.json(
        { success: false, error: 'El correo no tiene un formato válido' },
        { status: 400 }
      );
    }

    if (candidateName.length > MAX_NOMBRE) {
      return NextResponse.json(
        { success: false, error: `El nombre no puede superar ${MAX_NOMBRE} caracteres` },
        { status: 400 }
      );
    }

    if (candidatePhone !== undefined && candidatePhone !== null && candidatePhone !== '') {
      if (typeof candidatePhone !== 'string' || candidatePhone.length > MAX_TELEFONO) {
        return NextResponse.json(
          { success: false, error: 'El teléfono no es válido' },
          { status: 400 }
        );
      }
    }

    if (coverLetter !== undefined && coverLetter !== null && coverLetter !== '') {
      if (typeof coverLetter !== 'string' || coverLetter.length > MAX_CARTA) {
        return NextResponse.json(
          { success: false, error: `La carta de presentación no puede superar ${MAX_CARTA} caracteres` },
          { status: 400 }
        );
      }
    }

    // XSS ALMACENADO (#VAC): el CV se guardaba tal cual y varias vistas de admin
    // lo pintan como `href={app.cvUrl}` directo. `javascript:...` o
    // `data:text/html,...` desde un POST anónimo se convertían en un enlace que
    // el admin acaba pulsando. Sólo se acepta una URL http(s) absoluta.
    if (cvUrl !== undefined && cvUrl !== null && cvUrl !== '') {
      if (typeof cvUrl !== 'string' || cvUrl.length > MAX_CV_URL || !isSafeHttpUrl(cvUrl)) {
        return NextResponse.json(
          { success: false, error: 'La URL del CV no es válida (debe ser un enlace http o https)' },
          { status: 400 }
        );
      }
    }

    // Verificar que la vacante existe
    const job = await prisma.job.findUnique({
      where: { id: jobId }
    });

    if (!job) {
      return NextResponse.json(
        { success: false, error: 'Vacante no encontrada' },
        { status: 404 }
      );
    }

    // Verificar que la vacante esté activa y no haya expirado.
    // (La expiración se filtraba en el listado pero nadie la comprobaba aquí:
    // se podía postular a una vacante vencida conociendo su id.)
    if (job.status !== 'active' || (job.expiresAt && job.expiresAt <= new Date())) {
      return NextResponse.json(
        { success: false, error: 'Esta vacante ya no está activa' },
        { status: 400 }
      );
    }

    // Verificar si ya aplicó antes. Con sesión se mira también por userId: la
    // postulación pudo quedar registrada con otro correo (p. ej. el admin editó
    // el email del candidato después).
    const existingApplication = await prisma.application.findFirst({
      where: {
        jobId,
        ...(sessionUserId !== null
          ? { OR: [{ candidateEmail }, { userId: sessionUserId }] }
          : { candidateEmail })
      }
    });

    if (existingApplication) {
      // 409 (no 400): es un conflicto con un recurso existente, y es lo que el
      // modal de postulación ya distinguía como "ya te postulaste".
      return NextResponse.json(
        {
          success: false,
          error: 'Ya has aplicado a esta vacante anteriormente'
        },
        { status: 409 }
      );
    }

    // Crear aplicación
    let application;
    try {
      application = await prisma.application.create({
        data: {
          jobId,
          userId: sessionUserId,
          candidateName,
          candidateEmail,
          candidatePhone: candidatePhone || null,
          cvUrl: cvUrl || null,
          coverLetter: coverLetter || null,
          status: 'pending'
        },
        include: {
          job: {
            select: {
              title: true,
              company: true
            }
          }
        }
      });
    } catch (e: unknown) {
      // CONCURRENCIA (#VAC): el "¿ya existe?" y el create no son atómicos, así
      // que un doble clic (o el admin inyectando al candidato en el mismo
      // instante) cuela dos postulaciones. En cuanto exista el índice
      // @@unique([jobId, candidateEmail]) la segunda falla con P2002 y aquí se
      // traduce al mismo 409 que el camino normal.
      if (typeof e === 'object' && e !== null && (e as { code?: string }).code === 'P2002') {
        return NextResponse.json(
          { success: false, error: 'Ya has aplicado a esta vacante anteriormente' },
          { status: 409 }
        );
      }
      throw e;
    }

    // FIABILIDAD (#VAC): antes era un fire-and-forget suelto. En Vercel la
    // función puede congelarse en cuanto sale la respuesta, así que la
    // notificación se perdía a mitad. `after` la ejecuta con la respuesta ya
    // enviada pero con la lambda viva.
    const jobTitle = application.job.title;
    const applicationId = application.id;
    // EMP-009/EMP-013: sin `.catch(() => {})`: runAfterResponse registra el error.
    await runAfterResponse('NOTIF:new_application', () =>
      notifyAllAdmins({
        type: 'new_application',
        title: 'Nueva aplicación recibida',
        message: `${candidateName} aplicó a "${jobTitle}".`,
        link: '/admin',
        metadata: { applicationId, jobId, candidateName },
      })
    );

    return NextResponse.json(
      {
        success: true,
        message: 'Aplicación enviada exitosamente',
        data: application
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Error creating application:', error);
    return NextResponse.json(
      { success: false, error: 'Error al crear la aplicación. Intenta de nuevo.' },
      { status: 500 }
    );
  }
}
