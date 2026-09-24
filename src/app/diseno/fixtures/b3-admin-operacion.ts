// RUTA: src/app/diseno/fixtures/b3-admin-operacion.ts
//
// Bloque 3 · admin operación: asignar candidatos (/admin/assign-candidates),
// asignar equipo (/admin/assignments), candidatos interesados
// (/admin/direct-applications) y entrevistas (/admin/interviews).
//
// Formato en ./tipos.ts. Van ANTES que las base: si repites un patrón, gana el
// tuyo. Cada respuesta copia la FORMA de su route.ts (success, data,
// pagination, stats, pipelineStats…); si la forma no coincide, la página se
// rompe en el banco y engaña.
//
// Hay estado en memoria (asignaciones, postulaciones procesadas, entrevistas
// editadas): así, al guardar en el banco, la recarga posterior enseña el
// cambio, como en la aplicación real. Se reinicia al recargar la página.
//
// Datos inventados y verosímiles (nombres ficticios, @correo.mx / @inakat.com).
// NUNCA datos reales de producción.

import type { Fixture } from './tipos';
import { ESPECIALIDADES, VACANTES } from './base';

const ahora = Date.now();
const DIA = 86_400_000;
const HORA = 3_600_000;
const hace = (dias: number, horas = 0) => new Date(ahora - dias * DIA - horas * HORA).toISOString();

/** Quita acentos y espacios para armar correos. */
const plano = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '.');

