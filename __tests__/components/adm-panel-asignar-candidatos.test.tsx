// RUTA: __tests__/components/adm-panel-asignar-candidatos.test.tsx

/**
 * /admin/assign-candidates: el admin inyecta candidatos del banco en una
 * vacante. Lo que se prueba aquí es lo que hacía que inyectara a quien no era o
 * que no pudiera llegar a quien sí:
 *
 * - ADM-001: el enlace ?jobId= fallaba en silencio si la vacante no venía en
 *   la primera tanda del listado.
 * - ADM-010: el banco se quedaba en los 30 primeros y el descarte de
 *   hired/inactive se hacía en el navegador DESPUÉS de paginar.
 * - ADM-012: la selección sobrevivía al cambio de vacante y de filtros.
 * - ADM-013: los selects de filtro no recargaban la lista.
 * - ADM-053: las cajas del pipeline no sumaban el total.
 * - ADM-054: una respuesta lenta de la vacante anterior pisaba la actual.
 */

import React from 'react';
import { render, screen, fireEvent, waitFor, act, within } from '@testing-library/react';

let mockParams = new URLSearchParams();
jest.mock('next/navigation', () => ({
  useSearchParams: () => mockParams,
  useRouter: () => ({ push: jest.fn(), replace: jest.fn(), prefetch: jest.fn() })
}));

const respuesta = (body: unknown, status = 200) => ({
  ok: status >= 200 && status < 300,
  status,
  json: () => Promise.resolve(body)
});

const vacante = (id: number, title = `Vacante ${id}`) => ({
  id,
  title,
  company: `Empresa ${id}`,
  location: 'CDMX',
  status: 'active',
  profile: 'Tecnología',
  seniority: 'Sr'
});

const candidato = (id: number) => ({
  id,
  nombre: `Nombre${id}`,
  apellidoPaterno: `Apellido${id}`,
  apellidoMaterno: null,
  email: `c${id}@correo.com`,
  telefono: null,
  profile: 'Tecnología',
  seniority: 'Sr',
  añosExperiencia: 3,
  universidad: null,
  status: 'available',
  source: 'linkedin'
});

const paginacion = (page: number, total: number, limit = 30) => {
  const totalPages = Math.max(1, Math.ceil(total / limit));
  return { page, limit, total, totalPages, hasNext: page < totalPages, hasPrev: page > 1 };
};

const STATS_PIPELINE = {
  total: 8,
  pending: 1,
  injected: 0,
  reviewing: 1,
  sentToSpecialist: 0,
  evaluating: 0,
  sentToCompany: 1,
  companyInterested: 2,
  interviewed: 1,
  archived: 1,
  hired: 0,
  rejected: 1
};

const mockFetch = jest.fn();
global.fetch = mockFetch as unknown as typeof fetch;

const urls = () => mockFetch.mock.calls.map(([u]) => String(u));
const urlsDe = (fragmento: string) => urls().filter((u) => u.includes(fragmento));

type Rutas = Record<string, (url: string) => unknown>;

const rutasPorDefecto = (): Rutas => ({
  '/api/jobs?status=active': () => ({ success: true, data: [vacante(1), vacante(2)] }),
  '/api/specialties': () => ({
    success: true,
    data: [{ id: 1, name: 'Tecnología', subcategories: [] }, { id: 2, name: 'Finanzas', subcategories: [] }]
  }),
  '/api/admin/candidates': (url) => {
    const page = Number(new URL(url, 'http://x').searchParams.get('page') || '1');
    const base = page === 1 ? [candidato(1), candidato(2), candidato(3)] : [candidato(31)];
    return { success: true, data: base, pagination: paginacion(page, 31) };
  },
  '/api/applications?jobId=': () => ({ success: true, data: [] }),
  '/api/applications': () => ({ success: true, data: [] }),
  '/api/applications/counts': () => ({ success: true, data: {} }),
  '/api/admin/assign-candidates?jobId=': () => ({
    success: true,
    data: [],
    pipelineStats: STATS_PIPELINE,
    jobAssignment: null
  })
});

