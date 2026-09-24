// RUTA: __tests__/components/vac-create-job-form.test.tsx
//
// Cubre los hallazgos del formulario de vacantes:
//   VAC-029  la sub-especialidad se borraba al abrir la edición
//   VAC-030  se guardaban las coordenadas por defecto de CDMX
//   VAC-031  editar cobraba/devolvía créditos sin avisar ni confirmar
//   VAC-032  el temporizador del borrador pisaba la ida a comprar créditos
//   VAC-038  la edición no cargaba ni devolvía las coordenadas guardadas
//   VAC-045  un `habilidades` no-JSON rompía la edición
//   VAC-046  un 402 al editar mostraba cifras de publicación y entraba en bucle
//   VAC-049  el botón PUBLICAR seguía activo con el costo viejo

import React from 'react';
import { render, screen, waitFor, fireEvent, act } from '@testing-library/react';

const mockPush = jest.fn();
let mockEditId: string | null = null;

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush, replace: jest.fn(), prefetch: jest.fn() }),
  useSearchParams: () => ({
    get: (clave: string) => (clave === 'edit' ? mockEditId : null)
  })
}));

// Google Maps: sin cargar, el formulario pinta el input simple de ubicación.
jest.mock('@react-google-maps/api', () => ({
  useLoadScript: () => ({ isLoaded: false, loadError: null }),
  GoogleMap: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  Marker: () => <div data-testid="marker" />,
  Autocomplete: ({ children }: { children: React.ReactNode }) => <div>{children}</div>
}));

const mockFetch = jest.fn();
global.fetch = mockFetch as unknown as typeof fetch;

import CreateJobForm from '@/components/sections/jobs/CreateJobForm';

const OPCIONES_PRICING = {
  success: true,
  options: {
    profiles: ['Tecnología'],
    seniorities: ['Jr', 'Sr'],
    workModes: ['presential', 'remote', 'hybrid'],
    locations: []
  }
};

const ESPECIALIDADES = {
  success: true,
  data: [
    {
      id: 1,
      name: 'Tecnología',
      slug: 'tecnologia',
      icon: null,
      color: '#000',
      subcategories: ['Backend', 'Frontend']
    }
  ]
};

interface Escenario {
  /** Vacante que devuelve GET /api/jobs/:id en modo edición. */
  job?: Record<string, unknown>;
  /** Créditos del usuario en sesión. */
  credits?: number;
  /** Costo que devuelve POST /api/pricing/calculate. */
  costo?: number;
  /** Respuesta de POST /api/jobs o PUT /api/jobs/:id. */
  guardado?: { status?: number; body: Record<string, unknown> };
  /** Retrasa la respuesta del cálculo de costo hasta soltarla a mano. */
  retrasarCosto?: boolean;
}

let soltarCosto: (() => void) | null = null;

const montarEscenario = (escenario: Escenario = {}) => {
  const {
    job,
    credits = 100,
    costo = 10,
    guardado = { body: { success: true, status: 'draft' } },
    retrasarCosto = false
  } = escenario;

  mockFetch.mockImplementation((url: string, init?: RequestInit) => {
    const metodo = init?.method || 'GET';

    if (url === '/api/pricing/calculate' && metodo === 'POST') {
      const respuesta = {
        ok: true,
        json: () => Promise.resolve({ success: true, credits: costo, minSalary: null })
      };
      if (!retrasarCosto) return Promise.resolve(respuesta);
      return new Promise((resolve) => {
        soltarCosto = () => resolve(respuesta);
      });
    }
    if (url.startsWith('/api/pricing/calculate')) {
      return Promise.resolve({ ok: true, json: () => Promise.resolve(OPCIONES_PRICING) });
    }
    if (url.startsWith('/api/specialties')) {
      return Promise.resolve({ ok: true, json: () => Promise.resolve(ESPECIALIDADES) });
    }
    if (url.startsWith('/api/auth/me')) {
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ success: true, user: { credits, role: 'company' } })
      });
    }
    if (url.startsWith('/api/company/profile')) {
      return Promise.resolve({ ok: true, json: () => Promise.resolve({ success: false }) });
    }
    if (url.startsWith('/api/jobs/') && metodo === 'GET') {
      return Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ success: true, data: job })
      });
    }
    // POST /api/jobs o PUT /api/jobs/:id
    return Promise.resolve({
      ok: (guardado.status || 200) < 400,
      status: guardado.status || 200,
      json: () => Promise.resolve(guardado.body)
    });
  });
};

