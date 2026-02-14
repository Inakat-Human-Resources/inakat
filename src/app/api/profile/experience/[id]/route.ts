// RUTA: src/app/api/profile/experience/[id]/route.ts

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyToken } from '@/lib/auth';
import { cookies } from 'next/headers';

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

// Función auxiliar para recalcular años de experiencia
async function recalculateYearsOfExperience(candidateId: number) {
  const experiences = await prisma.experience.findMany({
    where: { candidateId }
  });

  let totalMonths = 0;
  const now = new Date();

  for (const exp of experiences) {
    const start = new Date(exp.fechaInicio);
    const end = exp.esActual || !exp.fechaFin ? now : new Date(exp.fechaFin);

    const months = (end.getFullYear() - start.getFullYear()) * 12 +
                   (end.getMonth() - start.getMonth());
    totalMonths += Math.max(0, months);
  }

  const years = Math.round(totalMonths / 12);

  await prisma.candidate.update({
    where: { id: candidateId },
    data: { añosExperiencia: years }
  });
}

/**
 * GET /api/profile/experience/[id]
 * Obtiene una experiencia específica
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await getAuthenticatedCandidate();
    if ('error' in auth) {
      return NextResponse.json(
        { success: false, error: auth.error },
        { status: auth.status }
      );
    }

    const { id } = await params;
    const experienceId = parseInt(id);

    if (isNaN(experienceId)) {
      return NextResponse.json(
        { success: false, error: 'ID inválido' },
        { status: 400 }
      );
    }

    const experience = await prisma.experience.findUnique({
      where: { id: experienceId }
    });

    if (!experience) {
      return NextResponse.json(
        { success: false, error: 'Experiencia no encontrada' },
        { status: 404 }
      );
    }

    // Verificar que pertenece al candidato
    if (experience.candidateId !== auth.candidate.id) {
      return NextResponse.json(
        { success: false, error: 'No tienes permiso para ver esta experiencia' },
        { status: 403 }
      );
    }

    return NextResponse.json({
      success: true,
      data: experience
    });
  } catch (error) {
    console.error('Error fetching experience:', error);
    return NextResponse.json(
      { success: false, error: 'Error al obtener experiencia' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/profile/experience/[id]
 * Actualiza una experiencia laboral
 */
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await getAuthenticatedCandidate();
    if ('error' in auth) {
      return NextResponse.json(
        { success: false, error: auth.error },
        { status: auth.status }
      );
    }

    const { id } = await params;
    const experienceId = parseInt(id);

    if (isNaN(experienceId)) {
      return NextResponse.json(
        { success: false, error: 'ID inválido' },
        { status: 400 }
      );
    }

    // Verificar que existe y pertenece al candidato
    const existing = await prisma.experience.findUnique({
      where: { id: experienceId }
    });

    if (!existing) {
      return NextResponse.json(
        { success: false, error: 'Experiencia no encontrada' },
        { status: 404 }
      );
    }

    if (existing.candidateId !== auth.candidate.id) {
      return NextResponse.json(
        { success: false, error: 'No tienes permiso para editar esta experiencia' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { empresa, puesto, ubicacion, fechaInicio, fechaFin, esActual, descripcion } = body;

    // Validar que fechaFin no sea anterior a fechaInicio
    const effectiveFechaInicio = fechaInicio !== undefined ? fechaInicio : existing.fechaInicio;
    const effectiveFechaFin = fechaFin !== undefined ? fechaFin : existing.fechaFin;
    const effectiveEsActual = esActual !== undefined ? esActual : existing.esActual;

    if (effectiveFechaFin && !effectiveEsActual) {
      if (new Date(effectiveFechaFin) < new Date(effectiveFechaInicio)) {
        return NextResponse.json(
          { success: false, error: 'La fecha de fin no puede ser anterior a la fecha de inicio' },
          { status: 400 }
        );
      }
    }

    // Preparar datos a actualizar
    const updateData: any = {};
    if (empresa !== undefined) updateData.empresa = empresa;
    if (puesto !== undefined) updateData.puesto = puesto;
    if (ubicacion !== undefined) updateData.ubicacion = ubicacion;
    if (fechaInicio !== undefined) updateData.fechaInicio = new Date(fechaInicio);
    if (fechaFin !== undefined) updateData.fechaFin = fechaFin ? new Date(fechaFin) : null;
    if (esActual !== undefined) updateData.esActual = esActual;
    if (descripcion !== undefined) updateData.descripcion = descripcion;

    const updated = await prisma.experience.update({
      where: { id: experienceId },
      data: updateData
    });

    // Recalcular años de experiencia
    await recalculateYearsOfExperience(auth.candidate.id);

    return NextResponse.json({
      success: true,
      message: 'Experiencia actualizada',
      data: updated
    });
  } catch (error) {
    console.error('Error updating experience:', error);
    return NextResponse.json(
      { success: false, error: 'Error al actualizar experiencia' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/profile/experience/[id]
 * Elimina una experiencia laboral
 */
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await getAuthenticatedCandidate();
    if ('error' in auth) {
      return NextResponse.json(
        { success: false, error: auth.error },
        { status: auth.status }
      );
    }

    const { id } = await params;
    const experienceId = parseInt(id);

    if (isNaN(experienceId)) {
      return NextResponse.json(
        { success: false, error: 'ID inválido' },
        { status: 400 }
      );
    }

    // Verificar que existe y pertenece al candidato
    const existing = await prisma.experience.findUnique({
      where: { id: experienceId }
    });

    if (!existing) {
      return NextResponse.json(
        { success: false, error: 'Experiencia no encontrada' },
        { status: 404 }
      );
    }

    if (existing.candidateId !== auth.candidate.id) {
      return NextResponse.json(
        { success: false, error: 'No tienes permiso para eliminar esta experiencia' },
        { status: 403 }
      );
    }

    await prisma.experience.delete({
      where: { id: experienceId }
    });

    // Recalcular años de experiencia
    await recalculateYearsOfExperience(auth.candidate.id);

    return NextResponse.json({
      success: true,
      message: 'Experiencia eliminada'
    });
  } catch (error) {
    console.error('Error deleting experience:', error);
    return NextResponse.json(
      { success: false, error: 'Error al eliminar experiencia' },
      { status: 500 }
    );
  }
}