const conRutas = (rutas: Rutas) => {
  mockFetch.mockImplementation((entrada: string) => {
    const url = String(entrada);
    // Gana la clave más larga que coincida (más específica).
    const clave = Object.keys(rutas)
      .filter((k) => url.includes(k))
      .sort((a, b) => b.length - a.length)[0];
    if (!clave) return Promise.resolve(respuesta({ success: false, error: 'no esperada' }, 404));
    const cuerpo = rutas[clave](url);
    if (cuerpo instanceof Promise) return cuerpo;
    return Promise.resolve(respuesta(cuerpo));
  });
};

import AssignCandidatesPage from '@/app/admin/assign-candidates/page';

const elegirVacante = async (titulo: string) => {
  fireEvent.click(await screen.findByText(titulo));
};

// Las vistas de la vacante son pestañas (role="tab") desde el rediseño.
const irAAsignar = async () => {
  fireEvent.click(screen.getByRole('tab', { name: /Asignar nuevos/ }));
  await screen.findByText('Nombre1 Apellido1');
};

// El pie de la selección: «1 candidato seleccionado» / «3 candidatos seleccionados».
const SELECCION = /candidatos? seleccionados?/;

describe('/admin/assign-candidates', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockParams = new URLSearchParams();
    conRutas(rutasPorDefecto());
    window.history.replaceState(null, '', '/admin/assign-candidates');
  });

  it('ADM-010: filtra el estado del candidato en el servidor y pide la página', async () => {
    render(<AssignCandidatesPage />);
    await elegirVacante('Vacante 1');

    await waitFor(() => expect(urlsDe('/api/admin/candidates').length).toBeGreaterThan(0));
    const pedida = new URL(urlsDe('/api/admin/candidates')[0], 'http://x');
    expect(pedida.searchParams.get('status')).toBe('available,in_process');
    expect(pedida.searchParams.get('page')).toBe('1');
  });

  it('ADM-010: se llega al candidato 31 con el paginador', async () => {
    render(<AssignCandidatesPage />);
    await elegirVacante('Vacante 1');
    await irAAsignar();

    expect(screen.getByText(/Página 1 de 2/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Siguiente' }));

    expect(await screen.findByText('Nombre31 Apellido31')).toBeInTheDocument();
    const ultima = new URL(urlsDe('/api/admin/candidates').slice(-1)[0], 'http://x');
    expect(ultima.searchParams.get('page')).toBe('2');
  });

  it('ADM-012: la selección de la vacante A no viaja a la vacante B', async () => {
    render(<AssignCandidatesPage />);
    await elegirVacante('Vacante 1');
    await irAAsignar();

    fireEvent.click(screen.getByText('Nombre1 Apellido1'));
    expect(screen.getByText('1 candidato seleccionado')).toBeInTheDocument();

    fireEvent.click(screen.getByText('Vacante 2'));
    await waitFor(() => expect(screen.queryByText(SELECCION)).not.toBeInTheDocument());
  });

  it('ADM-012: "Seleccionar todos" marca por pertenencia, no por tamaño', async () => {
    render(<AssignCandidatesPage />);
    await elegirVacante('Vacante 1');
    await irAAsignar();

    // Se marca uno a mano: con 3 visibles, la casilla debe completar la
    // selección (no desmarcar) y luego, con los 3 marcados, desmarcarlos.
    fireEvent.click(screen.getByText('Nombre1 Apellido1'));
    fireEvent.click(screen.getByRole('checkbox', { name: /Seleccionar todos/ }));
    expect(screen.getByText('3 candidatos seleccionados')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('checkbox', { name: /Seleccionar todos/ }));
    expect(screen.queryByText(SELECCION)).not.toBeInTheDocument();
  });

  it('ADM-012/013: cambiar un filtro recarga la lista y vacía la selección', async () => {
    render(<AssignCandidatesPage />);
    await elegirVacante('Vacante 1');
    await irAAsignar();

    fireEvent.click(screen.getByText('Nombre2 Apellido2'));
    expect(screen.getByText('1 candidato seleccionado')).toBeInTheDocument();

    const antes = urlsDe('/api/admin/candidates').length;
    // En móvil los filtros se despliegan con «Filtros»; desde sm están siempre.
    fireEvent.click(screen.getByRole('button', { name: /Filtros/ }));
    fireEvent.change(screen.getByLabelText('Especialidad'), { target: { value: 'Finanzas' } });

    await waitFor(() => expect(urlsDe('/api/admin/candidates').length).toBeGreaterThan(antes));
    const ultima = new URL(urlsDe('/api/admin/candidates').slice(-1)[0], 'http://x');
    expect(ultima.searchParams.get('profile')).toBe('Finanzas');
    expect(screen.queryByText(SELECCION)).not.toBeInTheDocument();
  });

  it('ADM-011: si la API trae el conteo por candidato, no se descarga la tabla de applications', async () => {
    conRutas({
      ...rutasPorDefecto(),
      '/api/admin/candidates': () => ({
        success: true,
        data: [{ ...candidato(1), activeApplications: 4 }],
        pagination: paginacion(1, 1)
      })
    });

    render(<AssignCandidatesPage />);
    await elegirVacante('Vacante 1');
    await irAAsignar();

    expect(await screen.findByText('4 vacantes')).toBeInTheDocument();
    const descargasCompletas = urls().filter((u) => u === '/api/applications');
    expect(descargasCompletas).toHaveLength(0);
    expect(urlsDe('/api/applications/counts')).toHaveLength(0);
  });

  it('ADM-011 / VAC-011: sin conteo en el listado, pide sólo el conteo y nunca la tabla entera', async () => {
    render(<AssignCandidatesPage />);
    await elegirVacante('Vacante 1');
    await irAAsignar();

    await waitFor(() => expect(urlsDe('/api/applications/counts').length).toBeGreaterThan(0));
    expect(urls().filter((u) => u === '/api/applications')).toHaveLength(0);
  });

  it('ADM-001: el enlace ?jobId= carga la vacante por id si no vino en el listado', async () => {
    mockParams = new URLSearchParams('jobId=77');
    conRutas({
      ...rutasPorDefecto(),
      '/api/jobs/77': () => ({ success: true, data: vacante(77, 'Vacante antigua') })
    });

    render(<AssignCandidatesPage />);

    await waitFor(() => expect(urlsDe('/api/jobs/77').length).toBe(1));
    // Seleccionada: aparece el pie de pestañas y se pide su pipeline.
    await waitFor(() =>
      expect(urlsDe('/api/admin/assign-candidates?jobId=77').length).toBeGreaterThan(0)
    );
    expect(screen.getAllByText('Vacante antigua').length).toBeGreaterThan(0);
  });

  it('ADM-001: si la vacante del enlace no existe o no está activa, lo dice', async () => {
    mockParams = new URLSearchParams('jobId=88');
    conRutas({
      ...rutasPorDefecto(),
      '/api/jobs/88': () => ({ success: false, error: 'Job not found' })
    });

    render(<AssignCandidatesPage />);
    expect(
      await screen.findByText('La vacante del enlace no existe o ya no está activa.')
    ).toBeInTheDocument();
  });

  it('ADM-053: las cajas del pipeline suman el total (interesados, entrevistados, descartados)', async () => {
    render(<AssignCandidatesPage />);
    await elegirVacante('Vacante 1');

    // Cada etapa es un <dt> (nombre) con su <dd> (cifra) en el mismo grupo.
    await screen.findByText('Entrevista', { selector: 'dt' });
    const valor = (nombre: string) => {
      const etiqueta = screen.getByText(nombre, { selector: 'dt' });
      return Number(etiqueta.parentElement!.querySelector('dd')!.textContent);
    };

    const cajas = ['Pendientes', 'En revisión', 'Evaluación', 'Enviados', 'Entrevista', 'Contratados', 'Descartados'];
    const suma = cajas.reduce((acc, nombre) => acc + valor(nombre), 0);

    expect(suma).toBe(8);
    // 'Enviados' incluye a los que ya le interesan a la empresa.
    expect(valor('Enviados')).toBe(3);
  });

  it('ADM-054: una respuesta tardía de la vacante anterior no pisa el pipeline actual', async () => {
    let soltarLenta: (v: unknown) => void = () => {};
    const rutas = rutasPorDefecto();
    conRutas({
      ...rutas,
      '/api/admin/assign-candidates?jobId=1': () =>
        new Promise((resolve) => {
          soltarLenta = resolve;
        }),
      '/api/admin/assign-candidates?jobId=2': () => ({
        success: true,
        data: [],
        pipelineStats: { ...STATS_PIPELINE, total: 2 },
        jobAssignment: null
      })
    });

    render(<AssignCandidatesPage />);
    await elegirVacante('Vacante 1');
    fireEvent.click(screen.getByText('Vacante 2'));

    const pestana = await screen.findByRole('tab', { name: /Pipeline/ });
    await waitFor(() => expect(pestana).toHaveTextContent('2'));

    await act(async () => {
      soltarLenta(
        respuesta({
          success: true,
          data: [],
          pipelineStats: { total: 99, pending: 99, injected: 0, reviewing: 0, sentToSpecialist: 0, evaluating: 0, sentToCompany: 0, hired: 0, rejected: 0 },
          jobAssignment: null
        })
      );
    });

    expect(screen.getByRole('tab', { name: /Pipeline/ })).not.toHaveTextContent('99');
  });
});

