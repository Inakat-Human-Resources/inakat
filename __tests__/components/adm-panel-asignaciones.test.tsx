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

/**
 * Fila de una vacante. Desde el rediseño es UNA sola tabla (DataTable) que en
 * móvil se ve como tarjetas: no hay dos copias de cada fila en el DOM.
 */
const tarjeta = (titulo: string) =>
  screen.getAllByText(titulo)[0].closest('tr') as HTMLElement;

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

    // La pantalla no se sustituye por el esqueleto y la fila 2 conserva su elección.
    expect(screen.getByRole('heading', { level: 1, name: /Asignar equipo/ })).toBeInTheDocument();
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
    // El aviso ya no va en el texto de la opción (el select lo recortaba): es
    // una insignia junto al select, enlazada con aria-describedby, y en la
    // lista desplegada la opción cuelga del grupo «Desactivado».
    const aviso = document.getElementById(select.getAttribute('aria-describedby') || '');
    expect(aviso).toHaveTextContent('Desactivado · reasigna');
    expect((select.selectedOptions[0].parentElement as HTMLOptGroupElement).label).toBe('Desactivado');
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
    // El estado sale en su columna y, cuando la tabla es estrecha, también bajo
    // el título (data-solo-bajo; CSS enseña uno u otro): la insignia dice el
    // nombre de su pestaña, «Incompletas», y nunca «Asignadas».
    const fila = within(tarjeta('Vacante 1'));
    expect(fila.getAllByText('Incompletas').length).toBeGreaterThan(0);
    expect(fila.queryByText('Asignadas')).not.toBeInTheDocument();
    expect(fila.queryByText('Asignado')).not.toBeInTheDocument();
  });

  it('la insignia de cada fila usa la etiqueta de la pestaña en la que cae (mismo criterio que la API)', async () => {
    const equipo = (recruiterStatus: string, specialistStatus: string) => ({
      id: 10,
      jobId: 0,
      recruiterId: 1,
      specialistId: 5,
      recruiterStatus,
      specialistStatus
    });
    const jobs = [
      vacante(1),
      vacante(2, equipo('pending', 'pending')),
      vacante(3, equipo('reviewing', 'pending')),
      vacante(4, equipo('sent_to_specialist', 'evaluating')),
      vacante(5, equipo('sent_to_specialist', 'sent_to_company'))
    ];
    mockFetch.mockResolvedValue(respuesta(listado(jobs)));

    render(<AssignmentsPage />);
    await screen.findAllByText('Vacante 1');

    // Sin contar las opciones de los selects («Sin asignar» también es una).
    const dice = (titulo: string, etiqueta: string) =>
      expect(
        within(tarjeta(titulo)).getAllByText(etiqueta, { ignore: 'option, script, style' }).length
      ).toBeGreaterThan(0);
    dice('Vacante 1', 'Sin asignar');
    dice('Vacante 2', 'Asignadas');
    dice('Vacante 3', 'En proceso');
    dice('Vacante 3', 'con el reclutador');
    dice('Vacante 4', 'En proceso');
    dice('Vacante 4', 'con el especialista');
    dice('Vacante 5', 'Completadas');
    // El vocabulario viejo, que no coincidía con las pestañas, ya no sale.
    for (const viejo of ['Asignado', 'Con reclutador', 'Con especialista', 'Completado', 'Incompleta']) {
      expect(screen.queryByText(viejo)).not.toBeInTheDocument();
    }
  });

  it('la especialidad no va en el texto de la opción: agrupa la lista y se lee bajo el select', async () => {
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
    mockFetch.mockResolvedValue(respuesta(listado(jobs)));

    render(<AssignmentsPage />);
    await screen.findAllByText('Vacante 1');

    const especialista = within(tarjeta('Vacante 1')).getAllByRole('combobox')[1] as HTMLSelectElement;
    expect(especialista.value).toBe('5');
    expect(especialista.selectedOptions[0].textContent?.trim()).toBe('Eva Eje');
    expect((especialista.selectedOptions[0].parentElement as HTMLOptGroupElement).label).toBe('Tecnología');
    const ayuda = document.getElementById(especialista.getAttribute('aria-describedby') || '');
    expect(ayuda).toHaveTextContent('Especialidad: Tecnología');
  });

  it('en la tarjeta (móvil) «Guardar» va al pie, a lo ancho, y no en la esquina sobre la empresa', async () => {
    mockFetch.mockResolvedValue(respuesta(listado([vacante(1)])));

    render(<AssignmentsPage />);
    await screen.findAllByText('Vacante 1');

    const celda = within(tarjeta('Vacante 1')).getByRole('button', { name: /Guardar/ }).closest('td') as HTMLElement;
    // 'completa' = fila propia a todo el ancho de la tarjeta (app.css), después
    // de los selects. En la esquina ('acciones') el w-px de la tabla dejaba la
    // columna en 1 px y el botón se montaba sobre empresa, ciudad y candidatos.
    expect(celda).toHaveAttribute('data-tarjeta', 'completa');
    // El w-px sólo se aplica en modo tabla (container query), nunca suelto.
    expect(celda.className.split(/\s+/)).not.toContain('w-px');
  });
});
