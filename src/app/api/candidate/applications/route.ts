// RUTA: src/app/api/candidate/applications/route.ts

import { NextResponse } from 'next/server';
import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { verifyToken } from '@/lib/auth';
import { cookies } from 'next/headers';
import { getCandidateStatusView } from '@/lib/application-status';
import { publicConfidentialLocation } from '@/lib/jobs-public';

/**
 * GET /api/candidate/applications
 * Obtener las postulaciones del candidato autenticado
 */
export async function GET() {
  try {
    // Verificar autenticación
    const cookieStore = await cookies();
    const token = cookieStore.get('auth-token')?.value;

    if (!token) {
      return NextResponse.json(
        { success: false, error: 'No autenticado' },
        { status: 401 }
      );
    }

    const payload = verifyToken(token);
    if (!payload?.userId) {
      return NextResponse.json(
        { success: false, error: 'Token inválido' },
        { status: 401 }
      );
    }

    // Verificar que el usuario es candidato
    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
      include: {
        candidate: true
      }
    });

    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Usuario no encontrado' },
        { status: 404 }
      );
    }

    if (user.role !== 'candidate' && user.role !== 'admin') {
      return NextResponse.json(
        { success: false, error: 'Acceso denegado' },
        { status: 403 }
      );
    }

    // Obtener el candidato asociado al usuario
    const candidate = await prisma.candidate.findUnique({
      where: { userId: payload.userId }
    });

    if (!candidate) {
      return NextResponse.json(
        { success: false, error: 'No tienes un perfil de candidato asociado' },
        { status: 404 }
      );
    }

    // Buscar aplicaciones del candidato.
    //
    // CORRECTNESS (#VAC): se buscaba SÓLO por `Candidate.email`, pero la
    // postulación rápida se guarda con el email del `User` (ApplyJobModal manda
    // profile.email) y con su userId. Si el admin corrige el correo en
    // /admin/candidates (PUT /api/admin/candidates/[id] toca Candidate.email sin
    // tocar User.email), los dos divergen y "Mis Postulaciones" sale vacío
    // aunque el control de duplicados sí detecte la postulación.
    //
    // PRIVACIDAD (AUTH-001): pero el vínculo POR EMAIL sólo vale si la cuenta
    // demostró que controla ese correo. El registro no lo verifica, así que
    // cualquiera podía darse de alta con el correo de otra persona y leer aquí
    // las postulaciones que ella hizo como invitada (CV, teléfono, carta).
    // Mientras `emailVerified` sea null, sólo cuentan las hechas con la sesión.
    const criterios: Prisma.ApplicationWhereInput[] = [{ userId: user.id }];

    if (user.emailVerified) {
      const emailsDelCandidato = Array.from(
        new Set([candidate.email.toLowerCase(), user.email.toLowerCase()])
      );
      criterios.push({ candidateEmail: { in: emailsDelCandidato } });
    }

    const applications = await prisma.application.findMany({
      where: {
        OR: criterios
      },
      include: {
        job: {
          select: {
            id: true,
            title: true,
            company: true,
            location: true,
            salary: true,
            jobType: true,
            workMode: true,
            status: true,
            profile: true,
            seniority: true,
            isConfidential: true,
            user: {
              select: {
                companyRequest: {
                  select: { logoUrl: true }
                }
              }
            }
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    // Sanitizar vacantes confidenciales y agregar logoUrl
    const sanitizedApplications = applications.map(app => {
      const logoUrl = app.job?.user?.companyRequest?.logoUrl || null;
      // Remover user anidado del job
      const jobWithoutUser = app.job ? {
        id: app.job.id,
        title: app.job.title,
        company: app.job.company,
        location: app.job.location,
        salary: app.job.salary,
        jobType: app.job.jobType,
        workMode: app.job.workMode,
        status: app.job.status,
        profile: app.job.profile,
        seniority: app.job.seniority,
        isConfidential: app.job.isConfidential,
        logoUrl: app.job.isConfidential ? null : logoUrl, // Ocultar logo si es confidencial
      } : null;

      if (app.job?.isConfidential) {
        return {
          ...app,
          job: {
            ...jobWithoutUser,
            company: 'Empresa Confidencial',
            // PRIVACIDAD (#VAC-022): una dirección sin comas se devolvía
            // COMPLETA al candidato. Mismo helper que el listado público.
            location: publicConfidentialLocation(app.job.location),
            logoUrl: null, // Asegurar que el logo esté oculto
          }
        };
      }
      return { ...app, job: jobWithoutUser };
    });

    // Mapear los status a labels amigables para el candidato.
    //
    // ETIQUETAS (#VAC): el switch cubría 8 de los 12 estados y el resto caía en
    // el default "En revisión": a un candidato descartado por el reclutador
    // (`discarded`) se le decía "En revisión" indefinidamente, y cuando la
    // empresa mostraba interés (`company_interested`) la etiqueta RETROCEDÍA de
    // "Enviado a empresa" a "En revisión". Ahora sale del mapa compartido, que
    // cubre los 12 y es el mismo que usan /my-applications y el modal.
    const applicationsWithLabels = sanitizedApplications.map(app => {
      const vista = getCandidateStatusView(app.status);

      return {
        ...app,
        statusLabel: vista.label,
        statusColor: vista.color,
        // No mostrar notas internas al candidato, solo notas públicas si las hubiera
        notes: null
      };
    });

    return NextResponse.json({
      success: true,
      data: applicationsWithLabels,
      count: applicationsWithLabels.length,
      candidate: {
        id: candidate.id,
        nombre: candidate.nombre,
        email: candidate.email
      }
    });

  } catch (error) {
    console.error('Error fetching candidate applications:', error);
    return NextResponse.json(
      { success: false, error: 'Error al obtener postulaciones' },
      { status: 500 }
    );
  }
}
