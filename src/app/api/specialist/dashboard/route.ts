// RUTA: src/app/api/specialist/dashboard/route.ts

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/auth';
import { createNotification, runAfterResponse } from '@/lib/notifications';
import { parseId } from '@/lib/authz-applications';
import { syncCandidateStatus } from '@/lib/candidate-status';
import { sendCandidateSentToCompany } from '@/lib/email';
import { absoluteUrl } from '@/lib/site-url';

/**
 * Postulaciones que el especialista ve de sus vacantes.
 * Incluye los estados que escribe la EMPRESA (company_interested, interviewed,
 * accepted, rejected): sin ellos el especialista perdía de vista a sus
 * candidatos en cuanto la empresa actuaba y nunca conocía el resultado de su
 * propia evaluación.
 */
const SPECIALIST_VISIBLE_STATUSES = [
  'sent_to_specialist',
  'evaluating',
  'sent_to_company',
  'company_interested',
  'interviewed',
  'accepted',
  'rejected',
  'discarded'
];

/**
 * Transiciones que el especialista puede aplicar sobre una Application.
 * Fuente de verdad única: la UI de /specialist/jobs/[jobId] pinta sus botones
 * a partir de esta misma tabla (ver SPECIALIST_TRANSITIONS allí).
 */
const allowedTransitions: Record<string, string[]> = {
  'sent_to_specialist': ['evaluating', 'discarded'],
  'evaluating': ['sent_to_company', 'discarded', 'sent_to_specialist'], // sent_to_specialist para revertir
  'discarded': ['evaluating', 'sent_to_specialist'] // Permite reactivar a cualquier estado anterior
};

// Todos los status a los que el especialista puede mover una postulación.
const TARGET_STATUSES = new Set(Object.values(allowedTransitions).flat());

/**
 * GET /api/specialist/dashboard
 * Obtener vacantes asignadas al especialista
 *
 * OPTIMIZADO: Eliminadas queries N+1, usa batch queries
 */
