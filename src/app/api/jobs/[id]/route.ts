// RUTA: src/app/api/jobs/[id]/route.ts

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { calculateJobCreditCost } from '@/lib/pricing';
import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/auth';

// Helper para verificar autenticación y ownership
async function verifyJobOwnership(jobUserId: number | null): Promise<{
  authenticated: boolean;
  authorized: boolean;
  userId?: number;
  role?: string;
  error?: string;
}> {
  const cookieStore = await cookies();
  const token = cookieStore.get('auth-token')?.value;

  if (!token) {
    return { authenticated: false, authorized: false, error: 'No autenticado' };
  }

  const payload = verifyToken(token);
  if (!payload?.userId) {
    return { authenticated: false, authorized: false, error: 'Token inválido' };
  }

  const isAdmin = payload.role === 'admin';
  const isOwner = jobUserId === payload.userId;

  if (!isAdmin && !isOwner) {
    return { authenticated: true, authorized: false, userId: payload.userId, role: payload.role, error: 'No tienes permiso para modificar esta vacante' };
  }

  return { authenticated: true, authorized: true, userId: payload.userId, role: payload.role };
}

// Función para sanitizar vacantes confidenciales
function sanitizeConfidentialJob(job: any, isOwnerOrAdmin: boolean) {
  if (!job.isConfidential || isOwnerOrAdmin) {
    return job;
  }

  // Ocultar datos sensibles para vacantes confidenciales
  return {
    ...job,
    company: 'Empresa Confidencial',
    location: job.location ? job.location.split(',').pop()?.trim() || 'México' : 'México',
    logoUrl: null, // Ocultar logo en vacantes confidenciales
  };
}

// GET - Obtener vacante por ID
export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const jobId = parseInt(id);

    if (isNaN(jobId)) {
      return NextResponse.json(
        { success: false, error: 'Invalid job ID' },
        { status: 400 }
      );
    }

    const job = await prisma.job.findUnique({
      where: { id: jobId },
      include: {
        user: {
          select: {
            companyRequest: {
              select: { logoUrl: true }
            }
          }
        }
      }
    });

    if (!job) {
      return NextResponse.json(
        { success: false, error: 'Job not found' },
        { status: 404 }
      );
    }

    // Verificar si el usuario es propietario o admin
    let isOwnerOrAdmin = false;
    const cookieStore = await cookies();
    const token = cookieStore.get('auth-token')?.value;

    if (token) {
      const payload = verifyToken(token);
      if (payload?.userId) {
        // Es admin o es el propietario de la vacante
        isOwnerOrAdmin = payload.role === 'admin' || job.userId === payload.userId;
      }
    }

    // Transformar para incluir logoUrl directamente
    // SEGURIDAD: Excluir notasInternas de la respuesta pública
    const logoUrl = job.user?.companyRequest?.logoUrl || null;
    const { user, notasInternas, ...jobWithoutSensitive } = job;
    const jobWithLogo = isOwnerOrAdmin
      ? { ...jobWithoutSensitive, notasInternas, logoUrl }
      : { ...jobWithoutSensitive, logoUrl };

    // Sanitizar si es confidencial y no es propietario/admin
    const sanitizedJob = sanitizeConfidentialJob(jobWithLogo, isOwnerOrAdmin);

    return NextResponse.json({ success: true, data: sanitizedJob });
  } catch (error) {
    console.error('Error fetching job:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch job' },
      { status: 500 }
    );
  }
}

// Función auxiliar para validar especialidad
async function validateSpecialty(profile: string | null, subcategory: string | null) {
  if (!profile) return { valid: true };

  const specialtyExists = await prisma.specialty.findFirst({
    where: {
      name: profile,
      isActive: true
    }
  });

  if (!specialtyExists) {
    return { valid: false, error: 'La especialidad seleccionada no es válida o no está activa' };
  }

  // Si hay subcategoría, validar que existe dentro de la especialidad
  if (subcategory && specialtyExists.subcategories) {
    const subcategories = specialtyExists.subcategories as string[];
    if (!subcategories.includes(subcategory)) {
      return { valid: false, error: 'La sub-especialidad seleccionada no es válida para esta especialidad' };
    }
  }

  return { valid: true };
}

