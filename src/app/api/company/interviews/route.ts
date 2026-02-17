// RUTA: src/app/api/company/interviews/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

/**
 * GET /api/company/interviews
 * Listar entrevistas de la empresa autenticada
 */
export async function GET(request: NextRequest) {
  try {
    const userId = request.headers.get('x-user-id');
    const userRole = request.headers.get('x-user-role');

    if (!userId || userRole !== 'company') {
      return NextResponse.json(
        { success: false, error: 'No autorizado' },
        { status: 403 }
      );
    }

    const companyUserId = parseInt(userId);

    const interviewRequests = await prisma.interviewRequest.findMany({
      where: {
        application: {
          job: {
            userId: companyUserId,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
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
      },
    });

    // Parse JSON text fields for each interview request
    const data = interviewRequests.map((ir) => ({
      ...ir,
      participants: ir.participants ? JSON.parse(ir.participants) : null,
      availableSlots: JSON.parse(ir.availableSlots),
      confirmedSlot: ir.confirmedSlot ? JSON.parse(ir.confirmedSlot) : null,
    }));

    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error('Error listando entrevistas de la empresa:', error);
    return NextResponse.json(
      { success: false, error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
