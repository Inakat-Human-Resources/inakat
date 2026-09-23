// RUTA: src/app/api/admin/vendors/commissions/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/auth';
import { getPaginationParams } from '@/lib/pagination';
import { etiquetaEstadoComision } from '@/lib/comisiones';

// DEAD-CODE (#PAGO): se eliminó `getAuthFromHeaders`. Corría después de
// `requireRole('admin')` (que ya valida cookie + rol en la base de datos), su
// `userId` no se usaba, y respondía 401 si faltaban las cabeceras del
// middleware: un segundo camino de fallo sin ninguna garantía adicional.

// GET - Listar todas las comisiones (filtrable por status)
export async function GET(request: NextRequest) {
  try {
    // Defense-in-depth: verificar rol además del middleware
    const roleCheck = await requireRole('admin');
    if ('error' in roleCheck) {
      return NextResponse.json(
        { success: false, error: roleCheck.error },
        { status: roleCheck.status }
      );
    }

    // VALIDACIÓN (#PAGO): page/limit acotados a [1,100] (antes `parseInt`
    // directo: limit=abc -> NaN -> 500, page=0 -> skip negativo -> 500,
    // limit=99999999 -> paginación anulada).
    const { searchParams } = new URL(request.url);
    const { page, limit, skip } = getPaginationParams(searchParams, 20);
    const status = searchParams.get('status'); // pending, paid
    const vendorIdParam = searchParams.get('vendorId');

    let vendorId: number | null = null;
    if (vendorIdParam !== null) {
      const parsed = Number.parseInt(vendorIdParam, 10);
      if (!Number.isInteger(parsed) || parsed <= 0) {
        return NextResponse.json(
          { success: false, error: 'vendorId inválido' },
          { status: 400 }
        );
      }
      vendorId = parsed;
    }

    // DINERO (#PAGO): una comisión sólo cuenta si la compra que la generó se
    // pagó. `DiscountCodeUse` se crea en POST /api/credits/purchases junto con la
    // compra, ANTES de saber si MercadoPago la aprueba; si el pago se rechaza o
    // el OXXO/SPEI nunca se paga, el webhook marca la compra como 'failed' pero
    // la comisión queda intacta. Sin este filtro, el panel las mostraba como
    // pagables y las sumaba a ventas e ingresos.
    const SOLO_COMPRAS_PAGADAS = { purchase: { paymentStatus: 'paid' } };

    const whereClause: Record<string, unknown> = { ...SOLO_COMPRAS_PAGADAS };
    if (status) {
      whereClause.commissionStatus = status;
    }
    if (vendorId !== null) {
      whereClause.code = { userId: vendorId };
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
        // ORDEN (#PAGO): era `commissionStatus: 'asc'` con el comentario
        // "Pending primero", pero el orden es lexicográfico y 'paid' < 'pending':
        // sin filtro de estado la primera página traía sólo comisiones YA
        // pagadas. Con 'desc' las pendientes van primero, y dentro de ellas
        // manda la fecha límite: lo que antes vence, antes se ve (la lista se
        // ordenaba por createdAt desc, así que las más urgentes eran justo las
        // que quedaban escondidas al final).
        orderBy: [
          { commissionStatus: 'desc' },
          { paymentDueDate: 'asc' },
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
        statusLabel: etiquetaEstadoComision(comm.commissionStatus),
        paidAt: comm.commissionPaidAt,
        dueDate: comm.paymentDueDate,
        proofUrl: comm.paymentProofUrl
      },
      createdAt: comm.createdAt
    }));

    // Resumen por status
    const [pendingSum, paidSum] = await Promise.all([
      prisma.discountCodeUse.aggregate({
        where: { commissionStatus: 'pending', ...SOLO_COMPRAS_PAGADAS },
        _sum: { commissionAmount: true },
        _count: true
      }),
      prisma.discountCodeUse.aggregate({
        where: { commissionStatus: 'paid', ...SOLO_COMPRAS_PAGADAS },
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
