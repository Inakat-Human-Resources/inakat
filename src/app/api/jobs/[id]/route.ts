// RUTA: src/app/api/jobs/[id]/route.ts

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { calculateJobCreditCost } from '@/lib/pricing';
import { requireAuth, getOptionalAuthUser, requireApprovedCompany } from '@/lib/auth';
import {
  WORK_MODES,
  isValidWorkMode,
  parseHabilidades,
  parseCoordinate,
  resolveCompanyName
} from '@/lib/jobs-validation';
// La vista pública de una confidencial (sin nombre, logo, userId, coordenadas
// ni dirección) vive en un solo sitio para las tres rutas de vacantes.
import { sanitizeConfidentialJob } from '@/lib/jobs-public';

/** El saldo no alcanzó al reclamarlo dentro de la transacción de ajuste. */
class CreditosInsuficientesError extends Error {
  readonly available: number;
  constructor(available: number) {
    super('INSUFFICIENT_CREDITS');
    this.name = 'CreditosInsuficientesError';
    this.available = available;
  }
}

// Helper para verificar autenticación y ownership
//
// AUTORIZACIÓN (#VAC): antes se decidía SÓLO con lo que dice el JWT (userId y
// role), sin mirar la base. El token dura 7 días, así que una empresa
// desactivada por fraude seguía editando, borrando y publicando sus vacantes
// durante una semana, y un admin degradado conservaba su bypass hasta que el
// token expirara. `requireAuth` consulta el usuario y comprueba `isActive` y su
// rol ACTUAL; es el mismo helper que ya usa POST /api/jobs.
async function verifyJobOwnership(jobUserId: number | null): Promise<{
  authenticated: boolean;
  authorized: boolean;
  userId?: number;
  role?: string;
  error?: string;
}> {
  const auth = await requireAuth();

  if ('error' in auth) {
    // 401 = no hay sesión utilizable; 403 = la hay pero el usuario ya no sirve
    // (desactivado). `authenticated` distingue cuál de los dos responde la ruta.
    return {
      authenticated: auth.status !== 401,
      authorized: false,
      error: auth.error
    };
  }

  const isAdmin = auth.user.role === 'admin';
  const isOwner = jobUserId === auth.user.id;

  if (!isAdmin && !isOwner) {
    return {
      authenticated: true,
      authorized: false,
      userId: auth.user.id,
      role: auth.user.role,
      error: 'No tienes permiso para modificar esta vacante'
    };
  }

  return { authenticated: true, authorized: true, userId: auth.user.id, role: auth.user.role };
}

// GET - Obtener vacante por ID
export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const jobId = parseInt(id);

    if (isNaN(jobId)) {
      return NextResponse.json(
        { success: false, error: 'Invalid job ID' },
        { status: 400 }
      );
    }

    const job = await prisma.job.findUnique({
      where: { id: jobId },
      include: {
        user: {
          select: {
            companyRequest: {
              select: { logoUrl: true }
            }
          }
        }
      }
    });

    if (!job) {
      return NextResponse.json(
        { success: false, error: 'Job not found' },
        { status: 404 }
      );
    }

    // Verificar si el usuario es propietario o admin.
    // Se consulta la base (getOptionalAuthUser) en vez de fiarse del JWT: un
    // usuario desactivado no es propietario de nada.
    const authUser = await getOptionalAuthUser();
    const isOwnerOrAdmin =
      !!authUser && (authUser.role === 'admin' || job.userId === authUser.id);

    // SEGURIDAD (#VAC): la ficha se devolvía sea cual sea su estado, así que
    // bastaba con enumerar /api/jobs/1..N para leer los borradores no publicados
    // de cualquier empresa (puesto, salario, descripción) y sus vacantes
    // pausadas o cerradas. Fuera del propietario sólo existe lo publicado y
    // vigente; el resto responde 404, que es además lo que ve quien no debería
    // saber siquiera que la vacante existe.
    const vigente = !job.expiresAt || job.expiresAt > new Date();
    if (!isOwnerOrAdmin && (job.status !== 'active' || !vigente)) {
      return NextResponse.json(
        { success: false, error: 'Job not found' },
        { status: 404 }
      );
    }

    // Transformar para incluir logoUrl directamente
    // SEGURIDAD: Excluir notasInternas de la respuesta pública
    const logoUrl = job.user?.companyRequest?.logoUrl || null;
    const { user, notasInternas, ...jobWithoutSensitive } = job;
    const jobWithLogo = isOwnerOrAdmin
      ? { ...jobWithoutSensitive, notasInternas, logoUrl }
      : { ...jobWithoutSensitive, logoUrl };

    // Sanitizar si es confidencial y no es propietario/admin
    const sanitizedJob = sanitizeConfidentialJob(jobWithLogo, isOwnerOrAdmin);

    return NextResponse.json({ success: true, data: sanitizedJob });
  } catch (error) {
    console.error('Error fetching job:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch job' },
      { status: 500 }
    );
  }
}

