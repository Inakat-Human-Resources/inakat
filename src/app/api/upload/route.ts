// RUTA: src/app/api/upload/route.ts
import { put } from '@vercel/blob';
import { NextResponse } from 'next/server';
import { writeFile, mkdir } from 'fs/promises';
import path from 'path';
import { randomUUID } from 'crypto';
import { applyRateLimit, UPLOAD_RATE_LIMIT } from '@/lib/rate-limit';

export const runtime = 'nodejs';

/**
 * RELIABILITY (#PERF-028): las funciones serverless de Vercel rechazan cuerpos
 * de más de 4.5 MB con un 413 de plataforma ANTES de ejecutar este handler, así
 * que el viejo límite de 5 MB era inalcanzable: los archivos entre 4.5 y 5 MB
 * fallaban con una respuesta que ni siquiera es JSON. El límite efectivo baja a
 * 4 MB y debe anunciarse igual en todos los formularios de cliente.
 */
const MAX_UPLOAD_BYTES = 4 * 1024 * 1024;
const MAX_UPLOAD_LABEL = '4MB';

// Tipos MIME permitidos - incluir variantes comunes
const ALLOWED_MIME_TYPES = [
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/jpg',
  'image/webp',
  // Documentos Word
  'application/msword',                                                        // .doc
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',   // .docx
  // Documentos Excel
  'application/vnd.ms-excel',                                                  // .xls
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',         // .xlsx
];

// Extensiones permitidas como fallback
const ALLOWED_EXTENSIONS = ['.pdf', '.jpg', '.jpeg', '.png', '.webp', '.doc', '.docx', '.xls', '.xlsx'];

/**
 * SECURITY (#PERF-027): firmas reales ("magic bytes") por extensión.
 *
 * El nombre y el MIME los pone el cliente: un HTML renombrado a .pdf llega con
 * type 'application/pdf' (el navegador lo deriva de la extensión) y pasaba los
 * dos controles anteriores. Aquí se leen los primeros bytes del archivo y se
 * exige que coincidan con la extensión declarada.
 *
 * Cada entrada es una lista de firmas alternativas; cada firma es una lista de
 * [offset, bytes esperados].
 */
type FirmaArchivo = Array<{ offset: number; bytes: number[] }>;

const FIRMAS_POR_EXTENSION: Record<string, FirmaArchivo[]> = {
  '.pdf': [[{ offset: 0, bytes: [0x25, 0x50, 0x44, 0x46, 0x2d] }]], // %PDF-
  '.jpg': [[{ offset: 0, bytes: [0xff, 0xd8, 0xff] }]],
  '.jpeg': [[{ offset: 0, bytes: [0xff, 0xd8, 0xff] }]],
  '.png': [[{ offset: 0, bytes: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a] }]],
  // RIFF....WEBP
  '.webp': [[
    { offset: 0, bytes: [0x52, 0x49, 0x46, 0x46] },
    { offset: 8, bytes: [0x57, 0x45, 0x42, 0x50] }
  ]],
  // Contenedor OLE2 de Office 97-2003
  '.doc': [[{ offset: 0, bytes: [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1] }]],
  '.xls': [[{ offset: 0, bytes: [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1] }]],
  // OOXML: son ZIP (PK\x03\x04)
  '.docx': [[{ offset: 0, bytes: [0x50, 0x4b, 0x03, 0x04] }]],
  '.xlsx': [[{ offset: 0, bytes: [0x50, 0x4b, 0x03, 0x04] }]]
};

/** Número de bytes que hace falta leer para comprobar cualquiera de las firmas. */
const BYTES_DE_FIRMA = 12;

/**
 * Comprueba que el contenido real del archivo corresponde a su extensión.
 * Si la extensión no tiene firma conocida, no bloquea (no debería ocurrir:
 * ALLOWED_EXTENSIONS y FIRMAS_POR_EXTENSION están alineadas).
 */
