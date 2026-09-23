// RUTA: src/app/api/profile/route.ts

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';
import { isSafeHttpUrl } from '@/lib/sanitize';
import { applyRateLimit } from '@/lib/rate-limit';
import { del } from '@vercel/blob';
import { z } from 'zod';
import bcrypt from 'bcryptjs';

/** Cambio de contraseña: 5 intentos por 15 minutos por IP (#PERF-023). */
const PROFILE_PASSWORD_RATE_LIMIT = { maxRequests: 5, windowSeconds: 15 * 60 };

/**
 * Política de contraseña: la MISMA que registro y reset-password (#PERF-024).
 * PUT /api/profile sólo exigía longitud >= 8, así que desde el perfil se podía
 * saltar la política con 'aaaaaaaa'.
 */
const passwordSchema = z
  .string()
  .min(8, 'La nueva contraseña debe tener al menos 8 caracteres')
  .regex(/[A-Z]/, 'La contraseña debe contener al menos una mayúscula')
  .regex(/[0-9]/, 'La contraseña debe contener al menos un número');

/**
 * ¿La URL apunta a NUESTRO almacenamiento? (#PERF-002)
 *
 * cvUrl sólo pasaba por normalizeUrl y fotoUrl no se validaba en absoluto, así
 * que un candidato podía guardar https://login-inakat.example/... y el
 * reclutador aterrizaba ahí con un clic desde la ficha.
 *
 * En desarrollo /api/upload devuelve rutas relativas '/uploads/<archivo>'
 * cuando no hay BLOB_READ_WRITE_TOKEN; se aceptan fuera de producción.
 *
 * (Duplicado a propósito con api/profile/documents/route.ts: un route.ts no
 * puede exportar nada que no sea un handler. Centralizar en src/lib.)
 */
