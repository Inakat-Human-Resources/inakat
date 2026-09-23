// RUTA: src/app/api/admin/users/route.ts

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getPaginationParams, buildPaginatedResponse } from '@/lib/pagination';
import { requireRole } from '@/lib/auth';
import bcrypt from 'bcryptjs';
// Longitud mínima compartida con el resto de altas: aquí se exigían 6 y la
// cuenta de staff creada con 6-7 caracteres no cumplía la política del resto
// de la plataforma.
import { PASSWORD_MIN_LENGTH } from '@/lib/validations';

// Roles que el admin puede crear
const ALLOWED_ROLES = ['admin', 'recruiter', 'specialist'];

/**
 * Convierte un id de body/query en entero positivo.
 * Sin esto `parseInt('abc')` da NaN, Prisma lanza y el admin recibe un 500
 * genérico en lugar de un 400 accionable.
 */
function parseId(value: unknown): number | null {
  if (typeof value !== 'string' && typeof value !== 'number') return null;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) return null;
  return parsed;
}

/**
 * Cuenta las vacantes NO cerradas que siguen asignadas a este usuario.
 * Se devuelve al desactivar o degradar para que el panel pueda avisar de que
 * esas vacantes quedan sin dueño (no bloquea la acción: la decisión es del admin).
 */
async function contarAsignacionesVivas(userId: number): Promise<number> {
  return prisma.jobAssignment.count({
    where: {
      OR: [{ recruiterId: userId }, { specialistId: userId }],
      job: { status: { not: 'closed' } }
    }
  });
}

/**
 * ¿La especialidad existe en el catálogo y está activa?
 * Antes se aceptaba cualquier texto: un especialista con una especialidad que
 * no existe nunca coincide con el perfil de ninguna vacante.
 */
async function especialidadDelCatalogo(nombre: unknown): Promise<boolean> {
  if (typeof nombre !== 'string' || !nombre.trim()) return false;
  const especialidad = await prisma.specialty.findFirst({
    where: { name: nombre.trim(), isActive: true },
    select: { id: true }
  });
  return Boolean(especialidad);
}

// GET - Listar usuarios (filtrados por rol)
/**
 * PLAT-003: requireApiKey ya rechaza las keys de un dueño inactivo, pero
 * quedaban marcadas como activas y revivían si se reactivaba la cuenta sin que
 * la empresa lo pidiera. Devuelve las operaciones para meterlas en la misma
 * transacción que desactiva al usuario.
 */
function desactivarIntegraciones(userId: number) {
  return [
    prisma.integrationApiKey.updateMany({ where: { userId }, data: { isActive: false } }),
    prisma.integrationWebhook.updateMany({ where: { userId }, data: { isActive: false } })
  ] as const;
}

export async function GET(request: Request) {
  try {
    // Defense-in-depth: verificar rol además del middleware
    const auth = await requireRole('admin');
    if ('error' in auth) {
      return NextResponse.json(
        { success: false, error: auth.error },
        { status: auth.status }
      );
    }

    const { searchParams } = new URL(request.url);
    const role = searchParams.get('role');
    const search = searchParams.get('search');
    const isActive = searchParams.get('isActive');

    const where: any = {};

    // Filtrar por rol si se especifica
    if (role) {
      where.role = role;
    } else {
      // Por defecto, solo mostrar roles internos (no empresas ni usuarios normales)
      where.role = { in: ALLOWED_ROLES };
    }

    // Filtrar por estado
    if (isActive !== null && isActive !== undefined && isActive !== '') {
      where.isActive = isActive === 'true';
    }

    // Búsqueda por nombre o email.
    // Se parte en palabras y se exige que CADA una aparezca en alguna columna:
    // buscar "Juan Pérez" contra columnas sueltas no encontraba nada, porque el
    // nombre completo no está contenido en ninguna columna individual.
    if (search) {
      const tokens = search.trim().split(/\s+/).filter(Boolean);
      if (tokens.length > 0) {
        where.AND = tokens.map((token) => ({
          OR: [
            { nombre: { contains: token, mode: 'insensitive' } },
            { email: { contains: token, mode: 'insensitive' } },
            { apellidoPaterno: { contains: token, mode: 'insensitive' } },
            { apellidoMaterno: { contains: token, mode: 'insensitive' } }
          ]
        }));
      }
    }

    const pagination = getPaginationParams(searchParams, 30);

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        select: {
          id: true,
          email: true,
          nombre: true,
          apellidoPaterno: true,
          apellidoMaterno: true,
          role: true,
          specialty: true,
          isActive: true,
          lastLogin: true,
          createdAt: true,
          // Contar asignaciones para reclutadores/especialistas
          _count: {
            select: {
              recruiterAssignments: true,
              specialistAssignments: true
            }
          }
        },
        orderBy: [
          { role: 'asc' },
          { createdAt: 'desc' }
        ],
        skip: pagination.skip,
        take: pagination.take
      }),
      prisma.user.count({ where })
    ]);

    const response = buildPaginatedResponse(users, total, pagination);
    return NextResponse.json({
      success: true,
      ...response,
      count: users.length  // backward compatibility
    });

  } catch (error) {
    console.error('Error fetching users:', error);
    return NextResponse.json(
      { success: false, error: 'Error al obtener usuarios' },
      { status: 500 }
    );
  }
}

