// RUTA: src/app/api/admin/candidates/route.ts

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/auth';
import { getPaginationParams, buildPaginatedResponse } from '@/lib/pagination';
import { isSafeHttpUrl } from '@/lib/sanitize';
import bcrypt from 'bcryptjs';
// Longitud mínima compartida con el resto de altas de credenciales.
import { PASSWORD_MIN_LENGTH } from '@/lib/validations';

// Longitud máxima de las notas internas del admin (igual que en el PUT).
const MAX_NOTAS = 5000;

// Estados de Application que ya no cuentan como proceso vivo del candidato.
const ESTADOS_POSTULACION_CERRADA = ['rejected', 'discarded', 'archived'];

/**
 * Entero >= 0 o `undefined` si el valor no es un número usable.
 * Antes `parseInt('veinte')` daba NaN, se pasaba a Prisma o a setFullYear y el
 * filtro terminaba en un 500 genérico.
 */
function enteroNoNegativo(value: string): number | undefined {
  if (!value) return undefined;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 0) return undefined;
  return parsed;
}

/**
 * Valida el array de experiencias antes de tocar la base.
 * Devuelve el mensaje de error o null si todo está bien.
 */
function validarExperiencias(experiences: unknown): string | null {
  if (!Array.isArray(experiences)) {
    return 'experiences debe ser un array';
  }
  for (const exp of experiences as any[]) {
    if (!exp || typeof exp !== 'object') return 'Experiencia inválida';
    if (typeof exp.empresa !== 'string' || !exp.empresa.trim()) {
      return 'Cada experiencia necesita empresa';
    }
    if (typeof exp.puesto !== 'string' || !exp.puesto.trim()) {
      return 'Cada experiencia necesita puesto';
    }
    if (Number.isNaN(new Date(exp.fechaInicio).getTime())) {
      return `Fecha de inicio inválida en la experiencia "${exp.empresa}"`;
    }
    if (exp.fechaFin && Number.isNaN(new Date(exp.fechaFin).getTime())) {
      return `Fecha de fin inválida en la experiencia "${exp.empresa}"`;
    }
  }
  return null;
}

/**
 * Devuelve el mensaje de error del primer campo cuya URL no sea http(s).
 * Estas URLs acaban renderizadas como href para reclutadores, especialistas y
 * empresas, así que se exige lo mismo que en /api/profile/documents.
 */
function urlInseguraEn(campos: Array<[string, unknown]>): string | null {
  for (const [etiqueta, valor] of campos) {
    if (valor === undefined || valor === null || valor === '') continue;
    if (!isSafeHttpUrl(valor)) {
      return `${etiqueta} debe ser una dirección http(s) válida`;
    }
  }
  return null;
}

/**
 * GET /api/admin/candidates
 * Listar candidatos con filtros avanzados
 */
