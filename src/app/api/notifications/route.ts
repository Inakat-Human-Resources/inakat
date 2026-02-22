// RUTA: src/app/api/notifications/route.ts

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';

/**
 * GET /api/notifications
 * Obtiene las notificaciones del usuario autenticado (paginadas)
 */
export async function GET(request: Request) {
  const auth = await requireAuth();
  if ('error' in auth) {
    return NextResponse.json({ success: false, error: auth.error }, { status: auth.status });
  }

  const { searchParams } = new URL(request.url);
  const page = Math.max(1, parseInt(searchParams.get('page') || '1'));
  const limit = Math.min(50, Math.max(1, parseInt(searchParams.get('limit') || '20')));
  const filter = searchParams.get('filter'); // "unread" | "read" | null (all)

  const where: { userId: number; read?: boolean } = { userId: auth.user.id };
  if (filter === 'unread') where.read = false;
  if (filter === 'read') where.read = true;

  const [notifications, total] = await Promise.all([
    prisma.notification.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.notification.count({ where }),
  ]);

  return NextResponse.json({
    success: true,
    data: notifications,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  });
}

/**
 * PATCH /api/notifications
 * Marca notificaciones como leídas
 * Body: { ids: number[] } o { all: true }
 */
export async function PATCH(request: Request) {
  const auth = await requireAuth();
  if ('error' in auth) {
    return NextResponse.json({ success: false, error: auth.error }, { status: auth.status });
  }

  const body = await request.json();

  if (body.all === true) {
    // Marcar todas como leídas
    await prisma.notification.updateMany({
      where: { userId: auth.user.id, read: false },
      data: { read: true, readAt: new Date() },
    });

    return NextResponse.json({ success: true, message: 'Todas las notificaciones marcadas como leídas' });
  }

  if (Array.isArray(body.ids) && body.ids.length > 0) {
    // Marcar específicas como leídas
    await prisma.notification.updateMany({
      where: {
        id: { in: body.ids.map(Number) },
        userId: auth.user.id,
      },
      data: { read: true, readAt: new Date() },
    });

    return NextResponse.json({ success: true, message: 'Notificaciones marcadas como leídas' });
  }

  return NextResponse.json(
    { success: false, error: 'Debes enviar { ids: [...] } o { all: true }' },
    { status: 400 }
  );
}
