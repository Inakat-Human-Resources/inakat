// RUTA: src/app/diseno/fixtures/b9-modal-perfil.ts
//
// Bloque 9 · ficha de candidato (CandidateProfileModal) y lo que pide:
//
//   GET    /api/evaluations/notes?applicationId=      notas de evaluación
//   POST   /api/evaluations/notes                     nota nueva (201)
//   PATCH  /api/evaluations/notes/:id                 editar / cambiar visibilidad
//   DELETE /api/evaluations/notes/:id                 borrar
//   GET    /api/evaluations/skill-ratings?applicationId=  calificaciones
//   POST   /api/evaluations/skill-ratings             guardar calificaciones
//   POST   /api/upload                                adjunto de nota / documento
//   POST   /api/evaluations/candidates/:id/documents  documento al expediente (201)
//
// Las formas son las de los route.ts (src/app/api/evaluations/**, api/upload).
// Las respuestas dependen del id de la postulación, así cualquier pantalla que
// abra la ficha (admin, empresa, reclutador, especialista) ve casos variados:
//   id % 3 === 0 → sin notas (estado vacío)
//   id % 3 === 1 → una nota corta del reclutador
//   id % 3 === 2 → tres notas: pública con adjunto, privada larga, del especialista
//   id % 4 === 0 → sin calificaciones; el resto, calificadas a medias o del todo
// Lo que se escribe (notas, calificaciones) se guarda en memoria mientras dura
// la pestaña, para que «guardar y recargar» cuente la misma historia.
//
// Datos inventados. NUNCA datos reales de producción.
import type { RolApp } from '@/lib/nav-app';
import type { Fixture } from './tipos';
import { USUARIOS } from './base';

const ahora = Date.now();
const DIA = 86_400_000;
const hace = (dias: number, horas = 0) => new Date(ahora - dias * DIA - horas * 3_600_000).toISOString();

// ---------------------------------------------------------------------------
// Notas de evaluación (modelo EvaluationNote)
// ---------------------------------------------------------------------------
interface NotaSimulada {
  id: number;
  authorId: number;
  authorRole: 'recruiter' | 'specialist';
  applicationId: number;
  content: string;
  documentUrl: string | null;
  documentName: string | null;
  isPublic: boolean;
  createdAt: string;
  updatedAt: string;
}

const RECLUTADORA = USUARIOS.recruiter.id; // Paola Méndez
const ESPECIALISTA = USUARIOS.specialist.id; // Diego Calderón
const OTRO_ESPECIALISTA = 32; // otra persona del equipo: su nota no la puede editar el especialista del banco

function notasIniciales(applicationId: number): NotaSimulada[] {
  const base = applicationId * 10;
  const nota = (
    i: number,
    autor: number,
    rol: NotaSimulada['authorRole'],
    content: string,
    dias: number,
    extra: Partial<NotaSimulada> = {}
  ): NotaSimulada => ({
    id: base + i,
    authorId: autor,
    authorRole: rol,
    applicationId,
    content,
    documentUrl: null,
    documentName: null,
    isPublic: false,
    createdAt: hace(dias, i * 3),
    updatedAt: hace(dias, i * 3),
    ...extra,
  });

  switch (applicationId % 3) {
    case 0:
      return [];
    case 1:
      return [
        nota(
          1,
          RECLUTADORA,
          'recruiter',
          'Primera llamada muy clara. Disponibilidad inmediata y expectativa salarial dentro del rango de la vacante.',
          2
        ),
      ];
    default:
      return [
        nota(
          1,
          ESPECIALISTA,
          'specialist',
          'Resolvió el caso técnico en 40 minutos. Buen criterio para priorizar y explica sus decisiones sin rodeos. Recomiendo avanzar a entrevista con la empresa.',
          1,
          {
            isPublic: true,
            documentUrl: '/uploads/3f6c2a90-reporte-evaluacion-tecnica.pdf',
            documentName: 'Reporte de evaluación técnica.pdf',
          }
        ),
        nota(
          2,
          OTRO_ESPECIALISTA,
          'specialist',
          'Segunda revisión del portafolio.\n\n' +
            '— Puntos fuertes: documentación ordenada, pruebas en los proyectos más recientes, trato cuidadoso de los datos personales.\n' +
            '— A reforzar: poca experiencia liderando equipos de más de tres personas; en la entrevista conviene preguntar por la migración que menciona en su experiencia de 2023, porque no queda claro qué parte hizo.\n\n' +
            'Nota interna: pidió que no se contacte a su empleo actual hasta tener oferta.',
          3
        ),
        nota(
          3,
          RECLUTADORA,
          'recruiter',
          'Validé referencias con su jefa anterior: puntual, colaborativa, salió por reestructura del área.',
          5
        ),
      ];
  }
}

/** Notas por postulación (se siembran la primera vez que se piden). */
const NOTAS = new Map<number, NotaSimulada[]>();
let siguienteNota = 900_000;

