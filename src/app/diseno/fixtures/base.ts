// RUTA: src/app/diseno/fixtures/base.ts
//
// Fixtures comunes del banco de pruebas (dueño: sistema de diseño):
// - /api/auth/me por rol y /api/auth/logout (las usan el AppShell y muchas páginas);
// - /api/notifications* (la campanita y /notifications);
// - /api/specialties (catálogo compartido por varios bloques);
// - lo que necesita /admin: /api/admin/stats, /api/jobs y el pipeline.
//
// Los datos son inventados y verosímiles (nombres ficticios): NUNCA copies aquí
// datos reales de producción.

import type { RolApp } from '@/lib/nav-app';
import type { Fixture } from './tipos';

const ahora = Date.now();
const DIA = 86_400_000;
const hace = (dias: number, horas = 0) => new Date(ahora - dias * DIA - horas * 3_600_000).toISOString();

// ---------------------------------------------------------------------------
// Sesión por rol
// ---------------------------------------------------------------------------
export const USUARIOS: Record<RolApp, { id: number; email: string; nombre: string; credits: number }> = {
  admin: { id: 1, email: 'lucia.herrera@inakat.com', nombre: 'Lucía Herrera', credits: 0 },
  company: { id: 20, email: 'tomas.rivas@grupoandes.mx', nombre: 'Tomás Rivas', credits: 12 },
  candidate: { id: 40, email: 'andrea.lopez@correo.mx', nombre: 'Andrea López', credits: 0 },
  user: { id: 41, email: 'luis.ramirez@correo.mx', nombre: 'Luis Ramírez', credits: 0 },
  recruiter: { id: 30, email: 'paola.mendez@inakat.com', nombre: 'Paola Méndez', credits: 0 },
  specialist: { id: 31, email: 'diego.calderon@inakat.com', nombre: 'Diego Calderón', credits: 0 },
  vendor: { id: 50, email: 'sofia.trevino@inakat.com', nombre: 'Sofía Treviño', credits: 0 },
};

// ---------------------------------------------------------------------------
// Notificaciones
// ---------------------------------------------------------------------------
const NOTIFICACIONES = [
  { id: 1, type: 'new_application', title: 'Nueva postulación', message: 'Mariana Pérez se postuló a Desarrollador Full Stack Sr.', link: '/admin/direct-applications', read: false, createdAt: hace(0, 1) },
  { id: 2, type: 'new_request', title: 'Nueva solicitud de empresa', message: 'Clínica Norte pidió darse de alta en INAKAT.', link: '/admin/requests', read: false, createdAt: hace(0, 5) },
  { id: 3, type: 'interview_requested', title: 'Entrevista solicitada', message: 'Grupo Andes propone tres horarios para entrevistar a Carlos Ibarra.', link: '/admin/interviews', read: false, createdAt: hace(1) },
  { id: 4, type: 'sent_to_company', title: 'Candidatos enviados', message: 'Se enviaron 3 candidatos evaluados para Ingeniera de Procesos.', link: null, read: true, createdAt: hace(2) },
  { id: 5, type: 'credits_purchased', title: 'Compra de créditos', message: 'Logística Pacífico compró el paquete de 10 créditos.', link: null, read: true, createdAt: hace(3) },
  { id: 6, type: 'contact_message', title: 'Mensaje de contacto', message: 'Nuevo mensaje desde el formulario de contacto.', link: '/admin/contact-messages', read: true, createdAt: hace(6) },
  { id: 7, type: 'assignment', title: 'Vacante asignada', message: 'Te asignaron la vacante Coordinadora Académica.', link: null, read: true, createdAt: hace(9) },
];

