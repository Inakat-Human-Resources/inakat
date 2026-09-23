// RUTA: src/app/api/admin/credit-packages/[id]/route.ts

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/auth';

// Longitud máxima del nombre visible del paquete (igual que en la ruta padre).
const MAX_NOMBRE = 60;

/**
 * GET /api/admin/credit-packages/[id]
 * Obtener un paquete específico
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireRole('admin');
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
    const auth = await requireRole('admin');
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

    // Preparar datos de actualización.
    // Todo se valida por TIPO: antes `parseInt('abc')` daba NaN, 'NaN <= 0' es
    // false y pasaba la validación, así que Prisma lanzaba y salía un 500; y
    // `name: ''` dejaba un paquete sin nombre visible.
    const updateData: any = {};

    if (name !== undefined) {
      const nombreLimpio = typeof name === 'string' ? name.trim() : '';
      if (!nombreLimpio || nombreLimpio.length > MAX_NOMBRE) {
        return NextResponse.json(
          { success: false, error: `El nombre debe tener entre 1 y ${MAX_NOMBRE} caracteres` },
          { status: 400 }
        );
      }
      updateData.name = nombreLimpio;
    }

    if (sortOrder !== undefined) {
      if (!Number.isInteger(sortOrder) || sortOrder < 0) {
        return NextResponse.json(
          { success: false, error: 'sortOrder debe ser un entero mayor o igual a 0' },
          { status: 400 }
        );
      }
      updateData.sortOrder = sortOrder;
    }

    if (isActive !== undefined) {
      if (typeof isActive !== 'boolean') {
        return NextResponse.json(
          { success: false, error: 'isActive debe ser booleano' },
          { status: 400 }
        );
      }
      updateData.isActive = isActive;
    }

    // Si cambian créditos o precio, recalcular pricePerCredit
    if (credits !== undefined || price !== undefined) {
      if (credits !== undefined && (!Number.isInteger(credits) || credits <= 0)) {
        return NextResponse.json(
          { success: false, error: 'La cantidad de créditos debe ser un entero mayor a 0' },
          { status: 400 }
        );
      }
      if (
        price !== undefined &&
        (typeof price !== 'number' || !Number.isFinite(price) || price <= 0)
      ) {
        return NextResponse.json(
          { success: false, error: 'El precio debe ser mayor a 0' },
          { status: 400 }
        );
      }

      const finalCredits = credits !== undefined ? credits : existing.credits;
      const finalPrice = price !== undefined ? price : existing.price;

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

    // Dos paquetes activos con los mismos créditos hacen ambigua la compra.
    // Se comprueba tanto al cambiar los créditos como al REACTIVAR un paquete
    // (antes reactivar uno inactivo no pasaba por esta comprobación).
    const creditosFinales: number = updateData.credits ?? existing.credits;
    const seguiraActivo: boolean = updateData.isActive ?? existing.isActive;
    if (seguiraActivo && (creditosFinales !== existing.credits || !existing.isActive)) {
      const duplicado = await prisma.creditPackage.findFirst({
        where: { credits: creditosFinales, isActive: true, id: { not: packageId } }
      });
      if (duplicado) {
        return NextResponse.json(
          {
            success: false,
            error: `Ya existe un paquete activo de ${creditosFinales} crédito(s) ("${duplicado.name}").`
          },
          { status: 409 }
        );
      }
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
    const auth = await requireRole('admin');
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
