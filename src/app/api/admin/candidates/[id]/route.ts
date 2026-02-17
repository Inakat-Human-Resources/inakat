// RUTA: src/app/api/admin/candidates/[id]/route.ts

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/auth';
import { sanitizeMultilineText } from '@/lib/sanitize';

// Función auxiliar para calcular años de experiencia
function calcularAñosExperiencia(experiences: Array<{ fechaInicio: Date; fechaFin: Date | null }>): number {
  if (!experiences || experiences.length === 0) return 0;

  const today = new Date();
  let totalMonths = 0;

  for (const exp of experiences) {
    const start = new Date(exp.fechaInicio);
    const end = exp.fechaFin ? new Date(exp.fechaFin) : today;
    const months =
      (end.getFullYear() - start.getFullYear()) * 12 +
      (end.getMonth() - start.getMonth());
    totalMonths += Math.max(0, months);
  }

  return Math.round(totalMonths / 12);
}

/**
 * GET /api/admin/candidates/[id]
 * Obtener un candidato por ID con experiencias y documentos
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireRole('admin');
    if ('error' in auth) {
      return NextResponse.json(
        { success: false, error: auth.error },
        { status: auth.status }
      );
    }

    const { id } = await params;
    const candidateId = parseInt(id);

    if (isNaN(candidateId)) {
      return NextResponse.json(
        { success: false, error: 'ID de candidato inválido' },
        { status: 400 }
      );
    }

    const candidate = await prisma.candidate.findUnique({
      where: { id: candidateId },
      include: {
        experiences: {
          orderBy: { fechaInicio: 'desc' }
        },
        documents: {
          orderBy: { createdAt: 'desc' }
        },
        user: {
          select: {
            id: true,
            email: true,
            role: true
          }
        }
      }
    });

    if (!candidate) {
      return NextResponse.json(
        { success: false, error: 'Candidato no encontrado' },
        { status: 404 }
      );
    }

    // Calcular edad
    let edad = null;
    if (candidate.fechaNacimiento) {
      const today = new Date();
      const birth = new Date(candidate.fechaNacimiento);
      edad = today.getFullYear() - birth.getFullYear();
      const monthDiff = today.getMonth() - birth.getMonth();
      if (
        monthDiff < 0 ||
        (monthDiff === 0 && today.getDate() < birth.getDate())
      ) {
        edad--;
      }
    }

    return NextResponse.json({
      success: true,
      data: { ...candidate, edad }
    });
  } catch (error) {
    console.error('Error fetching candidate:', error);
    return NextResponse.json(
      { success: false, error: 'Error al obtener candidato' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/admin/candidates/[id]
 * Actualizar candidato (recalcula añosExperiencia si cambian experiencias)
 */
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireRole('admin');
    if ('error' in auth) {
      return NextResponse.json(
        { success: false, error: auth.error },
        { status: auth.status }
      );
    }

    const { id } = await params;
    const candidateId = parseInt(id);

    if (isNaN(candidateId)) {
      return NextResponse.json(
        { success: false, error: 'ID de candidato inválido' },
        { status: 400 }
      );
    }

    // Verificar que existe
    const existingCandidate = await prisma.candidate.findUnique({
      where: { id: candidateId },
      include: { experiences: true }
    });

    if (!existingCandidate) {
      return NextResponse.json(
        { success: false, error: 'Candidato no encontrado' },
        { status: 404 }
      );
    }

    const body = await request.json();
    const {
      nombre,
      apellidoPaterno,
      apellidoMaterno,
      email,
      telefono,
      sexo,
      fechaNacimiento,
      universidad,
      carrera,
      nivelEstudios,
      educacion, // FEATURE: Educación múltiple (array)
      profile,
      subcategory,
      seniority,
      cvUrl,
      portafolioUrl,
      linkedinUrl,
      source,
      notas,
      status,
      experiences // Array de experiencias (opcional)
    } = body;

    // Validar email único si se está cambiando
    if (email && email.toLowerCase() !== existingCandidate.email.toLowerCase()) {
      const emailExists = await prisma.candidate.findUnique({
        where: { email: email.toLowerCase() }
      });

      if (emailExists) {
        return NextResponse.json(
          {
            success: false,
            error: `Ya existe un candidato con ese email (ID: ${emailExists.id})`
          },
          { status: 409 }
        );
      }
    }

    // Preparar datos de actualización
    const updateData: any = {};

    if (nombre !== undefined) updateData.nombre = nombre;
    if (apellidoPaterno !== undefined) updateData.apellidoPaterno = apellidoPaterno;
    if (apellidoMaterno !== undefined) updateData.apellidoMaterno = apellidoMaterno || null;
    if (email !== undefined) updateData.email = email.toLowerCase();
    if (telefono !== undefined) updateData.telefono = telefono || null;
    if (sexo !== undefined) updateData.sexo = sexo || null;
    if (fechaNacimiento !== undefined) {
      updateData.fechaNacimiento = fechaNacimiento ? new Date(fechaNacimiento) : null;
    }
    if (universidad !== undefined) updateData.universidad = universidad || null;
    if (carrera !== undefined) updateData.carrera = carrera || null;
    if (nivelEstudios !== undefined) updateData.nivelEstudios = nivelEstudios || null;
    if (profile !== undefined) updateData.profile = profile || null;
    if (subcategory !== undefined) updateData.subcategory = subcategory || null;
    if (seniority !== undefined) updateData.seniority = seniority || null;
    if (cvUrl !== undefined) updateData.cvUrl = cvUrl || null;
    if (portafolioUrl !== undefined) updateData.portafolioUrl = portafolioUrl || null;
    if (linkedinUrl !== undefined) updateData.linkedinUrl = linkedinUrl || null;
    if (source !== undefined) updateData.source = source || 'manual';
    if (notas !== undefined) updateData.notas = notas ? sanitizeMultilineText(notas) : null;
    if (status !== undefined) updateData.status = status;

    // FEATURE: Educación múltiple - guardar JSON y sincronizar campos legacy
    if (educacion !== undefined) {
      updateData.educacion = educacion && educacion.length > 0 ? JSON.stringify(educacion) : null;
      // Sincronizar campos legacy con la primera educación
      if (educacion && educacion.length > 0) {
        updateData.universidad = educacion[0].institucion || null;
        updateData.carrera = educacion[0].carrera || null;
        updateData.nivelEstudios = educacion[0].nivel || null;
      } else {
        updateData.universidad = null;
        updateData.carrera = null;
        updateData.nivelEstudios = null;
      }
    }

    // Si vienen experiencias, eliminar las existentes y crear las nuevas
    if (experiences !== undefined) {
      // Eliminar experiencias existentes
      await prisma.experience.deleteMany({
        where: { candidateId }
      });

      // Crear nuevas experiencias
      if (experiences.length > 0) {
        await prisma.experience.createMany({
          data: experiences.map((exp: any) => ({
            candidateId,
            empresa: exp.empresa,
            puesto: exp.puesto,
            ubicacion: exp.ubicacion || null,
            fechaInicio: new Date(exp.fechaInicio),
            fechaFin: exp.fechaFin ? new Date(exp.fechaFin) : null,
            esActual: exp.esActual || false,
            descripcion: exp.descripcion || null
          }))
        });
      }

      // Recalcular años de experiencia
      updateData.añosExperiencia = calcularAñosExperiencia(
        experiences.map((exp: any) => ({
          fechaInicio: new Date(exp.fechaInicio),
          fechaFin: exp.fechaFin ? new Date(exp.fechaFin) : null
        }))
      );
    }

    // Actualizar candidato
    const updatedCandidate = await prisma.candidate.update({
      where: { id: candidateId },
      data: updateData,
      include: {
        experiences: {
          orderBy: { fechaInicio: 'desc' }
        },
        documents: {
          orderBy: { createdAt: 'desc' }
        },
        user: {
          select: {
            id: true,
            email: true,
            role: true
          }
        }
      }
    });

    return NextResponse.json({
      success: true,
      message: 'Candidato actualizado exitosamente',
      data: updatedCandidate
    });
  } catch (error) {
    console.error('Error updating candidate:', error);
    return NextResponse.json(
      { success: false, error: 'Error al actualizar candidato' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/admin/candidates/[id]
 * Eliminar candidato
 */
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireRole('admin');
    if ('error' in auth) {
      return NextResponse.json(
        { success: false, error: auth.error },
        { status: auth.status }
      );
    }

    const { id } = await params;
    const candidateId = parseInt(id);

    if (isNaN(candidateId)) {
      return NextResponse.json(
        { success: false, error: 'ID de candidato inválido' },
        { status: 400 }
      );
    }

    // Verificar que existe
    const candidate = await prisma.candidate.findUnique({
      where: { id: candidateId }
    });

    if (!candidate) {
      return NextResponse.json(
        { success: false, error: 'Candidato no encontrado' },
        { status: 404 }
      );
    }

    // Eliminar candidato (las experiencias y documentos se eliminan por cascade)
    await prisma.candidate.delete({
      where: { id: candidateId }
    });

    return NextResponse.json({
      success: true,
      message: 'Candidato eliminado exitosamente'
    });
  } catch (error) {
    console.error('Error deleting candidate:', error);
    return NextResponse.json(
      { success: false, error: 'Error al eliminar candidato' },
      { status: 500 }
    );
  }
}
