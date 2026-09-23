// RUTA: src/app/api/applications/[id]/route.ts

import { NextRequest, NextResponse, after } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyToken } from '@/lib/auth';
import { dispatchCandidateAccepted } from '@/lib/worky2-webhook';
import { syncCandidateStatus } from '@/lib/candidate-status';

// ============================================================================
// TYPES
// ============================================================================

interface AuthUser {
  userId: number;
  email: string;
  role: string;
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

/**
 * Esta ruta es ADMIN-ONLY, y así se declara aquí.
 *
 * CÓDIGO MUERTO (#VAC): antes había ramas para candidate, user, company,
 * recruiter y specialist que NUNCA se ejecutaban —el middleware restringe todo
 * /api/applications/* a rol admin (ver la lista `isAdminRoute` en
 * src/middleware.ts)— y que además duplicaban src/lib/authz-applications.ts.
 * No sólo eran inútiles: hacían creer que el candidato podía consultar su
 * postulación por aquí, cuando el GET devuelve `candidateProfile.notas` (las
 * notas internas del admin SOBRE él) y sus documentos. Si alguien relajaba el
 * middleware fiándose de este código, esa fuga se abría sola.
 *
 * Los demás roles acceden por sus propias rutas: /api/company/applications/[id],
 * /api/recruiter/dashboard, /api/specialist/dashboard.
 */
function checkApplicationPermission(
  user: AuthUser | null
): { hasPermission: boolean; reason?: string } {
  // Sin autenticación, no tiene permiso
  if (!user) {
    return { hasPermission: false, reason: 'Autenticación requerida' };
  }

  if (user.role === 'admin') {
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
    const permissionCheck = checkApplicationPermission(currentUser);

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
        ciudad: true,
        estado: true,
        ubicacionCercana: true,
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

    // Agregar logoUrl al job (sin user anidado).
    //
    // CÓDIGO MUERTO (#VAC-034): aquí había una rama que anonimizaba la vacante
    // confidencial "para candidatos/usuarios", inalcanzable porque sólo un admin
    // pasa checkApplicationPermission, y que además copiaba la versión con fuga
    // de la ubicación (una dirección sin comas salía completa). El admin ve la
    // vacante tal cual; la vista pública vive en src/lib/jobs-public.ts.
    const logoUrl = application.job?.user?.companyRequest?.logoUrl || null;

    const jobForResponse = application.job ? {
      id: application.job.id,
      userId: application.job.userId,
      title: application.job.title,
      company: application.job.company,
      location: application.job.location,
      isConfidential: application.job.isConfidential,
      assignment: application.job.assignment,
      logoUrl,
    } : null;

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

    // SECURITY: ruta admin-only (ver checkApplicationPermission). Las ramas para
    // company/recruiter/specialist que había aquí eran inalcanzables: el
    // middleware ya corta cualquier otro rol antes de llegar.
    const canModify = currentUser?.role === 'admin';

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

    // IDEMPOTENCIA (#VAC): la aceptación se reclama de forma atómica.
    //
    // El webhook candidate.accepted se disparaba mirando el estado LEÍDO antes
    // del update, así que dos peticiones simultáneas (doble clic sobre
    // "Aceptar") leían ambas 'pending', ambas actualizaban y ambas notificaban:
    // Worky2 daba de alta al mismo candidato dos veces. Con `updateMany`
    // condicionado a que aún no esté aceptada, sólo una petición cuenta count 1
    // y sólo esa notifica.
    let esPrimeraAceptacion = false;

    if (status === 'accepted' && existingApplication.status !== 'accepted') {
      const reclamada = await prisma.application.updateMany({
        where: { id: applicationId, status: { not: 'accepted' } },
        data: updateData
      });
      esPrimeraAceptacion = reclamada.count === 1;

      if (!esPrimeraAceptacion) {
        return NextResponse.json(
          {
            success: false,
            error: 'Esta postulación ya fue aceptada (¿se hizo doble clic?)'
          },
          { status: 409 }
        );
      }
    } else {
      await prisma.application.update({
        where: { id: applicationId },
        data: updateData
      });
    }

    const updatedApplication = await prisma.application.findUnique({
      where: { id: applicationId },
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

    // Integración Worky2: si la Application transiciona a 'accepted' (y no lo
    // estaba ya), notificar candidate.accepted a los webhooks activos de la
    // empresa dueña de la vacante. Con `after()` (waitUntil en Vercel) en vez
    // de un `void` desnudo, que se perdía al congelarse la función.
    if (esPrimeraAceptacion) {
      after(() => dispatchCandidateAccepted(applicationId));
    }

    // ADM-028: Candidate.status sigue a sus postulaciones (hired / in_process /
    // available).
    if (status !== undefined && status !== existingApplication.status) {
      await syncCandidateStatus(existingApplication.candidateEmail);
    }

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

    // ADM-028: sin esta postulación el candidato puede quedar sin procesos vivos.
    await syncCandidateStatus(existingApplication.candidateEmail);

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
