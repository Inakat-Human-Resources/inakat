// RUTA: __tests__/components/pago-vendor-dashboard.test.tsx

/**
 * El panel del vendedor (/vendor/dashboard).
 *
 * - PAGO-026: el resumen contaba todas las ventas pero la tabla sólo traía las
 *   20 últimas, sin forma de llegar a las anteriores ni a sus comprobantes.
 * - PAGO-050: si la API respondía con success:false (500, sesión caducada), la
 *   página caía al estado vacío y decía "aún no tienes un código"; al intentar
 *   crear uno, el vendedor recibía un mensaje escrito para desarrolladores.
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

const respuesta = (body: unknown, status = 200) => ({
  ok: status >= 200 && status < 300,
  status,
  json: () => Promise.resolve(body)
});

const venta = (id: number) => ({
  id,
  company: { id: 900 + id, nombre: `Contacto ${id}`, nombreEmpresa: `Empresa ${id}` },
  purchase: { id: 500 + id, credits: 10, originalPrice: 35000, discountAmount: 3500, finalPrice: 31500 },
  commission: {
    amount: 3150,
    status: 'pending',
    statusLabel: 'Pendiente',
    paidAt: null,
    dueDate: '2026-05-10T00:00:00.000Z',
    proofUrl: null
  },
  createdAt: '2026-01-10T00:00:00.000Z'
});

const RESPUESTA_CODIGO = {
  success: true,
  data: {
    id: 1,
    code: 'EDUARDO10',
    discountPercent: 10,
    commissionPercent: 10,
    isActive: true,
    createdAt: '2026-01-01T00:00:00.000Z'
  }
};

const RESPUESTA_VENTAS = {
  success: true,
  data: {
    hasCode: true,
    code: 'EDUARDO10',
    sales: [venta(1)],
    summary: { totalSales: 45, totalCommission: 141750, pendingCommission: 50000, paidCommission: 91750 },
    pagination: { page: 1, limit: 20, totalCount: 45, totalPages: 3 }
  }
};

const mockFetch = jest.fn();
global.fetch = mockFetch as unknown as typeof fetch;

const urlsDe = (fragmento: string) =>
  mockFetch.mock.calls
    .map(([url]) => (typeof url === 'string' ? url : ''))
    .filter((url) => url.includes(fragmento));

import VendorDashboardPage from '@/app/vendor/dashboard/page';

describe('Panel del vendedor', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFetch.mockImplementation((url: string) => {
      const texto = String(url);
      if (texto.includes('/api/vendor/my-sales')) {
        return Promise.resolve(respuesta(RESPUESTA_VENTAS));
      }
      if (texto.includes('/api/vendor/my-code')) {
        return Promise.resolve(respuesta(RESPUESTA_CODIGO));
      }
      return Promise.resolve(respuesta({ success: false, error: 'Ruta no esperada' }, 404));
    });
  });

  it('PAGO-026: pide las ventas con página y tamaño de tanda', async () => {
    render(<VendorDashboardPage />);

    await waitFor(() => expect(urlsDe('/api/vendor/my-sales').length).toBe(1));
    expect(urlsDe('/api/vendor/my-sales')[0]).toContain('page=1');
    expect(urlsDe('/api/vendor/my-sales')[0]).toContain('limit=20');
  });

  it('PAGO-026: "Siguiente" trae la segunda tanda', async () => {
    render(<VendorDashboardPage />);
    await screen.findAllByText('Empresa 1');

    fireEvent.click(screen.getByRole('button', { name: 'Siguiente' }));

    await waitFor(() => expect(urlsDe('/api/vendor/my-sales').length).toBe(2));
    expect(urlsDe('/api/vendor/my-sales')[1]).toContain('page=2');
  });

  it('PAGO-026: con una sola página no se ofrecen controles', async () => {
    mockFetch.mockImplementation((url: string) => {
      const texto = String(url);
      if (texto.includes('/api/vendor/my-sales')) {
        return Promise.resolve(
          respuesta({
            ...RESPUESTA_VENTAS,
            data: {
              ...RESPUESTA_VENTAS.data,
              pagination: { page: 1, limit: 20, totalCount: 1, totalPages: 1 }
            }
          })
        );
      }
      return Promise.resolve(respuesta(RESPUESTA_CODIGO));
    });

    render(<VendorDashboardPage />);
    await screen.findAllByText('Empresa 1');

    expect(screen.queryByRole('button', { name: 'Siguiente' })).toBeNull();
  });

  it('PAGO-050: un 500 al pedir el código se avisa, no se disfraza de "aún no tienes código"', async () => {
    mockFetch.mockImplementation((url: string) => {
      const texto = String(url);
      if (texto.includes('/api/vendor/my-code')) {
        return Promise.resolve(respuesta({ success: false, error: 'Error al obtener código de descuento' }, 500));
      }
      return Promise.resolve(respuesta(RESPUESTA_VENTAS));
    });

    render(<VendorDashboardPage />);

    await screen.findByText('Error al obtener código de descuento');
  });

  it('PAGO-050: un 500 al pedir las ventas también se avisa', async () => {
    mockFetch.mockImplementation((url: string) => {
      const texto = String(url);
      if (texto.includes('/api/vendor/my-sales')) {
        return Promise.resolve(respuesta({ success: false, error: 'Error al obtener ventas' }, 500));
      }
      return Promise.resolve(respuesta(RESPUESTA_CODIGO));
    });

    render(<VendorDashboardPage />);

    await screen.findByText('Error al obtener ventas');
    expect(screen.getByText('Aún no tienes ventas')).toBeInTheDocument();
  });

  it('el camino normal sigue funcionando: código y ventas a la vista', async () => {
    render(<VendorDashboardPage />);

    await screen.findByText('EDUARDO10');
    await screen.findAllByText('Empresa 1');
    expect(screen.queryByText(/No pudimos cargar/)).toBeNull();
  });
});
