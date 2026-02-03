// RUTA: src/app/api/admin/candidates/route.ts

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyToken } from '@/lib/auth';
import { cookies } from 'next/headers';
import bcrypt from 'bcryptjs';

// Middleware para verificar que es admin
async function verifyAdmin() {
  const cookieStore = await cookies();
  const token = cookieStore.get('auth-token')?.value;

  if (!token) {
    return { error: 'No autenticado', status: 401 };
  }

  const payload = verifyToken(token);
  if (!payload?.userId) {
    return { error: 'Token inválido', status: 401 };
  }

  const user = await prisma.user.findUnique({
    where: { id: payload.userId }
  });

  if (!user || user.role !== 'admin') {
    return { error: 'Acceso denegado - Solo administradores', status: 403 };
  }

  return { user };
}

/**
 * GET /api/admin/candidates
 * Listar candidatos con filtros avanzados
 */
export async function GET(request: Request) {
  try {
    const auth = await verifyAdmin();
    if ('error' in auth) {
      return NextResponse.json(
        { success: false, error: auth.error },
        { status: auth.status }
      );
    }

    const { searchParams } = new URL(request.url);

    // Filtros
    const search = searchParams.get('search') || '';
    const sexo = searchParams.get('sexo') || '';
    const universidad = searchParams.get('universidad') || '';
    const profile = searchParams.get('profile') || '';
    const seniority = searchParams.get('seniority') || '';
    const subcategory = searchParams.get('subcategory') || '';
    const status = searchParams.get('status') || '';
    const source = searchParams.get('source') || '';
    const minExperience = searchParams.get('minExperience') || '';
    const maxExperience = searchParams.get('maxExperience') || '';
    const minAge = searchParams.get('minAge') || '';
    const maxAge = searchParams.get('maxAge') || '';

    // Construir query
    const where: any = {};

    // Búsqueda general
    if (search) {
      where.OR = [
        { nombre: { contains: search, mode: 'insensitive' } },
        { apellidoPaterno: { contains: search, mode: 'insensitive' } },
        { apellidoMaterno: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
        { carrera: { contains: search, mode: 'insensitive' } }
      ];
    }

    // Filtros específicos
    if (sexo) {
      where.sexo = sexo;
    }

    if (universidad) {
      where.universidad = { contains: universidad, mode: 'insensitive' };
    }

    if (profile) {
      where.profile = profile;
    }

    if (seniority) {
      where.seniority = seniority;
    }

    if (subcategory) {
      where.subcategory = subcategory;
    }

    if (status) {
      where.status = status;
    }

    if (source) {
      where.source = source;
    }

    // Filtro de años de experiencia
    if (minExperience || maxExperience) {
      where.añosExperiencia = {};
      if (minExperience) {
        where.añosExperiencia.gte = parseInt(minExperience);
      }
      if (maxExperience) {
        where.añosExperiencia.lte = parseInt(maxExperience);
      }
    }

    // Filtro de edad (calculado desde fechaNacimiento)
    if (minAge || maxAge) {
      const today = new Date();

      if (maxAge) {
        // Edad máxima = fecha de nacimiento mínima
        const minBirthDate = new Date(today);
        minBirthDate.setFullYear(today.getFullYear() - parseInt(maxAge) - 1);
        where.fechaNacimiento = { ...where.fechaNacimiento, gte: minBirthDate };
      }

      if (minAge) {
        // Edad mínima = fecha de nacimiento máxima
        const maxBirthDate = new Date(today);
        maxBirthDate.setFullYear(today.getFullYear() - parseInt(minAge));
        where.fechaNacimiento = { ...where.fechaNacimiento, lte: maxBirthDate };
      }
    }

    // Ejecutar query
    const candidates = await prisma.candidate.findMany({
      where,
      include: {
        experiences: {
          orderBy: { fechaInicio: 'desc' }
        },
        documents: {
          orderBy: { createdAt: 'desc' }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    // Calcular edad para cada candidato
    const candidatesWithAge = candidates.map((candidate) => {
      let edad = null;
      if (candidate.fechaNacimiento) {
        const today = new Date();
        const birth = new Date(candidate.fechaNacimiento);
        edad = today.getFullYear() - birth.getFullYear();
        const monthDiff = today.getMonth() - birth.getMonth();
        if (
          monthDiff < 0 ||
          (monthDiff === 0 && today.getDate() < birth.getDate())
        ) {
          edad--;
        }
      }
      return { ...candidate, edad };
    });

    return NextResponse.json({
      success: true,
      data: candidatesWithAge,
      count: candidatesWithAge.length
    });
  } catch (error) {
    console.error('Error fetching candidates:', error);
    return NextResponse.json(
      { success: false, error: 'Error al obtener candidatos' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/candidates
 * Crear nuevo candidato (inyección manual)
 */
export async function POST(request: Request) {
  try {
    const auth = await verifyAdmin();
    if ('error' in auth) {
      return NextResponse.json(
        { success: false, error: auth.error },
        { status: auth.status }
      );
    }

    const body = await request.json();
    const {
      nombre,
      apellidoPaterno,
      apellidoMaterno,
      email,
      telefono,
      sexo,
      fechaNacimiento,
      universidad,
      carrera,
      nivelEstudios,
      educacion, // FEATURE: Educación múltiple (array)
      profile,
      seniority,
      cvUrl,
      portafolioUrl,
      linkedinUrl,
      source,
      notas,
      experiences, // Array de experiencias
      documents, // Array de documentos
      password // Opcional: para crear cuenta de candidato
    } = body;

    // Validaciones básicas
    if (!nombre || !apellidoPaterno || !email) {
      return NextResponse.json(
        {
          success: false,
          error: 'Campos requeridos: nombre, apellidoPaterno, email'
        },
        { status: 400 }
      );
    }

    // Verificar email único en candidatos
    const existingCandidate = await prisma.candidate.findUnique({
      where: { email: email.toLowerCase() }
    });

    if (existingCandidate) {
      return NextResponse.json(
        {
          success: false,
          error: `Ya existe un candidato con ese email (ID: ${existingCandidate.id}). Puedes encontrarlo en el Banco de Candidatos y asignarlo a una vacante desde "Asignar Candidatos".`,
          existingCandidateId: existingCandidate.id,
          suggestion: 'Ir a /admin/candidates para buscar al candidato o /admin/assign-candidates para asignarlo a una vacante.'
        },
        { status: 409 }
      );
    }

    // Si viene password, verificar que no exista usuario con ese email
    let userId = null;
    let accountCreated = false;

    if (password) {
      // Validar longitud mínima de password
      if (password.length < 8) {
        return NextResponse.json(
          { success: false, error: 'La contraseña debe tener al menos 8 caracteres' },
          { status: 400 }
        );
      }

      // Verificar que no exista usuario con ese email
      const existingUser = await prisma.user.findUnique({
        where: { email: email.toLowerCase() }
      });

      if (existingUser) {
        return NextResponse.json(
          { success: false, error: 'Ya existe un usuario con ese email' },
          { status: 409 }
        );
      }

      // Crear usuario con role="candidate"
      const hashedPassword = await bcrypt.hash(password, 10);
      const newUser = await prisma.user.create({
        data: {
          email: email.toLowerCase(),
          password: hashedPassword,
          nombre,
          apellidoPaterno: apellidoPaterno || null,
          apellidoMaterno: apellidoMaterno || null,
          role: 'candidate',
          isActive: true
        }
      });

      userId = newUser.id;
      accountCreated = true;
    }

    // Calcular años de experiencia si hay experiencias
    let añosExperiencia = 0;
    if (experiences && experiences.length > 0) {
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

      añosExperiencia = Math.round(totalMonths / 12);
    }

    // Crear candidato con experiencias y vinculación a usuario si aplica
    const candidate = await prisma.candidate.create({
      data: {
        nombre,
        apellidoPaterno,
        apellidoMaterno: apellidoMaterno || null,
        email: email.toLowerCase(),
        telefono: telefono || null,
        sexo: sexo || null,
        fechaNacimiento: fechaNacimiento ? new Date(fechaNacimiento) : null,
        // FEATURE: Educación múltiple - guardar JSON y sincronizar legacy
        educacion: educacion && educacion.length > 0 ? JSON.stringify(educacion) : null,
        universidad: educacion && educacion.length > 0 ? (educacion[0].institucion || null) : (universidad || null),
        carrera: educacion && educacion.length > 0 ? (educacion[0].carrera || null) : (carrera || null),
        nivelEstudios: educacion && educacion.length > 0 ? (educacion[0].nivel || null) : (nivelEstudios || null),
        profile: profile || null,
        seniority: seniority || null,
        cvUrl: cvUrl || null,
        portafolioUrl: portafolioUrl || null,
        linkedinUrl: linkedinUrl || null,
        source: source || 'manual',
        status: 'available', // Explícitamente establecer status para evitar problemas
        notas: notas || null,
        añosExperiencia,
        userId, // Vincular con usuario si se creó cuenta
        experiences:
          experiences && experiences.length > 0
            ? {
                create: experiences.map((exp: any) => ({
                  empresa: exp.empresa,
                  puesto: exp.puesto,
                  ubicacion: exp.ubicacion || null,
                  fechaInicio: new Date(exp.fechaInicio),
                  fechaFin: exp.fechaFin ? new Date(exp.fechaFin) : null,
                  esActual: exp.esActual || false,
                  descripcion: exp.descripcion || null
                }))
              }
            : undefined,
        documents:
          documents && documents.length > 0
            ? {
                create: documents.map((doc: any) => ({
                  name: doc.name,
                  fileUrl: doc.fileUrl,
                  fileType: doc.fileType || null
                }))
              }
            : undefined
      },
      include: {
        experiences: true,
        documents: true,
        user: {
          select: {
            id: true,
            email: true,
            role: true
          }
        }
      }
    });

    // Mensaje según si se creó cuenta o no
    const message = accountCreated
      ? 'Candidato creado exitosamente con cuenta de acceso'
      : 'Candidato creado exitosamente (sin cuenta de acceso)';

    return NextResponse.json(
      {
        success: true,
        message,
        accountCreated,
        data: candidate
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Error creating candidate:', error);
    return NextResponse.json(
      { success: false, error: 'Error al crear candidato' },
      { status: 500 }
    );
  }
}
