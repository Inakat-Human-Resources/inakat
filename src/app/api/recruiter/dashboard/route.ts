// RUTA: src/app/api/recruiter/dashboard/route.ts

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyToken } from '@/lib/auth';
import { cookies } from 'next/headers';

// Verificar que es reclutador
async function verifyRecruiter() {
  const cookieStore = await cookies();
  const token = cookieStore.get('auth-token')?.value;

  if (!token) {
    return { error: 'No autenticado', status: 401 };
  }

  const payload = verifyToken(token);
  if (!payload?.userId) {
    return { error: 'Token inválido', status: 401 };
  }

  const user = await prisma.user.findUnique({
    where: { id: payload.userId }
  });

  if (!user || (user.role !== 'recruiter' && user.role !== 'admin')) {
    return { error: 'Acceso denegado - Solo reclutadores', status: 403 };
  }

  return { user };
}

/**
 * GET /api/recruiter/dashboard
 * Obtener vacantes asignadas al reclutador
 */
export async function GET(request: Request) {
  try {
    const auth = await verifyRecruiter();
    if ('error' in auth) {
      return NextResponse.json(
        { success: false, error: auth.error },
        { status: auth.status }
      );
    }

    const { user } = auth;
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');

    // Obtener asignaciones del reclutador
    const whereClause: any = {
      recruiterId: user.id
    };

    if (status && status !== 'all') {
      whereClause.recruiterStatus = status;
    }

    const assignments = await prisma.jobAssignment.findMany({
      where: whereClause,
      include: {
        job: {
          include: {
            user: {
              select: {
                nombre: true,
                companyRequest: {
                  select: {
                    nombreEmpresa: true,
                    correoEmpresa: true
                  }
                }
              }
            }
          }
        },
        specialist: {
          select: {
            id: true,
            nombre: true,
            apellidoPaterno: true,
            email: true,
            specialty: true
          }
        }
      },
      orderBy: { assignedAt: 'desc' }
    });

    // Obtener candidatos de la base de datos (para asignar a vacantes)
    const candidates = await prisma.candidate.findMany({
      where: { status: 'active' },
      include: {
        experiences: {
          orderBy: { fechaInicio: 'desc' },
          take: 3
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    // Estadísticas
    const allAssignments = await prisma.jobAssignment.findMany({
      where: { recruiterId: user.id }
    });

    const stats = {
      total: allAssignments.length,
      pending: allAssignments.filter((a) => a.recruiterStatus === 'pending')
        .length,
      reviewing: allAssignments.filter((a) => a.recruiterStatus === 'reviewing')
        .length,
      sentToSpecialist: allAssignments.filter(
        (a) => a.recruiterStatus === 'sent_to_specialist'
      ).length
    };

    return NextResponse.json({
      success: true,
      data: {
        assignments,
        candidates,
        stats,
        recruiter: {
          id: user.id,
          nombre: user.nombre,
          email: user.email
        }
      }
    });
  } catch (error) {
    console.error('Error fetching recruiter dashboard:', error);
    return NextResponse.json(
      { success: false, error: 'Error al obtener dashboard' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/recruiter/dashboard
 * Actualizar estado de asignación (reclutador)
 */
export async function PUT(request: Request) {
  try {
    const auth = await verifyRecruiter();
    if ('error' in auth) {
      return NextResponse.json(
        { success: false, error: auth.error },
        { status: auth.status }
      );
    }

    const { user } = auth;
    const body = await request.json();
    const { assignmentId, status, notes, candidateIds } = body;

    if (!assignmentId) {
      return NextResponse.json(
        { success: false, error: 'Se requiere el ID de la asignación' },
        { status: 400 }
      );
    }

    // Verificar que la asignación pertenece al reclutador
    const assignment = await prisma.jobAssignment.findUnique({
      where: { id: assignmentId }
    });

    if (!assignment) {
      return NextResponse.json(
        { success: false, error: 'Asignación no encontrada' },
        { status: 404 }
      );
    }

    if (assignment.recruiterId !== user.id && user.role !== 'admin') {
      return NextResponse.json(
        {
          success: false,
          error: 'No tienes permiso para modificar esta asignación'
        },
        { status: 403 }
      );
    }

    // Preparar datos de actualización
    const updateData: any = {};

    if (status) {
      updateData.recruiterStatus = status;

      // Si envía al especialista, actualizar estado del especialista también
      if (status === 'sent_to_specialist') {
        updateData.specialistStatus = 'pending';
      }
    }

    if (notes !== undefined) {
      updateData.recruiterNotes = notes;
    }

    if (candidateIds) {
      updateData.candidatesSentToSpecialist = candidateIds.join(',');
    }

    const updated = await prisma.jobAssignment.update({
      where: { id: assignmentId },
      data: updateData,
      include: {
        job: true,
        specialist: {
          select: { id: true, nombre: true, email: true }
        }
      }
    });

    return NextResponse.json({
      success: true,
      message: 'Asignación actualizada',
      data: updated
    });
  } catch (error) {
    console.error('Error updating assignment:', error);
    return NextResponse.json(
      { success: false, error: 'Error al actualizar asignación' },
      { status: 500 }
    );
  }
}
