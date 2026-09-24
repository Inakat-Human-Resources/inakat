// RUTA: __tests__/components/vac-mis-postulaciones.test.tsx
//
// Páginas de postulaciones del candidato:
//   VAC-016  estados sin mapear (discarded, evaluating, company_interested,
//            archived) se leían como 'Pendiente' y no sumaban en ningún filtro
//   VAC-028  la nota INTERNA (Application.notes) se pintaba como
//            'Nota de la empresa'
//   VAC-033  (parte cliente) el login desde /talents vuelve a la vacante elegida

import React from 'react';
import { render, screen, waitFor, fireEvent, act, within } from '@testing-library/react';

const mockPush = jest.fn();
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush, replace: jest.fn(), prefetch: jest.fn() }),
  useSearchParams: () => ({ get: () => null })
}));

const mockFetch = jest.fn();
global.fetch = mockFetch as unknown as typeof fetch;

import MyApplicationsPage from '@/app/my-applications/page';
import SearchPositionsSection from '@/components/sections/talents/SearchPositionsSection';

const vacante = (id: number) => ({
  id,
  title: `Vacante ${id}`,
  company: `Empresa ${id}`,
  location: 'Monterrey, N.L.',
  salary: '$20,000 / mes',
  jobType: 'Tiempo Completo',
  workMode: 'presential',
  status: 'active',
  companyRating: null,
  description: 'Descripción',
  requirements: null,
  createdAt: new Date(2026, 0, id).toISOString()
});

const postulacion = (id: number, status: string, extra: Record<string, unknown> = {}) => ({
  id,
  candidateName: 'Ana',
  candidateEmail: 'ana@correo.com',
  candidatePhone: null,
  coverLetter: null,
  cvUrl: null,
  status,
  createdAt: new Date(2026, 0, id).toISOString(),
  updatedAt: new Date(2026, 0, id).toISOString(),
  reviewedAt: null,
  job: vacante(id),
  ...extra
});

const responderMisPostulaciones = (applications: unknown[]) => {
  mockFetch.mockImplementation(() =>
    Promise.resolve({
      ok: true,
      status: 200,
      json: () =>
        Promise.resolve({
          success: true,
          data: {
            applications,
            // Conteos de la API tal como venían (sólo estados sueltos): la
            // página ya no depende de ellos.
            stats: { total: applications.length, pending: 0, reviewing: 0, interviewed: 0, accepted: 0, rejected: 0 }
          }
        })
    })
  );
};

describe('/my-applications', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('VAC-016: un estado discarded se lee "No seleccionado" y cuenta en su filtro', async () => {
    responderMisPostulaciones([
      postulacion(1, 'discarded'),
      postulacion(2, 'company_interested'),
      postulacion(3, 'pending')
    ]);

    render(<MyApplicationsPage />);

    await waitFor(() =>
      expect(screen.getByRole('heading', { name: 'Vacante 1' })).toBeInTheDocument()
    );

    // Etiquetas del mapa único (src/lib/application-status.ts), no 'Pendiente'.
    expect(screen.getByText('No seleccionado')).toBeInTheDocument();
    expect(screen.getByText('Empresa interesada')).toBeInTheDocument();

    // El filtro de no seleccionados incluye la descartada (antes: 0). Desde el
    // rediseño (docs/DISENO.md) los filtros son pestañas con su conteo al lado.
    const filtro = screen.getByRole('tab', { name: /No seleccionados\s*\(?1\)?$/ });
    fireEvent.click(filtro);

    expect(screen.getByRole('heading', { name: 'Vacante 1' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Vacante 2' })).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Vacante 3' })).not.toBeInTheDocument();

    // company_interested cae en 'En proceso'.
    expect(screen.getByRole('tab', { name: /En proceso\s*\(?1\)?$/ })).toBeInTheDocument();
  });

  it('VAC-028: la nota interna no se muestra al candidato aunque llegue', async () => {
    responderMisPostulaciones([
      postulacion(1, 'injected_by_admin', {
        notes: 'Candidato inyectado por Admin. Fuente original: occ.'
      })
    ]);

    render(<MyApplicationsPage />);

    await waitFor(() =>
      expect(screen.getByRole('heading', { name: 'Vacante 1' })).toBeInTheDocument()
    );
    expect(screen.queryByText(/Candidato inyectado por Admin/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Nota de la empresa/)).not.toBeInTheDocument();
  });

  // Revisión visual (b7): /my-applications y /candidate/applications son la
  // misma pantalla para dos roles y deben pintarse igual: mismo título, la
  // misma fecha corta del panel y el mismo aviso por estado.
  it('se pinta como su hermana /candidate/applications', async () => {
    responderMisPostulaciones([
      postulacion(1, 'accepted', { reviewedAt: new Date(2026, 0, 3).toISOString() })
    ]);

    render(<MyApplicationsPage />);

    await waitFor(() =>
      expect(screen.getByRole('heading', { name: 'Vacante 1' })).toBeInTheDocument()
    );
    expect(screen.getByRole('heading', { level: 1, name: 'Mis postulaciones' })).toBeInTheDocument();

    // Fecha corta («1 ene 2026»), no la larga («1 de enero de 2026»).
    // Es la del formateador único (src/lib/fechas), que no depende del ICU.
    expect(screen.getByText('Aplicado: 1 ene 2026')).toBeInTheDocument();
    expect(screen.queryByText(/de enero de 2026/)).not.toBeInTheDocument();

    // El aviso por estado y la modalidad legible, como en la hermana.
    expect(screen.getByText(/Has sido seleccionado para este puesto/)).toBeInTheDocument();
    expect(screen.getByText('Presencial')).toBeInTheDocument();
  });
});

