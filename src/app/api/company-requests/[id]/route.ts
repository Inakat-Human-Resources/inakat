// RUTA: src/app/api/company-requests/[id]/route.ts

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

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

    // Update the request status
    const updatedRequest = await prisma.companyRequest.update({
      where: { id: requestId },
      data: {
        status,
        rejectionReason: rejectionReason || null,
        approvedAt: status === 'approved' ? new Date() : null
      }
    });

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
    } = body;

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

    // Update the request data
    const updatedRequest = await prisma.companyRequest.update({
      where: { id: requestId },
      data: {
        nombre: nombre || existingRequest.nombre,
        apellidoPaterno: apellidoPaterno || existingRequest.apellidoPaterno,
        apellidoMaterno: apellidoMaterno || existingRequest.apellidoMaterno,
        nombreEmpresa: nombreEmpresa || existingRequest.nombreEmpresa,
        correoEmpresa: correoEmpresa || existingRequest.correoEmpresa,
        sitioWeb: sitioWeb !== undefined ? sitioWeb : existingRequest.sitioWeb,
        razonSocial: razonSocial || existingRequest.razonSocial,
        rfc: rfc || existingRequest.rfc,
        direccionEmpresa: direccionEmpresa || existingRequest.direccionEmpresa,
        updatedAt: new Date()
      }
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

    // Delete the request
    await prisma.companyRequest.delete({
      where: { id: requestId }
    });

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
