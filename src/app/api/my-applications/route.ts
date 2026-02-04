// RUTA: src/app/api/my-applications/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

/**
 * GET /api/my-applications
 * Obtiene todas las aplicaciones del usuario logueado
 */
export async function GET(request: NextRequest) {
  try {
    // Obtener userId del header (viene del middleware)
    const userId = request.headers.get('x-user-id');
    const userEmail = request.headers.get('x-user-email');

    if (!userId || !userEmail) {
      return NextResponse.json(
        { success: false, error: 'No autenticado' },
        { status: 401 }
      );
    }

    // Obtener aplicaciones del usuario
    const applications = await prisma.application.findMany({
      where: {
        OR: [{ userId: parseInt(userId) }, { candidateEmail: userEmail }]
      },
      include: {
        job: {
          select: {
            id: true,
            title: true,
            company: true,
            location: true,
            salary: true,
            jobType: true,
            workMode: true,
            status: true,
            isConfidential: true,
            user: {
              select: {
                companyRequest: {
                  select: { logoUrl: true }
                }
              }
            }
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    // Sanitizar vacantes confidenciales y agregar logoUrl
    const sanitizedApplications = applications.map(app => {
      const logoUrl = app.job?.user?.companyRequest?.logoUrl || null;
      // Remover user anidado del job
      const jobWithoutUser = app.job ? {
        id: app.job.id,
        title: app.job.title,
        company: app.job.company,
        location: app.job.location,
        salary: app.job.salary,
        jobType: app.job.jobType,
        workMode: app.job.workMode,
        status: app.job.status,
        isConfidential: app.job.isConfidential,
        logoUrl: app.job.isConfidential ? null : logoUrl, // Ocultar logo si es confidencial
      } : null;

      if (app.job?.isConfidential) {
        return {
          ...app,
          job: {
            ...jobWithoutUser,
            company: 'Empresa Confidencial',
            location: app.job.location?.includes(',')
              ? app.job.location.split(',').pop()?.trim() || app.job.location
              : app.job.location,
            logoUrl: null, // Asegurar que el logo esté oculto
          }
        };
      }
      return { ...app, job: jobWithoutUser };
    });

    // Calcular estadísticas
    const stats = {
      total: sanitizedApplications.length,
      pending: sanitizedApplications.filter((app) => app.status === 'pending').length,
      reviewing: sanitizedApplications.filter((app) => app.status === 'reviewing')
        .length,
      interviewed: sanitizedApplications.filter((app) => app.status === 'interviewed')
        .length,
      accepted: sanitizedApplications.filter((app) => app.status === 'accepted').length,
      rejected: sanitizedApplications.filter((app) => app.status === 'rejected').length
    };

    return NextResponse.json({
      success: true,
      data: {
        applications: sanitizedApplications,
        stats
      }
    });
  } catch (error) {
    console.error('Error fetching user applications:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Error al obtener aplicaciones'
      },
      { status: 500 }
    );
  }
}
