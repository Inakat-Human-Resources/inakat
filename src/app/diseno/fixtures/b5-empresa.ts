// RUTA: src/app/diseno/fixtures/b5-empresa.ts
//
// Bloque 5 · empresa (panel, candidatos de una vacante, entrevistas, perfil e
// integraciones). Formato en ./tipos.ts; ejemplos en ./base.ts y en
// docs/DISENO.md §10. Van ANTES que las base: si repites un patrón, gana el tuyo.
//
// Todo es inventado (nombres ficticios, correos @correo.mx): NUNCA datos reales.
//
// Las respuestas copian la FORMA de cada route.ts:
//   GET  /api/company/dashboard                 src/app/api/company/dashboard/route.ts
//   GET  /api/company/jobs/:jobId/candidates    src/app/api/company/jobs/[jobId]/candidates/route.ts
//   PATCH /api/company/applications/:id         src/app/api/company/applications/[id]/route.ts
//   POST /api/company/interview-requests        src/app/api/company/interview-requests/route.ts
//   GET  /api/company/interviews                src/app/api/company/interviews/route.ts
//   GET/PUT /api/company/profile                src/app/api/company/profile/route.ts
//   POST /api/upload                            src/app/api/upload/route.ts
//   PUT  /api/jobs/publish · PATCH /api/jobs/:id  src/app/api/jobs/…
//   GET/POST/DELETE /api/integration/keys|webhooks  src/app/api/integration/…
//
// Con ESTADO: las acciones (pausar, publicar, «Me interesa», crear una API
// key…) cambian los datos del banco hasta recargar la página, así la pantalla
// se ve reaccionar como en producción.
//
// Variantes por la URL de la PÁGINA (útiles para revisar estados):
//   ?cuenta=pending | rejected | sin   → avisos de la cuenta en el panel
//   ?vacio=1                           → panel, entrevistas e integraciones sin datos
//   ?falla=1                           → las cargas de este bloque responden 500
//   /company/jobs/404/candidates · /company/jobs/403/candidates → errores de la vacante

import type { Fixture } from './tipos';
import { USUARIOS, VACANTES } from './base';

const ahora = Date.now();
const HORA = 3_600_000;
const DIA = 24 * HORA;
const hace = (dias: number, horas = 0) => new Date(ahora - dias * DIA - horas * HORA).toISOString();
const dentroDe = (dias: number, horas = 0) => new Date(ahora + dias * DIA + horas * HORA).toISOString();

