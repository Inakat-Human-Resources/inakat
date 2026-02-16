// RUTA: src/app/api/company/interview-requests/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

/**
 * POST /api/company/interview-requests
 * Crear solicitud de entrevista (empresa)
 */
export async function POST(request: NextRequest) {
  try {
    const userId = request.headers.get('x-user-id');
    const userRole = request.headers.get('x-user-role');

    if (!userId || userRole !== 'company') {
      return NextResponse.json(
        { success: false, error: 'No autorizado' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { applicationId, type, duration, participants, availableSlots, message } = body;

    // Validaciones
    if (!applicationId || !type || !availableSlots) {
      return NextResponse.json(
        { success: false, error: 'applicationId, type y availableSlots son requeridos' },
        { status: 400 }
      );
    }

    if (!['videocall', 'presential'].includes(type)) {
      return NextResponse.json(
        { success: false, error: 'Tipo debe ser "videocall" o "presential"' },
        { status: 400 }
      );
    }

    if (!Array.isArray(availableSlots) || availableSlots.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Debes seleccionar al menos un horario' },
        { status: 400 }
      );
    }

    const parsedDuration = duration ? parseInt(duration) : 45;
    if (![30, 45, 60].includes(parsedDuration)) {
      return NextResponse.json(
        { success: false, error: 'Duración debe ser 30, 45 o 60 minutos' },
        { status: 400 }
      );
    }

    // Verificar que la application existe y pertenece a una vacante de la empresa
    const application = await prisma.application.findUnique({
      where: { id: parseInt(applicationId) },
      include: {
        job: { select: { id: true, userId: true, title: true } }
      }
    });

    if (!application) {
      return NextResponse.json(
        { success: false, error: 'Aplicación no encontrada' },
        { status: 404 }
      );
    }

    if (application.job.userId !== parseInt(userId)) {
      return NextResponse.json(
        { success: false, error: 'No tienes permiso sobre esta aplicación' },
        { status: 403 }
      );
    }

    // Verificar que no haya ya una solicitud pendiente
    const existingRequest = await prisma.interviewRequest.findFirst({
      where: {
        applicationId: parseInt(applicationId),
        status: 'pending'
      }
    });

    if (existingRequest) {
      return NextResponse.json(
        { success: false, error: 'Ya existe una solicitud de entrevista pendiente para este candidato' },
        { status: 409 }
      );
    }

    // Crear InterviewRequest
    const interviewRequest = await prisma.interviewRequest.create({
      data: {
        applicationId: parseInt(applicationId),
        requestedById: parseInt(userId),
        type,
        duration: parsedDuration,
        participants: participants ? JSON.stringify(participants) : null,
        availableSlots: JSON.stringify(availableSlots),
        message: message || null,
      }
    });

    // Cambiar status de la application a 'interviewed'
    await prisma.application.update({
      where: { id: parseInt(applicationId) },
      data: { status: 'interviewed' }
    });

    return NextResponse.json(
      {
        success: true,
        data: interviewRequest,
        message: `Solicitud de entrevista enviada para ${application.candidateName}`
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Error creando solicitud de entrevista:', error);
    return NextResponse.json(
      { success: false, error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/company/interview-requests
 * Listar solicitudes de entrevista de la empresa
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

    const interviewRequests = await prisma.interviewRequest.findMany({
      where: { requestedById: parseInt(userId) },
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
              select: { id: true, title: true, company: true }
            }
          }
        }
      }
    });

    return NextResponse.json({ success: true, data: interviewRequests });
  } catch (error) {
    console.error('Error listando solicitudes de entrevista:', error);
    return NextResponse.json(
      { success: false, error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
