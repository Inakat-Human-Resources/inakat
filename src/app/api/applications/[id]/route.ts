import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// GET - Obtener aplicación por ID
export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const applicationId = parseInt(id);

    if (isNaN(applicationId)) {
      return NextResponse.json(
        { success: false, error: 'Invalid application ID' },
        { status: 400 }
      );
    }

    const application = await prisma.application.findUnique({
      where: { id: applicationId },
      include: {
        job: true,
        user: {
          select: {
            id: true,
            nombre: true,
            email: true
          }
        }
      }
    });

    if (!application) {
      return NextResponse.json(
        { success: false, error: 'Application not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, data: application });
  } catch (error) {
    console.error('Error fetching application:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch application' },
      { status: 500 }
    );
  }
}

// PATCH - Actualizar aplicación (cambiar estado, agregar notas)
export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const applicationId = parseInt(id);

    if (isNaN(applicationId)) {
      return NextResponse.json(
        { success: false, error: 'Invalid application ID' },
        { status: 400 }
      );
    }

    const body = await request.json();
    const { status, notes } = body;

    // Verificar que la aplicación existe
    const existingApplication = await prisma.application.findUnique({
      where: { id: applicationId }
    });

    if (!existingApplication) {
      return NextResponse.json(
        { success: false, error: 'Application not found' },
        { status: 404 }
      );
    }

    // Validar status si se proporciona
    const validStatuses = [
      'pending',
      'reviewing',
      'evaluating',          // En evaluación por especialista
      'sent_to_specialist',
      'sent_to_company',
      'company_interested',  // Empresa marcó "Me interesa"
      'interviewed',
      'rejected',
      'accepted',
      'injected_by_admin',
      'discarded',
      'archived'
    ];
    if (status && !validStatuses.includes(status)) {
      return NextResponse.json(
        {
          success: false,
          error: `Invalid status. Must be one of: ${validStatuses.join(', ')}`
        },
        { status: 400 }
      );
    }

    // Preparar datos para actualizar
    const updateData: any = {
      updatedAt: new Date()
    };

    if (status) {
      updateData.status = status;
      // Si se revisa/rechaza/acepta, marcar reviewedAt
      if (['reviewing', 'rejected', 'accepted'].includes(status)) {
        updateData.reviewedAt = new Date();
      }
    }

    if (notes !== undefined) {
      updateData.notes = notes;
    }

    // Actualizar aplicación
    const updatedApplication = await prisma.application.update({
      where: { id: applicationId },
      data: updateData,
      include: {
        job: {
          select: {
            title: true,
            company: true
          }
        }
      }
    });

    return NextResponse.json({
      success: true,
      message: 'Application updated successfully',
      data: updatedApplication
    });
  } catch (error) {
    console.error('Error updating application:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update application' },
      { status: 500 }
    );
  }
}

// DELETE - Eliminar aplicación
export async function DELETE(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const applicationId = parseInt(id);

    if (isNaN(applicationId)) {
      return NextResponse.json(
        { success: false, error: 'Invalid application ID' },
        { status: 400 }
      );
    }

    // Verificar que la aplicación existe
    const existingApplication = await prisma.application.findUnique({
      where: { id: applicationId }
    });

    if (!existingApplication) {
      return NextResponse.json(
        { success: false, error: 'Application not found' },
        { status: 404 }
      );
    }

    // Eliminar aplicación
    await prisma.application.delete({
      where: { id: applicationId }
    });

    return NextResponse.json({
      success: true,
      message: 'Application deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting application:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to delete application' },
      { status: 500 }
    );
  }
}
