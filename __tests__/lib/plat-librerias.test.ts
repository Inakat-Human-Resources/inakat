// RUTA: __tests__/lib/plat-librerias.test.ts
//
// Auditoría 2026-09 — documento «plat»: fichas que viven en src/lib y en los
// componentes compartidos.

import * as fs from 'fs';
import * as path from 'path';

import {
  loginSchema,
  companyRequestSchema,
  contactMessageSchema,
  PASSWORD_MIN_LENGTH,
} from '@/lib/validations';
import { getPaginationParams } from '@/lib/pagination';
import { normalizeUrl } from '@/lib/utils';
import { esIpNoPublica, motivoUrlWebhookInvalida } from '@/lib/worky2-webhook';

const leer = (rel: string) => fs.readFileSync(path.join(process.cwd(), rel), 'utf-8');

// ============================================================
// PLAT-005 — el login aplicaba la política de contraseña
// ============================================================

describe('PLAT-005 · loginSchema sólo exige presencia', () => {
  it('acepta la contraseña de 6 caracteres que crea el admin', () => {
    const r = loginSchema.safeParse({ email: 'reclu@inakat.com', password: 'reclu1' });
    expect(r.success).toBe(true);
  });

  it('sigue rechazando la contraseña vacía', () => {
    const r = loginSchema.safeParse({ email: 'reclu@inakat.com', password: '' });
    expect(r.success).toBe(false);
  });

  it('exporta PASSWORD_MIN_LENGTH = 8 para unificar la política de alta', () => {
    expect(PASSWORD_MIN_LENGTH).toBe(8);
  });
});

// ============================================================
// PLAT-006 — el registro de empresa rechazaba el payload del formulario
// ============================================================

describe('PLAT-006 · companyRequestSchema acepta lo que manda el formulario', () => {
  const base = {
    nombre: 'Ana',
    apellidoPaterno: 'García',
    apellidoMaterno: 'López',
    nombreEmpresa: 'Mi Empresa',
    correoEmpresa: 'rh@miempresa.com',
    razonSocial: 'Mi Empresa S.A. de C.V.',
    rfc: 'XAXX010101AAA',
    direccionEmpresa: 'Av. Siempre Viva 742, Monterrey',
    identificacionUrl: 'https://x.public.blob.vercel-storage.com/ine.pdf',
    documentosConstitucionUrl: 'https://x.public.blob.vercel-storage.com/acta.pdf',
  };

  it('acepta el payload EXACTO del formulario con sitioWeb: null', () => {
    const r = companyRequestSchema.safeParse({ ...base, sitioWeb: null });
    expect(r.success).toBe(true);
  });

  it('acepta una URL sin protocolo como la valida el front (www.x.com)', () => {
    const r = companyRequestSchema.safeParse({ ...base, sitioWeb: 'www.miempresa.com' });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.sitioWeb).toBe('https://www.miempresa.com');
  });

  it('PLAT-001: sigue rechazando javascript: en las URLs guardadas', () => {
    expect(
      companyRequestSchema.safeParse({ ...base, identificacionUrl: 'javascript:alert(1)' }).success
    ).toBe(false);
  });
});

// ============================================================
// PLAT-033 — sin longitudes máximas en un endpoint público
// ============================================================

describe('PLAT-033 · longitudes máximas', () => {
  const contacto = {
    nombre: 'Ana',
    email: 'ana@empresa.com',
    mensaje: 'Mensaje suficientemente largo para pasar.',
  };

  it('rechaza un mensaje de 4 MB', () => {
    const r = contactMessageSchema.safeParse({ ...contacto, mensaje: 'a'.repeat(4_000_000) });
    expect(r.success).toBe(false);
  });

  it('rechaza un nombre desmedido', () => {
    const r = contactMessageSchema.safeParse({ ...contacto, nombre: 'a'.repeat(500) });
    expect(r.success).toBe(false);
  });

  it('rechaza una dirección de empresa desmedida', () => {
    const r = companyRequestSchema.safeParse({
      nombre: 'Ana',
      apellidoPaterno: 'García',
      apellidoMaterno: 'López',
      nombreEmpresa: 'Mi Empresa',
      correoEmpresa: 'rh@miempresa.com',
      razonSocial: 'Mi Empresa S.A. de C.V.',
      rfc: 'XAXX010101AAA',
      direccionEmpresa: 'a'.repeat(5000),
    });
    expect(r.success).toBe(false);
  });
});

