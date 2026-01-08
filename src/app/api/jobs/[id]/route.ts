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

    // Actualizar vacante
    const updatedJob = await prisma.job.update({
      where: { id: jobId },
      data: body
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

    // Actualizar vacante
    const updatedJob = await prisma.job.update({
      where: { id: jobId },
      data: {
        title,
        company,
        location,
        salary,
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
