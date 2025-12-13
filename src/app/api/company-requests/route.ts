import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// GET all company requests (for admin panel)
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");

    const where = status ? { status } : {};

    const requests = await prisma.companyRequest.findMany({
      where,
      orderBy: {
        createdAt: "desc",
      },
    });

    return NextResponse.json({
      success: true,
      data: requests,
    });
  } catch (error) {
    console.error("Error fetching company requests:", error);
    return NextResponse.json(
      { error: "Failed to fetch requests" },
      { status: 500 }
    );
  }
}

// POST new company request
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      nombre,
      apellidoPaterno,
      apellidoMaterno,
      nombreEmpresa,
      correoEmpresa,
      sitioWeb,
      razonSocial,
      rfc,
      direccionEmpresa,
      identificacionUrl,
      documentosConstitucionUrl,
    } = body;

    // Validate required fields
    if (
      !nombre ||
      !apellidoPaterno ||
      !apellidoMaterno ||
      !nombreEmpresa ||
      !correoEmpresa ||
      !razonSocial ||
      !rfc ||
      !direccionEmpresa
    ) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    // Create company request in database
    const companyRequest = await prisma.companyRequest.create({
      data: {
        nombre,
        apellidoPaterno,
        apellidoMaterno,
        nombreEmpresa,
        correoEmpresa,
        sitioWeb: sitioWeb || null,
        razonSocial,
        rfc,
        direccionEmpresa,
        identificacionUrl: identificacionUrl || null,
        documentosConstitucionUrl: documentosConstitucionUrl || null,
      },
    });

    return NextResponse.json(
      {
        success: true,
        message: "Company request submitted successfully",
        data: companyRequest,
      },
      { status: 201 }
    );
  } catch (error: unknown) {
    console.error("Error creating company request:", error);

    // Manejar error de RFC duplicado (Prisma unique constraint violation)
    if (
      error &&
      typeof error === 'object' &&
      'code' in error &&
      error.code === 'P2002' &&
      'meta' in error &&
      error.meta &&
      typeof error.meta === 'object' &&
      'target' in error.meta &&
      Array.isArray(error.meta.target) &&
      error.meta.target.includes('rfc')
    ) {
      return NextResponse.json(
        { error: "Ya existe una solicitud con este RFC. Por favor, verifica tus datos o contacta soporte." },
        { status: 409 }
      );
    }

    return NextResponse.json(
      { error: "Failed to submit company request" },
      { status: 500 }
    );
  }
}
