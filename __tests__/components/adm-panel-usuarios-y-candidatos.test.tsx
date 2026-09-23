// RUTA: __tests__/components/adm-panel-usuarios-y-candidatos.test.tsx

/**
 * /admin/users y /admin/candidates: los dos listados grandes del panel.
 *
 * /admin/users
 * - ADM-025: sin paginador; "Total" contaba la página cargada (30).
 * - ADM-009/051: el admin podía desactivarse a sí mismo y quedarse sin panel.
 * - ADM-024: la especialidad salía de una lista de 7 nombres escrita a mano.
 * - ADM-050: el input aceptaba contraseñas de 6 que la API rechaza.
 * - ADM-097: al dejar de ser especialista se reenviaba la especialidad vieja.
 * - ADM-098: desactivar desde el pill no avisaba de las vacantes asignadas.
 *
 * /admin/candidates
 * - ADM-016: sin paginador y tarjetas contadas sobre 30 filas.
 * - ADM-099: el enlace ?search=<email> del alta duplicada no filtraba.
 * - ADM-024: el filtro de perfil no salía del catálogo.
 */

import React from 'react';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';

let mockParams = new URLSearchParams();
jest.mock('next/navigation', () => ({
  useSearchParams: () => mockParams,
  useRouter: () => ({ push: jest.fn(), replace: jest.fn(), prefetch: jest.fn() }),
  usePathname: () => '/admin'
}));

const respuesta = (body: unknown, status = 200) => ({
  ok: status >= 200 && status < 300,
  status,
  json: () => Promise.resolve(body)
});

const mockFetch = jest.fn();
global.fetch = mockFetch as unknown as typeof fetch;

const urlsDe = (fragmento: string) =>
  mockFetch.mock.calls.map(([u]) => String(u)).filter((u) => u.includes(fragmento));

const pag = (page: number, total: number, limit = 30) => {
  const totalPages = Math.max(1, Math.ceil(total / limit));
  return { page, limit, total, totalPages, hasNext: page < totalPages, hasPrev: page > 1 };
};

import AdminUsersPage from '@/app/admin/users/page';
import AdminCandidatesPage from '@/app/admin/candidates/page';

const usuario = (id: number, extra: Record<string, unknown> = {}) => ({
  id,
  email: `u${id}@inakat.com`,
  nombre: `Usuario${id}`,
  apellidoPaterno: 'Apellido',
  apellidoMaterno: null,
  role: 'recruiter',
  specialty: null,
  isActive: true,
  createdAt: '2026-01-01T00:00:00.000Z',
  _count: { recruiterAssignments: 0, specialistAssignments: 0 },
  ...extra
});

describe('/admin/users', () => {
  let confirmSpy: jest.SpyInstance;
  const usuarios = [
    usuario(1, { role: 'admin' }),
    usuario(2, { _count: { recruiterAssignments: 6, specialistAssignments: 0 } }),
    usuario(3, { role: 'specialist', specialty: 'Tecnología' })
  ];

  beforeEach(() => {
    jest.clearAllMocks();
    confirmSpy = jest.spyOn(window, 'confirm').mockReturnValue(false);
    mockFetch.mockImplementation((url: string, init?: RequestInit) => {
      const u = String(url);
      if (init?.method === 'PUT' || init?.method === 'POST') {
        return Promise.resolve(respuesta({ success: true, message: 'ok' }));
      }
      if (u.startsWith('/api/auth/me')) {
        return Promise.resolve(respuesta({ success: true, user: { id: 1, role: 'admin' } }));
      }
      if (u.startsWith('/api/specialties')) {
        return Promise.resolve(respuesta({ success: true, names: ['Tecnología', 'Marketing'] }));
      }
      if (u.startsWith('/api/admin/users')) {
        const params = new URL(u, 'http://x').searchParams;
        if (params.get('limit') === '1') {
          return Promise.resolve(respuesta({ success: true, data: [], pagination: pag(1, 35, 1) }));
        }
        const page = Number(params.get('page') || '1');
        return Promise.resolve(
          respuesta({ success: true, data: page === 1 ? usuarios : [usuario(31)], pagination: pag(page, 35) })
        );
      }
      return Promise.resolve(respuesta({ success: false }, 404));
    });
  });

  afterEach(() => confirmSpy.mockRestore());

  it('ADM-025: la tarjeta Total es el total real y se llega a la página 2', async () => {
    render(<AdminUsersPage />);
    await screen.findByText(/Usuario2/);

    const total = screen.getByText('Total').parentElement as HTMLElement;
    await waitFor(() => expect(total).toHaveTextContent('35'));

    fireEvent.click(screen.getByRole('button', { name: 'Siguiente' }));
    expect(await screen.findByText(/Usuario31/)).toBeInTheDocument();
    expect(urlsDe('page=2').length).toBeGreaterThan(0);
  });

  it('ADM-009/051: sobre la propia fila no se ofrece desactivar', async () => {
    render(<AdminUsersPage />);
    expect(await screen.findByText('Activo (tú)')).toBeInTheDocument();

    const fila = screen.getByText('Activo (tú)').closest('tr') as HTMLElement;
    expect(within(fila).queryByTitle('Desactivar')).not.toBeInTheDocument();
  });

  it('ADM-098: desactivar desde el pill avisa de las vacantes asignadas', async () => {
    render(<AdminUsersPage />);
    await screen.findByText('Activo (tú)');

    const fila = screen.getByText(/Usuario2/).closest('tr') as HTMLElement;
    fireEvent.click(within(fila).getByRole('button', { name: 'Activo' }));

    expect(confirmSpy).toHaveBeenCalledTimes(1);
    expect(String(confirmSpy.mock.calls[0][0])).toContain('6 vacante(s)');
    expect(mockFetch.mock.calls.filter(([, i]) => i?.method === 'PUT')).toHaveLength(0);
  });

  it('ADM-024/050: especialidades del catálogo y contraseña de 8 como mínimo', async () => {
    render(<AdminUsersPage />);
    await screen.findByText('Activo (tú)');

    const fila = screen.getByText(/Usuario3/).closest('tr') as HTMLElement;
    fireEvent.click(within(fila).getByTitle('Editar'));

    const form = document.querySelector('form') as HTMLFormElement;
    expect(within(form).getByRole('option', { name: 'Marketing' })).toBeInTheDocument();
    const password = form.querySelector('input[type="password"]') as HTMLInputElement;
    expect(password.minLength).toBe(8);
  });

  it('ADM-097: al pasar un especialista a reclutador no se reenvía su especialidad', async () => {
    render(<AdminUsersPage />);
    await screen.findByText('Activo (tú)');

    const fila = screen.getByText(/Usuario3/).closest('tr') as HTMLElement;
    fireEvent.click(within(fila).getByTitle('Editar'));

    const form = document.querySelector('form') as HTMLFormElement;
    const [rol] = within(form).getAllByRole('combobox');
    fireEvent.change(rol, { target: { value: 'recruiter' } });
    fireEvent.submit(form);

    await waitFor(() =>
      expect(mockFetch.mock.calls.filter(([, i]) => i?.method === 'PUT')).toHaveLength(1)
    );
    const [, init] = mockFetch.mock.calls.find(([, i]) => i?.method === 'PUT')!;
    const body = JSON.parse(String(init.body));
    expect(body.role).toBe('recruiter');
    expect(body.specialty).toBe('');
    expect(body).not.toHaveProperty('password');
  });
});

