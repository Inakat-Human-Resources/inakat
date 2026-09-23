// RUTA: src/app/api/company/interview-requests/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { sendInterviewRequestToAdmin } from '@/lib/email';
import { sanitizeMultilineText } from '@/lib/sanitize';
import { notifyAllAdmins, runAfterResponse } from '@/lib/notifications';
import { canCompanySeeApplication } from '@/lib/authz-applications';
import { requireApprovedCompany } from '@/lib/auth';
import { validate } from '@/lib/validations';

/**
 * Body de la solicitud de entrevista.
 *
 * Antes sólo se comprobaba que `availableSlots` fuera un array no vacío: sus
 * elementos, su cantidad y el formato de fecha/hora no se miraban, `participants`
 * se serializaba tal cual (cualquier JSON, de cualquier tamaño, con correos sin
 * validar) y un `applicationId` no numérico daba NaN → prisma lanzaba → 500 en
 * vez de 400.
 */
const HOY_ISO = () => {
  const ahora = new Date();
  return `${ahora.getFullYear()}-${String(ahora.getMonth() + 1).padStart(2, '0')}-${String(
    ahora.getDate()
  ).padStart(2, '0')}`;
};

const slotSchema = z.object({
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Fecha inválida (formato AAAA-MM-DD)')
    .refine((d) => !Number.isNaN(Date.parse(`${d}T00:00:00`)), 'Fecha inexistente'),
  time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Hora inválida (formato HH:MM)')
});

