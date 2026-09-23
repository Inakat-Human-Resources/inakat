// RUTA: src/app/api/admin/pricing/sync/route.ts

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/auth';
// Misma tabla que usa POST /api/admin/specialties al crear una especialidad.
// Antes aquí había una copia propia sin 'Practicante' (4 seniorities en lugar
// de 5): una fila de practicante borrada no se regeneraba nunca y esa vacante
// pasaba a costar el DEFAULT de 5 créditos, más que un Jr presencial.
import {
  COMBINACIONES_ESPERADAS,
  claveCombinacion,
  generarPreciosPorDefecto
} from '@/app/api/admin/pricing/precios-por-defecto';

/**
 * GET /api/admin/pricing/sync
 * Verificar qué especialidades faltan precios
 */
export async function GET() {
  try {
    const auth = await requireRole('admin');
    if ('error' in auth) {
      return NextResponse.json(
        { success: false, error: auth.error },
        { status: auth.status }
      );
    }

    // Obtener todas las especialidades activas
    const specialties = await prisma.specialty.findMany({
      where: { isActive: true },
      select: { id: true, name: true }
    });

    // Precios existentes por combinación (no por conteo): contar filas daba
    // "completa" a una especialidad con 12 filas aunque le faltaran 3
    // combinaciones y le sobraran otras (p. ej. con `location`).
    const existingPricing = await prisma.pricingMatrix.findMany({
      where: { profile: { in: specialties.map((s) => s.name) } },
      select: { profile: true, seniority: true, workMode: true }
    });

    const combinacionesPorPerfil = new Map<string, Set<string>>();
    for (const fila of existingPricing) {
      if (!combinacionesPorPerfil.has(fila.profile)) {
        combinacionesPorPerfil.set(fila.profile, new Set());
      }
      combinacionesPorPerfil.get(fila.profile)!.add(claveCombinacion(fila.seniority, fila.workMode));
    }

    // Encontrar especialidades sin precios o con precios incompletos
    const missingPricing = [];
    const incompletePricing = [];

    for (const specialty of specialties) {
      const combinaciones = combinacionesPorPerfil.get(specialty.name);

      if (!combinaciones || combinaciones.size === 0) {
        missingPricing.push(specialty);
        continue;
      }

      const faltantes = generarPreciosPorDefecto(specialty.name)
        .map((fila) => claveCombinacion(fila.seniority, fila.workMode))
        .filter((clave) => !combinaciones.has(clave));

      if (faltantes.length > 0) {
        incompletePricing.push({
          ...specialty,
          currentCount: COMBINACIONES_ESPERADAS - faltantes.length,
          expected: COMBINACIONES_ESPERADAS,
          missingCombinations: faltantes
        });
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        totalSpecialties: specialties.length,
        withCompletePricing: specialties.length - missingPricing.length - incompletePricing.length,
        missingPricing,
        incompletePricing
      }
    });
  } catch (error) {
    console.error('Error checking pricing sync:', error);
    return NextResponse.json(
      { success: false, error: 'Error al verificar sincronización' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/pricing/sync
 * Generar precios faltantes para especialidades existentes
 */
export async function POST() {
  try {
    const auth = await requireRole('admin');
    if ('error' in auth) {
      return NextResponse.json(
        { success: false, error: auth.error },
        { status: auth.status }
      );
    }

    // Obtener todas las especialidades activas
    const specialties = await prisma.specialty.findMany({
      where: { isActive: true }
    });

    let totalCreated = 0;
    const syncedSpecialties = [];

    for (const specialty of specialties) {
      // Obtener precios existentes para esta especialidad
      const existingPricing = await prisma.pricingMatrix.findMany({
        where: { profile: specialty.name },
        select: { seniority: true, workMode: true }
      });

      const existingCombinations = new Set(
        existingPricing.map(p => claveCombinacion(p.seniority, p.workMode))
      );

      // Generar combinaciones faltantes
      const missingPricing = generarPreciosPorDefecto(specialty.name).filter(
        (fila) => !existingCombinations.has(claveCombinacion(fila.seniority, fila.workMode))
      );

      if (missingPricing.length > 0) {
        // Se cuenta lo REALMENTE creado, no lo intentado: `location` es NULL y
        // en PostgreSQL los NULL no colisionan, así que skipDuplicates puede no
        // filtrar nada y el conteo anterior mentía.
        const creados = await prisma.pricingMatrix.createMany({
          data: missingPricing,
          skipDuplicates: true
        });

        totalCreated += creados.count;
        syncedSpecialties.push({
          name: specialty.name,
          created: creados.count
        });
      }
    }

    return NextResponse.json({
      success: true,
      message: totalCreated > 0
        ? `Sincronización completada: ${totalCreated} precios creados`
        : 'Todas las especialidades ya tienen sus precios completos',
      data: {
        totalCreated,
        syncedSpecialties
      }
    });
  } catch (error) {
    console.error('Error syncing pricing:', error);
    return NextResponse.json(
      { success: false, error: 'Error al sincronizar precios' },
      { status: 500 }
    );
  }
}
