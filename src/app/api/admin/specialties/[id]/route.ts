// RUTA: src/app/api/admin/specialties/[id]/route.ts

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/auth';

// Función para generar slug
function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * GET /api/admin/specialties/[id]
 * Obtener una especialidad por ID
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Defensa en profundidad como el resto del módulo: el middleware no sabe si
    // el admin sigue activo ni cuál es su rol actual en BD.
    const auth = await requireRole('admin');
    if ('error' in auth) {
      return NextResponse.json(
        { success: false, error: auth.error },
        { status: auth.status }
      );
    }

    const { id } = await params;
    const specialtyId = parseInt(id);

    if (isNaN(specialtyId)) {
      return NextResponse.json(
        { success: false, error: 'ID de especialidad inválido' },
        { status: 400 }
      );
    }

    const specialty = await prisma.specialty.findUnique({
      where: { id: specialtyId }
    });

    if (!specialty) {
      return NextResponse.json(
        { success: false, error: 'Especialidad no encontrada' },
        { status: 404 }
      );
    }

    // Obtener precios asociados
    const pricing = await prisma.pricingMatrix.findMany({
      where: { profile: specialty.name },
      orderBy: [{ seniority: 'asc' }, { workMode: 'asc' }]
    });

    return NextResponse.json({
      success: true,
      data: {
        ...specialty,
        pricing
      }
    });
  } catch (error) {
    console.error('Error fetching specialty:', error);
    return NextResponse.json(
      { success: false, error: 'Error al obtener especialidad' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/admin/specialties/[id]
 * Actualizar una especialidad
 */
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireRole('admin');
    if ('error' in auth) {
      return NextResponse.json(
        { success: false, error: auth.error },
        { status: auth.status }
      );
    }

    const { id } = await params;
    const specialtyId = parseInt(id);

    if (isNaN(specialtyId)) {
      return NextResponse.json(
        { success: false, error: 'ID de especialidad inválido' },
        { status: 400 }
      );
    }

    const existing = await prisma.specialty.findUnique({
      where: { id: specialtyId }
    });

    if (!existing) {
      return NextResponse.json(
        { success: false, error: 'Especialidad no encontrada' },
        { status: 404 }
      );
    }

    const body = await request.json();
    const {
      name,
      description,
      icon,
      color,
      subcategories,
      sortOrder,
      isActive
    } = body;

    // ---- Validar ANTES de tocar nada ----
    if (name !== undefined && (typeof name !== 'string' || name.trim() === '')) {
      // ' ' (sólo espacios) pasaba el required del input, era truthy, generaba
      // slug '' y movía todos los precios al profile vacío.
      return NextResponse.json(
        { success: false, error: 'El nombre no puede quedar vacío' },
        { status: 400 }
      );
    }

    // Mismas reglas de tipo que el POST: un elemento no textual o un color
    // arbitrario llegaban a Prisma (500) o a la UI tal cual.
    if (
      subcategories !== undefined &&
      (!Array.isArray(subcategories) || subcategories.some((s: unknown) => typeof s !== 'string'))
    ) {
      return NextResponse.json(
        { success: false, error: 'subcategories debe ser un array de textos' },
        { status: 400 }
      );
    }

    if (color !== undefined && color !== null && color !== '' && !/^#[0-9a-f]{6}$/i.test(String(color))) {
      return NextResponse.json(
        { success: false, error: 'color debe ser un hexadecimal tipo #2b5d62' },
        { status: 400 }
      );
    }

    if (sortOrder !== undefined && sortOrder !== null && !Number.isInteger(sortOrder)) {
      return NextResponse.json(
        { success: false, error: 'sortOrder debe ser un entero' },
        { status: 400 }
      );
    }

    if (isActive !== undefined && typeof isActive !== 'boolean') {
      return NextResponse.json(
        { success: false, error: 'isActive debe ser booleano' },
        { status: 400 }
      );
    }

    // Si cambia el nombre, verificar que sea único y actualizar precios
    let newSlug = existing.slug;
    const oldName = existing.name;
    const nuevoNombre = name?.trim();
    const cambiaNombre = Boolean(nuevoNombre && nuevoNombre !== existing.name);

    if (cambiaNombre && nuevoNombre) {
      const duplicate = await prisma.specialty.findFirst({
        where: {
          name: nuevoNombre,
          id: { not: specialtyId }
        }
      });

      if (duplicate) {
        return NextResponse.json(
          { success: false, error: 'Ya existe una especialidad con ese nombre' },
          { status: 409 }
        );
      }

      newSlug = generateSlug(nuevoNombre);

      if (!newSlug) {
        return NextResponse.json(
          { success: false, error: 'El nombre debe contener letras o números' },
          { status: 400 }
        );
      }

      // El slug se normaliza sin acentos ni símbolos, así que "Tecnología" y
      // "Tecnologia" colisionan. Se comprueba ANTES: si no, la matriz de precios
      // ya se había renombrado cuando el update reventaba con P2002 y la
      // especialidad se quedaba sin precios (vacantes al DEFAULT de 5 créditos).
      const duplicadoSlug = await prisma.specialty.findFirst({
        where: { slug: newSlug, id: { not: specialtyId } }
      });

      if (duplicadoSlug) {
        return NextResponse.json(
          {
            success: false,
            error: `Ya existe una especialidad equivalente ("${duplicadoSlug.name}"): el identificador generado sería el mismo`
          },
          { status: 409 }
        );
      }
    }

    // Renombrado y propagación en UNA transacción. La especialidad se referencia
    // por NOMBRE en Job.profile, Candidate.profile y User.specialty: propagar
    // sólo a PricingMatrix dejaba las vacantes sin poder editarse, el precio
    // caído al DEFAULT y la guarda del DELETE contando 0.
    const resultado = await prisma.$transaction(async (tx) => {
      let propagados = { jobs: 0, candidates: 0, users: 0, pricing: 0 };

      if (cambiaNombre && nuevoNombre) {
        const pricing = await tx.pricingMatrix.updateMany({
          where: { profile: oldName },
          data: { profile: nuevoNombre }
        });
        const jobs = await tx.job.updateMany({
          where: { profile: oldName },
          data: { profile: nuevoNombre }
        });
        const candidates = await tx.candidate.updateMany({
          where: { profile: oldName },
          data: { profile: nuevoNombre }
        });
        const users = await tx.user.updateMany({
          where: { specialty: oldName },
          data: { specialty: nuevoNombre }
        });

        propagados = {
          pricing: pricing.count,
          jobs: jobs.count,
          candidates: candidates.count,
          users: users.count
        };
      }

      const actualizada = await tx.specialty.update({
        where: { id: specialtyId },
        data: {
          name: nuevoNombre || existing.name,
          slug: newSlug,
          description: description !== undefined ? description?.trim() || null : existing.description,
          icon: icon !== undefined ? icon || null : existing.icon,
          color: color || existing.color,
          subcategories: subcategories !== undefined ? subcategories : existing.subcategories,
          sortOrder: sortOrder !== undefined ? sortOrder : existing.sortOrder,
          isActive: isActive !== undefined ? isActive : existing.isActive
        }
      });

      return { actualizada, propagados };
    });

    return NextResponse.json({
      success: true,
      message: 'Especialidad actualizada exitosamente',
      data: resultado.actualizada,
      propagated: resultado.propagados
    });
  } catch (error) {
    console.error('Error updating specialty:', error);
    if ((error as { code?: string })?.code === 'P2002') {
      return NextResponse.json(
        { success: false, error: 'Ya existe una especialidad equivalente (nombre o slug)' },
        { status: 409 }
      );
    }
    return NextResponse.json(
      { success: false, error: 'Error al actualizar especialidad' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/admin/specialties/[id]
 * Eliminar una especialidad y sus precios asociados
 */
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireRole('admin');
    if ('error' in auth) {
      return NextResponse.json(
        { success: false, error: auth.error },
        { status: auth.status }
      );
    }

    const { id } = await params;
    const specialtyId = parseInt(id);

    if (isNaN(specialtyId)) {
      return NextResponse.json(
        { success: false, error: 'ID de especialidad inválido' },
        { status: 400 }
      );
    }

    const specialty = await prisma.specialty.findUnique({
      where: { id: specialtyId }
    });

    if (!specialty) {
      return NextResponse.json(
        { success: false, error: 'Especialidad no encontrada' },
        { status: 404 }
      );
    }

    // Verificar quién usa esta especialidad. Antes sólo se contaban vacantes:
    // los candidatos con ese profile y los especialistas con esa specialty
    // quedaban apuntando a un nombre inexistente (desplegables vacíos, filtros
    // que dejaban de encontrarlos).
    const [jobsWithProfile, candidatesWithProfile, usersWithSpecialty] = await Promise.all([
      prisma.job.count({ where: { profile: specialty.name } }),
      prisma.candidate.count({ where: { profile: specialty.name } }),
      prisma.user.count({ where: { specialty: specialty.name } })
    ]);

    const enUso = jobsWithProfile + candidatesWithProfile + usersWithSpecialty;

    if (enUso > 0) {
      const detalle = [
        jobsWithProfile > 0 ? `${jobsWithProfile} vacante(s)` : null,
        candidatesWithProfile > 0 ? `${candidatesWithProfile} candidato(s)` : null,
        usersWithSpecialty > 0 ? `${usersWithSpecialty} especialista(s)` : null
      ]
        .filter(Boolean)
        .join(', ');

      return NextResponse.json(
        {
          success: false,
          error: `No se puede eliminar: hay ${detalle} usando esta especialidad. Puedes desactivarla en lugar de borrarla.`,
          inUse: {
            jobs: jobsWithProfile,
            candidates: candidatesWithProfile,
            specialists: usersWithSpecialty
          }
        },
        { status: 409 }
      );
    }

    // Precios y especialidad en UNA transacción: sueltos, si el segundo borrado
    // fallaba la especialidad sobrevivía sin precios.
    const deletedPricing = await prisma.$transaction(async (tx) => {
      const borrados = await tx.pricingMatrix.deleteMany({
        where: { profile: specialty.name }
      });

      await tx.specialty.delete({
        where: { id: specialtyId }
      });

      return borrados;
    });

    return NextResponse.json({
      success: true,
      message: `Especialidad "${specialty.name}" eliminada junto con ${deletedPricing.count} precios asociados`
    });
  } catch (error) {
    console.error('Error deleting specialty:', error);
    return NextResponse.json(
      { success: false, error: 'Error al eliminar especialidad' },
      { status: 500 }
    );
  }
}
