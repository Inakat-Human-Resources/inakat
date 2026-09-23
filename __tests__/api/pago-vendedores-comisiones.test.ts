// RUTA: __tests__/api/pago-vendedores-comisiones.test.ts

/**
 * Dinero de los vendedores: alta, edición y liquidación de comisiones.
 *
 * Lo que se prueba aquí son defectos que movían dinero real:
 * - liquidar dos veces la misma comisión (y perder el comprobante del primero),
 * - guardar como comprobante cualquier cosa que luego se pinta como `href`,
 * - crear un vendedor con contraseña trivial, email inválido o 150% de descuento,
 * - dejar un User 'vendor' huérfano si falla la creación de su código,
 * - que el vendedor reactive por su cuenta un código que se le desactivó.
 */

jest.mock('next/server', () => ({
  NextResponse: {
    json: (data: any, options?: any) => ({
      status: options?.status || 200,
      json: async () => data
    })
  }
}));

const mockPrisma = {
  discountCode: {
    findFirst: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    findMany: jest.fn(),
    count: jest.fn()
  },
  discountCodeUse: {
    findUnique: jest.fn(),
    findUniqueOrThrow: jest.fn(),
    findMany: jest.fn(),
    count: jest.fn(),
    aggregate: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn()
  },
  user: {
    findUnique: jest.fn(),
    create: jest.fn()
  },
  $transaction: jest.fn()
};

jest.mock('@/lib/prisma', () => ({ prisma: mockPrisma }));

jest.mock('@/lib/auth', () => ({
  requireRole: jest.fn(),
  requireAuth: jest.fn(),
  getOptionalAuthUser: jest.fn()
}));

jest.mock('bcryptjs', () => ({ hash: jest.fn(async () => 'hash-falso') }));

import { requireRole } from '@/lib/auth';

const mockRequireRole = requireRole as jest.Mock;

const ADMIN = {
  user: {
    id: 7,
    email: 'admin@test.com',
    nombre: 'Admin',
    apellidoPaterno: null,
    apellidoMaterno: null,
    role: 'admin',
    isActive: true,
    credits: 0,
    specialty: null
  }
};

function req(body: any = {}, url = 'http://localhost:3000/api/admin/vendors') {
  return {
    headers: { get: () => null },
    json: async () => body,
    url
  } as any;
}

const params = (id: string) => ({ params: Promise.resolve({ id }) });

beforeEach(() => {
  jest.clearAllMocks();
  mockRequireRole.mockReset();
  mockRequireRole.mockResolvedValue(ADMIN);
});

