// RUTA: src/lib/validations.ts
import { z } from 'zod';
import { isSafeHttpUrl } from '@/lib/sanitize';

/**
 * URL opcional que va a acabar renderizada como `href`.
 *
 * Dos cosas que `z.string().url().optional().or(z.literal(''))` hacía mal:
 *
 *  1. `.optional()` acepta `undefined` pero NO `null`, y los formularios mandan
 *     `null` para los campos vacíos: el registro de empresa fallaba con
 *     «Datos inválidos» sólo por dejar el sitio web en blanco.
 *  2. `javascript:alert(1)` ES una URL válida para el estándar, así que pasaba
 *     el filtro y quedaba guardada; al pinchar el enlace desde el panel de
 *     admin se ejecutaba. Aquí se exige http(s), como en los documentos.
 */
const urlOpcionalSegura = (etiqueta: string) =>
  z
    .preprocess(
      (v) => {
        if (v === null || v === undefined || v === '') return undefined;
        if (typeof v !== 'string') return v;
        const limpio = v.trim();
        if (limpio === '') return undefined;
        // "inakat.com" es lo que la gente escribe; se completa antes de validar.
        return /^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(limpio) ? limpio : `https://${limpio}`;
      },
      z
        .string()
        .refine(isSafeHttpUrl, `${etiqueta} debe ser una dirección http(s) válida`)
        .optional()
    )
    .optional();

/** Sufijo de host de Vercel Blob (el único que autoriza next.config.ts). */
const HOST_BLOB_SUFIJO = '.public.blob.vercel-storage.com';

/**
 * ¿Es la URL de un archivo que salió de /api/upload?
 *
 * En producción /api/upload devuelve siempre una URL https de Vercel Blob; en
 * desarrollo, sin token de Blob, devuelve una ruta local `/uploads/<archivo>`.
 */
export function esUrlDeArchivoSubido(valor: unknown): valor is string {
  if (typeof valor !== 'string') return false;
  if (process.env.NODE_ENV !== 'production' && /^\/uploads\/[\w-][\w.-]*$/.test(valor)) {
    return true;
  }
  try {
    const url = new URL(valor);
    return url.protocol === 'https:' && url.hostname.endsWith(HOST_BLOB_SUFIJO);
  } catch {
    return false;
  }
}

/**
 * URL opcional de un documento o imagen subidos por /api/upload (INE, acta
 * constitutiva, logo).
 *
 * SEGURIDAD (EMP-001): con `urlOpcionalSegura` bastaba con que fuera http(s),
 * así que desde el alta PÚBLICA se podía guardar como «identificación» un
 * enlace a cualquier sitio, que el admin abre desde /admin/requests con su
 * sesión iniciada creyendo que es un documento de la empresa. Además, en
 * desarrollo la ruta local `/uploads/x.pdf` se convertía en
 * `https:///uploads/x.pdf` y el enlace quedaba roto. Aquí sólo se acepta lo
 * que realmente sale de nuestro endpoint de subida.
 */
const urlArchivoSubidoOpcional = (etiqueta: string) =>
  z
    .preprocess(
      (v) => {
        if (v === null || v === undefined) return undefined;
        if (typeof v !== 'string') return v;
        const limpio = v.trim();
        return limpio === '' ? undefined : limpio;
      },
      z
        .string()
        .refine(esUrlDeArchivoSubido, `${etiqueta} debe ser un archivo subido a INAKAT`)
        .optional()
    )
    .optional();

// =============================================
// POLÍTICA DE CONTRASEÑA
// =============================================

/**
 * Longitud mínima de contraseña al CREAR o CAMBIAR credenciales.
 *
 * Existe como constante exportada porque cada ruta la tenía escrita a mano con
 * un número distinto (register/reset exigían 8, admin/users 6, admin/vendors
 * nada). Esa discrepancia dejaba cuentas imposibles de usar: el admin creaba un
 * reclutador con 6 caracteres y el login lo rechazaba antes de comparar el hash.
 */
