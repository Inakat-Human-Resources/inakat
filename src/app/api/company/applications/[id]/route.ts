// RUTA: src/app/api/company/applications/[id]/route.ts

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { notifyAllAdmins } from '@/lib/notifications';

// Status válidos para que la empresa actualice
const COMPANY_ALLOWED_STATUSES = [
  'company_interested',  // Marcar como "Me interesa"
  'interviewed',         // Marcar como entrevistado
  'rejected',            // Descartar candidato
  'accepted'             // Aceptar candidato
];

/**
 * PATCH /api/company/applications/[id]
 * Permite a la empresa actualizar el status de un candidato
 * Solo puede cambiar de 'sent_to_company' o 'company_interested' a otro status
 */
export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    // Verificar autenticación y rol
    const userId = request.headers.get('x-user-id');
    const userRole = request.headers.get('x-user-role');

    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'No autenticado' },
        { status: 401 }
      );
    }

    if (userRole !== 'company') {
      return NextResponse.json(
        { success: false, error: 'Acceso denegado. Solo empresas pueden realizar esta acción.' },
        { status: 403 }
      );
    }

    const { id } = await context.params;
    const applicationId = parseInt(id);

    if (isNaN(applicationId)) {
      return NextResponse.json(
        { success: false, error: 'ID de aplicación inválido' },
        { status: 400 }
      );
    }

    const body = await request.json();
    const { status, notes, closeJob } = body;

    if (!status) {
      return NextResponse.json(
        { success: false, error: 'Status es requerido' },
        { status: 400 }
      );
    }

    // Validar que el status sea permitido para la empresa
    if (!COMPANY_ALLOWED_STATUSES.includes(status)) {
      return NextResponse.json(
        {
          success: false,
          error: `Status inválido. Debe ser uno de: ${COMPANY_ALLOWED_STATUSES.join(', ')}`
        },
        { status: 400 }
      );
    }

    // Verificar que la aplicación existe
    const application = await prisma.application.findUnique({
      where: { id: applicationId },
      include: {
        job: {
          select: {
            id: true,
            userId: true,
            title: true
          }
        }
      }
    });

    if (!application) {
      return NextResponse.json(
        { success: false, error: 'Aplicación no encontrada' },
        { status: 404 }
      );
    }

    // Verificar que la vacante pertenece a la empresa
    const companyUserId = parseInt(userId);
    if (application.job.userId !== companyUserId) {
      return NextResponse.json(
        { success: false, error: 'No tienes permiso para modificar esta aplicación' },
        { status: 403 }
      );
    }

    // Verificar que la aplicación está en un status que la empresa puede cambiar
    // FIX-03: Solo 'accepted' es estado final. 'rejected' ahora es recuperable.
    if (application.status === 'accepted') {
      return NextResponse.json(
        { success: false, error: 'Este candidato ya está en proceso de contratación y no puede ser modificado' },
        { status: 400 }
      );
    }

    // Solo puede modificar aplicaciones visibles para la empresa
    // FIX-03: Agregado 'rejected' para permitir recuperar candidatos descartados
    const COMPANY_MODIFIABLE_STATUSES = [
      'sent_to_company',
      'company_interested',
      'interviewed',
      'rejected'
    ];

    if (!COMPANY_MODIFIABLE_STATUSES.includes(application.status)) {
      return NextResponse.json(
        { success: false, error: 'No puedes modificar esta aplicación en su estado actual' },
        { status: 400 }
      );
    }

    // Validar transiciones de status válidas
    // Nota: Permitimos ir directo a 'accepted' desde cualquier estado visible
    // porque Eduardo pidió "En proceso de contratación" como opción directa
    // FIX-03: Agregadas transiciones desde 'rejected' para permitir recuperar candidatos
    const validTransitions: Record<string, string[]> = {
      'sent_to_company': ['company_interested', 'accepted', 'rejected'],
      'company_interested': ['interviewed', 'accepted', 'rejected'],
      'interviewed': ['accepted', 'rejected'],
      'rejected': ['company_interested', 'accepted']  // Recuperar o ir directo a contratación
    };

    const allowedNextStatuses = validTransitions[application.status] || [];
    if (!allowedNextStatuses.includes(status)) {
      return NextResponse.json(
        {
          success: false,
          error: `Transición inválida. Desde "${application.status}" solo puedes cambiar a: ${allowedNextStatuses.join(', ')}`
        },
        { status: 400 }
      );
    }

    // Actualizar la aplicación
    const updateData: { status: string; notes?: string; reviewedAt?: Date; updatedAt: Date } = {
      status,
      updatedAt: new Date()
    };

    if (notes !== undefined) {
      updateData.notes = notes;
    }

    // Si es una acción de revisión, marcar la fecha
    if (['company_interested', 'interviewed', 'rejected', 'accepted'].includes(status)) {
      updateData.reviewedAt = new Date();
    }

    const updatedApplication = await prisma.application.update({
      where: { id: applicationId },
      data: updateData,
      include: {
        job: {
          select: {
            id: true,
            title: true,
            company: true
          }
        }
      }
    });

    // Si es 'accepted' y closeJob es true, cerrar la vacante
    let jobClosed = false;
    if (status === 'accepted' && closeJob === true) {
      await prisma.job.update({
        where: { id: application.job.id },
        data: { status: 'closed', closedReason: 'success' }
      });
      jobClosed = true;
    }

    // Notificar a admins sobre la decisión de la empresa (fire-and-forget)
    const statusLabels: Record<string, string> = {
      company_interested: 'marcó como interesado',
      interviewed: 'marcó como entrevistado',
      rejected: 'descartó',
      accepted: 'aceptó para contratación',
    };
    notifyAllAdmins({
      type: 'application_status',
      title: `Empresa actualizó candidato`,
      message: `La empresa ${statusLabels[status] || 'actualizó'} a ${updatedApplication.candidateName} en "${updatedApplication.job.title}".`,
      link: '/admin',
      metadata: { applicationId, status, jobId: updatedApplication.job.id },
    }).catch(() => {});

    // Mensaje de éxito según la acción
    const statusMessages: Record<string, string> = {
      company_interested: 'Candidato marcado como "Me interesa"',
      interviewed: 'Candidato marcado como entrevistado',
      rejected: 'Candidato descartado',
      accepted: jobClosed
        ? '¡Candidato en proceso de contratación! La vacante ha sido cerrada.'
        : 'Candidato en proceso de contratación'
    };

    return NextResponse.json({
      success: true,
      message: statusMessages[status] || 'Aplicación actualizada',
      data: updatedApplication,
      jobClosed
    });
  } catch (error) {
    console.error('Error updating application:', error);
    return NextResponse.json(
      { success: false, error: 'Error al actualizar la aplicación' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/company/applications/[id]
 * Obtiene los detalles de una aplicación específica para la empresa
 */
export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    // Verificar autenticación y rol
    const userId = request.headers.get('x-user-id');
    const userRole = request.headers.get('x-user-role');

    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'No autenticado' },
        { status: 401 }
      );
    }

    if (userRole !== 'company') {
      return NextResponse.json(
        { success: false, error: 'Acceso denegado. Solo empresas pueden realizar esta acción.' },
        { status: 403 }
      );
    }

    const { id } = await context.params;
    const applicationId = parseInt(id);

    if (isNaN(applicationId)) {
      return NextResponse.json(
        { success: false, error: 'ID de aplicación inválido' },
        { status: 400 }
      );
    }

    const application = await prisma.application.findUnique({
      where: { id: applicationId },
      include: {
        job: {
          select: {
            id: true,
            title: true,
            company: true,
            userId: true
          }
        }
      }
    });

    if (!application) {
      return NextResponse.json(
        { success: false, error: 'Aplicación no encontrada' },
        { status: 404 }
      );
    }

    // Verificar que la vacante pertenece a la empresa
    const companyUserId = parseInt(userId);
    if (application.job.userId !== companyUserId) {
      return NextResponse.json(
        { success: false, error: 'No tienes permiso para ver esta aplicación' },
        { status: 403 }
      );
    }

    // Verificar que la aplicación es visible para la empresa
    const COMPANY_VISIBLE_STATUSES = [
      'sent_to_company',
      'company_interested',
      'interviewed',
      'rejected',
      'accepted'
    ];

    if (!COMPANY_VISIBLE_STATUSES.includes(application.status)) {
      return NextResponse.json(
        { success: false, error: 'No tienes acceso a esta aplicación' },
        { status: 403 }
      );
    }

    // Enriquecer con datos del candidato si existe
    const candidate = await prisma.candidate.findFirst({
      where: { email: { equals: application.candidateEmail, mode: 'insensitive' } },
      include: {
        experiences: {
          orderBy: { fechaInicio: 'desc' },
          take: 5
        }
      }
    });

    // Obtener notas del JobAssignment
    const jobAssignment = await prisma.jobAssignment.findFirst({
      where: { jobId: application.jobId }
    });

    return NextResponse.json({
      success: true,
      data: {
        ...application,
        candidateProfile: candidate ? {
          id: candidate.id,
          nombre: candidate.nombre,
          apellidoPaterno: candidate.apellidoPaterno,
          apellidoMaterno: candidate.apellidoMaterno,
          email: candidate.email,
          telefono: candidate.telefono,
          sexo: candidate.sexo,
          fechaNacimiento: candidate.fechaNacimiento,
          universidad: candidate.universidad,
          carrera: candidate.carrera,
          nivelEstudios: candidate.nivelEstudios,
          añosExperiencia: candidate.añosExperiencia,
          profile: candidate.profile,
          seniority: candidate.seniority,
          experiencias: candidate.experiences,
          cvUrl: candidate.cvUrl,
          linkedinUrl: candidate.linkedinUrl,
          portafolioUrl: candidate.portafolioUrl,
          notas: candidate.notas,
          educacion: candidate.educacion // FEATURE: Educación múltiple
        } : null,
        recruiterNotes: jobAssignment?.recruiterNotes || null,
        specialistNotes: jobAssignment?.specialistNotes || null
      }
    });
  } catch (error) {
    console.error('Error fetching application:', error);
    return NextResponse.json(
      { success: false, error: 'Error al obtener la aplicación' },
      { status: 500 }
    );
  }
}
