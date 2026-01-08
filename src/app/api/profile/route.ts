// RUTA: src/app/api/profile/route.ts

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyToken } from '@/lib/auth';
import { cookies } from 'next/headers';
import bcrypt from 'bcryptjs';

// Obtener usuario autenticado
async function getAuthenticatedUser() {
  const cookieStore = await cookies();
  const token = cookieStore.get('auth-token')?.value;

  if (!token) {
    return { error: 'No autenticado', status: 401 };
  }

  const payload = verifyToken(token);
  if (!payload?.userId) {
    return { error: 'Token inválido', status: 401 };
  }

  const user = await prisma.user.findUnique({
    where: { id: payload.userId },
    select: {
      id: true,
      email: true,
      nombre: true,
      role: true,
      password: true,
      credits: true,
      createdAt: true,
      candidate: {
        include: {
          experiences: {
            orderBy: { fechaInicio: 'desc' }
          }
        }
      },
      companyRequest: {
        select: {
          nombreEmpresa: true
        }
      }
    }
  });

  if (!user) {
    return { error: 'Usuario no encontrado', status: 404 };
  }

  return { user };
}

/**
 * GET /api/profile
 * Obtiene el perfil del usuario autenticado
 */
export async function GET() {
  try {
    const auth = await getAuthenticatedUser();
    if ('error' in auth) {
      return NextResponse.json(
        { success: false, error: auth.error },
        { status: auth.status }
      );
    }

    const { user } = auth;

    // Construir respuesta según el rol
    const profileData: any = {
      id: user.id,
      email: user.email,
      nombre: user.nombre,
      role: user.role,
      createdAt: user.createdAt
    };

    // Datos adicionales según rol
    if (user.role === 'company') {
      profileData.company = user.companyRequest?.nombreEmpresa || null;
      profileData.credits = user.credits;
    }

    // Datos de candidato si existe
    if (user.candidate) {
      profileData.candidate = {
        id: user.candidate.id,
        nombre: user.candidate.nombre,
        apellidoPaterno: user.candidate.apellidoPaterno,
        apellidoMaterno: user.candidate.apellidoMaterno,
        telefono: user.candidate.telefono,
        fechaNacimiento: user.candidate.fechaNacimiento,
        sexo: user.candidate.sexo,
        universidad: user.candidate.universidad,
        carrera: user.candidate.carrera,
        nivelEstudios: user.candidate.nivelEstudios,
        añosExperiencia: user.candidate.añosExperiencia,
        profile: user.candidate.profile,
        seniority: user.candidate.seniority,
        linkedinUrl: user.candidate.linkedinUrl,
        portafolioUrl: user.candidate.portafolioUrl,
        cvUrl: user.candidate.cvUrl,
        experiences: user.candidate.experiences || []
      };
    }

    return NextResponse.json({
      success: true,
      data: profileData
    });

  } catch (error) {
    console.error('Error fetching profile:', error);
    return NextResponse.json(
      { success: false, error: 'Error al obtener perfil' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/profile
 * Actualiza el perfil del usuario autenticado
 */
export async function PUT(request: Request) {
  try {
    const auth = await getAuthenticatedUser();
    if ('error' in auth) {
      return NextResponse.json(
        { success: false, error: auth.error },
        { status: auth.status }
      );
    }

    const { user } = auth;
    const body = await request.json();

    // Campos que el usuario puede actualizar
    const { nombre, currentPassword, newPassword, candidateData } = body;

    // Validar si quiere cambiar password
    if (newPassword) {
      if (!currentPassword) {
        return NextResponse.json(
          { success: false, error: 'Debes proporcionar tu contraseña actual' },
          { status: 400 }
        );
      }

      // Verificar password actual
      const isValidPassword = await bcrypt.compare(currentPassword, user.password);
      if (!isValidPassword) {
        return NextResponse.json(
          { success: false, error: 'Contraseña actual incorrecta' },
          { status: 400 }
        );
      }

      // Validar nuevo password
      if (newPassword.length < 8) {
        return NextResponse.json(
          { success: false, error: 'La nueva contraseña debe tener al menos 8 caracteres' },
          { status: 400 }
        );
      }
    }

    // Preparar datos a actualizar en User
    const updateUserData: any = {};
    if (nombre !== undefined) updateUserData.nombre = nombre;
    if (newPassword) {
      updateUserData.password = await bcrypt.hash(newPassword, 10);
    }

    // Actualizar usuario
    const updatedUser = await prisma.user.update({
      where: { id: user.id },
      data: updateUserData,
      select: {
        id: true,
        email: true,
        nombre: true,
        role: true,
        credits: true,
        candidate: true,
        companyRequest: {
          select: { nombreEmpresa: true }
        }
      }
    });

    // Actualizar datos de candidato si existen y se proporcionaron
    if (candidateData && user.candidate) {
      const {
        nombre: candidateNombre,
        apellidoPaterno,
        apellidoMaterno,
        telefono,
        fechaNacimiento,
        sexo,
        universidad,
        carrera,
        nivelEstudios,
        añosExperiencia,
        profile,
        seniority,
        linkedinUrl,
        portafolioUrl,
        cvUrl
      } = candidateData;

      const updateCandidateData: any = {};
      if (candidateNombre !== undefined) updateCandidateData.nombre = candidateNombre;
      if (apellidoPaterno !== undefined) updateCandidateData.apellidoPaterno = apellidoPaterno;
      if (apellidoMaterno !== undefined) updateCandidateData.apellidoMaterno = apellidoMaterno;
      if (telefono !== undefined) updateCandidateData.telefono = telefono;
      if (fechaNacimiento !== undefined) {
        updateCandidateData.fechaNacimiento = fechaNacimiento ? new Date(fechaNacimiento) : null;
      }
      if (sexo !== undefined) updateCandidateData.sexo = sexo;
      if (universidad !== undefined) updateCandidateData.universidad = universidad;
      if (carrera !== undefined) updateCandidateData.carrera = carrera;
      if (nivelEstudios !== undefined) updateCandidateData.nivelEstudios = nivelEstudios;
      if (añosExperiencia !== undefined) updateCandidateData.añosExperiencia = añosExperiencia;
      if (profile !== undefined) updateCandidateData.profile = profile;
      if (seniority !== undefined) updateCandidateData.seniority = seniority;
      if (linkedinUrl !== undefined) updateCandidateData.linkedinUrl = linkedinUrl;
      if (portafolioUrl !== undefined) updateCandidateData.portafolioUrl = portafolioUrl;
      if (cvUrl !== undefined) updateCandidateData.cvUrl = cvUrl;

      if (Object.keys(updateCandidateData).length > 0) {
        await prisma.candidate.update({
          where: { id: user.candidate.id },
          data: updateCandidateData
        });
      }
    }

    // Construir respuesta actualizada
    const profileData: any = {
      id: updatedUser.id,
      email: updatedUser.email,
      nombre: updatedUser.nombre,
      role: updatedUser.role
    };

    if (updatedUser.role === 'company') {
      profileData.company = updatedUser.companyRequest?.nombreEmpresa || null;
      profileData.credits = updatedUser.credits;
    }

    return NextResponse.json({
      success: true,
      message: 'Perfil actualizado exitosamente',
      data: profileData
    });

  } catch (error) {
    console.error('Error updating profile:', error);
    return NextResponse.json(
      { success: false, error: 'Error al actualizar perfil' },
      { status: 500 }
    );
  }
}
