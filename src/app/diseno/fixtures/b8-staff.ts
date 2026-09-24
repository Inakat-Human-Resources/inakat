// RUTA: src/app/diseno/fixtures/b8-staff.ts
//
// Bloque 8 · staff (reclutador, especialista, vendedor) y compra de créditos.
// Formato en ./tipos.ts; ejemplos en ./base.ts y en docs/DISENO.md (§10).
// Van ANTES que las base: si repites un patrón, gana el tuyo.
//
// Cubre TODO lo que piden estas páginas al cargar y al actuar:
//   /recruiter/dashboard · /recruiter/jobs/[jobId]
//     GET  /api/recruiter/dashboard (?jobId=)   PUT /api/recruiter/dashboard
//   /specialist/dashboard · /specialist/jobs/[jobId]
//     GET  /api/specialist/dashboard (?jobId=)  PUT /api/specialist/dashboard
//   /vendor/dashboard
//     GET|POST|PUT /api/vendor/my-code          GET /api/vendor/my-sales (?page&limit)
//   /credits/purchase
//     GET  /api/credit-packages                 POST /api/discount-codes/validate
//     POST /api/credits/purchases (sólo lo llama el Brick de Mercado Pago)
//
// Las formas copian los route.ts de cada API. Los movimientos de candidatos se
// guardan en memoria mientras dura la sesión del banco: lo que el reclutador
// envía aparece en «Por revisar» del especialista, y las transiciones se
// validan con las MISMAS tablas que la API (un botón imposible da el 400 real).
//
// Casos para mirar:
//   - Vacante 101: con especialista, doce candidatos en todas las etapas.
//   - Vacante 103: SIN especialista (aviso y «Enviar» deshabilitado).
//   - Vacante 110: sin candidatos (vacíos de cada pestaña).
//   - /diseno/vista/recruiter/jobs/999: vacante ajena (error de carga).
//   - /diseno/vista/vendor/dashboard?rol=admin: sin código y sin ventas.
//   - Código de compra válido: SOFIA10 (10 %) o PAOLA15 (15 %); cualquier otro
//     se rechaza. Código de vendedor ocupado: INAKAT10 (409).
//
// Datos inventados (nombres ficticios, @correo.mx): NUNCA datos de producción.

import type { Fixture } from './tipos';
import { VACANTES, USUARIOS } from './base';

const ahora = Date.now();
const DIA = 86_400_000;
const hace = (dias: number, horas = 0) => new Date(ahora - dias * DIA - horas * 3_600_000).toISOString();

// ---------------------------------------------------------------------------
// Personas del equipo
// ---------------------------------------------------------------------------
const RECLUTADORA = { id: USUARIOS.recruiter.id, nombre: 'Paola', apellidoPaterno: 'Méndez', email: USUARIOS.recruiter.email };
const OTRO_RECLUTADOR = { id: 34, nombre: 'Arturo', apellidoPaterno: 'Leyva', email: 'arturo.leyva@inakat.com' };
const ESPECIALISTA = {
  id: USUARIOS.specialist.id,
  nombre: 'Diego',
  apellidoPaterno: 'Calderón',
  email: USUARIOS.specialist.email,
  specialty: 'Tecnología',
};
const OTRA_ESPECIALISTA = {
  id: 33,
  nombre: 'Mónica',
  apellidoPaterno: 'Ibarra',
  email: 'monica.ibarra@inakat.com',
  specialty: 'Educación',
};

// ---------------------------------------------------------------------------
// Vacantes (las de ./base, con coordenadas y la forma que incluye la API)
// ---------------------------------------------------------------------------
const COORDENADAS: Record<string, [number, number]> = {
  'Monterrey, NL': [25.6866, -100.3161],
  CDMX: [19.4326, -99.1332],
  'Guadalajara, Jal.': [20.6597, -103.3496],
  'Puebla, Pue.': [19.0414, -98.2063],
  'Querétaro, Qro.': [20.5888, -100.3899],
  'Mérida, Yuc.': [20.9674, -89.5926],
};

const HABILIDADES: Record<number, string[]> = {
  101: ['React', 'Node.js', 'PostgreSQL', 'Pruebas automatizadas', 'Comunicación con clientes'],
  109: ['Python', 'Modelos predictivos', 'SQL', 'Visualización de datos'],
  113: ['Revit', 'Coordinación de obra', 'Normativa de construcción'],
};

function vacante(id: number, cambios: Partial<{ title: string }> = {}) {
  const v = VACANTES.find((x) => x.id === id) ?? VACANTES[0];
  const [lat, lng] = COORDENADAS[v.location] ?? [null, null];
  return {
    id: v.id,
    title: cambios.title ?? v.title,
    company: v.company,
    location: v.location,
    latitude: lat,
    longitude: lng,
    salary: v.salary,
    jobType: v.jobType,
    workMode: v.workMode,
    description: v.description,
    requirements: v.requirements,
    status: 'active',
    profile: v.profile,
    subcategory: null,
    seniority: v.seniority,
    habilidades: HABILIDADES[v.id] ? JSON.stringify(HABILIDADES[v.id]) : null,
    responsabilidades: v.responsabilidades,
    creditCost: v.creditCost,
    userId: v.userId,
    createdAt: v.createdAt,
    updatedAt: v.createdAt,
    user: {
      nombre: 'Tomás Rivas',
      companyRequest: {
        nombreEmpresa: v.company,
        correoEmpresa: `contacto@${v.company.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, '')}.mx`,
        logoUrl: null,
      },
    },
  };
}

