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
 *
 * OPTIMIZADO: Eliminadas queries N+1, usa batch queries
 */
export async function GET(request: Request) {
  const startTime = Date.now();

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
    const whereClause: Record<string, unknown> = {
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

    // =========================================================================
    // OPTIMIZACIÓN: Batch query para todos los candidatos
    // En lugar de N*M queries (por cada assignment, por cada application),
    // hacemos 1 sola query con todos los emails únicos
    // =========================================================================

    // Recolectar TODOS los emails de TODAS las applications
    const allEmails: string[] = [];
    for (const assignment of assignments) {
      for (const app of assignment.job.applications) {
        allEmails.push(app.candidateEmail.toLowerCase());
      }
    }
    const uniqueEmails = [...new Set(allEmails)];

    // Una sola query para obtener TODOS los candidatos
    const candidatesFromBank = uniqueEmails.length > 0
      ? await prisma.candidate.findMany({
          where: {
            email: { in: uniqueEmails, mode: 'insensitive' }
          },
          select: {
            id: true,
            email: true,
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
            educacion: true, // FEATURE: Educación múltiple
            fotoUrl: true, // FEAT-2: Foto de perfil
            experiences: {
              orderBy: { fechaInicio: 'desc' }
            },
            documents: {
              orderBy: { createdAt: 'desc' }
            }
          }
        })
      : [];

    // Crear mapa para acceso O(1)
    const candidateMap = new Map(
      candidatesFromBank.map(c => [c.email.toLowerCase(), c])
    );

    // Enriquecer assignments SIN queries adicionales
    const enrichedAssignments = assignments.map((assignment) => {
      const enrichedApplications = assignment.job.applications.map((app) => ({
        ...app,
        candidateProfile: candidateMap.get(app.candidateEmail.toLowerCase()) || null
      }));

      return {
        ...assignment,
        job: {
          ...assignment.job,
          applications: enrichedApplications
        }
      };
    });

    // Estadísticas basadas en applications
    let pendingCount = 0;
    let reviewingCount = 0;
    let sentToSpecialistCount = 0;
    let evaluatingCount = 0;
    let sentToCompanyCount = 0;
    let hiredCount = 0;
    let rejectedCount = 0;
    let discardedCount = 0;

    // Recolectar aplicaciones enviadas (para el tab "Enviados")
    const sentApplications: Array<{
      id: number;
      candidateName: string;
      candidateEmail: string;
      status: string;
      jobId: number;
      jobTitle: string;
      company: string;
      updatedAt: Date;
      candidateProfile: unknown;
    }> = [];

    for (const assignment of enrichedAssignments) {
      for (const app of assignment.job.applications) {
        if (app.status === 'pending' || app.status === 'injected_by_admin') {
          pendingCount++;
        } else if (app.status === 'reviewing') {
          reviewingCount++;
        } else if (app.status === 'sent_to_specialist') {
          sentToSpecialistCount++;
          sentApplications.push({
            id: app.id,
            candidateName: app.candidateName,
            candidateEmail: app.candidateEmail,
            status: app.status,
            jobId: assignment.job.id,
            jobTitle: assignment.job.title,
            company: assignment.job.user?.companyRequest?.nombreEmpresa || assignment.job.company,
            updatedAt: app.updatedAt,
            candidateProfile: app.candidateProfile
          });
        } else if (app.status === 'evaluating') {
          evaluatingCount++;
          sentApplications.push({
            id: app.id,
            candidateName: app.candidateName,
            candidateEmail: app.candidateEmail,
            status: app.status,
            jobId: assignment.job.id,
            jobTitle: assignment.job.title,
            company: assignment.job.user?.companyRequest?.nombreEmpresa || assignment.job.company,
            updatedAt: app.updatedAt,
            candidateProfile: app.candidateProfile
          });
        } else if (app.status === 'sent_to_company') {
          sentToCompanyCount++;
          sentApplications.push({
            id: app.id,
            candidateName: app.candidateName,
            candidateEmail: app.candidateEmail,
            status: app.status,
            jobId: assignment.job.id,
            jobTitle: assignment.job.title,
            company: assignment.job.user?.companyRequest?.nombreEmpresa || assignment.job.company,
            updatedAt: app.updatedAt,
            candidateProfile: app.candidateProfile
          });
        } else if (app.status === 'hired' || app.status === 'accepted') {
          hiredCount++;
          sentApplications.push({
            id: app.id,
            candidateName: app.candidateName,
            candidateEmail: app.candidateEmail,
            status: 'hired',
            jobId: assignment.job.id,
            jobTitle: assignment.job.title,
            company: assignment.job.user?.companyRequest?.nombreEmpresa || assignment.job.company,
            updatedAt: app.updatedAt,
            candidateProfile: app.candidateProfile
          });
        } else if (app.status === 'rejected' || app.status === 'company_rejected') {
          rejectedCount++;
          sentApplications.push({
            id: app.id,
            candidateName: app.candidateName,
            candidateEmail: app.candidateEmail,
            status: 'rejected',
            jobId: assignment.job.id,
            jobTitle: assignment.job.title,
            company: assignment.job.user?.companyRequest?.nombreEmpresa || assignment.job.company,
            updatedAt: app.updatedAt,
            candidateProfile: app.candidateProfile
          });
        } else if (app.status === 'discarded') {
          discardedCount++;
        }
      }
    }

    // Ordenar aplicaciones enviadas por fecha de actualización (más recientes primero)
    sentApplications.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());

    const stats = {
      total: enrichedAssignments.length,
      pending: pendingCount,
      reviewing: reviewingCount,
      sentToSpecialist: sentToSpecialistCount,
      evaluating: evaluatingCount,
      sentToCompany: sentToCompanyCount,
      hired: hiredCount,
      rejected: rejectedCount,
      discarded: discardedCount,
      // Total de candidatos en seguimiento (enviados al especialista o más adelante)
      totalSent: sentToSpecialistCount + evaluatingCount + sentToCompanyCount + hiredCount + rejectedCount
    };

    const duration = Date.now() - startTime;
    console.log(`[PERF] Recruiter dashboard loaded in ${duration}ms (${assignments.length} assignments, ${uniqueEmails.length} unique candidates)`);

    return NextResponse.json({
      success: true,
      data: {
        assignments: enrichedAssignments,
        sentApplications,
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
    const { assignmentId, status, notes, candidateIds, discardApplicationId, discardReason, updateApplicationId, newApplicationStatus } = body;

    // Acción: Actualizar status de una application individual (flujo de pestañas)
    if (updateApplicationId && newApplicationStatus) {
      const application = await prisma.application.findUnique({
        where: { id: updateApplicationId },
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
          { success: false, error: 'No tienes permiso para modificar este candidato' },
          { status: 403 }
        );
      }

      // Validar transiciones permitidas
      const allowedTransitions: Record<string, string[]> = {
        'pending': ['reviewing', 'discarded'],
        'injected_by_admin': ['reviewing', 'discarded'],
        'reviewing': ['sent_to_specialist', 'discarded', 'pending'], // pending para revertir
        'discarded': ['reviewing', 'pending'] // Permite reactivar a cualquier estado anterior
      };

      const currentStatus = application.status;
      const allowed = allowedTransitions[currentStatus] || [];

      if (!allowed.includes(newApplicationStatus)) {
        return NextResponse.json(
          { success: false, error: `No se puede mover de "${currentStatus}" a "${newApplicationStatus}"` },
          { status: 400 }
        );
      }

      // Si envía al especialista, verificar que hay especialista asignado
      if (newApplicationStatus === 'sent_to_specialist' && !hasAssignment?.specialistId) {
        return NextResponse.json(
          { success: false, error: 'No hay especialista asignado a esta vacante' },
          { status: 400 }
        );
      }

      // Actualizar Application
      const updatedApp = await prisma.application.update({
        where: { id: updateApplicationId },
        data: {
          status: newApplicationStatus,
          updatedAt: new Date()
        }
      });

      // Si envía al especialista, también actualizar el JobAssignment
      if (newApplicationStatus === 'sent_to_specialist' && hasAssignment) {
        await prisma.jobAssignment.update({
          where: { id: hasAssignment.id },
          data: {
            recruiterStatus: 'sent_to_specialist',
            specialistStatus: 'pending'
          }
        });
      }

      return NextResponse.json({
        success: true,
        message: `Candidato movido a "${newApplicationStatus}"`,
        data: updatedApp
      });
    }

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
    const updateData: Record<string, unknown> = {};

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

      // Actualizar candidatos enviados previamente para concatenar, no reemplazar
      const previouslySent = assignment.candidatesSentToSpecialist || '';
      const previousIds = previouslySent ? previouslySent.split(',').map(id => parseInt(id)).filter(id => !isNaN(id)) : [];
      const allSentIds = [...new Set([...previousIds, ...candidateIds])];

      await prisma.jobAssignment.update({
        where: { id: assignmentId },
        data: {
          candidatesSentToSpecialist: allSentIds.join(','),
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
