// RUTA: src/app/diseno/fixtures/b1-admin-core.ts
//
// Bloque 1 · admin núcleo: /admin/users, /admin/requests y
// /admin/contact-messages. Formato en ./tipos.ts; ejemplos en ./base.ts y en
// docs/DISENO.md («Probar una página en /diseno/vista»). Van ANTES que las
// base: si repites un patrón, gana el tuyo.
//
// Las formas copian las rutas reales:
// - src/app/api/admin/users/route.ts (GET paginado de 30 con `count`; POST 201;
//   PUT y DELETE con `activeAssignments`; sus mensajes de error);
// - src/app/api/company-requests/route.ts (GET { success, data } sin paginar) y
//   src/app/api/company-requests/[id]/route.ts (PATCH de estado, PUT de datos);
// - src/app/api/admin/contact-messages/route.ts (GET paginado de 20, desc).
//
// Las escrituras cambian una copia en memoria: aprobar, desactivar o editar se
// ve al recargar la lista, como en la app de verdad (se reinicia al recargar
// la pestaña). Datos inventados y verosímiles: NUNCA datos reales.

import type { Fixture } from './tipos';
import { ESPECIALIDADES, USUARIOS } from './base';

const ahora = Date.now();
const DIA = 86_400_000;
const HORA = 3_600_000;
const hace = (dias: number, horas = 0) => new Date(ahora - dias * DIA - horas * HORA).toISOString();

/** Respuesta JSON con código HTTP propio (para los errores calculados). */
const respuestaJson = (datos: unknown, estado: number) =>
  new Response(JSON.stringify(datos), { status: estado, headers: { 'Content-Type': 'application/json' } });

/** Bloque `pagination` de buildPaginatedResponse (src/lib/pagination.ts). */
function paginar<T>(lista: T[], url: URL, porDefecto: number, maximo = 100) {
  const entero = (v: string | null, respaldo: number) => {
    const n = Number.parseInt(v ?? '', 10);
    return Number.isFinite(n) ? n : respaldo;
  };
  const page = Math.max(1, entero(url.searchParams.get('page'), 1));
  const limit = Math.min(Math.max(1, entero(url.searchParams.get('limit'), porDefecto)), maximo);
  const total = lista.length;
  const totalPages = Math.ceil(total / limit);
  return {
    data: lista.slice((page - 1) * limit, page * limit),
    pagination: { page, limit, total, totalPages, hasNext: page < totalPages, hasPrev: page > 1 },
  };
}

const sinAcentos = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

// ===========================================================================
// /admin/users — equipo interno (admin, reclutadores, especialistas)
// ===========================================================================
interface UsuarioEquipo {
  id: number;
  email: string;
  nombre: string;
  apellidoPaterno: string | null;
  apellidoMaterno: string | null;
  role: 'admin' | 'recruiter' | 'specialist';
  specialty: string | null;
  isActive: boolean;
  lastLogin: string | null;
  createdAt: string;
  _count: { recruiterAssignments: number; specialistAssignments: number };
}

const NOMBRES_EQUIPO: Array<[string, string, string | null]> = [
  ['Mónica', 'Garza', 'Treviño'],
  ['Alejandro', 'Villarreal', 'Cantú'],
  ['Brenda', 'Olvera', null],
  ['Rodrigo', 'Esquivel', 'Pámanes'],
  ['Itzel', 'Cervantes', 'Luna'],
  ['Gustavo', 'Mireles', 'Ochoa'],
  ['Karla', 'Domínguez', 'Salinas'],
  ['Óscar', 'Benavides', null],
  ['Natalia', 'Quiroga', 'Elizondo'],
  ['Sergio', 'Lozano', 'Madero'],
  ['Adriana', 'Ponce', 'de León Arizpe'],
  ['Martín', 'Zambrano', 'Rocha'],
  ['Regina', 'Aldape', 'Sáenz'],
  ['Emiliano', 'Montemayor', 'Guerra'],
  ['Luisa Fernanda', 'Hinojosa', 'Tamez'],
  ['Pablo', 'Iturbide', 'Correa'],
  ['Mariela', 'Cárdenas', 'Robles'],
  ['Joaquín', 'Del Bosque', null],
  ['Valentina', 'Arredondo', 'Pérez'],
  ['Héctor', 'Galván', 'Leal'],
  ['Silvia', 'Rentería', 'Marroquín'],
  ['Andrés', 'Kuri', 'Nahle'],
  ['Paulina', 'Santos', 'Ibarra'],
  ['Tomás', 'Echeverría', 'Solís'],
  ['Carolina', 'Fuentes', 'Garza'],
  ['Iván', 'Morales', 'Téllez'],
  ['Daniela', 'Yáñez', null],
  ['Ernesto', 'Chapa', 'Villanueva'],
  ['Lorena', 'Bazán', 'Oyervides'],
  ['Fabián', 'Quintanilla', 'Ruiz'],
];

