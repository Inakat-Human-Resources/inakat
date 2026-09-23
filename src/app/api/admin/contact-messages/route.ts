// RUTA: src/app/api/admin/contact-messages/route.ts
//
// Lectura de los mensajes del formulario público de contacto (/contact).
// Existía el `create` en POST /api/contact pero NINGUNA lectura en todo `src/`:
// los leads sólo se podían consultar entrando a la base de datos a mano.
//
// NOTA sobre el modelo: ContactMessage sólo tiene id, nombre, email, telefono,
// mensaje y createdAt. No hay campo de "leído", así que aquí no hay filtro
// ?unread ni un PATCH para marcar: inventar columnas es trabajo de migración,
// no de esta ruta.

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/auth';
import { getPaginationParams, buildPaginatedResponse } from '@/lib/pagination';

/**
 * GET /api/admin/contact-messages?page=1&limit=20
 * Solo admin. Orden descendente por fecha (lo más reciente primero).
 */
export async function GET(request: Request) {
  try {
    const auth = await requireRole('admin');
    if ('error' in auth) {
      return NextResponse.json(
        { success: false, error: auth.error },
        { status: auth.status }
      );
    }

    const { searchParams } = new URL(request.url);
    const paginacion = getPaginationParams(searchParams, 20, 100);

    const [mensajes, total] = await Promise.all([
      prisma.contactMessage.findMany({
        orderBy: { createdAt: 'desc' },
        skip: paginacion.skip,
        take: paginacion.take,
        select: {
          id: true,
          nombre: true,
          email: true,
          telefono: true,
          mensaje: true,
          createdAt: true
        }
      }),
      prisma.contactMessage.count()
    ]);

    return NextResponse.json({
      success: true,
      ...buildPaginatedResponse(mensajes, total, paginacion)
    });
  } catch (error) {
    console.error('[AdminContactMessages] Error listando mensajes:', error);
    return NextResponse.json(
      { success: false, error: 'Error al obtener los mensajes de contacto' },
      { status: 500 }
    );
  }
}
