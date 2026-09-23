// RUTA: __tests__/components/vac-search-positions.test.tsx
//
// Cubre los hallazgos VAC-010 (la bolsa pública sólo mostraba la primera página
// y filtraba en el cliente), VAC-051 (el detalle no se sincronizaba con la
// lista) y VAC-053 (controles sin funcionalidad).

import React from 'react';
import { render, screen, waitFor, fireEvent, act } from '@testing-library/react';

// ApplyJobModal (hijo) usa useRouter.
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn(), prefetch: jest.fn() }),
  useSearchParams: () => ({ get: () => null })
}));

const mockFetch = jest.fn();
global.fetch = mockFetch as unknown as typeof fetch;

import SearchPositionsSection from '@/components/sections/talents/SearchPositionsSection';

/** Genera N vacantes de prueba. */
const vacantes = (ids: number[], extra: Record<string, unknown> = {}) =>
  ids.map((id) => ({
    id,
    title: `Vacante ${id}`,
    company: `Empresa ${id}`,
    location: 'Monterrey, N.L.',
    salary: '$20,000 / mes',
    jobType: 'Tiempo Completo',
    workMode: 'presential',
    companyRating: null,
    description: 'Descripción',
    requirements: null,
    status: 'active',
    createdAt: new Date(2026, 0, id).toISOString(),
    ...extra
  }));

/** URLs con las que se llamó a /api/jobs, en orden. */
const urlsDeJobs = (): string[] =>
  mockFetch.mock.calls
    .map((llamada) => String(llamada[0]))
    .filter((url) => url.startsWith('/api/jobs'));

interface RespuestaJobs {
  data: unknown[];
  total: number;
  hasNext: boolean;
}

const responderJobs = (porLlamada: RespuestaJobs[]) => {
  let indice = 0;
  mockFetch.mockImplementation((url: string) => {
    if (url.startsWith('/api/jobs')) {
      const respuesta = porLlamada[Math.min(indice, porLlamada.length - 1)];
      indice++;
      return Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({
            success: true,
            data: respuesta.data,
            pagination: {
              page: 1,
              limit: 20,
              total: respuesta.total,
              totalPages: Math.ceil(respuesta.total / 20),
              hasNext: respuesta.hasNext,
              hasPrev: false
            }
          })
      });
    }
    if (url.startsWith('/api/specialties')) {
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ success: true, data: [] })
      });
    }
    // /api/auth/me → anónimo
    return Promise.resolve({
      ok: false,
      json: () => Promise.resolve({ success: false })
    });
  });
};

describe('SearchPositionsSection — listado público de vacantes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
  });

  /** Avanza el debounce de 300 ms y deja que se resuelvan las promesas. */
  const avanzarDebounce = async () => {
    await act(async () => {
      jest.advanceTimersByTime(350);
    });
  };

  it('VAC-010: pide el listado paginado a la API en vez de traer un solo lote', async () => {
    responderJobs([{ data: vacantes([1, 2]), total: 35, hasNext: true }]);

    render(<SearchPositionsSection />);
    await avanzarDebounce();

    await waitFor(() => expect(urlsDeJobs().length).toBeGreaterThan(0));

    const url = new URL(urlsDeJobs()[0], 'https://inakat.test');
    expect(url.searchParams.get('status')).toBe('active');
    expect(url.searchParams.get('page')).toBe('1');
    expect(url.searchParams.get('limit')).toBe('20');
  });

  it('VAC-010: el término de búsqueda viaja a la API como query param (no se filtra en cliente)', async () => {
    responderJobs([
      { data: vacantes([1, 2]), total: 35, hasNext: true },
      { data: vacantes([28]), total: 1, hasNext: false }
    ]);

    render(<SearchPositionsSection />);
    await avanzarDebounce();
    await waitFor(() => expect(urlsDeJobs().length).toBe(1));

    fireEvent.change(screen.getByPlaceholderText('Buscar puesto, área, empresa'), {
      target: { value: 'Vacante 28' }
    });
    await avanzarDebounce();

    await waitFor(() => expect(urlsDeJobs().length).toBe(2));
    const url = new URL(urlsDeJobs()[1], 'https://inakat.test');
    expect(url.searchParams.get('search')).toBe('Vacante 28');
    expect(url.searchParams.get('page')).toBe('1');

    // La vacante devuelta por el servidor se pinta aunque no estuviera en el
    // primer lote: antes el filtro corría sólo sobre lo ya cargado.
    await waitFor(() =>
      expect(screen.getByRole('heading', { level: 3, name: 'Vacante 28' })).toBeInTheDocument()
    );
  });

  it('VAC-010: "Cargar más" pide la página siguiente y acumula los resultados', async () => {
    responderJobs([
      { data: vacantes([1, 2]), total: 4, hasNext: true },
      { data: vacantes([3, 4]), total: 4, hasNext: false }
    ]);

    render(<SearchPositionsSection />);
    await avanzarDebounce();

    const boton = await screen.findByRole('button', { name: /cargar más vacantes/i });
    await act(async () => {
      fireEvent.click(boton);
    });

    await waitFor(() => expect(urlsDeJobs().length).toBe(2));
    const url = new URL(urlsDeJobs()[1], 'https://inakat.test');
    expect(url.searchParams.get('page')).toBe('2');

    await waitFor(() =>
      expect(screen.getByRole('heading', { level: 3, name: 'Vacante 4' })).toBeInTheDocument()
    );
    // Las de la primera página siguen ahí.
    expect(screen.getByRole('heading', { level: 3, name: 'Vacante 1' })).toBeInTheDocument();
    // Ya no quedan más páginas: el botón desaparece.
    expect(
      screen.queryByRole('button', { name: /cargar más vacantes/i })
    ).not.toBeInTheDocument();
  });

  it('VAC-051: el detalle deja de mostrar una vacante que ya no está en la lista', async () => {
    responderJobs([
      { data: vacantes([1, 2]), total: 2, hasNext: false },
      { data: vacantes([9]), total: 1, hasNext: false }
    ]);

    render(<SearchPositionsSection />);
    await avanzarDebounce();

    // Detalle inicial: la primera de la lista ordenada ('Más reciente': la 2).
    await waitFor(() =>
      expect(screen.getByRole('heading', { level: 2, name: 'Vacante 2' })).toBeInTheDocument()
    );

    fireEvent.change(screen.getByPlaceholderText('Ubicación'), {
      target: { value: 'Guadalajara' }
    });
    await avanzarDebounce();

    await waitFor(() =>
      expect(screen.getByRole('heading', { level: 2, name: 'Vacante 9' })).toBeInTheDocument()
    );
    expect(
      screen.queryByRole('heading', { level: 2, name: 'Vacante 2' })
    ).not.toBeInTheDocument();
  });

  it('VAC-053: ya no se pintan los botones Guardados / Postulados / Vencidos', async () => {
    responderJobs([{ data: vacantes([1]), total: 1, hasNext: false }]);

    render(<SearchPositionsSection />);
    await avanzarDebounce();

    await waitFor(() =>
      expect(screen.getByRole('heading', { level: 3, name: 'Vacante 1' })).toBeInTheDocument()
    );

    expect(screen.queryByRole('button', { name: 'Guardados' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Postulados' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Vencidos' })).not.toBeInTheDocument();
  });
});
