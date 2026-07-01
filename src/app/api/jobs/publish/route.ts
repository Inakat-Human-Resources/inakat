// RUTA: src/app/api/jobs/publish/route.ts

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyToken, requireRole } from '@/lib/auth';
import { cookies } from 'next/headers';
import { calculateJobCreditCost } from '@/lib/pricing';

// Función para sanitizar vacantes confidenciales
function sanitizeConfidentialJob(job: any) {
  if (!job.isConfidential) return job;
  return {
    ...job,
    company: 'Empresa Confidencial',
    location: job.location ? job.location.split(',').pop()?.trim() || 'México' : 'México',
    logoUrl: null,
  };
}

// SEGURIDAD: campos internos que NUNCA deben salir en una respuesta pública.
// notasInternas es información interna de INAKAT, no visible para candidatos.
function stripInternalFields(job: any) {
  const { notasInternas, ...rest } = job;
  return rest;
}

// GET - Listar todas las vacantes activas
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status') || 'active';
    const search = searchParams.get('search') || '';
    const location = searchParams.get('location') || '';
    const jobType = searchParams.get('jobType') || '';
    const workMode = searchParams.get('workMode') || '';
    const profile = searchParams.get('profile') || '';
    const userId = searchParams.get('userId') || '';
    const includeDrafts = searchParams.get('includeDrafts') === 'true';

    // Construir filtros
    const where: any = {};

    // Si pide incluir drafts, no filtrar por status
    if (!includeDrafts) {
      where.status = status;
    }

    // Filtrar por usuario específico
    if (userId) {
      where.userId = parseInt(userId);
    }

    if (search) {
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { company: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } }
      ];
    }

    if (location) {
      where.location = { contains: location, mode: 'insensitive' };
    }

    if (jobType) {
      where.jobType = jobType;
    }

    if (workMode) {
      where.workMode = workMode;
    }

    if (profile) {
      where.profile = profile;
    }

    const jobs = await prisma.job.findMany({
      where,
      orderBy: {
        createdAt: 'desc'
      },
      include: {
        _count: {
          select: { applications: true }
        }
      }
    });

    // SEGURIDAD: este GET es público (no está protegido por middleware). Quitar
    // notasInternas de TODAS las vacantes y sanear las confidenciales antes de
    // responder. Antes se devolvían las notas internas de todas las vacantes.
    const sanitizedJobs = jobs.map(job => sanitizeConfidentialJob(stripInternalFields(job)));

    return NextResponse.json({
      success: true,
      data: sanitizedJobs,
      count: sanitizedJobs.length
    });
  } catch (error) {
    console.error('Error fetching jobs:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch jobs' },
      { status: 500 }
    );
  }
}

// POST - Crear nueva vacante (como borrador por defecto)
export async function POST(request: Request) {
  try {
    // SEGURIDAD: crear/publicar vacantes requiere sesión de empresa o admin.
    // Antes se permitía crear vacantes de forma anónima (userId null) y con
    // cualquier rol.
    const auth = await requireRole(['company', 'admin']);
    if ('error' in auth) {
      return NextResponse.json(
        { success: false, error: auth.error },
        { status: auth.status }
      );
    }

    const userId: number = auth.user.id;
    const userRole: string = auth.user.role;

    const body = await request.json();
    const {
      title,
      company,
      location,
      salary,
      jobType,
      workMode,
      description,
      requirements,
      companyRating,
      expiresAt,
      // Nuevos campos para pricing
      profile,
      seniority,
      // Opción para publicar directamente
      publishNow
    } = body;

    // Validaciones básicas
    if (
      !title ||
      !company ||
      !location ||
      !salary ||
      !jobType ||
      !description
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            'Faltan campos requeridos: title, company, location, salary, jobType, description'
        },
        { status: 400 }
      );
    }

    // Calcular costo en créditos usando la función centralizada
    // IMPORTANTE: Esta función es la misma que usa /api/pricing/calculate
    let creditCost = 0;
    if (profile && seniority && workMode) {
      const pricingResult = await calculateJobCreditCost(profile, seniority, workMode);
      creditCost = pricingResult.credits;
    }

    // Determinar status. Si es publicación de EMPRESA: descontar créditos + crear
    // la vacante + registrar el ledger DE FORMA ATÓMICA (#6). Antes la deducción
    // estaba en una transacción pero la creación de la vacante y el registro del
    // ledger ocurrían fuera: si la creación fallaba tras descontar, los créditos
    // se perdían sin vacante ni asiento contable.
    const publishingAsCompany = !!publishNow && userRole === 'company';
    const publishingAsAdmin = !!publishNow && userRole === 'admin';
    const initialStatus = publishingAsCompany || publishingAsAdmin ? 'active' : 'draft';

    // Tiempo límite para editar (4 horas desde publicación). Sólo al publicar.
    const editableUntil =
      initialStatus === 'active'
        ? new Date(Date.now() + 4 * 60 * 60 * 1000)
        : null;

    const jobData = {
      title,
      company,
      location,
      salary,
      jobType,
      workMode: workMode || 'presential',
      description,
      requirements: requirements || null,
      userId,
      companyRating: companyRating || null,
      expiresAt: expiresAt ? new Date(expiresAt) : null,
      status: initialStatus,
      profile: profile || null,
      seniority: seniority || null,
      creditCost: initialStatus === 'active' ? creditCost : 0,
      editableUntil,
    };

    let job;

    if (publishingAsCompany) {
      try {
        job = await prisma.$transaction(async (tx) => {
          // Leer dentro de la transacción para bloquear la fila del usuario.
          const freshUser = await tx.user.findUnique({ where: { id: userId } });
          if (!freshUser || freshUser.credits < creditCost) {
            throw new Error('INSUFFICIENT_CREDITS');
          }

          const updatedUser = await tx.user.update({
            where: { id: userId },
            data: { credits: { decrement: creditCost } },
          });

          const createdJob = await tx.job.create({ data: jobData });

          await tx.creditTransaction.create({
            data: {
              userId,
              type: 'spend',
              amount: -creditCost,
              balanceBefore: updatedUser.credits + creditCost,
              balanceAfter: updatedUser.credits,
              description: `Publicación de vacante: ${title}`,
              jobId: createdJob.id,
            },
          });

          return createdJob;
        });
      } catch (error: unknown) {
        if (error instanceof Error && error.message === 'INSUFFICIENT_CREDITS') {
          const currentUser = await prisma.user.findUnique({ where: { id: userId } });
          return NextResponse.json(
            {
              success: false,
              error: 'Créditos insuficientes para publicar',
              required: creditCost,
              available: currentUser?.credits || 0,
              savedAsDraft: false,
            },
            { status: 402 }
          );
        }
        throw error;
      }
    } else {
      // Borrador, o publicación de admin (sin créditos): crear directamente.
      job = await prisma.job.create({ data: jobData });
    }

    return NextResponse.json(
      {
        success: true,
        message:
          initialStatus === 'active'
            ? '¡Vacante publicada exitosamente!'
            : 'Vacante guardada como borrador',
        data: job,
        status: initialStatus,
        creditCost: initialStatus === 'active' ? creditCost : 0
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Error creating job:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to create job' },
      { status: 500 }
    );
  }
}

