// RUTA: src/app/diseno/fixtures/b4-admin-catalogo.ts
//
// Bloque 4 · admin catálogo: especialidades, matriz de precios, paquetes de
// créditos y vendedores/comisiones. Formato en ./tipos.ts; ejemplos en ./base.ts
// y en docs/DISENO.md §10. Van ANTES que las base: si repites un patrón, gana el tuyo.
//
// Las respuestas copian la FORMA de cada route.ts (src/app/api/admin/…):
// success, data, count, profiles, pagination { totalCount }, summary, message,
// affectedJobs, activeJobs (409)…
//
// Tienen memoria mientras la pestaña vive: crear, editar, activar, borrar o
// marcar una comisión como pagada cambia lo que devuelve la siguiente lectura,
// así el banco enseña el flujo completo. Al recargar vuelve al estado inicial.
//
// Casos que cubren a propósito:
// - especialidades activas e inactivas, sin descripción, sin icono, sin
//   subcategorías, con descripción larga; borrar una EN USO da 409;
// - una especialidad activa sin ningún precio (Marketing) y otra incompleta
//   (Ingeniería sin «Practicante»): «Regenerar combinaciones faltantes» tiene
//   qué enseñar; una fila con ubicación; filas inactivas; borrar una
//   combinación con vacantes da 409 con la lista;
// - paquetes con etiqueta, sin etiqueta, con centavos e inactivo; dos activos
//   con los mismos créditos dan 409;
// - 23 vendedores (dos páginas de 20), roles distintos, códigos inactivos;
//   comisiones pendientes vencidas y por vencer, pagadas con y sin comprobante,
//   una empresa sin solicitud («N/A», como la API).
//
// Datos inventados (nombres ficticios, correos @correo.mx): NUNCA de producción.

import type { Fixture } from './tipos';
import { ESPECIALIDADES, USUARIOS, VACANTES } from './base';

const ahora = Date.now();
const DIA = 86_400_000;
const hace = (dias: number) => new Date(ahora - dias * DIA).toISOString();

/** Respuesta con código HTTP propio (409, 400…). */
const json = (datos: unknown, estado = 200) =>
  new Response(JSON.stringify(datos), { status: estado, headers: { 'Content-Type': 'application/json' } });

const quitarAcentos = (texto: string) => texto.normalize('NFD').replace(/[̀-ͯ]/g, '');
const aSlug = (texto: string) =>
  quitarAcentos(texto)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
const redondear = (n: number) => Math.round(n * 100) / 100;

/** page/limit como getPaginationParams (src/lib/pagination.ts): tope 100. */
function paginar(url: URL, porDefecto = 20) {
  const page = Math.max(1, parseInt(url.searchParams.get('page') || '1', 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get('limit') || String(porDefecto), 10) || porDefecto));
  return { page, limit, skip: (page - 1) * limit };
}

