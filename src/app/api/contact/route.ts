// RUTA: src/app/api/contact/route.ts

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { applyRateLimit, CONTACT_RATE_LIMIT } from '@/lib/rate-limit';
import { sanitizeBody } from '@/lib/sanitize';
import { validate, contactMessageSchema } from '@/lib/validations';
import { getAdminInbox, sendContactMessageToAdmin } from '@/lib/email';
import { notifyAllAdmins } from '@/lib/notifications';

export async function POST(request: Request) {
  try {
    // Rate limiting: 5 mensajes por hora por IP
    const rateLimited = applyRateLimit(request, 'contact', CONTACT_RATE_LIMIT);
    if (rateLimited) return rateLimited;

    const body = await request.json();
    const clean = sanitizeBody(body, ['mensaje']);

    // SEGURIDAD (#10/#57): validar formato (email, teléfono, longitudes) con zod,
    // no sólo presencia. Antes sólo se comprobaba que existieran los campos.
    const validation = validate(contactMessageSchema, clean);
    if (!validation.success) {
      return NextResponse.json(
        { success: false, error: "Datos inválidos", errors: validation.errors },
        { status: 400 }
      );
    }

    const { nombre, email, telefono, mensaje } = validation.data;

    await prisma.contactMessage.create({
      data: {
        nombre,
        email,
        telefono: telefono || null,
        mensaje,
      },
    });

    // El mensaje se guardaba y ahí se quedaba: nadie lo leía ni recibía aviso,
    // así que cada lead que entraba por /contact se perdía salvo que alguien
    // entrara a la base a mano. Se avisa por los dos canales que ya existen
    // (notificación in-app + correo al buzón interno) y ninguno bloquea la
    // respuesta al visitante: si el correo falla, se registra y se sigue.
    const adminInbox = getAdminInbox();

    const avisos: Promise<unknown>[] = [
      notifyAllAdmins({
        type: 'contact_message',
        title: 'Nuevo mensaje de contacto',
        message: `${nombre}: ${mensaje.slice(0, 120)}`,
        link: '/admin/contact-messages',
        metadata: { email },
      }),
    ];

    if (adminInbox) {
      avisos.push(
        sendContactMessageToAdmin({
          adminEmail: adminInbox,
          nombre,
          email,
          telefono: telefono || null,
          mensaje,
        })
      );
    } else {
      console.warn('[Contact] Sin ADMIN_EMAIL ni SMTP_FROM: no se envió aviso por correo');
    }

    const resultados = await Promise.allSettled(avisos);
    for (const resultado of resultados) {
      if (resultado.status === 'rejected') {
        console.error('[Contact] Fallo al avisar del mensaje de contacto:', resultado.reason);
      }
    }

    // No se devuelve la fila creada: su `id` autoincremental permitía a
    // cualquier bot estimar cuántos leads recibe INAKAT.
    return NextResponse.json(
      {
        success: true,
        message: "Mensaje recibido. Nos pondremos en contacto contigo.",
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Error creating contact message:", error);
    return NextResponse.json(
      { success: false, error: "No pudimos enviar tu mensaje. Intenta de nuevo." },
      { status: 500 }
    );
  }
}
