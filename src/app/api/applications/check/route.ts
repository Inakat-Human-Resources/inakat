// RUTA: src/app/api/applications/check/route.ts

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';
import { getCandidateStatusLabel } from '@/lib/application-status';
import { parseId } from '@/lib/pagination';

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
    const jobId = parseId(searchParams.get('jobId'));

    if (jobId === null) {
      return NextResponse.json(
        { success: false, error: 'Parámetro requerido: jobId' },
        { status: 400 }
      );
    }

    // PRIVACIDAD (#VAC, mismo criterio que AUTH-001 en /api/my-applications):
    // el vínculo POR EMAIL sólo vale si la cuenta demostró que controla ese
    // correo. Sin verificar, quien se registrara con el correo de otra persona
    // podía preguntar aquí, vacante por vacante, si ella había postulado como
    // invitada y en qué estado iba. Sin verificar sólo cuenta lo hecho con la
    // sesión (userId).
    const cuenta = await prisma.user.findUnique({
      where: { id: auth.user.id },
      select: { emailVerified: true }
    });

    const criterios: Array<{ userId: number } | { candidateEmail: string }> = [
      { userId: auth.user.id }
    ];
    if (cuenta?.emailVerified) {
      criterios.push({ candidateEmail: auth.user.email.toLowerCase() });
    }

    // Buscar aplicación existente
    const existingApplication = await prisma.application.findFirst({
      where: {
        jobId,
        OR: criterios
      },
      select: {
        id: true,
        status: true,
        createdAt: true
      }
    });

    if (existingApplication) {
      // ETIQUETAS (#VAC): esta ruta tenía su propio mapa, incompleto y distinto
      // del de /api/candidate/applications y del de la página /my-applications
      // (aquí el default era "En proceso", allá "En revisión" y "Pendiente"), de
      // modo que la MISMA postulación se llamaba de tres formas según la
      // pantalla. El mapa vive ahora en src/lib/application-status.ts.
      return NextResponse.json({
        success: true,
        hasApplied: true,
        application: {
          id: existingApplication.id,
          status: existingApplication.status,
          statusLabel: getCandidateStatusLabel(existingApplication.status),
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
