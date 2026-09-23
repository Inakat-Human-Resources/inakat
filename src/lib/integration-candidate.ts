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

/** Campos del perfil Candidate que enriquecen el contrato. */
const candidateSelect = {
  email: true,
  nombre: true,
  apellidoPaterno: true,
  apellidoMaterno: true,
  telefono: true,
  cvUrl: true,
  universidad: true,
  carrera: true,
  añosExperiencia: true
} as const;

type PerfilCandidato = {
  nombre: string;
  apellidoPaterno: string;
  apellidoMaterno: string | null;
  telefono: string | null;
  cvUrl: string | null;
  universidad: string | null;
  carrera: string | null;
  añosExperiencia: number | null;
};

/**
 * Resuelve los perfiles Candidate de un lote de aplicaciones en UNA consulta y
 * los devuelve indexados por email en minúsculas.
 *
 * Antes se hacía un `findFirst` con `mode: 'insensitive'` (ILIKE, que no usa el
 * índice de email) por cada aplicación dentro de un `Promise.all`: con 300
 * contrataciones eran 300 consultas simultáneas contra un pool que en
 * serverless es de 1-5 conexiones (P2024, «Timed out fetching a new connection
 * from the connection pool»). El dashboard de empresa ya resolvía esto con una
 * sola consulta batch; aquí se reutiliza el mismo patrón.
 */
async function cargarPerfilesPorEmail(
  emails: string[]
): Promise<Map<string, PerfilCandidato>> {
  const unicos = [...new Set(emails.map((e) => e.toLowerCase()))];
  const mapa = new Map<string, PerfilCandidato>();
  if (unicos.length === 0) return mapa;

  const candidates = await prisma.candidate.findMany({
    where: { email: { in: unicos, mode: 'insensitive' } },
    select: candidateSelect
  });

  for (const candidate of candidates) {
    const clave = candidate.email.toLowerCase();
    // Si hubiera duplicados por caja, gana el primero (mismo criterio que el
    // findFirst anterior).
    if (!mapa.has(clave)) mapa.set(clave, candidate);
  }

  return mapa;
}

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

  const perfiles = await cargarPerfilesPorEmail([application.candidateEmail]);
  const candidato = buildCandidato(
    application,
    perfiles.get(application.candidateEmail.toLowerCase()) ?? null
  );
  return { candidato, companyUserId: application.job.userId };
}

export interface OpcionesCandidatosAceptados {
  /** Página 1-based. */
  page?: number;
  /** Tamaño de página (el caller ya lo capa). */
  limit?: number;
  /** Sólo los revisados a partir de esta fecha. */
  since?: Date | null;
}

export interface CandidatosAceptadosPage {
  candidatos: CandidatoInakat[];
  total: number;
}

/**
 * Lista los candidatos aceptados/contratados de TODAS las vacantes de la
 * empresa dueña de la API key, mapeados al contrato.
 *
 * Pagina siempre: la versión anterior traía el histórico completo sin `take`,
 * así que la respuesta crecía sin límite con cada contratación.
 */
export async function loadCandidatosAceptados(
  companyUserId: number,
  opciones: OpcionesCandidatosAceptados = {}
): Promise<CandidatosAceptadosPage> {
  const page = Math.max(1, Math.trunc(opciones.page ?? 1));
  const limit = Math.min(Math.max(1, Math.trunc(opciones.limit ?? 50)), 100);

  const where = {
    status: { in: ACCEPTED_APPLICATION_STATUSES },
    job: { userId: companyUserId },
    ...(opciones.since ? { reviewedAt: { gte: opciones.since } } : {})
  };

  const [applications, total] = await Promise.all([
    prisma.application.findMany({
      where,
      include: applicationInclude,
      orderBy: { reviewedAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit
    }),
    prisma.application.count({ where })
  ]);

  const perfiles = await cargarPerfilesPorEmail(
    applications.map((app) => app.candidateEmail)
  );

  return {
    candidatos: applications.map((app) =>
      buildCandidato(app, perfiles.get(app.candidateEmail.toLowerCase()) ?? null)
    ),
    total
  };
}

// =============================================
// INTERNOS
// =============================================

function buildCandidato(
  application: ApplicationWithRelations,
  candidate: PerfilCandidato | null
): CandidatoInakat {
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
    // PRIVACIDAD (#50/#51): `application.notes` son las notas internas de
    // INAKAT. Exportarlas al integrador reabría por el puente la misma fuga
    // que se cerró en el producto. Si hiciera falta mandar notas, tendrían
    // que ser las de evaluación marcadas como públicas.
    notasAdicionales: null,
    puesto: application.job.title ?? null,
    universidad: candidate?.universidad ?? null,
    carrera: candidate?.carrera ?? null,
    experienciaAnios: candidate?.añosExperiencia ?? null,
    salarioMensualPropuesto:
      application.job.salaryMax ?? application.job.salaryMin ?? null,
    fechaAceptacion: fechaAceptacion ? fechaAceptacion.toISOString() : null
  };
}
