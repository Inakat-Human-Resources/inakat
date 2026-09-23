// RUTA: __tests__/components/pago-admin-vendors-page.test.tsx

/**
 * El panel de vendedores y comisiones (/admin/vendors). Aquí se decide a quién
 * se le transfiere dinero, así que lo que la pantalla enseña tiene que ser lo
 * que hay:
 *
 * - PAGO-007: las APIs devuelven 20 filas por tanda; la página no pedía más, y
 *   las comisiones escondidas eran justo las más antiguas.
 * - PAGO-008: un 401 o un 500 se pintaban como "todas las comisiones han sido
 *   pagadas". El admin concluía que no debía nada.
 * - PAGO-010: la URL del comprobante sobrevivía al cerrar el modal y se
 *   guardaba en la comisión equivocada.
 * - PAGO-011 / PAGO-036: porcentajes vacíos que se volvían 0 sin avisar, y
 *   email/código sin comprobar (el modal no es un <form>).
 * - PAGO-013: el comprobante se aceptaba sin esquema y acababa siendo un enlace
 *   relativo roto en el panel del vendedor.
 * - PAGO-028: al abrir la página las comisiones se pedían dos veces.
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

const mockPush = jest.fn();

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush, replace: jest.fn(), prefetch: jest.fn() })
}));

const respuesta = (body: unknown, status = 200) => ({
  ok: status >= 200 && status < 300,
  status,
  json: () => Promise.resolve(body)
});

const vendedor = (id: number) => ({
  id,
  code: `VEND${id}`,
  discountPercent: 10,
  commissionPercent: 10,
  isActive: true,
  createdAt: '2026-01-10T00:00:00.000Z',
  user: { id: 100 + id, nombre: `Vendedor ${id}`, email: `v${id}@inakat.com`, role: 'vendor' },
  stats: { totalSales: 3, totalRevenue: 90000, totalCommission: 9000, pendingCommission: 3000, paidCommission: 6000 }
});

const comision = (id: number) => ({
  id,
  vendor: { id: 100 + id, nombre: `Vendedor ${id}`, email: `v${id}@inakat.com`, code: `VEND${id}` },
  company: { id: 900 + id, nombre: `Contacto ${id}`, email: `e${id}@empresa.com`, nombreEmpresa: `Empresa ${id}` },
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

const RESPUESTA_VENDEDORES = {
  success: true,
  data: {
    vendors: [vendedor(1)],
    globalStats: {
      totalVendors: 25,
      totalSales: 10,
      totalRevenue: 300000,
      totalCommissions: 30000,
      pendingCommissions: 9000
    },
    pagination: { page: 1, limit: 20, totalCount: 25, totalPages: 2 }
  }
};

const RESPUESTA_COMISIONES = {
  success: true,
  data: {
    commissions: [comision(1), comision(2)],
    summary: { pending: { count: 27, total: 85050 }, paid: { count: 4, total: 12600 } },
    pagination: { page: 1, limit: 20, totalCount: 27, totalPages: 2 }
  }
};

const mockFetch = jest.fn();
global.fetch = mockFetch as unknown as typeof fetch;

const urlsDe = (fragmento: string) =>
  mockFetch.mock.calls
    .map(([url]) => (typeof url === 'string' ? url : ''))
    .filter((url) => url.includes(fragmento));

import AdminVendorsPage from '@/app/admin/vendors/page';

const respuestaPorDefecto = (url: string) => {
  if (url.includes('/api/admin/vendors/commissions')) {
    return Promise.resolve(respuesta(RESPUESTA_COMISIONES));
  }
  if (url.includes('/api/admin/vendors')) {
    return Promise.resolve(respuesta(RESPUESTA_VENDEDORES));
  }
  return Promise.resolve(respuesta({ success: false, error: 'Ruta no esperada' }, 404));
};

describe('Panel de vendedores y comisiones', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFetch.mockImplementation((url: string) => respuestaPorDefecto(String(url)));
  });

  const abrirPendientes = async () => {
    fireEvent.click(screen.getByRole('button', { name: /Pendientes/ }));
    await screen.findByText('Empresa 1');
  };

  it('PAGO-007: pide la página y el tamaño de tanda a las dos APIs', async () => {
    render(<AdminVendorsPage />);

    await waitFor(() => expect(urlsDe('/api/admin/vendors?').length).toBe(1));

    const urlVendedores = urlsDe('/api/admin/vendors?')[0];
    expect(urlVendedores).toContain('page=1');
    expect(urlVendedores).toContain('limit=20');

    const urlComisiones = urlsDe('/api/admin/vendors/commissions')[0];
    expect(urlComisiones).toContain('page=1');
    expect(urlComisiones).toContain('limit=20');
    expect(urlComisiones).toContain('status=pending');
  });

  it('PAGO-007: "Siguiente" trae la segunda tanda de vendedores', async () => {
    render(<AdminVendorsPage />);
    await screen.findByText('Vendedor 1');

    fireEvent.click(screen.getByRole('button', { name: 'Siguiente' }));

    await waitFor(() => expect(urlsDe('/api/admin/vendors?').length).toBe(2));
    expect(urlsDe('/api/admin/vendors?')[1]).toContain('page=2');
  });

  it('PAGO-007: sin segunda página no se ofrecen controles', async () => {
    mockFetch.mockImplementation((url: string) => {
      const texto = String(url);
      if (texto.includes('/api/admin/vendors/commissions')) {
        return Promise.resolve(respuesta(RESPUESTA_COMISIONES));
      }
      return Promise.resolve(
        respuesta({
          ...RESPUESTA_VENDEDORES,
          data: {
            ...RESPUESTA_VENDEDORES.data,
            pagination: { page: 1, limit: 20, totalCount: 1, totalPages: 1 }
          }
        })
      );
    });

    render(<AdminVendorsPage />);
    await screen.findByText('Vendedor 1');

    expect(screen.queryByRole('button', { name: 'Siguiente' })).toBeNull();
  });

  it('PAGO-028: al abrir la página las comisiones se piden una sola vez', async () => {
    render(<AdminVendorsPage />);

    await waitFor(() => expect(urlsDe('/api/admin/vendors/commissions').length).toBeGreaterThan(0));
    // Un respiro por si hubiera un segundo efecto disparando otra petición.
    await waitFor(() => expect(urlsDe('/api/admin/vendors?').length).toBe(1));

    expect(urlsDe('/api/admin/vendors/commissions').length).toBe(1);
  });

  it('PAGO-008: un fallo de la API no se disfraza de "todas las comisiones han sido pagadas"', async () => {
    mockFetch.mockImplementation((url: string) => {
      const texto = String(url);
      if (texto.includes('/api/admin/vendors/commissions')) {
        return Promise.resolve(respuesta({ success: false, error: 'Error al obtener comisiones' }, 500));
      }
      return Promise.resolve(respuesta(RESPUESTA_VENDEDORES));
    });

    render(<AdminVendorsPage />);
    fireEvent.click(screen.getByRole('button', { name: /Pendientes/ }));

    await screen.findByText('No se pudieron cargar los datos');
    expect(screen.getByText('Error al obtener comisiones')).toBeInTheDocument();
    expect(screen.queryByText('Todas las comisiones han sido pagadas')).toBeNull();
  });

  it('PAGO-008: con la sesión caducada se manda al login', async () => {
    mockFetch.mockImplementation((url: string) => {
      const texto = String(url);
      if (texto.includes('/api/admin/vendors/commissions')) {
        return Promise.resolve(respuesta({ success: false, error: 'No autorizado' }, 401));
      }
      return Promise.resolve(respuesta(RESPUESTA_VENDEDORES));
    });

    render(<AdminVendorsPage />);

    await waitFor(() => expect(mockPush).toHaveBeenCalledWith('/login'));
  });

  it('PAGO-010: el comprobante no se hereda de la comisión anterior', async () => {
    const { container } = render(<AdminVendorsPage />);
    await abrirPendientes();

    const botonesPagar = screen.getAllByRole('button', { name: 'Marcar Pagada' });

    // Comisión 1: se escribe una URL y se cancela.
    fireEvent.click(botonesPagar[0]);
    const campo = () => container.querySelector('input[type="url"]') as HTMLInputElement;
    fireEvent.change(campo(), { target: { value: 'https://banco/comprobante-uno.pdf' } });
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));

    // Comisión 2: el campo tiene que venir en blanco.
    fireEvent.click(screen.getAllByRole('button', { name: 'Marcar Pagada' })[1]);
    expect(campo().value).toBe('');
  });

  it('PAGO-013: un comprobante sin http(s) se rechaza antes de tocar la API', async () => {
    const { container } = render(<AdminVendorsPage />);
    await abrirPendientes();

    fireEvent.click(screen.getAllByRole('button', { name: 'Marcar Pagada' })[0]);
    const campo = container.querySelector('input[type="url"]') as HTMLInputElement;
    fireEvent.change(campo, { target: { value: 'drive.google.com/file/abc' } });

    fireEvent.click(screen.getByRole('button', { name: /Confirmar Pago/ }));

    await screen.findByText(/debe ser un enlace completo/);
    expect(mockFetch.mock.calls.some(([, opciones]) => opciones?.method === 'PUT')).toBe(false);
  });

  it('PAGO-013: un comprobante válido sí se envía', async () => {
    const { container } = render(<AdminVendorsPage />);
    await abrirPendientes();

    fireEvent.click(screen.getAllByRole('button', { name: 'Marcar Pagada' })[0]);
    const campo = container.querySelector('input[type="url"]') as HTMLInputElement;
    fireEvent.change(campo, { target: { value: 'https://banco.mx/comprobante.pdf' } });

    fireEvent.click(screen.getByRole('button', { name: /Confirmar Pago/ }));

    await waitFor(() =>
      expect(mockFetch.mock.calls.some(([, opciones]) => opciones?.method === 'PUT')).toBe(true)
    );
    const llamadaPut = mockFetch.mock.calls.find(([, opciones]) => opciones?.method === 'PUT');
    expect(JSON.parse(llamadaPut![1].body)).toEqual({
      status: 'paid',
      paymentProofUrl: 'https://banco.mx/comprobante.pdf'
    });
  });

  describe('Alta de vendedor', () => {
    const abrirModal = async () => {
      render(<AdminVendorsPage />);
      await screen.findByText('Vendedor 1');
      fireEvent.click(screen.getByRole('button', { name: /Nuevo Vendedor/ }));
      await screen.findByPlaceholderText('Ej: VENDEDOR10');
    };

    const rellenarValido = (container: HTMLElement) => {
      fireEvent.change(screen.getByPlaceholderText('Nombre'), { target: { value: 'Juan' } });
      fireEvent.change(screen.getByPlaceholderText('Apellido Paterno'), { target: { value: 'Pérez' } });
      fireEvent.change(screen.getByPlaceholderText('vendedor@ejemplo.com'), { target: { value: 'juan@inakat.com' } });
      fireEvent.change(screen.getByPlaceholderText(/Mínimo 8 caracteres/), { target: { value: 'Password1' } });
      fireEvent.change(screen.getByPlaceholderText('Ej: VENDEDOR10'), { target: { value: 'JUAN10' } });
      return container.querySelectorAll('input[type="number"]');
    };

    const hayPost = () => mockFetch.mock.calls.some(([, opciones]) => opciones?.method === 'POST');

    it('PAGO-011: un porcentaje vacío no se convierte en 0 en silencio', async () => {
      await abrirModal();
      const numericos = rellenarValido(document.body);
      fireEvent.change(numericos[1], { target: { value: '' } });

      fireEvent.click(screen.getByRole('button', { name: /Crear Vendedor/ }));

      await screen.findByText(/% de comisión debe ser un número entre 0 y 99/);
      expect(hayPost()).toBe(false);
    });

    it('PAGO-011: un porcentaje fuera de rango se rechaza en vez de recortarse', async () => {
      await abrirModal();
      const numericos = rellenarValido(document.body);
      fireEvent.change(numericos[0], { target: { value: '150' } });

      fireEvent.click(screen.getByRole('button', { name: /Crear Vendedor/ }));

      await screen.findByText(/% de descuento debe ser un número entre 0 y 99/);
      expect(hayPost()).toBe(false);
    });

    it('PAGO-036: el email tiene que tener formato de email', async () => {
      await abrirModal();
      rellenarValido(document.body);
      fireEvent.change(screen.getByPlaceholderText('vendedor@ejemplo.com'), { target: { value: 'juan@' } });

      fireEvent.click(screen.getByRole('button', { name: /Crear Vendedor/ }));

      await screen.findByText('El email no tiene un formato válido');
      expect(hayPost()).toBe(false);
    });

    it('PAGO-036: el código sigue la misma regla que el endpoint del vendedor', async () => {
      await abrirModal();
      rellenarValido(document.body);
      fireEvent.change(screen.getByPlaceholderText('Ej: VENDEDOR10'), { target: { value: 'A' } });

      fireEvent.click(screen.getByRole('button', { name: /Crear Vendedor/ }));

      await screen.findByText(/entre 4 y 20 caracteres/);
      expect(hayPost()).toBe(false);
    });

    it('PAGO-015: la contraseña usa la misma política que el registro', async () => {
      await abrirModal();
      rellenarValido(document.body);
      fireEvent.change(screen.getByPlaceholderText(/Mínimo 8 caracteres/), { target: { value: '123456' } });

      fireEvent.click(screen.getByRole('button', { name: /Crear Vendedor/ }));

      await screen.findByText(/al menos 8 caracteres, una mayúscula y un número/);
      expect(hayPost()).toBe(false);
    });

    it('PAGO-011: con datos válidos los porcentajes viajan como número', async () => {
      await abrirModal();
      const numericos = rellenarValido(document.body);
      fireEvent.change(numericos[0], { target: { value: '15' } });
      fireEvent.change(numericos[1], { target: { value: '12.5' } });

      fireEvent.click(screen.getByRole('button', { name: /Crear Vendedor/ }));

      await waitFor(() => expect(hayPost()).toBe(true));
      const llamadaPost = mockFetch.mock.calls.find(([, opciones]) => opciones?.method === 'POST');
      const cuerpo = JSON.parse(llamadaPost![1].body);
      expect(cuerpo.discountPercent).toBe(15);
      // Los decimales ya no se truncan: la columna es Float.
      expect(cuerpo.commissionPercent).toBe(12.5);
      expect(cuerpo.code).toBe('JUAN10');
    });
  });
});
