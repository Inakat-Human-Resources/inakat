// RUTA: src/app/diseno/fixtures/b6-vacante.ts
//
// Bloque 6 · vacante: publicar (/create-job) y editar (/create-job?edit=<id>).
// Formato en ./tipos.ts; ejemplos en ./base.ts y en docs/DISENO.md §10.
// Van ANTES que las base: si repites un patrón, gana el tuyo.
//
// Formas copiadas de:
//   GET/POST /api/pricing/calculate  → src/app/api/pricing/calculate/route.ts
//   GET      /api/company/profile    → src/app/api/company/profile/route.ts
//   POST     /api/jobs               → src/app/api/jobs/route.ts
//   GET/PUT  /api/jobs/:id           → src/app/api/jobs/[id]/route.ts
//
// Casos que se pueden ver en el banco (empresa con 12 créditos, como en base.ts):
//   /diseno/vista/create-job                 publicar; Sr o Director cuestan más de 12
//                                            → modal de créditos insuficientes
//   /diseno/vista/create-job?edit=101        activa, en su ventana de 4 h, con mapa y habilidades
//   /diseno/vista/create-job?edit=102        activa sin ventana: cambiar nivel pide confirmar el cobro
//                                            (Jr remoto → Director híbrido pide 13 de 12 → 402
//                                            con las cifras reales: «te faltan 1»)
//   /diseno/vista/create-job?edit=103        confidencial, con notas internas largas
//   /diseno/vista/create-job?edit=104        pausada con la ventana vencida → 403 al guardar
//   /diseno/vista/create-job?edit=105        borrador antiguo: habilidades en texto plano y salario
//                                            sólo en la cadena `salary` (sin min/max ni coordenadas)
//   /diseno/vista/create-job?edit=999        no existe → «La vacante no existe o fue eliminada.»
//   Salud + Director                         sin precio en la matriz: el costo sale 5 por
//                                            defecto y publicar responde 400
//
// Datos inventados: ninguna cifra, persona o empresa es de producción.
import type { Fixture } from './tipos';
import { ESPECIALIDADES, USUARIOS, VACANTES } from './base';

const ahora = Date.now();
const HORA = 3_600_000;
const DIA = 24 * HORA;
const hace = (dias: number, horas = 0) => new Date(ahora - dias * DIA - horas * HORA).toISOString();

const responder = (datos: unknown, estado = 200) =>
  new Response(JSON.stringify(datos), {
    status: estado,
    headers: { 'Content-Type': 'application/json' },
  });

// ---------------------------------------------------------------------------
// Matriz de precios simulada (misma escala que prisma/seed.ts)
// ---------------------------------------------------------------------------
const NIVELES = ['Practicante', 'Jr', 'Middle', 'Sr', 'Director'];
const MODALIDADES = ['remote', 'hybrid', 'presential'];
const CREDITOS: Record<string, Record<string, number>> = {
  Practicante: { remote: 4, hybrid: 5, presential: 5 },
  Jr: { remote: 5, hybrid: 6, presential: 6 },
  Middle: { remote: 8, hybrid: 10, presential: 10 },
  Sr: { remote: 12, hybrid: 14, presential: 14 },
  Director: { remote: 15, hybrid: 18, presential: 18 },
};
/** Salario mínimo (MXN/mes) que exige la matriz por nivel. Practicante no exige. */
const SALARIO_MINIMO: Record<string, number | null> = {
  Practicante: null,
  Jr: 12000,
  Middle: 18000,
  Sr: 28000,
  Director: 45000,
};

/** Lo mismo que calculateJobCreditCost (src/lib/pricing.ts): precio por defecto 5 si no hay fila. */
function precio(profile: unknown, seniority: unknown, workMode: unknown) {
  const texto = (v: unknown): v is string => typeof v === 'string' && v.trim().length > 0 && v.length <= 200;
  if (!texto(profile) || !texto(seniority) || !texto(workMode)) {
    return { found: false as const, credits: 5 };
  }
  const fila = CREDITOS[seniority]?.[workMode];
  const perfilConocido = ESPECIALIDADES.some((e) => e.name === profile);
  // Salud no tiene fila de Director: sirve para ver «No hay un precio configurado…».
  if (!fila || !perfilConocido || (profile === 'Salud' && seniority === 'Director')) {
    return { found: false as const, credits: 5 };
  }
  const pricingId = 10 + ESPECIALIDADES.findIndex((e) => e.name === profile) * 15 + NIVELES.indexOf(seniority) * 3 + MODALIDADES.indexOf(workMode);
  return { found: true as const, credits: fila, pricingId, minSalary: SALARIO_MINIMO[seniority] ?? null };
}

