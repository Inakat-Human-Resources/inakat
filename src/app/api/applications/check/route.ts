// RUTA: src/app/api/applications/check/route.ts

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';

/**
 * GET /api/applications/check
 * Verifica si la persona autenticada ya postuló a una vacante.
 * Query params: jobId
 *
 * PRIVACIDAD: esta ruta era pública y recibía el email por query, así que
 * respondía si CUALQUIER persona había postulado a una vacante y en qué estado
 * iba — un oráculo para quien tuviera una lista de correos. El email ya no se
 * acepta por parámetro: sale de la sesión, que es lo que su único consumidor
 * (ApplyJobModal) hacía de todos modos.
 */
export async function GET(request: Request) {
  try {
    const auth = await requireAuth();
    if ('error' in auth) {
      return NextResponse.json(
        { success: false, error: auth.error },
        { status: auth.status }
      );
    }

    const { searchParams } = new URL(request.url);
    const jobId = searchParams.get('jobId');

    if (!jobId || Number.isNaN(parseInt(jobId))) {
      return NextResponse.json(
        { success: false, error: 'Parámetro requerido: jobId' },
        { status: 400 }
      );
    }

    // Buscar aplicación existente
    const existingApplication = await prisma.application.findFirst({
      where: {
        jobId: parseInt(jobId),
        candidateEmail: auth.user.email.toLowerCase()
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
