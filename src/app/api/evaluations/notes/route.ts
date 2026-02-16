// RUTA: src/app/api/evaluations/notes/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

/**
 * GET /api/evaluations/notes?applicationId=123
 * Obtener notas de evaluación por applicationId
 */
export async function GET(request: NextRequest) {
  try {
    const userRole = request.headers.get('x-user-role');

    // Reclutadores, especialistas, admins y empresas pueden ver notas
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

    // Empresas solo ven notas públicas
    const whereClause: any = { applicationId: parseInt(applicationId) };
    if (userRole === 'company') {
      whereClause.isPublic = true;
    }

    const notes = await prisma.evaluationNote.findMany({
      where: whereClause,
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({ success: true, data: notes });
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
    const userRole = request.headers.get('x-user-role');
    const userId = request.headers.get('x-user-id');

    // Solo reclutadores y especialistas pueden crear notas
    if (!userRole || !['recruiter', 'specialist'].includes(userRole)) {
      return NextResponse.json(
        { success: false, error: 'No autorizado' },
        { status: 403 }
      );
    }

    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'Usuario no identificado' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { applicationId, content, documentUrl, documentName, isPublic } = body;

    if (!applicationId || !content || content.trim() === '') {
      return NextResponse.json(
        { success: false, error: 'applicationId y content son requeridos' },
        { status: 400 }
      );
    }

    // Verificar que la application existe
    const application = await prisma.application.findUnique({
      where: { id: parseInt(applicationId) },
    });

    if (!application) {
      return NextResponse.json(
        { success: false, error: 'Aplicación no encontrada' },
        { status: 404 }
      );
    }

    // Obtener nombre del autor para incluirlo
    const author = await prisma.user.findUnique({
      where: { id: parseInt(userId) },
      select: { nombre: true, apellidoPaterno: true }
    });

    const note = await prisma.evaluationNote.create({
      data: {
        authorId: parseInt(userId),
        authorRole: userRole,
        applicationId: parseInt(applicationId),
        content: content.trim(),
        documentUrl: documentUrl || null,
        documentName: documentName || null,
        isPublic: isPublic === true,
      },
    });

    // Agregar nombre del autor a la respuesta
    const noteWithAuthor = {
      ...note,
      authorName: author ? `${author.nombre} ${author.apellidoPaterno || ''}`.trim() : 'Usuario'
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