describe('/talents — volver a la vacante tras iniciar sesión (VAC-033)', () => {
  const hrefOriginal = window.location.href;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
    window.history.replaceState(null, '', hrefOriginal);
  });

  const responderTalents = (detalle?: ReturnType<typeof vacante>) => {
    mockFetch.mockImplementation((url: string) => {
      if (url.startsWith('/api/jobs?')) {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              success: true,
              data: [vacante(1), vacante(2)],
              pagination: { page: 1, limit: 20, total: 30, totalPages: 2, hasNext: true, hasPrev: false }
            })
        });
      }
      if (url.startsWith('/api/jobs/')) {
        return Promise.resolve({
          ok: Boolean(detalle),
          json: () => Promise.resolve(detalle ? { success: true, data: detalle } : { success: false })
        });
      }
      if (url.startsWith('/api/specialties')) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ success: true, data: [] }) });
      }
      return Promise.resolve({ ok: false, json: () => Promise.resolve({ success: false }) });
    });
  };

  const avanzarDebounce = async () => {
    await act(async () => {
      jest.advanceTimersByTime(350);
    });
  };

  it('?vacante=ID selecciona esa vacante aunque no esté en la primera página', async () => {
    window.history.replaceState(null, '', '/talents?vacante=28');
    responderTalents(vacante(28));

    render(<SearchPositionsSection />);
    await avanzarDebounce();

    // El detalle (h2) muestra la vacante pedida, no la primera del listado.
    await waitFor(() =>
      expect(screen.getByRole('heading', { level: 2, name: 'Vacante 28' })).toBeInTheDocument()
    );
    expect(mockFetch.mock.calls.some(([url]) => url === '/api/jobs/28')).toBe(true);
  });

  it('el botón de login lleva la vacante elegida en el redirect', async () => {
    responderTalents();
    render(<SearchPositionsSection />);
    await avanzarDebounce();

    // La tarjeta se elige con el botón de su título (h3 > button).
    const tarjeta = await screen.findByRole('button', { name: 'Vacante 2' });
    fireEvent.click(tarjeta);
    await waitFor(() =>
      expect(screen.getByRole('heading', { level: 2, name: 'Vacante 2' })).toBeInTheDocument()
    );

    // La navegación va por el router de Next (mockPush).
    // El panel de detalle es el <article> que encabeza ese h2.
    const detalle = screen.getByRole('heading', { level: 2, name: 'Vacante 2' }).closest('article') as HTMLElement;
    fireEvent.click(within(detalle).getByRole('button', { name: /inicia sesión para postularte/i }));

    expect(mockPush).toHaveBeenCalledTimes(1);
    const url = new URL(String(mockPush.mock.calls[0][0]), 'https://inakat.test');
    expect(url.pathname).toBe('/login');
    expect(url.searchParams.get('redirect')).toBe('/talents?vacante=2');
  });
});