/** Cuerpo JSON del POST/PUT de guardado de la vacante. */
const cuerpoGuardado = (): Record<string, unknown> | null => {
  const llamada = mockFetch.mock.calls.find(
    ([url, init]) =>
      typeof url === 'string' &&
      url.startsWith('/api/jobs') &&
      (init?.method === 'POST' || init?.method === 'PUT')
  );
  return llamada ? JSON.parse(llamada[1].body) : null;
};

const seleccionar = (contenedorId: string, valor: string) => {
  const select = document
    .getElementById(contenedorId)
    ?.querySelector('select') as HTMLSelectElement;
  fireEvent.change(select, { target: { value: valor } });
};

/** Rellena los campos obligatorios de una vacante nueva. */
const rellenarFormulario = async () => {
  fireEvent.change(screen.getByPlaceholderText('ej. Desarrollador Full Stack'), {
    target: { value: 'Backend Sr' }
  });
  fireEvent.change(screen.getByPlaceholderText('ej. Tech Corp'), {
    target: { value: 'ACME' }
  });
  fireEvent.change(
    screen.getByPlaceholderText('Cargando mapa... ej. Monterrey, Nuevo León'),
    { target: { value: 'Monterrey, Nuevo León' } }
  );
  fireEvent.change(screen.getByPlaceholderText('15,000'), { target: { value: '20000' } });
  fireEvent.change(screen.getByPlaceholderText('22,000'), { target: { value: '25000' } });
  fireEvent.change(
    screen.getByPlaceholderText(
      'Describe las responsabilidades, el ambiente de trabajo, beneficios, etc.'
    ),
    { target: { value: 'Una descripción cualquiera' } }
  );

  await waitFor(() => {
    expect(
      document.getElementById('field-profile')?.querySelector('option[value="Tecnología"]')
    ).toBeTruthy();
  });
  seleccionar('field-profile', 'Tecnología');
  seleccionar('field-seniority', 'Sr');
};