function notasDe(applicationId: number): NotaSimulada[] {
  if (!NOTAS.has(applicationId)) NOTAS.set(applicationId, notasIniciales(applicationId));
  return NOTAS.get(applicationId)!;
}

function buscarNota(id: number): NotaSimulada | undefined {
  for (const lista of NOTAS.values()) {
    const n = lista.find((x) => x.id === id);
    if (n) return n;
  }
  return undefined;
}

/** Misma regla que GET /api/evaluations/notes: empresa sólo públicas y sin ids internos. */
function notasParaRol(applicationId: number, rol: RolApp) {
  const lista = [...notasDe(applicationId)].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  if (rol === 'company') {
    return lista
      .filter((n) => n.isPublic)
      .map(({ id, authorRole, content, documentUrl, documentName, isPublic, createdAt }) => ({
        id,
        authorRole,
        content,
        documentUrl,
        documentName,
        isPublic,
        createdAt,
      }));
  }
  const yo = USUARIOS[rol]?.id;
  return lista.map((n) => ({ ...n, canEdit: rol === 'admin' || n.authorId === yo }));
}

// ---------------------------------------------------------------------------
// Calificaciones de habilidades (modelo SkillRating)
// ---------------------------------------------------------------------------
interface CalificacionSimulada {
  id: number;
  skillName: string;
  rating: number;
  comment: string | null;
  ratedBy: { nombre: string };
  updatedAt: string;
}

/**
 * Habilidades que usan las vacantes del banco (b6: 101 y 102, y otras
 * frecuentes). La ficha sólo pinta las que pide SU vacante; las demás no se ven.
 */
const CALIFICACIONES_SEMBRADAS: Array<[string, number, string | null]> = [
  ['React', 5, 'Hooks, memo y pruebas con Testing Library sin titubear.'],
  ['Node.js', 4, null],
  ['PostgreSQL', 3, 'Consultas correctas; le cuestan los índices compuestos.'],
  ['Pruebas automatizadas', 4, null],
  ['Comunicación con negocio', 5, 'Tradujo el requerimiento a tareas concretas en la primera llamada.'],
  ['Lean manufacturing', 4, 'Aplicó 5S y VSM en su planta actual.'],
  ['Six Sigma', 3, 'Green Belt; sin proyectos cerrados todavía.'],
  ['AutoCAD', 5, null],
  ['Comunicación', 4, null],
  ['Trabajo en equipo', 5, null],
  ['Excel avanzado', 3, 'Tablas dinámicas sí; macros no.'],
  ['SQL', 4, null],
  ['Python', 3, null],
  ['Liderazgo', 3, 'Ha coordinado a dos personas, no más.'],
];

const CALIFICACIONES = new Map<number, CalificacionSimulada[]>();
let siguienteCalificacion = 500_000;

function calificacionesDe(applicationId: number): CalificacionSimulada[] {
  if (!CALIFICACIONES.has(applicationId)) {
    const sembradas: CalificacionSimulada[] =
      applicationId % 4 === 0
        ? []
        : CALIFICACIONES_SEMBRADAS
            // Una de cada dos postulaciones, calificada a medias.
            .filter((_, i) => applicationId % 2 === 0 || i % 2 === 0)
            .map(([skillName, rating, comment], i) => ({
              id: applicationId * 100 + i,
              skillName,
              rating,
              comment,
              ratedBy: { nombre: USUARIOS.specialist.nombre },
              updatedAt: hace(1, i),
            }));
    CALIFICACIONES.set(applicationId, sembradas);
  }
  return CALIFICACIONES.get(applicationId)!;
}

// ---------------------------------------------------------------------------
// Utilidades
// ---------------------------------------------------------------------------
const uuid = () =>
  'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });

const extension = (nombre: string) => {
  const e = nombre.split('.').pop()?.toLowerCase();
  return e && e !== nombre.toLowerCase() ? `.${e}` : '';
};

