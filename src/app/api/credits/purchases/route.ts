// RUTA: src/app/api/credits/purchases/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { verifyToken, requireApprovedCompany } from '@/lib/auth';
import { MercadoPagoConfig, Payment } from 'mercadopago';
import { registrarComisionDeVenta } from '@/lib/comisiones';
import { createNotification } from '@/lib/notifications';
import { sendPaymentConfirmation } from '@/lib/email';
import { requireEnv } from '@/lib/env';

// Configurar Mercado Pago
const client = new MercadoPagoConfig({
  accessToken: process.env.MERCADOPAGO_ACCESS_TOKEN ?? ''
});
const payment = new Payment(client);

/**
 * Forma del body. Antes no se validaba nada: un body sin `paymentData` lanzaba
 * un TypeError al leer `payment_method_id` y un `discountCode` numérico lo
 * lanzaba en `.toUpperCase()`. Los dos caían al catch genérico y respondían 500
 * "Error al procesar el pago", ensuciando además los logs de errores de pago
 * con fallos que son simples 400 (#PAGO).
 */
const esquemaCompra = z.object({
  // `packageId` es la vía correcta: identifica la fila exacta de CreditPackage.
  packageId: z.number().int().positive().optional(),
  // `packageType` se mantiene por compatibilidad con clientes antiguos.
  packageType: z.string().trim().min(1).max(50).optional(),
  discountCode: z.string().trim().min(1).max(20).optional().nullable(),
  /** Precio que el cliente dice haber visto; si no cuadra, no se cobra. */
  expectedAmount: z.number().nonnegative().optional()
});

/**
 * Los datos de la tarjeta se validan aparte y MÁS TARDE, justo antes de armar el
 * cobro: para decirle a alguien que su código de descuento no sirve o que el
 * paquete no existe no hace falta exigirle primero un token de tarjeta válido.
 */
const esquemaPaymentData = z.object({
  token: z.string().trim().min(1),
  payment_method_id: z.string().trim().min(1).max(50),
  installments: z.number().int().min(1).max(12).optional()
});

// Mapeo heredado de packageType a cantidad de créditos, SÓLO para clientes que
// todavía no envían packageId. La fuente de verdad es la tabla CreditPackage.
const PACKAGE_CREDITS: Record<string, number> = {
  pack_1: 1,
  pack_10: 10,
  pack_15: 15,
  pack_20: 20
};

/**
 * Correo de confirmación + notificación in-app de una compra acreditada.
 *
 * Es el mismo par que envía el webhook. Un fallo aquí no puede tumbar la
 * respuesta de una compra que YA se cobró y acreditó, de ahí el allSettled.
 */
async function notificarCompraAcreditada(
  userId: number,
  creditos: number,
  nuevoSaldo: number,
  totalPagado: number
): Promise<void> {
  try {
    const companyRequest = await prisma.companyRequest.findFirst({
      where: { userId },
      select: { nombreEmpresa: true, correoEmpresa: true }
    });

    await Promise.allSettled([
      createNotification({
        userId,
        type: 'credits_purchased',
        title: 'Créditos acreditados',
        message: `Se acreditaron ${creditos} créditos a tu cuenta. Nuevo saldo: ${nuevoSaldo}.`,
        link: '/company/dashboard',
        metadata: { credits: creditos, newBalance: nuevoSaldo }
      }),
      companyRequest
        ? sendPaymentConfirmation({
            companyEmail: companyRequest.correoEmpresa,
            nombreEmpresa: companyRequest.nombreEmpresa,
            credits: creditos,
            totalPrice: totalPagado,
            newBalance: nuevoSaldo
          })
        : Promise.resolve(false)
    ]);
  } catch (error) {
    console.error('[Payments] No se pudo notificar la compra acreditada:', {
      userId,
      error: error instanceof Error ? error.message : 'desconocido'
    });
  }
}

