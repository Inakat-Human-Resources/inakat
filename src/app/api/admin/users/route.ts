// RUTA: src/app/api/admin/users/route.ts

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getPaginationParams, buildPaginatedResponse } from '@/lib/pagination';
import bcrypt from 'bcryptjs';

// Roles que el admin puede crear
const ALLOWED_ROLES = ['admin', 'recruiter', 'specialist'];

// GET - Listar usuarios (filtrados por rol)
export async function GET(request: Request) {
  try {
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

    // Búsqueda por nombre o email
    if (search) {
      where.OR = [
        { nombre: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
        { apellidoPaterno: { contains: search, mode: 'insensitive' } }
      ];
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

    // Validar password mínimo
    if (password.length < 6) {
      return NextResponse.json(
        { success: false, error: 'La contraseña debe tener al menos 6 caracteres' },
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

    if (!id) {
      return NextResponse.json(
        { success: false, error: 'ID de usuario requerido' },
        { status: 400 }
      );
    }

    // Verificar que el usuario existe
    const existingUser = await prisma.user.findUnique({
      where: { id: parseInt(id) }
    });

    if (!existingUser) {
      return NextResponse.json(
        { success: false, error: 'Usuario no encontrado' },
        { status: 404 }
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
    if (role && ALLOWED_ROLES.includes(role)) updateData.role = role;
    if (specialty !== undefined) updateData.specialty = specialty || null;
    if (isActive !== undefined) updateData.isActive = isActive;

    // Si se proporciona nueva contraseña, hashearla
    if (password && password.length >= 6) {
      updateData.password = await bcrypt.hash(password, 10);
    }

    // Actualizar usuario
    const user = await prisma.user.update({
      where: { id: parseInt(id) },
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

    return NextResponse.json({
      success: true,
      message: 'Usuario actualizado exitosamente',
      data: user
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
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { success: false, error: 'ID de usuario requerido' },
        { status: 400 }
      );
    }

    // Verificar que el usuario existe
    const existingUser = await prisma.user.findUnique({
      where: { id: parseInt(id) }
    });

    if (!existingUser) {
      return NextResponse.json(
        { success: false, error: 'Usuario no encontrado' },
        { status: 404 }
      );
    }

    // Soft delete: desactivar en lugar de eliminar
    await prisma.user.update({
      where: { id: parseInt(id) },
      data: { isActive: false }
    });

    return NextResponse.json({
      success: true,
      message: 'Usuario desactivado exitosamente'
    });

  } catch (error) {
    console.error('Error deleting user:', error);
    return NextResponse.json(
      { success: false, error: 'Error al desactivar usuario' },
      { status: 500 }
    );
  }
}
