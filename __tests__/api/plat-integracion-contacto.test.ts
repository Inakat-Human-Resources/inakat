/**
 * @jest-environment node
 */

// RUTA: __tests__/api/plat-integracion-contacto.test.ts
//
// Auditoría 2026-09 — documento «plat» (integración Worky2, notificaciones,
// correo y librerías). Un describe por ficha.

export {};

jest.mock('@/lib/prisma', () => ({
  prisma: {
    contactMessage: { create: jest.fn(), findMany: jest.fn(), count: jest.fn() },
    notification: { findMany: jest.fn(), count: jest.fn(), updateMany: jest.fn() },
    user: { findMany: jest.fn(), findUnique: jest.fn() },
    integrationApiKey: { findUnique: jest.fn(), update: jest.fn() },
    application: { findMany: jest.fn(), count: jest.fn() },
    candidate: { findMany: jest.fn() },
  },
}));

jest.mock('@/lib/email', () => {
  const real = jest.requireActual('@/lib/email');
  return {
    ...real,
    sendEmail: jest.fn(async () => true),
    sendContactMessageToAdmin: jest.fn(async () => true),
  };
});

jest.mock('@/lib/auth', () => ({
  requireRole: jest.fn(),
  requireAuth: jest.fn(),
}));

import * as fs from 'fs';
import * as path from 'path';
import { prisma } from '@/lib/prisma';
import { sendContactMessageToAdmin } from '@/lib/email';
import { requireRole, requireAuth } from '@/lib/auth';

const leer = (rel: string) => fs.readFileSync(path.join(process.cwd(), rel), 'utf-8');

const mockPrisma = prisma as unknown as {
  contactMessage: { create: jest.Mock; findMany: jest.Mock; count: jest.Mock };
  notification: { findMany: jest.Mock; count: jest.Mock; updateMany: jest.Mock };
  user: { findMany: jest.Mock; findUnique: jest.Mock };
  integrationApiKey: { findUnique: jest.Mock; update: jest.Mock };
  application: { findMany: jest.Mock; count: jest.Mock };
  candidate: { findMany: jest.Mock };
};

function req(url: string, init: { method?: string; body?: unknown; headers?: Record<string, string> } = {}): Request {
  return {
    url,
    method: init.method ?? 'GET',
    headers: new Headers(init.headers ?? {}),
    json: async () => {
      if (init.body === undefined) throw new SyntaxError('sin cuerpo');
      return init.body;
    },
  } as unknown as Request;
}

beforeEach(() => {
  jest.clearAllMocks();
  process.env.ADMIN_EMAIL = 'avisos@inakat.com';
});

// ============================================================
// PLAT-002 — el mensaje de contacto se guardaba y nadie lo leía
// ============================================================

describe('PLAT-002 · POST /api/contact avisa al admin', () => {
  it('envía un correo al buzón interno con los datos del lead', async () => {
    mockPrisma.contactMessage.create.mockResolvedValue({ id: 7 });
    mockPrisma.user.findMany.mockResolvedValue([]);

    const { POST } = await import('@/app/api/contact/route');
    const res = await POST(
      req('http://localhost/api/contact', {
        method: 'POST',
        body: {
          nombre: 'Ana RH',
          email: 'ana@empresa.com',
          telefono: '8112345678',
          mensaje: 'Queremos contratar reclutamiento para 5 vacantes.',
        },
      })
    );

    expect(res.status).toBe(201);
    expect(mockPrisma.contactMessage.create).toHaveBeenCalledTimes(1);
    expect(sendContactMessageToAdmin).toHaveBeenCalledTimes(1);

    const params = (sendContactMessageToAdmin as jest.Mock).mock.calls[0][0];
    expect(params.adminEmail).toBe('avisos@inakat.com');
    expect(params.email).toBe('ana@empresa.com');
    expect(params.mensaje).toContain('5 vacantes');
  });

  it('responde 201 aunque el correo falle: el lead ya está guardado', async () => {
    mockPrisma.contactMessage.create.mockResolvedValue({ id: 8 });
    mockPrisma.user.findMany.mockResolvedValue([]);
    (sendContactMessageToAdmin as jest.Mock).mockRejectedValueOnce(new Error('SMTP caído'));

    const { POST } = await import('@/app/api/contact/route');
    const res = await POST(
      req('http://localhost/api/contact', {
        method: 'POST',
        body: {
          nombre: 'Ana RH',
          email: 'ana@empresa.com',
          mensaje: 'Queremos contratar reclutamiento para 5 vacantes.',
        },
      })
    );

    expect(res.status).toBe(201);
  });

  it('no devuelve la fila creada (el id revelaba el volumen de leads)', async () => {
    mockPrisma.contactMessage.create.mockResolvedValue({ id: 999, nombre: 'Ana RH' });
    mockPrisma.user.findMany.mockResolvedValue([]);

    const { POST } = await import('@/app/api/contact/route');
    const res = await POST(
      req('http://localhost/api/contact', {
        method: 'POST',
        body: {
          nombre: 'Ana RH',
          email: 'ana@empresa.com',
          mensaje: 'Queremos contratar reclutamiento para 5 vacantes.',
        },
      })
    );

    const cuerpo = await res.json();
    expect(cuerpo.data).toBeUndefined();
    expect(cuerpo.success).toBe(true);
  });
});

