// RUTA: src/lib/notifications.ts

import { after } from 'next/server';
import { prisma } from './prisma';

// =============================================
// TRABAJO POSTERIOR A LA RESPUESTA
// =============================================

/**
 * Ejecuta trabajo secundario (notificaciones, emails, webhooks) SIN perderlo.
 *
 * El patrón que había —`fn(...).catch(() => {})` y responder de inmediato— es
 * exactamente el que la auditoría de junio (#70) corrigió en el webhook de
 * MercadoPago y que seguía vivo en el resto: en serverless la función puede
 * congelarse en cuanto sale la respuesta, así que el INSERT o el SMTP no
 * llegan a completarse, y el `.catch` vacío se traga incluso el error.
 *
 * `after()` (estable desde Next 15.1) mantiene viva la invocación hasta que el
 * trabajo termina, sin retrasar la respuesta. Fuera de un contexto de request
 * (tests, scripts) `after()` lanza; en ese caso se ejecuta en línea, de modo
 * que el comportamiento sigue siendo verificable.
 *
 * @param etiqueta - prefijo para el log de errores, p. ej. 'NOTIF:approve'
 * @param fn - trabajo a ejecutar
 */
export async function runAfterResponse(
  etiqueta: string,
  fn: () => Promise<unknown>
): Promise<void> {
  const ejecutar = async () => {
    try {
      await fn();
    } catch (error) {
      console.error(`[${etiqueta}] Trabajo posterior a la respuesta falló:`, error);
    }
  };

  try {
    after(ejecutar);
  } catch {
    // Sin contexto de request: no hay respuesta que no bloquear.
    await ejecutar();
  }
}

// =============================================
// TIPOS
// =============================================

export type NotificationType =
  | 'new_request'
  | 'request_approved'
  | 'request_rejected'
  | 'assignment'
  | 'new_application'
  | 'credits_purchased'
  | 'sent_to_specialist'
  | 'sent_to_company'
  | 'application_status'
  | 'interview_requested'
  // Cambios de una entrevista agendada por el admin (ADM-041/ADM-042).
  | 'interview_confirmed'
  | 'interview_rescheduled'
  | 'interview_cancelled'
  // Devolución/contracargo de una compra de créditos ya acreditada: los créditos
  // se retiran y la comisión del vendedor se cancela, así que el admin tiene que
  // enterarse (#PAGO).
  | 'payment_refunded'
  // Mensaje del formulario público de contacto (/contact): antes se guardaba en
  // ContactMessage sin avisar a nadie y el lead se perdía.
  | 'contact_message';

interface CreateNotificationParams {
  userId: number;
  type: NotificationType;
  title: string;
  message: string;
  link?: string;
  metadata?: Record<string, unknown>;
}

// =============================================
// FUNCIONES
// =============================================

/**
 * Crea una notificación para un usuario específico
 */
export async function createNotification({
  userId,
  type,
  title,
  message,
  link,
  metadata,
}: CreateNotificationParams) {
  return prisma.notification.create({
    data: {
      userId,
      type,
      title,
      message,
      link: link || null,
      metadata: metadata ? JSON.stringify(metadata) : null,
    },
  });
}

/**
 * Envía una notificación a todos los admins activos
 */
export async function notifyAllAdmins(
  params: Omit<CreateNotificationParams, 'userId'>
) {
  const admins = await prisma.user.findMany({
    where: { role: 'admin', isActive: true },
    select: { id: true },
  });

  if (process.env.NODE_ENV !== 'production') {
    console.log('[NOTIF] notifyAllAdmins called:', params.type, '| Admins:', admins.length);
  }

  if (admins.length === 0) return;

  await prisma.notification.createMany({
    data: admins.map((admin) => ({
      userId: admin.id,
      type: params.type,
      title: params.title,
      message: params.message,
      link: params.link || null,
      metadata: params.metadata ? JSON.stringify(params.metadata) : null,
    })),
  });
}

/**
 * Obtiene el conteo de notificaciones no leídas de un usuario
 */
export async function getUnreadCount(userId: number): Promise<number> {
  return prisma.notification.count({
    where: { userId, read: false },
  });
}