// ---------------------------------------------------------------------------
// Candidatos (perfil del banco con la forma del select de las APIs)
// ---------------------------------------------------------------------------
interface Semilla {
  nombre: string;
  status: string;
  /** null = se postuló sin tener expediente en el banco. */
  banco: null | {
    universidad?: string;
    carrera?: string;
    nivelEstudios?: string;
    anios?: number;
    profile?: string;
    seniority?: string;
    source?: string;
    /** Desplazamiento desde la ciudad de la vacante, en grados (null = sin ubicación). */
    lejos?: [number, number] | null;
    linkedin?: string;
    cv?: string;
  };
  telefono?: string | null;
  cvPropio?: string | null;
  carta?: string | null;
}

const correo = (nombre: string) =>
  `${nombre
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .split(' ')
    .slice(0, 2)
    .join('.')}@correo.mx`;

function perfilDeBanco(id: number, s: Semilla, job: ReturnType<typeof vacante>) {
  if (!s.banco) return null;
  const b = s.banco;
  const lat = b.lejos === null || job.latitude === null ? null : job.latitude + (b.lejos?.[0] ?? 0.04);
  const lng = b.lejos === null || job.longitude === null ? null : job.longitude + (b.lejos?.[1] ?? -0.05);
  return {
    id,
    email: correo(s.nombre),
    universidad: b.universidad ?? null,
    carrera: b.carrera ?? null,
    nivelEstudios: b.nivelEstudios ?? null,
    añosExperiencia: b.anios ?? 0,
    profile: b.profile ?? null,
    subcategory: null,
    cartaPresentacion: s.carta ?? null,
    seniority: b.seniority ?? null,
    linkedinUrl: b.linkedin ?? null,
    portafolioUrl: null,
    cvUrl: b.cv ?? null,
    telefono: s.telefono ?? null,
    sexo: null,
    fechaNacimiento: null,
    ciudad: job.location.split(',')[0],
    estado: null,
    ubicacionCercana: null,
    latitude: lat,
    longitude: lng,
    source: b.source ?? 'registro',
    notas: null,
    educacion: b.universidad
      ? JSON.stringify([
          {
            nivel: b.nivelEstudios ?? 'Licenciatura',
            institucion: b.universidad,
            carrera: b.carrera ?? '',
            añoInicio: '2012',
            añoFin: '2016',
            // Los dos vocabularios de estatus que hay en producción (registro y /profile).
            estatus: ['Titulado', 'Completa', 'Terminado'][id % 3],
          },
        ])
      : null,
    fotoUrl: null,
    // Trayectoria y expediente para que la ficha no se vea vacía en el banco.
    experiences: b.anios
      ? [
          {
            id: id * 10 + 1,
            empresa: ['Manufacturas del Norte', 'Servicios Cumbres', 'Grupo Industrial Anáhuac'][id % 3],
            puesto: b.profile ? `${b.profile} · puesto actual` : 'Puesto actual',
            ubicacion: job.location,
            fechaInicio: new Date(2023, id % 12, 1).toISOString(),
            fechaFin: null,
            esActual: true,
            descripcion: 'Responsable de los indicadores del área y de la mejora continua de sus procesos.',
          },
        ]
      : [],
    documents:
      id % 3 === 0
        ? []
        : [{ id: id * 10 + 2, name: 'Constancia de estudios', fileUrl: '/uploads/constancia-ejemplo.pdf', fileType: 'application/pdf' }],
  };
}

function postulaciones(jobId: number, semillas: Semilla[]) {
  const job = vacante(jobId);
  return semillas.map((s, i) => {
    const id = jobId * 100 + i + 1;
    return {
      id,
      candidateName: s.nombre,
      candidateEmail: correo(s.nombre),
      candidatePhone: s.telefono === undefined ? `81 ${String(1000 + id).slice(-4)} ${String(5000 + i * 37).slice(-4)}` : s.telefono,
      cvUrl: s.cvPropio ?? null,
      coverLetter: s.carta ?? null,
      status: s.status,
      createdAt: hace(20 - i, i),
      updatedAt: hace(Math.max(0, 6 - i / 2), i),
      notes: null,
      candidateProfile: perfilDeBanco(4000 + id, s, job),
    };
  });
}

