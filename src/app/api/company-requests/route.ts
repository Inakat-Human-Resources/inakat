// RUTA: src/app/api/company-requests/route.ts

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { notifyAllAdmins, runAfterResponse } from "@/lib/notifications";
import {
  validate,
  companyRequestSchema,
  passwordRegistroSchema,
} from "@/lib/validations";
import { applyRateLimit, REGISTER_RATE_LIMIT } from "@/lib/rate-limit";

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
    // SEGURIDAD: este endpoint es una excepción PÚBLICA del middleware y cada
    // llamada válida ejecuta bcrypt, crea un User activo y notifica a todos los
    // admins. Sin límite servía además de oráculo de correos registrados (409).
    const rateLimited = applyRateLimit(request, "company-request", REGISTER_RATE_LIMIT);
    if (rateLimited) return rateLimited;

    // Un cuerpo que no es JSON (o es `null`/un número) hacía que la
    // desestructuración lanzara TypeError y el endpoint público respondiera 500.
    const body = await request.json().catch(() => null);
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });
    }
    const { password, dryRun } = body; // password no está en el schema

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

    // La política de contraseña era más débil aquí (sólo longitud) que en
    // /api/auth/register y /api/auth/reset-password, y más débil que lo que el
    // propio formulario de /companies dice exigir.
    const passwordValidation = validate(passwordRegistroSchema, password);
    if (!passwordValidation.success) {
      return NextResponse.json(
        {
          error: passwordValidation.errors[0]?.message || "Contraseña inválida",
          errors: passwordValidation.errors.map((e) => ({
            field: "password",
            message: e.message,
          })),
        },
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
      logoUrl,
      latitud,
      longitud,
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

    // PRE-VALIDACIÓN: el formulario sube identificación y constancia fiscal a
    // Blob (público, URL permanente) ANTES de llamar aquí; si esta llamada
    // fallaba, esos documentos con PII quedaban huérfanos y sin forma de
    // borrarlos. Con `dryRun` el cliente comprueba datos y correo duplicado
    // antes de subir nada.
    if (dryRun === true) {
      return NextResponse.json(
        { success: true, dryRun: true, message: "Datos válidos" },
        { status: 200 }
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
          apellidoMaterno: apellidoMaterno || "",
          nombreEmpresa,
          correoEmpresa,
          sitioWeb: sitioWeb || null,
          razonSocial,
          rfc,
          direccionEmpresa,
          latitud: latitud ?? null,
          longitud: longitud ?? null,
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
          // `nombre` guarda SÓLO el nombre de pila: los apellidos tienen
          // columna propia. Concatenar el paterno aquí hacía que cualquier
          // pantalla que compone «nombre + apellidoPaterno» lo repitiera
          // («Bienvenido, Juan Pérez Pérez»).
          nombre,
          apellidoPaterno,
          apellidoMaterno: apellidoMaterno || null,
          role: "company",
          isActive: true,
          companyRequest: {
            connect: { id: companyRequest.id }
          }
        },
      });

      return { companyRequest, user };
    });

    // FIABILIDAD: antes era `.catch(() => {})` sin await, así que en serverless
    // la instancia podía congelarse antes del INSERT y ningún admin se enteraba
    // de la solicitud (y el catch vacío ni siquiera lo registraba).
    await runAfterResponse('NOTIF:company-request', () =>
      notifyAllAdmins({
        type: 'new_request',
        title: 'Nueva solicitud de empresa',
        message: `${nombreEmpresa} ha enviado una solicitud de registro.`,
        link: '/admin/requests',
        metadata: { requestId: result.companyRequest.id, nombreEmpresa },
      })
    );

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
