// RUTA: src/app/api/candidate/applications/route.ts

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyToken } from '@/lib/auth';
import { cookies } from 'next/headers';

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

    // Buscar aplicaciones por el email del candidato
    const applications = await prisma.application.findMany({
      where: {
        candidateEmail: candidate.email.toLowerCase()
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
            seniority: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    // Mapear los status a labels amigables para el candidato
    const applicationsWithLabels = applications.map(app => {
      let statusLabel = '';
      let statusColor = '';

      switch (app.status) {
        case 'pending':
        case 'injected_by_admin':
          statusLabel = 'En revisión';
          statusColor = 'yellow';
          break;
        case 'reviewing':
        case 'sent_to_specialist':
          statusLabel = 'En proceso';
          statusColor = 'blue';
          break;
        case 'sent_to_company':
          statusLabel = 'Enviado a empresa';
          statusColor = 'purple';
          break;
        case 'interviewed':
          statusLabel = 'Entrevistado';
          statusColor = 'indigo';
          break;
        case 'accepted':
          statusLabel = 'Aceptado';
          statusColor = 'green';
          break;
        case 'rejected':
          statusLabel = 'No seleccionado';
          statusColor = 'gray';
          break;
        default:
          statusLabel = 'En revisión';
          statusColor = 'yellow';
      }

      return {
        ...app,
        statusLabel,
        statusColor,
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
