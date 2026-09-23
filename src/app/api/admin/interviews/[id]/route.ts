import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { isSafeHttpUrl } from '@/lib/sanitize';
import { createNotification, runAfterResponse } from '@/lib/notifications';
import type { NotificationType } from '@/lib/notifications';
import { sendInterviewUpdate } from '@/lib/email';
import { absoluteUrl } from '@/lib/site-url';

/** Fecha legible para el aviso a la empresa (hora de la Ciudad de México). */
function formatearFecha(fecha: Date): string {
  return fecha.toLocaleString('es-MX', {
    timeZone: 'America/Mexico_City',
    dateStyle: 'long',
    timeStyle: 'short',
  });
}

/**
 * Decide si el cambio merece aviso a la empresa y con qué texto:
 * confirmación, reprogramación de una ya confirmada, cancelación o rechazo.
 * Editar sólo notas internas o el tema no genera aviso.
 */
/** Participantes que la empresa añadió a la solicitud (JSON [{nombre, email}]). */
function leerParticipantes(json: string | null): Array<{ nombre: string | null; email: string }> {
  if (!json) return [];
  try {
    const lista: unknown = JSON.parse(json);
    if (!Array.isArray(lista)) return [];
    return lista
      .filter(
        (p): p is { nombre?: unknown; email: string } =>
          typeof p === 'object' && p !== null && typeof (p as { email?: unknown }).email === 'string'
      )
      .map((p) => ({
        nombre: typeof p.nombre === 'string' ? p.nombre : null,
        email: p.email.trim(),
      }))
      .filter((p) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(p.email))
      .slice(0, 10);
  } catch {
    return [];
  }
}

function avisoParaEmpresa(
  anterior: { status: string; scheduledStart: Date | null },
  nuevoStatus: string | undefined,
  nuevoInicio: Date | null | undefined,
  nuevoFin: Date | null | undefined,
  entrevista: {
    scheduledStart: Date | null;
    application: { candidateName: string; job: { title: string } };
  }
): { tipo: NotificationType; titulo: string; mensaje: string } | null {
  const candidato = entrevista.application.candidateName;
  const vacante = entrevista.application.job.title;
  const statusFinal = nuevoStatus ?? anterior.status;
  const cuando = entrevista.scheduledStart ? ` para el ${formatearFecha(entrevista.scheduledStart)}` : '';

  if (statusFinal === 'confirmed' && anterior.status !== 'confirmed') {
    return {
      tipo: 'interview_confirmed',
      titulo: 'Entrevista confirmada',
      mensaje: `La entrevista con ${candidato} para "${vacante}" quedó agendada${cuando}.`,
    };
  }
  if (statusFinal === 'confirmed' && (nuevoInicio !== undefined || nuevoFin !== undefined)) {
    const antes = anterior.scheduledStart?.getTime() ?? null;
    const ahora = entrevista.scheduledStart?.getTime() ?? null;
    if (antes === ahora) return null;
    return {
      tipo: 'interview_rescheduled',
      titulo: 'Entrevista reprogramada',
      mensaje: `La entrevista con ${candidato} para "${vacante}" cambió de horario${cuando}.`,
    };
  }
  if ((statusFinal === 'cancelled' || statusFinal === 'rejected') && anterior.status !== statusFinal) {
    return {
      // Un rechazo de la solicitud también la da por cerrada: mismo icono.
      tipo: 'interview_cancelled',
      titulo: statusFinal === 'cancelled' ? 'Entrevista cancelada' : 'Solicitud de entrevista rechazada',
      mensaje: `La solicitud de entrevista con ${candidato} para "${vacante}" fue ${
        statusFinal === 'cancelled' ? 'cancelada' : 'rechazada'
      }. Revisa los detalles en tu panel.`,
    };
  }
  return null;
}

/**
 * Estados de Application desde los que tiene sentido pasar a 'interviewed'.
 * Confirmar una entrevista no debe pisar una aplicación ya aceptada o rechazada.
 */