// POST - Crear nuevo usuario
export async function POST(request: Request) {
  try {
    // Defense-in-depth: verificar rol además del middleware
    const auth = await requireRole('admin');
    if ('error' in auth) {
      return NextResponse.json(
        { success: false, error: auth.error },
        { status: auth.status }
      );
    }

    const body = await request.json();
    const {
      email,
      password,
      nombre,
      apellidoPaterno,
      apellidoMaterno,
      role,
      specialty
    } = body;

    // Validaciones
    if (!email || !password || !nombre || !role) {
      return NextResponse.json(
        { success: false, error: 'Campos requeridos: email, password, nombre, role' },
        { status: 400 }
      );
    }

    // Validar rol
    if (!ALLOWED_ROLES.includes(role)) {
      return NextResponse.json(
        { success: false, error: `Rol inválido. Roles permitidos: ${ALLOWED_ROLES.join(', ')}` },
        { status: 400 }
      );
    }

    // Validar email único
    const existingUser = await prisma.user.findUnique({
      where: { email: email.toLowerCase() }
    });

    if (existingUser) {
      return NextResponse.json(
        { success: false, error: 'Ya existe un usuario con este email' },
        { status: 409 }
      );
    }

    // Validar password mínimo (mismo mínimo que el login; ver PASSWORD_MIN_LENGTH)
    if (typeof password !== 'string' || password.length < PASSWORD_MIN_LENGTH) {
      return NextResponse.json(
        { success: false, error: `La contraseña debe tener al menos ${PASSWORD_MIN_LENGTH} caracteres` },
        { status: 400 }
      );
    }

    // Si es specialist, debe tener especialidad
    if (role === 'specialist' && !specialty) {
      return NextResponse.json(
        { success: false, error: 'Los especialistas deben tener una especialidad asignada' },
        { status: 400 }
      );
    }

    if (role === 'specialist' && !(await especialidadDelCatalogo(specialty))) {
      return NextResponse.json(
        { success: false, error: 'La especialidad no existe o está desactivada en el catálogo' },
        { status: 400 }
      );
    }

    // Hash de la contraseña
    const hashedPassword = await bcrypt.hash(password, 10);

    // Crear usuario
    const user = await prisma.user.create({
      data: {
        email: email.toLowerCase(),
        password: hashedPassword,
        nombre,
        apellidoPaterno: apellidoPaterno || null,
        apellidoMaterno: apellidoMaterno || null,
        role,
        specialty: role === 'specialist' ? specialty : null,
        isActive: true
      },
      select: {
        id: true,
        email: true,
        nombre: true,
        apellidoPaterno: true,
        apellidoMaterno: true,
        role: true,
        specialty: true,
        isActive: true,
        createdAt: true
      }
    });

    return NextResponse.json({
      success: true,
      message: 'Usuario creado exitosamente',
      data: user
    }, { status: 201 });

  } catch (error) {
    console.error('Error creating user:', error);
    return NextResponse.json(
      { success: false, error: 'Error al crear usuario' },
      { status: 500 }
    );
  }
}

