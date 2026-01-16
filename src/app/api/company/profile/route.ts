// RUTA: src/app/api/company/profile/route.ts

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

/**
 * GET /api/company/profile
 * Obtiene el perfil completo de la empresa del usuario logueado
 */
export async function GET(request: Request) {
  try {
    // Obtener userId de los headers (agregado por middleware)
    const userId = request.headers.get('x-user-id');
    const userRole = request.headers.get('x-user-role');

    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'No autenticado' },
        { status: 401 }
      );
    }

    if (userRole !== 'company' && userRole !== 'admin') {
      return NextResponse.json(
        { success: false, error: 'Acceso denegado. Solo empresas.' },
        { status: 403 }
      );
    }

    const companyUserId = parseInt(userId);

    // Obtener información del usuario con su CompanyRequest aprobada
    const user = await prisma.user.findUnique({
      where: { id: companyUserId },
      select: {
        id: true,
        email: true,
        nombre: true,
        credits: true,
        companyRequest: {
          select: {
            id: true,
            // Datos del representante
            nombre: true,
            apellidoPaterno: true,
            apellidoMaterno: true,
            // Datos de la empresa
            nombreEmpresa: true,
            correoEmpresa: true,
            sitioWeb: true,
            razonSocial: true,
            rfc: true,
            direccionEmpresa: true,
            latitud: true,
            longitud: true,
            status: true,
            createdAt: true,
            approvedAt: true
          }
        }
      }
    });

    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Usuario no encontrado' },
        { status: 404 }
      );
    }

    if (!user.companyRequest) {
      return NextResponse.json(
        { success: false, error: 'No tienes una empresa registrada' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        userId: user.id,
        userEmail: user.email,
        userName: user.nombre,
        credits: user.credits,
        // Datos del representante
        representante: {
          nombre: user.companyRequest.nombre,
          apellidoPaterno: user.companyRequest.apellidoPaterno,
          apellidoMaterno: user.companyRequest.apellidoMaterno
        },
        // Datos de la empresa
        nombreEmpresa: user.companyRequest.nombreEmpresa,
        correoEmpresa: user.companyRequest.correoEmpresa,
        sitioWeb: user.companyRequest.sitioWeb,
        razonSocial: user.companyRequest.razonSocial,
        rfc: user.companyRequest.rfc,
        direccionEmpresa: user.companyRequest.direccionEmpresa,
        latitud: user.companyRequest.latitud,
        longitud: user.companyRequest.longitud,
        status: user.companyRequest.status,
        createdAt: user.companyRequest.createdAt,
        approvedAt: user.companyRequest.approvedAt
      }
    });
  } catch (error) {
    console.error('Error fetching company profile:', error);
    return NextResponse.json(
      { success: false, error: 'Error al obtener perfil de empresa' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/company/profile
 * Actualiza los datos del perfil de empresa
 * Nota: El RFC NO es editable porque es identificador único
 */
export async function PUT(request: Request) {
  try {
    // Obtener userId de los headers (agregado por middleware)
    const userId = request.headers.get('x-user-id');
    const userRole = request.headers.get('x-user-role');

    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'No autenticado' },
        { status: 401 }
      );
    }

    if (userRole !== 'company' && userRole !== 'admin') {
      return NextResponse.json(
        { success: false, error: 'Acceso denegado. Solo empresas.' },
        { status: 403 }
      );
    }

    const companyUserId = parseInt(userId);

    // Verificar que el usuario tiene una empresa asociada
    const user = await prisma.user.findUnique({
      where: { id: companyUserId },
      include: { companyRequest: true }
    });

    if (!user || !user.companyRequest) {
      return NextResponse.json(
        { success: false, error: 'No tienes una empresa registrada' },
        { status: 404 }
      );
    }

    const body = await request.json();
    const {
      // Datos del representante
      nombre,
      apellidoPaterno,
      apellidoMaterno,
      // Datos de la empresa (RFC NO es editable)
      nombreEmpresa,
      correoEmpresa,
      sitioWeb,
      razonSocial,
      direccionEmpresa,
      latitud,
      longitud
    } = body;

    // Validaciones básicas
    if (nombreEmpresa !== undefined && !nombreEmpresa.trim()) {
      return NextResponse.json(
        { success: false, error: 'El nombre de empresa no puede estar vacío' },
        { status: 400 }
      );
    }

    if (razonSocial !== undefined && !razonSocial.trim()) {
      return NextResponse.json(
        { success: false, error: 'La razón social no puede estar vacía' },
        { status: 400 }
      );
    }

    if (correoEmpresa !== undefined) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(correoEmpresa)) {
        return NextResponse.json(
          { success: false, error: 'El correo de empresa no es válido' },
          { status: 400 }
        );
      }
    }

    // Construir objeto de actualización solo con campos proporcionados
    const updateData: Record<string, string | number | null> = {};

    if (nombre !== undefined) updateData.nombre = nombre.trim();
    if (apellidoPaterno !== undefined) updateData.apellidoPaterno = apellidoPaterno.trim();
    if (apellidoMaterno !== undefined) updateData.apellidoMaterno = apellidoMaterno.trim();
    if (nombreEmpresa !== undefined) updateData.nombreEmpresa = nombreEmpresa.trim();
    if (correoEmpresa !== undefined) updateData.correoEmpresa = correoEmpresa.trim();
    if (sitioWeb !== undefined) updateData.sitioWeb = sitioWeb?.trim() || null;
    if (razonSocial !== undefined) updateData.razonSocial = razonSocial.trim();
    if (direccionEmpresa !== undefined) updateData.direccionEmpresa = direccionEmpresa.trim();
    if (latitud !== undefined) updateData.latitud = latitud;
    if (longitud !== undefined) updateData.longitud = longitud;

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json(
        { success: false, error: 'No hay datos para actualizar' },
        { status: 400 }
      );
    }

    // Actualizar en la base de datos
    const updated = await prisma.companyRequest.update({
      where: { id: user.companyRequest.id },
      data: updateData
    });

    return NextResponse.json({
      success: true,
      message: 'Perfil de empresa actualizado exitosamente',
      data: {
        representante: {
          nombre: updated.nombre,
          apellidoPaterno: updated.apellidoPaterno,
          apellidoMaterno: updated.apellidoMaterno
        },
        nombreEmpresa: updated.nombreEmpresa,
        correoEmpresa: updated.correoEmpresa,
        sitioWeb: updated.sitioWeb,
        razonSocial: updated.razonSocial,
        rfc: updated.rfc,
        direccionEmpresa: updated.direccionEmpresa,
        latitud: updated.latitud,
        longitud: updated.longitud
      }
    });
  } catch (error) {
    console.error('Error updating company profile:', error);
    return NextResponse.json(
      { success: false, error: 'Error al actualizar perfil de empresa' },
      { status: 500 }
    );
  }
}