// ---------------------------------------------------------------------------
// Vacantes completas (lo que devuelve GET /api/jobs/:id al propietario)
// ---------------------------------------------------------------------------
const NIVEL_MATRIZ: Record<string, string> = { Jr: 'Jr', Mid: 'Middle', Sr: 'Sr', Lead: 'Director' };
const COORDENADAS: Record<string, [number, number]> = {
  'Monterrey, NL': [25.6866, -100.3161],
  CDMX: [19.4326, -99.1332],
  'Guadalajara, Jal.': [20.6597, -103.3496],
  'Puebla, Pue.': [19.0414, -98.2063],
  'Querétaro, Qro.': [20.5888, -100.3899],
  'Mérida, Yuc.': [20.9674, -89.5926],
};

type VacanteCompleta = Record<string, unknown> & {
  id: number;
  status: string;
  creditCost: number;
  profile: string | null;
  seniority: string | null;
  workMode: string;
  editableUntil: string | null;
  salaryMin: number | null;
  salaryMax: number | null;
};

/** Diferencias de algunas vacantes para ver casos distintos en la edición. */
const AJUSTES: Record<number, Partial<VacanteCompleta>> = {
  101: {
    company: 'Grupo Andes',
    location: 'Torre Andes, Av. Constitución 1450, Centro, Monterrey, N.L., México',
    subcategory: 'Desarrollo web',
    educationLevel: 'Licenciatura',
    salaryMin: 45000,
    salaryMax: 55000,
    habilidades: JSON.stringify(['React', 'Node.js', 'PostgreSQL', 'Pruebas automatizadas', 'Comunicación con negocio']),
    resultadosEsperados:
      'En tres meses: llevar a producción el nuevo portal de clientes.\nEn seis: reducir a la mitad el tiempo de respuesta de las pantallas de facturación.',
    informacionAdicional: 'Equipo de cuatro personas, trabajo por ciclos de dos semanas y un día de oficina a la semana.',
    notasInternas: 'Reporta al director de tecnología. Rango negociable hasta $58,000 si la persona domina facturación electrónica.',
  },
  102: {
    subcategory: 'Control de calidad',
    educationLevel: 'Licenciatura',
    // Sin ventana de 4 h: la empresa todavía puede editarla (y el cambio de nivel
    // mueve créditos). Jr remoto = 5; a Director híbrido (18) la diferencia es 13
    // y la empresa tiene 12 → 402 con required/available.
    seniority: 'Jr',
    workMode: 'remote',
    creditCost: 5,
    editableUntil: null,
    salaryMin: 26000,
    salaryMax: 34000,
    habilidades: JSON.stringify(['Lean manufacturing', 'Six Sigma', 'AutoCAD']),
  },
  103: {
    isConfidential: true,
    subcategory: 'Enfermería',
    educationLevel: 'Licenciatura',
    salaryMin: 30000,
    salaryMax: 38000,
    notasInternas:
      'Sustituye a la jefa actual, que se jubila en diciembre; el equipo no lo sabe todavía. Buscamos a alguien con experiencia en acreditación hospitalaria y manejo de turnos nocturnos. No contactar a personal de Clínica del Valle: acuerdo de no captación vigente hasta marzo.',
  },
  104: {
    // Pausada y fuera de la ventana: el PUT responde 403.
    editableUntil: hace(3),
    salaryMin: 16000,
    salaryMax: 21000,
  },
  105: {
    // Borrador antiguo: habilidades en texto plano, salario sólo en la cadena.
    habilidades: 'Planeación didáctica, Moodle, Evaluación por competencias',
    salary: '$22,000 - $30,000 / mes',
    salaryMin: null,
    salaryMax: null,
    creditCost: 0,
    latitude: null,
    longitude: null,
    educationLevel: 'Posgrado',
  },
};

const GUARDADAS = new Map<number, VacanteCompleta>();

