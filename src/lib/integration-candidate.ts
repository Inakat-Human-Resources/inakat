// RUTA: src/lib/integration-candidate.ts
// Mapeo de una Application de INAKAT al contrato compartido CandidatoInakat
// del puente con Worky2. Lo usan tanto GET /api/integration/candidates como
// el webhook saliente (src/lib/worky2-webhook.ts) para garantizar que ambos
// canales emiten EXACTAMENTE la misma forma.

import { prisma } from './prisma';

// =============================================
// CONTRATO COMPARTIDO (idéntico al lado Worky2)
// =============================================

export interface CandidatoInakat {
  /** = Application.id de INAKAT */
  inakatCandidateId: number;
  nombre: string;
  apellidoPaterno: string;
  apellidoMaterno?: string | null;
  email: string;
  telefono?: string | null;
  cvUrl?: string | null;
  evaluacionPsicologica?: string | null;
  evaluacionTecnica?: string | null;
  notasAdicionales?: string | null;
  puesto?: string | null;
  universidad?: string | null;
  carrera?: string | null;
  experienciaAnios?: number | null;
  salarioMensualPropuesto?: number | null;
  fechaAceptacion?: string | null;
}

/**
 * Máquina de estados de Application: el estado final de contratación es
 * 'accepted' (ver COMPANY_ALLOWED_STATUSES en
 * src/app/api/company/applications/[id]/route.ts). 'hired' no está en la lista
 * canónica pero aparece como legado en dashboards (recruiter/dashboard), así
 * que lo incluimos defensivamente como "contratado".
 */
export const ACCEPTED_APPLICATION_STATUSES = ['accepted', 'hired'];

// =============================================
// CARGA + MAPEO
// =============================================

const applicationInclude = {
  job: {
    select: {
      id: true,
      title: true,
      userId: true,
      salaryMin: true,
      salaryMax: true
    }
  },
  // Solo notas visibles para la empresa (isPublic) — la API key pertenece a
  // la empresa, así que respeta la misma visibilidad que su panel.
  evaluationNotes: {
    where: { isPublic: true },
    orderBy: { createdAt: 'asc' as const },
    select: { authorRole: true, content: true }
  },
  skillRatings: {
    orderBy: { skillName: 'asc' as const },
    select: { skillName: true, rating: true, comment: true }
  }
};

type ApplicationWithRelations = NonNullable<
  Awaited<
    ReturnType<
      typeof prisma.application.findUnique<{
        where: { id: number };
        include: typeof applicationInclude;
      }>
    >
  >
>;

/**
 * Carga una Application por id y la mapea al contrato. Devuelve null si no
 * existe. No filtra por status: el caller decide (el webhook dispara justo
 * cuando la transición a 'accepted' acaba de ocurrir).
 */
export async function loadCandidatoInakat(
  applicationId: number
): Promise<{ candidato: CandidatoInakat; companyUserId: number | null } | null> {
  const application = await prisma.application.findUnique({
    where: { id: applicationId },
    include: applicationInclude
  });

  if (!application) return null;

  const candidato = await buildCandidato(application);
  return { candidato, companyUserId: application.job.userId };
}

/**
 * Lista los candidatos aceptados/contratados de TODAS las vacantes de la
 * empresa dueña de la API key, mapeados al contrato.
 */
export async function loadCandidatosAceptados(
  companyUserId: number
): Promise<CandidatoInakat[]> {
  const applications = await prisma.application.findMany({
    where: {
      status: { in: ACCEPTED_APPLICATION_STATUSES },
      job: { userId: companyUserId }
    },
    include: applicationInclude,
    orderBy: { reviewedAt: 'desc' }
  });

  return Promise.all(applications.map((app) => buildCandidato(app)));
}

// =============================================
// INTERNOS
// =============================================

async function buildCandidato(
  application: ApplicationWithRelations
): Promise<CandidatoInakat> {
  // Perfil enriquecido del candidato (mismo patrón que
  // GET /api/company/applications/[id]: match por email insensitive)
  const candidate = await prisma.candidate.findFirst({
    where: { email: { equals: application.candidateEmail, mode: 'insensitive' } },
    select: {
      nombre: true,
      apellidoPaterno: true,
      apellidoMaterno: true,
      telefono: true,
      cvUrl: true,
      universidad: true,
      carrera: true,
      añosExperiencia: true
    }
  });

  // Nombre: preferir el perfil Candidate (ya separado); si no existe,
  // separar candidateName de la Application (best effort).
  let nombre: string;
  let apellidoPaterno: string;
  let apellidoMaterno: string | null;

  if (candidate) {
    nombre = candidate.nombre;
    apellidoPaterno = candidate.apellidoPaterno;
    apellidoMaterno = candidate.apellidoMaterno ?? null;
  } else {
    const parts = application.candidateName.trim().split(/\s+/);
    nombre = parts[0] ?? application.candidateName;
    apellidoPaterno = parts[1] ?? '';
    apellidoMaterno = parts.length > 2 ? parts.slice(2).join(' ') : null;
  }

  // Evaluaciones: recruiter ≈ evaluación inicial/psicológica,
  // specialist + skill ratings ≈ evaluación técnica.
  const recruiterNotes = application.evaluationNotes
    .filter((note) => note.authorRole === 'recruiter')
    .map((note) => note.content.trim())
    .filter(Boolean);

  const specialistNotes = application.evaluationNotes
    .filter((note) => note.authorRole === 'specialist')
    .map((note) => note.content.trim())
    .filter(Boolean);

  const skillLines = application.skillRatings.map((rating) =>
    rating.comment
      ? `${rating.skillName}: ${rating.rating}/5 — ${rating.comment}`
      : `${rating.skillName}: ${rating.rating}/5`
  );

  const evaluacionPsicologica =
    recruiterNotes.length > 0 ? recruiterNotes.join('\n\n') : null;

  const tecnicaParts = [...specialistNotes];
  if (skillLines.length > 0) {
    tecnicaParts.push(`Habilidades evaluadas:\n${skillLines.join('\n')}`);
  }
  const evaluacionTecnica = tecnicaParts.length > 0 ? tecnicaParts.join('\n\n') : null;

  const fechaAceptacion = (application.reviewedAt ?? application.updatedAt) ?? null;

  return {
    inakatCandidateId: application.id,
    nombre,
    apellidoPaterno,
    apellidoMaterno,
    email: application.candidateEmail,
    telefono: application.candidatePhone ?? candidate?.telefono ?? null,
    cvUrl: application.cvUrl ?? candidate?.cvUrl ?? null,
    evaluacionPsicologica,
    evaluacionTecnica,
    notasAdicionales: application.notes ?? null,
    puesto: application.job.title ?? null,
    universidad: candidate?.universidad ?? null,
    carrera: candidate?.carrera ?? null,
    experienciaAnios: candidate?.añosExperiencia ?? null,
    salarioMensualPropuesto:
      application.job.salaryMax ?? application.job.salaryMin ?? null,
    fechaAceptacion: fechaAceptacion ? fechaAceptacion.toISOString() : null
  };
}
