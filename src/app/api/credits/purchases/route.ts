// RUTA: src/app/api/credits/purchases/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import jwt from 'jsonwebtoken';
import { MercadoPagoConfig, Payment } from 'mercadopago';

// Helper para calcular fecha de vencimiento de comisión (4 meses)
function getCommissionDueDate(): Date {
  const date = new Date();
  date.setMonth(date.getMonth() + 4);
  return date;
}

// Configurar Mercado Pago
const client = new MercadoPagoConfig({
  accessToken: process.env.MERCADOPAGO_ACCESS_TOKEN!
});
const payment = new Payment(client);

// Mapeo de packageType a cantidad de créditos
// Los precios se obtienen de la DB (CreditPackage)
const PACKAGE_CREDITS: Record<string, number> = {
  pack_1: 1,
  pack_10: 10,
  pack_15: 15,
  pack_20: 20
};

export async function POST(req: NextRequest) {
  try {
    // Verificar autenticación
    const token = req.cookies.get('auth-token')?.value;
    if (!token) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const payload = jwt.verify(token, process.env.JWT_SECRET!) as any;
    if (payload.role !== 'company') {
      return NextResponse.json({ error: 'Solo empresas' }, { status: 403 });
    }

    const { packageType, paymentData, discountCode } = await req.json();

    // MEJ-001: Validar packageType y obtener precio de la DB
    const credits = PACKAGE_CREDITS[packageType as keyof typeof PACKAGE_CREDITS];
    if (!credits) {
      return NextResponse.json({ error: 'Tipo de paquete inválido' }, { status: 400 });
    }

    // Buscar el paquete en la DB para obtener el precio real
    const pkg = await prisma.creditPackage.findFirst({
      where: {
        credits: credits,
        isActive: true
      }
    });

    if (!pkg) {
      return NextResponse.json(
        { error: 'Paquete no disponible. Contacta al administrador.' },
        { status: 400 }
      );
    }

    // Validar código de descuento si se proporciona
    let validDiscountCode: {
      id: number;
      code: string;
      userId: number;
      discountPercent: number;
      commissionPercent: number;
    } | null = null;

    if (discountCode) {
      const foundCode = await prisma.discountCode.findFirst({
        where: {
          code: discountCode.toUpperCase(),
          isActive: true
        },
        select: {
          id: true,
          code: true,
          userId: true,
          discountPercent: true,
          commissionPercent: true
        }
      });

      if (!foundCode) {
        return NextResponse.json(
          { error: 'Código de descuento inválido o inactivo' },
          { status: 400 }
        );
      }

      validDiscountCode = foundCode;
    }

    // Calcular precios con descuento
    const originalPrice = pkg.price;
    let discountAmount = 0;
    let finalPrice = originalPrice;

    if (validDiscountCode) {
      discountAmount = Math.round(originalPrice * (validDiscountCode.discountPercent / 100));
      finalPrice = originalPrice - discountAmount;
    }

    // Obtener info del usuario
    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
      include: { companyRequest: true }
    });

    if (!user) {
      return NextResponse.json(
        { error: 'Usuario no encontrado' },
        { status: 404 }
      );
    }

    // Crear objeto de pago base (usando precio final con descuento)
    const paymentBody: any = {
      transaction_amount: finalPrice,
      description: `Paquete de ${pkg.credits} crédito${
        pkg.credits > 1 ? 's' : ''
      } - INAKAT${validDiscountCode ? ` (${validDiscountCode.discountPercent}% desc.)` : ''}`,
      payment_method_id: paymentData.payment_method_id,
      token: paymentData.token,
      installments: paymentData.installments || 1,
      payer: {
        email: user.email,
        identification: {
          type: 'RFC',
          number: user.companyRequest?.rfc || 'XAXX010101000'
        }
      },
      metadata: {
        user_id: payload.userId,
        package_type: packageType,
        credits: pkg.credits,
        discount_code: validDiscountCode?.code || null,
        original_price: originalPrice,
        discount_amount: discountAmount
      }
    };

    // Solo agregar notification_url si estamos en producción
    // En desarrollo local, localhost no funciona para webhooks
    const appUrl = process.env.NEXT_PUBLIC_APP_URL;
    if (appUrl && !appUrl.includes('localhost')) {
      paymentBody.notification_url = `${appUrl}/api/webhooks/mercadopago`;
    }

    // Crear pago en Mercado Pago
    const paymentResult = await payment.create({
      body: paymentBody
    });

    console.log('[Payments] Payment created:', { id: paymentResult.id, status: paymentResult.status });

    // Registrar compra en DB (siempre como pending, se actualiza en la transacción si es approved)
    const purchase = await prisma.creditPurchase.create({
      data: {
        userId: payload.userId,
        amount: pkg.credits,
        pricePerCredit: finalPrice / pkg.credits, // Precio por crédito después de descuento
        totalPrice: finalPrice,
        packageType,
        paymentStatus: 'pending', // Se actualiza a 'paid' en la transacción si es approved
        paymentId: String(paymentResult.id),
        paymentMethod: paymentData.payment_method_id,
        paidAt: null // Se establece en la transacción si es approved
      }
    });

    // Si se usó código de descuento, registrar el uso
    if (validDiscountCode) {
      const commissionAmount = Math.round(finalPrice * (validDiscountCode.commissionPercent / 100));

      await prisma.discountCodeUse.create({
        data: {
          codeId: validDiscountCode.id,
          purchaseId: purchase.id,
          companyUserId: payload.userId,
          originalPrice,
          discountAmount,
          finalPrice,
          commissionAmount,
          commissionStatus: 'pending',
          paymentDueDate: getCommissionDueDate()
        }
      });

      console.log('[Payments] Discount code applied:', { code: validDiscountCode.code, discountAmount, commissionAmount });
    }

    // MEJ-003: Si el pago fue aprobado inmediatamente, agregar créditos usando transacción
    if (paymentResult.status === 'approved') {
      const balanceBefore = user.credits;

      // Usar transacción para garantizar consistencia (igual que el webhook)
      const { updatedUser, updatedPurchase } = await prisma.$transaction(async (tx) => {
        // Actualizar purchase status
        const updatedPurchase = await tx.creditPurchase.update({
          where: { id: purchase.id },
          data: {
            paymentStatus: 'paid',
            paidAt: new Date()
          }
        });

        // Agregar créditos al usuario
        const updatedUser = await tx.user.update({
          where: { id: payload.userId },
          data: {
            credits: {
              increment: pkg.credits
            }
          }
        });

        // Registrar transacción de créditos
        await tx.creditTransaction.create({
          data: {
            userId: payload.userId,
            type: 'purchase',
            amount: pkg.credits,
            balanceBefore,
            balanceAfter: updatedUser.credits,
            purchaseId: purchase.id,
            description: `Compra de ${pkg.credits} créditos - Pago ID: ${paymentResult.id}`
          }
        });

        return { updatedUser, updatedPurchase };
      });

      console.log('[Payments] Credits added:', { credits: pkg.credits, userId: payload.userId });

      return NextResponse.json({
        success: true,
        status: 'approved',
        purchase: updatedPurchase,
        creditsAdded: pkg.credits,
        newBalance: updatedUser.credits,
        paymentId: paymentResult.id,
        discount: validDiscountCode ? {
          code: validDiscountCode.code,
          originalPrice,
          discountAmount,
          finalPrice,
          discountPercent: validDiscountCode.discountPercent
        } : null
      });
    }

    // Pago pendiente (ej: OXXO, transferencia)
    return NextResponse.json({
      success: true,
      status: paymentResult.status,
      purchase,
      message: 'Pago pendiente de confirmación',
      paymentId: paymentResult.id,
      paymentDetails: {
        method: paymentData.payment_method_id,
        ticket_url:
          paymentResult.point_of_interaction?.transaction_data?.ticket_url
      },
      discount: validDiscountCode ? {
        code: validDiscountCode.code,
        originalPrice,
        discountAmount,
        finalPrice,
        discountPercent: validDiscountCode.discountPercent
      } : null
    });
  } catch (error: any) {
    console.error('[Payments] Error processing purchase:', error instanceof Error ? error.message : 'Unknown error');

    // Errores específicos de Mercado Pago
    if (error.cause) {
      return NextResponse.json(
        {
          error: 'Error en el pago',
          details: error.cause
        },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: error.message || 'Error al procesar pago' },
      { status: 500 }
    );
  }
}
