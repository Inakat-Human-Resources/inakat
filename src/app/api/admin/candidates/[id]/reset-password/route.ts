// RUTA: src/app/api/admin/candidates/[id]/reset-password/route.ts

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/auth';
import bcrypt from 'bcryptjs';

/**
 * POST /api/admin/candidates/[id]/reset-password
 * Resetear contraseña o crear cuenta para un candidato existente
 */
export async function POST(
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
    const candidateId = parseInt(id);

    if (isNaN(candidateId)) {
      return NextResponse.json(
        { success: false, error: 'ID de candidato inválido' },
        { status: 400 }
      );
    }

    const body = await request.json();
    const { password } = body;

    if (!password || password.length < 8) {
      return NextResponse.json(
        { success: false, error: 'La contraseña debe tener al menos 8 caracteres' },
        { status: 400 }
      );
    }

    // Buscar candidato
    const candidate = await prisma.candidate.findUnique({
      where: { id: candidateId },
      select: {
        id: true,
        email: true,
        nombre: true,
        apellidoPaterno: true,
        apellidoMaterno: true,
        userId: true
      }
    });

    if (!candidate) {
      return NextResponse.json(
        { success: false, error: 'Candidato no encontrado' },
        { status: 404 }
      );
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    if (candidate.userId) {
      // Candidato YA tiene cuenta: actualizar contraseña del User vinculado
      await prisma.user.update({
        where: { id: candidate.userId },
        data: { password: hashedPassword }
      });

      return NextResponse.json({
        success: true,
        message: 'Contraseña actualizada exitosamente',
        userId: candidate.userId
      });
    } else {
      // Candidato NO tiene cuenta: crear User y vincular

      // Verificar que no exista un User con el mismo email
      const existingUser = await prisma.user.findUnique({
        where: { email: candidate.email.toLowerCase() }
      });

      if (existingUser) {
        return NextResponse.json(
          { success: false, error: 'Ya existe un usuario con ese email. No se puede crear cuenta duplicada.' },
          { status: 409 }
        );
      }

      // Crear User con role='candidate'
      const newUser = await prisma.user.create({
        data: {
          email: candidate.email.toLowerCase(),
          password: hashedPassword,
          nombre: candidate.nombre,
          apellidoPaterno: candidate.apellidoPaterno || null,
          apellidoMaterno: candidate.apellidoMaterno || null,
          role: 'candidate',
          isActive: true
        }
      });

      // Vincular candidato con el nuevo User
      await prisma.candidate.update({
        where: { id: candidateId },
        data: { userId: newUser.id }
      });

      return NextResponse.json({
        success: true,
        message: 'Cuenta de acceso creada exitosamente',
        userId: newUser.id
      });
    }
  } catch (error) {
    console.error('Error resetting candidate password:', error);
    return NextResponse.json(
      { success: false, error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
