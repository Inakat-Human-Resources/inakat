// RUTA: src/app/api/notifications/route.ts

import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';
import { getPaginationParams } from '@/lib/pagination';

/**
 * Cuerpo válido de PATCH: o se marcan TODAS, o una lista acotada de ids.
 * Antes se leía `body.all` y `body.ids.map(Number)` a pelo: un cuerpo vacío,
 * `null` o `{ids:['x']}` reventaban con un 500 y un stack en los logs en vez de
 * devolver el 400 que corresponde.
 */
const patchSchema = z.union([
  z.object({ all: z.literal(true) }),
  z.object({
    ids: z.array(z.number().int().positive()).min(1).max(100)
  })
]);

/**
 * GET /api/notifications
 * Obtiene las notificaciones del usuario autenticado (paginadas)
 */
export async function GET(request: Request) {
  try {
    const auth = await requireAuth();
    if ('error' in auth) {
      return NextResponse.json({ success: false, error: auth.error }, { status: auth.status });
    }

    const { searchParams } = new URL(request.url);
    // getPaginationParams normaliza NaN y valores fuera de rango: `?page=abc`
    // llegaba a Prisma como `skip: NaN` y devolvía un 500.
    const { page, limit, skip, take } = getPaginationParams(searchParams, 20, 50);
    const filter = searchParams.get('filter'); // "unread" | "read" | null (all)

    const where: { userId: number; read?: boolean } = { userId: auth.user.id };
    if (filter === 'unread') where.read = false;
    if (filter === 'read') where.read = true;

    const [notifications, total, unreadTotal] = await Promise.all([
      prisma.notification.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take,
      }),
      prisma.notification.count({ where }),
      // Total de no leídas del usuario SIN filtro ni paginación: la página lo
      // necesita para saber si tiene sentido ofrecer "Marcar todas leídas"
      // (contarlas sobre los 20 elementos visibles escondía el botón cuando las
      // no leídas estaban en otra página).
      prisma.notification.count({ where: { userId: auth.user.id, read: false } }),
    ]);

    return NextResponse.json({
      success: true,
      data: notifications,
      unreadTotal,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('[Notifications] Error listando notificaciones:', error);
    return NextResponse.json(
      { success: false, error: 'Error al obtener las notificaciones' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/notifications
 * Marca notificaciones como leídas
 * Body: { ids: number[] } o { all: true }
 */
export async function PATCH(request: Request) {
  try {
    const auth = await requireAuth();
    if ('error' in auth) {
      return NextResponse.json({ success: false, error: auth.error }, { status: auth.status });
    }

    const body = await request.json().catch(() => null);
    const parsed = patchSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: 'Debes enviar { ids: [...] } o { all: true }' },
        { status: 400 }
      );
    }

    if ('all' in parsed.data) {
      await prisma.notification.updateMany({
        where: { userId: auth.user.id, read: false },
        data: { read: true, readAt: new Date() },
      });

      return NextResponse.json({ success: true, message: 'Todas las notificaciones marcadas como leídas' });
    }

    await prisma.notification.updateMany({
      where: {
        id: { in: parsed.data.ids },
        userId: auth.user.id,
      },
      data: { read: true, readAt: new Date() },
    });

    return NextResponse.json({ success: true, message: 'Notificaciones marcadas como leídas' });
  } catch (error) {
    console.error('[Notifications] Error marcando notificaciones:', error);
    return NextResponse.json(
      { success: false, error: 'Error al marcar las notificaciones' },
      { status: 500 }
    );
  }
}
