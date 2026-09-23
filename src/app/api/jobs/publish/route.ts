// RUTA: src/app/api/jobs/publish/route.ts

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireRole, getOptionalAuthUser, requireApprovedCompany } from '@/lib/auth';
import { calculateJobCreditCost } from '@/lib/pricing';
import { getPaginationParams, buildPaginatedResponse, parseId } from '@/lib/pagination';
import { sanitizeConfidentialJob } from '@/lib/jobs-public';

/** El borrador ya no estaba en 'draft' al reclamarlo: otra petición lo publicó. */
class YaPublicadaError extends Error {
  constructor() {
    super('ALREADY_PUBLISHED');
    this.name = 'YaPublicadaError';
  }
}

/** El saldo no alcanzó al reclamarlo dentro de la transacción de publicación. */
class SaldoInsuficienteError extends Error {
  readonly available: number;
  constructor(available: number) {
    super('INSUFFICIENT_CREDITS');
    this.name = 'SaldoInsuficienteError';
    this.available = available;
  }
}

// SEGURIDAD: campos internos que NUNCA deben salir en una respuesta pública.
// notasInternas es información interna de INAKAT, no visible para candidatos.
function stripInternalFields(job: any) {
  const { notasInternas, ...rest } = job;
  return rest;
}

// GET - Listar vacantes (copia antigua de GET /api/jobs)
//
// SEGURIDAD (#VAC): esta ruta NO está en el matcher del middleware, así que era
// anónima, y además aceptaba `?includeDrafts=true`, `?status=draft` y
// `?userId=N` sin pedir nada: cualquiera listaba los borradores no publicados,
// las pausadas y las cerradas de TODAS las empresas. Tampoco tenía take/skip,
// de modo que cada llamada serializaba la tabla Job entera —con las columnas
// @db.Text— y servía de DoS barato en bucle.
//
// Ahora se comporta como el listado público de /api/jobs: fuera de la vista de
// propietario sólo existe lo publicado y vigente, y siempre paginado.
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status') || 'active';
    const search = searchParams.get('search') || '';
    const location = searchParams.get('location') || '';
    const jobType = searchParams.get('jobType') || '';
    const workMode = searchParams.get('workMode') || '';
    const profile = searchParams.get('profile') || '';
    const includeDrafts = searchParams.get('includeDrafts') === 'true';

    // La vista de propietario exige sesión: nunca se deduce del query param.
    const authUser = await getOptionalAuthUser();
    const requestedUserId = parseId(searchParams.get('userId'));
    const isOwnerView =
      !!authUser &&
      requestedUserId !== null &&
      (authUser.role === 'admin' || authUser.id === requestedUserId);

    const where: any = {};
    const condiciones: any[] = [];

    if (isOwnerView) {
      where.userId = requestedUserId;
      if (!includeDrafts) {
        where.status = status;
      }
    } else {
      where.status = 'active';
      condiciones.push({
        OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }]
      });
    }

    if (search) {
      const porTexto: any[] = [
        { title: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } }
      ];
      // El nombre real de una confidencial no se puede sondear desde fuera: la
      // coincidencia misma revelaría quién está detrás de "Empresa Confidencial".
      porTexto.push(
        isOwnerView
          ? { company: { contains: search, mode: 'insensitive' } }
          : {
              AND: [
                { isConfidential: false },
                { company: { contains: search, mode: 'insensitive' } }
              ]
            }
      );
      condiciones.push({ OR: porTexto });
    }

    if (location) {
      condiciones.push(
        isOwnerView
          ? { location: { contains: location, mode: 'insensitive' } }
          : {
              AND: [
                { isConfidential: false },
                { location: { contains: location, mode: 'insensitive' } }
              ]
            }
      );
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

    if (condiciones.length > 0) {
      where.AND = condiciones;
    }

    const pagination = getPaginationParams(searchParams, 20);

    const [jobs, total] = await Promise.all([
      prisma.job.findMany({
        where,
        orderBy: {
          createdAt: 'desc'
        },
        skip: pagination.skip,
        take: pagination.take,
        include: {
          _count: {
            select: { applications: true }
          }
        }
      }),
      prisma.job.count({ where })
    ]);

    // Quitar notasInternas de TODAS las vacantes y sanear las confidenciales
    // antes de responder.
    const sanitizedJobs = jobs.map(job =>
      isOwnerView ? job : sanitizeConfidentialJob(stripInternalFields(job), false)
    );

    const response = buildPaginatedResponse(sanitizedJobs, total, pagination);

    return NextResponse.json({
      success: true,
      ...response,
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

// CÓDIGO MUERTO (#VAC): aquí vivía un POST sin ningún consumidor en el repo, que
// creaba y publicaba vacantes sin validar la especialidad contra el catálogo,
// sin el rango salarial, sin el salario mínimo de la matriz de precios y sin
// soportar isConfidential ni los campos extendidos. Era una vía por API para
// saltarse todas las reglas que sí aplica POST /api/jobs, que es lo que usa el
// formulario. Se eliminó: crear vacantes es POST /api/jobs.

// PUT - Publicar un borrador existente
export async function PUT(request: Request) {
  try {
    // AUTORIZACIÓN (#VAC): antes bastaba con que el JWT trajera un userId y que
    // el usuario existiera en la base; nadie miraba `isActive`. Una empresa
    // desactivada por fraude seguía publicando borradores durante los 7 días de
    // vida del token. `requireRole` comprueba rol e isActive contra la base.
    const auth = await requireRole(['company', 'admin']);
    if ('error' in auth) {
      return NextResponse.json(
        { success: false, error: auth.error },
        { status: auth.status }
      );
    }

    const user = auth.user;

    // EMP-002: una empresa pendiente de aprobación (o rechazada) no publica ni
    // compra, aunque su cuenta ya exista y esté activa.
    if (user.role === 'company') {
      const aprobacion = await requireApprovedCompany(user.id, user.role);
      if (aprobacion) {
        return NextResponse.json(
          { success: false, error: aprobacion.error, code: aprobacion.code },
          { status: aprobacion.status }
        );
      }
    }

    const body = await request.json();
    const jobId = parseId(body.jobId);

    if (jobId === null) {
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

    // Verificar que está en status draft (la comprobación definitiva se hace
    // dentro de la transacción; ésta es sólo para responder algo legible).
    if (job.status !== 'draft') {
      return NextResponse.json(
        { success: false, error: 'Solo se pueden publicar vacantes en borrador' },
        { status: 400 }
      );
    }

    const esAdmin = user.role === 'admin';

    // COBRO (#VAC): el costo salía de los campos guardados en el borrador y sólo
    // se calculaba `if (profile && seniority && workMode)`. Un borrador guardado
    // sin seniority (o con el campo vacío) se publicaba con creditCost 0, es
    // decir, GRATIS. Y una combinación que no está en la matriz devuelve
    // found:false con el precio por defecto (5), que es cobrar de menos.
    let creditCost = 0;
    let pricingFound = false;
    if (job.profile && job.seniority && job.workMode) {
      const pricingResult = await calculateJobCreditCost(job.profile, job.seniority, job.workMode);
      creditCost = pricingResult.credits;
      pricingFound = pricingResult.found;
    }

    if (!esAdmin) {
      if (!(job.profile && job.seniority && job.workMode)) {
        return NextResponse.json(
          {
            success: false,
            error:
              'Para publicar hay que indicar especialidad, seniority y modalidad de trabajo: de ellos depende el costo en créditos.',
            missing: [
              !job.profile && 'profile',
              !job.seniority && 'seniority',
              !job.workMode && 'workMode'
            ].filter(Boolean)
          },
          { status: 400 }
        );
      }

      if (!pricingFound || creditCost <= 0) {
        return NextResponse.json(
          {
            success: false,
            error:
              'No hay un precio configurado para esa combinación de especialidad, seniority y modalidad. Revisa los datos de la vacante.',
            profile: job.profile,
            seniority: job.seniority,
            workMode: job.workMode
          },
          { status: 400 }
        );
      }
    }

    // Calcular tiempo límite para editar (4 horas desde publicación)
    const editableUntil = new Date(Date.now() + 4 * 60 * 60 * 1000);

    // ATOMICIDAD (#VAC): activar el borrador y cobrar van en UNA transacción, y
    // las dos cosas se reclaman con un `updateMany` condicionado.
    //
    // Antes el estado 'draft' se comprobaba con una lectura previa y la
    // activación era un `job.update` suelto DESPUÉS de la transacción del cobro:
    //  - doble clic o dos pestañas => los dos PUT veían 'draft', los dos
    //    descontaban créditos y la vacante se publicaba una sola vez;
    //  - si la activación fallaba tras confirmar el cobro, los créditos se
    //    perdían con la vacante aún en borrador.
    // Y el `findUnique` "para bloquear la fila" no bloquea nada: en PostgreSQL
    // con READ COMMITTED un SELECT normal no toma lock, así que dos peticiones
    // leían el mismo saldo, ambas pasaban el if y ambos decrement se aplicaban
    // (saldo negativo: el esquema no tiene CHECK credits >= 0).
    let resultado: { job: any; newBalance: number };

    try {
      resultado = await prisma.$transaction(async (tx) => {
        const reclamado = await tx.job.updateMany({
          where: { id: jobId, status: 'draft' },
          data: {
            status: 'active',
            creditCost,
            editableUntil // Ahora sí inicia el cronómetro de 4 horas
          }
        });

        if (reclamado.count === 0) {
          throw new YaPublicadaError();
        }

        let newBalance = user.credits;

        if (!esAdmin && creditCost > 0) {
          const cobrado = await tx.user.updateMany({
            where: { id: user.id, credits: { gte: creditCost } },
            data: { credits: { decrement: creditCost } }
          });

          if (cobrado.count === 0) {
            const actual = await tx.user.findUnique({
              where: { id: user.id },
              select: { credits: true }
            });
            // Lanzar revierte también la activación del borrador.
            throw new SaldoInsuficienteError(actual?.credits ?? 0);
          }

          const after = await tx.user.findUnique({
            where: { id: user.id },
            select: { credits: true }
          });
          newBalance = after?.credits ?? 0;

          await tx.creditTransaction.create({
            data: {
              userId: user.id,
              type: 'spend',
              amount: -creditCost,
              balanceBefore: newBalance + creditCost,
              balanceAfter: newBalance,
              description: `Publicación de vacante: ${job.title}`,
              jobId: job.id
            }
          });
        }

        const actualizado = await tx.job.findUnique({ where: { id: jobId } });

        return { job: actualizado, newBalance };
      });
    } catch (error: unknown) {
      if (error instanceof SaldoInsuficienteError) {
        // Rollback: ni se cobró ni se publicó.
        return NextResponse.json(
          {
            success: false,
            error: 'Créditos insuficientes para publicar',
            required: creditCost,
            available: error.available
          },
          { status: 402 }
        );
      }

      if (error instanceof YaPublicadaError) {
        return NextResponse.json(
          { success: false, error: 'Esta vacante ya no está en borrador (¿se publicó desde otra pestaña?)' },
          { status: 409 }
        );
      }

      throw error;
    }

    return NextResponse.json({
      success: true,
      message: '¡Vacante publicada exitosamente!',
      data: resultado.job,
      creditCost: creditCost,
      newBalance: resultado.newBalance
    });
  } catch (error) {
    console.error('Error publishing job:', error);
    return NextResponse.json(
      { success: false, error: 'Error al publicar vacante' },
      { status: 500 }
    );
  }
}
