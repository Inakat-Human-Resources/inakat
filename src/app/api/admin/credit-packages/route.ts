// RUTA: src/app/api/admin/credit-packages/route.ts

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/auth';

/**
 * GET /api/admin/credit-packages
 * Lista todos los paquetes de créditos (ordenados por sortOrder)
 * Query params: ?activeOnly=true (opcional, para página de compra)
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const activeOnly = searchParams.get('activeOnly') === 'true';

    // Si es activeOnly, no requiere auth (para página pública de compra)
    if (!activeOnly) {
      const auth = await requireRole('admin');
      if ('error' in auth) {
        return NextResponse.json(
          { success: false, error: auth.error },
          { status: auth.status }
        );
      }
    }

    const where = activeOnly ? { isActive: true } : {};

    const packages = await prisma.creditPackage.findMany({
      where,
      orderBy: { sortOrder: 'asc' }
    });

    return NextResponse.json({
      success: true,
      data: packages
    });
  } catch (error) {
    console.error('Error fetching credit packages:', error);
    return NextResponse.json(
      { success: false, error: 'Error al obtener paquetes' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/credit-packages
 * Crear nuevo paquete de créditos
 */
export async function POST(request: Request) {
  try {
    const auth = await requireRole('admin');
    if ('error' in auth) {
      return NextResponse.json(
        { success: false, error: auth.error },
        { status: auth.status }
      );
    }

    const body = await request.json();
    const { name, credits, price, badge, sortOrder } = body;

    // Validaciones
    if (!name || !credits || !price) {
      return NextResponse.json(
        { success: false, error: 'Campos requeridos: name, credits, price' },
        { status: 400 }
      );
    }

    if (credits <= 0) {
      return NextResponse.json(
        { success: false, error: 'La cantidad de créditos debe ser mayor a 0' },
        { status: 400 }
      );
    }

    if (price <= 0) {
      return NextResponse.json(
        { success: false, error: 'El precio debe ser mayor a 0' },
        { status: 400 }
      );
    }

    // Calcular precio por crédito automáticamente
    const pricePerCredit = price / credits;

    // Validar badge
    const validBadges = ['MÁS POPULAR', 'PROMOCIÓN', null, ''];
    if (badge && !validBadges.includes(badge)) {
      return NextResponse.json(
        { success: false, error: 'Badge inválido. Opciones: MÁS POPULAR, PROMOCIÓN' },
        { status: 400 }
      );
    }

    const newPackage = await prisma.creditPackage.create({
      data: {
        name,
        credits: parseInt(credits),
        price: parseFloat(price),
        pricePerCredit: parseFloat(pricePerCredit.toFixed(2)),
        badge: badge || null,
        sortOrder: sortOrder || 0,
        isActive: true
      }
    });

    return NextResponse.json(
      {
        success: true,
        message: 'Paquete creado exitosamente',
        data: newPackage
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Error creating credit package:', error);
    return NextResponse.json(
      { success: false, error: 'Error al crear paquete' },
      { status: 500 }
    );
  }
}
