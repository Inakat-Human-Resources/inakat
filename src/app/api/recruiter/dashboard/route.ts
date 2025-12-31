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
            },
            applications: {
              where: {
                // Mostrar candidatos que NO han sido enviados al especialista ni descartados
                // pending = recién aplicó, reviewing = en revisión por reclutador
                // injected_by_admin = candidato inyectado por admin
                // Excluir: sent_to_specialist, sent_to_company, discarded, archived
                status: { in: ['pending', 'reviewing', 'injected_by_admin'] }
              },
              orderBy: { createdAt: 'desc' }
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

    // Enriquecer applications con datos del Candidate (si existe en el banco)
    const enrichedAssignments = await Promise.all(
      assignments.map(async (assignment) => {
        const enrichedApplications = await Promise.all(
          assignment.job.applications.map(async (app) => {
            // Buscar si hay un Candidate con este email
            const candidateFromBank = await prisma.candidate.findFirst({
              where: { email: { equals: app.candidateEmail, mode: 'insensitive' } },
              select: {
                id: true,
                universidad: true,
                carrera: true,
                nivelEstudios: true,
                añosExperiencia: true,
                profile: true,
                seniority: true,
                linkedinUrl: true,
                portafolioUrl: true,
                cvUrl: true,
                telefono: true,
                sexo: true,
                fechaNacimiento: true,
                source: true,
                notas: true,
                experiences: {
                  orderBy: { fechaInicio: 'desc' },
                  take: 5
                }
              }
            });

            return {
              ...app,
              candidateProfile: candidateFromBank
            };
          })
        );

        return {
          ...assignment,
          job: {
            ...assignment.job,
            applications: enrichedApplications
          }
        };
      })
    );

    // Obtener candidatos de la base de datos (para asignar a vacantes)
    // Mostrar candidatos que NO están en estados finales
    // Esto permite ver candidatos pendientes incluso después de enviar algunos
    const candidates = await prisma.candidate.findMany({
      where: {
        status: {
          notIn: ['sent_to_specialist', 'sent_to_company', 'discarded', 'rejected', 'accepted', 'archived']
        }
      },
      include: {
        experiences: {
          orderBy: { fechaInicio: 'desc' },
          take: 5
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
        assignments: enrichedAssignments,
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

      // Verificar que el reclutador tiene asignación a este job
      const hasAssignment = await prisma.jobAssignment.findFirst({
        where: { jobId: application.jobId, recruiterId: user.id }
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

      // Si hay razón, guardarla en las notas del reclutador
      if (discardReason && hasAssignment) {
        const currentNotes = hasAssignment.recruiterNotes || '';
        const newNote = `[DESCARTADO: ${application.candidateName}] ${discardReason}`;
        await prisma.jobAssignment.update({
          where: { id: hasAssignment.id },
          data: {
            recruiterNotes: currentNotes ? `${currentNotes}\n${newNote}` : newNote
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
      // Validar que hay especialista asignado antes de enviar
      if (status === 'sent_to_specialist' && !assignment.specialistId) {
        return NextResponse.json(
          { success: false, error: 'No hay especialista asignado a esta vacante. Solicita al admin que asigne uno.' },
          { status: 400 }
        );
      }

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

    // Si envía candidatos al especialista
    if (candidateIds && candidateIds.length > 0) {
      // Obtener datos de los candidatos seleccionados
      const selectedCandidates = await prisma.candidate.findMany({
        where: { id: { in: candidateIds } },
        select: { id: true, email: true, nombre: true, apellidoPaterno: true }
      });

      // Para cada candidato seleccionado, crear Application o actualizar a sent_to_specialist
      for (const candidate of selectedCandidates) {
        const candidateEmail = candidate.email.toLowerCase();

        // Buscar si ya existe la Application
        const existingApp = await prisma.application.findFirst({
          where: {
            jobId: assignment.jobId,
            candidateEmail: candidateEmail
          }
        });

        if (!existingApp) {
          // Crear Application para candidato del banco
          await prisma.application.create({
            data: {
              jobId: assignment.jobId,
              candidateEmail: candidateEmail,
              candidateName: `${candidate.nombre} ${candidate.apellidoPaterno || ''}`.trim(),
              status: 'sent_to_specialist'
            }
          });
        } else if (existingApp.status !== 'sent_to_specialist' && existingApp.status !== 'sent_to_company') {
          // Solo actualizar si no ha sido enviado ya
          await prisma.application.update({
            where: { id: existingApp.id },
            data: {
              status: 'sent_to_specialist',
              updatedAt: new Date()
            }
          });
        }
      }

      // IMPORTANTE: Actualizar candidatos enviados previamente para concatenar, no reemplazar
      const previouslySent = assignment.candidatesSentToSpecialist || '';
      const previousIds = previouslySent ? previouslySent.split(',').map(id => parseInt(id)).filter(id => !isNaN(id)) : [];
      const allSentIds = [...new Set([...previousIds, ...candidateIds])]; // Combinar sin duplicados

      await prisma.jobAssignment.update({
        where: { id: assignmentId },
        data: {
          candidatesSentToSpecialist: allSentIds.join(','),
          // Solo cambiar a sent_to_specialist si se especificó el status
          ...(status === 'sent_to_specialist' ? { recruiterStatus: 'sent_to_specialist', specialistStatus: 'pending' } : {})
        }
      });
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
