// RUTA: src/app/api/webhooks/mercadopago/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { MercadoPagoConfig, Payment } from 'mercadopago';
import { sendPaymentConfirmation } from '@/lib/email';
import { createNotification, notifyAllAdmins } from '@/lib/notifications';
import { validateMercadoPagoSignature } from '@/lib/mercadopago-signature';
import { registrarComisionDeVenta } from '@/lib/comisiones';

const client = new MercadoPagoConfig({
  accessToken: process.env.MERCADOPAGO_ACCESS_TOKEN ?? ''
});
const payment = new Payment(client);

// La validación de firma vive en src/lib/mercadopago-signature.ts para poder
// probarla unitariamente: es la ÚNICA barrera que impide que un POST falso
// acredite créditos, y no tenía ni un test.

/**
 * Revierte una compra ya acreditada tras una devolución o un contracargo.
 *
 * Reclama de forma atómica (`updateMany` condicionado a que siga 'paid') para
 * que dos notificaciones concurrentes no resten los créditos dos veces. El saldo
 * puede quedar negativo a propósito: bajarlo a 0 regalaría los créditos ya
 * gastados y escondería la deuda.
 *
 * @returns true si esta llamada fue la que aplicó la reversión.
 */
async function revertirCompraPagada(
  purchaseId: number,
  userId: number,
  creditos: number,
  estadoMercadoPago: string,
  paymentId: string
): Promise<boolean> {
  let aplicado = false;

  await prisma.$transaction(async (tx) => {
    const reclamada = await tx.creditPurchase.updateMany({
      where: { id: purchaseId, paymentStatus: 'paid' },
      data: { paymentStatus: 'refunded' }
    });

    if (reclamada.count === 0) return;

    const updatedUser = await tx.user.update({
      where: { id: userId },
      data: { credits: { decrement: creditos } }
    });

    await tx.creditTransaction.create({
      data: {
        userId,
        type: 'refund',
        amount: -creditos,
        balanceBefore: updatedUser.credits + creditos,
        balanceAfter: updatedUser.credits,
        purchaseId,
        description: `Devolución (${estadoMercadoPago}) - ${creditos} créditos retirados (Pago #${paymentId})`
      }
    });

    // La comisión del vendedor deja de ser cobrable.
    await tx.discountCodeUse.updateMany({
      where: { purchaseId, commissionStatus: 'pending' },
      data: { commissionStatus: 'cancelled' }
    });

    aplicado = true;
  });

  return aplicado;
}