const APLICACIONES: Record<number, ReturnType<typeof postulaciones>> = {
  // Desarrollador Full Stack · Grupo Andes · con especialista
  101: postulaciones(101, [
    { nombre: 'Mariana Pérez Treviño', status: 'pending', banco: { universidad: 'UANL', carrera: 'Ingeniería en Sistemas', nivelEstudios: 'Licenciatura', anios: 6, profile: 'Tecnología', seniority: 'Sr', source: 'linkedin', linkedin: 'linkedin.com/in/mariana-perez-dev', cv: 'https://example.com/cv/mariana-perez.pdf' } },
    { nombre: 'Carlos Ibarra Soto', status: 'pending', banco: { universidad: 'Tec de Monterrey', carrera: 'Ingeniería en Tecnologías Computacionales', nivelEstudios: 'Maestría', anios: 9, profile: 'Tecnología', seniority: 'Sr', source: 'referido', lejos: [0.35, 0.4] } },
    { nombre: 'María José de la Garza Santos', status: 'injected_by_admin', banco: { universidad: 'Universidad de Monterrey (UDEM)', carrera: 'Licenciatura en Ciencias Computacionales', nivelEstudios: 'Licenciatura', anios: 4, profile: 'Tecnología', seniority: 'Middle', source: 'manual' }, carta: 'Me interesa mucho el puesto porque he liderado migraciones de monolitos a servicios en empresas de logística.' },
    { nombre: 'Jorge Castañeda Leal', status: 'pending', banco: null, cvPropio: 'https://example.com/cv/jorge-castaneda.pdf', telefono: null },
    { nombre: 'Valeria Núñez Rocha', status: 'reviewing', banco: { universidad: 'UNAM', carrera: 'Ingeniería en Computación', nivelEstudios: 'Licenciatura', anios: 5, profile: 'Tecnología', seniority: 'Sr', source: 'occ', lejos: [-6.2, 1.2] } },
    { nombre: 'Ricardo Solís Medina', status: 'reviewing', banco: { universidad: 'IPN', carrera: 'Ingeniería en Sistemas Computacionales', nivelEstudios: 'Licenciatura', anios: 1, profile: 'Tecnología', seniority: 'Jr', source: 'registro' } },
    { nombre: 'Daniela Ortega Villarreal', status: 'sent_to_specialist', banco: { universidad: 'UANL', carrera: 'Licenciatura en Software', nivelEstudios: 'Licenciatura', anios: 7, profile: 'Tecnología', seniority: 'Sr', source: 'linkedin', linkedin: 'https://www.linkedin.com/in/daniela-ortega', cv: 'https://example.com/cv/daniela-ortega.pdf' } },
    { nombre: 'Emilio Vargas Cantú', status: 'evaluating', banco: { universidad: 'Tec de Monterrey', carrera: 'Ingeniería en Sistemas', nivelEstudios: 'Licenciatura', anios: 8, profile: 'Tecnología', seniority: 'Sr', source: 'referido', lejos: [0.12, -0.2] } },
    { nombre: 'Renata Aguilar Pineda', status: 'sent_to_company', banco: { universidad: 'UDEM', carrera: 'Ingeniería en Sistemas', nivelEstudios: 'Maestría', anios: 10, profile: 'Tecnología', seniority: 'Sr', source: 'linkedin' } },
    { nombre: 'Hugo Salazar Ríos', status: 'company_interested', banco: { universidad: 'UANL', carrera: 'Ingeniería en Software', nivelEstudios: 'Licenciatura', anios: 6, profile: 'Tecnología', seniority: 'Sr', source: 'occ' } },
    { nombre: 'Ximena Fuentes Olvera', status: 'interviewed', banco: { universidad: 'Universidad Regiomontana', carrera: 'Ingeniería en Sistemas', nivelEstudios: 'Licenciatura', anios: 5, profile: 'Tecnología', seniority: 'Middle', source: 'registro' } },
    { nombre: 'Andrés Maldonado Cruz', status: 'rejected', banco: { universidad: 'UANL', carrera: 'Ingeniería Mecatrónica', nivelEstudios: 'Licenciatura', anios: 3, profile: 'Tecnología', seniority: 'Middle', source: 'registro' } },
    { nombre: 'Paulina Esquivel Lara', status: 'discarded', banco: { universidad: 'Universidad Autónoma de Nuevo León', carrera: 'Contaduría Pública', nivelEstudios: 'Licenciatura', anios: 2, profile: 'Finanzas', seniority: 'Jr', source: 'registro' } },
    { nombre: 'Tomás Guerra Benavides', status: 'discarded', banco: null },
  ]),
  // Enfermera Jefe de Piso · SIN especialista
  103: postulaciones(103, [
    { nombre: 'Lucía Domínguez Arce', status: 'pending', banco: { universidad: 'Universidad de Guadalajara', carrera: 'Licenciatura en Enfermería', nivelEstudios: 'Licenciatura', anios: 11, profile: 'Salud', seniority: 'Sr', source: 'referido' } },
    { nombre: 'Óscar Villanueva Tapia', status: 'pending', banco: { universidad: 'UAG', carrera: 'Enfermería', nivelEstudios: 'Técnico', anios: 4, profile: 'Salud', seniority: 'Middle', source: 'occ' } },
    { nombre: 'Sofía Camarena Ruelas', status: 'reviewing', banco: { universidad: 'Universidad de Guadalajara', carrera: 'Licenciatura en Enfermería', nivelEstudios: 'Maestría', anios: 14, profile: 'Salud', seniority: 'Sr', source: 'linkedin' } },
    { nombre: 'Iván Zapata Montemayor', status: 'discarded', banco: null },
  ]),
  // Coordinadora Académica · con otra especialista
  105: postulaciones(105, [
    { nombre: 'Alejandra Robles Quintero', status: 'sent_to_specialist', banco: { universidad: 'UAQ', carrera: 'Pedagogía', nivelEstudios: 'Maestría', anios: 9, profile: 'Educación', seniority: 'Sr', source: 'registro' } },
    { nombre: 'Gabriel Ontiveros Salcedo', status: 'evaluating', banco: { universidad: 'UNAM', carrera: 'Psicología Educativa', nivelEstudios: 'Licenciatura', anios: 5, profile: 'Educación', seniority: 'Middle', source: 'manual' } },
    { nombre: 'Natalia Herrera Bustos', status: 'pending', banco: { universidad: 'Universidad Anáhuac Querétaro', carrera: 'Ciencias de la Educación', nivelEstudios: 'Licenciatura', anios: 3, profile: 'Educación', seniority: 'Jr', source: 'registro' } },
  ]),
  // Ingeniero Eléctrico · sin candidatos todavía
  110: [],
  // Científica de Datos (sin especialidad en la vacante) · del especialista
  109: postulaciones(109, [
    { nombre: 'Fernanda Ruiz Garza', status: 'sent_to_specialist', banco: { universidad: 'ITESO', carrera: 'Ingeniería Financiera', nivelEstudios: 'Maestría', anios: 7, profile: 'Tecnología', seniority: 'Sr', source: 'linkedin', linkedin: 'linkedin.com/in/fernanda-ruiz-datos' } },
    { nombre: 'Rodrigo Anaya Cervantes', status: 'sent_to_specialist', banco: { universidad: 'Universidad de Guadalajara', carrera: 'Actuaría', nivelEstudios: 'Licenciatura', anios: 4, profile: 'Tecnología', seniority: 'Middle', source: 'occ' } },
    { nombre: 'Elena Bastida Olmos', status: 'sent_to_specialist', banco: null, cvPropio: 'https://example.com/cv/elena-bastida.pdf' },
    { nombre: 'Samuel Treviño Garza', status: 'evaluating', banco: { universidad: 'CIMAT', carrera: 'Matemáticas Aplicadas', nivelEstudios: 'Doctorado', anios: 12, profile: 'Tecnología', seniority: 'Director', source: 'referido', lejos: null } },
  ]),
  // Arquitecta de Proyecto · otro reclutador, ya con resultado de la empresa
  113: postulaciones(113, [
    { nombre: 'Regina Palacios Montaño', status: 'sent_to_company', banco: { universidad: 'UDEM', carrera: 'Arquitectura', nivelEstudios: 'Licenciatura', anios: 8, profile: 'Arquitectura', seniority: 'Sr', source: 'registro' } },
    { nombre: 'Mauricio Elizondo Garza', status: 'accepted', banco: { universidad: 'Tec de Monterrey', carrera: 'Arquitectura', nivelEstudios: 'Maestría', anios: 13, profile: 'Arquitectura', seniority: 'Sr', source: 'referido' } },
    { nombre: 'Brenda Cavazos Lozano', status: 'rejected', banco: { universidad: 'UANL', carrera: 'Arquitectura', nivelEstudios: 'Licenciatura', anios: 5, profile: 'Arquitectura', seniority: 'Middle', source: 'occ' } },
    { nombre: 'Julián Rendón Salinas', status: 'discarded', banco: { universidad: 'UANL', carrera: 'Ingeniería Civil', nivelEstudios: 'Licenciatura', anios: 2, profile: 'Ingeniería', seniority: 'Jr', source: 'registro' } },
  ]),
};

