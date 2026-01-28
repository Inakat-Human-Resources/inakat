// RUTA: src/lib/auth.ts
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { prisma } from './prisma';

// =============================================
// CONFIGURACIÓN
// =============================================

const JWT_SECRET =
  process.env.JWT_SECRET || 'fallback-secret-CHANGE-IN-PRODUCTION';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';

if (!process.env.JWT_SECRET) {
  console.warn('[Auth] WARNING: JWT_SECRET not set. Using fallback secret.');
}

// =============================================
// TYPES
// =============================================

export interface JWTPayload {
  userId: number;
  email: string;
  role: string;
}

export interface AuthUser {
  id: number;
  email: string;
  nombre: string;
  apellidoPaterno?: string | null;
  apellidoMaterno?: string | null;
  role: string;
}

export interface AuthSuccess {
  success: true;
  user: AuthUser;
  token: string;
}

export interface AuthError {
  success: false;
  error: string;
}

export type AuthResult = AuthSuccess | AuthError;

// =============================================
// PASSWORD FUNCTIONS
// =============================================

/**
 * Hashea una contraseña usando bcrypt
 * @param password - Contraseña en texto plano
 * @returns Contraseña hasheada
 */
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

/**
 * Verifica una contraseña contra su hash
 * @param password - Contraseña en texto plano
 * @param hashedPassword - Contraseña hasheada
 * @returns true si coinciden, false si no
 */
export async function verifyPassword(
  password: string,
  hashedPassword: string
): Promise<boolean> {
  return bcrypt.compare(password, hashedPassword);
}

// =============================================
// JWT FUNCTIONS
// =============================================

/**
 * Genera un token JWT
 * @param payload - Datos a incluir en el token
 * @returns Token JWT
 */
export function generateToken(payload: JWTPayload): string {
  return jwt.sign(payload, JWT_SECRET, {
    expiresIn: JWT_EXPIRES_IN
  } as jwt.SignOptions);
}

/**
 * Verifica y decodifica un token JWT
 * @param token - Token JWT
 * @returns Payload decodificado o null si es inválido
 */
export function verifyToken(token: string): JWTPayload | null {
  try {
    return jwt.verify(token, JWT_SECRET) as JWTPayload;
  } catch {
    return null;
  }
}

// =============================================
// AUTHENTICATION
// =============================================

/**
 * Autentica un usuario con email y contraseña
 * @param email - Email del usuario
 * @param password - Contraseña en texto plano
 * @returns Resultado de autenticación con usuario y token o error
 */
export async function authenticateUser(
  email: string,
  password: string
): Promise<AuthResult> {
  try {
    // Buscar usuario por email
    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
      select: {
        id: true,
        email: true,
        password: true,
        nombre: true,
        apellidoPaterno: true,
        apellidoMaterno: true,
        role: true,
        isActive: true
      }
    });

    // Usuario no encontrado
    if (!user) {
      return {
        success: false,
        error: 'Credenciales inválidas'
      };
    }

    // Usuario desactivado
    if (!user.isActive) {
      return {
        success: false,
        error: 'Usuario desactivado. Contacta al administrador.'
      };
    }

    // Verificar contraseña
    const isValidPassword = await verifyPassword(password, user.password);

    if (!isValidPassword) {
      return {
        success: false,
        error: 'Credenciales inválidas'
      };
    }

    // Actualizar último login
    await prisma.user.update({
      where: { id: user.id },
      data: { lastLogin: new Date() }
    });

    // Generar token
    const token = generateToken({
      userId: user.id,
      email: user.email,
      role: user.role
    });

    // Retornar usuario y token (sin la contraseña)
    return {
      success: true,
      user: {
        id: user.id,
        email: user.email,
        nombre: user.nombre,
        apellidoPaterno: user.apellidoPaterno,
        apellidoMaterno: user.apellidoMaterno,
        role: user.role
      },
      token
    };
  } catch {
    return {
      success: false,
      error: 'Error al autenticar. Intenta de nuevo.'
    };
  }
}

/**
 * Obtiene un usuario por su ID
 * @param userId - ID del usuario
 * @returns Usuario o null si no existe
 */
export async function getUserById(userId: number): Promise<AuthUser | null> {
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        nombre: true,
        apellidoPaterno: true,
        apellidoMaterno: true,
        role: true,
        isActive: true
      }
    });

    if (!user || !user.isActive) {
      return null;
    }

    return user;
  } catch {
    return null;
  }
}

/**
 * Verifica si un usuario es admin
 * @param userId - ID del usuario
 * @returns true si es admin, false si no
 */
export async function isAdmin(userId: number): Promise<boolean> {
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { role: true, isActive: true }
    });

    return user?.role === 'admin' && user.isActive;
  } catch {
    return false;
  }
}
