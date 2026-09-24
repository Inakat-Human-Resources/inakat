// RUTA: __tests__/components/adm-panel-entrevistas.test.tsx

/**
 * /admin/interviews: el admin agenda las entrevistas que piden las empresas.
 *
 * - ADM-002/043: sólo se pedía la primera tanda (20): las solicitudes
 *   pendientes más antiguas no aparecían en ninguna pestaña.
 * - ADM-007: "Cancelar solicitud" mandaba scheduledStart/End en null y la API
 *   los guardaba como 1970-01-01.
 * - ADM-008: el éxito se decidía por un campo que la API no mandaba: todo
 *   guardado correcto se pintaba como "Error al guardar".
 * - ADM-064/065: se podía confirmar un horario pasado o una liga sin https.
 * - ADM-066: una entrevista confirmada no se podía cancelar desde la UI y
 *   cancelar no pedía confirmación.
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

const respuesta = (body: unknown, status = 200) => ({
  ok: status >= 200 && status < 300,
  status,
  json: () => Promise.resolve(body)
});

const MANANA = new Date(Date.now() + 24 * 3600 * 1000);

const solicitud = (id: number, extra: Record<string, unknown> = {}) => ({
  id,
  applicationId: 500 + id,
  type: 'videocall',
  duration: 60,
  participants: null,
  availableSlots: '[]',
  message: null,
  status: 'pending',
  confirmedSlot: null,
  topic: null,
  scheduledStart: null,
  scheduledEnd: null,
  location: null,
  meetingUrl: null,
  adminNotes: null,
  createdAt: '2026-09-01T10:00:00.000Z',
  application: {
    id: 500 + id,
    candidateName: `Candidato ${id}`,
    candidateEmail: `c${id}@correo.com`,
    candidatePhone: null,
    status: 'sent_to_company',
    job: { id: 1, title: 'Backend Sr', company: 'Acme' }
  },
  requestedBy: { nombre: 'Ana', apellidoPaterno: null, email: 'ana@acme.com', companyRequest: null },
  ...extra
});

const mockFetch = jest.fn();
global.fetch = mockFetch as unknown as typeof fetch;

const llamadas = (fragmento: string) =>
  mockFetch.mock.calls.filter(([u]) => String(u).includes(fragmento));

import AdminInterviewsPage from '@/app/admin/interviews/page';

describe('/admin/interviews', () => {
  let confirmSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    confirmSpy = jest.spyOn(window, 'confirm').mockReturnValue(true);
  });

  afterEach(() => confirmSpy.mockRestore());

  const conListado = (paginas: Array<ReturnType<typeof solicitud>[]>, patch?: () => unknown) => {
    mockFetch.mockImplementation((url: string, init?: RequestInit) => {
      const u = String(url);
      if (init?.method === 'PATCH') {
        return Promise.resolve(
          respuesta(patch ? patch() : { success: true, data: {}, interview: {} })
        );
      }
      if (u.startsWith('/api/admin/interviews')) {
        const page = Number(new URL(u, 'http://x').searchParams.get('page') || '1');
        return Promise.resolve(
          respuesta({
            success: true,
            data: paginas[page - 1] || [],
            pagination: { page, limit: 100, total: paginas.flat().length, totalPages: paginas.length }
          })
        );
      }
      return Promise.resolve(respuesta({ success: false }, 404));
    });
  };

  it('ADM-002: pide todas las tandas y la pendiente más antigua aparece y cuenta', async () => {
    const tanda1 = Array.from({ length: 100 }, (_, i) => solicitud(i + 1, { status: 'cancelled' }));
    const tanda2 = [solicitud(101)]; // la más antigua, y sigue pendiente
    conListado([tanda1, tanda2]);

    render(<AdminInterviewsPage />);

    expect(await screen.findByText('Candidato 101')).toBeInTheDocument();
    expect(llamadas('page=2')).toHaveLength(1);
    // Las cuatro vistas son pestañas (role="tab") con su contador.
    const pendientes = screen.getByRole('tab', { name: /Pendientes/ });
    expect(pendientes).toHaveTextContent('1');
  });

  it('ADM-007/008: cancelar una pendiente manda sólo estado y notas, y el éxito cierra el modal', async () => {
    conListado([[solicitud(1)]]);
    render(<AdminInterviewsPage />);

    fireEvent.click(await screen.findByRole('button', { name: /Agendar/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar solicitud' }));

    await waitFor(() => expect(llamadas('/api/admin/interviews/1')).toHaveLength(1));
    const [, init] = llamadas('/api/admin/interviews/1')[0];
    const body = JSON.parse(String(init.body));
    expect(body).toEqual({ status: 'cancelled', adminNotes: null });
    expect(confirmSpy).toHaveBeenCalled();

    // ADM-008: con { success: true } el modal se cierra; no aparece "Error al guardar".
    await waitFor(() =>
      expect(screen.queryByRole('button', { name: 'Cancelar solicitud' })).not.toBeInTheDocument()
    );
    expect(screen.queryByText('Error al guardar')).not.toBeInTheDocument();
  });

  it('ADM-066: si el admin no confirma, no se cancela nada', async () => {
    confirmSpy.mockReturnValue(false);
    conListado([[solicitud(1)]]);
    render(<AdminInterviewsPage />);

    fireEvent.click(await screen.findByRole('button', { name: /Agendar/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar solicitud' }));

    expect(llamadas('/api/admin/interviews/1')).toHaveLength(0);
  });

  it('ADM-066: una entrevista ya agendada también se puede cancelar', async () => {
    conListado([[
      solicitud(2, {
        status: 'confirmed',
        scheduledStart: MANANA.toISOString(),
        scheduledEnd: new Date(MANANA.getTime() + 3600 * 1000).toISOString(),
        meetingUrl: 'https://meet.example.com/abc'
      })
    ]]);
    render(<AdminInterviewsPage />);

    await screen.findByRole('tab', { name: /Agendadas/ });
    fireEvent.click(screen.getByRole('tab', { name: /Agendadas/ }));
    // «Editar la entrevista de Candidato 2» (el nombre lleva a quién se refiere).
    fireEvent.click(await screen.findByRole('button', { name: /^Editar/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar entrevista' }));

    await waitFor(() => expect(llamadas('/api/admin/interviews/2')).toHaveLength(1));
    const [, init] = llamadas('/api/admin/interviews/2')[0];
    expect(JSON.parse(String(init.body)).status).toBe('cancelled');
  });

  it('ADM-008: un error del servidor se muestra dentro del modal', async () => {
    conListado([[solicitud(1)]], () => ({ success: false, error: 'La fecha no es válida' }));
    render(<AdminInterviewsPage />);

    fireEvent.click(await screen.findByRole('button', { name: /Agendar/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar solicitud' }));

    expect(await screen.findByText('La fecha no es válida')).toBeInTheDocument();
  });

  // El modal se pinta al final de <body> (portal de Modal), fuera del
  // `container` del render: los campos se buscan por su etiqueta visible.
  it('ADM-065: una liga sin https no se confirma', async () => {
    conListado([[solicitud(1)]]);
    render(<AdminInterviewsPage />);

    fireEvent.click(await screen.findByRole('button', { name: /Agendar/ }));
    const inicio = screen.getByLabelText(/Fecha y hora de inicio/) as HTMLInputElement;
    expect(inicio).toHaveAttribute('type', 'datetime-local');
    const local = new Date(MANANA.getTime() - MANANA.getTimezoneOffset() * 60000)
      .toISOString()
      .slice(0, 16);
    fireEvent.change(inicio, { target: { value: local } });
    const liga = screen.getByLabelText(/Liga de videoconferencia/) as HTMLInputElement;
    expect(liga).toHaveAttribute('type', 'url');
    fireEvent.change(liga, { target: { value: 'meet.google.com/abc-defg-hij' } });
    fireEvent.click(screen.getByRole('button', { name: /Confirmar entrevista/i }));

    expect(await screen.findByText(/debe empezar por https/)).toBeInTheDocument();
    expect(llamadas('/api/admin/interviews/1')).toHaveLength(0);
  });

  it('ADM-064: no se confirma un horario que ya pasó', async () => {
    conListado([[solicitud(1)]]);
    render(<AdminInterviewsPage />);

    fireEvent.click(await screen.findByRole('button', { name: /Agendar/ }));
    fireEvent.change(screen.getByLabelText(/Fecha y hora de inicio/), {
      target: { value: '2020-01-01T10:00' }
    });
    fireEvent.change(screen.getByLabelText(/Liga de videoconferencia/), {
      target: { value: 'https://meet.example.com/abc' }
    });
    fireEvent.click(screen.getByRole('button', { name: /Confirmar entrevista/i }));

    expect(await screen.findByText(/ya pasó/)).toBeInTheDocument();
    expect(llamadas('/api/admin/interviews/1')).toHaveLength(0);
  });
});
