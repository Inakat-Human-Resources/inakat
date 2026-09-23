// RUTA: __tests__/api/perf-profile-experience.test.ts

/**
 * Auditoría 2026-09 · módulo perfil — /api/profile/experience
 *
 * PERF-004: la ruta hacía su propia autenticación con verifyToken sin mirar
 *           isActive: un usuario desactivado seguía escribiendo hasta 7 días.
 * PERF-020: el PUT no validaba nada. fechaInicio:null se guardaba como
 *           1970-01-01 y una fecha no parseable devolvía 500.
 * PERF-021: recalculateYearsOfExperience sumaba periodos solapados (dos empleos
 *           simultáneos contaban doble) y contaba hasta hoy las experiencias no
 *           actuales sin fecha de fin.
 */

jest.mock('next/server', () => ({
  NextResponse: {
    json: (data: any, options?: any) => ({
      status: options?.status || 200,
      json: async () => data,
    }),
  },
}));

jest.mock('@/lib/prisma', () => ({
  prisma: {
    candidate: { findFirst: jest.fn(), update: jest.fn() },
    experience: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
  },
}));

jest.mock('@/lib/auth', () => ({ requireAuth: jest.fn() }));

import { requireAuth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { GET, POST } from '@/app/api/profile/experience/route';
import { PUT } from '@/app/api/profile/experience/[id]/route';

const mockRequireAuth = requireAuth as jest.Mock;
const mockCandidate = (prisma as any).candidate;
const mockExperience = (prisma as any).experience;

const params = (id: string) => ({ params: Promise.resolve({ id }) });

function pedir(url: string, method: string, body?: any) {
  return new Request(url, {
    method,
    headers: body ? { 'content-type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
}

/** Años que quedaron guardados tras el recálculo. */
function añosGuardados(): number {
  expect(mockCandidate.update).toHaveBeenCalled();
  const ultima = mockCandidate.update.mock.calls[mockCandidate.update.mock.calls.length - 1][0];
  return ultima.data.añosExperiencia;
}

describe('PERF · /api/profile/experience', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRequireAuth.mockResolvedValue({ user: { id: 1, email: 'c@t.com', role: 'candidate' } });
    mockCandidate.findFirst.mockResolvedValue({ id: 10, userId: 1 });
    mockCandidate.update.mockResolvedValue({ id: 10 });
    mockExperience.create.mockImplementation(async ({ data }: any) => ({ id: 50, ...data }));
    mockExperience.update.mockImplementation(async ({ data }: any) => ({ id: 9, ...data }));
    mockExperience.findUnique.mockResolvedValue({
      id: 9,
      candidateId: 10,
      empresa: 'ACME',
      puesto: 'Dev',
      fechaInicio: new Date('2020-01-01'),
      fechaFin: new Date('2022-01-01'),
      esActual: false,
    });
    mockExperience.findMany.mockResolvedValue([]);
  });

  describe('PERF-010 · años recalculados', () => {
    it('GET devuelve añosExperiencia junto a la lista para que /profile no lo pise', async () => {
      mockCandidate.findFirst.mockResolvedValue({ id: 10, userId: 1, añosExperiencia: 6 });
      mockExperience.findMany.mockResolvedValue([{ id: 1 }]);

      const res = await GET();
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.data).toEqual([{ id: 1 }]);
      expect(json.añosExperiencia).toBe(6);
    });
  });

  describe('PERF-004 · isActive', () => {
    it('POST rechaza a un usuario desactivado', async () => {
      mockRequireAuth.mockResolvedValue({ error: 'Usuario no encontrado o desactivado', status: 403 });

      const res = await POST(pedir('http://localhost/api/profile/experience', 'POST', {
        empresa: 'ACME', puesto: 'Dev', fechaInicio: '2020-01-01', esActual: true,
      }));

      expect(res.status).toBe(403);
      expect(mockExperience.create).not.toHaveBeenCalled();
    });

    it('PUT rechaza a un usuario desactivado', async () => {
      mockRequireAuth.mockResolvedValue({ error: 'Usuario no encontrado o desactivado', status: 403 });

      const res = await PUT(pedir('http://localhost/api/profile/experience/9', 'PUT', { empresa: 'X' }), params('9'));

      expect(res.status).toBe(403);
      expect(mockExperience.update).not.toHaveBeenCalled();
    });
  });

  describe('PERF-020 · validación', () => {
    it('POST con fecha no parseable responde 400, no 500', async () => {
      const res = await POST(pedir('http://localhost/api/profile/experience', 'POST', {
        empresa: 'ACME', puesto: 'Dev', fechaInicio: 'abc',
      }));

      expect(res.status).toBe(400);
      expect(mockExperience.create).not.toHaveBeenCalled();
    });

    it('POST exige fecha de fin si no es el trabajo actual', async () => {
      const res = await POST(pedir('http://localhost/api/profile/experience', 'POST', {
        empresa: 'ACME', puesto: 'Dev', fechaInicio: '2015-01-01', esActual: false,
      }));

      expect(res.status).toBe(400);
      expect(mockExperience.create).not.toHaveBeenCalled();
    });

    it('POST rechaza una fecha de inicio futura', async () => {
      const res = await POST(pedir('http://localhost/api/profile/experience', 'POST', {
        empresa: 'ACME', puesto: 'Dev', fechaInicio: '2999-01-01', esActual: true,
      }));

      expect(res.status).toBe(400);
    });

    it('POST guarda una experiencia válida', async () => {
      const res = await POST(pedir('http://localhost/api/profile/experience', 'POST', {
        empresa: '  ACME  ', puesto: 'Dev', fechaInicio: '2020-03-01', fechaFin: '2022-09-01', esActual: false,
      }));

      expect(res.status).toBe(200);
      const data = mockExperience.create.mock.calls[0][0].data;
      expect(data.empresa).toBe('ACME');
      expect(data.fechaInicio).toBeInstanceOf(Date);
      expect(data.fechaFin).toBeInstanceOf(Date);
    });

    it('PUT con fechaInicio null responde 400 (antes se guardaba 1970)', async () => {
      const res = await PUT(
        pedir('http://localhost/api/profile/experience/9', 'PUT', { fechaInicio: null, esActual: true }),
        params('9')
      );

      expect(res.status).toBe(400);
      expect(mockExperience.update).not.toHaveBeenCalled();
    });

    it('PUT rechaza empresa vacía', async () => {
      const res = await PUT(
        pedir('http://localhost/api/profile/experience/9', 'PUT', { empresa: '' }),
        params('9')
      );

      expect(res.status).toBe(400);
      expect(mockExperience.update).not.toHaveBeenCalled();
    });

    it('PUT rechaza puesto vacío', async () => {
      const res = await PUT(
        pedir('http://localhost/api/profile/experience/9', 'PUT', { puesto: '   ' }),
        params('9')
      );

      expect(res.status).toBe(400);
    });

    it('PUT rechaza una descripción desmesurada', async () => {
      const res = await PUT(
        pedir('http://localhost/api/profile/experience/9', 'PUT', { descripcion: 'x'.repeat(3001) }),
        params('9')
      );

      expect(res.status).toBe(400);
    });

    it('PUT acepta un cambio válido', async () => {
      const res = await PUT(
        pedir('http://localhost/api/profile/experience/9', 'PUT', { puesto: 'Tech Lead' }),
        params('9')
      );

      expect(res.status).toBe(200);
      expect(mockExperience.update.mock.calls[0][0].data.puesto).toBe('Tech Lead');
    });
  });

  describe('PERF-021 · recálculo de años de experiencia', () => {
    it('no cuenta dos veces dos empleos simultáneos', async () => {
      // Dos empleos en paralelo de 2016-01 a 2022-01 = 6 años, no 12.
      mockExperience.findMany.mockResolvedValue([
        { fechaInicio: new Date('2016-01-15'), fechaFin: new Date('2022-01-15'), esActual: false },
        { fechaInicio: new Date('2016-01-15'), fechaFin: new Date('2022-01-15'), esActual: false },
      ]);

      await POST(pedir('http://localhost/api/profile/experience', 'POST', {
        empresa: 'ACME', puesto: 'Dev', fechaInicio: '2016-01-15', fechaFin: '2022-01-15', esActual: false,
      }));

      expect(añosGuardados()).toBe(6);
    });

    it('fusiona periodos que se solapan parcialmente', async () => {
      // 2010-2014 y 2013-2018 => 2010-2018 = 8 años (no 4 + 5 = 9).
      mockExperience.findMany.mockResolvedValue([
        { fechaInicio: new Date('2013-01-15'), fechaFin: new Date('2018-01-15'), esActual: false },
        { fechaInicio: new Date('2010-01-15'), fechaFin: new Date('2014-01-15'), esActual: false },
      ]);

      await POST(pedir('http://localhost/api/profile/experience', 'POST', {
        empresa: 'ACME', puesto: 'Dev', fechaInicio: '2010-01-15', fechaFin: '2014-01-15', esActual: false,
      }));

      expect(añosGuardados()).toBe(8);
    });

    it('suma los periodos que no se solapan', async () => {
      mockExperience.findMany.mockResolvedValue([
        { fechaInicio: new Date('2010-01-15'), fechaFin: new Date('2012-01-15'), esActual: false },
        { fechaInicio: new Date('2015-01-15'), fechaFin: new Date('2018-01-15'), esActual: false },
      ]);

      await POST(pedir('http://localhost/api/profile/experience', 'POST', {
        empresa: 'ACME', puesto: 'Dev', fechaInicio: '2010-01-15', fechaFin: '2012-01-15', esActual: false,
      }));

      expect(añosGuardados()).toBe(5);
    });

    it('NO cuenta hasta hoy una experiencia antigua sin fecha de fin', async () => {
      mockExperience.findMany.mockResolvedValue([
        // Práctica de 2015 sin fecha de fin y sin ser la actual: antes sumaba
        // una década entera.
        { fechaInicio: new Date('2015-01-15'), fechaFin: null, esActual: false },
        { fechaInicio: new Date('2020-01-15'), fechaFin: new Date('2022-01-15'), esActual: false },
      ]);

      await POST(pedir('http://localhost/api/profile/experience', 'POST', {
        empresa: 'ACME', puesto: 'Dev', fechaInicio: '2020-01-15', fechaFin: '2022-01-15', esActual: false,
      }));

      expect(añosGuardados()).toBe(2);
    });

    it('sí cuenta hasta hoy la experiencia marcada como actual', async () => {
      const inicio = new Date();
      inicio.setFullYear(inicio.getFullYear() - 4);

      mockExperience.findMany.mockResolvedValue([
        { fechaInicio: inicio, fechaFin: null, esActual: true },
      ]);

      await POST(pedir('http://localhost/api/profile/experience', 'POST', {
        empresa: 'ACME', puesto: 'Dev', fechaInicio: inicio.toISOString(), esActual: true,
      }));

      expect(añosGuardados()).toBe(4);
    });
  });
});
