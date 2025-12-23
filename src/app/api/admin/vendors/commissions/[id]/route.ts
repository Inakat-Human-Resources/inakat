// RUTA: src/app/api/admin/vendors/commissions/[id]/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

interface RouteParams {
  params: Promise<{ id: string }>;
}

// Helper para obtener info de usuario de los headers (agregados por middleware)
function getAuthFromHeaders(request: NextRequest): { userId: number; role: string } | null {
  const userId = request.headers.get('x-user-id');
  const role = request.headers.get('x-user-role');
  if (!userId || !role) return null;
  return { userId: parseInt(userId), role };
}

// PUT - Actualizar estado de comisión
export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const auth = getAuthFromHeaders(request);
    if (!auth || auth.role !== 'admin') {
      return NextResponse.json(
        { success: false, error: 'No autorizado' },
        { status: 401 }
      );
    }

    const { id } = await params;
    const commissionId = parseInt(id);

    if (isNaN(commissionId)) {
      return NextResponse.json(
        { success: false, error: 'ID de comisión inválido' },
        { status: 400 }
      );
    }

    // Verificar que la comisión existe
    const commission = await prisma.discountCodeUse.findUnique({
      where: { id: commissionId },
      include: {
        code: {
          include: {
            user: {
              select: {
                id: true,
                nombre: true,
                email: true
              }
            }
          }
        }
      }
    });

    if (!commission) {
      return NextResponse.json(
        { success: false, error: 'Comisión no encontrada' },
        { status: 404 }
      );
    }

    const body = await request.json();
    const { status, paymentProofUrl } = body;

    // Validar status
    const validStatuses = ['pending', 'paid'];
    if (status && !validStatuses.includes(status)) {
      return NextResponse.json(
        { success: false, error: 'Estado inválido. Usar: pending, paid' },
        { status: 400 }
      );
    }

    // Preparar datos de actualización
    const updateData: Record<string, unknown> = {};

    if (status) {
      updateData.commissionStatus = status;

      // Si se marca como pagado, guardar fecha
      if (status === 'paid') {
        updateData.commissionPaidAt = new Date();
      } else if (status === 'pending') {
        // Si se revierte a pending, limpiar fecha de pago
        updateData.commissionPaidAt = null;
      }
    }

    if (paymentProofUrl !== undefined) {
      updateData.paymentProofUrl = paymentProofUrl;
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json(
        { success: false, error: 'No hay datos para actualizar' },
        { status: 400 }
      );
    }

    // Actualizar comisión
    const updatedCommission = await prisma.discountCodeUse.update({
      where: { id: commissionId },
      data: updateData,
      include: {
        code: {
          include: {
            user: {
              select: {
                id: true,
                nombre: true,
                email: true
              }
            }
          }
        },
        purchase: {
          select: {
            id: true,
            amount: true
          }
        }
      }
    });

    return NextResponse.json({
      success: true,
      data: {
        id: updatedCommission.id,
        vendor: {
          id: updatedCommission.code.user.id,
          nombre: updatedCommission.code.user.nombre,
          email: updatedCommission.code.user.email,
          code: updatedCommission.code.code
        },
        commission: {
          amount: updatedCommission.commissionAmount,
          status: updatedCommission.commissionStatus,
          statusLabel: updatedCommission.commissionStatus === 'paid' ? 'Pagada' : 'Pendiente',
          paidAt: updatedCommission.commissionPaidAt,
          proofUrl: updatedCommission.paymentProofUrl
        },
        purchaseId: updatedCommission.purchaseId
      },
      message: status === 'paid' ? 'Comisión marcada como pagada' : 'Comisión actualizada'
    });
  } catch (error) {
    console.error('Error updating commission:', error);
    return NextResponse.json(
      { success: false, error: 'Error al actualizar comisión' },
      { status: 500 }
    );
  }
}

// GET - Obtener detalle de una comisión específica
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const auth = getAuthFromHeaders(request);
    if (!auth || auth.role !== 'admin') {
      return NextResponse.json(
        { success: false, error: 'No autorizado' },
        { status: 401 }
      );
    }

    const { id } = await params;
    const commissionId = parseInt(id);

    if (isNaN(commissionId)) {
      return NextResponse.json(
        { success: false, error: 'ID de comisión inválido' },
        { status: 400 }
      );
    }

    const commission = await prisma.discountCodeUse.findUnique({
      where: { id: commissionId },
      include: {
        code: {
          include: {
            user: {
              select: {
                id: true,
                nombre: true,
                apellidoPaterno: true,
                apellidoMaterno: true,
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
      }
    });

    if (!commission) {
      return NextResponse.json(
        { success: false, error: 'Comisión no encontrada' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        id: commission.id,
        vendor: {
          id: commission.code.user.id,
          nombre: `${commission.code.user.nombre} ${commission.code.user.apellidoPaterno || ''} ${commission.code.user.apellidoMaterno || ''}`.trim(),
          email: commission.code.user.email,
          code: commission.code.code
        },
        company: {
          id: commission.purchase.user.id,
          nombre: commission.purchase.user.nombre,
          email: commission.purchase.user.email,
          nombreEmpresa: commission.purchase.user.companyRequest?.nombreEmpresa || 'N/A'
        },
        purchase: {
          id: commission.purchaseId,
          credits: commission.purchase.amount,
          originalPrice: commission.originalPrice,
          discountAmount: commission.discountAmount,
          finalPrice: commission.finalPrice
        },
        commission: {
          amount: commission.commissionAmount,
          status: commission.commissionStatus,
          statusLabel: commission.commissionStatus === 'paid' ? 'Pagada' : 'Pendiente',
          paidAt: commission.commissionPaidAt,
          dueDate: commission.paymentDueDate,
          proofUrl: commission.paymentProofUrl
        },
        createdAt: commission.createdAt
      }
    });
  } catch (error) {
    console.error('Error getting commission:', error);
    return NextResponse.json(
      { success: false, error: 'Error al obtener comisión' },
      { status: 500 }
    );
  }
}
