import { put } from '@vercel/blob';
import { NextResponse } from 'next/server';

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

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json(
        { success: false, error: 'No se proporcionó ningún archivo' },
        { status: 400 }
      );
    }

    // Log para debugging
    console.log('Upload attempt:', {
      name: file.name,
      type: file.type,
      size: file.size
    });

    // Validar tipo de archivo - verificar MIME type O extensión
    const fileExtension = '.' + file.name.split('.').pop()?.toLowerCase();
    const isValidMimeType = ALLOWED_MIME_TYPES.includes(file.type);
    const isValidExtension = ALLOWED_EXTENSIONS.includes(fileExtension);

    if (!isValidMimeType && !isValidExtension) {
      console.error('Invalid file type:', { type: file.type, extension: fileExtension });
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

    // Subir a Vercel Blob
    const blob = await put(uniqueFileName, file, {
      access: 'public'
    });

    console.log('Upload successful:', { url: blob.url, filename: uniqueFileName });

    return NextResponse.json({
      success: true,
      url: blob.url,
      filename: file.name
    });
  } catch (error: unknown) {
    console.error('Error uploading file:', error);

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