describe('PLAT-002 · GET /api/admin/contact-messages', () => {
  it('rechaza a quien no es admin', async () => {
    (requireRole as jest.Mock).mockResolvedValue({ error: 'Acceso denegado', status: 403 });

    const { GET } = await import('@/app/api/admin/contact-messages/route');
    const res = await GET(req('http://localhost/api/admin/contact-messages'));

    expect(res.status).toBe(403);
    expect(mockPrisma.contactMessage.findMany).not.toHaveBeenCalled();
  });

  it('devuelve los mensajes paginados y ordenados por fecha descendente', async () => {
    (requireRole as jest.Mock).mockResolvedValue({ user: { id: 1, role: 'admin' } });
    mockPrisma.contactMessage.findMany.mockResolvedValue([{ id: 2 }, { id: 1 }]);
    mockPrisma.contactMessage.count.mockResolvedValue(42);

    const { GET } = await import('@/app/api/admin/contact-messages/route');
    const res = await GET(req('http://localhost/api/admin/contact-messages?page=2&limit=10'));
    const cuerpo = await res.json();

    expect(res.status).toBe(200);
    expect(requireRole).toHaveBeenCalledWith('admin');

    const args = mockPrisma.contactMessage.findMany.mock.calls[0][0];
    expect(args.orderBy).toEqual({ createdAt: 'desc' });
    expect(args.skip).toBe(10);
    expect(args.take).toBe(10);

    expect(cuerpo.pagination.total).toBe(42);
    expect(cuerpo.data).toHaveLength(2);
  });

  it('normaliza page inválido en vez de romper con 500', async () => {
    (requireRole as jest.Mock).mockResolvedValue({ user: { id: 1, role: 'admin' } });
    mockPrisma.contactMessage.findMany.mockResolvedValue([]);
    mockPrisma.contactMessage.count.mockResolvedValue(0);

    const { GET } = await import('@/app/api/admin/contact-messages/route');
    const res = await GET(req('http://localhost/api/admin/contact-messages?page=abc'));

    expect(res.status).toBe(200);
    const args = mockPrisma.contactMessage.findMany.mock.calls[0][0];
    expect(args.skip).toBe(0);
    expect(Number.isFinite(args.take)).toBe(true);
  });
});

// ============================================================
// PLAT-003 — la API key sobrevivía al soft-delete de la empresa
// ============================================================

describe('PLAT-003 · requireApiKey comprueba al usuario dueño', () => {
  const KEY = `inak_${'a'.repeat(32)}`;

  const pedir = async () => {
    const { requireApiKey } = await import('@/lib/integration-auth');
    return requireApiKey(req('http://localhost/api/integration/candidates', {
      headers: { 'x-api-key': KEY },
    }));
  };

  it('acepta la key de una empresa activa', async () => {
    mockPrisma.integrationApiKey.findUnique.mockResolvedValue({
      id: 3, userId: 9, name: 'Worky2', isActive: true,
      user: { isActive: true, role: 'company' },
    });
    mockPrisma.integrationApiKey.update.mockResolvedValue({});

    const r = await pedir();
    expect('apiKey' in r).toBe(true);
  });

  it('rechaza la key si la empresa dueña fue desactivada (soft delete)', async () => {
    mockPrisma.integrationApiKey.findUnique.mockResolvedValue({
      id: 3, userId: 9, name: 'Worky2', isActive: true,
      user: { isActive: false, role: 'company' },
    });

    const r = await pedir();
    expect('error' in r && r.status).toBe(401);
  });

  it('rechaza la key si el usuario dejó de ser company', async () => {
    mockPrisma.integrationApiKey.findUnique.mockResolvedValue({
      id: 3, userId: 9, name: 'Worky2', isActive: true,
      user: { isActive: true, role: 'user' },
    });

    const r = await pedir();
    expect('error' in r && r.status).toBe(401);
  });

  it('la consulta incluye el estado del dueño', async () => {
    mockPrisma.integrationApiKey.findUnique.mockResolvedValue(null);
    await pedir();

    const args = mockPrisma.integrationApiKey.findUnique.mock.calls[0][0];
    expect(args.select.user).toEqual({ select: { isActive: true, role: true } });
  });
});

