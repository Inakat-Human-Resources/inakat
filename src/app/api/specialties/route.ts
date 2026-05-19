// RUTA: src/app/api/specialties/route.ts

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

/**
 * GET /api/specialties
 * Obtener especialidades activas (público, sin autenticación)
 * Usado por formularios de candidatos, vacantes, etc.
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const withSubcategories = searchParams.get('subcategories') === 'true';

    const specialties = await prisma.specialty.findMany({
      where: { isActive: true },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      select: {
        id: true,
        name: true,
        slug: true,
        icon: true,
        color: true,
        subcategories: withSubcategories,
        description: false // No enviar descripción para mantener respuesta ligera
      }
    });

    // Si solo se necesitan los nombres (para selects simples)
    const names = specialties.map((s) => s.name);

    return NextResponse.json(
      {
        success: true,
        data: specialties,
        names, // Array simple de nombres para selects
        count: specialties.length
      },
      {
        headers: {
          'Cache-Control': 'public, s-maxage=600, stale-while-revalidate=86400'
        }
      }
    );
  } catch (error) {
    console.error('Error fetching specialties:', error);
    return NextResponse.json(
      { success: false, error: 'Error al obtener especialidades' },
      { status: 500 }
    );
  }
}
