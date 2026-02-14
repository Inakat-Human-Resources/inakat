// RUTA: src/app/api/profile/experience/route.ts

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

/**
 * GET /api/profile/experience
 * Obtiene todas las experiencias del candidato autenticado
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

    const experiences = await prisma.experience.findMany({
      where: { candidateId: auth.candidate.id },
      orderBy: { fechaInicio: 'desc' }
    });

    return NextResponse.json({
      success: true,
      data: experiences
    });
  } catch (error) {
    console.error('Error fetching experiences:', error);
    return NextResponse.json(
      { success: false, error: 'Error al obtener experiencias' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/profile/experience
 * Crea una nueva experiencia laboral
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

    const body = await request.json();
    const { empresa, puesto, ubicacion, fechaInicio, fechaFin, esActual, descripcion } = body;

    // Validaciones
    if (!empresa || !puesto || !fechaInicio) {
      return NextResponse.json(
        { success: false, error: 'Empresa, puesto y fecha de inicio son requeridos' },
        { status: 400 }
      );
    }

    // Validar que fechaFin no sea anterior a fechaInicio
    if (fechaFin && !esActual) {
      if (new Date(fechaFin) < new Date(fechaInicio)) {
        return NextResponse.json(
          { success: false, error: 'La fecha de fin no puede ser anterior a la fecha de inicio' },
          { status: 400 }
        );
      }
    }

    // Crear experiencia
    const experience = await prisma.experience.create({
      data: {
        candidateId: auth.candidate.id,
        empresa,
        puesto,
        ubicacion: ubicacion || null,
        fechaInicio: new Date(fechaInicio),
        fechaFin: fechaFin ? new Date(fechaFin) : null,
        esActual: esActual || false,
        descripcion: descripcion || null
      }
    });

    // Recalcular años de experiencia
    await recalculateYearsOfExperience(auth.candidate.id);

    return NextResponse.json({
      success: true,
      message: 'Experiencia agregada exitosamente',
      data: experience
    });
  } catch (error) {
    console.error('Error creating experience:', error);
    return NextResponse.json(
      { success: false, error: 'Error al crear experiencia' },
      { status: 500 }
    );
  }
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
