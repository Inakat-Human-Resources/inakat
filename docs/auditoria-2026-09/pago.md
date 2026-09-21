# Créditos, pagos, precios, descuentos y vendedores

[← volver al índice](../AUDITORIA-2026-09.md) · 51 hallazgos — 🟠 6 high · 🟡 21 medium · ⚪ 24 low

## 🟠 high (6)

#### PAGO-001 — Comisiones de compras NO pagadas (rechazadas/pendientes/fallidas) aparecen como pagables y se suman a ventas e ingresos

- **Severidad:** 🟠 high · **Categoría:** payments · **Estado:** nuevo · **Verificación:** ✅ verificada contra el código
- **Ubicación:** `src/app/api/admin/vendors/commissions/route.ts:44` · relacionados: `src/app/api/admin/vendors/route.ts`, `src/app/api/admin/vendors/commissions/[id]/route.ts`, `src/app/api/credits/purchases/route.ts`, `src/app/api/webhooks/mercadopago/route.ts`, `src/app/api/vendor/my-sales/route.ts`, `src/app/admin/vendors/page.tsx`
- **Problema:** DiscountCodeUse se crea en POST /api/credits/purchases inmediatamente despues de payment.create, ANTES de saber si el pago fue aprobado, con commissionStatus='pending'. Si MercadoPago devuelve status 'rejected', o el OXXO/SPEI nunca se paga, el webhook solo marca CreditPurchase.paymentStatus='failed'; el DiscountCodeUse queda intacto. Ninguna consulta del panel admin filtra por purchase.paymentStatus: ni el listado de comisiones, ni los agregados pending/paid, ni las stats por vendedor y globales de /api/admin/vendors, ni el PUT que marca como pagada. La UI tampoco muestra el estado del pago de la compra.
- **Comprobación:** Confirmado: `whereClause` sólo filtra por `commissionStatus` y `vendorId`; nunca por `purchase.paymentStatus`.
- **Evidencia:**

```ts
// src/app/api/admin/vendors/commissions/route.ts
    const whereClause: Record<string, unknown> = {};
    if (status) {
      whereClause.commissionStatus = status;
    }

// src/app/api/credits/purchases/route.ts (antes de comprobar 'approved')
        paymentStatus: 'pending', // Se actualiza a 'paid' en la transacción si es approved
    ...
      await prisma.discountCodeUse.create({
        data: {
          codeId: validDiscountCode.id,
          purchaseId: purchase.id,
          ...
```

- **Escenario de fallo:** Una empresa (o alguien coludido con un vendedor) intenta comprar Pack 10 con el codigo JUAN10 usando una tarjeta que es rechazada, 5 veces. Se crean 5 CreditPurchase (pending -> failed) y 5 DiscountCodeUse con comision pendiente de $3,150 cada una. En /admin/vendors el admin ve 'Pendientes (5)', 'Monto Venta $31,500', boton 'Marcar Pagada', Ventas=5 e Ingresos=$157,500, sin ningun indicio de que no se cobro nada. El admin transfiere $15,750 de comisiones por ventas inexistentes.
- **Arreglo propuesto:** Filtrar por purchase: { paymentStatus: 'paid' } en findMany/count/aggregate de commissions/route.ts y en vendors/route.ts (uses: { where: { purchase: { paymentStatus: 'paid' } } } y ambos aggregate). En PUT commissions/[id] rechazar con 409 si la compra no esta 'paid'. Mejor aun: crear el DiscountCodeUse solo cuando el pago se aprueba (rama approved de purchases y dentro de la transaccion del webhook), o anularlo cuando el webhook marca 'failed'. Aplicar el mismo filtro en /api/vendor/my-sales.
- **Otros auditores añaden:** Filtrar siempre por compra pagada: en commissions/route.ts anadir `whereClause.purchase = { paymentStatus: 'paid' }` y el mismo filtro en los dos `aggregate` (pendingSum/paidSum); en vendors/route.ts usar `uses: { where: { purchase: { paymentStatus: 'paid' } }, select: {...} }` y `where: { purchase: { paymentStatus: 'paid' } }` en globalStats/pendingGlobal; replicarlo en src/app/api/vendor/my-sales/route.ts. Mejor aun: crear el DiscountCodeUse solo cuando el pago queda aprobado (dentro de la transaccion de purchases/route.ts y en la transaccion del webhook), guardando el codigo en la compra mientras tanto. Devolver ademas `purchase.paymentStatus` en la respuesta.

#### PAGO-002 — Se cobra en MercadoPago ANTES de registrar la compra: cualquier fallo posterior deja cargo sin registro ni creditos

- **Severidad:** 🟠 high · **Categoría:** payments · **Estado:** nuevo · **Verificación:** ✅ verificada contra el código
- **Ubicación:** `src/app/api/credits/purchases/route.ts:170` · relacionados: `src/app/api/webhooks/mercadopago/route.ts`, `prisma/schema.prisma`
- **Problema:** El flujo es payment.create (cargo real a la tarjeta) -> creditPurchase.create -> discountCodeUse.create -> transaccion de acreditacion. No hay fila previa ni external_reference ni idempotencyKey. Si cualquier paso posterior al cargo lanza (timeout/pool de Postgres, funcion serverless terminada, P2002 en DiscountCodeUse), el catch responde 500 'Error al procesar el pago' aunque la tarjeta YA fue cobrada. Si fallo creditPurchase.create no existe fila, asi que el webhook responde 404 'Purchase not found' en todos los reintentos y los creditos nunca se acreditan; no hay forma de conciliar desde el panel de MP porque el pago no lleva external_reference.
- **Comprobación:** Confirmado: `payment.create` (cobro real) ocurre antes de `creditPurchase.create`.
- **Evidencia:**

```ts
const paymentResult = await payment.create({
  body: paymentBody
});
...
// Registrar compra en DB (siempre como pending...)
const purchase = await prisma.creditPurchase.create({
  data: {
    userId: payload.userId,
    ...
    paymentId: String(paymentResult.id),
```

- **Escenario de fallo:** Empresa paga Pack 20 ($65,000). MP aprueba y cobra. prisma.creditPurchase.create falla por un corte de conexion a la BD. La API responde 500 'Error al procesar el pago'; la empresa cree que fallo y reintenta -> segundo cargo. El webhook del primer pago responde 404 indefinidamente: $65,000 cobrados, 0 creditos, sin registro en CreditPurchase.
- **Arreglo propuesto:** 1) Crear primero la fila CreditPurchase en 'pending' con un UUID propio (nuevo campo externalReference unico). 2) Llamar payment.create con external_reference=ese UUID y requestOptions.idempotencyKey=ese UUID. 3) Guardar paymentId con un update. 4) En el webhook, si no se encuentra por paymentId, buscar por paymentInfo.external_reference. 5) Envolver los pasos posteriores al cargo en try/catch propio y, si fallan, responder 202 'Pago recibido, acreditacion en proceso' (nunca 'error al procesar el pago') dejando que el webhook complete.
- **Otros auditores añaden:** Crear primero la fila CreditPurchase en estado 'pending' (sin paymentId) y enviar a MP external_reference = purchase.id y requestOptions.idempotencyKey = purchase.id; tras payment.create guardar paymentId. En el webhook buscar por paymentId y, si no hay match, por external_reference. Mover el insert de DiscountCodeUse dentro de la misma transaccion inicial. Responder 200 (no 404) a webhooks no conciliables despues de registrarlos para revision.

#### PAGO-003 — DiscountCodeUse (comision del vendor) se crea antes de que el pago se apruebe y ninguna consulta de comisiones filtra por estado del pago

- **Severidad:** 🟠 high · **Categoría:** payments · **Estado:** nuevo · **Verificación:** ✅ verificada contra el código
- **Ubicación:** `src/app/api/credits/purchases/route.ts:192` · relacionados: `src/app/api/webhooks/mercadopago/route.ts`, `src/app/api/vendor/my-sales/route.ts`, `src/app/api/admin/vendors/route.ts`, `src/app/api/admin/vendors/commissions/route.ts`, `prisma/schema.prisma`
- **Problema:** La compra se registra 'pending' y, si hubo codigo, se inserta DiscountCodeUse con commissionStatus 'pending' inmediatamente, sea cual sea paymentResult.status (approved, in_process, pending de OXXO/SPEI, o rejected). El webhook solo marca CreditPurchase.paymentStatus='failed' en rechazo/cancelacion; nunca toca DiscountCodeUse. vendor/my-sales, admin/vendors y admin/vendors/commissions agregan por codeId/commissionStatus sin mirar purchase.paymentStatus.
- **Comprobación:** Confirmado: `discountCodeUse.create` con `commissionStatus: "pending"` se ejecuta sin mirar `paymentResult.status`.
- **Evidencia:**

```ts
    // Si se usó código de descuento, registrar el uso
    if (validDiscountCode) {
      const commissionAmount = Math.round(finalPrice * (validDiscountCode.commissionPercent / 100));
      await prisma.discountCodeUse.create({
        data: { codeId: validDiscountCode.id, purchaseId: purchase.id, companyUserId: payload.userId,
          originalPrice, discountAmount, finalPrice, commissionAmount,
          commissionStatus: 'pending', paymentDueDate: getCommissionDueDate() }
      });
// src/app/api/admin/vendors/commissions/route.ts:133-135
      prisma.discountCodeUse.aggregate({ where: { commissionStatus: 'pending' }, _sum: { commissionAmount: true },
```

- **Escenario de fallo:** Una empresa intenta comprar Pack 20 ($65,000) con el codigo de un vendor y la tarjeta es rechazada, o elige OXXO y nunca paga. Queda una fila DiscountCodeUse con comision pendiente de ~$5,850. El vendor la ve como venta y 'comision pendiente' en /vendor, el admin la ve en el total por pagar y puede marcarla 'paid' y transferir dinero por una venta que nunca se cobro. Reintentos de la misma empresa generan varias comisiones fantasma.
- **Arreglo propuesto:** Crear DiscountCodeUse solo cuando el pago quede 'paid': dentro de la misma transaccion que acredita creditos (en purchases POST cuando status==='approved' y en el webhook al reclamar el pago). Para ello guardar discountCodeId/montos en CreditPurchase (o en metadata) al crear la compra. Como defensa adicional, filtrar todas las consultas de comisiones con purchase: { paymentStatus: 'paid' } y limpiar las filas existentes ligadas a compras no pagadas.
- **Otros auditores añaden:** Crear el DiscountCodeUse SOLO cuando el pago queda aprobado, dentro de la misma transaccion que acredita creditos (tanto en la ruta de compra como en el webhook; guardar el codeId/porcentajes en la compra o en metadata para poder crearlo desde el webhook). Como defensa adicional, anadir purchase: { paymentStatus: 'paid' } a todos los findMany/count/aggregate de my-sales, admin/vendors y admin/vendors/commissions, y rechazar en PUT commissions/[id] marcar 'paid' si la compra no esta 'paid'. — Crear el DiscountCodeUse solo cuando el pago quede 'approved' (en la transaccion de acreditacion de purchases/route.ts y en la del webhook; guardar discountCodeId/discountAmount en CreditPurchase mientras tanto). Como defensa, filtrar en admin/vendors, admin/vendors/commissions y vendor/my-sales por purchase: { paymentStatus: 'paid' } y bloquear PUT commissions/[id] a 'paid' si la compra no esta pagada. Script para borrar los usos huerfanos existentes.

#### PAGO-004 — Compra de creditos: el camino sincrono 'approved' no usa el reclamo atomico del webhook -> posible doble acreditacion

- **Severidad:** 🟠 high · **Categoría:** payments · **Estado:** arreglo previo incompleto · **Verificación:** ✅ verificada contra el código
- **Ubicación:** `src/app/api/credits/purchases/route.ts:217` · relacionados: `src/app/api/webhooks/mercadopago/route.ts`
- **Problema:** El fix #7/#35 hizo idempotente el webhook con updateMany({ paymentStatus: { not: 'paid' } }), pero la respuesta sincrona de POST /api/credits/purchases, cuando MercadoPago devuelve approved, marca paid e incrementa creditos de forma INCONDICIONAL. Como el pago se crea con notification_url, el webhook del mismo pago llega en paralelo; entre creditPurchase.create (pending) y el commit de esta transaccion hay una ventana (que incluye el insert de DiscountCodeUse) en la que el webhook reclama y acredita, y despues esta transaccion vuelve a acreditar.
- **Comprobación:** Confirmado: el camino síncrono usa `creditPurchase.update` incondicional, mientras el webhook usa `updateMany({where:{paymentStatus:{not:"paid"}}})`. La asimetría deja una ventana de doble acreditación.
- **Evidencia:**