const correoDe = (nombre: string, apellido: string | null) =>
  `${sinAcentos(nombre.split(' ')[0])}.${sinAcentos(apellido ?? 'inakat').replace(/\s+/g, '')}@inakat.com`;

function crearEquipo(): UsuarioEquipo[] {
  const lista: UsuarioEquipo[] = [];
  // La sesión del banco (admin id 1) es una fila más: así se ve «Activo (tú)».
  const [nombreAdmin, apellidoAdmin] = USUARIOS.admin.nombre.split(' ');
  lista.push({
    id: USUARIOS.admin.id,
    email: USUARIOS.admin.email,
    nombre: nombreAdmin,
    apellidoPaterno: apellidoAdmin,
    apellidoMaterno: 'Salazar',
    role: 'admin',
    specialty: null,
    isActive: true,
    lastLogin: hace(0, 2),
    createdAt: hace(420),
    _count: { recruiterAssignments: 0, specialistAssignments: 0 },
  });
  // La reclutadora y el especialista de la sesión de sus roles.
  const [nombreRec, apellidoRec] = USUARIOS.recruiter.nombre.split(' ');
  lista.push({
    id: USUARIOS.recruiter.id,
    email: USUARIOS.recruiter.email,
    nombre: nombreRec,
    apellidoPaterno: apellidoRec,
    apellidoMaterno: 'Arriaga',
    role: 'recruiter',
    specialty: null,
    isActive: true,
    lastLogin: hace(0, 5),
    createdAt: hace(310),
    _count: { recruiterAssignments: 9, specialistAssignments: 0 },
  });
  const [nombreEsp, apellidoEsp] = USUARIOS.specialist.nombre.split(' ');
  lista.push({
    id: USUARIOS.specialist.id,
    email: USUARIOS.specialist.email,
    nombre: nombreEsp,
    apellidoPaterno: apellidoEsp,
    apellidoMaterno: 'Robles',
    role: 'specialist',
    specialty: 'Tecnología',
    isActive: true,
    lastLogin: hace(1, 3),
    createdAt: hace(300),
    _count: { recruiterAssignments: 0, specialistAssignments: 6 },
  });

  NOMBRES_EQUIPO.forEach(([nombre, paterno, materno], i) => {
    // 2 admins más, luego reclutadores y especialistas alternados.
    const role: UsuarioEquipo['role'] = i < 2 ? 'admin' : i % 2 === 0 ? 'recruiter' : 'specialist';
    const inactivo = i === 7 || i === 16 || i === 23;
    const especialidad =
      role !== 'specialist'
        ? null
        : // Una especialidad que ya no está en el catálogo (renombrada): el
          // modal la conserva como opción para no cambiársela sin querer.
          i === 9
          ? 'Mercadotecnia'
          : ESPECIALIDADES[i % ESPECIALIDADES.length].name;
    const asignaciones = [0, 3, 1, 7, 2, 0, 5, 4, 0, 11, 2, 6][i % 12];
    lista.push({
      id: 60 + i,
      email: correoDe(nombre, paterno),
      nombre,
      apellidoPaterno: paterno,
      apellidoMaterno: materno,
      role,
      specialty: especialidad,
      isActive: !inactivo,
      // Algunos nunca han entrado (cuentas recién creadas).
      lastLogin: i % 6 === 5 ? null : hace((i * 3) % 40, i % 9),
      createdAt: hace(20 + i * 9),
      _count: {
        recruiterAssignments: role === 'recruiter' ? asignaciones : 0,
        specialistAssignments: role === 'specialist' ? asignaciones : 0,
      },
    });
  });
  return lista;
}