/** Día local (AAAA-MM-DD) a `dias` de hoy: la forma de availableSlots. */
const diaLocal = (dias: number) => {
  const d = new Date(ahora + dias * DIA);
  const dd = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${dd(d.getMonth() + 1)}-${dd(d.getDate())}`;
};

/** Fecha ISO a `dias` de hoy, a la hora local `hh:mm`. */
const enDia = (dias: number, hhmm: string) => new Date(`${diaLocal(dias)}T${hhmm}:00`).toISOString();

const paginacion = (page: number, limit: number, total: number) => {
  const totalPages = Math.max(1, Math.ceil(total / limit));
  return { page, limit, total, totalPages, hasNext: page < totalPages, hasPrev: page > 1 };
};

const entero = (valor: string | null, respaldo: number) => {
  const n = Number.parseInt(valor ?? '', 10);
  return Number.isFinite(n) && n > 0 ? n : respaldo;
};

// ===========================================================================
// Equipo interno (reclutadores y especialistas activos)
// ===========================================================================
interface Persona {
  id: number;
  nombre: string;
  apellidoPaterno: string;
  email: string;
  specialty?: string;
  isActive?: boolean;
}

const RECLUTADORES: Persona[] = [
  { id: 30, nombre: 'Paola', apellidoPaterno: 'Méndez', email: 'paola.mendez@inakat.com' },
  { id: 32, nombre: 'Rodrigo', apellidoPaterno: 'Garza', email: 'rodrigo.garza@inakat.com' },
  { id: 33, nombre: 'Lorena', apellidoPaterno: 'Villarreal', email: 'lorena.villarreal@inakat.com' },
];

const ESPECIALISTAS: Persona[] = [
  { id: 31, nombre: 'Diego', apellidoPaterno: 'Calderón', email: 'diego.calderon@inakat.com', specialty: 'Tecnología' },
  { id: 34, nombre: 'Mónica', apellidoPaterno: 'Esquivel', email: 'monica.esquivel@inakat.com', specialty: 'Salud' },
  { id: 35, nombre: 'Arturo', apellidoPaterno: 'Leal', email: 'arturo.leal@inakat.com', specialty: 'Ingeniería' },
  { id: 36, nombre: 'Gabriela', apellidoPaterno: 'Olvera', email: 'gabriela.olvera@inakat.com', specialty: 'Educación' },
];

/** Reclutadora dada de baja que sigue a cargo de una vacante (ADM-015). */
const RECLUTADORA_BAJA: Persona = {
  id: 37,
  nombre: 'Laura',
  apellidoPaterno: 'Benítez',
  email: 'laura.benitez@inakat.com',
  isActive: false,
};

const PERSONAS = [...RECLUTADORES, ...ESPECIALISTAS, RECLUTADORA_BAJA];
const personaPorId = (id: number | null) => (id ? PERSONAS.find((p) => p.id === id) ?? null : null);

// ===========================================================================
// Vacantes activas y su equipo (una sola verdad para las tres pantallas)
// ===========================================================================
const ACTIVAS = VACANTES.filter((v) => v.status === 'active');

interface Asignacion {
  id: number;
  jobId: number;
  recruiterId: number | null;
  specialistId: number | null;
  recruiterStatus: string;
  specialistStatus: string;
  recruiterNotes: string | null;
  specialistNotes: string | null;
}

const NOTAS_RECLUTADOR = [
  'Buscamos gente con disponibilidad inmediata; la empresa prioriza experiencia en el sector sobre el título.',
  'Dos candidatas muy fuertes; falta confirmar expectativa salarial antes de enviarlas.',
  null,
];
const NOTAS_ESPECIALISTA = [
  'Evaluación técnica aplicada a tres personas. Recomiendo a dos para entrevista con la empresa.',
  null,
];

/** Estado inicial del equipo de cada vacante activa (variado a propósito). */
function asignacionInicial(jobId: number, k: number): Asignacion | null {
  const base = { id: 500 + k, jobId, recruiterNotes: null, specialistNotes: null };
  const vacante = ACTIVAS[k];
  // Especialista de la misma especialidad que la vacante, si lo hay.
  const especialista =
    ESPECIALISTAS.find((e) => e.specialty === vacante?.profile) ?? ESPECIALISTAS[k % ESPECIALISTAS.length];
  const reclutador = RECLUTADORES[k % RECLUTADORES.length];

  if (k === 7) {
    // La reclutadora está desactivada: el select debe decirlo (ADM-015).
    return { ...base, recruiterId: RECLUTADORA_BAJA.id, specialistId: null, recruiterStatus: 'pending', specialistStatus: 'pending' };
  }
  if (k === 11) {
    // Fila de asignación con los dos ids en null: cuenta como «Sin asignar».
    return { ...base, recruiterId: null, specialistId: null, recruiterStatus: 'pending', specialistStatus: 'pending' };
  }
  switch (k % 6) {
    case 0:
      return null; // sin equipo
    case 1:
      return { ...base, recruiterId: reclutador.id, specialistId: especialista.id, recruiterStatus: 'pending', specialistStatus: 'pending' };
    case 2:
      return {
        ...base,
        recruiterId: reclutador.id,
        specialistId: especialista.id,
        recruiterStatus: 'reviewing',
        specialistStatus: 'pending',
        recruiterNotes: NOTAS_RECLUTADOR[k % NOTAS_RECLUTADOR.length],
      };
    case 3:
      return { ...base, recruiterId: reclutador.id, specialistId: null, recruiterStatus: 'pending', specialistStatus: 'pending' };
    case 4:
      return {
        ...base,
        recruiterId: reclutador.id,
        specialistId: especialista.id,
        recruiterStatus: 'sent_to_specialist',
        specialistStatus: 'sent_to_company',
        recruiterNotes: NOTAS_RECLUTADOR[0],
        specialistNotes: NOTAS_ESPECIALISTA[0],
      };
    default:
      return {
        ...base,
        recruiterId: reclutador.id,
        specialistId: especialista.id,
        recruiterStatus: 'sent_to_specialist',
        specialistStatus: 'evaluating',
        recruiterNotes: NOTAS_RECLUTADOR[1],
      };
  }
}

/** Estado vivo del banco (lo cambia POST /api/admin/assignments). */
const asignaciones = new Map<number, Asignacion>();
ACTIVAS.forEach((v, k) => {
  const a = asignacionInicial(v.id, k);
  if (a) asignaciones.set(v.id, a);
});

type EstadoAsignacion = 'unassigned' | 'partial' | 'assigned' | 'in_progress' | 'completed';

/** Mismo helper que src/app/api/admin/assignments/route.ts. */
function estadoDeAsignacion(a: Asignacion | null | undefined): EstadoAsignacion {
  if (!a || (!a.recruiterId && !a.specialistId)) return 'unassigned';
  if (a.specialistStatus === 'sent_to_company') return 'completed';
  if (a.recruiterStatus === 'reviewing' || a.recruiterStatus === 'sent_to_specialist' || a.specialistStatus === 'evaluating') {
    return 'in_progress';
  }
  if (a.recruiterId && a.specialistId) return 'assigned';
  return 'partial';
}

/** Algunas empresas vienen de una solicitud aprobada (nombre comercial), otras no. */
const nombreComercial = (company: string, k: number) => (k % 3 === 0 ? `${company} S.A. de C.V.` : null);

/** Una vacante tal como la devuelve GET /api/admin/assignments (include assignment, user, _count). */
function vacanteConEquipo(k: number) {
  const v = ACTIVAS[k];
  const a = asignaciones.get(v.id) ?? null;
  const comercial = nombreComercial(v.company, k);
  const recruiter = personaPorId(a?.recruiterId ?? null);
  const specialist = personaPorId(a?.specialistId ?? null);
  return {
    ...v,
    user: {
      id: v.userId,
      nombre: `Contacto de ${v.company}`,
      companyRequest: comercial ? { nombreEmpresa: comercial } : null,
    },
    assignment: a
      ? {
          ...a,
          createdAt: hace(20 - k),
          updatedAt: hace(k % 4),
          recruiter: recruiter
            ? {
                id: recruiter.id,
                nombre: recruiter.nombre,
                apellidoPaterno: recruiter.apellidoPaterno,
                email: recruiter.email,
                isActive: recruiter.isActive ?? true,
              }
            : null,
          specialist: specialist
            ? {
                id: specialist.id,
                nombre: specialist.nombre,
                apellidoPaterno: specialist.apellidoPaterno,
                email: specialist.email,
                specialty: specialist.specialty ?? null,
                isActive: specialist.isActive ?? true,
              }
            : null,
        }
      : null,
  };
}

// ===========================================================================
// Banco de candidatos (GET /api/admin/candidates)
// ===========================================================================
const NOMBRES = [
  'Mariana', 'Carlos', 'Fernanda', 'Jorge', 'Valeria', 'Ricardo', 'Daniela', 'Emilio', 'Renata', 'Hugo',
  'Ximena', 'Andrés', 'Paulina', 'Sebastián', 'Regina', 'Iván', 'Camila', 'Óscar', 'Natalia', 'Rafael',
  'Lucía', 'Martín', 'Alejandra', 'Tomás', 'Sofía', 'Gerardo', 'Itzel', 'Mauricio', 'Brenda', 'Adrián',
  'Karla', 'Julián',
];
const APELLIDOS = [
  'Pérez', 'Ibarra', 'Ruiz', 'Castañeda', 'Núñez', 'Solís', 'Ortega', 'Vargas', 'Aguilar', 'Salazar',
  'Fuentes', 'Montemayor', 'Treviño', 'Cantú', 'Zapata', 'Rosales', 'Delgado', 'Quintero', 'Elizondo', 'Barragán',
];
const UNIVERSIDADES = [
  'UANL', 'Tecnológico de Monterrey', 'UNAM', 'Universidad de Guadalajara', 'IPN', 'UDEM', 'BUAP', null, 'ITESO', 'UAQ',
];
const CARRERAS: Record<string, string> = {
  Tecnología: 'Ingeniería en Sistemas Computacionales',
  Arquitectura: 'Arquitectura',
  'Diseño Gráfico': 'Diseño Gráfico',
  'Producción Audiovisual': 'Comunicación',
  Educación: 'Pedagogía',
  'Administración de Oficina': 'Administración de Empresas',
  Finanzas: 'Contaduría Pública',
  Marketing: 'Mercadotecnia',
  Ingeniería: 'Ingeniería Industrial',
  Salud: 'Enfermería',
};
const NIVELES = ['Practicante', 'Jr', 'Middle', 'Sr', 'Director'];
const FUENTES = ['linkedin', 'referido', 'bolsa_inakat', 'evento'];

interface CandidatoBanco {
  id: number;
  nombre: string;
  apellidoPaterno: string;
  apellidoMaterno: string | null;
  email: string;
  telefono: string | null;
  sexo: string | null;
  fechaNacimiento: string | null;
  universidad: string | null;
  carrera: string | null;
  nivelEstudios: string | null;
  profile: string | null;
  subcategory: string | null;
  seniority: string | null;
  añosExperiencia: number;
  cvUrl: string | null;
  linkedinUrl: string | null;
  portafolioUrl: string | null;
  status: string;
  source: string;
  notas: string | null;
  createdAt: string;
  updatedAt: string;
  experiences: unknown[];
  documents: unknown[];
  edad: number | null;
  activeApplications: number;
}

const BANCO: CandidatoBanco[] = Array.from({ length: 76 }, (_, i) => {
  const nombre = NOMBRES[i % NOMBRES.length];
  const apellidoPaterno = APELLIDOS[(i * 7) % APELLIDOS.length];
  const apellidoMaterno = i % 5 === 4 ? null : APELLIDOS[(i * 3 + 5) % APELLIDOS.length];
  const especialidad = ESPECIALIDADES[i % ESPECIALIDADES.length];
  const edad = 22 + ((i * 5) % 26);
  // Casi todos disponibles; algunos ya en proceso; unos pocos contratados o
  // inactivos (el filtro de la pantalla los deja fuera en el servidor).
  const status = i % 11 === 10 ? 'hired' : i % 13 === 12 ? 'inactive' : i % 4 === 3 ? 'in_process' : 'available';
  return {
    id: 2001 + i,
    nombre,
    apellidoPaterno,
    apellidoMaterno,
    email: `${plano(nombre)}.${plano(apellidoPaterno)}${i >= NOMBRES.length ? i : ''}@correo.mx`,
    telefono: i % 6 === 5 ? null : `81 ${String(1000 + ((i * 37) % 9000)).padStart(4, '0')} ${String(2000 + ((i * 53) % 7000)).padStart(4, '0')}`,
    sexo: i % 2 === 0 ? 'F' : 'M',
    fechaNacimiento: new Date(ahora - edad * 365.25 * DIA).toISOString(),
    universidad: UNIVERSIDADES[i % UNIVERSIDADES.length],
    carrera: CARRERAS[especialidad.name] ?? null,
    nivelEstudios: i % 7 === 0 ? 'Maestría' : 'Licenciatura',
    profile: i % 17 === 16 ? null : especialidad.name,
    subcategory: especialidad.subcategories[i % especialidad.subcategories.length] ?? null,
    seniority: NIVELES[(i * 3) % NIVELES.length],
    añosExperiencia: [0, 1, 2, 3, 4, 6, 8, 12, 15][i % 9],
    cvUrl: i % 4 === 1 ? null : `https://archivos.inakat.com/cv/${2001 + i}.pdf`,
    linkedinUrl: i % 3 === 0 ? `https://www.linkedin.com/in/${plano(nombre)}-${plano(apellidoPaterno)}` : null,
    portafolioUrl: null,
    status,
    source: FUENTES[i % FUENTES.length],
    notas: null,
    createdAt: hace(3 + i * 2),
    updatedAt: hace(i % 9),
    experiences: [],
    documents: [],
    edad,
    activeApplications: [0, 0, 1, 2, 0, 3, 1, 0][i % 8],
  };
});

