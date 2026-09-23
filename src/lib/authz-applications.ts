// RUTA: src/lib/authz-applications.ts
//
// Helpers de autorización (ownership / asignación) sobre una Application.
// Cierra IDOR cross-tenant en evaluaciones y solicitudes de entrevista.
//
// Reglas sobre una Application (vía su Job y JobAssignment):
//  - admin:      siempre.
//  - company:    job.userId === user.id (es su vacante).
//  - recruiter:  assignment.recruiterId === user.id (asignado a la job).
//  - specialist: assignment.specialistId === user.id (asignado a la job).

import { prisma } from './prisma';

export interface AppAuthUser {
  id: number;
  role: string;
}

/**
 * Convierte un valor que llega por query string o body en un ID de base de
 * datos, o `null` si no es un entero positivo. `parseInt` a secas deja pasar
 * NaN hasta Prisma, que lanza y acaba en un 500 en vez de un 400.
 */
export function parseId(value: unknown): number | null {
  if (typeof value === 'number') {
    return Number.isInteger(value) && value > 0 ? value : null;
  }
  if (typeof value !== 'string' || value.trim() === '') return null;
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

/**
 * Estados de una Application que la EMPRESA puede ver.
 *
 * Antes de 'sent_to_company' la postulación está en manos de INAKAT (cribado
 * del reclutador y evaluación del especialista): es justo el servicio que se
 * cobra. La lista estaba duplicada a mano en cuatro rutas y una de ellas
 * (POST /api/company/interview-requests) ni siquiera la comprobaba, así que
 * bastaba con pedir entrevista por applicationId para sacar nombre, correo y
 * teléfono de postulantes que aún no se habían enviado.
 */
export const COMPANY_VISIBLE_STATUSES = [
  'sent_to_company',
  'company_interested',
  'interviewed',
  'accepted',
  'rejected'
] as const;

/**
 * ¿Puede la empresa ver/operar sobre una Application en este estado?
 * El admin no pasa por aquí: para él todo es visible.
 */
export function canCompanySeeApplication(status: string): boolean {
  return (COMPANY_VISIBLE_STATUSES as readonly string[]).includes(status);
}

export interface JobAuthInfo {
  jobUserId?: number | null;
  recruiterId?: number | null;
  specialistId?: number | null;
}

/**
 * Decide (de forma pura, sin tocar la DB) si un usuario puede acceder a la
 * Application descrita por la info de ownership/asignación de su Job.
 */
export function canAccessJob(user: AppAuthUser, info: JobAuthInfo): boolean {
  switch (user.role) {
    case 'admin':
      return true;
    case 'company':
      return info.jobUserId != null && info.jobUserId === user.id;
    case 'recruiter':
      return info.recruiterId != null && info.recruiterId === user.id;
    case 'specialist':
      return info.specialistId != null && info.specialistId === user.id;
    default:
      return false;
  }
}

export interface ApplicationAuthData {
  id: number;
  status: string;
  job: {
    userId: number | null;
    assignment: {
      recruiterId: number | null;
      specialistId: number | null;
    } | null;
  } | null;
}

/**
 * Carga la Application con la info mínima necesaria para autorizar (job owner +
 * asignación). Devuelve null si no existe.
 */
export async function loadApplicationForAuth(
  applicationId: number
): Promise<ApplicationAuthData | null> {
  return prisma.application.findUnique({
    where: { id: applicationId },
    select: {
      id: true,
      status: true,
      job: {
        select: {
          userId: true,
          assignment: {
            select: { recruiterId: true, specialistId: true },
          },
        },
      },
    },
  });
}

/**
 * Aplana la info de autorización de una Application a JobAuthInfo.
 */
export function jobAuthInfoFromApplication(app: ApplicationAuthData): JobAuthInfo {
  return {
    jobUserId: app.job?.userId ?? null,
    recruiterId: app.job?.assignment?.recruiterId ?? null,
    specialistId: app.job?.assignment?.specialistId ?? null,
  };
}