let equipo = crearEquipo();
let siguienteIdUsuario = 200;

const ORDEN_ROL: Record<string, number> = { admin: 0, recruiter: 1, specialist: 2 };

function listarEquipo(url: URL) {
  const role = url.searchParams.get('role');
  const isActive = url.searchParams.get('isActive');
  const search = url.searchParams.get('search');
  let lista = [...equipo];
  if (role) lista = lista.filter((u) => u.role === role);
  if (isActive !== null && isActive !== '') lista = lista.filter((u) => u.isActive === (isActive === 'true'));
  if (search) {
    // Como la API: cada palabra tiene que aparecer en alguna columna.
    const palabras = search.trim().toLowerCase().split(/\s+/).filter(Boolean);
    lista = lista.filter((u) =>
      palabras.every((p) =>
        [u.nombre, u.email, u.apellidoPaterno, u.apellidoMaterno].some((c) => (c ?? '').toLowerCase().includes(p))
      )
    );
  }
  // orderBy: role asc, createdAt desc.
  lista.sort((a, b) => ORDEN_ROL[a.role] - ORDEN_ROL[b.role] || b.createdAt.localeCompare(a.createdAt));
  const pagina = paginar(lista, url, 30);
  return { success: true, ...pagina, count: pagina.data.length };
}

const asignacionesVivas = (u: UsuarioEquipo) => u._count.recruiterAssignments + u._count.specialistAssignments;

// ===========================================================================
// /admin/requests — solicitudes de alta de empresas
// ===========================================================================
interface Solicitud {
  id: number;
  nombre: string;
  apellidoPaterno: string;
  apellidoMaterno: string;
  nombreEmpresa: string;
  correoEmpresa: string;
  sitioWeb: string | null;
  razonSocial: string;
  rfc: string;
  direccionEmpresa: string;
  latitud: number | null;
  longitud: number | null;
  logoUrl: string | null;
  identificacionUrl: string | null;
  documentosConstitucionUrl: string | null;
  status: 'pending' | 'approved' | 'rejected';
  rejectionReason: string | null;
  createdAt: string;
  updatedAt: string;
  approvedAt: string | null;
  userId: number | null;
}

const BLOB = 'https://inakat-demo.public.blob.vercel-storage.com/solicitudes';

