// RUTA: src/app/api/admin/assignments/route.ts

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/auth';
import { createNotification } from '@/lib/notifications';

/**
 * Estado derivado de una vacante respecto a su equipo. Excluyentes y
 * exhaustivos: antes una asignación parcial (sólo reclutador, que la propia UI
 * permite) no caía ni en "Sin Asignar" ni en "Asignadas" y sólo aparecía
 * revisando "Todas" fila por fila.
 */
type EstadoAsignacion = 'unassigned' | 'partial' | 'assigned' | 'in_progress' | 'completed';

interface AsignacionParaEstado {
  recruiterId: number | null;
  specialistId: number | null;
  recruiterStatus: string;
  specialistStatus: string;
}

function estadoDeAsignacion(assignment: AsignacionParaEstado | null | undefined): EstadoAsignacion {
  if (!assignment || (!assignment.recruiterId && !assignment.specialistId)) {
    return 'unassigned';
  }
  if (assignment.specialistStatus === 'sent_to_company') {
    return 'completed';
  }
  // 'sent_to_specialist' (badge "Con Especialista") también es trabajo en curso
  if (
    assignment.recruiterStatus === 'reviewing' ||
    assignment.recruiterStatus === 'sent_to_specialist' ||
    assignment.specialistStatus === 'evaluating'
  ) {
    return 'in_progress';
  }
  if (assignment.recruiterId && assignment.specialistId) {
    return 'assigned';
  }
  return 'partial';
}

/**
 * Entero positivo o null (un string llegaba tal cual a Prisma y respondía 500).
 */
function idValido(value: unknown): number | null {
  if (typeof value !== 'string' && typeof value !== 'number') return null;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) return null;
  return parsed;
}

/**
 * GET /api/admin/assignments
 * Listar todas las asignaciones con filtros
 */
