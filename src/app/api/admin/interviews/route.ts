import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET(request: NextRequest) {
  try {
    const auth = await requireRole('admin');
    if ('error' in auth) {
      return NextResponse.json({ success: false, error: auth.error }, { status: auth.status });
    }

    const { searchParams } = request.nextUrl;
    const status = searchParams.get('status');

    // `parseInt('abc')` da NaN y `Math.max(1, NaN)` sigue siendo NaN: el skip
    // quedaba en NaN y Prisma respondía 500. Ahora se rechaza con 400.
    const rawPage = searchParams.get('page');
    const rawLimit = searchParams.get('limit');
    const page = rawPage === null ? 1 : Number(rawPage);
    const limitPedido = rawLimit === null ? 20 : Number(rawLimit);

    if (!Number.isInteger(page) || page < 1) {
      return NextResponse.json(
        { success: false, error: 'El parámetro page debe ser un entero positivo' },
        { status: 400 }
      );
    }
    if (!Number.isInteger(limitPedido) || limitPedido < 1) {
      return NextResponse.json(
        { success: false, error: 'El parámetro limit debe ser un entero positivo' },
        { status: 400 }
      );
    }

    const limit = Math.min(100, limitPedido);
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = {};
    if (status) {
      // Se admite lista separada por comas para que la UI pueda pedir una
      // pestaña completa en servidor en lugar de repartir 20 filas en cliente.
      const estados = status.split(',').map((s) => s.trim()).filter(Boolean);
      where.status = estados.length > 1 ? { in: estados } : estados[0];
    }

    const [interviews, total, countsByStatus] = await Promise.all([
      prisma.interviewRequest.findMany({
        where,
        include: {
          application: {
            select: {
              id: true,
              candidateName: true,
              candidateEmail: true,
              candidatePhone: true,
              status: true,
              job: {
                select: {
                  id: true,
                  title: true,
                  company: true,
                },
              },
            },
          },
          requestedBy: {
            select: {
              nombre: true,
              apellidoPaterno: true,
              email: true,
              companyRequest: {
                select: {
                  nombreEmpresa: true,
                },
              },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.interviewRequest.count({ where }),
      // Conteos GLOBALES por estado: las pestañas los calculaban sobre las 20
      // filas cargadas, así que una pendiente antigua no se contaba ni se veía.
      prisma.interviewRequest.groupBy({
        by: ['status'],
        _count: { _all: true },
      }),
    ]);

    const counts = Object.fromEntries(
      (countsByStatus as Array<{ status: string; _count: { _all: number } }>).map((fila) => [
        fila.status,
        fila._count._all,
      ])
    );

    return NextResponse.json({
      success: true,
      data: interviews,
      counts,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('Error fetching interview requests:', error);
    return NextResponse.json(
      { success: false, error: 'Error al obtener solicitudes de entrevista' },
      { status: 500 }
    );
  }
}