// Movimientos hechos en el banco durante la sesión (id de postulación → estado).
const movidos = new Map<number, string>();
const estadoDe = (app: { id: number; status: string }) => movidos.get(app.id) ?? app.status;
const conEstadoActual = <T extends { id: number; status: string }>(apps: T[]) =>
  apps.map((a) => ({ ...a, status: estadoDe(a) }));
const buscarPostulacion = (id: number) =>
  Object.entries(APLICACIONES)
    .map(([jobId, apps]) => ({ jobId: Number(jobId), app: apps.find((a) => a.id === id) }))
    .find((r) => r.app);

// ---------------------------------------------------------------------------
// Asignaciones (JobAssignment con la forma que devuelve cada API)
// ---------------------------------------------------------------------------
interface Asignacion {
  id: number;
  jobId: number;
  titulo?: string;
  recruiter: typeof RECLUTADORA | null;
  specialist: typeof ESPECIALISTA | null;
  recruiterStatus: string;
  specialistStatus: string;
  recruiterNotes: string | null;
  assignedAt: string;
}

const ASIGNACIONES: Asignacion[] = [
  {
    id: 501,
    jobId: 101,
    recruiter: RECLUTADORA,
    specialist: ESPECIALISTA,
    recruiterStatus: 'sent_to_specialist',
    specialistStatus: 'evaluating',
    recruiterNotes:
      'La empresa quiere a alguien que haya llevado un producto a producción de principio a fin.\n\nPrioriza experiencia con clientes internos: el equipo es pequeño y la persona va a presentar avances cada semana al director de operaciones. Horario de oficina en San Pedro tres días a la semana; confirmar disponibilidad para viajar a Saltillo una vez al mes.',
    assignedAt: hace(18),
  },
  {
    id: 502,
    jobId: 103,
    recruiter: RECLUTADORA,
    specialist: null,
    recruiterStatus: 'reviewing',
    specialistStatus: 'pending',
    recruiterNotes: null,
    assignedAt: hace(9),
  },
  {
    id: 503,
    jobId: 105,
    recruiter: RECLUTADORA,
    specialist: OTRA_ESPECIALISTA,
    recruiterStatus: 'sent_to_specialist',
    specialistStatus: 'pending',
    recruiterNotes: 'Buscan liderazgo con docentes y manejo de plataformas en línea.',
    assignedAt: hace(6),
  },
  {
    id: 504,
    jobId: 110,
    // Título largo a propósito: que se vea cómo parte línea en tabla y tarjeta.
    titulo: 'Ingeniero Eléctrico de Mantenimiento Industrial para Planta de Ensamble (turno mixto)',
    recruiter: RECLUTADORA,
    specialist: ESPECIALISTA,
    recruiterStatus: 'pending',
    specialistStatus: 'pending',
    recruiterNotes: null,
    assignedAt: hace(1),
  },
  {
    id: 505,
    jobId: 109,
    recruiter: OTRO_RECLUTADOR,
    specialist: ESPECIALISTA,
    recruiterStatus: 'sent_to_specialist',
    specialistStatus: 'pending',
    recruiterNotes: null,
    assignedAt: hace(4),
  },
  {
    id: 506,
    jobId: 113,
    recruiter: OTRO_RECLUTADOR,
    specialist: ESPECIALISTA,
    recruiterStatus: 'sent_to_specialist',
    specialistStatus: 'sent_to_company',
    recruiterNotes: 'Revisar portafolio: la empresa pidió proyectos de vivienda vertical.',
    assignedAt: hace(32),
  },
];

