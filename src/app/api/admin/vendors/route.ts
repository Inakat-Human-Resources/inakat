// RUTA: src/app/api/admin/vendors/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import bcrypt from 'bcryptjs';

// Helper para obtener info de usuario de los headers (agregados por middleware)
function getAuthFromHeaders(request: NextRequest): { userId: number; role: string } | null {
  const userId = request.headers.get('x-user-id');
  const role = request.headers.get('x-user-role');
  if (!userId || !role) return null;
  return { userId: parseInt(userId), role };
}

// GET - Listar todos los vendedores con sus códigos
export async function GET(request: NextRequest) {
  try {
    const auth = getAuthFromHeaders(request);
    if (!auth || auth.role !== 'admin') {
      return NextResponse.json(
        { success: false, error: 'No autorizado' },
        { status: 401 }
      );
    }

    // Obtener parámetros
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const search = searchParams.get('search') || '';
    const skip = (page - 1) * limit;

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
      _sum: {
        finalPrice: true,
        commissionAmount: true
      },
      _count: true
    });

    const pendingGlobal = await prisma.discountCodeUse.aggregate({
      where: { commissionStatus: 'pending' },
      _sum: { commissionAmount: true }
    });

    return NextResponse.json({
      success: true,
      data: {
        vendors,
        globalStats: {
          totalVendors: totalCount,
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
    const auth = getAuthFromHeaders(request);
    if (!auth || auth.role !== 'admin') {
      return NextResponse.json(
        { success: false, error: 'No autorizado' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const {
      nombre,
      apellidoPaterno,
      apellidoMaterno,
      email,
      telefono,
      password,
      code,
      discountPercent = 10,
      commissionPercent = 10
    } = body;

    // Validar campos requeridos
    if (!nombre || !apellidoPaterno || !email || !password || !code) {
      return NextResponse.json(
        { success: false, error: 'Nombre, apellido paterno, email, contraseña y código son requeridos' },
        { status: 400 }
      );
    }

    // Verificar que no exista un User con ese email
    const existingUser = await prisma.user.findUnique({
      where: { email: email.toLowerCase().trim() }
    });

    if (existingUser) {
      return NextResponse.json(
        { success: false, error: 'Ya existe un usuario con ese email' },
        { status: 409 }
      );
    }

    // Verificar que no exista un DiscountCode con ese code
    const existingCode = await prisma.discountCode.findUnique({
      where: { code: code.toUpperCase().trim() }
    });

    if (existingCode) {
      return NextResponse.json(
        { success: false, error: 'Ya existe un código de descuento con ese nombre' },
        { status: 409 }
      );
    }

    // Hash de la contraseña
    const hashedPassword = await bcrypt.hash(password, 10);

    // Crear User con role 'vendor'
    const newUser = await prisma.user.create({
      data: {
        nombre: nombre.trim(),
        apellidoPaterno: apellidoPaterno.trim(),
        apellidoMaterno: apellidoMaterno?.trim() || null,
        email: email.toLowerCase().trim(),
        password: hashedPassword,
        role: 'vendor',
        isActive: true,
      }
    });

    // Crear DiscountCode vinculado al User
    const newCode = await prisma.discountCode.create({
      data: {
        code: code.toUpperCase().trim(),
        userId: newUser.id,
        discountPercent: parseFloat(String(discountPercent)) || 10,
        commissionPercent: parseFloat(String(commissionPercent)) || 10,
        isActive: true,
      }
    });

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
