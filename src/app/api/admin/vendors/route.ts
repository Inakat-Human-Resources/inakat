// RUTA: src/app/api/admin/vendors/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/auth';
import { getPaginationParams } from '@/lib/pagination';
import { passwordRegistroSchema } from '@/lib/validations';
import bcrypt from 'bcryptjs';

// DEAD-CODE (#PAGO): aquí había un `getAuthFromHeaders` que leía x-user-id /
// x-user-role y respondía 401 si faltaban. Corría DESPUÉS de `requireRole`, que
// ya valida cookie + rol contra la base de datos, y su `userId` no se usaba para
// nada: sólo añadía un segundo camino de fallo que rechazaba llamadas legítimas
// cuando no pasaban por el middleware. El actor sale de `roleCheck.user`.

/**
 * Porcentaje de descuento/comisión.
 *
 * VALIDACIÓN (#PAGO): la ruta RECORTABA en silencio a [0,100] y convertía
 * cualquier cosa no numérica en 10. Teclear 150 guardaba 100 sin avisar (precio
 * final 0, que MercadoPago no puede cobrar) y un campo vacío guardaba 0% de
 * comisión sin que el admin se enterara. Ahora se responde 400 con el motivo.
 * El tope es 99: un 100% de descuento deja el cobro en 0 y no hay pago posible.
 */
const porcentajeSchema = z
  .number({ message: 'El porcentaje debe ser un número' })
  .min(0, 'El porcentaje no puede ser negativo')
  .max(99, 'El porcentaje debe ser menor que 100');

/**
 * Alta de vendedor.
 *
 * Antes sólo se comprobaba que los campos fueran truthy: entraban contraseñas
 * de un carácter (cuando el registro y el reset exigen 8 + mayúscula + número),
 * emails como "juan@" a los que nunca llegaría la recuperación de contraseña, y
 * códigos que el propio endpoint del vendedor rechazaría. Un email no-string
 * reventaba en `.toLowerCase()` y devolvía 500 en vez de 400.
 */
const esquemaAltaVendedor = z.object({
  nombre: z.string().trim().min(1, 'El nombre es requerido').max(100),
  apellidoPaterno: z.string().trim().min(1, 'El apellido paterno es requerido').max(100),
  apellidoMaterno: z.string().trim().max(100).optional().nullable(),
  email: z.string().trim().email('Email inválido').max(200),
  password: passwordRegistroSchema,
  // Mismo formato que exige /api/vendor/my-code: 4-20 alfanuméricos.
  code: z
    .string()
    .trim()
    .regex(/^[a-zA-Z0-9]{4,20}$/, 'El código debe tener entre 4 y 20 letras o números'),
  discountPercent: porcentajeSchema.default(10),
  commissionPercent: porcentajeSchema.default(10)
  // PAGO-014: el modal ya no pide teléfono (User no tiene esa columna y se
  // perdía en silencio). Si un cliente antiguo lo manda, zod lo descarta.
});

