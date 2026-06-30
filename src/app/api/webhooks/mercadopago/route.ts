// RUTA: src/app/api/webhooks/mercadopago/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { MercadoPagoConfig, Payment } from 'mercadopago';
import { sendPaymentConfirmation } from '@/lib/email';
import { createNotification } from '@/lib/notifications';
import crypto from 'crypto';

const client = new MercadoPagoConfig({
  accessToken: process.env.MERCADOPAGO_ACCESS_TOKEN!
});
const payment = new Payment(client);

// ============================================================================
// SECURITY: Validación de firma de MercadoPago
// ============================================================================
// MercadoPago envía headers x-signature y x-request-id para validar autenticidad
// Docs: https://www.mercadopago.com.mx/developers/es/docs/your-integrations/notifications/webhooks
// ============================================================================

function validateMercadoPagoSignature(
  xSignature: string | null,
  xRequestId: string | null,
  dataId: string,
  secret: string
): { isValid: boolean; reason?: string } {
  if (!xSignature) {
    return { isValid: false, reason: 'Missing x-signature header' };
  }

  if (!xRequestId) {
    return { isValid: false, reason: 'Missing x-request-id header' };
  }

  // Parsear x-signature (formato: "ts=xxx,v1=xxx")
  const parts = xSignature.split(',');
  const tsMatch = parts.find(p => p.startsWith('ts='));
  const v1Match = parts.find(p => p.startsWith('v1='));

  if (!tsMatch || !v1Match) {
    return { isValid: false, reason: 'Invalid x-signature format' };
  }

  const ts = tsMatch.replace('ts=', '');
  const v1 = v1Match.replace('v1=', '');

  // Construir el manifest para validar
  // Formato: id:{data.id};request-id:{x-request-id};ts:{ts};
  const manifest = `id:${dataId};request-id:${xRequestId};ts:${ts};`;

  // Generar HMAC con el secret
  const hmac = crypto
    .createHmac('sha256', secret)
    .update(manifest)
    .digest('hex');

  // SECURITY: comparación en tiempo constante para evitar timing attacks.
  // Comparar longitud primero (timingSafeEqual lanza si difieren los buffers).
  const hmacBuffer = Buffer.from(hmac, 'utf8');
  const v1Buffer = Buffer.from(v1, 'utf8');

  if (
    hmacBuffer.length !== v1Buffer.length ||
    !crypto.timingSafeEqual(hmacBuffer, v1Buffer)
  ) {
    return {
      isValid: false,
      reason: 'Signature mismatch',
    };
  }

  // Opcional: verificar que el timestamp no sea muy antiguo (prevenir replay attacks)
  const timestampMs = parseInt(ts);
  const fiveMinutesAgo = Date.now() - (5 * 60 * 1000);

  if (timestampMs < fiveMinutesAgo) {
    return { isValid: false, reason: 'Timestamp too old (possible replay attack)' };
  }

  return { isValid: true };
}

