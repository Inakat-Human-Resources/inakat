// RUTA: src/app/api/vendor/my-sales/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getPaginationParams } from '@/lib/pagination';
import { requireRole } from '@/lib/auth';
import { etiquetaEstadoComision } from '@/lib/comisiones';

/**
 * DINERO (AUTH-004): el panel de ventas y comisiones se autorizaba sólo con la
 * cabecera x-user-id y el middleware no exigía ningún rol en /api/vendor/*, así
 * que lo abría cualquier cuenta registrada. El rol 'vendor' lo asigna el admin
 * (POST /api/admin/vendors); `requireRole` lo comprueba contra la base y con él
 * `isActive`, sin esperar a que caduque el JWT (AUTH-002).
 */
const ROLES_VENDEDOR = ['vendor', 'admin'];

// GET - Listar ventas donde se usó el código del vendedor
export async function GET(request: NextRequest) {
  try {
    const auth = await requireRole(ROLES_VENDEDOR);
    if ('error' in auth) {
      return NextResponse.json(
        { success: false, error: auth.error },
        { status: auth.status }
      );
    }

    const userId = auth.user.id;

    // Obtener el código del vendedor
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

    // VALIDACIÓN (#PAGO): esta ruta la puede llamar cualquier usuario
    // autenticado. Con `parseInt` directo, ?page=0 daba skip=-20 (Prisma lanza
    // -> 500), ?limit=abc daba NaN (-> 500), ?limit=0 dejaba totalPages en
    // Infinity y un limit enorme traía TODAS las ventas con joins de tres
    // niveles en una sola respuesta. El helper acota a [1, 100].
    const { searchParams } = new URL(request.url);
    const { page, limit, skip } = getPaginationParams(searchParams, 20);

    // Obtener ventas con el código
    const [sales, totalCount, summaryData] = await Promise.all([
      prisma.discountCodeUse.findMany({
        where: { codeId: discountCode.id, purchase: { paymentStatus: 'paid' } },
        include: {
          purchase: {
            include: {
              // PRIVACIDAD (#PAGO): el vendedor sólo necesita saber QUÉ empresa
              // compró. Antes se le devolvían también el id interno de User y el
              // nombre de la persona que administra la cuenta, y el select traía
              // el email (que no se devolvía, pero se cargaba en cada fila: a un
              // descuido de filtrarse). Como cualquier usuario puede crear un
              // código y difundirlo, eso convertía la ruta en una fuga de datos
              // de contacto de las empresas que lo usaran.
              user: {
                select: {
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
        where: { codeId: discountCode.id, purchase: { paymentStatus: 'paid' } }
      }),
      prisma.discountCodeUse.aggregate({
        where: { codeId: discountCode.id, purchase: { paymentStatus: 'paid' } },
        _sum: {
          commissionAmount: true
        }
      })
    ]);

    // Calcular comisiones por estado
    const [pendingSum, paidSum] = await Promise.all([
      prisma.discountCodeUse.aggregate({
        where: { codeId: discountCode.id, commissionStatus: 'pending', purchase: { paymentStatus: 'paid' } },
        _sum: { commissionAmount: true }
      }),
      prisma.discountCodeUse.aggregate({
        where: {
          codeId: discountCode.id,
          commissionStatus: 'paid',
          // Este agregado se había quedado sin el filtro de compra pagada.
          purchase: { paymentStatus: 'paid' }
        },
        _sum: { commissionAmount: true }
      })
    ]);

    // Formatear ventas
    const formattedSales = sales.map(sale => ({
      id: sale.id,
      company: {
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
        statusLabel: etiquetaEstadoComision(sale.commissionStatus),
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
