// RUTA: src/app/api/company/jobs/[jobId]/candidates/route.ts

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

/**
 * GET /api/company/jobs/[jobId]/candidates
 * Obtiene una vacante específica y sus candidatos para la empresa
 * Solo muestra candidatos con status visibles para la empresa
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ jobId: string }> }
) {
  try {
    const { jobId: jobIdParam } = await params;
    const jobId = parseInt(jobIdParam);

    if (isNaN(jobId)) {
      return NextResponse.json(
        { success: false, error: 'ID de vacante inválido' },
        { status: 400 }
      );
    }

    // Obtener userId de los headers (agregado por middleware)
    const userId = request.headers.get('x-user-id');
    const userRole = request.headers.get('x-user-role');

    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'No autenticado' },
        { status: 401 }
      );
    }

    if (userRole !== 'company' && userRole !== 'admin') {
      return NextResponse.json(
        { success: false, error: 'Acceso denegado' },
        { status: 403 }
      );
    }

    const companyUserId = parseInt(userId);

    // Buscar la vacante
    const job = await prisma.job.findUnique({
      where: { id: jobId },
      select: {
        id: true,
        title: true,
        company: true,
        location: true,
        salary: true,
        status: true,
        profile: true,
        seniority: true,
        createdAt: true,
        userId: true
      }
    });

    if (!job) {
      return NextResponse.json(
        { success: false, error: 'Vacante no encontrada' },
        { status: 404 }
      );
    }

    // Verificar que la vacante pertenece a la empresa (o es admin)
    if (job.userId !== companyUserId && userRole !== 'admin') {
      return NextResponse.json(
        { success: false, error: 'No tienes permiso para ver esta vacante' },
        { status: 403 }
      );
    }

    // Status de aplicaciones visibles para la empresa
    const COMPANY_VISIBLE_STATUSES = [
      'sent_to_company',
      'company_interested',
      'interviewed',
      'accepted',
      'rejected'
    ];

    // Obtener aplicaciones de la vacante
    const applications = await prisma.application.findMany({
      where: {
        jobId: jobId,
        status: { in: COMPANY_VISIBLE_STATUSES }
      },
      orderBy: { createdAt: 'desc' }
    });

    // Enriquecer aplicaciones con datos del candidato
    const enrichedApplications = await Promise.all(
      applications.map(async (app) => {
        // Buscar candidato por email
        const candidate = await prisma.candidate.findFirst({
          where: { email: { equals: app.candidateEmail, mode: 'insensitive' } },
          include: {
            experiences: {
              orderBy: { fechaInicio: 'desc' },
              take: 3
            },
            documents: true
          }
        });

        // Obtener notas públicas de evaluación para esta aplicación
        const publicNotes = await prisma.evaluationNote.findMany({
          where: {
            applicationId: app.id,
            isPublic: true,
          },
          orderBy: { createdAt: 'desc' },
          include: {
            author: {
              select: { nombre: true, apellidoPaterno: true }
            }
          }
        });

        const publicEvaluationNotes = publicNotes.map(note => ({
          id: note.id,
          authorRole: note.authorRole,
          authorName: `${note.author.nombre} ${note.author.apellidoPaterno || ''}`.trim(),
          content: note.content,
          documentUrl: note.documentUrl,
          documentName: note.documentName,
          createdAt: note.createdAt,
        }));

        return {
          id: app.id,
          candidateName: app.candidateName,
          candidateEmail: app.candidateEmail,
          candidatePhone: app.candidatePhone,
          status: app.status,
          createdAt: app.createdAt,
          cvUrl: app.cvUrl,
          coverLetter: app.coverLetter,
          notes: app.notes,
          publicEvaluationNotes,
          candidateProfile: candidate
            ? {
                id: candidate.id,
                nombre: candidate.nombre,
                apellidoPaterno: candidate.apellidoPaterno,
                apellidoMaterno: candidate.apellidoMaterno,
                email: candidate.email,
                telefono: candidate.telefono,
                sexo: candidate.sexo,
                fechaNacimiento: candidate.fechaNacimiento,
                universidad: candidate.universidad,
                carrera: candidate.carrera,
                nivelEstudios: candidate.nivelEstudios,
                añosExperiencia: candidate.añosExperiencia,
                profile: candidate.profile,
                seniority: candidate.seniority,
                cvUrl: candidate.cvUrl,
                linkedinUrl: candidate.linkedinUrl,
                portafolioUrl: candidate.portafolioUrl,
                notas: candidate.notas,
                educacion: candidate.educacion, // FEATURE: Educación múltiple
                fotoUrl: candidate.fotoUrl, // FEAT-2: Foto de perfil
                experiences: candidate.experiences,
                documents: candidate.documents
              }
            : null
        };
      })
    );

    return NextResponse.json({
      success: true,
      data: {
        job,
        applications: enrichedApplications
      }
    });
  } catch (error) {
    console.error('Error fetching job candidates:', error);
    return NextResponse.json(
      { success: false, error: 'Error al obtener candidatos' },
      { status: 500 }
    );
  }
}