function crearSolicitudes(): Solicitud[] {
  const base = (s: Partial<Solicitud> & Pick<Solicitud, 'id' | 'nombreEmpresa' | 'razonSocial' | 'rfc' | 'status' | 'createdAt'>): Solicitud => ({
    nombre: 'Ana',
    apellidoPaterno: 'Pérez',
    apellidoMaterno: 'López',
    correoEmpresa: 'contacto@empresa.mx',
    sitioWeb: null,
    direccionEmpresa: 'Av. Constitución 1500, Centro, Monterrey, N.L.',
    latitud: null,
    longitud: null,
    logoUrl: null,
    identificacionUrl: `${BLOB}/ine-${s.id}.pdf`,
    documentosConstitucionUrl: `${BLOB}/acta-${s.id}.pdf`,
    rejectionReason: null,
    updatedAt: s.createdAt,
    approvedAt: null,
    userId: 400 + s.id,
    ...s,
  });

  return [
    // --- Pendientes (5: las mismas que cuenta /api/admin/stats en base.ts) ---
    base({
      id: 58,
      nombreEmpresa: 'Clínica Norte',
      razonSocial: 'Servicios Médicos Clínica Norte, S.A. de C.V.',
      rfc: 'SMC180904HB2',
      nombre: 'Rebeca',
      apellidoPaterno: 'Salinas',
      apellidoMaterno: 'Garza',
      correoEmpresa: 'rh@clinicanorte.mx',
      sitioWeb: 'https://www.clinicanorte.mx',
      direccionEmpresa: 'Av. Alfonso Reyes 2210, Col. Del Paseo Residencial, Monterrey, N.L.',
      status: 'pending',
      createdAt: hace(0, 5),
    }),
    base({
      id: 57,
      nombreEmpresa: 'Agroindustrias del Bajío',
      razonSocial: 'Agroindustrias y Empacadoras Integradas del Bajío, S.A.P.I. de C.V.',
      rfc: 'AEI150220Q81',
      nombre: 'Luis Ángel',
      apellidoPaterno: 'Mendoza',
      apellidoMaterno: 'Ríos',
      correoEmpresa: 'reclutamiento.corporativo@agroindustriasdelbajio.com.mx',
      sitioWeb: 'https://agroindustriasdelbajio.com.mx',
      direccionEmpresa: 'Carretera Celaya–Salvatierra km 4.5, Parque Agroindustrial, Celaya, Gto.',
      status: 'pending',
      createdAt: hace(1, 2),
    }),
    base({
      id: 56,
      nombreEmpresa: 'Estudio Tres Arcos',
      razonSocial: 'Tres Arcos Arquitectura, S.C.',
      rfc: 'TAA210611K3A',
      nombre: 'Iñaki',
      apellidoPaterno: 'Urquiza',
      apellidoMaterno: '',
      correoEmpresa: 'hola@tresarcos.studio',
      direccionEmpresa: 'Calle Morelos 88, Centro Histórico, Querétaro, Qro.',
      // Sin sitio web ni documentos: el detalle dice «no disponible».
      identificacionUrl: null,
      documentosConstitucionUrl: null,
      status: 'pending',
      createdAt: hace(2, 7),
    }),
    base({
      id: 55,
      nombreEmpresa: 'Farmacias Vida Plena',
      razonSocial: 'Distribuidora Farmacéutica Vida Plena, S.A. de C.V.',
      rfc: 'DFV090317MN5',
      nombre: 'Georgina',
      apellidoPaterno: 'Treviño',
      apellidoMaterno: 'Cavazos',
      correoEmpresa: 'talento@vidaplena.mx',
      sitioWeb: 'https://vidaplena.mx',
      // Fila antigua con un enlace que no es http(s): el detalle NO lo abre y
      // lo explica (esUrlSegura).
      identificacionUrl: 'javascript:alert(1)',
      status: 'pending',
      createdAt: hace(3, 1),
    }),
    base({
      id: 54,
      nombreEmpresa: 'Innovación Educativa Pátzcuaro',
      razonSocial: 'Innovación Educativa Pátzcuaro, A.C.',
      rfc: 'IEP170823TT0',
      nombre: 'Citlali',
      apellidoPaterno: 'Huerta',
      apellidoMaterno: 'Zavala',
      correoEmpresa: 'direccion@iepatzcuaro.edu.mx',
      direccionEmpresa: 'Portal Hidalgo 12, Centro, Pátzcuaro, Mich.',
      identificacionUrl: `${BLOB}/ine-54.jpg`,
      status: 'pending',
      createdAt: hace(5, 4),
    }),

    // --- Aprobadas (las empresas que ya publican en base.ts) ---
    ...[
      ['Grupo Andes', 'Grupo Andes Consultores, S.A. de C.V.', 'GAC150312KT4', 'Tomás', 'Rivas', 'Ochoa', 'tomas.rivas@grupoandes.mx', 'https://grupoandes.mx', 34],
      ['Constructora Sierra', 'Constructora Sierra Madre del Norte, S.A. de C.V.', 'CSM110505AB1', 'Mauricio', 'Leal', 'Garza', 'obras@constructorasierra.mx', 'https://constructorasierra.mx', 51],
      ['Logística Pacífico', 'Logística y Almacenaje del Pacífico, S. de R.L. de C.V.', 'LAP130918PQ7', 'Fernanda', 'Castro', 'Iñiguez', 'personas@logisticapacifico.mx', null, 63],
      ['Tecnologías Delta', 'Tecnologías Delta de México, S.A.P.I. de C.V.', 'TDM190127RS3', 'Jorge', 'Núñez', 'Barrera', 'talent@tecnologiasdelta.mx', 'https://tecnologiasdelta.mx', 77],
      ['Colegio Horizonte', 'Educación Horizonte, A.C.', 'EHO080814CD2', 'María José', 'Ávila', 'Durán', 'direccion@colegiohorizonte.edu.mx', 'https://colegiohorizonte.edu.mx', 92],
      ['Transportes Laguna', 'Transportes y Fletes de La Laguna, S.A. de C.V.', 'TFL050701GH9', 'Raúl', 'Ontiveros', 'Soto', 'rh@transporteslaguna.mx', null, 118],
      ['Hotel Bahía Azul', 'Operadora Hotelera Bahía Azul, S.A. de C.V.', 'OHB160402UV6', 'Ximena', 'Beltrán', 'Félix', 'capitalhumano@bahiaazul.mx', 'https://bahiaazul.mx', 146],
    ].map(([empresa, razon, rfc, nombre, paterno, materno, correo, web, dias], i) =>
      base({
        id: 50 - i * 3,
        nombreEmpresa: empresa as string,
        razonSocial: razon as string,
        rfc: rfc as string,
        nombre: nombre as string,
        apellidoPaterno: paterno as string,
        apellidoMaterno: materno as string,
        correoEmpresa: correo as string,
        sitioWeb: web as string | null,
        status: 'approved',
        createdAt: hace(dias as number),
        updatedAt: hace((dias as number) - 1),
        approvedAt: hace((dias as number) - 1, 3),
      })
    ),

    // --- Rechazadas ---
    base({
      id: 49,
      nombreEmpresa: 'Comercializadora Global XYZ',
      razonSocial: 'Comercializadora Global XYZ, S.A. de C.V.',
      rfc: 'CGX200101AA1',
      nombre: 'Pedro',
      apellidoPaterno: 'Gómez',
      apellidoMaterno: 'Mata',
      correoEmpresa: 'ventas@globalxyz.com',
      status: 'rejected',
      rejectionReason:
        'El RFC no coincide con la constancia de situación fiscal y el acta constitutiva está incompleta (faltan las páginas de la protocolización). Pueden volver a registrarse con los documentos correctos.',
      createdAt: hace(40),
      updatedAt: hace(38),
    }),
    base({
      id: 46,
      nombreEmpresa: 'Servicios Integrales Omega',
      razonSocial: 'Servicios Integrales Omega, S.C.',
      rfc: 'SIO190909ZX4',
      nombre: 'Carmen',
      apellidoPaterno: 'Lara',
      apellidoMaterno: 'Nava',
      correoEmpresa: 'omega.servicios@correo.mx',
      status: 'rejected',
      // Rechazada sin motivo: el detalle no pinta el recuadro.
      rejectionReason: null,
      createdAt: hace(70),
      updatedAt: hace(69),
    }),
  ];
}

