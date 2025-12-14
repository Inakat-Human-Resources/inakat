// RUTA: src/app/api/specialist/dashboard/route.ts

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyToken } from '@/lib/auth';
import { cookies } from 'next/headers';

// Verificar que es especialista
async function verifySpecialist() {
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

  if (!user || (user.role !== 'specialist' && user.role !== 'admin')) {
    return { error: 'Acceso denegado - Solo especialistas', status: 403 };
  }

  return { user };
}

/**
 * GET /api/specialist/dashboard
 * Obtener vacantes asignadas al especialista
 */
export async function GET(request: Request) {
  try {
    const auth = await verifySpecialist();
    if ('error' in auth) {
      return NextResponse.json(
        { success: false, error: auth.error },
        { status: auth.status }
      );
    }

    const { user } = auth;
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');

    // Obtener asignaciones del especialista
    const whereClause: any = {
      specialistId: user.id,
      // Solo mostrar las que ya pasaron por el reclutador
      recruiterStatus: 'sent_to_specialist'
    };

    if (status && status !== 'all') {
      whereClause.specialistStatus = status;
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
            },
            applications: {
              where: {
                status: { in: ['sent_to_specialist', 'evaluating'] }
              },
              orderBy: { createdAt: 'desc' }
            }
          }
        },
        recruiter: {
          select: {
            id: true,
            nombre: true,
            apellidoPaterno: true,
            email: true
          }
        }
      },
      orderBy: { updatedAt: 'desc' }
    });

    // Para cada asignación, obtener los candidatos enviados
    const assignmentsWithCandidates = await Promise.all(
      assignments.map(async (assignment) => {
        let candidates: any[] = [];

        if (assignment.candidatesSentToSpecialist) {
          const candidateIds = assignment.candidatesSentToSpecialist
            .split(',')
            .map((id) => parseInt(id))
            .filter((id) => !isNaN(id));

          if (candidateIds.length > 0) {
            candidates = await prisma.candidate.findMany({
              where: { id: { in: candidateIds } },
              include: {
                experiences: {
                  orderBy: { fechaInicio: 'desc' },
                  take: 3
                }
              }
            });
          }
        }

        return {
          ...assignment,
          candidates,
          applications: assignment.job.applications || []
        };
      })
    );

    // Estadísticas
    const allAssignments = await prisma.jobAssignment.findMany({
      where: {
        specialistId: user.id,
        recruiterStatus: 'sent_to_specialist'
      }
    });

    const stats = {
      total: allAssignments.length,
      pending: allAssignments.filter((a) => a.specialistStatus === 'pending')
        .length,
      evaluating: allAssignments.filter(
        (a) => a.specialistStatus === 'evaluating'
      ).length,
      sentToCompany: allAssignments.filter(
        (a) => a.specialistStatus === 'sent_to_company'
      ).length
    };

    return NextResponse.json({
      success: true,
      data: {
        assignments: assignmentsWithCandidates,
        stats,
        specialist: {
          id: user.id,
          nombre: user.nombre,
          email: user.email,
          specialty: user.specialty
        }
      }
    });
  } catch (error) {
    console.error('Error fetching specialist dashboard:', error);
    return NextResponse.json(
      { success: false, error: 'Error al obtener dashboard' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/specialist/dashboard
 * Actualizar estado de asignación (especialista)
 */
export async function PUT(request: Request) {
  try {
    const auth = await verifySpecialist();
    if ('error' in auth) {
      return NextResponse.json(
        { success: false, error: auth.error },
        { status: auth.status }
      );
    }

    const { user } = auth;
    const body = await request.json();
    const { assignmentId, status, notes, candidateIds, discardApplicationId, discardReason } = body;

    // Acción: Descartar candidato individual
    if (discardApplicationId) {
      const application = await prisma.application.findUnique({
        where: { id: discardApplicationId },
        include: { job: true }
      });

      if (!application) {
        return NextResponse.json(
          { success: false, error: 'Aplicación no encontrada' },
          { status: 404 }
        );
      }

      // Verificar que el especialista tiene asignación a este job
      const hasAssignment = await prisma.jobAssignment.findFirst({
        where: { jobId: application.jobId, specialistId: user.id }
      });

      if (!hasAssignment && user.role !== 'admin') {
        return NextResponse.json(
          { success: false, error: 'No tienes permiso para descartar este candidato' },
          { status: 403 }
        );
      }

      // Actualizar Application a discarded
      const discardedApp = await prisma.application.update({
        where: { id: discardApplicationId },
        data: {
          status: 'discarded',
          updatedAt: new Date()
        }
      });

      // Si hay razón, guardarla en las notas del especialista
      if (discardReason && hasAssignment) {
        const currentNotes = hasAssignment.specialistNotes || '';
        const newNote = `[DESCARTADO: ${application.candidateName}] ${discardReason}`;
        await prisma.jobAssignment.update({
          where: { id: hasAssignment.id },
          data: {
            specialistNotes: currentNotes ? `${currentNotes}\n${newNote}` : newNote
          }
        });
      }

      return NextResponse.json({
        success: true,
        message: 'Candidato descartado',
        data: discardedApp
      });
    }

    if (!assignmentId) {
      return NextResponse.json(
        { success: false, error: 'Se requiere el ID de la asignación' },
        { status: 400 }
      );
    }

    // Verificar que la asignación pertenece al especialista
    const assignment = await prisma.jobAssignment.findUnique({
      where: { id: assignmentId }
    });

    if (!assignment) {
      return NextResponse.json(
        { success: false, error: 'Asignación no encontrada' },
        { status: 404 }
      );
    }

    if (assignment.specialistId !== user.id && user.role !== 'admin') {
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
      updateData.specialistStatus = status;

      // Si envía a la empresa, calcular fecha de seguimiento (45 días)
      if (status === 'sent_to_company') {
        const followUpDate = new Date();
        followUpDate.setDate(followUpDate.getDate() + 45);
        updateData.followUpDate = followUpDate;
      }
    }

    if (notes !== undefined) {
      updateData.specialistNotes = notes;
    }

    if (candidateIds) {
      updateData.candidatesSentToCompany = candidateIds.join(',');
    }

    const updated = await prisma.jobAssignment.update({
      where: { id: assignmentId },
      data: updateData,
      include: {
        job: {
          include: {
            user: {
              select: {
                nombre: true,
                email: true,
                companyRequest: {
                  select: { nombreEmpresa: true }
                }
              }
            }
          }
        },
        recruiter: {
          select: { id: true, nombre: true, email: true }
        }
      }
    });

    // Si envía a la empresa, actualizar también el status de las Applications
    if (status === 'sent_to_company' && candidateIds && candidateIds.length > 0) {
      // Obtener emails de los candidatos seleccionados
      const selectedCandidates = await prisma.candidate.findMany({
        where: { id: { in: candidateIds } },
        select: { email: true }
      });

      const candidateEmails = selectedCandidates.map((c) => c.email.toLowerCase());

      if (candidateEmails.length > 0) {
        // Actualizar Applications para que la empresa las vea
        await prisma.application.updateMany({
          where: {
            jobId: assignment.jobId,
            candidateEmail: { in: candidateEmails }
          },
          data: {
            status: 'sent_to_company',
            updatedAt: new Date()
          }
        });
      }
    }

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
