import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { MercadoPagoConfig, Payment } from 'mercadopago';

const client = new MercadoPagoConfig({
  accessToken: process.env.MERCADOPAGO_ACCESS_TOKEN!
});
const payment = new Payment(client);

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    console.log('📩 Webhook received:', body);

    // Mercado Pago envía diferentes tipos de notificaciones
    if (body.type !== 'payment') {
      return NextResponse.json({ received: true });
    }

    // Obtener información del pago
    const paymentId = body.data.id;
    const paymentInfo = await payment.get({ id: paymentId });

    console.log('💳 Payment info:', paymentInfo);

    // Buscar la compra en nuestra DB
    const purchase = await prisma.creditPurchase.findUnique({
      where: { paymentId: String(paymentId) },
      include: { user: true }
    });

    if (!purchase) {
      console.error('❌ Purchase not found for payment:', paymentId);
      return NextResponse.json(
        { error: 'Purchase not found' },
        { status: 404 }
      );
    }

    // Si ya fue procesado, no hacer nada
    if (purchase.paymentStatus === 'paid') {
      console.log('✅ Payment already processed');
      return NextResponse.json({ received: true });
    }

    // Actualizar según el estado del pago
    if (paymentInfo.status === 'approved') {
      console.log('✅ Payment approved, adding credits...');

      const balanceBefore = purchase.user.credits;

      // Actualizar compra
      await prisma.creditPurchase.update({
        where: { id: purchase.id },
        data: {
          paymentStatus: 'paid',
          paidAt: new Date()
        }
      });

      // Agregar créditos al usuario
      const updatedUser = await prisma.user.update({
        where: { id: purchase.userId },
        data: {
          credits: {
            increment: purchase.amount
          }
        }
      });

      // Registrar transacción
      await prisma.creditTransaction.create({
        data: {
          userId: purchase.userId,
          type: 'purchase',
          amount: purchase.amount,
          balanceBefore,
          balanceAfter: updatedUser.credits,
          purchaseId: purchase.id,
          description: `Compra confirmada - ${purchase.amount} créditos (Webhook)`
        }
      });

      console.log(
        `✅ Added ${purchase.amount} credits to user ${purchase.userId}`
      );

      // TODO: Enviar email de confirmación
    } else if (
      paymentInfo.status === 'rejected' ||
      paymentInfo.status === 'cancelled'
    ) {
      console.log('❌ Payment rejected/cancelled');

      await prisma.creditPurchase.update({
        where: { id: purchase.id },
        data: {
          paymentStatus: 'failed'
        }
      });
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error('❌ Webhook error:', error);
    return NextResponse.json(
      { error: 'Webhook processing failed' },
      { status: 500 }
    );
  }
}

// Mercado Pago requiere responder rápido a los webhooks
export const maxDuration = 10;
