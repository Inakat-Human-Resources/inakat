import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(request: Request) {
  try {
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
