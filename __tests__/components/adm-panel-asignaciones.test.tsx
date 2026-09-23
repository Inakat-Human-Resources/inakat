// RUTA: __tests__/components/adm-panel-asignaciones.test.tsx

/**
 * /admin/assignments: el admin reparte reclutador y especialista por vacante.
 *
 * - ADM-014: guardar una fila recargaba toda la página y borraba lo elegido
 *   (sin guardar) en las demás filas.
 * - ADM-015: un reclutador desactivado se pintaba como "Sin asignar" mientras
 *   el estado conservaba su id y se reenviaba al guardar.
 * - ADM-029: una asignación parcial no caía en ningún filtro ni tarjeta.
 * - ADM-058: no se podía retirar el equipo de una vacante.
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

const posts = () =>
  mockFetch.mock.calls.filter(([, init]) => init?.method === 'POST');

import AssignmentsPage from '@/app/admin/assignments/page';

const vacante = (id: number, assignment?: Record<string, unknown>) => ({
  id,
  title: `Vacante ${id}`,
  company: `Empresa ${id}`,
  location: 'CDMX',
  profile: 'Tecnología',
  seniority: 'Sr',
  status: 'active',
  createdAt: '2026-09-01T00:00:00.000Z',
  user: { nombre: 'Dueño' },
  assignment,
  _count: { applications: 0 }
});

const RECLUTADORES = [
  { id: 1, nombre: 'Rita', apellidoPaterno: 'Ruiz', email: 'rita@inakat.com' },
  { id: 2, nombre: 'Raúl', apellidoPaterno: 'Rojas', email: 'raul@inakat.com' }
];
const ESPECIALISTAS = [
  { id: 5, nombre: 'Eva', apellidoPaterno: 'Eje', email: 'eva@inakat.com', specialty: 'Tecnología' }
];

const listado = (jobs: unknown[]) => ({
  success: true,
  data: jobs,
  recruiters: RECLUTADORES,
  specialists: ESPECIALISTAS,
  stats: { total: jobs.length, unassigned: 0, partial: 1, assigned: 0, inProgress: 0, completed: 0 }
});

/** Tarjeta (vista móvil, la primera en el DOM) de una vacante. */
const tarjeta = (titulo: string) =>
  screen.getAllByText(titulo)[0].closest('div.shadow-sm') as HTMLElement;

describe('/admin/assignments', () => {
  let confirmSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    confirmSpy = jest.spyOn(window, 'confirm').mockReturnValue(true);
  });

  afterEach(() => confirmSpy.mockRestore());

  it('ADM-014: guardar una fila no borra lo elegido sin guardar en otra', async () => {
    const jobs = [vacante(1), vacante(2)];
    mockFetch.mockImplementation((url: string, init?: RequestInit) => {
      if (init?.method === 'POST') return Promise.resolve(respuesta({ success: true, data: {} }));
      return Promise.resolve(respuesta(listado(jobs)));
    });

    render(<AssignmentsPage />);
    await screen.findAllByText('Vacante 1');

    // Fila 2: se elige reclutador y NO se guarda.
    fireEvent.change(within(tarjeta('Vacante 2')).getAllByRole('combobox')[0], { target: { value: '2' } });
    // Fila 1: se elige y se guarda.
    fireEvent.change(within(tarjeta('Vacante 1')).getAllByRole('combobox')[0], { target: { value: '1' } });
    fireEvent.click(within(tarjeta('Vacante 1')).getByRole('button', { name: /Guardar/ }));

    await waitFor(() => expect(posts()).toHaveLength(1));
    await waitFor(() => expect(mockFetch.mock.calls.length).toBeGreaterThanOrEqual(3));

    // La pantalla no se sustituye por el spinner y la fila 2 conserva su elección.
    expect(screen.getByText('Gestión de Vacantes')).toBeInTheDocument();
    await waitFor(() =>
      expect(
        (within(tarjeta('Vacante 2')).getAllByRole('combobox')[0] as HTMLSelectElement).value
      ).toBe('2')
    );
  });

  it('ADM-015: un reclutador desactivado se ve como tal y no como "Sin asignar"', async () => {
    const jobs = [
      vacante(1, {
        id: 10,
        jobId: 1,
        recruiterId: 9,
        specialistId: null,
        recruiterStatus: 'pending',
        specialistStatus: 'pending',
        recruiter: { id: 9, nombre: 'Laura', apellidoPaterno: 'Baja', email: 'laura@inakat.com' }
      })
    ];
    mockFetch.mockResolvedValue(respuesta(listado(jobs)));

    render(<AssignmentsPage />);
    await screen.findAllByText('Vacante 1');

    const select = within(tarjeta('Vacante 1')).getAllByRole('combobox')[0] as HTMLSelectElement;
    expect(select.value).toBe('9');
    expect(select.selectedOptions[0].textContent).toContain('Laura Baja');
    expect(select.selectedOptions[0].textContent).toContain('desactivado');
  });

  it('ADM-058: se puede retirar el equipo de una vacante (con confirmación)', async () => {
    const jobs = [
      vacante(1, {
        id: 10,
        jobId: 1,
        recruiterId: 1,
        specialistId: 5,
        recruiterStatus: 'pending',
        specialistStatus: 'pending'
      })
    ];
    mockFetch.mockImplementation((url: string, init?: RequestInit) => {
      if (init?.method === 'POST') return Promise.resolve(respuesta({ success: true, data: {} }));
      return Promise.resolve(respuesta(listado(jobs)));
    });

    render(<AssignmentsPage />);
    await screen.findAllByText('Vacante 1');

    const [reclutador, especialista] = within(tarjeta('Vacante 1')).getAllByRole('combobox');
    fireEvent.change(reclutador, { target: { value: '' } });
    fireEvent.change(especialista, { target: { value: '' } });
    fireEvent.click(within(tarjeta('Vacante 1')).getByRole('button', { name: /Guardar/ }));

    await waitFor(() => expect(posts()).toHaveLength(1));
    expect(confirmSpy).toHaveBeenCalledTimes(1);
    expect(JSON.parse(String(posts()[0][1].body))).toEqual({
      jobId: 1,
      recruiterId: null,
      specialistId: null
    });
  });

  it('ADM-058: en una vacante sin equipo, guardar vacío sigue pidiendo elegir a alguien', async () => {
    mockFetch.mockResolvedValue(respuesta(listado([vacante(1)])));

    render(<AssignmentsPage />);
    await screen.findAllByText('Vacante 1');

    fireEvent.click(within(tarjeta('Vacante 1')).getByRole('button', { name: /Guardar/ }));

    expect(await screen.findByText('Selecciona al menos un reclutador o especialista')).toBeInTheDocument();
    expect(posts()).toHaveLength(0);
  });

  it('ADM-029: la tarjeta "Incompletas" existe y una asignación parcial no dice "Asignado"', async () => {
    const jobs = [
      vacante(1, {
        id: 10,
        jobId: 1,
        recruiterId: 1,
        specialistId: null,
        recruiterStatus: 'pending',
        specialistStatus: 'pending'
      })
    ];
    mockFetch.mockResolvedValue(respuesta(listado(jobs)));

    render(<AssignmentsPage />);
    await screen.findAllByText('Vacante 1');

    expect(screen.getAllByText('Incompletas').length).toBeGreaterThan(0);
    expect(within(tarjeta('Vacante 1')).getByText('Incompleta')).toBeInTheDocument();
  });
});
