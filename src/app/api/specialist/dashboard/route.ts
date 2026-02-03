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
 *
 * OPTIMIZADO: Eliminadas queries N+1, usa batch queries
 */
export async function GET(request: Request) {
  const startTime = Date.now();

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
    const whereClause: Record<string, unknown> = {
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
                status: { in: ['sent_to_specialist', 'evaluating', 'sent_to_company', 'discarded'] }
              },
              orderBy: { createdAt: 'desc' },
              select: {
                id: true,
                candidateName: true,
                candidateEmail: true,
                candidatePhone: true,
                cvUrl: true,
                coverLetter: true,
                status: true,
                createdAt: true,
                updatedAt: true,
                notes: true
              }
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

    // =========================================================================
    // OPTIMIZACIÓN: Batch queries para candidatos
    // En lugar de múltiples queries anidadas, hacemos 2 queries batch
    // =========================================================================

    // 1. Recolectar todos los IDs de candidatos enviados (de candidatesSentToSpecialist)
    const allCandidateIds: number[] = [];
    for (const assignment of assignments) {
      if (assignment.candidatesSentToSpecialist) {
        const ids = assignment.candidatesSentToSpecialist
          .split(',')
          .map(id => parseInt(id))
          .filter(id => !isNaN(id));
        allCandidateIds.push(...ids);
      }
    }
    const uniqueCandidateIds = [...new Set(allCandidateIds)];

    // 2. Recolectar todos los emails de applications
    const allEmails: string[] = [];
    for (const assignment of assignments) {
      for (const app of assignment.job.applications) {
        allEmails.push(app.candidateEmail.toLowerCase());
      }
    }
    const uniqueEmails = [...new Set(allEmails)];

    // 3. Una sola query para obtener candidatos por ID (los enviados explícitamente)
    const candidatesById = uniqueCandidateIds.length > 0
      ? await prisma.candidate.findMany({
          where: { id: { in: uniqueCandidateIds } },
          include: {
            experiences: { orderBy: { fechaInicio: 'desc' } },
            documents: { orderBy: { createdAt: 'desc' } }
          }
        })
      : [];

    // 4. Una sola query para obtener candidatos por email (para enriquecer applications)
    const candidatesByEmail = uniqueEmails.length > 0
      ? await prisma.candidate.findMany({
          where: { email: { in: uniqueEmails, mode: 'insensitive' } },
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
            experiences: { orderBy: { fechaInicio: 'desc' } },
            documents: { orderBy: { createdAt: 'desc' } }
          }
        })
      : [];

    // Crear mapas para acceso O(1)
    const candidateByIdMap = new Map(
      candidatesById.map(c => [c.id, c])
    );
    const candidateByEmailMap = new Map(
      candidatesByEmail.map(c => [c.email.toLowerCase(), c])
    );

    // Enriquecer assignments SIN queries adicionales
    const assignmentsWithCandidates = assignments.map((assignment) => {
      // Obtener candidatos enviados por ID
      let candidates: typeof candidatesById = [];
      if (assignment.candidatesSentToSpecialist) {
        const ids = assignment.candidatesSentToSpecialist
          .split(',')
          .map(id => parseInt(id))
          .filter(id => !isNaN(id));
        candidates = ids
          .map(id => candidateByIdMap.get(id))
          .filter((c): c is NonNullable<typeof c> => c !== undefined);
      }

      // Enriquecer applications con datos del candidato
      const enrichedApplications = assignment.job.applications.map((app) => ({
        ...app,
        candidateProfile: candidateByEmailMap.get(app.candidateEmail.toLowerCase()) || null
      }));

      return {
        ...assignment,
        candidates,
        applications: enrichedApplications,
        recruiterNotes: assignment.recruiterNotes
      };
    });

    // Estadísticas basadas en status de applications
    let pendingCount = 0;
    let evaluatingCount = 0;
    let sentToCompanyCount = 0;
    let discardedCount = 0;

    for (const assignment of assignmentsWithCandidates) {
      for (const app of assignment.applications) {
        if (app.status === 'sent_to_specialist') {
          pendingCount++;
        } else if (app.status === 'evaluating') {
          evaluatingCount++;
        } else if (app.status === 'sent_to_company') {
          sentToCompanyCount++;
        } else if (app.status === 'discarded') {
          discardedCount++;
        }
      }
    }

    const stats = {
      total: assignmentsWithCandidates.length,
      pending: pendingCount,
      evaluating: evaluatingCount,
      sentToCompany: sentToCompanyCount,
      discarded: discardedCount
    };

    const duration = Date.now() - startTime;
    console.log(`[PERF] Specialist dashboard loaded in ${duration}ms (${assignments.length} assignments, ${uniqueEmails.length} unique candidates)`);

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

      // Verificar que el especialista tiene asignación a este job
      const hasAssignment = await prisma.jobAssignment.findFirst({
        where: { jobId: application.jobId, specialistId: user.id }
      });

      if (!hasAssignment && user.role !== 'admin') {
        return NextResponse.json(
          { success: false, error: 'No tienes permiso para modificar este candidato' },
          { status: 403 }
        );
      }

      // Validar transiciones permitidas para especialista
      const allowedTransitions: Record<string, string[]> = {
        'sent_to_specialist': ['evaluating', 'discarded'],
        'evaluating': ['sent_to_company', 'discarded', 'sent_to_specialist'], // sent_to_specialist para revertir
        'discarded': ['evaluating', 'sent_to_specialist'] // Permite reactivar a cualquier estado anterior
      };

      const currentStatus = application.status;
      const allowed = allowedTransitions[currentStatus] || [];

      if (!allowed.includes(newApplicationStatus)) {
        return NextResponse.json(
          { success: false, error: `No se puede mover de "${currentStatus}" a "${newApplicationStatus}"` },
          { status: 400 }
        );
      }

      // Preparar datos de actualización
      const updateData: Record<string, unknown> = {
        status: newApplicationStatus,
        updatedAt: new Date()
      };

      // Actualizar Application
      const updatedApp = await prisma.application.update({
        where: { id: updateApplicationId },
        data: updateData
      });

      // Si envía a empresa, actualizar la fecha de seguimiento en JobAssignment
      if (newApplicationStatus === 'sent_to_company' && hasAssignment) {
        const followUpDate = new Date();
        followUpDate.setDate(followUpDate.getDate() + 45);
        await prisma.jobAssignment.update({
          where: { id: hasAssignment.id },
          data: { followUpDate }
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
    const updateData: Record<string, unknown> = {};

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

    // Si envía candidatos a la empresa
    if (candidateIds && candidateIds.length > 0) {
      // Obtener emails de los candidatos seleccionados
      const selectedCandidates = await prisma.candidate.findMany({
        where: { id: { in: candidateIds } },
        select: { id: true, email: true }
      });

      const candidateEmails = selectedCandidates.map((c) => c.email.toLowerCase());

      if (candidateEmails.length > 0) {
        // Actualizar Applications SOLO de los candidatos seleccionados
        await prisma.application.updateMany({
          where: {
            jobId: assignment.jobId,
            candidateEmail: { in: candidateEmails },
            status: { in: ['sent_to_specialist', 'evaluating'] }
          },
          data: {
            status: 'sent_to_company',
            updatedAt: new Date()
          }
        });
      }

      // Actualizar candidatos enviados previamente para concatenar, no reemplazar
      const previouslySent = assignment.candidatesSentToCompany || '';
      const previousIds = previouslySent ? previouslySent.split(',').map(id => parseInt(id)).filter(id => !isNaN(id)) : [];
      const allSentIds = [...new Set([...previousIds, ...candidateIds])];

      await prisma.jobAssignment.update({
        where: { id: assignmentId },
        data: {
          candidatesSentToCompany: allSentIds.join(','),
          ...(status === 'sent_to_company' ? {
            specialistStatus: 'sent_to_company',
            followUpDate: (() => {
              const date = new Date();
              date.setDate(date.getDate() + 45);
              return date;
            })()
          } : {})
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
