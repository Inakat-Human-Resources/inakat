// RUTA: src/app/api/evaluations/skill-ratings/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// Status de aplicaciones visibles para la empresa
const COMPANY_VISIBLE_STATUSES = [
  'sent_to_company',
  'company_interested',
  'interviewed',
  'accepted',
  'rejected'
];

/**
 * GET /api/evaluations/skill-ratings?applicationId=123
 * Obtener calificaciones de habilidades de una aplicación
 */
export async function GET(request: NextRequest) {
  try {
    const userRole = request.headers.get('x-user-role');

    if (!userRole || !['recruiter', 'specialist', 'admin', 'company'].includes(userRole)) {
      return NextResponse.json(
        { success: false, error: 'No autorizado' },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const applicationId = searchParams.get('applicationId');

    if (!applicationId) {
      return NextResponse.json(
        { success: false, error: 'applicationId es requerido' },
        { status: 400 }
      );
    }

    const appId = parseInt(applicationId);

    // Para empresa: verificar que la application esté en status visible
    if (userRole === 'company') {
      const application = await prisma.application.findUnique({
        where: { id: appId },
        select: { status: true }
      });

      if (!application || !COMPANY_VISIBLE_STATUSES.includes(application.status)) {
        return NextResponse.json(
          { success: false, error: 'Aplicación no accesible' },
          { status: 403 }
        );
      }
    }

    const ratings = await prisma.skillRating.findMany({
      where: { applicationId: appId },
      include: {
        ratedBy: {
          select: { nombre: true, apellidoPaterno: true }
        }
      },
      orderBy: { createdAt: 'asc' }
    });

    const data = ratings.map(r => ({
      id: r.id,
      skillName: r.skillName,
      rating: r.rating,
      comment: r.comment,
      ratedBy: {
        nombre: `${r.ratedBy.nombre} ${r.ratedBy.apellidoPaterno || ''}`.trim()
      },
      updatedAt: r.updatedAt
    }));

    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error('Error al obtener skill ratings:', error);
    return NextResponse.json(
      { success: false, error: 'Error interno' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/evaluations/skill-ratings
 * Guardar calificaciones de habilidades (upsert)
 */
export async function POST(request: NextRequest) {
  try {
    const userId = request.headers.get('x-user-id');
    const userRole = request.headers.get('x-user-role');

    if (!userId || !userRole || !['specialist', 'admin'].includes(userRole)) {
      return NextResponse.json(
        { success: false, error: 'No autorizado - Solo especialistas o admins' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { applicationId, ratings } = body;

    if (!applicationId || !Array.isArray(ratings) || ratings.length === 0) {
      return NextResponse.json(
        { success: false, error: 'applicationId y ratings son requeridos' },
        { status: 400 }
      );
    }

    // Validar cada rating
    for (const r of ratings) {
      if (!r.skillName || typeof r.skillName !== 'string') {
        return NextResponse.json(
          { success: false, error: 'Cada rating debe tener skillName' },
          { status: 400 }
        );
      }
      if (!r.rating || r.rating < 1 || r.rating > 5) {
        return NextResponse.json(
          { success: false, error: `Rating para "${r.skillName}" debe ser entre 1 y 5` },
          { status: 400 }
        );
      }
    }

    // Verificar que la aplicación existe
    const application = await prisma.application.findUnique({
      where: { id: parseInt(applicationId) }
    });

    if (!application) {
      return NextResponse.json(
        { success: false, error: 'Aplicación no encontrada' },
        { status: 404 }
      );
    }

    // Upsert cada rating
    const results = await Promise.all(
      ratings.map(r =>
        prisma.skillRating.upsert({
          where: {
            applicationId_skillName: {
              applicationId: parseInt(applicationId),
              skillName: r.skillName
            }
          },
          update: {
            rating: r.rating,
            comment: r.comment || null,
            ratedById: parseInt(userId)
          },
          create: {
            applicationId: parseInt(applicationId),
            skillName: r.skillName,
            rating: r.rating,
            comment: r.comment || null,
            ratedById: parseInt(userId)
          }
        })
      )
    );

    return NextResponse.json({
      success: true,
      data: results,
      message: 'Calificaciones guardadas'
    });
  } catch (error) {
    console.error('Error al guardar skill ratings:', error);
    return NextResponse.json(
      { success: false, error: 'Error interno' },
      { status: 500 }
    );
  }
}
