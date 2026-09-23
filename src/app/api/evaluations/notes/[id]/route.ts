// RUTA: src/app/api/evaluations/notes/[id]/route.ts
//
// Editar, despublicar o borrar una nota de evaluación.
//
// Antes sólo existían GET y POST: `isPublic` se fijaba al crear y no había
// forma de retirar una nota. Una observación confidencial (pretensión
// salarial, motivo de salida) marcada "Visible para empresa" por error, o
// guardada en el candidato equivocado, quedaba expuesta a la empresa (y a la
// integración Worky2) para siempre, salvo editando la base a mano.

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/auth';
import {
  canAccessJob,
  jobAuthInfoFromApplication,
  loadApplicationForAuth,
  parseId,
} from '@/lib/authz-applications';

// Mismo máximo que el POST de /api/evaluations/notes.
const MAX_CONTENT_LENGTH = 5000;

type RouteContext = { params: Promise<{ id: string }> };

/**
 * Carga la nota y decide si el usuario puede modificarla:
 *  - admin: cualquier nota.
 *  - recruiter/specialist: sólo las SUYAS y mientras siga asignado a la
 *    vacante (un reclutador reasignado ya no toca notas de esa vacante).
 * Devuelve la nota o la respuesta de error lista para devolver.
 */
async function loadEditableNote(
  rawId: string,
  user: { id: number; role: string }
) {
  const noteId = parseId(rawId);

  if (noteId === null) {
    return {
      error: NextResponse.json(
        { success: false, error: 'ID inválido' },
        { status: 400 }
      ),
    };
  }

  const note = await prisma.evaluationNote.findUnique({
    where: { id: noteId },
    select: { id: true, authorId: true, applicationId: true },
  });

  if (!note) {
    return {
      error: NextResponse.json(
        { success: false, error: 'Nota no encontrada' },
        { status: 404 }
      ),
    };
  }

  if (user.role !== 'admin') {
    if (note.authorId !== user.id) {
      return {
        error: NextResponse.json(
          { success: false, error: 'Solo el autor o un admin pueden modificar esta nota' },
          { status: 403 }
        ),
      };
    }

    const application = await loadApplicationForAuth(note.applicationId);

    if (
      !application ||
      !canAccessJob(user, jobAuthInfoFromApplication(application))
    ) {
      return {
        error: NextResponse.json(
          { success: false, error: 'No autorizado para esta aplicación' },
          { status: 403 }
        ),
      };
    }
  }

  return { note };
}

/**
 * PATCH /api/evaluations/notes/[id]
 * Body: { content?: string, isPublic?: boolean }
 * Editar el contenido y/o alternar la visibilidad para la empresa.
 */
export async function PATCH(request: NextRequest, { params }: RouteContext) {
  try {
    // Rol e isActive desde la base, no desde los headers del JWT.
    const auth = await requireRole(['recruiter', 'specialist', 'admin']);
    if ('error' in auth) {
      return NextResponse.json(
        { success: false, error: auth.error },
        { status: auth.status }
      );
    }

    const { user } = auth;
    const { id } = await params;

    const body = await request.json().catch(() => null);

    if (!body || typeof body !== 'object') {
      return NextResponse.json(
        { success: false, error: 'Body inválido' },
        { status: 400 }
      );
    }

    const { content, isPublic } = body as { content?: unknown; isPublic?: unknown };
    const data: { content?: string; isPublic?: boolean } = {};

    if (content !== undefined) {
      if (typeof content !== 'string' || content.trim() === '') {
        return NextResponse.json(
          { success: false, error: 'content debe ser un texto no vacío' },
          { status: 400 }
        );
      }

      const cleanContent = content.trim();

      if (cleanContent.length > MAX_CONTENT_LENGTH) {
        return NextResponse.json(
          { success: false, error: `La nota no puede superar ${MAX_CONTENT_LENGTH} caracteres` },
          { status: 400 }
        );
      }

      // Igual que el POST: texto plano sin pasar por sanitizeText (React
      // escapa al pintar y el regex se comía "List<String>").
      data.content = cleanContent;
    }

    if (isPublic !== undefined) {
      if (typeof isPublic !== 'boolean') {
        return NextResponse.json(
          { success: false, error: 'isPublic debe ser booleano' },
          { status: 400 }
        );
      }
      data.isPublic = isPublic;
    }

    if (Object.keys(data).length === 0) {
      return NextResponse.json(
        { success: false, error: 'Nada que actualizar (content o isPublic)' },
        { status: 400 }
      );
    }

    const result = await loadEditableNote(id, { id: user.id, role: user.role });
    if ('error' in result) return result.error;

    const updated = await prisma.evaluationNote.update({
      where: { id: result.note.id },
      data,
    });

    return NextResponse.json({ success: true, data: updated });
  } catch (error) {
    console.error('Error al actualizar nota:', error);
    return NextResponse.json(
      { success: false, error: 'Error interno' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/evaluations/notes/[id]
 * Borrar una nota (autor asignado o admin).
 */
export async function DELETE(_request: NextRequest, { params }: RouteContext) {
  try {
    const auth = await requireRole(['recruiter', 'specialist', 'admin']);
    if ('error' in auth) {
      return NextResponse.json(
        { success: false, error: auth.error },
        { status: auth.status }
      );
    }

    const { user } = auth;
    const { id } = await params;

    const result = await loadEditableNote(id, { id: user.id, role: user.role });
    if ('error' in result) return result.error;

    // deleteMany y no delete: si otra pestaña ya la borró, se responde 404 en
    // vez de reventar con P2025 → 500.
    const { count } = await prisma.evaluationNote.deleteMany({
      where: { id: result.note.id },
    });

    if (count === 0) {
      return NextResponse.json(
        { success: false, error: 'Nota no encontrada' },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, message: 'Nota eliminada' });
  } catch (error) {
    console.error('Error al eliminar nota:', error);
    return NextResponse.json(
      { success: false, error: 'Error interno' },
      { status: 500 }
    );
  }
}
