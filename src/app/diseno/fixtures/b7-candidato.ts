// RUTA: src/app/diseno/fixtures/b7-candidato.ts
//
// Bloque 7 · candidato (perfil, mis postulaciones, notificaciones) y la
// gestión de aplicaciones del admin (/applications).
// Formato en ./tipos.ts; ejemplos en ./base.ts y en docs/DISENO.md.
// Van ANTES que las base: si repites un patrón, gana el tuyo.
//
// Formas copiadas de cada route.ts:
//   GET  /api/profile                    src/app/api/profile/route.ts
//   PUT  /api/profile                    (valida nombre, contraseña y teléfono como el real)
//   GET|POST /api/profile/experience     src/app/api/profile/experience/route.ts
//   PUT|DELETE /api/profile/experience/:id
//   GET|POST|DELETE /api/profile/documents
//   POST /api/upload                     src/app/api/upload/route.ts
//   GET  /api/my-applications            src/app/api/my-applications/route.ts
//   GET  /api/candidate/applications     src/app/api/candidate/applications/route.ts
//   GET  /api/applications · PATCH /api/applications/:id
//   GET|PATCH /api/notifications · GET /api/notifications/count
//     (sólo para candidato y usuario; el resto de roles cae en las de base.ts)
//
// Casos para mirar en el banco (/diseno/vista/…):
//   /profile                         candidata con el perfil a medias (sin foto ni carta)
//   /profile?rol=company             empresa: sólo cuenta, con empresa y créditos
//   /my-applications                 once postulaciones en todos los estados
//   /my-applications?rol=company     lista vacía (estado vacío)
//   /candidate/applications          las mismas, con avisos por estado
//   /candidate/applications?rol=admin  error real de la API (sin perfil de candidato)
//   /notifications?rol=candidate     26 avisos en dos páginas, cinco sin leer
//   Perfil › Cuenta: la contraseña actual que acepta el banco es «Inakat2026».
//
// Datos inventados y verosímiles. Estado en memoria: guardar, subir y borrar
// se ven al momento y se pierden al recargar el servidor.

import type { RolApp } from '@/lib/nav-app';
import { getCandidateStatusView } from '@/lib/application-status';
import type { ContextoFixture, Fixture } from './tipos';
import { FIXTURES_BASE, USUARIOS, VACANTES } from './base';

const ahora = Date.now();
const DIA = 86_400_000;
const hace = (dias: number, horas = 0) => new Date(ahora - dias * DIA - horas * 3_600_000).toISOString();

const json = (datos: unknown, estado = 200) =>
  new Response(JSON.stringify(datos), { status: estado, headers: { 'Content-Type': 'application/json' } });

/** Delegar en la fixture de base.ts (para los roles que no son de este bloque). */
function deBase(metodo: Fixture['metodo'], patron: string) {
  const f = FIXTURES_BASE.find((x) => x.metodo === metodo && x.patron === patron);
  return (ctx: ContextoFixture) =>
    typeof f?.respuesta === 'function' ? (f.respuesta as (c: ContextoFixture) => unknown)(ctx) : f?.respuesta ?? null;
}

const esCandidato = (rol: RolApp) => rol === 'candidate' || rol === 'user';

// ===========================================================================
// PERFIL
// ===========================================================================
const CANDIDATE_ID = 900;
const nombresUsuario: Partial<Record<RolApp, string>> = {};

const perfilCandidato: Record<string, unknown> = {
  id: CANDIDATE_ID,
  nombre: 'Andrea',
  apellidoPaterno: 'López',
  apellidoMaterno: 'Garza',
  telefono: '81 2345 6789',
  fechaNacimiento: '1994-05-17T00:00:00.000Z',
  sexo: 'F',
  ciudad: 'Monterrey',
  estado: 'Nuevo León',
  ubicacionCercana: 'Col. Del Valle, San Pedro Garza García, N.L.',
  latitude: 25.6506,
  longitude: -100.3636,
  universidad: 'Universidad Autónoma de Nuevo León',
  carrera: 'Ingeniería en Sistemas Computacionales',
  nivelEstudios: 'Licenciatura',
  añosExperiencia: 7,
  profile: 'Tecnología',
  seniority: 'Sr',
  linkedinUrl: 'https://www.linkedin.com/in/andrea-lopez-ejemplo',
  portafolioUrl: null,
  cvUrl: '/uploads/cv-andrea-lopez.pdf',
  // Sin foto ni carta: el indicador de completitud sale a medias (75 %).
  fotoUrl: null,
  cartaPresentacion: null,
};

