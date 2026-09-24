// RUTA: src/app/api/recruiter/dashboard/route.ts

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/auth';
import { createNotification, runAfterResponse } from '@/lib/notifications';
import { parseId } from '@/lib/authz-applications';
import { syncCandidateStatus } from '@/lib/candidate-status';

/**
 * Transiciones que el reclutador puede aplicar sobre una Application.
 * Es la ÚNICA fuente de verdad del PUT: la UI de /recruiter/jobs/[jobId] pinta
 * sus botones a partir de esta misma tabla (ver RECRUITER_TRANSITIONS allí).
 */
const allowedTransitions: Record<string, string[]> = {
  'pending': ['reviewing', 'discarded'],
  'injected_by_admin': ['reviewing', 'discarded'],
  'reviewing': ['sent_to_specialist', 'discarded', 'pending'], // pending para revertir
  'discarded': ['reviewing', 'pending'] // Permite reactivar a cualquier estado anterior
};

// Todos los status a los que el reclutador puede mover una postulación.
const TARGET_STATUSES = new Set(Object.values(allowedTransitions).flat());

/**
 * Nombre en pantalla de cada estado (el de las pestañas de /recruiter/jobs/[jobId]),
 * para que los mensajes del PUT se lean «Candidato movido a «En proceso»» y
 * no con el código crudo. El estado que se guarda no cambia.
 */
const NOMBRE_ESTADO: Record<string, string> = {
  pending: 'Por revisar',
  injected_by_admin: 'Por revisar',
  reviewing: 'En proceso',
  sent_to_specialist: 'Enviado al especialista',
  discarded: 'Descartados'
};
const nombreEstado = (estado: string) =>
  NOMBRE_ESTADO[estado] ? `«${NOMBRE_ESTADO[estado]}»` : `"${estado}"`;

/**
 * GET /api/recruiter/dashboard
 * Obtener vacantes asignadas al reclutador
 *
 * OPTIMIZADO: Eliminadas queries N+1, usa batch queries
 */