// PUT - Actualizar usuario
export async function PUT(request: Request) {
  try {
    // Defense-in-depth: verificar rol además del middleware
    const auth = await requireRole('admin');
    if ('error' in auth) {
      return NextResponse.json(
        { success: false, error: auth.error },
        { status: auth.status }
      );
    }

    const body = await request.json();
    const {
      id,
      email,
      password,
      nombre,
      apellidoPaterno,
      apellidoMaterno,
      role,
      specialty,
      isActive
    } = body;

    const userId = parseId(id);
    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'ID de usuario inválido' },
        { status: 400 }
      );
    }

    // Validar tipos ANTES de tocar la base: antes un password corto o un rol
    // inválido se descartaban en silencio y la respuesta decía "actualizado
    // exitosamente" aunque no se hubiera aplicado nada.
    if (password !== undefined && password !== null && password !== '') {
      if (typeof password !== 'string' || password.length < PASSWORD_MIN_LENGTH) {
        return NextResponse.json(
          { success: false, error: `La contraseña debe tener al menos ${PASSWORD_MIN_LENGTH} caracteres` },
          { status: 400 }
        );
      }
    }

    if (role !== undefined && !ALLOWED_ROLES.includes(role)) {
      return NextResponse.json(
        { success: false, error: `Rol inválido. Roles permitidos: ${ALLOWED_ROLES.join(', ')}` },
        { status: 400 }
      );
    }

    if (isActive !== undefined && typeof isActive !== 'boolean') {
      return NextResponse.json(
        { success: false, error: 'isActive debe ser booleano' },
        { status: 400 }
      );
    }

    if (email !== undefined && typeof email !== 'string') {
      return NextResponse.json(
        { success: false, error: 'Email inválido' },
        { status: 400 }
      );
    }

    // Verificar que el usuario existe
    const existingUser = await prisma.user.findUnique({
      where: { id: userId }
    });

    if (!existingUser) {
      return NextResponse.json(
        { success: false, error: 'Usuario no encontrado' },
        { status: 404 }
      );
    }

    // Rol resultante tras el cambio (para las reglas de specialty y de lockout)
    const rolFinal: string = role || existingUser.role;
    const seDesactiva = isActive === false && existingUser.isActive;
    const pierdeAdmin = existingUser.role === 'admin' && rolFinal !== 'admin';

    // No permitir que el admin se desactive ni se degrade a sí mismo: requireAuth
    // exige usuario activo, así que perdería el panel en la siguiente petición.
    if (userId === auth.user.id && (seDesactiva || pierdeAdmin)) {
      return NextResponse.json(
        { success: false, error: 'No puedes desactivar ni cambiar el rol de tu propia cuenta' },
        { status: 400 }
      );
    }

    // No dejar la plataforma sin ningún admin activo (lockout total del panel).
    if ((seDesactiva || pierdeAdmin) && existingUser.role === 'admin') {
      const otrosAdmins = await prisma.user.count({
        where: { role: 'admin', isActive: true, id: { not: userId } }
      });
      if (otrosAdmins === 0) {
        return NextResponse.json(
          { success: false, error: 'No se puede desactivar ni degradar al último administrador activo' },
          { status: 400 }
        );
      }
    }

    // Un especialista necesita especialidad; si deja de serlo, se limpia (misma
    // regla que POST, que antes sólo se aplicaba al crear).
    const specialtyFinal =
      specialty !== undefined ? specialty || null : existingUser.specialty;
    if (rolFinal === 'specialist' && !specialtyFinal) {
      return NextResponse.json(
        { success: false, error: 'Los especialistas deben tener una especialidad asignada' },
        { status: 400 }
      );
    }

    // Sólo se contrasta con el catálogo cuando la especialidad CAMBIA: editar el
    // nombre de un especialista cuya especialidad se desactivó después no debe
    // bloquearse por eso.
    if (
      rolFinal === 'specialist' &&
      specialtyFinal !== existingUser.specialty &&
      !(await especialidadDelCatalogo(specialtyFinal))
    ) {
      return NextResponse.json(
        { success: false, error: 'La especialidad no existe o está desactivada en el catálogo' },
        { status: 400 }
      );
    }

    // Si se cambia el email, verificar que no exista
    if (email && email.toLowerCase() !== existingUser.email) {
      const emailExists = await prisma.user.findUnique({
        where: { email: email.toLowerCase() }
      });

      if (emailExists) {
        return NextResponse.json(
          { success: false, error: 'Ya existe un usuario con este email' },
          { status: 409 }
        );
      }
    }

    // Preparar datos a actualizar
    const updateData: any = {};

    if (email) updateData.email = email.toLowerCase();
    if (nombre) updateData.nombre = nombre;
    if (apellidoPaterno !== undefined) updateData.apellidoPaterno = apellidoPaterno || null;
    if (apellidoMaterno !== undefined) updateData.apellidoMaterno = apellidoMaterno || null;
    if (role) updateData.role = role;
    if (isActive !== undefined) updateData.isActive = isActive;
    // La especialidad sólo tiene sentido en un especialista: al cambiar de rol
    // se limpia en lugar de arrastrar el valor anterior que reenvía el formulario.
    updateData.specialty = rolFinal === 'specialist' ? specialtyFinal : null;

    // Si se proporciona nueva contraseña, hashearla e invalidar cualquier enlace
    // de recuperación pendiente (si no, un "olvidé mi contraseña" emitido antes
    // seguiría sirviendo para volver a tomar la cuenta).
    if (password) {
      updateData.password = await bcrypt.hash(password, 10);
      updateData.resetToken = null;
      updateData.resetTokenExpiry = null;
    }

    // Aviso (no bloqueante) de vacantes vivas que quedarían sin dueño.
    const asignacionesVivas =
      seDesactiva || pierdeAdmin || (role && role !== existingUser.role)
        ? await contarAsignacionesVivas(userId)
        : 0;

    // Actualizar usuario
    const actualizarUsuario = prisma.user.update({
      where: { id: userId },
      data: updateData,
      select: {
        id: true,
        email: true,
        nombre: true,
        apellidoPaterno: true,
        apellidoMaterno: true,
        role: true,
        specialty: true,
        isActive: true,
        createdAt: true,
        updatedAt: true
      }
    });

    // PLAT-003: al desactivar, las API keys y webhooks de integración se apagan
    // en la misma transacción; si no, revivirían al reactivar la cuenta.
    const [user] = seDesactiva
      ? await prisma.$transaction([actualizarUsuario, ...desactivarIntegraciones(userId)])
      : [await actualizarUsuario];

    return NextResponse.json({
      success: true,
      message: 'Usuario actualizado exitosamente',
      data: user,
      activeAssignments: asignacionesVivas
    });

  } catch (error) {
    console.error('Error updating user:', error);
    return NextResponse.json(
      { success: false, error: 'Error al actualizar usuario' },
      { status: 500 }
    );
  }
}