interface ExperienciaFx {
  id: number;
  candidateId: number;
  empresa: string;
  puesto: string;
  ubicacion: string | null;
  fechaInicio: string;
  fechaFin: string | null;
  esActual: boolean;
  descripcion: string | null;
  createdAt: string;
  updatedAt: string;
}

let experiencias: ExperienciaFx[] = [
  {
    id: 501,
    candidateId: CANDIDATE_ID,
    empresa: 'Tecnologías Delta',
    puesto: 'Desarrolladora Full Stack Sr.',
    ubicacion: 'Monterrey, N.L.',
    fechaInicio: '2022-03-01T00:00:00.000Z',
    fechaFin: null,
    esActual: true,
    descripcion:
      'Lidero el rediseño del portal de clientes (Next.js y PostgreSQL). Coordino a tres desarrolladores y reviso el código de todo el equipo.\nBajé el tiempo de carga del panel principal de 6 s a 1.8 s.',
    createdAt: hace(400),
    updatedAt: hace(30),
  },
  {
    id: 502,
    candidateId: CANDIDATE_ID,
    empresa: 'Logística Pacífico',
    puesto: 'Desarrolladora Backend',
    ubicacion: 'Guadalajara, Jal. (remoto)',
    fechaInicio: '2019-01-01T00:00:00.000Z',
    fechaFin: '2022-02-01T00:00:00.000Z',
    esActual: false,
    descripcion: 'APIs de rastreo de envíos para 40 sucursales. Integración con transportistas y facturación electrónica.',
    createdAt: hace(400),
    updatedAt: hace(400),
  },
  {
    id: 503,
    candidateId: CANDIDATE_ID,
    empresa: 'Grupo Andes',
    puesto: 'Practicante de Sistemas',
    ubicacion: 'Monterrey, N.L.',
    fechaInicio: '2017-06-01T00:00:00.000Z',
    fechaFin: '2018-12-01T00:00:00.000Z',
    esActual: false,
    descripcion: null,
    createdAt: hace(400),
    updatedAt: hace(400),
  },
];

let educacionGuardada: unknown[] = [
  {
    id: 1,
    nivel: 'Licenciatura',
    institucion: 'Universidad Autónoma de Nuevo León',
    carrera: 'Ingeniería en Sistemas Computacionales',
    añoInicio: 2012,
    añoFin: 2017,
    estatus: 'Titulado',
  },
  {
    id: 2,
    nivel: 'Diplomado',
    institucion: 'Centro de Estudios Digitales del Norte (en línea)',
    carrera: 'Diplomado en Ciencia de Datos',
    añoInicio: 2025,
    añoFin: null,
    estatus: 'Cursando',
  },
];

interface DocumentoFx {
  id: number;
  candidateId: number;
  name: string;
  fileUrl: string;
  fileType: string | null;
  createdAt: string;
  updatedAt: string;
}

let documentos: DocumentoFx[] = [
  { id: 73, candidateId: CANDIDATE_ID, name: 'Constancia de inglés B2 (examen institucional, vigente hasta 2027)', fileUrl: '/uploads/ingles-b2.pdf', fileType: 'pdf', createdAt: hace(12), updatedAt: hace(12) },
  { id: 72, candidateId: CANDIDATE_ID, name: 'Certificación en servicios de nube', fileUrl: '/uploads/cert-nube.png', fileType: 'png', createdAt: hace(90), updatedAt: hace(90) },
  { id: 71, candidateId: CANDIDATE_ID, name: 'Título profesional', fileUrl: '/uploads/titulo-andrea-lopez.pdf', fileType: 'pdf', createdAt: hace(200), updatedAt: hace(200) },
];
let siguienteId = 1000;

