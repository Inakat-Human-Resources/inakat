// RUTA: src/app/api/admin/pricing/route.ts

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/auth';

// DEAD-CODE (#PAGO): aquí vivían VALID_SENIORITIES / VALID_WORK_MODES, sin uso
// desde que se deshabilitó el POST. Las combinaciones válidas salen de la propia
// matriz (GET /api/pricing/calculate).

/**
 * GET /api/admin/pricing
 * Lista todas las entradas de PricingMatrix
 */
export async function GET(request: Request) {
  try {
    const auth = await requireRole('admin');
    if ('error' in auth) {
      return NextResponse.json(
        { success: false, error: auth.error },
        { status: auth.status }
      );
    }

    const { searchParams } = new URL(request.url);
    const profile = searchParams.get('profile');
    const seniority = searchParams.get('seniority');
    const workMode = searchParams.get('workMode');
    const isActive = searchParams.get('isActive');

    // Construir filtros
    const where: any = {};

    if (profile) {
      where.profile = profile;
    }
    if (seniority) {
      where.seniority = seniority;
    }
    if (workMode) {
      where.workMode = workMode;
    }
    if (isActive !== null && isActive !== '') {
      where.isActive = isActive === 'true';
    }

    const pricingEntries = await prisma.pricingMatrix.findMany({
      where,
      orderBy: [
        { profile: 'asc' },
        { seniority: 'asc' },
        { workMode: 'asc' }
      ]
    });

    // Obtener perfiles únicos para el dropdown
    const uniqueProfiles = await prisma.pricingMatrix.findMany({
      select: { profile: true },
      distinct: ['profile'],
      orderBy: { profile: 'asc' }
    });

    return NextResponse.json({
      success: true,
      data: pricingEntries,
      count: pricingEntries.length,
      profiles: uniqueProfiles.map(p => p.profile)
    });

  } catch (error) {
    console.error('Error fetching pricing:', error);
    return NextResponse.json(
      { success: false, error: 'Error al obtener matriz de precios' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/pricing
 * DESHABILITADO - Los precios se generan automáticamente al crear especialidades
 */
export async function POST() {
  return NextResponse.json(
    {
      success: false,
      error: 'La creación manual de precios está deshabilitada. Los precios se generan automáticamente al crear especialidades.'
    },
    { status: 403 }
  );
}

/**
 * PUT /api/admin/pricing
 * Actualizar créditos, isActive y minSalary (no se pueden modificar profile, seniority, workMode, location)
 */
export async function PUT(request: Request) {
  try {
    const auth = await requireRole('admin');
    if ('error' in auth) {
      return NextResponse.json(
        { success: false, error: auth.error },
        { status: auth.status }
      );
    }

    const body = await request.json();
    const { id, credits, isActive, minSalary } = body;

    if (!id) {
      return NextResponse.json(
        { success: false, error: 'ID requerido' },
        { status: 400 }
      );
    }

    // `parseInt('x')` daba NaN y Prisma respondía 500 en vez de 400.
    const pricingId = Number(id);
    if (!Number.isInteger(pricingId) || pricingId <= 0) {
      return NextResponse.json(
        { success: false, error: 'ID inválido' },
        { status: 400 }
      );
    }

    // Verificar que existe
    const existing = await prisma.pricingMatrix.findUnique({
      where: { id: pricingId }
    });

    if (!existing) {
      return NextResponse.json(
        { success: false, error: 'Entrada no encontrada' },
        { status: 404 }
      );
    }

    // Validar créditos: entero >= 1.
    // Antes 0 pasaba (el mensaje ya decía "positivo") y esa combinación se
    // publicaba GRATIS; 2.5 también pasaba y reventaba en Prisma (campo Int).
    if (credits !== undefined && (!Number.isInteger(credits) || credits < 1)) {
      return NextResponse.json(
        { success: false, error: 'Credits debe ser un número entero mayor o igual a 1' },
        { status: 400 }
      );
    }

    // Validar minSalary
    if (
      minSalary !== undefined &&
      minSalary !== null &&
      (!Number.isInteger(minSalary) || minSalary < 0)
    ) {
      return NextResponse.json(
        { success: false, error: 'minSalary debe ser un número entero positivo o null' },
        { status: 400 }
      );
    }

    if (isActive !== undefined && typeof isActive !== 'boolean') {
      return NextResponse.json(
        { success: false, error: 'isActive debe ser booleano' },
        { status: 400 }
      );
    }

    // Solo permitir actualizar credits, isActive y minSalary
    const updateData: { credits?: number; isActive?: boolean; minSalary?: number | null } = {};
    if (credits !== undefined) updateData.credits = credits;
    if (isActive !== undefined) updateData.isActive = isActive;
    if (minSalary !== undefined) updateData.minSalary = minSalary;

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json(
        { success: false, error: 'No hay campos válidos para actualizar. Solo se puede modificar credits, isActive y minSalary.' },
        { status: 400 }
      );
    }

    // Desactivar deja la combinación sin precio: calculateJobCreditCost sólo
    // mira filas activas y devuelve found:false. POST /api/jobs, PUT
    // /api/jobs/publish y el PATCH de /api/jobs/[id] ya rechazan publicar sin
    // precio (ADM-020/ADM-044) en vez de cobrar DEFAULT_CREDITS. Se informa de
    // cuántas vacantes usan la combinación para que la UI pueda avisar.
    let vacantesAfectadas = 0;
    if (isActive === false && existing.isActive) {
      vacantesAfectadas = await prisma.job.count({
        where: {
          profile: existing.profile,
          seniority: existing.seniority,
          workMode: existing.workMode,
          status: { in: ['active', 'paused', 'draft'] }
        }
      });
    }

    const updated = await prisma.pricingMatrix.update({
      where: { id: pricingId },
      data: updateData
    });

    return NextResponse.json({
      success: true,
      message: 'Entrada actualizada exitosamente',
      data: updated,
      affectedJobs: vacantesAfectadas
    });

  } catch (error) {
    console.error('Error updating pricing:', error);
    return NextResponse.json(
      { success: false, error: 'Error al actualizar precio' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/admin/pricing
 * Eliminar una entrada de la matriz de precios
 * Solo si no hay vacantes activas usando ese perfil/seniority/workMode
 */
export async function DELETE(request: Request) {
  try {
    const auth = await requireRole('admin');
    if ('error' in auth) {
      return NextResponse.json(
        { success: false, error: auth.error },
        { status: auth.status }
      );
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { success: false, error: 'ID requerido' },
        { status: 400 }
      );
    }

    const pricingId = parseInt(id);
    if (isNaN(pricingId)) {
      return NextResponse.json(
        { success: false, error: 'ID inválido' },
        { status: 400 }
      );
    }

    // Obtener el registro a eliminar
    const pricingEntry = await prisma.pricingMatrix.findUnique({
      where: { id: pricingId }
    });

    if (!pricingEntry) {
      return NextResponse.json(
        { success: false, error: 'Entrada no encontrada' },
        { status: 404 }
      );
    }

    // Verificar si hay vacantes activas usando esta combinación
    const activeJobs = await prisma.job.findMany({
      where: {
        profile: pricingEntry.profile,
        seniority: pricingEntry.seniority,
        workMode: pricingEntry.workMode,
        status: {
          in: ['active', 'paused', 'draft'] // Cualquier estado que no sea 'closed'
        }
      },
      select: {
        id: true,
        title: true,
        company: true,
        status: true
      }
    });

    if (activeJobs.length > 0) {
      return NextResponse.json(
        {
          success: false,
          error: `No se puede eliminar. Hay ${activeJobs.length} vacante(s) usando esta configuración de precios.`,
          activeJobs: activeJobs.map(j => ({
            id: j.id,
            title: j.title,
            company: j.company,
            status: j.status
          }))
        },
        { status: 409 } // Conflict
      );
    }

    // Si no hay vacantes activas, eliminar
    await prisma.pricingMatrix.delete({
      where: { id: pricingId }
    });

    return NextResponse.json({
      success: true,
      message: `Entrada de precios eliminada: ${pricingEntry.profile} - ${pricingEntry.seniority} - ${pricingEntry.workMode}`
    });

  } catch (error) {
    console.error('Error deleting pricing entry:', error);
    return NextResponse.json(
      { success: false, error: 'Error al eliminar entrada de precios' },
      { status: 500 }
    );
  }
}
