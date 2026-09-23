// RUTA: src/app/api/profile/experience/route.ts

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';
import { z } from 'zod';

/**
 * AUTHZ (#PERF-004): antes esta ruta hacía su propia autenticación con
 * verifyToken + consulta, SIN mirar isActive. El middleware sólo comprueba la
 * firma del JWT, así que un candidato desactivado por fraude seguía escribiendo
 * en su ficha hasta 7 días. requireAuth() consulta la base y rechaza inactivos.
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

/**
 * Fecha que acepta string o Date y rechaza lo no parseable.
 *
 * No se usa z.coerce.date() porque `new Date(null)` es 1970-01-01 y se colaba
 * como fecha válida: una experiencia pasaba a empezar en 1970 y el recálculo de
 * años daba 57.
 */
const fechaValida = z
  .union([z.string(), z.date()])
  .refine((v) => !Number.isNaN(new Date(v).getTime()), { message: 'Fecha inválida' })
  .transform((v) => new Date(v));

/** Igual que fechaValida, pero '' y null cuentan como "sin fecha". */
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

const experienciaSchema = z
  .object({
    empresa: z.string().trim().min(1, 'La empresa es requerida').max(150),
    puesto: z.string().trim().min(1, 'El puesto es requerido').max(150),
    ubicacion: textoOpcional(150),
    fechaInicio: fechaValida,
    fechaFin: fechaOpcional,
    esActual: z.boolean().optional().default(false),
    descripcion: textoOpcional(3000)
  })
  // OJO: en zod 4 estos refinamientos se ejecutan aunque un campo del objeto
  // haya fallado, así que hay que comprobar el tipo antes de usar el valor (si
  // no, un `fechaInicio: 'abc'` acaba en TypeError -> 500 en vez de 400).
  .refine((d) => !(d.fechaInicio instanceof Date) || d.fechaInicio.getTime() <= Date.now(), {
    message: 'La fecha de inicio no puede ser futura',
    path: ['fechaInicio']
  })
  .refine((d) => !(d.fechaInicio instanceof Date) || d.esActual || d.fechaFin !== undefined, {
    // #PERF-021: sin esto, una experiencia no actual sin fecha de fin se contaba
    // "hasta hoy" al recalcular los años de experiencia.
    message: 'Indica la fecha de fin o marca "Trabajo actual"',
    path: ['fechaFin']
  })
  .refine((d) => !(d.fechaInicio instanceof Date) || !(d.fechaFin instanceof Date) || d.esActual || d.fechaFin >= d.fechaInicio, {
    message: 'La fecha de fin no puede ser anterior a la fecha de inicio',
    path: ['fechaFin']
  });

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
      data: experiences,
      // #PERF-010: cada alta/edición/baja recalcula añosExperiencia en el
      // servidor. Si /profile no recibe el valor nuevo, el siguiente «Guardar
      // Cambios» reenvía el viejo y pisa el recalculado.
      añosExperiencia: auth.candidate.añosExperiencia
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

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { success: false, error: 'Cuerpo de la petición inválido' },
        { status: 400 }
      );
    }

    // VALIDATION (#PERF-020): antes una fecha no parseable llegaba a Prisma y
    // devolvía 500 en vez de 400.
    const parsed = experienciaSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: parsed.error.issues[0]?.message || 'Datos inválidos' },
        { status: 400 }
      );
    }

    const datos = parsed.data;

    // Si es trabajo actual, forzar fechaFin a null
    const effectiveFechaFin = datos.esActual ? null : datos.fechaFin ?? null;

    // Crear experiencia
    const experience = await prisma.experience.create({
      data: {
        candidateId: auth.candidate.id,
        empresa: datos.empresa,
        puesto: datos.puesto,
        ubicacion: datos.ubicacion ?? null,
        fechaInicio: datos.fechaInicio,
        fechaFin: effectiveFechaFin,
        esActual: datos.esActual,
        descripcion: datos.descripcion ?? null
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

/**
 * Recalcula los años de experiencia del candidato (#PERF-021).
 *
 * Dos defectos del cálculo anterior:
 *  1. Sumaba cada experiencia por separado, así que dos empleos simultáneos
 *     contaban doble (una candidata con 6 años de carrera salía con 23).
 *  2. Trataba `!fechaFin` como "hasta hoy" aunque esActual fuese false, de modo
 *     que una práctica de 2015 sin fecha de fin sumaba una década.
 *
 * Ahora se construyen intervalos en meses, se descartan los inconsistentes y se
 * FUSIONAN los solapes antes de sumar.
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
      // No actual y sin fecha de fin: no se puede medir, no se cuenta.
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
