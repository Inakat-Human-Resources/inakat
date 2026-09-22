// RUTA: src/app/api/jobs/route.ts

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getOptionalAuthUser, requireRole } from '@/lib/auth';
import { calculateJobCreditCost } from '@/lib/pricing';
import { getPaginationParams, buildPaginatedResponse } from '@/lib/pagination';

/** El saldo no alcanzó al reclamarlo dentro de la transacción de publicación. */
class InsufficientCreditsError extends Error {
  readonly available: number;
  constructor(available: number) {
    super('INSUFFICIENT_CREDITS');
    this.name = 'InsufficientCreditsError';
    this.available = available;
  }
}

// Función para sanitizar vacantes confidenciales en vistas públicas
function sanitizeConfidentialJob(job: any, isOwnerOrAdmin: boolean) {
  if (!job.isConfidential || isOwnerOrAdmin) {
    return job;
  }

  // Ocultar datos sensibles para vacantes confidenciales
  return {
    ...job,
    company: 'Empresa Confidencial',
    location: job.location ? job.location.split(',').pop()?.trim() || 'México' : 'México', // Solo estado/país
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

    // SEGURIDAD: la "vista de propietario" (que expone notasInternas y los datos
    // reales de vacantes confidenciales) NO puede decidirse por la mera presencia
    // del query param ?userId. Debe exigir una sesión válida cuyo usuario sea el
    // propietario solicitado (o un admin). De lo contrario cualquier visitante
    // anónimo leería notas internas y de-anonimizaría vacantes confidenciales.
    const authUser = await getOptionalAuthUser();
    const requestedUserId = userId ? parseInt(userId) : null;
    const isOwnerView =
      !!authUser &&
      requestedUserId !== null &&
      (authUser.role === 'admin' || authUser.id === requestedUserId);

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

    if (requestedUserId !== null && !Number.isNaN(requestedUserId)) {
      where.userId = requestedUserId;
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

    const pagination = getPaginationParams(searchParams, 20);

    const [jobs, total] = await Promise.all([
      prisma.job.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: pagination.skip,
        take: pagination.take,
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
      }),
      prisma.job.count({ where })
    ]);

    // Transformar para incluir logoUrl directamente y sanitizar
    // SEGURIDAD: Excluir notasInternas de la respuesta pública (solo visible en vista de propietario)
    const sanitizedJobs = jobs.map(job => {
      const logoUrl = job.user?.companyRequest?.logoUrl || null;
      const { user, notasInternas, ...jobWithoutSensitive } = job;
      const jobData = isOwnerView
        ? { ...jobWithoutSensitive, notasInternas, logoUrl }
        : { ...jobWithoutSensitive, logoUrl };
      return sanitizeConfidentialJob(jobData, isOwnerView);
    });

    const response = buildPaginatedResponse(sanitizedJobs, total, pagination);
    return NextResponse.json({
      success: true,
      ...response,
      count: sanitizedJobs.length  // backward compatibility
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
    // SEGURIDAD: crear vacantes requiere sesión de empresa o admin.
    // Antes se permitía crear vacantes anónimas (userId null) con cualquier rol.
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
      latitude,
      longitude,
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
      notasInternas,
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

    // COBRO (#VAC): publicar exige los tres campos que determinan el precio. Sin
    // ellos `creditCost` quedaba en 0 y la vacante se publicaba GRATIS con sólo
    // omitirlos del body.
    if (publishNow && userRole === 'company' && !(profile && seniority && workMode)) {
      return NextResponse.json(
        {
          success: false,
          error:
            'Para publicar hay que indicar especialidad, seniority y modalidad de trabajo: de ellos depende el costo en créditos.',
          missing: [
            !profile && 'profile',
            !seniority && 'seniority',
            !workMode && 'workMode'
          ].filter(Boolean)
        },
        { status: 400 }
      );
    }

    if (publishNow && userId) {
      if (userRole === 'admin') {
        initialStatus = 'active';
      } else if (userRole === 'company') {
        initialStatus = 'active';
      }
    }

    // Calcular tiempo límite para editar (4 horas desde publicación)
    // Solo aplica cuando se publica, NO para borradores
    const editableUntil = publishNow && initialStatus === 'active'
      ? new Date(Date.now() + 4 * 60 * 60 * 1000)
      : null;

    // ATOMICIDAD (#VAC): cobro, ledger y creación de la vacante en UNA transacción.
    // Antes eran tres llamadas sueltas con un `findUnique` previo para comprobar el
    // saldo: dos publicaciones simultáneas leían el mismo saldo y ambas cobraban
    // (saldo negativo), y si `job.create` fallaba el cobro ya estaba hecho.
    // El saldo se reclama con un `updateMany` condicionado a que alcance, que es
    // atómico en la base de datos y no depende de una lectura previa.
    const cobra = initialStatus === 'active' && userRole === 'company' && creditCost > 0;

    const job = await prisma.$transaction(async (tx) => {
      let balanceBefore = 0;
      let balanceAfter = 0;

      if (cobra) {
        const claimed = await tx.user.updateMany({
          where: { id: userId, credits: { gte: creditCost } },
          data: { credits: { decrement: creditCost } }
        });

        if (claimed.count === 0) {
          // El saldo se lee aquí y viaja con el error: tras el rollback ya no
          // habría forma de saber con cuánto se quedó corto.
          const actual = await tx.user.findUnique({
            where: { id: userId },
            select: { credits: true }
          });
          throw new InsufficientCreditsError(actual?.credits ?? 0);
        }

        const after = await tx.user.findUnique({
          where: { id: userId },
          select: { credits: true }
        });
        balanceAfter = after?.credits ?? 0;
        balanceBefore = balanceAfter + creditCost;
      }

      const created = await tx.job.create({
        data: {
        title,
        company,
        location,
        latitude: latitude || null,
        longitude: longitude || null,
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
        notasInternas: notasInternas || null,
        // Vacante confidencial
        isConfidential: isConfidential || false
        }
      });

      if (cobra) {
        // El ledger se escribe con el jobId ya conocido. Antes se creaba antes que
        // la vacante y se ataba después con un updateMany que buscaba por
        // descripción: con dos vacantes del mismo título, ataba las dos.
        await tx.creditTransaction.create({
          data: {
            userId,
            type: 'spend',
            amount: -creditCost,
            balanceBefore,
            balanceAfter,
            description: `Publicación de vacante: ${title}`,
            jobId: created.id
          }
        });
      }

      return created;
    });

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
    if (error instanceof InsufficientCreditsError) {
      // La transacción hizo rollback: no se cobró nada y no se creó la vacante.
      return NextResponse.json(
        {
          success: false,
          error: 'Créditos insuficientes para publicar',
          available: error.available,
          savedAsDraft: false
        },
        { status: 402 }
      );
    }
    console.error('Error creating job:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to create job' },
      { status: 500 }
    );
  }
}