/**
 * Una sola columna (< xl: el móvil y hasta 1279 px). Antes la lista vivía en
 * una caja con scroll propio de unas tres vacantes y el detalle quedaba debajo:
 * al elegir no pasaba nada visible. Ahora el detalle se abre en el Drawer.
 * Sólo cambia DÓNDE se pinta: las llamadas son las mismas.
 */
describe('/admin/assign-candidates en una columna (< xl)', () => {
  const matchMediaOriginal = window.matchMedia;

  beforeEach(() => {
    jest.clearAllMocks();
    mockParams = new URLSearchParams();
    conRutas({
      ...rutasPorDefecto(),
      // POST de «Asignar» (la clave de ?jobId= es más larga y gana en los GET).
      '/api/admin/assign-candidates': () => ({ success: true, message: '1 candidato asignado' })
    });
    window.history.replaceState(null, '', '/admin/assign-candidates');
    window.matchMedia = jest.fn().mockImplementation((query: string) => ({
      matches: query.includes('max-width: 1279.98px'),
      media: query,
      onchange: null,
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
      addListener: jest.fn(),
      removeListener: jest.fn(),
      dispatchEvent: jest.fn()
    })) as unknown as typeof window.matchMedia;
  });

  afterEach(() => {
    window.matchMedia = matchMediaOriginal;
  });

  const pipelinesPedidos = (id: number) => urlsDe(`/api/admin/assign-candidates?jobId=${id}`).length;

  it('elegir una vacante abre su detalle en un cajón; cerrarlo no la deselecciona ni vuelve a pedir nada', async () => {
    render(<AssignCandidatesPage />);
    await elegirVacante('Vacante 1');

    const cajon = await screen.findByRole('dialog', { name: 'Vacante 1' });
    expect(within(cajon).getByRole('tab', { name: /Pipeline/ })).toBeInTheDocument();
    await waitFor(() => expect(pipelinesPedidos(1)).toBe(1));

    fireEvent.click(within(cajon).getByRole('button', { name: 'Cerrar' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    const vacante = screen.getByRole('button', { name: /Vacante 1/ });
    expect(vacante).toHaveAttribute('aria-pressed', 'true');

    // Pulsarla otra vez reabre el detalle sin volver a pedirlo.
    fireEvent.click(vacante);
    expect(await screen.findByRole('dialog', { name: 'Vacante 1' })).toBeInTheDocument();
    expect(pipelinesPedidos(1)).toBe(1);
  });

  it('la barra de «Asignar» va en el pie del cajón y hace el mismo POST', async () => {
    render(<AssignCandidatesPage />);
    await elegirVacante('Vacante 1');

    const cajon = await screen.findByRole('dialog', { name: 'Vacante 1' });
    fireEvent.click(within(cajon).getByRole('tab', { name: /Asignar nuevos/ }));
    fireEvent.click(await within(cajon).findByText('Nombre1 Apellido1'));
    expect(within(cajon).getByText('1 candidato seleccionado')).toBeInTheDocument();

    fireEvent.click(within(cajon).getByRole('button', { name: 'Asignar a la vacante' }));
    await waitFor(() => {
      const post = mockFetch.mock.calls.find(([, init]) => init?.method === 'POST' && !String(init?.body).includes('emails'));
      expect(post).toBeTruthy();
      expect(String(post![0])).toBe('/api/admin/assign-candidates');
      expect(JSON.parse(String(post![1].body))).toEqual({ jobId: 1, candidateIds: [1] });
    });
  });
});
