// RUTA: src/app/api/vendor/my-code/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/auth';

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

/**
 * DINERO (AUTH-004): estas rutas se autorizaban SÓLO con la cabecera x-user-id,
 * y el middleware no exigía ningún rol para /api/vendor/*. Cualquier cuenta
 * —por ejemplo un candidato recién autorregistrado con otro correo— podía
 * crearse un DiscountCode con 10% de descuento y 10% de comisión y usarlo desde
 * su cuenta de empresa: 10% permanente y comisión a cobrar a favor de sí mismo,
 * saltándose el anti auto-referido con una segunda cuenta.
 *
 * El rol 'vendor' lo asigna el admin (POST /api/admin/vendors), nadie se lo da
 * a sí mismo. `requireRole` consulta la base, así que además respeta la
 * desactivación y el cambio de rol sin esperar a que caduque el JWT (AUTH-002).
 */
const ROLES_VENDEDOR = ['vendor', 'admin'];

type AccesoVendedor = { userId: number } | { denegado: NextResponse };

async function requireVendedor(): Promise<AccesoVendedor> {
  const auth = await requireRole(ROLES_VENDEDOR);

  if ('error' in auth) {
    return {
      denegado: NextResponse.json(
        { success: false, error: auth.error },
        { status: auth.status }
      )
    };
  }

  return { userId: auth.user.id };
}

// GET - Obtener el código del vendedor logueado
export async function GET() {
  try {
    const acceso = await requireVendedor();
    if ('denegado' in acceso) return acceso.denegado;
    const { userId } = acceso;

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

// POST - Crear código de descuento para el vendedor
export async function POST(request: NextRequest) {
  try {
    const acceso = await requireVendedor();
    if ('denegado' in acceso) return acceso.denegado;
    const { userId } = acceso;

    // Verificar si ya tiene un código
    const existingCode = await prisma.discountCode.findFirst({
      where: { userId }
    });

    if (existingCode) {
      return NextResponse.json(
        { success: false, error: 'Ya tienes un código de descuento; edítalo desde tu panel.' },
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

    // Crear código.
    //
    // FIABILIDAD (#PAGO): la unicidad se comprueba con findUnique justo arriba
    // (check-then-act), así que dos POST simultáneos —doble clic, dos pestañas—
    // pasaban los dos. Si el texto coincidía, el segundo `create` lanzaba P2002
    // y el catch genérico respondía 500 "Error al crear código de descuento"
    // aunque el código SÍ se hubiera creado. Se traduce a 409.
    let discountCode;
    try {
      discountCode = await prisma.discountCode.create({
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
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        return NextResponse.json(
          { success: false, error: 'Este código ya está en uso. Elige otro.' },
          { status: 409 }
        );
      }
      throw error;
    }

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

// PUT - Actualizar código del vendedor
export async function PUT(request: NextRequest) {
  try {
    const acceso = await requireVendedor();
    if ('denegado' in acceso) return acceso.denegado;
    const { userId } = acceso;

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

    // AUTHZ (#PAGO): el dueño del código puede DESACTIVARLO, nunca reactivarlo.
    //
    // El PUT aceptaba cualquier isActive del propio vendedor. Si se detectaba un
    // abuso y se ponía isActive=false (a mano en la base o desde el panel), al
    // vendedor le bastaba un PUT {"isActive":true} para volver a tener un código
    // válido en /api/discount-codes/validate y en las compras. Reactivar es del
    // admin: PATCH /api/admin/vendors/[id].
    if (typeof isActive === 'boolean') {
      if (isActive && !existingCode.isActive) {
        return NextResponse.json(
          {
            success: false,
            error: 'Tu código está desactivado. Solo un administrador puede reactivarlo.'
          },
          { status: 403 }
        );
      }
      updateData.isActive = isActive;
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json(
        { success: false, error: 'No hay datos para actualizar' },
        { status: 400 }
      );
    }

    let updatedCode;
    try {
      updatedCode = await prisma.discountCode.update({
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
    } catch (error) {
      // Misma carrera que en el POST: el findFirst de unicidad no la cierra.
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        return NextResponse.json(
          { success: false, error: 'Este código ya está en uso. Elige otro.' },
          { status: 409 }
        );
      }
      throw error;
    }

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
