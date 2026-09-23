// RUTA: src/app/api/pricing/calculate/route.ts

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { calculateJobCreditCost } from '@/lib/pricing';

/**
 * POST /api/pricing/calculate
 * Calcula el costo en créditos de una vacante según la matriz de precios
 *
 * Body: { profile, seniority, workMode }
 * Response: { credits, found, pricing }
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { profile, seniority, workMode } = body ?? {};

    // VALIDACIÓN (#PAGO): la ruta es pública y sólo comprobaba truthiness. Un
    // {"profile":{"not":""}} es un filtro válido de Prisma y se ejecutaba tal
    // cual: devolvía la primera fila de la matriz sin autenticar. Un número o un
    // array daba 500. Se exige string con longitud razonable.
    const esTextoValido = (valor: unknown): valor is string =>
      typeof valor === 'string' && valor.trim().length > 0 && valor.length <= 200;

    if (!esTextoValido(profile) || !esTextoValido(seniority) || !esTextoValido(workMode)) {
      return NextResponse.json(
        {
          success: false,
          error: 'Campos requeridos (texto): profile, seniority, workMode'
        },
        { status: 400 }
      );
    }

    // Usar la función helper centralizada para calcular el costo
    const result = await calculateJobCreditCost(profile, seniority, workMode);

    if (!result.found) {
      return NextResponse.json({
        success: true,
        found: false,
        credits: result.credits,
        message: 'No se encontró precio específico, usando valor por defecto',
        query: { profile, seniority, workMode }
      });
    }

    return NextResponse.json({
      success: true,
      found: true,
      credits: result.credits,
      pricingId: result.pricingId,
      minSalary: result.minSalary
    });
  } catch (error) {
    console.error('Error calculating price:', error);
    return NextResponse.json(
      { success: false, error: 'Error al calcular precio' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/pricing/calculate
 * Obtener los valores disponibles para la matriz de precios
 */
export async function GET() {
  try {
    // Obtener valores únicos de la matriz
    const profiles = await prisma.pricingMatrix.findMany({
      where: { isActive: true },
      select: { profile: true },
      distinct: ['profile']
    });

    const seniorities = await prisma.pricingMatrix.findMany({
      where: { isActive: true },
      select: { seniority: true },
      distinct: ['seniority']
    });

    const workModes = await prisma.pricingMatrix.findMany({
      where: { isActive: true },
      select: { workMode: true },
      distinct: ['workMode']
    });

    const locations = await prisma.pricingMatrix.findMany({
      where: { isActive: true, location: { not: null } },
      select: { location: true },
      distinct: ['location']
    });

    return NextResponse.json({
      success: true,
      options: {
        profiles: profiles.map((p) => p.profile),
        seniorities: seniorities.map((s) => s.seniority),
        workModes: workModes.map((w) => w.workMode),
        locations: locations.map((l) => l.location).filter(Boolean)
      }
    });
  } catch (error) {
    console.error('Error fetching pricing options:', error);
    return NextResponse.json(
      { success: false, error: 'Error al obtener opciones' },
      { status: 500 }
    );
  }
}
