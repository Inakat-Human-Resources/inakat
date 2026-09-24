// RUTA: src/app/diseno/fixtures/b2-admin-candidatos.ts
//
// Bloque 2 · admin candidatos: el banco de candidatos (/admin/candidates), el
// formulario de alta y edición (CandidateForm) y la ficha con sus documentos.
// También sirve a cualquier pantalla que liste GET /api/admin/candidates
// (p. ej. Asignar candidatos: filtra por varios estados separados por comas).
//
// Formato en ./tipos.ts; ejemplos en ./base.ts y en docs/DISENO.md («Probar
// una página en /diseno/vista»). Van ANTES que las base: si repites un patrón,
// gana el tuyo.
//
// Las formas copian las de las rutas reales:
//   GET/POST  src/app/api/admin/candidates/route.ts
//   PUT/DELETE src/app/api/admin/candidates/[id]/route.ts
//   GET/POST/DELETE src/app/api/admin/candidates/[id]/documents/route.ts
//   POST      src/app/api/admin/candidates/[id]/reset-password/route.ts
//   POST      src/app/api/upload/route.ts
//   PUT       src/app/api/company-requests/[id]/route.ts (lo llama DetalleSolicitud de /admin/requests)
//
// El banco es un almacén en memoria: dar de alta, editar, borrar o añadir un
// documento se ve al recargar la lista (hasta que se recarga la página).
//
// Datos INVENTADOS (nombres ficticios, dominios .test / correo.mx): nunca
// copies aquí datos reales de producción.

import type { Fixture } from './tipos';
import { ESPECIALIDADES } from './base';

const ahora = Date.now();
const DIA = 86_400_000;
const hace = (dias: number) => new Date(ahora - dias * DIA).toISOString();
/** Medianoche UTC de una fecha (así guarda la API las fechas «sólo día»). */
const dia = (ano: number, mes: number, d = 1) => new Date(Date.UTC(ano, mes - 1, d)).toISOString();

