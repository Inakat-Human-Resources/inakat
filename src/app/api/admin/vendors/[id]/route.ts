// RUTA: src/app/api/admin/vendors/[id]/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/auth';

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * AUTHZ (#PAGO): antes NO existía ninguna ruta de admin que tocara DiscountCode.
 *
 * El panel mostraba "Activo/Inactivo" como texto de sólo lectura y el único
 * `discountCode.update` del repo estaba en /api/vendor/my-code, que usa el
 * propio vendedor. Consecuencias: un porcentaje mal tecleado al dar de alta era
 * irreversible desde el panel, desactivar al usuario en /admin/users no
 * invalidaba su código, y si se desactivaba un código fraudulento a mano en la
 * base de datos el vendedor lo reactivaba con un PUT a su propia ruta.
 *
 * `deactivatedByAdmin` no existe como columna, así que la regla equivalente se
 * aplica en /api/vendor/my-code: el vendedor puede desactivar su código, nunca
 * reactivarlo.
 */
const esquemaEdicion = z
  .object({
    isActive: z.boolean().optional(),
    discountPercent: z
      .number({ message: 'El porcentaje de descuento debe ser un número' })
      .min(0, 'El porcentaje no puede ser negativo')
      .max(99, 'El porcentaje debe ser menor que 100')
      .optional(),
    commissionPercent: z
      .number({ message: 'El porcentaje de comisión debe ser un número' })
      .min(0, 'El porcentaje no puede ser negativo')
      .max(99, 'El porcentaje debe ser menor que 100')
      .optional()
  })
  .refine(
    (datos) => Object.values(datos).some((valor) => valor !== undefined),
    { message: 'No hay datos para actualizar' }
  );

// PATCH - Editar el código de un vendedor (estado y porcentajes)
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const roleCheck = await requireRole('admin');
    if ('error' in roleCheck) {
      return NextResponse.json(
        { success: false, error: roleCheck.error },
        { status: roleCheck.status }
      );
    }

    const { id } = await params;
    const codeId = Number.parseInt(id, 10);

    if (!Number.isInteger(codeId) || codeId <= 0) {
      return NextResponse.json(
        { success: false, error: 'ID de código inválido' },
        { status: 400 }
      );
    }

    const parsed = esquemaEdicion.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          error: parsed.error.issues[0]?.message || 'Datos inválidos'
        },
        { status: 400 }
      );
    }

    const existente = await prisma.discountCode.findUnique({
      where: { id: codeId },
      select: { id: true }
    });

    if (!existente) {
      return NextResponse.json(
        { success: false, error: 'Código de vendedor no encontrado' },
        { status: 404 }
      );
    }

    const actualizado = await prisma.discountCode.update({
      where: { id: codeId },
      data: parsed.data,
      select: {
        id: true,
        code: true,
        discountPercent: true,
        commissionPercent: true,
        isActive: true,
        updatedAt: true,
        user: {
          select: { id: true, nombre: true, apellidoPaterno: true, email: true }
        }
      }
    });

    console.info('[Vendors] Código actualizado por admin:', {
      codeId,
      adminId: roleCheck.user.id,
      cambios: parsed.data
    });

    return NextResponse.json({
      success: true,
      data: actualizado,
      message: 'Código de vendedor actualizado'
    });
  } catch (error) {
    console.error('Error updating vendor code:', error);
    return NextResponse.json(
      { success: false, error: 'Error al actualizar el código del vendedor' },
      { status: 500 }
    );
  }
}