/** Años de experiencia como los recalcula el servidor (aproximado). */
function recalcularAnios() {
  const meses = experiencias.reduce((total, e) => {
    const inicio = new Date(e.fechaInicio).getTime();
    const fin = e.esActual || !e.fechaFin ? ahora : new Date(e.fechaFin).getTime();
    return total + Math.max(0, (fin - inicio) / (30.44 * DIA));
  }, 0);
  perfilCandidato.añosExperiencia = Math.floor(meses / 12);
}

const experienciasOrdenadas = () =>
  [...experiencias].sort((a, b) => new Date(b.fechaInicio).getTime() - new Date(a.fechaInicio).getTime());

function perfilDe(rol: RolApp) {
  const u = USUARIOS[rol];
  const base: Record<string, unknown> = {
    id: u.id,
    email: u.email,
    nombre: nombresUsuario[rol] ?? u.nombre,
    role: rol,
    createdAt: hace(320),
  };
  if (rol === 'company') {
    base.company = 'Grupo Andes';
    base.credits = u.credits;
  }
  // Sólo el rol candidato tiene expediente (Candidate) en el banco.
  if (rol === 'candidate') {
    base.candidate = { ...perfilCandidato, experiences: experienciasOrdenadas(), educacion: educacionGuardada };
  }
  return base;
}

function guardarPerfil({ cuerpo, rol }: ContextoFixture) {
  const { nombre, currentPassword, newPassword, candidateData } = (cuerpo ?? {}) as {
    nombre?: string;
    currentPassword?: string;
    newPassword?: string;
    candidateData?: Record<string, unknown>;
  };

  if (nombre !== undefined && (typeof nombre !== 'string' || nombre.trim().length === 0)) {
    return json({ success: false, error: 'El nombre de usuario no puede estar vacío' }, 400);
  }
  if (newPassword && currentPassword !== 'Inakat2026') {
    return json({ success: false, error: 'Contraseña actual incorrecta' }, 400);
  }
  if (candidateData && rol === 'candidate') {
    const tel = candidateData.telefono;
    if (typeof tel === 'string' && tel !== '') {
      const digitos = tel.replace(/\D/g, '').length;
      if (digitos < 10 || digitos > 13) {
        return json(
          { success: false, error: 'telefono: Teléfono inválido. Formato: 5512345678 o +52 55 1234 5678' },
          400
        );
      }
    }
    for (const [campo, valor] of Object.entries(candidateData)) {
      if (campo === 'educacion') educacionGuardada = Array.isArray(valor) ? valor : educacionGuardada;
      else if (valor !== undefined) perfilCandidato[campo] = valor === '' ? null : valor;
    }
  }
  if (typeof nombre === 'string') nombresUsuario[rol] = nombre.trim();

  const u = USUARIOS[rol];
  return {
    success: true,
    message: 'Perfil actualizado exitosamente',
    data: {
      id: u.id,
      email: u.email,
      nombre: nombresUsuario[rol] ?? u.nombre,
      role: rol,
      ...(rol === 'company' ? { company: 'Grupo Andes', credits: u.credits } : {}),
    },
  };
}

// ===========================================================================
// POSTULACIONES DE LA CANDIDATA (/my-applications y /candidate/applications)
// ===========================================================================
const ESTADOS_POSTULACION = [
  'company_interested',
  'pending',
  'interviewed',
  'sent_to_company',
  'reviewing',
  'accepted',
  'discarded',
  'injected_by_admin',
  'evaluating',
  'archived',
  'rejected',
];

