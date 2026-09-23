// RUTA: src/app/api/admin/specialties/route.ts

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/auth';
import {
  claveCombinacion,
  generarPreciosPorDefecto
} from '@/app/api/admin/pricing/precios-por-defecto';

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
    // Defensa en profundidad como el resto del módulo: el middleware sólo valida
    // la firma del JWT, no si el admin sigue activo ni su rol actual en BD.
    const auth = await requireRole('admin');
    if ('error' in auth) {
      return NextResponse.json(
        { success: false, error: auth.error },
        { status: auth.status }
      );
    }

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
    const auth = await requireRole('admin');
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
    if (!name || typeof name !== 'string' || name.trim() === '') {
      return NextResponse.json(
        { success: false, error: 'El nombre es requerido' },
        { status: 400 }
      );
    }

    if (subcategories !== undefined && !Array.isArray(subcategories)) {
      return NextResponse.json(
        { success: false, error: 'subcategories debe ser un array de textos' },
        { status: 400 }
      );
    }

    if (
      Array.isArray(subcategories) &&
      subcategories.some((s: unknown) => typeof s !== 'string')
    ) {
      return NextResponse.json(
        { success: false, error: 'subcategories debe ser un array de textos' },
        { status: 400 }
      );
    }

    if (sortOrder !== undefined && sortOrder !== null && !Number.isInteger(sortOrder)) {
      return NextResponse.json(
        { success: false, error: 'sortOrder debe ser un entero' },
        { status: 400 }
      );
    }

    if (isActive !== undefined && typeof isActive !== 'boolean') {
      return NextResponse.json(
        { success: false, error: 'isActive debe ser booleano' },
        { status: 400 }
      );
    }

    if (color !== undefined && color !== null && !/^#[0-9a-f]{6}$/i.test(String(color))) {
      return NextResponse.json(
        { success: false, error: 'color debe ser un hexadecimal tipo #2b5d62' },
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

    // generateSlug devuelve '' para nombres sin caracteres alfanuméricos
    // ("###"): la primera se creaba con slug vacío y la siguiente chocaba.
    if (!slug) {
      return NextResponse.json(
        { success: false, error: 'El nombre debe contener letras o números' },
        { status: 400 }
      );
    }

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

    const nombreLimpio = name.trim();

    // Auto-generar 15 combinaciones en PricingMatrix (5 seniorities × 3
    // workModes) con la misma tabla que usa /api/admin/pricing/sync.
    const pricingData = generarPreciosPorDefecto(nombreLimpio);

    // Especialidad + matriz de precios en UNA transacción: sueltas, si el
    // createMany fallaba la especialidad quedaba creada SIN precios (el admin
    // veía un 500, reintentaba y recibía 409) y todas sus vacantes pasaban a
    // costar el DEFAULT de 5 créditos.
    // skipDuplicates no protege aquí (location es NULL y en PostgreSQL los NULL
    // no colisionan), así que se comprueba antes si ese profile ya tiene filas.
    const specialty = await prisma.$transaction(async (tx) => {
      const creada = await tx.specialty.create({
        data: {
          name: nombreLimpio,
          slug,
          description: description?.trim() || null,
          icon: icon || null,
          color: color || '#2b5d62',
          subcategories: subcategories || [],
          sortOrder: finalSortOrder,
          isActive: isActive !== false
        }
      });

      const yaExistentes = await tx.pricingMatrix.findMany({
        where: { profile: nombreLimpio },
        select: { seniority: true, workMode: true }
      });
      const combinacionesExistentes = new Set(
        yaExistentes.map((p) => claveCombinacion(p.seniority, p.workMode))
      );

      const porCrear = pricingData.filter(
        (p) => !combinacionesExistentes.has(claveCombinacion(p.seniority, p.workMode))
      );

      if (porCrear.length > 0) {
        await tx.pricingMatrix.createMany({ data: porCrear });
      }

      return { creada, generados: porCrear.length };
    });

    return NextResponse.json(
      {
        success: true,
        message: `Especialidad creada exitosamente con ${specialty.generados} precios generados`,
        data: specialty.creada,
        pricingGenerated: specialty.generados
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Error creating specialty:', error);
    if ((error as { code?: string })?.code === 'P2002') {
      return NextResponse.json(
        { success: false, error: 'Ya existe una especialidad equivalente (nombre o slug)' },
        { status: 409 }
      );
    }
    return NextResponse.json(
      { success: false, error: 'Error al crear especialidad' },
      { status: 500 }
    );
  }
}
