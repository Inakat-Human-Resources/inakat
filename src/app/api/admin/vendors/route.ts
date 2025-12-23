// RUTA: src/app/api/admin/vendors/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// Helper para obtener info de usuario de los headers (agregados por middleware)
function getAuthFromHeaders(request: NextRequest): { userId: number; role: string } | null {
  const userId = request.headers.get('x-user-id');
  const role = request.headers.get('x-user-role');
  if (!userId || !role) return null;
  return { userId: parseInt(userId), role };
}

// GET - Listar todos los vendedores con sus códigos
export async function GET(request: NextRequest) {
  try {
    const auth = getAuthFromHeaders(request);
    if (!auth || auth.role !== 'admin') {
      return NextResponse.json(
        { success: false, error: 'No autorizado' },
        { status: 401 }
      );
    }

    // Obtener parámetros
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const search = searchParams.get('search') || '';
    const skip = (page - 1) * limit;

    // Construir filtros
    const whereClause: Record<string, unknown> = {};
    if (search) {
      whereClause.OR = [
        { code: { contains: search, mode: 'insensitive' } },
        { user: { nombre: { contains: search, mode: 'insensitive' } } },
        { user: { email: { contains: search, mode: 'insensitive' } } }
      ];
    }

    // Obtener códigos con estadísticas
    const [codes, totalCount] = await Promise.all([
      prisma.discountCode.findMany({
        where: whereClause,
        include: {
          user: {
            select: {
              id: true,
              nombre: true,
              apellidoPaterno: true,
              apellidoMaterno: true,
              email: true,
              role: true
            }
          },
          uses: {
            select: {
              id: true,
              finalPrice: true,
              commissionAmount: true,
              commissionStatus: true
            }
          }
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit
      }),
      prisma.discountCode.count({ where: whereClause })
    ]);

    // Formatear respuesta con estadísticas
    const vendors = codes.map(code => {
      const totalSales = code.uses.length;
      const totalRevenue = code.uses.reduce((sum, use) => sum + use.finalPrice, 0);
      const totalCommission = code.uses.reduce((sum, use) => sum + use.commissionAmount, 0);
      const pendingCommission = code.uses
        .filter(use => use.commissionStatus === 'pending')
        .reduce((sum, use) => sum + use.commissionAmount, 0);
      const paidCommission = code.uses
        .filter(use => use.commissionStatus === 'paid')
        .reduce((sum, use) => sum + use.commissionAmount, 0);

      return {
        id: code.id,
        code: code.code,
        discountPercent: code.discountPercent,
        commissionPercent: code.commissionPercent,
        isActive: code.isActive,
        createdAt: code.createdAt,
        user: {
          id: code.user.id,
          nombre: `${code.user.nombre} ${code.user.apellidoPaterno || ''} ${code.user.apellidoMaterno || ''}`.trim(),
          email: code.user.email,
          role: code.user.role
        },
        stats: {
          totalSales,
          totalRevenue,
          totalCommission,
          pendingCommission,
          paidCommission
        }
      };
    });

    // Estadísticas globales
    const globalStats = await prisma.discountCodeUse.aggregate({
      _sum: {
        finalPrice: true,
        commissionAmount: true
      },
      _count: true
    });

    const pendingGlobal = await prisma.discountCodeUse.aggregate({
      where: { commissionStatus: 'pending' },
      _sum: { commissionAmount: true }
    });

    return NextResponse.json({
      success: true,
      data: {
        vendors,
        globalStats: {
          totalVendors: totalCount,
          totalSales: globalStats._count,
          totalRevenue: globalStats._sum.finalPrice || 0,
          totalCommissions: globalStats._sum.commissionAmount || 0,
          pendingCommissions: pendingGlobal._sum.commissionAmount || 0
        },
        pagination: {
          page,
          limit,
          totalCount,
          totalPages: Math.ceil(totalCount / limit)
        }
      }
    });
  } catch (error) {
    console.error('Error getting vendors:', error);
    return NextResponse.json(
      { success: false, error: 'Error al obtener vendedores' },
      { status: 500 }
    );
  }
}
