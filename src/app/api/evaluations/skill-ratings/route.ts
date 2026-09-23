// RUTA: src/app/api/evaluations/skill-ratings/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/auth';
import {
  canAccessJob,
  canCompanySeeApplication,
  jobAuthInfoFromApplication,
  loadApplicationForAuth,
  parseId,
} from '@/lib/authz-applications';

// Límites de lo que se acepta en un POST de calificaciones.
const MAX_RATINGS = 50;
const MAX_SKILL_NAME_LENGTH = 100;
const MAX_COMMENT_LENGTH = 500;

// El especialista sólo califica mientras la postulación está en sus manos.
const RATEABLE_STATUSES = ['sent_to_specialist', 'evaluating'];

/**
 * GET /api/evaluations/skill-ratings?applicationId=123
 * Obtener calificaciones de habilidades de una aplicación
 */
export async function GET(request: NextRequest) {
  try {
    // Rol e isActive se leen de la base, no de los headers del JWT: un usuario
    // desactivado conservaba acceso durante toda la vida del token.
    const auth = await requireRole(['recruiter', 'specialist', 'admin', 'company']);
    if ('error' in auth) {
      return NextResponse.json(
        { success: false, error: auth.error },
        { status: auth.status }
      );
    }

    const { user } = auth;
    const userRole = user.role;

    const { searchParams } = new URL(request.url);
    const applicationId = searchParams.get('applicationId');

    if (!applicationId) {
      return NextResponse.json(
        { success: false, error: 'applicationId es requerido' },
        { status: 400 }
      );
    }

    const appId = parseId(applicationId);

    if (appId === null) {
      return NextResponse.json(
        { success: false, error: 'ID inválido' },
        { status: 400 }
      );
    }

    // Autorización por ownership/asignación sobre la Application
    const application = await loadApplicationForAuth(appId);

    if (!application) {
      return NextResponse.json(
        { success: false, error: 'Aplicación no encontrada' },
        { status: 404 }
      );
    }

    const authUser = { id: user.id, role: userRole };

    if (!canAccessJob(authUser, jobAuthInfoFromApplication(application))) {
      return NextResponse.json(
        { success: false, error: 'No autorizado para esta aplicación' },
        { status: 403 }
      );
    }

    // Para empresa: además, la application debe estar en un status visible
    if (userRole === 'company' && !canCompanySeeApplication(application.status)) {
      return NextResponse.json(
        { success: false, error: 'Aplicación no accesible' },
        { status: 403 }
      );
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
    // Rol e isActive desde la base, no desde los headers del JWT.
    const auth = await requireRole(['specialist', 'admin']);
    if ('error' in auth) {
      return NextResponse.json(
        {
          success: false,
          error: auth.status === 403
            ? 'No autorizado - Solo especialistas o admins'
            : auth.error
        },
        { status: auth.status }
      );
    }

    const { user } = auth;
    const userRole = user.role;

    const body = await request.json();
    const { applicationId, ratings } = body;

    const appId = parseId(applicationId);

    if (appId === null) {
      return NextResponse.json(
        { success: false, error: 'applicationId inválido' },
        { status: 400 }
      );
    }

    if (!Array.isArray(ratings) || ratings.length === 0) {
      return NextResponse.json(
        { success: false, error: 'applicationId y ratings son requeridos' },
        { status: 400 }
      );
    }

    if (ratings.length > MAX_RATINGS) {
      return NextResponse.json(
        { success: false, error: `No se pueden guardar más de ${MAX_RATINGS} habilidades` },
        { status: 400 }
      );
    }

    // Validar y normalizar cada rating. `rating` se comprueba como ENTERO:
    // 4.5, '5' o true pasaban la comparación numérica y reventaban al llegar a
    // la columna Int de Prisma, devolviendo un 500 en vez de un 400.
    const cleanRatings: Array<{ skillName: string; rating: number; comment: string | null }> = [];
    const seenSkills = new Set<string>();

    for (const r of ratings) {
      if (!r || typeof r.skillName !== 'string' || r.skillName.trim() === '') {
        return NextResponse.json(
          { success: false, error: 'Cada rating debe tener skillName' },
          { status: 400 }
        );
      }

      const skillName = r.skillName.trim();

      if (skillName.length > MAX_SKILL_NAME_LENGTH) {
        return NextResponse.json(
          { success: false, error: `"${skillName.slice(0, 30)}…" supera ${MAX_SKILL_NAME_LENGTH} caracteres` },
          { status: 400 }
        );
      }

      if (!Number.isInteger(r.rating) || r.rating < 1 || r.rating > 5) {
        return NextResponse.json(
          { success: false, error: `Rating para "${skillName}" debe ser un entero entre 1 y 5` },
          { status: 400 }
        );
      }

      if (r.comment != null && typeof r.comment !== 'string') {
        return NextResponse.json(
          { success: false, error: `Comentario inválido para "${skillName}"` },
          { status: 400 }
        );
      }

      if (typeof r.comment === 'string' && r.comment.length > MAX_COMMENT_LENGTH) {
        return NextResponse.json(
          { success: false, error: `El comentario de "${skillName}" supera ${MAX_COMMENT_LENGTH} caracteres` },
          { status: 400 }
        );
      }

      // Deduplicar: dos entradas con la misma skill competían sobre el unique
      // (applicationId, skillName) y podían dar P2002 con escritura parcial.
      const key = skillName.toLowerCase();
      if (seenSkills.has(key)) continue;
      seenSkills.add(key);

      cleanRatings.push({
        skillName,
        rating: r.rating,
        comment: r.comment ? r.comment : null
      });
    }

    // Verificar que la aplicación existe y autorizar (specialist asignado o admin)
    const application = await loadApplicationForAuth(appId);

    if (!application) {
      return NextResponse.json(
        { success: false, error: 'Aplicación no encontrada' },
        { status: 404 }
      );
    }

    const authUser = { id: user.id, role: userRole };

    if (!canAccessJob(authUser, jobAuthInfoFromApplication(application))) {
      return NextResponse.json(
        { success: false, error: 'No autorizado para esta aplicación' },
        { status: 403 }
      );
    }

    // El especialista califica mientras evalúa, no después: sin esto podía
    // cambiar las notas de un candidato ya aceptado por la empresa (y esas
    // filas se le muestran a ella y viajan a Worky2).
    if (userRole === 'specialist' && !RATEABLE_STATUSES.includes(application.status)) {
      return NextResponse.json(
        { success: false, error: 'La postulación no está en evaluación' },
        { status: 403 }
      );
    }

    // Todo o nada: en Promise.all un P2002 dejaba parte de las filas escritas.
    const results = await prisma.$transaction(
      cleanRatings.map(r =>
        prisma.skillRating.upsert({
          where: {
            applicationId_skillName: {
              applicationId: appId,
              skillName: r.skillName
            }
          },
          update: {
            rating: r.rating,
            comment: r.comment,
            ratedById: user.id
          },
          create: {
            applicationId: appId,
            skillName: r.skillName,
            rating: r.rating,
            comment: r.comment,
            ratedById: user.id
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
