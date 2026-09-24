// RUTA: __tests__/components/pago-purchase-page.test.tsx

/**
 * La página de compra de créditos.
 *
 * Tres cosas que se cobraban caras:
 * - PAGO-023: el total salía del cálculo que había hecho el servidor al validar
 *   el código, para el paquete que estaba elegido ENTONCES. Al cambiar de
 *   paquete se revalidaba, y esa llamada está limitada a 10 intentos por cuarto
 *   de hora: si fallaba, el precio viejo se quedaba pegado y el comprador veía
 *   un total distinto del que se le cobraba.
 * - PAGO-024: el SDK de Mercado Pago se cargaba en segundo plano y nada volvía
 *   a montar el formulario cuando terminaba, así que quien pulsaba "Continuar
 *   al Pago" demasiado pronto se quedaba mirando un hueco en blanco.
 * - PAGO-006: si los paquetes no cargan hay que decirlo y ofrecer reintentar.
 */

import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';

process.env.NEXT_PUBLIC_MERCADOPAGO_PUBLIC_KEY = 'TEST-PUBLIC-KEY';

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn(), prefetch: jest.fn() })
}));

// Controla si el SDK llega a avisar de que cargó.
let mockSdkCarga = true;

jest.mock('next/script', () => {
  const ReactLocal = require('react');
  return {
    __esModule: true,
    default: ({ onLoad }: { onLoad?: () => void }) => {
      ReactLocal.useEffect(() => {
        if (mockSdkCarga && typeof onLoad === 'function') onLoad();
        // eslint-disable-next-line react-hooks/exhaustive-deps
      }, []);
      return null;
    }
  };
});

const PAQUETES = [
  { id: 1, name: 'Pack 10', credits: 10, price: 35000, pricePerCredit: 3500, badge: 'MÁS POPULAR', isActive: true, sortOrder: 1 },
  { id: 2, name: 'Pack 20', credits: 20, price: 65000, pricePerCredit: 3250, badge: null, isActive: true, sortOrder: 2 }
];

const respuesta = (body: unknown, status = 200) => ({
  ok: status >= 200 && status < 300,
  status,
  json: () => Promise.resolve(body)
});

const mockFetch = jest.fn();
global.fetch = mockFetch as unknown as typeof fetch;

// El Brick: guardamos con qué monto se manda montar.
const crearBrick = jest.fn().mockResolvedValue(undefined);

import PurchaseCreditsPage from '@/app/credits/purchase/page';

