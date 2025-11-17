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
    const totalJobs = jobs.length;
    const activeJobs = jobs.filter((job) => job.status === 'active').length;
    const closedJobs = jobs.filter((job) => job.status === 'closed').length;
    const draftJobs = jobs.filter((job) => job.status === 'draft').length;

    // 4. Obtener todas las aplicaciones a las vacantes de esta empresa
    const jobIds = jobs.map((job) => job.id);

    const allApplications = await prisma.application.findMany({
      where: {
        jobId: { in: jobIds }
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

    // 5. Calcular estadísticas de aplicaciones
    const totalApplications = allApplications.length;
    const pendingApplications = allApplications.filter(
      (app) => app.status === 'pending'
    ).length;
    const reviewingApplications = allApplications.filter(
      (app) => app.status === 'reviewing'
    ).length;
    const interviewedApplications = allApplications.filter(
      (app) => app.status === 'interviewed'
    ).length;
    const acceptedApplications = allApplications.filter(
      (app) => app.status === 'accepted'
    ).length;
    const rejectedApplications = allApplications.filter(
      (app) => app.status === 'rejected'
    ).length;

    // 6. Aplicaciones recientes (últimas 5)
    const recentApplications = allApplications.slice(0, 5);

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

    // 8. Estadísticas por vacante
    const jobStats = jobs.map((job) => {
      const jobApplications = allApplications.filter(
        (app) => app.jobId === job.id
      );

      return {
        jobId: job.id,
        jobTitle: job.title,
        totalApplications: jobApplications.length,
        pendingApplications: jobApplications.filter(
          (app) => app.status === 'pending'
        ).length,
        acceptedApplications: jobApplications.filter(
          (app) => app.status === 'accepted'
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
          companyInfo: user.companyRequest
        },
        stats: {
          jobs: {
            total: totalJobs,
            active: activeJobs,
            closed: closedJobs,
            draft: draftJobs
          },
          applications: {
            total: totalApplications,
            pending: pendingApplications,
            reviewing: reviewingApplications,
            interviewed: interviewedApplications,
            accepted: acceptedApplications,
            rejected: rejectedApplications
          }
        },
        recentApplications,
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