const baseAsignacion = (a: Asignacion) => ({
  id: a.id,
  jobId: a.jobId,
  recruiterId: a.recruiter?.id ?? null,
  specialistId: a.specialist?.id ?? null,
  recruiterStatus: a.recruiterStatus,
  specialistStatus: a.specialistStatus,
  recruiterNotes: a.recruiterNotes,
  specialistNotes: null,
  candidatesSentToSpecialist: null,
  candidatesSentToCompany: null,
  assignedAt: a.assignedAt,
  updatedAt: hace(0, 3),
  followUpDate: null,
  followUpCompleted: false,
  followUpNotes: null,
});

// --- GET /api/recruiter/dashboard ------------------------------------------------
const TRANSICIONES_RECLUTADOR: Record<string, string[]> = {
  pending: ['reviewing', 'discarded'],
  injected_by_admin: ['reviewing', 'discarded'],
  reviewing: ['sent_to_specialist', 'discarded', 'pending'],
  discarded: ['reviewing', 'pending'],
};
const ESTADOS_ENVIADO_RECLUTADOR = [
  'sent_to_specialist',
  'evaluating',
  'sent_to_company',
  'company_interested',
  'interviewed',
  'accepted',
  'rejected',
];

function panelReclutador(url: URL) {
  const jobId = url.searchParams.get('jobId');
  const mias = ASIGNACIONES.filter((a) => a.recruiter?.id === RECLUTADORA.id).filter(
    (a) => !jobId || a.jobId === Number(jobId)
  );

  const assignments = mias.map((a) => ({
    ...baseAsignacion(a),
    job: {
      ...vacante(a.jobId, { title: a.titulo }),
      applications: conEstadoActual(APLICACIONES[a.jobId] ?? []),
    },
    specialist: a.specialist,
  }));

  const cuenta = (estados: string[]) =>
    assignments.reduce((n, a) => n + a.job.applications.filter((ap) => estados.includes(ap.status)).length, 0);

  const sentApplications = assignments
    .flatMap((a) =>
      a.job.applications
        .filter((ap) => ESTADOS_ENVIADO_RECLUTADOR.includes(ap.status))
        .map((ap) => ({
          id: ap.id,
          candidateName: ap.candidateName,
          candidateEmail: ap.candidateEmail,
          candidatePhone: ap.candidatePhone,
          cvUrl: ap.cvUrl,
          coverLetter: ap.coverLetter,
          status: ap.status,
          jobId: a.job.id,
          jobTitle: a.job.title,
          company: a.job.user.companyRequest.nombreEmpresa || a.job.company,
          createdAt: ap.createdAt,
          updatedAt: ap.updatedAt,
          candidateProfile: ap.candidateProfile,
          jobLatitude: a.job.latitude,
          jobLongitude: a.job.longitude,
        }))
    )
    .sort((x, y) => new Date(y.updatedAt).getTime() - new Date(x.updatedAt).getTime());

  return {
    success: true,
    data: {
      assignments,
      sentApplications,
      stats: {
        total: assignments.length,
        pending: cuenta(['pending', 'injected_by_admin']),
        reviewing: cuenta(['reviewing']),
        sentToSpecialist: cuenta(['sent_to_specialist']),
        evaluating: cuenta(['evaluating']),
        sentToCompany: cuenta(['sent_to_company']),
        companyInterested: cuenta(['company_interested']),
        interviewed: cuenta(['interviewed']),
        hired: cuenta(['accepted']),
        rejected: cuenta(['rejected']),
        discarded: cuenta(['discarded']),
        totalSent: sentApplications.length,
      },
      recruiter: { id: RECLUTADORA.id, nombre: USUARIOS.recruiter.nombre, email: RECLUTADORA.email },
    },
  };
}

// --- GET /api/specialist/dashboard -----------------------------------------------
const TRANSICIONES_ESPECIALISTA: Record<string, string[]> = {
  sent_to_specialist: ['evaluating', 'discarded'],
  evaluating: ['sent_to_company', 'discarded', 'sent_to_specialist'],
  discarded: ['evaluating', 'sent_to_specialist'],
};
const VISIBLES_ESPECIALISTA = [
  'sent_to_specialist',
  'evaluating',
  'sent_to_company',
  'company_interested',
  'interviewed',
  'accepted',
  'rejected',
  'discarded',
];

