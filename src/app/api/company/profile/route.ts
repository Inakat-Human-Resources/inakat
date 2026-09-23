// RUTA: src/app/api/company/profile/route.ts

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { validate, companyProfileUpdateSchema } from '@/lib/validations';

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
            logoUrl: true, // FEAT-1b: Logo de empresa
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
        logoUrl: user.companyRequest.logoUrl, // FEAT-1b: Logo de empresa
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

    // VALIDACIÓN: antes se hacía `.trim()` sobre lo que llegara —un número o un
    // objeto provocaba TypeError y 500—, nombre y dirección podían guardarse
    // vacíos, latitud/longitud aceptaban cualquier valor y `logoUrl` se
    // guardaba sin comprobar el esquema (un host externo rompe next/image en
    // todas las vistas que pintan el logo).
    const validation = validate(companyProfileUpdateSchema, body);
    if (!validation.success) {
      return NextResponse.json(
        { success: false, error: 'Datos inválidos', errors: validation.errors },
        { status: 400 }
      );
    }

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
      longitud,
      logoUrl
    } = validation.data;

    // Construir objeto de actualización solo con campos proporcionados
    const updateData: Record<string, string | number | null> = {};

    if (nombre !== undefined) updateData.nombre = nombre;
    if (apellidoPaterno !== undefined) updateData.apellidoPaterno = apellidoPaterno;
    if (apellidoMaterno !== undefined) updateData.apellidoMaterno = apellidoMaterno;
    if (nombreEmpresa !== undefined) updateData.nombreEmpresa = nombreEmpresa;
    if (correoEmpresa !== undefined) updateData.correoEmpresa = correoEmpresa;
    if (body.sitioWeb !== undefined) updateData.sitioWeb = sitioWeb || null;
    if (razonSocial !== undefined) updateData.razonSocial = razonSocial;
    if (direccionEmpresa !== undefined) updateData.direccionEmpresa = direccionEmpresa;
    if (latitud !== undefined) updateData.latitud = latitud;
    if (longitud !== undefined) updateData.longitud = longitud;

    // FEAT-1b: Permitir actualizar logoUrl
    if (body.logoUrl !== undefined) {
      updateData.logoUrl = logoUrl || null;
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json(
        { success: false, error: 'No hay datos para actualizar' },
        { status: 400 }
      );
    }

    // Datos del representante que también viven en User: antes sólo se
    // actualizaba la solicitud y el nombre de la cuenta (el que se ve en el
    // menú y en los correos) se quedaba con el representante anterior.
    const datosUsuario: { nombre?: string; apellidoPaterno?: string; apellidoMaterno?: string | null } = {};
    if (nombre !== undefined) datosUsuario.nombre = nombre;
    if (apellidoPaterno !== undefined) datosUsuario.apellidoPaterno = apellidoPaterno;
    if (apellidoMaterno !== undefined) datosUsuario.apellidoMaterno = apellidoMaterno || null;

    const companyRequestId = user.companyRequest.id;

    // Actualizar en la base de datos (solicitud y cuenta, juntas o ninguna)
    const updated = await prisma.$transaction(async (tx) => {
      const solicitud = await tx.companyRequest.update({
        where: { id: companyRequestId },
        data: updateData
      });

      if (Object.keys(datosUsuario).length > 0) {
        await tx.user.update({
          where: { id: companyUserId },
          data: datosUsuario
        });
      }

      return solicitud;
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
        longitud: updated.longitud,
        logoUrl: updated.logoUrl // FEAT-1b: Logo de empresa
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