// ---------------------------------------------------------------------------
// Especialidades (catálogo de prisma/seed.ts; las piden admin, candidatos,
// publicar vacante y el registro: por eso viven aquí y no en un bloque)
// ---------------------------------------------------------------------------
export const ESPECIALIDADES: Array<{ id: number; name: string; slug: string; icon: string; color: string; subcategories: string[] }> = [
  { id: 1, name: 'Tecnología', slug: 'tecnologia', icon: '💻', color: '#3B82F6', subcategories: ['Desarrollo web', 'DevOps', 'Infraestructura TI', 'Ciberseguridad', 'Bases de datos', 'Soporte técnico', 'Machine learning', 'Inteligencia artificial'] },
  { id: 2, name: 'Arquitectura', slug: 'arquitectura', icon: '🏛️', color: '#8B5CF6', subcategories: ['Diseño arquitectónico', 'Urbanismo', 'Interiorismo', 'Arquitectura sustentable', 'BIM', 'Supervisión de obra'] },
  { id: 3, name: 'Diseño Gráfico', slug: 'diseno-grafico', icon: '🎨', color: '#EC4899', subcategories: ['Diseño UI/UX', 'Branding', 'Ilustración', 'Motion graphics', 'Diseño editorial', 'Diseño de packaging'] },
  { id: 4, name: 'Producción Audiovisual', slug: 'produccion-audiovisual', icon: '🎬', color: '#F59E0B', subcategories: ['Fotografía', 'Video', 'Edición', 'Animación', 'Producción de contenido', 'Streaming'] },
  { id: 5, name: 'Educación', slug: 'educacion', icon: '📚', color: '#10B981', subcategories: ['Psicología', 'Lingüística', 'Pedagogía', 'Formación académica', 'Diseño instruccional', 'E-learning', 'Capacitación corporativa'] },
  { id: 6, name: 'Administración de Oficina', slug: 'administracion-oficina', icon: '🗂️', color: '#6366F1', subcategories: ['Recursos Humanos', 'Asistente administrativo', 'Gestión documental', 'Atención al cliente', 'Reclutamiento y selección', 'Recepción'] },
  { id: 7, name: 'Finanzas', slug: 'finanzas', icon: '💰', color: '#059669', subcategories: ['Contabilidad', 'Análisis financiero', 'Tesorería', 'Auditoría', 'Impuestos', 'Facturación'] },
  { id: 8, name: 'Marketing', slug: 'marketing', icon: '📈', color: '#EF4444', subcategories: ['Marketing digital', 'SEO/SEM', 'Community manager', 'Publicidad', 'Email marketing', 'Growth hacking'] },
  { id: 9, name: 'Ingeniería', slug: 'ingenieria', icon: '⚙️', color: '#78716C', subcategories: ['Mecatrónica', 'Electrónica', 'Automatización', 'Proyectos industriales', 'Diseño de producto', 'I+D', 'Control de calidad'] },
  { id: 10, name: 'Salud', slug: 'salud', icon: '🩺', color: '#DC2626', subcategories: ['Psicología clínica', 'Nutrición', 'Enfermería', 'Orientación familiar', 'Educación en salud', 'Medicina ocupacional'] },
];

// ---------------------------------------------------------------------------
// Vacantes (para /admin y cualquier pantalla que liste /api/jobs)
// ---------------------------------------------------------------------------
const EMPRESAS = ['Grupo Andes', 'Clínica Norte', 'Constructora Sierra', 'Logística Pacífico', 'Tecnologías Delta', 'Colegio Horizonte'];
// Perfiles con los nombres del catálogo de especialidades de arriba.
const PUESTOS: Array<[string, string, string]> = [
  ['Desarrollador Full Stack', 'Tecnología', 'Sr'],
  ['Ingeniera de Procesos', 'Ingeniería', 'Mid'],
  ['Enfermera Jefe de Piso', 'Salud', 'Sr'],
  ['Analista Contable', 'Finanzas', 'Jr'],
  ['Coordinadora Académica', 'Educación', 'Sr'],
  ['Diseñador UX/UI', 'Diseño Gráfico', 'Mid'],
  ['Residente de Obra', 'Arquitectura', 'Mid'],
  ['Jefe de Almacén', 'Administración de Oficina', 'Sr'],
  ['Científica de Datos', 'Tecnología', 'Lead'],
  ['Ingeniero Eléctrico', 'Ingeniería', 'Sr'],
  ['Psicóloga Organizacional', 'Salud', 'Mid'],
  ['Docente de Matemáticas', 'Educación', 'Jr'],
  ['Arquitecta de Proyecto', 'Arquitectura', 'Sr'],
];
const CIUDADES = ['Monterrey, NL', 'CDMX', 'Guadalajara, Jal.', 'Puebla, Pue.', 'Querétaro, Qro.', 'Mérida, Yuc.'];
const ESTADOS_VACANTE = ['active', 'active', 'active', 'paused', 'draft', 'active', 'closed', 'active'];