function panelEspecialista(url: URL) {
  const jobId = url.searchParams.get('jobId');
  const mias = ASIGNACIONES.filter(
    (a) => a.specialist?.id === ESPECIALISTA.id && a.recruiterStatus === 'sent_to_specialist'
  ).filter((a) => !jobId || a.jobId === Number(jobId));

  const assignments = mias.map((a) => ({
    ...baseAsignacion(a),
    // job SIN applications: la API las quita y las devuelve enriquecidas aparte.
    job: vacante(a.jobId, { title: a.titulo }),
    applications: conEstadoActual(APLICACIONES[a.jobId] ?? []).filter((ap) => VISIBLES_ESPECIALISTA.includes(ap.status)),
    recruiter: a.recruiter,
    recruiterNotes: a.recruiterNotes,
  }));

  const cuenta = (estados: string[]) =>
    assignments.reduce((n, a) => n + a.applications.filter((ap) => estados.includes(ap.status)).length, 0);

  return {
    success: true,
    data: {
      assignments,
      stats: {
        total: assignments.length,
        pending: cuenta(['sent_to_specialist']),
        evaluating: cuenta(['evaluating']),
        sentToCompany: cuenta(['sent_to_company', 'company_interested', 'interviewed', 'accepted', 'rejected']),
        discarded: cuenta(['discarded']),
      },
      specialist: {
        id: ESPECIALISTA.id,
        nombre: USUARIOS.specialist.nombre,
        email: ESPECIALISTA.email,
        specialty: ESPECIALISTA.specialty,
      },
    },
  };
}

// --- PUT de ambos paneles (misma validación que las API) --------------------------
function mover(
  cuerpo: unknown,
  transiciones: Record<string, string[]>,
  exigeEspecialista: boolean
): { estado: number; cuerpo: Record<string, unknown> } {
  const { updateApplicationId, newApplicationStatus } = (cuerpo ?? {}) as {
    updateApplicationId?: unknown;
    newApplicationStatus?: unknown;
  };
  const id = Number(updateApplicationId);
  if (!Number.isInteger(id) || id <= 0 || typeof newApplicationStatus !== 'string') {
    return {
      estado: 400,
      cuerpo: { success: false, error: 'Se requiere updateApplicationId (entero) y newApplicationStatus' },
    };
  }
  if (!Object.values(transiciones).flat().includes(newApplicationStatus)) {
    return { estado: 400, cuerpo: { success: false, error: `Estado "${newApplicationStatus}" no válido` } };
  }
  const encontrada = buscarPostulacion(id);
  const app = encontrada?.app;
  if (!encontrada || !app) {
    return { estado: 404, cuerpo: { success: false, error: 'Aplicación no encontrada' } };
  }
  const actual = estadoDe(app);
  if (!(transiciones[actual] || []).includes(newApplicationStatus)) {
    return {
      estado: 400,
      cuerpo: { success: false, error: `No se puede mover de "${actual}" a "${newApplicationStatus}"` },
    };
  }
  if (exigeEspecialista && newApplicationStatus === 'sent_to_specialist') {
    const asignacion = ASIGNACIONES.find((a) => a.jobId === encontrada.jobId);
    if (!asignacion?.specialist) {
      return { estado: 400, cuerpo: { success: false, error: 'No hay especialista asignado a esta vacante' } };
    }
  }
  movidos.set(id, newApplicationStatus);
  return {
    estado: 200,
    cuerpo: {
      success: true,
      message: `Candidato movido a "${newApplicationStatus}"`,
      data: { ...app, status: newApplicationStatus, updatedAt: new Date().toISOString() },
    },
  };
}

const responder = (r: { estado: number; cuerpo: Record<string, unknown> }) =>
  new Response(JSON.stringify(r.cuerpo), { status: r.estado, headers: { 'Content-Type': 'application/json' } });

// ---------------------------------------------------------------------------
// Vendedor: código y ventas
// ---------------------------------------------------------------------------
type CodigoVendedor = {
  id: number;
  code: string;
  discountPercent: number;
  commissionPercent: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  _count: { uses: number };
};

// Por rol: la vendedora tiene código; el admin (que también ve este panel) no.
const codigos: Record<string, CodigoVendedor | null> = {
  vendor: {
    id: 7,
    code: 'SOFIA10',
    discountPercent: 10,
    commissionPercent: 10,
    isActive: true,
    createdAt: hace(142),
    updatedAt: hace(30),
    _count: { uses: 27 },
  },
};
const codigoDe = (rol: string) => codigos[rol] ?? null;

const CODIGOS_OCUPADOS = ['INAKAT10', 'PAOLA15'];

function validarFormato(code: unknown): string | null {
  if (!code || typeof code !== 'string') return 'El código es requerido';
  const limpio = code.trim();
  if (limpio.length < 4 || limpio.length > 20) return 'El código debe tener entre 4 y 20 caracteres';
  if (!/^[a-zA-Z0-9]+$/.test(limpio)) return 'El código solo puede contener letras y números';
  return null;
}

