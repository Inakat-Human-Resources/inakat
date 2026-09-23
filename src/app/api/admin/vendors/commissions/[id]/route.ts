// RUTA: src/app/api/admin/vendors/commissions/[id]/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/auth';
import { isSafeHttpUrl } from '@/lib/sanitize';
import { etiquetaEstadoComision } from '@/lib/comisiones';
import { parseId } from '@/lib/pagination';

interface RouteParams {
  params: Promise<{ id: string }>;
}

// DEAD-CODE (#PAGO): se eliminó `getAuthFromHeaders`; `requireRole('admin')` ya
// valida cookie + rol contra la base de datos y devuelve el usuario actor.

// PUT - Actualizar estado de comisión
export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    // Defense-in-depth: verificar rol además del middleware
    const roleCheck = await requireRole('admin');
    if ('error' in roleCheck) {
      return NextResponse.json(
        { success: false, error: roleCheck.error },
        { status: roleCheck.status }
      );
    }

    const { id } = await params;
    const commissionId = parseId(id);

    if (commissionId === null) {
      return NextResponse.json(
        { success: false, error: 'ID de comisión inválido' },
        { status: 400 }
      );
    }

    // Verificar que la comisión existe
    const commission = await prisma.discountCodeUse.findUnique({
      where: { id: commissionId },
      include: {
        purchase: { select: { paymentStatus: true } },
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

    // DINERO (#PAGO): no se puede marcar como pagada la comisión de una venta que
    // nunca se cobró. La comisión nace junto con la compra, antes de saber si
    // MercadoPago la aprueba, así que un pago rechazado deja una comisión viva.
    if (status === 'paid' && commission.purchase?.paymentStatus !== 'paid') {
      return NextResponse.json(
        {
          success: false,
          error:
            'La compra que generó esta comisión no está pagada, así que no hay comisión que liquidar.',
          paymentStatus: commission.purchase?.paymentStatus ?? 'desconocido'
        },
        { status: 409 }
      );
    }

    // TRANSICIÓN (#PAGO): una comisión 'cancelled' (el webhook la cancela cuando
    // la compra se rechaza, se devuelve o sufre un contracargo) no se reabre.
    // Revertirla a 'pending' la devolvía a la lista de comisiones por liquidar
    // de una venta cuyo dinero ya no existe.
    if (commission.commissionStatus === 'cancelled' && status) {
      return NextResponse.json(
        {
          success: false,
          error: 'Esta comisión se canceló porque la compra se rechazó o se devolvió; no se puede reabrir.',
          commissionStatus: commission.commissionStatus
        },
        { status: 409 }
      );
    }

    // VALIDACIÓN (#PAGO): el comprobante se guardaba tal cual, de cualquier tipo
    // y con cualquier esquema, y luego se renderiza como `href` en el panel del
    // vendedor. Un "drive.google.com/file/abc" sin protocolo acababa como enlace
    // relativo roto (/vendor/drive.google.com/...), y un `javascript:` sería XSS
    // almacenado. Un número u objeto reventaba en Prisma y devolvía 500, no 400.
    if (
      paymentProofUrl !== undefined &&
      paymentProofUrl !== null &&
      !isSafeHttpUrl(paymentProofUrl)
    ) {
      return NextResponse.json(
        {
          success: false,
          error: 'El comprobante debe ser una URL http(s) completa (incluye https://)'
        },
        { status: 400 }
      );
    }

    if (typeof paymentProofUrl === 'string' && paymentProofUrl.length > 2000) {
      return NextResponse.json(
        { success: false, error: 'La URL del comprobante es demasiado larga' },
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
        // Si se revierte a pending, limpiar fecha de pago y comprobante: el
        // comprobante de un pago que se está deshaciendo no debe sobrevivirle.
        updateData.commissionPaidAt = null;
        updateData.paymentProofUrl = null;
      }
    }

    if (paymentProofUrl !== undefined) {
      // DATOS (#PAGO): la UI envía SIEMPRE paymentProofUrl (null si el campo va
      // vacío), así que un segundo "Marcar Pagada" sin URL borraba el
      // comprobante que ya había guardado otro admin. Un null no pisa lo que
      // existe; para quitarlo hay que revertir a 'pending'.
      if (paymentProofUrl !== null || !commission.paymentProofUrl) {
        updateData.paymentProofUrl = paymentProofUrl;
      }
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json(
        { success: false, error: 'No hay datos para actualizar' },
        { status: 400 }
      );
    }

    // TRANSICIÓN (#PAGO): marcar como pagada es un reclamo ATÓMICO sobre una
    // comisión que siga pendiente.
    //
    // Antes el handler no comparaba el estado actual con el pedido: dos admins
    // con la lista vieja abierta podían marcar la misma comisión, el segundo PUT
    // respondía 200, reescribía `commissionPaidAt` con su hora y (al enviar la
    // UI paymentProofUrl:null) borraba el comprobante del primero. Se perdía la
    // prueba del pago y era muy probable una segunda transferencia real.
    if (status === 'paid') {
      const reclamada = await prisma.discountCodeUse.updateMany({
        where: { id: commissionId, commissionStatus: 'pending' },
        data: updateData
      });

      if (reclamada.count === 0) {
        return NextResponse.json(
          {
            success: false,
            error: 'La comisión ya fue pagada por otro administrador.',
            commissionStatus: commission.commissionStatus,
            paidAt: commission.commissionPaidAt,
            proofUrl: commission.paymentProofUrl
          },
          { status: 409 }
        );
      }

      console.info('[Commissions] Comisión marcada como pagada:', {
        commissionId,
        adminId: roleCheck.user.id
      });
    }

    // El resto de transiciones (revertir a 'pending', actualizar comprobante) no
    // necesitan reclamo: no mueven dinero.
    const incluirRelaciones = {
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
    };

    const updatedCommission =
      status === 'paid'
        ? await prisma.discountCodeUse.findUniqueOrThrow({
            where: { id: commissionId },
            include: incluirRelaciones
          })
        : await prisma.discountCodeUse.update({
            where: { id: commissionId },
            data: updateData,
            include: incluirRelaciones
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
          statusLabel: etiquetaEstadoComision(updatedCommission.commissionStatus),
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
    // Defense-in-depth: verificar rol además del middleware
    const roleCheck = await requireRole('admin');
    if ('error' in roleCheck) {
      return NextResponse.json(
        { success: false, error: roleCheck.error },
        { status: roleCheck.status }
      );
    }

    const { id } = await params;
    const commissionId = parseId(id);

    if (commissionId === null) {
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
          statusLabel: etiquetaEstadoComision(commission.commissionStatus),
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
