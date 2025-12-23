// RUTA: src/app/api/discount-codes/validate/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// POST - Validar un código de descuento (público para mostrar en checkout)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { code, packagePrice } = body;

    if (!code) {
      return NextResponse.json(
        { success: false, error: 'Código requerido' },
        { status: 400 }
      );
    }

    const normalizedCode = code.trim().toUpperCase();

    // Buscar código
    const discountCode = await prisma.discountCode.findFirst({
      where: {
        code: normalizedCode,
        isActive: true
      },
      select: {
        id: true,
        code: true,
        discountPercent: true,
        user: {
          select: {
            nombre: true
          }
        }
      }
    });

    if (!discountCode) {
      return NextResponse.json({
        success: false,
        valid: false,
        error: 'Código inválido o inactivo'
      });
    }

    // Calcular descuento si se proporciona precio
    let discountInfo = null;
    if (packagePrice && typeof packagePrice === 'number') {
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
        vendorName: discountCode.user.nombre,
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
