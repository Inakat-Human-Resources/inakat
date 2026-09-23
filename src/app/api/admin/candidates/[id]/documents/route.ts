// RUTA: src/app/api/admin/candidates/[id]/documents/route.ts

import { NextResponse } from 'next/server';
import { del } from '@vercel/blob';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/auth';
import { isSafeHttpUrl } from '@/lib/sanitize';

// Longitud máxima del nombre visible del documento.
const MAX_NOMBRE_DOCUMENTO = 120;

/**
 * Esta ruta vive bajo /api/admin/, y el middleware devuelve 403 a cualquier rol
 * distinto de admin: declarar aquí ['admin','recruiter','specialist'] era una
 * promesa que la plataforma nunca cumplía y, además, el handler no comprueba
 * pertenencia, así que abrirla tal cual sería un IDOR (cualquier reclutador
 * leería o borraría documentos de CUALQUIER candidato por id).
 * Reclutadores y especialistas usan /api/evaluations/candidates/[id]/documents,
 * que sí verifica la asignación a la vacante.
 */
const ROLES_PERMITIDOS = 'admin';

/**
 * ¿La URL apunta a nuestro propio almacén de blobs? Sólo esos se borran al
 * eliminar la fila; una URL externa se deja intacta.
 */
function esBlobPropio(url: string): boolean {
  try {
    return new URL(url).hostname.endsWith('.public.blob.vercel-storage.com');
  } catch {
    return false;
  }
}

/**
 * Borra el archivo del store de blobs. Nunca bloquea el borrado de la fila:
 * si falla, se registra y se sigue.
 */
async function borrarBlobSiEsPropio(url: string): Promise<void> {
  if (!esBlobPropio(url)) return;
  if (!process.env.BLOB_READ_WRITE_TOKEN) return;
  try {
    await del(url);
  } catch (error) {
    console.error('[admin/candidates/documents] No se pudo borrar el blob:', error);
  }
}

// GET - Listar documentos de un candidato
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireRole(ROLES_PERMITIDOS);
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
    const auth = await requireRole(ROLES_PERMITIDOS);
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

    if (typeof name !== 'string' || !name.trim() || name.length > MAX_NOMBRE_DOCUMENTO) {
      return NextResponse.json(
        { success: false, error: `El nombre debe ser texto de 1 a ${MAX_NOMBRE_DOCUMENTO} caracteres` },
        { status: 400 }
      );
    }

    // El fileUrl se renderiza como href para reclutadores, especialistas y
    // empresas: sólo http(s) (misma regla que /api/profile/documents).
    if (!isSafeHttpUrl(fileUrl)) {
      return NextResponse.json(
        { success: false, error: 'La URL del archivo debe ser una dirección http(s) válida' },
        { status: 400 }
      );
    }

    if (fileType !== undefined && fileType !== null && typeof fileType !== 'string') {
      return NextResponse.json(
        { success: false, error: 'fileType debe ser texto' },
        { status: 400 }
      );
    }

    const document = await prisma.candidateDocument.create({
      data: {
        candidateId,
        name: name.trim(),
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
    const auth = await requireRole(ROLES_PERMITIDOS);
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

    const docId = Number(documentId);

    if (!Number.isInteger(docId) || docId <= 0) {
      return NextResponse.json(
        { success: false, error: 'ID de documento inválido' },
        { status: 400 }
      );
    }

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

    // Borrar también el archivo: si sólo se borra la fila, el CV o la
    // identificación siguen descargables por URL indefinidamente.
    await borrarBlobSiEsPropio(document.fileUrl);

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