// PATCH - Actualizar vacante (parcial)
export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const jobId = parseInt(id);

    if (isNaN(jobId)) {
      return NextResponse.json(
        { success: false, error: 'Invalid job ID' },
        { status: 400 }
      );
    }

    const body = await request.json();

    // Verificar que la vacante existe
    const existingJob = await prisma.job.findUnique({
      where: { id: jobId }
    });

    if (!existingJob) {
      return NextResponse.json(
        { success: false, error: 'Job not found' },
        { status: 404 }
      );
    }

    // Verificar autenticación y ownership
    const auth = await verifyJobOwnership(existingJob.userId);
    if (!auth.authenticated) {
      return NextResponse.json({ success: false, error: auth.error }, { status: 401 });
    }
    if (!auth.authorized) {
      return NextResponse.json({ success: false, error: auth.error }, { status: 403 });
    }

    // Verificar si el tiempo de edición ha expirado (4 horas)
    // Solo aplica para ediciones de contenido, no para cambios de status
    const allowedFieldsAfterExpiry = ['status', 'closedReason'];
    const contentFields = Object.keys(body).filter(k => !allowedFieldsAfterExpiry.includes(k));

    if (existingJob.editableUntil && new Date() > existingJob.editableUntil && contentFields.length > 0) {
      return NextResponse.json(
        {
          success: false,
          error: 'El tiempo para editar esta vacante ha expirado (4 horas después de su creación)'
        },
        { status: 403 }
      );
    }

    // Validar status si se proporciona
    const validJobStatuses = ['active', 'paused', 'closed', 'draft'];
    if (body.status && !validJobStatuses.includes(body.status)) {
      return NextResponse.json(
        {
          success: false,
          error: `Invalid status. Must be one of: ${validJobStatuses.join(', ')}`
        },
        { status: 400 }
      );
    }

    // Validar closedReason si se proporciona
    const validClosedReasons = ['success', 'cancelled'];
    if (body.closedReason && !validClosedReasons.includes(body.closedReason)) {
      return NextResponse.json(
        {
          success: false,
          error: `Invalid closedReason. Must be one of: ${validClosedReasons.join(', ')}`
        },
        { status: 400 }
      );
    }

    // Si se está cerrando la vacante, se requiere closedReason
    if (body.status === 'closed' && !body.closedReason) {
      return NextResponse.json(
        {
          success: false,
          error: 'closedReason is required when closing a job'
        },
        { status: 400 }
      );
    }

    // Validar especialidad si se proporciona
    if (body.profile !== undefined) {
      const validation = await validateSpecialty(body.profile, body.subcategory);
      if (!validation.valid) {
        return NextResponse.json(
          { success: false, error: validation.error },
          { status: 400 }
        );
      }
    }

    // Validar rango de salario si se proporcionan min/max
    if (body.salaryMin !== undefined && body.salaryMax !== undefined) {
      const minNum = parseInt(body.salaryMin) || 0;
      const maxNum = parseInt(body.salaryMax) || 0;

      if (minNum > maxNum) {
        return NextResponse.json(
          { success: false, error: 'El salario mínimo no puede ser mayor al máximo' },
          { status: 400 }
        );
      }

      if (maxNum - minNum > 10000) {
        return NextResponse.json(
          { success: false, error: 'La diferencia máxima permitida entre salarios es $10,000 MXN' },
          { status: 400 }
        );
      }
    }

    // Whitelist de campos permitidos (previene inyección de userId, creditCost, editableUntil)
    const allowedPatchFields = ['status', 'closedReason', 'title', 'company', 'location',
      'salary', 'salaryMin', 'salaryMax', 'jobType', 'workMode', 'description',
      'requirements', 'companyRating', 'profile', 'subcategory', 'seniority',
      'educationLevel', 'habilidades', 'responsabilidades', 'resultadosEsperados',
      'valoresActitudes', 'informacionAdicional', 'notasInternas', 'isConfidential'];
    const updateData: Record<string, any> = {};
    for (const field of allowedPatchFields) {
      if (body[field] !== undefined) updateData[field] = body[field];
    }
    // Convertir salaryMin/salaryMax a Int si existen
    if (updateData.salaryMin !== undefined) {
      updateData.salaryMin = updateData.salaryMin ? parseInt(updateData.salaryMin) : null;
    }
    if (updateData.salaryMax !== undefined) {
      updateData.salaryMax = updateData.salaryMax ? parseInt(updateData.salaryMax) : null;
    }

    // Actualizar vacante
    const updatedJob = await prisma.job.update({
      where: { id: jobId },
      data: updateData
    });

    return NextResponse.json({
      success: true,
      message: 'Job updated successfully',
      data: updatedJob
    });
  } catch (error) {
    console.error('Error updating job:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update job' },
      { status: 500 }
    );
  }
}

