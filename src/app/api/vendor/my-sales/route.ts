// RUTA: src/app/api/vendor/my-sales/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// Helper para obtener userId de los headers (agregados por middleware)
function getUserIdFromHeaders(request: NextRequest): number | null {
  const userId = request.headers.get('x-user-id');
  return userId ? parseInt(userId) : null;
}

// GET - Listar ventas donde se usó el código del usuario
export async function GET(request: NextRequest) {
  try {
    const userId = getUserIdFromHeaders(request);
    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'No autorizado' },
        { status: 401 }
      );
    }

    // Obtener el código del usuario
    const discountCode = await prisma.discountCode.findFirst({
      where: { userId }
    });

    if (!discountCode) {
      return NextResponse.json({
        success: true,
        data: {
          hasCode: false,
          sales: [],
          summary: {
            totalSales: 0,
            totalCommission: 0,
            pendingCommission: 0,
            paidCommission: 0
          }
        }
      });
    }

    // Obtener parámetros de paginación
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const skip = (page - 1) * limit;

    // Obtener ventas con el código
    const [sales, totalCount, summaryData] = await Promise.all([
      prisma.discountCodeUse.findMany({
        where: { codeId: discountCode.id },
        include: {
          purchase: {
            include: {
              user: {
                select: {
                  id: true,
                  nombre: true,
                  email: true,
                  companyRequest: {
                    select: {
                      nombreEmpresa: true
                    }
                  }
                }
              }
            }
          }
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit
      }),
      prisma.discountCodeUse.count({
        where: { codeId: discountCode.id }
      }),
      prisma.discountCodeUse.aggregate({
        where: { codeId: discountCode.id },
        _sum: {
          commissionAmount: true
        }
      })
    ]);

    // Calcular comisiones por estado
    const [pendingSum, paidSum] = await Promise.all([
      prisma.discountCodeUse.aggregate({
        where: { codeId: discountCode.id, commissionStatus: 'pending' },
        _sum: { commissionAmount: true }
      }),
      prisma.discountCodeUse.aggregate({
        where: { codeId: discountCode.id, commissionStatus: 'paid' },
        _sum: { commissionAmount: true }
      })
    ]);

    // Formatear ventas
    const formattedSales = sales.map(sale => ({
      id: sale.id,
      company: {
        id: sale.purchase.user.id,
        nombre: sale.purchase.user.nombre,
        nombreEmpresa: sale.purchase.user.companyRequest?.nombreEmpresa || 'N/A'
      },
      purchase: {
        id: sale.purchaseId,
        credits: sale.purchase.amount,
        originalPrice: sale.originalPrice,
        discountAmount: sale.discountAmount,
        finalPrice: sale.finalPrice
      },
      commission: {
        amount: sale.commissionAmount,
        status: sale.commissionStatus,
        statusLabel: sale.commissionStatus === 'paid' ? 'Pagada' : 'Pendiente',
        paidAt: sale.commissionPaidAt,
        dueDate: sale.paymentDueDate,
        proofUrl: sale.paymentProofUrl
      },
      createdAt: sale.createdAt
    }));

    return NextResponse.json({
      success: true,
      data: {
        hasCode: true,
        code: discountCode.code,
        sales: formattedSales,
        summary: {
          totalSales: totalCount,
          totalCommission: summaryData._sum.commissionAmount || 0,
          pendingCommission: pendingSum._sum.commissionAmount || 0,
          paidCommission: paidSum._sum.commissionAmount || 0
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
    console.error('Error getting vendor sales:', error);
    return NextResponse.json(
      { success: false, error: 'Error al obtener ventas' },
      { status: 500 }
    );
  }
}