// DELETE - Desactivar usuario (soft delete)
export async function DELETE(request: Request) {
  try {
    // Defense-in-depth: verificar rol además del middleware
    const auth = await requireRole('admin');
    if ('error' in auth) {
      return NextResponse.json(
        { success: false, error: auth.error },
        { status: auth.status }
      );
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    const userId = parseId(id);
    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'ID de usuario inválido' },
        { status: 400 }
      );
    }

    // Verificar que el usuario existe
    const existingUser = await prisma.user.findUnique({
      where: { id: userId }
    });

    if (!existingUser) {
      return NextResponse.json(
        { success: false, error: 'Usuario no encontrado' },
        { status: 404 }
      );
    }

    // No permitir auto-desactivarse: requireAuth exige usuario activo y el admin
    // perdería el panel en la siguiente petición.
    if (userId === auth.user.id) {
      return NextResponse.json(
        { success: false, error: 'No puedes desactivar tu propia cuenta' },
        { status: 400 }
      );
    }

    // Ni quedarse sin ningún admin activo.
    if (existingUser.role === 'admin') {
      const otrosAdmins = await prisma.user.count({
        where: { role: 'admin', isActive: true, id: { not: userId } }
      });
      if (otrosAdmins === 0) {
        return NextResponse.json(
          { success: false, error: 'No se puede desactivar al último administrador activo' },
          { status: 400 }
        );
      }
    }

    // Vacantes no cerradas que quedan asignadas a alguien que ya no puede entrar.
    const asignacionesVivas = await contarAsignacionesVivas(userId);

    // Soft delete: desactivar en lugar de eliminar. Las API keys y webhooks de
    // integración se apagan en la misma transacción (PLAT-003).
    await prisma.$transaction([
      prisma.user.update({
        where: { id: userId },
        data: { isActive: false }
      }),
      ...desactivarIntegraciones(userId)
    ]);

    return NextResponse.json({
      success: true,
      message: 'Usuario desactivado exitosamente',
      activeAssignments: asignacionesVivas
    });

  } catch (error) {
    console.error('Error deleting user:', error);
    return NextResponse.json(
      { success: false, error: 'Error al desactivar usuario' },
      { status: 500 }
    );
  }
}