// Función auxiliar para validar especialidad
async function validateSpecialty(profile: string | null, subcategory: string | null) {
  if (!profile) return { valid: true };

  const specialtyExists = await prisma.specialty.findFirst({
    where: {
      name: profile,
      isActive: true
    }
  });

  if (!specialtyExists) {
    return { valid: false, error: 'La especialidad seleccionada no es válida o no está activa' };
  }

  // Si hay subcategoría, validar que existe dentro de la especialidad
  if (subcategory && specialtyExists.subcategories) {
    const subcategories = specialtyExists.subcategories as string[];
    if (!subcategories.includes(subcategory)) {
      return { valid: false, error: 'La sub-especialidad seleccionada no es válida para esta especialidad' };
    }
  }

  return { valid: true };
}

// PATCH - Actualizar vacante (parcial)
export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const jobId = parseInt(id);

    if (isNaN(jobId)) {
      return NextResponse.json(
        { success: false, error: 'Invalid job ID' },
        { status: 400 }
      );
    }

    const body = await request.json();

    // Verificar que la vacante existe
    const existingJob = await prisma.job.findUnique({
      where: { id: jobId }
    });

    if (!existingJob) {
      return NextResponse.json(
        { success: false, error: 'Job not found' },
        { status: 404 }
      );
    }

    // Verificar autenticación y ownership
    const auth = await verifyJobOwnership(existingJob.userId);
    if (!auth.authenticated) {
      return NextResponse.json({ success: false, error: auth.error }, { status: 401 });
    }
    if (!auth.authorized) {
      return NextResponse.json({ success: false, error: auth.error }, { status: 403 });
    }

    // EMP-002: reactivar una vacante (-> active) exige empresa aprobada.
    if (body.status === 'active' && auth.role === 'company' && auth.userId !== undefined) {
      const aprobacion = await requireApprovedCompany(auth.userId, auth.role);
      if (aprobacion) {
        return NextResponse.json(
          { success: false, error: aprobacion.error, code: aprobacion.code },
          { status: aprobacion.status }
        );
      }
    }

    // Verificar si el tiempo de edición ha expirado (4 horas)
    // Solo aplica para ediciones de contenido, no para cambios de status
    const allowedFieldsAfterExpiry = ['status', 'closedReason'];
    const contentFields = Object.keys(body).filter(k => !allowedFieldsAfterExpiry.includes(k));

    if (existingJob.editableUntil && new Date() > existingJob.editableUntil && contentFields.length > 0) {
      return NextResponse.json(
        {
          success: false,
          error: 'El tiempo para editar esta vacante ha expirado (4 horas después de su creación)'
        },
        { status: 403 }
      );
    }

    // Validar status si se proporciona
    const validJobStatuses = ['active', 'paused', 'closed', 'draft'];
    if (body.status && !validJobStatuses.includes(body.status)) {
      return NextResponse.json(
        {
          success: false,
          error: `Invalid status. Must be one of: ${validJobStatuses.join(', ')}`
        },
        { status: 400 }
      );
    }

    // SEGURIDAD (#39 + #VAC): no publicar gratis desde PATCH.
    //
    // Un borrador nunca pagó créditos, así que para el owner es un callejón sin
    // salida: de `draft` sólo se sale por /api/jobs/publish, que valida y cobra.
    // Antes sólo se bloqueaba draft -> active, y como no hay máquina de estados
    // el bloqueo se rodeaba en dos pasos: draft -> paused -> active, que sí
    // estaba permitido porque el segundo salto ya no partía de un borrador.
    //
    // (No se usa `creditCost > 0` como prueba de pago: las vacantes anteriores al
    // cobro tienen 0 y dejarían a su dueño sin poder reanudarlas.)
    if (
      existingJob.status === 'draft' &&
      body.status !== undefined &&
      body.status !== 'draft' &&
      auth.role !== 'admin'
    ) {
      return NextResponse.json(
        {
          success: false,
          error: 'Para publicar/activar esta vacante usa el flujo de publicación (/api/jobs/publish), que valida y cobra los créditos correspondientes.'
        },
        { status: 403 }
      );
    }

    // Validar closedReason si se proporciona
    const validClosedReasons = ['success', 'cancelled'];
    if (body.closedReason && !validClosedReasons.includes(body.closedReason)) {
      return NextResponse.json(
        {
          success: false,
          error: `Invalid closedReason. Must be one of: ${validClosedReasons.join(', ')}`
        },
        { status: 400 }
      );
    }

    // Si se está cerrando la vacante, se requiere closedReason
    if (body.status === 'closed' && !body.closedReason) {
      return NextResponse.json(
        {
          success: false,
          error: 'closedReason is required when closing a job'
        },
        { status: 400 }
      );
    }

    // Validar especialidad si se proporciona
    if (body.profile !== undefined) {
      const validation = await validateSpecialty(body.profile, body.subcategory);
      if (!validation.valid) {
        return NextResponse.json(
          { success: false, error: validation.error },
          { status: 400 }
        );
      }
    }

    // Validar el rango salarial y el mínimo de la matriz de precios.
    //
    // VALIDACIÓN (#VAC): el rango sólo se comprobaba si llegaban LOS DOS campos
    // y el mínimo de la matriz no se comprobaba nunca en PATCH. Mandando sólo
    // `salaryMin: 3000` sobre una vacante de 30,000-38,000 se quedaba con un
    // rango de 35,000 de diferencia y por debajo del mínimo de su especialidad.
    // Se valida con los valores FINALES (lo que llega o, si no, lo guardado).
    if (body.salaryMin !== undefined || body.salaryMax !== undefined) {
      const minNum =
        body.salaryMin !== undefined ? parseInt(body.salaryMin) || 0 : existingJob.salaryMin ?? 0;
      const maxNum =
        body.salaryMax !== undefined ? parseInt(body.salaryMax) || 0 : existingJob.salaryMax ?? 0;

      if (minNum > 0 && maxNum > 0) {
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

      const perfilFinal = body.profile !== undefined ? body.profile : existingJob.profile;
      const seniorityFinal = body.seniority !== undefined ? body.seniority : existingJob.seniority;
      const workModeFinal = body.workMode !== undefined ? body.workMode : existingJob.workMode;

      if (minNum > 0 && perfilFinal && seniorityFinal && workModeFinal) {
        const pricingEntry = await prisma.pricingMatrix.findFirst({
          where: { profile: perfilFinal, seniority: seniorityFinal, workMode: workModeFinal, isActive: true }
        });

        if (pricingEntry?.minSalary && minNum < pricingEntry.minSalary) {
          return NextResponse.json(
            {
              success: false,
              error: `El salario mínimo ofrecido ($${minNum.toLocaleString()} MXN) es menor al mínimo requerido para esta especialidad ($${pricingEntry.minSalary.toLocaleString()} MXN)`,
              minSalaryRequired: pricingEntry.minSalary
            },
            { status: 400 }
          );
        }
      }
    }

    // Whitelist de campos permitidos (previene inyección de userId, creditCost, editableUntil)
    //
    // COBRO (#VAC): `profile`, `seniority` y `workMode` determinan el precio, y
    // PATCH no recalcula ni cobra nada. Estaban en la lista, así que se podía
    // publicar como junior/remoto (barato) y ascender después a senior/presencial
    // gratis. El que sí recalcula y cobra la diferencia es PUT, que es además lo
    // que usa el formulario de edición; desde PATCH sólo los toca un admin.
    const PRICE_FIELDS = ['profile', 'subcategory', 'seniority', 'workMode'];
    // SUPLANTACIÓN Y RESEÑAS FALSAS (#VAC): `company` permitía renombrar la
    // vacante como si fuera de otra empresa (phishing a candidatos) y
    // `companyRating` pintaba estrellas que nadie ha dado — no existe un sistema
    // de reseñas detrás. Ambos sólo los toca un admin, como los de precio.
    const ADMIN_ONLY_FIELDS = ['company', 'companyRating'];
    const allowedPatchFields = ['status', 'closedReason', 'title', 'location',
      'latitude', 'longitude', 'salary', 'salaryMin', 'salaryMax', 'jobType',
      'description', 'requirements',
      'educationLevel', 'habilidades', 'responsabilidades', 'resultadosEsperados',
      'valoresActitudes', 'informacionAdicional', 'notasInternas', 'isConfidential',
      ...(auth.role === 'admin' ? PRICE_FIELDS : []),
      ...(auth.role === 'admin' ? ADMIN_ONLY_FIELDS : [])];

    if (auth.role !== 'admin') {
      const intentados = PRICE_FIELDS.filter((f) => body[f] !== undefined);
      if (intentados.length > 0) {
        return NextResponse.json(
          {
            success: false,
            error:
              'Especialidad, seniority y modalidad determinan el costo de la vacante: edítalos desde el formulario de la vacante, que recalcula y ajusta los créditos.',
            fields: intentados
          },
          { status: 400 }
        );
      }
    }
    const updateData: Record<string, any> = {};
    for (const field of allowedPatchFields) {
      if (body[field] !== undefined) updateData[field] = body[field];
    }

    // habilidades es un JSON array de strings: cualquier otra cosa deja la
    // vacante imposible de abrir en el formulario de edición.
    if (updateData.habilidades !== undefined) {
      const parsed = parseHabilidades(updateData.habilidades);
      if (!parsed.ok) {
        return NextResponse.json({ success: false, error: parsed.error }, { status: 400 });
      }
      updateData.habilidades = parsed.value;
    }

    for (const campo of ['latitude', 'longitude'] as const) {
      if (updateData[campo] !== undefined) {
        const parsed = parseCoordinate(updateData[campo], campo);
        if (!parsed.ok) {
          return NextResponse.json({ success: false, error: parsed.error }, { status: 400 });
        }
        updateData[campo] = parsed.value;
      }
    }

    if (updateData.workMode !== undefined && !isValidWorkMode(updateData.workMode)) {
      return NextResponse.json(
        { success: false, error: `Modalidad de trabajo inválida. Debe ser una de: ${WORK_MODES.join(', ')}` },
        { status: 400 }
      );
    }

    if (updateData.companyRating !== undefined) {
      const rating = Number(updateData.companyRating);
      if (!Number.isFinite(rating) || rating < 0 || rating > 5) {
        return NextResponse.json(
          { success: false, error: 'companyRating debe ser un número entre 0 y 5' },
          { status: 400 }
        );
      }
      updateData.companyRating = rating;
    }

    // Convertir salaryMin/salaryMax a Int si existen
    if (updateData.salaryMin !== undefined) {
      updateData.salaryMin = updateData.salaryMin ? parseInt(updateData.salaryMin) : null;
    }
    if (updateData.salaryMax !== undefined) {
      updateData.salaryMax = updateData.salaryMax ? parseInt(updateData.salaryMax) : null;
    }

    // Actualizar vacante
    const updatedJob = await prisma.job.update({
      where: { id: jobId },
      data: updateData
    });

    return NextResponse.json({
      success: true,
      message: 'Job updated successfully',
      data: updatedJob
    });
  } catch (error) {
    console.error('Error updating job:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update job' },
      { status: 500 }
    );
  }
}