export const VACANTES = Array.from({ length: 26 }, (_, i) => {
  const [titulo, perfil, nivel] = PUESTOS[i % PUESTOS.length];
  const status = ESTADOS_VACANTE[i % ESTADOS_VACANTE.length];
  return {
    id: 101 + i,
    title: i >= PUESTOS.length ? `${titulo} II` : titulo,
    company: EMPRESAS[i % EMPRESAS.length],
    location: CIUDADES[i % CIUDADES.length],
    status,
    profile: i % 9 === 8 ? null : perfil,
    seniority: nivel,
    createdAt: hace(i * 1.3, i % 5),
    // La primera sigue en su ventana de edición de 4 h; las demás ya se procesan.
    editableUntil: i === 0 ? new Date(ahora + 2.5 * 3_600_000).toISOString() : i % 3 === 0 ? hace(i) : null,
    userId: 20 + (i % EMPRESAS.length),
    salary: `$${(28 + (i % 7) * 6)},000 – $${(36 + (i % 7) * 7)},000 MXN`,
    jobType: i % 4 === 3 ? 'Medio tiempo' : 'Tiempo completo',
    workMode: ['presential', 'hybrid', 'remote'][i % 3],
    description:
      'Buscamos a una persona que se integre al equipo para diseñar, ejecutar y mejorar los procesos del área, con trato directo con clientes internos y reporte a la dirección.',
    requirements: 'Licenciatura afín.\nTres años de experiencia en un puesto similar.\nInglés intermedio.',
    habilidades: 'Comunicación clara, orden, trabajo en equipo, orientación a resultados.',
    responsabilidades: 'Planear el trabajo semanal del área.\nDar seguimiento a indicadores.\nProponer mejoras.',
    resultadosEsperados: null,
    valoresActitudes: 'Honestidad, compromiso y ganas de aprender.',
    informacionAdicional: null,
    creditCost: 3,
    _count: { applications: [4, 0, 7, 2, 11, 1, 0, 5, 9, 3, 6, 0, 2][i % 13] },
  };
});

// ---------------------------------------------------------------------------
// Pipeline de una vacante
// ---------------------------------------------------------------------------
const NOMBRES = [
  'Mariana Pérez', 'Carlos Ibarra', 'Fernanda Ruiz', 'Jorge Castañeda', 'Valeria Núñez', 'Ricardo Solís',
  'Daniela Ortega', 'Emilio Vargas', 'Renata Aguilar', 'Hugo Salazar', 'Ximena Fuentes',
];
const ESTADOS_PIPELINE = [
  'pending', 'injected_by_admin', 'reviewing', 'sent_to_specialist', 'evaluating', 'sent_to_company',
  'company_interested', 'interviewed', 'rejected', 'accepted', 'discarded', 'archived',
];

/**
 * Habilidades que pide cada especialidad, como las guarda /create-job (un
 * array en JSON). Son las que b9-modal-perfil siembra con calificaciones: así
 * la ficha del pipeline enseña la evaluación de habilidades.
 */
const HABILIDADES_POR_PERFIL: Record<string, string[]> = {
  Tecnología: ['React', 'Node.js', 'PostgreSQL', 'Pruebas automatizadas', 'Comunicación con negocio'],
  Ingeniería: ['Lean manufacturing', 'Six Sigma', 'AutoCAD', 'Trabajo en equipo'],
  Arquitectura: ['AutoCAD', 'Liderazgo', 'Comunicación'],
  Finanzas: ['Excel avanzado', 'SQL', 'Comunicación'],
};
const HABILIDADES_COMUNES = ['Comunicación', 'Trabajo en equipo', 'Excel avanzado', 'Liderazgo'];
const habilidadesDe = (perfil: string | null) =>
  JSON.stringify((perfil && HABILIDADES_POR_PERFIL[perfil]) || HABILIDADES_COMUNES);

