import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

const interviewInclude = {
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
} as const;

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireRole('admin');
    if ('error' in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const { id } = await params;

    const interviewId = parseInt(id, 10);
    if (isNaN(interviewId)) {
      return NextResponse.json({ error: 'ID inválido' }, { status: 400 });
    }

    const interview = await prisma.interviewRequest.findUnique({
      where: { id: interviewId },
      include: interviewInclude,
    });

    if (!interview) {
      return NextResponse.json(
        { error: 'Solicitud de entrevista no encontrada' },
        { status: 404 }
      );
    }

    return NextResponse.json({ interview });
  } catch (error) {
    console.error('Error fetching interview request:', error);
    return NextResponse.json(
      { error: 'Error al obtener solicitud de entrevista' },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireRole('admin');
    if ('error' in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const { id } = await params;
    const body = await request.json();

    const interviewId = parseInt(id, 10);
    if (isNaN(interviewId)) {
      return NextResponse.json({ error: 'ID inválido' }, { status: 400 });
    }

    const existing = await prisma.interviewRequest.findUnique({
      where: { id: interviewId },
    });

    if (!existing) {
      return NextResponse.json(
        { error: 'Solicitud de entrevista no encontrada' },
        { status: 404 }
      );
    }

    const {
      status,
      topic,
      scheduledStart,
      scheduledEnd,
      location,
      meetingUrl,
      confirmedSlot,
      participants,
      adminNotes,
    } = body;

    // Build the update data with only the fields that were provided
    const updateData: Record<string, unknown> = {};
    if (status !== undefined) updateData.status = status;
    if (topic !== undefined) updateData.topic = topic;
    if (scheduledStart !== undefined) updateData.scheduledStart = new Date(scheduledStart);
    if (scheduledEnd !== undefined) updateData.scheduledEnd = new Date(scheduledEnd);
    if (location !== undefined) updateData.location = location;
    if (meetingUrl !== undefined) updateData.meetingUrl = meetingUrl;
    if (confirmedSlot !== undefined) updateData.confirmedSlot = confirmedSlot;
    if (participants !== undefined) updateData.participants = participants;
    if (adminNotes !== undefined) updateData.adminNotes = adminNotes;

    // Handle status-specific logic
    if (status === 'confirmed') {
      const start = scheduledStart || existing.scheduledStart;
      const end = scheduledEnd || existing.scheduledEnd;

      if (!start || !end) {
        return NextResponse.json(
          { error: 'Se requiere scheduledStart y scheduledEnd para confirmar la entrevista' },
          { status: 400 }
        );
      }

      updateData.confirmedAt = new Date();
      updateData.confirmedById = auth.user.id;

      // Update the related application status to 'interviewed'
      await prisma.application.update({
        where: { id: existing.applicationId },
        data: { status: 'interviewed' },
      });
    }

    // For 'cancelled' status, we intentionally do NOT update the Application status

    const interview = await prisma.interviewRequest.update({
      where: { id: interviewId },
      data: updateData,
      include: interviewInclude,
    });

    return NextResponse.json({ interview });
  } catch (error) {
    console.error('Error updating interview request:', error);
    return NextResponse.json(
      { error: 'Error al actualizar solicitud de entrevista' },
      { status: 500 }
    );
  }
}