function vacante(id: number): VacanteCompleta | null {
  const guardada = GUARDADAS.get(id);
  if (guardada) return guardada;
  const i = VACANTES.findIndex((v) => v.id === id);
  if (i < 0) return null;
  const v = VACANTES[i];
  const nivel = NIVEL_MATRIZ[v.seniority] ?? v.seniority;
  const [lat, lng] = COORDENADAS[v.location] ?? [null, null];
  const min = (18 + (i % 7) * 4) * 1000;
  const max = min + 8000;
  const costo = v.status === 'draft' ? 0 : precio(v.profile, nivel, v.workMode).credits;
  const completa: VacanteCompleta = {
    id: v.id,
    title: v.title,
    company: v.company,
    location: v.location,
    latitude: lat,
    longitude: lng,
    salary: `$${min.toLocaleString('es-MX')} - $${max.toLocaleString('es-MX')} / mes`,
    salaryMin: min,
    salaryMax: max,
    jobType: v.jobType === 'Medio tiempo' ? 'Medio Tiempo' : 'Tiempo Completo',
    workMode: v.workMode,
    description: v.description,
    requirements: v.requirements,
    status: v.status,
    closedReason: null,
    companyRating: null,
    creditCost: costo,
    profile: v.profile,
    subcategory: null,
    seniority: nivel,
    educationLevel: null,
    habilidades: v.habilidades,
    responsabilidades: v.responsabilidades,
    resultadosEsperados: v.resultadosEsperados,
    valoresActitudes: v.valoresActitudes,
    informacionAdicional: v.informacionAdicional,
    notasInternas: null,
    isConfidential: false,
    userId: USUARIOS.company.id,
    createdAt: v.createdAt,
    updatedAt: v.createdAt,
    expiresAt: null,
    editableUntil: v.editableUntil,
    logoUrl: null,
    ...AJUSTES[id],
  };
  return completa;
}

// ---------------------------------------------------------------------------
// Validaciones compartidas por POST y PUT (mensajes de las rutas)
// ---------------------------------------------------------------------------
type Cuerpo = Record<string, unknown>;

function errorDeSalario(b: Cuerpo): string | null {
  const min = parseInt(String(b.salaryMin ?? '')) || 0;
  const max = parseInt(String(b.salaryMax ?? '')) || 0;
  if (min > 0 && max > 0 && min > max) return 'El salario mínimo no puede ser mayor al máximo';
  if (min > 0 && max > 0 && max - min > 10000) return 'La diferencia máxima permitida entre salarios es $10,000 MXN';
  return null;
}

function errorDeMinimo(b: Cuerpo): { error: string; minSalaryRequired: number } | null {
  const p = precio(b.profile, b.seniority, b.workMode);
  const min = parseInt(String(b.salaryMin ?? '')) || 0;
  if (p.found && p.minSalary && min > 0 && min < p.minSalary) {
    return {
      error: `El salario mínimo ofrecido ($${min.toLocaleString()} MXN) es menor al mínimo requerido para esta especialidad ($${p.minSalary.toLocaleString()} MXN)`,
      minSalaryRequired: p.minSalary,
    };
  }
  return null;
}

const SIN_PRECIO =
  'No hay un precio configurado para esa combinación de especialidad, seniority y modalidad. Revisa los datos de la vacante.';

let siguienteId = 480;

