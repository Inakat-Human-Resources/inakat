// RUTA: src/app/api/admin/assign-candidates/route.ts

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// POST - Asignar candidatos a una vacante
// Crea Applications con status "injected_by_admin"
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { jobId, candidateIds } = body;

    // Validaciones básicas
    if (!jobId) {
      return NextResponse.json(
        { success: false, error: 'El jobId es requerido' },
        { status: 400 }
      );
    }

    if (!candidateIds || !Array.isArray(candidateIds) || candidateIds.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Debes seleccionar al menos un candidato' },
        { status: 400 }
      );
    }

    // Verificar que la vacante existe
    const job = await prisma.job.findUnique({
      where: { id: parseInt(jobId) }
    });

    if (!job) {
      return NextResponse.json(
        { success: false, error: 'La vacante no existe' },
        { status: 404 }
      );
    }

    // Obtener los candidatos
    const candidates = await prisma.candidate.findMany({
      where: {
        id: { in: candidateIds.map((id: number) => parseInt(String(id))) }
      }
    });

    if (candidates.length === 0) {
      return NextResponse.json(
        { success: false, error: 'No se encontraron candidatos válidos' },
        { status: 404 }
      );
    }

    // Verificar cuáles candidatos ya están asignados a esta vacante
    const existingApplications = await prisma.application.findMany({
      where: {
        jobId: parseInt(jobId),
        candidateEmail: {
          in: candidates.map(c => c.email.toLowerCase())
        }
      },
      select: { candidateEmail: true }
    });

    const existingEmails = new Set(existingApplications.map(a => a.candidateEmail.toLowerCase()));

    // Filtrar candidatos que no estén ya asignados
    const candidatesToAssign = candidates.filter(
      c => !existingEmails.has(c.email.toLowerCase())
    );

    if (candidatesToAssign.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: 'Todos los candidatos seleccionados ya están asignados a esta vacante'
        },
        { status: 409 }
      );
    }

    // Crear las aplicaciones
    const applications = await prisma.application.createMany({
      data: candidatesToAssign.map(candidate => ({
        jobId: parseInt(jobId),
        candidateName: `${candidate.nombre} ${candidate.apellidoPaterno}${candidate.apellidoMaterno ? ' ' + candidate.apellidoMaterno : ''}`,
        candidateEmail: candidate.email.toLowerCase(),
        candidatePhone: candidate.telefono,
        cvUrl: candidate.cvUrl,
        status: 'injected_by_admin',
        notes: `Candidato inyectado por Admin. Fuente original: ${candidate.source}. Perfil: ${candidate.profile || 'N/A'}. Seniority: ${candidate.seniority || 'N/A'}.`
      }))
    });

    // Actualizar el status de los candidatos a "in_process"
    await prisma.candidate.updateMany({
      where: {
        id: { in: candidatesToAssign.map(c => c.id) }
      },
      data: {
        status: 'in_process'
      }
    });

    // Obtener las aplicaciones creadas para retornarlas
    const createdApplications = await prisma.application.findMany({
      where: {
        jobId: parseInt(jobId),
        candidateEmail: {
          in: candidatesToAssign.map(c => c.email.toLowerCase())
        },
        status: 'injected_by_admin'
      },
      include: {
        job: {
          select: {
            id: true,
            title: true,
            company: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    const skippedCount = candidates.length - candidatesToAssign.length;

    return NextResponse.json({
      success: true,
      message: `${candidatesToAssign.length} candidato(s) asignado(s) exitosamente${skippedCount > 0 ? `. ${skippedCount} ya estaban asignados.` : ''}`,
      data: {
        assigned: createdApplications,
        assignedCount: candidatesToAssign.length,
        skippedCount
      }
    }, { status: 201 });

  } catch (error) {
    console.error('Error assigning candidates:', error);
    return NextResponse.json(
      { success: false, error: 'Error al asignar candidatos' },
      { status: 500 }
    );
  }
}

// GET - Obtener candidatos ya asignados a una vacante
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const jobId = searchParams.get('jobId');

    if (!jobId) {
      return NextResponse.json(
        { success: false, error: 'El jobId es requerido' },
        { status: 400 }
      );
    }

    const applications = await prisma.application.findMany({
      where: {
        jobId: parseInt(jobId),
        status: 'injected_by_admin'
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    return NextResponse.json({
      success: true,
      data: applications,
      count: applications.length
    });

  } catch (error) {
    console.error('Error fetching assigned candidates:', error);
    return NextResponse.json(
      { success: false, error: 'Error al obtener candidatos asignados' },
      { status: 500 }
    );
  }
}