```ts
if (paymentResult.status === 'approved') {
  const balanceBefore = user.credits;
  const { updatedUser, updatedPurchase } = await prisma.$transaction(async (tx) => {
    const updatedPurchase = await tx.creditPurchase.update({
      where: { id: purchase.id },
      data: { paymentStatus: 'paid', paidAt: new Date() }
    });
    const updatedUser = await tx.user.update({
      where: { id: payload.userId },
      data: { credits: { increment: pkg.credits } }
    });
```

- **Escenario de fallo:** Empresa compra Pack 10 con tarjeta. MP aprueba y dispara el webhook de inmediato. La ruta inserta la compra 'pending' (linea 177); el webhook entra, encuentra la compra, la reclama (count=1) y suma 10 creditos + asiento. Milisegundos despues la ruta sincrona ejecuta su transaccion sin condicion y suma otros 10 con un segundo asiento: 20 creditos por el precio de 10. Bajo carga (pool lento) la ventana se ensancha.
- **Arreglo propuesto:** Extraer una funcion compartida creditPurchaseOnce(tx, purchaseId) en src/lib/credits.ts con el mismo reclamo atomico (updateMany where paymentStatus != 'paid'; si count===0 no acreditar y devolver el saldo actual) y usarla tanto en el webhook como en esta ruta. Calcular balanceBefore a partir del saldo devuelto por el update, no de user.credits leido antes.
- **Otros auditores añaden:** Extraer una funcion compartida fulfillPurchase(tx, purchaseId, paymentId) con el mismo updateMany({ where: { id, paymentStatus: { not: 'paid' } } }) y usarla en ambos sitios; en la ruta, si claimed.count===0 no incrementar y devolver el saldo actual.

#### PAGO-005 — Cualquier usuario autenticado (p. ej. un candidato auto-registrado) puede crear un codigo 10%/10%: el bloqueo de auto-referido #34 se evade con una segunda cuenta

- **Severidad:** 🟠 high · **Categoría:** authz · **Estado:** arreglo previo incompleto · **Verificación:** ✅ verificada contra el código
- **Ubicación:** `src/app/api/vendor/my-code/route.ts:72` · relacionados: `src/middleware.ts`, `src/app/api/credits/purchases/route.ts`, `src/components/commons/Navbar.tsx`, `src/app/api/auth/register/route.ts`
- **Problema:** POST /api/vendor/my-code solo exige x-user-id; no comprueba rol. El middleware lo deja abierto a cualquier autenticado a proposito, pero la UI (Navbar L334: 'Solo para admin y vendor') y el alta de vendedores via POST /api/admin/vendors asumen que solo admin crea vendedores y fija porcentajes. El registro publico crea cuentas 'candidate' sin verificacion de email (emailVerified: new Date()). El fix #34 solo compara foundCode.userId === payload.userId, por lo que basta otra cuenta gratuita para auto-referirse.
- **Comprobación:** Confirmado: el POST sólo resuelve `userId` de las cabeceras; no comprueba rol.
- **Evidencia:**

```ts
export async function POST(request: NextRequest) {
  try {
    const userId = getUserIdFromHeaders(request);
    if (!userId) {
      return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 401 });
    }
    ...
    const discountCode = await prisma.discountCode.create({
      data: { code: normalizedCode, userId, discountPercent: 10, commissionPercent: 10, isActive: true },
```