const aObjeto = (cuerpo: unknown): Record<string, unknown> =>
  cuerpo && typeof cuerpo === 'object' ? (cuerpo as Record<string, unknown>) : {};

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------
export const fixtures: Fixture[] = [
  // ---- Notas de evaluación ----
  {
    metodo: 'GET',
    patron: '/api/evaluations/notes',
    retraso: 250,
    respuesta: ({ url, rol }) => {
      const id = Number(url.searchParams.get('applicationId'));
      if (!Number.isInteger(id) || id <= 0) return { success: false, error: 'applicationId es requerido' };
      return { success: true, data: notasParaRol(id, rol) };
    },
  },
  {
    metodo: 'POST',
    patron: '/api/evaluations/notes',
    estado: 201,
    respuesta: ({ cuerpo, rol }) => {
      const b = aObjeto(cuerpo);
      const applicationId = Number(b.applicationId);
      const fecha = new Date().toISOString();
      const nota: NotaSimulada = {
        id: ++siguienteNota,
        authorId: USUARIOS[rol]?.id ?? RECLUTADORA,
        authorRole: rol === 'specialist' ? 'specialist' : 'recruiter',
        applicationId,
        content: String(b.content ?? '').trim(),
        documentUrl: typeof b.documentUrl === 'string' && b.documentUrl ? b.documentUrl : null,
        documentName: typeof b.documentName === 'string' && b.documentName ? b.documentName : null,
        isPublic: b.isPublic === true,
        createdAt: fecha,
        updatedAt: fecha,
      };
      notasDe(applicationId).unshift(nota);
      return { success: true, data: { ...nota, authorName: USUARIOS[rol]?.nombre ?? 'Usuario' } };
    },
  },
  {
    metodo: 'PATCH',
    patron: '/api/evaluations/notes/:id',
    respuesta: ({ params, cuerpo }) => {
      const nota = buscarNota(Number(params.id));
      if (!nota) return new Response(JSON.stringify({ success: false, error: 'Nota no encontrada' }), { status: 404 });
      const b = aObjeto(cuerpo);
      if (typeof b.content === 'string') nota.content = b.content.trim();
      if (typeof b.isPublic === 'boolean') nota.isPublic = b.isPublic;
      nota.updatedAt = new Date().toISOString();
      return { success: true, data: { ...nota } };
    },
  },
  {
    metodo: 'DELETE',
    patron: '/api/evaluations/notes/:id',
    respuesta: ({ params }) => {
      const id = Number(params.id);
      for (const [clave, lista] of NOTAS) NOTAS.set(clave, lista.filter((n) => n.id !== id));
      return { success: true, message: 'Nota eliminada' };
    },
  },

  // ---- Calificaciones de habilidades ----
  {
    metodo: 'GET',
    patron: '/api/evaluations/skill-ratings',
    retraso: 200,
    respuesta: ({ url }) => {
      const id = Number(url.searchParams.get('applicationId'));
      if (!Number.isInteger(id) || id <= 0) return { success: false, error: 'applicationId es requerido' };
      return { success: true, data: calificacionesDe(id) };
    },
  },
  {
    metodo: 'POST',
    patron: '/api/evaluations/skill-ratings',
    retraso: 300,
    respuesta: ({ cuerpo, rol }) => {
      const b = aObjeto(cuerpo);
      const applicationId = Number(b.applicationId);
      const ratings = Array.isArray(b.ratings) ? (b.ratings as Array<Record<string, unknown>>) : [];
      if (!ratings.length) return new Response(JSON.stringify({ success: false, error: 'applicationId y ratings son requeridos' }), { status: 400 });
      const lista = calificacionesDe(applicationId);
      const fecha = new Date().toISOString();
      const guardadas = ratings.map((r) => {
        const skillName = String(r.skillName).trim();
        const existente = lista.find((x) => x.skillName === skillName);
        const fila: CalificacionSimulada = {
          id: existente?.id ?? ++siguienteCalificacion,
          skillName,
          rating: Number(r.rating),
          comment: typeof r.comment === 'string' && r.comment ? r.comment : null,
          ratedBy: { nombre: USUARIOS[rol]?.nombre ?? USUARIOS.specialist.nombre },
          updatedAt: fecha,
        };
        if (existente) Object.assign(existente, fila);
        else lista.push(fila);
        return fila;
      });
      // La API devuelve las filas de Prisma (upsert): applicationId, ratedById, fechas.
      return {
        success: true,
        data: guardadas.map((f) => ({
          id: f.id,
          applicationId,
          ratedById: USUARIOS[rol]?.id ?? ESPECIALISTA,
          skillName: f.skillName,
          rating: f.rating,
          comment: f.comment,
          createdAt: fecha,
          updatedAt: f.updatedAt,
        })),
        message: 'Calificaciones guardadas',
      };
    },
  },

  // ---- Archivos ----
  {
    // Forma de src/app/api/upload/route.ts en desarrollo (sin Blob): ruta local.
    metodo: 'POST',
    patron: '/api/upload',
    retraso: 600,
    respuesta: ({ cuerpo }) => {
      const archivo = aObjeto(cuerpo).file;
      const nombre = archivo instanceof File ? archivo.name : 'documento.pdf';
      return { success: true, url: `/uploads/${uuid()}${extension(nombre)}`, filename: nombre };
    },
  },
  {
    metodo: 'POST',
    patron: '/api/evaluations/candidates/:id/documents',
    estado: 201,
    respuesta: ({ params, cuerpo }) => {
      const b = aObjeto(cuerpo);
      const fecha = new Date().toISOString();
      return {
        success: true,
        message: 'Documento agregado exitosamente',
        data: {
          id: 700_000 + Math.floor(Math.random() * 10_000),
          candidateId: Number(params.id),
          name: String(b.name ?? '').trim(),
          fileUrl: String(b.fileUrl ?? ''),
          fileType: typeof b.fileType === 'string' && b.fileType ? b.fileType : null,
          createdAt: fecha,
          updatedAt: fecha,
        },
      };
    },
  },
];
