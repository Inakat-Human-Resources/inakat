// RUTA: src/app/api/admin/assign-candidates/route.ts

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { createNotification } from '@/lib/notifications';

// POST - Asignar candidatos a una vacante
// Crea Applications con status "injected_by_admin"
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { jobId, candidateIds } = body;

    // Validaciones básicas
    if (!jobId) {
      return NextResponse.json(
        { success: false, error: 'El jobId es requerido' },
        { status: 400 }
      );
    }

    if (!candidateIds || !Array.isArray(candidateIds) || candidateIds.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Debes seleccionar al menos un candidato' },
        { status: 400 }
      );
    }

    // Verificar que la vacante existe
    const job = await prisma.job.findUnique({
      where: { id: parseInt(jobId) }
    });

    if (!job) {
      return NextResponse.json(
        { success: false, error: 'La vacante no existe' },
        { status: 404 }
      );
    }

    // Obtener los candidatos
    const candidates = await prisma.candidate.findMany({
      where: {
        id: { in: candidateIds.map((id: number) => parseInt(String(id))) }
      }
    });

    if (candidates.length === 0) {
      return NextResponse.json(
        { success: false, error: 'No se encontraron candidatos válidos' },
        { status: 404 }
      );
    }

    // Verificar cuáles candidatos ya están asignados a esta vacante
    const existingApplications = await prisma.application.findMany({
      where: {
        jobId: parseInt(jobId),
        candidateEmail: {
          in: candidates.map(c => c.email.toLowerCase())
        }
      },
      select: { candidateEmail: true }
    });

    const existingEmails = new Set(existingApplications.map(a => a.candidateEmail.toLowerCase()));

    // Filtrar candidatos que no estén ya asignados
    const candidatesToAssign = candidates.filter(
      c => !existingEmails.has(c.email.toLowerCase())
    );

    if (candidatesToAssign.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: 'Todos los candidatos seleccionados ya están asignados a esta vacante'
        },
        { status: 409 }
      );
    }

    // Crear las aplicaciones
    const applications = await prisma.application.createMany({
      data: candidatesToAssign.map(candidate => ({
        jobId: parseInt(jobId),
        candidateName: `${candidate.nombre} ${candidate.apellidoPaterno}${candidate.apellidoMaterno ? ' ' + candidate.apellidoMaterno : ''}`,
        candidateEmail: candidate.email.toLowerCase(),
        candidatePhone: candidate.telefono,
        cvUrl: candidate.cvUrl,
        status: 'injected_by_admin',
        notes: `Candidato inyectado por Admin. Fuente original: ${candidate.source}. Perfil: ${candidate.profile || 'N/A'}. Seniority: ${candidate.seniority || 'N/A'}.`
      }))
    });

    // Actualizar el status de los candidatos a "in_process"
    await prisma.candidate.updateMany({
      where: {
        id: { in: candidatesToAssign.map(c => c.id) }
      },
      data: {
        status: 'in_process'
      }
    });

    // Obtener las aplicaciones creadas para retornarlas
    const createdApplications = await prisma.application.findMany({
      where: {
        jobId: parseInt(jobId),
        candidateEmail: {
          in: candidatesToAssign.map(c => c.email.toLowerCase())
        },
        status: 'injected_by_admin'
      },
      include: {
        job: {
          select: {
            id: true,
            title: true,
            company: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    const skippedCount = candidates.length - candidatesToAssign.length;

    // Notificar al reclutador asignado, si existe (fire-and-forget)
    const jobAssignment = await prisma.jobAssignment.findUnique({
      where: { jobId: parseInt(jobId) },
      select: { recruiterId: true },
    });
    if (jobAssignment?.recruiterId) {
      createNotification({
        userId: jobAssignment.recruiterId,
        type: 'new_application',
        title: 'Candidatos inyectados',
        message: `Se asignaron ${candidatesToAssign.length} candidato(s) a "${job.title}".`,
        link: '/recruiter/dashboard',
        metadata: { jobId: parseInt(jobId), count: candidatesToAssign.length },
      }).catch(() => {});
    }

    return NextResponse.json({
      success: true,
      message: `${candidatesToAssign.length} candidato(s) asignado(s) exitosamente${skippedCount > 0 ? `. ${skippedCount} ya estaban asignados.` : ''}`,
      data: {
        assigned: createdApplications,
        assignedCount: candidatesToAssign.length,
        skippedCount
      }
    }, { status: 201 });

  } catch (error) {
    console.error('Error assigning candidates:', error);
    return NextResponse.json(
      { success: false, error: 'Error al asignar candidatos' },
      { status: 500 }
    );
  }
}

// GET - Obtener candidatos ya asignados a una vacante con datos del pipeline
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const jobId = searchParams.get('jobId');

    if (!jobId) {
      return NextResponse.json(
        { success: false, error: 'El jobId es requerido' },
        { status: 400 }
      );
    }

    // Obtener todas las aplicaciones de la vacante (no solo injected_by_admin)
    const applications = await prisma.application.findMany({
      where: {
        jobId: parseInt(jobId)
      },
      orderBy: {
        updatedAt: 'desc'
      }
    });

    // Obtener la asignación del job (contiene recruiter, specialist y sus notas)
    const jobAssignment = await prisma.jobAssignment.findUnique({
      where: {
        jobId: parseInt(jobId)
      },
      include: {
        recruiter: {
          select: {
            id: true,
            nombre: true,
            apellidoPaterno: true,
            email: true
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
      }
    });

    // Obtener datos enriquecidos de los candidatos
    const candidateEmails = applications.map(app => app.candidateEmail.toLowerCase());
    const candidatesFromBank = await prisma.candidate.findMany({
      where: {
        email: { in: candidateEmails, mode: 'insensitive' }
      },
      select: {
        id: true,
        email: true,
        nombre: true,
        apellidoPaterno: true,
        telefono: true,
        profile: true,
        seniority: true,
        universidad: true,
        añosExperiencia: true,
        cvUrl: true,
        linkedinUrl: true
      }
    });

    // Crear mapa de candidatos para acceso O(1)
    const candidateMap = new Map(
      candidatesFromBank.map(c => [c.email.toLowerCase(), c])
    );

    // Enriquecer aplicaciones con datos del pipeline
    const enrichedApplications = applications.map(app => {
      const candidateProfile = candidateMap.get(app.candidateEmail.toLowerCase());

      return {
        id: app.id,
        candidateName: app.candidateName,
        candidateEmail: app.candidateEmail,
        candidatePhone: app.candidatePhone,
        cvUrl: app.cvUrl,
        coverLetter: app.coverLetter,
        status: app.status,
        notes: app.notes,
        createdAt: app.createdAt,
        updatedAt: app.updatedAt,
        // Datos del candidato del banco
        candidateProfile,
        // Datos del equipo asignado
        assignedRecruiter: jobAssignment?.recruiter ? {
          id: jobAssignment.recruiter.id,
          name: `${jobAssignment.recruiter.nombre} ${jobAssignment.recruiter.apellidoPaterno || ''}`.trim()
        } : null,
        assignedSpecialist: jobAssignment?.specialist ? {
          id: jobAssignment.specialist.id,
          name: `${jobAssignment.specialist.nombre} ${jobAssignment.specialist.apellidoPaterno || ''}`.trim(),
          specialty: jobAssignment.specialist.specialty
        } : null,
        // Notas del equipo (a nivel de vacante, no de candidato individual)
        recruiterNotes: jobAssignment?.recruiterNotes || null,
        specialistNotes: jobAssignment?.specialistNotes || null,
        // Estados del proceso
        recruiterStatus: jobAssignment?.recruiterStatus || null,
        specialistStatus: jobAssignment?.specialistStatus || null
      };
    });

    // Estadísticas del pipeline
    const pipelineStats = {
      total: applications.length,
      pending: applications.filter(a => a.status === 'pending').length,
      injected: applications.filter(a => a.status === 'injected_by_admin').length,
      reviewing: applications.filter(a => a.status === 'reviewing').length,
      sentToSpecialist: applications.filter(a => a.status === 'sent_to_specialist').length,
      evaluating: applications.filter(a => a.status === 'evaluating').length,
      sentToCompany: applications.filter(a => a.status === 'sent_to_company').length,
      hired: applications.filter(a => a.status === 'hired' || a.status === 'accepted').length,
      rejected: applications.filter(a => a.status === 'rejected' || a.status === 'discarded' || a.status === 'company_rejected').length
    };

    return NextResponse.json({
      success: true,
      data: enrichedApplications,
      jobAssignment: jobAssignment ? {
        id: jobAssignment.id,
        recruiter: jobAssignment.recruiter,
        specialist: jobAssignment.specialist,
        recruiterNotes: jobAssignment.recruiterNotes,
        specialistNotes: jobAssignment.specialistNotes,
        recruiterStatus: jobAssignment.recruiterStatus,
        specialistStatus: jobAssignment.specialistStatus
      } : null,
      pipelineStats,
      count: applications.length
    });

  } catch (error) {
    console.error('Error fetching assigned candidates:', error);
    return NextResponse.json(
      { success: false, error: 'Error al obtener candidatos asignados' },
      { status: 500 }
    );
  }
}
