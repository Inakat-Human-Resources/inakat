// RUTA: __tests__/components/vac-create-job-mapa.test.tsx
//
// Publicar vacante: la ubicación sin Google Maps y el tipo de trabajo.
//   - Si el script no carga, o si Google rechaza la clave (sin facturación:
//     el script carga pero pinta su diálogo en inglés sobre el mapa), el mapa
//     se quita y queda el campo de dirección escrito a mano, con un aviso.
//   - «Tiempo completo» se lee con minúscula, pero se guarda el valor de
//     siempre («Tiempo Completo»).
//
// El rechazo de la clave se recuerda a nivel de módulo (vale para la sesión),
// así que la prueba que lo dispara va la última.

import React from 'react';
import { render, screen, waitFor, fireEvent, act } from '@testing-library/react';

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn(), prefetch: jest.fn() }),
  useSearchParams: () => ({ get: () => null })
}));

let mockMapa: { isLoaded: boolean; loadError: Error | undefined } = {
  isLoaded: false,
  loadError: undefined
};

jest.mock('@react-google-maps/api', () => ({
  useLoadScript: () => mockMapa,
  GoogleMap: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="google-map">{children}</div>
  ),
  Marker: () => <div data-testid="marker" />,
  Autocomplete: ({ children }: { children: React.ReactNode }) => <div>{children}</div>
}));

const mockFetch = jest.fn();
global.fetch = mockFetch as unknown as typeof fetch;

// Una función de Google que ya estuviera puesta debe seguir llamándose.
const gmAuthFailurePrevia = jest.fn();
(window as Window & { gm_authFailure?: () => void }).gm_authFailure = gmAuthFailurePrevia;

import CreateJobForm from '@/components/sections/jobs/CreateJobForm';

const responder = (cuerpo: unknown) =>
  Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(cuerpo) });

const montarApis = () => {
  mockFetch.mockImplementation((url: string) => {
    if (url.startsWith('/api/pricing/calculate')) {
      return responder({
        success: true,
        options: { profiles: [], seniorities: [], workModes: [], locations: [] }
      });
    }
    if (url.startsWith('/api/specialties')) return responder({ success: true, data: [] });
    if (url.startsWith('/api/auth/me')) {
      return responder({ success: true, user: { credits: 10, role: 'company' } });
    }
    return responder({ success: false });
  });
};

const montarFormulario = async () => {
  render(<CreateJobForm />);
  await waitFor(() => expect(mockFetch).toHaveBeenCalled());
};

describe('CreateJobForm: ubicación sin mapa y tipo de trabajo', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    montarApis();
    mockMapa = { isLoaded: false, loadError: undefined };
  });

  it('el tipo de trabajo se lee «Tiempo completo» y guarda el valor de siempre', async () => {
    await montarFormulario();

    const select = document.querySelector('select[name="jobType"]') as HTMLSelectElement;
    expect(select.value).toBe('Tiempo Completo');
    expect(select.options[select.selectedIndex].textContent).toBe('Tiempo completo');
    expect(Array.from(select.options).map((o) => o.textContent)).toEqual([
      'Tiempo completo',
      'Medio tiempo',
      'Por proyecto',
      'Temporal',
      'Prácticas'
    ]);
    expect(Array.from(select.options).map((o) => o.value)).toEqual([
      'Tiempo Completo',
      'Medio Tiempo',
      'Por Proyecto',
      'Temporal',
      'Prácticas'
    ]);
  });

  it('mientras carga el mapa, el campo simple dice que está cargando y no hay aviso', async () => {
    await montarFormulario();

    expect(
      screen.getByPlaceholderText('Cargando mapa... ej. Monterrey, Nuevo León')
    ).toBeInTheDocument();
    expect(screen.queryByText(/El mapa no está disponible/)).not.toBeInTheDocument();
  });

  it('si el script de Google no carga, queda el campo escrito a mano con un aviso', async () => {
    mockMapa = { isLoaded: false, loadError: new Error('sin red') };
    await montarFormulario();

    const campo = screen.getByPlaceholderText('ej. Monterrey, Nuevo León');
    expect(screen.queryByPlaceholderText(/Cargando mapa/)).not.toBeInTheDocument();
    expect(screen.getByText(/El mapa no está disponible en este momento/)).toBeInTheDocument();
    expect(screen.getByText('Escribe la dirección con ciudad y estado.')).toBeInTheDocument();
    expect(screen.queryByTestId('google-map')).not.toBeInTheDocument();

    fireEvent.change(campo, { target: { value: 'Monterrey, Nuevo León' } });
    expect(campo).toHaveValue('Monterrey, Nuevo León');
  });

  // Va la última: el rechazo de la clave vale para el resto de la sesión.
  it('si Google rechaza la clave (gm_authFailure), se quita el mapa y queda el campo a mano', async () => {
    mockMapa = { isLoaded: true, loadError: undefined };
    await montarFormulario();

    // Con el mapa bien: autocompletado + mapa + estado del punto.
    expect(screen.getByPlaceholderText('Busca una dirección...')).toBeInTheDocument();
    expect(screen.getByTestId('google-map')).toBeInTheDocument();
    expect(screen.getByText('Sin punto exacto en el mapa')).toBeInTheDocument();

    act(() => {
      (window as Window & { gm_authFailure?: () => void }).gm_authFailure?.();
    });

    expect(gmAuthFailurePrevia).toHaveBeenCalledTimes(1);
    expect(screen.queryByTestId('google-map')).not.toBeInTheDocument();
    expect(screen.queryByPlaceholderText('Busca una dirección...')).not.toBeInTheDocument();
    const campo = screen.getByPlaceholderText('ej. Monterrey, Nuevo León');
    expect(campo).not.toBeDisabled();
    expect(screen.getByText(/El mapa no está disponible en este momento/)).toBeInTheDocument();

    fireEvent.change(campo, { target: { value: 'Guadalajara, Jalisco' } });
    expect(campo).toHaveValue('Guadalajara, Jalisco');
  });
});
