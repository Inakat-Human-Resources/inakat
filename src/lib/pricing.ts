// RUTA: src/lib/pricing.ts

import { prisma } from './prisma';

/**
 * Calcula el costo en créditos de una vacante según la matriz de precios.
 * Esta función DEBE ser usada en todos los lugares donde se calcule el precio
 * para garantizar consistencia entre frontend y backend.
 *
 * @param profile - Perfil del puesto (ej: "Tecnología")
 * @param seniority - Nivel de experiencia (ej: "Jr", "Sr")
 * @param workMode - Modalidad de trabajo (ej: "remote", "hybrid", "presential")
 * @returns Objeto con los créditos y si se encontró un precio en la matriz
 */
export async function calculateJobCreditCost(
  profile: string,
  seniority: string,
  workMode: string
): Promise<{ credits: number; found: boolean; pricingId?: number }> {
  const DEFAULT_CREDITS = 5;

  if (!profile || !seniority || !workMode) {
    return { credits: DEFAULT_CREDITS, found: false };
  }

  // Buscar precio en la matriz - sin location específico
  // Usamos orderBy para garantizar resultados consistentes
  const pricing = await prisma.pricingMatrix.findFirst({
    where: {
      profile,
      seniority,
      workMode,
      location: null,
      isActive: true
    },
    orderBy: {
      id: 'asc' // Garantiza orden consistente
    }
  });

  if (pricing) {
    return {
      credits: pricing.credits,
      found: true,
      pricingId: pricing.id
    };
  }

  // Si no encuentra con location: null, buscar ignorando location
  // Esto es para compatibilidad con datos existentes que puedan tener location
  const pricingAny = await prisma.pricingMatrix.findFirst({
    where: {
      profile,
      seniority,
      workMode,
      isActive: true
    },
    orderBy: {
      id: 'asc'
    }
  });

  if (pricingAny) {
    return {
      credits: pricingAny.credits,
      found: true,
      pricingId: pricingAny.id
    };
  }

  // No se encontró precio, usar valor por defecto
  return { credits: DEFAULT_CREDITS, found: false };
}
