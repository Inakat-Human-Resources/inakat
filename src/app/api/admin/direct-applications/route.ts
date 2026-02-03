// RUTA: src/app/api/admin/direct-applications/route.ts

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

/**
 * GET /api/admin/direct-applications
 * Obtener aplicaciones directas pendientes (status='pending')
 * Solo accesible para admin
 */
export async function GET(request: Request) {
  try {
    // Verificar que es admin (el middleware ya valida esto)
    const userRole = request.headers.get('x-user-role');

    if (userRole !== 'admin') {
      return NextResponse.json(
        { success: false, error: 'Acceso denegado - Solo administradores' },
        { status: 403 }
      );
    }

    // Obtener aplicaciones pendientes (aplicaciones directas sin revisar)
    const applications = await prisma.application.findMany({
      where: {
        status: 'pending'
      },
      include: {
        job: {
          select: {
            id: true,
            title: true,
            company: true,
            location: true,
            status: true,
            assignment: {
              select: {
                id: true,
                recruiter: {
                  select: { id: true, nombre: true, apellidoPaterno: true }
                }
              }
            },
            user: {
              select: {
                nombre: true,
                email: true,
                companyRequest: {
                  select: {
                    nombreEmpresa: true
                  }
                }
              }
            }
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    return NextResponse.json({
      success: true,
      data: applications,
      count: applications.length
    });
  } catch (error) {
    console.error('Error fetching direct applications:', error);
    return NextResponse.json(
      { success: false, error: 'Error al obtener aplicaciones directas' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/admin/direct-applications
 * Actualizar status de una aplicación directa
 * Body: { applicationId: number, newStatus: string }
 */
export async function PUT(request: Request) {
  try {
    // Verificar que es admin
    const userRole = request.headers.get('x-user-role');

    if (userRole !== 'admin') {
      return NextResponse.json(
        { success: false, error: 'Acceso denegado - Solo administradores' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { applicationId, newStatus } = body;

    if (!applicationId || !newStatus) {
      return NextResponse.json(
        { success: false, error: 'Se requiere applicationId y newStatus' },
        { status: 400 }
      );
    }

    // Validar status permitidos para esta acción
    const validStatuses = ['reviewing', 'discarded', 'archived'];
    if (!validStatuses.includes(newStatus)) {
      return NextResponse.json(
        {
          success: false,
          error: `Status inválido. Debe ser: ${validStatuses.join(', ')}`
        },
        { status: 400 }
      );
    }

    // Verificar que la aplicación existe
    const existingApplication = await prisma.application.findUnique({
      where: { id: applicationId }
    });

    if (!existingApplication) {
      return NextResponse.json(
        { success: false, error: 'Aplicación no encontrada' },
        { status: 404 }
      );
    }

    // Actualizar el status
    const updatedApplication = await prisma.application.update({
      where: { id: applicationId },
      data: {
        status: newStatus,
        updatedAt: new Date()
      },
      include: {
        job: {
          select: {
            title: true,
            company: true
          }
        }
      }
    });

    // Verificar si la vacante tiene reclutador asignado cuando se mueve a reviewing
    if (newStatus === 'reviewing') {
      const jobAssignment = await prisma.jobAssignment.findUnique({
        where: { jobId: existingApplication.jobId }
      });

      if (!jobAssignment) {
        return NextResponse.json({
          success: true,
          message: 'Aplicación movida al proceso de revisión. ⚠️ Esta vacante no tiene reclutador asignado aún. Asigna uno desde Gestión de Asignaciones.',
          data: updatedApplication,
          needsAssignment: true
        });
      }
    }

    const statusMessages: Record<string, string> = {
      reviewing: 'Aplicación movida al proceso de revisión',
      discarded: 'Aplicación descartada',
      archived: 'Aplicación archivada'
    };

    return NextResponse.json({
      success: true,
      message: statusMessages[newStatus] || 'Status actualizado',
      data: updatedApplication
    });
  } catch (error) {
    console.error('Error updating application status:', error);
    return NextResponse.json(
      { success: false, error: 'Error al actualizar aplicación' },
      { status: 500 }
    );
  }
}
