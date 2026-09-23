// RUTA: src/app/api/auth/register/route.ts

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { hashPassword, generateToken, getAuthCookieOptions } from '@/lib/auth';
import { normalizeUrl } from '@/lib/utils';
import { isSafeHttpUrl } from '@/lib/sanitize';
import { z } from 'zod';
import { telefonoSchema, esUrlDeArchivoSubido } from '@/lib/validations';
import {
  applyRateLimit,
  consumeRateLimit,
  getClientIP,
  peekRateLimit,
  rateLimitResponse,
  REGISTER_RATE_LIMIT,
  REGISTER_ATTEMPT_RATE_LIMIT
} from '@/lib/rate-limit';

/**
 * POST /api/auth/register
 * Registra un nuevo candidato con perfil profesional completo
 * Crea User + Candidate en una transacción
 */

/**
 * Fecha en formato ISO (YYYY-MM-DD) o ISO completo, que `new Date()` sepa leer.
 * Sin esto, 'texto' o '2020-13-45' llegaban a Prisma como Invalid Date y la
 * ruta respondía 500 en vez de 400 con el campo señalado (AUTH-019).
 */
const fechaValida = z
  .string()
  .max(40)
  .refine((v) => !Number.isNaN(new Date(v).getTime()), 'Fecha inválida');

/**
 * URL de documento/foto que luego se renderiza como href o src.
 * Mismo criterio que el fix #55 en /api/profile/documents, que nunca se aplicó
 * a este endpoint —que además es PÚBLICO y sin autenticar— (AUTH-008).
 */
const urlSegura = z
  .string()
  .max(2048)
  .refine(
    (v) => isSafeHttpUrl(v) || /^\/uploads\/[\w.-]+$/.test(v),
    'La URL debe ser http(s) absoluta'
  );

/** Enlaces que el usuario escribe a mano (se normalizan antes de validar). */
const enlaceOpcional = z
  .string()
  .max(2048)
  .optional()
  .refine((v) => {
    const normalizada = normalizeUrl(v);
    return !normalizada || isSafeHttpUrl(normalizada);
  }, 'La URL debe ser http(s) absoluta');

// Schema de validación expandido
const registerSchema = z.object({
  // Auth
  email: z.string().max(254).email('Email inválido'),
  password: z
    .string()
    .min(8, 'La contraseña debe tener al menos 8 caracteres')
    .max(128, 'La contraseña es demasiado larga')
    .regex(/[A-Z]/, 'Debe contener al menos una mayúscula')
    .regex(/[0-9]/, 'Debe contener al menos un número'),

  // Datos personales
  // UI-005: trim para no guardar nombres con espacios sobrantes o sólo espacios.
  nombre: z.string().trim().min(2, 'El nombre es requerido').max(80),
  apellidoPaterno: z.string().trim().min(2, 'El apellido paterno es requerido').max(80),
  apellidoMaterno: z.string().trim().max(80).optional(),
  // AUTHUI-023: mismo criterio que el formulario de contacto.
  telefono: telefonoSchema,
  sexo: z.enum(['M', 'F', 'Otro']).optional(),
  // AUTHUI-024: rango razonable (1930 .. hoy menos 15 años).
  fechaNacimiento: fechaValida
    .refine(
      (v) => new Date(v).getTime() >= new Date('1930-01-01T00:00:00Z').getTime(),
      'La fecha de nacimiento no puede ser anterior a 1930'
    )
    .refine((v) => {
      const limite = new Date();
      limite.setFullYear(limite.getFullYear() - 15);
      return new Date(v).getTime() <= limite.getTime();
    }, 'Debes tener al menos 15 años')
    .optional(),
  ciudad: z.string().max(120).optional(),
  estado: z.string().max(120).optional(),
  ubicacionCercana: z.string().max(200).optional(),

  // Educación (FEATURE: Educación múltiple)
  educacion: z
    .array(
      z.object({
        id: z.number().optional(),
        nivel: z.string().max(80),
        institucion: z.string().max(200),
        carrera: z.string().max(200),
        añoInicio: z.number().int().min(1950).max(new Date().getFullYear() + 8).nullable().optional(),
        añoFin: z.number().int().min(1950).max(new Date().getFullYear() + 8).nullable().optional(),
        estatus: z.string().max(80)
      }).refine(
        (e) => e.añoInicio == null || e.añoFin == null || e.añoFin >= e.añoInicio,
        { message: 'El año de fin no puede ser anterior al de inicio', path: ['añoFin'] }
      )
    )
    .max(20)
    .optional(),

  // Profesional
  profile: z.string().max(120).optional(),
  subcategory: z.string().max(120).optional(),
  seniority: z.string().max(80).optional(),

  // Links
  cvUrl: enlaceOpcional,
  linkedinUrl: enlaceOpcional,
  portafolioUrl: enlaceOpcional,

  // Experiencias (array)
  experiences: z
    .array(
      z.object({
        empresa: z.string().max(200),
        puesto: z.string().max(200),
        ubicacion: z.string().max(200).optional(),
        fechaInicio: fechaValida,
        fechaFin: fechaValida.optional(),
        esActual: z.boolean(),
        descripcion: z.string().max(2000).optional()
      })
        // AUTHUI-026: sin fecha de fin se contaba hasta hoy e inflaba añosExperiencia.
        .refine((e) => e.esActual || !!e.fechaFin, {
          message: 'Indica la fecha de fin o marca trabajo actual',
          path: ['fechaFin']
        })
        .refine((e) => !e.fechaFin || new Date(e.fechaFin) >= new Date(e.fechaInicio), {
          message: 'La fecha de fin no puede ser anterior a la de inicio',
          path: ['fechaFin']
        })
    )
    .max(20)
    .optional(),

  // Documentos (array)
  documents: z
    .array(
      z.object({
        name: z.string().max(200),
        fileUrl: urlSegura
      })
    )
    .max(20)
    .optional(),

  // FEAT-2: Foto de perfil del candidato.
  // INFRA-032: sólo archivos de /api/upload (Vercel Blob, o /uploads/ en
  // desarrollo). Una URL de otro dominio rompe next/image al pintarla.
  fotoUrl: z
    .string()
    .max(2048)
    .refine(esUrlDeArchivoSubido, 'La foto debe ser un archivo subido a INAKAT')
    .optional()
});