// ============================================================
// PLAT-007 — el webhook se disparaba con `void` y se perdía
// ============================================================

describe('PLAT-007 · dispatchCandidateAccepted no se invoca con `void`', () => {
  const callers = [
    'src/app/api/company/applications/[id]/route.ts',
    'src/app/api/applications/[id]/route.ts',
  ];

  it.each(callers)('%s usa after() de next/server', (archivo) => {
    const c = leer(archivo);
    expect(c).toMatch(/after\(\(\) => dispatchCandidateAccepted\(/);
    expect(c).not.toMatch(/void dispatchCandidateAccepted\(/);
    expect(c).toMatch(/import \{[^}]*\bafter\b[^}]*\} from 'next\/server'/);
  });
});

// ============================================================
// PLAT-012 — N+1 con ILIKE y sin paginación
// ============================================================

describe('PLAT-012 · loadCandidatosAceptados hace una sola consulta de perfiles', () => {
  const app = (id: number, email: string) => ({
    id,
    candidateEmail: email,
    candidateName: 'Juan Pérez López',
    candidatePhone: null,
    cvUrl: null,
    notes: 'NOTA INTERNA: pide 20% más de sueldo',
    reviewedAt: new Date('2026-09-01'),
    updatedAt: new Date('2026-09-01'),
    job: { id: 1, title: 'Dev', userId: 9, salaryMin: 100, salaryMax: 200 },
    evaluationNotes: [],
    skillRatings: [],
  });

  it('resuelve N aplicaciones con 1 candidate.findMany (no N findFirst)', async () => {
    mockPrisma.application.findMany.mockResolvedValue([
      app(1, 'a@x.com'), app(2, 'b@x.com'), app(3, 'A@X.com'),
    ]);
    mockPrisma.application.count.mockResolvedValue(3);
    mockPrisma.candidate.findMany.mockResolvedValue([]);

    const { loadCandidatosAceptados } = await import('@/lib/integration-candidate');
    const { candidatos, total } = await loadCandidatosAceptados(9);

    expect(mockPrisma.candidate.findMany).toHaveBeenCalledTimes(1);
    const where = mockPrisma.candidate.findMany.mock.calls[0][0].where;
    // Emails deduplicados en minúsculas, en un único `in`
    expect(where.email.in.sort()).toEqual(['a@x.com', 'b@x.com']);
    expect(candidatos).toHaveLength(3);
    expect(total).toBe(3);
  });

  it('pagina la consulta de aplicaciones (skip/take) y capa el limit', async () => {
    mockPrisma.application.findMany.mockResolvedValue([]);
    mockPrisma.application.count.mockResolvedValue(0);
    mockPrisma.candidate.findMany.mockResolvedValue([]);

    const { loadCandidatosAceptados } = await import('@/lib/integration-candidate');
    await loadCandidatosAceptados(9, { page: 3, limit: 5000 });

    const args = mockPrisma.application.findMany.mock.calls[0][0];
    expect(args.take).toBe(100); // tope duro
    expect(args.skip).toBe(200); // (3-1) * 100
  });

  it('aplica el filtro ?since sobre reviewedAt', async () => {
    mockPrisma.application.findMany.mockResolvedValue([]);
    mockPrisma.application.count.mockResolvedValue(0);
    mockPrisma.candidate.findMany.mockResolvedValue([]);

    const desde = new Date('2026-01-01T00:00:00.000Z');
    const { loadCandidatosAceptados } = await import('@/lib/integration-candidate');
    await loadCandidatosAceptados(9, { since: desde });

    const args = mockPrisma.application.findMany.mock.calls[0][0];
    expect(args.where.reviewedAt).toEqual({ gte: desde });
  });

  it('PLAT-004: no exporta las notas internas de la Application', async () => {
    mockPrisma.application.findMany.mockResolvedValue([app(1, 'a@x.com')]);
    mockPrisma.application.count.mockResolvedValue(1);
    mockPrisma.candidate.findMany.mockResolvedValue([]);

    const { loadCandidatosAceptados } = await import('@/lib/integration-candidate');
    const { candidatos } = await loadCandidatosAceptados(9);

    expect(candidatos[0].notasAdicionales).toBeNull();
    expect(JSON.stringify(candidatos[0])).not.toContain('NOTA INTERNA');
  });
});

// ============================================================
// PLAT-018 — la API de notificaciones devolvía 500 ante entradas raras
// ============================================================

describe('PLAT-018 · /api/notifications valida la entrada', () => {
  beforeEach(() => {
    (requireAuth as jest.Mock).mockResolvedValue({ user: { id: 5, role: 'admin' } });
  });

  it('GET con page=abc responde 200 y no manda NaN a Prisma', async () => {
    mockPrisma.notification.findMany.mockResolvedValue([]);
    mockPrisma.notification.count.mockResolvedValue(0);

    const { GET } = await import('@/app/api/notifications/route');
    const res = await GET(req('http://localhost/api/notifications?page=abc&limit=xyz'));

    expect(res.status).toBe(200);
    const args = mockPrisma.notification.findMany.mock.calls[0][0];
    expect(Number.isFinite(args.skip)).toBe(true);
    expect(Number.isFinite(args.take)).toBe(true);
    expect(args.skip).toBe(0);
  });

  it('GET devuelve unreadTotal sin filtro ni paginación (PLAT-022)', async () => {
    mockPrisma.notification.findMany.mockResolvedValue([]);
    mockPrisma.notification.count
      .mockResolvedValueOnce(3) // total filtrado
      .mockResolvedValueOnce(17); // no leídas totales

    const { GET } = await import('@/app/api/notifications/route');
    const res = await GET(req('http://localhost/api/notifications?filter=read'));
    const cuerpo = await res.json();

    expect(cuerpo.unreadTotal).toBe(17);
    const segundaLlamada = mockPrisma.notification.count.mock.calls[1][0];
    expect(segundaLlamada.where).toEqual({ userId: 5, read: false });
  });

  it('PATCH con cuerpo vacío responde 400, no 500', async () => {
    const { PATCH } = await import('@/app/api/notifications/route');
    const res = await PATCH(req('http://localhost/api/notifications', { method: 'PATCH' }));

    expect(res.status).toBe(400);
    expect(mockPrisma.notification.updateMany).not.toHaveBeenCalled();
  });

  it('PATCH con ids no numéricos responde 400', async () => {
    const { PATCH } = await import('@/app/api/notifications/route');
    const res = await PATCH(
      req('http://localhost/api/notifications', { method: 'PATCH', body: { ids: ['x'] } })
    );

    expect(res.status).toBe(400);
    expect(mockPrisma.notification.updateMany).not.toHaveBeenCalled();
  });

  it('PATCH con cuerpo null responde 400', async () => {
    const { PATCH } = await import('@/app/api/notifications/route');
    const res = await PATCH(
      req('http://localhost/api/notifications', { method: 'PATCH', body: null })
    );

    expect(res.status).toBe(400);
  });

  it('PATCH con más de 100 ids responde 400', async () => {
    const { PATCH } = await import('@/app/api/notifications/route');
    const res = await PATCH(
      req('http://localhost/api/notifications', {
        method: 'PATCH',
        body: { ids: Array.from({ length: 101 }, (_, i) => i + 1) },
      })
    );

    expect(res.status).toBe(400);
  });

  it('PATCH válido con ids marca sólo las del usuario autenticado', async () => {
    mockPrisma.notification.updateMany.mockResolvedValue({ count: 2 });

    const { PATCH } = await import('@/app/api/notifications/route');
    const res = await PATCH(
      req('http://localhost/api/notifications', { method: 'PATCH', body: { ids: [1, 2] } })
    );

    expect(res.status).toBe(200);
    const args = mockPrisma.notification.updateMany.mock.calls[0][0];
    expect(args.where).toEqual({ id: { in: [1, 2] }, userId: 5 });
  });
});
