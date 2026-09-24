// RUTA: src/app/credits/purchase/page.tsx

'use client';

/**
 * Compra de créditos (empresa): elegir paquete → código de descuento → pagar
 * con el Brick de tarjeta de Mercado Pago.
 *
 * Registro de aplicación (docs/DISENO.md): PageHeader → Stepper de dos pasos
 * (el paso es `showCheckout`, el mismo estado de siempre) → paquetes, código y
 * resumen → pago. La lógica es la de siempre: GET /api/credit-packages,
 * POST /api/discount-codes/validate, el descuento calculado aquí (PAGO-023),
 * el montaje del Brick cuando el SDK avisa (PAGO-024) y POST
 * /api/credits/purchases con el precio que ve el comprador (PAGO-006). El
 * Brick lo pinta Mercado Pago dentro de #mp-checkout-container: aquí sólo se
 * viste su contenedor.
 */

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Script from 'next/script';
import {
  Loader2,
  AlertCircle,
  Tag,
  X,
  Check,
  ArrowLeft,
  ArrowRight,
  CreditCard,
  Lock,
  RefreshCw,
  Info
} from 'lucide-react';
import { notifyAuthChanged } from '@/lib/auth-events';
import PageHeader from '@/components/ui/PageHeader';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import IconButton from '@/components/ui/IconButton';
import FormField, { Input } from '@/components/ui/FormField';
import EmptyState from '@/components/ui/EmptyState';
import Stepper from '@/components/ui/Stepper';
import Toast from '@/components/ui/Toast';
import Skeleton from '@/components/ui/Skeleton';
import { cn } from '@/lib/utils';

interface CreditPackage {
  id: number;
  name: string;
  credits: number;
  price: number;
  pricePerCredit: number;
  badge: string | null;
  isActive: boolean;
  sortOrder: number;
}

interface DiscountInfo {
  code: string;
  discountPercent: number;
}

// DINERO (#PAGO): aquí había una lista de precios escrita a mano que se usaba
// como fallback. Como la petición iba a /api/admin/credit-packages y el
// middleware la bloquea para empresas, el fallback era lo que se mostraba
// SIEMPRE — y el cobro real sale de la tabla CreditPackage, así que el precio
// anunciado podía no ser el cobrado. Si los paquetes no cargan, ahora se avisa
// en vez de enseñar precios que quizá no existen.

/** Los dos pasos de la compra (presentación de `showCheckout`). */
const PASOS = [
  { id: 'paquete', etiqueta: 'Paquete', descripcion: 'Elige cuántos créditos' },
  { id: 'pago', etiqueta: 'Pago', descripcion: 'Pago seguro con Mercado Pago' }
];