// ===========================================================================
// ESPECIALIDADES — /api/admin/specialties
// ===========================================================================
interface Especialidad {
  id: number;
  name: string;
  slug: string;
  description: string | null;
  icon: string | null;
  color: string;
  subcategories: string[];
  sortOrder: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

const DESCRIPCIONES: Record<string, string | null> = {
  tecnologia: 'Desarrollo de software, infraestructura, datos y seguridad de la información.',
  arquitectura: 'Proyecto arquitectónico, urbanismo, interiorismo y supervisión de obra.',
  'diseno-grafico': 'Identidad visual, interfaces, ilustración y diseño editorial.',
  'produccion-audiovisual': 'Foto, video, edición y animación para marcas y medios.',
  educacion:
    'Docencia, diseño instruccional y capacitación en escuelas, universidades y empresas. Incluye perfiles de psicología educativa y orientación, y los equipos que diseñan programas de formación en línea para plantillas de cientos de personas.',
  'administracion-oficina': 'Recursos humanos, asistencia administrativa, recepción y atención al cliente.',
  finanzas: 'Contabilidad, tesorería, auditoría, impuestos y facturación.',
  marketing: null,
  ingenieria: 'Mecatrónica, electrónica, automatización y proyectos industriales.',
  salud: 'Psicología clínica, nutrición, enfermería y medicina ocupacional.',
};

let especialidades: Especialidad[] = [
  ...ESPECIALIDADES.map((e, i) => ({
    ...e,
    description: DESCRIPCIONES[e.slug] ?? null,
    sortOrder: i + 1,
    // Salud está pausada: deja de salir en el catálogo público.
    isActive: e.slug !== 'salud',
    createdAt: hace(400 - i * 10),
    updatedAt: hace(30 - i),
  })),
  {
    id: 11,
    name: 'Gastronomía',
    slug: 'gastronomia',
    description: null,
    icon: null,
    color: '#2b5d62',
    subcategories: [],
    sortOrder: 11,
    isActive: false,
    createdAt: hace(20),
    updatedAt: hace(20),
  },
];
let siguienteIdEspecialidad = 12;

// ===========================================================================
// MATRIZ DE PRECIOS — /api/admin/pricing y /api/admin/pricing/sync
// (misma tabla por defecto que src/app/api/admin/pricing/precios-por-defecto.ts)
// ===========================================================================
interface Precio {
  id: number;
  profile: string;
  seniority: string;
  workMode: string;
  location: string | null;
  credits: number;
  minSalary: number | null;
  isActive: boolean;
  createdAt: string;
}

const SENIORITIES = ['Director', 'Sr', 'Middle', 'Jr', 'Practicante'] as const;
const MODALIDADES = ['presential', 'hybrid', 'remote'] as const;
const CREDITOS_BASE: Record<string, number> = { Director: 10, Sr: 8, Middle: 6, Jr: 4, Practicante: 2 };
const EXTRA_MODALIDAD: Record<string, number> = { presential: 0, hybrid: 1, remote: 2 };
const SALARIO_MINIMO: Record<string, number | null> = {
  Director: 70000,
  Sr: 45000,
  Middle: 30000,
  Jr: 18000,
  Practicante: null,
};
/** Perfiles que exigen salario mínimo (los demás, sin mínimo). */
const CON_SALARIO_MINIMO = new Set(['Tecnología', 'Finanzas', 'Arquitectura']);
const COMBINACIONES_ESPERADAS = SENIORITIES.length * MODALIDADES.length;
const clave = (seniority: string, workMode: string) => `${seniority}-${workMode}`;

let siguienteIdPrecio = 1;
const filaPorDefecto = (profile: string, seniority: string, workMode: string): Precio => ({
  id: siguienteIdPrecio++,
  profile,
  seniority,
  workMode,
  location: null,
  credits: CREDITOS_BASE[seniority] + EXTRA_MODALIDAD[workMode],
  minSalary: null,
  isActive: true,
  createdAt: new Date(ahora).toISOString(),
});

let precios: Precio[] = [];
for (const esp of especialidades) {
  if (esp.slug === 'marketing') continue; // activa y SIN ningún precio
  for (const workMode of MODALIDADES) {
    for (const seniority of SENIORITIES) {
      if (esp.slug === 'ingenieria' && seniority === 'Practicante') continue; // incompleta
      const fila = filaPorDefecto(esp.name, seniority, workMode);
      fila.createdAt = hace(300);
      if (CON_SALARIO_MINIMO.has(esp.name)) fila.minSalary = SALARIO_MINIMO[seniority];
      if (esp.slug === 'tecnologia' && seniority === 'Director') fila.credits += 2;
      // Dos combinaciones pausadas a mano.
      if (esp.slug === 'produccion-audiovisual' && seniority === 'Practicante' && workMode !== 'presential') {
        fila.isActive = false;
      }
      precios.push(fila);
    }
  }
}
// Una combinación con ubicación (el alta manual está deshabilitada, pero la columna existe).
precios.push({
  ...filaPorDefecto('Tecnología', 'Sr', 'presential'),
  location: 'Monterrey, NL',
  credits: 7,
  minSalary: 42000,
  createdAt: hace(90),
});

/** Orden de la API: profile, seniority y workMode ascendentes. */
const ordenarPrecios = (lista: Precio[]) =>
  [...lista].sort(
    (a, b) =>
      a.profile.localeCompare(b.profile, 'es') ||
      a.seniority.localeCompare(b.seniority, 'es') ||
      a.workMode.localeCompare(b.workMode, 'es')
  );

/** Vacantes (no cerradas) que usan una combinación: las de la base. */
const vacantesDe = (p: Precio) =>
  VACANTES.filter(
    (v) =>
      v.profile === p.profile &&
      v.seniority === p.seniority &&
      v.workMode === p.workMode &&
      ['active', 'paused', 'draft'].includes(v.status)
  );

/** Lo que calcula GET /api/admin/pricing/sync. */
function faltantes() {
  const activas = especialidades.filter((e) => e.isActive);
  const missingPricing: Array<{ id: number; name: string }> = [];
  const incompletePricing: Array<{
    id: number;
    name: string;
    currentCount: number;
    expected: number;
    missingCombinations: string[];
  }> = [];
  for (const esp of activas) {
    const existentes = new Set(precios.filter((p) => p.profile === esp.name).map((p) => clave(p.seniority, p.workMode)));
    if (existentes.size === 0) {
      missingPricing.push({ id: esp.id, name: esp.name });
      continue;
    }
    const faltan: string[] = [];
    for (const workMode of MODALIDADES) {
      for (const seniority of SENIORITIES) {
        if (!existentes.has(clave(seniority, workMode))) faltan.push(clave(seniority, workMode));
      }
    }
    if (faltan.length > 0) {
      incompletePricing.push({
        id: esp.id,
        name: esp.name,
        currentCount: COMBINACIONES_ESPERADAS - faltan.length,
        expected: COMBINACIONES_ESPERADAS,
        missingCombinations: faltan,
      });
    }
  }
  return { activas, missingPricing, incompletePricing };
}

// ===========================================================================
// PAQUETES DE CRÉDITOS — /api/admin/credit-packages
// ===========================================================================
interface Paquete {
  id: number;
  name: string;
  credits: number;
  price: number;
  pricePerCredit: number;
  badge: string | null;
  isActive: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

let paquetes: Paquete[] = [
  { id: 1, name: 'Pack Básico', credits: 1, price: 4000, pricePerCredit: 4000, badge: null, isActive: true, sortOrder: 1, createdAt: hace(210), updatedAt: hace(60) },
  { id: 2, name: 'Pack 10', credits: 10, price: 35000, pricePerCredit: 3500, badge: 'MÁS POPULAR', isActive: true, sortOrder: 2, createdAt: hace(210), updatedAt: hace(60) },
  { id: 3, name: 'Pack 15', credits: 15, price: 50000, pricePerCredit: 3333.33, badge: null, isActive: true, sortOrder: 3, createdAt: hace(210), updatedAt: hace(60) },
  { id: 4, name: 'Pack 20 · temporada alta', credits: 20, price: 65000, pricePerCredit: 3250, badge: 'PROMOCIÓN', isActive: true, sortOrder: 4, createdAt: hace(45), updatedAt: hace(5) },
  { id: 5, name: 'Pack 5 (piloto con centavos)', credits: 5, price: 18999.5, pricePerCredit: 3799.9, badge: null, isActive: false, sortOrder: 5, createdAt: hace(150), updatedAt: hace(100) },
];
let siguienteIdPaquete = 6;
const BADGES_VALIDOS = ['MÁS POPULAR', 'PROMOCIÓN'];

// ===========================================================================
// VENDEDORES Y COMISIONES — /api/admin/vendors, /api/admin/vendors/commissions
// ===========================================================================
interface Vendedor {
  id: number;
  code: string;
  discountPercent: number;
  commissionPercent: number;
  isActive: boolean;
  createdAt: string;
  user: { id: number; nombre: string; email: string; role: string };
}

interface Comision {
  id: number;
  vendorId: number;
  company: { id: number; nombre: string; email: string; nombreEmpresa: string };
  purchase: { id: number; credits: number; originalPrice: number; discountAmount: number; finalPrice: number };
  commission: {
    amount: number;
    status: 'pending' | 'paid';
    paidAt: string | null;
    dueDate: string | null;
    proofUrl: string | null;
  };
  createdAt: string;
}

// [nombre completo, rol, % descuento, % comisión, activo]
const PERSONAS: Array<[string, string, number, number, boolean]> = [
  [USUARIOS.vendor.nombre + ' Garza', 'vendor', 10, 10, true],
  ['Adriana Villarreal Soto', 'vendor', 15, 12.5, true],
  ['Héctor Salinas Ruiz', 'vendor', 10, 10, true],
  ['Lorena Medina Paz', 'vendor', 5, 8, true],
  ['Iván Quiroga León', 'vendor', 10, 10, false],
  ['Natalia Esquivel Mora', 'vendor', 12, 10, true],
  [USUARIOS.recruiter.nombre + ' Ortiz', 'recruiter', 10, 5, true],
  ['Óscar Benavides Luna', 'vendor', 0, 10, true],
  ['Karla Montemayor Díaz', 'vendor', 10, 10, true],
  ['Tomás Rendón Vela', 'vendor', 20, 15, true],
  ['Alejandra Guerra Nieto', 'vendor', 10, 10, false],
  ['Mauricio Tamez Olvera', 'vendor', 10, 10, true],
  ['Diana Carrillo Ortiz', 'specialist', 10, 7.5, true],
  ['Samuel Ochoa Reyna', 'vendor', 10, 10, true],
  ['Brenda Zapata Ibarra', 'vendor', 8, 10, true],
  ['Julio César Almaguer Treviño', 'vendor', 10, 10, true],
  ['Regina Fuentes Leal', 'vendor', 10, 10, true],
  ['Ernesto Cavazos Luna', 'vendor', 15, 10, false],
  ['Mónica Rangel Salas', 'vendor', 10, 10, true],
  ['Arturo Peña Chapa', 'vendor', 10, 10, true],
  ['Fabiola Cruz Rendón', 'vendor', 10, 10, true],
  ['Gerardo Leal Sierra', 'vendor', 10, 10, true],
  ['Patricia Morales Nava', 'vendor', 10, 10, true],
];

let vendedores: Vendedor[] = PERSONAS.map(([nombre, role, discountPercent, commissionPercent, isActive], i) => {
  const [pila, apellido] = quitarAcentos(nombre).toLowerCase().split(' ');
  const email =
    i === 0 ? USUARIOS.vendor.email : i === 6 ? USUARIOS.recruiter.email : `${pila}.${apellido}@correo.mx`;
  return {
    id: 300 + i,
    code: `${quitarAcentos(nombre.split(' ')[0]).toUpperCase()}${discountPercent || 'SIN'}${i > 9 ? i : ''}`.slice(0, 20),
    discountPercent,
    commissionPercent,
    isActive,
    createdAt: hace(i * 9 + 2),
    user: { id: i === 0 ? USUARIOS.vendor.id : i === 6 ? USUARIOS.recruiter.id : 600 + i, nombre, email, role },
  };
});
let siguienteIdVendedor = 400;

const EMPRESAS_COMPRADORAS = [
  { id: 20, nombre: 'Tomás Rivas', email: 'tomas.rivas@grupoandes.mx', nombreEmpresa: 'Grupo Andes' },
  { id: 21, nombre: 'Elena Cortés', email: 'elena.cortes@clinicanorte.mx', nombreEmpresa: 'Clínica Norte' },
  { id: 22, nombre: 'Raúl Mendoza', email: 'raul.mendoza@constructorasierra.mx', nombreEmpresa: 'Constructora Sierra' },
  { id: 23, nombre: 'Silvia Paredes', email: 'silvia.paredes@logisticapacifico.mx', nombreEmpresa: 'Logística Pacífico' },
  { id: 24, nombre: 'Andrés Beltrán', email: 'andres.beltran@tecdelta.mx', nombreEmpresa: 'Tecnologías Delta' },
  { id: 25, nombre: 'Verónica Solís', email: 'veronica.solis@colegiohorizonte.mx', nombreEmpresa: 'Colegio Horizonte' },
  { id: 26, nombre: 'Jaime Estrada', email: 'jaime.estrada@farmaciasdelvalle.mx', nombreEmpresa: 'Farmacias del Valle' },
  // Sin solicitud de empresa: la API devuelve «N/A».
  { id: 27, nombre: 'Claudia Ríos', email: 'claudia.rios@correo.mx', nombreEmpresa: 'N/A' },
];
const PAQUETES_VENDIDOS = [
  { credits: 10, originalPrice: 35000 },
  { credits: 1, originalPrice: 4000 },
  { credits: 15, originalPrice: 50000 },
  { credits: 20, originalPrice: 65000 },
];
// Los vendedores con ventas (índices de PERSONAS).
const CON_VENTAS = [0, 1, 2, 3, 5, 6, 8, 9, 11, 13];

let comisiones: Comision[] = Array.from({ length: 38 }, (_, i) => {
  const vendedor = vendedores[CON_VENTAS[(i * 7) % CON_VENTAS.length]];
  const empresa = EMPRESAS_COMPRADORAS[i % EMPRESAS_COMPRADORAS.length];
  const paquete = PAQUETES_VENDIDOS[i % PAQUETES_VENDIDOS.length];
  const discountAmount = redondear((paquete.originalPrice * vendedor.discountPercent) / 100);
  const finalPrice = redondear(paquete.originalPrice - discountAmount);
  // Las 8 más antiguas ya se pagaron; de las 30 pendientes, las de más de 30
  // días desde la venta están vencidas (una decena).
  const pagada = i >= 30;
  const diasDesdeVenta = pagada ? 60 + (i - 30) * 6 : 2 + i * 1.5;
  return {
    id: 700 + i,
    vendorId: vendedor.id,
    company: empresa,
    purchase: { id: 900 + i, credits: paquete.credits, originalPrice: paquete.originalPrice, discountAmount, finalPrice },
    commission: {
      amount: redondear((finalPrice * vendedor.commissionPercent) / 100),
      status: pagada ? 'paid' : 'pending',
      paidAt: pagada ? hace(diasDesdeVenta - 28) : null,
      // Plazo de pago: 30 días desde la venta. Una sin fecha, como puede venir de la base.
      dueDate: i === 5 ? null : hace(diasDesdeVenta - 30),
      proofUrl: pagada && i !== 33 ? `https://drive.google.com/file/d/comprobante-${900 + i}/view` : null,
    },
    createdAt: hace(diasDesdeVenta),
  };
});

const etiquetaComision = (status: string) =>
  status === 'paid' ? 'Pagada' : status === 'cancelled' ? 'Cancelada' : 'Pendiente';

/** Una comisión con la forma de GET /api/admin/vendors/commissions. */
function formaComision(c: Comision) {
  const vendedor = vendedores.find((v) => v.id === c.vendorId)!;
  const [nombre, apellidoPaterno] = vendedor.user.nombre.split(' ');
  return {
    id: c.id,
    vendor: { id: vendedor.user.id, nombre: `${nombre} ${apellidoPaterno ?? ''}`.trim(), email: vendedor.user.email, code: vendedor.code },
    company: c.company,
    purchase: c.purchase,
    commission: { ...c.commission, statusLabel: etiquetaComision(c.commission.status) },
    createdAt: c.createdAt,
  };
}

/** Un vendedor con la forma de GET /api/admin/vendors (con sus estadísticas). */
function formaVendedor(v: Vendedor) {
  const suyas = comisiones.filter((c) => c.vendorId === v.id);
  const suma = (lista: Comision[], campo: (c: Comision) => number) => redondear(lista.reduce((s, c) => s + campo(c), 0));
  return {
    ...v,
    stats: {
      totalSales: suyas.length,
      totalRevenue: suma(suyas, (c) => c.purchase.finalPrice),
      totalCommission: suma(suyas, (c) => c.commission.amount),
      pendingCommission: suma(suyas.filter((c) => c.commission.status === 'pending'), (c) => c.commission.amount),
      paidCommission: suma(suyas.filter((c) => c.commission.status === 'paid'), (c) => c.commission.amount),
    },
  };
}

const resumenComisiones = () => {
  const de = (status: string) => comisiones.filter((c) => c.commission.status === status);
  const total = (lista: Comision[]) => redondear(lista.reduce((s, c) => s + c.commission.amount, 0));
  return {
    pending: { count: de('pending').length, total: total(de('pending')) },
    paid: { count: de('paid').length, total: total(de('paid')) },
  };
};

// ===========================================================================
// FIXTURES
// ===========================================================================
export const fixtures: Fixture[] = [
  // ---------------------------------------------------------------- especialidades
  {
    metodo: 'GET',
    patron: '/api/admin/specialties',
    respuesta: ({ url }) => {
      const lista = [...especialidades]
        .filter((e) => url.searchParams.get('activeOnly') !== 'true' || e.isActive)
        .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name, 'es'));
      return { success: true, data: lista, count: lista.length };
    },
  },
  {
    metodo: 'POST',
    patron: '/api/admin/specialties',
    respuesta: ({ cuerpo }) => {
      const datos = (cuerpo ?? {}) as Partial<Especialidad>;
      const name = String(datos.name ?? '').trim();
      if (!name) return json({ success: false, error: 'El nombre es requerido' }, 400);
      if (especialidades.some((e) => e.name.toLowerCase() === name.toLowerCase())) {
        return json({ success: false, error: 'Ya existe una especialidad con ese nombre' }, 409);
      }
      const nueva: Especialidad = {
        id: siguienteIdEspecialidad++,
        name,
        slug: aSlug(name),
        description: datos.description || null,
        icon: datos.icon || null,
        color: datos.color || '#2b5d62',
        subcategories: datos.subcategories ?? [],
        sortOrder: datos.sortOrder ?? especialidades.length + 1,
        isActive: datos.isActive ?? true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      especialidades = [...especialidades, nueva];
      const generados = MODALIDADES.flatMap((m) => SENIORITIES.map((s) => filaPorDefecto(name, s, m)));
      precios = [...precios, ...generados];
      return json(
        {
          success: true,
          message: `Especialidad creada exitosamente con ${generados.length} precios generados`,
          data: nueva,
          pricingGenerated: generados.length,
        },
        201
      );
    },
  },
  {
    metodo: 'PUT',
    patron: '/api/admin/specialties/:id',
    respuesta: ({ params, cuerpo }) => {
      const id = Number(params.id);
      const actual = especialidades.find((e) => e.id === id);
      if (!actual) return json({ success: false, error: 'Especialidad no encontrada' }, 404);
      const cambios = (cuerpo ?? {}) as Partial<Especialidad>;
      if (cambios.name !== undefined && !String(cambios.name).trim()) {
        return json({ success: false, error: 'El nombre no puede quedar vacío' }, 400);
      }
      const nuevoNombre = cambios.name !== undefined ? String(cambios.name).trim() : actual.name;
      if (nuevoNombre !== actual.name && especialidades.some((e) => e.id !== id && e.name.toLowerCase() === nuevoNombre.toLowerCase())) {
        return json({ success: false, error: 'Ya existe una especialidad con ese nombre' }, 409);
      }
      if (cambios.color !== undefined && !/^#[0-9a-fA-F]{6}$/.test(String(cambios.color))) {
        return json({ success: false, error: 'color debe ser un hexadecimal tipo #2b5d62' }, 400);
      }
      const actualizada: Especialidad = {
        ...actual,
        ...cambios,
        name: nuevoNombre,
        slug: aSlug(nuevoNombre),
        description: cambios.description !== undefined ? cambios.description || null : actual.description,
        icon: cambios.icon !== undefined ? cambios.icon || null : actual.icon,
        updatedAt: new Date().toISOString(),
      };
      let propagados = { pricing: 0, jobs: 0, candidates: 0, users: 0 };
      if (nuevoNombre !== actual.name) {
        precios = precios.map((p) => (p.profile === actual.name ? { ...p, profile: nuevoNombre } : p));
        propagados = {
          pricing: precios.filter((p) => p.profile === nuevoNombre).length,
          jobs: VACANTES.filter((v) => v.profile === actual.name).length,
          candidates: 4,
          users: 1,
        };
      }
      especialidades = especialidades.map((e) => (e.id === id ? actualizada : e));
      return { success: true, message: 'Especialidad actualizada exitosamente', data: actualizada, propagated: propagados };
    },
  },
  {
    metodo: 'DELETE',
    patron: '/api/admin/specialties/:id',
    respuesta: ({ params }) => {
      const id = Number(params.id);
      const actual = especialidades.find((e) => e.id === id);
      if (!actual) return json({ success: false, error: 'Especialidad no encontrada' }, 404);
      const jobs = VACANTES.filter((v) => v.profile === actual.name).length;
      // Candidatos y especialistas: inventados, sólo para las que tienen vacantes.
      const candidates = jobs > 0 ? jobs * 3 : 0;
      const specialists = jobs > 0 ? 1 : 0;
      if (jobs + candidates + specialists > 0) {
        const detalle = [
          jobs > 0 ? `${jobs} vacante(s)` : null,
          candidates > 0 ? `${candidates} candidato(s)` : null,
          specialists > 0 ? `${specialists} especialista(s)` : null,
        ]
          .filter(Boolean)
          .join(', ');
        return json(
          {
            success: false,
            error: `No se puede eliminar: hay ${detalle} usando esta especialidad. Puedes desactivarla en lugar de borrarla.`,
            inUse: { jobs, candidates, specialists },
          },
          409
        );
      }
      const borrados = precios.filter((p) => p.profile === actual.name).length;
      precios = precios.filter((p) => p.profile !== actual.name);
      especialidades = especialidades.filter((e) => e.id !== id);
      return {
        success: true,
        message: `Especialidad "${actual.name}" eliminada junto con ${borrados} precios asociados`,
      };
    },
  },

  // ---------------------------------------------------------------- matriz de precios
  // /sync antes que /pricing: son rutas distintas, pero así se lee el orden.
  {
    metodo: 'GET',
    patron: '/api/admin/pricing/sync',
    respuesta: () => {
      const { activas, missingPricing, incompletePricing } = faltantes();
      return {
        success: true,
        data: {
          totalSpecialties: activas.length,
          withCompletePricing: activas.length - missingPricing.length - incompletePricing.length,
          missingPricing,
          incompletePricing,
        },
      };
    },
  },
  {
    metodo: 'POST',
    patron: '/api/admin/pricing/sync',
    respuesta: () => {
      const syncedSpecialties: Array<{ name: string; created: number }> = [];
      let totalCreated = 0;
      for (const esp of especialidades.filter((e) => e.isActive)) {
        const existentes = new Set(precios.filter((p) => p.profile === esp.name).map((p) => clave(p.seniority, p.workMode)));
        const nuevas = MODALIDADES.flatMap((m) => SENIORITIES.map((s) => [s, m] as const))
          .filter(([s, m]) => !existentes.has(clave(s, m)))
          .map(([s, m]) => filaPorDefecto(esp.name, s, m));
        if (nuevas.length > 0) {
          precios = [...precios, ...nuevas];
          totalCreated += nuevas.length;
          syncedSpecialties.push({ name: esp.name, created: nuevas.length });
        }
      }
      return {
        success: true,
        message:
          totalCreated > 0
            ? `Sincronización completada: ${totalCreated} precios creados`
            : 'Todas las especialidades ya tienen sus precios completos',
        data: { totalCreated, syncedSpecialties },
      };
    },
  },
  {
    metodo: 'GET',
    patron: '/api/admin/pricing',
    respuesta: ({ url }) => {
      const perfil = url.searchParams.get('profile');
      const seniority = url.searchParams.get('seniority');
      const workMode = url.searchParams.get('workMode');
      const lista = ordenarPrecios(
        precios.filter(
          (p) =>
            (!perfil || p.profile === perfil) &&
            (!seniority || p.seniority === seniority) &&
            (!workMode || p.workMode === workMode)
        )
      );
      const perfiles = [...new Set(precios.map((p) => p.profile))].sort((a, b) => a.localeCompare(b, 'es'));
      return { success: true, data: lista, count: lista.length, profiles: perfiles };
    },
  },
  {
    metodo: 'PUT',
    patron: '/api/admin/pricing',
    respuesta: ({ cuerpo }) => {
      const datos = (cuerpo ?? {}) as { id?: number; credits?: number; minSalary?: number | null; isActive?: boolean };
      if (datos.id === undefined) return json({ success: false, error: 'ID requerido' }, 400);
      const actual = precios.find((p) => p.id === Number(datos.id));
      if (!actual) return json({ success: false, error: 'Entrada no encontrada' }, 404);
      if (datos.credits !== undefined && (!Number.isInteger(datos.credits) || datos.credits < 1)) {
        return json({ success: false, error: 'Credits debe ser un número entero mayor o igual a 1' }, 400);
      }
      if (
        datos.minSalary !== undefined &&
        datos.minSalary !== null &&
        (!Number.isInteger(datos.minSalary) || datos.minSalary < 0)
      ) {
        return json({ success: false, error: 'minSalary debe ser un número entero positivo o null' }, 400);
      }
      const actualizada: Precio = {
        ...actual,
        ...(datos.credits !== undefined ? { credits: datos.credits } : {}),
        ...(datos.minSalary !== undefined ? { minSalary: datos.minSalary } : {}),
        ...(datos.isActive !== undefined ? { isActive: datos.isActive } : {}),
      };
      precios = precios.map((p) => (p.id === actual.id ? actualizada : p));
      return {
        success: true,
        message: 'Entrada actualizada exitosamente',
        data: actualizada,
        affectedJobs: datos.isActive === false ? vacantesDe(actualizada).length : 0,
      };
    },
  },
  {
    metodo: 'DELETE',
    patron: '/api/admin/pricing',
    respuesta: ({ url }) => {
      const id = url.searchParams.get('id');
      if (!id) return json({ success: false, error: 'ID requerido' }, 400);
      const actual = precios.find((p) => p.id === Number(id));
      if (!actual) return json({ success: false, error: 'Entrada no encontrada' }, 404);
      const activeJobs = vacantesDe(actual);
      if (activeJobs.length > 0) {
        return json(
          {
            success: false,
            error: `No se puede eliminar. Hay ${activeJobs.length} vacante(s) usando esta configuración de precios.`,
            activeJobs: activeJobs.map((v) => ({ id: v.id, title: v.title, company: v.company, status: v.status })),
          },
          409
        );
      }
      precios = precios.filter((p) => p.id !== actual.id);
      return {
        success: true,
        message: `Entrada de precios eliminada: ${actual.profile} - ${actual.seniority} - ${actual.workMode}`,
      };
    },
  },

  // ---------------------------------------------------------------- paquetes de créditos
  {
    metodo: 'GET',
    patron: '/api/admin/credit-packages',
    respuesta: () => ({ success: true, data: [...paquetes].sort((a, b) => a.sortOrder - b.sortOrder) }),
  },
  {
    metodo: 'POST',
    patron: '/api/admin/credit-packages',
    respuesta: ({ cuerpo }) => {
      const datos = (cuerpo ?? {}) as Partial<Paquete>;
      const name = String(datos.name ?? '').trim();
      if (!name || datos.credits === undefined || datos.price === undefined) {
        return json({ success: false, error: 'Campos requeridos: name, credits, price' }, 400);
      }
      if (name.length > 60) return json({ success: false, error: 'El nombre debe tener entre 1 y 60 caracteres' }, 400);
      if (!Number.isInteger(datos.credits) || datos.credits <= 0) {
        return json({ success: false, error: 'La cantidad de créditos debe ser un entero mayor a 0' }, 400);
      }
      if (typeof datos.price !== 'number' || datos.price <= 0) {
        return json({ success: false, error: 'El precio debe ser mayor a 0' }, 400);
      }
      if (datos.badge && !BADGES_VALIDOS.includes(datos.badge)) {
        return json({ success: false, error: 'Badge inválido. Opciones: MÁS POPULAR, PROMOCIÓN' }, 400);
      }
      const duplicado = paquetes.find((p) => p.isActive && p.credits === datos.credits);
      if (duplicado) {
        return json(
          {
            success: false,
            error: `Ya existe un paquete activo de ${datos.credits} crédito(s) ("${duplicado.name}"). Desactívalo o edítalo en lugar de duplicarlo.`,
          },
          409
        );
      }
      const nuevo: Paquete = {
        id: siguienteIdPaquete++,
        name,
        credits: datos.credits,
        price: datos.price,
        pricePerCredit: redondear(datos.price / datos.credits),
        badge: datos.badge || null,
        isActive: true,
        sortOrder: datos.sortOrder ?? 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      paquetes = [...paquetes, nuevo];
      return json({ success: true, message: 'Paquete creado exitosamente', data: nuevo }, 201);
    },
  },
  {
    metodo: 'PUT',
    patron: '/api/admin/credit-packages/:id',
    respuesta: ({ params, cuerpo }) => {
      const actual = paquetes.find((p) => p.id === Number(params.id));
      if (!actual) return json({ success: false, error: 'Paquete no encontrado' }, 404);
      const cambios = (cuerpo ?? {}) as Partial<Paquete>;
      const credits = cambios.credits ?? actual.credits;
      const price = cambios.price ?? actual.price;
      const isActive = cambios.isActive ?? actual.isActive;
      if (!Number.isInteger(credits) || credits <= 0) {
        return json({ success: false, error: 'La cantidad de créditos debe ser un entero mayor a 0' }, 400);
      }
      if (typeof price !== 'number' || price <= 0) {
        return json({ success: false, error: 'El precio debe ser mayor a 0' }, 400);
      }
      const duplicado = isActive && paquetes.find((p) => p.id !== actual.id && p.isActive && p.credits === credits);
      if (duplicado) {
        return json(
          { success: false, error: `Ya existe un paquete activo de ${credits} crédito(s) ("${duplicado.name}").` },
          409
        );
      }
      const actualizado: Paquete = {
        ...actual,
        ...cambios,
        credits,
        price,
        isActive,
        badge: cambios.badge !== undefined ? cambios.badge || null : actual.badge,
        pricePerCredit: redondear(price / credits),
        updatedAt: new Date().toISOString(),
      };
      paquetes = paquetes.map((p) => (p.id === actual.id ? actualizado : p));
      return { success: true, message: 'Paquete actualizado exitosamente', data: actualizado };
    },
  },
  {
    metodo: 'DELETE',
    patron: '/api/admin/credit-packages/:id',
    respuesta: ({ params }) => {
      const actual = paquetes.find((p) => p.id === Number(params.id));
      if (!actual) return json({ success: false, error: 'Paquete no encontrado' }, 404);
      paquetes = paquetes.map((p) => (p.id === actual.id ? { ...p, isActive: false } : p));
      return { success: true, message: 'Paquete desactivado exitosamente' };
    },
  },

  // ---------------------------------------------------------------- comisiones (antes que /vendors/:id)
  {
    metodo: 'GET',
    patron: '/api/admin/vendors/commissions',
    respuesta: ({ url }) => {
      const { page, limit, skip } = paginar(url);
      const status = url.searchParams.get('status');
      // Orden de la API: pendientes primero, la fecha límite más próxima arriba.
      const lista = comisiones
        .filter((c) => !status || c.commission.status === status)
        .sort(
          (a, b) =>
            b.commission.status.localeCompare(a.commission.status) ||
            (a.commission.dueDate ?? '9999').localeCompare(b.commission.dueDate ?? '9999') ||
            b.createdAt.localeCompare(a.createdAt)
        );
      return {
        success: true,
        data: {
          commissions: lista.slice(skip, skip + limit).map(formaComision),
          summary: resumenComisiones(),
          pagination: { page, limit, totalCount: lista.length, totalPages: Math.ceil(lista.length / limit) },
        },
      };
    },
  },
  {
    metodo: 'PUT',
    patron: '/api/admin/vendors/commissions/:id',
    respuesta: ({ params, cuerpo }) => {
      const actual = comisiones.find((c) => c.id === Number(params.id));
      if (!actual) return json({ success: false, error: 'Comisión no encontrada' }, 404);
      const datos = (cuerpo ?? {}) as { status?: string; paymentProofUrl?: string | null };
      if (datos.status && !['pending', 'paid'].includes(datos.status)) {
        return json({ success: false, error: 'Estado inválido. Usar: pending, paid' }, 400);
      }
      if (datos.paymentProofUrl && !/^https?:\/\/\S+$/i.test(datos.paymentProofUrl)) {
        return json({ success: false, error: 'El comprobante debe ser una URL http(s) completa (incluye https://)' }, 400);
      }
      if (datos.status === 'paid' && actual.commission.status === 'paid') {
        return json({ success: false, error: 'La comisión ya fue pagada por otro administrador.' }, 409);
      }
      const pagada: Comision = {
        ...actual,
        commission: {
          ...actual.commission,
          status: datos.status === 'paid' ? 'paid' : actual.commission.status,
          paidAt: datos.status === 'paid' ? new Date().toISOString() : actual.commission.paidAt,
          proofUrl: datos.paymentProofUrl ?? actual.commission.proofUrl,
        },
      };
      comisiones = comisiones.map((c) => (c.id === actual.id ? pagada : c));
      const forma = formaComision(pagada);
      return {
        success: true,
        data: {
          id: forma.id,
          vendor: forma.vendor,
          commission: {
            amount: forma.commission.amount,
            status: forma.commission.status,
            statusLabel: forma.commission.statusLabel,
            paidAt: forma.commission.paidAt,
            proofUrl: forma.commission.proofUrl,
          },
          purchaseId: pagada.purchase.id,
        },
        message: datos.status === 'paid' ? 'Comisión marcada como pagada' : 'Comisión actualizada',
      };
    },
  },

  // ---------------------------------------------------------------- vendedores
  {
    metodo: 'GET',
    patron: '/api/admin/vendors',
    respuesta: ({ url }) => {
      const { page, limit, skip } = paginar(url);
      const busqueda = (url.searchParams.get('search') || '').toLowerCase();
      const lista = [...vendedores]
        .filter(
          (v) =>
            !busqueda ||
            v.code.toLowerCase().includes(busqueda) ||
            v.user.nombre.toLowerCase().includes(busqueda) ||
            v.user.email.toLowerCase().includes(busqueda)
        )
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
      const resumen = resumenComisiones();
      return {
        success: true,
        data: {
          vendors: lista.slice(skip, skip + limit).map(formaVendedor),
          // Globales: sin el filtro de búsqueda (como la API).
          globalStats: {
            totalVendors: vendedores.length,
            totalSales: comisiones.length,
            totalRevenue: redondear(comisiones.reduce((s, c) => s + c.purchase.finalPrice, 0)),
            totalCommissions: redondear(resumen.pending.total + resumen.paid.total),
            pendingCommissions: resumen.pending.total,
          },
          pagination: { page, limit, totalCount: lista.length, totalPages: Math.ceil(lista.length / limit) },
        },
      };
    },
  },
  {
    metodo: 'POST',
    patron: '/api/admin/vendors',
    respuesta: ({ cuerpo }) => {
      const datos = (cuerpo ?? {}) as {
        nombre?: string;
        apellidoPaterno?: string;
        apellidoMaterno?: string;
        email?: string;
        code?: string;
        discountPercent?: number;
        commissionPercent?: number;
      };
      const email = String(datos.email ?? '').trim().toLowerCase();
      const code = String(datos.code ?? '').trim().toUpperCase();
      if (vendedores.some((v) => v.user.email.toLowerCase() === email)) {
        return json({ success: false, error: 'Ya existe un usuario con ese email' }, 409);
      }
      if (vendedores.some((v) => v.code === code)) {
        return json({ success: false, error: 'Ya existe un código de descuento con ese nombre' }, 409);
      }
      const nombre = [datos.nombre, datos.apellidoPaterno, datos.apellidoMaterno].filter(Boolean).join(' ').trim();
      const id = siguienteIdVendedor++;
      const nuevo: Vendedor = {
        id,
        code,
        discountPercent: Number(datos.discountPercent ?? 10),
        commissionPercent: Number(datos.commissionPercent ?? 10),
        isActive: true,
        createdAt: new Date().toISOString(),
        user: { id: id + 1000, nombre, email, role: 'vendor' },
      };
      vendedores = [nuevo, ...vendedores];
      return json(
        {
          success: true,
          data: {
            user: { id: nuevo.user.id, nombre: `${datos.nombre ?? ''} ${datos.apellidoPaterno ?? ''}`.trim(), email, role: 'vendor' },
            code: { id, code, discountPercent: nuevo.discountPercent, commissionPercent: nuevo.commissionPercent },
          },
          message: `Vendedor ${datos.nombre ?? ''} creado con código ${code}`,
        },
        201
      );
    },
  },
  {
    metodo: 'PATCH',
    patron: '/api/admin/vendors/:id',
    respuesta: ({ params, cuerpo }) => {
      const actual = vendedores.find((v) => v.id === Number(params.id));
      if (!actual) return json({ success: false, error: 'Código de vendedor no encontrado' }, 404);
      const datos = (cuerpo ?? {}) as { isActive?: boolean };
      if (typeof datos.isActive !== 'boolean') return json({ success: false, error: 'Datos inválidos' }, 400);
      const actualizado = { ...actual, isActive: datos.isActive };
      vendedores = vendedores.map((v) => (v.id === actual.id ? actualizado : v));
      const [nombre, apellidoPaterno] = actualizado.user.nombre.split(' ');
      return {
        success: true,
        data: {
          id: actualizado.id,
          code: actualizado.code,
          discountPercent: actualizado.discountPercent,
          commissionPercent: actualizado.commissionPercent,
          isActive: actualizado.isActive,
          updatedAt: new Date().toISOString(),
          user: { id: actualizado.user.id, nombre, apellidoPaterno: apellidoPaterno ?? null, email: actualizado.user.email },
        },
        message: 'Código de vendedor actualizado',
      };
    },
  },
];