// ---------------------------------------------------------------------------
// Materia prima
// ---------------------------------------------------------------------------
const NOMBRES_F = ['Mariana', 'Fernanda', 'Valeria', 'Daniela', 'Renata', 'Ximena', 'Andrea', 'Paulina', 'Regina', 'Lucía', 'Camila', 'Sofía'];
const NOMBRES_M = ['Carlos', 'Jorge', 'Ricardo', 'Emilio', 'Hugo', 'Diego', 'Santiago', 'Mauricio', 'Iván', 'Óscar', 'Rodrigo', 'Alejandro'];
const APELLIDOS = [
  'Pérez', 'Ibarra', 'Ruiz', 'Castañeda', 'Núñez', 'Solís', 'Ortega', 'Vargas', 'Aguilar', 'Salazar',
  'Fuentes', 'Garza', 'Treviño', 'Villarreal', 'Cantú', 'Elizondo', 'Montemayor', 'de la Fuente', 'Zambrano', 'Leal',
];
const UNIVERSIDADES = [
  'UANL', 'Tecnológico de Monterrey', 'UNAM', 'Universidad de Guadalajara', 'IPN', 'UDEM', 'BUAP', 'Universidad Iberoamericana', 'ITESO', 'UAQ',
];
const CARRERAS_POR_PERFIL: Record<string, string[]> = {
  'Tecnología': ['Ingeniería en Sistemas Computacionales', 'Ingeniería en Software', 'Ciencia de Datos'],
  'Ingeniería': ['Ingeniería Industrial', 'Ingeniería Mecatrónica', 'Ingeniería Eléctrica'],
  'Salud': ['Enfermería', 'Psicología', 'Nutrición'],
  'Finanzas': ['Contaduría Pública', 'Finanzas', 'Economía'],
  'Educación': ['Pedagogía', 'Ciencias de la Educación', 'Lingüística Aplicada'],
  'Diseño Gráfico': ['Diseño Gráfico', 'Diseño Industrial', 'Artes Digitales'],
  'Arquitectura': ['Arquitectura', 'Urbanismo', 'Diseño de Interiores'],
  'Marketing': ['Mercadotecnia', 'Comunicación', 'Negocios Internacionales'],
  'Administración de Oficina': ['Administración de Empresas', 'Recursos Humanos', 'Relaciones Industriales'],
  'Producción Audiovisual': ['Comunicación Audiovisual', 'Cine', 'Animación Digital'],
};
const PERFILES = ESPECIALIDADES.map((e) => e.name);
const SUBCATEGORIAS: Record<string, string[]> = Object.fromEntries(ESPECIALIDADES.map((e) => [e.name, e.subcategories]));
const NIVELES = ['Practicante', 'Jr', 'Middle', 'Sr', 'Director'];
const EMPRESAS_PREVIAS = [
  'Grupo Andes', 'Constructora Sierra', 'Logística Pacífico', 'Tecnologías Delta', 'Clínica Norte', 'Colegio Horizonte',
  'Aceros del Bajío', 'Farmacias Cumbre', 'Consultora Meridiano', 'Banco Regional del Norte',
];
const PUESTOS_POR_PERFIL: Record<string, string[]> = {
  'Tecnología': ['Desarrollador Backend', 'Ingeniera de Datos', 'Líder Técnico'],
  'Ingeniería': ['Ingeniero de Procesos', 'Supervisora de Mantenimiento', 'Ingeniero de Calidad'],
  'Salud': ['Enfermera General', 'Psicóloga Clínica', 'Nutrióloga'],
  'Finanzas': ['Analista Contable', 'Auxiliar de Tesorería', 'Contralora'],
  'Educación': ['Docente de Primaria', 'Coordinadora Académica', 'Diseñador Instruccional'],
  'Diseño Gráfico': ['Diseñadora UX/UI', 'Diseñador Editorial', 'Directora de Arte'],
  'Arquitectura': ['Residente de Obra', 'Proyectista BIM', 'Arquitecta de Proyecto'],
  'Marketing': ['Community Manager', 'Especialista SEO/SEM', 'Gerente de Marca'],
  'Administración de Oficina': ['Asistente de Dirección', 'Reclutadora', 'Recepcionista'],
  'Producción Audiovisual': ['Editor de Video', 'Fotógrafa', 'Productor de Contenido'],
};
const ESTADOS = ['available', 'available', 'in_process', 'available', 'hired', 'available', 'in_process', 'inactive', 'available', 'in_process'];
const FUENTES = ['manual', 'linkedin', 'occ', 'linkedin', 'referido', 'registro', 'manual', 'linkedin'];
const ESTATUS_EDU = ['Titulado', 'Terminado', 'Cursando', 'Titulado', 'Trunco', 'Completa', 'En curso'];
const NOTAS = [
  null,
  'Buena comunicación en la entrevista telefónica. Disponible para empezar en dos semanas.',
  null,
  'Prefiere trabajo híbrido. Pretensión salarial por encima del rango de la vacante; revisar con la empresa antes de enviarlo.',
  null,
  'Referido por una colaboradora de Grupo Andes. Tiene certificación vigente y experiencia coordinando equipos de hasta 12 personas en planta; pidió que no se le contacte en horario laboral.',
  null,
];

const sinAcentos = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const slug = (s: string) => sinAcentos(s).replace(/[^a-z0-9]+/g, '.').replace(/^\.|\.$/g, '');

/** Edad a partir de la fecha de nacimiento (como la calcula la API). */
function edadDe(fechaNacimiento: string | null): number | null {
  if (!fechaNacimiento) return null;
  const hoy = new Date();
  const nac = new Date(fechaNacimiento);
  let edad = hoy.getFullYear() - nac.getFullYear();
  const m = hoy.getMonth() - nac.getMonth();
  if (m < 0 || (m === 0 && hoy.getDate() < nac.getDate())) edad--;
  return edad;
}