// ============================================================
// PLAT-010 — el placeholder sugería un formato que la API rechazaba
// ============================================================

describe('PLAT-010 · el teléfono se normaliza antes de validarlo', () => {
  const base = {
    nombre: 'Ana',
    email: 'ana@empresa.com',
    mensaje: 'Mensaje suficientemente largo para pasar.',
  };

  it.each([
    '+52 811 123 4567',
    '811-123-4567',
    '(811) 123 4567',
    '8112345678',
  ])('acepta %s', (telefono) => {
    expect(contactMessageSchema.safeParse({ ...base, telefono }).success).toBe(true);
  });

  it('sigue rechazando un teléfono que no son 10 dígitos', () => {
    expect(contactMessageSchema.safeParse({ ...base, telefono: '123 45' }).success).toBe(false);
  });
});

// ============================================================
// PLAT-009 — SSRF en la URL del webhook saliente
// ============================================================

describe('PLAT-009 · validación anti-SSRF de la URL del webhook', () => {
  it.each([
    '127.0.0.1',
    '10.0.0.5',
    '172.16.3.1',
    '192.168.1.1',
    '169.254.169.254',
    '100.64.0.1',
    '0.0.0.0',
    '::1',
    'fd00::1',
    'fe80::1',
    '::ffff:127.0.0.1',
  ])('esIpNoPublica(%s) es true', (ip) => {
    expect(esIpNoPublica(ip)).toBe(true);
  });

  it.each(['8.8.8.8', '104.18.32.1', '2606:4700::1'])('esIpNoPublica(%s) es false', (ip) => {
    expect(esIpNoPublica(ip)).toBe(false);
  });

  it('rechaza localhost y la IP de metadatos de la nube', () => {
    expect(motivoUrlWebhookInvalida('http://localhost:3000/hook')).toBeTruthy();
    expect(motivoUrlWebhookInvalida('http://169.254.169.254/latest/meta-data')).toBeTruthy();
    expect(motivoUrlWebhookInvalida('https://127.0.0.1/hook')).toBeTruthy();
  });

  it('rechaza credenciales embebidas y puertos no estándar', () => {
    expect(motivoUrlWebhookInvalida('https://user:pass@worky2.com/hook')).toBeTruthy();
    expect(motivoUrlWebhookInvalida('https://worky2.com:9200/hook')).toBeTruthy();
  });

  it('rechaza esquemas que no son http(s)', () => {
    expect(motivoUrlWebhookInvalida('javascript:alert(1)')).toBeTruthy();
    expect(motivoUrlWebhookInvalida('file:///etc/passwd')).toBeTruthy();
  });

  it('acepta una URL pública https normal', () => {
    expect(motivoUrlWebhookInvalida('https://worky2.com/inakat/webhook')).toBeNull();
  });

  it('el despacho no sigue redirecciones (307/308 reenviaría la PII)', () => {
    const c = leer('src/lib/worky2-webhook.ts');
    expect(c).toContain("redirect: 'error'");
  });

  it('revalida la URL justo antes de enviar (DNS rebinding)', () => {
    const c = leer('src/lib/worky2-webhook.ts');
    expect(c).toMatch(/await motivoUrlWebhookInvalidaConDns\(webhook\.url\)/);
  });
});

// ============================================================
// PLAT-013 — sanitizeText destruía texto legítimo
// ============================================================

