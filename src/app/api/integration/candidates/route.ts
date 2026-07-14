// RUTA: src/app/api/integration/candidates/route.ts
// Endpoint del puente para Worky2 (auth: header X-Api-Key).
// Devuelve los candidatos aceptados/contratados de la empresa dueña de la key,
// mapeados EXACTO al contrato compartido CandidatoInakat.

import { NextResponse } from 'next/server';
import { requireApiKey } from '@/lib/integration-auth';
import { loadCandidatosAceptados } from '@/lib/integration-candidate';
import { applyRateLimit, type RateLimitConfig } from '@/lib/rate-limit';

/** Consultas del sistema externo: 60 por minuto por IP */
const INTEGRATION_RATE_LIMIT: RateLimitConfig = {
  maxRequests: 60,
  windowSeconds: 60
};

/**
 * GET /api/integration/candidates?status=accepted
 * Header requerido: X-Api-Key: inak_<32 hex>
 * Respuesta: { success: true, data: CandidatoInakat[] }
 */
export async function GET(request: Request) {
  try {
    const blocked = applyRateLimit(request, 'integration-candidates', INTEGRATION_RATE_LIMIT);
    if (blocked) return blocked;

    const auth = await requireApiKey(request);
    if ('error' in auth) {
      return NextResponse.json(
        { success: false, error: auth.error },
        { status: auth.status }
      );
    }

    // Único status soportado por el contrato v1: accepted
    const url = new URL(request.url);
    const status = url.searchParams.get('status') ?? 'accepted';
    if (status !== 'accepted') {
      return NextResponse.json(
        {
          success: false,
          error: 'Status no soportado. El único valor válido es "accepted".'
        },
        { status: 400 }
      );
    }

    const candidatos = await loadCandidatosAceptados(auth.apiKey.userId);

    return NextResponse.json({
      success: true,
      data: candidatos
    });
  } catch (error) {
    console.error('[Integration] Error listando candidatos aceptados:', error);
    return NextResponse.json(
      { success: false, error: 'Error al obtener los candidatos' },
      { status: 500 }
    );
  }
}