// ---------------------------------------------------------------------------
// Tipos del almacén (la forma de prisma.candidate + include)
// ---------------------------------------------------------------------------
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

interface DocumentoFx {
  id: number;
  candidateId: number;
  name: string;
  fileUrl: string;
  fileType: string | null;
  createdAt: string;
  updatedAt: string;
}

interface CandidatoFx {
  id: number;
  nombre: string;
  apellidoPaterno: string;
  apellidoMaterno: string | null;
  email: string;
  telefono: string | null;
  sexo: string | null;
  fechaNacimiento: string | null;
  ciudad: string | null;
  estado: string | null;
  ubicacionCercana: string | null;
  latitude: number | null;
  longitude: number | null;
  universidad: string | null;
  carrera: string | null;
  nivelEstudios: string | null;
  educacion: string | null;
  añosExperiencia: number;
  profile: string | null;
  subcategory: string | null;
  seniority: string | null;
  cvUrl: string | null;
  portafolioUrl: string | null;
  linkedinUrl: string | null;
  fotoUrl: string | null;
  source: string;
  notas: string | null;
  cartaPresentacion: string | null;
  status: string;
  createdAt: string;
  updatedAt: string;
  userId: number | null;
  experiences: ExperienciaFx[];
  documents: DocumentoFx[];
}

let siguienteId = 1;
let siguienteDoc = 900;
let siguienteExp = 5000;
let siguienteUsuario = 700;

const CIUDADES: Array<[string, string]> = [
  ['Monterrey', 'Nuevo León'], ['San Pedro Garza García', 'Nuevo León'], ['Guadalajara', 'Jalisco'], ['Ciudad de México', 'CDMX'],
  ['Puebla', 'Puebla'], ['Querétaro', 'Querétaro'], ['Morelia', 'Michoacán'], ['Mérida', 'Yucatán'],
];

