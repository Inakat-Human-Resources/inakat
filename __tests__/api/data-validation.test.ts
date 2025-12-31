// RUTA: __tests__/api/data-validation.test.ts

/**
 * Tests de Validación de Datos
 *
 * Verifican que la validación de datos funciona correctamente
 * para prevenir datos inválidos o maliciosos.
 */

describe('Validación de Email', () => {
  const validateEmail = (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  it('debería aceptar emails válidos', () => {
    expect(validateEmail('user@example.com')).toBe(true);
    expect(validateEmail('user.name@example.com')).toBe(true);
    expect(validateEmail('user+tag@example.co.mx')).toBe(true);
  });

  it('debería rechazar emails inválidos', () => {
    expect(validateEmail('')).toBe(false);
    expect(validateEmail('invalid')).toBe(false);
    expect(validateEmail('user@')).toBe(false);
    expect(validateEmail('@example.com')).toBe(false);
    expect(validateEmail('user @example.com')).toBe(false);
  });
});

describe('Validación de RFC', () => {
  const validateRFC = (rfc: string): boolean => {
    if (!rfc) return false;
    const rfcRegex = /^[A-ZÑ&]{3,4}[0-9]{6}[A-Z0-9]{3}$/;
    return rfcRegex.test(rfc.toUpperCase());
  };

  it('debería aceptar RFC válidos de persona moral (12 caracteres)', () => {
    expect(validateRFC('ABC123456XY9')).toBe(true);
    expect(validateRFC('TEC201201AB3')).toBe(true);
  });

  it('debería aceptar RFC válidos de persona física (13 caracteres)', () => {
    expect(validateRFC('GARA850101HDF')).toBe(true);
    expect(validateRFC('XAXX010101000')).toBe(true);
  });

  it('debería rechazar RFC inválidos', () => {
    expect(validateRFC('')).toBe(false);
    expect(validateRFC('ABC')).toBe(false);
    expect(validateRFC('12345678901')).toBe(false);
    expect(validateRFC('ABCD12345678901')).toBe(false); // Muy largo
  });
});

describe('Validación de Teléfono', () => {
  const validatePhone = (phone: string): boolean => {
    if (!phone) return true; // Opcional
    const cleaned = phone.replace(/\D/g, '');
    return cleaned.length >= 10 && cleaned.length <= 15;
  };

  it('debería aceptar teléfonos válidos', () => {
    expect(validatePhone('5512345678')).toBe(true);
    expect(validatePhone('55 1234 5678')).toBe(true);
    expect(validatePhone('+52 55 1234 5678')).toBe(true);
    expect(validatePhone('(55) 1234-5678')).toBe(true);
  });

  it('debería aceptar campo vacío (opcional)', () => {
    expect(validatePhone('')).toBe(true);
  });

  it('debería rechazar teléfonos muy cortos', () => {
    expect(validatePhone('123456789')).toBe(false); // 9 dígitos
  });
});

describe('Validación de URL', () => {
  const validateURL = (url: string): boolean => {
    if (!url) return true; // Opcional
    try {
      new URL(url.startsWith('http') ? url : `https://${url}`);
      return true;
    } catch {
      return false;
    }
  };

  it('debería aceptar URLs válidas', () => {
    expect(validateURL('https://example.com')).toBe(true);
    expect(validateURL('http://example.com')).toBe(true);
    expect(validateURL('example.com')).toBe(true);
    expect(validateURL('www.example.com')).toBe(true);
  });

  it('debería aceptar campo vacío (opcional)', () => {
    expect(validateURL('')).toBe(true);
  });
});

describe('Validación de Código Postal', () => {
  const validatePostalCode = (code: string): boolean => {
    if (!code) return false;
    return /^[0-9]{5}$/.test(code);
  };

  it('debería aceptar códigos postales válidos (5 dígitos)', () => {
    expect(validatePostalCode('64000')).toBe(true);
    expect(validatePostalCode('01000')).toBe(true);
    expect(validatePostalCode('99999')).toBe(true);
  });

  it('debería rechazar códigos postales inválidos', () => {
    expect(validatePostalCode('')).toBe(false);
    expect(validatePostalCode('1234')).toBe(false); // 4 dígitos
    expect(validatePostalCode('123456')).toBe(false); // 6 dígitos
    expect(validatePostalCode('ABCDE')).toBe(false); // Letras
  });
});

describe('Validación de Contraseña', () => {
  const validatePassword = (password: string): { valid: boolean; errors: string[] } => {
    const errors: string[] = [];

    if (password.length < 6) {
      errors.push('La contraseña debe tener al menos 6 caracteres');
    }

    return { valid: errors.length === 0, errors };
  };

  it('debería aceptar contraseñas válidas', () => {
    expect(validatePassword('password123').valid).toBe(true);
    expect(validatePassword('SecurePass1!').valid).toBe(true);
  });

  it('debería rechazar contraseñas muy cortas', () => {
    const result = validatePassword('12345');
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('La contraseña debe tener al menos 6 caracteres');
  });
});

describe('Validación de Salario', () => {
  const validateSalary = (salary: string): boolean => {
    if (!salary) return false;
    // Acepta formatos: "$25,000", "25000", "$25,000 - $35,000", etc.
    return salary.length > 0 && salary.length <= 100;
  };

  it('debería aceptar formatos de salario válidos', () => {
    expect(validateSalary('$25,000')).toBe(true);
    expect(validateSalary('$25,000 - $35,000')).toBe(true);
    expect(validateSalary('25000')).toBe(true);
    expect(validateSalary('Competitivo')).toBe(true);
  });

  it('debería rechazar salario vacío', () => {
    expect(validateSalary('')).toBe(false);
  });
});

describe('Validación de Créditos', () => {
  const validateCredits = (credits: number, required: number): { sufficient: boolean; missing: number } => {
    const sufficient = credits >= required;
    const missing = sufficient ? 0 : required - credits;
    return { sufficient, missing };
  };

  it('debería confirmar créditos suficientes', () => {
    expect(validateCredits(10, 6).sufficient).toBe(true);
    expect(validateCredits(6, 6).sufficient).toBe(true);
  });

  it('debería detectar créditos insuficientes', () => {
    const result = validateCredits(3, 6);
    expect(result.sufficient).toBe(false);
    expect(result.missing).toBe(3);
  });
});

describe('Sanitización de Entrada', () => {
  const sanitizeInput = (input: string): string => {
    return input
      .trim()
      .replace(/[<>]/g, '') // Prevenir XSS básico
      .slice(0, 1000); // Limitar longitud
  };

  it('debería remover espacios al inicio y final', () => {
    expect(sanitizeInput('  texto  ')).toBe('texto');
  });

  it('debería remover caracteres peligrosos', () => {
    expect(sanitizeInput('<script>alert(1)</script>')).toBe('scriptalert(1)/script');
  });

  it('debería limitar longitud del texto', () => {
    const longText = 'a'.repeat(2000);
    expect(sanitizeInput(longText).length).toBe(1000);
  });
});

describe('Validación de Archivos', () => {
  const ALLOWED_TYPES = ['application/pdf', 'image/jpeg', 'image/png'];
  const MAX_SIZE = 5 * 1024 * 1024; // 5MB

  const validateFile = (file: { type: string; size: number }): { valid: boolean; error?: string } => {
    if (!ALLOWED_TYPES.includes(file.type)) {
      return { valid: false, error: 'Tipo de archivo no permitido' };
    }
    if (file.size > MAX_SIZE) {
      return { valid: false, error: 'El archivo excede el tamaño máximo de 5MB' };
    }
    return { valid: true };
  };

  it('debería aceptar archivos PDF', () => {
    expect(validateFile({ type: 'application/pdf', size: 1024 }).valid).toBe(true);
  });

  it('debería aceptar imágenes JPEG y PNG', () => {
    expect(validateFile({ type: 'image/jpeg', size: 1024 }).valid).toBe(true);
    expect(validateFile({ type: 'image/png', size: 1024 }).valid).toBe(true);
  });

  it('debería rechazar tipos de archivo no permitidos', () => {
    const result = validateFile({ type: 'application/exe', size: 1024 });
    expect(result.valid).toBe(false);
    expect(result.error).toBe('Tipo de archivo no permitido');
  });

  it('debería rechazar archivos muy grandes', () => {
    const result = validateFile({ type: 'application/pdf', size: 10 * 1024 * 1024 });
    expect(result.valid).toBe(false);
    expect(result.error).toContain('5MB');
  });
});

describe('Validación de Campos de Vacante', () => {
  const validateJob = (job: {
    title: string;
    company: string;
    location: string;
    salary: string;
    description: string;
  }): { valid: boolean; errors: string[] } => {
    const errors: string[] = [];

    if (!job.title || job.title.length < 3) {
      errors.push('El título debe tener al menos 3 caracteres');
    }
    if (!job.company || job.company.length < 2) {
      errors.push('El nombre de empresa es requerido');
    }
    if (!job.location) {
      errors.push('La ubicación es requerida');
    }
    if (!job.salary) {
      errors.push('El salario es requerido');
    }
    if (!job.description || job.description.length < 50) {
      errors.push('La descripción debe tener al menos 50 caracteres');
    }

    return { valid: errors.length === 0, errors };
  };

  it('debería aceptar vacante válida', () => {
    const job = {
      title: 'Desarrollador Full Stack',
      company: 'Tech Corp',
      location: 'CDMX',
      salary: '$30,000 - $45,000',
      description: 'Buscamos un desarrollador con experiencia en React y Node.js para unirse a nuestro equipo de desarrollo.',
    };
    expect(validateJob(job).valid).toBe(true);
  });

  it('debería rechazar vacante con título muy corto', () => {
    const job = {
      title: 'De',
      company: 'Tech Corp',
      location: 'CDMX',
      salary: '$30,000',
      description: 'a'.repeat(50),
    };
    const result = validateJob(job);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('El título debe tener al menos 3 caracteres');
  });

  it('debería rechazar vacante con descripción muy corta', () => {
    const job = {
      title: 'Developer',
      company: 'Tech Corp',
      location: 'CDMX',
      salary: '$30,000',
      description: 'Corta',
    };
    const result = validateJob(job);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('La descripción debe tener al menos 50 caracteres');
  });
});