// PUT - Actualizar vacante (completa) - Usado por el formulario de edición
export async function PUT(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const jobId = parseInt(id);

    if (isNaN(jobId)) {
      return NextResponse.json(
        { success: false, error: 'ID de vacante inválido' },
        { status: 400 }
      );
    }

    const body = await request.json();

    // Verificar que la vacante existe
    const existingJob = await prisma.job.findUnique({
      where: { id: jobId }
    });

    if (!existingJob) {
      return NextResponse.json(
        { success: false, error: 'Vacante no encontrada' },
        { status: 404 }
      );
    }

    // Verificar autenticación y ownership
    const auth = await verifyJobOwnership(existingJob.userId);
    if (!auth.authenticated) {
      return NextResponse.json({ success: false, error: auth.error }, { status: 401 });
    }
    if (!auth.authorized) {
      return NextResponse.json({ success: false, error: auth.error }, { status: 403 });
    }

    // Verificar si el tiempo de edición ha expirado (4 horas)
    if (existingJob.editableUntil && new Date() > existingJob.editableUntil) {
      return NextResponse.json(
        {
          success: false,
          error: 'El tiempo para editar esta vacante ha expirado (4 horas después de su creación)'
        },
        { status: 403 }
      );
    }

    // Validar especialidad
    const validation = await validateSpecialty(body.profile, body.subcategory);
    if (!validation.valid) {
      return NextResponse.json(
        { success: false, error: validation.error },
        { status: 400 }
      );
    }

    // Extraer campos permitidos para actualización
    const {
      title,
      company,
      location,
      salary,
      salaryMin,
      salaryMax,
      jobType,
      workMode,
      description,
      requirements,
      companyRating,
      profile,
      subcategory,
      seniority,
      educationLevel,
      habilidades,
      responsabilidades,
      resultadosEsperados,
      valoresActitudes,
      informacionAdicional,
      notasInternas,
      isConfidential
    } = body;

    // Validar rango de salario si se proporcionan min/max
    if (salaryMin !== undefined && salaryMax !== undefined) {
      const minNum = parseInt(salaryMin) || 0;
      const maxNum = parseInt(salaryMax) || 0;

      if (minNum > maxNum) {
        return NextResponse.json(
          { success: false, error: 'El salario mínimo no puede ser mayor al máximo' },
          { status: 400 }
        );
      }

      if (maxNum - minNum > 10000) {
        return NextResponse.json(
          { success: false, error: 'La diferencia máxima permitida entre salarios es $10,000 MXN' },
          { status: 400 }
        );
      }
    }

    // ========== VALIDACIÓN DE CRÉDITOS AL EDITAR ==========
    // Solo aplica a vacantes activas cuando cambian campos que afectan el precio
    let creditChange: { original: number; new: number; difference: number; action: string } | null = null;
    let newCreditCost: number | undefined = undefined;

    if (existingJob.status === 'active') {
      const originalCost = existingJob.creditCost || 0;

      // Determinar valores actuales y nuevos para comparación
      const currentProfile = existingJob.profile || '';
      const currentSeniority = existingJob.seniority || '';
      const currentWorkMode = existingJob.workMode || 'presential';

      const newProfile = profile !== undefined ? (profile || '') : currentProfile;
      const newSeniority = seniority !== undefined ? (seniority || '') : currentSeniority;
      const newWorkMode = workMode !== undefined ? (workMode || 'presential') : currentWorkMode;

      // Verificar si cambiaron campos que afectan el precio
      const priceAffectingFieldsChanged =
        newProfile !== currentProfile ||
        newSeniority !== currentSeniority ||
        newWorkMode !== currentWorkMode;

      if (priceAffectingFieldsChanged && newProfile && newSeniority && newWorkMode) {
        // Calcular nuevo costo usando la función centralizada
        const newCostResult = await calculateJobCreditCost(newProfile, newSeniority, newWorkMode);
        const newCost = newCostResult.credits;
        const difference = newCost - originalCost;

        // Obtener usuario/empresa propietario de la vacante
        const company = await prisma.user.findUnique({
          where: { id: existingJob.userId! }
        });

        if (!company) {
          return NextResponse.json(
            { success: false, error: 'Usuario propietario de la vacante no encontrado' },
            { status: 404 }
          );
        }

        if (difference > 0) {
          // Cobrar diferencia - verificar créditos suficientes
          if (company.credits < difference) {
            return NextResponse.json(
              {
                success: false,
                error: `Créditos insuficientes. Necesitas ${difference} créditos adicionales para este cambio.`,
                required: difference,
                available: company.credits
              },
              { status: 402 }
            );
          }

          // Descontar créditos
          await prisma.user.update({
            where: { id: existingJob.userId! },
            data: { credits: { decrement: difference } }
          });

          // Registrar transacción de créditos
          await prisma.creditTransaction.create({
            data: {
              userId: existingJob.userId!,
              type: 'spend',
              amount: -difference,
              balanceBefore: company.credits,
              balanceAfter: company.credits - difference,
              description: `Ajuste por edición de vacante: ${existingJob.title} (${currentSeniority} → ${newSeniority})`,
              jobId: jobId
            }
          });

          creditChange = {
            original: originalCost,
            new: newCost,
            difference: difference,
            action: 'charged'
          };
        } else if (difference < 0) {
          // Devolver créditos (diferencia es negativa)
          const refundAmount = Math.abs(difference);

          await prisma.user.update({
            where: { id: existingJob.userId! },
            data: { credits: { increment: refundAmount } }
          });

          // Registrar transacción de créditos (devolución)
          await prisma.creditTransaction.create({
            data: {
              userId: existingJob.userId!,
              type: 'refund',
              amount: refundAmount,
              balanceBefore: company.credits,
              balanceAfter: company.credits + refundAmount,
              description: `Devolución por edición de vacante: ${existingJob.title} (${currentSeniority} → ${newSeniority})`,
              jobId: jobId
            }
          });

          creditChange = {
            original: originalCost,
            new: newCost,
            difference: difference,
            action: 'refunded'
          };
        }

        // Actualizar el creditCost del job
        newCreditCost = newCost;
      }
    }
    // ========== FIN VALIDACIÓN DE CRÉDITOS ==========

    // Actualizar vacante
    const updatedJob = await prisma.job.update({
      where: { id: jobId },
      data: {
        title,
        company,
        location,
        salary,
        salaryMin: salaryMin !== undefined ? (salaryMin ? parseInt(salaryMin) : null) : undefined,
        salaryMax: salaryMax !== undefined ? (salaryMax ? parseInt(salaryMax) : null) : undefined,
        jobType,
        workMode: workMode || 'presential',
        description,
        requirements: requirements || null,
        companyRating: companyRating || null,
        profile: profile || null,
        subcategory: subcategory || null,
        seniority: seniority || null,
        educationLevel: educationLevel || null,
        habilidades: habilidades || null,
        responsabilidades: responsabilidades || null,
        resultadosEsperados: resultadosEsperados || null,
        valoresActitudes: valoresActitudes || null,
        informacionAdicional: informacionAdicional || null,
        notasInternas: notasInternas || null,
        // Vacante confidencial
        ...(isConfidential !== undefined && { isConfidential }),
        // Actualizar creditCost si cambió
        ...(newCreditCost !== undefined && { creditCost: newCreditCost })
      }
    });

    // Construir mensaje de respuesta
    let message = 'Vacante actualizada exitosamente';
    if (creditChange) {
      if (creditChange.action === 'charged') {
        message = `Vacante actualizada. Se han cobrado ${creditChange.difference} créditos adicionales.`;
      } else if (creditChange.action === 'refunded') {
        message = `Vacante actualizada. Se han devuelto ${Math.abs(creditChange.difference)} créditos.`;
      }
    }

    return NextResponse.json({
      success: true,
      message,
      data: updatedJob,
      ...(creditChange && { creditChange })
    });
  } catch (error) {
    console.error('Error updating job:', error);
    return NextResponse.json(
      { success: false, error: 'Error al actualizar vacante' },
      { status: 500 }
    );
  }
}

// DELETE - Eliminar vacante
export async function DELETE(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const jobId = parseInt(id);

    if (isNaN(jobId)) {
      return NextResponse.json(
        { success: false, error: 'Invalid job ID' },
        { status: 400 }
      );
    }

    // Verificar que la vacante existe
    const existingJob = await prisma.job.findUnique({
      where: { id: jobId }
    });

    if (!existingJob) {
      return NextResponse.json(
        { success: false, error: 'Job not found' },
        { status: 404 }
      );
    }

    // Verificar autenticación y ownership
    const auth = await verifyJobOwnership(existingJob.userId);
    if (!auth.authenticated) {
      return NextResponse.json({ success: false, error: auth.error }, { status: 401 });
    }
    if (!auth.authorized) {
      return NextResponse.json({ success: false, error: auth.error }, { status: 403 });
    }

    // Eliminar vacante
    await prisma.job.delete({
      where: { id: jobId }
    });

    return NextResponse.json({
      success: true,
      message: 'Job deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting job:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to delete job' },
      { status: 500 }
    );
  }
}
