// RUTA: src/app/api/company/profile/route.ts

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

/**
 * GET /api/company/profile
 * Obtiene el perfil de la empresa del usuario logueado
 * Usado para pre-llenar el nombre de empresa en el formulario de crear vacante
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

    if (userRole !== 'company') {
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
            nombreEmpresa: true,
            correoEmpresa: true,
            sitioWeb: true,
            rfc: true,
            direccionEmpresa: true,
            status: true
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
        // Datos de la empresa
        nombreEmpresa: user.companyRequest.nombreEmpresa,
        correoEmpresa: user.companyRequest.correoEmpresa,
        sitioWeb: user.companyRequest.sitioWeb,
        rfc: user.companyRequest.rfc,
        direccionEmpresa: user.companyRequest.direccionEmpresa,
        status: user.companyRequest.status
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
