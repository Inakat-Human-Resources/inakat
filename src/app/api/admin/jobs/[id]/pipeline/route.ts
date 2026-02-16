// RUTA: src/app/api/admin/jobs/[id]/pipeline/route.ts

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyToken } from '@/lib/auth';
import { cookies } from 'next/headers';

// Middleware para verificar que es admin
async function verifyAdmin() {
  const cookieStore = await cookies();
  const token = cookieStore.get('auth-token')?.value;

  if (!token) {
    return { error: 'No autenticado', status: 401 };
  }

  const payload = verifyToken(token);
  if (!payload?.userId) {
    return { error: 'Token inválido', status: 401 };
  }

  const user = await prisma.user.findUnique({
    where: { id: payload.userId }
  });

  if (!user || user.role !== 'admin') {
    return { error: 'Acceso denegado - Solo administradores', status: 403 };
  }

  return { user };
}

/**
 * GET /api/admin/jobs/[id]/pipeline
 * Retorna desglose de candidatos por etapa para una vacante
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await verifyAdmin();
    if ('error' in auth) {
      return NextResponse.json(
        { success: false, error: auth.error },
        { status: auth.status }
      );
    }

    const { id } = await params;
    const jobId = parseInt(id);

    if (isNaN(jobId)) {
      return NextResponse.json(
        { success: false, error: 'ID de vacante inválido' },
        { status: 400 }
      );
    }

    // Verificar que la vacante existe
    const job = await prisma.job.findUnique({
      where: { id: jobId },
      select: { id: true, title: true, company: true, status: true }
    });

    if (!job) {
      return NextResponse.json(
        { success: false, error: 'Vacante no encontrada' },
        { status: 404 }
      );
    }

    // Obtener todas las aplicaciones de esta vacante
    const applications = await prisma.application.findMany({
      where: { jobId },
      select: {
        id: true,
        candidateName: true,
        candidateEmail: true,
        status: true,
        createdAt: true,
        updatedAt: true
      },
      orderBy: { updatedAt: 'desc' }
    });

    // Contar por status
    const countByStatus: Record<string, number> = {};
    for (const app of applications) {
      countByStatus[app.status] = (countByStatus[app.status] || 0) + 1;
    }

    // Agrupar en etapas
    const stages = {
      recruiter: {
        pending: (countByStatus['pending'] || 0) + (countByStatus['injected_by_admin'] || 0),
        reviewing: countByStatus['reviewing'] || 0,
        sent_to_specialist: countByStatus['sent_to_specialist'] || 0,
        discarded: countByStatus['discarded'] || 0
      },
      specialist: {
        evaluating: countByStatus['evaluating'] || 0,
        sent_to_company: countByStatus['sent_to_company'] || 0
      },
      company: {
        interested: countByStatus['company_interested'] || 0,
        interviewed: countByStatus['interviewed'] || 0,
        rejected: countByStatus['rejected'] || 0,
        accepted: countByStatus['accepted'] || 0
      }
    };

    // Totales por etapa
    const recruiterTotal = stages.recruiter.pending + stages.recruiter.reviewing +
      stages.recruiter.sent_to_specialist + stages.recruiter.discarded;
    const specialistTotal = stages.specialist.evaluating + stages.specialist.sent_to_company;
    const companyTotal = stages.company.interested + stages.company.interviewed +
      stages.company.rejected + stages.company.accepted;

    return NextResponse.json({
      success: true,
      data: {
        job: {
          id: job.id,
          title: job.title,
          company: job.company,
          status: job.status
        },
        total: applications.length,
        stageTotals: {
          recruiter: recruiterTotal,
          specialist: specialistTotal,
          company: companyTotal
        },
        stages,
        applications
      }
    });
  } catch (error) {
    console.error('Error getting pipeline:', error);
    return NextResponse.json(
      { success: false, error: 'Error al obtener pipeline' },
      { status: 500 }
    );
  }
}
