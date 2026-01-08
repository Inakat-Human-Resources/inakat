// RUTA: src/app/api/admin/pricing/sync/route.ts

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

/**
 * GET /api/admin/pricing/sync
 * Verificar qué especialidades faltan precios
 */
export async function GET() {
  try {
    const auth = await verifyAdmin();
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

    // Obtener todos los profiles con precios
    const existingPricing = await prisma.pricingMatrix.groupBy({
      by: ['profile'],
      _count: { id: true }
    });

    const profilesWithPricing = new Set(existingPricing.map(p => p.profile));

    // Encontrar especialidades sin precios o con precios incompletos
    const missingPricing = [];
    const incompletePricing = [];

    for (const specialty of specialties) {
      const pricingEntry = existingPricing.find(p => p.profile === specialty.name);

      if (!pricingEntry) {
        missingPricing.push(specialty);
      } else if (pricingEntry._count.id < 12) {
        incompletePricing.push({
          ...specialty,
          currentCount: pricingEntry._count.id,
          expected: 12
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
    const auth = await verifyAdmin();
    if ('error' in auth) {
      return NextResponse.json(
        { success: false, error: auth.error },
        { status: auth.status }
      );
    }

    // Configuración de precios
    const workModes = ['presential', 'hybrid', 'remote'];
    const seniorityLevels = ['Director', 'Sr', 'Middle', 'Jr'];

    const baseCredits: Record<string, number> = {
      'Director': 10,
      'Sr': 8,
      'Middle': 6,
      'Jr': 4
    };

    const workModeBonus: Record<string, number> = {
      'presential': 0,
      'hybrid': 1,
      'remote': 2
    };

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
        existingPricing.map(p => `${p.seniority}-${p.workMode}`)
      );

      // Generar combinaciones faltantes
      const missingPricing = [];

      for (const workMode of workModes) {
        for (const seniority of seniorityLevels) {
          const key = `${seniority}-${workMode}`;

          if (!existingCombinations.has(key)) {
            const credits = baseCredits[seniority] + workModeBonus[workMode];
            missingPricing.push({
              profile: specialty.name,
              seniority,
              workMode,
              location: null,
              credits,
              isActive: true
            });
          }
        }
      }

      if (missingPricing.length > 0) {
        await prisma.pricingMatrix.createMany({
          data: missingPricing,
          skipDuplicates: true
        });

        totalCreated += missingPricing.length;
        syncedSpecialties.push({
          name: specialty.name,
          created: missingPricing.length
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
