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

    // SEGURIDAD (#39 + #VAC): no publicar gratis desde PATCH.
    //
    // Un borrador nunca pagó créditos, así que para el owner es un callejón sin
    // salida: de `draft` sólo se sale por /api/jobs/publish, que valida y cobra.
    // Antes sólo se bloqueaba draft -> active, y como no hay máquina de estados
    // el bloqueo se rodeaba en dos pasos: draft -> paused -> active, que sí
    // estaba permitido porque el segundo salto ya no partía de un borrador.
    //
    // (No se usa `creditCost > 0` como prueba de pago: las vacantes anteriores al
    // cobro tienen 0 y dejarían a su dueño sin poder reanudarlas.)
    if (
      existingJob.status === 'draft' &&
      body.status !== undefined &&
      body.status !== 'draft' &&
      auth.role !== 'admin'
    ) {
      return NextResponse.json(
        {
          success: false,
          error: 'Para publicar/activar esta vacante usa el flujo de publicación (/api/jobs/publish), que valida y cobra los créditos correspondientes.'
        },
        { status: 403 }
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
    //
    // COBRO (#VAC): `profile`, `seniority` y `workMode` determinan el precio, y
    // PATCH no recalcula ni cobra nada. Estaban en la lista, así que se podía
    // publicar como junior/remoto (barato) y ascender después a senior/presencial
    // gratis. El que sí recalcula y cobra la diferencia es PUT, que es además lo
    // que usa el formulario de edición; desde PATCH sólo los toca un admin.
    const PRICE_FIELDS = ['profile', 'subcategory', 'seniority', 'workMode'];
    const allowedPatchFields = ['status', 'closedReason', 'title', 'company', 'location',
      'latitude', 'longitude', 'salary', 'salaryMin', 'salaryMax', 'jobType',
      'description', 'requirements', 'companyRating',
      'educationLevel', 'habilidades', 'responsabilidades', 'resultadosEsperados',
      'valoresActitudes', 'informacionAdicional', 'notasInternas', 'isConfidential',
      ...(auth.role === 'admin' ? PRICE_FIELDS : [])];

    if (auth.role !== 'admin') {
      const intentados = PRICE_FIELDS.filter((f) => body[f] !== undefined);
      if (intentados.length > 0) {
        return NextResponse.json(
          {
            success: false,
            error:
              'Especialidad, seniority y modalidad determinan el costo de la vacante: edítalos desde el formulario de la vacante, que recalcula y ajusta los créditos.',
            fields: intentados
          },
          { status: 400 }
        );
      }
    }
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

        // ATOMICIDAD (#VAC): el ajuste va en UNA transacción, y el cobro reclama
        // el saldo con una condición que resuelve la base de datos. Antes eran
        // `user.update` + `creditTransaction.create` sueltos sobre un saldo leído
        // antes: dos ediciones simultáneas devolvían los créditos dos veces
        // —acuñando créditos de la nada— o cobraban por debajo de cero.
        if (difference > 0) {
          try {
            const cobrado = await prisma.$transaction(async (tx) => {
              const claimed = await tx.user.updateMany({
                where: { id: existingJob.userId!, credits: { gte: difference } },
                data: { credits: { decrement: difference } }
              });

              if (claimed.count === 0) {
                const actual = await tx.user.findUnique({
                  where: { id: existingJob.userId! },
                  select: { credits: true }
                });
                return { ok: false as const, available: actual?.credits ?? 0 };
              }

              const after = await tx.user.findUnique({
                where: { id: existingJob.userId! },
                select: { credits: true }
              });
              const balanceAfter = after?.credits ?? 0;

              await tx.creditTransaction.create({
                data: {
                  userId: existingJob.userId!,
                  type: 'spend',
                  amount: -difference,
                  balanceBefore: balanceAfter + difference,
                  balanceAfter,
                  description: `Ajuste por edición de vacante: ${existingJob.title} (${currentSeniority} → ${newSeniority})`,
                  jobId: jobId
                }
              });

              return { ok: true as const };
            });

            if (!cobrado.ok) {
              return NextResponse.json(
                {
                  success: false,
                  error: `Créditos insuficientes. Necesitas ${difference} créditos adicionales para este cambio.`,
                  required: difference,
                  available: cobrado.available
                },
                { status: 402 }
              );
            }
          } catch (e) {
            console.error('Error cobrando el ajuste de la vacante:', e);
            return NextResponse.json(
              { success: false, error: 'No se pudo aplicar el ajuste de créditos' },
              { status: 500 }
            );
          }

          creditChange = {
            original: originalCost,
            new: newCost,
            difference: difference,
            action: 'charged'
          };
        } else if (difference < 0) {
          // Devolver créditos (diferencia es negativa).
          // El guard `creditCost: originalCost` es el que hace la devolución
          // idempotente: si otra petición ya devolvió y dejó el coste en newCost,
          // esta no encuentra la fila y no vuelve a devolver.
          const refundAmount = Math.abs(difference);

          try {
            const devuelto = await prisma.$transaction(async (tx) => {
              const claimed = await tx.job.updateMany({
                where: { id: jobId, creditCost: originalCost },
                data: { creditCost: newCost }
              });

              if (claimed.count === 0) return false;

              const after = await tx.user.update({
                where: { id: existingJob.userId! },
                data: { credits: { increment: refundAmount } },
                select: { credits: true }
              });

              await tx.creditTransaction.create({
                data: {
                  userId: existingJob.userId!,
                  type: 'refund',
                  amount: refundAmount,
                  balanceBefore: after.credits - refundAmount,
                  balanceAfter: after.credits,
                  description: `Devolución por edición de vacante: ${existingJob.title} (${currentSeniority} → ${newSeniority})`,
                  jobId: jobId
                }
              });

              return true;
            });

            if (!devuelto) {
              return NextResponse.json(
                {
                  success: false,
                  error: 'La vacante se modificó mientras se aplicaba el cambio. Vuelve a intentarlo.'
                },
                { status: 409 }
              );
            }
          } catch (e) {
            console.error('Error devolviendo créditos del ajuste:', e);
            return NextResponse.json(
              { success: false, error: 'No se pudo aplicar el ajuste de créditos' },
              { status: 500 }
            );
          }

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