function esUrlDeNuestroAlmacenamiento(value: unknown): value is string {
  if (typeof value !== 'string') return false;

  const limpio = value.trim();
  if (limpio === '') return false;

  if (limpio.startsWith('/uploads/')) {
    return process.env.NODE_ENV !== 'production' && !limpio.includes('..');
  }

  let parsed: URL;
  try {
    parsed = new URL(limpio);
  } catch {
    return false;
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return false;

  return parsed.hostname.endsWith('.public.blob.vercel-storage.com');
}

/**
 * Borra el archivo anterior al reemplazar foto o CV (#PERF-003). Best-effort:
 * si falla, se registra y se sigue.
 */
async function borrarBlobSiEsNuestro(fileUrl: string | null | undefined) {
  if (!fileUrl || !esUrlDeNuestroAlmacenamiento(fileUrl)) return;
  if (fileUrl.startsWith('/uploads/')) return; // fallback local: no hay blob

  try {
    await del(fileUrl);
  } catch (error) {
    console.error('[Perfil] No se pudo eliminar el blob:', fileUrl, error);
  }
}

// =============================================
// VALIDACIÓN DE candidateData (#PERF-025, #PERF-006, #PERF-008)
// =============================================

/** Texto opcional: '' y null significan "bórralo". */
const textoOpcional = (max: number) =>
  z.preprocess(
    (v) => (v === '' ? null : v),
    z.string().trim().max(max, `Máximo ${max} caracteres`).nullable().optional()
  );

/** URL de perfil (LinkedIn, portafolio): se completa el esquema y se exige http(s). */
const urlPerfilOpcional = (etiqueta: string) =>
  z.preprocess(
    (v) => {
      if (v === '' || v === null || v === undefined) return null;
      if (typeof v !== 'string') return v;
      const limpio = v.trim();
      if (limpio === '') return null;
      return /^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(limpio) ? limpio : `https://${limpio}`;
    },
    z
      .string()
      .max(500)
      .refine(isSafeHttpUrl, `${etiqueta} debe ser una dirección http(s) válida`)
      .nullable()
      .optional()
  );

/** URL de archivo propio (CV, foto): sólo nuestro almacenamiento (#PERF-002). */
const urlDeArchivoOpcional = (etiqueta: string) =>
  z.preprocess(
    (v) => (v === '' ? null : v),
    z
      .string()
      .refine(esUrlDeNuestroAlmacenamiento, `${etiqueta} debe ser un archivo subido a INAKAT`)
      .nullable()
      .optional()
  );

const fechaNacimientoOpcional = z.preprocess(
  (v) => (v === '' ? null : v),
  z
    .union([z.string(), z.date()])
    .refine((v) => !Number.isNaN(new Date(v).getTime()), { message: 'Fecha de nacimiento inválida' })
    .transform((v) => new Date(v))
    .refine((d) => d.getTime() <= Date.now(), { message: 'La fecha de nacimiento no puede ser futura' })
    .refine((d) => d.getUTCFullYear() >= 1900, { message: 'Fecha de nacimiento inválida' })
    .nullable()
    .optional()
);

/**
 * Texto de una entrada de educación: null (lo guardan el alta de admin y datos
 * antiguos) cuenta como vacío. Un objeto o un número siguen siendo un 400.
 */
const textoEducacion = (max: number) =>
  z.preprocess(
    (v) => (v === null || v === undefined ? '' : v),
    z.string().trim().max(max)
  );

/**
 * Año de una entrada de educación. Se aceptan también cadenas numéricas
 * ('2015') porque la UI reenvía TODO el array en cada guardado: un formato
 * antiguo en una sola entrada bloqueaba cualquier cambio del perfil. El mínimo
 * es el mismo que acepta el registro (1900).
 */
const anioEducacion = z.preprocess(
  (v) => {
    if (v === '' || v === null || v === undefined) return null;
    if (typeof v === 'string' && /^\d{4}$/.test(v.trim())) return Number(v.trim());
    return v;
  },
  z.number().int().min(1900).max(2100).nullable()
);

/** Una entrada de educación (#PERF-006). */
const educacionEntradaSchema = z.object({
  id: z.number().optional(),
  nivel: textoEducacion(80),
  institucion: textoEducacion(200),
  carrera: textoEducacion(200),
  añoInicio: anioEducacion.optional(),
  añoFin: anioEducacion.optional(),
  estatus: textoEducacion(80)
});

/**
 * Normaliza el JSON de educación guardado antes de devolverlo (#PERF-006).
 *
 * Datos antiguos (o dados de alta por admin sin validar) pueden traer `null`
 * dentro del array o campos que no son texto. Como /profile reenvía el array
 * completo en cada guardado, devolverlos tal cual hacía que el PUT respondiera
 * 400 para siempre. Se descartan las entradas que no son objetos y se
 * coaccionan los campos.
 */
function normalizarEducacionGuardada(entradas: unknown[]): Array<Record<string, unknown>> {
  const texto = (v: unknown) => (typeof v === 'string' || typeof v === 'number' ? String(v) : '');
  const anio = (v: unknown) => {
    const n = typeof v === 'string' ? Number(v) : v;
    return typeof n === 'number' && Number.isInteger(n) && n >= 1900 && n <= 2100 ? n : null;
  };

  return entradas
    .filter((e): e is Record<string, unknown> => !!e && typeof e === 'object' && !Array.isArray(e))
    .map((e, index) => ({
      id: typeof e.id === 'number' && Number.isFinite(e.id) ? e.id : index + 1,
      nivel: texto(e.nivel),
      institucion: texto(e.institucion),
      carrera: texto(e.carrera),
      añoInicio: anio(e.añoInicio),
      añoFin: anio(e.añoFin),
      estatus: texto(e.estatus)
    }));
}

const candidateDataSchema = z.object({
  nombre: z.string().trim().min(1, 'El nombre es requerido').max(100).optional(),
  apellidoPaterno: z.string().trim().min(1, 'El apellido paterno es requerido').max(100).optional(),
  apellidoMaterno: textoOpcional(100),
  // Se acepta el formato que la gente escribe (con espacios o guiones), pero se
  // exige un número plausible: entre 10 y 13 dígitos.
  telefono: z.preprocess(
    (v) => (v === '' ? null : v),
    z
      .string()
      .trim()
      .max(25)
      .refine((v) => {
        const digitos = v.replace(/\D/g, '');
        return digitos.length >= 10 && digitos.length <= 13;
      }, 'Teléfono inválido. Formato: 5512345678 o +52 55 1234 5678')
      .nullable()
      .optional()
  ),
  fechaNacimiento: fechaNacimientoOpcional,
  sexo: z.preprocess(
    (v) => (v === '' ? null : v),
    z.enum(['M', 'F', 'Otro']).nullable().optional()
  ),
  ciudad: textoOpcional(100),
  estado: textoOpcional(100),
  ubicacionCercana: textoOpcional(200),
  latitude: z.number().min(-90).max(90).nullable().optional(),
  longitude: z.number().min(-180).max(180).nullable().optional(),
  universidad: textoOpcional(200),
  carrera: textoOpcional(200),
  nivelEstudios: textoOpcional(50),
  // #PERF-008: la columna es Int NOT NULL. La UI mandaba null al vaciar el
  // input y Prisma reventaba con un 500 genérico que tiraba TODO el guardado.
  // '' y null se tratan como "no lo toques".
  añosExperiencia: z.preprocess(
    (v) => (v === '' || v === null ? undefined : v),
    z
      .number()
      .int('Años de experiencia debe ser un número entero')
      .min(0, 'Años de experiencia no puede ser negativo')
      .max(60, 'Años de experiencia fuera de rango')
      .optional()
  ),
  profile: textoOpcional(100),
  seniority: z.preprocess(
    (v) => (v === '' ? null : v),
    z
      .enum(['Practicante', 'Jr', 'Middle', 'Sr', 'Director'])
      .nullable()
      .optional()
  ),
  linkedinUrl: urlPerfilOpcional('El enlace de LinkedIn'),
  portafolioUrl: urlPerfilOpcional('El enlace del portafolio'),
  cvUrl: urlDeArchivoOpcional('El CV'),
  fotoUrl: urlDeArchivoOpcional('La foto'),
  cartaPresentacion: textoOpcional(1000),
  educacion: z.array(educacionEntradaSchema).max(15, 'Máximo 15 entradas de educación').optional()
});

// Select completo para obtener datos del perfil con relaciones
const profileSelect = {
  id: true,
  email: true,
  nombre: true,
  role: true,
  password: true,
  credits: true,
  createdAt: true,
  candidate: {
    select: {
      id: true,
      nombre: true,
      apellidoPaterno: true,
      apellidoMaterno: true,
      telefono: true,
      fechaNacimiento: true,
      sexo: true,
      ciudad: true,
      estado: true,
      ubicacionCercana: true,
      latitude: true,
      longitude: true,
      universidad: true,
      carrera: true,
      nivelEstudios: true,
      educacion: true,
      añosExperiencia: true,
      profile: true,
      seniority: true,
      linkedinUrl: true,
      portafolioUrl: true,
      cvUrl: true,
      fotoUrl: true,
      cartaPresentacion: true,
      experiences: {
        orderBy: { fechaInicio: 'desc' as const }
      }
    }
  },
  companyRequest: {
    select: {
      nombreEmpresa: true
    }
  }
};

/**
 * GET /api/profile
 * Obtiene el perfil del usuario autenticado
 */
export async function GET() {
  try {
    const auth = await requireAuth();
    if ('error' in auth) {
      return NextResponse.json(
        { success: false, error: auth.error },
        { status: auth.status }
      );
    }

    const user = await prisma.user.findUnique({
      where: { id: auth.user.id },
      select: profileSelect
    });

    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Usuario no encontrado' },
        { status: 404 }
      );
    }

    // Construir respuesta según el rol
    const profileData: any = {
      id: user.id,
      email: user.email,
      nombre: user.nombre,
      role: user.role,
      createdAt: user.createdAt
    };

    // Datos adicionales según rol
    if (user.role === 'company') {
      profileData.company = user.companyRequest?.nombreEmpresa || null;
      profileData.credits = user.credits;
    }

    // Datos de candidato si existe
    if (user.candidate) {
      // Parsear educación JSON si existe
      let educacionArray: any[] = [];
      let educacionGuardada = false;
      if (user.candidate.educacion) {
        try {
          const parsed = JSON.parse(user.candidate.educacion);
          if (Array.isArray(parsed)) {
            educacionArray = normalizarEducacionGuardada(parsed);
            educacionGuardada = true;
          }
        } catch {
          educacionArray = [];
        }
      }

      // Si NUNCA se guardó educación pero sí hay datos legacy, fabricar una
      // entrada inicial a partir de ellos.
      //
      // #PERF-007: el fallback sólo aplica cuando `educacion` es null. Antes se
      // aplicaba también con '[]' guardado, así que la última entrada que el
      // candidato borraba reaparecía en el siguiente GET.
      //
      // #PERF-022: no se inventan 'Licenciatura' ni 'Completa'. Esos valores
      // por defecto acababan persistidos como reales en el siguiente guardado y
      // metían al candidato en los filtros de licenciados.
      if (!educacionGuardada && (user.candidate.universidad || user.candidate.carrera)) {
        educacionArray = [{
          id: 1,
          nivel: user.candidate.nivelEstudios || '',
          institucion: user.candidate.universidad || '',
          carrera: user.candidate.carrera || '',
          añoInicio: null,
          añoFin: null,
          estatus: ''
        }];
      }

      profileData.candidate = {
        id: user.candidate.id,
        nombre: user.candidate.nombre,
        apellidoPaterno: user.candidate.apellidoPaterno,
        apellidoMaterno: user.candidate.apellidoMaterno,
        telefono: user.candidate.telefono,
        fechaNacimiento: user.candidate.fechaNacimiento,
        sexo: user.candidate.sexo,
        ciudad: user.candidate.ciudad,
        estado: user.candidate.estado,
        ubicacionCercana: user.candidate.ubicacionCercana,
        latitude: user.candidate.latitude,
        longitude: user.candidate.longitude,
        universidad: user.candidate.universidad,
        carrera: user.candidate.carrera,
        nivelEstudios: user.candidate.nivelEstudios,
        añosExperiencia: user.candidate.añosExperiencia,
        profile: user.candidate.profile,
        seniority: user.candidate.seniority,
        linkedinUrl: user.candidate.linkedinUrl,
        portafolioUrl: user.candidate.portafolioUrl,
        cvUrl: user.candidate.cvUrl,
        fotoUrl: user.candidate.fotoUrl, // FEAT-2: Foto de perfil
        cartaPresentacion: user.candidate.cartaPresentacion || null,
        experiences: user.candidate.experiences || [],
        educacion: educacionArray
      };
    }

    return NextResponse.json({
      success: true,
      data: profileData
    });

  } catch (error) {
    console.error('Error fetching profile:', error);
    return NextResponse.json(
      { success: false, error: 'Error al obtener perfil' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/profile
 * Actualiza el perfil del usuario autenticado
 */
export async function PUT(request: Request) {
  try {
    const auth = await requireAuth();
    if ('error' in auth) {
      return NextResponse.json(
        { success: false, error: auth.error },
        { status: auth.status }
      );
    }

    const user = await prisma.user.findUnique({
      where: { id: auth.user.id },
      select: profileSelect
    });

    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Usuario no encontrado' },
        { status: 404 }
      );
    }
    let body: any;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { success: false, error: 'Cuerpo de la petición inválido' },
        { status: 400 }
      );
    }

    // Campos que el usuario puede actualizar
    const { nombre, currentPassword, newPassword, candidateData } = body || {};

    // -----------------------------------------------------------------
    // 1) VALIDAR TODO ANTES DE ESCRIBIR NADA (#PERF-005)
    //
    // Antes prisma.user.update (nombre y contraseña) se confirmaba y DESPUÉS se
    // actualizaba el candidato: si esa segunda escritura lanzaba, la respuesta
    // era 500 pero la contraseña YA había cambiado, y el reintento fallaba con
    // «Contraseña actual incorrecta».
    // -----------------------------------------------------------------

    if (nombre !== undefined && (typeof nombre !== 'string' || nombre.trim().length === 0)) {
      return NextResponse.json(
        { success: false, error: 'El nombre de usuario no puede estar vacío' },
        { status: 400 }
      );
    }

    let hashedPassword: string | null = null;

    if (newPassword) {
      // SECURITY (#PERF-023): sin rate limit, quien roba una cookie puede
      // probar contraseñas sin límite contra este endpoint para averiguar la
      // actual y quedarse con la cuenta. El login sí lo tenía.
      const rateLimited = applyRateLimit(request, 'profile-password', PROFILE_PASSWORD_RATE_LIMIT);
      if (rateLimited) return rateLimited;

      if (!currentPassword || typeof currentPassword !== 'string') {
        return NextResponse.json(
          { success: false, error: 'Debes proporcionar tu contraseña actual' },
          { status: 400 }
        );
      }

      // Validar la nueva contraseña ANTES de comparar la actual: así no se gasta
      // un bcrypt por cada petición mal formada.
      const passwordParsed = passwordSchema.safeParse(newPassword);
      if (!passwordParsed.success) {
        return NextResponse.json(
          { success: false, error: passwordParsed.error.issues[0]?.message || 'Contraseña inválida' },
          { status: 400 }
        );
      }

      // Verificar password actual
      const isValidPassword = await bcrypt.compare(currentPassword, user.password);
      if (!isValidPassword) {
        return NextResponse.json(
          { success: false, error: 'Contraseña actual incorrecta' },
          { status: 400 }
        );
      }

      hashedPassword = await bcrypt.hash(passwordParsed.data, 10);
    }

    // Preparar datos a actualizar en User
    const updateUserData: any = {};
    if (nombre !== undefined) updateUserData.nombre = nombre.trim();
    if (hashedPassword) updateUserData.password = hashedPassword;

    // Validar datos de candidato (#PERF-025): antes ningún campo se validaba,
    // así que '' en nombre, una carta de 2 MB o un tipo equivocado llegaban a
    // Prisma y devolvían 500 en vez de 400.
    const updateCandidateData: any = {};
    let cvUrlAnterior: string | null = null;
    let fotoUrlAnterior: string | null = null;

    if (candidateData && user.candidate) {
      const parsed = candidateDataSchema.safeParse(candidateData);
      if (!parsed.success) {
        const issue = parsed.error.issues[0];
        const campo = issue?.path?.join('.') ?? '';
        return NextResponse.json(
          {
            success: false,
            error: campo ? `${campo}: ${issue?.message}` : issue?.message || 'Datos inválidos'
          },
          { status: 400 }
        );
      }

      const datos = parsed.data;

      if (datos.nombre !== undefined) updateCandidateData.nombre = datos.nombre;
      if (datos.apellidoPaterno !== undefined) updateCandidateData.apellidoPaterno = datos.apellidoPaterno;
      if (datos.apellidoMaterno !== undefined) updateCandidateData.apellidoMaterno = datos.apellidoMaterno;
      if (datos.telefono !== undefined) updateCandidateData.telefono = datos.telefono;
      if (datos.fechaNacimiento !== undefined) updateCandidateData.fechaNacimiento = datos.fechaNacimiento;
      if (datos.sexo !== undefined) updateCandidateData.sexo = datos.sexo;
      if (datos.ciudad !== undefined) updateCandidateData.ciudad = datos.ciudad;
      if (datos.estado !== undefined) updateCandidateData.estado = datos.estado;
      if (datos.ubicacionCercana !== undefined) updateCandidateData.ubicacionCercana = datos.ubicacionCercana;
      if (datos.latitude !== undefined) updateCandidateData.latitude = datos.latitude;
      if (datos.longitude !== undefined) updateCandidateData.longitude = datos.longitude;
      if (datos.universidad !== undefined) updateCandidateData.universidad = datos.universidad;
      if (datos.carrera !== undefined) updateCandidateData.carrera = datos.carrera;
      if (datos.nivelEstudios !== undefined) updateCandidateData.nivelEstudios = datos.nivelEstudios;
      if (datos.añosExperiencia !== undefined) updateCandidateData.añosExperiencia = datos.añosExperiencia;
      if (datos.profile !== undefined) updateCandidateData.profile = datos.profile;
      if (datos.seniority !== undefined) updateCandidateData.seniority = datos.seniority;
      if (datos.linkedinUrl !== undefined) updateCandidateData.linkedinUrl = datos.linkedinUrl;
      if (datos.portafolioUrl !== undefined) updateCandidateData.portafolioUrl = datos.portafolioUrl;

      if (datos.cvUrl !== undefined) {
        updateCandidateData.cvUrl = datos.cvUrl;
        if (user.candidate.cvUrl && user.candidate.cvUrl !== datos.cvUrl) {
          cvUrlAnterior = user.candidate.cvUrl;
        }
      }

      // FEAT-2: Actualizar foto de perfil
      if (datos.fotoUrl !== undefined) {
        updateCandidateData.fotoUrl = datos.fotoUrl;
        if (user.candidate.fotoUrl && user.candidate.fotoUrl !== datos.fotoUrl) {
          fotoUrlAnterior = user.candidate.fotoUrl;
        }
      }

      // Carta de presentación
      if (datos.cartaPresentacion !== undefined) updateCandidateData.cartaPresentacion = datos.cartaPresentacion;

      // Guardar educación como JSON string
      if (datos.educacion !== undefined) {
        updateCandidateData.educacion = JSON.stringify(datos.educacion);
        if (datos.educacion.length > 0) {
          // Actualizar campos legacy con la primera entrada (para compatibilidad)
          const primeraEducacion = datos.educacion[0];
          updateCandidateData.universidad = primeraEducacion.institucion || null;
          updateCandidateData.carrera = primeraEducacion.carrera || null;
          updateCandidateData.nivelEstudios = primeraEducacion.nivel || null;
        } else {
          // #PERF-007: al borrar la última entrada hay que limpiar también los
          // campos legacy; si no, el GET los usaba para fabricarla de nuevo y
          // la entrada "eliminada" reaparecía tras guardar.
          updateCandidateData.universidad = null;
          updateCandidateData.carrera = null;
          updateCandidateData.nivelEstudios = null;
        }
      }
    }

    // -----------------------------------------------------------------
    // 2) ESCRIBIR TODO DE GOLPE (#PERF-005)
    // -----------------------------------------------------------------
    const escrituras: any[] = [];

    escrituras.push(
      prisma.user.update({
        where: { id: user.id },
        data: updateUserData,
        select: {
          id: true,
          email: true,
          nombre: true,
          role: true,
          credits: true,
          companyRequest: {
            select: { nombreEmpresa: true }
          }
        }
      })
    );

    if (user.candidate && Object.keys(updateCandidateData).length > 0) {
      escrituras.push(
        prisma.candidate.update({
          where: { id: user.candidate.id },
          data: updateCandidateData
        })
      );
    }

    const [updatedUser] = await prisma.$transaction(escrituras);

    // SECURITY (#PERF-003): una vez confirmado el cambio, borrar el archivo
    // anterior. Sin esto, la foto o el CV reemplazados seguían públicos para
    // siempre. Best-effort: nunca rompe la respuesta.
    await borrarBlobSiEsNuestro(cvUrlAnterior);
    await borrarBlobSiEsNuestro(fotoUrlAnterior);

    // Construir respuesta actualizada
    const profileData: any = {
      id: updatedUser.id,
      email: updatedUser.email,
      nombre: updatedUser.nombre,
      role: updatedUser.role
    };

    if (updatedUser.role === 'company') {
      profileData.company = updatedUser.companyRequest?.nombreEmpresa || null;
      profileData.credits = updatedUser.credits;
    }

    return NextResponse.json({
      success: true,
      message: 'Perfil actualizado exitosamente',
      data: profileData
    });

  } catch (error) {
    console.error('Error updating profile:', error);
    return NextResponse.json(
      { success: false, error: 'Error al actualizar perfil' },
      { status: 500 }
    );
  }
}