/** Fecha local a una hora concreta, dentro de `dias` días (para entrevistas). */
function aLas(dias: number, hora: number, minuto = 0): string {
  const d = new Date(ahora);
  d.setDate(d.getDate() + dias);
  d.setHours(hora, minuto, 0, 0);
  return d.toISOString();
}
/** 'YYYY-MM-DD' local dentro de `dias` días (como los horarios propuestos). */
function diaLocal(dias: number): string {
  const d = new Date(ahora);
  d.setDate(d.getDate() + dias);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Parámetro de la URL de la página del banco (no de la petición). */
function parametroPagina(nombre: string): string | null {
  if (typeof window === 'undefined') return null;
  return new URLSearchParams(window.location.search).get(nombre);
}

const respuesta = (datos: unknown, estado: number) =>
  new Response(JSON.stringify(datos), { status: estado, headers: { 'Content-Type': 'application/json' } });

const falla500 = () => respuesta({ success: false, error: 'Error interno del servidor' }, 500);

// ---------------------------------------------------------------------------
// La empresa del banco: Grupo Andes (Tomás Rivas, rol company)
// ---------------------------------------------------------------------------
const EMPRESA = 'Grupo Andes';
const CUENTA = USUARIOS.company;
const MONTERREY = { lat: 25.6866, lng: -100.3161 };

/** Monograma en SVG (data:): next/image lo pinta sin optimizar, sin red. */
function monograma(iniciales: string, fondo: string): string {
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96">` +
    `<rect width="96" height="96" rx="18" fill="${fondo}"/>` +
    `<path d="M22 66a26 26 0 0 1 52 0" fill="none" stroke="#9fbb2f" stroke-width="7" stroke-linecap="round"/>` +
    `<circle cx="48" cy="60" r="7" fill="#f48602"/>` +
    `<text x="48" y="38" text-anchor="middle" font-family="Arial, sans-serif" font-weight="700" font-size="24" fill="#ffffff">${iniciales}</text>` +
    `</svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}
const LOGO_EMPRESA = monograma('GA', '#2b5d62');
const LOGO_SUBIDO = monograma('GA', '#283739');

// ---------------------------------------------------------------------------
// Vacantes de la empresa (forma de Prisma Job, sin notasInternas)
// ---------------------------------------------------------------------------
interface VacanteEmpresa {
  id: number;
  title: string;
  company: string;
  location: string;
  latitude: number | null;
  longitude: number | null;
  salary: string;
  salaryMin: number | null;
  salaryMax: number | null;
  jobType: string;
  workMode: string;
  description: string;
  requirements: string | null;
  status: string;
  closedReason: string | null;
  companyRating: null;
  creditCost: number;
  profile: string | null;
  subcategory: string | null;
  seniority: string | null;
  educationLevel: string | null;
  habilidades: string | null;
  responsabilidades: string | null;
  resultadosEsperados: string | null;
  valoresActitudes: string | null;
  informacionAdicional: string | null;
  isConfidential: boolean;
  userId: number;
  createdAt: string;
  updatedAt: string;
  expiresAt: string | null;
  editableUntil: string | null;
}

function vacante(
  id: number,
  datos: Partial<VacanteEmpresa> & Pick<VacanteEmpresa, 'title' | 'status' | 'createdAt'>
): VacanteEmpresa {
  return {
    id,
    company: EMPRESA,
    location: 'Monterrey, NL',
    latitude: MONTERREY.lat,
    longitude: MONTERREY.lng,
    salary: '$28,000 – $36,000 MXN',
    salaryMin: 28000,
    salaryMax: 36000,
    jobType: 'Tiempo completo',
    workMode: 'presential',
    description:
      'Buscamos a una persona que se integre al equipo de operaciones para diseñar, ejecutar y mejorar los procesos del área, con trato directo con clientes internos y reporte a la dirección.',
    requirements: 'Licenciatura afín.\nTres años de experiencia en un puesto similar.\nInglés intermedio.',
    closedReason: null,
    companyRating: null,
    creditCost: 3,
    profile: 'Ingeniería',
    subcategory: null,
    seniority: 'Mid',
    educationLevel: 'Licenciatura',
    habilidades: JSON.stringify(['Mejora continua', 'Excel avanzado', 'Trabajo en equipo']),
    responsabilidades: 'Planear el trabajo semanal del área.\nDar seguimiento a indicadores.\nProponer mejoras.',
    resultadosEsperados: null,
    valoresActitudes: 'Honestidad, compromiso y ganas de aprender.',
    informacionAdicional: null,
    isConfidential: false,
    userId: CUENTA.id,
    updatedAt: datos.createdAt,
    expiresAt: null,
    editableUntil: null,
    ...datos,
  };
}

function vacantesIniciales(): VacanteEmpresa[] {
  return [
    // Recién publicada: sigue en su ventana de edición de 4 h, aún sin candidatos.
    vacante(201, {
      title: 'Desarrollador Full Stack Sr.',
      status: 'active',
      createdAt: hace(0, 1.5),
      editableUntil: dentroDe(0, 2.5),
      profile: 'Tecnología',
      subcategory: 'Desarrollo web',
      seniority: 'Sr',
      workMode: 'hybrid',
      salary: '$55,000 – $65,000 MXN',
      habilidades: JSON.stringify(['TypeScript', 'React', 'Node.js', 'PostgreSQL', 'Pruebas automatizadas']),
    }),
    vacante(202, {
      title: 'Ingeniera de Procesos',
      status: 'active',
      createdAt: hace(12),
      editableUntil: hace(12, -4),
      subcategory: 'Proyectos industriales',
      resultadosEsperados: 'Reducir 15 % los tiempos muertos de la línea 2 en el primer semestre.',
    }),
    vacante(203, {
      title: 'Analista Contable Jr.',
      status: 'active',
      createdAt: hace(20),
      editableUntil: hace(20, -4),
      profile: 'Finanzas',
      subcategory: 'Contabilidad',
      seniority: 'Jr',
      salary: '$18,000 – $22,000 MXN',
      habilidades: 'Conciliaciones bancarias, CONTPAQi, cierre mensual.',
    }),
    // Nombre largo y ya expirada (sigue en «Activas» con su insignia).
    vacante(204, {
      title: 'Coordinadora de Logística y Distribución Regional, Zona Noreste',
      status: 'active',
      createdAt: hace(48),
      editableUntil: hace(48, -4),
      expiresAt: hace(3),
      profile: 'Administración de Oficina',
      location: 'Apodaca, NL',
      latitude: 25.7817,
      longitude: -100.1882,
      salary: '$32,000 – $40,000 MXN',
    }),
    vacante(205, {
      title: 'Diseñador UX/UI',
      status: 'paused',
      createdAt: hace(30),
      editableUntil: hace(30, -4),
      profile: 'Diseño Gráfico',
      subcategory: 'Diseño UI/UX',
      workMode: 'remote',
      location: 'Remoto (México)',
      latitude: null,
      longitude: null,
    }),
    vacante(206, {
      title: 'Jefe de Almacén',
      status: 'draft',
      createdAt: hace(2),
      profile: 'Administración de Oficina',
      seniority: 'Sr',
      creditCost: 0,
    }),
    vacante(207, {
      title: 'Ejecutivo de Ventas B2B',
      status: 'draft',
      createdAt: hace(5),
      profile: 'Marketing',
      seniority: 'Mid',
      jobType: 'Medio tiempo',
      creditCost: 0,
    }),
    vacante(208, {
      title: 'Residente de Obra',
      status: 'closed',
      closedReason: 'success',
      createdAt: hace(75),
      editableUntil: hace(75, -4),
      profile: 'Arquitectura',
      subcategory: 'Supervisión de obra',
      location: 'Santa Catarina, NL',
    }),
    vacante(209, {
      title: 'Auxiliar Administrativo',
      status: 'closed',
      closedReason: 'cancelled',
      createdAt: hace(60),
      editableUntil: hace(60, -4),
      profile: 'Administración de Oficina',
      seniority: 'Jr',
    }),
    vacante(210, {
      title: 'Científica de Datos',
      status: 'active',
      createdAt: hace(8),
      editableUntil: hace(8, -4),
      profile: 'Tecnología',
      subcategory: 'Machine learning',
      seniority: 'Lead',
      workMode: 'hybrid',
      salary: '$70,000 – $80,000 MXN',
    }),
    vacante(211, {
      title: 'Técnico de Mantenimiento Industrial',
      status: 'active',
      createdAt: hace(15),
      editableUntil: hace(15, -4),
      location: 'Escobedo, NL',
      latitude: 25.7939,
      longitude: -100.3148,
      seniority: 'Mid',
      educationLevel: 'Preparatoria/Bachillerato',
    }),
  ];
}

// ---------------------------------------------------------------------------
// Candidatos (postulaciones visibles para la empresa)
// ---------------------------------------------------------------------------
const PERSONAS: Array<{
  nombre: string;
  apellidoPaterno: string;
  apellidoMaterno: string | null;
  carrera: string;
  universidad: string;
  nivelEstudios: string;
  profile: string;
  seniority: string;
  lat: number | null;
  lng: number | null;
}> = [
  { nombre: 'Mariana', apellidoPaterno: 'Pérez', apellidoMaterno: 'Gutiérrez', carrera: 'Ingeniería Industrial', universidad: 'Tecnológico de Monterrey', nivelEstudios: 'Licenciatura', profile: 'Ingeniería', seniority: 'Mid', lat: 25.6573, lng: -100.4023 },
  { nombre: 'Carlos', apellidoPaterno: 'Ibarra', apellidoMaterno: null, carrera: 'Ingeniería Mecatrónica', universidad: 'UANL', nivelEstudios: 'Licenciatura', profile: 'Ingeniería', seniority: 'Sr', lat: 25.7817, lng: -100.1882 },
  { nombre: 'Fernanda', apellidoPaterno: 'Ruiz', apellidoMaterno: 'Montemayor', carrera: 'Contaduría Pública', universidad: 'Universidad de Monterrey', nivelEstudios: 'Maestría', profile: 'Finanzas', seniority: 'Mid', lat: 25.6775, lng: -100.2597 },
  { nombre: 'Jorge', apellidoPaterno: 'Castañeda', apellidoMaterno: 'Leal', carrera: 'Administración de Empresas', universidad: 'Universidad Regiomontana', nivelEstudios: 'Licenciatura', profile: 'Administración de Oficina', seniority: 'Sr', lat: 25.425, lng: -100.147 },
  { nombre: 'Valeria', apellidoPaterno: 'Núñez', apellidoMaterno: 'Cantú', carrera: 'Diseño Industrial', universidad: 'UANL', nivelEstudios: 'Licenciatura', profile: 'Diseño Gráfico', seniority: 'Mid', lat: 25.6866, lng: -100.3161 },
  { nombre: 'Ricardo', apellidoPaterno: 'Solís', apellidoMaterno: 'Treviño', carrera: 'Ingeniería en Sistemas Computacionales', universidad: 'Instituto Tecnológico de Nuevo León', nivelEstudios: 'Licenciatura', profile: 'Tecnología', seniority: 'Sr', lat: 25.4232, lng: -100.9924 },
  { nombre: 'Daniela', apellidoPaterno: 'Ortega', apellidoMaterno: null, carrera: 'Actuaría', universidad: 'Universidad Autónoma de Coahuila', nivelEstudios: 'Maestría', profile: 'Tecnología', seniority: 'Lead', lat: null, lng: null },
  { nombre: 'Alejandro', apellidoPaterno: 'de la Garza', apellidoMaterno: 'Villarreal', carrera: 'Ingeniería Civil', universidad: 'Universidad de Monterrey', nivelEstudios: 'Licenciatura', profile: 'Arquitectura', seniority: 'Mid', lat: 25.6751, lng: -100.4602 },
  { nombre: 'Renata', apellidoPaterno: 'Aguilar', apellidoMaterno: 'Salinas', carrera: 'Logística y Transporte', universidad: 'Tecnológico de Monterrey', nivelEstudios: 'Licenciatura', profile: 'Administración de Oficina', seniority: 'Mid', lat: 25.7939, lng: -100.3148 },
  { nombre: 'Hugo', apellidoPaterno: 'Salazar', apellidoMaterno: 'Rdz', carrera: 'Técnico en Mantenimiento Industrial', universidad: 'CONALEP Nuevo León', nivelEstudios: 'Técnico', profile: 'Ingeniería', seniority: 'Jr', lat: 25.7506, lng: -100.2946 },
  { nombre: 'Ximena', apellidoPaterno: 'Fuentes', apellidoMaterno: 'Chapa', carrera: 'Ciencia de Datos', universidad: 'Tecnológico de Monterrey', nivelEstudios: 'Maestría', profile: 'Tecnología', seniority: 'Sr', lat: 25.6489, lng: -100.2896 },
  { nombre: 'Paulina', apellidoPaterno: 'Cantú', apellidoMaterno: 'Elizondo', carrera: 'Contaduría Pública', universidad: 'UANL', nivelEstudios: 'Licenciatura', profile: 'Finanzas', seniority: 'Jr', lat: 25.7275, lng: -100.3094 },
  { nombre: 'Sebastián', apellidoPaterno: 'Leal', apellidoMaterno: 'Benavides', carrera: 'Arquitectura', universidad: 'Universidad de Monterrey', nivelEstudios: 'Licenciatura', profile: 'Arquitectura', seniority: 'Sr', lat: 25.6573, lng: -100.4023 },
  { nombre: 'Andrea', apellidoPaterno: 'Chapa', apellidoMaterno: null, carrera: 'Psicología Organizacional', universidad: 'Universidad Regiomontana', nivelEstudios: 'Licenciatura', profile: 'Salud', seniority: 'Mid', lat: 25.6775, lng: -100.2597 },
  { nombre: 'Rodrigo', apellidoPaterno: 'Elizondo', apellidoMaterno: 'Garza', carrera: 'Ingeniería Eléctrica', universidad: 'UANL', nivelEstudios: 'Licenciatura', profile: 'Ingeniería', seniority: 'Mid', lat: 25.8651, lng: -100.2333 },
  { nombre: 'Lucía', apellidoPaterno: 'Benavides', apellidoMaterno: 'Zambrano', carrera: 'Mercadotecnia', universidad: 'Universidad de Monterrey', nivelEstudios: 'Licenciatura', profile: 'Marketing', seniority: 'Jr', lat: 25.6866, lng: -100.3161 },
];

/** Estados de las postulaciones de cada vacante (sólo los que ve la empresa). */
const PIPELINE: Record<number, string[]> = {
  202: ['sent_to_company', 'sent_to_company', 'sent_to_company', 'company_interested', 'company_interested', 'interviewed', 'accepted', 'rejected', 'rejected'],
  203: ['sent_to_company', 'sent_to_company', 'company_interested', 'rejected', 'rejected'],
  204: ['sent_to_company', 'company_interested', 'interviewed', 'rejected'],
  205: ['company_interested', 'interviewed', 'rejected'],
  208: ['accepted', 'interviewed', 'interviewed', 'company_interested', 'company_interested', 'rejected', 'rejected', 'rejected', 'rejected', 'rejected', 'rejected'],
  209: ['rejected', 'rejected'],
  210: ['sent_to_company', 'company_interested', 'company_interested', 'interviewed', 'interviewed', 'rejected', 'rejected'],
  211: ['company_interested', 'rejected'],
};
/** Vacantes fuera de la empresa (p. ej. /company/jobs/101/candidates): un embudo típico. */
const PIPELINE_TIPICO = ['sent_to_company', 'sent_to_company', 'company_interested', 'interviewed', 'accepted', 'rejected'];

const quitarAcentos = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '');

function postulacion(jobId: number, status: string, i: number) {
  const persona = PERSONAS[(jobId + i * 3) % PERSONAS.length];
  const nombreCompleto = [persona.nombre, persona.apellidoPaterno, persona.apellidoMaterno].filter(Boolean).join(' ');
  const email = `${quitarAcentos(persona.nombre).toLowerCase()}.${quitarAcentos(persona.apellidoPaterno).toLowerCase().replace(/\s+/g, '')}@correo.mx`;
  const id = jobId * 100 + i;
  // Uno de cada siete no tiene expediente en el banco de candidatos.
  const sinExpediente = (id % 7) === 3;
  const evaluado = status !== 'sent_to_company' || i % 2 === 0;
  return {
    id,
    candidateName: nombreCompleto,
    candidateEmail: email,
    candidatePhone: `81 ${String(1000 + ((id * 37) % 9000))} ${String(1000 + ((id * 53) % 9000))}`,
    status,
    createdAt: hace(1 + i * 1.7, i),
    cvUrl: null as string | null,
    coverLetter:
      i % 3 === 0
        ? 'Me interesa mucho el puesto porque combina lo que más disfruto: ordenar procesos y trabajar con personas. En mi último empleo reduje los reprocesos del área y me gustaría aportar lo mismo aquí.'
        : null,
    publicEvaluationNotes: evaluado
      ? [
          {
            id: id * 10,
            authorRole: 'specialist',
            authorName: 'Diego Calderón',
            content:
              'Entrevista técnica sólida: explica con claridad cómo midió sus resultados y resolvió bien el caso práctico. Recomendable para una segunda entrevista con el área.',
            documentUrl: null,
            documentName: null,
            createdAt: hace(1 + i),
          },
        ]
      : [],
    candidateProfile: sinExpediente
      ? null
      : {
          id: 5000 + id,
          nombre: persona.nombre,
          apellidoPaterno: persona.apellidoPaterno,
          apellidoMaterno: persona.apellidoMaterno,
          email,
          telefono: `81 ${String(1000 + ((id * 37) % 9000))} ${String(1000 + ((id * 53) % 9000))}`,
          sexo: i % 2 === 0 ? 'F' : 'M',
          fechaNacimiento: new Date(1990 + (id % 9), id % 12, 1 + (id % 27)).toISOString(),
          universidad: persona.universidad,
          carrera: persona.carrera,
          nivelEstudios: persona.nivelEstudios,
          añosExperiencia: 2 + (id % 9),
          profile: persona.profile,
          seniority: persona.seniority,
          // Domicilio y CV: la ficha los pinta en «Resumen» (datos inventados).
          ciudad: ['Monterrey', 'San Pedro Garza García', 'Guadalupe', 'Apodaca'][id % 4],
          estado: 'Nuevo León',
          cvUrl: i % 2 === 1 ? `/uploads/cv-${quitarAcentos(persona.nombre).toLowerCase()}.pdf` : null,
          linkedinUrl: i % 2 === 0 ? `https://www.linkedin.com/in/${quitarAcentos(persona.nombre).toLowerCase()}-ejemplo` : null,
          portafolioUrl: null,
          educacion: JSON.stringify([
            // Estatus de los DOS vocabularios que hay en producción (registro y /profile).
            { nivel: persona.nivelEstudios, institucion: persona.universidad, carrera: persona.carrera, añoInicio: 2010 + (id % 5), añoFin: 2014 + (id % 5), estatus: ['Titulado', 'Completa', 'Terminado'][id % 3] },
            ...(id % 4 === 1
              ? [{ nivel: 'Diplomado', institucion: 'Universidad de Monterrey', carrera: 'Diplomado en Gestión de Proyectos', añoInicio: 2025, añoFin: null, estatus: id % 8 === 1 ? 'Cursando' : 'En curso' }]
              : []),
          ]),
          fotoUrl: null,
          cartaPresentacion: null,
          experiences: [
            {
              id: id * 10 + 1,
              empresa: 'Manufacturas del Norte',
              puesto: 'Analista de mejora continua',
              ubicacion: 'Monterrey, NL',
              fechaInicio: hace(900),
              fechaFin: null,
              esActual: true,
              descripcion: 'Seguimiento de indicadores de producción y proyectos de reducción de desperdicio.',
            },
            {
              id: id * 10 + 2,
              empresa: 'Servicios Industriales Cumbres',
              puesto: 'Practicante de operaciones',
              ubicacion: 'Guadalupe, NL',
              fechaInicio: hace(1500),
              fechaFin: hace(920),
              esActual: false,
              descripcion: null,
            },
          ],
          documents: [{ id: id * 10 + 3, name: 'Cédula profesional.pdf', fileUrl: '/uploads/cedula-ejemplo.pdf', fileType: 'application/pdf' }],
          latitude: persona.lat,
          longitude: persona.lng,
        },
  };
}
type Postulacion = ReturnType<typeof postulacion>;

