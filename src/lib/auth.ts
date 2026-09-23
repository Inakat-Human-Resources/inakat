// RUTA: src/lib/auth.ts
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { createHash } from 'crypto';
import { prisma } from './prisma';

// =============================================
// CONFIGURACIÓN
// =============================================

// Validación estricta al cargar el módulo
if (!process.env.JWT_SECRET) {
  throw new Error(
    '[Auth] FATAL: JWT_SECRET no está configurado. Configura la variable de entorno antes de iniciar la aplicación.'
  );
}

if (process.env.JWT_SECRET.length < 32) {
  throw new Error(
    '[Auth] FATAL: JWT_SECRET debe tener al menos 32 caracteres por seguridad.'
  );
}

const JWT_SECRET: string = process.env.JWT_SECRET;
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';

/** Duración por defecto de la sesión (7 días) en segundos. */
const DEFAULT_MAX_AGE_SECONDS = 60 * 60 * 24 * 7;

/**
 * Convierte el valor de JWT_EXPIRES_IN ('7d', '24h', '30m', '3600') a segundos.
 *
 * CONFIG (AUTH-022): la vida del token salía de la variable de entorno pero el
 * `maxAge` de la cookie que lo transporta estaba escrito a mano (7 días) en
 * login y en register. Al tocar JWT_EXPIRES_IN los dos relojes se
 * desincronizaban: con '1d' el navegador seguía mandando durante 6 días un
 * token muerto; con '30d' la sesión moría a los 7 y la configuración no servía
 * de nada. Ahora ambos salen del mismo sitio.
 */
export function getAuthCookieMaxAge(): number {
  const raw = String(JWT_EXPIRES_IN).trim();
  const match = /^(\d+(?:\.\d+)?)\s*(s|m|h|d)?$/i.exec(raw);

  if (!match) return DEFAULT_MAX_AGE_SECONDS;

  const value = parseFloat(match[1]);
  if (!Number.isFinite(value) || value <= 0) return DEFAULT_MAX_AGE_SECONDS;

  const unit = (match[2] || 's').toLowerCase();
  const multipliers: Record<string, number> = {
    s: 1,
    m: 60,
    h: 60 * 60,
    d: 60 * 60 * 24
  };

  return Math.floor(value * multipliers[unit]);
}

/**
 * Opciones de la cookie de sesión. Una sola fuente para login y register.
 */
export function getAuthCookieOptions() {
  return {
    httpOnly: true, // No accesible desde JavaScript (seguridad contra XSS)
    secure: process.env.NODE_ENV === 'production', // Solo HTTPS en producción
    sameSite: 'lax' as const, // Protección CSRF
    maxAge: getAuthCookieMaxAge(),
    path: '/' // Disponible en todas las rutas
  };
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
// TOKEN DE RESET DE CONTRASEÑA
// =============================================

/**
 * SHA-256 del token de recuperación de contraseña.
 *
 * SEGURIDAD (AUTH-021): en `User.resetToken` se guarda ESTE valor, no el token
 * que viaja por correo. Guardarlo en claro convertía cualquier lectura de la
 * tabla (backup, réplica, acceso de soporte, un `findMany` sin `select`) en un
 * pase para tomar cuentas ajenas durante la hora de validez.
 *
 * Una función de un solo paso basta: el token son 32 bytes aleatorios, no una
 * contraseña adivinable, así que no hace falta bcrypt/argon.
 */
export function hashResetToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

// =============================================
// AUTHENTICATION
// =============================================

// Hash bcrypt válido (cost=10) de un password aleatorio para comparar contra él
// cuando el usuario no existe. Mantiene un tiempo de respuesta constante para
// evitar que un atacante enumere emails registrados midiendo latencias.
const DUMMY_HASH = '$2b$10$24SukS9M6uGGx6ejw6/v3eBEAE5OL6Whbwfj6ma.9/b6ekdNXJnGq';

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

    // Usuario no encontrado: hacer bcrypt dummy para mantener timing constante
    if (!user) {
      await bcrypt.compare(password, DUMMY_HASH);
      return {
        success: false,
        error: 'Credenciales inválidas'
      };
    }

    // Verificar contraseña ANTES de revelar el estado de la cuenta.
    // Devolver "Usuario desactivado" sin validar la contraseña permitiría a un
    // atacante enumerar qué emails están registrados (#24). Por eso primero se
    // comprueba la contraseña y, si es incorrecta, se responde de forma genérica.
    const isValidPassword = await verifyPassword(password, user.password);

    if (!isValidPassword) {
      return {
        success: false,
        error: 'Credenciales inválidas'
      };
    }

    // Solo cuando la contraseña es correcta revelamos que la cuenta está
    // desactivada (no hay enumeración: quien acierta la contraseña ya es dueño
    // legítimo de la cuenta).
    if (!user.isActive) {
      return {
        success: false,
        error: 'Usuario desactivado. Contacta al administrador.'
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
  } catch (error) {
    console.error('[Auth] Error en authenticateUser:', error instanceof Error ? error.message : 'Unknown');
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

// =============================================
// CENTRALIZED ROLE VERIFICATION (API Routes)
// =============================================

export interface VerifyResult {
  user: {
    id: number;
    email: string;
    nombre: string;
    apellidoPaterno: string | null;
    apellidoMaterno: string | null;
    role: string;
    isActive: boolean;
    credits: number;
    specialty: string | null;
  };
}

export interface VerifyError {
  error: string;
  status: number;
}

/**
 * Verifica que el usuario está autenticado (cualquier rol).
 * Lee la cookie auth-token, verifica JWT, y retorna el user de la DB.
 */
export async function requireAuth(): Promise<VerifyResult | VerifyError> {
  const { cookies } = await import('next/headers');
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
      apellidoPaterno: true,
      apellidoMaterno: true,
      role: true,
      isActive: true,
      credits: true,
      specialty: true,
    }
  });

  if (!user || !user.isActive) {
    return { error: 'Usuario no encontrado o desactivado', status: 403 };
  }

  return { user };
}

