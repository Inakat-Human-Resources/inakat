// RUTA: src/app/api/company-requests/[id]/route.ts

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { createNotification, runAfterResponse } from '@/lib/notifications';
import { validate, companyRequestUpdateSchema } from '@/lib/validations';
import { sendCompanyApproved, sendCompanyRejected } from '@/lib/email';
import { getAppUrl } from '@/lib/utils';

// PATCH - Update company request status
export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const requestId = parseInt(id);

    if (isNaN(requestId)) {
      return NextResponse.json(
        { success: false, error: 'ID de solicitud inválido' },
        { status: 400 }
      );
    }

    const body = await request.json();
    const { status, rejectionReason } = body;

    // Validate status
    if (!['pending', 'approved', 'rejected'].includes(status)) {
      return NextResponse.json(
        {
          success: false,
          error: 'Estado inválido. Debe ser: pending, approved o rejected'
        },
        { status: 400 }
      );
    }

    // Check if request exists
    const existingRequest = await prisma.companyRequest.findUnique({
      where: { id: requestId }
    });

    if (!existingRequest) {
      return NextResponse.json(
        { success: false, error: 'Solicitud no encontrada' },
        { status: 404 }
      );
    }

    // Update the request status.
    //
    // AUTORIZACIÓN: rechazar tenía efecto puramente decorativo — sólo cambiaba
    // el status y mandaba una notificación, mientras la cuenta seguía activa y
    // podía publicar vacantes y recibir datos de candidatos. Ahora la decisión
    // del admin se aplica sobre el User en la MISMA transacción: 'rejected'
    // desactiva la cuenta y 'approved' la reactiva. 'pending' también la
    // reactiva: es el estado con el que nace toda cuenta (activa, con funciones
    // limitadas), y si el admin reabría una solicitud rechazada la empresa se
    // quedaba sin poder entrar mientras se revisaba de nuevo.
    const updatedRequest = await prisma.$transaction(async (tx) => {
      const actualizada = await tx.companyRequest.update({
        where: { id: requestId },
        data: {
          status,
          rejectionReason: rejectionReason || null,
          approvedAt: status === 'approved' ? new Date() : null
        }
      });

      if (actualizada.userId) {
        await tx.user.update({
          where: { id: actualizada.userId },
          data: { isActive: status !== 'rejected' }
        });
      }

      return actualizada;
    });

    // Notificar a la empresa si tiene userId asociado.
    // FIABILIDAD: antes era `.catch(() => {})` sin await; en serverless la
    // instancia podía congelarse antes del INSERT y la empresa no se enteraba
    // por ningún canal (el catch vacío tampoco registraba el fallo).
    if (updatedRequest.userId && (status === 'approved' || status === 'rejected')) {
      const userIdEmpresa = updatedRequest.userId;
      const notifType = status === 'approved' ? 'request_approved' : 'request_rejected';
      const notifTitle = status === 'approved'
        ? '¡Tu empresa ha sido aprobada!'
        : 'Tu solicitud fue rechazada';
      const notifMessage = status === 'approved'
        ? 'Ya puedes publicar vacantes y acceder a todas las funciones.'
        : `Motivo: ${rejectionReason || 'No especificado'}. Contacta soporte para más información.`;

      await runAfterResponse('NOTIF:company-request-status', () =>
        createNotification({
          userId: userIdEmpresa,
          type: notifType,
          title: notifTitle,
          message: notifMessage,
          link: status === 'approved' ? '/company/dashboard' : undefined,
          metadata: { requestId: updatedRequest.id },
        })
      );
    }

    // Correo a la empresa. Hasta ahora sólo se creaba la notificación in-app,
    // así que la empresa que esperaba las "24-48 h" prometidas en la guía no se
    // enteraba de nada salvo que volviera a entrar por su cuenta; y al ser
    // rechazada, nunca conocía el motivo. Se espera el envío (Promise.allSettled,
    // como el webhook de MercadoPago) porque en serverless una promesa suelta se
    // pierde al congelarse la función, pero un fallo de SMTP no rompe el PATCH.
    if (status === 'approved' || status === 'rejected') {
      const envio =
        status === 'approved'
          ? sendCompanyApproved({
              email: updatedRequest.correoEmpresa,
              nombreEmpresa: updatedRequest.nombreEmpresa,
              loginUrl: `${getAppUrl(request.url)}/login`,
            })
          : sendCompanyRejected({
              email: updatedRequest.correoEmpresa,
              nombreEmpresa: updatedRequest.nombreEmpresa,
              motivo: rejectionReason || null,
            });

      const [resultado] = await Promise.allSettled([envio]);
      if (resultado.status === 'rejected' || resultado.value === false) {
        console.error(
          `[CompanyRequests] No se pudo enviar el correo de ${status} para la solicitud ${updatedRequest.id}`
        );
      }
    }

    // El User ya fue creado al momento del registro, solo actualizamos el status
    const statusMessages: Record<string, string> = {
      approved: 'Empresa aprobada exitosamente',
      rejected: 'Solicitud rechazada',
      pending: 'Solicitud marcada como pendiente'
    };

    return NextResponse.json(
      {
        success: true,
        message: statusMessages[status] || 'Estado actualizado',
        data: updatedRequest
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Error updating company request:', error);
    return NextResponse.json(
      { success: false, error: 'Error al actualizar la solicitud. Intenta de nuevo.' },
      { status: 500 }
    );
  }
}