const solicitudes = crearSolicitudes();

const RFC_VALIDO = /^[A-ZÑ&]{3,4}[0-9]{6}[A-Z0-9]{3}$/;

// ===========================================================================
// /admin/contact-messages — formulario público de /contact
// ===========================================================================
const MENSAJES_CONTACTO: Array<[string, string, string | null, string]> = [
  ['Rebeca Salinas', 'rebeca.salinas@clinicanorte.mx', '81 2345 6789', 'Hola, buscamos cubrir tres vacantes de enfermería para turno nocturno. ¿Podrían contarnos cómo funciona la evaluación por especialistas y en cuánto tiempo suelen presentar candidatos?'],
  ['Joel Arteaga', 'joel.arteaga@correo.mx', null, 'Quisiera saber si puedo registrarme como candidato aunque todavía no termine la carrera.'],
  ['Mariana Cortés', 'mcortes@logisticapacifico.mx', '33 1122 3344', 'Buen día.\n\nSomos una empresa de logística con operación en Guadalajara, Manzanillo y Lázaro Cárdenas. Estamos creciendo el área de almacén y necesitamos:\n\n- 2 supervisores de turno\n- 1 jefe de inventarios\n- 4 montacarguistas certificados\n\nNos interesa conocer precios por volumen y si el proceso incluye pruebas psicométricas. También quisiéramos saber si pueden apoyarnos con vacantes confidenciales, porque una de ellas es para reemplazar a una persona que todavía no sabe que se va.\n\nQuedo atenta, gracias.'],
  ['Óscar Villalobos', 'oscar.villalobos@constructorasierra.mx', '81 8765 4321', 'Necesitamos un residente de obra con experiencia en naves industriales para un proyecto en Apodaca. ¿Tienen perfiles disponibles?'],
  ['Lucía Paredes', 'lucia.paredes@correo.mx', null, 'Me postulé a una vacante hace dos semanas y no he recibido respuesta. ¿Cómo puedo saber en qué etapa va mi proceso?'],
  ['Arturo Bermúdez', 'abermudez@tecnologiasdelta.mx', '55 4455 6677', 'Queremos integrar INAKAT con nuestro ATS. ¿Tienen documentación de la API y webhooks?'],
  ['Fernanda Ruiz', 'fer.ruiz@correo.mx', '44 3322 1100', 'Soy psicóloga organizacional y me gustaría colaborar con ustedes como especialista evaluadora. ¿A quién le puedo enviar mi CV?'],
  ['Colegio Horizonte', 'direccion@colegiohorizonte.edu.mx', '81 1234 0000', 'Buscamos docentes de matemáticas y física para secundaria, ciclo escolar que inicia en agosto.'],
  ['Emilio Garza', 'emilio.garza@correo.mx', null, 'Hola'],
  ['Patricia Leal', 'patricia.leal@hotelbahiaazul.mx', '612 123 4567', 'Estamos abriendo un nuevo hotel en La Paz y requerimos contratar 40 personas en áreas de recepción, alimentos y bebidas, y mantenimiento. ¿Manejan contrataciones masivas? ¿Cuál sería el costo aproximado y el tiempo de entrega de candidatos?'],
  ['Raúl Ontiveros', 'rh@transporteslaguna.mx', '871 555 0101', 'Gracias por el apoyo con la vacante de coordinador de tráfico. Nos gustaría abrir dos más el próximo mes.'],
  ['Sofía Herrera', 'sofia.herrera@correo.mx', '81 9988 7766', 'Olvidé mi contraseña y no me llega el correo para restablecerla. Ya revisé la carpeta de spam.'],
];

