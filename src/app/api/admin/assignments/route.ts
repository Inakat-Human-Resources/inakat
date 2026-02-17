// RUTA: src/app/api/admin/assignments/route.ts

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/auth';

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

    // Obtener vacantes con sus asignaciones
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

    // Filtrar según status
    let filteredJobs = jobs;

    if (status === 'unassigned') {
      filteredJobs = jobs.filter((j) => !j.assignment);
    } else if (status === 'assigned') {
      filteredJobs = jobs.filter(
        (j) =>
          j.assignment && j.assignment.recruiterId && j.assignment.specialistId
      );
    } else if (status === 'in_progress') {
      filteredJobs = jobs.filter(
        (j) =>
          j.assignment &&
          (j.assignment.recruiterStatus === 'reviewing' ||
            j.assignment.specialistStatus === 'evaluating')
      );
    } else if (status === 'completed') {
      filteredJobs = jobs.filter(
        (j) =>
          j.assignment && j.assignment.specialistStatus === 'sent_to_company'
      );
    }

    if (recruiterId) {
      filteredJobs = filteredJobs.filter(
        (j) => j.assignment?.recruiterId === parseInt(recruiterId)
      );
    }

    if (specialistId) {
      filteredJobs = filteredJobs.filter(
        (j) => j.assignment?.specialistId === parseInt(specialistId)
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

    // Estadísticas
    const stats = {
      total: jobs.length,
      unassigned: jobs.filter((j) => !j.assignment).length,
      assigned: jobs.filter(
        (j) => j.assignment?.recruiterId && j.assignment?.specialistId
      ).length,
      inProgress: jobs.filter(
        (j) =>
          j.assignment &&
          (j.assignment.recruiterStatus === 'reviewing' ||
            j.assignment.specialistStatus === 'evaluating')
      ).length,
      completed: jobs.filter(
        (j) => j.assignment?.specialistStatus === 'sent_to_company'
      ).length
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

    if (!jobId) {
      return NextResponse.json(
        { success: false, error: 'Se requiere el ID de la vacante' },
        { status: 400 }
      );
    }

    // Verificar que la vacante existe
    const job = await prisma.job.findUnique({
      where: { id: jobId }
    });

    if (!job) {
      return NextResponse.json(
        { success: false, error: 'Vacante no encontrada' },
        { status: 404 }
      );
    }

    // Verificar que el reclutador existe y tiene el rol correcto
    if (recruiterId) {
      const recruiter = await prisma.user.findUnique({
        where: { id: recruiterId }
      });

      if (!recruiter || recruiter.role !== 'recruiter') {
        return NextResponse.json(
          { success: false, error: 'Reclutador no válido' },
          { status: 400 }
        );
      }
    }

    // Verificar que el especialista existe y tiene el rol correcto
    // También verificar si su especialidad coincide con el perfil de la vacante
    let specialtyWarning: string | null = null;

    if (specialistId) {
      const specialist = await prisma.user.findUnique({
        where: { id: specialistId }
      });

      if (!specialist || specialist.role !== 'specialist') {
        return NextResponse.json(
          { success: false, error: 'Especialista no válido' },
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

    // Crear o actualizar asignación
    const assignment = await prisma.jobAssignment.upsert({
      where: { jobId },
      update: {
        recruiterId: recruiterId || null,
        specialistId: specialistId || null
      },
      create: {
        jobId,
        recruiterId: recruiterId || null,
        specialistId: specialistId || null,
        recruiterStatus: recruiterId ? 'pending' : 'pending',
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