// ---------------------------------------------------------------------------
// Entrevistas
// ---------------------------------------------------------------------------
interface Entrevista {
  id: number;
  applicationId: number;
  requestedById: number;
  type: string;
  duration: number;
  participants: Array<{ nombre: string; email: string }> | null;
  availableSlots: Array<{ date: string; time: string }>;
  message: string | null;
  status: string;
  confirmedSlot: { date: string; time: string } | null;
  confirmedAt: string | null;
  confirmedById: number | null;
  topic: string | null;
  scheduledStart: string | null;
  scheduledEnd: string | null;
  location: string | null;
  meetingUrl: string | null;
  createdAt: string;
  updatedAt: string;
}

function entrevistasIniciales(): Entrevista[] {
  const base = {
    requestedById: CUENTA.id,
    message: null,
    confirmedSlot: null,
    confirmedAt: null,
    confirmedById: null,
    topic: null,
    scheduledStart: null,
    scheduledEnd: null,
    location: null,
    meetingUrl: null,
  };
  const participantes = [
    { nombre: 'Tomás Rivas', email: CUENTA.email },
    { nombre: 'Laura Villarreal', email: 'laura.villarreal@grupoandes.mx' },
  ];
  return [
    // Pendientes (INAKAT coordinando)
    {
      ...base,
      id: 9001,
      applicationId: 20203,
      type: 'videocall',
      duration: 45,
      participants: participantes,
      availableSlots: [
        { date: diaLocal(2), time: '10:00' },
        { date: diaLocal(2), time: '16:00' },
        { date: diaLocal(3), time: '09:00' },
      ],
      message: 'Nos gustaría conocer más sobre su experiencia en proyectos de mejora continua.',
      status: 'pending',
      createdAt: hace(0, 6),
      updatedAt: hace(0, 6),
    },
    {
      ...base,
      id: 9002,
      applicationId: 21001,
      type: 'presential',
      duration: 60,
      participants: null,
      availableSlots: [{ date: diaLocal(4), time: '12:00' }],
      status: 'pending',
      createdAt: hace(1, 3),
      updatedAt: hace(1, 3),
    },
    // Agendadas (confirmadas y por venir)
    {
      ...base,
      id: 9003,
      applicationId: 20204,
      type: 'videocall',
      duration: 45,
      participants: participantes,
      availableSlots: [{ date: diaLocal(1), time: '11:00' }],
      status: 'confirmed',
      confirmedSlot: { date: diaLocal(1), time: '11:00' },
      confirmedAt: hace(0, 20),
      confirmedById: USUARIOS.admin.id,
      topic: 'Entrevista con la gerencia de operaciones',
      scheduledStart: aLas(1, 11),
      scheduledEnd: aLas(1, 11, 45),
      meetingUrl: 'https://meet.google.com/abc-defg-hij',
      createdAt: hace(3),
      updatedAt: hace(0, 20),
    },
    {
      ...base,
      id: 9004,
      applicationId: 21003,
      type: 'presential',
      duration: 60,
      participants: [participantes[1]],
      availableSlots: [{ date: diaLocal(6), time: '09:00' }],
      status: 'confirmed',
      confirmedSlot: { date: diaLocal(6), time: '09:00' },
      confirmedAt: hace(1),
      confirmedById: USUARIOS.admin.id,
      topic: 'Caso práctico de modelos de pronóstico',
      scheduledStart: aLas(6, 9),
      scheduledEnd: aLas(6, 10),
      location: 'Av. Constitución 1500 Ote., piso 8, Centro, Monterrey, NL',
      createdAt: hace(4),
      updatedAt: hace(1),
    },
    // Pasadas
    {
      ...base,
      id: 9005,
      applicationId: 20205,
      type: 'videocall',
      duration: 30,
      participants: null,
      availableSlots: [{ date: diaLocal(-5), time: '13:00' }],
      status: 'confirmed',
      confirmedSlot: { date: diaLocal(-5), time: '13:00' },
      confirmedAt: hace(8),
      confirmedById: USUARIOS.admin.id,
      topic: null,
      scheduledStart: aLas(-5, 13),
      scheduledEnd: aLas(-5, 13, 30),
      meetingUrl: 'https://meet.google.com/xyz-uvwx-rst',
      createdAt: hace(9),
      updatedAt: hace(5),
    },
    {
      ...base,
      id: 9006,
      applicationId: 20501,
      type: 'videocall',
      duration: 45,
      participants: null,
      availableSlots: [{ date: diaLocal(-9), time: '17:00' }],
      status: 'cancelled',
      createdAt: hace(12),
      updatedAt: hace(10),
    },
    {
      ...base,
      id: 9007,
      applicationId: 20401,
      type: 'presential',
      duration: 45,
      participants: null,
      availableSlots: [
        { date: diaLocal(-14), time: '08:00' },
        { date: diaLocal(-14), time: '20:00' },
      ],
      status: 'rejected',
      createdAt: hace(16),
      updatedAt: hace(15),
    },
  ];
}

