/**
 * Dinero: comisiones de ventas que nunca se cobraron, y la compra de créditos.
 *
 * `DiscountCodeUse` (la comisión del vendedor) se crea junto con la compra,
 * ANTES de saber si MercadoPago aprueba el pago. Si el pago se rechaza o el
 * OXXO/SPEI nunca se paga, el webhook marca la compra como 'failed' pero la
 * comisión queda viva: el panel la mostraba como pagable y la sumaba a ventas e
 * ingresos, así que el admin podía liquidar comisiones de ventas inexistentes.
 *
 * Y la compra: se cobraba en MercadoPago antes de registrar nada, así que
 * cualquier fallo posterior dejaba un cargo sin rastro y sin forma de conciliar.
 */
import fs from 'fs';
import path from 'path';

const readFile = (filePath: string): string =>
  fs.readFileSync(path.join(process.cwd(), filePath), 'utf-8');

describe('Comisiones: sólo cuentan las de compras pagadas', () => {
  it('el listado y los totales del panel filtran por compra pagada', () => {
    const c = readFile('src/app/api/admin/vendors/commissions/route.ts');
    expect(c).toContain("const SOLO_COMPRAS_PAGADAS = { purchase: { paymentStatus: 'paid' } }");
    // el filtro va en el where del listado y en los dos agregados
    expect(c).toMatch(/whereClause: Record<string, unknown> = \{ \.\.\.SOLO_COMPRAS_PAGADAS \}/);
    expect((c.match(/\.\.\.SOLO_COMPRAS_PAGADAS/g) || []).length).toBeGreaterThanOrEqual(3);
  });

  it('las estadísticas por vendedor y las globales también', () => {
    const v = readFile('src/app/api/admin/vendors/route.ts');
    expect((v.match(/purchase: \{ paymentStatus: 'paid' \}/g) || []).length).toBeGreaterThanOrEqual(3);
  });

  it('lo que ve el propio vendedor en sus ventas, igual', () => {
    const s = readFile('src/app/api/vendor/my-sales/route.ts');
    expect((s.match(/purchase: \{ paymentStatus: 'paid' \}/g) || []).length).toBeGreaterThanOrEqual(4);
  });

  it('no se puede liquidar la comisión de una compra no pagada', () => {
    const c = readFile('src/app/api/admin/vendors/commissions/[id]/route.ts');
    expect(c).toContain('purchase: { select: { paymentStatus: true } }');
    expect(c).toMatch(/status === 'paid' && commission\.purchase\?\.paymentStatus !== 'paid'/);
    expect(c).toContain('status: 409');
  });
});

describe('Compra de créditos: nunca un cargo sin rastro', () => {
  const c = readFile('src/app/api/credits/purchases/route.ts');

  it('la compra se registra ANTES de cobrar', () => {
    const iCreate = c.indexOf('prisma.creditPurchase.create');
    const iPay = c.indexOf('await payment.create');
    expect(iCreate).toBeGreaterThan(-1);
    expect(iPay).toBeGreaterThan(-1);
    expect(iCreate).toBeLessThan(iPay);
  });

  it('el id de la compra viaja como external_reference y hay idempotencyKey', () => {
    expect(c).toContain('paymentBody.external_reference = String(purchase.id)');
    expect(c).toMatch(/idempotencyKey: `inakat-purchase-\$\{purchase\.id\}`/);
  });

  it('si el cobro falla, la compra queda marcada como failed', () => {
    const bloque = c.slice(c.indexOf('await payment.create'));
    expect(bloque.slice(0, 900)).toMatch(/paymentStatus: 'failed'/);
  });

  it('el camino síncrono usa el mismo reclamo atómico que el webhook', () => {
    // Si la notificación llega a la vez que la respuesta síncrona, sólo uno acredita.
    expect(c).toMatch(
      /creditPurchase\.updateMany\(\{\s*where: \{ id: purchase\.id, paymentStatus: \{ not: 'paid' \} \}/
    );
    expect(c).toContain('if (claimed.count === 0)');
  });
});

describe('Webhook: concilia aunque no se haya guardado el paymentId', () => {
  const w = readFile('src/app/api/webhooks/mercadopago/route.ts');

  it('busca por external_reference cuando no encuentra por paymentId', () => {
    expect(w).toContain('paymentInfo.external_reference');
    expect(w).toMatch(/findUnique\(\{ where: \{ id: refId \} \}\)/);
  });

  it('valida que la referencia sea un id real antes de usarla', () => {
    expect(w).toMatch(/Number\.isInteger\(refId\) && refId > 0/);
  });

  it('guarda el paymentId para que los reintentos la encuentren por la vía normal', () => {
    const bloque = w.slice(w.indexOf('Compra conciliada por external_reference'));
    expect(bloque.slice(0, 500)).toMatch(/data: \{ paymentId: String\(paymentId\) \}/);
  });
});

describe('Página de compra: los precios salen de la base de datos', () => {
  it('pide los paquetes a una ruta que el middleware no bloquea', () => {
    const p = readFile('src/app/credits/purchase/page.tsx');
    expect(p).toContain("fetch('/api/credit-packages')");
    // no debe quedar ninguna LLAMADA a la ruta de admin (el comentario que
    // explica por qué se movió sí puede mencionarla)
    expect(p).not.toMatch(/fetch\(\s*['"`][^'"`]*\/api\/admin\/credit-packages/);
  });

  it('ya no hay una lista de precios escrita a mano', () => {
    const p = readFile('src/app/credits/purchase/page.tsx');
    expect(p).not.toContain('DEFAULT_PACKAGES');
  });

  it('si no cargan, se avisa en vez de enseñar precios que quizá no existen', () => {
    const p = readFile('src/app/credits/purchase/page.tsx');
    expect(p).toMatch(/No pudimos cargar los paquetes de créditos/);
  });

  it('la ruta pública sólo devuelve paquetes activos', () => {
    const r = readFile('src/app/api/credit-packages/route.ts');
    expect(r).toContain('where: { isActive: true }');
  });
});
