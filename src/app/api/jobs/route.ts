// RUTA: src/app/api/jobs/route.ts

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyToken } from '@/lib/auth';
import { cookies } from 'next/headers';
import { calculateJobCreditCost } from '@/lib/pricing';

// Función para sanitizar vacantes confidenciales en vistas públicas
function sanitizeConfidentialJob(job: any, isOwnerOrAdmin: boolean) {
  if (!job.isConfidential || isOwnerOrAdmin) {
    return job;
  }

  // Ocultar datos sensibles para vacantes confidenciales
  return {
    ...job,
    company: 'Empresa Confidencial',
    location: job.location ? job.location.split(',')[1]?.trim() || 'México' : 'México', // Solo estado/país
    logoUrl: null, // Ocultar logo en vacantes confidenciales
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

    // Determinar si es vista de propietario (para no sanitizar)
    const isOwnerView = !!userId;

    const where: any = {};

    if (!includeDrafts) {
      where.status = status;
      // Filtrar vacantes expiradas de la búsqueda pública
      if (status === 'active') {
        where.OR = [
          { expiresAt: null },
          { expiresAt: { gt: new Date() } }
        ];
      }
    }

    if (userId) {
      where.userId = parseInt(userId);
    }

    if (search) {
      // Combinar búsqueda con filtro de expiración usando AND
      where.AND = [
        ...(where.OR ? [{ OR: where.OR }] : []),
        {
          OR: [
            { title: { contains: search, mode: 'insensitive' } },
            { company: { contains: search, mode: 'insensitive' } },
            { description: { contains: search, mode: 'insensitive' } }
          ]
        }
      ];
      // Limpiar el OR original si ya se movió a AND
      if (where.OR) delete where.OR;
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
        _count: { select: { applications: true } },
        user: {
          select: {
            companyRequest: {
              select: { logoUrl: true }
            }
          }
        }
      }
    });

    // Transformar para incluir logoUrl directamente y sanitizar
    const sanitizedJobs = jobs.map(job => {
      const logoUrl = job.user?.companyRequest?.logoUrl || null;
      const { user, ...jobWithoutUser } = job;
      return sanitizeConfidentialJob({ ...jobWithoutUser, logoUrl }, isOwnerView);
    });

    return NextResponse.json({
      success: true,
      data: sanitizedJobs,
      count: sanitizedJobs.length
    });
  } catch {
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
      salaryMin,
      salaryMax,
      jobType,
      workMode,
      description,
      requirements,
      companyRating,
      expiresAt,
      profile,
      subcategory,
      seniority,
      educationLevel,
      publishNow,
      // Campos extendidos
      habilidades,
      responsabilidades,
      resultadosEsperados,
      valoresActitudes,
      informacionAdicional,
      // Vacante confidencial
      isConfidential
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

    // Validar rango de salario si se proporcionan min/max
    if (salaryMin !== undefined && salaryMax !== undefined) {
      const minNum = parseInt(salaryMin) || 0;
      const maxNum = parseInt(salaryMax) || 0;

      if (minNum > maxNum) {
        return NextResponse.json(
          { success: false, error: 'El salario mínimo no puede ser mayor al máximo' },
          { status: 400 }
        );
      }

      if (maxNum - minNum > 10000) {
        return NextResponse.json(
          { success: false, error: 'La diferencia máxima permitida entre salarios es $10,000 MXN' },
          { status: 400 }
        );
      }
    }

    // Validar que la especialidad (profile) existe en el catálogo
    if (profile) {
      const specialtyExists = await prisma.specialty.findFirst({
        where: {
          name: profile,
          isActive: true
        }
      });

      if (!specialtyExists) {
        return NextResponse.json(
          { success: false, error: 'La especialidad seleccionada no es válida o no está activa' },
          { status: 400 }
        );
      }

      // Si hay subcategoría, validar que existe dentro de la especialidad
      if (subcategory && specialtyExists.subcategories) {
        const subcategories = specialtyExists.subcategories as string[];
        if (!subcategories.includes(subcategory)) {
          return NextResponse.json(
            { success: false, error: 'La sub-especialidad seleccionada no es válida para esta especialidad' },
            { status: 400 }
          );
        }
      }
    }

    // Validar salario mínimo configurado en PricingMatrix
    if (profile && seniority && workMode && salaryMin) {
      const pricingEntry = await prisma.pricingMatrix.findFirst({
        where: {
          profile,
          seniority,
          workMode,
          isActive: true
        }
      });

      if (pricingEntry?.minSalary) {
        const offeredMinSalary = parseInt(salaryMin) || 0;
        if (offeredMinSalary < pricingEntry.minSalary) {
          return NextResponse.json(
            {
              success: false,
              error: `El salario mínimo ofrecido ($${offeredMinSalary.toLocaleString()} MXN) es menor al mínimo requerido para esta especialidad ($${pricingEntry.minSalary.toLocaleString()} MXN)`,
              minSalaryRequired: pricingEntry.minSalary
            },
            { status: 400 }
          );
        }
      }
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
        salaryMin: salaryMin ? parseInt(salaryMin) : null,
        salaryMax: salaryMax ? parseInt(salaryMax) : null,
        jobType,
        workMode: workMode || 'presential',
        description,
        requirements: requirements || null,
        userId: userId,
        companyRating: companyRating || null,
        expiresAt: expiresAt ? new Date(expiresAt) : null,
        status: initialStatus,
        profile: profile || null,
        subcategory: subcategory || null,
        seniority: seniority || null,
        educationLevel: educationLevel || null,
        creditCost: initialStatus === 'active' ? creditCost : 0,
        editableUntil, // 4 horas para editar
        // Campos extendidos
        habilidades: habilidades || null,
        responsabilidades: responsabilidades || null,
        resultadosEsperados: resultadosEsperados || null,
        valoresActitudes: valoresActitudes || null,
        informacionAdicional: informacionAdicional || null,
        // Vacante confidencial
        isConfidential: isConfidential || false
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
  } catch {
    return NextResponse.json(
      { success: false, error: 'Failed to create job' },
      { status: 500 }
    );
  }
}