export const PASSWORD_MIN_LENGTH = 8;

/** Política de contraseña para alta y cambio de credenciales. */
export const passwordSchema = z
  .string()
  .min(PASSWORD_MIN_LENGTH, `La contraseña debe tener al menos ${PASSWORD_MIN_LENGTH} caracteres`)
  .max(200, 'La contraseña no puede exceder 200 caracteres');

/**
 * Política de las vías de ALTA PÚBLICA (registro de candidato, reset de
 * contraseña y alta de empresa): además del mínimo, una mayúscula y un número.
 *
 * El alta de empresa sólo comprobaba `password.length < 8` a mano, así que por
 * esa vía entraban contraseñas que /api/auth/register y /api/auth/reset-password
 * rechazan — y que el propio formulario de /companies dice exigir.
 */
export const passwordRegistroSchema = passwordSchema
  .regex(/[A-Z]/, 'La contraseña debe contener al menos una mayúscula')
  .regex(/[0-9]/, 'La contraseña debe contener al menos un número');

/**
 * Nombre de persona.
 *
 * El patrón del formulario (`/^[A-Za-zÁáÉéÍíÓóÚúÑñ\s]+$/`) rechazaba diéresis
 * («Argüelles»), apóstrofos («D'Angelo»), guiones («María-José») y puntos
 * («Ma. Fernanda»): gente real que no podía registrarse. Se usan clases Unicode.
 */