// PUT - Actualizar vacante (completa) - Usado por el formulario de edición
export async function PUT(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const jobId = parseInt(id);

    if (isNaN(jobId)) {
      return NextResponse.json(
        { success: false, error: 'ID de vacante inválido' },
        { status: 400 }
      );
    }

    const body = await request.json();

    // Verificar que la vacante existe
    const existingJob = await prisma.job.findUnique({
      where: { id: jobId }
    });

    if (!existingJob) {
      return NextResponse.json(
        { success: false, error: 'Vacante no encontrada' },
        { status: 404 }
      );
    }

    // Verificar autenticación y ownership
    const auth = await verifyJobOwnership(existingJob.userId);
    if (!auth.authenticated) {
      return NextResponse.json({ success: false, error: auth.error }, { status: 401 });
    }
    if (!auth.authorized) {
      return NextResponse.json({ success: false, error: auth.error }, { status: 403 });
    }

    // Verificar si el tiempo de edición ha expirado (4 horas)
    if (existingJob.editableUntil && new Date() > existingJob.editableUntil) {
      return NextResponse.json(
        {
          success: false,
          error: 'El tiempo para editar esta vacante ha expirado (4 horas después de su creación)'
        },
        { status: 403 }
      );
    }

    // Validar especialidad
    const validation = await validateSpecialty(body.profile, body.subcategory);
    if (!validation.valid) {
      return NextResponse.json(
        { success: false, error: validation.error },
        { status: 400 }
      );
    }

    // Extraer campos permitidos para actualización
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
      profile,
      subcategory,
      seniority,
      educationLevel,
      habilidades,
      responsabilidades,
      resultadosEsperados,
      valoresActitudes,
      informacionAdicional,
      notasInternas,
      isConfidential
    } = body;

    // Validar rango de salario con los valores FINALES.
    //
    // VALIDACIÓN (#VAC-041): sólo se comprobaba si llegaban LOS DOS extremos, así
    // que mandar únicamente `salaryMin` (o `salaryMax`) abría un rango de más de
    // $10,000 o invertido sobre lo ya guardado. Mismo criterio que PATCH.
    if (salaryMin !== undefined || salaryMax !== undefined) {
      const minNum =
        salaryMin !== undefined ? parseInt(salaryMin) || 0 : existingJob.salaryMin ?? 0;
      const maxNum =
        salaryMax !== undefined ? parseInt(salaryMax) || 0 : existingJob.salaryMax ?? 0;

      if (minNum > 0 && maxNum > 0 && minNum > maxNum) {
        return NextResponse.json(
          { success: false, error: 'El salario mínimo no puede ser mayor al máximo' },
          { status: 400 }
        );
      }

      if (minNum > 0 && maxNum > 0 && maxNum - minNum > 10000) {
        return NextResponse.json(
          { success: false, error: 'La diferencia máxima permitida entre salarios es $10,000 MXN' },
          { status: 400 }
        );
      }
    }

    if (workMode !== undefined && workMode !== null && workMode !== '' && !isValidWorkMode(workMode)) {
      return NextResponse.json(
        { success: false, error: `Modalidad de trabajo inválida. Debe ser una de: ${WORK_MODES.join(', ')}` },
        { status: 400 }
      );
    }

    // VALIDACIÓN (#VAC): el mínimo salarial de la matriz sólo se comprobaba al
    // crear. Se podía crear con un salario válido y bajarlo después por PUT.
    const perfilFinal = profile !== undefined ? profile : existingJob.profile;
    const seniorityFinal = seniority !== undefined ? seniority : existingJob.seniority;
    const workModeFinal = workMode !== undefined ? (workMode || 'presential') : existingJob.workMode;
    const salarioMinFinal =
      salaryMin !== undefined ? parseInt(salaryMin) || 0 : existingJob.salaryMin ?? 0;

    if (perfilFinal && seniorityFinal && workModeFinal && salarioMinFinal > 0) {
      const pricingEntry = await prisma.pricingMatrix.findFirst({
        where: { profile: perfilFinal, seniority: seniorityFinal, workMode: workModeFinal, isActive: true }
      });

      if (pricingEntry?.minSalary && salarioMinFinal < pricingEntry.minSalary) {
        return NextResponse.json(
          {
            success: false,
            error: `El salario mínimo ofrecido ($${salarioMinFinal.toLocaleString()} MXN) es menor al mínimo requerido para esta especialidad ($${pricingEntry.minSalary.toLocaleString()} MXN)`,
            minSalaryRequired: pricingEntry.minSalary
          },
          { status: 400 }
        );
      }
    }

    const habilidadesParsed = parseHabilidades(habilidades);
    if (!habilidadesParsed.ok) {
      return NextResponse.json({ success: false, error: habilidadesParsed.error }, { status: 400 });
    }

    // COORDENADAS (#VAC): el formulario las envía pero el PUT ni las
    // desestructuraba, así que al cambiar la ubicación de Monterrey a
    // Guadalajara el texto se actualizaba y las coordenadas seguían apuntando a
    // la sede anterior (es lo que usa el reclutador para calcular distancias).
    const latParsed = parseCoordinate(body.latitude, 'latitude');
    if (!latParsed.ok) {
      return NextResponse.json({ success: false, error: latParsed.error }, { status: 400 });
    }
    const lonParsed = parseCoordinate(body.longitude, 'longitude');
    if (!lonParsed.ok) {
      return NextResponse.json({ success: false, error: lonParsed.error }, { status: 400 });
    }

    // El nombre de la empresa no lo elige el body (ver POST /api/jobs).
    const companyName = await resolveCompanyName(
      existingJob.userId ?? auth.userId!,
      auth.role === 'admin' ? 'admin' : 'company',
      company
    );

    // companyRating: sólo admin, y dentro de 0-5.
    let companyRatingFinal: number | null | undefined = undefined;
    if (auth.role === 'admin' && companyRating !== undefined) {
      if (companyRating === null || companyRating === '') {
        companyRatingFinal = null;
      } else {
        const rating = Number(companyRating);
        if (!Number.isFinite(rating) || rating < 0 || rating > 5) {
          return NextResponse.json(
            { success: false, error: 'companyRating debe ser un número entre 0 y 5' },
            { status: 400 }
          );
        }
        companyRatingFinal = rating;
      }
    }

    // ========== VALIDACIÓN DE CRÉDITOS AL EDITAR ==========
    // Aplica a toda vacante YA PUBLICADA cuando cambian campos que afectan el
    // precio.
    //
    // COBRO (#VAC): antes sólo miraba `status === 'active'`. Una vacante pausada
    // (o cerrada) seguía dentro de su ventana de edición, así que bastaba con
    // pausarla, subirla de Jr a Director por PUT sin que se cobrara nada, y
    // reanudarla con PATCH paused -> active, que no cobra. El borrador queda
    // fuera: su precio se calcula y se cobra entero al publicarlo.
    let creditChange: { original: number; new: number; difference: number; action: string } | null = null;
    let newCreditCost: number | undefined = undefined;

    if (existingJob.status !== 'draft') {
      const originalCost = existingJob.creditCost || 0;

      // Determinar valores actuales y nuevos para comparación
      const currentProfile = existingJob.profile || '';
      const currentSeniority = existingJob.seniority || '';
      const currentWorkMode = existingJob.workMode || 'presential';

      const newProfile = profile !== undefined ? (profile || '') : currentProfile;
      const newSeniority = seniority !== undefined ? (seniority || '') : currentSeniority;
      const newWorkMode = workMode !== undefined ? (workMode || 'presential') : currentWorkMode;

      // Verificar si cambiaron campos que afectan el precio
      const priceAffectingFieldsChanged =
        newProfile !== currentProfile ||
        newSeniority !== currentSeniority ||
        newWorkMode !== currentWorkMode;

      if (priceAffectingFieldsChanged && newProfile && newSeniority && newWorkMode) {
        // Calcular nuevo costo usando la función centralizada
        const newCostResult = await calculateJobCreditCost(newProfile, newSeniority, newWorkMode);
        const newCost = newCostResult.credits;
        const difference = newCost - originalCost;

        // Obtener usuario/empresa propietario de la vacante
        const company = await prisma.user.findUnique({
          where: { id: existingJob.userId! }
        });

        if (!company) {
          return NextResponse.json(
            { success: false, error: 'Usuario propietario de la vacante no encontrado' },
            { status: 404 }
          );
        }

        // COBRO (#VAC): una combinación que no está en la matriz devuelve
        // found:false con el precio por defecto (5). Al publicar ya se rechaza
        // (POST /api/jobs y PUT /api/jobs/publish); aquí no, así que una vacante
        // de Director (p. ej. 18 créditos) editada a seniority 'Director.' —con
        // punto— bajaba a 5 y DEVOLVÍA 13 créditos por un valor inventado.
        if (company.role !== 'admin' && !newCostResult.found) {
          return NextResponse.json(
            {
              success: false,
              error:
                'No hay un precio configurado para esa combinación de especialidad, seniority y modalidad. Revisa los datos de la vacante.',
              profile: newProfile,
              seniority: newSeniority,
              workMode: newWorkMode
            },
            { status: 400 }
          );
        }

        // CRÉDITOS (#VAC): el ajuste no miraba el rol del propietario. Un admin
        // publica sin pagar (POST /api/jobs no le cobra), así que al subir de
        // nivel su propia vacante recibía un 402 "créditos insuficientes" que le
        // impedía guardar, y al bajarla se le "devolvían" créditos que nunca
        // pagó, con un asiento 'refund' ficticio en el ledger. Para un
        // propietario admin sólo se actualiza el coste de referencia.
        if (company.role === 'admin') {
          await prisma.job.updateMany({
            where: { id: jobId, creditCost: originalCost },
            data: { creditCost: newCost }
          });
          newCreditCost = newCost;
        } else {

        // ATOMICIDAD (#VAC): el ajuste va en UNA transacción, y el cobro reclama
        // el saldo con una condición que resuelve la base de datos. Antes eran
        // `user.update` + `creditTransaction.create` sueltos sobre un saldo leído
        // antes: dos ediciones simultáneas devolvían los créditos dos veces
        // —acuñando créditos de la nada— o cobraban por debajo de cero.
        if (difference > 0) {
          try {
            const cobrado = await prisma.$transaction(async (tx) => {
              // El mismo anclaje que la devolución: el ajuste se aplica sobre el
              // `creditCost` que se leyó o no se aplica. Sin él, dos ediciones
              // simultáneas partían las dos del precio viejo y cobraban la
              // diferencia dos veces por un único cambio.
              const reclamada = await tx.job.updateMany({
                where: { id: jobId, creditCost: originalCost },
                data: { creditCost: newCost }
              });

              if (reclamada.count === 0) {
                return { ok: false as const };
              }

              const claimed = await tx.user.updateMany({
                where: { id: existingJob.userId!, credits: { gte: difference } },
                data: { credits: { decrement: difference } }
              });

              if (claimed.count === 0) {
                const actual = await tx.user.findUnique({
                  where: { id: existingJob.userId! },
                  select: { credits: true }
                });
                // Se LANZA (no se devuelve) para que el rollback deshaga también
                // el reclamo de la vacante: devolverlo lo dejaría confirmado y la
                // vacante subiría de precio sin haber cobrado.
                throw new CreditosInsuficientesError(actual?.credits ?? 0);
              }

              const after = await tx.user.findUnique({
                where: { id: existingJob.userId! },
                select: { credits: true }
              });
              const balanceAfter = after?.credits ?? 0;

              await tx.creditTransaction.create({
                data: {
                  userId: existingJob.userId!,
                  type: 'spend',
                  amount: -difference,
                  balanceBefore: balanceAfter + difference,
                  balanceAfter,
                  description: `Ajuste por edición de vacante: ${existingJob.title} (${currentSeniority} → ${newSeniority})`,
                  jobId: jobId
                }
              });

              return { ok: true as const };
            });

            if (!cobrado.ok) {
              return NextResponse.json(
                {
                  success: false,
                  error: 'La vacante se modificó mientras se aplicaba el cambio. Vuelve a intentarlo.'
                },
                { status: 409 }
              );
            }
          } catch (e) {
            if (e instanceof CreditosInsuficientesError) {
              // La transacción hizo rollback: ni se cobró ni subió el precio.
              return NextResponse.json(
                {
                  success: false,
                  error: `Créditos insuficientes. Necesitas ${difference} créditos adicionales para este cambio.`,
                  required: difference,
                  available: e.available
                },
                { status: 402 }
              );
            }
            console.error('Error cobrando el ajuste de la vacante:', e);
            return NextResponse.json(
              { success: false, error: 'No se pudo aplicar el ajuste de créditos' },
              { status: 500 }
            );
          }

          creditChange = {
            original: originalCost,
            new: newCost,
            difference: difference,
            action: 'charged'
          };
        } else if (difference < 0) {
          // Devolver créditos (diferencia es negativa).
          // El guard `creditCost: originalCost` es el que hace la devolución
          // idempotente: si otra petición ya devolvió y dejó el coste en newCost,
          // esta no encuentra la fila y no vuelve a devolver.
          const refundAmount = Math.abs(difference);

          try {
            const devuelto = await prisma.$transaction(async (tx) => {
              const claimed = await tx.job.updateMany({
                where: { id: jobId, creditCost: originalCost },
                data: { creditCost: newCost }
              });

              if (claimed.count === 0) return false;

              const after = await tx.user.update({
                where: { id: existingJob.userId! },
                data: { credits: { increment: refundAmount } },
                select: { credits: true }
              });

              await tx.creditTransaction.create({
                data: {
                  userId: existingJob.userId!,
                  type: 'refund',
                  amount: refundAmount,
                  balanceBefore: after.credits - refundAmount,
                  balanceAfter: after.credits,
                  description: `Devolución por edición de vacante: ${existingJob.title} (${currentSeniority} → ${newSeniority})`,
                  jobId: jobId
                }
              });

              return true;
            });

            if (!devuelto) {
              return NextResponse.json(
                {
                  success: false,
                  error: 'La vacante se modificó mientras se aplicaba el cambio. Vuelve a intentarlo.'
                },
                { status: 409 }
              );
            }
          } catch (e) {
            console.error('Error devolviendo créditos del ajuste:', e);
            return NextResponse.json(
              { success: false, error: 'No se pudo aplicar el ajuste de créditos' },
              { status: 500 }
            );
          }

          creditChange = {
            original: originalCost,
            new: newCost,
            difference: difference,
            action: 'refunded'
          };
        }

        // Actualizar el creditCost del job
        newCreditCost = newCost;
        }
      }
    }
    // ========== FIN VALIDACIÓN DE CRÉDITOS ==========

    // Actualizar vacante
    const updatedJob = await prisma.job.update({
      where: { id: jobId },
      data: {
        title,
        company: companyName,
        location,
        // Si el body no trae coordenadas se dejan como están: `parseCoordinate`
        // convierte `undefined` en null y un cliente que no las envía borraba
        // las de la vacante. Un `null` explícito sí las limpia.
        ...(body.latitude !== undefined && { latitude: latParsed.value }),
        ...(body.longitude !== undefined && { longitude: lonParsed.value }),
        salary,
        salaryMin: salaryMin !== undefined ? (salaryMin ? parseInt(salaryMin) : null) : undefined,
        salaryMax: salaryMax !== undefined ? (salaryMax ? parseInt(salaryMax) : null) : undefined,
        jobType,
        workMode: workMode || 'presential',
        description,
        requirements: requirements || null,
        // Sólo un admin puede tocar las estrellas; para el resto se deja como está.
        ...(companyRatingFinal !== undefined && { companyRating: companyRatingFinal }),
        profile: profile || null,
        subcategory: subcategory || null,
        seniority: seniority || null,
        educationLevel: educationLevel || null,
        habilidades: habilidadesParsed.value,
        responsabilidades: responsabilidades || null,
        resultadosEsperados: resultadosEsperados || null,
        valoresActitudes: valoresActitudes || null,
        informacionAdicional: informacionAdicional || null,
        notasInternas: notasInternas || null,
        // Vacante confidencial
        ...(isConfidential !== undefined && { isConfidential }),
        // Actualizar creditCost si cambió
        ...(newCreditCost !== undefined && { creditCost: newCreditCost })
      }
    });

    // Construir mensaje de respuesta
    let message = 'Vacante actualizada exitosamente';
    if (creditChange) {
      if (creditChange.action === 'charged') {
        message = `Vacante actualizada. Se han cobrado ${creditChange.difference} créditos adicionales.`;
      } else if (creditChange.action === 'refunded') {
        message = `Vacante actualizada. Se han devuelto ${Math.abs(creditChange.difference)} créditos.`;
      }
    }

    return NextResponse.json({
      success: true,
      message,
      data: updatedJob,
      ...(creditChange && { creditChange })
    });
  } catch (error) {
    console.error('Error updating job:', error);
    return NextResponse.json(
      { success: false, error: 'Error al actualizar vacante' },
      { status: 500 }
    );
  }
}