const mensajesContacto = Array.from({ length: 27 }, (_, i) => {
  const [nombre, email, telefono, mensaje] = MENSAJES_CONTACTO[i % MENSAJES_CONTACTO.length];
  return {
    id: 300 - i,
    nombre,
    email,
    telefono,
    mensaje,
    createdAt: hace(i * 1.7, (i * 5) % 11),
  };
});

// ===========================================================================
// Fixtures
// ===========================================================================
export const fixtures: Fixture[] = [
  // --- Usuarios del equipo ---------------------------------------------------
  {
    metodo: 'GET',
    patron: '/api/admin/users',
    retraso: 250,
    respuesta: ({ url }) => listarEquipo(url),
  },
  {
    metodo: 'POST',
    patron: '/api/admin/users',
    retraso: 400,
    respuesta: ({ cuerpo }) => {
      const b = (cuerpo ?? {}) as Record<string, string>;
      if (!b.email || !b.password || !b.nombre || !b.role) {
        return respuestaJson({ success: false, error: 'Campos requeridos: email, password, nombre, role' }, 400);
      }
      if (equipo.some((u) => u.email.toLowerCase() === b.email.toLowerCase())) {
        return respuestaJson({ success: false, error: 'Ya existe un usuario con este email' }, 409);
      }
      if (b.password.length < 8) {
        return respuestaJson({ success: false, error: 'La contraseña debe tener al menos 8 caracteres' }, 400);
      }
      if (b.role === 'specialist' && !b.specialty) {
        return respuestaJson({ success: false, error: 'Los especialistas deben tener una especialidad asignada' }, 400);
      }
      const nuevo: UsuarioEquipo = {
        id: siguienteIdUsuario++,
        email: b.email.toLowerCase(),
        nombre: b.nombre,
        apellidoPaterno: b.apellidoPaterno || null,
        apellidoMaterno: b.apellidoMaterno || null,
        role: b.role as UsuarioEquipo['role'],
        specialty: b.role === 'specialist' ? b.specialty : null,
        isActive: true,
        lastLogin: null,
        createdAt: new Date().toISOString(),
        _count: { recruiterAssignments: 0, specialistAssignments: 0 },
      };
      equipo = [nuevo, ...equipo];
      // El `select` del POST real no devuelve _count ni lastLogin.
      const data = {
        id: nuevo.id,
        email: nuevo.email,
        nombre: nuevo.nombre,
        apellidoPaterno: nuevo.apellidoPaterno,
        apellidoMaterno: nuevo.apellidoMaterno,
        role: nuevo.role,
        specialty: nuevo.specialty,
        isActive: nuevo.isActive,
        createdAt: nuevo.createdAt,
      };
      return respuestaJson({ success: true, message: 'Usuario creado exitosamente', data }, 201);
    },
  },
  {
    metodo: 'PUT',
    patron: '/api/admin/users',
    retraso: 400,
    respuesta: ({ cuerpo }) => {
      const b = (cuerpo ?? {}) as Record<string, unknown>;
      const u = equipo.find((x) => x.id === Number(b.id));
      if (!u) return respuestaJson({ success: false, error: 'Usuario no encontrado' }, 404);
      if (u.id === USUARIOS.admin.id && (b.isActive === false || (b.role && b.role !== u.role))) {
        return respuestaJson({ success: false, error: 'No puedes desactivar ni cambiar el rol de tu propia cuenta' }, 400);
      }
      if (typeof b.password === 'string' && b.password.length < 8) {
        return respuestaJson({ success: false, error: 'La contraseña debe tener al menos 8 caracteres' }, 400);
      }
      const rol = (b.role as UsuarioEquipo['role']) ?? u.role;
      if (rol === 'specialist' && 'specialty' in b && !b.specialty) {
        return respuestaJson({ success: false, error: 'Los especialistas deben tener una especialidad asignada' }, 400);
      }
      const antes = { ...u };
      if (typeof b.isActive === 'boolean') u.isActive = b.isActive;
      if (typeof b.email === 'string') u.email = b.email;
      if (typeof b.nombre === 'string') u.nombre = b.nombre;
      if ('apellidoPaterno' in b) u.apellidoPaterno = (b.apellidoPaterno as string) || null;
      if ('apellidoMaterno' in b) u.apellidoMaterno = (b.apellidoMaterno as string) || null;
      u.role = rol;
      if ('specialty' in b) u.specialty = rol === 'specialist' ? ((b.specialty as string) || null) : null;
      // Como la API: se avisa de las vacantes vivas al desactivar o cambiar de rol.
      const pierde = (antes.isActive && !u.isActive) || antes.role !== u.role;
      return {
        success: true,
        message: 'Usuario actualizado exitosamente',
        data: { ...u },
        activeAssignments: pierde ? asignacionesVivas(antes) : 0,
      };
    },
  },
  {
    metodo: 'DELETE',
    patron: '/api/admin/users',
    retraso: 400,
    respuesta: ({ url }) => {
      const id = Number(url.searchParams.get('id'));
      const u = equipo.find((x) => x.id === id);
      if (!u) return respuestaJson({ success: false, error: 'Usuario no encontrado' }, 404);
      if (u.id === USUARIOS.admin.id) {
        return respuestaJson({ success: false, error: 'No puedes desactivar tu propia cuenta' }, 400);
      }
      u.isActive = false;
      return { success: true, message: 'Usuario desactivado exitosamente', activeAssignments: asignacionesVivas(u) };
    },
  },

  // --- Solicitudes de empresa -------------------------------------------------
  {
    metodo: 'GET',
    patron: '/api/company-requests',
    retraso: 250,
    respuesta: ({ url }) => {
      const status = url.searchParams.get('status');
      const data = (status ? solicitudes.filter((s) => s.status === status) : solicitudes)
        .slice()
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
      return { success: true, data };
    },
  },
  {
    metodo: 'PATCH',
    patron: '/api/company-requests/:id',
    // El PATCH real espera al correo a la empresa: tarda.
    retraso: 900,
    respuesta: ({ params, cuerpo }) => {
      const b = (cuerpo ?? {}) as { status?: string; rejectionReason?: string | null };
      if (!b.status || !['pending', 'approved', 'rejected'].includes(b.status)) {
        return respuestaJson(
          { success: false, error: 'Estado inválido. Debe ser: pending, approved o rejected' },
          400
        );
      }
      const s = solicitudes.find((x) => x.id === Number(params.id));
      if (!s) return respuestaJson({ success: false, error: 'Solicitud no encontrada' }, 404);
      s.status = b.status as Solicitud['status'];
      s.rejectionReason = b.rejectionReason || null;
      s.approvedAt = b.status === 'approved' ? new Date().toISOString() : null;
      s.updatedAt = new Date().toISOString();
      const mensajes: Record<string, string> = {
        approved: 'Empresa aprobada exitosamente',
        rejected: 'Solicitud rechazada',
        pending: 'Solicitud marcada como pendiente',
      };
      return { success: true, message: mensajes[b.status], data: { ...s } };
    },
  },
  {
    metodo: 'PUT',
    patron: '/api/company-requests/:id',
    retraso: 500,
    respuesta: ({ params, cuerpo }) => {
      const b = (cuerpo ?? {}) as Partial<Solicitud>;
      // Como companyRequestUpdateSchema: un RFC con otro formato es 400.
      if (b.rfc !== undefined && !RFC_VALIDO.test(b.rfc)) {
        return respuestaJson(
          {
            success: false,
            error: 'Datos inválidos',
            errors: [{ field: 'rfc', message: 'RFC inválido. Debe ser formato mexicano válido (ej: ABC123456A1A o XAXX010101AAA)' }],
          },
          400
        );
      }
      const s = solicitudes.find((x) => x.id === Number(params.id));
      if (!s) return respuestaJson({ success: false, error: 'Solicitud no encontrada' }, 404);
      if (s.status !== 'pending') {
        return respuestaJson({ success: false, error: 'Solo las solicitudes pendientes pueden ser editadas' }, 400);
      }
      const campos = ['nombre', 'apellidoPaterno', 'apellidoMaterno', 'nombreEmpresa', 'correoEmpresa', 'razonSocial', 'rfc', 'direccionEmpresa'] as const;
      campos.forEach((c) => {
        const v = b[c];
        if (typeof v === 'string' && (v || c === 'apellidoMaterno')) s[c] = v;
      });
      if (b.sitioWeb !== undefined) s.sitioWeb = b.sitioWeb || null;
      s.updatedAt = new Date().toISOString();
      return { success: true, message: 'Solicitud de empresa actualizada exitosamente', data: { ...s } };
    },
  },

  // --- Mensajes de contacto ---------------------------------------------------
  {
    metodo: 'GET',
    patron: '/api/admin/contact-messages',
    retraso: 250,
    respuesta: ({ url }) => ({ success: true, ...paginar(mensajesContacto, url, 20) }),
  },
];
