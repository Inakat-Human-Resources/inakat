// RUTA: __tests__/components/adm-panel-resto.test.tsx

/**
 * El resto de pantallas del panel de administración.
 *
 * - /admin (dashboard) · ADM-003: la tabla de vacantes hacía slice(0, 20) sin
 *   forma de ver el resto y descargaba /api/company-requests para nada.
 *   ADM-090: las postulaciones archivadas contaban en el total del pipeline
 *   pero no se podían ver.
 * - /admin/direct-applications · ADM-017: `cvUrl` crudo en un href (XSS).
 *   ADM-018: una vacante sin dueño tiraba la página. ADM-039: si otra persona
 *   ya había movido la postulación (409), la fila se quedaba ahí.
 * - /admin/requests · ADM-023: editar una solicitud no refrescaba la lista.
 * - /admin/specialties · ADM-069: el error al guardar se pintaba tras el modal.
 * - CandidateForm · ADM-032: el botón de guardar estaba fuera del <form> y
 *   nada validaba nombre ni email.
 */

import React from 'react';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';

const mockPush = jest.fn();
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush, replace: jest.fn(), prefetch: jest.fn() }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => '/admin'
}));

const respuesta = (body: unknown, status = 200) => ({
  ok: status >= 200 && status < 300,
  status,
  json: () => Promise.resolve(body)
});

const mockFetch = jest.fn();
global.fetch = mockFetch as unknown as typeof fetch;

const llamadas = (fragmento: string, metodo = 'GET') =>
  mockFetch.mock.calls.filter(
    ([u, init]) => String(u).includes(fragmento) && (init?.method || 'GET') === metodo
  );

import AdminDashboardPage from '@/app/admin/page';
import DirectApplicationsPage from '@/app/admin/direct-applications/page';
import AdminRequestsPage from '@/app/admin/requests/page';
import SpecialtiesPage from '@/app/admin/specialties/page';
import CandidateForm from '@/components/sections/admin/CandidateForm';

let confirmSpy: jest.SpyInstance;
beforeEach(() => {
  jest.clearAllMocks();
  confirmSpy = jest.spyOn(window, 'confirm').mockReturnValue(true);
});
afterEach(() => confirmSpy.mockRestore());

