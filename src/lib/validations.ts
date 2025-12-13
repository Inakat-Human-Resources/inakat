// RUTA: src/lib/validations.ts
import { z } from 'zod';

// =============================================
// SCHEMAS DE VALIDACIÓN
// =============================================

// Validación de login
export const loginSchema = z.object({
  email: z.string().email('Email inválido'),
  password: z.string().min(6, 'La contraseña debe tener al menos 6 caracteres')
});

export type LoginData = z.infer<typeof loginSchema>;

// Validación de registro de empresa
export const companyRequestSchema = z.object({
  nombre: z.string().min(2, 'Nombre muy corto'),
  apellidoPaterno: z.string().min(2, 'Apellido paterno muy corto'),
  apellidoMaterno: z.string().min(2, 'Apellido materno muy corto'),
  nombreEmpresa: z.string().min(2, 'Nombre de empresa muy corto'),
  correoEmpresa: z.string().email('Email inválido'),
  sitioWeb: z.string().url('URL inválida').optional().or(z.literal('')),
  razonSocial: z.string().min(5, 'Razón social muy corta'),
  rfc: z
    .string()
    .regex(
      /^[A-ZÑ&]{3,4}[0-9]{6}[A-Z0-9]{3}$/,
      'RFC inválido. Debe ser formato mexicano válido (ej: ABC123456A1A o XAXX010101AAA)'
    ),
  direccionEmpresa: z.string().min(10, 'Dirección muy corta'),
  identificacionUrl: z.string().url().optional().or(z.literal('')),
  documentosConstitucionUrl: z.string().url().optional().or(z.literal(''))
});

export type CompanyRequestData = z.infer<typeof companyRequestSchema>;

// Validación de mensaje de contacto
export const contactMessageSchema = z.object({
  nombre: z.string().min(2, 'Nombre muy corto'),
  email: z.string().email('Email inválido'),
  telefono: z
    .string()
    .regex(
      /^\+?52?\d{10}$/,
      'Teléfono inválido. Formato: 5512345678 o +525512345678'
    )
    .optional()
    .or(z.literal('')),
  mensaje: z.string().min(10, 'Mensaje debe tener al menos 10 caracteres')
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
