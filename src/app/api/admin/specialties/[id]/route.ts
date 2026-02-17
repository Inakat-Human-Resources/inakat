// RUTA: src/app/api/admin/specialties/[id]/route.ts

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/auth';

// Función para generar slug
function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * GET /api/admin/specialties/[id]
 * Obtener una especialidad por ID
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const specialtyId = parseInt(id);

    if (isNaN(specialtyId)) {
      return NextResponse.json(
        { success: false, error: 'ID de especialidad inválido' },
        { status: 400 }
      );
    }

    const specialty = await prisma.specialty.findUnique({
      where: { id: specialtyId }
    });

    if (!specialty) {
      return NextResponse.json(
        { success: false, error: 'Especialidad no encontrada' },
        { status: 404 }
      );
    }

    // Obtener precios asociados
    const pricing = await prisma.pricingMatrix.findMany({
      where: { profile: specialty.name },
      orderBy: [{ seniority: 'asc' }, { workMode: 'asc' }]
    });

    return NextResponse.json({
      success: true,
      data: {
        ...specialty,
        pricing
      }
    });
  } catch (error) {
    console.error('Error fetching specialty:', error);
    return NextResponse.json(
      { success: false, error: 'Error al obtener especialidad' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/admin/specialties/[id]
 * Actualizar una especialidad
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
    const specialtyId = parseInt(id);

    if (isNaN(specialtyId)) {
      return NextResponse.json(
        { success: false, error: 'ID de especialidad inválido' },
        { status: 400 }
      );
    }

    const existing = await prisma.specialty.findUnique({
      where: { id: specialtyId }
    });

    if (!existing) {
      return NextResponse.json(
        { success: false, error: 'Especialidad no encontrada' },
        { status: 404 }
      );
    }

    const body = await request.json();
    const {
      name,
      description,
      icon,
      color,
      subcategories,
      sortOrder,
      isActive
    } = body;

    // Si cambia el nombre, verificar que sea único y actualizar precios
    let newSlug = existing.slug;
    const oldName = existing.name;

    if (name && name.trim() !== existing.name) {
      const duplicate = await prisma.specialty.findFirst({
        where: {
          name: name.trim(),
          id: { not: specialtyId }
        }
      });

      if (duplicate) {
        return NextResponse.json(
          { success: false, error: 'Ya existe una especialidad con ese nombre' },
          { status: 409 }
        );
      }

      newSlug = generateSlug(name);

      // Actualizar el profile en PricingMatrix
      await prisma.pricingMatrix.updateMany({
        where: { profile: oldName },
        data: { profile: name.trim() }
      });
    }

    const specialty = await prisma.specialty.update({
      where: { id: specialtyId },
      data: {
        name: name?.trim() || existing.name,
        slug: newSlug,
        description: description !== undefined ? description?.trim() || null : existing.description,
        icon: icon !== undefined ? icon || null : existing.icon,
        color: color || existing.color,
        subcategories: subcategories !== undefined ? subcategories : existing.subcategories,
        sortOrder: sortOrder !== undefined ? sortOrder : existing.sortOrder,
        isActive: isActive !== undefined ? isActive : existing.isActive
      }
    });

    return NextResponse.json({
      success: true,
      message: 'Especialidad actualizada exitosamente',
      data: specialty
    });
  } catch (error) {
    console.error('Error updating specialty:', error);
    return NextResponse.json(
      { success: false, error: 'Error al actualizar especialidad' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/admin/specialties/[id]
 * Eliminar una especialidad y sus precios asociados
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
    const specialtyId = parseInt(id);

    if (isNaN(specialtyId)) {
      return NextResponse.json(
        { success: false, error: 'ID de especialidad inválido' },
        { status: 400 }
      );
    }

    const specialty = await prisma.specialty.findUnique({
      where: { id: specialtyId }
    });

    if (!specialty) {
      return NextResponse.json(
        { success: false, error: 'Especialidad no encontrada' },
        { status: 404 }
      );
    }

    // Verificar si hay vacantes usando esta especialidad
    const jobsWithProfile = await prisma.job.count({
      where: { profile: specialty.name }
    });

    if (jobsWithProfile > 0) {
      return NextResponse.json(
        {
          success: false,
          error: `No se puede eliminar: hay ${jobsWithProfile} vacante(s) usando esta especialidad`
        },
        { status: 409 }
      );
    }

    // Eliminar precios asociados primero
    const deletedPricing = await prisma.pricingMatrix.deleteMany({
      where: { profile: specialty.name }
    });

    // Eliminar especialidad
    await prisma.specialty.delete({
      where: { id: specialtyId }
    });

    return NextResponse.json({
      success: true,
      message: `Especialidad "${specialty.name}" eliminada junto con ${deletedPricing.count} precios asociados`
    });
  } catch (error) {
    console.error('Error deleting specialty:', error);
    return NextResponse.json(
      { success: false, error: 'Error al eliminar especialidad' },
      { status: 500 }
    );
  }
}
