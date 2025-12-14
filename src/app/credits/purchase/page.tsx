// RUTA: src/app/credits/purchase/page.tsx

'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Script from 'next/script';
import { Loader2, AlertCircle } from 'lucide-react';

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

// Paquetes por defecto (fallback si la API falla)
const DEFAULT_PACKAGES: CreditPackage[] = [
  { id: 1, name: '1 Crédito', credits: 1, price: 4000, pricePerCredit: 4000, badge: null, isActive: true, sortOrder: 1 },
  { id: 2, name: 'Pack 10', credits: 10, price: 35000, pricePerCredit: 3500, badge: 'MÁS POPULAR', isActive: true, sortOrder: 2 },
  { id: 3, name: 'Pack 15', credits: 15, price: 50000, pricePerCredit: 3333, badge: null, isActive: true, sortOrder: 3 },
  { id: 4, name: 'Pack 20', credits: 20, price: 65000, pricePerCredit: 3250, badge: 'PROMOCIÓN', isActive: true, sortOrder: 4 }
];

export default function PurchaseCreditsPage() {
  const router = useRouter();
  const [packages, setPackages] = useState<CreditPackage[]>([]);
  const [selectedPackageId, setSelectedPackageId] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingPackages, setLoadingPackages] = useState(true);
  const [showCheckout, setShowCheckout] = useState(false);
  const [mp, setMp] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  // Cargar paquetes desde la API
  useEffect(() => {
    fetchPackages();
  }, []);

  const fetchPackages = async () => {
    try {
      setLoadingPackages(true);
      const response = await fetch('/api/admin/credit-packages?activeOnly=true');
      const data = await response.json();

      if (data.success && data.data.length > 0) {
        setPackages(data.data);
        // Seleccionar el paquete con badge "MÁS POPULAR" o el segundo por defecto
        const popularPkg = data.data.find((p: CreditPackage) => p.badge === 'MÁS POPULAR');
        setSelectedPackageId(popularPkg?.id || data.data[Math.min(1, data.data.length - 1)]?.id);
      } else {
        // Usar paquetes por defecto si no hay en la BD
        setPackages(DEFAULT_PACKAGES);
        setSelectedPackageId(2); // Pack 10 por defecto
      }
    } catch (err) {
      console.error('Error fetching packages:', err);
      setPackages(DEFAULT_PACKAGES);
      setSelectedPackageId(2);
    } finally {
      setLoadingPackages(false);
    }
  };

  const selectedPkg = packages.find((p) => p.id === selectedPackageId);

  useEffect(() => {
    if (
      showCheckout &&
      selectedPkg &&
      typeof window !== 'undefined' &&
      (window as any).MercadoPago
    ) {
      initMercadoPago();
    }
  }, [showCheckout, selectedPkg]);

  const initMercadoPago = async () => {
    try {
      const publicKey = process.env.NEXT_PUBLIC_MERCADOPAGO_PUBLIC_KEY;

      if (!publicKey) {
        console.error('Mercado Pago public key not found');
        alert('Error de configuración. Por favor contacta al administrador.');
        return;
      }

      // Inicializar Mercado Pago
      const mercadopago = new (window as any).MercadoPago(publicKey, {
        locale: 'es-MX'
      });

      setMp(mercadopago);

      // Crear Brick de Card Payment
      const bricksBuilder = mercadopago.bricks();

      await bricksBuilder.create('cardPayment', 'mp-checkout-container', {
        initialization: {
          amount: selectedPkg?.price || 0
        },
        customization: {
          visual: {
            style: {
              theme: 'default'
            }
          },
          paymentMethods: {
            maxInstallments: 12,
            minInstallments: 1
          }
        },
        callbacks: {
          onSubmit: async (formData: any) => {
            return await handlePayment(formData);
          },
          onReady: () => {
            console.log('Brick is ready');
          },
          onError: (error: any) => {
            console.error('Brick error:', error);
            alert('Error al cargar el formulario de pago');
          }
        }
      });
    } catch (error) {
      console.error('Error initializing MP:', error);
      alert('Error al inicializar Mercado Pago');
    }
  };

  const handlePayment = async (formData: any) => {
    try {
      setLoading(true);

      // ✅ CORREGIDO: /api/credits/purchases (con 's')
      const res = await fetch('/api/credits/purchases', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          packageId: selectedPackageId,
          packageType: `pack_${selectedPkg?.credits}`, // Mantener compatibilidad
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
          // Pago aprobado inmediatamente
          alert(`¡Compra exitosa! Se agregaron ${data.creditsAdded} créditos.`);
          router.push('/company/dashboard');
        } else if (data.status === 'pending' || data.status === 'in_process') {
          // Pago pendiente (OXXO, transferencia, etc.)
          alert(
            `Pago recibido. Los créditos se agregarán cuando se confirme el pago.`
          );

          // Si hay ticket URL (OXXO), abrirlo
          if (data.paymentDetails?.ticket_url) {
            window.open(data.paymentDetails.ticket_url, '_blank');
          }

          router.push('/company/dashboard');
        } else {
          alert('El pago fue rechazado. Por favor intenta con otro método.');
        }
      } else {
        alert(data.error || 'Error al procesar pago');
      }
    } catch (error) {
      console.error('Error:', error);
      alert('Error al procesar pago');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {/* Cargar SDK de Mercado Pago */}
      <Script
        src="https://sdk.mercadopago.com/js/v2"
        strategy="lazyOnload"
        onLoad={() => console.log('Mercado Pago SDK loaded')}
      />

      <div className="min-h-screen bg-custom-beige py-20">
        <div className="container mx-auto px-4 max-w-6xl">
          <h1 className="text-4xl font-bold text-title-dark mb-8">
            Comprar Créditos
          </h1>

          {!showCheckout ? (
            <>
              {/* Selección de Paquete */}
              {loadingPackages ? (
                <div className="flex justify-center items-center py-12">
                  <Loader2 className="animate-spin text-button-orange" size={40} />
                  <span className="ml-3 text-gray-600">Cargando paquetes...</span>
                </div>
              ) : packages.length === 0 ? (
                <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-6 text-center">
                  <AlertCircle className="mx-auto text-yellow-600 mb-2" size={40} />
                  <p className="text-yellow-800">No hay paquetes disponibles en este momento.</p>
                </div>
              ) : (
                <div className={`grid grid-cols-1 gap-6 mb-8 ${
                  packages.length === 1 ? 'md:grid-cols-1 max-w-sm mx-auto' :
                  packages.length === 2 ? 'md:grid-cols-2 max-w-2xl mx-auto' :
                  packages.length === 3 ? 'md:grid-cols-3' :
                  'md:grid-cols-4'
                }`}>
                  {packages.map((pkg) => (
                    <div
                      key={pkg.id}
                      onClick={() => setSelectedPackageId(pkg.id)}
                      className={`
                        relative bg-white rounded-xl p-6 cursor-pointer border-2 transition-all
                        ${
                          selectedPackageId === pkg.id
                            ? 'border-button-orange shadow-lg scale-105'
                            : 'border-gray-200 hover:border-gray-300'
                        }
                      `}
                    >
                      {pkg.badge === 'MÁS POPULAR' && (
                        <div className="absolute -top-3 left-1/2 transform -translate-x-1/2 bg-button-orange text-white px-4 py-1 rounded-full text-sm font-bold">
                          MÁS POPULAR
                        </div>
                      )}

                      {pkg.badge === 'PROMOCIÓN' && (
                        <div className="absolute -top-3 left-1/2 transform -translate-x-1/2 bg-red-500 text-white px-4 py-1 rounded-full text-sm font-bold">
                          PROMOCIÓN
                        </div>
                      )}

                      <div className="text-center">
                        <h3 className="text-5xl font-bold text-title-dark mb-2">
                          {pkg.credits}
                        </h3>
                        <p className="text-gray-600 mb-4">
                          {pkg.credits === 1 ? 'crédito' : 'créditos'}
                        </p>
                        <p className="text-3xl font-bold text-button-orange mb-2">
                          ${pkg.price.toLocaleString()}
                        </p>
                        <p className="text-sm text-gray-500">MXN</p>
                        <p className="text-xs text-gray-400 mt-2">
                          ${Math.round(pkg.pricePerCredit).toLocaleString()} por crédito
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Botón Continuar */}
              {packages.length > 0 && selectedPkg && (
                <div className="text-center">
                  <button
                    onClick={() => setShowCheckout(true)}
                    disabled={loadingPackages}
                    className="bg-button-orange text-white px-8 py-4 rounded-full text-lg font-bold hover:bg-opacity-90 transition-colors disabled:opacity-50"
                  >
                    Continuar al Pago →
                  </button>
                </div>
              )}

              {/* Info adicional */}
              <div className="mt-12 bg-white rounded-xl p-6">
                <h2 className="text-2xl font-bold mb-4">
                  ¿Cómo funcionan los créditos?
                </h2>
                <ul className="space-y-3 text-gray-700">
                  <li className="flex items-start gap-2">
                    <span className="text-button-orange font-bold">✓</span>
                    <span>
                      Cada crédito te permite publicar 1 vacante activa
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-button-orange font-bold">✓</span>
                    <span>
                      Los créditos no expiran y puedes usarlos cuando los
                      necesites
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-button-orange font-bold">✓</span>
                    <span>Paquetes más grandes = mejor precio por crédito</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-button-orange font-bold">✓</span>
                    <span>
                      Métodos de pago: Tarjeta, OXXO, transferencia bancaria
                    </span>
                  </li>
                </ul>
              </div>
            </>
          ) : selectedPkg ? (
            <>
              {/* Resumen de compra */}
              <div className="bg-white rounded-xl p-6 mb-6">
                <h2 className="text-2xl font-bold mb-4">Resumen de Compra</h2>
                <div className="flex justify-between items-center">
                  <div>
                    <p className="text-gray-600">Paquete seleccionado:</p>
                    <p className="text-xl font-bold">
                      {selectedPkg.name} - {selectedPkg.credits}{' '}
                      {selectedPkg.credits === 1 ? 'crédito' : 'créditos'}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-gray-600">Total:</p>
                    <p className="text-3xl font-bold text-button-orange">
                      ${selectedPkg.price.toLocaleString()} MXN
                    </p>
                  </div>
                </div>

                <button
                  onClick={() => setShowCheckout(false)}
                  className="text-gray-600 hover:text-gray-800 mt-4"
                >
                  ← Cambiar paquete
                </button>
              </div>

              {/* Contenedor del Brick de Mercado Pago */}
              <div className="bg-white rounded-xl p-6 shadow-lg">
                <h2 className="text-2xl font-bold mb-4">Información de Pago</h2>

                {/* Aquí se renderiza el Brick */}
                <div id="mp-checkout-container"></div>

                {loading && (
                  <div className="text-center mt-4">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-button-orange mx-auto"></div>
                    <p className="text-gray-600 mt-2">Procesando pago...</p>
                  </div>
                )}
              </div>

              {/* Métodos de pago aceptados */}
              <div className="mt-6 text-center text-gray-600 text-sm">
                <p>
                  Aceptamos tarjetas de crédito/débito, OXXO, transferencia
                  bancaria
                </p>
                <p className="mt-2">
                  Pago seguro procesado por Mercado Pago
                </p>
              </div>
            </>
          ) : (
            <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-6 text-center">
              <AlertCircle className="mx-auto text-yellow-600 mb-2" size={40} />
              <p className="text-yellow-800">No se ha seleccionado ningún paquete.</p>
              <button
                onClick={() => setShowCheckout(false)}
                className="mt-4 text-blue-600 hover:underline"
              >
                ← Volver a seleccionar paquete
              </button>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
