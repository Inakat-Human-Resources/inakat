// RUTA: src/app/api/admin/pricing/route.ts

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyToken } from '@/lib/auth';
import { cookies } from 'next/headers';

// Middleware para verificar que es admin
async function verifyAdmin() {
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
    where: { id: payload.userId }
  });

  if (!user || user.role !== 'admin') {
    return { error: 'Acceso denegado - Solo administradores', status: 403 };
  }

  return { user };
}

// Opciones válidas
const VALID_SENIORITIES = ['Practicante', 'Jr', 'Middle', 'Sr', 'Director'];
const VALID_WORK_MODES = ['remote', 'hybrid', 'presential'];

/**
 * GET /api/admin/pricing
 * Lista todas las entradas de PricingMatrix
 */
export async function GET(request: Request) {
  try {
    const auth = await verifyAdmin();
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
    const auth = await verifyAdmin();
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

    // Verificar que existe
    const existing = await prisma.pricingMatrix.findUnique({
      where: { id: parseInt(id) }
    });

    if (!existing) {
      return NextResponse.json(
        { success: false, error: 'Entrada no encontrada' },
        { status: 404 }
      );
    }

    // Validar créditos
    if (credits !== undefined && (typeof credits !== 'number' || credits < 0)) {
      return NextResponse.json(
        { success: false, error: 'Credits debe ser un número positivo' },
        { status: 400 }
      );
    }

    // Validar minSalary
    if (minSalary !== undefined && minSalary !== null && (typeof minSalary !== 'number' || minSalary < 0)) {
      return NextResponse.json(
        { success: false, error: 'minSalary debe ser un número positivo o null' },
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

    const updated = await prisma.pricingMatrix.update({
      where: { id: parseInt(id) },
      data: updateData
    });

    return NextResponse.json({
      success: true,
      message: 'Entrada actualizada exitosamente',
      data: updated
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
 * DESHABILITADO - Los precios no se pueden eliminar, solo desactivar con isActive=false
 */
export async function DELETE() {
  return NextResponse.json(
    {
      success: false,
      error: 'La eliminación de precios está deshabilitada. Puedes desactivar un precio cambiando su estado a "Inactivo".'
    },
    { status: 403 }
  );
}