describe('CreateJobForm', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockEditId = null;
    soltarCosto = null;
  });

  it('VAC-029: al abrir una vacante para editar conserva la sub-especialidad guardada', async () => {
    mockEditId = '12';
    montarEscenario({
      job: {
        id: 12,
        title: 'Backend Sr',
        company: 'ACME',
        location: 'Monterrey',
        salaryMin: 20000,
        salaryMax: 25000,
        jobType: 'Tiempo Completo',
        workMode: 'presential',
        description: 'desc',
        profile: 'Tecnología',
        subcategory: 'Backend',
        seniority: 'Sr',
        status: 'active',
        creditCost: 10
      }
    });

    render(<CreateJobForm />);

    await waitFor(() =>
      expect(screen.getByDisplayValue('Backend Sr')).toBeInTheDocument()
    );

    // El select de sub-especialidad sigue en 'Backend' (antes un efecto sobre
    // formData.profile lo dejaba en '' justo después de cargar).
    await waitFor(() => {
      const selects = Array.from(document.querySelectorAll('select'));
      const subcategoria = selects.find((s) =>
        Array.from(s.options).some((o) => o.value === 'Backend')
      ) as HTMLSelectElement;
      expect(subcategoria).toBeTruthy();
      expect(subcategoria.value).toBe('Backend');
    });
  });

  it('VAC-045: un `habilidades` que no es JSON no rompe la edición', async () => {
    mockEditId = '13';
    montarEscenario({
      job: {
        id: 13,
        title: 'Backend Sr',
        company: 'ACME',
        location: 'Monterrey',
        jobType: 'Tiempo Completo',
        workMode: 'presential',
        description: 'desc',
        habilidades: 'React, Node',
        status: 'draft',
        creditCost: 0
      }
    });

    render(<CreateJobForm />);

    await waitFor(() =>
      expect(screen.getByDisplayValue('Backend Sr')).toBeInTheDocument()
    );
    expect(screen.queryByText(/Error de conexión/i)).not.toBeInTheDocument();
    // Se degradó a lista por comas en vez de lanzar.
    expect(screen.getByText('React')).toBeInTheDocument();
    expect(screen.getByText('Node')).toBeInTheDocument();
  });

  it('VAC-030: sin elegir punto en el mapa no se envían las coordenadas por defecto', async () => {
    montarEscenario({});

    render(<CreateJobForm />);
    await waitFor(() =>
      expect(screen.getByPlaceholderText('ej. Desarrollador Full Stack')).toBeInTheDocument()
    );

    await rellenarFormulario();

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /guardar borrador/i }));
    });

    await waitFor(() => expect(cuerpoGuardado()).not.toBeNull());
    const cuerpo = cuerpoGuardado()!;
    expect(cuerpo.latitude).toBeNull();
    expect(cuerpo.longitude).toBeNull();
  });

  it('VAC-038: la edición recupera y reenvía las coordenadas guardadas', async () => {
    mockEditId = '14';
    montarEscenario({
      job: {
        id: 14,
        title: 'Backend Sr',
        company: 'ACME',
        location: 'Monterrey',
        salaryMin: 20000,
        salaryMax: 25000,
        jobType: 'Tiempo Completo',
        workMode: 'presential',
        description: 'desc',
        profile: 'Tecnología',
        seniority: 'Sr',
        latitude: 25.6866,
        longitude: -100.3161,
        status: 'draft',
        creditCost: 0
      },
      guardado: { body: { success: true } }
    });

    render(<CreateJobForm />);
    await waitFor(() =>
      expect(screen.getByDisplayValue('Backend Sr')).toBeInTheDocument()
    );

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /guardar cambios/i }));
    });

    await waitFor(() => expect(cuerpoGuardado()).not.toBeNull());
    const cuerpo = cuerpoGuardado()!;
    expect(cuerpo.latitude).toBeCloseTo(25.6866, 4);
    expect(cuerpo.longitude).toBeCloseTo(-100.3161, 4);
  });

  it('VAC-031: cambiar el nivel de una vacante activa pide confirmación antes del PUT', async () => {
    mockEditId = '15';
    montarEscenario({
      costo: 18,
      job: {
        id: 15,
        title: 'Backend Jr',
        company: 'ACME',
        location: 'Monterrey',
        salaryMin: 20000,
        salaryMax: 25000,
        jobType: 'Tiempo Completo',
        workMode: 'presential',
        description: 'desc',
        profile: 'Tecnología',
        seniority: 'Jr',
        status: 'active',
        creditCost: 6
      }
    });

    render(<CreateJobForm />);
    await waitFor(() =>
      expect(screen.getByDisplayValue('Backend Jr')).toBeInTheDocument()
    );

    await act(async () => {
      seleccionar('field-seniority', 'Sr');
    });

    // Aviso del delta (18 - 6 = 12) antes de guardar.
    await waitFor(() =>
      expect(screen.getByText(/se te cobrarán/i)).toBeInTheDocument()
    );

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /guardar cambios/i }));
    });

    // No se mandó el PUT: primero hay que confirmar.
    expect(cuerpoGuardado()).toBeNull();
    const confirmar = screen.getByRole('button', {
      name: /confirmar y pagar 12 créditos/i
    });

    await act(async () => {
      fireEvent.click(confirmar);
    });

    await waitFor(() => expect(cuerpoGuardado()).not.toBeNull());
    expect(cuerpoGuardado()!.seniority).toBe('Sr');
  });

  it('VAC-046: un 402 al editar muestra la diferencia real y manda a comprar sin reenviar el PUT', async () => {
    mockEditId = '16';
    montarEscenario({
      costo: 18,
      credits: 10,
      job: {
        id: 16,
        title: 'Backend Jr',
        company: 'ACME',
        location: 'Monterrey',
        salaryMin: 20000,
        salaryMax: 25000,
        jobType: 'Tiempo Completo',
        workMode: 'presential',
        description: 'desc',
        profile: 'Tecnología',
        seniority: 'Jr',
        status: 'active',
        creditCost: 6
      },
      guardado: {
        status: 402,
        body: { success: false, error: 'Créditos insuficientes', required: 12, available: 10 }
      }
    });

    render(<CreateJobForm />);
    await waitFor(() =>
      expect(screen.getByDisplayValue('Backend Jr')).toBeInTheDocument()
    );

    await act(async () => {
      seleccionar('field-seniority', 'Sr');
    });
    await waitFor(() =>
      expect(screen.getByText(/se te cobrarán/i)).toBeInTheDocument()
    );
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /guardar cambios/i }));
    });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /confirmar y pagar 12 créditos/i }));
    });

    // Modal con las cifras del 402 (faltan 2), no con el costo total (18 - 10 = 8).
    await waitFor(() =>
      expect(screen.getByText(/para aplicar este cambio/i)).toBeInTheDocument()
    );
    // La cifra que falta va destacada en el color de peligro del sistema (text-danger).
    expect(screen.getByText(/2\s+créditos/, { selector: 'strong.text-danger' })).toBeInTheDocument();

    const llamadasGuardado = () =>
      mockFetch.mock.calls.filter(([, init]) => init?.method === 'PUT').length;
    expect(llamadasGuardado()).toBe(1);

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /^comprar créditos$/i }));
    });

    expect(mockPush).toHaveBeenCalledWith('/credits/purchase');
    // No se repitió el PUT (antes: mismo 402 y el modal se cerraba sin navegar).
    expect(llamadasGuardado()).toBe(1);
  });

  it('VAC-049: el botón PUBLICAR se bloquea mientras se recalcula el costo', async () => {
    montarEscenario({ retrasarCosto: true });

    render(<CreateJobForm />);
    await waitFor(() =>
      expect(screen.getByPlaceholderText('ej. Desarrollador Full Stack')).toBeInTheDocument()
    );

    await rellenarFormulario();

    // Cálculo en vuelo: el botón no puede publicar con el costo anterior.
    const boton = screen.getByRole('button', { name: /calculando/i });
    expect(boton).toBeDisabled();

    await act(async () => {
      soltarCosto?.();
    });

    await waitFor(() =>
      expect(screen.getByRole('button', { name: /publicar \(10/i })).toBeEnabled()
    );
  });

  it('VAC-032: guardar el borrador desde el modal de créditos no programa la vuelta al dashboard', async () => {
    jest.useFakeTimers();
    try {
      montarEscenario({
        credits: 1,
        costo: 10,
        guardado: { body: { success: true, status: 'draft' } }
      });

      render(<CreateJobForm />);
      await act(async () => {
        await Promise.resolve();
      });
      await waitFor(() =>
        expect(screen.getByPlaceholderText('ej. Desarrollador Full Stack')).toBeInTheDocument()
      );

      await rellenarFormulario();
      await act(async () => {
        await Promise.resolve();
      });

      // Saldo insuficiente: se abre el modal.
      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /comprar créditos/i }));
      });

      const botonModal = await screen.findByRole('button', {
        name: /comprar créditos y guardar en borrador/i
      });

      await act(async () => {
        fireEvent.click(botonModal);
      });

      await waitFor(() => expect(mockPush).toHaveBeenCalledWith('/credits/purchase'));

      // Pasado el antiguo temporizador de 1,5 s nadie manda al dashboard.
      await act(async () => {
        jest.advanceTimersByTime(3000);
      });
      expect(mockPush).not.toHaveBeenCalledWith('/company/dashboard');
    } finally {
      jest.useRealTimers();
    }
  });
});