describe('PLAT-013 · sanitizeText ya no mutila texto plano', () => {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { sanitizeText } = require('@/lib/sanitize');

  it('conserva la nota de evaluación del escenario de la ficha', () => {
    const nota = 'JavaScript: avanzado. Experiencia React < 2 anios, Node > 3 anios';
    expect(sanitizeText(nota)).toBe(nota);
  });

  it('sigue quitando tags HTML reales', () => {
    expect(sanitizeText('<b>hola</b> <img src=x onerror=alert(1)> mundo')).toBe('hola  mundo');
  });
});

// ============================================================
// PLAT-030 — getPaginationParams propagaba NaN a Prisma
// ============================================================

describe('PLAT-030 · getPaginationParams nunca devuelve NaN', () => {
  it('page=abc y limit=xyz caen a los valores por defecto', () => {
    const r = getPaginationParams(new URLSearchParams('page=abc&limit=xyz'));
    expect(r.page).toBe(1);
    expect(r.limit).toBe(20);
    expect(r.skip).toBe(0);
    expect(r.take).toBe(20);
  });

  it('una página absurda no desborda el Int32 de skip', () => {
    const r = getPaginationParams(new URLSearchParams('page=99999999999999'));
    expect(Number.isSafeInteger(r.skip)).toBe(true);
    expect(r.skip).toBeLessThan(2 ** 31);
  });

  it('valores negativos se saturan al mínimo', () => {
    const r = getPaginationParams(new URLSearchParams('page=-5&limit=-10'));
    expect(r.page).toBe(1);
    expect(r.limit).toBe(1);
  });
});

// ============================================================
// PLAT-032 — normalizeUrl distinguía mayúsculas
// ============================================================

describe('PLAT-032 · normalizeUrl', () => {
  it('no duplica el protocolo cuando el móvil autocapitaliza', () => {
    expect(normalizeUrl('Https://www.linkedin.com/in/ana')).toBe(
      'https://www.linkedin.com/in/ana'
    );
    expect(normalizeUrl('HTTP://example.com')).toBe('http://example.com');
  });

  it('hace trim antes de decidir', () => {
    expect(normalizeUrl('  https://example.com  ')).toBe('https://example.com');
  });

  it('respeta las rutas relativas de /api/upload en desarrollo', () => {
    expect(normalizeUrl('/uploads/cv.pdf')).toBe('/uploads/cv.pdf');
  });

  it('sigue completando las URLs sin protocolo', () => {
    expect(normalizeUrl('linkedin.com/in/ana')).toBe('https://linkedin.com/in/ana');
  });

  it('cadena vacía o sólo espacios → undefined', () => {
    expect(normalizeUrl('   ')).toBeUndefined();
    expect(normalizeUrl(null)).toBeUndefined();
  });
});

// ============================================================
// Fichas verificadas sobre el código fuente
// ============================================================