export async function POST(req: NextRequest) {
  try {
    // Verificar autenticación
    const token = req.cookies.get('auth-token')?.value;
    if (!token) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const payload = verifyToken(token);
    if (!payload) {
      return NextResponse.json({ error: 'Token inválido o expirado' }, { status: 401 });
    }
    if (payload.role !== 'company') {
      return NextResponse.json({ error: 'Solo empresas' }, { status: 403 });
    }

    // EMP-002: una empresa pendiente de aprobación (o rechazada) no compra créditos.
    const aprobacion = await requireApprovedCompany(payload.userId, payload.role);
    if (aprobacion) {
      return NextResponse.json(
        { success: false, error: aprobacion.error, code: aprobacion.code },
        { status: aprobacion.status }
      );
    }

    // CONFIG (#PAGO): sin token de MercadoPago el SDK falla con un error opaco
    // dentro del try y el cliente recibe "Error al procesar el pago". Mejor
    // decirlo antes de tocar nada.
    if (!requireEnv('MERCADOPAGO_ACCESS_TOKEN')) {
      console.error('[Payments] MERCADOPAGO_ACCESS_TOKEN no configurado');
      return NextResponse.json(
        { error: 'El cobro no está configurado. Contacta al administrador.' },
        { status: 503 }
      );
    }

    const body = await req.json();

    const parsed = esquemaCompra.safeParse(body ?? {});
    if (!parsed.success) {
      return NextResponse.json(
        {
          error: 'Datos de compra inválidos',
          detalle: parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`)
        },
        { status: 400 }
      );
    }

    const { packageId, packageType, discountCode, expectedAmount } = parsed.data;

    // DINERO (#PAGO): el paquete se resuelve por ID, no por una tabla de
    // créditos escrita a mano. `PACKAGE_CREDITS` sólo conocía pack_1/10/15/20,
    // así que cualquier paquete que el admin creara era imposible de comprar; y
    // el `findFirst({ credits, isActive })` sin orderBy podía cobrar el precio
    // del paquete equivocado cuando había dos activos con la misma cantidad.
    let pkg;
    if (packageId !== undefined) {
      pkg = await prisma.creditPackage.findFirst({
        where: { id: packageId, isActive: true }
      });
    } else {
      const credits = packageType ? PACKAGE_CREDITS[packageType] : undefined;
      if (!credits) {
        return NextResponse.json({ error: 'Tipo de paquete inválido' }, { status: 400 });
      }
      pkg = await prisma.creditPackage.findFirst({
        where: { credits, isActive: true },
        orderBy: { id: 'asc' }
      });
    }

    if (!pkg) {
      return NextResponse.json(
        { error: 'Paquete no disponible. Contacta al administrador.' },
        { status: 400 }
      );
    }

    // El packageType que se guarda sale de la fila, no de lo que mande el cliente.
    const packageTypeReal = `pack_${pkg.credits}`;

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
          code: discountCode.trim().toUpperCase(),
          isActive: true,
          // AUTHZ (#PAGO): desactivar al vendedor en /admin/users no invalidaba
          // su código; seguía dando descuento y generando comisiones.
          // AUTH-004 / PAGO-005: sólo cuentan los códigos de vendedores (o admin).
          // Los que crearon otras cuentas mientras /api/vendor/* estaba abierto
          // permitían auto-referirse con una segunda cuenta.
          user: { isActive: true, role: { in: ['vendor', 'admin'] } }
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

      // SECURITY (#34): impedir auto-referido. Un usuario no puede aplicar
      // un código de descuento que él mismo creó (se auto-asignaría descuento
      // + comisión sobre su propia compra).
      if (foundCode.userId === payload.userId) {
        return NextResponse.json(
          { error: 'No puedes usar tu propio código de descuento' },
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

    // DINERO (#PAGO): nunca cobrar un importe distinto al que el cliente vio.
    // La página de compra mostraba precios que podían no ser los de la base de
    // datos (caía a una lista escrita a mano, y el total con descuento se
    // quedaba obsoleto al cambiar de paquete si fallaba la revalidación),
    // mientras el servidor cobraba siempre su propio cálculo.
    if (expectedAmount !== undefined && Math.round(expectedAmount) !== Math.round(finalPrice)) {
      return NextResponse.json(
        {
          error: 'El precio cambió. Revisa el total antes de pagar.',
          expectedAmount,
          finalPrice
        },
        { status: 409 }
      );
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

    // Ahora sí: los datos de la tarjeta. Sin esto, un body sin `paymentData`
    // reventaba con un TypeError al leer `payment_method_id` y el catch genérico
    // respondía 500 "Error al procesar el pago" (#PAGO).
    const paymentParsed = esquemaPaymentData.safeParse(
      (body as { paymentData?: unknown })?.paymentData
    );
    if (!paymentParsed.success) {
      return NextResponse.json(
        {
          error: 'Datos de pago inválidos',
          detalle: paymentParsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`)
        },
        { status: 400 }
      );
    }
    const paymentData = paymentParsed.data;

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
        package_type: packageTypeReal,
        package_id: pkg.id,
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

    // DINERO (#PAGO): la fila se crea ANTES de cobrar.
    //
    // Antes el orden era: cobrar en MercadoPago -> registrar la compra. Si algo
    // fallaba entre medias (timeout del pool de Postgres, la función serverless
    // terminada, un P2002 en DiscountCodeUse), la tarjeta ya estaba cobrada y no
    // quedaba fila: el webhook respondía 404 "Purchase not found" en todos los
    // reintentos, los créditos no se acreditaban nunca, y como el pago no llevaba
    // external_reference tampoco había forma de conciliarlo desde el panel de MP.
    //
    // Ahora la compra nace en 'pending' y su id viaja a MercadoPago como
    // `external_reference`, que es lo que permite al webhook encontrarla aunque
    // el paymentId no se haya llegado a guardar. La `idempotencyKey` evita el
    // doble cargo si el cliente reintenta la misma compra.
    const purchase = await prisma.creditPurchase.create({
      data: {
        userId: payload.userId,
        amount: pkg.credits,
        pricePerCredit: finalPrice / pkg.credits, // Precio por crédito después de descuento
        totalPrice: finalPrice,
        packageType: packageTypeReal,
        paymentStatus: 'pending',
        paymentMethod: paymentData.payment_method_id,
        paidAt: null
      }
    });

    paymentBody.external_reference = String(purchase.id);

    let paymentResult;
    try {
      paymentResult = await payment.create({
        body: paymentBody,
        requestOptions: { idempotencyKey: `inakat-purchase-${purchase.id}` }
      });
    } catch (e) {
      // El cobro no llegó a hacerse: la compra queda marcada y no se acredita nada.
      await prisma.creditPurchase.update({
        where: { id: purchase.id },
        data: { paymentStatus: 'failed' }
      }).catch((err) => {
        console.error('[Payments] No se pudo marcar la compra como fallida:', {
          purchaseId: purchase.id,
          error: err instanceof Error ? err.message : 'desconocido'
        });
      });
      throw e;
    }

    console.info('[Payments] Payment created:', { id: paymentResult.id, status: paymentResult.status });

    // A partir de aquí la tarjeta PUEDE estar cobrada: lo que falle se registra,
    // pero nunca se le dice al cliente que el pago falló.
    await prisma.creditPurchase.update({
      where: { id: purchase.id },
      data: { paymentId: String(paymentResult.id) }
    }).catch((e) => {
      console.error('[Payments] No se pudo guardar el paymentId; el webhook conciliará por external_reference:', {
        purchaseId: purchase.id,
        paymentId: paymentResult.id,
        error: e instanceof Error ? e.message : 'desconocido'
      });
    });

    // DINERO (#PAGO): el uso del código (= la comisión del vendedor) YA NO se
    // registra aquí. Se creaba justo después de pedir el cobro, sin mirar si
    // MercadoPago había aprobado nada: una tarjeta rechazada o un OXXO que nadie
    // paga dejaba una comisión viva que el admin podía liquidar de verdad. Ahora
    // se crea dentro de la transacción que acredita los créditos — abajo si
    // aprueba al instante, o en el webhook si el pago se confirma después — y
    // los datos del código viajan mientras tanto en la metadata del pago.

    // MEJ-003: Si el pago fue aprobado inmediatamente, agregar créditos usando transacción
    if (paymentResult.status === 'approved') {
      // Usar transacción para garantizar consistencia (igual que el webhook)
      //
      // DINERO (#PAGO): a estas alturas la tarjeta YA está cobrada. Si la
      // transacción falla (corte del pool, timeout), el catch genérico respondía
      // 500 "Error al procesar el pago": la empresa creía que no se había cobrado
      // y reintentaba -> segundo cargo. La compra sigue en 'pending' con su
      // external_reference, así que el webhook la acreditará; al cliente se le
      // dice la verdad: pago recibido, acreditación en proceso.
      const acreditacion = await prisma.$transaction(async (tx) => {
        // IDEMPOTENCIA (#PAGO): el mismo reclamo atómico que usa el webhook.
        // Antes este camino hacía un `update` incondicional mientras el webhook
        // usaba `updateMany` condicionado a que la compra siguiera sin pagar; si
        // la notificación llegaba a la vez que esta respuesta síncrona, los dos
        // podían acreditar y el usuario se llevaba los créditos por duplicado.
        const claimed = await tx.creditPurchase.updateMany({
          where: { id: purchase.id, paymentStatus: { not: 'paid' } },
          data: { paymentStatus: 'paid', paidAt: new Date() }
        });

        if (claimed.count === 0) {
          // El webhook llegó primero y ya acreditó: no se toca el saldo.
          const yaPagada = await tx.creditPurchase.findUnique({ where: { id: purchase.id } });
          const actual = await tx.user.findUnique({ where: { id: payload.userId } });
          return { updatedUser: actual!, updatedPurchase: yaPagada!, acreditadoAqui: false };
        }

        const updatedPurchase = await tx.creditPurchase.findUniqueOrThrow({
          where: { id: purchase.id }
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

        // Registrar transacción de créditos.
        //
        // LEDGER (#PAGO): `balanceBefore` salía de un `user.credits` leído antes
        // de llamar a MercadoPago — segundos antes, con un cobro de por medio —
        // mientras `balanceAfter` salía del saldo real. Si la empresa gastaba
        // créditos en otra pestaña durante el cobro, el asiento no cuadraba
        // (balanceBefore + amount != balanceAfter). Se deriva del saldo nuevo,
        // igual que ya hacía el webhook.
        await tx.creditTransaction.create({
          data: {
            userId: payload.userId,
            type: 'purchase',
            amount: pkg.credits,
            balanceBefore: updatedUser.credits - pkg.credits,
            balanceAfter: updatedUser.credits,
            purchaseId: purchase.id,
            description: `Compra de ${pkg.credits} créditos - Pago ID: ${paymentResult.id}`
          }
        });

        // La comisión del vendedor, sólo ahora que la compra está pagada.
        if (validDiscountCode) {
          const resultado = await registrarComisionDeVenta(tx, {
            purchaseId: purchase.id,
            companyUserId: payload.userId,
            codigo: validDiscountCode.code,
            originalPrice,
            discountAmount,
            finalPrice
          });

          if (resultado.creada) {
            console.info('[Payments] Discount code applied:', {
              code: validDiscountCode.code,
              discountAmount,
              commissionAmount: resultado.commissionAmount
            });
          }
        }

        return { updatedUser, updatedPurchase, acreditadoAqui: true };
      }).catch((error: unknown) => {
        console.error('[Payments] Pago aprobado pero la acreditación falló; queda para el webhook:', {
          purchaseId: purchase.id,
          paymentId: paymentResult.id,
          error: error instanceof Error ? error.message : 'desconocido'
        });
        return null;
      });

      if (!acreditacion) {
        // 'in_process' es el estado que la página ya trata como "pago recibido,
        // los créditos llegarán al confirmarse": nunca un error que invite a
        // pagar otra vez.
        return NextResponse.json(
          {
            success: true,
            status: 'in_process',
            purchase: { id: purchase.id },
            paymentId: paymentResult.id,
            message: 'Pago recibido. La acreditación de tus créditos está en proceso.'
          },
          { status: 202 }
        );
      }

      const { updatedUser, updatedPurchase, acreditadoAqui } = acreditacion;

      console.info('[Payments] Credits added:', { credits: pkg.credits, userId: payload.userId });

      // NOTIFICACIÓN (#PAGO): el correo de confirmación y la notificación in-app
      // sólo se enviaban desde el webhook, y sólo cuando era él quien acreditaba.
      // En el flujo normal de tarjeta acredita esta respuesta síncrona, así que
      // la empresa pagaba y no recibía NADA: ni correo ni comprobante. Se
      // notifica sólo si esta llamada fue la que ganó el reclamo atómico, para
      // no duplicar el aviso cuando ganó el webhook.
      if (acreditadoAqui) {
        await notificarCompraAcreditada(
          payload.userId,
          pkg.credits,
          updatedUser.credits,
          finalPrice
        );
      }

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

    // CORRECCIÓN (#PAGO): un rechazo NO es un pago pendiente.
    //
    // MercadoPago devuelve 201 con status 'rejected'/'cancelled' (no lanza), así
    // que esta rama final lo trataba como "pendiente de confirmación": la compra
    // se quedaba 'pending' para siempre en cuanto no hubiera notification_url
    // (local, o NEXT_PUBLIC_APP_URL sin definir) y la API respondía
    // success:true con un mensaje que no correspondía a lo ocurrido.
    if (paymentResult.status === 'rejected' || paymentResult.status === 'cancelled') {
      await prisma.creditPurchase.updateMany({
        where: { id: purchase.id, paymentStatus: { not: 'paid' } },
        data: { paymentStatus: 'failed' }
      });

      console.warn('[Payments] Pago rechazado:', {
        purchaseId: purchase.id,
        status: paymentResult.status,
        statusDetail: paymentResult.status_detail
      });

      return NextResponse.json(
        {
          success: false,
          status: paymentResult.status,
          error: 'El pago fue rechazado. Revisa los datos de la tarjeta o usa otro medio de pago.',
          statusDetail: paymentResult.status_detail
        },
        { status: 402 }
      );
    }

    // Pago pendiente de verdad (ej: OXXO, transferencia, 3DS en proceso)
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
  } catch (error: unknown) {
    // SECURITY (#90): loguear el detalle en el servidor, pero nunca devolver
    // error.cause / error.message crudos al cliente (fuga de internals).
    const hasCause =
      typeof error === 'object' && error !== null && 'cause' in error &&
      (error as { cause?: unknown }).cause != null;

    console.error('[Payments] Error processing purchase:', {
      message: error instanceof Error ? error.message : 'Unknown error',
      cause: hasCause ? (error as { cause: unknown }).cause : undefined,
    });

    // Errores específicos de Mercado Pago (ej: pago rechazado): respondemos 400
    // con un mensaje genérico, sin exponer el detalle interno.
    if (hasCause) {
      return NextResponse.json(
        { error: 'No se pudo procesar el pago. Verifica los datos e intenta de nuevo.' },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: 'Error al procesar el pago' },
      { status: 500 }
    );
  }
}
