// RUTA: src/app/api/interview-requests/[id]/route.ts

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/auth';
import { parseId } from '@/lib/authz-applications';

/**
 * GET /api/interview-requests/[id]
 * Obtener detalle de una solicitud de entrevista
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Rol e isActive se leen de la base, no de los headers que el middleware
    // rellena desde el JWT: un usuario desactivado seguía entrando con la
    // misma cookie durante los 7 días de vida del token.
    const auth = await requireRole(['admin', 'recruiter', 'specialist', 'company']);
    if ('error' in auth) {
      return NextResponse.json(
        { success: false, error: auth.error },
        { status: auth.status }
      );
    }

    const { user } = auth;
    const userRole = user.role;

    const requestId = parseId(id);

    if (requestId === null) {
      return NextResponse.json(
        { success: false, error: 'ID inválido' },
        { status: 400 }
      );
    }

    const interviewRequest = await prisma.interviewRequest.findUnique({
      where: { id: requestId },
      include: {
        application: {
          select: {
            id: true,
            candidateName: true,
            candidateEmail: true,
            candidatePhone: true,
            status: true,
            job: {
              select: {
                id: true,
                title: true,
                company: true,
                userId: true,
                assignment: {
                  select: { recruiterId: true, specialistId: true }
                }
              }
            }
          }
        },
        requestedBy: {
          select: { id: true, nombre: true, email: true }
        }
      }
    });

    if (!interviewRequest) {
      return NextResponse.json(
        { success: false, error: 'Solicitud no encontrada' },
        { status: 404 }
      );
    }

    // Autorización: dueño de la solicitud (requestedById), admin, o
    // recruiter/specialist asignado a la job. Evita fuga de PII del candidato.
    const assignment = interviewRequest.application?.job?.assignment;
    const authorized =
      userRole === 'admin' ||
      interviewRequest.requestedById === user.id ||
      (userRole === 'recruiter' && assignment?.recruiterId === user.id) ||
      (userRole === 'specialist' && assignment?.specialistId === user.id);

    if (!authorized) {
      return NextResponse.json(
        { success: false, error: 'No autorizado para esta solicitud' },
        { status: 403 }
      );
    }

    // SEGURIDAD: userId del dueño y los IDs de staff (recruiter/specialist) se
    // añadieron al select sólo para autorizar; no deben salir en la respuesta.
    // PRIVACIDAD: `adminNotes` son, según el esquema, «Notas internas del
    // admin», y confirmedById identifica al staff que confirmó: el `...rest`
    // se los entregaba enteros a la empresa solicitante.
    const { application, adminNotes, confirmedById, ...rest } = interviewRequest;
    const interviewFields = userRole === 'company'
      ? rest
      : { ...rest, adminNotes, confirmedById };

    const safeData = {
      ...interviewFields,
      application: application
        ? {
            ...application,
            job: application.job
              ? {
                  id: application.job.id,
                  title: application.job.title,
                  company: application.job.company,
                }
              : application.job,
          }
        : application,
    };

    return NextResponse.json({ success: true, data: safeData });
  } catch (error) {
    console.error('Error obteniendo solicitud de entrevista:', error);
    return NextResponse.json(
      { success: false, error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}

// NOTA: aquí vivía un PATCH paralelo de confirmación/rechazo que no llamaba
// ninguna página (la UI confirma por /api/admin/interviews/[id]). Guardaba
// `confirmedSlot` pero no derivaba scheduledStart/End ni tocaba la Application,
// y tanto /admin/interviews como /company/interviews exigen scheduledStart para
// las pestañas Agendadas/Pasadas: una entrevista confirmada por esta vía salía
// de Pendientes y no reaparecía en ninguna pestaña. Se elimina en lugar de
// duplicar la lógica del admin.
