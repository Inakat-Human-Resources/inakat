// RUTA: src/app/api/vendor/my-code/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// Validar formato de código: solo letras y números, 4-20 caracteres
function validateCodeFormat(code: string): { valid: boolean; error?: string } {
  if (!code || typeof code !== 'string') {
    return { valid: false, error: 'El código es requerido' };
  }

  const trimmedCode = code.trim();

  if (trimmedCode.length < 4 || trimmedCode.length > 20) {
    return { valid: false, error: 'El código debe tener entre 4 y 20 caracteres' };
  }

  if (!/^[a-zA-Z0-9]+$/.test(trimmedCode)) {
    return { valid: false, error: 'El código solo puede contener letras y números' };
  }

  return { valid: true };
}

// Helper para obtener userId de los headers (agregados por middleware)
function getUserIdFromHeaders(request: NextRequest): number | null {
  const userId = request.headers.get('x-user-id');
  return userId ? parseInt(userId) : null;
}

// GET - Obtener el código del usuario logueado
export async function GET(request: NextRequest) {
  try {
    const userId = getUserIdFromHeaders(request);
    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'No autorizado' },
        { status: 401 }
      );
    }

    const discountCode = await prisma.discountCode.findFirst({
      where: { userId },
      select: {
        id: true,
        code: true,
        discountPercent: true,
        commissionPercent: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
        _count: {
          select: { uses: true }
        }
      }
    });

    return NextResponse.json({
      success: true,
      data: discountCode
    });
  } catch (error) {
    console.error('Error getting discount code:', error);
    return NextResponse.json(
      { success: false, error: 'Error al obtener código de descuento' },
      { status: 500 }
    );
  }
}

// POST - Crear código de descuento para el usuario
export async function POST(request: NextRequest) {
  try {
    const userId = getUserIdFromHeaders(request);
    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'No autorizado' },
        { status: 401 }
      );
    }

    // Verificar si ya tiene un código
    const existingCode = await prisma.discountCode.findFirst({
      where: { userId }
    });

    if (existingCode) {
      return NextResponse.json(
        { success: false, error: 'Ya tienes un código de descuento. Usa PUT para actualizarlo.' },
        { status: 409 }
      );
    }

    const body = await request.json();
    const { code } = body;

    // Validar formato
    const validation = validateCodeFormat(code);
    if (!validation.valid) {
      return NextResponse.json(
        { success: false, error: validation.error },
        { status: 400 }
      );
    }

    const normalizedCode = code.trim().toUpperCase();

    // Verificar que el código sea único
    const duplicateCode = await prisma.discountCode.findUnique({
      where: { code: normalizedCode }
    });

    if (duplicateCode) {
      return NextResponse.json(
        { success: false, error: 'Este código ya está en uso. Elige otro.' },
        { status: 409 }
      );
    }

    // Crear código
    const discountCode = await prisma.discountCode.create({
      data: {
        code: normalizedCode,
        userId,
        discountPercent: 10,
        commissionPercent: 10,
        isActive: true
      },
      select: {
        id: true,
        code: true,
        discountPercent: true,
        commissionPercent: true,
        isActive: true,
        createdAt: true
      }
    });

    return NextResponse.json({
      success: true,
      data: discountCode,
      message: 'Código de descuento creado exitosamente'
    }, { status: 201 });
  } catch (error) {
    console.error('Error creating discount code:', error);
    return NextResponse.json(
      { success: false, error: 'Error al crear código de descuento' },
      { status: 500 }
    );
  }
}

// PUT - Actualizar código del usuario
export async function PUT(request: NextRequest) {
  try {
    const userId = getUserIdFromHeaders(request);
    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'No autorizado' },
        { status: 401 }
      );
    }

    // Verificar que tenga un código
    const existingCode = await prisma.discountCode.findFirst({
      where: { userId }
    });

    if (!existingCode) {
      return NextResponse.json(
        { success: false, error: 'No tienes un código de descuento. Usa POST para crear uno.' },
        { status: 404 }
      );
    }

    const body = await request.json();
    const { code, isActive } = body;

    const updateData: { code?: string; isActive?: boolean } = {};

    // Si se proporciona nuevo código, validar
    if (code !== undefined) {
      const validation = validateCodeFormat(code);
      if (!validation.valid) {
        return NextResponse.json(
          { success: false, error: validation.error },
          { status: 400 }
        );
      }

      const normalizedCode = code.trim().toUpperCase();

      // Verificar unicidad (excluyendo el actual)
      const duplicateCode = await prisma.discountCode.findFirst({
        where: {
          code: normalizedCode,
          id: { not: existingCode.id }
        }
      });

      if (duplicateCode) {
        return NextResponse.json(
          { success: false, error: 'Este código ya está en uso. Elige otro.' },
          { status: 409 }
        );
      }

      updateData.code = normalizedCode;
    }

    // Si se proporciona isActive, actualizar
    if (typeof isActive === 'boolean') {
      updateData.isActive = isActive;
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json(
        { success: false, error: 'No hay datos para actualizar' },
        { status: 400 }
      );
    }

    const updatedCode = await prisma.discountCode.update({
      where: { id: existingCode.id },
      data: updateData,
      select: {
        id: true,
        code: true,
        discountPercent: true,
        commissionPercent: true,
        isActive: true,
        createdAt: true,
        updatedAt: true
      }
    });

    return NextResponse.json({
      success: true,
      data: updatedCode,
      message: 'Código de descuento actualizado'
    });
  } catch (error) {
    console.error('Error updating discount code:', error);
    return NextResponse.json(
      { success: false, error: 'Error al actualizar código de descuento' },
      { status: 500 }
    );
  }
}
