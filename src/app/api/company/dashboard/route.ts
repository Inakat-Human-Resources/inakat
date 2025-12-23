import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

/**
 * GET /api/company/dashboard
 * Obtiene estadísticas y datos del dashboard para una empresa
 * Requiere autenticación como empresa (role: "company")
 */
export async function GET(request: Request) {
  try {
    // Obtener userId de los headers (agregado por middleware)
    const userId = request.headers.get('x-user-id');
    const userRole = request.headers.get('x-user-role');

    if (!userId) {
      return NextResponse.json(
        {
          success: false,
          error: 'No autenticado'
        },
        { status: 401 }
      );
    }

    if (userRole !== 'company') {
      return NextResponse.json(
        {
          success: false,
          error: 'Acceso denegado. Solo empresas pueden acceder a este recurso.'
        },
        { status: 403 }
      );
    }

    const companyUserId = parseInt(userId);

    // 1. Obtener información de la empresa
    const user = await prisma.user.findUnique({
      where: { id: companyUserId },
      select: {
        id: true,
        email: true,
        nombre: true,
        apellidoPaterno: true,
        apellidoMaterno: true,
        credits: true,
        companyRequest: {
          select: {
            nombreEmpresa: true,
            correoEmpresa: true,
            sitioWeb: true,
            rfc: true,
            direccionEmpresa: true
          }
        }
      }
    });

    if (!user) {
      return NextResponse.json(
        {
          success: false,
          error: 'Usuario no encontrado'
        },
        { status: 404 }
      );
    }

    // 2. Obtener todas las vacantes de la empresa
    const jobs = await prisma.job.findMany({
      where: { userId: companyUserId },
      include: {
        applications: true
      },
      orderBy: { createdAt: 'desc' }
    });

    // 3. Calcular estadísticas de vacantes
    const now = new Date();
    const totalJobs = jobs.length;
    const activeJobs = jobs.filter(
      (job) => job.status === 'active' && (!job.expiresAt || job.expiresAt > now)
    ).length;
    const pausedJobs = jobs.filter((job) => job.status === 'paused').length;
    const expiredJobs = jobs.filter(
      (job) => job.status === 'active' && job.expiresAt && job.expiresAt <= now
    ).length;
    const closedJobs = jobs.filter((job) => job.status === 'closed').length;
    const draftJobs = jobs.filter((job) => job.status === 'draft').length;

    // 4. Obtener SOLO las aplicaciones visibles para la empresa
    // La empresa SOLO ve candidatos que han sido enviados por el Especialista
    // Status permitidos para empresa:
    // - sent_to_company: Candidatos nuevos por revisar
    // - company_interested: Candidatos que la empresa marcó "Me interesa"
    // - interviewed: Candidatos entrevistados
    // - accepted: Candidatos aceptados
    // - rejected: Candidatos descartados
    const jobIds = jobs.map((job) => job.id);

    const COMPANY_VISIBLE_STATUSES = [
      'sent_to_company',
      'company_interested',
      'interviewed',
      'accepted',
      'rejected'
    ];

    const allApplications = await prisma.application.findMany({
      where: {
        jobId: { in: jobIds },
        status: { in: COMPANY_VISIBLE_STATUSES }
      },
      include: {
        job: {
          select: {
            id: true,
            title: true,
            location: true,
            status: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    // 4.1 Enriquecer aplicaciones con datos de Candidate y JobAssignment
    const enrichedApplications = await Promise.all(
      allApplications.map(async (app) => {
        // Buscar candidato por email
        const candidate = await prisma.candidate.findFirst({
          where: { email: { equals: app.candidateEmail, mode: 'insensitive' } },
          include: {
            experiences: {
              orderBy: { fechaInicio: 'desc' },
              take: 3
            }
          }
        });

        // Buscar JobAssignment para obtener notas
        const jobAssignment = await prisma.jobAssignment.findFirst({
          where: { jobId: app.jobId }
        });

        return {
          ...app,
          candidateProfile: candidate
            ? {
                id: candidate.id,
                nombre: candidate.nombre,
                apellidoPaterno: candidate.apellidoPaterno,
                apellidoMaterno: candidate.apellidoMaterno,
                email: candidate.email,
                telefono: candidate.telefono,
                sexo: candidate.sexo,
                fechaNacimiento: candidate.fechaNacimiento,
                universidad: candidate.universidad,
                carrera: candidate.carrera,
                nivelEstudios: candidate.nivelEstudios,
                añosExperiencia: candidate.añosExperiencia,
                profile: candidate.profile,
                seniority: candidate.seniority,
                experienciasRecientes: candidate.experiences,
                cvUrl: candidate.cvUrl,
                linkedinUrl: candidate.linkedinUrl,
                portafolioUrl: candidate.portafolioUrl,
                notas: candidate.notas
              }
            : null,
          recruiterNotes: jobAssignment?.recruiterNotes || null,
          specialistNotes: jobAssignment?.specialistNotes || null
        };
      })
    );

    // 5. Calcular estadísticas de aplicaciones (solo las visibles para empresa)
    const totalApplications = allApplications.length;
    // Para empresa: "sent_to_company" = Nuevos candidatos por revisar
    const pendingReview = allApplications.filter(
      (app) => app.status === 'sent_to_company'
    ).length;
    // Candidatos que la empresa marcó como interesados
    const interestedCandidates = allApplications.filter(
      (app) => app.status === 'company_interested'
    ).length;
    const interviewedApplications = allApplications.filter(
      (app) => app.status === 'interviewed'
    ).length;
    const acceptedApplications = allApplications.filter(
      (app) => app.status === 'accepted'
    ).length;
    // Candidatos descartados por la empresa
    const rejectedApplications = allApplications.filter(
      (app) => app.status === 'rejected'
    ).length;

    // 6. Aplicaciones recientes (últimas 5) - con datos enriquecidos
    const recentApplications = enrichedApplications.slice(0, 5);

    // 7. Vacantes con más aplicaciones (top 5)
    const jobsWithApplicationCount = jobs.map((job) => ({
      id: job.id,
      title: job.title,
      location: job.location,
      status: job.status,
      applicationCount: job.applications.length,
      salary: job.salary
    }));

    const topJobs = jobsWithApplicationCount
      .sort((a, b) => b.applicationCount - a.applicationCount)
      .slice(0, 5);

    // 8. Estadísticas por vacante (solo candidatos visibles para empresa)
    const jobStats = jobs.map((job) => {
      const jobApplications = allApplications.filter(
        (app) => app.jobId === job.id
      );

      return {
        jobId: job.id,
        jobTitle: job.title,
        totalCandidates: jobApplications.length,
        pendingReview: jobApplications.filter(
          (app) => app.status === 'sent_to_company'
        ).length,
        interested: jobApplications.filter(
          (app) => app.status === 'company_interested'
        ).length,
        interviewedCandidates: jobApplications.filter(
          (app) => app.status === 'interviewed'
        ).length,
        acceptedCandidates: jobApplications.filter(
          (app) => app.status === 'accepted'
        ).length,
        rejectedCandidates: jobApplications.filter(
          (app) => app.status === 'rejected'
        ).length
      };
    });

    // 9. Respuesta completa
    return NextResponse.json({
      success: true,
      data: {
        company: {
          userId: user.id,
          userName: `${user.nombre} ${user.apellidoPaterno || ''}`,
          email: user.email,
          credits: user.credits,
          companyInfo: user.companyRequest
        },
        stats: {
          jobs: {
            total: totalJobs,
            active: activeJobs,
            paused: pausedJobs,
            expired: expiredJobs,
            closed: closedJobs,
            draft: draftJobs
          },
          applications: {
            total: totalApplications,
            pendingReview, // Candidatos enviados por especialista, sin revisar
            interested: interestedCandidates, // Candidatos marcados como "Me interesa"
            interviewed: interviewedApplications,
            accepted: acceptedApplications,
            rejected: rejectedApplications
          }
        },
        recentApplications,
        allApplications: enrichedApplications, // Todas las aplicaciones con datos completos
        topJobs,
        jobStats,
        allJobs: jobs.map((job) => ({
          ...job,
          applicationCount: job.applications.length
        }))
      }
    });
  } catch (error) {
    console.error('Error fetching company dashboard:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Error al obtener datos del dashboard'
      },
      { status: 500 }
    );
  }
}