const UNIVERSIDADES = ['UANL', 'Tec de Monterrey', 'UNAM', 'Universidad de Guadalajara', 'BUAP', 'UDEM'];
const CARRERAS: Record<string, string> = {
  Tecnología: 'Ingeniería en Sistemas Computacionales',
  Ingeniería: 'Ingeniería Industrial',
  Salud: 'Licenciatura en Enfermería',
  Finanzas: 'Contaduría Pública',
  Educación: 'Licenciatura en Pedagogía',
  'Diseño Gráfico': 'Diseño Gráfico',
  Arquitectura: 'Arquitectura',
  'Administración de Oficina': 'Administración de Empresas',
};
/** Ciudad del candidato y sus coordenadas (para la distancia a la vacante). */
const DOMICILIOS: Array<[string, string, number, number]> = [
  ['Monterrey', 'Nuevo León', 25.6866, -100.3161],
  ['San Pedro Garza García', 'Nuevo León', 25.6573, -100.4026],
  ['Guadalupe', 'Nuevo León', 25.6775, -100.2597],
  ['Apodaca', 'Nuevo León', 25.7817, -100.1886],
  ['Saltillo', 'Coahuila', 25.4232, -101.0053],
];

/**
 * Perfil de candidato para la ficha (CandidateProfileModal), con la forma que
 * devuelve la API del pipeline: educación en JSON con los DOS vocabularios de
 * estatus que hay en producción, experiencias (una actual), documentos y
 * enlaces. Datos inventados.
 */