const postulacionesCandidata = ESTADOS_POSTULACION.map((status, i) => {
  const v = VACANTES[(i * 2) % VACANTES.length];
  const confidencial = i === 3;
  const titulo =
    i === 4 ? 'Coordinadora de Proyectos de Infraestructura Hospitalaria y Mantenimiento Preventivo' : v.title;
  const creada = hace(3 + i * 4, i);
  return {
    id: 7000 + i,
    jobId: v.id,
    userId: USUARIOS.candidate.id,
    candidateName: 'Andrea López Garza',
    candidateEmail: USUARIOS.candidate.email,
    candidatePhone: '81 2345 6789',
    coverLetter: null,
    cvUrl: '/uploads/cv-andrea-lopez.pdf',
    status,
    notes: null,
    createdAt: creada,
    updatedAt: hace(1 + i * 2),
    reviewedAt: ['pending', 'injected_by_admin'].includes(status) ? null : hace(2 + i * 3),
    job: {
      id: v.id,
      title: titulo,
      company: confidencial ? 'Empresa Confidencial' : v.company,
      location: confidencial ? 'Nuevo León' : v.location,
      salary: v.salary,
      jobType: v.jobType,
      workMode: v.workMode,
      status: v.status,
      profile: v.profile,
      seniority: v.seniority,
      isConfidential: confidencial,
      // Sin logos: next/image sólo acepta el almacenamiento real (ver CompanyLogo).
      logoUrl: null,
    },
  };
});

function misPostulaciones({ rol }: ContextoFixture) {
  // Con cualquier rol que no sea de candidato, la lista sale vacía (estado vacío).
  const applications = esCandidato(rol)
    ? postulacionesCandidata.map((app) => {
        const vista = getCandidateStatusView(app.status);
        return { ...app, notes: null, statusLabel: vista.label, statusColor: vista.color };
      })
    : [];
  const cuenta = (s: string) => applications.filter((a) => a.status === s).length;
  return {
    success: true,
    data: {
      applications,
      stats: {
        total: applications.length,
        pending: cuenta('pending'),
        reviewing: cuenta('reviewing'),
        interviewed: cuenta('interviewed'),
        accepted: cuenta('accepted'),
        rejected: cuenta('rejected'),
      },
    },
  };
}

function postulacionesDelCandidato({ rol }: ContextoFixture) {
  // Como el route.ts: sólo candidate y admin pasan; el admin no tiene expediente.
  if (rol !== 'candidate' && rol !== 'admin') {
    return json({ success: false, error: 'Acceso denegado' }, 403);
  }
  if (rol === 'admin') {
    return json({ success: false, error: 'No tienes un perfil de candidato asociado' }, 404);
  }
  const data = postulacionesCandidata.map((app) => {
    const vista = getCandidateStatusView(app.status);
    return { ...app, statusLabel: vista.label, statusColor: vista.color, notes: null };
  });
  return {
    success: true,
    data,
    count: data.length,
    candidate: { id: CANDIDATE_ID, nombre: 'Andrea', email: USUARIOS.candidate.email },
  };
}

// ===========================================================================
// GESTIÓN DE APLICACIONES (admin, /applications)
// ===========================================================================
const POSTULANTES = [
  'Mariana Pérez', 'Carlos Ibarra', 'Fernanda Ruiz', 'Jorge Castañeda', 'Valeria Núñez', 'Ricardo Solís',
  'Daniela Ortega', 'Emilio Vargas', 'Renata Aguilar', 'Hugo Salazar', 'Ximena Fuentes', 'Óscar Medina',
  'Paulina Treviño', 'Andrés Cavazos', 'Lucía Garza', 'Sebastián Montemayor', 'Camila Robles', 'Diego Arriaga',
];
const ESTADOS_ADMIN = ['pending', 'reviewing', 'pending', 'interviewed', 'accepted', 'rejected', 'discarded', 'reviewing', 'sent_to_specialist'];
/** «Óscar Medina» → oscar.medina@correo.mx (sin acentos: se quitan las marcas combinantes). */
const correo = (nombre: string) =>
  `${nombre
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, '.')}@correo.mx`;

