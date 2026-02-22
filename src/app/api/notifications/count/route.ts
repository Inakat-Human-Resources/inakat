// RUTA: src/app/api/notifications/count/route.ts

import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { getUnreadCount } from '@/lib/notifications';

/**
 * GET /api/notifications/count
 * Retorna el conteo de notificaciones no leídas del usuario
 */
export async function GET() {
  const auth = await requireAuth();
  if ('error' in auth) {
    return NextResponse.json({ success: false, error: auth.error }, { status: auth.status });
  }

  const count = await getUnreadCount(auth.user.id);

  return NextResponse.json({ success: true, count });
}
