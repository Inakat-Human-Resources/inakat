// RUTA: src/app/api/applications/check/route.ts

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

/**
 * GET /api/applications/check
 * Verifica si un email ya aplicó a una vacante específica
 * Query params: jobId, email
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const jobId = searchParams.get('jobId');
    const email = searchParams.get('email');

    // Validar parámetros requeridos
    if (!jobId || !email) {
      return NextResponse.json(
        { success: false, error: 'Parámetros requeridos: jobId, email' },
        { status: 400 }
      );
    }

    // Buscar aplicación existente
    const existingApplication = await prisma.application.findFirst({
      where: {
        jobId: parseInt(jobId),
        candidateEmail: email.toLowerCase()
      },
      select: {
        id: true,
        status: true,
        createdAt: true
      }
    });

    if (existingApplication) {
      // Mapear status a label amigable
      const statusLabels: Record<string, string> = {
        pending: 'En revisión',
        injected_by_admin: 'En revisión',
        reviewing: 'En proceso',
        sent_to_specialist: 'En proceso',
        sent_to_company: 'Enviado a empresa',
        interviewed: 'Entrevistado',
        accepted: 'Aceptado',
        rejected: 'No seleccionado'
      };

      return NextResponse.json({
        success: true,
        hasApplied: true,
        application: {
          id: existingApplication.id,
          status: existingApplication.status,
          statusLabel: statusLabels[existingApplication.status] || 'En proceso',
          appliedAt: existingApplication.createdAt
        }
      });
    }

    return NextResponse.json({
      success: true,
      hasApplied: false
    });

  } catch (error) {
    console.error('Error checking application:', error);
    return NextResponse.json(
      { success: false, error: 'Error al verificar aplicación' },
      { status: 500 }
    );
  }
}