// ===========================================================================
// Pipeline de cada vacante (GET /api/admin/assign-candidates?jobId=)
// ===========================================================================
const ESTADOS_PIPELINE = [
  'injected_by_admin', 'pending', 'reviewing', 'sent_to_specialist', 'evaluating', 'sent_to_company',
  'company_interested', 'interviewed', 'accepted', 'rejected', 'discarded', 'archived',
];

/** Postulantes que no están en el banco (se postularon desde /talents). */
const EXTERNOS = [
  { nombre: 'Leticia Robles Guerra', email: 'leticia.robles@correo.mx', telefono: '33 2841 7730' },
  { nombre: 'Bruno Echeverría', email: 'bruno.echeverria@correo.mx', telefono: null },
  { nombre: 'Anaid Cervantes', email: 'anaid.cervantes@correo.mx', telefono: '55 6120 4418' },
  { nombre: 'Samuel Tovar Ríos', email: 'samuel.tovar@correo.mx', telefono: '81 3390 1275' },
];

const NOTAS_POSTULACION = [
  'Pidió que lo contacten después de las 17:00.',
  'Llega referida por el área de Recursos Humanos de la empresa; revisar con prioridad.',
  null,
  null,
];

/** Candidatos que el banco asignó desde la pantalla (POST), por vacante. */
const asignadosEnBanco = new Map<number, Array<{ candidatoId: number; cuando: string }>>();