export async function GET(request: Request) {
  try {
    const auth = await requireRole('admin');
    if ('error' in auth) {
      return NextResponse.json(
        { success: false, error: auth.error },
        { status: auth.status }
      );
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status'); // unassigned, assigned, in_progress, completed
    const recruiterId = searchParams.get('recruiterId');
    const specialistId = searchParams.get('specialistId');

    // Obtener vacantes con sus asignaciones.
    // Se incluye isActive del equipo asignado: el select de la UI sólo ofrece
    // usuarios activos, así que un reclutador desactivado aparecía como
    // "Sin asignar" aunque la vacante siguiera a su cargo.
    const jobs = await prisma.job.findMany({
      where: {
        status: 'active'
      },
      include: {
        assignment: {
          include: {
            recruiter: {
              select: {
                id: true,
                nombre: true,
                apellidoPaterno: true,
                email: true,
                isActive: true
              }
            },
            specialist: {
              select: {
                id: true,
                nombre: true,
                apellidoPaterno: true,
                email: true,
                specialty: true,
                isActive: true
              }
            }
          }
        },
        user: {
          select: {
            id: true,
            nombre: true,
            companyRequest: {
              select: {
                nombreEmpresa: true
              }
            }
          }
        },
        _count: {
          select: {
            applications: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    // Filtrar según status, usando el mismo helper que las estadísticas para
    // que filtro, tarjetas y badges no puedan discrepar.
    let filteredJobs = jobs;

    const ESTADOS_FILTRABLES: EstadoAsignacion[] = [
      'unassigned',
      'partial',
      'assigned',
      'in_progress',
      'completed'
    ];

    if (status && ESTADOS_FILTRABLES.includes(status as EstadoAsignacion)) {
      filteredJobs = jobs.filter((j) => estadoDeAsignacion(j.assignment) === status);
    }

    const recruiterIdNum = idValido(recruiterId);
    if (recruiterIdNum) {
      filteredJobs = filteredJobs.filter(
        (j) => j.assignment?.recruiterId === recruiterIdNum
      );
    }

    const specialistIdNum = idValido(specialistId);
    if (specialistIdNum) {
      filteredJobs = filteredJobs.filter(
        (j) => j.assignment?.specialistId === specialistIdNum
      );
    }

    // Obtener reclutadores y especialistas disponibles
    const recruiters = await prisma.user.findMany({
      where: { role: 'recruiter', isActive: true },
      select: { id: true, nombre: true, apellidoPaterno: true, email: true }
    });

    const specialists = await prisma.user.findMany({
      where: { role: 'specialist', isActive: true },
      select: {
        id: true,
        nombre: true,
        apellidoPaterno: true,
        email: true,
        specialty: true
      }
    });

    // Estadísticas: estados excluyentes, así que las cifras SÍ suman el total.
    const estados = jobs.map((j) => estadoDeAsignacion(j.assignment));
    const stats = {
      total: jobs.length,
      unassigned: estados.filter((e) => e === 'unassigned').length,
      partial: estados.filter((e) => e === 'partial').length,
      assigned: estados.filter((e) => e === 'assigned').length,
      inProgress: estados.filter((e) => e === 'in_progress').length,
      completed: estados.filter((e) => e === 'completed').length
    };

    return NextResponse.json({
      success: true,
      data: filteredJobs,
      recruiters,
      specialists,
      stats
    });
  } catch (error) {
    console.error('Error fetching assignments:', error);
    return NextResponse.json(
      { success: false, error: 'Error al obtener asignaciones' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/assignments
 * Crear o actualizar asignación de vacante
 */
export async function POST(request: Request) {
  try {
    const auth = await requireRole('admin');
    if ('error' in auth) {
      return NextResponse.json(
        { success: false, error: auth.error },
        { status: auth.status }
      );
    }

    const body = await request.json();
    const { jobId, recruiterId, specialistId } = body;

    const jobIdNum = idValido(jobId);
    if (!jobIdNum) {
      return NextResponse.json(
        { success: false, error: 'Se requiere el ID de la vacante (entero positivo)' },
        { status: 400 }
      );
    }

    // recruiterId / specialistId: null o vacío significa "sin asignar"
    const recruiterIdNum = recruiterId ? idValido(recruiterId) : null;
    if (recruiterId && !recruiterIdNum) {
      return NextResponse.json(
        { success: false, error: 'El ID del reclutador debe ser un entero positivo' },
        { status: 400 }
      );
    }

    const specialistIdNum = specialistId ? idValido(specialistId) : null;
    if (specialistId && !specialistIdNum) {
      return NextResponse.json(
        { success: false, error: 'El ID del especialista debe ser un entero positivo' },
        { status: 400 }
      );
    }

    // Verificar que la vacante existe
    const job = await prisma.job.findUnique({
      where: { id: jobIdNum }
    });

    if (!job) {
      return NextResponse.json(
        { success: false, error: 'Vacante no encontrada' },
        { status: 404 }
      );
    }

    // Ni cerradas ni borradores (un borrador aún no se publica ni se paga).
    if (job.status === 'closed' || job.status === 'draft') {
      return NextResponse.json(
        {
          success: false,
          error: job.status === 'closed'
            ? 'No se puede asignar equipo a una vacante cerrada'
            : 'No se puede asignar equipo a una vacante en borrador'
        },
        { status: 409 }
      );
    }

    // Verificar que el reclutador existe, tiene el rol correcto y sigue ACTIVO:
    // el select de la UI sólo ofrece activos, pero un id desactivado reenviado
    // desde el estado del formulario dejaba la vacante a cargo de alguien que ya
    // no puede iniciar sesión.
    if (recruiterIdNum) {
      const recruiter = await prisma.user.findUnique({
        where: { id: recruiterIdNum }
      });

      if (!recruiter || recruiter.role !== 'recruiter') {
        return NextResponse.json(
          { success: false, error: 'Reclutador no válido' },
          { status: 400 }
        );
      }

      if (!recruiter.isActive) {
        return NextResponse.json(
          { success: false, error: 'El reclutador seleccionado está desactivado' },
          { status: 400 }
        );
      }
    }

    // Verificar que el especialista existe y tiene el rol correcto
    // También verificar si su especialidad coincide con el perfil de la vacante
    let specialtyWarning: string | null = null;

    if (specialistIdNum) {
      const specialist = await prisma.user.findUnique({
        where: { id: specialistIdNum }
      });

      if (!specialist || specialist.role !== 'specialist') {
        return NextResponse.json(
          { success: false, error: 'Especialista no válido' },
          { status: 400 }
        );
      }

      if (!specialist.isActive) {
        return NextResponse.json(
          { success: false, error: 'El especialista seleccionado está desactivado' },
          { status: 400 }
        );
      }

      // Validar que la especialidad del especialista coincide con el perfil de la vacante
      if (specialist.specialty && job.profile) {
        if (specialist.specialty !== job.profile) {
          specialtyWarning = `Advertencia: La especialidad del especialista (${specialist.specialty}) no coincide con el perfil de la vacante (${job.profile}). La asignación se realizó de todas formas.`;
        }
      }
    }

    // Asignación previa: hace falta para no re-notificar a quien no cambió.
    const asignacionPrevia = await prisma.jobAssignment.findUnique({
      where: { jobId: jobIdNum },
      select: { recruiterId: true, specialistId: true }
    });

    // Crear o actualizar asignación
    const assignment = await prisma.jobAssignment.upsert({
      where: { jobId: jobIdNum },
      update: {
        recruiterId: recruiterIdNum,
        specialistId: specialistIdNum
      },
      create: {
        jobId: jobIdNum,
        recruiterId: recruiterIdNum,
        specialistId: specialistIdNum,
        recruiterStatus: 'pending',
        specialistStatus: 'pending'
      },
      include: {
        job: true,
        recruiter: {
          select: { id: true, nombre: true, apellidoPaterno: true, email: true }
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

    // Notificar SÓLO a quien cambió: la UI reenvía siempre ambos ids, así que
    // añadir al especialista volvía a avisar al reclutador de una vacante que ya
    // tenía desde hacía días.
    // Se esperan las promesas antes de responder: en serverless la función puede
    // congelarse al devolver la respuesta y el insert no llegaba a ejecutarse;
    // además el `.catch(() => {})` vacío se tragaba cualquier error.
    const notificaciones: Array<Promise<unknown>> = [];

    if (recruiterIdNum && recruiterIdNum !== asignacionPrevia?.recruiterId && assignment.job) {
      notificaciones.push(
        createNotification({
          userId: recruiterIdNum,
          type: 'assignment',
          title: 'Nueva vacante asignada',
          message: `Se te asignó la vacante "${assignment.job.title}".`,
          link: '/recruiter/dashboard',
          metadata: { jobId: jobIdNum, jobTitle: assignment.job.title },
        })
      );
    }
    if (specialistIdNum && specialistIdNum !== asignacionPrevia?.specialistId && assignment.job) {
      notificaciones.push(
        createNotification({
          userId: specialistIdNum,
          type: 'assignment',
          title: 'Nueva vacante asignada',
          message: `Se te asignó la vacante "${assignment.job.title}". La verás en tu panel cuando el reclutador te envíe candidatos.`,
          link: '/specialist/dashboard',
          metadata: { jobId: jobIdNum, jobTitle: assignment.job.title },
        })
      );
    }

    if (notificaciones.length > 0) {
      const resultados = await Promise.allSettled(notificaciones);
      resultados
        .filter((r): r is PromiseRejectedResult => r.status === 'rejected')
        .forEach((r) => console.error('[assignments] notificación fallida:', r.reason));
    }

    return NextResponse.json({
      success: true,
      message: 'Asignación guardada exitosamente',
      warning: specialtyWarning,
      data: assignment
    });
  } catch (error) {
    console.error('Error creating assignment:', error);
    return NextResponse.json(
      { success: false, error: 'Error al guardar asignación' },
      { status: 500 }
    );
  }
}