function perfilDeCandidato(jobId: number, i: number, nombre: string, email: string, perfil: string | null) {
  const [ciudad, estado, lat, lng] = DOMICILIOS[i % DOMICILIOS.length];
  const slug = email.split('@')[0];
  const universidad = UNIVERSIDADES[i % UNIVERSIDADES.length];
  const carrera = (perfil && CARRERAS[perfil]) || 'Administración de Empresas';
  const años = 2 + ((i * 3) % 9);
  const inicio = 2026 - años - 5;
  const educacion = [
    {
      id: 1,
      nivel: 'Licenciatura',
      institucion: universidad,
      carrera,
      añoInicio: inicio,
      añoFin: inicio + 4,
      // Vocabulario del registro (Titulado/Terminado) o de /profile (Completa).
      estatus: ['Titulado', 'Completa', 'Terminado'][i % 3],
    },
    ...(i % 2 === 0
      ? [
          {
            id: 2,
            nivel: 'Maestría',
            institucion: UNIVERSIDADES[(i + 2) % UNIVERSIDADES.length],
            carrera: 'Maestría en Administración',
            añoInicio: 2025,
            añoFin: null,
            estatus: i % 4 === 0 ? 'Cursando' : 'En curso',
          },
        ]
      : i % 5 === 3
        ? [{ id: 2, nivel: 'Diplomado', institucion: 'UDEM', carrera: 'Diplomado en Finanzas', añoInicio: 2021, añoFin: 2021, estatus: 'Trunca' }]
        : []),
  ];
  return {
    id: 5000 + (jobId % 100) * 20 + i,
    telefono: `81 ${String(1000 + i * 37).slice(0, 4)} ${String(5000 + i * 91).slice(0, 4)}`,
    ciudad,
    estado,
    latitude: lat,
    longitude: lng,
    ubicacionCercana: i % 3 === 0 ? 'Cerca de Av. Constitución' : undefined,
    añosExperiencia: años,
    profile: perfil ?? undefined,
    subcategory: perfil ? ESPECIALIDADES.find((e) => e.name === perfil)?.subcategories[i % 4] : undefined,
    seniority: ['Jr', 'Mid', 'Sr'][i % 3],
    universidad,
    carrera,
    nivelEstudios: 'Licenciatura',
    educacion: JSON.stringify(educacion),
    sexo: i % 2 === 0 ? 'F' : 'M',
    fechaNacimiento: new Date(1988 + (i % 10), i % 12, 3 + i).toISOString(),
    linkedinUrl: i % 3 !== 2 ? `https://www.linkedin.com/in/${slug.replace('.', '-')}` : undefined,
    portafolioUrl: perfil === 'Diseño Gráfico' || perfil === 'Arquitectura' ? `https://portafolio.example.com/${slug}` : undefined,
    cvUrl: `/uploads/cv-${slug}.pdf`,
    source: i % 4 === 0 ? 'referido' : 'manual',
    notas: i % 3 === 1 ? 'Pidió que no se contacte a su empleo actual hasta tener oferta.' : undefined,
    cartaPresentacion:
      i % 2 === 1
        ? 'Me interesa la vacante porque combina lo que más disfruto de mi trabajo actual con la posibilidad de crecer en un equipo más grande. Puedo incorporarme en dos semanas.'
        : undefined,
    experiences: [
      {
        id: 1,
        empresa: EMPRESAS[(i + 2) % EMPRESAS.length],
        puesto: `${perfil ?? 'Administración'} · puesto actual`,
        ubicacion: `${ciudad}, ${estado}`,
        fechaInicio: new Date(2023, i % 12, 1).toISOString(),
        esActual: true,
        descripcion: 'Responsable de los indicadores del área y de la mejora continua de sus procesos.',
      },
      {
        id: 2,
        empresa: EMPRESAS[(i + 4) % EMPRESAS.length],
        puesto: 'Analista',
        ubicacion: 'Monterrey, Nuevo León',
        fechaInicio: new Date(2019, (i + 3) % 12, 1).toISOString(),
        fechaFin: new Date(2022, (i + 7) % 12, 1).toISOString(),
        esActual: false,
      },
    ],
    documents:
      i % 3 === 0
        ? []
        : [
            { id: 1, name: 'Constancia de estudios', fileUrl: `/uploads/constancia-${slug}.pdf`, fileType: 'application/pdf', createdAt: hace(20) },
            ...(i % 2 === 0
              ? [{ id: 2, name: 'Certificación profesional', fileUrl: `/uploads/certificacion-${slug}.pdf`, fileType: 'application/pdf', createdAt: hace(12) }]
              : []),
          ],
  };
}