// ---------------------------------------------------------------------------
// Integraciones
// ---------------------------------------------------------------------------
const MASCARA_KEY = 'inak_********************************';
const MASCARA_SECRETO = '••••••••';

function keysIniciales() {
  return [
    { id: 71, name: 'Worky2 producción', isActive: true, lastUsedAt: hace(0, 3), createdAt: hace(40) },
    { id: 70, name: 'Pruebas de nómina (sandbox)', isActive: false, lastUsedAt: null, createdAt: hace(90) },
  ];
}
function webhooksIniciales() {
  return [{ id: 31, url: 'https://nomina.grupoandes.mx/inakat/webhook', isActive: true, createdAt: hace(40) }];
}

// ---------------------------------------------------------------------------
// Estado del banco (se reinicia al recargar la página)
// ---------------------------------------------------------------------------
const estado = {
  // El saldo ES el de la cuenta de base (USUARIOS.company): /api/auth/me, que
  // pinta la cabecera del AppShell, lo lee en cada llamada, así que tras
  // publicar un borrador (y notifyAuthChanged) la cabecera baja igual.
  get creditos() {
    return CUENTA.credits;
  },
  set creditos(valor: number) {
    CUENTA.credits = valor;
  },
  vacantes: vacantesIniciales(),
  postulaciones: new Map<number, Postulacion[]>(),
  entrevistas: entrevistasIniciales(),
  keys: keysIniciales(),
  webhooks: webhooksIniciales(),
  siguienteId: 10_000,
  perfil: {
    representante: { nombre: 'Tomás', apellidoPaterno: 'Rivas', apellidoMaterno: 'Garza' },
    nombreEmpresa: EMPRESA,
    correoEmpresa: 'reclutamiento@grupoandes.mx',
    sitioWeb: 'https://www.grupoandes.mx' as string | null,
    razonSocial: 'Grupo Andes Servicios Industriales, S.A. de C.V.',
    rfc: 'GAS180312KL4',
    direccionEmpresa: 'Av. Constitución 1500 Ote., Centro, 64000 Monterrey, N.L., México',
    latitud: MONTERREY.lat as number | null,
    longitud: MONTERREY.lng as number | null,
    logoUrl: LOGO_EMPRESA as string | null,
    status: 'approved',
    createdAt: hace(210),
    approvedAt: hace(208) as string | null,
  },
};

