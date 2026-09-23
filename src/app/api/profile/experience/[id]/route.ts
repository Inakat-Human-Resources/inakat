// RUTA: src/app/api/profile/experience/[id]/route.ts

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';
import { z } from 'zod';

/**
 * AUTHZ (#PERF-004): ver nota en ../route.ts. requireAuth() consulta la base y
 * rechaza a los usuarios con isActive=false; la autenticación ad-hoc anterior
 * sólo verificaba la firma del JWT.
 */
async function getAuthenticatedCandidate() {
  const auth = await requireAuth();
  if ('error' in auth) return auth;

  const candidate = await prisma.candidate.findFirst({
    where: { userId: auth.user.id }
  });

  if (!candidate) {
    return { error: 'No tienes un perfil de candidato', status: 403 };
  }

  return { user: auth.user, candidate };
}

// =============================================
// VALIDACIÓN (#PERF-020)
// =============================================
// Mismas reglas que en POST /api/profile/experience. Están duplicadas porque un
// route.ts no puede exportar nada que no sea un handler; conviene moverlas a
// src/lib cuando se centralice recalculateYearsOfExperience.

const fechaValida = z
  .union([z.string(), z.date()])
  .refine((v) => !Number.isNaN(new Date(v).getTime()), { message: 'Fecha inválida' })
  .transform((v) => new Date(v));

const fechaOpcional = z.preprocess(
  (v) => (v === '' || v === null ? undefined : v),
  fechaValida.optional()
);

/** Texto opcional: '' significa "bórralo" (null), no "no lo toques". */
const textoOpcional = (max: number) =>
  z.preprocess(
    (v) => (v === '' ? null : v),
    z.string().trim().max(max).nullable().optional()
  );

/**
 * En PUT todos los campos son opcionales (actualización parcial), pero los que
 * llegan tienen que ser válidos: antes `empresa: ''` se aceptaba y
 * `fechaInicio: null` se guardaba como 1970-01-01.
 */
const experienciaParcialSchema = z.object({
  empresa: z.string().trim().min(1, 'La empresa no puede estar vacía').max(150).optional(),
  puesto: z.string().trim().min(1, 'El puesto no puede estar vacío').max(150).optional(),
  ubicacion: textoOpcional(150),
  fechaInicio: fechaValida.optional(),
  fechaFin: fechaOpcional,
  esActual: z.boolean().optional(),
  descripcion: textoOpcional(3000)
});

/**
 * Recalcula los años de experiencia fusionando los solapes (#PERF-021).
 * Copia de la función de ../route.ts (ver nota arriba).
 */
async function recalculateYearsOfExperience(candidateId: number) {
  const experiences = await prisma.experience.findMany({
    where: { candidateId }
  });

  const ahora = new Date();
  const intervalos: Array<[number, number]> = [];

  for (const exp of experiences) {
    const inicio = new Date(exp.fechaInicio);
    if (Number.isNaN(inicio.getTime())) continue;

    let fin: Date;
    if (exp.esActual) {
      fin = ahora;
    } else if (exp.fechaFin) {
      fin = new Date(exp.fechaFin);
    } else {
      continue;
    }

    if (Number.isNaN(fin.getTime())) continue;

    const mesInicio = inicio.getFullYear() * 12 + inicio.getMonth();
    const mesFin = fin.getFullYear() * 12 + fin.getMonth();
    if (mesFin <= mesInicio) continue;

    intervalos.push([mesInicio, mesFin]);
  }

  intervalos.sort((a, b) => a[0] - b[0]);

  let totalMonths = 0;
  let inicioActual: number | null = null;
  let finActual = 0;

  for (const [inicio, fin] of intervalos) {
    if (inicioActual === null) {
      inicioActual = inicio;
      finActual = fin;
    } else if (inicio <= finActual) {
      finActual = Math.max(finActual, fin);
    } else {
      totalMonths += finActual - inicioActual;
      inicioActual = inicio;
      finActual = fin;
    }
  }

  if (inicioActual !== null) totalMonths += finActual - inicioActual;

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

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { success: false, error: 'Cuerpo de la petición inválido' },
        { status: 400 }
      );
    }

    const parsed = experienciaParcialSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: parsed.error.issues[0]?.message || 'Datos inválidos' },
        { status: 400 }
      );
    }

    const { empresa, puesto, ubicacion, fechaInicio, fechaFin, esActual, descripcion } = parsed.data;
    const seEnvioFechaFin = body !== null && typeof body === 'object' && 'fechaFin' in body;

    // Estado resultante tras aplicar el parche, para validar coherencia
    const effectiveFechaInicio = fechaInicio ?? new Date(existing.fechaInicio);
    const effectiveEsActual = esActual !== undefined ? esActual : existing.esActual;
    const effectiveFechaFin = seEnvioFechaFin
      ? fechaFin ?? null
      : existing.fechaFin
        ? new Date(existing.fechaFin)
        : null;

    if (effectiveFechaInicio.getTime() > Date.now()) {
      return NextResponse.json(
        { success: false, error: 'La fecha de inicio no puede ser futura' },
        { status: 400 }
      );
    }

    if (!effectiveEsActual && !effectiveFechaFin) {
      // #PERF-021: una experiencia no actual sin fecha de fin se contaba "hasta
      // hoy" al recalcular los años de experiencia.
      return NextResponse.json(
        { success: false, error: 'Indica la fecha de fin o marca "Trabajo actual"' },
        { status: 400 }
      );
    }

    if (effectiveFechaFin && !effectiveEsActual && effectiveFechaFin < effectiveFechaInicio) {
      return NextResponse.json(
        { success: false, error: 'La fecha de fin no puede ser anterior a la fecha de inicio' },
        { status: 400 }
      );
    }

    // Si es trabajo actual, forzar fechaFin a null
    const finalFechaFin = effectiveEsActual ? null : effectiveFechaFin;

    // Preparar datos a actualizar
    const updateData: any = {};
    if (empresa !== undefined) updateData.empresa = empresa;
    if (puesto !== undefined) updateData.puesto = puesto;
    if (ubicacion !== undefined) updateData.ubicacion = ubicacion;
    if (fechaInicio !== undefined) updateData.fechaInicio = fechaInicio;
    if (seEnvioFechaFin || esActual !== undefined) updateData.fechaFin = finalFechaFin;
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
