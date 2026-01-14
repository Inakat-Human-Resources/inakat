import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

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
      where: { id: jobId }
    });

    if (!job) {
      return NextResponse.json(
        { success: false, error: 'Job not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, data: job });
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

    // Preparar datos para actualizar (convertir salaryMin/salaryMax a Int si existen)
    const updateData = { ...body };
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
      habilidades,
      responsabilidades,
      resultadosEsperados,
      valoresActitudes,
      informacionAdicional
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
        habilidades: habilidades || null,
        responsabilidades: responsabilidades || null,
        resultadosEsperados: resultadosEsperados || null,
        valoresActitudes: valoresActitudes || null,
        informacionAdicional: informacionAdicional || null
      }
    });

    return NextResponse.json({
      success: true,
      message: 'Vacante actualizada exitosamente',
      data: updatedJob
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