/** Postulaciones de una vacante (se crean la primera vez que se piden). */
function postulacionesDe(jobId: number): Postulacion[] {
  let lista = estado.postulaciones.get(jobId);
  if (!lista) {
    const deLaEmpresa = estado.vacantes.some((v) => v.id === jobId);
    const estados = PIPELINE[jobId] ?? (deLaEmpresa ? [] : PIPELINE_TIPICO);
    lista = estados.map((s, i) => postulacion(jobId, s, i));
    estado.postulaciones.set(jobId, lista);
  }
  return lista;
}

function buscarPostulacion(id: number): { app: Postulacion; jobId: number } | null {
  const jobId = Math.floor(id / 100);
  const app = postulacionesDe(jobId).find((a) => a.id === id);
  return app ? { app, jobId } : null;
}

/** La vacante tal como la selecciona GET /api/company/jobs/:id/candidates. */
function vacanteParaCandidatos(jobId: number) {
  const propia = estado.vacantes.find((v) => v.id === jobId);
  if (propia) {
    const { id, title, company, location, salary, status, profile, seniority, createdAt, userId, habilidades, latitude, longitude } = propia;
    return { id, title, company, location, salary, status, profile, seniority, createdAt, userId, habilidades, latitude, longitude };
  }
  const base = VACANTES.find((v) => v.id === jobId);
  return {
    id: jobId,
    title: base?.title ?? 'Vacante de ejemplo',
    company: base?.company ?? EMPRESA,
    location: base?.location ?? 'Monterrey, NL',
    salary: base?.salary ?? '$30,000 – $38,000 MXN',
    status: base?.status ?? 'active',
    profile: base?.profile ?? null,
    seniority: base?.seniority ?? null,
    createdAt: base?.createdAt ?? hace(10),
    userId: CUENTA.id,
    habilidades: base?.habilidades ?? null,
    latitude: MONTERREY.lat,
    longitude: MONTERREY.lng,
  };
}

