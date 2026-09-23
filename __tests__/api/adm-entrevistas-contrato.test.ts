// RUTA: __tests__/api/adm-entrevistas-contrato.test.ts

/**
 * Auditoría 2026-09 · módulo admin — /api/admin/interviews
 *
 * ADM-007: `null` en scheduledStart/End se parseaba como 1970-01-01; y la rama
 *          'confirmed' miraba los valores CRUDOS, así que confirmar mandando
 *          null borraba la fecha aunque la comprobación pasara.
 * ADM-008: PATCH y GET devolvían `{ interview }` sin `success`, así que la UI
 *          mostraba "Error al guardar" aunque el cambio se hubiera guardado.
 * ADM-040: meetingUrl y el resto de campos se guardaban sin validar.
 * ADM-041: la promoción de la Application no era transaccional ni respetaba el
 *          estado actual.
 * ADM-043: ?page=abc producía skip NaN y 500.
 * ADM-064: se podían confirmar entrevistas en el pasado.
 */

jest.mock('next/server', () => ({
  NextRequest: class {},
  NextResponse: {
    json: (data: any, options?: any) => ({
      status: options?.status || 200,
      json: async () => data,
    }),
  },
}));

const tx = {
  application: { updateMany: jest.fn() },
  interviewRequest: { update: jest.fn() },
};

jest.mock('@/lib/prisma', () => ({
  prisma: {
    interviewRequest: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
      groupBy: jest.fn(),
      update: jest.fn(),
    },
    application: { update: jest.fn(), updateMany: jest.fn() },
    $transaction: jest.fn(),
  },
}));

// ADM-041/042: el PATCH de entrevistas manda correos; nunca SMTP real en tests.
jest.mock('@/lib/email', () => ({
  sendInterviewUpdate: jest.fn().mockResolvedValue(true),
}));

jest.mock('@/lib/auth', () => ({
  requireRole: jest.fn(),
  requireAuth: jest.fn(),
}));

import { requireRole } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { GET as interviewsGet } from '@/app/api/admin/interviews/route';
import {
  GET as interviewGet,
  PATCH as interviewPatch,
} from '@/app/api/admin/interviews/[id]/route';

const mockRequireRole = requireRole as jest.Mock;
const mockInterview = (prisma as any).interviewRequest;
const mockApplication = (prisma as any).application;
const mockTransaction = (prisma as any).$transaction as jest.Mock;

const ADMIN = { user: { id: 1, email: 'admin@inakat.com', role: 'admin' } };

/** NextRequest simulado: los handlers sólo usan json() y nextUrl.searchParams. */
function pedir(url: string, method = 'GET', body?: any): any {
  return {
    nextUrl: new URL(url),
    json: async () => body,
    headers: new Headers(),
    method,
  };
}

const params = (id: string) => ({ params: Promise.resolve({ id }) });

const EN_UNA_HORA = new Date(Date.now() + 60 * 60 * 1000).toISOString();
const EN_DOS_HORAS = new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString();

const SOLICITUD_PENDIENTE = {
  id: 3,
  applicationId: 20,
  status: 'pending',
  scheduledStart: null,
  scheduledEnd: null,
};

