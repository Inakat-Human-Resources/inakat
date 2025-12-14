// RUTA: src/app/api/admin/credit-packages/[id]/route.ts

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyToken } from '@/lib/auth';
import { cookies } from 'next/headers';

// Verificar que es admin
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

/**
 * GET /api/admin/credit-packages/[id]
 * Obtener un paquete específico
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await verifyAdmin();
    if ('error' in auth) {
      return NextResponse.json(
        { success: false, error: auth.error },
        { status: auth.status }
      );
    }

    const { id } = await params;
    const packageId = parseInt(id);

    if (isNaN(packageId)) {
      return NextResponse.json(
        { success: false, error: 'ID inválido' },
        { status: 400 }
      );
    }

    const creditPackage = await prisma.creditPackage.findUnique({
      where: { id: packageId }
    });

    if (!creditPackage) {
      return NextResponse.json(
        { success: false, error: 'Paquete no encontrado' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: creditPackage
    });
  } catch (error) {
    console.error('Error fetching credit package:', error);
    return NextResponse.json(
      { success: false, error: 'Error al obtener paquete' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/admin/credit-packages/[id]
 * Actualizar un paquete
 */
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await verifyAdmin();
    if ('error' in auth) {
      return NextResponse.json(
        { success: false, error: auth.error },
        { status: auth.status }
      );
    }

    const { id } = await params;
    const packageId = parseInt(id);

    if (isNaN(packageId)) {
      return NextResponse.json(
        { success: false, error: 'ID inválido' },
        { status: 400 }
      );
    }

    // Verificar que existe
    const existing = await prisma.creditPackage.findUnique({
      where: { id: packageId }
    });

    if (!existing) {
      return NextResponse.json(
        { success: false, error: 'Paquete no encontrado' },
        { status: 404 }
      );
    }

    const body = await request.json();
    const { name, credits, price, badge, sortOrder, isActive } = body;

    // Preparar datos de actualización
    const updateData: any = {};

    if (name !== undefined) updateData.name = name;
    if (sortOrder !== undefined) updateData.sortOrder = parseInt(sortOrder);
    if (isActive !== undefined) updateData.isActive = isActive;

    // Si cambian créditos o precio, recalcular pricePerCredit
    const finalCredits = credits !== undefined ? parseInt(credits) : existing.credits;
    const finalPrice = price !== undefined ? parseFloat(price) : existing.price;

    if (credits !== undefined || price !== undefined) {
      if (finalCredits <= 0) {
        return NextResponse.json(
          { success: false, error: 'La cantidad de créditos debe ser mayor a 0' },
          { status: 400 }
        );
      }
      if (finalPrice <= 0) {
        return NextResponse.json(
          { success: false, error: 'El precio debe ser mayor a 0' },
          { status: 400 }
        );
      }

      updateData.credits = finalCredits;
      updateData.price = finalPrice;
      updateData.pricePerCredit = parseFloat((finalPrice / finalCredits).toFixed(2));
    }

    // Validar y actualizar badge
    if (badge !== undefined) {
      const validBadges = ['MÁS POPULAR', 'PROMOCIÓN', null, ''];
      if (badge && !validBadges.includes(badge)) {
        return NextResponse.json(
          { success: false, error: 'Badge inválido. Opciones: MÁS POPULAR, PROMOCIÓN' },
          { status: 400 }
        );
      }
      updateData.badge = badge || null;
    }

    const updated = await prisma.creditPackage.update({
      where: { id: packageId },
      data: updateData
    });

    return NextResponse.json({
      success: true,
      message: 'Paquete actualizado exitosamente',
      data: updated
    });
  } catch (error) {
    console.error('Error updating credit package:', error);
    return NextResponse.json(
      { success: false, error: 'Error al actualizar paquete' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/admin/credit-packages/[id]
 * Desactivar un paquete (soft delete)
 */
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await verifyAdmin();
    if ('error' in auth) {
      return NextResponse.json(
        { success: false, error: auth.error },
        { status: auth.status }
      );
    }

    const { id } = await params;
    const packageId = parseInt(id);

    if (isNaN(packageId)) {
      return NextResponse.json(
        { success: false, error: 'ID inválido' },
        { status: 400 }
      );
    }

    // Verificar que existe
    const existing = await prisma.creditPackage.findUnique({
      where: { id: packageId }
    });

    if (!existing) {
      return NextResponse.json(
        { success: false, error: 'Paquete no encontrado' },
        { status: 404 }
      );
    }

    // Soft delete: solo desactivar
    await prisma.creditPackage.update({
      where: { id: packageId },
      data: { isActive: false }
    });

    return NextResponse.json({
      success: true,
      message: 'Paquete desactivado exitosamente'
    });
  } catch (error) {
    console.error('Error deleting credit package:', error);
    return NextResponse.json(
      { success: false, error: 'Error al eliminar paquete' },
      { status: 500 }
    );
  }
}