/**
 * Mensaje único para "ese correo ya no está libre", da igual si lo ocupa un
 * User o un Candidate del banco de talento (AUTH-009). Es accionable sin decir
 * cuál de los dos es (AUTH-010, parcial: el flujo de reclamar perfil con
 * verificación por correo sigue pendiente).
 */
const EMAIL_EN_USO =
  'Este email ya está en uso. Si es tuyo, inicia sesión o usa "Olvidé mi contraseña". Si no logras entrar, escríbenos a info@inakat.com.';

// Función para calcular años de experiencia
function calcularAñosExperiencia(
  experiences?: {
    fechaInicio: string;
    fechaFin?: string;
    esActual: boolean;
  }[]
): number {
  if (!experiences || experiences.length === 0) return 0;

  const today = new Date();
  let totalMonths = 0;

  for (const exp of experiences) {
    const start = new Date(exp.fechaInicio);
    const end = exp.fechaFin ? new Date(exp.fechaFin) : today;
    const months =
      (end.getFullYear() - start.getFullYear()) * 12 +
      (end.getMonth() - start.getMonth());
    totalMonths += Math.max(0, months);
  }

  return Math.round(totalMonths / 12);
}

export async function POST(request: Request) {
  try {
    // Rate limiting en dos cubos (AUTH-018):
    //  - 20 peticiones/hora por IP: freno al abuso automatizado.
    //  - 3 altas CREADAS/hora por IP: el cupo real, que ya no se gasta con los
    //    400 de zod ni con los 409 de email repetido.
    const rateLimited = applyRateLimit(
      request,
      'register-attempt',
      REGISTER_ATTEMPT_RATE_LIMIT
    );
    if (rateLimited) return rateLimited;

    const ip = getClientIP(request);
    const successKey = `register:${ip}`;
    const successLimit = peekRateLimit(successKey, REGISTER_RATE_LIMIT);
    if (!successLimit.success) return rateLimitResponse(successLimit);

    // VALIDACIÓN (AUTH-015): cuerpo no-JSON → 400, no 500.
    const body = await request.json().catch(() => null);

    if (!body || typeof body !== 'object') {
      return NextResponse.json(
        { success: false, error: 'Cuerpo de la solicitud inválido' },
        { status: 400 }
      );
    }

    // Validar datos de entrada
    const validation = registerSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        {
          success: false,
          errors: validation.error.flatten().fieldErrors
        },
        { status: 400 }
      );
    }

    const {
      email,
      password,
      nombre,
      apellidoPaterno,
      apellidoMaterno,
      telefono,
      sexo,
      fechaNacimiento,
      ciudad,
      estado,
      ubicacionCercana,
      educacion,
      profile,
      subcategory,
      seniority,
      cvUrl,
      linkedinUrl,
      portafolioUrl,
      experiences,
      documents,
      fotoUrl // FEAT-2: Foto de perfil
    } = validation.data;

    // Verificar si el email ya existe en User o en el banco de candidatos.
    //
    // PRIVACIDAD (AUTH-009): los dos casos responden EXACTAMENTE lo mismo. Antes
    // el mensaje distinguía 'Este email ya está registrado' de 'Ya existe un
    // candidato con ese email', y esa diferencia convertía el registro en un
    // oráculo: revelaba no sólo que la cuenta existe, sino que esa persona está
    // en la base de candidatos de INAKAT (dato sensible: busca empleo).
    const [existingUser, existingCandidate] = await Promise.all([
      prisma.user.findUnique({ where: { email: email.toLowerCase() } }),
      prisma.candidate.findUnique({ where: { email: email.toLowerCase() } })
    ]);

    if (existingUser || existingCandidate) {
      return NextResponse.json(
        {
          success: false,
          error: EMAIL_EN_USO
        },
        { status: 409 }
      );
    }

    // Hashear contraseña
    const hashedPassword = await hashPassword(password);

    // Calcular años de experiencia
    const añosExperiencia = calcularAñosExperiencia(experiences);

    // Crear User + Candidate en transacción
    const result = await prisma.$transaction(async (tx) => {
      // 1. Crear User
      const user = await tx.user.create({
        data: {
          email: email.toLowerCase(),
          password: hashedPassword,
          nombre,
          apellidoPaterno,
          apellidoMaterno: apellidoMaterno || null,
          role: 'candidate',
          isActive: true,
          // SEGURIDAD (AUTH-001): aquí se escribía `emailVerified: new Date()`
          // sin haber comprobado NUNCA que quien registra controla ese correo.
          // Era un dato falso. Queda null hasta que exista el flujo de
          // verificación (enlace de un solo uso), que es lo que debe habilitar
          // el vínculo por email con las postulaciones hechas como invitado.
          emailVerified: null
        }
      });

      // 2. Crear Candidate vinculado al User
      const candidate = await tx.candidate.create({
        data: {
          userId: user.id,
          nombre,
          apellidoPaterno,
          apellidoMaterno: apellidoMaterno || null,
          email: email.toLowerCase(),
          telefono: telefono || null,
          sexo: sexo || null,
          fechaNacimiento: fechaNacimiento ? new Date(fechaNacimiento) : null,
          ciudad: ciudad || null,
          estado: estado || null,
          ubicacionCercana: ubicacionCercana || null,
          // FEATURE: Educación múltiple - guardar JSON y sincronizar campos legacy
          educacion: educacion && educacion.length > 0 ? JSON.stringify(educacion) : null,
          universidad: educacion && educacion.length > 0 ? (educacion[0].institucion || null) : null,
          carrera: educacion && educacion.length > 0 ? (educacion[0].carrera || null) : null,
          nivelEstudios: educacion && educacion.length > 0 ? (educacion[0].nivel || null) : null,
          profile: profile || null,
          subcategory: subcategory || null,
          seniority: seniority || null,
          cvUrl: normalizeUrl(cvUrl) || null,
          linkedinUrl: normalizeUrl(linkedinUrl) || null,
          portafolioUrl: normalizeUrl(portafolioUrl) || null,
          source: 'registro',
          añosExperiencia,
          status: 'available',
          fotoUrl: fotoUrl || null, // FEAT-2: Foto de perfil
          // Crear experiencias anidadas
          experiences:
            experiences && experiences.length > 0
              ? {
                  create: experiences.map((exp) => ({
                    empresa: exp.empresa,
                    puesto: exp.puesto,
                    ubicacion: exp.ubicacion || null,
                    fechaInicio: new Date(exp.fechaInicio),
                    fechaFin: exp.fechaFin ? new Date(exp.fechaFin) : null,
                    esActual: exp.esActual,
                    descripcion: exp.descripcion || null
                  }))
                }
              : undefined,
          // Crear documentos anidados
          documents:
            documents && documents.length > 0
              ? {
                  create: documents.map((doc) => ({
                    name: doc.name,
                    fileUrl: doc.fileUrl,
                    fileType: doc.fileUrl.split('.').pop() || null
                  }))
                }
              : undefined
        },
        include: {
          experiences: true,
          documents: true
        }
      });

      return { user, candidate };
    });

    // El cupo estrecho (3/hora por IP) lo gastan sólo las altas que existen.
    consumeRateLimit(successKey, REGISTER_RATE_LIMIT);

    // Generar token JWT
    const token = generateToken({
      userId: result.user.id,
      email: result.user.email,
      role: result.user.role
    });

    // Crear respuesta
    const response = NextResponse.json(
      {
        success: true,
        message: 'Registro exitoso',
        user: {
          id: result.user.id,
          email: result.user.email,
          nombre: result.user.nombre,
          apellidoPaterno: result.user.apellidoPaterno,
          apellidoMaterno: result.user.apellidoMaterno,
          role: result.user.role
        },
        candidate: {
          id: result.candidate.id,
          experiencesCount: result.candidate.experiences.length,
          documentsCount: result.candidate.documents.length
        }
      },
      { status: 201 }
    );

    // Establecer cookie con el token.
    // maxAge derivado de JWT_EXPIRES_IN, no un 7 escrito a mano (AUTH-022).
    response.cookies.set('auth-token', token, getAuthCookieOptions());

    return response;
  } catch (error) {
    // CARRERA (AUTH-020): la unicidad se comprueba antes de la transacción
    // (check-then-act). Con dos envíos simultáneos —doble clic, reintento por
    // red lenta— el segundo viola el índice único y antes caía en el 500
    // genérico: la UI decía "error" aunque la cuenta SÍ se había creado.
    if (
      typeof error === 'object' &&
      error !== null &&
      (error as { code?: string }).code === 'P2002'
    ) {
      return NextResponse.json(
        { success: false, error: EMAIL_EN_USO },
        { status: 409 }
      );
    }

    console.error('Error in /api/auth/register:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Error al procesar el registro'
      },
      { status: 500 }
    );
  }
}
