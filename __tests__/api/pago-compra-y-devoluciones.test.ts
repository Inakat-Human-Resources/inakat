// RUTA: __tests__/api/pago-compra-y-devoluciones.test.ts

/**
 * Compra de créditos y devoluciones.
 *
 * Defectos que se fijan aquí:
 * - la comisión del vendedor nacía ANTES de saber si el pago se aprobaba;
 * - un rechazo síncrono se guardaba como 'pending' y se respondía success:true;
 * - el paquete se resolvía por una tabla de créditos escrita a mano en vez de
 *   por el id de la fila, así que se podía cobrar el precio equivocado;
 * - se podía cobrar un importe distinto al que el cliente vio;
 * - el ledger no cuadraba (balanceBefore leído antes del cobro);
 * - un body sin paymentData devolvía 500 en vez de 400;
 * - la confirmación por correo sólo salía desde el webhook;
 * - una devolución/contracargo se descartaba en silencio.
 */

import fs from 'fs';
import path from 'path';

const leer = (rel: string): string =>
  fs.readFileSync(path.join(process.cwd(), rel), 'utf-8');

const COMPRA = 'src/app/api/credits/purchases/route.ts';
const WEBHOOK = 'src/app/api/webhooks/mercadopago/route.ts';

// ===========================================================================
// PAGO-003 — la comisión sólo nace con el pago aprobado
// ===========================================================================
describe('La comisión del vendedor sólo se crea con la compra pagada', () => {
  it('la ruta de compra ya no inserta DiscountCodeUse suelto', () => {
    const c = leer(COMPRA);
    expect(c).not.toContain('prisma.discountCodeUse.create');
  });

  it('se registra a través del helper, dentro de la transacción de acreditación', () => {
    const c = leer(COMPRA);
    expect(c).toContain("import { registrarComisionDeVenta } from '@/lib/comisiones'");

    // La llamada ocurre con el cliente de la transacción (tx), no con prisma.
    expect(c).toMatch(/await registrarComisionDeVenta\(tx, \{/);

    // Y está DENTRO del bloque de 'approved'.
    const iAprobado = c.indexOf("paymentResult.status === 'approved'");
    const iComision = c.indexOf('registrarComisionDeVenta(tx');
    const iRespuestaAprobado = c.indexOf('status: \'approved\',');
    expect(iAprobado).toBeGreaterThan(-1);
    expect(iComision).toBeGreaterThan(iAprobado);
    expect(iComision).toBeLessThan(iRespuestaAprobado);
  });

  it('el webhook también la registra al acreditar, con el código de la metadata', () => {
    const w = leer(WEBHOOK);
    expect(w).toContain('registrarComisionDeVenta(tx, {');
    expect(w).toContain('metadata.discount_code');
  });

  it('el helper es idempotente: comprueba si ya existe y traduce P2002', () => {
    const h = leer('src/lib/comisiones.ts');
    expect(h).toContain('tx.discountCodeUse.findUnique');
    expect(h).toContain("error.code === 'P2002'");
    expect(h).toContain("motivo: 'ya-registrada'");
  });
});

// ===========================================================================
// PAGO-018 / PAGO-006 — paquete por id y precio verificado
// ===========================================================================
describe('Resolución del paquete y precio cobrado', () => {
  const c = leer(COMPRA);

  it('resuelve por packageId cuando el cliente lo envía', () => {
    expect(c).toMatch(/where: \{ id: packageId, isActive: true \}/);
  });

  it('el camino heredado por cantidad de créditos usa orderBy determinista', () => {
    // Sin orderBy, dos paquetes activos con los mismos créditos daban un precio
    // arbitrario: el comprador podía pagar el del pack que no eligió.
    expect(c).toMatch(/where: \{ credits, isActive: true \},\s*orderBy: \{ id: 'asc' \}/);
  });

  it('packageType se deriva de la fila, no de lo que mande el cliente', () => {
    expect(c).toContain('const packageTypeReal = `pack_${pkg.credits}`');
    expect(c).toContain('packageType: packageTypeReal');
  });

  it('rechaza con 409 si el importe no coincide con lo que el cliente vio', () => {
    expect(c).toMatch(
      /Math\.round\(expectedAmount\) !== Math\.round\(finalPrice\)/
    );
    expect(c).toMatch(/status: 409/);
  });
});

// ===========================================================================
// PAGO-037 — body validado: 400, no 500
// ===========================================================================
describe('Validación del body de la compra', () => {
  const c = leer(COMPRA);

  it('el body pasa por un esquema zod antes de tocar nada', () => {
    expect(c).toContain('esquemaCompra.safeParse');
    expect(c).toContain('token: z.string()');
    expect(c).toContain('payment_method_id: z.string()');
  });

  it('el esquema se valida ANTES de leer el paquete y de cobrar', () => {
    const iParse = c.indexOf('esquemaCompra.safeParse');
    const iCobro = c.indexOf('await payment.create');
    expect(iParse).toBeGreaterThan(-1);
    expect(iParse).toBeLessThan(iCobro);
  });
});

// ===========================================================================
// PAGO-038 — ledger cuadrado
// ===========================================================================
describe('El asiento de créditos cuadra', () => {
  it('balanceBefore se deriva del saldo nuevo, no de una lectura previa', () => {
    const c = leer(COMPRA);
    expect(c).toContain('balanceBefore: updatedUser.credits - pkg.credits');
    expect(c).not.toContain('const balanceBefore = user.credits');
  });
});

// ===========================================================================
// PAGO-039 — un rechazo no es un pago pendiente
// ===========================================================================
describe('Pago rechazado de forma síncrona', () => {
  const c = leer(COMPRA);

  it('marca la compra como failed y responde 402', () => {
    expect(c).toMatch(
      /paymentResult\.status === 'rejected' \|\| paymentResult\.status === 'cancelled'/
    );
    expect(c).toMatch(/paymentStatus: \{ not: 'paid' \} \},\s*data: \{ paymentStatus: 'failed' \}/);
    expect(c).toContain('status: 402');
  });

  it('la rama de rechazo va ANTES de la respuesta de "pendiente"', () => {
    const iRechazo = c.indexOf("paymentResult.status === 'rejected'");
    const iPendiente = c.indexOf("message: 'Pago pendiente de confirmación'");
    expect(iRechazo).toBeLessThan(iPendiente);
  });
});

// ===========================================================================
// PAGO-019 — confirmación también en el camino síncrono
// ===========================================================================
describe('Confirmación de la compra', () => {
  const c = leer(COMPRA);

  it('la ruta envía notificación in-app y correo tras acreditar', () => {
    expect(c).toContain('notificarCompraAcreditada');
    expect(c).toContain("type: 'credits_purchased'");
    expect(c).toContain('sendPaymentConfirmation');
  });

  it('sólo notifica quien ganó el reclamo atómico (no duplica con el webhook)', () => {
    expect(c).toMatch(/if \(acreditadoAqui\) \{\s*await notificarCompraAcreditada/);
  });
});

// ===========================================================================
// PAGO-022 — devoluciones y contracargos
// ===========================================================================
describe('Devoluciones y contracargos en el webhook', () => {
  const w = leer(WEBHOOK);

  it('el early-return por "ya pagada" vive DENTRO de la rama approved', () => {
    const iApproved = w.indexOf("paymentInfo.status === 'approved'");
    const iEarly = w.indexOf("purchase.paymentStatus === 'paid'");
    expect(iApproved).toBeGreaterThan(-1);
    expect(iEarly).toBeGreaterThan(iApproved);
  });

  it('hay rama para refunded y charged_back', () => {
    expect(w).toMatch(
      /paymentInfo\.status === 'refunded' \|\|\s*paymentInfo\.status === 'charged_back'/
    );
  });

  it('la reversión reclama de forma atómica sobre paymentStatus paid', () => {
    expect(w).toMatch(
      /updateMany\(\{\s*where: \{ id: purchaseId, paymentStatus: 'paid' \},\s*data: \{ paymentStatus: 'refunded' \}/
    );
  });

  it('resta créditos y deja asiento negativo de tipo refund', () => {
    expect(w).toContain('credits: { decrement: creditos }');
    expect(w).toContain("type: 'refund'");
    expect(w).toContain('amount: -creditos');
  });

  it('cancela la comisión pendiente del vendedor', () => {
    expect(w).toMatch(
      /discountCodeUse\.updateMany\(\{\s*where: \{ purchaseId, commissionStatus: 'pending' \},\s*data: \{ commissionStatus: 'cancelled' \}/
    );
  });

  it('avisa a los administradores', () => {
    expect(w).toContain('notifyAllAdmins');
    expect(w).toContain("type: 'payment_refunded'");
  });

  it('un rechazo tardío no degrada una compra ya acreditada', () => {
    expect(w).toMatch(
      /creditPurchase\.updateMany\(\{\s*where: \{ id: purchase\.id, paymentStatus: \{ not: 'paid' \} \},\s*data: \{ paymentStatus: 'failed' \}/
    );
  });

  it('los estados sin tratamiento quedan registrados en log', () => {
    expect(w).toContain('Estado sin tratamiento específico');
  });
});

// ===========================================================================
// PAGO-009 — desactivar al vendedor invalida su código
// ===========================================================================
describe('Un vendedor desactivado no da descuento', () => {
  // AUTH-004 / PAGO-005: además de activo, el dueño tiene que ser vendor o admin.
  const DUENO_ACTIVO = /user:\s*\{\s*isActive:\s*true\b/;

  it('la compra exige que el dueño del código esté activo', () => {
    expect(leer(COMPRA)).toMatch(DUENO_ACTIVO);
  });

  it('la validación pública del código, igual', () => {
    expect(leer('src/app/api/discount-codes/validate/route.ts')).toMatch(DUENO_ACTIVO);
  });
});

// ===========================================================================
// PAGO-040 / PAGO-037 — validación del código
// ===========================================================================
describe('POST /api/discount-codes/validate', () => {
  it('valida el tipo de code con zod (antes: 500 con un número)', () => {
    const v = leer('src/app/api/discount-codes/validate/route.ts');
    expect(v).toContain('esquemaValidacion.safeParse');
    expect(v).toContain('code: z.string()');
  });

  it('aplica la regla de auto-referido si hay sesión', () => {
    const v = leer('src/app/api/discount-codes/validate/route.ts');
    expect(v).toContain('getOptionalAuthUser');
    expect(v).toMatch(/sesion\.id === discountCode\.userId/);
  });
});

// ===========================================================================
// PAGO-027 / PAGO-041 — la matriz de precios no acepta filtros inyectados
// ===========================================================================
describe('calculateJobCreditCost', () => {
  const mockPrisma = { pricingMatrix: { findFirst: jest.fn() } };

  beforeAll(() => {
    jest.doMock('@/lib/prisma', () => ({ prisma: mockPrisma }));
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('no consulta Prisma con valores que no son string', async () => {
    const { calculateJobCreditCost } = await import('@/lib/pricing');

    const casos: unknown[] = [{ not: '' }, 1, ['a'], null, undefined, ''];
    for (const valor of casos) {
      const r = await calculateJobCreditCost(valor, valor, valor);
      expect(r.found).toBe(false);
    }

    // Lo importante: el filtro inyectado nunca llega a la base de datos.
    expect(mockPrisma.pricingMatrix.findFirst).not.toHaveBeenCalled();
  });

  it('calcularCostoExigiendoPrecio lanza si la combinación no tiene precio', async () => {
    mockPrisma.pricingMatrix.findFirst.mockResolvedValue(null);
    const { calcularCostoExigiendoPrecio, PrecioNoConfiguradoError } = await import(
      '@/lib/pricing'
    );

    await expect(
      calcularCostoExigiendoPrecio('Tecnología', 'Director ', 'remote')
    ).rejects.toBeInstanceOf(PrecioNoConfiguradoError);
  });

  it('calcularCostoExigiendoPrecio devuelve los créditos reales de la matriz', async () => {
    mockPrisma.pricingMatrix.findFirst.mockResolvedValue({
      id: 3,
      credits: 18,
      minSalary: 50000
    });
    const { calcularCostoExigiendoPrecio } = await import('@/lib/pricing');

    const r = await calcularCostoExigiendoPrecio('Tecnología', 'Director', 'remote');
    expect(r.credits).toBe(18);
  });
});

// ===========================================================================
// PAGO-041 — la ruta pública de precios exige strings
// ===========================================================================
describe('POST /api/pricing/calculate', () => {
  it('exige que los tres campos sean texto', () => {
    const p = leer('src/app/api/pricing/calculate/route.ts');
    expect(p).toContain('esTextoValido');
    expect(p).toMatch(/typeof valor === 'string'/);
    expect(p).toMatch(/!esTextoValido\(profile\)/);
  });
});

// ===========================================================================
// PAGO-017 — validación central de entorno
// ===========================================================================
describe('src/lib/env.ts', () => {
  it('detecta las variables que faltan', async () => {
    const { validarServerEnv } = await import('@/lib/env');
    const r = validarServerEnv({} as NodeJS.ProcessEnv);

    expect(r.ok).toBe(false);
    expect(r.faltantes.join(' | ')).toContain('MERCADOPAGO_WEBHOOK_SECRET');
    expect(r.faltantes.join(' | ')).toContain('SMTP_PASS');
  });

  it('rechaza NEXT_PUBLIC_APP_URL apuntando a localhost', async () => {
    const { validarServerEnv } = await import('@/lib/env');
    const r = validarServerEnv({
      NEXT_PUBLIC_APP_URL: 'http://localhost:3000'
    } as unknown as NodeJS.ProcessEnv);

    expect(r.faltantes.join(' | ')).toContain('notification_url');
  });

  it('assertServerEnv lanza en producción con el entorno incompleto', async () => {
    const { assertServerEnv } = await import('@/lib/env');
    expect(() =>
      assertServerEnv({ NODE_ENV: 'production' } as NodeJS.ProcessEnv)
    ).toThrow(/Configuración de entorno incompleta/);
  });

  it('requireEnv devuelve null cuando la variable está vacía', async () => {
    const { requireEnv } = await import('@/lib/env');
    expect(requireEnv('MERCADOPAGO_ACCESS_TOKEN', {} as NodeJS.ProcessEnv)).toBeNull();
    expect(
      requireEnv('MERCADOPAGO_ACCESS_TOKEN', { MERCADOPAGO_ACCESS_TOKEN: 'tok' } as unknown as NodeJS.ProcessEnv)
    ).toBe('tok');
  });

  it('la compra responde 503 (no 500) si falta el token de MercadoPago', () => {
    const c = leer(COMPRA);
    expect(c).toContain("requireEnv('MERCADOPAGO_ACCESS_TOKEN')");
    expect(c).toContain('status: 503');
  });
});
