// RUTA: src/app/api/admin/specialties/route.ts

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

// Función para generar slug
function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Remover acentos
    .replace(/[^a-z0-9]+/g, '-') // Reemplazar espacios y caracteres especiales
    .replace(/^-+|-+$/g, ''); // Remover guiones al inicio/final
}

/**
 * GET /api/admin/specialties
 * Listar todas las especialidades
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const activeOnly = searchParams.get('active') === 'true';
    const includeSubcategories = searchParams.get('subcategories') !== 'false';

    const where = activeOnly ? { isActive: true } : {};

    const specialties = await prisma.specialty.findMany({
      where,
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      select: {
        id: true,
        name: true,
        slug: true,
        description: true,
        icon: true,
        color: true,
        subcategories: includeSubcategories,
        sortOrder: true,
        isActive: true,
        createdAt: true,
        updatedAt: true
      }
    });

    return NextResponse.json({
      success: true,
      data: specialties,
      count: specialties.length
    });
  } catch (error) {
    console.error('Error fetching specialties:', error);
    return NextResponse.json(
      { success: false, error: 'Error al obtener especialidades' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/specialties
 * Crear nueva especialidad
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
    const {
      name,
      description,
      icon,
      color,
      subcategories,
      sortOrder,
      isActive
    } = body;

    // Validaciones
    if (!name || name.trim() === '') {
      return NextResponse.json(
        { success: false, error: 'El nombre es requerido' },
        { status: 400 }
      );
    }

    // Verificar nombre único
    const existing = await prisma.specialty.findUnique({
      where: { name: name.trim() }
    });

    if (existing) {
      return NextResponse.json(
        { success: false, error: 'Ya existe una especialidad con ese nombre' },
        { status: 409 }
      );
    }

    // Generar slug
    const slug = generateSlug(name);

    // Verificar slug único
    const existingSlug = await prisma.specialty.findUnique({
      where: { slug }
    });

    if (existingSlug) {
      return NextResponse.json(
        { success: false, error: 'Ya existe una especialidad con ese slug' },
        { status: 409 }
      );
    }

    // Obtener el siguiente sortOrder si no se especifica
    let finalSortOrder = sortOrder;
    if (finalSortOrder === undefined || finalSortOrder === null) {
      const lastSpecialty = await prisma.specialty.findFirst({
        orderBy: { sortOrder: 'desc' }
      });
      finalSortOrder = (lastSpecialty?.sortOrder || 0) + 1;
    }

    // Crear especialidad
    const specialty = await prisma.specialty.create({
      data: {
        name: name.trim(),
        slug,
        description: description?.trim() || null,
        icon: icon || null,
        color: color || '#2b5d62',
        subcategories: subcategories || [],
        sortOrder: finalSortOrder,
        isActive: isActive !== false
      }
    });

    // Auto-generar 15 combinaciones en PricingMatrix (5 seniorities × 3 workModes)
    const workModes = ['presential', 'hybrid', 'remote'];
    const seniorityLevels = ['Director', 'Sr', 'Middle', 'Jr', 'Practicante'];

    // Créditos base por seniority
    const baseCredits: Record<string, number> = {
      'Director': 10,
      'Sr': 8,
      'Middle': 6,
      'Jr': 4,
      'Practicante': 2
    };

    // Ajuste por modalidad
    const workModeBonus: Record<string, number> = {
      'presential': 0,
      'hybrid': 1,
      'remote': 2
    };

    const pricingData = [];
    for (const workMode of workModes) {
      for (const seniority of seniorityLevels) {
        const credits = baseCredits[seniority] + workModeBonus[workMode];
        pricingData.push({
          profile: specialty.name,
          seniority,
          workMode,
          location: null,
          credits,
          isActive: true
        });
      }
    }

    await prisma.pricingMatrix.createMany({
      data: pricingData,
      skipDuplicates: true
    });

    return NextResponse.json(
      {
        success: true,
        message: `Especialidad creada exitosamente con ${pricingData.length} precios generados`,
        data: specialty,
        pricingGenerated: pricingData.length
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Error creating specialty:', error);
    return NextResponse.json(
      { success: false, error: 'Error al crear especialidad' },
      { status: 500 }
    );
  }
}
