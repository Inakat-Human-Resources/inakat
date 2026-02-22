// RUTA: src/lib/notifications.ts

import { prisma } from './prisma';

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
  | 'interview_requested';

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