// ---------------------------------------------------------------------------
// Panel (GET /api/company/dashboard)
// ---------------------------------------------------------------------------
function panel() {
  const cuenta = parametroPagina('cuenta');
  const vacio = parametroPagina('vacio') === '1';
  const vacantes = vacio ? [] : estado.vacantes;
  const now = Date.now();
  const expirada = (v: VacanteEmpresa) => v.status === 'active' && v.expiresAt !== null && new Date(v.expiresAt).getTime() <= now;

  const todas = vacantes.flatMap((v) =>
    postulacionesDe(v.id).map(({ publicEvaluationNotes: _notas, ...app }) => ({
      ...app,
      jobId: v.id,
      updatedAt: app.createdAt,
      job: { id: v.id, title: v.title, location: v.location, status: v.status, latitude: v.latitude, longitude: v.longitude },
    }))
  );
  const cuenta_ = (s: string) => todas.filter((a) => a.status === s).length;

  const jobStats = vacantes.map((v) => {
    const apps = postulacionesDe(v.id);
    const c = (s: string) => apps.filter((a) => a.status === s).length;
    return {
      jobId: v.id,
      jobTitle: v.title,
      totalCandidates: apps.length,
      pendingReview: c('sent_to_company'),
      interested: c('company_interested'),
      interviewedCandidates: c('interviewed'),
      acceptedCandidates: c('accepted'),
      rejectedCandidates: c('rejected'),
    };
  });

  const companyInfo =
    cuenta === 'sin'
      ? null
      : {
          nombre: estado.perfil.representante.nombre,
          apellidoPaterno: estado.perfil.representante.apellidoPaterno,
          nombreEmpresa: estado.perfil.nombreEmpresa,
          correoEmpresa: estado.perfil.correoEmpresa,
          sitioWeb: estado.perfil.sitioWeb,
          rfc: estado.perfil.rfc,
          direccionEmpresa: estado.perfil.direccionEmpresa,
          logoUrl: estado.perfil.logoUrl,
          status: cuenta === 'pending' ? 'pending' : cuenta === 'rejected' ? 'rejected' : 'approved',
          rejectionReason:
            cuenta === 'rejected'
              ? 'La constancia de situación fiscal no coincide con la razón social registrada'
              : null,
        };

  return {
    success: true,
    data: {
      company: {
        userId: CUENTA.id,
        userName: `${estado.perfil.representante.nombre} ${estado.perfil.representante.apellidoPaterno}`,
        email: CUENTA.email,
        credits: estado.creditos,
        companyInfo,
      },
      stats: {
        jobs: {
          total: vacantes.length,
          active: vacantes.filter((v) => v.status === 'active' && !expirada(v)).length,
          paused: vacantes.filter((v) => v.status === 'paused').length,
          expired: vacantes.filter(expirada).length,
          closed: vacantes.filter((v) => v.status === 'closed').length,
          draft: vacantes.filter((v) => v.status === 'draft').length,
        },
        applications: {
          total: todas.length,
          pendingReview: cuenta_('sent_to_company'),
          interested: cuenta_('company_interested'),
          interviewed: cuenta_('interviewed'),
          accepted: cuenta_('accepted'),
          rejected: cuenta_('rejected'),
        },
      },
      recentApplications: todas.slice(0, 5),
      allApplications: todas,
      topJobs: [...jobStats]
        .sort((a, b) => b.totalCandidates - a.totalCandidates)
        .slice(0, 5)
        .map((s) => {
          const v = vacantes.find((x) => x.id === s.jobId)!;
          return { id: v.id, title: v.title, location: v.location, status: v.status, applicationCount: s.totalCandidates, salary: v.salary };
        }),
      jobStats,
      allJobs: vacantes.map((v) => ({ ...v, applicationCount: postulacionesDe(v.id).length })),
    },
  };
}