// GET - Listar todos los vendedores con sus códigos
export async function GET(request: NextRequest) {
  try {
    // Defense-in-depth: verificar rol además del middleware
    const roleCheck = await requireRole('admin');
    if ('error' in roleCheck) {
      return NextResponse.json(
        { success: false, error: roleCheck.error },
        { status: roleCheck.status }
      );
    }

    // VALIDACIÓN (#PAGO): `parseInt` directo dejaba pasar limit=abc (NaN ->
    // PrismaClientValidationError -> 500), page=0 (skip negativo -> 500) y
    // limit=100000000 (paginación anulada). El helper acota a [1, 100].
    const { searchParams } = new URL(request.url);
    const { page, limit, skip } = getPaginationParams(searchParams, 20);
    const search = searchParams.get('search') || '';

    // Construir filtros
    const whereClause: Record<string, unknown> = {};
    if (search) {
      whereClause.OR = [
        { code: { contains: search, mode: 'insensitive' } },
        { user: { nombre: { contains: search, mode: 'insensitive' } } },
        { user: { email: { contains: search, mode: 'insensitive' } } }
      ];
    }

    // Obtener códigos con estadísticas
    const [codes, totalCount] = await Promise.all([
      prisma.discountCode.findMany({
        where: whereClause,
        include: {
          user: {
            select: {
              id: true,
              nombre: true,
              apellidoPaterno: true,
              apellidoMaterno: true,
              email: true,
              role: true
            }
          },
          uses: {
            // DINERO (#PAGO): sólo cuentan las comisiones de compras pagadas.
            // DiscountCodeUse se crea antes de saber si MercadoPago aprueba el
            // pago, así que sin este filtro las ventas rechazadas inflaban las
            // estadísticas del vendedor.
            where: { purchase: { paymentStatus: 'paid' } },
            select: {
              id: true,
              finalPrice: true,
              commissionAmount: true,
              commissionStatus: true
            }
          }
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit
      }),
      prisma.discountCode.count({ where: whereClause })
    ]);

    // Formatear respuesta con estadísticas
    const vendors = codes.map(code => {
      const totalSales = code.uses.length;
      const totalRevenue = code.uses.reduce((sum, use) => sum + use.finalPrice, 0);
      const totalCommission = code.uses.reduce((sum, use) => sum + use.commissionAmount, 0);
      const pendingCommission = code.uses
        .filter(use => use.commissionStatus === 'pending')
        .reduce((sum, use) => sum + use.commissionAmount, 0);
      const paidCommission = code.uses
        .filter(use => use.commissionStatus === 'paid')
        .reduce((sum, use) => sum + use.commissionAmount, 0);

      return {
        id: code.id,
        code: code.code,
        discountPercent: code.discountPercent,
        commissionPercent: code.commissionPercent,
        isActive: code.isActive,
        createdAt: code.createdAt,
        user: {
          id: code.user.id,
          nombre: `${code.user.nombre} ${code.user.apellidoPaterno || ''} ${code.user.apellidoMaterno || ''}`.trim(),
          email: code.user.email,
          role: code.user.role
        },
        stats: {
          totalSales,
          totalRevenue,
          totalCommission,
          pendingCommission,
          paidCommission
        }
      };
    });

    // Estadísticas globales
    const globalStats = await prisma.discountCodeUse.aggregate({
      where: { purchase: { paymentStatus: 'paid' } },
      _sum: {
        finalPrice: true,
        commissionAmount: true
      },
      _count: true
    });

    const pendingGlobal = await prisma.discountCodeUse.aggregate({
      where: { commissionStatus: 'pending', purchase: { paymentStatus: 'paid' } },
      _sum: { commissionAmount: true }
    });

    // CORRECCIÓN (#PAGO): `totalVendors` reutilizaba `totalCount`, que lleva el
    // filtro de búsqueda. Al buscar "maria" la tarjeta "Vendedores" bajaba a 1
    // mientras Ventas e Ingresos seguían siendo los de los 40 vendedores. La
    // estadística global se cuenta sin filtro; `totalCount` queda para la
    // paginación de los resultados.
    const totalVendors = await prisma.discountCode.count();

    return NextResponse.json({
      success: true,
      data: {
        vendors,
        globalStats: {
          totalVendors,
          totalSales: globalStats._count,
          totalRevenue: globalStats._sum.finalPrice || 0,
          totalCommissions: globalStats._sum.commissionAmount || 0,
          pendingCommissions: pendingGlobal._sum.commissionAmount || 0
        },
        pagination: {
          page,
          limit,
          totalCount,
          totalPages: Math.ceil(totalCount / limit)
        }
      }
    });
  } catch (error) {
    console.error('Error getting vendors:', error);
    return NextResponse.json(
      { success: false, error: 'Error al obtener vendedores' },
      { status: 500 }
    );
  }
}

// POST - Crear nuevo vendedor (User + DiscountCode)
export async function POST(request: NextRequest) {
  try {
    // Defense-in-depth: verificar rol además del middleware
    const roleCheck = await requireRole('admin');
    if ('error' in roleCheck) {
      return NextResponse.json(
        { success: false, error: roleCheck.error },
        { status: roleCheck.status }
      );
    }

    const parsed = esquemaAltaVendedor.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          error: parsed.error.issues[0]?.message || 'Datos inválidos',
          detalle: parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`)
        },
        { status: 400 }
      );
    }

    const {
      nombre,
      apellidoPaterno,
      apellidoMaterno,
      email,
      password,
      code,
      discountPercent,
      commissionPercent
    } = parsed.data;

    const emailNormalizado = email.toLowerCase().trim();
    const codigoNormalizado = code.toUpperCase().trim();

    // Verificar que no exista un User con ese email
    const existingUser = await prisma.user.findUnique({
      where: { email: emailNormalizado }
    });

    if (existingUser) {
      return NextResponse.json(
        { success: false, error: 'Ya existe un usuario con ese email' },
        { status: 409 }
      );
    }

    // Verificar que no exista un DiscountCode con ese code
    const existingCode = await prisma.discountCode.findUnique({
      where: { code: codigoNormalizado }
    });

    if (existingCode) {
      return NextResponse.json(
        { success: false, error: 'Ya existe un código de descuento con ese nombre' },
        { status: 409 }
      );
    }

    // Hash de la contraseña
    const hashedPassword = await bcrypt.hash(password, 10);

    // INTEGRIDAD (#PAGO): el usuario y su código se crean en UNA transacción.
    //
    // Antes eran dos inserts sueltos y la unicidad del código se comprobaba con
    // un findUnique previo (check-then-act). Si el segundo insert fallaba —una
    // carrera con otro alta, un corte de conexión— quedaba un User con rol
    // 'vendor' SIN código: no aparecía en /admin/vendors (que lista códigos), no
    // se podía corregir, y el reintento chocaba con 409 "ya existe ese email".
    let creado;
    try {
      creado = await prisma.$transaction(async (tx) => {
        const newUser = await tx.user.create({
          data: {
            nombre: nombre.trim(),
            apellidoPaterno: apellidoPaterno.trim(),
            apellidoMaterno: apellidoMaterno?.trim() || null,
            email: emailNormalizado,
            password: hashedPassword,
            role: 'vendor',
            isActive: true,
          }
        });

        const newCode = await tx.discountCode.create({
          data: {
            code: codigoNormalizado,
            userId: newUser.id,
            discountPercent,
            commissionPercent,
            isActive: true,
          }
        });

        return { newUser, newCode };
      });
    } catch (error) {
      // La carrera que el findUnique no puede cerrar: el índice único sí.
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        const objetivo = String(error.meta?.target ?? '');
        const mensaje = objetivo.includes('email')
          ? 'Ya existe un usuario con ese email'
          : 'Ya existe un código de descuento con ese nombre';
        return NextResponse.json({ success: false, error: mensaje }, { status: 409 });
      }
      throw error;
    }

    const { newUser, newCode } = creado;

    return NextResponse.json(
      {
        success: true,
        data: {
          user: {
            id: newUser.id,
            nombre: `${newUser.nombre} ${newUser.apellidoPaterno}`.trim(),
            email: newUser.email,
            role: newUser.role
          },
          code: {
            id: newCode.id,
            code: newCode.code,
            discountPercent: newCode.discountPercent,
            commissionPercent: newCode.commissionPercent
          }
        },
        message: `Vendedor ${newUser.nombre} creado con código ${newCode.code}`
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Error creating vendor:', error);
    return NextResponse.json(
      { success: false, error: 'Error al crear vendedor' },
      { status: 500 }
    );
  }
}
