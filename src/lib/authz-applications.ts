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
