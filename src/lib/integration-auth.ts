// RUTA: src/lib/integration-auth.ts
// Autenticación para las rutas /api/integration/* (puente con Worky2).
//
// NOTA IMPORTANTE: el matcher de src/middleware.ts NO cubre /api/integration,
// a propósito: /api/integration/candidates se autentica con X-Api-Key (sistema
// externo, sin cookie), así que cada ruta de integración se autentica aquí.

import crypto from 'crypto';
import { verifyToken } from './auth';
import { prisma } from './prisma';

// =============================================
// TYPES
// =============================================

export interface IntegrationAuthError {
  error: string;
  status: number;
}

export interface CompanyAuthSuccess {
  user: {
    id: number;
    email: string;
    nombre: string;
    role: string;
  };
}

export interface ApiKeyAuthSuccess {
  apiKey: {
    id: number;
    userId: number;
    name: string;
  };
}

// =============================================
// API KEY HELPERS
// =============================================

/** Genera una API key en claro con el formato del contrato: "inak_" + 32 hex. */
export function generateApiKey(): string {
  return `inak_${crypto.randomBytes(16).toString('hex')}`;
}

/** SHA-256 hex de la key en claro. Es lo ÚNICO que se persiste en la DB. */
export function hashApiKey(plainKey: string): string {
  return crypto.createHash('sha256').update(plainKey).digest('hex');
}

/** Máscara para listados: nunca podemos reconstruir la key (solo hay hash). */
export function maskApiKey(): string {
  return 'inak_********************************';
}

// =============================================
// AUTH: EMPRESA (JWT propio de INAKAT)
// =============================================

/**
 * Autentica al usuario "company" dueño de la integración.
 * Acepta el JWT tanto en la cookie `auth-token` (patrón web de INAKAT) como en
 * `Authorization: Bearer <token>` (clientes API). Devuelve el user activo o
 * un error { error, status }.
 */
export async function requireCompanyUser(
  request: Request
): Promise<CompanyAuthSuccess | IntegrationAuthError> {
  const token = extractToken(request);

  if (!token) {
    return { error: 'No autenticado. Por favor inicia sesión.', status: 401 };
  }

  const payload = verifyToken(token);
  if (!payload?.userId) {
    return { error: 'Token inválido o expirado.', status: 401 };
  }

  const user = await prisma.user.findUnique({
    where: { id: payload.userId },
    select: { id: true, email: true, nombre: true, role: true, isActive: true }
  });

  if (!user || !user.isActive) {
    return { error: 'Usuario no encontrado o desactivado', status: 403 };
  }

  if (user.role !== 'company') {
    return {
      error: 'Acceso denegado. Solo empresas pueden gestionar integraciones.',
      status: 403
    };
  }

  return {
    user: {
      id: user.id,
      email: user.email,
      nombre: user.nombre,
      role: user.role
    }
  };
}

function extractToken(request: Request): string | null {
  // 1) Authorization: Bearer <jwt>
  const authHeader = request.headers.get('authorization');
  if (authHeader?.toLowerCase().startsWith('bearer ')) {
    return authHeader.slice(7).trim() || null;
  }

  // 2) Cookie auth-token (mismo nombre que usa src/middleware.ts)
  const cookieHeader = request.headers.get('cookie');
  if (!cookieHeader) return null;

  for (const part of cookieHeader.split(';')) {
    const [name, ...rest] = part.trim().split('=');
    if (name === 'auth-token') {
      const value = rest.join('=');
      return value ? decodeURIComponent(value) : null;
    }
  }

  return null;
}

// =============================================
// AUTH: SISTEMA EXTERNO (X-Api-Key de Worky2)
// =============================================

/**
 * Autentica un request externo por header X-Api-Key: hashea la key recibida,
 * la busca en IntegrationApiKey (activa) y actualiza lastUsedAt.
 */
export async function requireApiKey(
  request: Request
): Promise<ApiKeyAuthSuccess | IntegrationAuthError> {
  const plainKey = request.headers.get('x-api-key');

  if (!plainKey) {
    return { error: 'Falta el header X-Api-Key', status: 401 };
  }

  // Validación de formato barata antes de tocar la DB
  if (!/^inak_[0-9a-f]{32}$/.test(plainKey)) {
    return { error: 'API key inválida', status: 401 };
  }

  const keyHash = hashApiKey(plainKey);

  const apiKey = await prisma.integrationApiKey.findUnique({
    where: { keyHash },
    select: { id: true, userId: true, name: true, isActive: true }
  });

  if (!apiKey || !apiKey.isActive) {
    return { error: 'API key inválida', status: 401 };
  }

  // Marcar uso (no bloquea la respuesta si falla)
  prisma.integrationApiKey
    .update({ where: { id: apiKey.id }, data: { lastUsedAt: new Date() } })
    .catch(() => {});

  return {
    apiKey: { id: apiKey.id, userId: apiKey.userId, name: apiKey.name }
  };
}