const EMPRESAS_CLIENTE = [
  'Grupo Andes',
  'Clínica Norte',
  'Comercializadora de Alimentos del Noreste y Bajío',
  'Logística Pacífico',
  'Agencia Brújula Digital',
  'Colegio Horizonte',
  'Hotel Mirador del Valle',
  'Farmacias Vida Plena',
  'Constructora Sierra',
];
const PAQUETES_VENDIDOS: Array<[number, number]> = [
  [10, 35000],
  [5, 18500],
  [20, 65000],
  [1, 4000],
  [10, 35000],
  [5, 18500],
];

// 27 ventas pagadas, de la más reciente a la más antigua: las recientes con la
// comisión por pagar, las de hace más de cuatro meses pagadas con comprobante,
// y una cancelada (compra devuelta).
const VENTAS = Array.from({ length: 27 }, (_, i) => {
  const [credits, originalPrice] = PAQUETES_VENDIDOS[i % PAQUETES_VENDIDOS.length];
  const discountAmount = Math.round(originalPrice * 0.1);
  const finalPrice = originalPrice - discountAmount;
  const dias = 3 + i * 6;
  const pagada = dias > 120;
  const cancelada = i === 4;
  const status = cancelada ? 'cancelled' : pagada ? 'paid' : 'pending';
  const creada = new Date(ahora - dias * DIA);
  const vence = new Date(creada);
  vence.setMonth(vence.getMonth() + 4);
  return {
    id: 900 + i,
    company: { nombreEmpresa: EMPRESAS_CLIENTE[i % EMPRESAS_CLIENTE.length] },
    purchase: { id: 7000 + i, credits, originalPrice, discountAmount, finalPrice },
    commission: {
      amount: Math.round(finalPrice * 0.1 * 100) / 100,
      status,
      statusLabel: status === 'paid' ? 'Pagada' : status === 'cancelled' ? 'Cancelada' : 'Pendiente',
      paidAt: pagada && !cancelada ? new Date(creada.getTime() + 100 * DIA).toISOString() : null,
      dueDate: vence.toISOString(),
      proofUrl: pagada && !cancelada ? `https://example.com/comprobantes/comision-${900 + i}.pdf` : null,
    },
    createdAt: creada.toISOString(),
  };
});

function ventas(url: URL, rol: string) {
  const codigo = codigoDe(rol);
  if (!codigo) {
    return {
      success: true,
      data: {
        hasCode: false,
        sales: [],
        summary: { totalSales: 0, totalCommission: 0, pendingCommission: 0, paidCommission: 0 },
      },
    };
  }
  const limit = Math.min(100, Math.max(1, Number(url.searchParams.get('limit')) || 20));
  const page = Math.max(1, Number(url.searchParams.get('page')) || 1);
  const suma = (lista: typeof VENTAS) => Math.round(lista.reduce((n, v) => n + v.commission.amount, 0) * 100) / 100;
  return {
    success: true,
    data: {
      hasCode: true,
      code: codigo.code,
      sales: VENTAS.slice((page - 1) * limit, page * limit),
      summary: {
        totalSales: VENTAS.length,
        totalCommission: suma(VENTAS),
        pendingCommission: suma(VENTAS.filter((v) => v.commission.status === 'pending')),
        paidCommission: suma(VENTAS.filter((v) => v.commission.status === 'paid')),
      },
      pagination: { page, limit, totalCount: VENTAS.length, totalPages: Math.ceil(VENTAS.length / limit) },
    },
  };
}

// ---------------------------------------------------------------------------
// Compra de créditos
// ---------------------------------------------------------------------------
const PAQUETES = [
  { id: 1, name: 'Básico', credits: 1, price: 4000, pricePerCredit: 4000, badge: null, isActive: true, sortOrder: 1 },
  { id: 2, name: 'Arranque', credits: 5, price: 18500, pricePerCredit: 3700, badge: 'MÁS POPULAR', isActive: true, sortOrder: 2 },
  { id: 3, name: 'Crecimiento', credits: 10, price: 35000, pricePerCredit: 3500, badge: null, isActive: true, sortOrder: 3 },
  { id: 4, name: 'Empresa', credits: 20, price: 65000, pricePerCredit: 3250, badge: 'PROMOCIÓN', isActive: true, sortOrder: 4 },
];