describe('PLAT-016/017 · secretos y topes de la gestión de integraciones', () => {
  const webhooks = () => leer('src/app/api/integration/webhooks/route.ts');
  const keys = () => leer('src/app/api/integration/keys/route.ts');

  it('PLAT-016: la máscara del secreto no depende de su contenido', () => {
    const c = webhooks();
    expect(c).not.toMatch(/secret\.slice\(/);
    expect(c).not.toMatch(/secret\.length/);
    // Y el listado ya no saca el secreto de la base
    expect(c).toMatch(/maskSecret\(\)/);
  });

  it('PLAT-017: hay tope de webhooks activos y rate limit al crear', () => {
    const c = webhooks();
    expect(c).toMatch(/integrationWebhook\.count\(/);
    expect(c).toMatch(/MAX_WEBHOOKS_ACTIVOS/);
    expect(c).toMatch(/applyRateLimit\(request, 'integration-manage'/);
  });

  it('PLAT-017: hay tope de API keys activas y rate limit al crear', () => {
    const c = keys();
    expect(c).toMatch(/integrationApiKey\.count\(/);
    expect(c).toMatch(/MAX_KEYS_ACTIVAS/);
    expect(c).toMatch(/applyRateLimit\(request, 'integration-manage'/);
  });

  it('PLAT-015: el rate limit funcional es por API key, no por IP', () => {
    const c = leer('src/app/api/integration/candidates/route.ts');
    expect(c).toMatch(/checkRateLimit\(\s*`integration-key:\$\{auth\.apiKey\.id\}`/);
  });
});

describe('PLAT-011 · los correos a la empresa se envían de verdad', () => {
  it('PATCH company-requests/[id] llama a sendCompanyApproved y sendCompanyRejected', () => {
    const c = leer('src/app/api/company-requests/[id]/route.ts');
    expect(c).toMatch(/sendCompanyApproved\(\{/);
    expect(c).toMatch(/sendCompanyRejected\(\{/);
    expect(c).toContain('Promise.allSettled');
  });

  it('la plantilla de aprobación ya no exige mandar la contraseña', () => {
    const c = leer('src/lib/email.ts');
    expect(c).toMatch(/password\?: string/);
  });
});

describe('PLAT-028 · transporter SMTP con timeouts y resultado comprobado', () => {
  it('el transporter declara los tres timeouts', () => {
    const c = leer('src/lib/email.ts');
    expect(c).toMatch(/connectionTimeout: \d+/);
    expect(c).toMatch(/greetingTimeout: \d+/);
    expect(c).toMatch(/socketTimeout: \d+/);
  });

  it('forgot-password registra cuando el correo no sale', () => {
    const c = leer('src/app/api/auth/forgot-password/route.ts');
    // Da igual qué helper concreto se use: lo que importa es que el resultado
    // del envío se comprueba en vez de ignorarse.
    expect(c).toMatch(/const enviado = await send\w*\(/);
    expect(c).toMatch(/if \(!enviado\)/);
  });
});

describe('PLAT-031 · src/lib/test-helpers.ts era código muerto', () => {
  it('ya no existe dentro del árbol de producción', () => {
    expect(fs.existsSync(path.join(process.cwd(), 'src/lib/test-helpers.ts'))).toBe(false);
  });
});

describe('PLAT-023/024 · componentes compartidos', () => {
  it('PLAT-023: CompanyLogo cae al icono de edificio si la imagen falla', () => {
    const c = leer('src/components/shared/CompanyLogo.tsx');
    expect(c).toMatch(/onError=\{\(\) => setUrlFallida\(logoUrl\)\}/);
    expect(c).toMatch(/urlFallida !== logoUrl/);
  });

  it('PLAT-024: ErrorToast cancela el temporizador de cierre en el cleanup', () => {
    // ErrorToast es ahora un puente hacia el Toast del sistema de diseño, que
    // guarda el temporizador de salida y lo cancela en el cleanup.
    expect(leer('src/components/shared/ErrorToast.tsx')).toContain("from '@/components/ui/Toast'");
    const c = leer('src/components/ui/Toast.tsx');
    expect(c).toMatch(/cierreRef/);
    expect(c).toMatch(/clearTimeout\(cierreRef\.current\)/);
    expect(c).toMatch(/return cancelarCierre;/);
  });
});

describe('PLAT-008 · pantalla de Integraciones de la empresa', () => {
  it('existe la página y consume las rutas reales con la cookie de sesión', () => {
    const ruta = 'src/app/company/integrations/page.tsx';
    expect(fs.existsSync(path.join(process.cwd(), ruta))).toBe(true);
    const c = leer(ruta);
    expect(c).toContain('/api/integration/keys');
    expect(c).toContain('/api/integration/webhooks');
    expect(c).toMatch(/credentials: 'include'/);
  });

  it('está enlazada desde la navegación de la empresa', () => {
    // La navegación por rol vive en src/lib/nav-app.ts (la pinta el AppShell).
    const c = leer('src/lib/nav-app.ts');
    const empresa = c.slice(c.indexOf('company: ['), c.indexOf('candidate: ['));
    expect(empresa).toContain("href: '/company/integrations'");
  });
});
