// RUTA: src/app/api/jobs/route.ts

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyToken } from '@/lib/auth';
import { cookies } from 'next/headers';
import { calculateJobCreditCost } from '@/lib/pricing';

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

    const where: any = {};

    if (!includeDrafts) {
      where.status = status;
    }

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
      orderBy: { createdAt: 'desc' },
      include: {
        _count: { select: { applications: true } }
      }
    });

    return NextResponse.json({
      success: true,
      data: jobs,
      count: jobs.length
    });
  } catch (error) {
    console.error('Error fetching jobs:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch jobs' },
      { status: 500 }
    );
  }
}

// POST - Crear nueva vacante
export async function POST(request: Request) {
  try {
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
      profile,
      seniority,
      publishNow
    } = body;

    if (
      !title ||
      !company ||
      !location ||
      !salary ||
      !jobType ||
      !description
    ) {
      return NextResponse.json(
        { success: false, error: 'Faltan campos requeridos' },
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

    let initialStatus = 'draft';

    if (publishNow && userId) {
      const user = await prisma.user.findUnique({
        where: { id: userId }
      });

      if (user) {
        if (user.role === 'admin') {
          initialStatus = 'active';
        } else if (user.role === 'company') {
          if (user.credits >= creditCost) {
            initialStatus = 'active';

            await prisma.user.update({
              where: { id: userId },
              data: { credits: { decrement: creditCost } }
            });

            await prisma.creditTransaction.create({
              data: {
                userId: userId,
                type: 'spend',
                amount: -creditCost,
                balanceBefore: user.credits,
                balanceAfter: user.credits - creditCost,
                description: `Publicación de vacante: ${title}`
              }
            });
          } else {
            return NextResponse.json(
              {
                success: false,
                error: 'Créditos insuficientes para publicar',
                required: creditCost,
                available: user.credits,
                savedAsDraft: false
              },
              { status: 402 }
            );
          }
        }
      }
    }

    // Crear vacante SIN isRemote
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
        profile: profile || null,
        seniority: seniority || null,
        creditCost: initialStatus === 'active' ? creditCost : 0
      }
    });

    if (initialStatus === 'active' && userId && userRole === 'company') {
      await prisma.creditTransaction.updateMany({
        where: {
          userId,
          description: `Publicación de vacante: ${title}`,
          jobId: null
        },
        data: { jobId: job.id }
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
