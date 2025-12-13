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
 * Crear nueva entrada en PricingMatrix
 */
export async function POST(request: Request) {
  try {
    const auth = await verifyAdmin();
    if ('error' in auth) {
      return NextResponse.json(
        { success: false, error: auth.error },
        { status: auth.status }
      );
    }

    const body = await request.json();
    const { profile, seniority, workMode, location, credits } = body;

    // Validaciones
    if (!profile || !seniority || !workMode || credits === undefined) {
      return NextResponse.json(
        { success: false, error: 'Campos requeridos: profile, seniority, workMode, credits' },
        { status: 400 }
      );
    }

    if (!VALID_SENIORITIES.includes(seniority)) {
      return NextResponse.json(
        { success: false, error: `Seniority inválido. Valores válidos: ${VALID_SENIORITIES.join(', ')}` },
        { status: 400 }
      );
    }

    if (!VALID_WORK_MODES.includes(workMode)) {
      return NextResponse.json(
        { success: false, error: `WorkMode inválido. Valores válidos: ${VALID_WORK_MODES.join(', ')}` },
        { status: 400 }
      );
    }

    if (typeof credits !== 'number' || credits < 0) {
      return NextResponse.json(
        { success: false, error: 'Credits debe ser un número positivo' },
        { status: 400 }
      );
    }

    // Verificar duplicado
    const existing = await prisma.pricingMatrix.findFirst({
      where: {
        profile,
        seniority,
        workMode,
        location: location || null
      }
    });

    if (existing) {
      return NextResponse.json(
        {
          success: false,
          error: 'Ya existe una entrada con esta combinación de perfil, seniority, modalidad y ubicación'
        },
        { status: 409 }
      );
    }

    // Crear entrada
    const pricingEntry = await prisma.pricingMatrix.create({
      data: {
        profile,
        seniority,
        workMode,
        location: location || null,
        credits,
        isActive: true
      }
    });

    return NextResponse.json({
      success: true,
      message: 'Precio creado exitosamente',
      data: pricingEntry
    }, { status: 201 });

  } catch (error) {
    console.error('Error creating pricing:', error);
    return NextResponse.json(
      { success: false, error: 'Error al crear precio' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/admin/pricing
 * Actualizar entrada existente
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
    const { id, profile, seniority, workMode, location, credits, isActive } = body;

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

    // Validaciones de campos opcionales
    if (seniority && !VALID_SENIORITIES.includes(seniority)) {
      return NextResponse.json(
        { success: false, error: `Seniority inválido` },
        { status: 400 }
      );
    }

    if (workMode && !VALID_WORK_MODES.includes(workMode)) {
      return NextResponse.json(
        { success: false, error: `WorkMode inválido` },
        { status: 400 }
      );
    }

    if (credits !== undefined && (typeof credits !== 'number' || credits < 0)) {
      return NextResponse.json(
        { success: false, error: 'Credits debe ser un número positivo' },
        { status: 400 }
      );
    }

    // Verificar duplicado si se cambian campos clave
    if (profile || seniority || workMode || location !== undefined) {
      const duplicate = await prisma.pricingMatrix.findFirst({
        where: {
          profile: profile || existing.profile,
          seniority: seniority || existing.seniority,
          workMode: workMode || existing.workMode,
          location: location !== undefined ? (location || null) : existing.location,
          NOT: { id: parseInt(id) }
        }
      });

      if (duplicate) {
        return NextResponse.json(
          { success: false, error: 'Ya existe otra entrada con esta combinación' },
          { status: 409 }
        );
      }
    }

    // Preparar datos a actualizar
    const updateData: any = {};
    if (profile) updateData.profile = profile;
    if (seniority) updateData.seniority = seniority;
    if (workMode) updateData.workMode = workMode;
    if (location !== undefined) updateData.location = location || null;
    if (credits !== undefined) updateData.credits = credits;
    if (isActive !== undefined) updateData.isActive = isActive;

    const updated = await prisma.pricingMatrix.update({
      where: { id: parseInt(id) },
      data: updateData
    });

    return NextResponse.json({
      success: true,
      message: 'Precio actualizado exitosamente',
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
 * Eliminar entrada
 */
export async function DELETE(request: Request) {
  try {
    const auth = await verifyAdmin();
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

    await prisma.pricingMatrix.delete({
      where: { id: parseInt(id) }
    });

    return NextResponse.json({
      success: true,
      message: 'Precio eliminado exitosamente'
    });

  } catch (error) {
    console.error('Error deleting pricing:', error);
    return NextResponse.json(
      { success: false, error: 'Error al eliminar precio' },
      { status: 500 }
    );
  }
}