function contenidoCoincideConExtension(
  cabecera: Uint8Array,
  extension: string
): boolean {
  const firmas = FIRMAS_POR_EXTENSION[extension];
  if (!firmas) return true;

  return firmas.some((firma) =>
    firma.every(({ offset, bytes }) =>
      bytes.every((b, i) => cabecera[offset + i] === b)
    )
  );
}

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

    // VALIDATION (#PERF-026): si el Content-Type no es multipart, formData()
    // lanza; antes ese error caía en el catch genérico y respondía 500.
    let formData: FormData;
    try {
      formData = await request.formData();
    } catch {
      return NextResponse.json(
        { success: false, error: 'La petición debe ser multipart/form-data con un campo "file"' },
        { status: 400 }
      );
    }

    // VALIDATION (#PERF-026): formData.get puede devolver un string. El cast a
    // File lo ocultaba y `file.name.split` reventaba con un TypeError -> 500.
    const file = formData.get('file');

    if (!file) {
      return NextResponse.json(
        { success: false, error: 'No se proporcionó ningún archivo' },
        { status: 400 }
      );
    }

    if (!(file instanceof File)) {
      return NextResponse.json(
        { success: false, error: 'El campo "file" debe ser un archivo' },
        { status: 400 }
      );
    }

    const blobConfigured = isBlobConfigured();

    // SECURITY (#54): primer filtro, sobre lo que declara el cliente. Se exige
    // SIEMPRE una extensión permitida; y el MIME debe estar en la lista permitida
    // O ser genérico/vacío (varios navegadores/SO envían '' o
    // application/octet-stream para .doc/.docx/.xls/.xlsx legítimos). Así se
    // bloquea un MIME explícitamente peligroso (p.ej. text/html) y una extensión
    // peligrosa, sin rechazar documentos ofimáticos válidos.
    //
    // OJO: nombre y MIME los pone el cliente, así que esto NO basta para impedir
    // un HTML renombrado a .pdf; de eso se encarga la comprobación de firma real
    // más abajo (#PERF-027).
    const GENERIC_MIME_TYPES = ['', 'application/octet-stream'];
    const fileExtension = '.' + file.name.split('.').pop()?.toLowerCase();
    const isValidExtension = ALLOWED_EXTENSIONS.includes(fileExtension);
    const isAllowedMime = ALLOWED_MIME_TYPES.includes(file.type);
    const isGenericMime = GENERIC_MIME_TYPES.includes(file.type);

    if (!isValidExtension || (!isAllowedMime && !isGenericMime)) {
      return NextResponse.json(
        {
          success: false,
          error: `Tipo de archivo no permitido (${file.type || fileExtension}). Solo se aceptan: PDF, JPG, PNG, WEBP, DOC, DOCX, XLS, XLSX`
        },
        { status: 400 }
      );
    }

    // Validar tamaño (máximo MAX_UPLOAD_LABEL, ver nota en MAX_UPLOAD_BYTES)
    if (file.size > MAX_UPLOAD_BYTES) {
      const sizeMB = (file.size / (1024 * 1024)).toFixed(2);
      return NextResponse.json(
        {
          success: false,
          error: `Archivo muy grande (${sizeMB}MB). El tamaño máximo es ${MAX_UPLOAD_LABEL}`
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

    // SECURITY (#PERF-027): comprobar el contenido real, no sólo lo que dice el
    // cliente. Sin esto, cualquier binario renombrado a .pdf se alojaba en el
    // store de la empresa.
    const cabecera = new Uint8Array(await file.slice(0, BYTES_DE_FIRMA).arrayBuffer());
    if (!contenidoCoincideConExtension(cabecera, fileExtension)) {
      return NextResponse.json(
        {
          success: false,
          error: `El contenido del archivo no corresponde a su extensión (${fileExtension}). Sube el archivo original.`
        },
        { status: 400 }
      );
    }

    // SECURITY (#PERF-029): el nombre público ya no depende de Math.random ni
    // contiene el nombre original (que suele ser el nombre de la persona y
    // viajaba en logs, referers y correos). Un UUID v4 + el sufijo aleatorio del
    // propio Blob hacen la URL inadivinable; el nombre original se guarda en BD.
    const uniqueFileName = `${randomUUID()}${fileExtension}`;

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
      // Subir a Vercel Blob. En @vercel/blob ^2.0.0 addRandomSuffix es false por
      // defecto: hay que pedirlo explícitamente (#PERF-029).
      const blob = await put(uniqueFileName, file, {
        access: 'public',
        addRandomSuffix: true
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

    // SECURITY (#58/#91): loguear el detalle interno en el servidor; nunca
    // exponerlo al cliente.
    console.error('[Upload] Error procesando archivo:', errorMessage);

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
        error: 'Error al subir el archivo. Inténtalo de nuevo más tarde.'
      },
      { status: 500 }
    );
  }
}