function crearCandidato(i: number): CandidatoFx {
  const id = siguienteId++;
  const mujer = i % 2 === 0;
  const nombre = (mujer ? NOMBRES_F : NOMBRES_M)[(i * 5) % 12];
  const apellidoPaterno = APELLIDOS[(i * 3) % APELLIDOS.length];
  const apellidoMaterno = i % 6 === 5 ? null : APELLIDOS[(i * 7 + 4) % APELLIDOS.length];
  const perfil = i % 11 === 10 ? null : PERFILES[i % PERFILES.length];
  const carreras = perfil ? CARRERAS_POR_PERFIL[perfil] ?? ['Administración'] : ['Administración de Empresas'];
  const carrera = carreras[i % carreras.length];
  const universidad = UNIVERSIDADES[(i * 3) % UNIVERSIDADES.length];
  const nacimiento = i % 9 === 4 ? null : dia(1975 + ((i * 7) % 27), 1 + (i % 12), 1 + ((i * 3) % 27));
  const [ciudad, estadoMx] = CIUDADES[i % CIUDADES.length];
  const creado = hace(i * 2.3 + 0.2);

  // Educación: la mayoría con JSON (uno o dos estudios), algunos sólo con los
  // campos viejos (educacion null) y algunos sin estudios.
  const tipoEdu = i % 8;
  const estudios =
    tipoEdu === 7
      ? []
      : [
          {
            id: 1,
            nivel: i % 5 === 0 ? 'Técnico' : 'Licenciatura',
            institucion: universidad,
            carrera,
            añoInicio: 2008 + (i % 10),
            añoFin: ESTATUS_EDU[i % ESTATUS_EDU.length] === 'Cursando' ? null : 2012 + (i % 10),
            estatus: ESTATUS_EDU[i % ESTATUS_EDU.length],
          },
          ...(i % 4 === 1
            ? [
                {
                  id: 2,
                  nivel: 'Posgrado',
                  institucion: UNIVERSIDADES[(i * 3 + 1) % UNIVERSIDADES.length],
                  carrera: `Maestría en ${perfil === 'Finanzas' ? 'Finanzas Corporativas' : perfil === 'Tecnología' ? 'Ciencias Computacionales' : 'Administración'}`,
                  añoInicio: 2019,
                  añoFin: i % 8 === 1 ? null : 2021,
                  estatus: i % 8 === 1 ? 'Cursando' : 'Titulado',
                },
              ]
            : []),
        ];
  const soloLegado = tipoEdu === 6;

  // Experiencias: de 0 a 3, la más reciente puede ser la actual.
  const numExp = i % 4;
  const puestos = perfil ? PUESTOS_POR_PERFIL[perfil] ?? ['Auxiliar Administrativo'] : ['Auxiliar Administrativo'];
  const experiences: ExperienciaFx[] = Array.from({ length: numExp }, (_, k) => {
    const actual = k === 0 && i % 3 !== 2;
    const inicio = dia(2024 - k * 3 - (i % 3), 1 + ((i + k) % 12));
    return {
      id: siguienteExp++,
      candidateId: id,
      empresa: EMPRESAS_PREVIAS[(i + k * 3) % EMPRESAS_PREVIAS.length],
      puesto: puestos[(i + k) % puestos.length],
      ubicacion: `${ciudad}, ${estadoMx}`,
      fechaInicio: inicio,
      fechaFin: actual ? null : dia(2024 - k * 3 - (i % 3) + 2, 1 + ((i + k + 5) % 12)),
      esActual: actual,
      descripcion:
        k === 0
          ? 'Responsable del seguimiento de indicadores semanales, la coordinación con otras áreas y la mejora continua de los procesos del equipo.'
          : null,
      createdAt: creado,
      updatedAt: creado,
    };
  });
  const añosExperiencia = numExp === 0 ? i % 3 : Math.min(25, 1 + numExp * 2 + (i % 5));

  // Documentos: de 0 a 3.
  const numDocs = i % 5 === 0 ? 3 : i % 3 === 0 ? 1 : 0;
  const nombresDoc = ['Título profesional', 'Cédula profesional', 'Carta de recomendación de Grupo Andes'];
  const documents: DocumentoFx[] = Array.from({ length: numDocs }, (_, k) => ({
    id: siguienteDoc++,
    candidateId: id,
    name: nombresDoc[k],
    fileUrl: `https://archivos.inakat.test/candidatos/${id}/${slug(nombresDoc[k])}.pdf`,
    fileType: 'application/pdf',
    createdAt: hace(i * 2.3 - k * 0.1),
    updatedAt: hace(i * 2.3 - k * 0.1),
  }));

  const email = `${slug(nombre)}.${slug(apellidoPaterno)}${i > 23 ? i : ''}@correo.mx`;
  const linkedin =
    i % 3 === 0
      ? `https://www.linkedin.com/in/${slug(nombre)}-${slug(apellidoPaterno)}-${1000 + i}`
      : i % 7 === 1
        ? `linkedin.com/in/${slug(nombre)}${slug(apellidoPaterno)}` // sin protocolo: la página lo completa
        : null;

  return {
    id,
    nombre,
    apellidoPaterno,
    apellidoMaterno,
    email,
    telefono: i % 5 === 3 ? null : `81 ${String(1000 + ((i * 137) % 9000)).padStart(4, '0')} ${String(1000 + ((i * 311) % 9000)).padStart(4, '0')}`,
    sexo: i % 13 === 12 ? null : i % 17 === 16 ? 'Otro' : mujer ? 'F' : 'M',
    fechaNacimiento: nacimiento,
    ciudad,
    estado: estadoMx,
    ubicacionCercana: null,
    latitude: null,
    longitude: null,
    universidad: estudios[0]?.institucion ?? null,
    carrera: estudios[0]?.carrera ?? null,
    nivelEstudios: estudios[0]?.nivel ?? null,
    educacion: estudios.length > 0 && !soloLegado ? JSON.stringify(estudios) : null,
    añosExperiencia,
    profile: perfil,
    subcategory: perfil ? SUBCATEGORIAS[perfil]?.[i % (SUBCATEGORIAS[perfil]?.length || 1)] ?? null : null,
    seniority: NIVELES[(i * 2) % NIVELES.length],
    cvUrl: i % 4 === 3 ? null : `https://archivos.inakat.test/cv/${slug(nombre)}-${slug(apellidoPaterno)}-${id}.pdf`,
    portafolioUrl: perfil === 'Diseño Gráfico' || perfil === 'Arquitectura' ? `https://portafolio.test/${slug(nombre)}${id}` : null,
    linkedinUrl: linkedin,
    fotoUrl: null,
    source: FUENTES[i % FUENTES.length],
    notas: NOTAS[i % NOTAS.length],
    cartaPresentacion:
      i % 4 === 0
        ? `Soy ${carrera.toLowerCase().startsWith('ingenier') ? 'ingeniera/o' : 'profesional'} con experiencia en ${perfil ?? 'administración'}. Me interesa un puesto donde pueda aportar orden, seguimiento y trato cercano con el equipo.`
        : null,
    status: ESTADOS[i % ESTADOS.length],
    createdAt: creado,
    updatedAt: creado,
    userId: i % 5 === 1 ? 600 + i : null,
    experiences,
    documents,
  };
}