// PUT - Update company request data fields (for editing)
export async function PUT(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const requestId = parseInt(id);

    if (isNaN(requestId)) {
      return NextResponse.json(
        { success: false, error: 'ID de solicitud inválido' },
        { status: 400 }
      );
    }

    const body = await request.json();

    // VALIDACIÓN: la remediación #9/#52 aplicó zod sólo al POST. Este PUT
    // escribía nombre, correo, RFC, razón social y dirección sin comprobar
    // absolutamente nada (un RFC 'abc' se guardaba tal cual).
    const validation = validate(companyRequestUpdateSchema, body);
    if (!validation.success) {
      return NextResponse.json(
        { success: false, error: 'Datos inválidos', errors: validation.errors },
        { status: 400 }
      );
    }

    const {
      nombre,
      apellidoPaterno,
      apellidoMaterno,
      nombreEmpresa,
      correoEmpresa,
      sitioWeb,
      razonSocial,
      rfc,
      direccionEmpresa
    } = validation.data;

    // Check if request exists
    const existingRequest = await prisma.companyRequest.findUnique({
      where: { id: requestId }
    });

    if (!existingRequest) {
      return NextResponse.json(
        { success: false, error: 'Solicitud no encontrada' },
        { status: 404 }
      );
    }

    // Only allow editing pending requests
    if (existingRequest.status !== 'pending') {
      return NextResponse.json(
        { success: false, error: 'Solo las solicitudes pendientes pueden ser editadas' },
        { status: 400 }
      );
    }

    // Si el admin corrige el correo, hay que mover también el correo de LOGIN:
    // el User se crea en el registro con `correoEmpresa`, y al cambiar sólo la
    // solicitud la empresa seguía entrando con el correo viejo mientras los
    // avisos iban al nuevo.
    const nuevoCorreo =
      correoEmpresa && correoEmpresa.toLowerCase() !== existingRequest.correoEmpresa.toLowerCase()
        ? correoEmpresa.toLowerCase()
        : null;

    if (nuevoCorreo && existingRequest.userId) {
      const ocupado = await prisma.user.findUnique({
        where: { email: nuevoCorreo },
        select: { id: true }
      });
      if (ocupado && ocupado.id !== existingRequest.userId) {
        return NextResponse.json(
          { success: false, error: 'Ya existe una cuenta con este correo electrónico.' },
          { status: 409 }
        );
      }
    }

    // Update the request data
    const updatedRequest = await prisma.$transaction(async (tx) => {
      const actualizada = await tx.companyRequest.update({
        where: { id: requestId },
        data: {
          nombre: nombre || existingRequest.nombre,
          apellidoPaterno: apellidoPaterno || existingRequest.apellidoPaterno,
          apellidoMaterno:
            apellidoMaterno !== undefined ? apellidoMaterno : existingRequest.apellidoMaterno,
          nombreEmpresa: nombreEmpresa || existingRequest.nombreEmpresa,
          correoEmpresa: correoEmpresa || existingRequest.correoEmpresa,
          // '' se normaliza a null: el schema trata el vacío como "sin sitio".
          sitioWeb: sitioWeb !== undefined ? sitioWeb || null : existingRequest.sitioWeb,
          razonSocial: razonSocial || existingRequest.razonSocial,
          rfc: rfc || existingRequest.rfc,
          direccionEmpresa: direccionEmpresa || existingRequest.direccionEmpresa,
          updatedAt: new Date()
        }
      });

      if (nuevoCorreo && existingRequest.userId) {
        await tx.user.update({
          where: { id: existingRequest.userId },
          data: { email: nuevoCorreo }
        });
      }

      return actualizada;
    });

    return NextResponse.json(
      {
        success: true,
        message: 'Solicitud de empresa actualizada exitosamente',
        data: updatedRequest
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Error updating company request data:', error);
    return NextResponse.json(
      { success: false, error: 'Error al actualizar los datos de la solicitud. Intenta de nuevo.' },
      { status: 500 }
    );
  }
}

// GET - Get single company request by ID
export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const requestId = parseInt(id);

    if (isNaN(requestId)) {
      return NextResponse.json(
        { success: false, error: 'ID de solicitud inválido' },
        { status: 400 }
      );
    }

    const companyRequest = await prisma.companyRequest.findUnique({
      where: { id: requestId }
    });

    if (!companyRequest) {
      return NextResponse.json(
        { success: false, error: 'Solicitud no encontrada' },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, data: companyRequest });
  } catch (error) {
    console.error('Error fetching company request:', error);
    return NextResponse.json(
      { success: false, error: 'Error al obtener la solicitud. Intenta de nuevo.' },
      { status: 500 }
    );
  }
}

