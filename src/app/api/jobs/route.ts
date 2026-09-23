// RUTA: src/app/api/jobs/route.ts

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getOptionalAuthUser, requireRole, requireApprovedCompany } from '@/lib/auth';
import { calculateJobCreditCost } from '@/lib/pricing';
import { getPaginationParams, buildPaginatedResponse, parseId } from '@/lib/pagination';
import {
  WORK_MODES,
  isValidWorkMode,
  parseHabilidades,
  parseExpiresAt,
  parseCoordinate,
  resolveCompanyName
} from '@/lib/jobs-validation';
import { sanitizeConfidentialJob } from '@/lib/jobs-public';

/** El saldo no alcanzó al reclamarlo dentro de la transacción de publicación. */
class InsufficientCreditsError extends Error {
  readonly available: number;
  constructor(available: number) {
    super('INSUFFICIENT_CREDITS');
    this.name = 'InsufficientCreditsError';
    this.available = available;
  }
}

/**
 * Orden del listado. El buscador de /talents ordenaba EN EL CLIENTE sólo la
 * página que tenía cargada, así que "Menos reciente" o "A → Z" no eran un orden
 * global. El `id` desempata para que la paginación sea estable.
 */
const ORDENES: Record<string, Array<Record<string, 'asc' | 'desc'>>> = {
  newest: [{ createdAt: 'desc' }, { id: 'desc' }],
  oldest: [{ createdAt: 'asc' }, { id: 'asc' }],
  az: [{ title: 'asc' }, { id: 'asc' }],
  za: [{ title: 'desc' }, { id: 'desc' }]
};

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
    const requestedUserId = parseId(userId);
    // VISTA ADMIN (#VAC): el dashboard de admin pide
    // `/api/jobs?includeDrafts=true&limit=100` (y assign-candidates
    // `?status=active&limit=100`) sin userId, así que recibía la vista pública:
    // sólo activas, y sus contadores de pausadas/borradores/cerradas salían en
    // 0. Un admin con sesión que lo pide EXPLÍCITAMENTE (`includeDrafts=true` o
    // `all=true`) ve las vacantes de todas las empresas. Sin esos parámetros la
    // respuesta es la pública, idéntica para todos (ver Cache-Control abajo).
    const pideTodo = includeDrafts || searchParams.get('all') === 'true';
    const isAdminAllView =
      !!authUser && authUser.role === 'admin' && requestedUserId === null && pideTodo;

    const isOwnerView =
      isAdminAllView ||
      (!!authUser &&
        requestedUserId !== null &&
        (authUser.role === 'admin' || authUser.id === requestedUserId));

    const where: any = {};
    // Condiciones que se acumulan en where.AND (varias pueden coexistir: la
    // vigencia, la búsqueda por texto y la ubicación).
    const condiciones: any[] = [];

    // SEGURIDAD (#VAC): el estado a listar NO lo decide el cliente.
    //
    // `includeDrafts=true` quitaba el filtro de status y `status=draft` hacía lo
    // mismo por la puerta de al lado, sin exigir sesión: cualquiera listaba los
    // borradores (planes de contratación no publicados, con salario y
    // descripción), las pausadas y las cerradas de TODAS las empresas. El filtro
    // `?userId=N` tampoco pedía nada, así que servía para agruparlas por empresa.
    //
    // Fuera de la vista de propietario sólo existe lo publicado y vigente.
    if (isOwnerView) {
      if (requestedUserId !== null) {
        where.userId = requestedUserId;
      }
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
      // PRIVACIDAD (#VAC): la búsqueda corre en la base contra el nombre REAL de
      // la empresa y sólo después se enmascara el resultado, así que un acierto
      // con `?search=AcmeCorp` confirmaba quién está detrás de "Empresa
      // Confidencial". Fuera de la vista de propietario, el nombre de la empresa
      // sólo se busca donde es público.
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
      // Mismo motivo: la dirección exacta de una vacante confidencial no se
      // puede sondear desde fuera (su ubicación pública es sólo el estado).
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
    const orderBy = ORDENES[searchParams.get('sort') || 'newest'] ?? ORDENES.newest;

    const [jobs, total] = await Promise.all([
      prisma.job.findMany({
        where,
        orderBy,
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

    // CACHÉ (#VAC): cada visita anónima a /talents ejecutaba findMany + count
    // sin ninguna caché. Sólo se cachea en el CDN la respuesta que es IDÉNTICA
    // para cualquiera: sin `userId`, `includeDrafts` ni `all`, que son los
    // únicos parámetros con los que la sesión cambia el resultado. El CDN
    // indexa por URL y no por cookie, así que cachear una vista de propietario
    // se la serviría a un anónimo.
    const respuestaPublica =
      requestedUserId === null && !pideTodo && searchParams.get('userId') === null;

    return NextResponse.json(
      {
        success: true,
        ...response,
        count: sanitizedJobs.length  // backward compatibility
      },
      {
        headers: {
          'Cache-Control': respuestaPublica
            ? 'public, s-maxage=60, stale-while-revalidate=300'
            : 'private, no-store'
        }
      }
    );
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

    // EMP-002: una empresa pendiente de aprobación (o rechazada) no publica ni
    // compra, aunque su cuenta ya exista y esté activa.
    if (userRole === 'company') {
      const aprobacion = await requireApprovedCompany(userId, userRole);
      if (aprobacion) {
        return NextResponse.json(
          { success: false, error: aprobacion.error, code: aprobacion.code },
          { status: aprobacion.status }
        );
      }
    }

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

    // VALIDACIÓN (#VAC): el rango salarial sólo se comprobaba «si llegan ambos
    // campos», y el mínimo de la matriz de precios «si llega salaryMin»: bastaba
    // con omitirlos para saltarse las dos reglas y publicar con un `salary` de
    // texto libre como "$3,000 - $80,000 / mes". El formulario ya los exige y los
    // envía siempre; ahora el servidor también.
    const minNum = parseInt(salaryMin) || 0;
    const maxNum = parseInt(salaryMax) || 0;

    if (minNum <= 0 || maxNum <= 0) {
      return NextResponse.json(
        { success: false, error: 'Indica el salario mínimo y el máximo (números mayores a 0)' },
        { status: 400 }
      );
    }

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

    // VALIDACIÓN (#VAC): la modalidad determina el precio y no se comprobaba
    // contra ningún catálogo. Un valor inventado no encuentra fila en la matriz
    // y se cobraba el precio por defecto (5) en vez del real.
    if (workMode !== undefined && workMode !== null && workMode !== '' && !isValidWorkMode(workMode)) {
      return NextResponse.json(
        { success: false, error: `Modalidad de trabajo inválida. Debe ser una de: ${WORK_MODES.join(', ')}` },
        { status: 400 }
      );
    }

    const habilidadesParsed = parseHabilidades(habilidades);
    if (!habilidadesParsed.ok) {
      return NextResponse.json(
        { success: false, error: habilidadesParsed.error },
        { status: 400 }
      );
    }

    // Estos tres se validan ANTES de tocar créditos: un Invalid Date o una
    // coordenada fuera de rango hacía lanzar a `job.create` con el cobro ya hecho.
    const expiresAtParsed = parseExpiresAt(expiresAt);
    if (!expiresAtParsed.ok) {
      return NextResponse.json({ success: false, error: expiresAtParsed.error }, { status: 400 });
    }

    const latParsed = parseCoordinate(latitude, 'latitude');
    if (!latParsed.ok) {
      return NextResponse.json({ success: false, error: latParsed.error }, { status: 400 });
    }

    const lonParsed = parseCoordinate(longitude, 'longitude');
    if (!lonParsed.ok) {
      return NextResponse.json({ success: false, error: lonParsed.error }, { status: 400 });
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
    if (profile && seniority && workMode) {
      const pricingEntry = await prisma.pricingMatrix.findFirst({
        where: {
          profile,
          seniority,
          workMode,
          isActive: true
        }
      });

      if (pricingEntry?.minSalary) {
        const offeredMinSalary = minNum;
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
    let pricingFound = false;
    if (profile && seniority && workMode) {
      const pricingResult = await calculateJobCreditCost(profile, seniority, workMode);
      creditCost = pricingResult.credits;
      pricingFound = pricingResult.found;
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

    // COBRO (#VAC): si la combinación no está en la matriz de precios,
    // `calculateJobCreditCost` devuelve found:false y el precio por defecto (5).
    // Publicar a ese precio es cobrar de menos: p. ej. 'Director.' (con punto) no
    // encuentra fila y salía por 5 créditos en vez de por el precio real.
    if (publishNow && userRole === 'company' && (!pricingFound || creditCost <= 0)) {
      return NextResponse.json(
        {
          success: false,
          error:
            'No hay un precio configurado para esa combinación de especialidad, seniority y modalidad. Revisa los datos de la vacante.',
          profile,
          seniority,
          workMode
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

    // SUPLANTACIÓN (#VAC): en la UI el nombre de la empresa es de sólo lectura,
    // pero el servidor guardaba lo que llegara en el body: "X SA" podía publicar
    // a nombre de "Google México". Para rol company manda su solicitud aprobada.
    const companyName = await resolveCompanyName(userId, userRole, company);

    // companyRating sólo lo fija un admin, y dentro de 0-5.
    let companyRatingValido: number | null = null;
    if (userRole === 'admin' && companyRating !== undefined && companyRating !== null && companyRating !== '') {
      const rating = Number(companyRating);
      if (!Number.isFinite(rating) || rating < 0 || rating > 5) {
        return NextResponse.json(
          { success: false, error: 'companyRating debe ser un número entre 0 y 5' },
          { status: 400 }
        );
      }
      companyRatingValido = rating;
    }

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
        // El nombre de la empresa sale de su solicitud registrada, no del body.
        company: companyName,
        location,
        latitude: latParsed.value,
        longitude: lonParsed.value,
        salary,
        salaryMin: minNum,
        salaryMax: maxNum,
        jobType,
        workMode: workMode || 'presential',
        description,
        requirements: requirements || null,
        userId: userId,
        // VALIDACIÓN (#VAC): las estrellas que ve el candidato las fijaba la
        // propia empresa desde el body, sin rango ni control de rol, y no existe
        // ningún sistema real de reseñas detrás. Sólo un admin puede ponerlas.
        companyRating: userRole === 'admin' ? companyRatingValido : null,
        expiresAt: expiresAtParsed.value,
        status: initialStatus,
        profile: profile || null,
        subcategory: subcategory || null,
        seniority: seniority || null,
        educationLevel: educationLevel || null,
        creditCost: initialStatus === 'active' ? creditCost : 0,
        editableUntil, // 4 horas para editar
        // Campos extendidos
        habilidades: habilidadesParsed.value,
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