- **Escenario de fallo:** El dueno de una empresa se registra como candidato con otro email, hace POST /api/vendor/my-code {code:'MIO2026'} y usa ese codigo en todas las compras de su empresa: 10% de descuento permanente y ademas aparece como vendedor con 10% de comision por cobrar sobre sus propias compras. Cualquier candidato puede tambien publicar su codigo y generar pasivo de comisiones no autorizado.
- **Arreglo propuesto:** En POST/PUT/GET de /api/vendor/* exigir rol con requireRole(['vendor','admin']) (y anadir la comprobacion de rol en middleware para /api/vendor/ y /vendor/). Mantener la creacion de codigos solo via admin. Opcional: bloquear en la compra codigos cuyo vendedor comparta email/dominio/RFC con la empresa compradora.
- **Otros auditores añaden:** En vendor/my-code (POST/PUT) y vendor/my-sales exigir requireRole(['vendor','admin']); anadir '/api/vendor/' y '/vendor/' al bloque de roles del middleware. Si el negocio quiere codigos abiertos, requerir aprobacion del admin (isActive=false por defecto) antes de que el codigo sea utilizable.

#### PAGO-006 — La pagina de compra recibe 403 del middleware al pedir los paquetes y cae a precios hardcodeados que pueden diferir del monto realmente cobrado

- **Severidad:** 🟠 high · **Categoría:** payments · **Estado:** pendiente conocido de junio · **Verificación:** ✅ verificada contra el código
- **Ubicación:** `src/app/credits/purchase/page.tsx:68` · relacionados: `src/middleware.ts`, `src/app/api/admin/credit-packages/route.ts`, `src/app/api/credits/purchases/route.ts`
- **Problema:** Detalle nuevo sobre el pendiente #28: la empresa pide /api/admin/credit-packages?activeOnly=true, pero src/middleware.ts trata todo /api/admin/ como admin-only y devuelve 403 JSON a role=company, por lo que el branch 'activeOnly sin auth' de la ruta es inalcanzable. El cliente interpreta success=false y usa DEFAULT_PACKAGES (4000/35000/50000/65000). El Brick de MercadoPago se inicializa con ese monto, pero el servidor cobra pkg.price de la base de datos. Los paquetes que el admin configure en /admin/credit-packages jamas se reflejan al comprador.
- **Comprobación:** Confirmado: `fetch("/api/admin/credit-packages?activeOnly=true")` con fallback a `DEFAULT_PACKAGES` hardcodeados en el propio archivo.
- **Evidencia:**

```ts
const response = await fetch('/api/admin/credit-packages?activeOnly=true');
const data = await response.json();
if (data.success && data.data.length > 0) {
  setPackages(data.data);
  ...
} else {
  // Usar paquetes por defecto si no hay en la BD
  setPackages(DEFAULT_PACKAGES);
// middleware.ts:84  pathname.startsWith('/api/admin/') ||  ... if (isAdminRoute && payload.role !== 'admin') -> 403
// credits/purchases/route.ts:138  transaction_amount: finalPrice  (desde pkg.price de la DB)
```

- **Escenario de fallo:** El admin sube el Pack 10 a $39,000 en /admin/credit-packages. La empresa entra a /credits/purchase, ve 'Pack 10 — $35,000' y el formulario de tarjeta muestra $35,000, pero POST /api/credits/purchases crea el pago con transaction_amount 39,000: se le cobran $4,000 mas de lo mostrado (o menos, si el admin bajo el precio). Si el admin desactiva el pack de 15, la UI lo sigue ofreciendo y la compra falla con 'Paquete no disponible'.
- **Arreglo propuesto:** Crear GET /api/credit-packages (fuera de /api/admin, solo isActive, con Cache-Control corto) y consumirlo desde la pagina; eliminar DEFAULT_PACKAGES y mostrar error si no carga. Enviar packageId y que el servidor resuelva por id (no por PACKAGE_CREDITS fijo). Como defensa, que el cliente envie expectedAmount y el servidor rechace con 409 si difiere de finalPrice calculado.
- **Otros auditores añaden:** Crear GET /api/credit-packages (solo activos, fuera de /api/admin, con auth de empresa o publica) y consumirla aqui; eliminar el fallback DEFAULT_PACKAGES (mostrar error y boton reintentar). Ademas, que el cliente envie expectedAmount y el servidor responda 409 si difiere de su finalPrice calculado, para que nunca se cobre un monto distinto al mostrado. — Crear GET /api/credit-packages publico/autenticado (fuera de /api/admin) que devuelva solo paquetes activos y usarlo en la pagina; eliminar DEFAULT_PACKAGES (si la API falla, mostrar error y deshabilitar la compra). En la respuesta del POST devolver el monto cobrado y, antes de cobrar, comparar con el precio que el cliente dice haber visto (expectedPrice) y rechazar con 409 si difiere.

## 🟡 medium (21)

#### PAGO-007 — Listas de vendedores, pendientes e historial truncadas a 20 sin paginacion en la UI

- **Severidad:** 🟡 medium · **Categoría:** frontend-bug · **Estado:** nuevo · **Verificación:** sin verificar (reportada por 2 auditores)
- **Ubicación:** `src/app/admin/vendors/page.tsx:153` · relacionados: `src/app/api/admin/vendors/route.ts`, `src/app/api/admin/vendors/commissions/route.ts`
- **Problema:** Las APIs paginan con limit=20 por defecto y devuelven data.pagination, pero la pagina nunca envia page/limit ni renderiza controles de paginacion. Los contadores (tab 'Pendientes (N)', banner 'N comisiones pendientes por $X', card Vendedores) muestran el total real, mientras la tabla lista como maximo 20. En pendientes el orden es createdAt desc, asi que las que quedan ocultas son las MAS ANTIGUAS (las mas cercanas a su fecha limite).
- **Evidencia:**

```ts
// page.tsx
      const res = await fetch(`/api/admin/vendors?search=${vendorSearch}`);
...
      const res = await fetch(`/api/admin/vendors/commissions${statusParam}`);

// commissions/route.ts
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    ...
        skip,
        take: limit
```

- **Escenario de fallo:** Hay 27 comisiones pendientes. El banner dice '27 comisiones pendientes por $85,050' pero la tabla muestra 20; las 7 mas antiguas (con paymentDueDate mas proximo) no se pueden ver ni pagar hasta liquidar las nuevas. En Historial solo se ven los ultimos 20 pagos; el vendedor #21 en adelante solo aparece si se le busca por nombre.
- **Arreglo propuesto:** Guardar page en estado por lista, enviar ?page=&limit= y renderizar Anterior/Siguiente usando data.pagination.totalPages (o 'Cargar mas'). Para pendientes ordenar por paymentDueDate asc.
- **Otros auditores añaden:** const qs = new URLSearchParams({ search: vendorSearch }); fetch(`/api/admin/vendors?${qs}`).

#### PAGO-008 — Errores de carga silenciosos: un 401/500 se muestra como 'No hay comisiones pendientes / Todas las comisiones han sido pagadas'

- **Severidad:** 🟡 medium · **Categoría:** ux · **Estado:** nuevo · **Verificación:** sin verificar (reportada por 1 auditor)
- **Ubicación:** `src/app/admin/vendors/page.tsx:156`
- **Problema:** fetchVendors y fetchCommissions solo manejan data.success === true y excepciones de red. Si la API responde {success:false} (401 del middleware por JWT expirado, 403, 500), no hay rama else: no se notifica nada, las listas quedan vacias, las stats en 0 y se renderizan los estados vacios, que afirman que no hay nada que pagar.
- **Evidencia:**

```ts
      if (data.success) {
        setCommissions(data.data.commissions || []);
        setCommissionSummary(data.data.summary || {
          pending: { count: 0, total: 0 },
          paid: { count: 0, total: 0 }
        });
      }
    } catch (error) {
      console.error('Error fetching commissions:', error);
```

- **Escenario de fallo:** El admin deja la pestana abierta y su JWT expira (o Prisma falla y la API devuelve 500). Al recargar datos, el middleware responde 401 JSON; la pagina muestra 'Pendientes (0)' y 'Todas las comisiones han sido pagadas' sin aviso de error. El admin concluye que no debe nada a los vendedores.
- **Arreglo propuesto:** Agregar else { setNotification({ type: 'error', message: data.error || 'No se pudieron cargar los datos' }) } en ambas funciones, comprobar res.ok, redirigir a login en 401 y usar un estado loadError para no renderizar los estados vacios cuando hubo error.

#### PAGO-009 — El admin no puede desactivar ni editar el codigo/porcentajes de un vendedor; desactivar al usuario no desactiva el codigo

- **Severidad:** 🟡 medium · **Categoría:** correctness · **Estado:** nuevo · **Verificación:** sin verificar (reportada por 1 auditor)
- **Ubicación:** `src/app/admin/vendors/page.tsx:577` · relacionados: `src/app/api/admin/vendors/route.ts`, `src/app/api/vendor/my-code/route.ts`, `src/app/api/discount-codes/validate/route.ts`, `src/app/api/credits/purchases/route.ts`
- **Problema:** La columna Estado es de solo lectura y la tabla no muestra discountPercent/commissionPercent aunque la API los devuelve. /api/admin/vendors solo exporta GET y POST: no existe endpoint admin para cambiar isActive o porcentajes (el unico prisma.discountCode.update del repo esta en /api/vendor/my-code, que usa el propio vendedor y le permite reactivarse). Ademas, /api/discount-codes/validate y /api/credits/purchases solo comprueban discountCode.isActive, no user.isActive, asi que desactivar al usuario en /admin/users no invalida su codigo.
- **Evidencia:**

```ts
<td className="px-6 py-4 text-center">
  <span className={`px-3 py-1 rounded-full text-xs font-medium ${
    vendor.isActive
      ? 'bg-green-100 text-green-800'
      : 'bg-gray-100 text-gray-800'
  }`}>
    {vendor.isActive ? 'Activo' : 'Inactivo'}
  </span>
</td>
```

- **Escenario de fallo:** El admin crea un vendedor con % Comisión 100 por error de dedo (o el vendedor es dado de baja). No hay forma desde el panel de corregir el porcentaje ni de desactivar el codigo; desactivar al usuario tampoco sirve: el codigo sigue dando descuento y generando comisiones pendientes. La unica salida es editar la BD a mano.
- **Arreglo propuesto:** Agregar PATCH /api/admin/vendors/[id] (isActive, discountPercent, commissionPercent con validacion 0 <= x < 100) y en la UI: mostrar los porcentajes, toggle de estado con confirmacion y modal de edicion. En validate y purchases exigir tambien user: { isActive: true }.

#### PAGO-010 — La URL de comprobante persiste entre modales de pago: puede guardarse el comprobante de A en la comision B

- **Severidad:** 🟡 medium · **Categoría:** frontend-bug · **Estado:** nuevo · **Verificación:** sin verificar (reportada por 1 auditor)
- **Ubicación:** `src/app/admin/vendors/page.tsx:815`
- **Problema:** paymentProofUrl solo se limpia en el camino de exito (linea 218). Cerrar el modal con la X (815) o con Cancelar (866) y abrirlo para otra comision (689) conserva el texto anterior, que aparece prellenado y se envia con 'Confirmar Pago'. La UI no ofrece revertir ni editar el comprobante despues.
- **Evidencia:**

```ts
<button
  onClick={() => setPaymentModal({ isOpen: false, commission: null })}
  className="text-gray-400 hover:text-gray-600"
>
  <X className="w-5 h-5" />
</button>
...
onClick={() => setPaymentModal({ isOpen: true, commission: comm })}
```

- **Escenario de fallo:** El admin abre 'Marcar Pagada' para la comision de Juan, pega https://banco/comprobante-juan.pdf y cancela porque el monto no coincide. Abre la de Maria: el campo ya trae la URL de Juan. Pulsa 'Confirmar Pago' y la comision de Maria queda registrada con el comprobante de Juan, visible tambien para Maria en /vendor/dashboard.
- **Arreglo propuesto:** Centralizar openPaymentModal(comm) y closePaymentModal() que hagan setPaymentProofUrl('') y usarlos en las lineas 689, 815 y 866.

#### PAGO-011 — Porcentajes de descuento/comision: vacio -> 0, min/max inoperantes (inputs fuera de <form>), decimales truncados y clamp silencioso en la API

- **Severidad:** 🟡 medium · **Categoría:** validation · **Estado:** nuevo · **Verificación:** sin verificar (reportada por 1 auditor)
- **Ubicación:** `src/app/admin/vendors/page.tsx:1016` · relacionados: `src/app/api/admin/vendors/route.ts`
- **Problema:** Los inputs usan parseInt(...) || 0: un campo vacio se convierte en 0 y '12.5' en 12 (aunque la columna es Float y la API usa parseFloat). El modal no es un <form>, asi que min/max (y type=email/url) nunca se validan. La API no rechaza valores fuera de rango: los recorta a [0,100], y NaN se vuelve 10. Se admite 100% de descuento, que produce finalPrice 0 y un pago que MercadoPago no puede procesar. Como no existe edicion de vendedores, el error es irreversible desde el panel.
- **Evidencia:**

```ts
// page.tsx
  type="number"
  min={0}
  max={100}
  value={createForm.discountPercent}
  onChange={(e) => setCreateForm(prev => ({ ...prev, discountPercent: parseInt(e.target.value) || 0 }))}

// route.ts
    const finalDiscount = Number.isNaN(parsedDiscount)
      ? 10
      : Math.min(100, Math.max(0, parsedDiscount));
```

- **Escenario de fallo:** El admin borra '% Comisión' para reescribirlo, se distrae y pulsa 'Crear Vendedor': el vendedor queda con 0% de comision sin aviso. O teclea 150 en '% Descuento': la API guarda 100 sin avisar; toda compra con ese codigo calcula finalPrice=0 y falla con 'No se pudo procesar el pago'.
- **Arreglo propuesto:** Mantener los porcentajes como string en estado y validar al enviar (numero, 0 <= x < 100, mostrar error en createError). En la API devolver 400 si el valor no es numerico o esta fuera de rango en lugar de recortar o asumir 10.

#### PAGO-012 — PUT de comision sin guarda de estado: re-marcar 'paid' sobrescribe fecha de pago y borra el comprobante

- **Severidad:** 🟡 medium · **Categoría:** data-integrity · **Estado:** nuevo · **Verificación:** sin verificar (reportada por 2 auditores)
- **Ubicación:** `src/app/api/admin/vendors/commissions/[id]/route.ts:89` · relacionados: `src/app/admin/vendors/page.tsx`
- **Problema:** El handler no compara el estado actual con el solicitado. Marcar como 'paid' una comision ya pagada reescribe commissionPaidAt con la fecha actual, y como la UI siempre envia paymentProofUrl (null si el campo esta vacio), tambien pisa el comprobante existente. Tampoco hay 409 ni registro del actor (esto ultimo ya esta en el pendiente #32; la ausencia de guarda de transicion es nueva).
- **Evidencia:**

```ts
    if (status) {
      updateData.commissionStatus = status;

      // Si se marca como pagado, guardar fecha
      if (status === 'paid') {
        updateData.commissionPaidAt = new Date();
      } else if (status === 'pending') {
        // Si se revierte a pending, limpiar fecha de pago
        updateData.commissionPaidAt = null;
      }
    }

    if (paymentProofUrl !== undefined) {
      updateData.paymentProofUrl = paymentProofUrl;
```

- **Escenario de fallo:** Dos admins tienen abierta la pestana Pendientes. A marca la comision #5 como pagada con su comprobante. B, con la lista vieja, pulsa 'Marcar Pagada' en la #5 sin URL: el PUT responde 200, commissionPaidAt pasa a la hora de B y paymentProofUrl queda en null. Se pierde el comprobante de A y es probable una doble transferencia real.
- **Arreglo propuesto:** Usar updateMany({ where: { id, commissionStatus: 'pending' }, data }) para marcar como pagada y devolver 409 'La comisión ya fue pagada' si count === 0; exigir un flag explicito para revertir a pending; no sobrescribir paymentProofUrl con null si ya existe; registrar paidByUserId.
- **Otros auditores añaden:** En el findUnique incluir `purchase: { select: { paymentStatus: true } }` y responder 409 si no es 'paid'. Si `commission.commissionStatus === 'paid'` y llega 'paid', no tocar commissionPaidAt (o 409). Usar `updateMany({ where: { id, commissionStatus: 'pending' }, data })` y comprobar `count === 1` para que sea atomico. Para revertir a 'pending' exigir un motivo y limpiar tambien paymentProofUrl.

#### PAGO-013 — paymentProofUrl sin validar (tipo/esquema) y sin registrar que admin marco el pago; se renderiza como href al vendedor

- **Severidad:** 🟡 medium · **Categoría:** validation · **Estado:** pendiente conocido de junio · **Verificación:** sin verificar (reportada por 2 auditores)
- **Ubicación:** `src/app/api/admin/vendors/commissions/[id]/route.ts:101` · relacionados: `src/app/vendor/dashboard/page.tsx`, `src/app/admin/vendors/page.tsx`, `prisma/schema.prisma`
- **Problema:** Pendiente conocido #32, con detalle nuevo: el valor se guarda tal cual (cualquier tipo o esquema). Se renderiza como `href` en src/app/vendor/dashboard/page.tsx (lineas 487 y 568) y en src/app/admin/vendors/page.tsx:785. El input del modal es type="url" pero NO esta dentro de un <form> (el boton usa onClick), asi que el navegador no valida nada. Ademas `auth.userId` se lee en la linea 31 pero nunca se persiste: el modelo DiscountCodeUse (prisma/schema.prisma:717-750) no tiene campo para el actor.
- **Evidencia:**

```ts
    if (paymentProofUrl !== undefined) {
      updateData.paymentProofUrl = paymentProofUrl;
    }
```

- **Escenario de fallo:** El admin pega 'drive.google.com/file/abc' (sin https://) -> se guarda -> en /vendor/dashboard el enlace 'Ver comprobante' apunta a /vendor/drive.google.com/file/abc (ruta relativa, 404). Si se envia un numero u objeto por API, Prisma lanza error de validacion y la respuesta es 500 en vez de 400. Tampoco queda registro de que administrador marco pagada la comision.
- **Arreglo propuesto:** Validar `typeof paymentProofUrl === 'string'`, parsear con `new URL()` y exigir protocolo http/https (mismo criterio que el arreglo #55 de fileUrl); aceptar null para limpiar. Anadir `commissionPaidById Int?` a DiscountCodeUse (migracion) y guardar `roleCheck.user.id` al marcar 'paid'.
- **Otros auditores añaden:** Validar typeof === 'string', longitud maxima y new URL(value).protocol in ['http:','https:'] (misma regla que el fix #55 de fileUrl); 400 si no cumple. Validar igual en el cliente antes de enviar.

#### PAGO-014 — El telefono capturado al crear vendedor se descarta en silencio

- **Severidad:** 🟡 medium · **Categoría:** data-integrity · **Estado:** nuevo · **Verificación:** sin verificar (reportada por 1 auditor)
- **Ubicación:** `src/app/api/admin/vendors/route.ts:187` · relacionados: `src/app/admin/vendors/page.tsx`, `prisma/schema.prisma`
- **Problema:** El modal 'Nuevo Vendedor' pide Teléfono y lo envia en el body; la API lo desestructura pero nunca lo usa, y el modelo User no tiene columna de telefono. La respuesta es 201 con mensaje de exito, por lo que el admin cree que quedo guardado.
- **Evidencia:**

```ts
      email,
      telefono,
      password,
...
    const newUser = await prisma.user.create({
      data: {
        nombre: nombre.trim(),
        apellidoPaterno: apellidoPaterno.trim(),
        apellidoMaterno: apellidoMaterno?.trim() || null,
        email: email.toLowerCase().trim(),
        password: hashedPassword,
        role: 'vendor',
        isActive: true,
      }
```

- **Escenario de fallo:** El admin registra a un vendedor con su celular para poder avisarle de pagos de comision. 'Vendedor creado exitosamente'. El dato no existe en ninguna tabla; cuando lo necesita no esta en ningun lado.
- **Arreglo propuesto:** Agregar telefono String? a User (migracion) y persistirlo con validacion de 10 digitos, o quitar el campo del modal y del destructuring.

#### PAGO-015 — Alta de vendedor sin politica de contrasena, sin validar email y descartando el telefono que pide el formulario

- **Severidad:** 🟡 medium · **Categoría:** validation · **Estado:** nuevo · **Verificación:** sin verificar (reportada por 2 auditores)
- **Ubicación:** `src/app/api/admin/vendors/route.ts:195` · relacionados: `src/app/admin/vendors/page.tsx`, `src/app/api/auth/reset-password/route.ts`
- **Problema:** Solo se comprueba que los campos sean truthy. No hay longitud/complejidad de contrasena (registro y reset exigen min 8 + mayuscula + numero; admin/users exige min 6; el placeholder de la UI dice 'Minimo 6 caracteres' pero nadie lo aplica). No se valida formato de email ni tipos (`email.toLowerCase()` con un numero lanza TypeError -> 500). `telefono` se desestructura (linea 187) pero nunca se guarda: el modelo User no tiene ese campo. Los porcentajes fuera de [0,100] se recortan en silencio.
- **Evidencia:**

```ts
    if (!nombre || !apellidoPaterno || !email || !password || !code) {
      return NextResponse.json(
        { success: false, error: 'Nombre, apellido paterno, email, contraseña y código son requeridos' },
        { status: 400 }
      );
    }
```

- **Escenario de fallo:** El admin crea un vendedor con contrasena '1' y email 'juan@' -> 201. La cuenta queda con credencial trivial y un email al que no llegara la recuperacion de contrasena. El telefono capturado en el modal desaparece sin aviso. Con discountPercent 150 se guarda 100% sin advertencia (precio final 0 -> MercadoPago rechaza el pago).
- **Arreglo propuesto:** Validar con zod: email `.email()`, password con la misma politica que src/app/api/auth/reset-password/route.ts, code `/^[A-Z0-9_-]{3,20}$/`, porcentajes `.min(0).max(100)` devolviendo 400 en vez de recortar. Quitar el campo Telefono del modal o anadir la columna al modelo.
- **Otros auditores añaden:** Validar el body con zod reutilizando la regla de register (min 8, /[A-Z]/, /[0-9]/) y z.string().email(); replicar la validacion en handleCreateVendor y corregir el placeholder.

#### PAGO-016 — Alta de vendedor no es transaccional: si falla la creacion del codigo queda un User huerfano y el reintento da 409

- **Severidad:** 🟡 medium · **Categoría:** data-integrity · **Estado:** nuevo · **Verificación:** sin verificar (reportada por 2 auditores)
- **Ubicación:** `src/app/api/admin/vendors/route.ts:230`
- **Problema:** `prisma.user.create` y `prisma.discountCode.create` se ejecutan por separado. La unicidad del codigo se comprueba antes con findUnique (check-then-act), por lo que una carrera o cualquier error en el segundo insert deja creado el usuario 'vendor' sin codigo.
- **Evidencia:**

```ts
    const newUser = await prisma.user.create({
      data: {
        nombre: nombre.trim(),
        ...
        role: 'vendor',
        isActive: true,
      }
    });
    ...
    const newCode = await prisma.discountCode.create({
      data: {
        code: code.toUpperCase().trim(),
        userId: newUser.id,
```

- **Escenario de fallo:** El admin crea el vendedor juan@x.com con codigo JUAN10. Entre el findUnique del codigo y el create, otro usuario registra JUAN10 desde /api/vendor (o hay un corte de BD): discountCode.create lanza P2002 -> 500 'Error al crear vendedor'. El User ya existe. El admin reintenta -> 409 'Ya existe un usuario con ese email'. El vendedor puede iniciar sesion pero no tiene codigo ni aparece en /admin/vendors (que lista codigos).
- **Arreglo propuesto:** Envolver ambos inserts en `prisma.$transaction(async (tx) => {...})` y mapear P2002 a 409 con mensaje segun `error.meta.target` (email o code).
- **Otros auditores añaden:** Envolver ambas escrituras en prisma.$transaction(async tx => ...) y mapear P2002 a 409 con mensaje especifico segun meta.target (email o code).

#### PAGO-017 — Sin validacion central de entorno: mapa concreto de variables cuya ausencia degrada en silencio

- **Severidad:** 🟡 medium · **Categoría:** config · **Estado:** pendiente conocido de junio · **Verificación:** sin verificar (reportada por 1 auditor)
- **Ubicación:** `src/app/api/credits/purchases/route.ts:16` · relacionados: `src/app/api/webhooks/mercadopago/route.ts`, `src/lib/email.ts`, `src/app/api/upload/route.ts`, `src/app/api/auth/forgot-password/route.ts`, `.env.example`
- **Problema:** Pendiente menor #88. Detalle nuevo tras hacer grep de process.env en src: solo JWT_SECRET falla al arrancar. El resto: MERCADOPAGO_ACCESS_TOKEN se usa con `!` a nivel de modulo en 2 rutas (undefined -> 500 generico al pagar); MERCADOPAGO_WEBHOOK_SECRET ausente en produccion -> 500 en cada notificacion; NEXT_PUBLIC_MERCADOPAGO_PUBLIC_KEY ausente -> 'Error de configuracion' en el checkout; SMTP_USER/PASS ausentes -> sendEmail devuelve false y forgot-password responde exito sin enviar nada; NEXT_PUBLIC_APP_URL ausente o con 'localhost' -> no se envia notification_url a MercadoPago; BLOB_READ_WRITE_TOKEN ausente -> 503 en subidas; NEXT_PUBLIC_BASE_URL no documentada. Nada de esto se detecta en build ni en CI.
- **Evidencia:**

```ts
src/app/api/credits/purchases/route.ts:16-18
const client = new MercadoPagoConfig({
  accessToken: process.env.MERCADOPAGO_ACCESS_TOKEN!
});
:164-167
    const appUrl = process.env.NEXT_PUBLIC_APP_URL;
    if (appUrl && !appUrl.includes('localhost')) {
      paymentBody.notification_url = `${appUrl}/api/webhooks/mercadopago`;
src/lib/email.ts:95-97
  if (!transport) { console.warn('[Email] Skipping email (SMTP not configured):', subject); return false; }
```

- **Escenario de fallo:** En un redeploy o al crear el entorno Preview se olvida NEXT_PUBLIC_APP_URL o SMTP_PASS: los pagos OXXO/SPEI se crean sin notification_url y nunca se confirman; los usuarios que piden reset ven 'recibiras un enlace' y no llega nada. Ningun log de arranque ni check lo advierte.
- **Arreglo propuesto:** Crear src/lib/env.ts con un schema zod (server y client) que se importe desde next.config.ts y falle el build si en produccion falta cualquiera de: DATABASE_URL, DIRECT_URL, JWT_SECRET(>=32), MERCADOPAGO_ACCESS_TOKEN, MERCADOPAGO_WEBHOOK_SECRET, NEXT_PUBLIC_MERCADOPAGO_PUBLIC_KEY, NEXT_PUBLIC_APP_URL (https), BLOB_READ_WRITE_TOKEN, SMTP_USER, SMTP_PASS, NEXT_PUBLIC_GOOGLE_MAPS_API_KEY; sustituir todos los process.env.X por env.X; anadir el chequeo al paso de build del CI.

#### PAGO-018 — El servidor resuelve el paquete por cantidad de creditos con un mapa hardcodeado e ignora el packageId que envia la UI

- **Severidad:** 🟡 medium · **Categoría:** payments · **Estado:** nuevo · **Verificación:** sin verificar (reportada por 2 auditores)
- **Ubicación:** `src/app/api/credits/purchases/route.ts:49` · relacionados: `src/app/credits/purchase/page.tsx`, `src/app/api/admin/credit-packages/route.ts`, `prisma/schema.prisma`
- **Problema:** PACKAGE_CREDITS solo conoce pack_1/10/15/20, mientras que el admin puede crear paquetes con cualquier cantidad. La busqueda es findFirst({ credits, isActive }) sin orderBy, y CreditPackage no tiene unique sobre credits: con dos paquetes activos de la misma cantidad el precio cobrado es arbitrario. La UI manda packageId pero la API lo descarta.
- **Evidencia:**

```ts
const credits = PACKAGE_CREDITS[packageType as keyof typeof PACKAGE_CREDITS];
if (!credits) {
  return NextResponse.json({ error: 'Tipo de paquete inválido' }, { status: 400 });
}

const pkg = await prisma.creditPackage.findFirst({
  where: {
    credits: credits,
    isActive: true
  }
});
```

- **Escenario de fallo:** (1) Admin crea 'Pack 5' -> la UI enviaria packageType 'pack_5' -> 400 'Tipo de paquete invalido': paquete imposible de comprar. (2) Admin crea 'Pack 10 Promo' a $30,000 sin desactivar 'Pack 10' de $35,000 -> el comprador elige la promo y findFirst puede devolver el de $35,000: se cobra $5,000 de mas.
- **Arreglo propuesto:** Validar Number.isInteger(packageId) y buscar prisma.creditPackage.findFirst({ where: { id: packageId, isActive: true } }); derivar credits y packageType (`pack_${pkg.credits}`) de la fila. Eliminar PACKAGE_CREDITS.
- **Otros auditores añaden:** Enviar packageId desde el cliente y resolver con findUnique({ where: { id } }) validando isActive; eliminar PACKAGE_CREDITS. Guardar packageId en CreditPurchase (FK) en lugar de packageType string. Si se quiere impedir duplicados, @@unique([credits]) sobre paquetes activos (indice parcial).

#### PAGO-019 — Los pagos aprobados al instante (el unico flujo real de la UI) nunca envian email de confirmacion ni notificacion

- **Severidad:** 🟡 medium · **Categoría:** reliability · **Estado:** nuevo · **Verificación:** sin verificar (reportada por 1 auditor)
- **Ubicación:** `src/app/api/credits/purchases/route.ts:213` · relacionados: `src/app/api/webhooks/mercadopago/route.ts`, `src/lib/email.ts`
- **Problema:** sendPaymentConfirmation y createNotification('credits_purchased') solo se llaman en el webhook, y solo cuando el webhook es quien acredita. En el flujo normal de tarjeta la ruta de compra acredita de forma sincrona sin enviar nada; cuando luego llega el webhook, la compra ya esta 'paid' y sale por el early-return 'alreadyProcessed' (webhook L166-169) sin notificar.
- **Evidencia:**

```ts
// MEJ-003: Si el pago fue aprobado inmediatamente, agregar créditos usando transacción
if (paymentResult.status === 'approved') {
  const balanceBefore = user.credits;
  const { updatedUser, updatedPurchase } = await prisma.$transaction(async (tx) => {
    ...
  });
  console.info('[Payments] Credits added:', ...);
  return NextResponse.json({ success: true, status: 'approved', ...
```

- **Escenario de fallo:** Empresa paga $65,000 con tarjeta, MP aprueba al instante. Ve un toast de 1.5 s y es redirigida al dashboard. No recibe el correo 'Pago confirmado' ni la notificacion in-app; no le queda ningun comprobante de la operacion.
- **Arreglo propuesto:** Tras la transaccion de la rama approved, ejecutar el mismo Promise.allSettled([createNotification(...), sendPaymentConfirmation(...)]) que el webhook (idealmente dentro del helper comun fulfillPurchase para que solo notifique quien gano el reclamo atomico).

#### PAGO-020 — El vendedor puede reactivar su propio codigo via PUT y el admin no tiene ninguna ruta para desactivar o editar codigos

- **Severidad:** 🟡 medium · **Categoría:** authz · **Estado:** nuevo · **Verificación:** sin verificar (reportada por 1 auditor)
- **Ubicación:** `src/app/api/vendor/my-code/route.ts:212` · relacionados: `src/app/api/admin/vendors/route.ts`, `src/app/admin/vendors/page.tsx`
- **Problema:** PUT /api/vendor/my-code acepta isActive del propio dueno del codigo (la UI no lo usa, pero la API si). No existe /api/admin/vendors/[id] ni ningun otro endpoint que modifique DiscountCode: el admin ve 'Activo/Inactivo' en /admin/vendors pero no puede cambiarlo ni ajustar porcentajes despues de crearlo. Si se desactiva un codigo fraudulento directamente en BD, el vendedor lo reactiva con una llamada.
- **Evidencia:**

```ts
// Si se proporciona isActive, actualizar
if (typeof isActive === 'boolean') {
  updateData.isActive = isActive;
}
```

- **Escenario de fallo:** Se detecta un vendedor abusando del sistema y se pone isActive=false en la BD. El vendedor envia PUT /api/vendor/my-code {"isActive":true} -> 200 y el codigo vuelve a ser valido en /api/discount-codes/validate y en las compras.
- **Arreglo propuesto:** Eliminar isActive del PUT del vendedor (o permitir solo true->false). Crear PUT /api/admin/vendors/[id] (requireRole admin) para isActive, discountPercent y commissionPercent con cotas [0,100], y anadir un campo deactivatedByAdmin que el vendedor no pueda revertir.

#### PAGO-021 — El chequeo anti-replay asume que 'ts' viene en milisegundos sin normalizar

- **Severidad:** 🟡 medium · **Categoría:** reliability · **Estado:** nuevo · **Verificación:** sin verificar (reportada por 2 auditores)
- **Ubicación:** `src/app/api/webhooks/mercadopago/route.ts:74` · relacionados: `__tests__/api/webhook-idempotency.test.ts`
- **Problema:** ts se compara directamente contra Date.now(). El ejemplo de la documentacion oficial de MercadoPago muestra ts de 10 digitos (ts=1704908010, segundos). Si MP entrega segundos, timestampMs (~1.7e9) siempre es menor que fiveMinutesAgo (~1.7e12) y el 100% de los webhooks firmados se rechaza con 401 'Timestamp too old', de modo que ningun pago pendiente/in_process se acredita jamas. No hay ningun test sobre validateMercadoPagoSignature que fije el formato esperado (no existe 'x-signature' en __tests__). No pude verificar la unidad real contra una notificacion de produccion: debe confirmarse, pero el codigo no deberia depender de ello.
- **Evidencia:**

```ts
// Opcional: verificar que el timestamp no sea muy antiguo (prevenir replay attacks)
const timestampMs = parseInt(ts);
const fiveMinutesAgo = Date.now() - (5 * 60 * 1000);

if (timestampMs < fiveMinutesAgo) {
  return { isValid: false, reason: 'Timestamp too old (possible replay attack)' };
}
```

- **Escenario de fallo:** Pago con 3DS queda 'in_process'; minutos despues MP lo aprueba y envia el webhook con ts en segundos. La firma HMAC es correcta pero el chequeo de antiguedad lo rechaza con 401; MP reintenta y siempre falla. La compra queda 'pending' para siempre con el cliente ya cobrado.
- **Arreglo propuesto:** Normalizar: let tsMs = Number(ts); if (!Number.isFinite(tsMs)) return invalid; if (tsMs < 1e12) tsMs *= 1000; Ampliar la tolerancia (p. ej. 15 min) y apoyarse en la idempotencia ya existente. Anadir tests unitarios de la funcion con ts en ambos formatos, firma valida/invalida y cabeceras ausentes.
- **Otros auditores añaden:** Normalizar la unidad (`const tsMs = ts.length <= 10 ? Number(ts) * 1000 : Number(ts)`), rechazar NaN, y anadir tests con MERCADOPAGO_WEBHOOK_SECRET fijado: firma valida, firma alterada, falta x-request-id, ts en segundos y en ms, ts de hace 10 min. Capturar un header real de produccion para confirmar la unidad.

#### PAGO-022 — Reembolsos y contracargos: el early-return por 'paid' los descarta sin registrar; creditos y comision del vendedor se conservan

- **Severidad:** 🟡 medium · **Categoría:** payments · **Estado:** pendiente conocido de junio · **Verificación:** sin verificar (reportada por 1 auditor)
- **Ubicación:** `src/app/api/webhooks/mercadopago/route.ts:166` · relacionados: `src/app/api/credits/purchases/route.ts`, `prisma/schema.prisma`
- **Problema:** Pendiente conocido #38, con detalle nuevo: (1) cualquier notificacion posterior de un pago ya acreditado (refunded, charged_back, in_mediation) sale por este early-return ANTES de mirar paymentInfo.status, por lo que ni siquiera queda log del estado; (2) la cadena de estados de L172/L259 solo contempla approved/rejected/cancelled; (3) el DiscountCodeUse asociado sigue 'pending' y el admin puede pagar comision de una venta devuelta; (4) no existe ninguna ruta de admin para restar creditos (no hay ningun uso de type 'admin_adjustment' en src/), asi que el proceso manual tampoco es posible sin tocar la BD.
- **Evidencia:**

```ts
// Si ya fue procesado, no hacer nada (idempotencia)
if (purchase.paymentStatus === 'paid') {
  console.warn('[Webhook] Payment already processed:', { purchaseId: purchase.id });
  return NextResponse.json({ received: true, alreadyProcessed: true });
}
```

- **Escenario de fallo:** Empresa compra Pack 20 con codigo de vendedor, publica vacantes y despues disputa el cargo con su banco. MP notifica status 'charged_back': el webhook responde alreadyProcessed. La empresa conserva los 20 creditos, la compra sigue 'paid', el vendedor sigue con $5,850 de comision pendiente de pago.
- **Arreglo propuesto:** Mover el early-return dentro de la rama approved. Anadir rama para 'refunded' | 'charged_back': en transaccion, reclamar con updateMany({ where: { id, paymentStatus: 'paid' }, data: { paymentStatus: 'refunded' } }), decrementar creditos (permitiendo saldo negativo o bloqueando la cuenta, segun negocio), asiento CreditTransaction type 'refund' negativo, marcar DiscountCodeUse como 'cancelled' y notificar a admin.

#### PAGO-023 — Precio con descuento obsoleto al cambiar de paquete: la revalidacion falla en silencio (rate limit 10/15 min) y se muestra un total distinto al que se cobra

- **Severidad:** 🟡 medium · **Categoría:** frontend-bug · **Estado:** nuevo · **Verificación:** sin verificar (reportada por 1 auditor)
- **Ubicación:** `src/app/credits/purchase/page.tsx:94` · relacionados: `src/app/api/discount-codes/validate/route.ts`, `src/lib/rate-limit.ts`
- **Problema:** El total del resumen y el amount del Brick salen de discountInfo.pricing.finalPrice, que fue calculado por el servidor para el paquete que estaba seleccionado al validar. Cada cambio de paquete dispara otra llamada a /api/discount-codes/validate, limitada a 10 por 15 min por IP; ante 429 o error de red el catch es silencioso y discountInfo conserva el pricing del paquete anterior. El servidor cobra siempre pkg.price - descuento del paquete enviado.
- **Evidencia:**

```ts
const finalPrice = discountInfo?.pricing?.finalPrice || originalPrice;
...
const data = await response.json();
if (data.success && data.valid) {
  setDiscountInfo(data.data);
}
} catch {
  // Silent fail for revalidation
}
```

- **Escenario de fallo:** Usuario aplica el codigo con Pack 10 (finalPrice 31,500) y va comparando paquetes; tras ~10 clics la API responde 429. Selecciona Pack 20 y continua: el resumen muestra 'Precio original $65,000 / Tu precio $31,500 / Ahorras $3,500' y el Brick 'Pagar $31,500'; POST /api/credits/purchases cobra $58,500.
- **Arreglo propuesto:** No depender de 'pricing' del servidor para mostrar: calcular en cliente discountAmount = Math.round(selectedPkg.price * discountInfo.discountPercent / 100) (igual que ya hacen las tarjetas en L397-400) y eliminar el efecto de revalidacion. Completar con el chequeo expectedAmount en el servidor (409 si no coincide).

#### PAGO-024 — El formulario de pago puede no renderizarse nunca: SDK cargado con lazyOnload y onLoad vacio

- **Severidad:** 🟡 medium · **Categoría:** frontend-bug · **Estado:** nuevo · **Verificación:** sin verificar (reportada por 1 auditor)
- **Ubicación:** `src/app/credits/purchase/page.tsx:169`
- **Problema:** El efecto que monta el Brick solo corre cuando cambian showCheckout/selectedPkg/discountInfo y exige que window.MercadoPago exista en ese momento. El script usa strategy='lazyOnload' (se carga en idle tras window.load) y onLoad es una funcion vacia, asi que si el usuario pulsa 'Continuar al Pago' antes de que termine de cargar, el efecto no hace nada y nada lo vuelve a disparar. Tampoco hay onError: si un bloqueador impide cargar sdk.mercadopago.com no se muestra ningun mensaje.
- **Evidencia:**

```ts
useEffect(() => {
  if (
    showCheckout &&
    selectedPkg &&
    typeof window !== 'undefined' &&
    (window as any).MercadoPago
  ) {
    initMercadoPago();
  }
}, [showCheckout, selectedPkg, discountInfo]);
...
<Script src="https://sdk.mercadopago.com/js/v2" strategy="lazyOnload" onLoad={() => {}} />
```

- **Escenario de fallo:** Empresa llega desde el modal de 'creditos insuficientes' con conexion lenta, el Pack 10 ya viene preseleccionado y pulsa 'Continuar al Pago' en 1-2 s. window.MercadoPago aun no existe: la tarjeta 'Informacion de Pago' queda vacia indefinidamente, sin error ni spinner. Solo se arregla volviendo atras y entrando de nuevo.
- **Arreglo propuesto:** const [sdkReady, setSdkReady] = useState(false); <Script strategy='afterInteractive' onLoad={() => setSdkReady(true)} onReady={() => setSdkReady(true)} onError={() => setNotification({type:'error', message:'No se pudo cargar Mercado Pago'})} />; anadir sdkReady a la condicion y a las dependencias del efecto, y mostrar un loader mientras !sdkReady.

#### PAGO-025 — El SDK de MercadoPago se carga con lazyOnload y onLoad vacio: si el usuario abre el checkout antes de que cargue, el formulario de pago nunca aparece

- **Severidad:** 🟡 medium · **Categoría:** frontend-bug · **Estado:** nuevo · **Verificación:** sin verificar (reportada por 1 auditor)
- **Ubicación:** `src/app/credits/purchase/page.tsx:344`
- **Problema:** El efecto que monta el Brick solo corre cuando cambian showCheckout/selectedPkg/discountInfo y exige que window.MercadoPago ya exista. El script usa strategy='lazyOnload' (se descarga en idle tras window.onload) y su onLoad es una funcion vacia, por lo que al terminar de cargar nada vuelve a disparar el efecto.
- **Evidencia:**

```ts
src/app/credits/purchase/page.tsx:169-178
  useEffect(() => {
    if (showCheckout && selectedPkg && typeof window !== 'undefined' && (window as any).MercadoPago) {
      initMercadoPago();
    }
  }, [showCheckout, selectedPkg, discountInfo]);
:344-348
      <Script
        src="https://sdk.mercadopago.com/js/v2"
        strategy="lazyOnload"
        onLoad={() => {}}
      />
```

- **Escenario de fallo:** Una empresa entra a /credits/purchase con red lenta (o navegacion cliente, donde lazyOnload tarda mas) y pulsa el boton de pagar en los primeros segundos: showCheckout pasa a true, window.MercadoPago aun es undefined, el efecto no hace nada; cuando el SDK llega, onLoad no cambia ningun estado. El modal muestra #mp-checkout-container vacio, sin spinner ni error, hasta que el usuario cierra y reabre o cambia de paquete.
- **Arreglo propuesto:** Anadir `const [sdkReady, setSdkReady] = useState(false)`, `onLoad={() => setSdkReady(true)}` (y `onReady` para navegaciones donde el script ya estaba), incluir sdkReady en las dependencias del efecto, usar strategy='afterInteractive', y mostrar un loader/errores (onError) mientras no este listo.

#### PAGO-026 — El panel del vendedor no pagina: solo se ven las 20 ventas mas recientes

- **Severidad:** 🟡 medium · **Categoría:** frontend-bug · **Estado:** nuevo · **Verificación:** sin verificar (reportada por 1 auditor)
- **Ubicación:** `src/app/vendor/dashboard/page.tsx:116` · relacionados: `src/app/api/vendor/my-sales/route.ts`
- **Problema:** GET /api/vendor/my-sales pagina con limit=20 por defecto y devuelve 'pagination', pero la pagina llama sin parametros, ignora data.data.pagination y no tiene controles de pagina. Las tarjetas de resumen si cuentan todo, asi que el vendedor ve 'Ventas: 57' y una tabla con 20 filas sin forma de ver el resto ni sus comprobantes.
- **Evidencia:**

```ts
const res = await fetch('/api/vendor/my-sales');
const data = await res.json();

if (data.success) {
  setSales(data.data.sales || []);
  setSummary(data.data.summary || { ... });
}
```

- **Escenario de fallo:** Vendedor con 45 ventas quiere revisar el comprobante de pago de una comision de hace 3 meses: la fila no aparece en la tabla (solo las 20 ultimas) y no hay paginacion ni filtro.
- **Arreglo propuesto:** Guardar page y pagination en estado, llamar /api/vendor/my-sales?page=N&limit=20 y anadir controles Anterior/Siguiente (mismo patron que /admin/vendors).

#### PAGO-027 — calculateJobCreditCost devuelve 5 creditos por defecto cuando la combinacion no existe: permite pagar menos enviando un seniority/workMode inexistente

- **Severidad:** 🟡 medium · **Categoría:** payments · **Estado:** nuevo · **Verificación:** sin verificar (reportada por 1 auditor)
- **Ubicación:** `src/lib/pricing.ts:73` · relacionados: `src/app/api/jobs/route.ts`, `src/app/api/jobs/publish/route.ts`, `src/app/api/pricing/calculate/route.ts`
- **Problema:** Si no hay fila en PricingMatrix la funcion devuelve DEFAULT_CREDITS=5 con found:false, y los endpoints de publicacion usan ese valor sin mirar 'found'. La matriz sembrada llega a 18 creditos. POST /api/jobs valida profile contra el catalogo pero NO valida seniority ni workMode, asi que un valor que no matchee (mayusculas, espacio final, 'onsite') cobra 5. Ademas la funcion ignora 'location' aunque el modelo y GET /api/pricing/calculate lo exponen: con filas solo por ubicacion toma la de menor id arbitrariamente.
- **Evidencia:**

```ts
  if (pricingAny) {
    return { credits: pricingAny.credits, found: true, ... };
  }

  // No se encontró precio, usar valor por defecto
  return { credits: DEFAULT_CREDITS, found: false };
}
```

- **Escenario de fallo:** Empresa envia POST /api/jobs con profile 'Tecnología', seniority 'Director ' (con espacio) y workMode 'remote', publishNow:true. No hay match en la matriz -> 5 creditos en lugar de 18. La vacante se guarda con seniority 'Director '.
- **Arreglo propuesto:** En los endpoints que cobran, tratar found:false como error 400 ('Combinacion sin precio configurado') en vez de cobrar el default; validar seniority y workMode contra las listas activas de la matriz. Dejar el default solo para la estimacion en /api/pricing/calculate, o eliminarlo. Decidir si 'location' forma parte del precio e implementarlo o quitarlo del modelo/GET.

## ⚪ low (24)

#### PAGO-028 — Condicion de carrera en fetchCommissions (sin cancelacion ni guarda de orden) y doble fetch al montar

- **Severidad:** ⚪ low · **Categoría:** frontend-bug · **Estado:** nuevo · **Verificación:** sin verificar (reportada por 1 auditor)
- **Ubicación:** `src/app/admin/vendors/page.tsx:140`
- **Problema:** Al montar se ejecutan ambos efectos y fetchCommissions se llama dos veces. Las pestanas Pendientes e Historial comparten el mismo estado commissions y cada cambio de filtro lanza un fetch sin AbortController ni id de peticion: la ultima respuesta en LLEGAR gana, no la ultima solicitada.
- **Evidencia:**

```ts
  useEffect(() => {
    fetchVendors();
    fetchCommissions();
  }, []);

  // Recargar comisiones cuando cambia el filtro
  useEffect(() => {
    fetchCommissions();
  }, [commissionFilter]);
```

- **Escenario de fallo:** El admin pulsa 'Historial de Pagos' y enseguida 'Pendientes'. Si la respuesta de status=paid llega despues que la de status=pending, la pestana Pendientes queda mostrando comisiones YA pagadas, cada una con su boton 'Marcar Pagada' (y el PUT lo acepta, ver hallazgo de guarda de estado). El estado erroneo persiste hasta el siguiente fetch.
- **Arreglo propuesto:** Quitar fetchCommissions del efecto de montaje; en fetchCommissions usar AbortController (abortar la peticion anterior) o un contador de requestId y descartar respuestas viejas; o mantener estados separados pendingCommissions/paidCommissions.

#### PAGO-029 — getRoleLabel/getRoleColor no contemplan el rol 'vendor'

- **Severidad:** ⚪ low · **Categoría:** copy · **Estado:** nuevo · **Verificación:** sin verificar (reportada por 1 auditor)
- **Ubicación:** `src/app/admin/vendors/page.tsx:294`
- **Problema:** Los vendedores creados desde este mismo panel reciben role='vendor', pero el mapa de etiquetas no lo incluye y cae al valor crudo.
- **Evidencia:**

```ts
    const roles: Record<string, string> = {
      admin: 'Administrador',
      company: 'Empresa',
      recruiter: 'Reclutador',
      specialist: 'Especialista',
      candidate: 'Candidato',
      user: 'Usuario'
    };
    return roles[role] || role;
```

- **Escenario de fallo:** Tras crear un vendedor, la columna Rol muestra 'vendor' (ingles, minusculas, badge gris) en lugar de 'Vendedor'.
- **Arreglo propuesto:** Agregar vendor: 'Vendedor' al mapa de etiquetas y un color propio en getRoleColor.

#### PAGO-030 — Los 5 modales de estas paginas carecen de semantica de dialogo, Escape y nombres accesibles en botones de icono

- **Severidad:** ⚪ low · **Categoría:** a11y · **Estado:** arreglo previo incompleto · **Verificación:** sin verificar (reportada por 1 auditor)
- **Ubicación:** `src/app/admin/vendors/page.tsx:810` · relacionados: `src/app/admin/pricing/page.tsx`, `src/app/admin/credit-packages/page.tsx`
- **Problema:** Los fixes #59/#60 de la Fase 4 (role=dialog, aria-modal, Escape, aria-label en botones de cerrar) no alcanzaron estos modales: pago y crear vendedor (vendors), editar y eliminar (pricing), crear/editar (credit-packages). Ninguno tiene role="dialog"/aria-modal/aria-labelledby, cierre con Escape ni gestion de foco. Botones solo-icono sin nombre accesible: X de cierre (vendors 814 y 905; pricing 290, 487 y 591; credit-packages 231 y 385), el '×' de la notificacion (vendors 348) y el toggle de ver contrasena (vendors 984).
- **Evidencia:**

```ts
      {paymentModal.isOpen && paymentModal.commission && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-md w-full">
            ...
              <button
                onClick={() => setPaymentModal({ isOpen: false, commission: null })}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
```

- **Escenario de fallo:** Un admin con lector de pantalla abre 'Marcar Pagada': el foco queda en la tabla de fondo, el contenido no se anuncia como dialogo, el boton de cerrar se lee como 'boton' sin nombre y Escape no cierra; con Tab puede seguir operando la pagina de detras.
- **Arreglo propuesto:** Extraer un componente <Modal> comun (role="dialog", aria-modal, aria-labelledby, cierre con Escape, foco inicial y retorno de foco) y usarlo en los 5 modales; agregar aria-label="Cerrar", "Descartar notificación" y "Mostrar/ocultar contraseña".

#### PAGO-031 — Labels de formularios y filtros no asociados a sus inputs (sin htmlFor/id)

- **Severidad:** ⚪ low · **Categoría:** a11y · **Estado:** nuevo · **Verificación:** sin verificar (reportada por 1 auditor)
- **Ubicación:** `src/app/admin/vendors/page.tsx:917` · relacionados: `src/app/admin/pricing/page.tsx`, `src/app/admin/credit-packages/page.tsx`
- **Problema:** Todos los <label> de los formularios (crear vendedor, URL de comprobante, editar creditos/salario minimo, crear/editar paquete) y de los filtros de pricing son hermanos del input sin htmlFor ni id. El input no tiene nombre accesible y hacer clic en la etiqueta no enfoca el campo. En el modal de pricing incluso se usan <label> para texto de solo lectura.
- **Evidencia:**

```ts
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Nombre *</label>
                  <input
                    type="text"
                    value={createForm.nombre}
                    onChange={(e) => setCreateForm(prev => ({ ...prev, nombre: e.target.value }))}
                    placeholder="Nombre"
```

- **Escenario de fallo:** Con lector de pantalla, los campos '% Descuento' y '% Comisión' se anuncian ambos como 'campo de edicion numerico 10', indistinguibles; el admin puede intercambiar los porcentajes sin saberlo.
- **Arreglo propuesto:** Asignar id unico a cada input/select y htmlFor en su label (o envolver el input dentro del label); sustituir por <span>/<dt> los label de los bloques de solo lectura.

#### PAGO-032 — orderBy commissionStatus 'asc' pone 'paid' antes que 'pending', al reves de lo que dice el comentario

- **Severidad:** ⚪ low · **Categoría:** correctness · **Estado:** nuevo · **Verificación:** sin verificar (reportada por 2 auditores)
- **Ubicación:** `src/app/api/admin/vendors/commissions/route.ts:88`
- **Problema:** Orden lexicografico: 'paid' < 'pending'. Con 'asc' las pagadas salen primero. Solo afecta a consultas sin ?status (la UI define el filtro 'all' en el tipo pero nunca lo selecciona), por lo que hoy es un camino latente.
- **Evidencia:**

```ts
        orderBy: [
          { commissionStatus: 'asc' }, // Pending primero
          { createdAt: 'desc' }
        ],
```

- **Escenario de fallo:** GET /api/admin/vendors/commissions sin status y con mas de 20 pagadas: la primera pagina trae solo comisiones pagadas; las pendientes quedan en paginas posteriores, al contrario de la intencion documentada.
- **Arreglo propuesto:** Usar { commissionStatus: 'desc' } o, mejor, ordenar por paymentDueDate asc dentro de pendientes.
- **Otros auditores añaden:** Cambiar a `{ commissionStatus: 'desc' }` o, mejor, ordenar por `paymentDueDate asc` dentro de las pendientes y no depender del orden alfabetico.

#### PAGO-033 — Codigo muerto: helper getAuthFromHeaders triplicado y redundante, ternario sin efecto, constantes y Set sin uso

- **Severidad:** ⚪ low · **Categoría:** dead-code · **Estado:** nuevo · **Verificación:** sin verificar (reportada por 1 auditor)
- **Ubicación:** `src/app/api/admin/vendors/route.ts:9` · relacionados: `src/app/api/admin/vendors/commissions/route.ts`, `src/app/api/admin/vendors/commissions/[id]/route.ts`, `src/app/api/admin/assignments/route.ts`, `src/app/api/admin/pricing/route.ts`, `src/app/api/admin/pricing/sync/route.ts`
- **Problema:** 1) `getAuthFromHeaders` esta copiado en vendors/route.ts:9-14, commissions/route.ts:8-13 y commissions/[id]/route.ts:12-17; se ejecuta despues de `requireRole('admin')`, que ya valida cookie + rol en BD, y su `userId` nunca se usa. Anade un segundo camino de fallo que responde 401 si faltan los headers del middleware. 2) assignments/route.ts:246 `recruiterStatus: recruiterId ? 'pending' : 'pending'`. 3) pricing/route.ts:8-9 VALID_SENIORITIES / VALID_WORK_MODES sin uso desde que el POST se deshabilito. 4) pricing/sync/route.ts:33 `profilesWithPricing` sin uso.
- **Evidencia:**

```ts
function getAuthFromHeaders(request: NextRequest): { userId: number; role: string } | null {
  const userId = request.headers.get('x-user-id');
  const role = request.headers.get('x-user-role');
  if (!userId || !role) return null;
  return { userId: parseInt(userId), role };
}
// assignments/route.ts:246
        recruiterStatus: recruiterId ? 'pending' : 'pending',
```

- **Escenario de fallo:** Al invocar los handlers de vendors sin pasar por el middleware (tests de integracion o un cambio de matcher) responden 401 'No autorizado' aunque requireRole haya aprobado. El resto es deuda que confunde al mantenedor.
- **Arreglo propuesto:** Eliminar getAuthFromHeaders y su chequeo en los tres archivos y usar `roleCheck.user.id` (que ademas sirve para auditar quien marca una comision). Simplificar el ternario a 'pending'. Borrar las constantes y el Set sin uso, o usar VALID_* para validar los filtros del GET de pricing.

#### PAGO-034 — Parametros de paginacion sin acotar en 3 rutas que no usan getPaginationParams (limit enorme, NaN o negativo -> 500)

- **Severidad:** ⚪ low · **Categoría:** validation · **Estado:** nuevo · **Verificación:** sin verificar (reportada por 3 auditores)
- **Ubicación:** `src/app/api/admin/vendors/route.ts:38` · relacionados: `src/app/api/admin/vendors/commissions/route.ts`, `src/app/api/vendor/my-sales/route.ts`, `src/lib/pagination.ts`
- **Problema:** Cuatro rutas usan el helper (o un clamp equivalente): jobs, admin/candidates, admin/users, admin/interviews, notifications. Tres no: admin/vendors, admin/vendors/commissions y vendor/my-sales hacen parseInt directo de page y limit. limit=abc produce NaN y Prisma lanza error de validacion (500); page=0 da skip negativo (500); limit=100000000 elimina la paginacion; limit negativo invierte el orden. vendor/my-sales es accesible a cualquier usuario autenticado. admin/vendors ademas embebe TODAS las filas uses de cada codigo para sumar en JS en vez de usar groupBy.
- **Evidencia:**

```ts
const page = parseInt(searchParams.get('page') || '1');
const limit = parseInt(searchParams.get('limit') || '20');
const search = searchParams.get('search') || '';
const skip = (page - 1) * limit;
...
uses: { select: { id: true, finalPrice: true, commissionAmount: true, commissionStatus: true } }
...
skip,
take: limit
```

- **Escenario de fallo:** Un usuario autenticado llama GET /api/vendor/my-sales?limit=foo y recibe 500 'Error al obtener ventas' con un stack de PrismaClientValidationError en logs; con ?limit=99999999 obtiene todas las filas con joins de purchase y user en una sola respuesta.
- **Arreglo propuesto:** Reemplazar el parseo manual por getPaginationParams(searchParams, 20) y buildPaginatedResponse en las tres rutas. En admin/vendors sustituir el include de uses por prisma.discountCodeUse.groupBy({ by:['codeId','commissionStatus'], where:{ codeId:{ in: ids } }, _sum:{ finalPrice:true, commissionAmount:true }, _count:true }).
- **Otros auditores añaden:** `const page = Math.max(1, Number.parseInt(...) || 1); const limit = Math.min(100, Math.max(1, Number.parseInt(...) || 20));` y validar vendorId con isNaN -> 400. Anadir paginacion a las tres tablas de la UI usando `data.pagination`. Calcular totalVendors con `distinct: ['userId']` sin el filtro de busqueda. — const page = Math.max(1, Number.parseInt(...) || 1); const limit = Math.min(100, Math.max(1, Number.parseInt(...) || 20)); devolver 400 si vendorId no es entero.

#### PAGO-035 — globalStats.totalVendors usa el conteo filtrado por la busqueda

- **Severidad:** ⚪ low · **Categoría:** correctness · **Estado:** nuevo · **Verificación:** sin verificar (reportada por 1 auditor)
- **Ubicación:** `src/app/api/admin/vendors/route.ts:138`
- **Problema:** totalCount se calcula con whereClause (incluye el filtro search) y se reutiliza como estadistica global. El resto de globalStats no se filtra, asi que al buscar la card 'Vendedores' y la etiqueta del tab cambian mientras Ventas/Ingresos siguen siendo globales.
- **Evidencia:**

```ts
      prisma.discountCode.count({ where: whereClause })
...
        globalStats: {
          totalVendors: totalCount,
          totalSales: globalStats._count,
```

- **Escenario de fallo:** Con 40 vendedores, el admin busca 'maria': la card muestra 'Vendedores 1' y el tab 'Vendedores (1)' junto a Ventas e Ingresos de los 40.
- **Arreglo propuesto:** Calcular aparte prisma.discountCode.count() sin filtro para globalStats.totalVendors y dejar pagination.totalCount para los resultados de busqueda.

#### PAGO-036 — Email y codigo del vendedor sin validacion de formato (y tipos no string => 500)

- **Severidad:** ⚪ low · **Categoría:** validation · **Estado:** nuevo · **Verificación:** sin verificar (reportada por 1 auditor)
- **Ubicación:** `src/app/api/admin/vendors/route.ts:216` · relacionados: `src/app/api/vendor/my-code/route.ts`, `src/app/admin/vendors/page.tsx`
- **Problema:** El input type=email del modal no esta dentro de un <form>, por lo que el navegador no valida; la API tampoco comprueba formato de email. El codigo no pasa por la regla que SI aplica /api/vendor/my-code (4-20 alfanumericos). Si email o code llegan como no-string, .toLowerCase()/.toUpperCase() lanzan TypeError y la respuesta es 500 en vez de 400.
- **Evidencia:**

```ts
    const existingUser = await prisma.user.findUnique({
      where: { email: email.toLowerCase().trim() }
    });
...
    const existingCode = await prisma.discountCode.findUnique({
      where: { code: code.toUpperCase().trim() }
    });
```

- **Escenario de fallo:** El admin escribe 'juan@gmial' o 'juan@' como email: la cuenta se crea, el vendedor no puede iniciar sesion con su correo real ni recibir el reset de contrasena. O crea el codigo 'A' / 'PROMO 10%', que el propio endpoint del vendedor rechazaria.
- **Arreglo propuesto:** Schema zod compartido: email z.string().email(), code con /^[A-Z0-9]{4,20}$/ tras normalizar (extraer validateCodeFormat a src/lib), y 400 para tipos invalidos.

#### PAGO-037 — Entradas mal tipadas provocan 500 en vez de 400 en compra y validacion de codigo

- **Severidad:** ⚪ low · **Categoría:** validation · **Estado:** nuevo · **Verificación:** sin verificar (reportada por 1 auditor)
- **Ubicación:** `src/app/api/credits/purchases/route.ts:142` · relacionados: `src/app/api/discount-codes/validate/route.ts`
- **Problema:** No se valida la forma del body. paymentData ausente -> TypeError al leer payment_method_id; discountCode no string -> TypeError en toUpperCase (L81, ademas sin trim a diferencia de validate); en /api/discount-codes/validate, code no string -> TypeError en code.trim() (L24). Todos caen al catch generico y devuelven 500 (en compra, 'Error al procesar el pago'), lo que ademas ensucia los logs de errores de pago.
- **Evidencia:**

```ts
payment_method_id: paymentData.payment_method_id,
token: paymentData.token,
installments: paymentData.installments || 1,
```

- **Escenario de fallo:** POST /api/credits/purchases {"packageType":"pack_10"} (sin paymentData) -> 500. POST /api/discount-codes/validate {"code":123} -> 500 'Error al validar codigo'.
- **Arreglo propuesto:** Validar con zod al inicio: packageId int, paymentData { token: string no vacio, payment_method_id: string, installments: int 1..12 }, discountCode string opcional con trim/uppercase; responder 400 con detalle. Igual en validate (code: string 4..20).

#### PAGO-038 — balanceBefore del asiento de compra usa un saldo leido antes de llamar a MercadoPago

- **Severidad:** ⚪ low · **Categoría:** data-integrity · **Estado:** nuevo · **Verificación:** sin verificar (reportada por 1 auditor)
- **Ubicación:** `src/app/api/credits/purchases/route.ts:214`
- **Problema:** user se lee en L124, despues viene payment.create (segundos de latencia) y dos inserts; balanceBefore = user.credits puede estar obsoleto mientras balanceAfter sale del saldo real. El webhook ya lo hace bien (updatedUser.credits - purchase.amount).
- **Evidencia:**

```ts
if (paymentResult.status === 'approved') {
  const balanceBefore = user.credits;
```

- **Escenario de fallo:** Durante los segundos del cobro la empresa publica una vacante en otra pestana (-10 creditos). Asiento resultante: balanceBefore=50, amount=+20, balanceAfter=60: el ledger no cuadra (50+20 != 60) y cualquier auditoria de saldos marcara descuadre.
- **Arreglo propuesto:** Dentro de la transaccion: balanceBefore: updatedUser.credits - pkg.credits (igual que el webhook) y eliminar la variable externa.

#### PAGO-039 — Un pago rechazado de forma sincrona se guarda como 'pending' y se responde success:true con 'Pago pendiente de confirmacion'

- **Severidad:** ⚪ low · **Categoría:** correctness · **Estado:** nuevo · **Verificación:** sin verificar (reportada por 1 auditor)
- **Ubicación:** `src/app/api/credits/purchases/route.ts:272`
- **Problema:** La rama final trata todo lo que no sea 'approved' como pendiente, incluido status 'rejected'/'cancelled' (MP devuelve 201, no lanza). La compra queda 'pending' hasta que el webhook la marque 'failed'; en entornos sin notification_url (localhost, o NEXT_PUBLIC_APP_URL sin definir, L164-167) queda 'pending' para siempre. El contrato success:true + message de 'pendiente' para un rechazo es enganoso; la UI solo acierta porque mira data.status.
- **Evidencia:**

```ts
// Pago pendiente (ej: OXXO, transferencia)
return NextResponse.json({
  success: true,
  status: paymentResult.status,
  purchase,
  message: 'Pago pendiente de confirmación',
  paymentId: paymentResult.id,
```

- **Escenario de fallo:** Tarjeta sin fondos: MP responde status 'rejected'. Se crea CreditPurchase 'pending' (+ DiscountCodeUse si hay codigo) y la API responde 200 {success:true, status:'rejected', message:'Pago pendiente de confirmacion'}. En reportes aparecen compras 'pending' que nunca se resolveran.
- **Arreglo propuesto:** Si status es 'rejected' o 'cancelled': actualizar la compra a 'failed', no registrar uso de codigo, y responder 402 { success:false, status, error:'El pago fue rechazado' } (mapear status_detail a un mensaje util). Reservar la rama pendiente para 'pending'/'in_process'.

#### PAGO-040 — La validacion publica del codigo no aplica la regla de auto-referido: el error llega despues de capturar la tarjeta

- **Severidad:** ⚪ low · **Categoría:** ux · **Estado:** nuevo · **Verificación:** sin verificar (reportada por 1 auditor)
- **Ubicación:** `src/app/api/discount-codes/validate/route.ts:27` · relacionados: `src/app/api/credits/purchases/route.ts`
- **Problema:** validate no identifica al usuario (no esta en el matcher del middleware ni lee la cookie), asi que devuelve valid:true para el codigo propio. La UI muestra el descuento aplicado y el total rebajado; el rechazo 'No puedes usar tu propio codigo de descuento' solo aparece al enviar el pago en /api/credits/purchases.
- **Evidencia:**

```ts
const discountCode = await prisma.discountCode.findFirst({
  where: {
    code: normalizedCode,
    isActive: true
  },
  select: { id: true, code: true, discountPercent: true }
});
```

- **Escenario de fallo:** Usuario con codigo propio lo aplica en /credits/purchase: ve '10% de descuento aplicado' y $31,500. Rellena la tarjeta, pulsa Pagar y recibe un error; el token de tarjeta ya se consumio y debe empezar de nuevo.
- **Arreglo propuesto:** En validate, leer opcionalmente la sesion (getOptionalAuthUser) y, si discountCode.userId === user.id, responder valid:false con el mismo mensaje. Incluir userId en el select solo para esa comparacion (no devolverlo).

#### PAGO-041 — /api/pricing/calculate acepta valores no string y los pasa como filtro a Prisma (operadores inyectables / 500)

- **Severidad:** ⚪ low · **Categoría:** validation · **Estado:** nuevo · **Verificación:** sin verificar (reportada por 1 auditor)
- **Ubicación:** `src/app/api/pricing/calculate/route.ts:16` · relacionados: `src/lib/pricing.ts`
- **Problema:** La ruta es publica (no esta en el matcher) y solo comprueba truthiness. Un objeto como {"not":""} es un filtro valido de Prisma y se ejecuta tal cual en calculateJobCreditCost; un numero o array provoca PrismaClientValidationError -> 500. El mismo helper recibe valores sin tipar desde POST /api/jobs y /api/jobs/publish.
- **Evidencia:**

```ts
const body = await request.json();
const { profile, seniority, workMode } = body;

if (!profile || !seniority || !workMode) {
  return NextResponse.json({ success: false, error: 'Campos requeridos: ...' }, { status: 400 });
}

const result = await calculateJobCreditCost(profile, seniority, workMode);
```

- **Escenario de fallo:** POST /api/pricing/calculate {"profile":{"not":""},"seniority":{"not":""},"workMode":{"not":""}} -> devuelve la primera fila de la matriz (consulta arbitraria sin autenticar). {"profile":1,"seniority":1,"workMode":1} -> 500.
- **Arreglo propuesto:** Exigir typeof === 'string' (y longitud maxima) para los tres campos en la ruta y dentro de calculateJobCreditCost; devolver 400 si no.

#### PAGO-042 — Carrera al crear codigo: sin unique por usuario y P2002 devuelto como 500

- **Severidad:** ⚪ low · **Categoría:** reliability · **Estado:** nuevo · **Verificación:** sin verificar (reportada por 1 auditor)
- **Ubicación:** `src/app/api/vendor/my-code/route.ts:83` · relacionados: `prisma/schema.prisma`
- **Problema:** La unicidad 'un codigo por usuario' se comprueba con findFirst antes de crear, y DiscountCode.userId no es unico en el schema. Dos POST concurrentes pasan ambos el chequeo. Si el texto del codigo coincide, el segundo create lanza P2002 y el catch responde 500 generico en vez de 409; si difiere, el usuario queda con dos codigos y GET/PUT/my-sales (findFirst sin orderBy) operan sobre uno arbitrario.
- **Evidencia:**

```ts
const existingCode = await prisma.discountCode.findFirst({
  where: { userId }
});

if (existingCode) {
  return NextResponse.json(
    { success: false, error: 'Ya tienes un código de descuento. Usa PUT para actualizarlo.' },
    { status: 409 }
  );
}
```

- **Escenario de fallo:** Doble clic en guardar (o dos pestanas) al crear el codigo: dos POST simultaneos. Resultado A: 500 'Error al crear codigo de descuento' aunque se creo. Resultado B: dos codigos activos para el mismo vendedor; las ventas del segundo no aparecen en su panel.
- **Arreglo propuesto:** Anadir @unique a DiscountCode.userId (con migracion revisada) y capturar Prisma.PrismaClientKnownRequestError code 'P2002' para responder 409 con mensaje claro en POST y PUT.

#### PAGO-043 — Parametros de paginacion sin validar en my-sales (500 con page=0 o limit no numerico; limit ilimitado)

- **Severidad:** ⚪ low · **Categoría:** validation · **Estado:** nuevo · **Verificación:** sin verificar (reportada por 1 auditor)
- **Ubicación:** `src/app/api/vendor/my-sales/route.ts:46` · relacionados: `src/app/api/admin/vendors/route.ts`, `src/app/api/admin/vendors/commissions/route.ts`
- **Problema:** page y limit se pasan tal cual a skip/take. page=0 da skip=-20 (Prisma lanza -> 500), limit=abc da NaN (-> 500), limit=0 da totalPages=Infinity (se serializa como null) y un limit enorme carga todas las ventas con include de tres niveles.
- **Evidencia:**

```ts
const page = parseInt(searchParams.get('page') || '1');
const limit = parseInt(searchParams.get('limit') || '20');
const skip = (page - 1) * limit;
```

- **Escenario de fallo:** GET /api/vendor/my-sales?page=0 -> 500 'Error al obtener ventas'. GET ?limit=1000000 -> consulta sin tope con joins a purchase->user->companyRequest.
- **Arreglo propuesto:** const page = Math.max(1, parseInt(...) || 1); const limit = Math.min(100, Math.max(1, parseInt(...) || 20)); (mismo saneo en admin/vendors y admin/vendors/commissions, que repiten el patron).

#### PAGO-044 — my-sales expone al vendedor el id interno y el nombre personal del comprador, y consulta su email sin usarlo

- **Severidad:** ⚪ low · **Categoría:** security · **Estado:** nuevo · **Verificación:** sin verificar (reportada por 1 auditor)
- **Ubicación:** `src/app/api/vendor/my-sales/route.ts:58`
- **Problema:** La respuesta incluye company.id (User.id interno) y company.nombre (nombre de la persona que administra la cuenta de empresa); la UI solo usa nombreEmpresa. El select trae ademas email, que no se devuelve pero se carga en cada fila (codigo muerto a un descuido de filtrarse). Como hoy cualquier usuario puede crear un codigo, cualquiera puede recibir estos datos de las empresas que lo usen.
- **Evidencia:**

```ts
user: {
  select: {
    id: true,
    nombre: true,
    email: true,
    companyRequest: { select: { nombreEmpresa: true } }
  }
}
...
company: { id: sale.purchase.user.id, nombre: sale.purchase.user.nombre, nombreEmpresa: ... }
```

- **Escenario de fallo:** Un tercero crea un codigo y lo difunde; cada empresa que lo usa le revela el nombre de su contacto y su id de usuario interno via GET /api/vendor/my-sales.
- **Arreglo propuesto:** Reducir el select a companyRequest.nombreEmpresa y devolver solo nombreEmpresa en 'company'; quitar id, nombre y email.

#### PAGO-045 — Sin tests para la validacion de firma del webhook ni para los estados no aprobados

- **Severidad:** ⚪ low · **Categoría:** tests · **Estado:** nuevo · **Verificación:** sin verificar (reportada por 1 auditor)
- **Ubicación:** `src/app/api/webhooks/mercadopago/route.ts:22` · relacionados: `__tests__/api/webhook-idempotency.test.ts`
- **Problema:** En __tests__ no hay ninguna referencia a 'x-signature' ni a validateMercadoPagoSignature: la suite de idempotencia corre sin MERCADOPAGO_WEBHOOK_SECRET, es decir, saltandose la firma. La unica barrera que impide acreditar creditos con un POST falso no tiene cobertura (firma valida, firma alterada, cabeceras ausentes, ts antiguo/en segundos, secret ausente en produccion -> 500), ni tampoco las ramas rejected/cancelled.
- **Evidencia:**

```ts
function validateMercadoPagoSignature(
  xSignature: string | null,
  xRequestId: string | null,
  dataId: string,
  secret: string
): { isValid: boolean; reason?: string } {
```

- **Escenario de fallo:** Un refactor cambia el manifest (p. ej. el orden 'id:...;request-id:...;ts:...;') o la unidad de ts; CI sigue en verde y en produccion todos los webhooks empiezan a fallar con 401 sin que nadie lo note hasta que un cliente reclama creditos.
- **Arreglo propuesto:** Exportar la funcion a src/lib/mercadopago-signature.ts y anadir tests unitarios con un secret fijo y HMAC calculado en el test; anadir tests de ruta con secret definido para 401/200 y para rejected -> 'failed'.

#### PAGO-046 — El webhook devuelve al llamante el motivo exacto del fallo de firma

- **Severidad:** ⚪ low · **Categoría:** security · **Estado:** nuevo · **Verificación:** sin verificar (reportada por 1 auditor)
- **Ubicación:** `src/app/api/webhooks/mercadopago/route.ts:117`
- **Problema:** Ante firma invalida la respuesta 401 incluye reason ('Missing x-request-id header', 'Invalid x-signature format', 'Signature mismatch', 'Timestamp too old...'). Es un oraculo gratuito para quien sondea el endpoint publico; el detalle ya queda en console.error.
- **Evidencia:**

```ts
return NextResponse.json(
  { error: 'Invalid signature', reason: validation.reason },
  { status: 401 }
);
```

- **Escenario de fallo:** Un atacante que prueba cabeceras contra /api/webhooks/mercadopago distingue por la respuesta que parte del esquema de firma ya cumple (formato correcto vs HMAC incorrecto vs ventana de tiempo).
- **Arreglo propuesto:** Responder solo { error: 'Invalid signature' } y conservar reason unicamente en el log del servidor.

#### PAGO-047 — Codigo muerto y contrato desalineado en la pagina de compra

- **Severidad:** ⚪ low · **Categoría:** dead-code · **Estado:** nuevo · **Verificación:** sin verificar (reportada por 1 auditor)
- **Ubicación:** `src/app/credits/purchase/page.tsx:24`
- **Problema:** DiscountInfo.vendorName sigue declarado como obligatorio aunque la API dejo de devolverlo en #37; los estados mp/setMp (L48) y error/setError (L49) nunca se leen; onLoad={() => {}} vacio (L347); packageId se envia (L288) y el servidor lo ignora; la rama window.open(ticket_url) es inalcanzable con el Brick de tarjeta.
- **Evidencia:**

```ts
interface DiscountInfo {
  code: string;
  discountPercent: number;
  vendorName: string;
  pricing?: {
```

- **Escenario de fallo:** Mantenimiento: un desarrollador usa discountInfo.vendorName (tipado como string) y pinta 'undefined' en produccion; o asume que packageId determina el cobro cuando no es asi.
- **Arreglo propuesto:** Eliminar vendorName, mp y error; conectar onLoad al estado sdkReady; alinear el contrato con la API (usar packageId en el servidor, ver hallazgo del mapa PACKAGE_CREDITS).

#### PAGO-048 — Tarjetas de paquete no operables por teclado y avisos sin semantica accesible en la pagina de compra

- **Severidad:** ⚪ low · **Categoría:** a11y · **Estado:** nuevo · **Verificación:** sin verificar (reportada por 1 auditor)
- **Ubicación:** `src/app/credits/purchase/page.tsx:403`
- **Problema:** Cada paquete es un <div onClick> sin role, tabIndex ni manejador de teclado, y el estado seleccionado solo se comunica con color/borde (sin aria-pressed/aria-checked). El boton '×' de la notificacion (L366-371) y el de 'Quitar codigo' (solo title) carecen de aria-label; la notificacion de exito/error de pago no tiene role='alert'/aria-live; el input del codigo no tiene label asociado y usa onKeyPress (deprecado). La Fase 4 (#63) corrigio las tarjetas de vacante pero no estas.
- **Evidencia:**

```ts
<div
  key={pkg.id}
  onClick={() => setSelectedPackageId(pkg.id)}
  className={`
    relative bg-white rounded-xl p-4 sm:p-6 cursor-pointer border-2 transition-all
```

- **Escenario de fallo:** Usuario que navega solo con teclado no puede cambiar el paquete preseleccionado (Tab salta las tarjetas) y un lector de pantalla no anuncia el resultado del pago.
- **Arreglo propuesto:** Convertir las tarjetas en <button type='button' aria-pressed={selected}> o en un radiogroup (role='radio', aria-checked, tabIndex, Enter/Espacio); aria-label en los botones de icono; role='alert' en la notificacion; <label htmlFor> para el codigo y onKeyDown en vez de onKeyPress.

#### PAGO-049 — La pagina promete OXXO y transferencia pero el Brick es solo de tarjeta; codigo de ticket_url muerto

- **Severidad:** ⚪ low · **Categoría:** copy · **Estado:** nuevo · **Verificación:** sin verificar (reportada por 1 auditor)
- **Ubicación:** `src/app/credits/purchase/page.tsx:600` · relacionados: `src/app/api/credits/purchases/route.ts`
- **Problema:** Se monta bricksBuilder.create('cardPayment', ...) (L205), que solo acepta tarjetas de credito/debito. Los textos de L597-601 y L679-683 anuncian OXXO y transferencia bancaria, y handlePayment/ la API conservan ramas para ticket_url y 'Pago pendiente (ej: OXXO, transferencia)' que nunca se ejecutan con este Brick.
- **Evidencia:**

```ts
<span>
  Métodos de pago: Tarjeta, OXXO, transferencia bancaria
</span>
...
<p>
  Aceptamos tarjetas de crédito/débito, OXXO, transferencia
  bancaria
</p>
```

- **Escenario de fallo:** Empresa sin tarjeta corporativa elige comprar porque la pagina ofrece OXXO/SPEI; al continuar solo encuentra el formulario de tarjeta y abandona (o contacta a soporte).
- **Arreglo propuesto:** O bien corregir el copy a 'Tarjeta de credito o debito', o migrar al Brick 'payment' con paymentMethods { creditCard, debitCard, ticket, bankTransfer } y probar el flujo pendiente + webhook de extremo a extremo.

#### PAGO-050 — El panel del vendedor ignora respuestas success:false: ante un 500 muestra 'Aun no tienes un codigo' y luego un mensaje tecnico 'Usa PUT para actualizarlo'

- **Severidad:** ⚪ low · **Categoría:** ux · **Estado:** nuevo · **Verificación:** sin verificar (reportada por 1 auditor)
- **Ubicación:** `src/app/vendor/dashboard/page.tsx:101` · relacionados: `src/app/api/vendor/my-code/route.ts`
- **Problema:** fetchDiscountCode y fetchSales solo muestran error si fetch lanza. Si la API responde JSON con success:false (500, 401 por sesion expirada, 429) no se hace nada: la UI cae al estado vacio. Al intentar crear, el POST devuelve 409 con un texto pensado para desarrolladores que se pinta tal cual bajo el input.
- **Evidencia:**

```ts
if (data.success && data.data) {
  setDiscountCode(data.data);
  setNewCode(data.data.code);
}
} catch (error) {
  console.error('Error fetching discount code:', error);
  setError('Error al cargar tu código de descuento. Intenta recargar la página.');
```

- **Escenario de fallo:** La BD tiene un hipo y GET /api/vendor/my-code responde 500. El vendedor ve 'Aun no tienes un codigo de descuento' y resumen en $0. Pulsa 'Crear Mi Codigo', escribe uno y recibe 'Ya tienes un codigo de descuento. Usa PUT para actualizarlo.'
- **Arreglo propuesto:** Tratar !res.ok || !data.success como error (setError con mensaje y boton reintentar; redirigir a login en 401). Cambiar el texto del 409 a lenguaje de usuario ('Ya tienes un codigo; editalo desde tu panel').

#### PAGO-051 — Botones de solo icono sin nombre accesible y label sin asociar en el panel del vendedor

- **Severidad:** ⚪ low · **Categoría:** a11y · **Estado:** nuevo · **Verificación:** sin verificar (reportada por 1 auditor)
- **Ubicación:** `src/app/vendor/dashboard/page.tsx:341`
- **Problema:** Los botones Guardar (icono Save), Cancelar (icono X) del modo edicion y el de cerrar el banner de error (L233) no tienen aria-label ni title; un lector de pantalla anuncia solo 'boton'. El <label> 'Tu codigo de descuento' (L324) no esta asociado al input (sin htmlFor/id). El sweep #60 de la Fase 4 no cubrio esta pagina.
- **Evidencia:**

```ts
<button
  onClick={handleSaveCode}
  disabled={savingCode}
  className="px-4 py-3 bg-button-green text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
>
  {savingCode ? (
    <Loader2 className="w-5 h-5 animate-spin" />
  ) : (
    <Save className="w-5 h-5" />
  )}
</button>
```

- **Escenario de fallo:** Vendedor que navega con lector de pantalla entra a editar su codigo: escucha 'boton, boton' y no puede distinguir guardar de cancelar.
- **Arreglo propuesto:** Anadir aria-label='Guardar codigo' / 'Cancelar edicion' / 'Cerrar aviso', aria-busy mientras guarda, id en el input + htmlFor en el label, y role='alert' en el mensaje codeError.