export async function GET(request: Request) {
  try {
    const auth = await requireRole(['specialist', 'admin']);
    if ('error' in auth) {
      return NextResponse.json(
        { success: false, error: auth.error },
        { status: auth.status }
      );
    }

    const { user } = auth;
    const { searchParams } = new URL(request.url);

    // La página de detalle sólo necesita UNA vacante: con ?jobId= se evita
    // descargar todas las asignaciones del especialista con todas sus
    // postulaciones y perfiles en cada carga y tras cada acción.
    const jobIdParam = searchParams.get('jobId');
    const jobIdFilter = jobIdParam ? parseId(jobIdParam) : null;

    if (jobIdParam && jobIdFilter === null) {
      return NextResponse.json(
        { success: false, error: 'jobId inválido' },
        { status: 400 }
      );
    }

    // Obtener asignaciones del especialista
    const whereClause: Record<string, unknown> = {
      specialistId: user.id,
      // Solo mostrar las que ya pasaron por el reclutador
      recruiterStatus: 'sent_to_specialist'
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
              where: {
                status: { in: SPECIALIST_VISIBLE_STATUSES }
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

    // 1. Recolectar todos los emails de applications
    const allEmails: string[] = [];
    for (const assignment of assignments) {
      for (const app of assignment.job.applications) {
        allEmails.push(app.candidateEmail.toLowerCase());
      }
    }
    const uniqueEmails = [...new Set(allEmails)];

    // 2. Una sola query para obtener candidatos por email (para enriquecer applications)
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
            experiences: { orderBy: { fechaInicio: 'desc' } },
            documents: { orderBy: { createdAt: 'desc' } }
          }
        })
      : [];

    // Crear mapa para acceso O(1)
    const candidateByEmailMap = new Map(
      candidatesByEmail.map(c => [c.email.toLowerCase(), c])
    );

    // Enriquecer assignments SIN queries adicionales
    const assignmentsWithCandidates = assignments.map((assignment) => {
      // Enriquecer applications con datos del candidato
      const enrichedApplications = assignment.job.applications.map((app) => ({
        ...app,
        candidateProfile: candidateByEmailMap.get(app.candidateEmail.toLowerCase()) || null
      }));

      // job.applications (sin enriquecer) viajaba duplicado junto a
      // `applications`: ninguna página lo lee, sólo engordaba la respuesta.
      const { applications: _sinEnriquecer, ...jobSinApplications } = assignment.job;

      return {
        ...assignment,
        job: jobSinApplications,
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
        } else if (
          // Una vez enviado a la empresa la postulación sigue contando como
          // "enviada" aunque la empresa la haya movido: si no, el contador
          // bajaba solo y el especialista creía haber perdido candidatos.
          app.status === 'sent_to_company' ||
          app.status === 'company_interested' ||
          app.status === 'interviewed' ||
          app.status === 'accepted' ||
          app.status === 'rejected'
        ) {
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
    const auth = await requireRole(['specialist', 'admin']);
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

      // Verificar que el especialista tiene asignación a este job.
      // El admin cubre a cualquier especialista, así que para él la asignación
      // se busca sólo por jobId: buscarla por specialistId (null en su caso)
      // dejaba hasAssignment vacío y se saltaba followUpDate y la notificación.
      const hasAssignment = await prisma.jobAssignment.findFirst({
        where: user.role === 'admin'
          ? { jobId: application.jobId }
          : { jobId: application.jobId, specialistId: user.id }
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
          { success: false, error: `No se puede mover de "${currentStatus}" a "${newApplicationStatus}"` },
          { status: 400 }
        );
      }

      // Application y JobAssignment se mueven juntas: si la escritura de la
      // asignación fallaba, la postulación quedaba movida y el panel del admin
      // seguía marcando la vacante como si nadie la hubiera tocado.
      const updatedApp = await prisma.$transaction(async (tx) => {
        const updated = await tx.application.update({
          where: { id: applicationId },
          data: {
            status: newApplicationStatus,
            updatedAt: new Date()
          }
        });

        if (!hasAssignment) return updated;

        // El panel de asignaciones del admin deriva "en progreso" y
        // "completado" de specialistStatus: el flujo por candidato nunca lo
        // escribía, así que las tarjetas se quedaban en cero para siempre.
        if (newApplicationStatus === 'evaluating') {
          await tx.jobAssignment.updateMany({
            where: { id: hasAssignment.id, specialistStatus: 'pending' },
            data: { specialistStatus: 'evaluating' }
          });
        }

        if (newApplicationStatus === 'sent_to_company') {
          const followUpDate = new Date();
          followUpDate.setDate(followUpDate.getDate() + 45);
          await tx.jobAssignment.update({
            where: { id: hasAssignment.id },
            data: { specialistStatus: 'sent_to_company', followUpDate }
          });
        }

        return updated;
      });

      // ADM-028: Candidate.status sigue a sus postulaciones.
      await syncCandidateStatus(updatedApp.candidateEmail);

      // Notificar a la empresa. runAfterResponse usa `after` (Next 15), que
      // garantiza que el INSERT corre aunque la lambda ya haya respondido, y
      // registra el error si falla: antes era `.catch(() => {})` sin await, que
      // en Vercel podía perderse y se tragaba el error sin dejar rastro.
      if (newApplicationStatus === 'sent_to_company' && application.job.userId) {
        const companyUserId = application.job.userId;
        await runAfterResponse('NOTIF:sent_to_company', () =>
          createNotification({
            userId: companyUserId,
            type: 'sent_to_company',
            title: 'Candidato disponible para revisión',
            message: `Un candidato fue enviado para tu revisión en "${application.job.title}".`,
            link: '/company/dashboard',
            metadata: { jobId: application.jobId, applicationId },
          })
        );

        // PLAT-011: USER_GUIDE promete un correo a la empresa cuando le llega un
        // candidato; la plantilla existía pero nadie la enviaba.
        await runAfterResponse('EMAIL:sent_to_company', async () => {
          const empresa = await prisma.user.findUnique({
            where: { id: companyUserId },
            select: { email: true, nombre: true }
          });
          if (!empresa?.email) return;
          await sendCandidateSentToCompany({
            companyEmail: empresa.email,
            nombreEmpresa: application.job.company || empresa.nombre,
            candidateName: application.candidateName,
            jobTitle: application.job.title,
            dashboardUrl: absoluteUrl('/company/dashboard')
          });
        });
      }

      return NextResponse.json({
        success: true,
        message: `Candidato movido a "${newApplicationStatus}"`,
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
