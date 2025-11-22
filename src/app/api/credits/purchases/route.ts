// RUTA: src/app/api/credits/purchases/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import jwt from 'jsonwebtoken';
import { MercadoPagoConfig, Payment } from 'mercadopago';

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

    const { packageType, paymentData } = await req.json();

    // Validar paquete
    const pkg = PACKAGES[packageType as keyof typeof PACKAGES];
    if (!pkg) {
      return NextResponse.json({ error: 'Paquete inválido' }, { status: 400 });
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

    // Crear objeto de pago base
    const paymentBody: any = {
      transaction_amount: pkg.price,
      description: `Paquete de ${pkg.credits} crédito${
        pkg.credits > 1 ? 's' : ''
      } - INAKAT`,
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
        credits: pkg.credits
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

    console.log('✅ Payment created:', paymentResult.id, paymentResult.status);

    // Registrar compra en DB
    const purchase = await prisma.creditPurchase.create({
      data: {
        userId: payload.userId,
        amount: pkg.credits,
        pricePerCredit: pkg.pricePerCredit,
        totalPrice: pkg.price,
        packageType,
        paymentStatus: paymentResult.status === 'approved' ? 'paid' : 'pending',
        paymentId: String(paymentResult.id),
        paymentMethod: paymentData.payment_method_id,
        paidAt: paymentResult.status === 'approved' ? new Date() : null
      }
    });

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

      console.log(
        `✅ Credits added: ${pkg.credits} credits to user ${payload.userId}`
      );

      return NextResponse.json({
        success: true,
        status: 'approved',
        purchase,
        creditsAdded: pkg.credits,
        newBalance: updatedUser.credits,
        paymentId: paymentResult.id
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
      }
    });
  } catch (error: any) {
    console.error('❌ Error processing purchase:', error);

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