// DELETE - Eliminar vacante
export async function DELETE(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const jobId = parseInt(id);

    if (isNaN(jobId)) {
      return NextResponse.json(
        { success: false, error: 'Invalid job ID' },
        { status: 400 }
      );
    }

    // Verificar que la vacante existe
    const existingJob = await prisma.job.findUnique({
      where: { id: jobId },
      include: { _count: { select: { applications: true } } }
    });

    if (!existingJob) {
      return NextResponse.json(
        { success: false, error: 'Job not found' },
        { status: 404 }
      );
    }

    // Verificar autenticación y ownership
    const auth = await verifyJobOwnership(existingJob.userId);
    if (!auth.authenticated) {
      return NextResponse.json({ success: false, error: auth.error }, { status: 401 });
    }
    if (!auth.authorized) {
      return NextResponse.json({ success: false, error: auth.error }, { status: 403 });
    }

    // INTEGRIDAD (#VAC): el DELETE sólo comprobaba la propiedad, y Application
    // cuelga de Job con onDelete: Cascade (y de Application cuelgan en cascada
    // las notas de evaluación, las calificaciones de habilidades y las
    // solicitudes de entrevista). Una empresa borrando una vacante activa se
    // llevaba por delante el trabajo de reclutadores y especialistas y el
    // historial de todos los candidatos, sin rastro ni forma de recuperarlo.
    //
    // Para rol company el borrado físico queda sólo para el borrador vacío: lo
    // demás se cierra (PATCH status 'closed'), que es lo que hace el dashboard.
    if (auth.role !== 'admin') {
      if (existingJob.status !== 'draft') {
        return NextResponse.json(
          {
            success: false,
            error:
              'Solo se pueden eliminar borradores. Para retirar una vacante publicada ciérrala (status "closed"); así se conservan las postulaciones y su historial.'
          },
          { status: 409 }
        );
      }

      if (existingJob._count.applications > 0) {
        return NextResponse.json(
          {
            success: false,
            error:
              'Esta vacante tiene postulaciones: eliminarla borraría también las candidaturas y sus evaluaciones. Ciérrala en lugar de eliminarla.',
            applications: existingJob._count.applications
          },
          { status: 409 }
        );
      }
    }

    // Eliminar vacante
    await prisma.job.delete({
      where: { id: jobId }
    });

    return NextResponse.json({
      success: true,
      message: 'Job deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting job:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to delete job' },
      { status: 500 }
    );
  }
}
