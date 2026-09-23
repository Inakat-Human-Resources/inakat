// RUTA: src/app/api/company/dashboard/route.ts

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { COMPANY_VISIBLE_STATUSES } from '@/lib/authz-applications';

/**
 * GET /api/company/dashboard
 * Obtiene estadísticas y datos del dashboard para una empresa
 * Requiere autenticación como empresa (role: "company")
 *
 * OPTIMIZADO: Eliminadas queries N+1, usa batch queries
 */
export async function GET(request: Request) {
  try {
    // Obtener userId de los headers (agregado por middleware)
    const userId = request.headers.get('x-user-id');
    const userRole = request.headers.get('x-user-role');

    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'No autenticado' },
        { status: 401 }
      );
    }

    if (userRole !== 'company') {
      return NextResponse.json(
        { success: false, error: 'Acceso denegado. Solo empresas pueden acceder a este recurso.' },
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
            // Nombre del representante para el saludo (ver userName abajo).
            nombre: true,
            apellidoPaterno: true,
            nombreEmpresa: true,
            correoEmpresa: true,
            sitioWeb: true,
            rfc: true,
            direccionEmpresa: true,
            logoUrl: true, // FEAT-1b: Logo de empresa
            // El dashboard necesita saber si la cuenta está aprobada: las
            // acciones (publicar, ver candidatos) se bloquean en el servidor
            // hasta que un admin la apruebe, así que la UI tiene que avisarlo
            // en vez de dejar que el usuario choque contra un 403.
            status: true,
            rejectionReason: true
          }
        }
      }
    });

    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Usuario no encontrado' },
        { status: 404 }
      );
    }

    // Status de aplicaciones visibles para la empresa (lista compartida en
    // src/lib/authz-applications.ts; aquí estaba duplicada a mano).
    const estadosVisibles = [...COMPANY_VISIBLE_STATUSES];

    // 2. Obtener todas las vacantes de la empresa.
    //
    // RENDIMIENTO/PRIVACIDAD (EMP-014): antes se hacía `include: { applications }`
    // con las filas COMPLETAS (coverLetter, notes, cvUrl…) sólo para usar
    // `.length`, y luego se volvían a traer las mismas aplicaciones en
    // `allApplications`. El conteo por vacante sale ahora de esa segunda
    // consulta (ver `conteosPorJob`), y `allJobs` ya no embebe las filas.
    const jobs = await prisma.job.findMany({
      where: { userId: companyUserId },
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

    // 4. Obtener todas las aplicaciones visibles
    const jobIds = jobs.map((job) => job.id);

    const allApplications = await prisma.application.findMany({
      where: {
        jobId: { in: jobIds },
        status: { in: estadosVisibles }
      },
      include: {
        job: {
          select: {
            id: true,
            title: true,
            location: true,
            status: true,
            latitude: true,
            longitude: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    // =========================================================================
    // OPTIMIZACIÓN: Batch query para todos los candidatos
    // En lugar de N queries (una por application), hacemos 1 query con todos los emails
    // =========================================================================

    // Obtener emails únicos de todas las applications
    const uniqueEmails = [...new Set(
      allApplications.map(app => app.candidateEmail.toLowerCase())
    )];

    // Una sola query para obtener TODOS los candidatos
    const candidatesFromBank = await prisma.candidate.findMany({
      where: {
        email: { in: uniqueEmails, mode: 'insensitive' }
      },
      include: {
        experiences: {
          orderBy: { fechaInicio: 'desc' },
          take: 3
        }
      }
    });

    // Crear mapa para acceso O(1)
    const candidateMap = new Map(
      candidatesFromBank.map(c => [c.email.toLowerCase(), c])
    );

    // Enriquecer applications SIN queries adicionales
    const enrichedApplications = allApplications.map((app) => {
      const candidate = candidateMap.get(app.candidateEmail.toLowerCase());

      // SEGURIDAD (#50/#51): no exponer Application.notes (campo de notas internas)
      // a la empresa. Se elimina del spread.
      const { notes: _internalNotes, ...appPublic } = app;

      return {
        ...appPublic,
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
              // SEGURIDAD (#50/#51): NO exponer candidate.notas (notas internas del admin) a la empresa
              educacion: candidate.educacion, // FEATURE: Educación múltiple
              latitude: candidate.latitude,
              longitude: candidate.longitude
            }
          : null
        // SEGURIDAD (#50/#51): NO exponer recruiterNotes/specialistNotes (notas internas) a la empresa
      };
    });

    // 5. Calcular estadísticas de aplicaciones
    const totalApplications = allApplications.length;
    const pendingReview = allApplications.filter(
      (app) => app.status === 'sent_to_company'
    ).length;
    const interestedCandidates = allApplications.filter(
      (app) => app.status === 'company_interested'
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
    const recentApplications = enrichedApplications.slice(0, 5);

    // 7. Estadísticas por vacante
    //
    // RENDIMIENTO: antes se hacía un filter() sobre TODAS las aplicaciones por
    // cada vacante (O(vacantes × aplicaciones): con 80 vacantes y 2.000
    // candidatos son 160.000 comparaciones en cada carga del dashboard). Un
    // único recorrido agrupando por jobId da lo mismo en O(aplicaciones).
    const conteosPorJob = new Map<
      number,
      {
        totalCandidates: number;
        pendingReview: number;
        interested: number;
        interviewedCandidates: number;
        acceptedCandidates: number;
        rejectedCandidates: number;
      }
    >();

    for (const job of jobs) {
      conteosPorJob.set(job.id, {
        totalCandidates: 0,
        pendingReview: 0,
        interested: 0,
        interviewedCandidates: 0,
        acceptedCandidates: 0,
        rejectedCandidates: 0
      });
    }

    for (const app of allApplications) {
      const conteo = conteosPorJob.get(app.jobId);
      if (!conteo) continue;
      conteo.totalCandidates++;
      if (app.status === 'sent_to_company') conteo.pendingReview++;
      else if (app.status === 'company_interested') conteo.interested++;
      else if (app.status === 'interviewed') conteo.interviewedCandidates++;
      else if (app.status === 'accepted') conteo.acceptedCandidates++;
      else if (app.status === 'rejected') conteo.rejectedCandidates++;
    }

    const jobStats = jobs.map((job) => ({
      jobId: job.id,
      jobTitle: job.title,
      ...conteosPorJob.get(job.id)!
    }));

    const candidatosDe = (jobId: number) => conteosPorJob.get(jobId)?.totalCandidates ?? 0;

    // 8. Vacantes con más aplicaciones (top 5)
    const topJobs = jobs
      .map((job) => ({
        id: job.id,
        title: job.title,
        location: job.location,
        status: job.status,
        applicationCount: candidatosDe(job.id),
        salary: job.salary
      }))
      .sort((a, b) => b.applicationCount - a.applicationCount)
      .slice(0, 5);

    // El saludo sale de la SOLICITUD (nombre de pila + apellido): en el alta
    // viejo `User.nombre` ya llevaba el apellido paterno concatenado y se
    // repetía («Bienvenido, Juan Pérez Pérez»), y además es lo que la empresa
    // edita desde su perfil.
    const representante = user.companyRequest
      ? `${user.companyRequest.nombre} ${user.companyRequest.apellidoPaterno || ''}`
      : `${user.nombre} ${user.apellidoPaterno || ''}`;

    // 9. Respuesta completa
    return NextResponse.json({
      success: true,
      data: {
        company: {
          userId: user.id,
          userName: representante.trim(),
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
            pendingReview,
            interested: interestedCandidates,
            interviewed: interviewedApplications,
            accepted: acceptedApplications,
            rejected: rejectedApplications
          }
        },
        recentApplications,
        allApplications: enrichedApplications,
        topJobs,
        jobStats,
        allJobs: jobs.map((job) => {
          // SEGURIDAD (#50/#51): notasInternas es información interna de INAKAT
          // ("no visible para candidatos"), no debe exponerse a la empresa.
          const { notasInternas: _notasInternas, ...jobPublic } = job;
          return {
            ...jobPublic,
            // PRIVACIDAD (#50/#51): las vacantes ya NO embeben sus
            // applications. Venían del include completo y conservaban `notes`
            // (notas internas); la página sólo necesita el conteo.
            applicationCount: candidatosDe(job.id)
          };
        })
      }
    });
  } catch (error) {
    console.error('Error fetching company dashboard:', error);
    return NextResponse.json(
      { success: false, error: 'Error al obtener datos del dashboard' },
      { status: 500 }
    );
  }
}
