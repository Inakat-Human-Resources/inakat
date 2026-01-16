// RUTA: src/app/api/debug/assignments/route.ts
// TEMPORAL - Endpoint de diagnóstico para investigar asignaciones
// TODO: Eliminar después de resolver el problema

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

/**
 * GET /api/debug/assignments
 * Diagnóstico de asignaciones de vacantes
 * SOLO PARA DEBUGGING - ELIMINAR EN PRODUCCIÓN
 */
export async function GET() {
  try {
    // 1. Obtener todos los especialistas
    const specialists = await prisma.user.findMany({
      where: { role: 'specialist' },
      select: {
        id: true,
        email: true,
        nombre: true,
        apellidoPaterno: true,
        specialty: true
      }
    });

    // 2. Obtener todas las asignaciones con detalles
    const assignments = await prisma.jobAssignment.findMany({
      include: {
        job: {
          select: {
            id: true,
            title: true,
            company: true,
            status: true
          }
        },
        recruiter: {
          select: {
            id: true,
            email: true,
            nombre: true
          }
        },
        specialist: {
          select: {
            id: true,
            email: true,
            nombre: true
          }
        }
      },
      orderBy: { assignedAt: 'desc' }
    });

    // 3. Obtener todas las applications con status relevante para especialista
    const applications = await prisma.application.findMany({
      where: {
        status: { in: ['sent_to_specialist', 'evaluating', 'sent_to_company'] }
      },
      select: {
        id: true,
        jobId: true,
        candidateName: true,
        candidateEmail: true,
        status: true,
        createdAt: true,
        updatedAt: true
      },
      orderBy: { updatedAt: 'desc' }
    });

    // 4. Análisis de problemas potenciales
    const problems: string[] = [];

    // Verificar asignaciones sin especialista
    const assignmentsWithoutSpecialist = assignments.filter(a => !a.specialistId);
    if (assignmentsWithoutSpecialist.length > 0) {
      problems.push(`${assignmentsWithoutSpecialist.length} asignaciones SIN especialista asignado`);
    }

    // Verificar asignaciones con recruiterStatus != 'sent_to_specialist'
    const assignmentsNotSentToSpecialist = assignments.filter(
      a => a.specialistId && a.recruiterStatus !== 'sent_to_specialist'
    );
    if (assignmentsNotSentToSpecialist.length > 0) {
      problems.push(`${assignmentsNotSentToSpecialist.length} asignaciones con especialista pero recruiterStatus != 'sent_to_specialist'`);
    }

    // Verificar si hay applications en 'sent_to_specialist'
    if (applications.length === 0) {
      problems.push('No hay applications con status sent_to_specialist, evaluating o sent_to_company');
    }

    // 5. Resumen detallado por vacante
    const vacancySummary = assignments.map(a => {
      const jobApplications = applications.filter(app => app.jobId === a.jobId);
      return {
        jobId: a.jobId,
        jobTitle: a.job.title,
        jobCompany: a.job.company,
        jobStatus: a.job.status,
        recruiterId: a.recruiterId,
        recruiterEmail: a.recruiter?.email || 'N/A',
        recruiterStatus: a.recruiterStatus,
        specialistId: a.specialistId,
        specialistEmail: a.specialist?.email || 'SIN ESPECIALISTA',
        specialistStatus: a.specialistStatus,
        candidatesSentToSpecialist: a.candidatesSentToSpecialist || 'ninguno',
        applicationsForSpecialist: jobApplications.length,
        applicationStatuses: jobApplications.map(app => ({
          id: app.id,
          candidate: app.candidateName,
          status: app.status
        }))
      };
    });

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      summary: {
        totalSpecialists: specialists.length,
        totalAssignments: assignments.length,
        assignmentsWithSpecialist: assignments.filter(a => a.specialistId).length,
        assignmentsReadyForSpecialist: assignments.filter(a => a.recruiterStatus === 'sent_to_specialist').length,
        totalApplicationsForSpecialist: applications.length
      },
      problems: problems.length > 0 ? problems : ['No se detectaron problemas obvios'],
      specialists: specialists.map(s => ({
        id: s.id,
        email: s.email,
        nombre: `${s.nombre} ${s.apellidoPaterno || ''}`.trim(),
        specialty: s.specialty
      })),
      vacancySummary,
      rawData: {
        assignments: assignments.map(a => ({
          id: a.id,
          jobId: a.jobId,
          recruiterId: a.recruiterId,
          specialistId: a.specialistId,
          recruiterStatus: a.recruiterStatus,
          specialistStatus: a.specialistStatus,
          candidatesSentToSpecialist: a.candidatesSentToSpecialist
        })),
        applications: applications
      }
    });
  } catch (error) {
    console.error('Debug assignments error:', error);
    return NextResponse.json(
      { success: false, error: String(error) },
      { status: 500 }
    );
  }
}
