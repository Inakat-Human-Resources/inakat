// RUTA: __tests__/components/adm-bandeja-directa-movil.test.tsx

/**
 * /admin/direct-applications en el móvil: cada postulación ocupaba casi una
 * pantalla con cuatro botones a todo el ancho. Ahora «Ver CV» y «Meter al
 * proceso» van en una fila y Descartar/Archivar en el «…» de la ficha (desde
 * lg siguen a la vista en su columna). Lo que se prueba es que el menú hace
 * EXACTAMENTE lo mismo que los botones: la misma confirmación y el mismo PUT.
 */

import React from 'react';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn(), prefetch: jest.fn() }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => '/admin/direct-applications'
}));

const respuesta = (body: unknown, status = 200) => ({
  ok: status >= 200 && status < 300,
  status,
  json: () => Promise.resolve(body)
});

const mockFetch = jest.fn();
global.fetch = mockFetch as unknown as typeof fetch;

const puts = () => mockFetch.mock.calls.filter(([, init]) => init?.method === 'PUT');

import DirectApplicationsPage from '@/app/admin/direct-applications/page';

const postulacion = (id: number) => ({
  id,
  candidateName: `Postulante ${id}`,
  candidateEmail: `p${id}@correo.mx`,
  candidatePhone: null,
  cvUrl: 'https://cdn.example.com/cv.pdf',
  coverLetter: null,
  status: 'pending',
  createdAt: '2026-09-01T00:00:00.000Z',
  job: {
    id: 10 + id,
    title: `Vacante ${id}`,
    company: 'Empresa de respaldo',
    location: 'CDMX',
    status: 'active',
    assignment: null,
    user: { nombre: 'Dueño', email: 'd@correo.mx', companyRequest: { nombreEmpresa: 'Acme' } }
  }
});

describe('/admin/direct-applications: decisiones en el móvil', () => {
  let confirmSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    confirmSpy = jest.spyOn(window, 'confirm').mockReturnValue(true);
    mockFetch.mockImplementation((_url: string, init?: RequestInit) => {
      if (init?.method === 'PUT') return Promise.resolve(respuesta({ success: true, message: 'Hecho' }));
      return Promise.resolve(respuesta({ success: true, data: [postulacion(1), postulacion(2)] }));
    });
  });

  afterEach(() => confirmSpy.mockRestore());

  const abrirMenu = async (nombre: string) => {
    await screen.findByText(nombre);
    const ficha = screen.getByText(nombre).closest('article') as HTMLElement;
    fireEvent.click(within(ficha).getByRole('button', { name: `Más decisiones sobre ${nombre}` }));
    return screen.getByRole('menu');
  };

  it('la ficha conserva a la vista el CV y «Meter al proceso»', async () => {
    render(<DirectApplicationsPage />);
    await screen.findByText('Postulante 1');
    const ficha = within(screen.getByText('Postulante 1').closest('article') as HTMLElement);

    expect(ficha.getByRole('link', { name: /Ver CV/ })).toHaveAttribute('href', 'https://cdn.example.com/cv.pdf');
    expect(ficha.getByRole('button', { name: /Meter al proceso/ })).toBeInTheDocument();
  });

  it('«…» ofrece Descartar y Archivar; Descartar confirma y hace el PUT de siempre', async () => {
    render(<DirectApplicationsPage />);
    const menu = await abrirMenu('Postulante 1');

    expect(within(menu).getAllByRole('menuitem').map((m) => m.textContent)).toEqual(['Descartar', 'Archivar']);
    fireEvent.click(within(menu).getByRole('menuitem', { name: 'Descartar' }));

    await waitFor(() => expect(puts()).toHaveLength(1));
    expect(confirmSpy).toHaveBeenCalledTimes(1);
    expect(String(puts()[0][0])).toBe('/api/admin/direct-applications');
    expect(JSON.parse(String(puts()[0][1].body))).toEqual({ applicationId: 1, newStatus: 'discarded' });
    await waitFor(() => expect(screen.queryByText('Postulante 1')).not.toBeInTheDocument());
  });

  it('Archivar desde el «…» hace el mismo PUT que el botón', async () => {
    render(<DirectApplicationsPage />);
    const menu = await abrirMenu('Postulante 2');

    fireEvent.click(within(menu).getByRole('menuitem', { name: 'Archivar' }));

    await waitFor(() => expect(puts()).toHaveLength(1));
    expect(JSON.parse(String(puts()[0][1].body))).toEqual({ applicationId: 2, newStatus: 'archived' });
  });

  it('si se cancela la confirmación, el menú no envía nada (como el botón)', async () => {
    confirmSpy.mockReturnValue(false);
    render(<DirectApplicationsPage />);
    const menu = await abrirMenu('Postulante 1');

    fireEvent.click(within(menu).getByRole('menuitem', { name: 'Descartar' }));

    expect(confirmSpy).toHaveBeenCalledTimes(1);
    expect(puts()).toHaveLength(0);
    expect(screen.getByText('Postulante 1')).toBeInTheDocument();
  });
});
