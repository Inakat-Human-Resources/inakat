// RUTA: src/app/api/integration/webhooks/route.ts
// Registro de webhooks salientes hacia Worky2 (auth: JWT de usuario 'company').
// Worky2 provee la URL receptora y el secreto compartido; INAKAT firma cada
// entrega con HMAC-SHA256 (ver src/lib/worky2-webhook.ts).

import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { requireCompanyUser } from '@/lib/integration-auth';
import {
  motivoUrlWebhookInvalida,
  motivoUrlWebhookInvalidaConDns
} from '@/lib/worky2-webhook';
import { applyRateLimit, type RateLimitConfig } from '@/lib/rate-limit';

/** Alta/baja de integraciones: 20 por hora por IP. No es un endpoint de uso continuo. */
const INTEGRATION_MANAGE_RATE_LIMIT: RateLimitConfig = {
  maxRequests: 20,
  windowSeconds: 60 * 60
};

/**
 * Tope de webhooks activos por empresa.
 *
 * Cada aceptación de candidato dispara un POST por webhook activo EN PARALELO:
 * sin tope, una cuenta podía registrar miles de URLs de una víctima y convertir
 * a INAKAT en el amplificador que le manda el tráfico.
 */
const MAX_WEBHOOKS_ACTIVOS = 5;

const createWebhookSchema = z.object({
  url: z
    .string()
    .trim()
    .max(2048, 'La URL no puede exceder 2048 caracteres')
    // Las reglas anti-SSRF viven en worky2-webhook.ts porque el despacho las
    // vuelve a aplicar justo antes de enviar.
    .superRefine((value, ctx) => {
      const motivo = motivoUrlWebhookInvalida(value);
      if (motivo) ctx.addIssue({ code: 'custom', message: motivo });
    }),
  secret: z
    .string()
    .trim()
    .min(16, 'El secreto debe tener al menos 16 caracteres')
    .max(200, 'El secreto no puede exceder 200 caracteres')
});

const deleteWebhookSchema = z.object({
  id: z.coerce.number().int().positive('id inválido')
});

/**
 * Máscara del secreto compartido.
 *
 * Constante a propósito: la versión anterior devolvía los 4 primeros caracteres
 * REALES y tantos asteriscos como caracteres quedaban, es decir, regalaba
 * prefijo y longitud exacta del secreto HMAC a cualquiera con la sesión.
 */
function maskSecret(): string {
  return '••••••••';
}

/**
 * POST /api/integration/webhooks
 * Registra un webhook. Body: { url, secret } (ambos los provee Worky2 en su
 * pantalla de Integraciones).
 */
