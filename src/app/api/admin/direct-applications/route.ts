// RUTA: src/app/api/admin/direct-applications/route.ts

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/auth';
import { getPaginationParams, buildPaginatedResponse } from '@/lib/pagination';

// Tope alto para no romper la pantalla actual (que aún no pagina) pero evitar
// que una avalancha de postulaciones tumbe la función serverless.
const LIMITE_POR_DEFECTO = 200;
const LIMITE_MAXIMO = 200;

/**
 * GET /api/admin/direct-applications
 * Obtener aplicaciones directas pendientes (status='pending')
 * Solo accesible para admin
 */
export async function GET(request: Request) {
  try {
    // Defense-in-depth: verificar rol además del middleware
    const auth = await requireRole('admin');
    if ('error' in auth) {
      return NextResponse.json(
        { success: false, error: auth.error },
        { status: auth.status }
      );
    }

    // (Se eliminó la segunda comprobación por header x-user-role: requireRole
    // ya consulta la BD y era una rama inalcanzable que además devolvía 403 a
    // un admin legítimo cuando el handler se invoca sin el middleware.)

    // Paginación: POST /api/applications es público, así que el volumen de
    // 'pending' lo controla cualquiera. Sin tope, la respuesta con todos los
    // includes puede superar el límite de la función serverless y la pantalla
    // deja de funcionar por completo.
    const { searchParams } = new URL(request.url);
    const pagination = getPaginationParams(searchParams, LIMITE_POR_DEFECTO, LIMITE_MAXIMO);

    const [applications, total] = await Promise.all([
      prisma.application.findMany({
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
        orderBy: { createdAt: 'desc' },
        skip: pagination.skip,
        take: pagination.take
      }),
      prisma.application.count({ where: { status: 'pending' } })
    ]);

    const response = buildPaginatedResponse(applications, total, pagination);

    // TODO(handoff): la pantalla /admin/direct-applications debe leer
    // `pagination` y pintar controles; hoy sólo usa `data`.
    return NextResponse.json({
      success: true,
      ...response,
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
    // Defense-in-depth: verificar rol además del middleware
    const auth = await requireRole('admin');
    if ('error' in auth) {
      return NextResponse.json(
        { success: false, error: auth.error },
        { status: auth.status }
      );
    }

    // (Igual que en GET: fuera la segunda comprobación por header.)

    const body = await request.json();
    const { applicationId, newStatus } = body;

    if (!applicationId || !newStatus) {
      return NextResponse.json(
        { success: false, error: 'Se requiere applicationId y newStatus' },
        { status: 400 }
      );
    }

    const idAplicacion = Number(applicationId);
    if (!Number.isInteger(idAplicacion) || idAplicacion <= 0) {
      return NextResponse.json(
        { success: false, error: 'applicationId debe ser un entero positivo' },
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
      where: { id: idAplicacion }
    });

    if (!existingApplication) {
      return NextResponse.json(
        { success: false, error: 'Aplicación no encontrada' },
        { status: 404 }
      );
    }

    // Reclamo atómico: esta pantalla sólo procesa postulaciones 'pending', pero
    // el reclutador trabaja las mismas filas desde su panel. Sin la condición,
    // "Descartar" sobre una lista desactualizada pisaba un estado avanzado
    // (p. ej. una ya enviada al especialista).
    const reclamo = await prisma.application.updateMany({
      where: { id: idAplicacion, status: 'pending' },
      data: {
        status: newStatus,
        // Coherente con /api/applications/[id]: al pasar a revisión se marca la
        // fecha, que antes nunca se fijaba por este flujo.
        ...(newStatus === 'reviewing' ? { reviewedAt: new Date() } : {}),
        updatedAt: new Date()
      }
    });

    if (reclamo.count === 0) {
      return NextResponse.json(
        {
          success: false,
          error: `La postulación ya no está pendiente (estado actual: ${existingApplication.status}). Recarga la lista.`
        },
        { status: 409 }
      );
    }

    const updatedApplication = await prisma.application.findUnique({
      where: { id: idAplicacion },
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