// 64 candidatos: tres páginas de 30 (la API pagina a 30 por defecto).
const BANCO: CandidatoFx[] = Array.from({ length: 64 }, (_, i) => crearCandidato(i));

// Un par de casos al límite para ver la presentación: nombre largo y datos mínimos.
BANCO[2] = {
  ...BANCO[2],
  nombre: 'María Guadalupe del Socorro',
  apellidoPaterno: 'Villarreal',
  apellidoMaterno: 'Montemayor de la Fuente',
  email: 'maria.guadalupe.villarreal.montemayor@correo.mx',
};
BANCO[5] = {
  ...BANCO[5],
  telefono: null,
  sexo: null,
  fechaNacimiento: null,
  universidad: null,
  carrera: null,
  nivelEstudios: null,
  educacion: null,
  profile: null,
  subcategory: null,
  seniority: null,
  cvUrl: null,
  linkedinUrl: null,
  notas: null,
  experiences: [],
  documents: [],
  añosExperiencia: 0,
};

// Postulaciones vivas por correo (lo que añade la API con un groupBy).
const activas = (c: CandidatoFx) => (c.status === 'in_process' ? 1 + (c.id % 3) : c.id % 7 === 0 ? 1 : 0);

const conEdad = (c: CandidatoFx) => ({ ...c, edad: edadDe(c.fechaNacimiento), activeApplications: activas(c) });

const numero = (v: string | null) => {
  if (v == null || v === '') return undefined;
  const n = Number.parseInt(v, 10);
  return Number.isFinite(n) && n >= 0 ? n : undefined;
};