const aplicacionesAdmin = Array.from({ length: 32 }, (_, i) => {
  const nombre = POSTULANTES[i % POSTULANTES.length];
  const v = VACANTES[i % VACANTES.length];
  const cvs = [
    `https://ejemplo.public.blob.vercel-storage.com/cv-${i + 1}.pdf`,
    null,
    `drive.ejemplo.mx/cv/${i + 1}.pdf`,
  ];
  return {
    id: 3000 + i,
    jobId: v.id,
    userId: i % 3 === 0 ? null : 60 + i,
    candidateName: nombre,
    candidateEmail: correo(nombre),
    candidatePhone: i % 4 === 1 ? null : `81 ${String(1000 + i * 37).slice(0, 4)} ${String(2000 + i * 53).slice(0, 4)}`,
    cvUrl: cvs[i % cvs.length],
    coverLetter:
      i % 3 === 0
        ? 'Me interesa mucho la vacante porque he trabajado en proyectos similares durante los últimos cinco años.\n\nPuedo incorporarme de inmediato y tengo disponibilidad para viajar dentro del estado.'
        : null,
    status: ESTADOS_ADMIN[i % ESTADOS_ADMIN.length],
    notes: null,
    createdAt: hace(i * 0.9, i % 7),
    updatedAt: hace(i * 0.5),
    reviewedAt: null,
    job: { id: v.id, title: v.title, company: v.company, location: v.location, salary: v.salary },
    user: i % 3 === 0 ? null : { id: 60 + i, nombre, email: correo(nombre) },
  };
});

// ===========================================================================
// NOTIFICACIONES del candidato y del usuario
// ===========================================================================
const PLANTILLAS_AVISO: Array<{ type: string; title: string; message: (i: number) => string }> = [
  { type: 'application_status', title: 'Tu postulación avanzó', message: (i) => `Tu perfil para ${VACANTES[i % VACANTES.length].title} ya está en evaluación con un especialista.` },
  { type: 'sent_to_company', title: 'Tu perfil fue enviado a la empresa', message: (i) => `${VACANTES[i % VACANTES.length].company} recibió tu perfil para ${VACANTES[i % VACANTES.length].title}.` },
  { type: 'interview_requested', title: 'Te proponen una entrevista', message: (i) => `${VACANTES[i % VACANTES.length].company} propone el jueves a las 10:00 para conversar sobre la vacante.` },
  { type: 'interview_confirmed', title: 'Entrevista confirmada', message: () => 'Quedó confirmada tu entrevista del martes a las 16:30 por videollamada. Revisa tu correo para el enlace.' },
  { type: 'interview_rescheduled', title: 'Entrevista reprogramada', message: () => 'La empresa movió tu entrevista al viernes a las 12:00.' },
  { type: 'application_status', title: 'Actualización de tu postulación', message: (i) => `La vacante ${VACANTES[i % VACANTES.length].title} se cubrió con otro perfil. Gracias por tu interés.` },
  { type: 'interview_cancelled', title: 'Entrevista cancelada', message: () => 'La empresa canceló la entrevista programada. Te avisaremos si propone otro horario.' },
];

const avisosCandidato = Array.from({ length: 26 }, (_, i) => {
  const p = PLANTILLAS_AVISO[i % PLANTILLAS_AVISO.length];
  return {
    id: 9000 + i,
    userId: USUARIOS.candidate.id,
    type: p.type,
    title: p.title,
    message: p.message(i),
    // Unos con enlace (navegan y se marcan leídos) y otros sin él.
    link: i % 3 === 0 ? '/candidate/applications' : null,
    read: i >= 5,
    readAt: i >= 5 ? hace(i * 0.8) : null,
    createdAt: hace(i * 0.9, i === 0 ? 0.02 : i),
  };
});

