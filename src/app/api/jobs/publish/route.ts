// RUTA: src/app/api/jobs/publish/route.ts

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyToken } from '@/lib/auth';
import { cookies } from 'next/headers';
import { calculateJobCreditCost } from '@/lib/pricing';

// Función para sanitizar vacantes confidenciales
function sanitizeConfidentialJob(job: any) {
  if (!job.isConfidential) return job;
  return {
    ...job,
    company: 'Empresa Confidencial',
    location: job.location ? job.location.split(',').pop()?.trim() || 'México' : 'México',
  };
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

    // Sanitizar vacantes confidenciales
    const sanitizedJobs = jobs.map(job => sanitizeConfidentialJob(job));

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
    // Verificar autenticación
    const cookieStore = await cookies();
    const token = cookieStore.get('auth-token')?.value;

    let userId: number | null = null;
    let userRole: string = 'user';

    if (token) {
      const payload = verifyToken(token);
      if (payload?.userId) {
        const user = await prisma.user.findUnique({
          where: { id: payload.userId }
        });
        if (user) {
          userId = user.id;
          userRole = user.role;
        }
      }
    }

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

    // Determinar el status inicial
    // - Si es admin: puede publicar directo
    // - Si es empresa y quiere publicar ahora: verificar créditos
    // - Por defecto: guardar como borrador
    let initialStatus = 'draft';
    let balanceAfterPublish: number | null = null;

    // MEJ-002: Usar transacción para deducción de créditos (evita race conditions)
    if (publishNow && userId) {
      const user = await prisma.user.findUnique({
        where: { id: userId }
      });

      if (user) {
        if (user.role === 'admin') {
          // Admin puede publicar sin créditos
          initialStatus = 'active';
        } else if (user.role === 'company') {
          // Empresa necesita créditos - usar transacción para atomicidad
          try {
            await prisma.$transaction(async (tx) => {
              // Leer usuario dentro de la transacción para bloqueo
              const freshUser = await tx.user.findUnique({
                where: { id: userId }
              });

              if (!freshUser || freshUser.credits < creditCost) {
                throw new Error('INSUFFICIENT_CREDITS');
              }

              // Descontar créditos atómicamente
              const updatedUser = await tx.user.update({
                where: { id: userId },
                data: { credits: { decrement: creditCost } }
              });

              balanceAfterPublish = updatedUser.credits;
            });

            initialStatus = 'active';
          } catch (error: any) {
            if (error.message === 'INSUFFICIENT_CREDITS') {
              const currentUser = await prisma.user.findUnique({
                where: { id: userId }
              });
              return NextResponse.json(
                {
                  success: false,
                  error: 'Créditos insuficientes para publicar',
                  required: creditCost,
                  available: currentUser?.credits || 0,
                  savedAsDraft: false
                },
                { status: 402 }
              );
            }
            throw error;
          }
        }
      }
    }

    // Calcular tiempo límite para editar (4 horas desde publicación)
    // Solo aplica cuando se publica, NO para borradores
    const editableUntil = publishNow && initialStatus === 'active'
      ? new Date(Date.now() + 4 * 60 * 60 * 1000)
      : null;

    // Crear vacante
    const job = await prisma.job.create({
      data: {
        title,
        company,
        location,
        salary,
        jobType,
        workMode: workMode || 'presential',
        description,
        requirements: requirements || null,
        userId: userId,
        companyRating: companyRating || null,
        expiresAt: expiresAt ? new Date(expiresAt) : null,
        status: initialStatus,
        // Campos de pricing
        profile: profile || null,
        seniority: seniority || null,
        creditCost: initialStatus === 'active' ? creditCost : 0,
        editableUntil // 4 horas para editar
      }
    });

    // Registrar transacción de créditos si se publicó
    if (initialStatus === 'active' && userId && userRole === 'company' && balanceAfterPublish !== null) {
      await prisma.creditTransaction.create({
        data: {
          userId: userId,
          type: 'spend',
          amount: -creditCost,
          balanceBefore: balanceAfterPublish + creditCost, // Balance antes del decremento
          balanceAfter: balanceAfterPublish,
          description: `Publicación de vacante: ${title}`,
          jobId: job.id
        }
      });
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
