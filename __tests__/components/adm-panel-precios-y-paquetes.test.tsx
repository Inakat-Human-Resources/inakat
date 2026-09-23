// RUTA: __tests__/components/adm-panel-precios-y-paquetes.test.tsx

/**
 * Las dos pantallas donde el admin fija lo que cuesta publicar y lo que se
 * cobra por créditos. Un clic de más aquí cambia lo que pagan las empresas.
 *
 * /admin/pricing
 * - ADM-020: el pill de Estado desactivaba una combinación sin avisar (deja de
 *   tener precio y de exigir salario mínimo).
 * - ADM-021: "limpiar filtros" recargaba con los filtros viejos.
 * - ADM-022: el campo de créditos vacío se guardaba como 0 (publicación gratis).
 * - ADM-045: borrar una fila era irreversible; nadie llamaba a /pricing/sync.
 * - ADM-067: el error de guardado se pintaba detrás del modal.
 *
 * /admin/credit-packages
 * - ADM-061: el pill desactivaba un paquete sin confirmación.
 * - ADM-062: los precios con centavos se mostraban redondeados a pesos.
 * - ADM-067: el error de guardado se pintaba detrás del modal.
 */

import React from 'react';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';

const respuesta = (body: unknown, status = 200) => ({
  ok: status >= 200 && status < 300,
  status,
  json: () => Promise.resolve(body)
});

const mockFetch = jest.fn();
global.fetch = mockFetch as unknown as typeof fetch;

const llamadas = (fragmento: string, metodo?: string) =>
  mockFetch.mock.calls.filter(
    ([u, init]) => String(u).includes(fragmento) && (!metodo || (init?.method || 'GET') === metodo)
  );

import AdminPricingPage from '@/app/admin/pricing/page';
import AdminCreditPackagesPage from '@/app/admin/credit-packages/page';

const entrada = {
  id: 7,
  profile: 'Tecnología',
  seniority: 'Director',
  workMode: 'remote',
  location: null,
  credits: 12,
  minSalary: 60000,
  isActive: true,
  createdAt: '2026-01-01T00:00:00.000Z'
};

describe('/admin/pricing', () => {
  let confirmSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    confirmSpy = jest.spyOn(window, 'confirm').mockReturnValue(true);
    mockFetch.mockImplementation((url: string, init?: RequestInit) => {
      const u = String(url);
      const metodo = init?.method || 'GET';
      if (u.startsWith('/api/admin/pricing/sync')) {
        return Promise.resolve(respuesta({ success: true, message: 'Sincronización completada: 3 precios creados' }));
      }
      if (u.startsWith('/api/admin/pricing') && metodo === 'GET') {
        return Promise.resolve(respuesta({ success: true, data: [entrada], profiles: ['Tecnología'] }));
      }
      if (u.startsWith('/api/admin/pricing') && metodo === 'PUT') {
        return Promise.resolve(respuesta({ success: false, error: 'Credits debe ser un entero mayor o igual a 1' }, 400));
      }
      return Promise.resolve(respuesta({ success: false }, 404));
    });
  });

  afterEach(() => confirmSpy.mockRestore());

  it('ADM-020: desactivar pide confirmación y, si se cancela, no toca nada', async () => {
    confirmSpy.mockReturnValue(false);
    render(<AdminPricingPage />);

    fireEvent.click(await screen.findByRole('button', { name: 'Activo' }));

    expect(confirmSpy).toHaveBeenCalledTimes(1);
    expect(String(confirmSpy.mock.calls[0][0])).toContain('12 créditos');
    expect(llamadas('/api/admin/pricing', 'PUT')).toHaveLength(0);
  });

  it('ADM-021: limpiar filtros recarga SIN los filtros anteriores', async () => {
    render(<AdminPricingPage />);
    await screen.findByRole('button', { name: 'Activo' });

    const [perfil] = screen.getAllByRole('combobox');
    fireEvent.change(perfil, { target: { value: 'Tecnología' } });
    fireEvent.click(screen.getByRole('button', { name: /Filtrar/ }));
    await waitFor(() =>
      expect(llamadas('profile=Tecnolog').length).toBe(1)
    );

    fireEvent.click(screen.getByRole('button', { name: 'Limpiar filtros y recargar' }));

    await waitFor(() => expect(llamadas('/api/admin/pricing?', 'GET').length).toBe(3));
    const ultima = String(llamadas('/api/admin/pricing?', 'GET').slice(-1)[0][0]);
    expect(new URL(ultima, 'http://x').searchParams.toString()).toBe('');
  });

  it('ADM-022/067: créditos vacíos no se envían y el aviso sale DENTRO del modal', async () => {
    render(<AdminPricingPage />);
    fireEvent.click(await screen.findByTitle('Editar créditos'));

    const form = document.querySelector('form') as HTMLFormElement;
    const creditos = within(form).getAllByRole('spinbutton')[0];
    fireEvent.change(creditos, { target: { value: '' } });
    fireEvent.submit(form);

    expect(within(form).getByRole('alert')).toHaveTextContent('Escribe cuántos créditos');
    expect(llamadas('/api/admin/pricing', 'PUT')).toHaveLength(0);

    fireEvent.change(creditos, { target: { value: '0' } });
    fireEvent.submit(form);
    expect(within(form).getByRole('alert')).toHaveTextContent('mayor o igual a 1');
    expect(llamadas('/api/admin/pricing', 'PUT')).toHaveLength(0);
  });

  it('ADM-067: el error del servidor al guardar se ve dentro del modal', async () => {
    render(<AdminPricingPage />);
    fireEvent.click(await screen.findByTitle('Editar créditos'));

    const form = document.querySelector('form') as HTMLFormElement;
    fireEvent.change(within(form).getAllByRole('spinbutton')[0], { target: { value: '9' } });
    fireEvent.submit(form);

    await waitFor(() =>
      expect(within(form).getByRole('alert')).toHaveTextContent('Credits debe ser un entero')
    );
    const [, init] = llamadas('/api/admin/pricing', 'PUT')[0];
    expect(JSON.parse(String(init.body)).credits).toBe(9);
  });

  it('ADM-045: hay forma de regenerar las combinaciones borradas', async () => {
    render(<AdminPricingPage />);
    await screen.findByRole('button', { name: 'Activo' });

    fireEvent.click(screen.getByRole('button', { name: /Regenerar combinaciones faltantes/ }));

    await waitFor(() => expect(llamadas('/api/admin/pricing/sync', 'POST')).toHaveLength(1));
    expect(await screen.findByText(/3 precios creados/)).toBeInTheDocument();
  });
});