/** GET /api/admin/candidates: mismos filtros, orden y paginación que la ruta. */
function listar(url: URL) {
  const q = url.searchParams;
  const search = q.get('search') || '';
  const tokens = search.trim().split(/\s+/).filter(Boolean).map(sinAcentos);
  const estados = (q.get('status') || '').split(',').map((s) => s.trim()).filter(Boolean);
  const universidad = sinAcentos(q.get('universidad') || '');
  const minExp = numero(q.get('minExperience'));
  const maxExp = numero(q.get('maxExperience'));
  const minEdad = numero(q.get('minAge'));
  const maxEdad = numero(q.get('maxAge'));

  const lista = BANCO.filter((c) => {
    if (
      tokens.length &&
      !tokens.every((t) =>
        [c.nombre, c.apellidoPaterno, c.apellidoMaterno, c.email, c.carrera].some((campo) => campo && sinAcentos(campo).includes(t))
      )
    )
      return false;
    if (q.get('sexo') && c.sexo !== q.get('sexo')) return false;
    if (universidad && !(c.universidad && sinAcentos(c.universidad).includes(universidad))) return false;
    if (q.get('profile') && c.profile !== q.get('profile')) return false;
    if (q.get('seniority') && c.seniority !== q.get('seniority')) return false;
    if (q.get('subcategory') && c.subcategory !== q.get('subcategory')) return false;
    if (estados.length && !estados.includes(c.status)) return false;
    if (q.get('source') && c.source !== q.get('source')) return false;
    if (minExp !== undefined && c.añosExperiencia < minExp) return false;
    if (maxExp !== undefined && c.añosExperiencia > maxExp) return false;
    if (minEdad !== undefined || maxEdad !== undefined) {
      const edad = edadDe(c.fechaNacimiento);
      if (edad === null) return false;
      if (minEdad !== undefined && edad < minEdad) return false;
      if (maxEdad !== undefined && edad > maxEdad) return false;
    }
    return true;
  }).sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  const page = Math.max(1, numero(q.get('page')) ?? 1);
  const limit = Math.min(100, Math.max(1, numero(q.get('limit')) ?? 30));
  const total = lista.length;
  const totalPages = Math.ceil(total / limit);
  const data = lista.slice((page - 1) * limit, page * limit).map(conEdad);
  return {
    success: true,
    data,
    pagination: { page, limit, total, totalPages, hasNext: page < totalPages, hasPrev: page > 1 },
    count: data.length,
  };
}

const porId = (id: string | number) => BANCO.find((c) => c.id === Number(id));

/** Convierte el cuerpo del formulario (fechas 'AAAA-MM-DD', educación en array) a la forma guardada. */
function aplicarCuerpo(base: CandidatoFx, cuerpo: Record<string, any>): CandidatoFx {
  const educacion = Array.isArray(cuerpo.educacion) ? cuerpo.educacion : [];
  const experiences: ExperienciaFx[] = Array.isArray(cuerpo.experiences)
    ? cuerpo.experiences.map((exp: any) => ({
        id: exp.id ?? siguienteExp++,
        candidateId: base.id,
        empresa: exp.empresa,
        puesto: exp.puesto,
        ubicacion: exp.ubicacion || null,
        fechaInicio: new Date(exp.fechaInicio).toISOString(),
        fechaFin: exp.fechaFin ? new Date(exp.fechaFin).toISOString() : null,
        esActual: Boolean(exp.esActual),
        descripcion: exp.descripcion || null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }))
    : base.experiences;
  const documents: DocumentoFx[] = Array.isArray(cuerpo.documents)
    ? cuerpo.documents.map((doc: any) => ({
        id: doc.id ?? siguienteDoc++,
        candidateId: base.id,
        name: doc.name,
        fileUrl: doc.fileUrl,
        fileType: doc.fileType || null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }))
    : base.documents;
  return {
    ...base,
    nombre: cuerpo.nombre ?? base.nombre,
    apellidoPaterno: cuerpo.apellidoPaterno ?? base.apellidoPaterno,
    apellidoMaterno: cuerpo.apellidoMaterno ?? null,
    email: typeof cuerpo.email === 'string' ? cuerpo.email.toLowerCase() : base.email,
    telefono: cuerpo.telefono ?? null,
    sexo: cuerpo.sexo ?? null,
    fechaNacimiento: cuerpo.fechaNacimiento ? new Date(cuerpo.fechaNacimiento).toISOString() : null,
    educacion: educacion.length > 0 ? JSON.stringify(educacion) : null,
    universidad: educacion[0]?.institucion || null,
    carrera: educacion[0]?.carrera || null,
    nivelEstudios: educacion[0]?.nivel || null,
    profile: cuerpo.profile ?? null,
    seniority: cuerpo.seniority ?? null,
    cvUrl: cuerpo.cvUrl ?? null,
    portafolioUrl: cuerpo.portafolioUrl ?? null,
    linkedinUrl: cuerpo.linkedinUrl ?? null,
    fotoUrl: cuerpo.fotoUrl ?? null,
    source: cuerpo.source || base.source,
    notas: cuerpo.notas ?? null,
    cartaPresentacion: cuerpo.cartaPresentacion ?? null,
    experiences,
    documents,
    updatedAt: new Date().toISOString(),
  };
}

