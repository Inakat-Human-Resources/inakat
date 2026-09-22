// RUTA: src/app/api/admin/stats/route.ts

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/auth';

/**
 * GET /api/admin/stats
 * Cifras del panel de administración, contadas en la base de datos.
 *
 * Antes el dashboard las calculaba con `.length` sobre las respuestas de
 * /api/jobs, /api/admin/candidates y /api/applications, que están paginadas: los
 * totales se topaban en el tamaño de página (20/30) y, como /api/jobs devuelve
 * sólo vacantes activas por defecto, «borradores», «pausadas» y «cerradas»
 * salían siempre en 0. Eran números falsos con aspecto de ciertos.
 */
export async function GET() {
  try {
    const auth = await requireRole('admin');
    if ('error' in auth) {
      return NextResponse.json(
        { success: false, error: auth.error },
        { status: auth.status }
      );
    }

    const [
      totalJobs,
      activeJobs,
      pausedJobs,
      draftJobs,
      closedJobs,
      totalCandidates,
      totalApplications,
      pendingRequests,
      companiesAgrupadas
    ] = await Promise.all([
      prisma.job.count(),
      prisma.job.count({ where: { status: 'active' } }),
      prisma.job.count({ where: { status: 'paused' } }),
      prisma.job.count({ where: { status: 'draft' } }),
      prisma.job.count({ where: { status: 'closed' } }),
      prisma.candidate.count(),
      prisma.application.count(),
      prisma.companyRequest.count({ where: { status: 'pending' } }),
      prisma.job.groupBy({ by: ['company'] })
    ]);

    return NextResponse.json({
      success: true,
      data: {
        totalJobs,
        activeJobs,
        pausedJobs,
        draftJobs,
        closedJobs,
        totalCandidates,
        totalApplications,
        pendingRequests,
        totalCompanies: companiesAgrupadas.length
      }
    });
  } catch (error) {
    console.error('Error fetching admin stats:', error);
    return NextResponse.json(
      { success: false, error: 'Error al obtener estadísticas' },
      { status: 500 }
    );
  }
}