// PUT - Publicar un borrador existente
export async function PUT(request: Request) {
  try {
    // Verificar autenticación
    const cookieStore = await cookies();
    const token = cookieStore.get('auth-token')?.value;

    if (!token) {
      return NextResponse.json(
        { success: false, error: 'No autenticado' },
        { status: 401 }
      );
    }

    const payload = verifyToken(token);
    if (!payload?.userId) {
      return NextResponse.json(
        { success: false, error: 'Token inválido' },
        { status: 401 }
      );
    }

    const user = await prisma.user.findUnique({
      where: { id: payload.userId }
    });

    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Usuario no encontrado' },
        { status: 404 }
      );
    }

    const body = await request.json();
    const { jobId } = body;

    if (!jobId) {
      return NextResponse.json(
        { success: false, error: 'Se requiere jobId' },
        { status: 400 }
      );
    }

    // Buscar la vacante
    const job = await prisma.job.findUnique({
      where: { id: jobId }
    });

    if (!job) {
      return NextResponse.json(
        { success: false, error: 'Vacante no encontrada' },
        { status: 404 }
      );
    }

    // Verificar que el usuario es dueño de la vacante
    if (job.userId !== user.id && user.role !== 'admin') {
      return NextResponse.json(
        { success: false, error: 'No tienes permiso para publicar esta vacante' },
        { status: 403 }
      );
    }

    // Verificar que está en status draft
    if (job.status !== 'draft') {
      return NextResponse.json(
        { success: false, error: 'Solo se pueden publicar vacantes en borrador' },
        { status: 400 }
      );
    }

    // Calcular costo en créditos
    let creditCost = 0;
    if (job.profile && job.seniority && job.workMode) {
      const pricingResult = await calculateJobCreditCost(job.profile, job.seniority, job.workMode);
      creditCost = pricingResult.credits;
    }

    // MEJ-002: Usar transacción para deducción de créditos (evita race conditions)
    let newBalance = user.credits;

    if (user.role !== 'admin') {
      try {
        const result = await prisma.$transaction(async (tx) => {
          // Leer usuario dentro de la transacción para bloqueo
          const freshUser = await tx.user.findUnique({
            where: { id: user.id }
          });

          if (!freshUser || freshUser.credits < creditCost) {
            throw new Error('INSUFFICIENT_CREDITS');
          }

          // Descontar créditos atómicamente
          const updatedUser = await tx.user.update({
            where: { id: user.id },
            data: { credits: { decrement: creditCost } }
          });

          // Registrar transacción de créditos
          await tx.creditTransaction.create({
            data: {
              userId: user.id,
              type: 'spend',
              amount: -creditCost,
              balanceBefore: freshUser.credits,
              balanceAfter: updatedUser.credits,
              description: `Publicación de vacante: ${job.title}`,
              jobId: job.id
            }
          });

          return { newBalance: updatedUser.credits };
        });

        newBalance = result.newBalance;
      } catch (error: any) {
        if (error.message === 'INSUFFICIENT_CREDITS') {
          const currentUser = await prisma.user.findUnique({
            where: { id: user.id }
          });
          return NextResponse.json(
            {
              success: false,
              error: 'Créditos insuficientes para publicar',
              required: creditCost,
              available: currentUser?.credits || 0
            },
            { status: 402 }
          );
        }
        throw error;
      }
    }

    // Calcular tiempo límite para editar (4 horas desde publicación)
    const editableUntil = new Date(Date.now() + 4 * 60 * 60 * 1000);

    // Actualizar vacante a activa
    const updatedJob = await prisma.job.update({
      where: { id: jobId },
      data: {
        status: 'active',
        creditCost: creditCost,
        editableUntil // Ahora sí inicia el cronómetro de 4 horas
      }
    });

    return NextResponse.json({
      success: true,
      message: '¡Vacante publicada exitosamente!',
      data: updatedJob,
      creditCost: creditCost,
      newBalance: newBalance
    });
  } catch (error) {
    console.error('Error publishing job:', error);
    return NextResponse.json(
      { success: false, error: 'Error al publicar vacante' },
      { status: 500 }
    );
  }
}