const candidato = (id: number) => ({
  id,
  nombre: `Cand${id}`,
  apellidoPaterno: 'Prueba',
  apellidoMaterno: null,
  email: `cand${id}@correo.com`,
  telefono: null,
  sexo: null,
  fechaNacimiento: null,
  edad: null,
  universidad: null,
  carrera: null,
  nivelEstudios: null,
  educacion: [],
  profile: 'Tecnología',
  subcategory: null,
  seniority: 'Sr',
  añosExperiencia: 2,
  cvUrl: null,
  portafolioUrl: null,
  linkedinUrl: null,
  fotoUrl: null,
  source: 'manual',
  notas: null,
  status: 'available',
  createdAt: '2026-01-01T00:00:00.000Z',
  experiences: [],
  documents: [],
  userId: null
});

describe('/admin/candidates', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockParams = new URLSearchParams();
    mockFetch.mockImplementation((url: string) => {
      const u = String(url);
      if (u.startsWith('/api/specialties')) {
        return Promise.resolve(respuesta({ success: true, names: ['Tecnología', 'Marketing'], data: [] }));
      }
      if (u.startsWith('/api/admin/candidates')) {
        const params = new URL(u, 'http://x').searchParams;
        if (params.get('limit') === '1') {
          const totales: Record<string, number> = { '': 500, available: 300, in_process: 150, hired: 40 };
          return Promise.resolve(
            respuesta({ success: true, data: [], pagination: pag(1, totales[params.get('status') || ''], 1) })
          );
        }
        const page = Number(params.get('page') || '1');
        return Promise.resolve(
          respuesta({ success: true, data: page === 1 ? [candidato(1)] : [candidato(31)], pagination: pag(page, 500) })
        );
      }
      return Promise.resolve(respuesta({ success: false }, 404));
    });
  });

  it('ADM-016: las tarjetas cuentan el banco completo y el paginador pide la página 2', async () => {
    render(<AdminCandidatesPage />);
    await screen.findAllByText(/Cand1/);

    await waitFor(() => expect(screen.getByText(/Mostrando 1 de 500 candidatos/)).toBeInTheDocument());
    expect(screen.getAllByText('500').length).toBeGreaterThan(0);
    expect(screen.getAllByText('40').length).toBeGreaterThan(0);

    fireEvent.click(screen.getByRole('button', { name: 'Siguiente' }));
    expect((await screen.findAllByText(/Cand31/)).length).toBeGreaterThan(0);
    const ultima = new URL(
      urlsDe('/api/admin/candidates').filter((x) => !x.includes('limit=1')).slice(-1)[0],
      'http://x'
    );
    expect(ultima.searchParams.get('page')).toBe('2');
  });

  it('ADM-099: ?search=<email> filtra desde la primera carga', async () => {
    mockParams = new URLSearchParams('search=ana@correo.com');
    render(<AdminCandidatesPage />);
    await screen.findAllByText(/Cand1/);

    const primera = new URL(
      urlsDe('/api/admin/candidates').filter((x) => !x.includes('limit=1'))[0],
      'http://x'
    );
    expect(primera.searchParams.get('search')).toBe('ana@correo.com');
  });

  it('ADM-024: el filtro de perfil ofrece las especialidades del catálogo', async () => {
    render(<AdminCandidatesPage />);
    await screen.findAllByText(/Cand1/);

    fireEvent.click(screen.getByRole('button', { name: /Filtros/ }));
    expect(await screen.findByRole('option', { name: 'Marketing' })).toBeInTheDocument();
  });
});