const paquete = {
  id: 3,
  name: 'Pack 10',
  credits: 10,
  price: 34999.5,
  pricePerCredit: 3499.95,
  badge: null,
  isActive: true,
  sortOrder: 1,
  createdAt: '2026-01-01T00:00:00.000Z'
};

describe('/admin/credit-packages', () => {
  let confirmSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    confirmSpy = jest.spyOn(window, 'confirm').mockReturnValue(true);
    mockFetch.mockImplementation((url: string, init?: RequestInit) => {
      const metodo = init?.method || 'GET';
      if (String(url) === '/api/admin/credit-packages' && metodo === 'GET') {
        return Promise.resolve(respuesta({ success: true, data: [paquete] }));
      }
      if (metodo === 'PUT' || metodo === 'POST') {
        return Promise.resolve(respuesta({ success: false, error: 'El precio debe ser mayor a 0' }, 400));
      }
      return Promise.resolve(respuesta({ success: false }, 404));
    });
  });

  afterEach(() => confirmSpy.mockRestore());

  it('ADM-061: el pill de Estado pide confirmación antes de desactivar', async () => {
    confirmSpy.mockReturnValue(false);
    render(<AdminCreditPackagesPage />);

    fireEvent.click(await screen.findByRole('button', { name: 'Activo' }));

    expect(confirmSpy).toHaveBeenCalledTimes(1);
    expect(llamadas('/api/admin/credit-packages/3', 'PUT')).toHaveLength(0);
  });

  it('ADM-062: el precio se muestra con sus centavos, no redondeado', async () => {
    render(<AdminCreditPackagesPage />);
    await screen.findByText('Pack 10');

    const fila = screen.getByText('Pack 10').closest('tr') as HTMLElement;
    expect(fila.textContent).toContain('34,999.5');
    expect(fila.textContent).not.toContain('35,000');
  });

  it('ADM-067: el error al guardar se ve dentro del modal', async () => {
    render(<AdminCreditPackagesPage />);
    fireEvent.click(await screen.findByTitle('Editar'));

    const form = document.querySelector('form') as HTMLFormElement;
    fireEvent.submit(form);

    await waitFor(() =>
      expect(within(form).getByRole('alert')).toHaveTextContent('El precio debe ser mayor a 0')
    );
  });
});
