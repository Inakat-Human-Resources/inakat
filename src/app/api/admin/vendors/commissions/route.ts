// RUTA: src/app/api/admin/vendors/commissions/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// Helper para obtener info de usuario de los headers (agregados por middleware)
function getAuthFromHeaders(request: NextRequest): { userId: number; role: string } | null {
  const userId = request.headers.get('x-user-id');
  const role = request.headers.get('x-user-role');
  if (!userId || !role) return null;
  return { userId: parseInt(userId), role };
}

// GET - Listar todas las comisiones (filtrable por status)
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
    const status = searchParams.get('status'); // pending, paid
    const vendorId = searchParams.get('vendorId');
    const skip = (page - 1) * limit;

    // Construir filtros
    const whereClause: Record<string, unknown> = {};
    if (status) {
      whereClause.commissionStatus = status;
    }
    if (vendorId) {
      whereClause.code = {
        userId: parseInt(vendorId)
      };
    }

    // Obtener comisiones
    const [commissions, totalCount] = await Promise.all([
      prisma.discountCodeUse.findMany({
        where: whereClause,
        include: {
          code: {
            include: {
              user: {
                select: {
                  id: true,
                  nombre: true,
                  apellidoPaterno: true,
                  email: true
                }
              }
            }
          },
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
        orderBy: [
          { commissionStatus: 'asc' }, // Pending primero
          { createdAt: 'desc' }
        ],
        skip,
        take: limit
      }),
      prisma.discountCodeUse.count({ where: whereClause })
    ]);

    // Formatear respuesta
    const formattedCommissions = commissions.map(comm => ({
      id: comm.id,
      vendor: {
        id: comm.code.user.id,
        nombre: `${comm.code.user.nombre} ${comm.code.user.apellidoPaterno || ''}`.trim(),
        email: comm.code.user.email,
        code: comm.code.code
      },
      company: {
        id: comm.purchase.user.id,
        nombre: comm.purchase.user.nombre,
        email: comm.purchase.user.email,
        nombreEmpresa: comm.purchase.user.companyRequest?.nombreEmpresa || 'N/A'
      },
      purchase: {
        id: comm.purchaseId,
        credits: comm.purchase.amount,
        originalPrice: comm.originalPrice,
        discountAmount: comm.discountAmount,
        finalPrice: comm.finalPrice
      },
      commission: {
        amount: comm.commissionAmount,
        status: comm.commissionStatus,
        statusLabel: comm.commissionStatus === 'paid' ? 'Pagada' : 'Pendiente',
        paidAt: comm.commissionPaidAt,
        dueDate: comm.paymentDueDate,
        proofUrl: comm.paymentProofUrl
      },
      createdAt: comm.createdAt
    }));

    // Resumen por status
    const [pendingSum, paidSum] = await Promise.all([
      prisma.discountCodeUse.aggregate({
        where: { commissionStatus: 'pending' },
        _sum: { commissionAmount: true },
        _count: true
      }),
      prisma.discountCodeUse.aggregate({
        where: { commissionStatus: 'paid' },
        _sum: { commissionAmount: true },
        _count: true
      })
    ]);

    return NextResponse.json({
      success: true,
      data: {
        commissions: formattedCommissions,
        summary: {
          pending: {
            count: pendingSum._count,
            total: pendingSum._sum.commissionAmount || 0
          },
          paid: {
            count: paidSum._count,
            total: paidSum._sum.commissionAmount || 0
          }
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
    console.error('Error getting commissions:', error);
    return NextResponse.json(
      { success: false, error: 'Error al obtener comisiones' },
      { status: 500 }
    );
  }
}