// ===========================================================================
// PAGO-012 / PAGO-013 — liquidación de comisiones
// ===========================================================================
describe('PUT /api/admin/vendors/commissions/[id]', () => {
  const comisionPendiente = {
    id: 5,
    commissionStatus: 'pending',
    commissionPaidAt: null,
    paymentProofUrl: null,
    purchaseId: 99,
    purchase: { paymentStatus: 'paid' },
    code: { user: { id: 3, nombre: 'Juan', email: 'juan@test.com' } }
  };

  it('marca como pagada reclamando ATÓMICAMENTE sobre estado pending', async () => {
    mockPrisma.discountCodeUse.findUnique.mockResolvedValue(comisionPendiente);
    mockPrisma.discountCodeUse.updateMany.mockResolvedValue({ count: 1 });
    mockPrisma.discountCodeUse.findUniqueOrThrow.mockResolvedValue({
      ...comisionPendiente,
      commissionStatus: 'paid',
      commissionAmount: 3150,
      code: { code: 'JUAN10', user: { id: 3, nombre: 'Juan', email: 'juan@test.com' } },
      purchase: { id: 99, amount: 10 }
    });

    const { PUT } = await import('@/app/api/admin/vendors/commissions/[id]/route');
    const res = await PUT(
      req({ status: 'paid', paymentProofUrl: 'https://banco.mx/comprobante.pdf' }),
      params('5')
    );
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.success).toBe(true);

    // La condición del reclamo es lo que impide la doble liquidación.
    const where = mockPrisma.discountCodeUse.updateMany.mock.calls[0][0].where;
    expect(where).toEqual({ id: 5, commissionStatus: 'pending' });
    // Y ya no se usa el update incondicional para este camino.
    expect(mockPrisma.discountCodeUse.update).not.toHaveBeenCalled();
  });

  it('devuelve 409 si otro admin ya la pagó (reclamo count=0)', async () => {
    mockPrisma.discountCodeUse.findUnique.mockResolvedValue({
      ...comisionPendiente,
      commissionStatus: 'paid',
      paymentProofUrl: 'https://banco.mx/comprobante-del-primero.pdf'
    });
    mockPrisma.discountCodeUse.updateMany.mockResolvedValue({ count: 0 });

    const { PUT } = await import('@/app/api/admin/vendors/commissions/[id]/route');
    const res = await PUT(req({ status: 'paid', paymentProofUrl: null }), params('5'));
    const data = await res.json();

    expect(res.status).toBe(409);
    expect(data.success).toBe(false);
    // El comprobante del primero sigue ahí.
    expect(data.proofUrl).toBe('https://banco.mx/comprobante-del-primero.pdf');
  });

  it('un paymentProofUrl null NO pisa el comprobante ya guardado', async () => {
    mockPrisma.discountCodeUse.findUnique.mockResolvedValue({
      ...comisionPendiente,
      paymentProofUrl: 'https://banco.mx/ya-existente.pdf'
    });
    mockPrisma.discountCodeUse.updateMany.mockResolvedValue({ count: 1 });
    mockPrisma.discountCodeUse.findUniqueOrThrow.mockResolvedValue({
      ...comisionPendiente,
      commissionStatus: 'paid',
      commissionAmount: 100,
      code: { code: 'X', user: { id: 3, nombre: 'Juan', email: 'j@t.com' } },
      purchase: { id: 99, amount: 10 }
    });

    const { PUT } = await import('@/app/api/admin/vendors/commissions/[id]/route');
    await PUT(req({ status: 'paid', paymentProofUrl: null }), params('5'));

    const data = mockPrisma.discountCodeUse.updateMany.mock.calls[0][0].data;
    expect(data).not.toHaveProperty('paymentProofUrl');
  });

  it('rechaza con 400 un comprobante que no es URL http(s)', async () => {
    mockPrisma.discountCodeUse.findUnique.mockResolvedValue(comisionPendiente);

    const { PUT } = await import('@/app/api/admin/vendors/commissions/[id]/route');

    for (const valor of ['drive.google.com/file/abc', 'javascript:alert(1)', 123, {}]) {
      const res = await PUT(req({ status: 'paid', paymentProofUrl: valor }), params('5'));
      expect(res.status).toBe(400);
    }

    expect(mockPrisma.discountCodeUse.updateMany).not.toHaveBeenCalled();
  });

  it('sigue rechazando con 409 liquidar la comisión de una compra no pagada', async () => {
    mockPrisma.discountCodeUse.findUnique.mockResolvedValue({
      ...comisionPendiente,
      purchase: { paymentStatus: 'failed' }
    });

    const { PUT } = await import('@/app/api/admin/vendors/commissions/[id]/route');
    const res = await PUT(req({ status: 'paid' }), params('5'));

    expect(res.status).toBe(409);
    expect(mockPrisma.discountCodeUse.updateMany).not.toHaveBeenCalled();
  });

  it('al revertir a pending limpia también el comprobante', async () => {
    mockPrisma.discountCodeUse.findUnique.mockResolvedValue({
      ...comisionPendiente,
      commissionStatus: 'paid',
      paymentProofUrl: 'https://banco.mx/x.pdf'
    });
    mockPrisma.discountCodeUse.update.mockResolvedValue({
      ...comisionPendiente,
      commissionAmount: 100,
      code: { code: 'X', user: { id: 3, nombre: 'Juan', email: 'j@t.com' } },
      purchase: { id: 99, amount: 10 }
    });

    const { PUT } = await import('@/app/api/admin/vendors/commissions/[id]/route');
    await PUT(req({ status: 'pending' }), params('5'));

    const data = mockPrisma.discountCodeUse.update.mock.calls[0][0].data;
    expect(data.commissionPaidAt).toBeNull();
    expect(data.paymentProofUrl).toBeNull();
  });
});

