// RUTA: src/app/api/contact/route.ts

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { applyRateLimit, CONTACT_RATE_LIMIT } from '@/lib/rate-limit';
import { sanitizeBody } from '@/lib/sanitize';
import { validate, contactMessageSchema } from '@/lib/validations';

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
        { error: "Datos inválidos", errors: validation.errors },
        { status: 400 }
      );
    }

    const { nombre, email, telefono, mensaje } = validation.data;

    // Create contact message in database
    const contactMessage = await prisma.contactMessage.create({
      data: {
        nombre,
        email,
        telefono: telefono || null,
        mensaje,
      },
    });

    return NextResponse.json(
      {
        success: true,
        message: "Message received successfully",
        data: contactMessage,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Error creating contact message:", error);
    return NextResponse.json(
      { error: "Failed to send message" },
      { status: 500 }
    );
  }
}
