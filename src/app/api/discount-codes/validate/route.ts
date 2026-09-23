// RUTA: src/app/api/discount-codes/validate/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { getOptionalAuthUser } from '@/lib/auth';
import { applyRateLimit, DISCOUNT_VALIDATE_RATE_LIMIT } from '@/lib/rate-limit';

/**
 * VALIDACIÓN (#PAGO): `code` se usaba sin comprobar el tipo, así que un
 * {"code":123} reventaba en `.trim()` y devolvía 500 "Error al validar código"
 * en vez de un 400.
 */
const esquemaValidacion = z.object({
  code: z.string().trim().min(1, 'Código requerido').max(20),
  packagePrice: z.number().positive().optional()
});

// POST - Validar un código de descuento (público para mostrar en checkout)
export async function POST(request: NextRequest) {
  try {
    // SECURITY (#37): rate limit para evitar enumeración de códigos.
    const rateLimited = applyRateLimit(request, 'discount-validate', DISCOUNT_VALIDATE_RATE_LIMIT);
    if (rateLimited) return rateLimited;

    const parsed = esquemaValidacion.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          valid: false,
          error: parsed.error.issues[0]?.message || 'Código requerido'
        },
        { status: 400 }
      );
    }

    const { code, packagePrice } = parsed.data;
    const normalizedCode = code.toUpperCase();

    // Buscar código
    const discountCode = await prisma.discountCode.findFirst({
      where: {
        code: normalizedCode,
        isActive: true,
        // Desactivar al vendedor en /admin/users no invalidaba su código (#PAGO).
        // AUTH-004 / PAGO-005: sólo códigos de vendedores (o admin), igual que
        // en la compra; si no, se mostraría válido uno que luego se rechaza.
        user: { isActive: true, role: { in: ['vendor', 'admin'] } }
      },
      select: {
        id: true,
        code: true,
        discountPercent: true,
        // Sólo para comparar con el usuario de la sesión; no se devuelve.
        userId: true
      }
    });

    if (!discountCode) {
      return NextResponse.json({
        success: false,
        valid: false,
        error: 'Código inválido o inactivo'
      });
    }

    // UX (#PAGO): la regla de auto-referido sólo se aplicaba al pagar, así que
    // el usuario veía "10% de descuento aplicado", rellenaba la tarjeta y el
    // rechazo llegaba con el token ya consumido. Aquí no hay auth obligatoria,
    // pero si hay sesión se comprueba igual.
    const sesion = await getOptionalAuthUser();
    if (sesion && sesion.id === discountCode.userId) {
      return NextResponse.json({
        success: false,
        valid: false,
        error: 'No puedes usar tu propio código de descuento'
      });
    }

    // Calcular descuento si se proporciona precio
    let discountInfo = null;
    if (packagePrice !== undefined) {
      const discountAmount = Math.round(packagePrice * (discountCode.discountPercent / 100));
      const finalPrice = packagePrice - discountAmount;

      discountInfo = {
        originalPrice: packagePrice,
        discountAmount,
        finalPrice,
        savings: discountAmount
      };
    }

    return NextResponse.json({
      success: true,
      valid: true,
      data: {
        code: discountCode.code,
        discountPercent: discountCode.discountPercent,
        ...discountInfo && { pricing: discountInfo }
      }
    });
  } catch (error) {
    console.error('Error validating discount code:', error);
    return NextResponse.json(
      { success: false, error: 'Error al validar código' },
      { status: 500 }
    );
  }
}