export default function PurchaseCreditsPage() {
  const router = useRouter();
  const [packages, setPackages] = useState<CreditPackage[]>([]);
  const [selectedPackageId, setSelectedPackageId] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingPackages, setLoadingPackages] = useState(true);
  const [showCheckout, setShowCheckout] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // PAGO-024: el SDK de Mercado Pago se descarga aparte. Hasta que no avisa que
  // está listo no se puede montar el formulario de tarjeta; antes, si el
  // comprador pulsaba "Continuar al Pago" antes de que cargara, el recuadro se
  // quedaba vacío para siempre porque nada volvía a disparar el montaje.
  const [sdkReady, setSdkReady] = useState(false);
  const [sdkError, setSdkError] = useState(false);

  // Estado para código de descuento
  const [discountCodeInput, setDiscountCodeInput] = useState('');
  const [validatingCode, setValidatingCode] = useState(false);
  const [discountInfo, setDiscountInfo] = useState<DiscountInfo | null>(null);
  const [discountError, setDiscountError] = useState<string | null>(null);

  // Notificación
  const [notification, setNotification] = useState<{ type: 'success' | 'error' | null; message: string }>({ type: null, message: '' });

  // Cargar paquetes desde la API
  useEffect(() => {
    fetchPackages();
  }, []);

  const fetchPackages = async () => {
    try {
      setLoadingPackages(true);
      setError(null);
      const response = await fetch('/api/credit-packages');
      const data = await response.json();

      if (data.success && data.data.length > 0) {
        setPackages(data.data);
        // Seleccionar el paquete con badge "MÁS POPULAR" o el segundo por defecto
        const popularPkg = data.data.find((p: CreditPackage) => p.badge === 'MÁS POPULAR');
        setSelectedPackageId(popularPkg?.id || data.data[Math.min(1, data.data.length - 1)]?.id);
      } else {
        setPackages([]);
        setSelectedPackageId(null);
        setError(
          'No pudimos cargar los paquetes de créditos. Vuelve a intentarlo en un momento o escríbenos a info@inakat.com.'
        );
      }
    } catch {
      setPackages([]);
      setSelectedPackageId(null);
      setError(
        'No pudimos cargar los paquetes de créditos. Revisa tu conexión y vuelve a intentarlo.'
      );
    } finally {
      setLoadingPackages(false);
    }
  };

  const selectedPkg = packages.find((p) => p.id === selectedPackageId);

  // Calcular precios con descuento.
  // PAGO-023: antes el total salía de `pricing` que devolvía el servidor al
  // validar el código, es decir, del paquete que estaba elegido EN ESE MOMENTO.
  // Al cambiar de paquete se revalidaba, pero si esa llamada fallaba (el
  // validador está limitado a 10 intentos por cuarto de hora) el precio viejo se
  // quedaba pegado y el comprador veía un total distinto al que se le cobraba.
  // Ahora el descuento se calcula aquí sobre el paquete elegido, con la misma
  // fórmula que usa el servidor (porcentaje redondeado al peso).
  const originalPrice = selectedPkg?.price || 0;
  const discountAmount = discountInfo
    ? Math.round(originalPrice * (discountInfo.discountPercent / 100))
    : 0;
  const finalPrice = originalPrice - discountAmount;

  // Validar código de descuento
  const handleValidateCode = async () => {
    if (!discountCodeInput.trim()) {
      setDiscountError('Ingresa un código de descuento');
      return;
    }

    setValidatingCode(true);
    setDiscountError(null);

    try {
      const response = await fetch('/api/discount-codes/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: discountCodeInput.trim(),
          packagePrice: selectedPkg?.price || 0
        })
      });

      const data = await response.json();

      if (data.success && data.valid) {
        setDiscountInfo(data.data);
        setDiscountError(null);
      } else {
        setDiscountError(data.error || 'Código inválido o expirado');
        setDiscountInfo(null);
      }
    } catch {
      setDiscountError('Error al validar el código');
      setDiscountInfo(null);
    } finally {
      setValidatingCode(false);
    }
  };

  // Quitar código de descuento
  const handleRemoveCode = () => {
    setDiscountCodeInput('');
    setDiscountInfo(null);
    setDiscountError(null);
  };

  // PAGO-023: aquí había un efecto que revalidaba el código contra el servidor
  // cada vez que se cambiaba de paquete, sólo para recalcular el precio. Ya no
  // hace falta (el descuento se calcula arriba) y además fallaba en silencio.

  useEffect(() => {
    if (showCheckout && selectedPkg && sdkReady) {
      initMercadoPago();
    }
  }, [showCheckout, selectedPkg, discountInfo, sdkReady]);

  const initMercadoPago = async () => {
    try {
      const publicKey = process.env.NEXT_PUBLIC_MERCADOPAGO_PUBLIC_KEY;

      if (!publicKey) {
        setNotification({ type: 'error', message: 'Error de configuración. Por favor contacta al administrador.' });
        return;
      }

      if (typeof window === 'undefined' || !(window as any).MercadoPago) {
        return;
      }

      // Inicializar Mercado Pago
      const mercadopago = new (window as any).MercadoPago(publicKey, {
        locale: 'es-MX'
      });

      // Limpiar contenedor anterior si existe
      const container = document.getElementById('mp-checkout-container');
      if (container) {
        container.innerHTML = '';
      }

      // Crear Brick de Card Payment con el precio final (con descuento si aplica)
      const bricksBuilder = mercadopago.bricks();

      await bricksBuilder.create('cardPayment', 'mp-checkout-container', {
        initialization: {
          amount: finalPrice,
          payer: {
            email: '' // Se llenará por el usuario
          }
        },
        customization: {
          visual: {
            style: {
              theme: 'default',
              customVariables: {
                formBackgroundColor: '#FFFFFF',
                baseColor: '#f97316' // button-orange
              }
            },
            hideFormTitle: false,
            hidePaymentButton: false
          },
          paymentMethods: {
            maxInstallments: 12,
            minInstallments: 1,
            types: {
              // Habilitar todos los métodos de pago en México
              excluded: []
            }
          },
          // Personalizar textos de validación
          texts: {
            formTitle: 'Datos de la tarjeta',
            cardNumber: {
              label: 'Número de tarjeta',
              placeholder: '1234 5678 9012 3456'
            },
            expirationDate: {
              label: 'Fecha de vencimiento',
              placeholder: 'MM/AA'
            },
            securityCode: {
              label: 'Código de seguridad',
              placeholder: 'CVV'
            },
            cardholderName: {
              label: 'Nombre del titular',
              placeholder: 'Como aparece en la tarjeta'
            },
            cardholderIdentification: {
              label: 'RFC del titular'
            },
            email: {
              label: 'Correo electrónico',
              placeholder: 'tu@email.com'
            },
            formSubmit: 'Pagar'
          }
        },
        callbacks: {
          onSubmit: async (formData: any) => {
            return await handlePayment(formData);
          },
          onReady: () => {},
          onError: (error: any) => {
            // No mostrar notificación para errores de validación menores
            if (!error?.message?.includes('validation')) {
              setNotification({ type: 'error', message: 'Error al cargar el formulario de pago. Por favor recarga la página.' });
            }
          },
          onBinChange: () => {}
        }
      });
    } catch {
      setNotification({ type: 'error', message: 'Error al inicializar Mercado Pago' });
    }
  };

  const handlePayment = async (formData: any) => {
    try {
      setLoading(true);

      const res = await fetch('/api/credits/purchases', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          packageId: selectedPackageId,
          packageType: `pack_${selectedPkg?.credits}`,
          discountCode: discountInfo?.code || null, // Enviar código de descuento
          // PAGO-006: el precio que el comprador tiene delante. El servidor
          // debe rechazar el cobro si no coincide con el que calcula él.
          expectedAmount: finalPrice,
          paymentData: {
            token: formData.token,
            payment_method_id: formData.payment_method_id,
            installments: formData.installments,
            payer: formData.payer
          }
        })
      });

      const data = await res.json();

      if (data.success) {
        if (data.status === 'approved') {
          // Mostrar mensaje con info de descuento si aplica
          let message =
            data.creditsAdded === 1
              ? '¡Compra exitosa! Se agregó 1 crédito.'
              : `¡Compra exitosa! Se agregaron ${data.creditsAdded} créditos.`;
          if (data.discount) {
            message += ` Ahorraste $${data.discount.discountAmount.toLocaleString()} con tu código de descuento.`;
          }
          setNotification({ type: 'success', message });
          // UI-004: el saldo del Navbar quedaba desfasado tras comprar.
          notifyAuthChanged();
          setTimeout(() => router.push('/company/dashboard'), 1500);
        } else if (data.status === 'pending' || data.status === 'in_process') {
          setNotification({ type: 'success', message: 'Pago recibido. Los créditos se agregarán cuando se confirme el pago.' });

          if (data.paymentDetails?.ticket_url) {
            window.open(data.paymentDetails.ticket_url, '_blank');
          }

          setTimeout(() => router.push('/company/dashboard'), 1500);
        } else {
          setNotification({ type: 'error', message: 'El pago fue rechazado. Por favor intenta con otro método.' });
        }
      } else {
        setNotification({ type: 'error', message: data.error || 'Error al procesar pago' });
      }
    } catch {
      setNotification({ type: 'error', message: 'Error al procesar pago' });
    } finally {
      setLoading(false);
    }
  };

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('es-MX', {
      style: 'currency',
      currency: 'MXN',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(price);
  };

  // "10 créditos" en UN solo texto: la cifra suelta sólo vive en la tarjeta
  // del paquete (los tests la buscan por su número).
  const creditosDe = (n: number) => `${n} ${n === 1 ? 'crédito' : 'créditos'}`;

  // Rejilla de paquetes según cuántos hay (como antes: 1 y 2 centrados).
  const rejillaPaquetes =
    packages.length === 1
      ? 'grid-cols-1 max-w-[16rem]'
      : packages.length === 2
        ? 'grid-cols-2 max-w-xl'
        : packages.length === 3
          ? 'grid-cols-2 sm:grid-cols-3'
          : 'grid-cols-2 lg:grid-cols-4';

  return (
    <>
      {/* Cargar SDK de Mercado Pago */}
      <Script
        src="https://sdk.mercadopago.com/js/v2"
        strategy="afterInteractive"
        onLoad={() => { setSdkReady(true); setSdkError(false); }}
        onReady={() => { setSdkReady(true); setSdkError(false); }}
        onError={() => setSdkError(true)}
      />

      <PageHeader
        antetitulo="Créditos"
        titulo="Comprar créditos"
        remate="para tus vacantes"
        descripcion="Elige un paquete, aplica tu código si tienes uno y paga con Mercado Pago."
      />

      <Stepper
        pasos={PASOS}
        actual={showCheckout ? 1 : 0}
        alIrA={() => setShowCheckout(false)}
        className="mb-6 sm:max-w-sm"
      />

      {/* Notificación: fija arriba para que se vea aunque se esté al pie del
          formulario de pago; se queda hasta que se cierra (como antes). */}
      <Toast
        tono={notification.type === 'success' ? 'exito' : 'error'}
        mensaje={notification.type ? notification.message : null}
        alCerrar={() => setNotification({ type: null, message: '' })}
        duracion={0}
      />

      {/* PAGO-006: si los paquetes no cargan hay que decirlo. Antes el
          mensaje se guardaba en el estado pero no se pintaba en ninguna
          parte, así que el comprador sólo veía "no hay paquetes". */}
      {error && (
        <div
          role="alert"
          className="mb-6 flex flex-col gap-3 rounded-xl border border-danger/30 bg-danger-tint px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
        >
          <p className="flex items-start gap-2 text-sm font-medium text-danger-dark">
            <AlertCircle size={18} className="mt-px flex-none" aria-hidden="true" />
            {error}
          </p>
          <Button
            variante="contorno"
            tamano="sm"
            icono={RefreshCw}
            onClick={fetchPackages}
            disabled={loadingPackages}
            className="self-start sm:self-auto"
          >
            Reintentar
          </Button>
        </div>
      )}

      {!showCheckout ? (
        // scroll-mb: por debajo de 1024 px, al llegar con Tab a un campo o
        // botón del pie, el navegador lo deja por encima de la barra fija de
        // «Continuar al pago» en vez de debajo (WCAG 2.4.11).
        <div className="space-y-6 max-lg:[&_:is(a,button,input)]:scroll-mb-24">
          {/* Selección de Paquete */}
          {loadingPackages ? (
            <div role="status" className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
              <span className="sr-only">Cargando paquetes…</span>
              {[0, 1, 2, 3].map((i) => (
                <div key={i} className="flex flex-col items-center rounded-xl border border-line bg-white px-4 py-6 shadow-ap-1">
                  <Skeleton className="h-10 w-14" />
                  <Skeleton className="mt-2 h-3.5 w-16" />
                  <Skeleton className="mt-4 h-6 w-24" />
                  <Skeleton className="mt-2 h-3 w-20" />
                </div>
              ))}
            </div>
          ) : packages.length === 0 ? (
            !error && (
              <Card>
                <EmptyState
                  frase="Por ahora, nada que elegir."
                  titulo="No hay paquetes disponibles en este momento."
                  descripcion="Escríbenos a info@inakat.com y te ayudamos a comprar créditos."
                />
              </Card>
            )
          ) : (
            <section aria-labelledby="titulo-paquetes" className="[overflow:visible]">
              <h2 id="titulo-paquetes" className="mb-1 font-display text-base font-semibold text-ink">
                Elige tu paquete
              </h2>
              <p className="mb-5 text-sm text-ink-muted">Precios en pesos mexicanos (MXN).</p>
              <div role="group" aria-labelledby="titulo-paquetes" className={cn('grid gap-3 sm:gap-4', rejillaPaquetes)}>
                {packages.map((pkg) => {
                  // Calcular precio con descuento para este paquete
                  const pkgDiscount = discountInfo
                    ? Math.round(pkg.price * (discountInfo.discountPercent / 100))
                    : 0;
                  const pkgFinalPrice = pkg.price - pkgDiscount;
                  const seleccionado = selectedPackageId === pkg.id;

                  return (
                    <button
                      key={pkg.id}
                      type="button"
                      aria-pressed={seleccionado}
                      onClick={() => setSelectedPackageId(pkg.id)}
                      className={cn(
                        'relative flex flex-col items-center rounded-xl border bg-white px-3 pb-5 pt-7 text-center transition-[border-color,box-shadow,background-color] duration-150 sm:px-4',
                        'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal',
                        seleccionado
                          ? 'border-teal bg-teal-tint/40 shadow-ap-2 ring-1 ring-teal'
                          : 'border-line-strong shadow-ap-1 hover:border-ink'
                      )}
                    >
                      {/* El punto: marca el paquete elegido con forma, no sólo con color. */}
                      <span
                        className={cn(
                          'absolute left-3 top-3 h-4 w-4 rounded-full border-2 bg-white transition-[border-width,border-color] duration-150',
                          seleccionado ? 'border-[5px] border-teal' : 'border-line-strong'
                        )}
                        aria-hidden="true"
                      />

                      {pkg.badge === 'MÁS POPULAR' && (
                        <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-orange px-2.5 py-1 font-display text-[11px] font-bold leading-none tracking-wide text-ink">
                          MÁS POPULAR
                        </span>
                      )}

                      {pkg.badge === 'PROMOCIÓN' && (
                        <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-ink px-2.5 py-1 font-display text-[11px] font-bold leading-none tracking-wide text-white">
                          PROMOCIÓN
                        </span>
                      )}

                      {/* El nombre del paquete, el mismo que sale en «Tu compra». */}
                      <span className="mb-2 max-w-full text-balance font-display text-sm font-semibold leading-tight text-ink">
                        {pkg.name}
                      </span>
                      <span className="font-display text-4xl font-bold leading-none tracking-tight text-ink tabular-nums sm:text-5xl">
                        {pkg.credits}
                      </span>
                      <span className="mt-1.5 text-sm text-ink-muted">
                        {pkg.credits === 1 ? 'crédito' : 'créditos'}
                      </span>

                      {/* Precio con descuento */}
                      {discountInfo ? (
                        <>
                          <span className="mt-4 text-sm text-ink-muted line-through tabular-nums">
                            {formatPrice(pkg.price)}
                          </span>
                          <span className="font-display text-xl font-semibold text-ink tabular-nums sm:text-2xl">
                            {formatPrice(pkgFinalPrice)}
                          </span>
                          <span className="mt-0.5 text-xs font-semibold text-lime-dark">
                            Ahorras {formatPrice(pkgDiscount)}
                          </span>
                        </>
                      ) : (
                        <span className="mt-4 font-display text-xl font-semibold text-ink tabular-nums sm:text-2xl">
                          {formatPrice(pkg.price)}
                        </span>
                      )}

                      <span className="mt-1 text-xs text-ink-muted tabular-nums">
                        {formatPrice(Math.round(pkgFinalPrice / pkg.credits))} / crédito
                      </span>
                    </button>
                  );
                })}
              </div>
            </section>
          )}

          {packages.length > 0 && (
            <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-start">
              {/* Código de Descuento */}
              <Card
                titulo={
                  <span className="inline-flex items-center gap-2">
                    <Tag size={18} className="flex-none text-orange-dark" aria-hidden="true" />
                    ¿Tienes un código de descuento?
                  </span>
                }
              >
                <div aria-live="polite">
                  {!discountInfo ? (
                    <FormField
                      etiqueta="Código de descuento"
                      ayuda="Si un asesor de INAKAT te compartió un código, escríbelo aquí."
                      error={discountError}
                    >
                      <div className="flex flex-col gap-2 sm:flex-row">
                        <Input
                          type="text"
                          value={discountCodeInput}
                          onChange={(e) => {
                            setDiscountCodeInput(e.target.value.toUpperCase());
                            setDiscountError(null);
                          }}
                          placeholder="Ej: EDUARDO10"
                          autoComplete="off"
                          spellCheck={false}
                          className="font-mono uppercase sm:flex-1"
                          onKeyPress={(e) => e.key === 'Enter' && handleValidateCode()}
                        />
                        <Button
                          variante="secundario"
                          onClick={handleValidateCode}
                          disabled={validatingCode || !discountCodeInput.trim()}
                          cargando={validatingCode}
                        >
                          Aplicar
                        </Button>
                      </div>
                    </FormField>
                  ) : (
                    <div className="flex items-center justify-between gap-3 rounded-lg border border-lime/50 bg-lime-tint px-4 py-3">
                      <div className="flex min-w-0 items-center gap-3">
                        <span
                          className="flex h-9 w-9 flex-none items-center justify-center rounded-full bg-lime text-ink"
                          aria-hidden="true"
                        >
                          <Check className="h-5 w-5" />
                        </span>
                        <div className="min-w-0">
                          <p className="font-semibold text-lime-dark">
                            ¡{discountInfo.discountPercent}% de descuento aplicado!
                          </p>
                          <p className="text-sm text-ink">
                            Código: <span className="font-mono font-bold">{discountInfo.code}</span>
                          </p>
                        </div>
                      </div>
                      <IconButton etiqueta="Quitar código" icono={X} tamano="sm" onClick={handleRemoveCode} />
                    </div>
                  )}
                </div>
              </Card>

              {/* Resumen y botón Continuar */}
              {selectedPkg && (
                <Card titulo="Tu compra" className="lg:row-span-2">
                  <dl className="space-y-2.5 text-sm">
                    <div className="flex items-baseline justify-between gap-3">
                      <dt className="text-ink-muted">Paquete</dt>
                      <dd className="text-right font-medium text-ink">
                        {`${selectedPkg.name} · ${creditosDe(selectedPkg.credits)}`}
                      </dd>
                    </div>
                    <div className="flex items-baseline justify-between gap-3">
                      <dt className="text-ink-muted">Precio</dt>
                      <dd className="tabular-nums text-ink">{formatPrice(originalPrice)}</dd>
                    </div>
                    {discountInfo && (
                      <div className="flex items-baseline justify-between gap-3">
                        <dt className="text-ink-muted">{`Descuento (${discountInfo.code})`}</dt>
                        <dd className="tabular-nums font-medium text-lime-dark">{`−${formatPrice(discountAmount)}`}</dd>
                      </div>
                    )}
                    <div className="flex items-baseline justify-between gap-3 border-t border-line pt-3">
                      <dt className="font-display font-semibold text-ink">Total</dt>
                      <dd className="font-display text-2xl font-bold tabular-nums text-ink">
                        {formatPrice(finalPrice)} <span className="text-xs font-medium text-ink-muted">MXN</span>
                      </dd>
                    </div>
                  </dl>
                  {/* La acción de la página. En escritorio, al pie de esta
                      tarjeta; por debajo de 1024 px la MISMA pieza pasa a barra
                      fija abajo con el total (como la de /create-job), para no
                      tener que bajar dos pantallas, tras el cupón, a buscarla.
                      Un solo botón en el DOM. Fixed y no sticky: la rejilla que
                      la contiene empieza al pie de la primera pantalla y un
                      sticky no se vería hasta llegar a ella. */}
                  <div className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-white px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 shadow-[0_-10px_24px_-18px_rgba(40,55,57,0.55)] sm:px-6 lg:static lg:z-auto lg:mt-5 lg:border-0 lg:bg-transparent lg:p-0 lg:shadow-none">
                    <div className="flex items-center justify-between gap-4 lg:block">
                      <p className="min-w-0 lg:hidden">
                        <span className="block truncate text-xs text-ink-muted">
                          {`Total · ${creditosDe(selectedPkg.credits)}`}
                        </span>
                        <span className="font-display text-xl font-bold tabular-nums leading-tight text-ink">
                          {formatPrice(finalPrice)}
                        </span>{' '}
                        <span className="text-xs font-medium text-ink-muted">MXN</span>
                      </p>
                      <Button
                        iconoFinal={ArrowRight}
                        onClick={() => setShowCheckout(true)}
                        disabled={loadingPackages}
                        className="flex-none lg:h-12 lg:w-full lg:px-5 lg:text-base lg:[&_svg]:h-5 lg:[&_svg]:w-5"
                      >
                        Continuar al pago
                      </Button>
                    </div>
                  </div>
                  <p className="mt-3 flex items-center justify-center gap-1.5 text-xs text-ink-muted">
                    <Lock size={12} aria-hidden="true" />
                    Pago seguro procesado por Mercado Pago
                  </p>
                </Card>
              )}

              {/* Info adicional */}
              <Card
                titulo={
                  <span className="inline-flex items-center gap-2">
                    <Info size={18} className="flex-none text-teal" aria-hidden="true" />
                    ¿Cómo funcionan los créditos?
                  </span>
                }
              >
                <ul className="space-y-3 text-sm text-ink">
                  <li className="flex items-start gap-2.5">
                    <Check size={16} className="mt-0.5 flex-none text-lime-dark" aria-hidden="true" />
                    <span>
                      Los créditos se usan para publicar vacantes. El costo varía según el perfil y seniority.
                    </span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <Check size={16} className="mt-0.5 flex-none text-lime-dark" aria-hidden="true" />
                    <span>
                      Los créditos no expiran y puedes usarlos cuando los
                      necesites
                    </span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <Check size={16} className="mt-0.5 flex-none text-lime-dark" aria-hidden="true" />
                    <span>Paquetes más grandes = mejor precio por crédito</span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <Check size={16} className="mt-0.5 flex-none text-lime-dark" aria-hidden="true" />
                    <span>
                      Métodos de pago: Tarjeta, OXXO, transferencia bancaria
                    </span>
                  </li>
                </ul>
              </Card>
            </div>
          )}

          {/* Hueco del alto de la barra fija de «Continuar al pago» (sólo
              por debajo de 1024 px): sin él, lo último de la página quedaba
              debajo de la barra. */}
          {packages.length > 0 && selectedPkg && <div aria-hidden="true" className="h-16 lg:hidden" />}
        </div>
      ) : selectedPkg ? (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-start">
          {/* Resumen de compra: primero en el orden de lectura (qué pagas y
              luego cómo); en escritorio va a la derecha y se queda a la vista. */}
          <div className="lg:sticky lg:top-20 lg:order-2">
            <Card titulo="Resumen de compra">
              <p className="text-sm text-ink-muted">Paquete seleccionado</p>
              <p className="font-display text-lg font-semibold text-ink">
                {`${selectedPkg.name} - ${creditosDe(selectedPkg.credits)}`}
              </p>

              {/* Mostrar código de descuento si aplica */}
              {discountInfo && (
                <p className="mt-2 inline-flex items-center gap-1.5 text-sm font-medium text-lime-dark">
                  <Tag size={14} className="flex-none" aria-hidden="true" />
                  Código {discountInfo.code} aplicado ({discountInfo.discountPercent}% desc.)
                </p>
              )}

              <dl className="mt-4 space-y-2.5 border-t border-line pt-4 text-sm">
                {discountInfo ? (
                  <>
                    <div className="flex items-baseline justify-between gap-3">
                      <dt className="text-ink-muted">Precio original</dt>
                      <dd className="tabular-nums text-ink-muted line-through">{formatPrice(originalPrice)}</dd>
                    </div>
                    <div className="flex items-baseline justify-between gap-3">
                      <dt className="text-ink-muted">Ahorras</dt>
                      <dd className="tabular-nums font-medium text-lime-dark">{formatPrice(discountAmount)}</dd>
                    </div>
                    <div className="flex items-baseline justify-between gap-3 border-t border-line pt-3">
                      <dt className="font-display font-semibold text-ink">Tu precio</dt>
                      <dd className="font-display text-2xl font-bold tabular-nums text-ink">{formatPrice(finalPrice)}</dd>
                    </div>
                  </>
                ) : (
                  <div className="flex items-baseline justify-between gap-3">
                    <dt className="font-display font-semibold text-ink">Total</dt>
                    <dd className="font-display text-2xl font-bold tabular-nums text-ink">{formatPrice(originalPrice)}</dd>
                  </div>
                )}
              </dl>

              <Button
                variante="contorno"
                tamano="sm"
                icono={ArrowLeft}
                onClick={() => setShowCheckout(false)}
                className="mt-5"
              >
                Cambiar paquete
              </Button>
            </Card>

            {/* Métodos de pago aceptados */}
            <div className="mt-4 space-y-1 px-1 text-center text-[13px] text-ink-muted">
              <p>
                Aceptamos tarjetas de crédito/débito, OXXO, transferencia
                bancaria
              </p>
              <p className="inline-flex items-center gap-1.5">
                <Lock size={12} aria-hidden="true" />
                Pago seguro procesado por Mercado Pago
              </p>
            </div>
          </div>

          {/* Contenedor del Brick de Mercado Pago */}
          <Card
            titulo={
              <span className="inline-flex items-center gap-2">
                <CreditCard size={18} className="flex-none text-teal" aria-hidden="true" />
                Información de pago
              </span>
            }
            className="lg:order-1"
          >
            {/* PAGO-024: mientras el SDK no esté listo se avisa, en vez de
                dejar un hueco en blanco sin explicación. */}
            {sdkError ? (
              <div
                role="alert"
                className="flex items-start gap-2 rounded-lg border border-danger/30 bg-danger-tint px-4 py-3 text-sm font-medium text-danger-dark"
              >
                <AlertCircle size={18} className="mt-px flex-none" aria-hidden="true" />
                <span>
                  No se pudo cargar el formulario de pago de Mercado Pago. Revisa tu
                  conexión o desactiva el bloqueador de anuncios y recarga la página.
                </span>
              </div>
            ) : !sdkReady ? (
              <div role="status" className="flex items-center justify-center gap-3 py-10 text-sm text-ink-muted">
                <Loader2 className="h-6 w-6 animate-spin text-teal" aria-hidden="true" />
                Cargando formulario de pago…
              </div>
            ) : null}

            {/* Aquí se renderiza el Brick (lo pinta Mercado Pago: no se toca por dentro) */}
            <div id="mp-checkout-container"></div>

            {loading && (
              <div role="status" className="mt-4 flex items-center justify-center gap-3 text-sm font-medium text-ink">
                <Loader2 className="h-5 w-5 animate-spin text-teal" aria-hidden="true" />
                Procesando pago…
              </div>
            )}
          </Card>
        </div>
      ) : (
        <Card>
          <EmptyState
            titulo="No se ha seleccionado ningún paquete."
            accion={
              <Button variante="contorno" icono={ArrowLeft} onClick={() => setShowCheckout(false)}>
                Volver a seleccionar paquete
              </Button>
            }
          />
        </Card>
      )}
    </>
  );
}
