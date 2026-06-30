// RUTA: src/app/api/interview-requests/[id]/route.ts

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

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
    const userId = request.headers.get('x-user-id');
    const userRole = request.headers.get('x-user-role');

    if (!userId || !userRole) {
      return NextResponse.json(
        { success: false, error: 'No autenticado' },
        { status: 401 }
      );
    }

    if (!['admin', 'recruiter', 'specialist', 'company'].includes(userRole)) {
      return NextResponse.json(
        { success: false, error: 'No autorizado' },
        { status: 403 }
      );
    }

    const interviewRequest = await prisma.interviewRequest.findUnique({
      where: { id: parseInt(id) },
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
    const parsedUserId = parseInt(userId);
    const assignment = interviewRequest.application?.job?.assignment;
    const authorized =
      userRole === 'admin' ||
      interviewRequest.requestedById === parsedUserId ||
      (userRole === 'recruiter' && assignment?.recruiterId === parsedUserId) ||
      (userRole === 'specialist' && assignment?.specialistId === parsedUserId);

    if (!authorized) {
      return NextResponse.json(
        { success: false, error: 'No autorizado para esta solicitud' },
        { status: 403 }
      );
    }

    // SEGURIDAD: userId del dueño y los IDs de staff (recruiter/specialist) se
    // añadieron al select sólo para autorizar; no deben salir en la respuesta.
    const { application, ...rest } = interviewRequest;
    const safeData = {
      ...rest,
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

/**
 * PATCH /api/interview-requests/[id]
 * Confirmar/rechazar solicitud (recruiter o admin)
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const userId = request.headers.get('x-user-id');
    const userRole = request.headers.get('x-user-role');

    if (!userId || !userRole) {
      return NextResponse.json(
        { success: false, error: 'No autenticado' },
        { status: 401 }
      );
    }

    if (!['admin', 'recruiter'].includes(userRole)) {
      return NextResponse.json(
        { success: false, error: 'Solo admin o recruiter pueden confirmar/rechazar' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { status, confirmedSlot } = body;

    if (!status || !['confirmed', 'rejected', 'cancelled'].includes(status)) {
      return NextResponse.json(
        { success: false, error: 'Status debe ser "confirmed", "rejected" o "cancelled"' },
        { status: 400 }
      );
    }

    const existing = await prisma.interviewRequest.findUnique({
      where: { id: parseInt(id) },
      include: {
        application: {
          select: {
            job: {
              select: {
                assignment: { select: { recruiterId: true } }
              }
            }
          }
        }
      }
    });

    if (!existing) {
      return NextResponse.json(
        { success: false, error: 'Solicitud no encontrada' },
        { status: 404 }
      );
    }

    // Autorización: admin, o el recruiter asignado a la job de la solicitud.
    const recruiterId = existing.application?.job?.assignment?.recruiterId;
    const authorized =
      userRole === 'admin' ||
      (userRole === 'recruiter' && recruiterId === parseInt(userId));

    if (!authorized) {
      return NextResponse.json(
        { success: false, error: 'No autorizado para esta solicitud' },
        { status: 403 }
      );
    }

    if (existing.status !== 'pending') {
      return NextResponse.json(
        { success: false, error: 'Solo se pueden modificar solicitudes pendientes' },
        { status: 400 }
      );
    }

    if (status === 'confirmed' && !confirmedSlot) {
      return NextResponse.json(
        { success: false, error: 'Debes seleccionar un horario para confirmar' },
        { status: 400 }
      );
    }

    const updated = await prisma.interviewRequest.update({
      where: { id: parseInt(id) },
      data: {
        status,
        confirmedSlot: confirmedSlot ? JSON.stringify(confirmedSlot) : null,
        confirmedAt: status === 'confirmed' ? new Date() : null,
        confirmedById: status === 'confirmed' ? parseInt(userId) : null,
      }
    });

    const statusMessages: Record<string, string> = {
      confirmed: 'Entrevista confirmada',
      rejected: 'Solicitud rechazada',
      cancelled: 'Solicitud cancelada'
    };

    return NextResponse.json({
      success: true,
      data: updated,
      message: statusMessages[status]
    });
  } catch (error) {
    console.error('Error actualizando solicitud de entrevista:', error);
    return NextResponse.json(
      { success: false, error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
