// RUTA: src/app/api/integration/candidates/route.ts
// Endpoint del puente para Worky2 (auth: header X-Api-Key).
// Devuelve los candidatos aceptados/contratados de la empresa dueña de la key,
// mapeados EXACTO al contrato compartido CandidatoInakat.

import { NextResponse } from 'next/server';
import { requireApiKey } from '@/lib/integration-auth';
import { loadCandidatosAceptados } from '@/lib/integration-candidate';
import { applyRateLimit, checkRateLimit, type RateLimitConfig } from '@/lib/rate-limit';
import { getPaginationParams, buildPaginatedResponse } from '@/lib/pagination';

/**
 * Worky2 es multi-tenant y llama desde sus propios servidores, es decir, desde
 * una o pocas IPs para TODAS las empresas. Por eso hay dos límites:
 *  - por IP, alto, sólo como cortafuegos contra fuerza bruta;
 *  - por API key, el funcional, que es lo que de verdad reparte la cuota.
 * Con un único límite por IP, la sincronización de una empresa agotaba la de
 * las demás y todas recibían 429 habiendo hecho una sola llamada.
 */
const INTEGRATION_IP_RATE_LIMIT: RateLimitConfig = {
  maxRequests: 600,
  windowSeconds: 60
};

/** Consultas del sistema externo: 60 por minuto por API key. */
const INTEGRATION_KEY_RATE_LIMIT: RateLimitConfig = {
  maxRequests: 60,
  windowSeconds: 60
};

/**
 * GET /api/integration/candidates?status=accepted&page=1&limit=50&since=<ISO>
 * Header requerido: X-Api-Key: inak_<32 hex>
 * Respuesta: { success: true, data: CandidatoInakat[], pagination: {...} }
 */
export async function GET(request: Request) {
  try {
    const blocked = applyRateLimit(request, 'integration-candidates', INTEGRATION_IP_RATE_LIMIT);
    if (blocked) return blocked;

    const auth = await requireApiKey(request);
    if ('error' in auth) {
      return NextResponse.json(
        { success: false, error: auth.error },
        { status: auth.status }
      );
    }

    const porKey = checkRateLimit(
      `integration-key:${auth.apiKey.id}`,
      INTEGRATION_KEY_RATE_LIMIT
    );
    if (!porKey.success) {
      return NextResponse.json(
        {
          success: false,
          error: 'Demasiadas solicitudes para esta API key. Intenta de nuevo en unos segundos.',
          retryAfterSeconds: porKey.resetInSeconds
        },
        { status: 429, headers: { 'Retry-After': porKey.resetInSeconds.toString() } }
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

    // Filtro incremental opcional: sólo lo revisado a partir de esa fecha.
    const sinceRaw = url.searchParams.get('since');
    let since: Date | null = null;
    if (sinceRaw) {
      const fecha = new Date(sinceRaw);
      if (Number.isNaN(fecha.getTime())) {
        return NextResponse.json(
          { success: false, error: 'El parámetro "since" debe ser una fecha ISO 8601.' },
          { status: 400 }
        );
      }
      since = fecha;
    }

    const paginacion = getPaginationParams(url.searchParams, 50, 100);

    const { candidatos, total } = await loadCandidatosAceptados(auth.apiKey.userId, {
      page: paginacion.page,
      limit: paginacion.limit,
      since
    });

    return NextResponse.json({
      success: true,
      ...buildPaginatedResponse(candidatos, total, paginacion)
    });
  } catch (error) {
    console.error('[Integration] Error listando candidatos aceptados:', error);
    return NextResponse.json(
      { success: false, error: 'Error al obtener los candidatos' },
      { status: 500 }
    );
  }
}