const interviewRequestSchema = z.object({
  applicationId: z.coerce
    .number()
    .int('applicationId debe ser un entero')
    .positive('applicationId debe ser positivo'),
  type: z.enum(['videocall', 'presential'], {
    message: 'Tipo debe ser "videocall" o "presential"'
  }),
  duration: z.coerce
    .number()
    .int()
    .refine((d) => [30, 45, 60].includes(d), 'Duración debe ser 30, 45 o 60 minutos')
    .optional()
    .default(45),
  participants: z
    .preprocess(
      (v) => (v === null ? undefined : v),
      z
        .array(
          z.object({
            nombre: z.string().trim().min(1, 'Nombre requerido').max(100, 'Nombre muy largo'),
            email: z.string().trim().email('Email de participante inválido').max(254)
          })
        )
        .max(10, 'Máximo 10 participantes')
        .optional()
    )
    .optional(),
  availableSlots: z
    .array(slotSchema)
    .min(1, 'Debes seleccionar al menos un horario')
    .max(30, 'Máximo 30 horarios'),
  message: z
    .preprocess(
      (v) => (v === null ? undefined : v),
      z.string().max(2000, 'El mensaje no puede exceder 2000 caracteres').optional()
    )
    .optional()
});

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

    const companyUserId = parseInt(userId);

    // AUTORIZACIÓN: el alta de empresa es pública y crea la cuenta en el acto.
    // Sin esta comprobación, una empresa sin aprobar (o ya rechazada) podía
    // pedir entrevistas y con ello destapar los datos de contacto del candidato.
    const aprobacion = await requireApprovedCompany(companyUserId, userRole);
    if (aprobacion) {
      return NextResponse.json(
        { success: false, error: aprobacion.error, code: aprobacion.code },
        { status: aprobacion.status }
      );
    }

    const body = await request.json();

    const validation = validate(interviewRequestSchema, body);
    if (!validation.success) {
      return NextResponse.json(
        {
          success: false,
          error: validation.errors[0]?.message || 'Datos inválidos',
          errors: validation.errors
        },
        { status: 400 }
      );
    }

    const { applicationId, type, duration, participants, availableSlots, message } =
      validation.data;

    // Los horarios propuestos tienen que poder ocurrir: un slot en el pasado
    // sólo sirve para que caduque sin que nadie agende.
    const hoy = HOY_ISO();
    if (availableSlots.some((slot) => slot.date < hoy)) {
      return NextResponse.json(
        { success: false, error: 'No puedes proponer horarios en fechas pasadas' },
        { status: 400 }
      );
    }

    // Verificar que la application existe y pertenece a una vacante de la empresa
    const application = await prisma.application.findUnique({
      where: { id: applicationId },
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

    if (application.job.userId !== companyUserId) {
      return NextResponse.json(
        { success: false, error: 'No tienes permiso sobre esta aplicación' },
        { status: 403 }
      );
    }

    // AUTORIZACIÓN: el resto de rutas de empresa limita la visibilidad a
    // COMPANY_VISIBLE_STATUSES; ésta no lo hacía, y como la respuesta y el
    // listado devuelven nombre, correo y teléfono, bastaba con recorrer
    // applicationId=1..N para sacar los datos de postulantes que INAKAT todavía
    // no había enviado (justo el filtro que la empresa paga).
    if (!canCompanySeeApplication(application.status)) {
      return NextResponse.json(
        { success: false, error: 'Este candidato aún no ha sido enviado a tu empresa' },
        { status: 403 }
      );
    }

    // Crear InterviewRequest comprobando el duplicado DENTRO de la transacción:
    // con el findFirst suelto, dos clics seguidos creaban dos solicitudes.
    let interviewRequest;
    try {
      interviewRequest = await prisma.$transaction(async (tx) => {
        const existente = await tx.interviewRequest.findFirst({
          where: { applicationId, status: 'pending' },
          select: { id: true }
        });

        if (existente) {
          throw new Error('DUPLICATE_PENDING_REQUEST');
        }

        return tx.interviewRequest.create({
          data: {
            applicationId,
            requestedById: companyUserId,
            type,
            duration,
            participants: participants && participants.length > 0
              ? JSON.stringify(participants)
              : null,
            availableSlots: JSON.stringify(availableSlots),
            message: message ? sanitizeMultilineText(message) : null,
          }
        });
      });
    } catch (error) {
      if (error instanceof Error && error.message === 'DUPLICATE_PENDING_REQUEST') {
        return NextResponse.json(
          { success: false, error: 'Ya existe una solicitud de entrevista pendiente para este candidato' },
          { status: 409 }
        );
      }
      throw error;
    }

    // Ya NO cambiar status aquí — Admin decide cuándo mover a 'interviewed'
    // La application permanece en su status actual hasta que Admin confirme/agende

    // Notificar a admins sobre la solicitud de entrevista
    const adminUsers = await prisma.user.findMany({
      where: { role: 'admin', isActive: true },
      select: { email: true }
    });

    const companyRequest = await prisma.companyRequest.findFirst({
      where: { userId: companyUserId },
      select: { nombreEmpresa: true }
    });

    const companyName = companyRequest?.nombreEmpresa || 'Empresa';

    // FIABILIDAD: el bucle anterior lanzaba un SMTP por admin sin await y la
    // ruta respondía de inmediato, así que en serverless el envío se cortaba a
    // mitad del handshake. Tampoco había respaldo in-app: el tipo
    // 'interview_requested' estaba declarado y tenía icono en la campanita,
    // pero ningún código lo emitía. Ahora hay campanita SIEMPRE y el correo se
    // completa después de responder, sin perderse.
    await runAfterResponse('INTERVIEW_REQUEST:notify', () =>
      Promise.allSettled([
        notifyAllAdmins({
          type: 'interview_requested',
          title: 'Nueva solicitud de entrevista',
          message: `${companyName} solicitó entrevista con ${application.candidateName} para "${application.job.title}".`,
          link: '/admin/interviews',
          metadata: { interviewRequestId: interviewRequest.id, applicationId },
        }),
        ...adminUsers.map((admin) =>
          sendInterviewRequestToAdmin({
            adminEmail: admin.email,
            companyName,
            candidateName: application.candidateName,
            jobTitle: application.job.title,
            interviewType: type,
            adminUrl: `${process.env.NEXT_PUBLIC_APP_URL || 'https://inakat.com'}/admin/interviews`,
          })
        ),
      ]).then((resultados) => {
        const fallidos = resultados.filter((r) => r.status === 'rejected').length;
        if (fallidos > 0) {
          console.error(
            `[InterviewRequest] ${fallidos} avisos fallaron para la solicitud ${interviewRequest.id}`
          );
        }
      })
    );

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

    // PRIVACIDAD (#50/#51): el findMany no llevaba `select`, así que cada fila
    // viajaba entera a la empresa — incluido `adminNotes`, que el esquema
    // describe como «Notas internas del admin» y la UI rotula «solo admin».
    const interviewRequests = await prisma.interviewRequest.findMany({
      where: { requestedById: parseInt(userId) },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        applicationId: true,
        type: true,
        duration: true,
        participants: true,
        availableSlots: true,
        message: true,
        status: true,
        confirmedSlot: true,
        confirmedAt: true,
        topic: true,
        scheduledStart: true,
        scheduledEnd: true,
        location: true,
        meetingUrl: true,
        createdAt: true,
        updatedAt: true,
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