function pipeline(jobId: number) {
  const vacante = VACANTES.find((v) => v.id === jobId) ?? VACANTES[0];
  const applications = NOMBRES.map((nombre, i) => {
    const email = `${nombre.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(' ', '.')}@correo.mx`;
    return {
      id: jobId * 100 + i,
      candidateName: nombre,
      candidateEmail: email,
      candidatePhone: '81 1234 5678',
      cvUrl: null,
      coverLetter: null,
      status: ESTADOS_PIPELINE[i % ESTADOS_PIPELINE.length],
      notes: null,
      createdAt: hace(10 - i),
      updatedAt: hace(5 - i / 3),
      evaluationNotes: [],
      candidateProfile: perfilDeCandidato(jobId, i, nombre, email, vacante.profile),
    };
  });
  const cuenta = (s: string) => applications.filter((a) => a.status === s).length;
  const stages = {
    recruiter: {
      pending: cuenta('pending') + cuenta('injected_by_admin'),
      reviewing: cuenta('reviewing'),
      sent_to_specialist: cuenta('sent_to_specialist'),
      discarded: cuenta('discarded'),
    },
    specialist: { evaluating: cuenta('evaluating'), sent_to_company: cuenta('sent_to_company') },
    company: {
      interested: cuenta('company_interested'),
      interviewed: cuenta('interviewed'),
      rejected: cuenta('rejected'),
      accepted: cuenta('accepted'),
    },
  };
  const suma = (o: Record<string, number>) => Object.values(o).reduce((a, b) => a + b, 0);
  const archived = cuenta('archived');
  return {
    // Habilidades en JSON (como las guarda /create-job): la ficha las califica.
    job: { id: vacante.id, title: vacante.title, company: vacante.company, status: vacante.status, habilidades: habilidadesDe(vacante.profile) },
    total: applications.length,
    archived,
    stageTotals: {
      recruiter: suma(stages.recruiter),
      specialist: suma(stages.specialist),
      company: suma(stages.company),
      archived,
    },
    stages,
    applications,
    jobAssignment: { recruiterNotes: 'Perfil con buena comunicación; confirmar disponibilidad para viajar.', specialistNotes: null },
  };
}

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------
export const FIXTURES_BASE: Fixture[] = [
  {
    metodo: 'GET',
    patron: '/api/auth/me',
    respuesta: ({ rol }) => ({
      success: true,
      user: {
        ...USUARIOS[rol],
        role: rol,
        apellidoPaterno: null,
        apellidoMaterno: null,
        isActive: true,
        emailVerified: true,
        lastLogin: hace(0, 2),
        createdAt: hace(200),
      },
    }),
  },
  { metodo: 'POST', patron: '/api/auth/logout', respuesta: { success: true } },

  { metodo: 'GET', patron: '/api/notifications/count', respuesta: { success: true, count: NOTIFICACIONES.filter((n) => !n.read).length } },
  {
    metodo: 'GET',
    patron: '/api/notifications',
    respuesta: ({ url }) => {
      const filtro = url.searchParams.get('filter');
      const limit = Number(url.searchParams.get('limit') || 20);
      const lista = NOTIFICACIONES.filter((n) => (filtro === 'unread' ? !n.read : filtro === 'read' ? n.read : true));
      return {
        success: true,
        data: lista.slice(0, limit),
        unreadTotal: NOTIFICACIONES.filter((n) => !n.read).length,
        pagination: { page: 1, limit, total: lista.length, totalPages: 1, hasNext: false, hasPrev: false },
      };
    },
  },
  { metodo: 'PATCH', patron: '/api/notifications', respuesta: { success: true } },

  {
    // Misma forma que src/app/api/specialties/route.ts: subcategorías sólo con ?subcategories=true.
    metodo: 'GET',
    patron: '/api/specialties',
    respuesta: ({ url }) => {
      const conSub = url.searchParams.get('subcategories') === 'true';
      const data = ESPECIALIDADES.map(({ subcategories, ...resto }) => (conSub ? { ...resto, subcategories } : resto));
      return { success: true, data, names: ESPECIALIDADES.map((e) => e.name), count: ESPECIALIDADES.length };
    },
  },

  {
    metodo: 'GET',
    patron: '/api/admin/stats',
    respuesta: {
      success: true,
      data: {
        totalJobs: 148,
        activeJobs: 96,
        pausedJobs: 7,
        draftJobs: 21,
        closedJobs: 24,
        totalCandidates: 1284,
        totalApplications: 3417,
        pendingRequests: 5,
        totalCompanies: 37,
      },
    },
  },
  {
    metodo: 'GET',
    patron: '/api/jobs',
    respuesta: ({ url }) => {
      const status = url.searchParams.get('status');
      const lista = status ? VACANTES.filter((v) => v.status === status) : VACANTES;
      const limit = Number(url.searchParams.get('limit') || 20);
      // El total del servidor es mayor que lo que baja la tabla: así se ve el aviso
      // «La tabla carga las N vacantes más recientes de M».
      const total = status ? lista.length : 148;
      return {
        success: true,
        data: lista.slice(0, limit),
        pagination: { page: 1, limit, total, totalPages: Math.ceil(total / limit), hasNext: total > limit, hasPrev: false },
      };
    },
  },
  {
    metodo: 'GET',
    patron: '/api/admin/jobs/:id/pipeline',
    retraso: 350,
    respuesta: ({ params }) => ({ success: true, data: pipeline(Number(params.id)) }),
  },
];
