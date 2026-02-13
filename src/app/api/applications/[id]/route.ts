// RUTA: src/app/api/applications/[id]/route.ts

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
    location?: string;
    isConfidential?: boolean;
    logoUrl?: string | null;
    assignment?: {
      recruiterId: number | null;
      specialistId: number | null;
    } | null;
    user?: {
      companyRequest?: {
        logoUrl?: string | null;
      } | null;
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
    return { hasPermission: false, reason: 'Autenticación requerida' };
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
    reason: `El rol '${user.role}' no tiene permiso para acceder a esta aplicación`
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
        { success: false, error: 'ID de aplicación inválido' },
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
            location: true,
            isConfidential: true,
            assignment: {
              select: {
                recruiterId: true,
                specialistId: true
              }
            },
            user: {
              select: {
                companyRequest: {
                  select: { logoUrl: true }
                }
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
        { success: false, error: 'Aplicación no encontrada' },
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

    // Buscar datos del candidato por email para enriquecer la respuesta
    const candidateProfile = await prisma.candidate.findFirst({
      where: { email: { equals: application.candidateEmail, mode: 'insensitive' } },
      select: {
        id: true,
        nombre: true,
        apellidoPaterno: true,
        apellidoMaterno: true,
        email: true,
        telefono: true,
        sexo: true,
        fechaNacimiento: true,
        universidad: true,
        carrera: true,
        nivelEstudios: true,
        añosExperiencia: true,
        profile: true,
        seniority: true,
        cvUrl: true,
        linkedinUrl: true,
        portafolioUrl: true,
        notas: true,
        educacion: true,
        fotoUrl: true, // FEAT-2: Foto de perfil
        experiences: {
          orderBy: { fechaInicio: 'desc' },
          take: 5
        },
        documents: true
      }
    });

    // Agregar logoUrl al job y sanitizar vacantes confidenciales para candidatos/usuarios
    const logoUrl = application.job?.user?.companyRequest?.logoUrl || null;
    const isCandidateOrUser = ['candidate', 'user'].includes(currentUser?.role || '');
    const isConfidential = application.job?.isConfidential;

    // Construir job con logoUrl (sin user anidado)
    let jobForResponse = application.job ? {
      id: application.job.id,
      userId: application.job.userId,
      title: application.job.title,
      company: application.job.company,
      location: application.job.location,
      isConfidential: application.job.isConfidential,
      assignment: application.job.assignment,
      logoUrl: (isCandidateOrUser && isConfidential) ? null : logoUrl,
    } : null;

    // Sanitizar datos adicionales si es confidencial y es candidato/usuario
    if (isCandidateOrUser && isConfidential && jobForResponse) {
      jobForResponse = {
        ...jobForResponse,
        company: 'Empresa Confidencial',
        location: application.job?.location?.includes(',')
          ? application.job.location.split(',').pop()?.trim() || application.job.location
          : application.job?.location,
        logoUrl: null,
      };
    }

    const responseData = {
      ...application,
      job: jobForResponse,
      candidateProfile // FEAT-2: Incluir perfil del candidato con fotoUrl
    };

    return NextResponse.json({ success: true, data: responseData });

  } catch (error) {
    console.error('Error fetching application:', error);
    return NextResponse.json(
      { success: false, error: 'Error al obtener la aplicación. Intenta de nuevo.' },
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
        { success: false, error: 'ID de aplicación inválido' },
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
            location: true,
            isConfidential: true,
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
        { success: false, error: 'Aplicación no encontrada' },
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
          error: `Estado inválido. Debe ser uno de: ${validStatuses.join(', ')}`
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
            company: true,
            location: true,
            isConfidential: true
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

    return NextResponse.json({
      success: true,
      message: 'Aplicación actualizada exitosamente',
      data: updatedApplication
    });

  } catch (error) {
    console.error('Error updating application:', error);
    return NextResponse.json(
      { success: false, error: 'Error al actualizar la aplicación. Intenta de nuevo.' },
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
        { success: false, error: 'ID de aplicación inválido' },
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
        { success: false, error: 'Aplicación no encontrada' },
        { status: 404 }
      );
    }

    // Eliminar aplicación
    await prisma.application.delete({
      where: { id: applicationId }
    });

    return NextResponse.json({
      success: true,
      message: 'Aplicación eliminada exitosamente'
    });

  } catch (error) {
    console.error('Error deleting application:', error);
    return NextResponse.json(
      { success: false, error: 'Error al eliminar la aplicación. Intenta de nuevo.' },
      { status: 500 }
    );
  }
}
