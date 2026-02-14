// RUTA: src/app/api/profile/route.ts

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyToken } from '@/lib/auth';
import { cookies } from 'next/headers';
import bcrypt from 'bcryptjs';

// Normalizar URLs: agregar https:// si falta
const normalizeUrl = (url: string | undefined) => url && !url.startsWith('http') ? `https://${url}` : url;

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
        select: {
          id: true,
          nombre: true,
          apellidoPaterno: true,
          apellidoMaterno: true,
          telefono: true,
          fechaNacimiento: true,
          sexo: true,
          ciudad: true,
          estado: true,
          ubicacionCercana: true,
          universidad: true,
          carrera: true,
          nivelEstudios: true,
          educacion: true,
          añosExperiencia: true,
          profile: true,
          seniority: true,
          linkedinUrl: true,
          portafolioUrl: true,
          cvUrl: true,
          fotoUrl: true, // FEAT-2: Foto de perfil
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
      // Parsear educación JSON si existe
      let educacionArray = [];
      if (user.candidate.educacion) {
        try {
          educacionArray = JSON.parse(user.candidate.educacion);
        } catch {
          educacionArray = [];
        }
      }

      // Si no hay entradas de educación pero sí hay datos legacy, crear entrada inicial
      if (educacionArray.length === 0 && (user.candidate.universidad || user.candidate.carrera)) {
        educacionArray = [{
          id: 1,
          nivel: user.candidate.nivelEstudios || 'Licenciatura',
          institucion: user.candidate.universidad || '',
          carrera: user.candidate.carrera || '',
          añoInicio: null,
          añoFin: null,
          estatus: 'Completa'
        }];
      }

      profileData.candidate = {
        id: user.candidate.id,
        nombre: user.candidate.nombre,
        apellidoPaterno: user.candidate.apellidoPaterno,
        apellidoMaterno: user.candidate.apellidoMaterno,
        telefono: user.candidate.telefono,
        fechaNacimiento: user.candidate.fechaNacimiento,
        sexo: user.candidate.sexo,
        ciudad: user.candidate.ciudad,
        estado: user.candidate.estado,
        ubicacionCercana: user.candidate.ubicacionCercana,
        universidad: user.candidate.universidad,
        carrera: user.candidate.carrera,
        nivelEstudios: user.candidate.nivelEstudios,
        añosExperiencia: user.candidate.añosExperiencia,
        profile: user.candidate.profile,
        seniority: user.candidate.seniority,
        linkedinUrl: user.candidate.linkedinUrl,
        portafolioUrl: user.candidate.portafolioUrl,
        cvUrl: user.candidate.cvUrl,
        fotoUrl: user.candidate.fotoUrl, // FEAT-2: Foto de perfil
        experiences: user.candidate.experiences || [],
        educacion: educacionArray
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
        ciudad,
        estado,
        ubicacionCercana,
        universidad,
        carrera,
        nivelEstudios,
        añosExperiencia,
        profile,
        seniority,
        linkedinUrl,
        portafolioUrl,
        cvUrl,
        educacion,
        fotoUrl // FEAT-2: Foto de perfil
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
      if (ciudad !== undefined) updateCandidateData.ciudad = ciudad;
      if (estado !== undefined) updateCandidateData.estado = estado;
      if (ubicacionCercana !== undefined) updateCandidateData.ubicacionCercana = ubicacionCercana;
      if (universidad !== undefined) updateCandidateData.universidad = universidad;
      if (carrera !== undefined) updateCandidateData.carrera = carrera;
      if (nivelEstudios !== undefined) updateCandidateData.nivelEstudios = nivelEstudios;
      if (añosExperiencia !== undefined) updateCandidateData.añosExperiencia = añosExperiencia;
      if (profile !== undefined) updateCandidateData.profile = profile;
      if (seniority !== undefined) updateCandidateData.seniority = seniority;
      if (linkedinUrl !== undefined) updateCandidateData.linkedinUrl = normalizeUrl(linkedinUrl);
      if (portafolioUrl !== undefined) updateCandidateData.portafolioUrl = normalizeUrl(portafolioUrl);
      if (cvUrl !== undefined) updateCandidateData.cvUrl = normalizeUrl(cvUrl);

      // FEAT-2: Actualizar foto de perfil
      if (fotoUrl !== undefined) updateCandidateData.fotoUrl = fotoUrl;

      // Guardar educación como JSON string
      if (educacion !== undefined) {
        updateCandidateData.educacion = JSON.stringify(educacion);
        // Actualizar campos legacy con la primera entrada (para compatibilidad)
        if (Array.isArray(educacion) && educacion.length > 0) {
          const primeraEducacion = educacion[0];
          updateCandidateData.universidad = primeraEducacion.institucion || null;
          updateCandidateData.carrera = primeraEducacion.carrera || null;
          updateCandidateData.nivelEstudios = primeraEducacion.nivel || null;
        }
      }

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
