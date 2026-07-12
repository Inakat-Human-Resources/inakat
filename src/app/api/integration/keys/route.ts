// RUTA: src/app/api/integration/keys/route.ts
// Gestión de API keys del puente con Worky2 (auth: JWT de usuario 'company').
// La key en claro se muestra UNA sola vez al crearla; en DB solo vive su SHA-256.

import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import {
  generateApiKey,
  hashApiKey,
  maskApiKey,
  requireCompanyUser
} from '@/lib/integration-auth';

const createKeySchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, 'El nombre debe tener al menos 2 caracteres')
    .max(80, 'El nombre no puede exceder 80 caracteres')
});

const deleteKeySchema = z.object({
  id: z.coerce.number().int().positive('id inválido')
});

/**
 * POST /api/integration/keys
 * Crea una API key nueva. Devuelve la key en claro SOLO en esta respuesta.
 * Body: { name: string }
 */
export async function POST(request: Request) {
  try {
    const auth = await requireCompanyUser(request);
    if ('error' in auth) {
      return NextResponse.json(
        { success: false, error: auth.error },
        { status: auth.status }
      );
    }

    const body = await request.json().catch(() => null);
    const parsed = createKeySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: parsed.error.issues[0]?.message || 'Datos inválidos' },
        { status: 400 }
      );
    }

    const plainKey = generateApiKey();

    const apiKey = await prisma.integrationApiKey.create({
      data: {
        userId: auth.user.id,
        name: parsed.data.name,
        keyHash: hashApiKey(plainKey)
      },
      select: { id: true, name: true, isActive: true, createdAt: true }
    });

    return NextResponse.json(
      {
        success: true,
        message:
          'API key creada. Guárdala ahora: no volverá a mostrarse en claro.',
        data: {
          ...apiKey,
          // Única vez que viaja la key en claro
          key: plainKey
        }
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('[Integration] Error creando API key:', error);
    return NextResponse.json(
      { success: false, error: 'Error al crear la API key' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/integration/keys
 * Lista las keys de la empresa, enmascaradas (nunca se puede recuperar la key:
 * solo se guarda su SHA-256).
 */
export async function GET(request: Request) {
  try {
    const auth = await requireCompanyUser(request);
    if ('error' in auth) {
      return NextResponse.json(
        { success: false, error: auth.error },
        { status: auth.status }
      );
    }

    const keys = await prisma.integrationApiKey.findMany({
      where: { userId: auth.user.id },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        name: true,
        isActive: true,
        lastUsedAt: true,
        createdAt: true
      }
    });

    return NextResponse.json({
      success: true,
      data: keys.map((key) => ({ ...key, maskedKey: maskApiKey() }))
    });
  } catch (error) {
    console.error('[Integration] Error listando API keys:', error);
    return NextResponse.json(
      { success: false, error: 'Error al listar las API keys' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/integration/keys?id=123  (o body { id: 123 })
 * Revoca una key (isActive=false). Se conserva el registro como auditoría.
 */
export async function DELETE(request: Request) {
  try {
    const auth = await requireCompanyUser(request);
    if ('error' in auth) {
      return NextResponse.json(
        { success: false, error: auth.error },
        { status: auth.status }
      );
    }

    const url = new URL(request.url);
    const rawId = url.searchParams.get('id') ?? (await request.json().catch(() => null))?.id;
    const parsed = deleteKeySchema.safeParse({ id: rawId });
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: 'Debes indicar el id de la key a revocar' },
        { status: 400 }
      );
    }

    const key = await prisma.integrationApiKey.findUnique({
      where: { id: parsed.data.id },
      select: { id: true, userId: true, isActive: true }
    });

    // Ownership: solo la empresa dueña puede revocar su key
    if (!key || key.userId !== auth.user.id) {
      return NextResponse.json(
        { success: false, error: 'API key no encontrada' },
        { status: 404 }
      );
    }

    if (!key.isActive) {
      return NextResponse.json(
        { success: false, error: 'La API key ya estaba revocada' },
        { status: 409 }
      );
    }

    await prisma.integrationApiKey.update({
      where: { id: key.id },
      data: { isActive: false }
    });

    return NextResponse.json({
      success: true,
      message: 'API key revocada'
    });
  } catch (error) {
    console.error('[Integration] Error revocando API key:', error);
    return NextResponse.json(
      { success: false, error: 'Error al revocar la API key' },
      { status: 500 }
    );
  }
}
