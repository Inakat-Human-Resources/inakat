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

// Paquetes disponibles
const PACKAGES = {
  single: { credits: 1, price: 4000, pricePerCredit: 4000 },
  pack_10: { credits: 10, price: 35000, pricePerCredit: 3500 },
  pack_15: { credits: 15, price: 50000, pricePerCredit: 3333 },
  pack_20: { credits: 20, price: 65000, pricePerCredit: 3250 }
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

    // Validar paquete
    const pkg = PACKAGES[packageType as keyof typeof PACKAGES];
    if (!pkg) {
      return NextResponse.json({ error: 'Paquete inválido' }, { status: 400 });
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

    // Registrar compra en DB
    const purchase = await prisma.creditPurchase.create({
      data: {
        userId: payload.userId,
        amount: pkg.credits,
        pricePerCredit: finalPrice / pkg.credits, // Precio por crédito después de descuento
        totalPrice: finalPrice,
        packageType,
        paymentStatus: paymentResult.status === 'approved' ? 'paid' : 'pending',
        paymentId: String(paymentResult.id),
        paymentMethod: paymentData.payment_method_id,
        paidAt: paymentResult.status === 'approved' ? new Date() : null
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

    // Si el pago fue aprobado inmediatamente, agregar créditos
    if (paymentResult.status === 'approved') {
      const balanceBefore = user.credits;

      const updatedUser = await prisma.user.update({
        where: { id: payload.userId },
        data: {
          credits: {
            increment: pkg.credits
          }
        }
      });

      // Registrar transacción
      await prisma.creditTransaction.create({
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

      console.log('[Payments] Credits added:', { credits: pkg.credits, userId: payload.userId });

      return NextResponse.json({
        success: true,
        status: 'approved',
        purchase,
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
