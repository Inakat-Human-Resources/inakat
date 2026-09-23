// RUTA: src/app/api/my-applications/route.ts

import { NextRequest, NextResponse } from 'next/server';
import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { getCandidateStatusLabel, getCandidateStatusView } from '@/lib/application-status';
import { publicConfidentialLocation } from '@/lib/jobs-public';

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

    const userIdNum = parseInt(userId, 10);

    // PRIVACIDAD (AUTH-001): el vínculo POR EMAIL sólo vale si la cuenta
    // demostró que controla ese correo. El registro no lo verifica, así que
    // cualquiera podía darse de alta con el correo de otra persona y leer aquí
    // las postulaciones que ella hizo como invitada (CV, teléfono, carta).
    // Mientras `emailVerified` sea null, sólo cuentan las postulaciones hechas
    // con la sesión (userId).
    const cuenta = await prisma.user.findUnique({
      where: { id: userIdNum },
      select: { emailVerified: true }
    });

    const criterios: Prisma.ApplicationWhereInput[] = [{ userId: userIdNum }];
    if (cuenta?.emailVerified) {
      criterios.push({ candidateEmail: userEmail.toLowerCase() });
    }

    // Obtener aplicaciones del usuario
    const applications = await prisma.application.findMany({
      where: {
        OR: criterios
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

      // Application.notes son notas INTERNAS (el admin escribe ahí los
      // metadatos de inyección y el equipo sus comentarios), pero la página
      // /my-applications las pintaba al candidato como "Nota de la empresa".
      // /api/candidate/applications ya las anulaba; aquí faltaba.
      // ETIQUETAS (#VAC): la página tenía su propio mapa incompleto
      // (`badges[status] || badges.pending`), así que `evaluating`,
      // `company_interested`, `discarded` y `archived` se mostraban como
      // "Pendiente". La etiqueta la decide el mapa compartido.
      const appSinNotasInternas = {
        ...app,
        notes: null,
        statusLabel: getCandidateStatusLabel(app.status),
        statusColor: getCandidateStatusView(app.status).color
      };

      if (app.job?.isConfidential) {
        return {
          ...appSinNotasInternas,
          job: {
            ...jobWithoutUser,
            company: 'Empresa Confidencial',
            // PRIVACIDAD (#VAC-022): antes, si la dirección no tenía comas se
            // devolvía COMPLETA ("Av Reforma 222 CDMX"), y con comas el último
            // segmento, que en las direcciones de Google es siempre "México".
            // La ubicación pública sale del mismo helper que usa GET /api/jobs.
            location: publicConfidentialLocation(app.job.location),
            logoUrl: null, // Asegurar que el logo esté oculto
          }
        };
      }
      return { ...appSinNotasInternas, job: jobWithoutUser };
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