describe('/api/admin/interviews — contrato de respuesta y fechas', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRequireRole.mockResolvedValue(ADMIN);
    tx.application.updateMany.mockReset();
    tx.interviewRequest.update.mockReset();
    tx.interviewRequest.update.mockResolvedValue({ id: 3, status: 'cancelled' });
    mockTransaction.mockImplementation(async (cb: any) => cb(tx));
  });

  describe('ADM-007 · null significa "sin fecha", no 1970', () => {
    it('cancelar una pendiente enviando ambas fechas en null responde 200', async () => {
      mockInterview.findUnique.mockResolvedValue(SOLICITUD_PENDIENTE);

      const res = await interviewPatch(
        pedir('http://localhost/api/admin/interviews/3', 'PATCH', {
          status: 'cancelled',
          scheduledStart: null,
          scheduledEnd: null,
        }),
        params('3')
      );

      expect(res.status).toBe(200);
      const datos = tx.interviewRequest.update.mock.calls[0][0].data;
      expect(datos.scheduledStart).toBeNull();
      expect(datos.scheduledEnd).toBeNull();
    });

    it('confirmar con scheduledStart null y fecha previa en BD no pasa la validación cruda', async () => {
      // Antes: `scheduledStart || existing.scheduledStart` daba por buena la
      // fecha vieja y a la vez escribía null, dejando la entrevista sin horario.
      mockInterview.findUnique.mockResolvedValue({
        ...SOLICITUD_PENDIENTE,
        scheduledStart: new Date(EN_UNA_HORA),
        scheduledEnd: new Date(EN_DOS_HORAS),
      });

      const res = await interviewPatch(
        pedir('http://localhost/api/admin/interviews/3', 'PATCH', {
          status: 'confirmed',
          scheduledStart: null,
          scheduledEnd: null,
        }),
        params('3')
      );

      expect(res.status).toBe(400);
      expect(mockTransaction).not.toHaveBeenCalled();
    });
  });

  describe('ADM-008 · la respuesta lleva success', () => {
    it('PATCH responde success:true y data', async () => {
      mockInterview.findUnique.mockResolvedValue(SOLICITUD_PENDIENTE);

      const res = await interviewPatch(
        pedir('http://localhost/api/admin/interviews/3', 'PATCH', { status: 'cancelled' }),
        params('3')
      );
      const cuerpo = await res.json();

      expect(cuerpo.success).toBe(true);
      expect(cuerpo.data).toBeDefined();
      expect(cuerpo.interview).toBeDefined();
    });

    it('GET por id responde success:true y data', async () => {
      mockInterview.findUnique.mockResolvedValue(SOLICITUD_PENDIENTE);

      const res = await interviewGet(
        pedir('http://localhost/api/admin/interviews/3'),
        params('3')
      );
      const cuerpo = await res.json();

      expect(cuerpo.success).toBe(true);
      expect(cuerpo.data).toBeDefined();
    });

    it('los errores llevan success:false', async () => {
      mockInterview.findUnique.mockResolvedValue(null);

      const res = await interviewPatch(
        pedir('http://localhost/api/admin/interviews/3', 'PATCH', { status: 'cancelled' }),
        params('3')
      );
      const cuerpo = await res.json();

      expect(res.status).toBe(404);
      expect(cuerpo.success).toBe(false);
    });
  });

  describe('ADM-040 / ADM-065 · validación de campos', () => {
    it('rechaza meetingUrl sin protocolo', async () => {
      mockInterview.findUnique.mockResolvedValue(SOLICITUD_PENDIENTE);

      const res = await interviewPatch(
        pedir('http://localhost/api/admin/interviews/3', 'PATCH', {
          meetingUrl: 'meet.google.com/abc-defg-hij',
        }),
        params('3')
      );

      expect(res.status).toBe(400);
      expect(mockTransaction).not.toHaveBeenCalled();
    });

    it('acepta una liga https', async () => {
      mockInterview.findUnique.mockResolvedValue(SOLICITUD_PENDIENTE);

      const res = await interviewPatch(
        pedir('http://localhost/api/admin/interviews/3', 'PATCH', {
          meetingUrl: 'https://meet.google.com/abc-defg-hij',
        }),
        params('3')
      );

      expect(res.status).toBe(200);
    });

    it('rechaza participants no textual en vez de reventar en Prisma', async () => {
      mockInterview.findUnique.mockResolvedValue(SOLICITUD_PENDIENTE);

      const res = await interviewPatch(
        pedir('http://localhost/api/admin/interviews/3', 'PATCH', {
          participants: [{ nombre: 'Ana', email: 'ana@test.com' }],
        }),
        params('3')
      );

      expect(res.status).toBe(400);
    });
  });

  describe('ADM-064 · no se confirman entrevistas pasadas', () => {
    it('rechaza confirmar con una fecha anterior a ahora', async () => {
      mockInterview.findUnique.mockResolvedValue(SOLICITUD_PENDIENTE);
      const ayer = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const ayerMasUnaHora = new Date(Date.now() - 23 * 60 * 60 * 1000).toISOString();

      const res = await interviewPatch(
        pedir('http://localhost/api/admin/interviews/3', 'PATCH', {
          status: 'confirmed',
          scheduledStart: ayer,
          scheduledEnd: ayerMasUnaHora,
        }),
        params('3')
      );

      expect(res.status).toBe(400);
      expect(mockTransaction).not.toHaveBeenCalled();
    });
  });

  describe('ADM-041 · promoción de la Application', () => {
    it('confirmar promueve con updateMany condicionado dentro de la transacción', async () => {
      mockInterview.findUnique.mockResolvedValue(SOLICITUD_PENDIENTE);
      tx.interviewRequest.update.mockResolvedValue({ id: 3, status: 'confirmed' });

      await interviewPatch(
        pedir('http://localhost/api/admin/interviews/3', 'PATCH', {
          status: 'confirmed',
          scheduledStart: EN_UNA_HORA,
          scheduledEnd: EN_DOS_HORAS,
        }),
        params('3')
      );

      expect(tx.application.updateMany).toHaveBeenCalled();
      const llamada = tx.application.updateMany.mock.calls[0][0];
      expect(llamada.where.id).toBe(20);
      expect(llamada.where.status.in).toContain('sent_to_company');
      expect(llamada.where.status.in).not.toContain('accepted');
      expect(llamada.data).toEqual({ status: 'interviewed' });
      // Nunca fuera de la transacción
      expect(mockApplication.update).not.toHaveBeenCalled();
    });

    it('no vuelve a promover si la entrevista ya estaba confirmada', async () => {
      mockInterview.findUnique.mockResolvedValue({
        ...SOLICITUD_PENDIENTE,
        status: 'confirmed',
        scheduledStart: new Date(EN_UNA_HORA),
        scheduledEnd: new Date(EN_DOS_HORAS),
      });
      tx.interviewRequest.update.mockResolvedValue({ id: 3, status: 'confirmed' });

      await interviewPatch(
        pedir('http://localhost/api/admin/interviews/3', 'PATCH', { status: 'confirmed' }),
        params('3')
      );

      expect(tx.application.updateMany).not.toHaveBeenCalled();
    });
  });

  describe('ADM-043 · paginación del listado', () => {
    beforeEach(() => {
      mockInterview.findMany.mockResolvedValue([]);
      mockInterview.count.mockResolvedValue(0);
      mockInterview.groupBy.mockResolvedValue([]);
    });

    it('?page=abc responde 400 en vez de 500 por skip NaN', async () => {
      const res = await interviewsGet(
        pedir('http://localhost/api/admin/interviews?page=abc')
      );

      expect(res.status).toBe(400);
      expect(mockInterview.findMany).not.toHaveBeenCalled();
    });

    it('devuelve conteos globales por estado, no sólo los de la página', async () => {
      mockInterview.groupBy.mockResolvedValue([
        { status: 'pending', _count: { _all: 25 } },
        { status: 'confirmed', _count: { _all: 4 } },
      ]);

      const res = await interviewsGet(pedir('http://localhost/api/admin/interviews'));
      const cuerpo = await res.json();

      expect(cuerpo.counts).toEqual({ pending: 25, confirmed: 4 });
      expect(mockInterview.groupBy).toHaveBeenCalled();
    });

    it('?status admite lista separada por comas', async () => {
      await interviewsGet(
        pedir('http://localhost/api/admin/interviews?status=pending,confirmed')
      );

      const where = mockInterview.findMany.mock.calls[0][0].where;
      expect(where.status).toEqual({ in: ['pending', 'confirmed'] });
    });
  });
});