// ===========================================================================
// PAGO-011 / PAGO-015 / PAGO-016 / PAGO-036 — alta de vendedor
// ===========================================================================
describe('POST /api/admin/vendors', () => {
  const altaValida = {
    nombre: 'Juan',
    apellidoPaterno: 'Pérez',
    email: 'juan@empresa.com',
    password: 'Segura123',
    code: 'JUAN10',
    discountPercent: 10,
    commissionPercent: 10
  };

  it('crea usuario y código en UNA transacción', async () => {
    mockPrisma.user.findUnique.mockResolvedValue(null);
    mockPrisma.discountCode.findUnique.mockResolvedValue(null);

    const tx = {
      user: { create: jest.fn(async () => ({ id: 42, nombre: 'Juan', apellidoPaterno: 'Pérez', email: 'juan@empresa.com', role: 'vendor' })) },
      discountCode: { create: jest.fn(async () => ({ id: 9, code: 'JUAN10', discountPercent: 10, commissionPercent: 10 })) }
    };
    mockPrisma.$transaction.mockImplementation(async (cb: any) => cb(tx));

    const { POST } = await import('@/app/api/admin/vendors/route');
    const res = await POST(req(altaValida));
    const data = await res.json();

    expect(res.status).toBe(201);
    expect(data.success).toBe(true);
    expect(mockPrisma.$transaction).toHaveBeenCalledTimes(1);
    // Los dos inserts ocurren con el cliente de la transacción, no con prisma.
    expect(tx.user.create).toHaveBeenCalledTimes(1);
    expect(tx.discountCode.create).toHaveBeenCalledTimes(1);
    expect(mockPrisma.user.create).not.toHaveBeenCalled();
    expect(mockPrisma.discountCode.create).not.toHaveBeenCalled();
  });

  it('traduce P2002 del código a 409 (no a 500)', async () => {
    mockPrisma.user.findUnique.mockResolvedValue(null);
    mockPrisma.discountCode.findUnique.mockResolvedValue(null);

    const { Prisma } = require('@prisma/client');
    const p2002 = new Prisma.PrismaClientKnownRequestError('dup', {
      code: 'P2002',
      clientVersion: 'test',
      meta: { target: ['code'] }
    });
    mockPrisma.$transaction.mockRejectedValue(p2002);

    const { POST } = await import('@/app/api/admin/vendors/route');
    const res = await POST(req(altaValida));
    const data = await res.json();

    expect(res.status).toBe(409);
    expect(data.error).toContain('código');
  });

  it('rechaza con 400 una contraseña que no cumple la política', async () => {
    const { POST } = await import('@/app/api/admin/vendors/route');
    const res = await POST(req({ ...altaValida, password: '1' }));

    expect(res.status).toBe(400);
    expect(mockPrisma.$transaction).not.toHaveBeenCalled();
  });

  it('rechaza con 400 un email mal formado', async () => {
    const { POST } = await import('@/app/api/admin/vendors/route');
    const res = await POST(req({ ...altaValida, email: 'juan@' }));

    expect(res.status).toBe(400);
    expect(mockPrisma.$transaction).not.toHaveBeenCalled();
  });

  it('rechaza con 400 un email que no es string (antes: 500)', async () => {
    const { POST } = await import('@/app/api/admin/vendors/route');
    const res = await POST(req({ ...altaValida, email: 12345 }));

    expect(res.status).toBe(400);
  });

  it('rechaza con 400 un porcentaje fuera de rango en vez de recortarlo', async () => {
    const { POST } = await import('@/app/api/admin/vendors/route');

    const res150 = await POST(req({ ...altaValida, discountPercent: 150 }));
    expect(res150.status).toBe(400);

    const resNeg = await POST(req({ ...altaValida, commissionPercent: -5 }));
    expect(resNeg.status).toBe(400);

    // 100% de descuento deja el cobro en 0: tampoco se admite.
    const res100 = await POST(req({ ...altaValida, discountPercent: 100 }));
    expect(res100.status).toBe(400);

    expect(mockPrisma.$transaction).not.toHaveBeenCalled();
  });

  it('un porcentaje 0 legítimo se guarda como 0 (antes se convertía en 10)', async () => {
    mockPrisma.user.findUnique.mockResolvedValue(null);
    mockPrisma.discountCode.findUnique.mockResolvedValue(null);

    const tx = {
      user: { create: jest.fn(async () => ({ id: 42, nombre: 'Juan', apellidoPaterno: 'Pérez', email: 'juan@empresa.com', role: 'vendor' })) },
      discountCode: { create: jest.fn(async () => ({ id: 9, code: 'JUAN10', discountPercent: 0, commissionPercent: 0 })) }
    };
    mockPrisma.$transaction.mockImplementation(async (cb: any) => cb(tx));

    const { POST } = await import('@/app/api/admin/vendors/route');
    await POST(req({ ...altaValida, discountPercent: 0, commissionPercent: 0 }));

    const data = (tx.discountCode.create.mock.calls[0] as unknown as [{ data: Record<string, unknown> }])[0].data;
    expect(data.discountPercent).toBe(0);
    expect(data.commissionPercent).toBe(0);
  });

  it('rechaza con 400 un código con formato inválido', async () => {
    const { POST } = await import('@/app/api/admin/vendors/route');

    for (const code of ['A', 'PROMO 10%', 'x'.repeat(30)]) {
      const res = await POST(req({ ...altaValida, code }));
      expect(res.status).toBe(400);
    }
  });
});