export async function GET(request: Request) {
  try {
    const auth = await requireRole(['recruiter', 'admin']);
    if ('error' in auth) {
      return NextResponse.json(
        { success: false, error: auth.error },
        { status: auth.status }
      );
    }

    const { user } = auth;
    const { searchParams } = new URL(request.url);

    // La página de detalle sólo necesita UNA vacante: con ?jobId= se evita
    // descargar todas las asignaciones del reclutador con todas sus
    // postulaciones y perfiles en cada carga y tras cada acción.
    const jobIdParam = searchParams.get('jobId');
    const jobIdFilter = jobIdParam ? parseId(jobIdParam) : null;

    if (jobIdParam && jobIdFilter === null) {
      return NextResponse.json(
        { success: false, error: 'jobId inválido' },
        { status: 400 }
      );
    }

    // Obtener asignaciones del reclutador
    const whereClause: Record<string, unknown> = {
      recruiterId: user.id
    };

    if (jobIdFilter !== null) {
      whereClause.jobId = jobIdFilter;
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
                    correoEmpresa: true,
                    logoUrl: true // La cabecera de la vacante pinta el logo
                  }
                }
              }
            },
            applications: {
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
            subcategory: true, // El modal de perfil la pinta
            cartaPresentacion: true, // El modal de perfil la pinta
            seniority: true,
            linkedinUrl: true,
            portafolioUrl: true,
            cvUrl: true,
            telefono: true,
            sexo: true,
            fechaNacimiento: true,
            ciudad: true,
            estado: true,
            ubicacionCercana: true,
            latitude: true,
            longitude: true,
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
    let companyInterestedCount = 0;
    let interviewedCount = 0;
    let hiredCount = 0;
    let rejectedCount = 0;
    let discardedCount = 0;

    // Recolectar aplicaciones enviadas (para el tab "Enviados")
    const sentApplications: Array<{
      id: number;
      candidateName: string;
      candidateEmail: string;
      candidatePhone: string | null;
      cvUrl: string | null;
      coverLetter: string | null;
      status: string;
      jobId: number;
      jobTitle: string;
      company: string;
      createdAt: Date;
      updatedAt: Date;
      candidateProfile: unknown;
      jobLatitude: number | null;
      jobLongitude: number | null;
    }> = [];

    type EnrichedApplication = (typeof enrichedAssignments)[number]['job']['applications'][number];
    type EnrichedAssignment = (typeof enrichedAssignments)[number];

    // Una sola forma de construir la fila de "Enviados": antes había cinco
    // copias del mismo push y dos de ellas reescribían el status real.
    const toSentApplication = (app: EnrichedApplication, assignment: EnrichedAssignment) => ({
      id: app.id,
      candidateName: app.candidateName,
      candidateEmail: app.candidateEmail,
      candidatePhone: app.candidatePhone ?? null,
      cvUrl: app.cvUrl ?? null,
      coverLetter: app.coverLetter ?? null,
      status: app.status,
      jobId: assignment.job.id,
      jobTitle: assignment.job.title,
      company: assignment.job.user?.companyRequest?.nombreEmpresa || assignment.job.company,
      createdAt: app.createdAt,
      updatedAt: app.updatedAt,
      candidateProfile: app.candidateProfile,
      jobLatitude: assignment.job.latitude ?? null,
      jobLongitude: assignment.job.longitude ?? null
    });

    for (const assignment of enrichedAssignments) {
      for (const app of assignment.job.applications) {
        switch (app.status) {
          case 'pending':
          case 'injected_by_admin':
            pendingCount++;
            break;
          case 'reviewing':
            reviewingCount++;
            break;
          case 'sent_to_specialist':
            sentToSpecialistCount++;
            sentApplications.push(toSentApplication(app, assignment));
            break;
          case 'evaluating':
            evaluatingCount++;
            sentApplications.push(toSentApplication(app, assignment));
            break;
          case 'sent_to_company':
            sentToCompanyCount++;
            sentApplications.push(toSentApplication(app, assignment));
            break;
          // La empresa mueve la postulación a estos dos estados: sin sus ramas
          // el candidato desaparecía de "Enviados" justo cuando más interesa
          // seguirlo.
          case 'company_interested':
            companyInterestedCount++;
            sentApplications.push(toSentApplication(app, assignment));
            break;
          case 'interviewed':
            interviewedCount++;
            sentApplications.push(toSentApplication(app, assignment));
            break;
          case 'accepted':
            hiredCount++;
            sentApplications.push(toSentApplication(app, assignment));
            break;
          case 'rejected':
            rejectedCount++;
            sentApplications.push(toSentApplication(app, assignment));
            break;
          case 'discarded':
            discardedCount++;
            break;
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
      companyInterested: companyInterestedCount,
      interviewed: interviewedCount,
      hired: hiredCount,
      rejected: rejectedCount,
      discarded: discardedCount,
      // Total de candidatos en seguimiento (enviados al especialista o más adelante)
      totalSent: sentApplications.length
    };

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
    const auth = await requireRole(['recruiter', 'admin']);
    if ('error' in auth) {
      return NextResponse.json(
        { success: false, error: auth.error },
        { status: auth.status }
      );
    }

    const { user } = auth;
    const body = await request.json();
    const { updateApplicationId, newApplicationStatus } = body;

    // Validar el body ANTES de tocar la base: con un id no numérico Prisma
    // lanzaba y el catch genérico devolvía 500 en vez de 400.
    const applicationId = parseId(updateApplicationId);

    if (applicationId === null || typeof newApplicationStatus !== 'string') {
      return NextResponse.json(
        { success: false, error: 'Se requiere updateApplicationId (entero) y newApplicationStatus' },
        { status: 400 }
      );
    }

    if (!TARGET_STATUSES.has(newApplicationStatus)) {
      return NextResponse.json(
        { success: false, error: `Estado "${newApplicationStatus}" no válido` },
        { status: 400 }
      );
    }

    // Acción: Actualizar status de una application individual (flujo de pestañas)
    {
      const application = await prisma.application.findUnique({
        where: { id: applicationId },
        include: { job: true }
      });

      if (!application) {
        return NextResponse.json(
          { success: false, error: 'Aplicación no encontrada' },
          { status: 404 }
        );
      }

      // Verificar que el reclutador tiene asignación a este job.
      // El admin cubre a cualquier reclutador, así que para él la asignación se
      // busca sólo por jobId: buscarla por recruiterId (que es null en su caso)
      // dejaba hasAssignment vacío y rompía el envío al especialista.
      const hasAssignment = await prisma.jobAssignment.findFirst({
        where: user.role === 'admin'
          ? { jobId: application.jobId }
          : { jobId: application.jobId, recruiterId: user.id }
      });

      if (!hasAssignment && user.role !== 'admin') {
        return NextResponse.json(
          { success: false, error: 'No tienes permiso para modificar este candidato' },
          { status: 403 }
        );
      }

      const currentStatus = application.status;
      const allowed = allowedTransitions[currentStatus] || [];

      if (!allowed.includes(newApplicationStatus)) {
        return NextResponse.json(
          { success: false, error: `No se puede mover de ${nombreEstado(currentStatus)} a ${nombreEstado(newApplicationStatus)}` },
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

      // Application y JobAssignment se mueven juntas: si el INSERT de la
      // asignación fallaba, la postulación quedaba en 'sent_to_specialist' con
      // la asignación sin marcar (invisible para el especialista y sin camino
      // de vuelta para el reclutador).
      const updatedApp = await prisma.$transaction(async (tx) => {
        const updated = await tx.application.update({
          where: { id: applicationId },
          data: {
            status: newApplicationStatus,
            updatedAt: new Date()
          }
        });

        if (!hasAssignment) return updated;

        // El panel de asignaciones del admin deriva "en progreso" de
        // recruiterStatus: sin esta escritura nunca salía de 'pending'.
        if (newApplicationStatus === 'reviewing') {
          await tx.jobAssignment.updateMany({
            where: { id: hasAssignment.id, recruiterStatus: 'pending' },
            data: { recruiterStatus: 'reviewing' }
          });
        }

        if (newApplicationStatus === 'sent_to_specialist') {
          await tx.jobAssignment.update({
            where: { id: hasAssignment.id },
            data: { recruiterStatus: 'sent_to_specialist' }
          });

          // No pisar el avance del especialista: reiniciar specialistStatus a
          // 'pending' en cada envío borraba el progreso de la vacante.
          await tx.jobAssignment.updateMany({
            where: {
              id: hasAssignment.id,
              specialistStatus: { notIn: ['evaluating', 'sent_to_company'] }
            },
            data: { specialistStatus: 'pending' }
          });
        }

        return updated;
      });

      // ADM-028: Candidate.status sigue a sus postulaciones (p. ej. un descarte
      // puede devolverlo a 'available').
      await syncCandidateStatus(updatedApp.candidateEmail);

      // Notificar al especialista. runAfterResponse usa `after` (Next 15), que
      // garantiza que el INSERT corre aunque la lambda ya haya respondido, y
      // registra el error si falla: antes era `.catch(() => {})` sin await, que
      // en Vercel podía perderse y se tragaba el error sin dejar rastro.
      if (newApplicationStatus === 'sent_to_specialist' && hasAssignment?.specialistId) {
        const specialistId = hasAssignment.specialistId;
        await runAfterResponse('NOTIF:sent_to_specialist', () =>
          createNotification({
            userId: specialistId,
            type: 'sent_to_specialist',
            title: 'Candidato enviado para evaluación',
            message: `Un candidato fue enviado para tu evaluación en "${application.job.title}".`,
            link: '/specialist/dashboard',
            metadata: { jobId: application.jobId, applicationId },
          })
        );
      }

      return NextResponse.json({
        success: true,
        message: `Candidato movido a ${nombreEstado(newApplicationStatus)}`,
        data: updatedApp
      });
    }
  } catch (error) {
    console.error('Error updating assignment:', error);
    return NextResponse.json(
      { success: false, error: 'Error al actualizar asignación' },
      { status: 500 }
    );
  }
}