const ESTADOS_PROMOVIBLES_A_ENTREVISTA = [
  'pending',
  'injected_by_admin',
  'reviewing',
  'sent_to_specialist',
  'evaluating',
  'sent_to_company',
  'company_interested',
  'interviewed',
];

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
      return NextResponse.json({ success: false, error: auth.error }, { status: auth.status });
    }

    const { id } = await params;

    const interviewId = parseInt(id, 10);
    if (isNaN(interviewId)) {
      return NextResponse.json({ success: false, error: 'ID inválido' }, { status: 400 });
    }

    const interview = await prisma.interviewRequest.findUnique({
      where: { id: interviewId },
      include: interviewInclude,
    });

    if (!interview) {
      return NextResponse.json(
        { success: false, error: 'Solicitud de entrevista no encontrada' },
        { status: 404 }
      );
    }

    // Mismo contrato que el resto de /api/admin/*: `data` además de `interview`
    // (que se conserva por compatibilidad con la UI actual).
    return NextResponse.json({ success: true, data: interview, interview });
  } catch (error) {
    console.error('Error fetching interview request:', error);
    return NextResponse.json(
      { success: false, error: 'Error al obtener solicitud de entrevista' },
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
      return NextResponse.json({ success: false, error: auth.error }, { status: auth.status });
    }

    const { id } = await params;
    const body = await request.json();

    const interviewId = parseInt(id, 10);
    if (isNaN(interviewId)) {
      return NextResponse.json({ success: false, error: 'ID inválido' }, { status: 400 });
    }

    const existing = await prisma.interviewRequest.findUnique({
      where: { id: interviewId },
    });

    if (!existing) {
      return NextResponse.json(
        { success: false, error: 'Solicitud de entrevista no encontrada' },
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

    // #33: validar el enum de status y que las fechas sean válidas (antes se
    // aceptaba cualquier string y `new Date('basura')` guardaba Invalid Date).
    const VALID_STATUSES = ['pending', 'confirmed', 'rejected', 'cancelled'];
    if (status !== undefined && !VALID_STATUSES.includes(status)) {
      return NextResponse.json(
        { success: false, error: `Status inválido. Valores permitidos: ${VALID_STATUSES.join(', ')}` },
        { status: 400 }
      );
    }

    // Campos de texto: sin tipar, un array o un objeto llegaba a Prisma y
    // respondía 500 en vez de 400.
    const CAMPOS_TEXTO: Array<[string, unknown, number]> = [
      ['topic', topic, 200],
      ['location', location, 300],
      ['confirmedSlot', confirmedSlot, 200],
      ['participants', participants, 2000],
      ['adminNotes', adminNotes, 2000],
    ];
    for (const [nombre, valor, maximo] of CAMPOS_TEXTO) {
      if (valor === undefined || valor === null) continue;
      if (typeof valor !== 'string') {
        return NextResponse.json(
          { success: false, error: `${nombre} debe ser texto` },
          { status: 400 }
        );
      }
      if (valor.length > maximo) {
        return NextResponse.json(
          { success: false, error: `${nombre} no puede superar ${maximo} caracteres` },
          { status: 400 }
        );
      }
    }

    // La liga de la videollamada se renderiza como href en /company/interviews y
    // en el panel admin: sin protocolo, el navegador la resuelve como ruta
    // relativa (/company/meet.google.com/...) y da 404 a la hora de la entrevista.
    if (meetingUrl !== undefined && meetingUrl !== null && meetingUrl !== '') {
      if (!isSafeHttpUrl(meetingUrl)) {
        return NextResponse.json(
          { success: false, error: 'La liga de la videollamada debe empezar por http:// o https://' },
          { status: 400 }
        );
      }
    }

    /**
     * `null` y `''` significan «sin fecha», no una fecha inválida.
     *
     * Antes se pasaban directos a `new Date()`: `new Date(null)` da
     * 1970-01-01T00:00:00Z, que NO es NaN, así que la comprobación la daba por
     * buena y se guardaba 1970 como hora de la entrevista. Cancelar una
     * solicitud que aún no tenía horario escribía esa fecha en la base.
     */
    const parseValidDate = (value: unknown): Date | null | undefined => {
      if (value === null || value === '') return null;
      const d = new Date(value as string);
      return Number.isNaN(d.getTime()) ? undefined : d;
    };

    let parsedStart: Date | null | undefined;
    let parsedEnd: Date | null | undefined;
    if (scheduledStart !== undefined) {
      const d = parseValidDate(scheduledStart);
      if (d === undefined) {
        return NextResponse.json(
          { success: false, error: 'scheduledStart no es una fecha válida' },
          { status: 400 }
        );
      }
      parsedStart = d;
    }
    if (scheduledEnd !== undefined) {
      const d = parseValidDate(scheduledEnd);
      if (d === undefined) {
        return NextResponse.json(
          { success: false, error: 'scheduledEnd no es una fecha válida' },
          { status: 400 }
        );
      }
      parsedEnd = d;
    }
    if (parsedStart && parsedEnd && parsedStart >= parsedEnd) {
      return NextResponse.json(
        { success: false, error: 'scheduledStart debe ser anterior a scheduledEnd' },
        { status: 400 }
      );
    }

    // Build the update data with only the fields that were provided
    const updateData: Record<string, unknown> = {};
    if (status !== undefined) updateData.status = status;
    if (topic !== undefined) updateData.topic = topic;
    if (parsedStart !== undefined) updateData.scheduledStart = parsedStart;
    if (parsedEnd !== undefined) updateData.scheduledEnd = parsedEnd;
    if (location !== undefined) updateData.location = location;
    if (meetingUrl !== undefined) updateData.meetingUrl = meetingUrl;
    if (confirmedSlot !== undefined) updateData.confirmedSlot = confirmedSlot;
    if (participants !== undefined) updateData.participants = participants;
    if (adminNotes !== undefined) updateData.adminNotes = adminNotes;

    // Handle status-specific logic
    // Se usan las fechas YA PARSEADAS (no los valores crudos del body): mandar
    // scheduledStart: null junto a status 'confirmed' pasaba la comprobación
    // mirando la fecha antigua y a la vez borraba la fecha de la entrevista.
    const promueveAplicacion = status === 'confirmed' && existing.status !== 'confirmed';
    if (status === 'confirmed') {
      const start = parsedStart !== undefined ? parsedStart : existing.scheduledStart;
      const end = parsedEnd !== undefined ? parsedEnd : existing.scheduledEnd;

      if (!start || !end) {
        return NextResponse.json(
          { success: false, error: 'Se requiere scheduledStart y scheduledEnd para confirmar la entrevista' },
          { status: 400 }
        );
      }

      if (start >= end) {
        return NextResponse.json(
          { success: false, error: 'scheduledStart debe ser anterior a scheduledEnd' },
          { status: 400 }
        );
      }

      // No se agendan entrevistas en el pasado: los slots propuestos caducan y
      // la entrevista aparecía directamente en "Pasadas" / "Realizada".
      if (start.getTime() < Date.now()) {
        return NextResponse.json(
          { success: false, error: 'No se puede confirmar una entrevista con fecha pasada' },
          { status: 400 }
        );
      }

      updateData.confirmedAt = new Date();
      updateData.confirmedById = auth.user.id;
    }

    // For 'cancelled' status, we intentionally do NOT update the Application status

    // Ambos updates en la misma transacción: antes la Application podía quedar
    // en 'interviewed' aunque el update de la entrevista fallara después.
    const interview = await prisma.$transaction(async (tx) => {
      if (promueveAplicacion) {
        // Sólo se promueve desde un estado que lo admita: si la empresa ya la
        // aceptó o rechazó, confirmar la entrevista no debe pisar ese estado.
        await tx.application.updateMany({
          where: {
            id: existing.applicationId,
            status: { in: ESTADOS_PROMOVIBLES_A_ENTREVISTA },
          },
          data: { status: 'interviewed' },
        });
      }

      return tx.interviewRequest.update({
        where: { id: interviewId },
        data: updateData,
        include: interviewInclude,
      });
    });

    // Avisar a la empresa que la pidió: antes el PATCH sólo tocaba la base y la
    // empresa se enteraba (si acaso) entrando por su cuenta a /company/interviews.
    // Se completa después de responder, sin perderse en serverless, y un fallo
    // del aviso nunca convierte en error un cambio que ya se guardó.
    await runAfterResponse('ADMIN_INTERVIEW:notify', async () => {
      const aviso = avisoParaEmpresa(existing, status, parsedStart, parsedEnd, interview);
      if (!aviso) return;
      await createNotification({
        userId: existing.requestedById,
        type: aviso.tipo,
        title: aviso.titulo,
        message: aviso.mensaje,
        link: '/company/interviews',
        metadata: { interviewRequestId: interview.id, applicationId: existing.applicationId },
      });

      // ADM-041/ADM-042: los correos. A la empresa, siempre que haya aviso. Al
      // candidato y a los participantes sólo si la entrevista está (o estaba)
      // agendada: el rechazo de una solicitud que nunca se confirmó no les
      // concierne, porque nunca se les dijo nada.
      const fecha = interview.scheduledStart ? formatearFecha(interview.scheduledStart) : null;
      const lugar = interview.type === 'presential' ? interview.location : null;
      const liga = interview.type === 'presential' ? null : interview.meetingUrl;
      const vacante = interview.application.job.title;
      const envios: Array<Promise<boolean>> = [];

      if (interview.requestedBy.email) {
        envios.push(
          sendInterviewUpdate({
            to: interview.requestedBy.email,
            nombreDestinatario:
              interview.requestedBy.companyRequest?.nombreEmpresa ?? interview.requestedBy.nombre,
            titulo: aviso.titulo,
            mensaje: aviso.mensaje,
            fecha,
            lugar,
            liga,
            panelUrl: absoluteUrl('/company/interviews'),
          })
        );
      }

      const involucraAlCandidato =
        aviso.tipo !== 'interview_cancelled' || existing.status === 'confirmed';
      if (involucraAlCandidato) {
        const mensajeExterno =
          aviso.tipo === 'interview_confirmed'
            ? `Tu entrevista para la vacante "${vacante}" quedó agendada.`
            : aviso.tipo === 'interview_rescheduled'
              ? `Tu entrevista para la vacante "${vacante}" cambió de horario.`
              : `Tu entrevista para la vacante "${vacante}" fue cancelada.`;

        if (interview.application.candidateEmail) {
          envios.push(
            sendInterviewUpdate({
              to: interview.application.candidateEmail,
              nombreDestinatario: interview.application.candidateName,
              titulo: aviso.titulo,
              mensaje: mensajeExterno,
              fecha: aviso.tipo === 'interview_cancelled' ? null : fecha,
              lugar: aviso.tipo === 'interview_cancelled' ? null : lugar,
              liga: aviso.tipo === 'interview_cancelled' ? null : liga,
            })
          );
        }

        for (const participante of leerParticipantes(interview.participants)) {
          envios.push(
            sendInterviewUpdate({
              to: participante.email,
              nombreDestinatario: participante.nombre,
              titulo: aviso.titulo,
              mensaje: `La entrevista con ${interview.application.candidateName} para "${vacante}" ${
                aviso.tipo === 'interview_confirmed'
                  ? 'quedó agendada'
                  : aviso.tipo === 'interview_rescheduled'
                    ? 'cambió de horario'
                    : 'fue cancelada'
              }.`,
              fecha: aviso.tipo === 'interview_cancelled' ? null : fecha,
              lugar: aviso.tipo === 'interview_cancelled' ? null : lugar,
              liga: aviso.tipo === 'interview_cancelled' ? null : liga,
            })
          );
        }
      }

      await Promise.allSettled(envios);
    });
    return NextResponse.json({ success: true, data: interview, interview });
  } catch (error) {
    console.error('Error updating interview request:', error);
    return NextResponse.json(
      { success: false, error: 'Error al actualizar solicitud de entrevista' },
      { status: 500 }
    );
  }
}
