import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyToken } from '@/lib/auth';

// ============================================================================
// TYPES
// ============================================================================

interface AuthUser {
  userId: number;
  email: string;
  role: string;
}

interface ApplicationWithRelations {
  id: number;
  jobId: number;
  userId: number | null;
  candidateEmail: string;
  job: {
    id: number;
    userId: number | null;
    title: string;
    company: string;
    assignment?: {
      recruiterId: number | null;
      specialistId: number | null;
    } | null;
  };
  user?: {
    id: number;
    nombre: string;
    email: string;
  } | null;
  [key: string]: unknown;
}

// ============================================================================
// SECURITY: Permission checking
// ============================================================================

async function getCurrentUser(request: NextRequest): Promise<AuthUser | null> {
  try {
    // Intentar obtener de headers (inyectados por middleware)
    const userIdHeader = request.headers.get('x-user-id');
    const userEmailHeader = request.headers.get('x-user-email');
    const userRoleHeader = request.headers.get('x-user-role');

    if (userIdHeader && userEmailHeader && userRoleHeader) {
      return {
        userId: parseInt(userIdHeader),
        email: userEmailHeader,
        role: userRoleHeader
      };
    }

    // Fallback: verificar token directamente
    const authHeader = request.headers.get('authorization');
    const token = authHeader?.replace('Bearer ', '') ||
                  request.cookies.get('auth-token')?.value;

    if (!token) return null;

    const payload = verifyToken(token);
    if (!payload) return null;

    return {
      userId: payload.userId,
      email: payload.email,
      role: payload.role
    };
  } catch {
    return null;
  }
}

function checkApplicationPermission(
  user: AuthUser | null,
  application: ApplicationWithRelations
): { hasPermission: boolean; reason?: string } {
  // Sin autenticación, no tiene permiso
  if (!user) {
    return { hasPermission: false, reason: 'Authentication required' };
  }

  // Admin puede ver todo
  if (user.role === 'admin') {
    return { hasPermission: true };
  }

  // El candidato puede ver su propia aplicación (por userId o email)
  if (user.role === 'candidate' || user.role === 'user') {
    if (application.userId === user.userId) {
      return { hasPermission: true };
    }
    if (application.candidateEmail.toLowerCase() === user.email.toLowerCase()) {
      return { hasPermission: true };
    }
  }

  // La empresa dueña del job puede verla
  if (user.role === 'company' && application.job?.userId === user.userId) {
    return { hasPermission: true };
  }

  // Recruiter asignado al job puede verla
  if (user.role === 'recruiter' &&
      application.job?.assignment?.recruiterId === user.userId) {
    return { hasPermission: true };
  }

  // Especialista asignado al job puede verla
  if (user.role === 'specialist' &&
      application.job?.assignment?.specialistId === user.userId) {
    return { hasPermission: true };
  }

  return {
    hasPermission: false,
    reason: `Role '${user.role}' does not have permission to access this application`
  };
}

// ============================================================================
// GET - Obtener aplicación por ID
// ============================================================================

export async function GET(
  request: NextRequest,
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

    // Obtener usuario autenticado
    const currentUser = await getCurrentUser(request);

    // Buscar la aplicación con datos relacionados para verificación de permisos
    const application = await prisma.application.findUnique({
      where: { id: applicationId },
      include: {
        job: {
          select: {
            id: true,
            userId: true,
            title: true,
            company: true,
            assignment: {
              select: {
                recruiterId: true,
                specialistId: true
              }
            }
          }
        },
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

    // SECURITY: Verificar permisos
    const permissionCheck = checkApplicationPermission(
      currentUser,
      application as unknown as ApplicationWithRelations
    );

    if (!permissionCheck.hasPermission) {
      console.warn('[Applications] Access denied:', {
        applicationId,
        userId: currentUser?.userId,
        role: currentUser?.role,
        reason: permissionCheck.reason
      });

      return NextResponse.json(
        { success: false, error: 'No tienes permiso para ver esta aplicación' },
        { status: 403 }
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

// ============================================================================
// PATCH - Actualizar aplicación (cambiar estado, agregar notas)
// ============================================================================

export async function PATCH(
  request: NextRequest,
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

    // Obtener usuario autenticado
    const currentUser = await getCurrentUser(request);

    // Verificar que la aplicación existe con datos para permisos
    const existingApplication = await prisma.application.findUnique({
      where: { id: applicationId },
      include: {
        job: {
          select: {
            id: true,
            userId: true,
            title: true,
            company: true,
            assignment: {
              select: {
                recruiterId: true,
                specialistId: true
              }
            }
          }
        }
      }
    });

    if (!existingApplication) {
      return NextResponse.json(
        { success: false, error: 'Application not found' },
        { status: 404 }
      );
    }

    // SECURITY: Verificar permisos para modificar
    // Solo admin, empresa dueña, recruiter asignado, o especialista asignado pueden modificar
    const canModify =
      currentUser?.role === 'admin' ||
      (currentUser?.role === 'company' && existingApplication.job?.userId === currentUser.userId) ||
      (currentUser?.role === 'recruiter' && existingApplication.job?.assignment?.recruiterId === currentUser.userId) ||
      (currentUser?.role === 'specialist' && existingApplication.job?.assignment?.specialistId === currentUser.userId);

    if (!canModify) {
      console.warn('[Applications] Modification denied:', {
        applicationId,
        userId: currentUser?.userId,
        role: currentUser?.role
      });

      return NextResponse.json(
        { success: false, error: 'No tienes permiso para modificar esta aplicación' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { status, notes } = body;

    // Validar status si se proporciona
    const validStatuses = [
      'pending',
      'reviewing',
      'evaluating',
      'sent_to_specialist',
      'sent_to_company',
      'company_interested',
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
    const updateData: Record<string, unknown> = {
      updatedAt: new Date()
    };

    if (status) {
      updateData.status = status;
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

    // Si el status cambia a 'sent_to_specialist', actualizar JobAssignment
    if (status === 'sent_to_specialist') {
      const jobAssignment = await prisma.jobAssignment.findFirst({
        where: { jobId: existingApplication.jobId }
      });

      if (jobAssignment && jobAssignment.specialistId) {
        await prisma.jobAssignment.update({
          where: { id: jobAssignment.id },
          data: {
            recruiterStatus: 'sent_to_specialist',
            specialistStatus: jobAssignment.specialistStatus === 'pending'
              ? 'pending'
              : jobAssignment.specialistStatus
          }
        });
      }
    }

    console.log('[Applications] Updated:', {
      applicationId,
      by: currentUser?.userId,
      role: currentUser?.role,
      newStatus: status
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

// ============================================================================
// DELETE - Eliminar aplicación
// ============================================================================

export async function DELETE(
  request: NextRequest,
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

    // Obtener usuario autenticado
    const currentUser = await getCurrentUser(request);

    // SECURITY: Solo admin puede eliminar aplicaciones
    if (!currentUser || currentUser.role !== 'admin') {
      console.warn('[Applications] Delete denied:', {
        applicationId,
        userId: currentUser?.userId,
        role: currentUser?.role
      });

      return NextResponse.json(
        { success: false, error: 'Solo administradores pueden eliminar aplicaciones' },
        { status: 403 }
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

    console.log('[Applications] Deleted:', {
      applicationId,
      by: currentUser.userId
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
