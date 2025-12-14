import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import bcrypt from 'bcryptjs';

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
        { success: false, error: 'Invalid request ID' },
        { status: 400 }
      );
    }

    const body = await request.json();
    const { status, rejectionReason } = body; // ← AGREGADO rejectionReason

    // Validate status
    if (!['pending', 'approved', 'rejected'].includes(status)) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid status. Must be: pending, approved, or rejected'
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
        { success: false, error: 'Request not found' },
        { status: 404 }
      );
    }

    // Update the request
    const updatedRequest = await prisma.companyRequest.update({
      where: { id: requestId },
      data: {
        status,
        rejectionReason: rejectionReason || null,
        approvedAt: status === 'approved' ? new Date() : null
      }
    });

    // Si se aprueba la empresa, crear cuenta de usuario automáticamente
    let createdUser = null;
    if (status === 'approved') {
      // Verificar si ya existe un usuario con ese email
      const existingUser = await prisma.user.findUnique({
        where: { email: existingRequest.correoEmpresa.toLowerCase() }
      });

      if (!existingUser) {
        // Generar contraseña temporal: primeras 4 letras del nombre + 4 dígitos del RFC + !
        const nombrePart = existingRequest.nombre
          .replace(/\s+/g, '')
          .substring(0, 4)
          .toLowerCase();
        const rfcPart = existingRequest.rfc
          .replace(/[^0-9]/g, '')
          .substring(0, 4)
          .padEnd(4, '0');
        const tempPassword = `${nombrePart}${rfcPart}!`;

        const hashedPassword = await bcrypt.hash(tempPassword, 10);

        createdUser = await prisma.user.create({
          data: {
            email: existingRequest.correoEmpresa.toLowerCase(),
            password: hashedPassword,
            nombre: `${existingRequest.nombre} ${existingRequest.apellidoPaterno}`,
            apellidoPaterno: existingRequest.apellidoPaterno,
            apellidoMaterno: existingRequest.apellidoMaterno,
            role: 'company',
            companyRequest: {
              connect: { id: existingRequest.id }
            }
          }
        });

        console.log(
          `Usuario de empresa creado: ${createdUser.email} (contraseña temporal: ${tempPassword})`
        );
      }
    }

    return NextResponse.json(
      {
        success: true,
        message:
          status === 'approved' && createdUser
            ? 'Empresa aprobada y cuenta de usuario creada'
            : 'Request status updated successfully',
        data: updatedRequest,
        userCreated: createdUser
          ? { email: createdUser.email, id: createdUser.id }
          : null
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Error updating company request:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update request' },
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
        { success: false, error: 'Invalid request ID' },
        { status: 400 }
      );
    }

    const companyRequest = await prisma.companyRequest.findUnique({
      where: { id: requestId }
    });

    if (!companyRequest) {
      return NextResponse.json(
        { success: false, error: 'Request not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, data: companyRequest });
  } catch (error) {
    console.error('Error fetching company request:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch request' },
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
        { success: false, error: 'Invalid request ID' },
        { status: 400 }
      );
    }

    // Check if request exists
    const existingRequest = await prisma.companyRequest.findUnique({
      where: { id: requestId }
    });

    if (!existingRequest) {
      return NextResponse.json(
        { success: false, error: 'Request not found' },
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
        message: 'Request deleted successfully'
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Error deleting company request:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to delete request' },
      { status: 500 }
    );
  }
}
