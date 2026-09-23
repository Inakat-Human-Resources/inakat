// RUTA: src/app/api/admin/assign-candidates/route.ts

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { createNotification } from '@/lib/notifications';
import { requireRole } from '@/lib/auth';

// Estados de candidato a los que tiene sentido inyectar en una vacante.
const ESTADOS_INYECTABLES = ['available', 'in_process'];

// Tope de candidatos por petición (evita un createMany desmedido).
const MAX_CANDIDATOS_POR_ASIGNACION = 200;

/**
 * Entero positivo o null. `parseInt('abc')` daba NaN, Prisma lanzaba y el admin
 * recibía un 500 genérico en vez de un 400.
 */
function idValido(value: unknown): number | null {
  if (typeof value !== 'string' && typeof value !== 'number') return null;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) return null;
  return parsed;
}

// POST - Asignar candidatos a una vacante
// Crea Applications con status "injected_by_admin"
export async function POST(request: Request) {
  try {
    // Defense-in-depth: verificar rol además del middleware
    const auth = await requireRole('admin');
    if ('error' in auth) {
      return NextResponse.json(
        { success: false, error: auth.error },
        { status: auth.status }
      );
    }

    const body = await request.json();
    const { jobId, candidateIds } = body;

    // Validaciones básicas
    const jobIdNum = idValido(jobId);
    if (!jobIdNum) {
      return NextResponse.json(
        { success: false, error: 'El jobId es requerido y debe ser un entero positivo' },
        { status: 400 }
      );
    }

    if (!candidateIds || !Array.isArray(candidateIds) || candidateIds.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Debes seleccionar al menos un candidato' },
        { status: 400 }
      );
    }

    if (candidateIds.length > MAX_CANDIDATOS_POR_ASIGNACION) {
      return NextResponse.json(
        { success: false, error: `No se pueden asignar más de ${MAX_CANDIDATOS_POR_ASIGNACION} candidatos a la vez` },
        { status: 400 }
      );
    }

    const idsCandidatos = candidateIds.map(idValido);
    if (idsCandidatos.some((id) => id === null)) {
      return NextResponse.json(
        { success: false, error: 'Hay candidateIds que no son enteros positivos' },
        { status: 400 }
      );
    }

    // Verificar que la vacante existe
    const job = await prisma.job.findUnique({
      where: { id: jobIdNum }
    });

    if (!job) {
      return NextResponse.json(
        { success: false, error: 'La vacante no existe' },
        { status: 404 }
      );
    }

    // No se inyecta en vacantes cerradas, pausadas o en borrador: el reclutador
    // recibía aviso de una vacante que ya no está en proceso.
    if (job.status !== 'active') {
      return NextResponse.json(
        { success: false, error: `La vacante no está activa (estado: ${job.status})` },
        { status: 409 }
      );
    }

    // Obtener los candidatos. El filtro de estado se aplica en el servidor: la
    // UI lo hacía en cliente, así que por API se podía inyectar a un candidato
    // 'hired' o 'inactive' y pisarle el estado.
    const candidates = await prisma.candidate.findMany({
      where: {
        id: { in: idsCandidatos as number[] },
        status: { in: ESTADOS_INYECTABLES }
      }
    });

    if (candidates.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: 'No se encontraron candidatos válidos (deben estar disponibles o en proceso)'
        },
        { status: 404 }
      );
    }

    const omitidosPorEstado = idsCandidatos.length - candidates.length;

    // Comprobación + creación + cambio de estado en UNA transacción: sueltos,
    // dos admins (o dos pestañas) pasaban a la vez el chequeo de duplicados, y
    // si el updateMany fallaba las Applications quedaban creadas con el
    // candidato todavía 'available'.
    // La unicidad (jobId, candidateEmail) ya está en el schema y en la
    // migración 20260922000000 (DB-008): con skipDuplicates, una asignación
    // simultánea omite en silencio a los ya asignados en vez de dar P2002/500.
    const resultado = await prisma.$transaction(async (tx) => {
      const existingApplications = await tx.application.findMany({
        where: {
          jobId: jobIdNum,
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
        return { candidatesToAssign, createdApplications: [] };
      }

      await tx.application.createMany({
        skipDuplicates: true,
        data: candidatesToAssign.map(candidate => ({
          jobId: jobIdNum,
          // AUTH-001: se vincula por userId; my-applications ya no enlaza por
          // email mientras emailVerified sea null.
          userId: candidate.userId ?? null,
          candidateName: `${candidate.nombre} ${candidate.apellidoPaterno}${candidate.apellidoMaterno ? ' ' + candidate.apellidoMaterno : ''}`,
          candidateEmail: candidate.email.toLowerCase(),
          candidatePhone: candidate.telefono,
          cvUrl: candidate.cvUrl,
          status: 'injected_by_admin'
          // Sin `notes`: el texto interno ("inyectado por Admin, fuente
          // original...") se le mostraba al candidato en /my-applications bajo
          // el rótulo "Nota de la empresa". El origen ya queda registrado en el
          // propio status 'injected_by_admin' y en Candidate.source.
        }))
      });

      // Actualizar el status de los candidatos a "in_process"
      await tx.candidate.updateMany({
        where: {
          id: { in: candidatesToAssign.map(c => c.id) }
        },
        data: {
          status: 'in_process'
        }
      });

      // Obtener las aplicaciones creadas para retornarlas
      const createdApplications = await tx.application.findMany({
        where: {
          jobId: jobIdNum,
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

      return { candidatesToAssign, createdApplications };
    });

    const { candidatesToAssign, createdApplications } = resultado;

    if (candidatesToAssign.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: 'Todos los candidatos seleccionados ya están asignados a esta vacante'
        },
        { status: 409 }
      );
    }

    const skippedCount = candidates.length - candidatesToAssign.length;

    // Notificar al reclutador asignado, si existe.
    // Se ESPERA antes de responder: en serverless la función puede congelarse
    // al devolver la respuesta y el insert no llegaba a ejecutarse, con el error
    // además tragado por un `.catch(() => {})` vacío.
    const jobAssignment = await prisma.jobAssignment.findUnique({
      where: { jobId: jobIdNum },
      select: { recruiterId: true },
    });
    if (jobAssignment?.recruiterId) {
      const resultados = await Promise.allSettled([
        createNotification({
          userId: jobAssignment.recruiterId,
          type: 'new_application',
          title: 'Candidatos inyectados',
          message: `Se asignaron ${candidatesToAssign.length} candidato(s) a "${job.title}".`,
          link: '/recruiter/dashboard',
          metadata: { jobId: jobIdNum, count: candidatesToAssign.length },
        }),
      ]);
      resultados
        .filter((r): r is PromiseRejectedResult => r.status === 'rejected')
        .forEach((r) => console.error('[assign-candidates] notificación fallida:', r.reason));
    }

    const avisoOmitidos = omitidosPorEstado > 0
      ? ` ${omitidosPorEstado} se omitieron por no estar disponibles.`
      : '';

    return NextResponse.json({
      success: true,
      message: `${candidatesToAssign.length} candidato(s) asignado(s) exitosamente${skippedCount > 0 ? `. ${skippedCount} ya estaban asignados.` : ''}${avisoOmitidos}`,
      data: {
        assigned: createdApplications,
        assignedCount: candidatesToAssign.length,
        skippedCount,
        ineligibleCount: omitidosPorEstado
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
    // Defense-in-depth: verificar rol además del middleware
    const auth = await requireRole('admin');
    if ('error' in auth) {
      return NextResponse.json(
        { success: false, error: auth.error },
        { status: auth.status }
      );
    }

    const { searchParams } = new URL(request.url);
    const jobId = searchParams.get('jobId');

    const jobIdNum = idValido(jobId);
    if (!jobIdNum) {
      return NextResponse.json(
        { success: false, error: 'El jobId es requerido y debe ser un entero positivo' },
        { status: 400 }
      );
    }

    // Obtener todas las aplicaciones de la vacante (no solo injected_by_admin)
    const applications = await prisma.application.findMany({
      where: {
        jobId: jobIdNum
      },
      orderBy: {
        updatedAt: 'desc'
      }
    });

    // Obtener la asignación del job (contiene recruiter, specialist y sus notas)
    const jobAssignment = await prisma.jobAssignment.findUnique({
      where: {
        jobId: jobIdNum
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

    // Estadísticas del pipeline.
    // Se añaden companyInterested, interviewed y archived: son estados reales
    // del schema (este mismo módulo pone 'interviewed' al confirmar una
    // entrevista) y antes no caían en ningún contador, así que los candidatos
    // más avanzados desaparecían de las tarjetas aunque `total` los contara.
    const pipelineStats = {
      total: applications.length,
      pending: applications.filter(a => a.status === 'pending').length,
      injected: applications.filter(a => a.status === 'injected_by_admin').length,
      reviewing: applications.filter(a => a.status === 'reviewing').length,
      sentToSpecialist: applications.filter(a => a.status === 'sent_to_specialist').length,
      evaluating: applications.filter(a => a.status === 'evaluating').length,
      sentToCompany: applications.filter(a => a.status === 'sent_to_company').length,
      companyInterested: applications.filter(a => a.status === 'company_interested').length,
      interviewed: applications.filter(a => a.status === 'interviewed').length,
      archived: applications.filter(a => a.status === 'archived').length,
      hired: applications.filter(a => a.status === 'accepted').length,
      rejected: applications.filter(a => a.status === 'rejected' || a.status === 'discarded').length
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
