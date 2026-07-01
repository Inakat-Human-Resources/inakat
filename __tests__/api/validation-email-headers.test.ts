/**
 * @jest-environment node
 */

// RUTA: __tests__/api/validation-email-headers.test.ts
//
// Cubre el bundle de validación + email + headers de la auditoría:
//  #67/#12 escape HTML e inyección de cabeceras CRLF en emails
//  #10/#57 contacto valida formato (no sólo presencia)
//  #11      regex de teléfono acepta el ejemplo documentado y números 52xxxxxxxx

export {};

jest.mock('@/lib/prisma', () => ({
  prisma: { contactMessage: { create: jest.fn() } },
}));

import { escapeHtml, sanitizeEmailHeader } from '@/lib/email';
import { contactMessageSchema } from '@/lib/validations';
import { prisma } from '@/lib/prisma';

const mockPrisma = prisma as unknown as { contactMessage: { create: jest.Mock } };

function makeReq(body: unknown): Request {
  return {
    headers: new Headers(),
    json: async () => body,
  } as unknown as Request;
}

describe('email.ts — escape HTML e inyección de cabeceras (#67/#12)', () => {
  it('escapeHtml neutraliza HTML/atributos', () => {
    expect(escapeHtml('<script>alert(1)</script>')).toBe(
      '&lt;script&gt;alert(1)&lt;/script&gt;'
    );
    expect(escapeHtml('x" onmouseover="y')).toBe('x&quot; onmouseover=&quot;y');
    expect(escapeHtml(null)).toBe('');
    expect(escapeHtml(42)).toBe('42');
  });

  it('sanitizeEmailHeader elimina CR/LF (anti inyección de cabeceras)', () => {
    expect(sanitizeEmailHeader('Asunto\r\nBcc: attacker@evil.com')).toBe(
      'Asunto Bcc: attacker@evil.com'
    );
    expect(sanitizeEmailHeader('normal subject')).toBe('normal subject');
  });
});

describe('contactMessageSchema (#10/#57)', () => {
  it('rechaza email inválido', () => {
    const r = contactMessageSchema.safeParse({
      nombre: 'Juan',
      email: 'no-es-email',
      mensaje: 'Hola, quiero más información sobre el servicio.',
    });
    expect(r.success).toBe(false);
  });

  it('acepta datos válidos', () => {
    const r = contactMessageSchema.safeParse({
      nombre: 'Juan',
      email: 'juan@empresa.com',
      telefono: '5512345678',
      mensaje: 'Hola, quiero más información sobre el servicio.',
    });
    expect(r.success).toBe(true);
  });
});

describe('regex de teléfono (#11)', () => {
  const cases: Array<[string, boolean]> = [
    ['5512345678', true], // 10 dígitos
    ['+525512345678', true], // +52 + 10 dígitos
    ['525512345678', true], // 52 + 10 dígitos
    ['5212345678', true], // 10 dígitos que empiezan por 52 (el bug anterior lo rechazaba)
    ['123', false], // muy corto
    ['abcdefghij', false], // no numérico
  ];
  it.each(cases)('telefono %s -> válido=%s', (telefono, ok) => {
    const r = contactMessageSchema.safeParse({
      nombre: 'Juan',
      email: 'juan@empresa.com',
      telefono,
      mensaje: 'Hola, quiero más información sobre el servicio.',
    });
    expect(r.success).toBe(ok);
  });
});

describe('POST /api/contact — handler real (#10/#57)', () => {
  beforeEach(() => jest.clearAllMocks());

  it('rechaza con 400 un email inválido', async () => {
    const { POST } = await import('@/app/api/contact/route');
    const res = await POST(
      makeReq({ nombre: 'Juan', email: 'no-email', mensaje: 'Mensaje suficientemente largo.' })
    );
    expect(res.status).toBe(400);
    expect(mockPrisma.contactMessage.create).not.toHaveBeenCalled();
  });

  it('acepta con 201 datos válidos', async () => {
    mockPrisma.contactMessage.create.mockResolvedValue({ id: 1 });
    const { POST } = await import('@/app/api/contact/route');
    const res = await POST(
      makeReq({
        nombre: 'Juan',
        email: 'juan@empresa.com',
        mensaje: 'Mensaje suficientemente largo para pasar la validación.',
      })
    );
    expect(res.status).toBe(201);
    expect(mockPrisma.contactMessage.create).toHaveBeenCalledTimes(1);
  });
});
