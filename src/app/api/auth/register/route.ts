// RUTA: src/app/api/auth/register/route.ts

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { hashPassword, generateToken } from '@/lib/auth';
import { normalizeUrl } from '@/lib/utils';
import { z } from 'zod';
import { applyRateLimit, REGISTER_RATE_LIMIT } from '@/lib/rate-limit';

/**
 * POST /api/auth/register
 * Registra un nuevo candidato con perfil profesional completo
 * Crea User + Candidate en una transacción
 */

// Schema de validación expandido
const registerSchema = z.object({
  // Auth
  email: z.string().email('Email inválido'),
  password: z
    .string()
    .min(8, 'La contraseña debe tener al menos 8 caracteres')
    .regex(/[A-Z]/, 'Debe contener al menos una mayúscula')
    .regex(/[0-9]/, 'Debe contener al menos un número'),

  // Datos personales
  nombre: z.string().min(2, 'El nombre es requerido'),
  apellidoPaterno: z.string().min(2, 'El apellido paterno es requerido'),
  apellidoMaterno: z.string().optional(),
  telefono: z.string().optional(),
  sexo: z.enum(['M', 'F', 'Otro']).optional(),
  fechaNacimiento: z.string().optional(),
  ciudad: z.string().optional(),
  estado: z.string().optional(),
  ubicacionCercana: z.string().optional(),

  // Educación (FEATURE: Educación múltiple)
  educacion: z
    .array(
      z.object({
        id: z.number().optional(),
        nivel: z.string(),
        institucion: z.string(),
        carrera: z.string(),
        añoInicio: z.number().nullable().optional(),
        añoFin: z.number().nullable().optional(),
        estatus: z.string()
      })
    )
    .optional(),

  // Profesional
  profile: z.string().optional(),
  subcategory: z.string().optional(),
  seniority: z.string().optional(),

  // Links
  cvUrl: z.string().optional(),
  linkedinUrl: z.string().optional(),
  portafolioUrl: z.string().optional(),

  // Experiencias (array)
  experiences: z
    .array(
      z.object({
        empresa: z.string(),
        puesto: z.string(),
        ubicacion: z.string().optional(),
        fechaInicio: z.string(),
        fechaFin: z.string().optional(),
        esActual: z.boolean(),
        descripcion: z.string().optional()
      })
    )
    .optional(),

  // Documentos (array)
  documents: z
    .array(
      z.object({
        name: z.string(),
        fileUrl: z.string()
      })
    )
    .optional(),

  // FEAT-2: Foto de perfil del candidato
  fotoUrl: z.string().optional()
});

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
    // Rate limiting: 3 registros por hora por IP
    const rateLimited = applyRateLimit(request, 'register', REGISTER_RATE_LIMIT);
    if (rateLimited) return rateLimited;

    const body = await request.json();

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

    // Verificar si el email ya existe en User
    const existingUser = await prisma.user.findUnique({
      where: { email: email.toLowerCase() }
    });

    if (existingUser) {
      return NextResponse.json(
        {
          success: false,
          error: 'Este email ya está registrado'
        },
        { status: 409 }
      );
    }

    // Verificar si el email ya existe en Candidate
    const existingCandidate = await prisma.candidate.findUnique({
      where: { email: email.toLowerCase() }
    });

    if (existingCandidate) {
      return NextResponse.json(
        {
          success: false,
          error: 'Ya existe un candidato con ese email'
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
          emailVerified: new Date()
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

    // Establecer cookie con el token
    response.cookies.set('auth-token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7, // 7 días
      path: '/'
    });

    return response;
  } catch (error) {
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