// ---------------------------------------------------------------------------
describe('/admin (dashboard)', () => {
  const vacante = (id: number) => ({
    id,
    title: `Puesto ${String(id).padStart(2, '0')}`,
    company: 'Acme',
    location: 'CDMX',
    status: 'active',
    profile: 'Tecnología',
    seniority: 'Sr',
    // Fechas decrecientes: el orden por defecto (createdAt desc) deja 01..25.
    createdAt: new Date(Date.UTC(2026, 0, 31 - id)).toISOString(),
    userId: 1,
    _count: { applications: 0 }
  });

  const PIPELINE = {
    job: { id: 1, title: 'Puesto 01', company: 'Acme' },
    total: 3,
    archived: 1,
    stageTotals: { recruiter: 2, specialist: 0, company: 0, archived: 1 },
    stages: {
      recruiter: { pending: 2, reviewing: 0, sent_to_specialist: 0, discarded: 0 },
      specialist: { evaluating: 0, sent_to_company: 0 },
      company: { interested: 0, interviewed: 0, rejected: 0, accepted: 0 }
    },
    applications: [
      { id: 1, candidateName: 'Ana Activa', candidateEmail: 'a@x.com', status: 'pending', updatedAt: '2026-09-01T00:00:00.000Z' },
      { id: 2, candidateName: 'Beto Activo', candidateEmail: 'b@x.com', status: 'pending', updatedAt: '2026-09-01T00:00:00.000Z' },
      { id: 3, candidateName: 'Carla Archivada', candidateEmail: 'c@x.com', status: 'archived', updatedAt: '2026-09-01T00:00:00.000Z' }
    ],
    jobAssignment: null
  };

  beforeEach(() => {
    const vacantes = Array.from({ length: 25 }, (_, i) => vacante(i + 1));
    mockFetch.mockImplementation((url: string) => {
      const u = String(url);
      if (u.startsWith('/api/jobs')) {
        return Promise.resolve(
          respuesta({ success: true, data: vacantes, pagination: { page: 1, limit: 100, total: 130, totalPages: 2 } })
        );
      }
      if (u.startsWith('/api/admin/stats')) {
        return Promise.resolve(respuesta({ success: true, data: { totalJobs: 130 } }));
      }
      if (u.includes('/pipeline')) {
        return Promise.resolve(respuesta({ success: true, data: PIPELINE }));
      }
      return Promise.resolve(respuesta({ success: false }, 404));
    });
  });

  it('ADM-003: la tabla pagina en vez de cortar en 20 y no descarga solicitudes de empresa', async () => {
    render(<AdminDashboardPage />);
    await screen.findByText('Puesto 01');

    expect(screen.queryByText('Puesto 21')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Siguiente' }));
    expect(await screen.findByText('Puesto 21')).toBeInTheDocument();
    expect(screen.getByText('Puesto 25')).toBeInTheDocument();

    // Avisa de que hay más vacantes en el servidor que en la tabla.
    expect(screen.getByText(/25 vacantes más recientes de 130/)).toBeInTheDocument();
    expect(llamadas('/api/company-requests')).toHaveLength(0);
  });

  it('ADM-090: las archivadas del pipeline se pueden ver', async () => {
    render(<AdminDashboardPage />);
    await screen.findByText('Puesto 01');

    const fila = screen.getByText('Puesto 01').closest('tr') as HTMLElement;
    fireEvent.click(within(fila).getByTitle('Ver pipeline'));

    fireEvent.click(await screen.findByRole('button', { name: /Archivados/ }));
    expect(await screen.findByText('Carla Archivada')).toBeInTheDocument();
    expect(screen.queryByText('Ana Activa')).not.toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
describe('/admin/direct-applications', () => {
  const postulacion = (id: number, extra: Record<string, unknown> = {}) => ({
    id,
    candidateName: `Postulante ${id}`,
    candidateEmail: `p${id}@correo.com`,
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
      user: { nombre: 'Dueño', email: 'd@x.com', companyRequest: { nombreEmpresa: 'Acme' } }
    },
    ...extra
  });

  it('ADM-017/018: cvUrl peligroso no se enlaza y una vacante sin dueño no tira la página', async () => {
    const lista = [
      postulacion(1, { cvUrl: 'javascript:alert(document.cookie)' }),
      postulacion(2, {
        job: { ...postulacion(2).job, user: null }
      })
    ];
    mockFetch.mockResolvedValue(respuesta({ success: true, data: lista }));

    render(<DirectApplicationsPage />);

    expect(await screen.findByText('Postulante 1')).toBeInTheDocument();
    expect(screen.getByText(/Empresa de respaldo/)).toBeInTheDocument();
    const enlaces = Array.from(document.querySelectorAll('a')).map((a) => a.getAttribute('href') || '');
    expect(enlaces.some((h) => h.toLowerCase().startsWith('javascript:'))).toBe(false);
    // El CV bueno sí se enlaza.
    expect(enlaces).toContain('https://cdn.example.com/cv.pdf');
  });

  it('ADM-039: si otra persona ya la movió (409), la fila desaparece y se recarga', async () => {
    let lista = [postulacion(1), postulacion(2)];
    mockFetch.mockImplementation((url: string, init?: RequestInit) => {
      if (init?.method === 'PUT') {
        lista = [postulacion(2)];
        return Promise.resolve(respuesta({ success: false, error: 'La postulación ya no está pendiente' }, 409));
      }
      return Promise.resolve(respuesta({ success: true, data: lista }));
    });

    render(<DirectApplicationsPage />);
    await screen.findByText('Postulante 1');

    // Cada postulación de la bandeja es un <article> con sus tres decisiones.
    const tarjeta = screen.getByText('Postulante 1').closest('article') as HTMLElement;
    fireEvent.click(within(tarjeta).getByRole('button', { name: /Descartar/ }));

    await waitFor(() => expect(screen.queryByText('Postulante 1')).not.toBeInTheDocument());
    expect(await screen.findByText('La postulación ya no está pendiente')).toBeInTheDocument();
    expect(llamadas('/api/admin/direct-applications').length).toBe(2);
  });
});

// ---------------------------------------------------------------------------
describe('/admin/requests', () => {
  it('ADM-023: guardar la edición de una solicitud recarga la lista', async () => {
    const solicitud = {
      id: 4,
      nombre: 'Ana',
      apellidoPaterno: 'Pérez',
      apellidoMaterno: 'López',
      nombreEmpresa: 'Acme SA',
      correoEmpresa: 'contacto@acme.com',
      sitioWeb: null,
      razonSocial: 'Acme SA de CV',
      rfc: 'ACM010101AAA',
      direccionEmpresa: 'Calle 1',
      identificacionUrl: null,
      documentosConstitucionUrl: null,
      status: 'pending',
      createdAt: '2026-09-01T00:00:00.000Z',
      updatedAt: '2026-09-01T00:00:00.000Z'
    };
    mockFetch.mockImplementation((url: string, init?: RequestInit) => {
      if (init?.method === 'PUT') return Promise.resolve(respuesta({ success: true }));
      return Promise.resolve(respuesta({ success: true, data: [solicitud] }));
    });

    render(<AdminRequestsPage />);
    // Abrir el detalle de la fila, pasar a edición y guardar.
    fireEvent.click((await screen.findAllByRole('button', { name: /Ver solicitud de/ }))[0]);
    fireEvent.click(screen.getByRole('button', { name: 'Editar datos' }));
    fireEvent.click(screen.getByRole('button', { name: /Guardar cambios/i }));

    await waitFor(() => expect(llamadas('/api/company-requests/4', 'PUT')).toHaveLength(1));
    await waitFor(() => expect(llamadas('/api/company-requests')).toHaveLength(2));
  });

  it('aprobar pide confirmación en un Modal y hace el mismo PATCH de siempre', async () => {
    const solicitud = {
      id: 4,
      nombre: 'Ana',
      apellidoPaterno: 'Pérez',
      apellidoMaterno: 'López',
      nombreEmpresa: 'Acme SA',
      correoEmpresa: 'contacto@acme.com',
      sitioWeb: null,
      razonSocial: 'Acme SA de CV',
      rfc: 'ACM010101AAA',
      direccionEmpresa: 'Calle 1',
      identificacionUrl: null,
      documentosConstitucionUrl: null,
      status: 'pending',
      createdAt: '2026-09-01T00:00:00.000Z',
      updatedAt: '2026-09-01T00:00:00.000Z'
    };
    mockFetch.mockImplementation((url: string, init?: RequestInit) => {
      if (init?.method === 'PATCH') return Promise.resolve(respuesta({ success: true }));
      return Promise.resolve(respuesta({ success: true, data: [solicitud] }));
    });

    render(<AdminRequestsPage />);
    fireEvent.click(await screen.findByRole('button', { name: 'Aprobar solicitud de Acme SA' }));

    // Nada se envía hasta confirmar (antes lo decidía el confirm() del navegador).
    const dialogo = await screen.findByRole('dialog');
    expect(llamadas('/api/company-requests/4', 'PATCH')).toHaveLength(0);

    fireEvent.click(within(dialogo).getByRole('button', { name: 'Aprobar solicitud' }));
    await waitFor(() => expect(llamadas('/api/company-requests/4', 'PATCH')).toHaveLength(1));
    const [, init] = llamadas('/api/company-requests/4', 'PATCH')[0];
    expect(JSON.parse(String(init.body))).toEqual({ status: 'approved' });
    // Y recarga la lista, como siempre.
    await waitFor(() => expect(llamadas('/api/company-requests')).toHaveLength(2));
  });
});

// ---------------------------------------------------------------------------
describe('/admin/specialties', () => {
  it('ADM-069: el error al guardar se ve dentro del modal', async () => {
    mockFetch.mockImplementation((url: string, init?: RequestInit) => {
      if (init?.method === 'POST') {
        return Promise.resolve(respuesta({ success: false, error: 'Ya existe una especialidad equivalente' }, 409));
      }
      return Promise.resolve(respuesta({ success: true, data: [] }));
    });

    render(<SpecialtiesPage />);
    // Rediseño (sep 2026): el botón va en minúscula («Nueva especialidad»).
    fireEvent.click(await screen.findByRole('button', { name: /Nueva especialidad/i }));

    const form = document.querySelector('form') as HTMLFormElement;
    fireEvent.change(form.querySelector('input[type="text"]') as HTMLInputElement, {
      target: { value: 'Tecnologia' }
    });
    fireEvent.submit(form);

    await waitFor(() =>
      expect(within(form).getByRole('alert')).toHaveTextContent('Ya existe una especialidad equivalente')
    );
  });
});

// ---------------------------------------------------------------------------
describe('CandidateForm', () => {
  beforeEach(() => {
    mockFetch.mockResolvedValue(respuesta({ success: true, names: [], data: [] }));
  });

  it('ADM-032: el botón de guardar envía el <form> y sin nombre/email válido no se guarda', async () => {
    render(<CandidateForm isOpen onClose={jest.fn()} onSuccess={jest.fn()} />);

    const form = document.querySelector('form') as HTMLFormElement;
    const guardar = Array.from(document.querySelectorAll('button[type="submit"]')) as HTMLButtonElement[];
    expect(guardar.length).toBeGreaterThan(0);
    expect(guardar.every((b) => b.getAttribute('form') === form.id || form.contains(b))).toBe(true);

    fireEvent.submit(form);
    expect(await screen.findByText('Nombre y apellido paterno son obligatorios.')).toBeInTheDocument();
    expect(llamadas('/api/admin/candidates', 'POST')).toHaveLength(0);
  });
});