/** Avisa a los administradores de una devolución para que puedan actuar. */
async function avisarAdminsDeDevolucion(
  purchaseId: number,
  userId: number,
  creditos: number,
  estadoMercadoPago: string
): Promise<void> {
  try {
    await notifyAllAdmins({
      type: 'payment_refunded',
      title: 'Compra de créditos devuelta',
      message: `La compra #${purchaseId} (${creditos} créditos) se marcó como "${estadoMercadoPago}". Se retiraron los créditos y se canceló la comisión asociada.`,
      link: '/admin/vendors',
      metadata: { purchaseId, userId, creditos, estadoMercadoPago }
    });
  } catch (error) {
    console.error('[Webhook] No se pudo avisar a los admins de la devolución:', {
      purchaseId,
      error: error instanceof Error ? error.message : 'desconocido'
    });
  }
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

        // SECURITY (#PAGO): el motivo exacto queda en el log del servidor, pero
        // NO se devuelve. Decirle a quien sondea el endpoint si falló el formato,
        // el HMAC o la ventana de tiempo es un oráculo gratuito.
        return NextResponse.json(
          { error: 'Invalid signature' },
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

    // Buscar la compra en nuestra DB.
    //
    // Por paymentId primero y, si no aparece, por `external_reference`: la compra
    // se crea ANTES de cobrar y su id viaja a MercadoPago en ese campo, así que
    // si el `update` que guarda el paymentId no llegó a completarse (timeout,
    // función serverless terminada) la compra sigue siendo conciliable y los
    // créditos se acreditan igual. Antes, en ese caso, el webhook respondía 404
    // en todos los reintentos y el cargo se quedaba sin acreditar.
    let purchase = await prisma.creditPurchase.findUnique({
      where: { paymentId: String(paymentId) }
    });

    if (!purchase && paymentInfo.external_reference) {
      const refId = Number(paymentInfo.external_reference);
      if (Number.isInteger(refId) && refId > 0) {
        purchase = await prisma.creditPurchase.findUnique({ where: { id: refId } });
        if (purchase) {
          console.warn('[Webhook] Compra conciliada por external_reference:', {
            purchaseId: purchase.id,
            paymentId,
            requestId
          });
          // Se guarda el paymentId para que los reintentos siguientes la
          // encuentren por la vía normal.
          await prisma.creditPurchase.update({
            where: { id: purchase.id },
            data: { paymentId: String(paymentId) }
          }).catch((e: unknown) => {
            // No bloquea la acreditación: se sigue con la compra ya encontrada.
            console.error('[Webhook] No se pudo guardar el paymentId conciliado:', {
              purchaseId: purchase?.id,
              paymentId,
              requestId,
              error: e instanceof Error ? e.message : 'desconocido'
            });
          });
        }
      }
    }

    if (!purchase) {
      console.error('[Webhook] Purchase not found:', { paymentId, requestId });
      return NextResponse.json(
        { error: 'Purchase not found' },
        { status: 404 }
      );
    }

    // DINERO (#PAGO): el early-return por "ya está pagada" estaba AQUÍ, antes de
    // mirar `paymentInfo.status`. Eso descartaba en silencio las notificaciones
    // posteriores de un pago ya acreditado — 'refunded', 'charged_back',
    // 'in_mediation' — sin dejar siquiera log del estado: la empresa devolvía el
    // cargo, conservaba los créditos y el vendedor conservaba su comisión. Ahora
    // la idempotencia vive dentro de la rama 'approved' (que además reclama de
    // forma atómica) y los estados de devolución tienen su propia rama.

    // Actualizar según el estado del pago
    if (paymentInfo.status === 'approved') {
      // Idempotencia: si ya está pagada, nada que acreditar.
      if (purchase.paymentStatus === 'paid') {
        console.warn('[Webhook] Payment already processed:', { purchaseId: purchase.id });
        return NextResponse.json({ received: true, alreadyProcessed: true });
      }

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

        // DINERO (#PAGO): la comisión del vendedor se crea AQUÍ, no al pedir el
        // cobro. Los datos del código viajan en la metadata del pago, que es lo
        // que permite registrarla desde el webhook cuando quien acredita es él
        // (OXXO/SPEI/3DS) y no la respuesta síncrona de la compra.
        const metadata = (paymentInfo.metadata || {}) as Record<string, unknown>;
        const codigoUsado = metadata.discount_code;

        if (typeof codigoUsado === 'string' && codigoUsado.trim()) {
          const originalPrice = Number(metadata.original_price);
          const discountAmount = Number(metadata.discount_amount);

          const resultado = await registrarComisionDeVenta(tx, {
            purchaseId: purchase.id,
            companyUserId: purchase.userId,
            codigo: codigoUsado,
            originalPrice: Number.isFinite(originalPrice) ? originalPrice : purchase.totalPrice,
            discountAmount: Number.isFinite(discountAmount) ? discountAmount : 0,
            finalPrice: purchase.totalPrice
          });

          if (!resultado.creada) {
            console.warn('[Webhook] Comisión no registrada:', {
              purchaseId: purchase.id,
              codigo: codigoUsado,
              motivo: resultado.motivo
            });
          }
        }

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

      // Sólo degrada una compra que NO esté pagada: si ya se acreditó, lo que
      // corresponde es la rama de devolución, no marcarla 'failed'.
      await prisma.creditPurchase.updateMany({
        where: { id: purchase.id, paymentStatus: { not: 'paid' } },
        data: { paymentStatus: 'failed' }
      });

      // La comisión, si existiera (filas del flujo antiguo, que la creaba antes
      // de cobrar), deja de ser cobrable. Con la misma guarda que la compra: la
      // comisión de una compra YA acreditada sólo se cancela por la rama de
      // devolución, nunca por un rechazo.
      await prisma.discountCodeUse.updateMany({
        where: {
          purchaseId: purchase.id,
          commissionStatus: 'pending',
          purchase: { paymentStatus: { not: 'paid' } }
        },
        data: { commissionStatus: 'cancelled' }
      });

    } else if (
      paymentInfo.status === 'refunded' ||
      paymentInfo.status === 'charged_back'
    ) {
      // DINERO (#PAGO): devolución o contracargo de una compra ya acreditada.
      // Antes esto no existía: la notificación salía por el early-return de
      // "ya procesado" y la empresa se quedaba con los créditos de un cargo que
      // había recuperado, mientras el vendedor conservaba su comisión pendiente.
      const revertido = await revertirCompraPagada(
        purchase.id,
        purchase.userId,
        purchase.amount,
        paymentInfo.status,
        String(paymentId)
      );

      if (!revertido) {
        console.warn('[Webhook] Devolución sobre una compra que no estaba pagada:', {
          purchaseId: purchase.id,
          status: paymentInfo.status
        });
        return NextResponse.json({ received: true, alreadyProcessed: true });
      }

      console.error('[Webhook] DEVOLUCIÓN aplicada:', {
        purchaseId: purchase.id,
        userId: purchase.userId,
        creditos: purchase.amount,
        status: paymentInfo.status,
        paymentId
      });

      await avisarAdminsDeDevolucion(purchase.id, purchase.userId, purchase.amount, paymentInfo.status);

    } else {
      // Cualquier otro estado (in_mediation, in_process, authorized...) queda
      // registrado aunque no dispare ninguna acción, para poder investigarlo.
      console.warn('[Webhook] Estado sin tratamiento específico:', {
        purchaseId: purchase.id,
        paymentId,
        status: paymentInfo.status,
        statusDetail: paymentInfo.status_detail
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
