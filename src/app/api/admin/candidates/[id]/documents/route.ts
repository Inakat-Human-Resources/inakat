// RUTA: src/app/api/admin/candidates/[id]/documents/route.ts

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyToken } from '@/lib/auth';
import { cookies } from 'next/headers';

// Roles permitidos para gestionar documentos de candidatos
const ALLOWED_ROLES = ['admin', 'recruiter', 'specialist'];

// Middleware para verificar que el usuario tiene permisos
async function verifyAllowedUser() {
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

  if (!user || !ALLOWED_ROLES.includes(user.role)) {
    return { error: 'Acceso denegado - Solo administradores, reclutadores y especialistas', status: 403 };
  }

  return { user };
}

// GET - Listar documentos de un candidato
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await verifyAllowedUser();
    if ('error' in auth) {
      return NextResponse.json(
        { success: false, error: auth.error },
        { status: auth.status }
      );
    }

    const { id } = await params;
    const candidateId = parseInt(id);

    if (isNaN(candidateId)) {
      return NextResponse.json(
        { success: false, error: 'ID de candidato inválido' },
        { status: 400 }
      );
    }

    // Verificar que el candidato existe
    const candidate = await prisma.candidate.findUnique({
      where: { id: candidateId }
    });

    if (!candidate) {
      return NextResponse.json(
        { success: false, error: 'Candidato no encontrado' },
        { status: 404 }
      );
    }

    const documents = await prisma.candidateDocument.findMany({
      where: { candidateId },
      orderBy: { createdAt: 'desc' }
    });

    return NextResponse.json({
      success: true,
      data: documents
    });
  } catch (error) {
    console.error('Error fetching candidate documents:', error);
    return NextResponse.json(
      { success: false, error: 'Error al obtener documentos' },
      { status: 500 }
    );
  }
}

// POST - Agregar documento a un candidato
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await verifyAllowedUser();
    if ('error' in auth) {
      return NextResponse.json(
        { success: false, error: auth.error },
        { status: auth.status }
      );
    }

    const { id } = await params;
    const candidateId = parseInt(id);

    if (isNaN(candidateId)) {
      return NextResponse.json(
        { success: false, error: 'ID de candidato inválido' },
        { status: 400 }
      );
    }

    // Verificar que el candidato existe
    const candidate = await prisma.candidate.findUnique({
      where: { id: candidateId }
    });

    if (!candidate) {
      return NextResponse.json(
        { success: false, error: 'Candidato no encontrado' },
        { status: 404 }
      );
    }

    const body = await request.json();
    const { name, fileUrl, fileType } = body;

    if (!name || !fileUrl) {
      return NextResponse.json(
        { success: false, error: 'Nombre y URL del archivo son requeridos' },
        { status: 400 }
      );
    }

    const document = await prisma.candidateDocument.create({
      data: {
        candidateId,
        name,
        fileUrl,
        fileType: fileType || null
      }
    });

    return NextResponse.json(
      {
        success: true,
        message: 'Documento agregado exitosamente',
        data: document
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Error creating candidate document:', error);
    return NextResponse.json(
      { success: false, error: 'Error al crear documento' },
      { status: 500 }
    );
  }
}

// DELETE - Eliminar documento (por query param documentId)
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await verifyAllowedUser();
    if ('error' in auth) {
      return NextResponse.json(
        { success: false, error: auth.error },
        { status: auth.status }
      );
    }

    const { id } = await params;
    const candidateId = parseInt(id);

    if (isNaN(candidateId)) {
      return NextResponse.json(
        { success: false, error: 'ID de candidato inválido' },
        { status: 400 }
      );
    }

    const { searchParams } = new URL(request.url);
    const documentId = searchParams.get('documentId');

    if (!documentId) {
      return NextResponse.json(
        { success: false, error: 'ID de documento requerido' },
        { status: 400 }
      );
    }

    const docId = parseInt(documentId);

    // Verificar que el documento existe y pertenece al candidato
    const document = await prisma.candidateDocument.findFirst({
      where: {
        id: docId,
        candidateId
      }
    });

    if (!document) {
      return NextResponse.json(
        { success: false, error: 'Documento no encontrado' },
        { status: 404 }
      );
    }

    await prisma.candidateDocument.delete({
      where: { id: docId }
    });

    return NextResponse.json({
      success: true,
      message: 'Documento eliminado exitosamente'
    });
  } catch (error) {
    console.error('Error deleting candidate document:', error);
    return NextResponse.json(
      { success: false, error: 'Error al eliminar documento' },
      { status: 500 }
    );
  }
}