export const fixtures: Fixture[] = [
  // Opciones de la matriz (GET) y cálculo del costo (POST).
  {
    metodo: 'GET',
    patron: '/api/pricing/calculate',
    respuesta: {
      success: true,
      options: {
        profiles: ESPECIALIDADES.map((e) => e.name),
        seniorities: NIVELES,
        workModes: MODALIDADES,
        locations: ['Monterrey'],
      },
    },
  },
  {
    metodo: 'POST',
    patron: '/api/pricing/calculate',
    // Un poco de espera: así se ve el «Calculando costo…» del botón.
    retraso: 450,
    respuesta: ({ cuerpo }) => {
      const b = (cuerpo ?? {}) as Cuerpo;
      const texto = (v: unknown) => typeof v === 'string' && v.trim().length > 0 && v.length <= 200;
      if (!texto(b.profile) || !texto(b.seniority) || !texto(b.workMode)) {
        return responder({ success: false, error: 'Campos requeridos (texto): profile, seniority, workMode' }, 400);
      }
      const p = precio(b.profile, b.seniority, b.workMode);
      if (!p.found) {
        return {
          success: true,
          found: false,
          credits: p.credits,
          message: 'No se encontró precio específico, usando valor por defecto',
          query: { profile: b.profile, seniority: b.seniority, workMode: b.workMode },
        };
      }
      return { success: true, found: true, credits: p.credits, pricingId: p.pricingId, minSalary: p.minSalary };
    },
  },

  // Perfil de la empresa: el formulario sólo lo pide para una empresa (nombre precargado).
  {
    metodo: 'GET',
    patron: '/api/company/profile',
    respuesta: ({ rol }) => {
      if (rol !== 'company' && rol !== 'admin') {
        return responder({ success: false, error: 'Acceso denegado. Solo empresas.' }, 403);
      }
      if (rol === 'admin') {
        return responder({ success: false, error: 'No tienes una empresa registrada' }, 404);
      }
      const u = USUARIOS.company;
      return {
        success: true,
        data: {
          userId: u.id,
          userEmail: u.email,
          userName: u.nombre,
          credits: u.credits,
          representante: { nombre: 'Tomás', apellidoPaterno: 'Rivas', apellidoMaterno: 'Garza' },
          nombreEmpresa: 'Grupo Andes',
          correoEmpresa: 'contacto@grupoandes.mx',
          sitioWeb: 'https://grupoandes.mx',
          razonSocial: 'Grupo Andes Servicios Profesionales, S.A. de C.V.',
          rfc: 'GAS150312KT4',
          direccionEmpresa: 'Av. Constitución 1450, Centro, Monterrey, N.L.',
          latitud: 25.6693,
          longitud: -100.3099,
          logoUrl: null,
          status: 'approved',
          createdAt: hace(210),
          approvedAt: hace(208),
        },
      };
    },
  },

  // Crear (borrador o publicar).
  {
    metodo: 'POST',
    patron: '/api/jobs',
    retraso: 600,
    respuesta: ({ cuerpo, rol }) => {
      const b = (cuerpo ?? {}) as Cuerpo;
      if (rol !== 'company' && rol !== 'admin') {
        return responder({ success: false, error: 'Acceso denegado' }, 403);
      }
      if (!b.title || !b.company || !b.location || !b.salary || !b.jobType || !b.description) {
        return responder({ success: false, error: 'Faltan campos requeridos' }, 400);
      }
      const salario = errorDeSalario(b);
      if (salario) return responder({ success: false, error: salario }, 400);

      const publicar = b.publishNow === true;
      if (publicar && rol === 'company' && !(b.profile && b.seniority && b.workMode)) {
        return responder(
          {
            success: false,
            error:
              'Para publicar hay que indicar especialidad, seniority y modalidad de trabajo: de ellos depende el costo en créditos.',
            missing: [!b.profile && 'profile', !b.seniority && 'seniority', !b.workMode && 'workMode'].filter(Boolean),
          },
          400
        );
      }
      const minimo = errorDeMinimo(b);
      if (minimo) return responder({ success: false, ...minimo }, 400);

      const p = precio(b.profile, b.seniority, b.workMode);
      if (publicar && rol === 'company' && (!p.found || p.credits <= 0)) {
        return responder({ success: false, error: SIN_PRECIO, profile: b.profile, seniority: b.seniority, workMode: b.workMode }, 400);
      }

      let status = 'draft';
      if (publicar) {
        if (rol === 'company' && USUARIOS.company.credits < p.credits) {
          return responder(
            { success: false, error: 'Créditos insuficientes para publicar', available: USUARIOS.company.credits, savedAsDraft: false },
            402
          );
        }
        status = 'active';
      }

      const id = siguienteId++;
      const creado = new Date().toISOString();
      const job: VacanteCompleta = {
        ...(b as Record<string, unknown>),
        id,
        status,
        creditCost: status === 'active' ? p.credits : 0,
        profile: (b.profile as string) || null,
        seniority: (b.seniority as string) || null,
        workMode: (b.workMode as string) || 'presential',
        salaryMin: Number(b.salaryMin) || null,
        salaryMax: Number(b.salaryMax) || null,
        userId: USUARIOS[rol].id,
        createdAt: creado,
        updatedAt: creado,
        expiresAt: null,
        editableUntil: status === 'active' ? new Date(Date.now() + 4 * HORA).toISOString() : null,
      };
      delete (job as Record<string, unknown>).publishNow;
      GUARDADAS.set(id, job);
      return responder(
        {
          success: true,
          message: status === 'active' ? '¡Vacante publicada exitosamente!' : 'Vacante guardada como borrador',
          data: job,
          status,
          creditCost: status === 'active' ? p.credits : 0,
        },
        201
      );
    },
  },

  // Leer para editar.
  {
    metodo: 'GET',
    patron: '/api/jobs/:id',
    retraso: 350,
    respuesta: ({ params }) => {
      const id = parseInt(params.id);
      if (Number.isNaN(id)) return responder({ success: false, error: 'Invalid job ID' }, 400);
      const job = vacante(id);
      if (!job) return responder({ success: false, error: 'Job not found' }, 404);
      return { success: true, data: job };
    },
  },

  // Guardar cambios (con el ajuste de créditos si cambia especialidad, nivel o modalidad).
  {
    metodo: 'PUT',
    patron: '/api/jobs/:id',
    retraso: 600,
    // El ajuste mira el rol del PROPIETARIO (aquí siempre la empresa), no el de
    // quien edita: así lo hace la ruta.
    respuesta: ({ params, cuerpo }) => {
      const id = parseInt(params.id);
      if (Number.isNaN(id)) return responder({ success: false, error: 'Invalid job ID' }, 400);
      const actual = vacante(id);
      if (!actual) return responder({ success: false, error: 'Job not found' }, 404);
      if (actual.editableUntil && Date.now() > new Date(actual.editableUntil).getTime()) {
        return responder(
          { success: false, error: 'El tiempo para editar esta vacante ha expirado (4 horas después de su creación)' },
          403
        );
      }
      const b = (cuerpo ?? {}) as Cuerpo;
      if (b.profile && !ESPECIALIDADES.some((e) => e.name === b.profile)) {
        return responder({ success: false, error: 'La especialidad seleccionada no es válida o no está activa' }, 400);
      }
      const salario = errorDeSalario(b);
      if (salario) return responder({ success: false, error: salario }, 400);
      const minimo = errorDeMinimo(b);
      if (minimo) return responder({ success: false, ...minimo }, 400);

      let creditChange: { original: number; new: number; difference: number; action: string } | null = null;
      let nuevoCosto = actual.creditCost;
      const perfil = (b.profile as string) || '';
      const nivel = (b.seniority as string) || '';
      const modalidad = (b.workMode as string) || 'presential';
      const cambiaPrecio =
        perfil !== (actual.profile || '') || nivel !== (actual.seniority || '') || modalidad !== (actual.workMode || 'presential');

      // Como la ruta: el borrador no se ajusta (se cobra entero al publicarlo).
      if (actual.status !== 'draft' && cambiaPrecio && perfil && nivel && modalidad) {
        const p = precio(perfil, nivel, modalidad);
        if (!p.found) {
          return responder({ success: false, error: SIN_PRECIO, profile: perfil, seniority: nivel, workMode: modalidad }, 400);
        }
        const diferencia = p.credits - actual.creditCost;
        if (diferencia > 0 && diferencia > USUARIOS.company.credits) {
          return responder(
            {
              success: false,
              error: `Créditos insuficientes. Necesitas ${diferencia} créditos adicionales para este cambio.`,
              required: diferencia,
              available: USUARIOS.company.credits,
            },
            402
          );
        }
        if (diferencia !== 0) {
          creditChange = {
            original: actual.creditCost,
            new: p.credits,
            difference: diferencia,
            action: diferencia > 0 ? 'charged' : 'refunded',
          };
        }
        nuevoCosto = p.credits;
      }

      const actualizada: VacanteCompleta = {
        ...actual,
        ...(b as Record<string, unknown>),
        id,
        status: actual.status,
        creditCost: nuevoCosto,
        profile: perfil || null,
        seniority: nivel || null,
        workMode: modalidad,
        salaryMin: Number(b.salaryMin) || null,
        salaryMax: Number(b.salaryMax) || null,
        editableUntil: actual.editableUntil,
        updatedAt: new Date().toISOString(),
      };
      GUARDADAS.set(id, actualizada);

      let message = 'Vacante actualizada exitosamente';
      if (creditChange?.action === 'charged') {
        message = `Vacante actualizada. Se han cobrado ${creditChange.difference} créditos adicionales.`;
      } else if (creditChange?.action === 'refunded') {
        message = `Vacante actualizada. Se han devuelto ${Math.abs(creditChange.difference)} créditos.`;
      }
      return { success: true, message, data: actualizada, ...(creditChange && { creditChange }) };
    },
  },
];
