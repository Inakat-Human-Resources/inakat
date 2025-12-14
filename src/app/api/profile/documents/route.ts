// RUTA: src/app/api/profile/documents/route.ts

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyToken } from '@/lib/auth';
import { cookies } from 'next/headers';
import { put, del } from '@vercel/blob';

// Obtener candidato autenticado
async function getAuthenticatedCandidate() {
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
    where: { id: payload.userId },
    include: { candidate: true }
  });

  if (!user) {
    return { error: 'Usuario no encontrado', status: 404 };
  }

  if (!user.candidate) {
    return { error: 'No tienes un perfil de candidato', status: 403 };
  }

  return { user, candidate: user.candidate };
}

/**
 * GET /api/profile/documents
 * Obtiene los documentos del candidato
 */
export async function GET() {
  try {
    const auth = await getAuthenticatedCandidate();
    if ('error' in auth) {
      return NextResponse.json(
        { success: false, error: auth.error },
        { status: auth.status }
      );
    }

    const candidate = await prisma.candidate.findUnique({
      where: { id: auth.candidate.id },
      select: {
        cvUrl: true
      }
    });

    // Por ahora solo manejamos el CV ya que no hay modelo de documentos múltiples
    // En el futuro se podría crear un modelo CandidateDocument para recomendaciones, etc.
    return NextResponse.json({
      success: true,
      data: {
        cv: candidate?.cvUrl || null
      }
    });
  } catch (error) {
    console.error('Error fetching documents:', error);
    return NextResponse.json(
      { success: false, error: 'Error al obtener documentos' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/profile/documents
 * Sube un documento (CV)
 */
export async function POST(request: Request) {
  try {
    const auth = await getAuthenticatedCandidate();
    if ('error' in auth) {
      return NextResponse.json(
        { success: false, error: auth.error },
        { status: auth.status }
      );
    }

    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const type = formData.get('type') as string || 'cv';

    if (!file) {
      return NextResponse.json(
        { success: false, error: 'No se proporcionó archivo' },
        { status: 400 }
      );
    }

    // Validar tamaño (max 5MB)
    const MAX_SIZE = 5 * 1024 * 1024;
    if (file.size > MAX_SIZE) {
      return NextResponse.json(
        { success: false, error: 'El archivo excede el tamaño máximo de 5MB' },
        { status: 400 }
      );
    }

    // Validar tipo de archivo
    const allowedExtensions = ['.pdf', '.doc', '.docx'];
    const fileName = file.name.toLowerCase();
    const hasValidExtension = allowedExtensions.some(ext => fileName.endsWith(ext));

    if (!hasValidExtension) {
      return NextResponse.json(
        { success: false, error: 'Formato no permitido. Use PDF, DOC o DOCX' },
        { status: 400 }
      );
    }

    // Subir a Vercel Blob
    const timestamp = Date.now();
    const safeName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
    const blobPath = `candidates/${auth.candidate.id}/${type}_${timestamp}_${safeName}`;

    const blob = await put(blobPath, file, {
      access: 'public',
      addRandomSuffix: false
    });

    // Si es CV, actualizar en el candidato
    if (type === 'cv') {
      // Opcional: eliminar CV anterior si existe
      if (auth.candidate.cvUrl) {
        try {
          await del(auth.candidate.cvUrl);
        } catch (e) {
          // Ignorar error si no se puede eliminar
          console.log('Could not delete old CV:', e);
        }
      }

      await prisma.candidate.update({
        where: { id: auth.candidate.id },
        data: { cvUrl: blob.url }
      });
    }

    return NextResponse.json({
      success: true,
      message: 'Documento subido exitosamente',
      data: {
        url: blob.url,
        type
      }
    });
  } catch (error) {
    console.error('Error uploading document:', error);
    return NextResponse.json(
      { success: false, error: 'Error al subir documento' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/profile/documents
 * Elimina un documento
 */
export async function DELETE(request: Request) {
  try {
    const auth = await getAuthenticatedCandidate();
    if ('error' in auth) {
      return NextResponse.json(
        { success: false, error: auth.error },
        { status: auth.status }
      );
    }

    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type') || 'cv';

    if (type === 'cv') {
      if (auth.candidate.cvUrl) {
        try {
          await del(auth.candidate.cvUrl);
        } catch (e) {
          console.log('Could not delete CV from blob:', e);
        }

        await prisma.candidate.update({
          where: { id: auth.candidate.id },
          data: { cvUrl: null }
        });
      }

      return NextResponse.json({
        success: true,
        message: 'CV eliminado'
      });
    }

    return NextResponse.json(
      { success: false, error: 'Tipo de documento no soportado' },
      { status: 400 }
    );
  } catch (error) {
    console.error('Error deleting document:', error);
    return NextResponse.json(
      { success: false, error: 'Error al eliminar documento' },
      { status: 500 }
    );
  }
}
