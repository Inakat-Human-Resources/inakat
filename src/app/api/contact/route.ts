// RUTA: src/app/api/contact/route.ts

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { applyRateLimit, CONTACT_RATE_LIMIT } from '@/lib/rate-limit';

export async function POST(request: Request) {
  try {
    // Rate limiting: 5 mensajes por hora por IP
    const rateLimited = applyRateLimit(request, 'contact', CONTACT_RATE_LIMIT);
    if (rateLimited) return rateLimited;

    const body = await request.json();
    const { nombre, email, telefono, mensaje } = body;

    // Validate required fields
    if (!nombre || !email || !mensaje) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

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