// ---------------------------------------------------------------------------
// Entrevistas (GET /api/company/interviews): con la postulación y su vacante
// ---------------------------------------------------------------------------
function entrevistasConPostulacion() {
  return estado.entrevistas
    .map((e) => {
      const hallada = buscarPostulacion(e.applicationId);
      const vacanteId = hallada?.jobId ?? 202;
      const job = vacanteParaCandidatos(vacanteId);
      const app = hallada?.app ?? postulacionesDe(202)[0];
      return {
        ...e,
        application: {
          id: app.id,
          candidateName: app.candidateName,
          candidateEmail: app.candidateEmail,
          candidatePhone: app.candidatePhone,
          status: app.status,
          job: { id: job.id, title: job.title, company: job.company },
        },
      };
    })
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

// ---------------------------------------------------------------------------
// Perfil (GET/PUT /api/company/profile)
// ---------------------------------------------------------------------------
function perfil() {
  const p = estado.perfil;
  return {
    success: true,
    data: {
      userId: CUENTA.id,
      userEmail: CUENTA.email,
      userName: p.representante.nombre,
      credits: estado.creditos,
      representante: { ...p.representante },
      nombreEmpresa: p.nombreEmpresa,
      correoEmpresa: p.correoEmpresa,
      sitioWeb: p.sitioWeb,
      razonSocial: p.razonSocial,
      rfc: p.rfc,
      direccionEmpresa: p.direccionEmpresa,
      latitud: p.latitud,
      longitud: p.longitud,
      logoUrl: p.logoUrl,
      status: p.status,
      createdAt: p.createdAt,
      approvedAt: p.approvedAt,
    },
  };
}

type CuerpoPerfil = Partial<{
  nombre: string;
  apellidoPaterno: string;
  apellidoMaterno: string;
  nombreEmpresa: string;
  correoEmpresa: string;
  sitioWeb: string;
  razonSocial: string;
  direccionEmpresa: string;
  latitud: number | null;
  longitud: number | null;
  logoUrl: string | null;
}>;

function guardarPerfil(cuerpo: CuerpoPerfil) {
  const errores: string[] = [];
  const vacio = (v: unknown) => typeof v === 'string' && v.trim() === '';
  if (vacio(cuerpo.nombre)) errores.push('El nombre es obligatorio');
  if (vacio(cuerpo.nombreEmpresa)) errores.push('El nombre de la empresa es obligatorio');
  if (vacio(cuerpo.direccionEmpresa)) errores.push('La dirección es obligatoria');
  if (cuerpo.sitioWeb && !/^https?:\/\//i.test(cuerpo.sitioWeb)) errores.push('El sitio web debe empezar con http:// o https://');
  if (errores.length) return respuesta({ success: false, error: 'Datos inválidos', errors: errores }, 400);

  const p = estado.perfil;
  if (cuerpo.nombre !== undefined) p.representante.nombre = cuerpo.nombre;
  if (cuerpo.apellidoPaterno !== undefined) p.representante.apellidoPaterno = cuerpo.apellidoPaterno;
  if (cuerpo.apellidoMaterno !== undefined) p.representante.apellidoMaterno = cuerpo.apellidoMaterno;
  if (cuerpo.nombreEmpresa !== undefined) p.nombreEmpresa = cuerpo.nombreEmpresa;
  if (cuerpo.correoEmpresa !== undefined) p.correoEmpresa = cuerpo.correoEmpresa;
  if (cuerpo.sitioWeb !== undefined) p.sitioWeb = cuerpo.sitioWeb || null;
  if (cuerpo.razonSocial !== undefined) p.razonSocial = cuerpo.razonSocial;
  if (cuerpo.direccionEmpresa !== undefined) p.direccionEmpresa = cuerpo.direccionEmpresa;
  if (cuerpo.latitud !== undefined) p.latitud = cuerpo.latitud;
  if (cuerpo.longitud !== undefined) p.longitud = cuerpo.longitud;
  if (cuerpo.logoUrl !== undefined) p.logoUrl = cuerpo.logoUrl || null;

  return {
    success: true,
    message: 'Perfil de empresa actualizado exitosamente',
    data: {
      representante: { ...p.representante },
      nombreEmpresa: p.nombreEmpresa,
      correoEmpresa: p.correoEmpresa,
      sitioWeb: p.sitioWeb,
      razonSocial: p.razonSocial,
      rfc: p.rfc,
      direccionEmpresa: p.direccionEmpresa,
      latitud: p.latitud,
      longitud: p.longitud,
      logoUrl: p.logoUrl,
    },
  };
}

// ---------------------------------------------------------------------------
// Transiciones que acepta la API (src/app/api/company/applications/[id]/route.ts)
// ---------------------------------------------------------------------------
const TRANSICIONES: Record<string, string[]> = {
  sent_to_company: ['company_interested', 'accepted', 'rejected'],
  company_interested: ['interviewed', 'accepted', 'rejected'],
  interviewed: ['accepted', 'rejected'],
  rejected: ['company_interested', 'accepted'],
};
const MENSAJES_ESTADO: Record<string, string> = {
  company_interested: 'Candidato marcado como "Me interesa"',
  interviewed: 'Candidato marcado como entrevistado',
  rejected: 'Candidato descartado',
};

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------
export const fixtures: Fixture[] = [
  // ---- Panel ----
  {
    metodo: 'GET',
    patron: '/api/company/dashboard',
    retraso: 250,
    respuesta: () => (parametroPagina('falla') === '1' ? falla500() : panel()),
  },
  {
    // Publicar un borrador: descuenta créditos y lo deja activo con su ventana de edición.
    metodo: 'PUT',
    patron: '/api/jobs/publish',
    retraso: 400,
    respuesta: ({ cuerpo }) => {
      const { jobId } = (cuerpo ?? {}) as { jobId?: number };
      if (!jobId) return respuesta({ success: false, error: 'Se requiere jobId' }, 400);
      const v = estado.vacantes.find((x) => x.id === Number(jobId));
      if (!v) return respuesta({ success: false, error: 'Vacante no encontrada' }, 404);
      if (v.status !== 'draft') return respuesta({ success: false, error: 'Solo se pueden publicar vacantes en borrador' }, 400);
      const costo = 3;
      if (estado.creditos < costo) {
        return respuesta(
          { success: false, error: 'Créditos insuficientes para publicar', required: costo, available: estado.creditos },
          402
        );
      }
      estado.creditos -= costo;
      v.status = 'active';
      v.creditCost = costo;
      v.createdAt = new Date().toISOString();
      v.editableUntil = dentroDe(0, 4);
      return { success: true, message: '¡Vacante publicada exitosamente!', data: v, creditCost: costo };
    },
  },
  {
    // Pausar, reanudar y cerrar (el panel sólo manda status y closedReason).
    metodo: 'PATCH',
    patron: '/api/jobs/:id',
    retraso: 300,
    respuesta: ({ params, cuerpo }) => {
      const { status, closedReason } = (cuerpo ?? {}) as { status?: string; closedReason?: string };
      const v = estado.vacantes.find((x) => x.id === Number(params.id));
      if (v && status) {
        v.status = status;
        v.closedReason = status === 'closed' ? closedReason ?? null : null;
        v.updatedAt = new Date().toISOString();
      }
      return { success: true, message: 'Job updated successfully', data: v ?? { id: Number(params.id), status } };
    },
  },

  // ---- Candidatos de una vacante ----
  {
    metodo: 'GET',
    patron: '/api/company/jobs/:jobId/candidates',
    retraso: 300,
    respuesta: ({ params }) => {
      const jobId = Number(params.jobId);
      if (parametroPagina('falla') === '1') return respuesta({ success: false, error: 'Error al obtener candidatos' }, 500);
      if (Number.isNaN(jobId)) return respuesta({ success: false, error: 'ID de vacante inválido' }, 400);
      if (jobId === 404) return respuesta({ success: false, error: 'Vacante no encontrada' }, 404);
      if (jobId === 403) return respuesta({ success: false, error: 'No tienes permiso para ver esta vacante' }, 403);
      return { success: true, data: { job: vacanteParaCandidatos(jobId), applications: postulacionesDe(jobId) } };
    },
  },
  {
    metodo: 'PATCH',
    patron: '/api/company/applications/:id',
    retraso: 300,
    respuesta: ({ params, cuerpo }) => {
      const { status, closeJob } = (cuerpo ?? {}) as { status?: string; closeJob?: boolean };
      if (!status) return respuesta({ success: false, error: 'Status es requerido' }, 400);
      const hallada = buscarPostulacion(Number(params.id));
      if (!hallada) return respuesta({ success: false, error: 'Aplicación no encontrada' }, 404);
      const { app, jobId } = hallada;
      if (app.status === 'accepted') {
        return respuesta(
          { success: false, error: 'Este candidato ya está en proceso de contratación y no puede ser modificado' },
          400
        );
      }
      const permitidos = TRANSICIONES[app.status] ?? [];
      if (!permitidos.includes(status)) {
        return respuesta(
          { success: false, error: `Transición inválida. Desde "${app.status}" solo puedes cambiar a: ${permitidos.join(', ')}` },
          400
        );
      }
      app.status = status;
      let jobClosed = false;
      if (status === 'accepted' && closeJob === true) {
        const v = estado.vacantes.find((x) => x.id === jobId);
        if (v) {
          v.status = 'closed';
          v.closedReason = 'success';
        }
        jobClosed = true;
      }
      const job = vacanteParaCandidatos(jobId);
      return {
        success: true,
        message:
          status === 'accepted'
            ? jobClosed
              ? '¡Candidato en proceso de contratación! La vacante ha sido cerrada.'
              : 'Candidato en proceso de contratación'
            : MENSAJES_ESTADO[status] ?? 'Aplicación actualizada',
        data: { ...app, jobId, job: { id: job.id, title: job.title } },
        jobClosed,
      };
    },
  },
  {
    metodo: 'POST',
    patron: '/api/company/interview-requests',
    retraso: 500,
    respuesta: ({ cuerpo }) => {
      const datos = (cuerpo ?? {}) as {
        applicationId?: number;
        type?: string;
        duration?: number;
        participants?: Array<{ nombre: string; email: string }> | null;
        availableSlots?: Array<{ date: string; time: string }>;
        message?: string | null;
      };
      if (!datos.applicationId || !datos.availableSlots?.length) {
        return respuesta({ success: false, error: 'Datos inválidos' }, 400);
      }
      const hallada = buscarPostulacion(Number(datos.applicationId));
      if (!hallada) return respuesta({ success: false, error: 'Aplicación no encontrada' }, 404);
      if (estado.entrevistas.some((e) => e.applicationId === hallada.app.id && e.status === 'pending')) {
        return respuesta({ success: false, error: 'Ya existe una solicitud de entrevista pendiente para este candidato' }, 409);
      }
      const nueva: Entrevista = {
        id: estado.siguienteId++,
        applicationId: hallada.app.id,
        requestedById: CUENTA.id,
        type: datos.type ?? 'videocall',
        duration: datos.duration ?? 45,
        participants: datos.participants ?? null,
        availableSlots: datos.availableSlots,
        message: datos.message ?? null,
        status: 'pending',
        confirmedSlot: null,
        confirmedAt: null,
        confirmedById: null,
        topic: null,
        scheduledStart: null,
        scheduledEnd: null,
        location: null,
        meetingUrl: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      estado.entrevistas.push(nueva);
      return respuesta(
        {
          success: true,
          data: { ...nueva, participants: JSON.stringify(nueva.participants), availableSlots: JSON.stringify(nueva.availableSlots) },
          message: `Solicitud de entrevista enviada para ${hallada.app.candidateName}`,
        },
        201
      );
    },
  },

  // ---- Entrevistas ----
  {
    metodo: 'GET',
    patron: '/api/company/interviews',
    retraso: 250,
    respuesta: () => {
      if (parametroPagina('falla') === '1') return falla500();
      return { success: true, data: parametroPagina('vacio') === '1' ? [] : entrevistasConPostulacion() };
    },
  },

  // ---- Perfil ----
  {
    metodo: 'GET',
    patron: '/api/company/profile',
    retraso: 250,
    respuesta: () =>
      parametroPagina('falla') === '1'
        ? respuesta({ success: false, error: 'Error al obtener perfil de empresa' }, 500)
        : perfil(),
  },
  {
    metodo: 'PUT',
    patron: '/api/company/profile',
    retraso: 500,
    respuesta: ({ cuerpo }) => guardarPerfil((cuerpo ?? {}) as CuerpoPerfil),
  },
  {
    // Subida de archivos (la usa el logo del perfil; también la piden otras
    // pantallas). Una imagen vuelve como un logo que el banco pinta sin red
    // (data:); cualquier otro archivo, como una ruta local de ejemplo.
    metodo: 'POST',
    patron: '/api/upload',
    retraso: 700,
    respuesta: ({ cuerpo }) => {
      const archivo = (cuerpo as { file?: File } | undefined)?.file;
      const nombre = archivo?.name ?? 'archivo.pdf';
      const esImagen = typeof archivo?.type === 'string' && archivo.type.startsWith('image/');
      return { success: true, url: esImagen ? LOGO_SUBIDO : `/uploads/banco-${nombre.replace(/[^\w.-]+/g, '-')}`, filename: nombre };
    },
  },

  // ---- Integraciones ----
  {
    metodo: 'GET',
    patron: '/api/integration/keys',
    retraso: 200,
    respuesta: () => {
      if (parametroPagina('falla') === '1') return respuesta({ success: false, error: 'Error al listar las API keys' }, 500);
      const lista = parametroPagina('vacio') === '1' ? [] : estado.keys;
      return {
        success: true,
        data: [...lista]
          .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
          .map((k) => ({ ...k, maskedKey: MASCARA_KEY })),
      };
    },
  },
  {
    metodo: 'POST',
    patron: '/api/integration/keys',
    retraso: 400,
    respuesta: ({ cuerpo }) => {
      const nombre = String((cuerpo as { name?: string } | undefined)?.name ?? '').trim();
      if (nombre.length < 2) return respuesta({ success: false, error: 'El nombre debe tener al menos 2 caracteres' }, 400);
      if (estado.keys.filter((k) => k.isActive).length >= 10) {
        return respuesta(
          { success: false, error: 'Has alcanzado el máximo de 10 API keys activas. Revoca alguna antes de crear otra.' },
          409
        );
      }
      const nueva = { id: estado.siguienteId++, name: nombre, isActive: true, lastUsedAt: null, createdAt: new Date().toISOString() };
      estado.keys.push(nueva);
      const aleatoria = Array.from({ length: 32 }, (_, i) => '0123456789abcdef'[(nueva.id * 7 + i * 13) % 16]).join('');
      return respuesta(
        {
          success: true,
          message: 'API key creada. Guárdala ahora: no volverá a mostrarse en claro.',
          data: { id: nueva.id, name: nueva.name, isActive: true, createdAt: nueva.createdAt, key: `inak_${aleatoria}` },
        },
        201
      );
    },
  },
  {
    metodo: 'DELETE',
    patron: '/api/integration/keys',
    retraso: 300,
    respuesta: ({ url }) => {
      const id = Number(url.searchParams.get('id'));
      if (!id) return respuesta({ success: false, error: 'Debes indicar el id de la key a revocar' }, 400);
      const k = estado.keys.find((x) => x.id === id);
      if (!k) return respuesta({ success: false, error: 'API key no encontrada' }, 404);
      if (!k.isActive) return respuesta({ success: false, error: 'La API key ya estaba revocada' }, 409);
      k.isActive = false;
      return { success: true, message: 'API key revocada' };
    },
  },
  {
    metodo: 'GET',
    patron: '/api/integration/webhooks',
    retraso: 200,
    respuesta: () => {
      if (parametroPagina('falla') === '1') return respuesta({ success: false, error: 'Error al listar los webhooks' }, 500);
      const lista = parametroPagina('vacio') === '1' ? [] : estado.webhooks;
      return { success: true, data: lista.map((w) => ({ ...w, maskedSecret: MASCARA_SECRETO })) };
    },
  },
  {
    metodo: 'POST',
    patron: '/api/integration/webhooks',
    retraso: 400,
    respuesta: ({ cuerpo }) => {
      const { url: destino, secret } = (cuerpo ?? {}) as { url?: string; secret?: string };
      if (!destino || !/^https:\/\//i.test(destino)) return respuesta({ success: false, error: 'La URL debe usar https' }, 400);
      if (!secret || secret.length < 16) return respuesta({ success: false, error: 'El secreto debe tener al menos 16 caracteres' }, 400);
      if (estado.webhooks.some((w) => w.isActive && w.url === destino)) {
        return respuesta({ success: false, error: 'Ya existe un webhook activo con esa URL' }, 409);
      }
      const nuevo = { id: estado.siguienteId++, url: destino, isActive: true, createdAt: new Date().toISOString() };
      estado.webhooks.push(nuevo);
      return respuesta({ success: true, message: 'Webhook registrado. Recibirá el evento candidate.accepted.', data: nuevo }, 201);
    },
  },
  {
    metodo: 'DELETE',
    patron: '/api/integration/webhooks',
    retraso: 300,
    respuesta: ({ url }) => {
      const id = Number(url.searchParams.get('id'));
      if (!id) return respuesta({ success: false, error: 'Debes indicar el id del webhook a eliminar' }, 400);
      const w = estado.webhooks.find((x) => x.id === id);
      if (!w) return respuesta({ success: false, error: 'Webhook no encontrado' }, 404);
      if (!w.isActive) return respuesta({ success: false, error: 'El webhook ya estaba desactivado' }, 409);
      w.isActive = false;
      return { success: true, message: 'Webhook desactivado' };
    },
  },
];