export async function POST(request: Request) {
  try {
    const blocked = applyRateLimit(request, 'integration-manage', INTEGRATION_MANAGE_RATE_LIMIT);
    if (blocked) return blocked;

    const auth = await requireCompanyUser(request);
    if ('error' in auth) {
      return NextResponse.json(
        { success: false, error: auth.error },
        { status: auth.status }
      );
    }

    const body = await request.json().catch(() => null);
    const parsed = createWebhookSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: parsed.error.issues[0]?.message || 'Datos inválidos' },
        { status: 400 }
      );
    }

    // Resolución DNS: un nombre público puede apuntar a 127.0.0.1 o a la red
    // interna. Se hace aquí (con red) y no en el schema, que es síncrono.
    const motivoDns = await motivoUrlWebhookInvalidaConDns(parsed.data.url);
    if (motivoDns) {
      return NextResponse.json({ success: false, error: motivoDns }, { status: 400 });
    }

    const activos = await prisma.integrationWebhook.count({
      where: { userId: auth.user.id, isActive: true }
    });

    if (activos >= MAX_WEBHOOKS_ACTIVOS) {
      return NextResponse.json(
        {
          success: false,
          error: `Has alcanzado el máximo de ${MAX_WEBHOOKS_ACTIVOS} webhooks activos. Desactiva alguno antes de crear otro.`
        },
        { status: 409 }
      );
    }

    // Evitar duplicados exactos activos para la misma empresa
    const existing = await prisma.integrationWebhook.findFirst({
      where: { userId: auth.user.id, url: parsed.data.url, isActive: true }
    });

    if (existing) {
      return NextResponse.json(
        { success: false, error: 'Ya existe un webhook activo con esa URL' },
        { status: 409 }
      );
    }

    const webhook = await prisma.integrationWebhook.create({
      data: {
        userId: auth.user.id,
        url: parsed.data.url,
        secret: parsed.data.secret
      },
      select: { id: true, url: true, isActive: true, createdAt: true }
    });

    return NextResponse.json(
      {
        success: true,
        message: 'Webhook registrado. Recibirá el evento candidate.accepted.',
        data: webhook
      },
      { status: 201 }
    );
  } catch (error) {
    // DB-022: el índice único parcial IntegrationWebhook_userId_url_active_key
    // convierte la carrera findFirst + create en un P2002: es un duplicado, no un 500.
    if ((error as { code?: string })?.code === 'P2002') {
      return NextResponse.json(
        { success: false, error: 'Ya existe un webhook activo con esa URL' },
        { status: 409 }
      );
    }
    console.error('[Integration] Error registrando webhook:', error);
    return NextResponse.json(
      { success: false, error: 'Error al registrar el webhook' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/integration/webhooks
 * Lista los webhooks de la empresa (secreto enmascarado).
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

    const webhooks = await prisma.integrationWebhook.findMany({
      where: { userId: auth.user.id },
      orderBy: { createdAt: 'desc' },
      // El secreto NO se selecciona: no hay motivo para sacarlo de la base en
      // un listado, y la máscara ya no depende de su contenido.
      select: {
        id: true,
        url: true,
        isActive: true,
        createdAt: true
      }
    });

    return NextResponse.json({
      success: true,
      data: webhooks.map((webhook) => ({
        id: webhook.id,
        url: webhook.url,
        maskedSecret: maskSecret(),
        isActive: webhook.isActive,
        createdAt: webhook.createdAt
      }))
    });
  } catch (error) {
    console.error('[Integration] Error listando webhooks:', error);
    return NextResponse.json(
      { success: false, error: 'Error al listar los webhooks' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/integration/webhooks?id=123  (o body { id: 123 })
 * Desactiva un webhook (isActive=false): deja de recibir eventos.
 */
export async function DELETE(request: Request) {
  try {
    const blocked = applyRateLimit(request, 'integration-manage', INTEGRATION_MANAGE_RATE_LIMIT);
    if (blocked) return blocked;

    const auth = await requireCompanyUser(request);
    if ('error' in auth) {
      return NextResponse.json(
        { success: false, error: auth.error },
        { status: auth.status }
      );
    }

    const url = new URL(request.url);
    const rawId = url.searchParams.get('id') ?? (await request.json().catch(() => null))?.id;
    const parsed = deleteWebhookSchema.safeParse({ id: rawId });
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: 'Debes indicar el id del webhook a eliminar' },
        { status: 400 }
      );
    }

    const webhook = await prisma.integrationWebhook.findUnique({
      where: { id: parsed.data.id },
      select: { id: true, userId: true, isActive: true }
    });

    // Ownership: solo la empresa dueña puede eliminar su webhook
    if (!webhook || webhook.userId !== auth.user.id) {
      return NextResponse.json(
        { success: false, error: 'Webhook no encontrado' },
        { status: 404 }
      );
    }

    if (!webhook.isActive) {
      return NextResponse.json(
        { success: false, error: 'El webhook ya estaba desactivado' },
        { status: 409 }
      );
    }

    await prisma.integrationWebhook.update({
      where: { id: webhook.id },
      data: { isActive: false }
    });

    return NextResponse.json({
      success: true,
      message: 'Webhook desactivado'
    });
  } catch (error) {
    console.error('[Integration] Error eliminando webhook:', error);
    return NextResponse.json(
      { success: false, error: 'Error al eliminar el webhook' },
      { status: 500 }
    );
  }
}
