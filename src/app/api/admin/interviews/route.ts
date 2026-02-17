import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

async function verifyAdmin() {
  const cookieStore = await cookies();
  const token = cookieStore.get('auth-token')?.value;
  if (!token) return { error: 'No autenticado', status: 401 };
  const payload = verifyToken(token);
  if (!payload?.userId) return { error: 'Token inválido', status: 401 };
  const user = await prisma.user.findUnique({ where: { id: payload.userId } });
  if (!user || user.role !== 'admin') return { error: 'Acceso denegado', status: 403 };
  return { user };
}

export async function GET(request: NextRequest) {
  try {
    const auth = await verifyAdmin();
    if ('error' in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const { searchParams } = request.nextUrl;
    const status = searchParams.get('status');
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const limit = Math.max(1, Math.min(100, parseInt(searchParams.get('limit') || '20', 10)));
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = {};
    if (status) {
      where.status = status;
    }

    const [interviews, total] = await Promise.all([
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
    ]);

    return NextResponse.json({
      interviews,
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
      { error: 'Error al obtener solicitudes de entrevista' },
      { status: 500 }
    );
  }
}