/**
 * Verifica que el usuario tiene uno de los roles permitidos.
 */
export async function requireRole(
  roles: string | string[]
): Promise<VerifyResult | VerifyError> {
  const auth = await requireAuth();

  if ('error' in auth) {
    return auth;
  }

  const allowedRoles = Array.isArray(roles) ? roles : [roles];

  if (!allowedRoles.includes(auth.user.role)) {
    return { error: 'Acceso denegado - Permisos insuficientes', status: 403 };
  }

  return auth;
}

// =============================================
// APROBACIÓN DE EMPRESA
// =============================================

export interface CompanyApprovalError {
  error: string;
  code: 'COMPANY_NOT_APPROVED' | 'COMPANY_NOT_FOUND';
  status: number;
}

/**
 * Comprueba que la empresa que hay detrás de `userId` está APROBADA por un
 * admin antes de dejarla operar.
 *
 * El alta de empresa es un endpoint público que crea en el acto un User con
 * role 'company' e isActive true; el panel de admin aprueba o rechaza, pero
 * ninguna ruta consultaba `companyRequest.status`, así que el flujo de
 * aprobación no tenía ningún efecto: una empresa inventada (o ya rechazada)
 * seguía publicando vacantes y recibiendo datos de candidatos.
 *
 * Devuelve `null` cuando puede operar y un error tipado cuando no. El admin
 * queda exento (opera en nombre de INAKAT, no de una empresa concreta).
 *
 * INTERRUPTOR: sólo se exige si `ENFORCE_COMPANY_APPROVAL=true`. Encenderlo es
 * decisión de negocio, no técnica: hoy hay empresas operando (publicando y
 * pagando) cuya solicitud nunca se aprobó formalmente, y activarlo sin revisar
 * antes esa lista las dejaría sin servicio de un día para otro. Antes de
 * encenderlo, aprobar en /admin/requests a las empresas legítimas.
 *
 * @param userId - id del User de la sesión
 * @param role - rol de la sesión ('admin' queda exento)
 */
export async function requireApprovedCompany(
  userId: number,
  role?: string | null
): Promise<CompanyApprovalError | null> {
  if (process.env.ENFORCE_COMPANY_APPROVAL !== 'true') return null;
  if (role === 'admin') return null;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      isActive: true,
      role: true,
      companyRequest: { select: { status: true } }
    }
  });

  if (!user || !user.isActive) {
    return {
      error: 'Usuario no encontrado o desactivado',
      code: 'COMPANY_NOT_FOUND',
      status: 403
    };
  }

  if (user.role === 'admin') return null;

  if (!user.companyRequest) {
    return {
      error: 'No tienes una empresa registrada. Contacta a soporte.',
      code: 'COMPANY_NOT_FOUND',
      status: 403
    };
  }

  if (user.companyRequest.status !== 'approved') {
    return {
      error:
        user.companyRequest.status === 'rejected'
          ? 'Tu solicitud de empresa fue rechazada. Contacta a soporte.'
          : 'Tu empresa está en revisión. Podrás usar esta función cuando INAKAT apruebe tu cuenta.',
      code: 'COMPANY_NOT_APPROVED',
      status: 403
    };
  }

  return null;
}

/**
 * Autenticación OPCIONAL: devuelve el usuario activo de la DB si la cookie
 * auth-token es válida, o `null` si no hay sesión / token inválido / usuario
 * inactivo. No lanza ni devuelve error: pensado para endpoints públicos que
 * exponen datos adicionales sólo al propietario autenticado (p. ej. notas
 * internas o vacantes confidenciales). NUNCA confíes en query params para
 * decidir si alguien es "propietario": usa este helper.
 */
export async function getOptionalAuthUser(): Promise<VerifyResult['user'] | null> {
  const { cookies } = await import('next/headers');
  const cookieStore = await cookies();
  const token = cookieStore.get('auth-token')?.value;

  if (!token) return null;

  const payload = verifyToken(token);
  if (!payload?.userId) return null;

  const user = await prisma.user.findUnique({
    where: { id: payload.userId },
    select: {
      id: true,
      email: true,
      nombre: true,
      apellidoPaterno: true,
      apellidoMaterno: true,
      role: true,
      isActive: true,
      credits: true,
      specialty: true,
    },
  });

  if (!user || !user.isActive) return null;

  return user;
}
