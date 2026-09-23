// RUTA: src/lib/comisiones.ts

import { Prisma } from '@prisma/client';

/** Cliente de Prisma dentro de una transacción (o el cliente normal). */
type ClientePrisma = Prisma.TransactionClient;

/** Plazo de pago de la comisión al vendedor: 4 meses desde la venta. */
export function getCommissionDueDate(desde: Date = new Date()): Date {
  const fecha = new Date(desde);
  fecha.setMonth(fecha.getMonth() + 4);
  return fecha;
}

/**
 * Etiqueta legible del estado de una comisión.
 *
 * Las rutas hacían `status === 'paid' ? 'Pagada' : 'Pendiente'`, así que una
 * comisión 'cancelled' (compra rechazada o devuelta) se mostraba como
 * "Pendiente", es decir, como dinero que todavía se le debe al vendedor.
 */
export function etiquetaEstadoComision(estado: string): string {
  switch (estado) {
    case 'paid':
      return 'Pagada';
    case 'cancelled':
      return 'Cancelada';
    default:
      return 'Pendiente';
  }
}

export interface DatosComision {
  purchaseId: number;
  companyUserId: number;
  /** Código de descuento tal cual se aplicó (se normaliza a mayúsculas aquí). */
  codigo: string;
  originalPrice: number;
  discountAmount: number;
  finalPrice: number;
}

export type ResultadoComision =
  | { creada: true; commissionAmount: number; codeId: number }
  | { creada: false; motivo: 'codigo-inexistente' | 'ya-registrada' };

/**
 * Registra la comisión del vendedor (DiscountCodeUse) de una venta.
 *
 * DINERO (#PAGO): esta fila se creaba en POST /api/credits/purchases justo
 * después de pedir el cobro, SIN mirar si MercadoPago había aprobado el pago.
 * Una tarjeta rechazada, o un OXXO que nadie paga, dejaba una comisión viva que
 * el vendedor veía como venta y el admin podía liquidar de verdad: dinero real
 * transferido por ventas que nunca se cobraron. Ahora sólo se llama cuando la
 * compra queda efectivamente en 'paid', y siempre dentro de la MISMA transacción
 * que acredita los créditos (tanto en la ruta de compra como en el webhook).
 *
 * Es idempotente: `DiscountCodeUse.purchaseId` es único, así que si las dos vías
 * corren a la vez sólo una fila sobrevive y la otra sale por 'ya-registrada'.
 */
export async function registrarComisionDeVenta(
  tx: ClientePrisma,
  datos: DatosComision
): Promise<ResultadoComision> {
  const codigoNormalizado = datos.codigo.trim().toUpperCase();

  const code = await tx.discountCode.findUnique({
    where: { code: codigoNormalizado },
    select: { id: true, commissionPercent: true }
  });

  if (!code) {
    return { creada: false, motivo: 'codigo-inexistente' };
  }

  const yaExiste = await tx.discountCodeUse.findUnique({
    where: { purchaseId: datos.purchaseId },
    select: { id: true }
  });

  if (yaExiste) {
    return { creada: false, motivo: 'ya-registrada' };
  }

  const commissionAmount = Math.round(
    datos.finalPrice * (code.commissionPercent / 100)
  );

  try {
    await tx.discountCodeUse.create({
      data: {
        codeId: code.id,
        purchaseId: datos.purchaseId,
        companyUserId: datos.companyUserId,
        originalPrice: datos.originalPrice,
        discountAmount: datos.discountAmount,
        finalPrice: datos.finalPrice,
        commissionAmount,
        commissionStatus: 'pending',
        paymentDueDate: getCommissionDueDate()
      }
    });
  } catch (error) {
    // Carrera entre la respuesta síncrona y el webhook: la otra ganó.
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      return { creada: false, motivo: 'ya-registrada' };
    }
    throw error;
  }

  return { creada: true, commissionAmount, codeId: code.id };
}
