// RUTA: src/lib/candidate-status.ts

import { prisma } from '@/lib/prisma';

/**
 * Estados de Application que cierran el proceso sin contratación.
 * (Mismo criterio que el conteo de procesos vivos de /api/admin/candidates.)
 */
export const ESTADOS_POSTULACION_CERRADA = ['rejected', 'discarded', 'archived'];

/**
 * Recalcula Candidate.status a partir de sus postulaciones (ADM-028).
 *
 * Antes sólo lo cambiaba la inyección del admin (-> in_process) y nunca llegaba
 * a 'hired' ni volvía a 'available' cuando todos los procesos se cerraban, así
 * que el banco de talento mostraba estados falsos y el filtro de inyección
 * (available / in_process) no reflejaba la realidad.
 *
 *  - 'hired'      si alguna postulación está 'accepted'.
 *  - 'in_process' si alguna sigue viva (ni aceptada ni cerrada).
 *  - 'available'  si no queda ninguna viva.
 *
 * 'inactive' es una decisión manual del admin y no se toca. La postulación se
 * enlaza con el expediente por correo (sin distinguir mayúsculas, porque los
 * datos heredados no están normalizados; ver EVAL-007).
 *
 * Nunca lanza: es un efecto secundario de un cambio que ya se guardó.
 */
export async function syncCandidateStatus(email: string | null | undefined): Promise<void> {
  const correo = typeof email === 'string' ? email.trim() : '';
  if (!correo) return;

  try {
    const candidato = await prisma.candidate.findFirst({
      where: { email: { equals: correo, mode: 'insensitive' } },
      select: { id: true, status: true }
    });
    if (!candidato || candidato.status === 'inactive') return;

    const postulaciones = await prisma.application.findMany({
      where: { candidateEmail: { equals: correo, mode: 'insensitive' } },
      select: { status: true }
    });

    let nuevo = 'available';
    if (postulaciones.some((p) => p.status === 'accepted')) {
      nuevo = 'hired';
    } else if (postulaciones.some((p) => !ESTADOS_POSTULACION_CERRADA.includes(p.status))) {
      nuevo = 'in_process';
    }

    if (nuevo !== candidato.status) {
      await prisma.candidate.update({
        where: { id: candidato.id },
        data: { status: nuevo }
      });
    }
  } catch (error) {
    console.error('[candidate-status] No se pudo recalcular Candidate.status:', {
      error: error instanceof Error ? error.message : 'desconocido'
    });
  }
}