const conUsuario = (c: CandidatoFx) => ({
  ...c,
  user: c.userId ? { id: c.userId, email: c.email, role: 'candidate' } : null,
});

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------
export const fixtures: Fixture[] = [
  // Lista del banco (y conteos: la página pide limit=1 por estado).
  // RegExp (se compara con ruta + query) que deja pasar la búsqueda de
  // /admin/assign-candidates (status=available,in_process): ésa la contesta
  // b3-admin-operacion, que va después en el índice y trae activeApplications.
  {
    metodo: 'GET',
    patron: /^\/api\/admin\/candidates(?:\?(?!.*status=available(?:%2C|,)in_process).*)?$/,
    retraso: 300,
    respuesta: ({ url }) => listar(url),
  },

  // Alta. Correo repetido → 409 con existingCandidateId (el aviso con enlaces).
  // Prueba con mariana.perez@correo.mx para verlo.
  {
    metodo: 'POST',
    patron: '/api/admin/candidates',
    retraso: 500,
    respuesta: ({ cuerpo }) => {
      const datos = (cuerpo ?? {}) as Record<string, any>;
      const email = String(datos.email || '').toLowerCase();
      const existente = BANCO.find((c) => c.email === email);
      if (existente) {
        return new Response(
          JSON.stringify({
            success: false,
            error: `Ya existe un candidato con ese email (ID: ${existente.id}). Puedes encontrarlo en el Banco de Candidatos y asignarlo a una vacante desde "Asignar Candidatos".`,
            existingCandidateId: existente.id,
            suggestion: 'Ir a /admin/candidates para buscar al candidato o /admin/assign-candidates para asignarlo a una vacante.',
          }),
          { status: 409, headers: { 'Content-Type': 'application/json' } }
        );
      }
      const creado = new Date().toISOString();
      const nuevo = aplicarCuerpo(
        {
          ...crearCandidato(BANCO.length),
          experiences: [],
          documents: [],
          status: 'available',
          createdAt: creado,
          userId: datos.password ? siguienteUsuario++ : null,
        },
        datos
      );
      BANCO.unshift(nuevo);
      const accountCreated = Boolean(datos.password);
      return new Response(
        JSON.stringify({
          success: true,
          message: accountCreated
            ? 'Candidato creado exitosamente con cuenta de acceso'
            : 'Candidato creado exitosamente (sin cuenta de acceso)',
          accountCreated,
          data: conUsuario(nuevo),
        }),
        { status: 201, headers: { 'Content-Type': 'application/json' } }
      );
    },
  },

  // Documentos de un candidato (la ficha).
  {
    metodo: 'GET',
    patron: '/api/admin/candidates/:id/documents',
    retraso: 250,
    respuesta: ({ params }) => {
      const c = porId(params.id);
      if (!c) return new Response(JSON.stringify({ success: false, error: 'Candidato no encontrado' }), { status: 404 });
      return { success: true, data: [...c.documents].sort((a, b) => b.createdAt.localeCompare(a.createdAt)) };
    },
  },
  {
    metodo: 'POST',
    patron: '/api/admin/candidates/:id/documents',
    retraso: 300,
    respuesta: ({ params, cuerpo }) => {
      const c = porId(params.id);
      const datos = (cuerpo ?? {}) as Record<string, any>;
      if (!c) return new Response(JSON.stringify({ success: false, error: 'Candidato no encontrado' }), { status: 404 });
      const creado = new Date().toISOString();
      const documento: DocumentoFx = {
        id: siguienteDoc++,
        candidateId: c.id,
        name: String(datos.name || '').trim(),
        fileUrl: datos.fileUrl,
        fileType: datos.fileType || null,
        createdAt: creado,
        updatedAt: creado,
      };
      c.documents.unshift(documento);
      return new Response(
        JSON.stringify({ success: true, message: 'Documento agregado exitosamente', data: documento }),
        { status: 201, headers: { 'Content-Type': 'application/json' } }
      );
    },
  },
  {
    metodo: 'DELETE',
    patron: '/api/admin/candidates/:id/documents',
    retraso: 250,
    respuesta: ({ params, url }) => {
      const c = porId(params.id);
      const docId = Number(url.searchParams.get('documentId'));
      if (c) c.documents = c.documents.filter((d) => d.id !== docId);
      return { success: true, message: 'Documento eliminado exitosamente' };
    },
  },

  // Cuenta de acceso: resetear contraseña o crear la cuenta.
  {
    metodo: 'POST',
    patron: '/api/admin/candidates/:id/reset-password',
    retraso: 400,
    respuesta: ({ params }) => {
      const c = porId(params.id);
      if (!c) return new Response(JSON.stringify({ success: false, error: 'Candidato no encontrado' }), { status: 404 });
      if (c.userId) return { success: true, message: 'Contraseña actualizada exitosamente', userId: c.userId };
      c.userId = siguienteUsuario++;
      return { success: true, message: 'Cuenta de acceso creada exitosamente', userId: c.userId };
    },
  },

  // Editar y borrar.
  {
    metodo: 'PUT',
    patron: '/api/admin/candidates/:id',
    retraso: 500,
    respuesta: ({ params, cuerpo }) => {
      const i = BANCO.findIndex((c) => c.id === Number(params.id));
      if (i < 0) return new Response(JSON.stringify({ success: false, error: 'Candidato no encontrado' }), { status: 404 });
      BANCO[i] = aplicarCuerpo(BANCO[i], (cuerpo ?? {}) as Record<string, any>);
      return { success: true, message: 'Candidato actualizado exitosamente', data: conUsuario(BANCO[i]) };
    },
  },
  {
    metodo: 'DELETE',
    patron: '/api/admin/candidates/:id',
    retraso: 350,
    respuesta: ({ params }) => {
      const i = BANCO.findIndex((c) => c.id === Number(params.id));
      const conCuenta = i >= 0 && Boolean(BANCO[i].userId);
      if (i >= 0) BANCO.splice(i, 1);
      return {
        success: true,
        message: conCuenta
          ? 'Candidato eliminado exitosamente y su cuenta de acceso fue desactivada'
          : 'Candidato eliminado exitosamente',
        accountDeactivated: conCuenta,
      };
    },
  },

  // Subida de archivos (foto de perfil y documentos). Devuelve una URL http(s)
  // inventada: en el banco la vista previa de una foto no carga y el
  // formulario muestra el icono en su lugar.
  {
    metodo: 'POST',
    patron: '/api/upload',
    retraso: 700,
    respuesta: ({ cuerpo }) => {
      const archivo = (cuerpo as { file?: File } | undefined)?.file;
      const nombre = archivo && typeof archivo === 'object' && 'name' in archivo ? archivo.name : 'archivo.pdf';
      return {
        success: true,
        url: `https://archivos.inakat.test/subidas/${Date.now()}-${slug(nombre.replace(/\.[^.]+$/, ''))}${(nombre.match(/\.[^.]+$/) || ['.pdf'])[0].toLowerCase()}`,
        filename: nombre,
      };
    },
  },

  // Guardar la edición de una solicitud de empresa (DetalleSolicitud de /admin/requests).
  {
    metodo: 'PUT',
    patron: '/api/company-requests/:id',
    retraso: 400,
    respuesta: ({ params, cuerpo }) => ({
      success: true,
      message: 'Solicitud de empresa actualizada exitosamente',
      data: { id: Number(params.id), ...((cuerpo ?? {}) as Record<string, unknown>), updatedAt: new Date().toISOString() },
    }),
  },
];
