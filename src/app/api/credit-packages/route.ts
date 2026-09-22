// RUTA: src/app/api/credit-packages/route.ts

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

/**
 * GET /api/credit-packages
 * Paquetes de créditos ACTIVOS, para la página de compra.
 *
 * Existe aparte de /api/admin/credit-packages porque aquel handler contemplaba
 * el caso público (`?activeOnly=true` sin auth), pero el middleware protege todo
 * `/api/admin/*` por rol admin y devolvía 403 antes de llegar al handler. El
 * resultado era que la página de compra NUNCA recibía los paquetes reales y caía
 * en una lista de precios escrita a mano en el propio componente — que podía no
 * coincidir con lo que el servidor cobra de verdad, porque el cobro sale de esta
 * misma tabla (POST /api/credits/purchases).
 *
 * La gestión (crear, editar, desactivar) sigue en /api/admin/credit-packages.
 */
export async function GET() {
  try {
    const packages = await prisma.creditPackage.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: 'asc' },
      select: {
        id: true,
        name: true,
        credits: true,
        price: true,
        pricePerCredit: true,
        badge: true,
        isActive: true,
        sortOrder: true
      }
    });

    return NextResponse.json({ success: true, data: packages });
  } catch (error) {
    console.error('Error fetching credit packages:', error);
    return NextResponse.json(
      { success: false, error: 'Error al obtener paquetes' },
      { status: 500 }
    );
  }
}
