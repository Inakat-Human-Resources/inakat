// RUTA: src/app/api/admin/credit-packages/route.ts

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/auth';

// Longitud máxima del nombre visible del paquete.
const MAX_NOMBRE = 60;

/**
 * GET /api/admin/credit-packages
 * Lista todos los paquetes de créditos (ordenados por sortOrder).
 *
 * La rama `?activeOnly=true` "sin auth" se eliminó: era código muerto porque el
 * middleware protege todo /api/admin/* por rol admin y devolvía 403 antes de
 * entrar aquí. La página de compra usa GET /api/credit-packages.
 */
export async function GET() {
  try {
    const auth = await requireRole('admin');
    if ('error' in auth) {
      return NextResponse.json(
        { success: false, error: auth.error },
        { status: auth.status }
      );
    }

    const packages = await prisma.creditPackage.findMany({
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

    // Se valida el TIPO antes de comparar: 'abc' <= 0 es false, así que un
    // string pasaba los filtros y `parseInt('abc')` daba NaN -> Prisma lanzaba
    // y el admin recibía un 500.
    const nombreLimpio = typeof name === 'string' ? name.trim() : '';
    if (!nombreLimpio || nombreLimpio.length > MAX_NOMBRE) {
      return NextResponse.json(
        { success: false, error: `El nombre debe tener entre 1 y ${MAX_NOMBRE} caracteres` },
        { status: 400 }
      );
    }

    if (!Number.isInteger(credits) || credits <= 0) {
      return NextResponse.json(
        { success: false, error: 'La cantidad de créditos debe ser un entero mayor a 0' },
        { status: 400 }
      );
    }

    if (typeof price !== 'number' || !Number.isFinite(price) || price <= 0) {
      return NextResponse.json(
        { success: false, error: 'El precio debe ser mayor a 0' },
        { status: 400 }
      );
    }

    if (sortOrder !== undefined && sortOrder !== null && (!Number.isInteger(sortOrder) || sortOrder < 0)) {
      return NextResponse.json(
        { success: false, error: 'sortOrder debe ser un entero mayor o igual a 0' },
        { status: 400 }
      );
    }

    // Validar badge
    const validBadges = ['MÁS POPULAR', 'PROMOCIÓN', null, ''];
    if (badge && !validBadges.includes(badge)) {
      return NextResponse.json(
        { success: false, error: 'Badge inválido. Opciones: MÁS POPULAR, PROMOCIÓN' },
        { status: 400 }
      );
    }

    // Dos paquetes activos con los MISMOS créditos hacen ambigua la compra
    // (/api/credits/purchases resuelve el paquete por cantidad de créditos).
    const duplicado = await prisma.creditPackage.findFirst({
      where: { credits, isActive: true }
    });

    if (duplicado) {
      return NextResponse.json(
        {
          success: false,
          error: `Ya existe un paquete activo de ${credits} crédito(s) ("${duplicado.name}"). Desactívalo o edítalo en lugar de duplicarlo.`
        },
        { status: 409 }
      );
    }

    // Calcular precio por crédito con los valores ya normalizados
    const pricePerCredit = price / credits;

    const newPackage = await prisma.creditPackage.create({
      data: {
        name: nombreLimpio,
        credits,
        price,
        pricePerCredit: parseFloat(pricePerCredit.toFixed(2)),
        badge: badge || null,
        sortOrder: sortOrder ?? 0,
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
