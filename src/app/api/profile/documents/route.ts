// RUTA: src/app/api/profile/documents/route.ts

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyToken } from '@/lib/auth';
import { cookies } from 'next/headers';

// GET - Obtener documentos del candidato
export async function GET() {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('auth-token')?.value;

    if (!token) {
      return NextResponse.json({ success: false, error: 'No autenticado' }, { status: 401 });
    }

    const payload = verifyToken(token);
    if (!payload?.userId) {
      return NextResponse.json({ success: false, error: 'Token inválido' }, { status: 401 });
    }

    const candidate = await prisma.candidate.findFirst({
      where: { userId: payload.userId },
      include: { documents: { orderBy: { createdAt: 'desc' } } }
    });

    return NextResponse.json({ success: true, data: candidate?.documents || [] });
  } catch (error) {
    console.error('Error fetching documents:', error);
    return NextResponse.json({ success: false, error: 'Error al obtener documentos' }, { status: 500 });
  }
}

// POST - Agregar documento
export async function POST(request: Request) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('auth-token')?.value;

    if (!token) {
      return NextResponse.json({ success: false, error: 'No autenticado' }, { status: 401 });
    }

    const payload = verifyToken(token);
    if (!payload?.userId) {
      return NextResponse.json({ success: false, error: 'Token inválido' }, { status: 401 });
    }

    const candidate = await prisma.candidate.findFirst({
      where: { userId: payload.userId }
    });

    if (!candidate) {
      return NextResponse.json({ success: false, error: 'Candidato no encontrado' }, { status: 404 });
    }

    const { name, fileUrl, fileType } = await request.json();

    if (!name || !fileUrl) {
      return NextResponse.json({ success: false, error: 'Nombre y URL del archivo son requeridos' }, { status: 400 });
    }

    const doc = await prisma.candidateDocument.create({
      data: {
        candidateId: candidate.id,
        name,
        fileUrl,
        fileType: fileType || null
      }
    });

    return NextResponse.json({ success: true, data: doc }, { status: 201 });
  } catch (error) {
    console.error('Error creating document:', error);
    return NextResponse.json({ success: false, error: 'Error al crear documento' }, { status: 500 });
  }
}

// DELETE - Eliminar documento
export async function DELETE(request: Request) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('auth-token')?.value;

    if (!token) {
      return NextResponse.json({ success: false, error: 'No autenticado' }, { status: 401 });
    }

    const payload = verifyToken(token);
    if (!payload?.userId) {
      return NextResponse.json({ success: false, error: 'Token inválido' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const docId = searchParams.get('id');

    if (!docId) {
      return NextResponse.json({ success: false, error: 'ID requerido' }, { status: 400 });
    }

    // Verificar que el documento pertenece al candidato del usuario
    const candidate = await prisma.candidate.findFirst({
      where: { userId: payload.userId }
    });

    if (!candidate) {
      return NextResponse.json({ success: false, error: 'Candidato no encontrado' }, { status: 404 });
    }

    const doc = await prisma.candidateDocument.findUnique({
      where: { id: parseInt(docId) }
    });

    if (!doc || doc.candidateId !== candidate.id) {
      return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 403 });
    }

    await prisma.candidateDocument.delete({ where: { id: parseInt(docId) } });

    return NextResponse.json({ success: true, message: 'Documento eliminado' });
  } catch (error) {
    console.error('Error deleting document:', error);
    return NextResponse.json({ success: false, error: 'Error al eliminar documento' }, { status: 500 });
  }
}
