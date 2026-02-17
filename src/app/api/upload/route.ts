// RUTA: src/app/api/upload/route.ts
import { put } from '@vercel/blob';
import { NextResponse } from 'next/server';
import { writeFile, mkdir } from 'fs/promises';
import path from 'path';
import { applyRateLimit, UPLOAD_RATE_LIMIT } from '@/lib/rate-limit';

export const runtime = 'nodejs';

// Tipos MIME permitidos - incluir variantes comunes
const ALLOWED_MIME_TYPES = [
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/jpg',
  'image/webp'
];

// Extensiones permitidas como fallback
const ALLOWED_EXTENSIONS = ['.pdf', '.jpg', '.jpeg', '.png', '.webp'];

// Verificar si el token de Vercel Blob está configurado
function isBlobConfigured(): boolean {
  const token = process.env.BLOB_READ_WRITE_TOKEN;
  return Boolean(token && token.length > 10);
}

// Fallback: guardar archivo localmente (solo para desarrollo)
async function saveToLocalStorage(file: File, uniqueFileName: string): Promise<string> {
  const uploadDir = path.join(process.cwd(), 'public', 'uploads');

  // Crear directorio si no existe
  await mkdir(uploadDir, { recursive: true });

  const filePath = path.join(uploadDir, uniqueFileName);
  const bytes = await file.arrayBuffer();
  const buffer = Buffer.from(bytes);

  await writeFile(filePath, buffer);

  // Retornar URL relativa para acceso público
  return `/uploads/${uniqueFileName}`;
}

export async function POST(request: Request) {
  try {
    // Rate limiting: 15 uploads por hora por IP
    const rateLimited = applyRateLimit(request, 'upload', UPLOAD_RATE_LIMIT);
    if (rateLimited) return rateLimited;

    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json(
        { success: false, error: 'No se proporcionó ningún archivo' },
        { status: 400 }
      );
    }

    const blobConfigured = isBlobConfigured();

    // Validar tipo de archivo - verificar MIME type O extensión
    const fileExtension = '.' + file.name.split('.').pop()?.toLowerCase();
    const isValidMimeType = ALLOWED_MIME_TYPES.includes(file.type);
    const isValidExtension = ALLOWED_EXTENSIONS.includes(fileExtension);

    if (!isValidMimeType && !isValidExtension) {
      return NextResponse.json(
        {
          success: false,
          error: `Tipo de archivo no permitido (${file.type || fileExtension}). Solo se aceptan: PDF, JPG, PNG, WEBP`
        },
        { status: 400 }
      );
    }

    // Validar tamaño (máximo 5MB)
    const maxSize = 5 * 1024 * 1024; // 5MB
    if (file.size > maxSize) {
      const sizeMB = (file.size / (1024 * 1024)).toFixed(2);
      return NextResponse.json(
        {
          success: false,
          error: `Archivo muy grande (${sizeMB}MB). El tamaño máximo es 5MB`
        },
        { status: 400 }
      );
    }

    // Validar que el archivo no esté vacío
    if (file.size === 0) {
      return NextResponse.json(
        {
          success: false,
          error: 'El archivo está vacío'
        },
        { status: 400 }
      );
    }

    // Generar nombre único para evitar colisiones
    const timestamp = Date.now();
    const randomStr = Math.random().toString(36).substring(2, 8);
    const sanitizedName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
    const uniqueFileName = `${timestamp}-${randomStr}-${sanitizedName}`;

    let fileUrl: string;

    // Verificar si Vercel Blob está configurado
    if (!blobConfigured) {
      // En desarrollo, usar almacenamiento local
      if (process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'test') {
        fileUrl = await saveToLocalStorage(file, uniqueFileName);
      } else {
        // En producción sin token configurado, retornar error claro
        return NextResponse.json(
          {
            success: false,
            error: 'El servicio de almacenamiento no está configurado. Contacta al administrador para configurar BLOB_READ_WRITE_TOKEN.'
          },
          { status: 503 }
        );
      }
    } else {
      // Subir a Vercel Blob
      const blob = await put(uniqueFileName, file, {
        access: 'public'
      });
      fileUrl = blob.url;
    }

    return NextResponse.json({
      success: true,
      url: fileUrl,
      filename: file.name
    });
  } catch (error: unknown) {

    // Manejo específico de errores de Vercel Blob
    const errorMessage = error instanceof Error ? error.message : 'Error desconocido';

    if (errorMessage.includes('BLOB_STORE_NOT_FOUND') || errorMessage.includes('not configured')) {
      return NextResponse.json(
        {
          success: false,
          error: 'El servicio de almacenamiento no está configurado. Contacta al administrador.'
        },
        { status: 503 }
      );
    }

    if (errorMessage.includes('BLOB_ACCESS_DENIED')) {
      return NextResponse.json(
        {
          success: false,
          error: 'Error de permisos en el almacenamiento. Contacta al administrador.'
        },
        { status: 403 }
      );
    }

    return NextResponse.json(
      {
        success: false,
        error: `Error al subir archivo: ${errorMessage}`
      },
      { status: 500 }
    );
  }
}