// ===========================================================================
// PAGO-009 / PAGO-020 — el admin puede editar; el vendedor no se reactiva solo
// ===========================================================================
describe('PATCH /api/admin/vendors/[id]', () => {
  it('desactiva el código de un vendedor', async () => {
    mockPrisma.discountCode.findUnique.mockResolvedValue({ id: 9 });
    mockPrisma.discountCode.update.mockResolvedValue({
      id: 9,
      code: 'JUAN10',
      discountPercent: 10,
      commissionPercent: 10,
      isActive: false,
      updatedAt: new Date(),
      user: { id: 3, nombre: 'Juan', apellidoPaterno: 'Pérez', email: 'j@t.com' }
    });

    const { PATCH } = await import('@/app/api/admin/vendors/[id]/route');
    const res = await PATCH(req({ isActive: false }), params('9'));
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(mockPrisma.discountCode.update.mock.calls[0][0].data).toEqual({ isActive: false });
    expect(data.data.isActive).toBe(false);
  });

  it('corrige los porcentajes dentro de rango', async () => {
    mockPrisma.discountCode.findUnique.mockResolvedValue({ id: 9 });
    mockPrisma.discountCode.update.mockResolvedValue({
      id: 9, code: 'JUAN10', discountPercent: 5, commissionPercent: 7,
      isActive: true, updatedAt: new Date(),
      user: { id: 3, nombre: 'Juan', apellidoPaterno: 'P', email: 'j@t.com' }
    });

    const { PATCH } = await import('@/app/api/admin/vendors/[id]/route');
    const res = await PATCH(req({ discountPercent: 5, commissionPercent: 7 }), params('9'));

    expect(res.status).toBe(200);
  });

  it('rechaza con 400 un porcentaje de 100 o más', async () => {
    const { PATCH } = await import('@/app/api/admin/vendors/[id]/route');
    const res = await PATCH(req({ commissionPercent: 100 }), params('9'));

    expect(res.status).toBe(400);
    expect(mockPrisma.discountCode.update).not.toHaveBeenCalled();
  });

  it('exige rol admin', async () => {
    mockRequireRole.mockResolvedValue({ error: 'Acceso denegado', status: 403 });

    const { PATCH } = await import('@/app/api/admin/vendors/[id]/route');
    const res = await PATCH(req({ isActive: false }), params('9'));

    expect(res.status).toBe(403);
    expect(mockPrisma.discountCode.update).not.toHaveBeenCalled();
  });
});