// ===========================================================================
// Fixtures
// ===========================================================================
export const fixtures: Fixture[] = [
  // --- Perfil -------------------------------------------------------------
  { metodo: 'GET', patron: '/api/profile', respuesta: ({ rol }) => ({ success: true, data: perfilDe(rol) }) },
  { metodo: 'PUT', patron: '/api/profile', retraso: 500, respuesta: guardarPerfil },

  {
    metodo: 'GET',
    patron: '/api/profile/experience',
    respuesta: () => ({
      success: true,
      data: experienciasOrdenadas(),
      añosExperiencia: perfilCandidato.añosExperiencia,
    }),
  },
  {
    metodo: 'POST',
    patron: '/api/profile/experience',
    retraso: 400,
    respuesta: ({ cuerpo }) => {
      const c = (cuerpo ?? {}) as Record<string, unknown>;
      const nueva: ExperienciaFx = {
        id: siguienteId++,
        candidateId: CANDIDATE_ID,
        empresa: String(c.empresa ?? ''),
        puesto: String(c.puesto ?? ''),
        ubicacion: c.ubicacion ? String(c.ubicacion) : null,
        fechaInicio: `${c.fechaInicio}T00:00:00.000Z`,
        fechaFin: c.esActual || !c.fechaFin ? null : `${c.fechaFin}T00:00:00.000Z`,
        esActual: Boolean(c.esActual),
        descripcion: c.descripcion ? String(c.descripcion) : null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      experiencias.push(nueva);
      recalcularAnios();
      return { success: true, message: 'Experiencia agregada exitosamente', data: nueva };
    },
  },
  {
    metodo: 'PUT',
    patron: '/api/profile/experience/:id',
    retraso: 400,
    respuesta: ({ params, cuerpo }) => {
      const c = (cuerpo ?? {}) as Record<string, unknown>;
      const exp = experiencias.find((e) => e.id === Number(params.id));
      if (!exp) return json({ success: false, error: 'Experiencia no encontrada' }, 404);
      Object.assign(exp, {
        empresa: String(c.empresa ?? exp.empresa),
        puesto: String(c.puesto ?? exp.puesto),
        ubicacion: c.ubicacion ? String(c.ubicacion) : null,
        fechaInicio: c.fechaInicio ? `${c.fechaInicio}T00:00:00.000Z` : exp.fechaInicio,
        fechaFin: c.esActual || !c.fechaFin ? null : `${c.fechaFin}T00:00:00.000Z`,
        esActual: Boolean(c.esActual),
        descripcion: c.descripcion ? String(c.descripcion) : null,
        updatedAt: new Date().toISOString(),
      });
      recalcularAnios();
      return { success: true, message: 'Experiencia actualizada', data: exp };
    },
  },
  {
    metodo: 'DELETE',
    patron: '/api/profile/experience/:id',
    retraso: 300,
    respuesta: ({ params }) => {
      experiencias = experiencias.filter((e) => e.id !== Number(params.id));
      recalcularAnios();
      return { success: true, message: 'Experiencia eliminada' };
    },
  },

  {
    // Como el route.ts: `candidate?.documents || []` (sin expediente, lista vacía).
    metodo: 'GET',
    patron: '/api/profile/documents',
    respuesta: ({ rol }) => ({ success: true, data: rol === 'candidate' ? documentos : [] }),
  },
  {
    metodo: 'POST',
    patron: '/api/profile/documents',
    retraso: 300,
    respuesta: ({ cuerpo }) => {
      const c = (cuerpo ?? {}) as { name?: string; fileUrl?: string; fileType?: string };
      if (!c.name || !c.fileUrl) {
        return json({ success: false, error: 'Nombre y URL del archivo son requeridos' }, 400);
      }
      const doc: DocumentoFx = {
        id: siguienteId++,
        candidateId: CANDIDATE_ID,
        name: c.name.trim(),
        fileUrl: c.fileUrl,
        fileType: c.fileType || null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      documentos = [doc, ...documentos];
      return json({ success: true, data: doc }, 201);
    },
  },
  {
    metodo: 'DELETE',
    patron: '/api/profile/documents',
    retraso: 300,
    respuesta: ({ url }) => {
      const id = url.searchParams.get('id');
      if (!id) return json({ success: false, error: 'ID requerido' }, 400);
      documentos = documentos.filter((d) => d.id !== Number(id));
      return { success: true, message: 'Documento eliminado' };
    },
  },

  {
    // FormData → { file: File }. En desarrollo el real devuelve '/uploads/<archivo>'.
    metodo: 'POST',
    patron: '/api/upload',
    retraso: 700,
    respuesta: ({ cuerpo }) => {
      const archivo = (cuerpo as { file?: File } | undefined)?.file;
      const nombre = archivo && typeof archivo === 'object' && 'name' in archivo ? archivo.name : 'archivo.pdf';
      const limpio = nombre.toLowerCase().replace(/[^a-z0-9.]+/g, '-');
      return { success: true, url: `/uploads/${Date.now()}-${limpio}`, filename: nombre };
    },
  },

  // --- Postulaciones -------------------------------------------------------
  { metodo: 'GET', patron: '/api/my-applications', respuesta: misPostulaciones },
  { metodo: 'GET', patron: '/api/candidate/applications', respuesta: postulacionesDelCandidato },

  {
    metodo: 'GET',
    patron: '/api/applications',
    retraso: 250,
    respuesta: () => {
      const total = aplicacionesAdmin.length;
      return {
        success: true,
        data: aplicacionesAdmin,
        pagination: { page: 1, limit: 500, total, totalPages: 1, hasNext: false, hasPrev: false },
        count: total,
        total,
      };
    },
  },
  {
    metodo: 'PATCH',
    patron: '/api/applications/:id',
    retraso: 300,
    respuesta: ({ params, cuerpo }) => {
      const app = aplicacionesAdmin.find((a) => a.id === Number(params.id));
      if (!app) return json({ success: false, error: 'Aplicación no encontrada' }, 404);
      const { status } = (cuerpo ?? {}) as { status?: string };
      if (status) app.status = status;
      app.updatedAt = new Date().toISOString();
      return { success: true, data: app };
    },
  },

  // --- Notificaciones (candidato y usuario; el resto, base.ts) -------------
  {
    metodo: 'GET',
    patron: '/api/notifications/count',
    respuesta: (ctx) =>
      esCandidato(ctx.rol)
        ? { success: true, count: avisosCandidato.filter((n) => !n.read).length }
        : deBase('GET', '/api/notifications/count')(ctx),
  },
  {
    metodo: 'GET',
    patron: '/api/notifications',
    respuesta: (ctx) => {
      if (!esCandidato(ctx.rol)) return deBase('GET', '/api/notifications')(ctx);
      const filtro = ctx.url.searchParams.get('filter');
      const page = Math.max(1, Number(ctx.url.searchParams.get('page') || 1));
      const limit = Math.min(50, Math.max(1, Number(ctx.url.searchParams.get('limit') || 20)));
      const lista = avisosCandidato.filter((n) => (filtro === 'unread' ? !n.read : filtro === 'read' ? n.read : true));
      const total = lista.length;
      return {
        success: true,
        data: lista.slice((page - 1) * limit, page * limit),
        unreadTotal: avisosCandidato.filter((n) => !n.read).length,
        pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
      };
    },
  },
  {
    metodo: 'PATCH',
    patron: '/api/notifications',
    respuesta: (ctx) => {
      if (!esCandidato(ctx.rol)) return deBase('PATCH', '/api/notifications')(ctx);
      const c = (ctx.cuerpo ?? {}) as { all?: boolean; ids?: number[] };
      const marcar = (n: (typeof avisosCandidato)[number]) => {
        n.read = true;
        n.readAt = new Date().toISOString();
      };
      if (c.all) {
        avisosCandidato.filter((n) => !n.read).forEach(marcar);
        return { success: true, message: 'Todas las notificaciones marcadas como leídas' };
      }
      if (Array.isArray(c.ids) && c.ids.length > 0) {
        avisosCandidato.filter((n) => c.ids!.includes(n.id)).forEach(marcar);
        return { success: true, message: 'Notificaciones marcadas como leídas' };
      }
      return json({ success: false, error: 'Debes enviar { ids: [...] } o { all: true }' }, 400);
    },
  },
];
