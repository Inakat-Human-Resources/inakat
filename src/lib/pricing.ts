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
 * @returns Objeto con los créditos, minSalary y si se encontró un precio en la matriz
 */
export async function calculateJobCreditCost(
  profile: unknown,
  seniority: unknown,
  workMode: unknown
): Promise<{ credits: number; found: boolean; pricingId?: number; minSalary?: number | null }> {
  const DEFAULT_CREDITS = 5;

  // SECURITY (#PAGO): los tres valores llegan sin tipar desde POST /api/jobs,
  // /api/jobs/publish y la ruta pública /api/pricing/calculate, y se usaban tal
  // cual como filtro de Prisma. Un objeto como {"not":""} es un filtro VÁLIDO:
  // devolvía la primera fila de la matriz a cualquiera, sin autenticar. Un
  // número o un array provocaba PrismaClientValidationError -> 500.
  if (
    typeof profile !== 'string' ||
    typeof seniority !== 'string' ||
    typeof workMode !== 'string' ||
    !profile.trim() ||
    !seniority.trim() ||
    !workMode.trim() ||
    profile.length > 200 ||
    seniority.length > 200 ||
    workMode.length > 200
  ) {
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
      pricingId: pricing.id,
      minSalary: pricing.minSalary
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
      pricingId: pricingAny.id,
      minSalary: pricingAny.minSalary
    };
  }

  // No se encontró precio. Se devuelve un valor por defecto SÓLO para la
  // estimación; `found: false` es la señal de que no hay precio configurado.
  //
  // DINERO (#PAGO): quien COBRA no puede ignorar `found`. La matriz llega a 18
  // créditos y el default es 5: un seniority o workMode que no matchee (un
  // espacio de más, otra capitalización, 'onsite' en vez de 'presential') salía
  // por aquí y la vacante se publicaba por 5 créditos. Ver `exigirPrecio`.
  return { credits: DEFAULT_CREDITS, found: false };
}

/**
 * Error de "no hay precio configurado para esta combinación".
 * Lo usan los endpoints que cobran para responder 400 en vez de cobrar el
 * default silencioso.
 */
export class PrecioNoConfiguradoError extends Error {
  constructor(
    public readonly profile: string,
    public readonly seniority: string,
    public readonly workMode: string
  ) {
    super('Combinación sin precio configurado');
    this.name = 'PrecioNoConfiguradoError';
  }
}

/**
 * Igual que `calculateJobCreditCost`, pero LANZA si la combinación no tiene
 * precio en la matriz. Es la que deben usar los endpoints que cobran créditos.
 */
export async function calcularCostoExigiendoPrecio(
  profile: unknown,
  seniority: unknown,
  workMode: unknown
): Promise<{ credits: number; pricingId?: number; minSalary?: number | null }> {
  const resultado = await calculateJobCreditCost(profile, seniority, workMode);

  if (!resultado.found) {
    throw new PrecioNoConfiguradoError(
      String(profile),
      String(seniority),
      String(workMode)
    );
  }

  return {
    credits: resultado.credits,
    pricingId: resultado.pricingId,
    minSalary: resultado.minSalary
  };
}
