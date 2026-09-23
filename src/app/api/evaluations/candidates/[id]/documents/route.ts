// RUTA: src/app/api/evaluations/candidates/[id]/documents/route.ts

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/auth';
import { parseId } from '@/lib/authz-applications';

/**
 * Documentos de un candidato para el STAFF que lo evalúa (#PERF-016).
 *
 * CandidateProfileModal llamaba a /api/admin/candidates/[id]/documents, que
 * vive bajo /api/admin/: para reclutadores y especialistas el botón «Agregar»
 * fallaba siempre (y el archivo ya subido quedaba huérfano en el blob). Abrir
 * esa ruta tal cual habría sido un IDOR, porque no comprueba asignación:
 * cualquier reclutador habría podido leer o añadir documentos de CUALQUIER
 * candidato por id.
 *
 * Esta ruta:
 *  - admin: siempre.
 *  - recruiter/specialist: sólo si el candidato tiene una postulación en una
 *    vacante que tengan ASIGNADA (JobAssignment.recruiterId/specialistId).
 *  - fileUrl sólo de nuestro almacenamiento (misma regla que
 *    /api/profile/documents, #PERF-002).
 *
 * El borrado sigue siendo sólo de admin (/api/admin/candidates/[id]/documents).
 */

const ROLES_PERMITIDOS = ['admin', 'recruiter', 'specialist'];

/** Longitud máxima del nombre visible del documento. */
const MAX_NOMBRE_DOCUMENTO = 120;

/** Longitud máxima de fileType (extensión: pdf, docx…). */
const MAX_TIPO_DOCUMENTO = 20;

/**
 * ¿La URL apunta a NUESTRO almacenamiento? (#PERF-002)
 *
 * En desarrollo /api/upload devuelve rutas relativas '/uploads/<archivo>'
 * cuando no hay BLOB_READ_WRITE_TOKEN; se aceptan fuera de producción.
 *
 * (Duplicado a propósito con api/profile/documents/route.ts: un route.ts no
 * puede exportar nada que no sea un handler. Centralizar en src/lib.)
 */
function esUrlDeNuestroAlmacenamiento(value: unknown): value is string {
  if (typeof value !== 'string') return false;

  const limpio = value.trim();
  if (limpio === '') return false;

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

type ResultadoAcceso =
  | { ok: true; candidateId: number }
  | { ok: false; error: string; status: number };

/**
 * Autentica, valida el id y comprueba que el usuario puede tocar los
 * documentos de este candidato.
 */
async function autorizar(idParam: string): Promise<ResultadoAcceso> {
  const auth = await requireRole(ROLES_PERMITIDOS);
  if ('error' in auth) {
    return { ok: false, error: auth.error, status: auth.status };
  }

  const candidateId = parseId(idParam);
  if (candidateId === null) {
    return { ok: false, error: 'ID de candidato inválido', status: 400 };
  }

  const candidate = await prisma.candidate.findUnique({
    where: { id: candidateId },
    select: { id: true, email: true }
  });

  if (!candidate) {
    return { ok: false, error: 'Candidato no encontrado', status: 404 };
  }

  if (auth.user.role === 'admin') {
    return { ok: true, candidateId };
  }

  // La postulación se enlaza con el expediente por correo, como en el resto
  // de rutas (Application.candidateId es nuevo y aún no está poblado).
  const filtroAsignacion =
    auth.user.role === 'recruiter'
      ? { recruiterId: auth.user.id }
      : { specialistId: auth.user.id };

  const postulacionAsignada = await prisma.application.findFirst({
    where: {
      candidateEmail: candidate.email,
      job: { assignment: filtroAsignacion }
    },
    select: { id: true }
  });

  if (!postulacionAsignada) {
    return {
      ok: false,
      error: 'No tienes asignada ninguna vacante con este candidato',
      status: 403
    };
  }

  return { ok: true, candidateId };
}

// GET - Listar documentos del candidato
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const acceso = await autorizar(id);
    if (!acceso.ok) {
      return NextResponse.json(
        { success: false, error: acceso.error },
        { status: acceso.status }
      );
    }

    const documents = await prisma.candidateDocument.findMany({
      where: { candidateId: acceso.candidateId },
      orderBy: { createdAt: 'desc' }
    });

    return NextResponse.json({ success: true, data: documents });
  } catch (error) {
    console.error('Error fetching candidate documents (evaluations):', error);
    return NextResponse.json(
      { success: false, error: 'Error al obtener documentos' },
      { status: 500 }
    );
  }
}

// POST - Agregar documento al candidato
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const acceso = await autorizar(id);
    if (!acceso.ok) {
      return NextResponse.json(
        { success: false, error: acceso.error },
        { status: acceso.status }
      );
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { success: false, error: 'Cuerpo de la petición inválido' },
        { status: 400 }
      );
    }

    const { name, fileUrl, fileType } = (body || {}) as {
      name?: unknown;
      fileUrl?: unknown;
      fileType?: unknown;
    };

    if (typeof name !== 'string' || !name.trim() || name.trim().length > MAX_NOMBRE_DOCUMENTO) {
      return NextResponse.json(
        { success: false, error: `El nombre del documento debe tener entre 1 y ${MAX_NOMBRE_DOCUMENTO} caracteres` },
        { status: 400 }
      );
    }

    if (!esUrlDeNuestroAlmacenamiento(fileUrl)) {
      return NextResponse.json(
        { success: false, error: 'URL del archivo inválida. Sube el archivo con el formulario para obtener una URL válida.' },
        { status: 400 }
      );
    }

    if (
      fileType !== undefined &&
      fileType !== null &&
      (typeof fileType !== 'string' || fileType.length > MAX_TIPO_DOCUMENTO)
    ) {
      return NextResponse.json(
        { success: false, error: 'Tipo de archivo inválido' },
        { status: 400 }
      );
    }

    const document = await prisma.candidateDocument.create({
      data: {
        candidateId: acceso.candidateId,
        name: name.trim(),
        fileUrl: fileUrl.trim(),
        fileType: typeof fileType === 'string' && fileType ? fileType : null
      }
    });

    return NextResponse.json(
      { success: true, message: 'Documento agregado exitosamente', data: document },
      { status: 201 }
    );
  } catch (error) {
    console.error('Error creating candidate document (evaluations):', error);
    return NextResponse.json(
      { success: false, error: 'Error al crear documento' },
      { status: 500 }
    );
  }
}
