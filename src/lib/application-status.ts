// RUTA: src/lib/application-status.ts

/**
 * Único mapa de estados de una postulación de cara al candidato.
 *
 * Había tres mapas distintos e incompletos —/api/candidate/applications,
 * /api/applications/check y la página /my-applications— y ninguno cubría los 12
 * estados del esquema: `evaluating`, `company_interested`, `discarded` y
 * `archived` caían en el `default` de cada uno. El mismo registro decía
 * "En revisión" en una pantalla, "En proceso" en otra y "Pendiente" en la
 * tercera, y un candidato descartado seguía viendo "En revisión" para siempre.
 *
 * Cualquier estado nuevo se añade AQUÍ y en ningún otro sitio.
 */

/** Los 12 estados que acepta Application.status. */
export const APPLICATION_STATUSES = [
  'pending',
  'reviewing',
  'evaluating',
  'sent_to_specialist',
  'sent_to_company',
  'company_interested',
  'interviewed',
  'rejected',
  'accepted',
  'injected_by_admin',
  'discarded',
  'archived'
] as const;

export type ApplicationStatus = (typeof APPLICATION_STATUSES)[number];

export interface ApplicationStatusView {
  /** Texto que ve el candidato. */
  label: string;
  /** Color del badge (el mismo vocabulario que ya usaban las rutas). */
  color: string;
}

/**
 * Etiqueta de cara al candidato. El trabajo interno (a quién se le mandó, si un
 * reclutador lo descartó o si la empresa mostró interés) no se le detalla: se
 * agrupa en estados que sí significan algo para quien postuló.
 */
const VISTA_CANDIDATO: Record<ApplicationStatus, ApplicationStatusView> = {
  pending: { label: 'En revisión', color: 'yellow' },
  injected_by_admin: { label: 'En revisión', color: 'yellow' },
  reviewing: { label: 'En proceso', color: 'blue' },
  evaluating: { label: 'En proceso', color: 'blue' },
  sent_to_specialist: { label: 'En proceso', color: 'blue' },
  sent_to_company: { label: 'Enviado a empresa', color: 'purple' },
  company_interested: { label: 'Empresa interesada', color: 'purple' },
  interviewed: { label: 'Entrevistado', color: 'indigo' },
  accepted: { label: 'Aceptado', color: 'green' },
  rejected: { label: 'No seleccionado', color: 'gray' },
  discarded: { label: 'No seleccionado', color: 'gray' },
  archived: { label: 'Proceso finalizado', color: 'gray' }
};

/** Respaldo para un estado que no esté en el mapa (dato legado o corrupto). */
const DESCONOCIDO: ApplicationStatusView = { label: 'En revisión', color: 'yellow' };

/** Vista (etiqueta + color) de un estado para el candidato. */
export function getCandidateStatusView(status: string | null | undefined): ApplicationStatusView {
  if (!status) return DESCONOCIDO;
  return VISTA_CANDIDATO[status as ApplicationStatus] ?? DESCONOCIDO;
}

/** Sólo la etiqueta, para quien no necesita el color. */
export function getCandidateStatusLabel(status: string | null | undefined): string {
  return getCandidateStatusView(status).label;
}

/** ¿Es un estado válido de Application.status? */
export function isValidApplicationStatus(status: unknown): status is ApplicationStatus {
  return typeof status === 'string' && (APPLICATION_STATUSES as readonly string[]).includes(status);
}
