// RUTA: __tests__/api/specialties-public.test.ts

/**
 * Tests del endpoint público de especialidades.
 * GET /api/specialties → consumido por la landing (SpecialtiesSection) y formularios.
 *
 * Verifica:
 *  - Solo devuelve especialidades activas (isActive: true)
 *  - No requiere autenticación
 *  - Respeta sortOrder para el ordenamiento
 *  - Incluye Cache-Control para reducir presión sobre DB
 *  - Devuelve subcategorías cuando ?subcategories=true
 */

// jsdom no expone Response.json estático; mockeamos NextResponse para devolver un objeto inspeccionable.
jest.mock('next/server', () => ({
  NextResponse: {
    json: (data: unknown, options?: { status?: number; headers?: Record<string, string> }) => ({
      status: options?.status ?? 200,
      headers: new Map(Object.entries(options?.headers ?? {})),
      json: async () => data,
    }),
  },
}));

jest.mock('@/lib/prisma', () => ({
  prisma: {
    specialty: {
      findMany: jest.fn(),
    },
  },
}));

import { GET } from '@/app/api/specialties/route';
import { prisma } from '@/lib/prisma';

const mockPrismaSpecialty = prisma.specialty as unknown as {
  findMany: jest.Mock;
};

const buildRequest = (search = '') =>
  new Request(`http://localhost:3000/api/specialties${search}`);

describe('GET /api/specialties (público)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('solo consulta especialidades activas y ordenadas por sortOrder', async () => {
    mockPrismaSpecialty.findMany.mockResolvedValue([]);

    await GET(buildRequest());

    expect(mockPrismaSpecialty.findMany).toHaveBeenCalledTimes(1);
    const args = mockPrismaSpecialty.findMany.mock.calls[0][0];
    expect(args.where).toEqual({ isActive: true });
    expect(args.orderBy).toEqual([
      { sortOrder: 'asc' },
      { name: 'asc' },
    ]);
  });

  it('devuelve subcategorías cuando se pide ?subcategories=true', async () => {
    mockPrismaSpecialty.findMany.mockResolvedValue([
      {
        id: 1,
        name: 'Tecnologías de la Información',
        slug: 'ti',
        icon: null,
        color: '#2b5d62',
        subcategories: ['Desarrollo de software', 'Ciberseguridad'],
      },
    ]);

    const res = await GET(buildRequest('?subcategories=true'));
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.success).toBe(true);
    expect(json.data).toHaveLength(1);
    expect(json.data[0].subcategories).toEqual([
      'Desarrollo de software',
      'Ciberseguridad',
    ]);

    const selectArg = mockPrismaSpecialty.findMany.mock.calls[0][0].select;
    expect(selectArg.subcategories).toBe(true);
  });

  it('expone Cache-Control público para reducir carga en DB', async () => {
    mockPrismaSpecialty.findMany.mockResolvedValue([]);

    const res = await GET(buildRequest());
    const cacheControl =
      (res.headers as unknown as Map<string, string>).get('Cache-Control') ?? '';

    expect(cacheControl).toMatch(/public/);
    expect(cacheControl).toMatch(/s-maxage=\d+/);
  });

  it('no llama a Prisma con campos de auth ni filtra por usuario (endpoint público)', async () => {
    mockPrismaSpecialty.findMany.mockResolvedValue([]);

    await GET(buildRequest());

    const args = mockPrismaSpecialty.findMany.mock.calls[0][0];
    // El endpoint público nunca debe filtrar por userId/role del solicitante
    expect(JSON.stringify(args.where)).not.toMatch(/userId|role|email/i);
  });

  it('devuelve count y array names para selects simples', async () => {
    mockPrismaSpecialty.findMany.mockResolvedValue([
      { id: 1, name: 'Salud', slug: 'salud', icon: null, color: '#000' },
      { id: 2, name: 'TI', slug: 'ti', icon: null, color: '#000' },
    ]);

    const res = await GET(buildRequest());
    const json = await res.json();

    expect(json.count).toBe(2);
    expect(json.names).toEqual(['Salud', 'TI']);
  });

  it('responde 500 si Prisma falla, sin filtrar el error interno', async () => {
    const consoleSpy = jest
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);
    mockPrismaSpecialty.findMany.mockRejectedValue(new Error('DB down'));

    const res = await GET(buildRequest());
    const json = await res.json();

    expect(res.status).toBe(500);
    expect(json.success).toBe(false);
    expect(json.error).toBe('Error al obtener especialidades');
    expect(JSON.stringify(json)).not.toMatch(/DB down/);

    consoleSpy.mockRestore();
  });
});