export const NOMBRE_PERSONA_REGEX = /^[\p{L}\p{M}'’.\- ]+$/u;

/** Latitud opcional, tolerando null/'' y comprobando el rango. */
const latitudOpcional = z
  .preprocess(
    (v) => (v === null || v === '' ? undefined : v),
    z.number().min(-90, 'Latitud fuera de rango').max(90, 'Latitud fuera de rango').optional()
  )
  .optional();

/** Longitud opcional, tolerando null/'' y comprobando el rango. */
const longitudOpcional = z
  .preprocess(
    (v) => (v === null || v === '' ? undefined : v),
    z
      .number()
      .min(-180, 'Longitud fuera de rango')
      .max(180, 'Longitud fuera de rango')
      .optional()
  )
  .optional();

// =============================================
// SCHEMAS DE VALIDACIÓN
// =============================================

/**
 * Validación de login.
 *
 * El login sólo comprueba PRESENCIA, nunca la política de complejidad: aplicarla
 * aquí bloqueaba para siempre a las cuentas creadas con contraseñas más cortas
 * (el 400 salía antes de comparar el hash, así que el usuario veía un error
 * genérico y el admin no se enteraba). La política vive en `passwordSchema` y
 * sólo se aplica al crear o cambiar la contraseña.
 */
export const loginSchema = z.object({
  email: z.string().email('Email inválido'),
  password: z.string().min(1, 'La contraseña es requerida').max(200)
});

export type LoginData = z.infer<typeof loginSchema>;

// Validación de registro de empresa
export const companyRequestSchema = z.object({
  // Los `.max()` no son cosmética: el endpoint es PÚBLICO y el rate limit vive
  // en memoria por instancia, así que sin tope se pueden insertar cadenas del
  // tamaño del cuerpo que acepte la plataforma (~4.5 MB) en columnas String.
  nombre: z
    .string()
    .trim()
    .min(2, 'Nombre muy corto')
    .max(80, 'Nombre muy largo')
    .regex(NOMBRE_PERSONA_REGEX, 'Nombre inválido'),
  apellidoPaterno: z
    .string()
    .trim()
    .min(2, 'Apellido paterno muy corto')
    .max(80, 'Apellido paterno muy largo')
    .regex(NOMBRE_PERSONA_REGEX, 'Apellido paterno inválido'),
  // OPCIONAL: hay representantes con un solo apellido (el registro de
  // candidatos ya lo tenía opcional). Se acepta '' y null.
  apellidoMaterno: z
    .preprocess(
      (v) => (v === null || v === undefined ? '' : v),
      z
        .string()
        .trim()
        .max(80, 'Apellido materno muy largo')
        .refine(
          (v) => v === '' || (v.length >= 2 && NOMBRE_PERSONA_REGEX.test(v)),
          'Apellido materno inválido'
        )
    )
    .optional(),
  nombreEmpresa: z
    .string()
    .trim()
    .min(2, 'Nombre de empresa muy corto')
    .max(200, 'Nombre de empresa muy largo'),
  correoEmpresa: z.string().trim().email('Email inválido').max(254, 'Email muy largo'),
  sitioWeb: urlOpcionalSegura('El sitio web'),
  razonSocial: z
    .string()
    .trim()
    .min(5, 'Razón social muy corta')
    .max(200, 'Razón social muy larga'),
  rfc: z
    .string()
    .regex(
      /^[A-ZÑ&]{3,4}[0-9]{6}[A-Z0-9]{3}$/,
      'RFC inválido. Debe ser formato mexicano válido (ej: ABC123456A1A o XAXX010101AAA)'
    ),
  direccionEmpresa: z
    .string()
    .trim()
    .min(10, 'Dirección muy corta')
    .max(400, 'Dirección muy larga'),
  identificacionUrl: urlArchivoSubidoOpcional('La identificación'),
  documentosConstitucionUrl: urlArchivoSubidoOpcional('El acta constitutiva'),
  // El logo se renderiza como imagen en el panel de admin, en la bolsa pública
  // y en el dashboard: tiene que venir de /api/upload, igual que los
  // documentos. Antes se leía crudo del body y se guardaba sin pasar por el
  // schema.
  logoUrl: urlArchivoSubidoOpcional('El logo'),
  // El mapa del formulario ya calculaba estas coordenadas pero nadie las
  // enviaba ni la ruta las aceptaba, así que toda empresa nueva quedaba con
  // latitud/longitud null aunque hubiera marcado su ubicación.
  latitud: latitudOpcional,
  longitud: longitudOpcional
});

export type CompanyRequestData = z.infer<typeof companyRequestSchema>;

/**
 * Edición de una solicitud desde el panel de admin (PUT company-requests/[id]).
 *
 * Mismas reglas de formato que el alta, con todos los campos opcionales: la
 * remediación #9/#52 sólo cubrió el POST y el PUT escribía RFC, correo y
 * nombres sin validar absolutamente nada.
 */
export const companyRequestUpdateSchema = companyRequestSchema
  .omit({ identificacionUrl: true, documentosConstitucionUrl: true, logoUrl: true })
  .partial();

export type CompanyRequestUpdateData = z.infer<typeof companyRequestUpdateSchema>;

/**
 * Actualización del perfil de empresa (PUT /api/company/profile).
 *
 * Antes se hacía `.trim()` sobre lo que llegara (un número u objeto provocaba
 * TypeError → 500), nombre/dirección podían quedarse vacíos, lat/lng aceptaban
 * cualquier valor y `logoUrl` se guardaba sin comprobar el esquema.
 */
export const companyProfileUpdateSchema = z.object({
  nombre: z
    .string()
    .trim()
    .min(2, 'Nombre muy corto')
    .max(80, 'Nombre muy largo')
    .regex(NOMBRE_PERSONA_REGEX, 'Nombre inválido')
    .optional(),
  apellidoPaterno: z
    .string()
    .trim()
    .min(2, 'Apellido paterno muy corto')
    .max(80, 'Apellido paterno muy largo')
    .regex(NOMBRE_PERSONA_REGEX, 'Apellido paterno inválido')
    .optional(),
  apellidoMaterno: z
    .preprocess(
      (v) => (v === null || v === undefined ? '' : v),
      z
        .string()
        .trim()
        .max(80, 'Apellido materno muy largo')
        .refine(
          (v) => v === '' || (v.length >= 2 && NOMBRE_PERSONA_REGEX.test(v)),
          'Apellido materno inválido'
        )
    )
    .optional(),
  nombreEmpresa: z
    .string()
    .trim()
    .min(2, 'Nombre de empresa muy corto')
    .max(200, 'Nombre de empresa muy largo')
    .optional(),
  correoEmpresa: z.string().trim().email('Email inválido').max(254, 'Email muy largo').optional(),
  sitioWeb: urlOpcionalSegura('El sitio web'),
  razonSocial: z
    .string()
    .trim()
    .min(5, 'Razón social muy corta')
    .max(200, 'Razón social muy larga')
    .optional(),
  direccionEmpresa: z
    .string()
    .trim()
    .min(10, 'Dirección muy corta')
    .max(400, 'Dirección muy larga')
    .optional(),
  latitud: latitudOpcional,
  longitud: longitudOpcional,
  // Sólo logos subidos por /api/upload: next/image únicamente autoriza el host
  // de Vercel Blob, así que cualquier otro host dejaba el logo roto en la bolsa
  // pública y en los paneles.
  logoUrl: urlArchivoSubidoOpcional('El logo')
});

export type CompanyProfileUpdateData = z.infer<typeof companyProfileUpdateSchema>;

/**
 * Quita separadores humanos del teléfono ANTES de validarlo.
 *
 * El placeholder del formulario propone «+52 000 000 0000» y la propia página
 * imprime el teléfono de INAKAT con espacios, pero el patrón no admite ni
 * espacios ni guiones ni paréntesis: quien copiaba el formato sugerido recibía
 * «Datos inválidos» y, tras 5 intentos, una hora de rate limit.
 */
const telefonoNormalizado = (v: unknown) =>
  typeof v === 'string' ? v.replace(/[\s\-().]/g, '') : v;

/**
 * Teléfono mexicano opcional: 10 dígitos con prefijo +52/52 opcional, tras
 * quitar espacios, guiones, puntos y paréntesis. Compartido por el formulario
 * de contacto y el registro de candidatos (AUTHUI-023).
 */
export const telefonoSchema = z.preprocess(
  telefonoNormalizado,
  z
    .string()
    .regex(
      // 10 dígitos, con prefijo de país +52/52 OPCIONAL como grupo. El patrón
      // anterior (/^\+?52?\d{10}$/) rechazaba números de 10 dígitos que empiezan
      // por 52 (consumía el "52" del prefijo y dejaba sólo 8 dígitos) (#11).
      /^(\+?52)?\d{10}$/,
      'Teléfono inválido. Formato: 10 dígitos, ej. 8112345678'
    )
    .optional()
    .or(z.literal(''))
);

// Validación de mensaje de contacto
export const contactMessageSchema = z.object({
  nombre: z.string().trim().min(2, 'Nombre muy corto').max(120, 'Nombre muy largo'),
  email: z.string().trim().email('Email inválido').max(254, 'Email muy largo'),
  telefono: telefonoSchema,
  mensaje: z
    .string()
    .trim()
    .min(10, 'Mensaje debe tener al menos 10 caracteres')
    .max(5000, 'El mensaje no puede exceder 5000 caracteres')
});

export type ContactMessageData = z.infer<typeof contactMessageSchema>;

// =============================================
// HELPER DE VALIDACIÓN
// =============================================

export interface ValidationSuccess<T> {
  success: true;
  data: T;
}

export interface ValidationError {
  success: false;
  errors: Array<{
    field: string;
    message: string;
  }>;
}

export type ValidationResult<T> = ValidationSuccess<T> | ValidationError;

/**
 * Valida datos contra un schema de Zod
 * @param schema - Schema de Zod
 * @param data - Datos a validar
 * @returns Resultado de validación con datos o errores
 */
export function validate<T>(
  schema: z.ZodSchema<T>,
  data: unknown
): ValidationResult<T> {
  try {
    const validatedData = schema.parse(data);
    return {
      success: true,
      data: validatedData
    };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        success: false,
        errors: error.issues.map((err) => ({
          field: err.path.join('.'),
          message: err.message
        }))
      };
    }
    return {
      success: false,
      errors: [{ field: 'unknown', message: 'Error de validación desconocido' }]
    };
  }
}