interface PostulacionPipeline {
  id: number;
  candidateName: string;
  candidateEmail: string;
  candidatePhone: string | null;
  cvUrl: string | null;
  coverLetter: string | null;
  status: string;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

function postulacionesDe(jobId: number): PostulacionPipeline[] {
  const vacante = VACANTES.find((v) => v.id === jobId);
  const cuantas = vacante?._count.applications ?? 0;
  const delBanco = BANCO.filter((c) => (c.id + jobId) % 6 === 0 && c.status !== 'inactive');
  const lista: PostulacionPipeline[] = [];
  for (let i = 0; i < cuantas; i++) {
    const externo = i % 4 === 3 ? EXTERNOS[(jobId + i) % EXTERNOS.length] : null;
    const c = externo ? null : delBanco[i % Math.max(1, delBanco.length)];
    const nombre = externo ? externo.nombre : c ? `${c.nombre} ${c.apellidoPaterno}${c.apellidoMaterno ? ` ${c.apellidoMaterno}` : ''}` : `Candidato ${i + 1}`;
    const email = externo ? externo.email : c?.email ?? `candidato${i}@correo.mx`;
    if (lista.some((p) => p.candidateEmail === email)) continue;
    lista.push({
      id: jobId * 100 + i,
      candidateName: nombre,
      candidateEmail: email,
      candidatePhone: externo ? externo.telefono : c?.telefono ?? null,
      cvUrl: i % 5 === 2 ? null : i % 5 === 4 ? `drive.google.com/file/d/${jobId}${i}cv/view` : `https://archivos.inakat.com/cv/p-${jobId}-${i}.pdf`,
      coverLetter: null,
      status: ESTADOS_PIPELINE[(i + jobId) % ESTADOS_PIPELINE.length],
      notes: NOTAS_POSTULACION[(i + jobId) % NOTAS_POSTULACION.length],
      createdAt: hace(14 - i, 3),
      updatedAt: hace(Math.max(0, 6 - i), i),
    });
  }
  // Los que el admin asignó desde el banco en esta sesión.
  for (const { candidatoId, cuando } of asignadosEnBanco.get(jobId) ?? []) {
    const c = BANCO.find((x) => x.id === candidatoId);
    if (!c || lista.some((p) => p.candidateEmail === c.email)) continue;
    lista.unshift({
      id: jobId * 1000 + candidatoId,
      candidateName: `${c.nombre} ${c.apellidoPaterno}${c.apellidoMaterno ? ` ${c.apellidoMaterno}` : ''}`,
      candidateEmail: c.email,
      candidatePhone: c.telefono,
      cvUrl: c.cvUrl,
      coverLetter: null,
      status: 'injected_by_admin',
      notes: null,
      createdAt: cuando,
      updatedAt: cuando,
    });
  }
  return lista;
}

function pipelineDe(jobId: number) {
  const aplicaciones = postulacionesDe(jobId);
  const a = asignaciones.get(jobId) ?? null;
  const recruiter = personaPorId(a?.recruiterId ?? null);
  const specialist = personaPorId(a?.specialistId ?? null);

  const data = aplicaciones.map((app) => {
    const c = BANCO.find((x) => x.email === app.candidateEmail);
    return {
      ...app,
      // La API manda `undefined` (se omite en el JSON) si no hay expediente.
      candidateProfile: c
        ? {
            id: c.id,
            email: c.email,
            nombre: c.nombre,
            apellidoPaterno: c.apellidoPaterno,
            telefono: c.telefono,
            profile: c.profile,
            seniority: c.seniority,
            universidad: c.universidad,
            añosExperiencia: c.añosExperiencia,
            cvUrl: c.cvUrl,
            linkedinUrl: c.linkedinUrl,
          }
        : undefined,
      assignedRecruiter: recruiter ? { id: recruiter.id, name: `${recruiter.nombre} ${recruiter.apellidoPaterno}` } : null,
      assignedSpecialist: specialist
        ? { id: specialist.id, name: `${specialist.nombre} ${specialist.apellidoPaterno}`, specialty: specialist.specialty ?? null }
        : null,
      recruiterNotes: a?.recruiterNotes ?? null,
      specialistNotes: a?.specialistNotes ?? null,
      recruiterStatus: a?.recruiterStatus ?? null,
      specialistStatus: a?.specialistStatus ?? null,
    };
  });

  const cuenta = (...estados: string[]) => aplicaciones.filter((x) => estados.includes(x.status)).length;
  return {
    success: true,
    data,
    jobAssignment: a
      ? {
          id: a.id,
          recruiter: recruiter
            ? { id: recruiter.id, nombre: recruiter.nombre, apellidoPaterno: recruiter.apellidoPaterno, email: recruiter.email }
            : null,
          specialist: specialist
            ? {
                id: specialist.id,
                nombre: specialist.nombre,
                apellidoPaterno: specialist.apellidoPaterno,
                email: specialist.email,
                specialty: specialist.specialty ?? null,
              }
            : null,
          recruiterNotes: a.recruiterNotes,
          specialistNotes: a.specialistNotes,
          recruiterStatus: a.recruiterStatus,
          specialistStatus: a.specialistStatus,
        }
      : null,
    pipelineStats: {
      total: aplicaciones.length,
      pending: cuenta('pending'),
      injected: cuenta('injected_by_admin'),
      reviewing: cuenta('reviewing'),
      sentToSpecialist: cuenta('sent_to_specialist'),
      evaluating: cuenta('evaluating'),
      sentToCompany: cuenta('sent_to_company'),
      companyInterested: cuenta('company_interested'),
      interviewed: cuenta('interviewed'),
      archived: cuenta('archived'),
      hired: cuenta('accepted'),
      rejected: cuenta('rejected', 'discarded'),
    },
    count: aplicaciones.length,
  };
}

// ===========================================================================
// Postulaciones directas pendientes (GET/PUT /api/admin/direct-applications)
// ===========================================================================
const CARTA_LARGA =
  'Hola, me interesa mucho la vacante porque llevo cinco años coordinando equipos en una empresa del mismo giro y ' +
  'quiero dar el siguiente paso en una organización que apueste por la mejora continua. En mi puesto actual ' +
  'reduje los tiempos de entrega un 18 % reorganizando el flujo de trabajo y capacitando a las personas nuevas. ' +
  'Tengo disponibilidad para cambiarme de ciudad y puedo incorporarme en dos semanas. Quedo atenta a cualquier ' +
  'pregunta y agradezco de antemano la oportunidad de conversar.';

interface Directa {
  id: number;
  candidateName: string;
  candidateEmail: string;
  candidatePhone: string | null;
  cvUrl: string | null;
  coverLetter: string | null;
  createdAt: string;
  /** Índice en ACTIVAS de la vacante a la que se postuló. */
  k: number;
  /** Vacante heredada sin dueño (job.user = null, ADM-018). */
  sinDueno?: boolean;
}

const DIRECTAS: Directa[] = [
  { id: 9001, candidateName: 'Alejandra Marroquín Téllez', candidateEmail: 'alejandra.marroquin@correo.mx', candidatePhone: '81 2230 9941', cvUrl: 'https://archivos.inakat.com/cv/d-9001.pdf', coverLetter: CARTA_LARGA, createdAt: hace(0, 2), k: 2 },
  { id: 9002, candidateName: 'Kevin Arredondo', candidateEmail: 'kevin.arredondo@correo.mx', candidatePhone: null, cvUrl: 'drive.google.com/file/d/1kArredondoCV/view', coverLetter: 'Me gustaría aplicar. Adjunto mi CV.', createdAt: hace(0, 7), k: 0 },
  { id: 9003, candidateName: 'Rosa Isela Maldonado', candidateEmail: 'rosa.maldonado@correo.mx', candidatePhone: '55 4102 3387', cvUrl: null, coverLetter: null, createdAt: hace(1, 1), k: 3 },
  { id: 9004, candidateName: 'Héctor Villalobos Cárdenas', candidateEmail: 'hector.villalobos@correo.mx', candidatePhone: '33 1908 5520', cvUrl: 'https://archivos.inakat.com/cv/d-9004.pdf', coverLetter: 'Soy ingeniero con experiencia en líneas de ensamble automotriz y manejo de PLC. Busco un proyecto de largo plazo en Monterrey.', createdAt: hace(1, 6), k: 9, sinDueno: true },
  // Enlace peligroso guardado antes de validar: la pantalla NO debe enlazarlo (ADM-017).
  { id: 9005, candidateName: 'Pamela Irigoyen', candidateEmail: 'pamela.irigoyen@correo.mx', candidatePhone: '81 5520 1144', cvUrl: 'javascript:alert(document.cookie)', coverLetter: null, createdAt: hace(2, 3), k: 5 },
  // Otra persona ya la movió: el PUT responde 409 (ADM-039).
  { id: 9006, candidateName: 'Ulises Parra', candidateEmail: 'ulises.parra@correo.mx', candidatePhone: '81 7781 0092', cvUrl: 'https://archivos.inakat.com/cv/d-9006.pdf', coverLetter: 'Buen día, me interesa la posición de medio tiempo.', createdAt: hace(3), k: 4 },
  { id: 9007, candidateName: 'María José de la Garza Santos', candidateEmail: 'mariajose.delagarza@correo.mx', candidatePhone: '81 6632 4410', cvUrl: 'https://archivos.inakat.com/cv/d-9007.pdf', coverLetter: CARTA_LARGA.slice(0, 220), createdAt: hace(4, 5), k: 7 },
  { id: 9008, candidateName: 'Diego Armando Luna', candidateEmail: 'diegoarmando.luna@correo.mx', candidatePhone: null, cvUrl: null, coverLetter: 'Estudiante de último semestre, busco mi primera experiencia profesional.', createdAt: hace(6), k: 11 },
];

/** Ya procesadas en esta sesión del banco: salen de la bandeja. */
const directasProcesadas = new Map<number, string>();

function directaParaApi(d: Directa) {
  const v = ACTIVAS[d.k % ACTIVAS.length];
  const a = asignaciones.get(v.id) ?? null;
  const recruiter = personaPorId(a?.recruiterId ?? null);
  const comercial = nombreComercial(v.company, d.k);
  return {
    id: d.id,
    jobId: v.id,
    userId: null,
    candidateName: d.candidateName,
    candidateEmail: d.candidateEmail,
    candidatePhone: d.candidatePhone,
    cvUrl: d.cvUrl,
    coverLetter: d.coverLetter,
    status: 'pending',
    notes: null,
    createdAt: d.createdAt,
    updatedAt: d.createdAt,
    job: {
      id: v.id,
      title: v.title,
      company: v.company,
      location: v.location,
      status: v.status,
      assignment: a
        ? { id: a.id, recruiter: recruiter ? { id: recruiter.id, nombre: recruiter.nombre, apellidoPaterno: recruiter.apellidoPaterno } : null }
        : null,
      user: d.sinDueno
        ? null
        : {
            nombre: `Contacto de ${v.company}`,
            email: `contacto@${plano(v.company).replace(/\./g, '')}.mx`,
            companyRequest: comercial ? { nombreEmpresa: comercial } : null,
          },
    },
  };
}

// ===========================================================================
// Solicitudes de entrevista (GET /api/admin/interviews, PATCH /[id])
// ===========================================================================
interface Entrevista {
  id: number;
  applicationId: number;
  type: string;
  duration: number;
  participants: string | null;
  availableSlots: string;
  message: string | null;
  status: string;
  confirmedSlot: string | null;
  topic: string | null;
  scheduledStart: string | null;
  scheduledEnd: string | null;
  location: string | null;
  meetingUrl: string | null;
  adminNotes: string | null;
  createdAt: string;
  updatedAt: string;
  application: {
    id: number;
    candidateName: string;
    candidateEmail: string;
    candidatePhone: string | null;
    status: string;
    job: { id: number; title: string; company: string };
  };
  requestedBy: {
    nombre: string;
    apellidoPaterno: string | null;
    email: string;
    companyRequest: { nombreEmpresa: string } | null;
  };
}

const slots = (...lista: Array<[number, string]>) => JSON.stringify(lista.map(([dias, time]) => ({ date: diaLocal(dias), time })));
const participantes = (...lista: Array<[string, string]>) => JSON.stringify(lista.map(([nombre, email]) => ({ nombre, email })));

function entrevista(
  id: number,
  k: number,
  candidato: [string, string],
  datos: Partial<Omit<Entrevista, 'id' | 'application' | 'requestedBy'>>
): Entrevista {
  const v = ACTIVAS[k % ACTIVAS.length];
  const comercial = nombreComercial(v.company, k);
  const inicio = datos.scheduledStart ?? null;
  const duracion = datos.duration ?? 60;
  return {
    id,
    applicationId: 7000 + id,
    type: 'videocall',
    duration: duracion,
    participants: null,
    availableSlots: '[]',
    message: null,
    status: 'pending',
    confirmedSlot: null,
    topic: null,
    scheduledStart: inicio,
    scheduledEnd: inicio ? new Date(new Date(inicio).getTime() + duracion * 60_000).toISOString() : null,
    location: null,
    meetingUrl: null,
    adminNotes: null,
    createdAt: hace(2 + id % 9, id % 5),
    updatedAt: hace(id % 3),
    ...datos,
    application: {
      id: 7000 + id,
      candidateName: candidato[0],
      candidateEmail: candidato[1],
      candidatePhone: id % 3 === 0 ? null : '81 4455 ' + String(1000 + id).slice(-4),
      status: datos.status === 'confirmed' ? 'interviewed' : 'company_interested',
      job: { id: v.id, title: v.title, company: v.company },
    },
    requestedBy: {
      nombre: ['Tomás', 'Elena', 'Ramiro', 'Patricia'][k % 4],
      apellidoPaterno: ['Rivas', 'Sandoval', null, 'Guajardo'][k % 4],
      email: `rh@${plano(v.company).replace(/\./g, '')}.mx`,
      companyRequest: comercial ? { nombreEmpresa: comercial } : null,
    },
  };
}

const ENTREVISTAS: Entrevista[] = [
  // Pendientes
  entrevista(1, 0, ['Mariana Pérez Luna', 'mariana.perez@correo.mx'], {
    availableSlots: slots([1, '10:00'], [2, '16:30'], [4, '09:00']),
    message: 'Nos interesa conocerla esta semana. Si puede, preferimos por la mañana; entrará también el líder técnico.',
    participants: participantes(['Iván Robledo', 'ivan.robledo@grupoandes.mx']),
  }),
  entrevista(2, 2, ['Carlos Ibarra Soto', 'carlos.ibarra@correo.mx'], {
    type: 'presential',
    duration: 45,
    availableSlots: slots([-1, '11:00'], [3, '12:00'], [5, '17:00']),
    message: 'Entrevista en planta. Traer identificación oficial para el acceso.',
  }),
  entrevista(3, 4, ['Renata Aguilar', 'renata.aguilar@correo.mx'], { availableSlots: '[]', duration: 30 }),
  entrevista(4, 6, ['Hugo Salazar Delgado', 'hugo.salazar@correo.mx'], {
    availableSlots: slots([2, '13:00']),
    message:
      'Buen día. Revisamos el perfil y nos gustaría una primera plática de 60 minutos con Recursos Humanos y, si todo va bien, ' +
      'una segunda con la dirección del área la semana siguiente. Por favor confirmen con al menos 24 horas de anticipación ' +
      'para reservar la sala virtual y enviar la invitación a todos los participantes.',
    participants: participantes(['Patricia Guajardo', 'patricia.guajardo@constructorasierra.mx'], ['Luis Treviño', 'luis.trevino@constructorasierra.mx']),
  }),
  entrevista(5, 9, ['Ximena Fuentes', 'ximena.fuentes@correo.mx'], {
    type: 'presential',
    availableSlots: 'horario por definir', // JSON roto guardado a mano: «Sin horarios»
  }),

  // Agendadas (futuras)
  entrevista(6, 1, ['Fernanda Ruiz Montemayor', 'fernanda.ruiz@correo.mx'], {
    status: 'confirmed',
    scheduledStart: enDia(1, '11:30'),
    meetingUrl: 'https://meet.google.com/xqa-rtbn-kpe',
    topic: 'Entrevista técnica: procesos de mejora continua',
    adminNotes: 'Confirmado por teléfono con la candidata.',
  }),
  entrevista(7, 3, ['Jorge Castañeda', 'jorge.castaneda@correo.mx'], {
    status: 'confirmed',
    type: 'presential',
    duration: 90,
    scheduledStart: enDia(3, '09:00'),
    location: 'Av. Constitución 1450, piso 8, Col. Centro, Monterrey, N.L.',
    topic: 'Entrevista con dirección',
  }),
  // Liga guardada antes de validar (sin https): se enseña como texto (ADM-065).
  entrevista(8, 5, ['Valeria Núñez Zapata', 'valeria.nunez@correo.mx'], {
    status: 'confirmed',
    scheduledStart: enDia(6, '17:00'),
    meetingUrl: 'meet.google.com/abc-defg-hij',
  }),

  // Pasadas (confirmadas con fecha vencida)
  entrevista(9, 7, ['Ricardo Solís', 'ricardo.solis@correo.mx'], {
    status: 'confirmed',
    scheduledStart: enDia(-2, '10:00'),
    meetingUrl: 'https://zoom.us/j/81234567890',
    adminNotes: 'La empresa pidió segunda entrevista; pendiente de agendar.',
  }),
  entrevista(10, 8, ['Daniela Ortega Rosales', 'daniela.ortega@correo.mx'], {
    status: 'confirmed',
    type: 'presential',
    scheduledStart: enDia(-9, '12:30'),
    location: 'Blvd. Díaz Ordaz 140, San Pedro Garza García, N.L.',
  }),

  // Canceladas y rechazadas
  entrevista(11, 10, ['Emilio Vargas', 'emilio.vargas@correo.mx'], {
    status: 'cancelled',
    availableSlots: slots([-4, '10:00'], [-3, '10:00']),
    adminNotes: 'El candidato aceptó otra oferta.',
  }),
  entrevista(12, 12, ['Brenda Cantú Elizondo', 'brenda.cantu@correo.mx'], {
    status: 'rejected',
    message: 'Ya no requerimos la entrevista, cerramos el proceso con otra persona.',
  }),
  entrevista(13, 13, ['Óscar Quintero', 'oscar.quintero@correo.mx'], {
    status: 'cancelled',
    scheduledStart: enDia(-1, '16:00'),
    meetingUrl: 'https://teams.microsoft.com/l/meetup-join/19%3ameeting',
  }),
];

const entrevistasVivas = new Map<number, Entrevista>(ENTREVISTAS.map((e) => [e.id, e]));

// ===========================================================================
// Fixtures
// ===========================================================================
export const fixtures: Fixture[] = [
  // ------------------------------------------------------------------ assign-candidates
  {
    metodo: 'GET',
    patron: '/api/admin/assign-candidates',
    retraso: 300,
    respuesta: ({ url }) => {
      const jobId = Number(url.searchParams.get('jobId'));
      if (!Number.isInteger(jobId) || jobId <= 0) {
        return new Response(
          JSON.stringify({ success: false, error: 'El jobId es requerido y debe ser un entero positivo' }),
          { status: 400, headers: { 'Content-Type': 'application/json' } }
        );
      }
      return pipelineDe(jobId);
    },
  },
  {
    metodo: 'POST',
    patron: '/api/admin/assign-candidates',
    retraso: 500,
    respuesta: ({ cuerpo }) => {
      const { jobId, candidateIds } = (cuerpo ?? {}) as { jobId?: number; candidateIds?: number[] };
      const vacante = VACANTES.find((v) => v.id === jobId);
      const responder = (estado: number, datos: unknown) =>
        new Response(JSON.stringify(datos), { status: estado, headers: { 'Content-Type': 'application/json' } });
      if (!vacante) return responder(404, { success: false, error: 'La vacante no existe' });
      if (vacante.status !== 'active') {
        return responder(409, { success: false, error: `La vacante no está activa (estado: ${vacante.status})` });
      }
      const ids = Array.isArray(candidateIds) ? candidateIds : [];
      const validos = BANCO.filter((c) => ids.includes(c.id) && ['available', 'in_process'].includes(c.status));
      const yaEstan = new Set(postulacionesDe(vacante.id).map((p) => p.candidateEmail));
      const nuevos = validos.filter((c) => !yaEstan.has(c.email));
      if (nuevos.length === 0) {
        return responder(409, { success: false, error: 'Todos los candidatos seleccionados ya están asignados a esta vacante' });
      }
      const cuando = new Date().toISOString();
      asignadosEnBanco.set(vacante.id, [
        ...(asignadosEnBanco.get(vacante.id) ?? []),
        ...nuevos.map((c) => ({ candidatoId: c.id, cuando })),
      ]);
      nuevos.forEach((c) => {
        c.status = 'in_process';
        c.activeApplications += 1;
      });
      const omitidos = validos.length - nuevos.length;
      const noDisponibles = ids.length - validos.length;
      return responder(201, {
        success: true,
        message:
          `${nuevos.length} candidato(s) asignado(s) exitosamente` +
          (omitidos > 0 ? `. ${omitidos} ya estaban asignados.` : '') +
          (noDisponibles > 0 ? ` ${noDisponibles} se omitieron por no estar disponibles.` : ''),
        data: { assigned: [], assignedCount: nuevos.length, skippedCount: omitidos, ineligibleCount: noDisponibles },
      });
    },
  },
  {
    // Sólo la búsqueda de Asignar candidatos (status=available,in_process); el
    // listado general de /admin/candidates es del bloque 2.
    metodo: 'GET',
    patron: /^\/api\/admin\/candidates\?(?=.*status=available(%2C|,)in_process)/,
    retraso: 250,
    respuesta: ({ url }) => {
      const q = url.searchParams;
      const estados = (q.get('status') || '').split(',').filter(Boolean);
      const tokens = (q.get('search') || '').trim().toLowerCase().split(/\s+/).filter(Boolean);
      const profile = q.get('profile');
      const seniority = q.get('seniority');
      const subcategory = q.get('subcategory');
      const lista = BANCO.filter((c) => {
        if (estados.length && !estados.includes(c.status)) return false;
        if (profile && c.profile !== profile) return false;
        if (seniority && c.seniority !== seniority) return false;
        if (subcategory && c.subcategory !== subcategory) return false;
        return tokens.every((t) =>
          [c.nombre, c.apellidoPaterno, c.apellidoMaterno ?? '', c.email, c.carrera ?? ''].some((campo) =>
            campo.toLowerCase().includes(t)
          )
        );
      });
      const page = entero(q.get('page'), 1);
      const limit = Math.min(100, entero(q.get('limit'), 30));
      const data = lista.slice((page - 1) * limit, page * limit);
      return { success: true, data, pagination: paginacion(page, limit, lista.length), count: data.length };
    },
  },
  {
    // Respaldo del conteo (sólo si el listado no trae activeApplications).
    metodo: 'POST',
    patron: '/api/applications/counts',
    respuesta: ({ cuerpo }) => {
      const emails = ((cuerpo as { emails?: string[] } | undefined)?.emails ?? []).map((e) => e.toLowerCase());
      const data: Record<string, number> = {};
      BANCO.forEach((c) => {
        if (emails.includes(c.email) && c.activeApplications > 0) data[c.email] = c.activeApplications;
      });
      return { success: true, data };
    },
  },
  {
    // «Ya en esta vacante»: los correos de las postulaciones de la vacante.
    metodo: 'GET',
    patron: /^\/api\/applications\?(?:.*&)?jobId=\d+/,
    respuesta: ({ url }) => {
      const jobId = Number(url.searchParams.get('jobId'));
      const vacante = VACANTES.find((v) => v.id === jobId);
      const data = postulacionesDe(jobId).map((p) => ({
        ...p,
        jobId,
        userId: null,
        job: vacante
          ? { id: vacante.id, title: vacante.title, company: vacante.company, location: vacante.location, salary: vacante.salary }
          : null,
        user: null,
      }));
      return { success: true, data, pagination: paginacion(1, 500, data.length), count: data.length, total: data.length };
    },
  },

  // ------------------------------------------------------------------ assignments
  {
    metodo: 'GET',
    patron: '/api/admin/assignments',
    retraso: 250,
    respuesta: ({ url }) => {
      const status = url.searchParams.get('status');
      const todas = ACTIVAS.map((_, k) => vacanteConEquipo(k));
      const estados = ACTIVAS.map((v) => estadoDeAsignacion(asignaciones.get(v.id)));
      const filtrables: EstadoAsignacion[] = ['unassigned', 'partial', 'assigned', 'in_progress', 'completed'];
      const data =
        status && filtrables.includes(status as EstadoAsignacion)
          ? todas.filter((_, i) => estados[i] === status)
          : todas;
      return {
        success: true,
        data,
        recruiters: RECLUTADORES.map(({ id, nombre, apellidoPaterno, email }) => ({ id, nombre, apellidoPaterno, email })),
        specialists: ESPECIALISTAS.map(({ id, nombre, apellidoPaterno, email, specialty }) => ({ id, nombre, apellidoPaterno, email, specialty })),
        stats: {
          total: todas.length,
          unassigned: estados.filter((e) => e === 'unassigned').length,
          partial: estados.filter((e) => e === 'partial').length,
          assigned: estados.filter((e) => e === 'assigned').length,
          inProgress: estados.filter((e) => e === 'in_progress').length,
          completed: estados.filter((e) => e === 'completed').length,
        },
      };
    },
  },
  {
    metodo: 'POST',
    patron: '/api/admin/assignments',
    retraso: 450,
    respuesta: ({ cuerpo }) => {
      const { jobId, recruiterId, specialistId } = (cuerpo ?? {}) as {
        jobId?: number;
        recruiterId?: number | null;
        specialistId?: number | null;
      };
      const responder = (estado: number, datos: unknown) =>
        new Response(JSON.stringify(datos), { status: estado, headers: { 'Content-Type': 'application/json' } });
      const vacante = VACANTES.find((v) => v.id === jobId);
      if (!vacante) return responder(404, { success: false, error: 'Vacante no encontrada' });
      if (vacante.status === 'closed' || vacante.status === 'draft') {
        return responder(409, { success: false, error: 'No se puede asignar equipo a una vacante cerrada' });
      }
      const reclutador = personaPorId(recruiterId ?? null);
      if (recruiterId && (!reclutador || !RECLUTADORES.concat(RECLUTADORA_BAJA).some((r) => r.id === recruiterId))) {
        return responder(400, { success: false, error: 'Reclutador no válido' });
      }
      if (reclutador && reclutador.isActive === false) {
        return responder(400, { success: false, error: 'El reclutador seleccionado está desactivado' });
      }
      const especialista = specialistId ? ESPECIALISTAS.find((e) => e.id === specialistId) : null;
      if (specialistId && !especialista) return responder(400, { success: false, error: 'Especialista no válido' });

      const warning =
        especialista?.specialty && vacante.profile && especialista.specialty !== vacante.profile
          ? `Advertencia: La especialidad del especialista (${especialista.specialty}) no coincide con el perfil de la vacante (${vacante.profile}). La asignación se realizó de todas formas.`
          : null;

      const previa = asignaciones.get(vacante.id);
      const nueva: Asignacion = previa
        ? { ...previa, recruiterId: recruiterId ?? null, specialistId: specialistId ?? null }
        : {
            id: 600 + vacante.id,
            jobId: vacante.id,
            recruiterId: recruiterId ?? null,
            specialistId: specialistId ?? null,
            recruiterStatus: 'pending',
            specialistStatus: 'pending',
            recruiterNotes: null,
            specialistNotes: null,
          };
      asignaciones.set(vacante.id, nueva);
      return { success: true, message: 'Asignación guardada exitosamente', warning, data: { ...nueva, job: vacante } };
    },
  },

  // ------------------------------------------------------------------ direct-applications
  {
    metodo: 'GET',
    patron: '/api/admin/direct-applications',
    retraso: 300,
    respuesta: ({ url }) => {
      const pendientes = DIRECTAS.filter((d) => !directasProcesadas.has(d.id)).map(directaParaApi);
      const page = entero(url.searchParams.get('page'), 1);
      const limit = Math.min(200, entero(url.searchParams.get('limit'), 200));
      const data = pendientes.slice((page - 1) * limit, page * limit);
      return { success: true, data, pagination: paginacion(page, limit, pendientes.length), count: data.length };
    },
  },
  {
    metodo: 'PUT',
    patron: '/api/admin/direct-applications',
    retraso: 400,
    respuesta: ({ cuerpo }) => {
      const { applicationId, newStatus } = (cuerpo ?? {}) as { applicationId?: number; newStatus?: string };
      const responder = (estado: number, datos: unknown) =>
        new Response(JSON.stringify(datos), { status: estado, headers: { 'Content-Type': 'application/json' } });
      const validos = ['reviewing', 'discarded', 'archived'];
      if (!newStatus || !validos.includes(newStatus)) {
        return responder(400, { success: false, error: `Status inválido. Debe ser: ${validos.join(', ')}` });
      }
      const directa = DIRECTAS.find((d) => d.id === applicationId);
      if (!directa) return responder(404, { success: false, error: 'Aplicación no encontrada' });

      // Esta la movió el reclutador desde su panel mientras tanto (ADM-039).
      if (directa.id === 9006 && !directasProcesadas.has(9006)) {
        directasProcesadas.set(9006, 'reviewing');
        return responder(409, {
          success: false,
          error: 'La postulación ya no está pendiente (estado actual: reviewing). Recarga la lista.',
        });
      }
      const previo = directasProcesadas.get(directa.id);
      if (previo) {
        return responder(409, {
          success: false,
          error: `La postulación ya no está pendiente (estado actual: ${previo}). Recarga la lista.`,
        });
      }
      directasProcesadas.set(directa.id, newStatus);
      const api = directaParaApi(directa);
      const data = { ...api, status: newStatus, job: { title: api.job.title, company: api.job.company } };

      if (newStatus === 'reviewing' && !asignaciones.has(api.job.id)) {
        return {
          success: true,
          message:
            'Aplicación movida al proceso de revisión. ⚠️ Esta vacante no tiene reclutador asignado aún. Asigna uno desde Gestión de Asignaciones.',
          data,
          needsAssignment: true,
        };
      }
      const mensajes: Record<string, string> = {
        reviewing: 'Aplicación movida al proceso de revisión',
        discarded: 'Aplicación descartada',
        archived: 'Aplicación archivada',
      };
      return { success: true, message: mensajes[newStatus], data };
    },
  },

  // ------------------------------------------------------------------ interviews
  {
    metodo: 'GET',
    patron: '/api/admin/interviews',
    retraso: 300,
    respuesta: ({ url }) => {
      const q = url.searchParams;
      const estados = (q.get('status') || '').split(',').map((s) => s.trim()).filter(Boolean);
      const todas = [...entrevistasVivas.values()].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
      const lista = estados.length ? todas.filter((e) => estados.includes(e.status)) : todas;
      const page = entero(q.get('page'), 1);
      const limit = Math.min(100, entero(q.get('limit'), 20));
      const counts: Record<string, number> = {};
      todas.forEach((e) => {
        counts[e.status] = (counts[e.status] ?? 0) + 1;
      });
      return {
        success: true,
        data: lista.slice((page - 1) * limit, page * limit),
        counts,
        pagination: { total: lista.length, page, limit, totalPages: Math.ceil(lista.length / limit) },
      };
    },
  },
  {
    metodo: 'PATCH',
    patron: '/api/admin/interviews/:id',
    retraso: 450,
    respuesta: ({ params, cuerpo }) => {
      const responder = (estado: number, datos: unknown) =>
        new Response(JSON.stringify(datos), { status: estado, headers: { 'Content-Type': 'application/json' } });
      const actual = entrevistasVivas.get(Number(params.id));
      if (!actual) return responder(404, { success: false, error: 'Solicitud de entrevista no encontrada' });

      const cambios = (cuerpo ?? {}) as Partial<Entrevista>;
      const permitidos = ['pending', 'confirmed', 'rejected', 'cancelled'];
      if (cambios.status && !permitidos.includes(cambios.status)) {
        return responder(400, { success: false, error: `Status inválido. Valores permitidos: ${permitidos.join(', ')}` });
      }
      if (cambios.meetingUrl && !/^https?:\/\//i.test(cambios.meetingUrl)) {
        return responder(400, { success: false, error: 'La liga de la videollamada debe empezar por http:// o https://' });
      }
      const siguiente: Entrevista = { ...actual, ...cambios, updatedAt: new Date().toISOString() };
      if (siguiente.status === 'confirmed' && (!siguiente.scheduledStart || !siguiente.scheduledEnd)) {
        return responder(400, {
          success: false,
          error: 'Se requiere scheduledStart y scheduledEnd para confirmar la entrevista',
        });
      }
      if (siguiente.scheduledStart && siguiente.scheduledEnd && siguiente.scheduledStart >= siguiente.scheduledEnd) {
        return responder(400, { success: false, error: 'scheduledStart debe ser anterior a scheduledEnd' });
      }
      if (siguiente.status === 'confirmed' && actual.status !== 'confirmed') {
        siguiente.application = { ...siguiente.application, status: 'interviewed' };
      }
      entrevistasVivas.set(siguiente.id, siguiente);
      return { success: true, data: siguiente, interview: siguiente };
    },
  },
];
