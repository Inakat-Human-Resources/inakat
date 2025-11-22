// RUTA: src/app/api/auth/register/route.ts

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { hashPassword, generateToken } from '@/lib/auth';
import { z } from 'zod';

/**
 * POST /api/auth/register
 * Registra un nuevo usuario candidato
 */

// Schema de validación
const registerSchema = z.object({
  email: z.string().email('Email inválido'),
  password: z
    .string()
    .min(8, 'La contraseña debe tener al menos 8 caracteres')
    .regex(/[A-Z]/, 'Debe contener al menos una mayúscula')
    .regex(/[0-9]/, 'Debe contener al menos un número'),
  nombre: z.string().min(2, 'El nombre es requerido'),
  apellidoPaterno: z.string().min(2, 'El apellido paterno es requerido'),
  apellidoMaterno: z.string().optional()
});

export async function POST(request: Request) {
  try {
    const body = await request.json();

    // Validar datos de entrada
    const validation = registerSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        {
          success: false,
          errors: validation.error.flatten().fieldErrors
        },
        { status: 400 }
      );
    }

    const { email, password, nombre, apellidoPaterno, apellidoMaterno } =
      validation.data;

    // Verificar si el email ya existe
    const existingUser = await prisma.user.findUnique({
      where: { email: email.toLowerCase() }
    });

    if (existingUser) {
      return NextResponse.json(
        {
          success: false,
          error: 'Este email ya está registrado'
        },
        { status: 409 }
      );
    }

    // Hashear contraseña
    const hashedPassword = await hashPassword(password);

    // Crear usuario
    const user = await prisma.user.create({
      data: {
        email: email.toLowerCase(),
        password: hashedPassword,
        nombre,
        apellidoPaterno,
        apellidoMaterno: apellidoMaterno || null,
        role: 'user', // Usuario regular (candidato)
        isActive: true,
        emailVerified: new Date() // Por ahora verificamos automáticamente
      }
    });

    // Generar token JWT
    const token = generateToken({
      userId: user.id,
      email: user.email,
      role: user.role
    });

    // Crear respuesta
    const response = NextResponse.json(
      {
        success: true,
        message: 'Registro exitoso',
        user: {
          id: user.id,
          email: user.email,
          nombre: user.nombre,
          apellidoPaterno: user.apellidoPaterno,
          apellidoMaterno: user.apellidoMaterno,
          role: user.role
        }
      },
      { status: 201 }
    );

    // Establecer cookie con el token
    response.cookies.set('auth-token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7, // 7 días
      path: '/'
    });

    return response;
  } catch (error) {
    console.error('Error in /api/auth/register:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Error al procesar el registro'
      },
      { status: 500 }
    );
  }
}