export async function GET(request: Request) {
  try {
    const auth = await requireRole('admin');
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

    // Búsqueda general.
    // Se parte el término en palabras y se exige que CADA una aparezca en alguna
    // columna: "Juan Pérez" no está contenido en ninguna columna individual, así
    // que la búsqueda por nombre completo devolvía siempre 0 resultados.
    if (search) {
      const tokens = search.trim().split(/\s+/).filter(Boolean);
      if (tokens.length > 0) {
        where.AND = tokens.map((token) => ({
          OR: [
            { nombre: { contains: token, mode: 'insensitive' } },
            { apellidoPaterno: { contains: token, mode: 'insensitive' } },
            { apellidoMaterno: { contains: token, mode: 'insensitive' } },
            { email: { contains: token, mode: 'insensitive' } },
            { carrera: { contains: token, mode: 'insensitive' } }
          ]
        }));
      }
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
      // Se admite lista separada por comas (p. ej. "available,in_process") para
      // que el filtro de Asignar Candidatos se aplique en servidor y no después
      // de paginar, que era lo que vaciaba la página.
      const estados = status.split(',').map((s) => s.trim()).filter(Boolean);
      where.status = estados.length > 1 ? { in: estados } : estados[0];
    }

    if (source) {
      where.source = source;
    }

    // Filtro de años de experiencia (se ignora lo que no sea entero >= 0)
    const minExp = enteroNoNegativo(minExperience);
    const maxExp = enteroNoNegativo(maxExperience);
    if (minExp !== undefined || maxExp !== undefined) {
      where.añosExperiencia = {};
      if (minExp !== undefined) {
        where.añosExperiencia.gte = minExp;
      }
      if (maxExp !== undefined) {
        where.añosExperiencia.lte = maxExp;
      }
    }

    // Filtro de edad (calculado desde fechaNacimiento)
    const edadMin = enteroNoNegativo(minAge);
    const edadMax = enteroNoNegativo(maxAge);
    if (edadMin !== undefined || edadMax !== undefined) {
      const today = new Date();

      if (edadMax !== undefined) {
        // Edad máxima = fecha de nacimiento mínima
        const minBirthDate = new Date(today);
        minBirthDate.setFullYear(today.getFullYear() - edadMax - 1);
        where.fechaNacimiento = { ...where.fechaNacimiento, gte: minBirthDate };
      }

      if (edadMin !== undefined) {
        // Edad mínima = fecha de nacimiento máxima
        const maxBirthDate = new Date(today);
        maxBirthDate.setFullYear(today.getFullYear() - edadMin);
        where.fechaNacimiento = { ...where.fechaNacimiento, lte: maxBirthDate };
      }
    }

    // Paginación
    const pagination = getPaginationParams(searchParams, 30);

    // Ejecutar query con paginación
    const [candidates, total] = await Promise.all([
      prisma.candidate.findMany({
        where,
        include: {
          experiences: {
            orderBy: { fechaInicio: 'desc' }
          },
          documents: {
            orderBy: { createdAt: 'desc' }
          }
        },
        orderBy: { createdAt: 'desc' },
        skip: pagination.skip,
        take: pagination.take
      }),
      prisma.candidate.count({ where })
    ]);

    // Postulaciones VIVAS de cada candidato de la página (ADM-011): Asignar
    // Candidatos descargaba GET /api/applications entero —toda la tabla, con
    // PII— sólo para pintar "N vacantes". Aquí se cuenta en la base, sólo para
    // los emails de esta página y sin procesos cerrados.
    const emailsDePagina = candidates.map((c) => c.email.toLowerCase());
    const conteoPostulaciones = new Map<string, number>();
    if (emailsDePagina.length > 0) {
      const grupos = await prisma.application.groupBy({
        by: ['candidateEmail'],
        where: {
          candidateEmail: { in: emailsDePagina, mode: 'insensitive' },
          status: { notIn: ESTADOS_POSTULACION_CERRADA },
          job: { status: { not: 'closed' } }
        },
        _count: { _all: true }
      });
      for (const grupo of grupos) {
        const clave = grupo.candidateEmail.toLowerCase();
        conteoPostulaciones.set(clave, (conteoPostulaciones.get(clave) || 0) + grupo._count._all);
      }
    }

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
      return {
        ...candidate,
        edad,
        activeApplications: conteoPostulaciones.get(candidate.email.toLowerCase()) || 0
      };
    });

    const response = buildPaginatedResponse(candidatesWithAge, total, pagination);
    return NextResponse.json({
      success: true,
      ...response,
      count: candidatesWithAge.length  // backward compatibility
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
    const auth = await requireRole('admin');
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
      subcategory,
      seniority,
      cvUrl,
      portafolioUrl,
      linkedinUrl,
      source,
      notas,
      cartaPresentacion, // El formulario la envía y antes se descartaba en silencio
      ciudad,
      estado,
      ubicacionCercana,
      experiences, // Array de experiencias
      documents, // Array de documentos
      password, // Opcional: para crear cuenta de candidato
      fotoUrl // FEAT-2: Foto de perfil del candidato
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

    if (typeof email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      return NextResponse.json(
        { success: false, error: 'Email inválido' },
        { status: 400 }
      );
    }

    // Notas internas: mismo tratamiento que el PUT (texto tal cual, con tope de
    // longitud); antes un tipo no textual llegaba a Prisma y respondía 500.
    if (notas !== undefined && notas !== null && typeof notas !== 'string') {
      return NextResponse.json(
        { success: false, error: 'Las notas deben ser texto' },
        { status: 400 }
      );
    }
    if (typeof notas === 'string' && notas.length > MAX_NOTAS) {
      return NextResponse.json(
        { success: false, error: `Las notas no pueden superar ${MAX_NOTAS} caracteres` },
        { status: 400 }
      );
    }

    // Las URLs se renderizan como href en el perfil del candidato: sólo http(s).
    const urlInvalida = urlInseguraEn([
      ['El CV', cvUrl],
      ['El portafolio', portafolioUrl],
      ['El LinkedIn', linkedinUrl],
      ['La foto', fotoUrl]
    ]);
    if (urlInvalida) {
      return NextResponse.json({ success: false, error: urlInvalida }, { status: 400 });
    }

    if (Array.isArray(documents)) {
      const docInvalido = urlInseguraEn(
        documents.map((doc: any, i: number) => [`La URL del documento ${i + 1}`, doc?.fileUrl])
      );
      if (docInvalido) {
        return NextResponse.json({ success: false, error: docInvalido }, { status: 400 });
      }
      if (documents.some((doc: any) => !doc?.name || typeof doc.name !== 'string')) {
        return NextResponse.json(
          { success: false, error: 'Cada documento necesita un nombre' },
          { status: 400 }
        );
      }
    }

    // Las experiencias se validan ANTES de escribir nada: una fecha no parseable
    // hacía fallar el create del candidato dejando un User huérfano.
    if (experiences !== undefined) {
      const errorExperiencias = validarExperiencias(experiences);
      if (errorExperiencias) {
        return NextResponse.json(
          { success: false, error: errorExperiencias },
          { status: 400 }
        );
      }
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
    let hashedPassword: string | null = null;
    const accountCreated = Boolean(password);

    if (password) {
      // Validar longitud mínima de password
      if (typeof password !== 'string' || password.length < PASSWORD_MIN_LENGTH) {
        return NextResponse.json(
          { success: false, error: `La contraseña debe tener al menos ${PASSWORD_MIN_LENGTH} caracteres` },
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

      hashedPassword = await bcrypt.hash(password, 10);
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

    // Crear cuenta (si aplica) y candidato en UNA transacción: antes el User se
    // creaba suelto y, si el create del candidato fallaba, quedaba un User
    // huérfano que bloqueaba el email para siempre (mismo patrón que
    // /api/auth/register).
    const candidate = await prisma.$transaction(async (tx) => {
      let userId: number | null = null;

      if (hashedPassword) {
        const newUser = await tx.user.create({
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
      }

      return tx.candidate.create({
        data: {
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
          // FEATURE: Educación múltiple - guardar JSON y sincronizar legacy
          educacion: educacion && educacion.length > 0 ? JSON.stringify(educacion) : null,
          universidad: educacion && educacion.length > 0 ? (educacion[0].institucion || null) : (universidad || null),
          carrera: educacion && educacion.length > 0 ? (educacion[0].carrera || null) : (carrera || null),
          nivelEstudios: educacion && educacion.length > 0 ? (educacion[0].nivel || null) : (nivelEstudios || null),
          profile: profile || null,
          subcategory: subcategory || null,
          seniority: seniority || null,
          cvUrl: cvUrl || null,
          portafolioUrl: portafolioUrl || null,
          linkedinUrl: linkedinUrl || null,
          source: source || 'manual',
          status: 'available', // Explícitamente establecer status para evitar problemas
          notas: notas || null,
          cartaPresentacion: cartaPresentacion || null,
          añosExperiencia,
          fotoUrl: fotoUrl || null, // FEAT-2: Foto de perfil
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
    // Carrera de unicidad (email de candidato o de usuario): 409, no 500.
    if ((error as { code?: string })?.code === 'P2002') {
      return NextResponse.json(
        { success: false, error: 'Ya existe un registro con ese email' },
        { status: 409 }
      );
    }
    return NextResponse.json(
      { success: false, error: 'Error al crear candidato' },
      { status: 500 }
    );
  }
}