const CODIGOS_COMPRA: Record<string, number> = { SOFIA10: 10, PAOLA15: 15 };

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------
export const fixtures: Fixture[] = [
  // Reclutador
  { metodo: 'GET', patron: '/api/recruiter/dashboard', retraso: 300, respuesta: ({ url }) => panelReclutador(url) },
  {
    metodo: 'PUT',
    patron: '/api/recruiter/dashboard',
    retraso: 450,
    respuesta: ({ cuerpo }) => responder(mover(cuerpo, TRANSICIONES_RECLUTADOR, true)),
  },

  // Especialista
  { metodo: 'GET', patron: '/api/specialist/dashboard', retraso: 300, respuesta: ({ url }) => panelEspecialista(url) },
  {
    metodo: 'PUT',
    patron: '/api/specialist/dashboard',
    retraso: 450,
    respuesta: ({ cuerpo }) => responder(mover(cuerpo, TRANSICIONES_ESPECIALISTA, false)),
  },

  // Vendedor
  {
    metodo: 'GET',
    patron: '/api/vendor/my-code',
    retraso: 250,
    respuesta: ({ rol }) => ({ success: true, data: codigoDe(rol) }),
  },
  {
    metodo: 'POST',
    patron: '/api/vendor/my-code',
    retraso: 500,
    respuesta: ({ cuerpo, rol }) => {
      if (codigoDe(rol)) {
        return responder({ estado: 409, cuerpo: { success: false, error: 'Ya tienes un código de descuento; edítalo desde tu panel.' } });
      }
      const { code } = (cuerpo ?? {}) as { code?: unknown };
      const error = validarFormato(code);
      if (error) return responder({ estado: 400, cuerpo: { success: false, error } });
      const normalizado = String(code).trim().toUpperCase();
      if (CODIGOS_OCUPADOS.includes(normalizado)) {
        return responder({ estado: 409, cuerpo: { success: false, error: 'Este código ya está en uso. Elige otro.' } });
      }
      codigos[rol] = {
        id: 70 + Object.keys(codigos).length,
        code: normalizado,
        discountPercent: 10,
        commissionPercent: 10,
        isActive: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        _count: { uses: 0 },
      };
      const { updatedAt, _count, ...creado } = codigos[rol]!;
      void updatedAt;
      void _count;
      return responder({
        estado: 201,
        cuerpo: { success: true, data: creado, message: 'Código de descuento creado exitosamente' },
      });
    },
  },
  {
    metodo: 'PUT',
    patron: '/api/vendor/my-code',
    retraso: 500,
    respuesta: ({ cuerpo, rol }) => {
      const actual = codigoDe(rol);
      if (!actual) {
        return responder({
          estado: 404,
          cuerpo: { success: false, error: 'No tienes un código de descuento. Usa POST para crear uno.' },
        });
      }
      const { code } = (cuerpo ?? {}) as { code?: unknown };
      const error = validarFormato(code);
      if (error) return responder({ estado: 400, cuerpo: { success: false, error } });
      const normalizado = String(code).trim().toUpperCase();
      if (normalizado !== actual.code && CODIGOS_OCUPADOS.includes(normalizado)) {
        return responder({ estado: 409, cuerpo: { success: false, error: 'Este código ya está en uso. Elige otro.' } });
      }
      codigos[rol] = { ...actual, code: normalizado, updatedAt: new Date().toISOString() };
      return { success: true, data: codigos[rol], message: 'Código actualizado' };
    },
  },
  { metodo: 'GET', patron: '/api/vendor/my-sales', retraso: 350, respuesta: ({ url, rol }) => ventas(url, rol) },

  // Compra de créditos
  { metodo: 'GET', patron: '/api/credit-packages', retraso: 300, respuesta: { success: true, data: PAQUETES } },
  {
    metodo: 'POST',
    patron: '/api/discount-codes/validate',
    retraso: 400,
    respuesta: ({ cuerpo }) => {
      const { code, packagePrice } = (cuerpo ?? {}) as { code?: unknown; packagePrice?: unknown };
      if (typeof code !== 'string' || !code.trim()) {
        return responder({ estado: 400, cuerpo: { success: false, valid: false, error: 'Código requerido' } });
      }
      const porcentaje = CODIGOS_COMPRA[code.trim().toUpperCase()];
      if (!porcentaje) return { success: false, valid: false, error: 'Código inválido o inactivo' };
      const precio = typeof packagePrice === 'number' ? packagePrice : undefined;
      const discountAmount = precio !== undefined ? Math.round(precio * (porcentaje / 100)) : 0;
      return {
        success: true,
        valid: true,
        data: {
          code: code.trim().toUpperCase(),
          discountPercent: porcentaje,
          ...(precio !== undefined && {
            pricing: { originalPrice: precio, discountAmount, finalPrice: precio - discountAmount, savings: discountAmount },
          }),
        },
      };
    },
  },
  {
    // Sólo lo llama el Brick de Mercado Pago al pagar (fuera del banco no hay SDK).
    metodo: 'POST',
    patron: '/api/credits/purchases',
    retraso: 900,
    respuesta: ({ cuerpo }) => {
      const { packageId, discountCode, expectedAmount } = (cuerpo ?? {}) as {
        packageId?: number;
        discountCode?: string | null;
        expectedAmount?: number;
      };
      const pkg = PAQUETES.find((p) => p.id === packageId);
      if (!pkg) {
        return responder({ estado: 400, cuerpo: { error: 'Paquete no disponible. Contacta al administrador.' } });
      }
      const porcentaje = discountCode ? CODIGOS_COMPRA[discountCode] ?? 0 : 0;
      const discountAmount = Math.round(pkg.price * (porcentaje / 100));
      const finalPrice = pkg.price - discountAmount;
      if (typeof expectedAmount === 'number' && expectedAmount !== finalPrice) {
        return responder({
          estado: 409,
          cuerpo: { error: 'El precio cambió. Revisa el total antes de pagar.', expectedAmount: finalPrice },
        });
      }
      return {
        success: true,
        status: 'approved',
        purchase: { id: 9101, credits: pkg.credits, amount: pkg.credits, paymentStatus: 'paid' },
        creditsAdded: pkg.credits,
        newBalance: USUARIOS.company.credits + pkg.credits,
        paymentId: 'SIMULADO-9101',
        discount: porcentaje
          ? { code: discountCode, originalPrice: pkg.price, discountAmount, finalPrice, discountPercent: porcentaje }
          : null,
      };
    },
  },
];