export async function POST(req: NextRequest) {
  const requestId = req.headers.get('x-request-id') || 'unknown';

  try {
    // Obtener headers de firma ANTES de parsear el body
    const xSignature = req.headers.get('x-signature');
    const xRequestId = req.headers.get('x-request-id');

    const body = await req.json();
    const { data, type } = body;

    // ========================================================================
    // SECURITY: Validar firma del webhook
    // ========================================================================
    const webhookSecret = process.env.MERCADOPAGO_WEBHOOK_SECRET;

    if (webhookSecret) {
      const validation = validateMercadoPagoSignature(
        xSignature,
        xRequestId,
        data?.id?.toString() || '',
        webhookSecret
      );

      if (!validation.isValid) {
        console.error('[Webhook] Signature validation failed:', {
          reason: validation.reason,
          type,
          dataId: data?.id,
          requestId,
          ip: req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'unknown'
        });

        return NextResponse.json(
          { error: 'Invalid signature', reason: validation.reason },
          { status: 401 }
        );
      }

    } else {
      // En desarrollo sin secret configurado, solo warning
      if (process.env.NODE_ENV === 'production') {
        console.error('[Webhook] CRITICAL: MERCADOPAGO_WEBHOOK_SECRET not configured in production!');
        return NextResponse.json(
          { error: 'Webhook not configured' },
          { status: 500 }
        );
      }
      console.warn('[Webhook] WARNING: MERCADOPAGO_WEBHOOK_SECRET not configured - signature validation skipped');
    }

    console.info('[Webhook] Received:', { type, dataId: data?.id, requestId });

    // MercadoPago envía diferentes tipos de notificaciones
    if (type !== 'payment') {
      return NextResponse.json({ received: true });
    }

    // Obtener información del pago desde MercadoPago
    const paymentId = data.id;
    const paymentInfo = await payment.get({ id: paymentId });

    console.info('[Webhook] Payment info:', {
      id: paymentInfo.id,
      status: paymentInfo.status,
      statusDetail: paymentInfo.status_detail
    });

    // Buscar la compra en nuestra DB
    const purchase = await prisma.creditPurchase.findUnique({
      where: { paymentId: String(paymentId) }
    });

    if (!purchase) {
      console.error('[Webhook] Purchase not found:', { paymentId, requestId });
      return NextResponse.json(
        { error: 'Purchase not found' },
        { status: 404 }
      );
    }

    // Si ya fue procesado, no hacer nada (idempotencia)
    if (purchase.paymentStatus === 'paid') {
      console.warn('[Webhook] Payment already processed:', { purchaseId: purchase.id });
      return NextResponse.json({ received: true, alreadyProcessed: true });
    }

    // Actualizar según el estado del pago
    if (paymentInfo.status === 'approved') {
      console.info('[Webhook] Payment approved, adding credits:', {
        purchaseId: purchase.id,
        userId: purchase.userId,
        amount: purchase.amount
      });

      // CONSISTENCIA + IDEMPOTENCIA (#35/#7): el chequeo previo de paymentStatus
      // y la acreditación NO eran atómicos; dos entregas concurrentes del webhook
      // podían acreditar dos veces. Aquí se "reclama" el pago de forma atómica con
      // un updateMany condicionado a que siga sin pagarse: sólo una entrega gana la
      // carrera (la otra ve count=0 y no acredita).
      let credited = false;
      let newBalance = 0;

      await prisma.$transaction(async (tx) => {
        const claimed = await tx.creditPurchase.updateMany({
          where: { id: purchase.id, paymentStatus: { not: 'paid' } },
          data: { paymentStatus: 'paid', paidAt: new Date() }
        });

        // Otra entrega concurrente ya acreditó este pago.
        if (claimed.count === 0) return;

        // Agregar créditos al usuario (incremento atómico)
        const updatedUser = await tx.user.update({
          where: { id: purchase.userId },
          data: { credits: { increment: purchase.amount } }
        });

        // Registrar transacción de créditos (balanceBefore exacto desde el saldo nuevo)
        await tx.creditTransaction.create({
          data: {
            userId: purchase.userId,
            type: 'purchase',
            amount: purchase.amount,
            balanceBefore: updatedUser.credits - purchase.amount,
            balanceAfter: updatedUser.credits,
            purchaseId: purchase.id,
            description: `Compra confirmada - ${purchase.amount} créditos (Pago #${paymentId})`
          }
        });

        credited = true;
        newBalance = updatedUser.credits;
      });

      if (!credited) {
        // Idempotencia: otra entrega ya procesó este pago.
        console.warn('[Webhook] Payment already credited by a concurrent delivery:', { purchaseId: purchase.id });
        return NextResponse.json({ received: true, alreadyProcessed: true });
      }

      console.info('[Webhook] Credits added successfully:', {
        userId: purchase.userId,
        credits: purchase.amount,
        newBalance
      });

      // Notificación in-app + email de confirmación. Se AWAITean (antes eran
      // fire-and-forget, que en serverless puede no completarse tras responder)
      // (#70). allSettled: un fallo no afecta al otro ni a la respuesta del webhook.
      const companyRequest = await prisma.companyRequest.findFirst({
        where: { userId: purchase.userId },
        select: { nombreEmpresa: true, correoEmpresa: true }
      });

      await Promise.allSettled([
        createNotification({
          userId: purchase.userId,
          type: 'credits_purchased',
          title: 'Créditos acreditados',
          message: `Se acreditaron ${purchase.amount} créditos a tu cuenta. Nuevo saldo: ${newBalance}.`,
          link: '/company/dashboard',
          metadata: { credits: purchase.amount, newBalance },
        }),
        companyRequest
          ? sendPaymentConfirmation({
              companyEmail: companyRequest.correoEmpresa,
              nombreEmpresa: companyRequest.nombreEmpresa,
              credits: purchase.amount,
              totalPrice: purchase.totalPrice,
              newBalance,
            })
          : Promise.resolve(false),
      ]);

    } else if (paymentInfo.status === 'rejected' || paymentInfo.status === 'cancelled') {
      console.warn('[Webhook] Payment rejected/cancelled:', {
        paymentId,
        status: paymentInfo.status,
        statusDetail: paymentInfo.status_detail
      });

      await prisma.creditPurchase.update({
        where: { id: purchase.id },
        data: {
          paymentStatus: 'failed'
        }
      });
    }

    return NextResponse.json({ received: true });

  } catch (error) {
    console.error('[Webhook] Error:', {
      error: error instanceof Error ? error.message : 'Unknown error',
      requestId
    });
    return NextResponse.json(
      { error: 'Webhook processing failed' },
      { status: 500 }
    );
  }
}

// MercadoPago requiere responder rápido a los webhooks
export const maxDuration = 10;