describe('PUT /api/vendor/my-code', () => {
  function reqVendor(body: any, userId = 3) {
    const headers = new Map<string, string>([['x-user-id', String(userId)]]);
    return {
      headers: { get: (n: string) => headers.get(n) ?? null },
      json: async () => body,
      url: 'http://localhost:3000/api/vendor/my-code'
    } as any;
  }

  it('el vendedor NO puede reactivar un código desactivado', async () => {
    mockPrisma.discountCode.findFirst.mockResolvedValue({
      id: 9,
      userId: 3,
      code: 'JUAN10',
      isActive: false
    });

    const { PUT } = await import('@/app/api/vendor/my-code/route');
    const res = await PUT(reqVendor({ isActive: true }));
    const data = await res.json();

    expect(res.status).toBe(403);
    expect(data.error).toContain('administrador');
    expect(mockPrisma.discountCode.update).not.toHaveBeenCalled();
  });

  it('el vendedor SÍ puede desactivar su propio código', async () => {
    mockPrisma.discountCode.findFirst.mockResolvedValue({
      id: 9,
      userId: 3,
      code: 'JUAN10',
      isActive: true
    });
    mockPrisma.discountCode.update.mockResolvedValue({
      id: 9, code: 'JUAN10', discountPercent: 10, commissionPercent: 10,
      isActive: false, createdAt: new Date(), updatedAt: new Date()
    });

    const { PUT } = await import('@/app/api/vendor/my-code/route');
    const res = await PUT(reqVendor({ isActive: false }));

    expect(res.status).toBe(200);
    expect(mockPrisma.discountCode.update.mock.calls[0][0].data.isActive).toBe(false);
  });

  it('un P2002 al crear el código responde 409, no 500', async () => {
    mockPrisma.discountCode.findFirst.mockResolvedValue(null);
    mockPrisma.discountCode.findUnique.mockResolvedValue(null);

    const { Prisma } = require('@prisma/client');
    mockPrisma.discountCode.create.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('dup', {
        code: 'P2002',
        clientVersion: 'test',
        meta: { target: ['code'] }
      })
    );

    const { POST } = await import('@/app/api/vendor/my-code/route');
    const res = await POST(reqVendor({ code: 'JUAN10' }));

    expect(res.status).toBe(409);
  });
});

// ===========================================================================
// PAGO-032 / PAGO-034 / PAGO-035 — listados del panel
// ===========================================================================
describe('Listados del panel de vendedores', () => {
  it('las comisiones pendientes van primero y por fecha límite ascendente', async () => {
    mockPrisma.discountCodeUse.findMany.mockResolvedValue([]);
    mockPrisma.discountCodeUse.count.mockResolvedValue(0);
    mockPrisma.discountCodeUse.aggregate.mockResolvedValue({
      _sum: { commissionAmount: 0 },
      _count: 0
    });

    const { GET } = await import('@/app/api/admin/vendors/commissions/route');
    await GET(req({}, 'http://localhost:3000/api/admin/vendors/commissions'));

    const orderBy = mockPrisma.discountCodeUse.findMany.mock.calls[0][0].orderBy;
    expect(orderBy[0]).toEqual({ commissionStatus: 'desc' });
    expect(orderBy[1]).toEqual({ paymentDueDate: 'asc' });
  });

  it('acota limit y page en vez de pasarlos crudos a Prisma', async () => {
    mockPrisma.discountCodeUse.findMany.mockResolvedValue([]);
    mockPrisma.discountCodeUse.count.mockResolvedValue(0);
    mockPrisma.discountCodeUse.aggregate.mockResolvedValue({
      _sum: { commissionAmount: 0 },
      _count: 0
    });

    const { GET } = await import('@/app/api/admin/vendors/commissions/route');
    await GET(req({}, 'http://localhost:3000/api/admin/vendors/commissions?page=0&limit=abc'));

    const args = mockPrisma.discountCodeUse.findMany.mock.calls[0][0];
    expect(args.skip).toBe(0);
    expect(args.skip).toBeGreaterThanOrEqual(0);
    expect(Number.isNaN(args.take)).toBe(false);
    expect(args.take).toBeLessThanOrEqual(100);
    expect(args.take).toBeGreaterThanOrEqual(1);
  });

  it('un limit enorme se acota a 100', async () => {
    mockPrisma.discountCodeUse.findMany.mockResolvedValue([]);
    mockPrisma.discountCodeUse.count.mockResolvedValue(0);
    mockPrisma.discountCodeUse.aggregate.mockResolvedValue({
      _sum: { commissionAmount: 0 },
      _count: 0
    });

    const { GET } = await import('@/app/api/admin/vendors/commissions/route');
    await GET(req({}, 'http://localhost:3000/api/admin/vendors/commissions?limit=99999999'));

    expect(mockPrisma.discountCodeUse.findMany.mock.calls[0][0].take).toBe(100);
  });

  it('vendorId no numérico devuelve 400', async () => {
    const { GET } = await import('@/app/api/admin/vendors/commissions/route');
    const res = await GET(
      req({}, 'http://localhost:3000/api/admin/vendors/commissions?vendorId=abc')
    );

    expect(res.status).toBe(400);
    expect(mockPrisma.discountCodeUse.findMany).not.toHaveBeenCalled();
  });

  it('totalVendors se cuenta SIN el filtro de búsqueda', async () => {
    mockPrisma.discountCode.findMany.mockResolvedValue([]);
    mockPrisma.discountCode.count
      .mockResolvedValueOnce(1) // totalCount, con filtro de búsqueda
      .mockResolvedValueOnce(40); // totalVendors, global
    mockPrisma.discountCodeUse.aggregate.mockResolvedValue({
      _sum: { finalPrice: 0, commissionAmount: 0 },
      _count: 0
    });

    const { GET } = await import('@/app/api/admin/vendors/route');
    const res = await GET(req({}, 'http://localhost:3000/api/admin/vendors?search=maria'));
    const data = await res.json();

    expect(data.data.globalStats.totalVendors).toBe(40);
    expect(data.data.pagination.totalCount).toBe(1);

    // El segundo count no lleva where.
    const segundaLlamada = mockPrisma.discountCode.count.mock.calls[1];
    expect(segundaLlamada[0]).toBeUndefined();
  });
});

