// RUTA: src/app/api/company-requests/route.ts

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { notifyAllAdmins } from "@/lib/notifications";
import { validate, companyRequestSchema } from "@/lib/validations";

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
      { error: "Error al obtener las solicitudes. Intenta de nuevo." },
      { status: 500 }
    );
  }
}

// POST new company request
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { password, logoUrl } = body; // password/logoUrl no están en el schema

    // SEGURIDAD (#9/#52): validar de verdad con zod (formato de email, RFC
    // mexicano, longitudes), no sólo presencia. Antes companyRequestSchema
    // estaba definido pero la ruta nunca lo usaba.
    const validation = validate(companyRequestSchema, body);
    if (!validation.success) {
      return NextResponse.json(
        { error: "Datos inválidos", errors: validation.errors },
        { status: 400 }
      );
    }

    if (!password || typeof password !== "string" || password.length < 8) {
      return NextResponse.json(
        { error: "La contraseña debe tener al menos 8 caracteres" },
        { status: 400 }
      );
    }

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
    } = validation.data;

    // Verificar si ya existe un usuario con ese email
    const existingUser = await prisma.user.findUnique({
      where: { email: correoEmpresa.toLowerCase() }
    });

    if (existingUser) {
      return NextResponse.json(
        { error: "Ya existe una cuenta con este correo electrónico." },
        { status: 409 }
      );
    }

    // Hashear la contraseña
    const hashedPassword = await bcrypt.hash(password, 10);

    // Crear User y CompanyRequest en una transacción
    const result = await prisma.$transaction(async (tx) => {
      // 1. Crear el CompanyRequest primero
      const companyRequest = await tx.companyRequest.create({
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
          logoUrl: logoUrl || null, // FEAT-1b: Logo de empresa
          status: "pending",
        },
      });

      // 2. Crear el User conectado al CompanyRequest
      const user = await tx.user.create({
        data: {
          email: correoEmpresa.toLowerCase(),
          password: hashedPassword,
          nombre: `${nombre} ${apellidoPaterno}`,
          apellidoPaterno,
          apellidoMaterno,
          role: "company",
          isActive: true,
          companyRequest: {
            connect: { id: companyRequest.id }
          }
        },
      });

      return { companyRequest, user };
    });

    // Notificar a admins (fire-and-forget)
    notifyAllAdmins({
      type: 'new_request',
      title: 'Nueva solicitud de empresa',
      message: `${nombreEmpresa} ha enviado una solicitud de registro.`,
      link: '/admin/requests',
      metadata: { requestId: result.companyRequest.id, nombreEmpresa },
    }).catch(() => {});

    return NextResponse.json(
      {
        success: true,
        message: "Solicitud enviada. Ya puedes iniciar sesión, pero algunas funciones estarán limitadas hasta que tu cuenta sea aprobada.",
        data: result.companyRequest,
      },
      { status: 201 }
    );
  } catch (error: unknown) {
    console.error("Error creating company request:", error);

    // Manejar error de email duplicado (Prisma unique constraint violation)
    if (
      error &&
      typeof error === 'object' &&
      'code' in error &&
      error.code === 'P2002' &&
      'meta' in error &&
      error.meta &&
      typeof error.meta === 'object' &&
      'target' in error.meta &&
      Array.isArray(error.meta.target)
    ) {
      const target = error.meta.target as string[];
      if (target.includes('email')) {
        return NextResponse.json(
          { error: "Ya existe una cuenta con este correo electrónico." },
          { status: 409 }
        );
      }
    }

    return NextResponse.json(
      { error: "Error al enviar la solicitud. Intenta de nuevo." },
      { status: 500 }
    );
  }
}
