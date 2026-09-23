# Guía MercadoPago

Resumen de lo que hace falta para que los cobros de créditos funcionen en un
entorno. La referencia completa de variables está en
[`docs/ENVIRONMENT_VARIABLES.md`](./ENVIRONMENT_VARIABLES.md) y el paso a paso
del despliegue en [`docs/DEPLOYMENT.md`](./DEPLOYMENT.md).

## Variables

| Variable | Dónde se usa | Si falta |
|----------|--------------|----------|
| `MERCADOPAGO_ACCESS_TOKEN` | Servidor: crea el pago y consulta su estado | El checkout responde "Error de configuración" |
| `NEXT_PUBLIC_MERCADOPAGO_PUBLIC_KEY` | Navegador: SDK en `/credits/purchase` | Mismo error en el checkout. **Lleva el prefijo `NEXT_PUBLIC_`**; `MERCADOPAGO_PUBLIC_KEY` a secas no existe en el código |
| `MERCADOPAGO_WEBHOOK_SECRET` | Servidor: verifica la firma de cada notificación | En producción el webhook responde 500 "Webhook not configured" y los pagos pendientes **nunca se acreditan** |

Las `NEXT_PUBLIC_*` se incrustan en el build: después de cambiarlas hay que
volver a desplegar.

Usa credenciales de **prueba** (`TEST-...`) fuera de producción. Nunca las
pongas en un documento del repositorio.

## Registrar el webhook

1. MercadoPago → Tu aplicación → **Webhooks**.
2. URL de notificación: `https://<tu-dominio>/api/webhooks/mercadopago`.
3. Evento: **Pagos** (`payment`).
4. Copia la clave secreta que genera y ponla en `MERCADOPAGO_WEBHOOK_SECRET`.
5. Prueba con el botón del panel: debe responder 200, no 500.

## Tarjetas de prueba

MercadoPago publica las tarjetas y titulares de prueba (aprobado, rechazado,
pendiente) en su documentación para desarrolladores, sección *Checkout API →
Tarjetas de prueba*. Úsalas sólo con credenciales `TEST-`.