describe('Página de compra de créditos', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSdkCarga = true;
    crearBrick.mockClear();

    (window as unknown as Record<string, unknown>).MercadoPago = function MercadoPagoMock() {
      return {
        bricks: () => ({ create: crearBrick })
      };
    };

    mockFetch.mockImplementation((url: string) => {
      if (typeof url === 'string' && url.includes('/api/credit-packages')) {
        return Promise.resolve(respuesta({ success: true, data: PAQUETES }));
      }
      if (typeof url === 'string' && url.includes('/api/discount-codes/validate')) {
        return Promise.resolve(
          respuesta({
            success: true,
            valid: true,
            data: {
              code: 'JUAN10',
              discountPercent: 10,
              // El servidor sigue devolviendo su cálculo para el paquete que
              // estaba elegido al validar; la página ya no debe fiarse de él.
              pricing: { originalPrice: 35000, discountAmount: 3500, finalPrice: 31500, savings: 3500 }
            }
          })
        );
      }
      return Promise.resolve(respuesta({ success: false, error: 'Ruta no esperada' }, 404));
    });
  });

  const aplicarCodigo = async () => {
    fireEvent.change(screen.getByPlaceholderText('Ej: EDUARDO10'), { target: { value: 'JUAN10' } });
    fireEvent.click(screen.getByRole('button', { name: 'Aplicar' }));
    await screen.findByText(/10% de descuento aplicado/);
  };

  it('PAGO-023: al cambiar de paquete el total se recalcula sin volver a preguntar al servidor', async () => {
    render(<PurchaseCreditsPage />);
    await screen.findByText('10');

    await aplicarCodigo();

    const llamadasValidacion = () =>
      mockFetch.mock.calls.filter(
        ([url]) => typeof url === 'string' && url.includes('/api/discount-codes/validate')
      ).length;

    expect(llamadasValidacion()).toBe(1);

    // Cambiar al Pack 20: el descuento es del 10% sobre 65,000 -> 58,500
    fireEvent.click(screen.getByText('20'));
    fireEvent.click(screen.getByRole('button', { name: /Continuar al pago/i }));

    await screen.findByText('Resumen de compra');

    // El total que se enseña es el del paquete elegido, no el que el servidor
    // calculó para el anterior (31,500).
    expect(screen.getAllByText((_, nodo) => (nodo?.textContent || '').includes('58,500')).length).toBeGreaterThan(0);
    expect(screen.queryByText((_, nodo) => (nodo?.textContent || '') === '$31,500')).toBeNull();

    // Y no se ha vuelto a llamar al validador, que es lo que fallaba en silencio.
    expect(llamadasValidacion()).toBe(1);
  });

  it('PAGO-023: el monto que se manda a Mercado Pago es el del paquete elegido', async () => {
    render(<PurchaseCreditsPage />);
    await screen.findByText('20');

    await aplicarCodigo();

    fireEvent.click(screen.getByText('20'));
    fireEvent.click(screen.getByRole('button', { name: /Continuar al pago/i }));

    await waitFor(() => expect(crearBrick).toHaveBeenCalled());

    const [, , opciones] = crearBrick.mock.calls[crearBrick.mock.calls.length - 1];
    expect(opciones.initialization.amount).toBe(58500);
  });

  it('PAGO-024: mientras el SDK no avisa de que cargó se muestra un aviso y no se monta el formulario', async () => {
    mockSdkCarga = false;

    render(<PurchaseCreditsPage />);
    await screen.findByText('10');

    fireEvent.click(screen.getByRole('button', { name: /Continuar al pago/i }));
    await screen.findByText('Información de pago');

    expect(screen.getByText(/Cargando formulario de pago/)).toBeInTheDocument();
    expect(crearBrick).not.toHaveBeenCalled();
  });

  it('PAGO-024: cuando el SDK avisa, el formulario se monta solo', async () => {
    render(<PurchaseCreditsPage />);
    await screen.findByText('10');

    fireEvent.click(screen.getByRole('button', { name: /Continuar al pago/i }));

    await waitFor(() => expect(crearBrick).toHaveBeenCalled());
    expect(screen.queryByText(/Cargando formulario de pago/)).toBeNull();
  });

  it('PAGO-006: si los paquetes no cargan se avisa y se puede reintentar', async () => {
    mockFetch.mockImplementation((url: string) => {
      if (typeof url === 'string' && url.includes('/api/credit-packages')) {
        return Promise.resolve(respuesta({ success: false, error: 'boom' }, 500));
      }
      return Promise.resolve(respuesta({ success: false }, 404));
    });

    render(<PurchaseCreditsPage />);

    await screen.findByText(/No pudimos cargar los paquetes de créditos/);

    const llamadasAntes = mockFetch.mock.calls.length;
    fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }));

    await waitFor(() => expect(mockFetch.mock.calls.length).toBeGreaterThan(llamadasAntes));
  });

  it('PAGO-006: el precio que ve el comprador viaja al servidor para que lo compare', async () => {
    render(<PurchaseCreditsPage />);
    await screen.findByText('20');

    fireEvent.click(screen.getByText('20'));
    fireEvent.click(screen.getByRole('button', { name: /Continuar al pago/i }));

    await waitFor(() => expect(crearBrick).toHaveBeenCalled());

    const [, , opciones] = crearBrick.mock.calls[crearBrick.mock.calls.length - 1];
    await act(async () => {
      await opciones.callbacks.onSubmit({
        token: 'tok_123',
        payment_method_id: 'visa',
        installments: 1,
        payer: { email: 'a@b.com' }
      });
    });

    const llamadaCompra = mockFetch.mock.calls.find(
      ([url]) => typeof url === 'string' && url.includes('/api/credits/purchases')
    );
    expect(llamadaCompra).toBeDefined();
    const cuerpo = JSON.parse(llamadaCompra![1].body);
    expect(cuerpo.expectedAmount).toBe(65000);
    expect(cuerpo.packageId).toBe(2);
  });
});
