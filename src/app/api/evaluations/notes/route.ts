// RUTA: src/app/api/evaluations/notes/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { isSafeHttpUrl } from '@/lib/sanitize';
import { requireRole } from '@/lib/auth';
import {
  canAccessJob,
  canCompanySeeApplication,
  jobAuthInfoFromApplication,
  loadApplicationForAuth,
  parseId,
} from '@/lib/authz-applications';

// Longitudes máximas de lo que se guarda en la nota.
const MAX_CONTENT_LENGTH = 5000;
const MAX_DOCUMENT_NAME_LENGTH = 255;

/**
 * ¿Apunta el adjunto a NUESTRO almacenamiento? El modal sube el archivo por
 * /api/upload (Vercel Blob, o '/uploads/<archivo>' en desarrollo) y luego
 * manda aquí esa URL. Exigir sólo http(s) dejaba pasar cualquier host: una
 * cuenta de staff comprometida podía colgar en una nota pública un enlace de
 * phishing llamado "Reporte psicométrico.pdf" que la empresa abre con un clic.
 * Misma regla que /api/profile/documents.
 */
function isOwnStorageUrl(value: unknown): value is string {
  if (!isSafeHttpUrl(value)) {
    // Fallback de desarrollo: ruta relativa, nunca en producción.
    return (
      typeof value === 'string' &&
      value.startsWith('/uploads/') &&
      !value.includes('..') &&
      process.env.NODE_ENV !== 'production'
    );
  }
  return new URL(value).hostname.endsWith('.public.blob.vercel-storage.com');
}

/**
 * GET /api/evaluations/notes?applicationId=123
 * Obtener notas de evaluación por applicationId
 */
export async function GET(request: NextRequest) {
  try {
    // Reclutadores, especialistas, admins y empresas pueden ver notas.
    // Se resuelve contra la BASE (requireRole consulta rol e isActive), no
    // contra los headers del JWT: un usuario desactivado o degradado conservaba
    // acceso hasta 7 días con la misma cookie.
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

    if (!canAccessJob({ id: user.id, role: userRole }, jobAuthInfoFromApplication(application))) {
      return NextResponse.json(
        { success: false, error: 'No autorizado para esta aplicación' },
        { status: 403 }
      );
    }

    // Para empresa: además, la application debe estar en un status visible.
    // Ser dueña de la vacante no basta: sin esto leía las notas públicas (y el
    // adjunto) de candidatos que INAKAT nunca le presentó o ya descartó.
    if (userRole === 'company' && !canCompanySeeApplication(application.status)) {
      return NextResponse.json(
        { success: false, error: 'Aplicación no accesible' },
        { status: 403 }
      );
    }

    // Empresas solo ven notas públicas
    const whereClause: { applicationId: number; isPublic?: boolean } = { applicationId: appId };
    if (userRole === 'company') {
      whereClause.isPublic = true;
    }

    const notes = await prisma.evaluationNote.findMany({
      where: whereClause,
      orderBy: { createdAt: 'desc' },
      // A la empresa no le corresponde el id interno del staff que escribió.
      ...(userRole === 'company'
        ? {
            select: {
              id: true,
              authorRole: true,
              content: true,
              documentUrl: true,
              documentName: true,
              isPublic: true,
              createdAt: true,
            },
          }
        : {}),
    });

    // EVAL-020: el staff ve qué notas puede editar o retirar (las suyas; el
    // admin, todas), la misma regla que aplica PATCH/DELETE /notes/[id].
    const data =
      userRole === 'company'
        ? notes
        : notes.map((nota) => ({
            ...nota,
            canEdit:
              userRole === 'admin' ||
              (nota as { authorId?: number }).authorId === user.id,
          }));

    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error('Error al obtener notas:', error);
    return NextResponse.json(
      { success: false, error: 'Error interno' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/evaluations/notes
 * Crear una nota de evaluación
 */
export async function POST(request: NextRequest) {
  try {
    // Solo reclutadores y especialistas pueden crear notas. Rol e isActive se
    // leen de la base, no del JWT (ver comentario del GET).
    const auth = await requireRole(['recruiter', 'specialist']);
    if ('error' in auth) {
      return NextResponse.json(
        { success: false, error: auth.error },
        { status: auth.status }
      );
    }

    const { user } = auth;
    const userRole = user.role;

    const body = await request.json();
    const { applicationId, content, documentUrl, documentName, isPublic } = body;

    const appId = parseId(applicationId);

    if (appId === null) {
      return NextResponse.json(
        { success: false, error: 'applicationId inválido' },
        { status: 400 }
      );
    }

    // `content.trim()` reventaba con un TypeError (→ 500) si no era string.
    if (typeof content !== 'string' || content.trim() === '') {
      return NextResponse.json(
        { success: false, error: 'applicationId y content son requeridos' },
        { status: 400 }
      );
    }

    // NO se pasa por sanitizeText: su regex /<[^>]*>/g borra todo lo que quede
    // entre '<' y '>', y se comía contenido legítimo de una evaluación técnica
    // ("List<String>", "pide < 30k y tiene > 5 años"). La nota se pinta como
    // texto en React, que ya escapa: el filtrado no aportaba seguridad.
    const cleanContent = content.trim();

    if (cleanContent.length > MAX_CONTENT_LENGTH) {
      return NextResponse.json(
        { success: false, error: `La nota no puede superar ${MAX_CONTENT_LENGTH} caracteres` },
        { status: 400 }
      );
    }

    // El adjunto se pinta como href en el modal y lo ve también la empresa:
    // sin validar, una cuenta comprometida podía colar un enlace de phishing
    // con nombre de "Reporte psicométrico.pdf".
    if (documentUrl != null && documentUrl !== '' && !isOwnStorageUrl(documentUrl)) {
      return NextResponse.json(
        { success: false, error: 'documentUrl debe ser un archivo subido a INAKAT' },
        { status: 400 }
      );
    }

    if (documentName != null && documentName !== '' && typeof documentName !== 'string') {
      return NextResponse.json(
        { success: false, error: 'documentName inválido' },
        { status: 400 }
      );
    }

    // Verificar que la application existe y autorizar (recruiter/specialist asignado)
    const application = await loadApplicationForAuth(appId);

    if (!application) {
      return NextResponse.json(
        { success: false, error: 'Aplicación no encontrada' },
        { status: 404 }
      );
    }

    if (!canAccessJob({ id: user.id, role: userRole }, jobAuthInfoFromApplication(application))) {
      return NextResponse.json(
        { success: false, error: 'No autorizado para esta aplicación' },
        { status: 403 }
      );
    }

    const note = await prisma.evaluationNote.create({
      data: {
        authorId: user.id,
        authorRole: userRole,
        applicationId: appId,
        content: cleanContent,
        documentUrl: documentUrl || null,
        documentName: documentName
          ? String(documentName).slice(0, MAX_DOCUMENT_NAME_LENGTH)
          : null,
        isPublic: isPublic === true,
      },
    });

    // Agregar nombre del autor a la respuesta
    const noteWithAuthor = {
      ...note,
      authorName: `${user.nombre} ${user.apellidoPaterno || ''}`.trim() || 'Usuario'
    };

    return NextResponse.json(
      { success: true, data: noteWithAuthor },
      { status: 201 }
    );
  } catch (error) {
    console.error('Error al crear nota:', error);
    return NextResponse.json(
      { success: false, error: 'Error interno' },
      { status: 500 }
    );
  }
}