// ===========================================================================
// PAGO-044 — el vendedor no ve datos personales del comprador
// ===========================================================================
describe('GET /api/vendor/my-sales', () => {
  function reqVendor(url = 'http://localhost:3000/api/vendor/my-sales') {
    const headers = new Map<string, string>([['x-user-id', '3']]);
    return {
      headers: { get: (n: string) => headers.get(n) ?? null },
      json: async () => ({}),
      url
    } as any;
  }

  it('no devuelve id, nombre ni email de la persona que compró', async () => {
    mockPrisma.discountCode.findFirst.mockResolvedValue({ id: 9, code: 'JUAN10' });
    mockPrisma.discountCodeUse.findMany.mockResolvedValue([
      {
        id: 1,
        purchaseId: 99,
        originalPrice: 35000,
        discountAmount: 3500,
        finalPrice: 31500,
        commissionAmount: 3150,
        commissionStatus: 'pending',
        commissionPaidAt: null,
        paymentDueDate: new Date(),
        paymentProofUrl: null,
        createdAt: new Date(),
        purchase: {
          amount: 10,
          user: { companyRequest: { nombreEmpresa: 'ACME' } }
        }
      }
    ]);
    mockPrisma.discountCodeUse.count.mockResolvedValue(1);
    mockPrisma.discountCodeUse.aggregate.mockResolvedValue({
      _sum: { commissionAmount: 3150 }
    });

    const { GET } = await import('@/app/api/vendor/my-sales/route');
    const res = await GET(reqVendor());
    const data = await res.json();

    expect(data.data.sales[0].company).toEqual({ nombreEmpresa: 'ACME' });

    // Y el select tampoco los carga.
    const select = mockPrisma.discountCodeUse.findMany.mock.calls[0][0]
      .include.purchase.include.user.select;
    expect(select).toEqual({ companyRequest: { select: { nombreEmpresa: true } } });
  });

  it('acota page=0 / limit=abc en vez de reventar', async () => {
    mockPrisma.discountCode.findFirst.mockResolvedValue({ id: 9, code: 'JUAN10' });
    mockPrisma.discountCodeUse.findMany.mockResolvedValue([]);
    mockPrisma.discountCodeUse.count.mockResolvedValue(0);
    mockPrisma.discountCodeUse.aggregate.mockResolvedValue({
      _sum: { commissionAmount: 0 }
    });

    const { GET } = await import('@/app/api/vendor/my-sales/route');
    await GET(reqVendor('http://localhost:3000/api/vendor/my-sales?page=0&limit=abc'));

    const args = mockPrisma.discountCodeUse.findMany.mock.calls[0][0];
    expect(args.skip).toBe(0);
    expect(args.take).toBe(20);
  });

  it('el agregado de comisiones pagadas también filtra por compra pagada', async () => {
    mockPrisma.discountCode.findFirst.mockResolvedValue({ id: 9, code: 'JUAN10' });
    mockPrisma.discountCodeUse.findMany.mockResolvedValue([]);
    mockPrisma.discountCodeUse.count.mockResolvedValue(0);
    mockPrisma.discountCodeUse.aggregate.mockResolvedValue({
      _sum: { commissionAmount: 0 }
    });

    const { GET } = await import('@/app/api/vendor/my-sales/route');
    await GET(reqVendor());

    for (const llamada of mockPrisma.discountCodeUse.aggregate.mock.calls) {
      expect(llamada[0].where.purchase).toEqual({ paymentStatus: 'paid' });
    }
  });
});
