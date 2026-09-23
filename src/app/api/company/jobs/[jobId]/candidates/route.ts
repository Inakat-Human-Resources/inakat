// RUTA: src/app/api/company/jobs/[jobId]/candidates/route.ts

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { COMPANY_VISIBLE_STATUSES } from '@/lib/authz-applications';
import { requireApprovedCompany } from '@/lib/auth';

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

    // AUTORIZACIÓN: esta ruta entrega nombre, correo, teléfono y documentos de
    // los candidatos. La cuenta de empresa se crea sola al registrarse, así que
    // sin comprobar la aprobación del admin una empresa inventada (o ya
    // rechazada) seguía cosechando datos personales.
    const aprobacion = await requireApprovedCompany(companyUserId, userRole);
    if (aprobacion) {
      return NextResponse.json(
        { success: false, error: aprobacion.error, code: aprobacion.code },
        { status: aprobacion.status }
      );
    }

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
        userId: true,
        habilidades: true,
        latitude: true,
        longitude: true
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

    // Obtener aplicaciones de la vacante (COMPANY_VISIBLE_STATUSES vive en
    // src/lib/authz-applications.ts; estaba duplicada a mano en cuatro rutas)
    const applications = await prisma.application.findMany({
      where: {
        jobId: jobId,
        status: { in: [...COMPANY_VISIBLE_STATUSES] }
      },
      orderBy: { createdAt: 'desc' }
    });

    // =========================================================================
    // RENDIMIENTO: esta ruta hermana se quedó con el patrón N+1 que el
    // dashboard de empresa ya había eliminado: por cada postulación lanzaba un
    // candidate.findFirst (con `mode: 'insensitive'`, que no usa el índice
    // único de email → seq scan) y un evaluationNote.findMany, todos a la vez
    // dentro de un Promise.all. Con 40 candidatos eran 80+ consultas
    // simultáneas contra un pool serverless pequeño → P2024 y 500 en el flujo
    // principal de la empresa. Ahora son 3 consultas y dos Maps en memoria.
    // =========================================================================
    const applicationIds = applications.map((app) => app.id);
    const uniqueEmails = [
      ...new Set(applications.map((app) => app.candidateEmail.toLowerCase()))
    ];

    const [candidates, publicNotes] = await Promise.all([
      uniqueEmails.length > 0
        ? prisma.candidate.findMany({
            where: { email: { in: uniqueEmails, mode: 'insensitive' } },
            include: {
              experiences: {
                orderBy: { fechaInicio: 'desc' },
                take: 3
              },
              // `select` explícito: la empresa recibe la lista de documentos
              // del candidato para poder abrirlos, pero no las marcas de
              // tiempo ni el candidateId interno.
              documents: {
                select: { id: true, name: true, fileUrl: true, fileType: true }
              }
            }
          })
        : Promise.resolve([]),
      applicationIds.length > 0
        ? prisma.evaluationNote.findMany({
            where: {
              applicationId: { in: applicationIds },
              isPublic: true,
            },
            orderBy: { createdAt: 'desc' },
            include: {
              author: {
                select: { nombre: true, apellidoPaterno: true }
              }
            }
          })
        : Promise.resolve([])
    ]);

    const candidateMap = new Map(candidates.map((c) => [c.email.toLowerCase(), c]));

    // Notas públicas ya mapeadas a la forma que se devuelve, agrupadas por
    // aplicación: así el enriquecido de abajo no vuelve a recorrerlas todas.
    interface NotaPublicaDTO {
      id: number;
      authorRole: string;
      authorName: string;
      content: string;
      documentUrl: string | null;
      documentName: string | null;
      createdAt: Date;
    }

    const notesByApplication = new Map<number, NotaPublicaDTO[]>();
    for (const note of publicNotes) {
      const dto: NotaPublicaDTO = {
        id: note.id,
        authorRole: note.authorRole,
        authorName: `${note.author.nombre} ${note.author.apellidoPaterno || ''}`.trim(),
        content: note.content,
        documentUrl: note.documentUrl,
        documentName: note.documentName,
        createdAt: note.createdAt,
      };
      const acumuladas = notesByApplication.get(note.applicationId);
      if (acumuladas) {
        acumuladas.push(dto);
      } else {
        notesByApplication.set(note.applicationId, [dto]);
      }
    }

    // Enriquecer aplicaciones con datos del candidato (sin más consultas)
    const enrichedApplications = applications.map((app) => {
        const candidate = candidateMap.get(app.candidateEmail.toLowerCase());
        const publicEvaluationNotes = notesByApplication.get(app.id) ?? [];

        return {
          id: app.id,
          candidateName: app.candidateName,
          candidateEmail: app.candidateEmail,
          candidatePhone: app.candidatePhone,
          status: app.status,
          createdAt: app.createdAt,
          cvUrl: app.cvUrl,
          coverLetter: app.coverLetter,
          // PRIVACIDAD (#50/#51): `notes` son las notas internas de INAKAT sobre
          // la postulación y no se envían a la empresa. Lo que sí ve son las
          // notas de evaluación marcadas como públicas.
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
                // PRIVACIDAD (#50/#51): `notas` del candidato son internas del admin.
                educacion: candidate.educacion, // FEATURE: Educación múltiple
                fotoUrl: candidate.fotoUrl, // FEAT-2: Foto de perfil
                cartaPresentacion: candidate.cartaPresentacion || null,
                experiences: candidate.experiences,
                documents: candidate.documents,
                latitude: candidate.latitude,
                longitude: candidate.longitude
              }
            : null
        };
    });

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
