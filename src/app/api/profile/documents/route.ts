// RUTA: src/app/api/profile/documents/route.ts

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';
import { applyRateLimit } from '@/lib/rate-limit';
import { del } from '@vercel/blob';

/** Máximo de documentos adicionales por candidato (#PERF-019). */
const MAX_DOCUMENTOS_POR_CANDIDATO = 20;

/** Documentos: 30 altas/bajas por hora por IP (#PERF-019). */
const DOCUMENTS_RATE_LIMIT = { maxRequests: 30, windowSeconds: 60 * 60 };

/**
 * Valida que una URL de archivo apunte a NUESTRO almacenamiento.
 *
 * Exigir sólo http(s) (#55) evitaba el XSS almacenado (javascript:, data:…)
 * pero dejaba pasar cualquier host: un candidato podía guardar
 * https://login-inakat.example/... y el reclutador lo abría con un clic desde
 * un contexto de confianza (#PERF-002).
 *
 * En desarrollo /api/upload devuelve rutas relativas '/uploads/<archivo>'
 * cuando no hay BLOB_READ_WRITE_TOKEN, así que también se aceptan fuera de
 * producción.
 */
function esUrlDeNuestroAlmacenamiento(value: unknown): value is string {
  if (typeof value !== 'string') return false;

  const limpio = value.trim();
  if (limpio === '') return false;

  // Fallback de desarrollo: /uploads/<archivo> (nunca en producción)
  if (limpio.startsWith('/uploads/')) {
    return process.env.NODE_ENV !== 'production' && !limpio.includes('..');
  }

  let parsed: URL;
  try {
    parsed = new URL(limpio);
  } catch {
    return false;
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return false;

  return parsed.hostname.endsWith('.public.blob.vercel-storage.com');
}

/**
 * Borra el blob asociado a una URL propia. Best-effort: si falla, se registra
 * y se sigue — la fila de BD ya se eliminó y no queremos romper la respuesta
 * al usuario (#PERF-003).
 */
async function borrarBlobSiEsNuestro(fileUrl: string | null | undefined) {
  if (!fileUrl || !esUrlDeNuestroAlmacenamiento(fileUrl)) return;
  if (fileUrl.startsWith('/uploads/')) return; // fallback local: no hay blob

  try {
    await del(fileUrl);
  } catch (error) {
    console.error('[Documentos] No se pudo eliminar el blob:', fileUrl, error);
  }
}

/**
 * AUTHZ (#PERF-004): antes estas rutas hacían su propia autenticación con
 * verifyToken + consulta, sin mirar isActive, así que un usuario desactivado
 * seguía escribiendo en su ficha hasta 7 días (lo que dura el JWT). requireAuth
 * consulta la base y rechaza a los inactivos.
 */
async function requireCandidate() {
  const auth = await requireAuth();
  if ('error' in auth) return auth;

  const candidate = await prisma.candidate.findFirst({
    where: { userId: auth.user.id }
  });

  if (!candidate) {
    return { error: 'Candidato no encontrado', status: 404 };
  }

  return { user: auth.user, candidate };
}

// GET - Obtener documentos del candidato
export async function GET() {
  try {
    const auth = await requireAuth();
    if ('error' in auth) {
      return NextResponse.json({ success: false, error: auth.error }, { status: auth.status });
    }

    // Un usuario sin ficha de candidato (empresa, reclutador…) simplemente no
    // tiene documentos: se responde lista vacía, como antes.
    const candidate = await prisma.candidate.findFirst({
      where: { userId: auth.user.id },
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
    const rateLimited = applyRateLimit(request, 'profile-documents', DOCUMENTS_RATE_LIMIT);
    if (rateLimited) return rateLimited;

    const auth = await requireCandidate();
    if ('error' in auth) {
      return NextResponse.json({ success: false, error: auth.error }, { status: auth.status });
    }
    const { candidate } = auth;

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ success: false, error: 'Cuerpo de la petición inválido' }, { status: 400 });
    }

    const { name, fileUrl, fileType } = (body || {}) as {
      name?: unknown;
      fileUrl?: unknown;
      fileType?: unknown;
    };

    if (!name || !fileUrl) {
      return NextResponse.json({ success: false, error: 'Nombre y URL del archivo son requeridos' }, { status: 400 });
    }

    // VALIDATION (#PERF-019): antes `name` y `fileType` entraban sin comprobar
    // tipo ni longitud.
    if (typeof name !== 'string' || name.trim().length === 0 || name.trim().length > 120) {
      return NextResponse.json(
        { success: false, error: 'El nombre del documento debe tener entre 1 y 120 caracteres' },
        { status: 400 }
      );
    }

    if (fileType !== undefined && fileType !== null) {
      if (typeof fileType !== 'string' || fileType.length > 20) {
        return NextResponse.json(
          { success: false, error: 'Tipo de archivo inválido' },
          { status: 400 }
        );
      }
    }

    if (!esUrlDeNuestroAlmacenamiento(fileUrl)) {
      return NextResponse.json(
        { success: false, error: 'URL del archivo inválida. Sube el archivo con el formulario para obtener una URL válida.' },
        { status: 400 }
      );
    }

    // VALIDATION (#PERF-019): tope de documentos por candidato; sin él, un
    // script autenticado podía crear decenas de miles de filas que después
    // arrastra cada listado de recruiter/company.
    const total = await prisma.candidateDocument.count({
      where: { candidateId: candidate.id }
    });

    if (total >= MAX_DOCUMENTOS_POR_CANDIDATO) {
      return NextResponse.json(
        { success: false, error: `Has alcanzado el máximo de ${MAX_DOCUMENTOS_POR_CANDIDATO} documentos. Elimina alguno antes de subir otro.` },
        { status: 400 }
      );
    }

    const doc = await prisma.candidateDocument.create({
      data: {
        candidateId: candidate.id,
        name: name.trim(),
        fileUrl,
        fileType: typeof fileType === 'string' && fileType ? fileType : null
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
    const rateLimited = applyRateLimit(request, 'profile-documents', DOCUMENTS_RATE_LIMIT);
    if (rateLimited) return rateLimited;

    const auth = await requireCandidate();
    if ('error' in auth) {
      return NextResponse.json({ success: false, error: auth.error }, { status: auth.status });
    }
    const { candidate } = auth;

    const { searchParams } = new URL(request.url);
    const docId = searchParams.get('id');

    if (!docId) {
      return NextResponse.json({ success: false, error: 'ID requerido' }, { status: 400 });
    }

    // VALIDATION (#PERF-019): parseInt('abc') es NaN y Prisma reventaba -> 500.
    const id = Number(docId);
    if (!Number.isInteger(id) || id <= 0) {
      return NextResponse.json({ success: false, error: 'ID inválido' }, { status: 400 });
    }

    const doc = await prisma.candidateDocument.findUnique({
      where: { id }
    });

    if (!doc || doc.candidateId !== candidate.id) {
      return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 403 });
    }

    await prisma.candidateDocument.delete({ where: { id } });

    // SECURITY (#PERF-003): borrar también el archivo. Antes sólo se borraba la
    // fila y la URL pública seguía sirviendo el documento con datos personales
    // indefinidamente (derecho de cancelación, LFPDPPP).
    await borrarBlobSiEsNuestro(doc.fileUrl);

    return NextResponse.json({ success: true, message: 'Documento eliminado' });
  } catch (error) {
    console.error('Error deleting document:', error);
    return NextResponse.json({ success: false, error: 'Error al eliminar documento' }, { status: 500 });
  }
}