// DELETE - Delete a company request
export async function DELETE(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const requestId = parseInt(id);

    if (isNaN(requestId)) {
      return NextResponse.json(
        { success: false, error: 'ID de solicitud inválido' },
        { status: 400 }
      );
    }

    // Check if request exists
    const existingRequest = await prisma.companyRequest.findUnique({
      where: { id: requestId }
    });

    if (!existingRequest) {
      return NextResponse.json(
        { success: false, error: 'Solicitud no encontrada' },
        { status: 404 }
      );
    }

    // INTEGRIDAD: borrar sólo la fila CompanyRequest dejaba un User de rol
    // 'company' activo, con sus vacantes y créditos, y sin solicitud asociada:
    // podía iniciar sesión, /api/company/dashboard devolvía companyInfo null y
    // la página reventaba, pero por API seguía publicando vacantes.
    if (existingRequest.userId) {
      const userId = existingRequest.userId;
      const [vacantes, compras] = await Promise.all([
        prisma.job.count({ where: { userId } }),
        prisma.creditPurchase.count({ where: { userId } })
      ]);

      if (vacantes > 0 || compras > 0) {
        return NextResponse.json(
          {
            success: false,
            error:
              'Esta empresa ya tiene vacantes o compras registradas. Recházala en vez de eliminarla para no dejar datos huérfanos.'
          },
          { status: 409 }
        );
      }

      // Sin historial: se borra la solicitud y se desactiva la cuenta en la
      // misma transacción, para que no quede un acceso sin dueño.
      await prisma.$transaction(async (tx) => {
        await tx.user.update({
          where: { id: userId },
          data: { isActive: false }
        });
        await tx.companyRequest.delete({ where: { id: requestId } });
      });
    } else {
      await prisma.companyRequest.delete({
        where: { id: requestId }
      });
    }

    return NextResponse.json(
      {
        success: true,
        message: 'Solicitud eliminada exitosamente'
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Error deleting company request:', error);
    return NextResponse.json(
      { success: false, error: 'Error al eliminar la solicitud. Intenta de nuevo.' },
      { status: 500 }
    );
  }
}
