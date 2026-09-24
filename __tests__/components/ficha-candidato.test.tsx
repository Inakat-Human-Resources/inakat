/**
 * RUTA: __tests__/components/ficha-candidato.test.tsx
 *
 * Ficha de candidato (src/components/shared/CandidateProfileModal.tsx) tras el
 * rediseño de septiembre de 2026 con el Modal y las Tabs del sistema.
 *
 * Lo que se prueba es lo que hace una persona con ratón y teclado, y que las
 * llamadas a la API sigan siendo las MISMAS (URL, método y cuerpo):
 * - PERF-035: con «Agregar documento» abierto, Escape cancela sólo ese
 *   sub-modal; el segundo Escape cierra la ficha.
 * - PERF-017: interactuar dentro del sub-modal no cierra la ficha.
 * - Borrar una nota pide confirmación y sólo entonces llama al DELETE.
 * - Guardar calificaciones manda el cuerpo de siempre.
 * - EMP-007: la empresa no ve notas internas; el admin sí.
 */
import React from 'react';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import '@testing-library/jest-dom';

jest.mock('next/image', () => ({
  __esModule: true,
  default: ({ src, alt }: { src: string; alt: string }) => <img src={src} alt={alt} />,
}));
jest.mock('next/link', () => ({
  __esModule: true,
  default: ({ children, href, ...resto }: { children: React.ReactNode; href: string }) => (
    <a href={href} {...resto}>
      {children}
    </a>
  ),
}));

import CandidateProfileModal from '@/components/shared/CandidateProfileModal';

type Ruta = (init?: RequestInit) => { status?: number; body: unknown };

/** fetch simulado por «MÉTODO /ruta» (sin query). Devuelve el jest.fn para mirar las llamadas. */
function simularFetch(rutas: Record<string, Ruta>) {
  const fn = jest.fn(async (url: string, init?: RequestInit) => {
    const metodo = (init?.method || 'GET').toUpperCase();
    const clave = `${metodo} ${String(url).split('?')[0]}`;
    const r = rutas[clave]?.(init) ?? { status: 404, body: { success: false, error: 'sin ruta' } };
    const status = r.status ?? 200;
    return { ok: status < 400, status, json: async () => r.body } as unknown as Response;
  });
  global.fetch = fn as unknown as typeof fetch;
  return fn;
}

const POSTULACION = {
  id: 55,
  candidateName: 'Ana Ruiz',
  candidateEmail: 'ana.ruiz@correo.mx',
  candidatePhone: '81 5555 0000',
  cvUrl: null,
  coverLetter: null,
  status: 'evaluating',
  createdAt: '2026-09-01T16:00:00Z',
  notes: 'Nota interna de la postulación',
  candidateProfile: {
    id: 7,
    notas: 'Comentario privado del admin',
    experiences: [],
    documents: [],
  },
};

const NOTA_PROPIA = {
  id: 9,
  authorId: 31,
  authorRole: 'specialist',
  applicationId: 55,
  content: 'Buen manejo de SQL; flojo en modelado.',
  isPublic: false,
  createdAt: '2026-09-02T10:00:00Z',
  canEdit: true,
};

afterEach(() => {
  jest.restoreAllMocks();
});

describe('Ficha de candidato · Modal del sistema', () => {
  it('es un diálogo con el nombre del candidato y su estado', async () => {
    simularFetch({ 'GET /api/evaluations/notes': () => ({ body: { success: true, data: [] } }) });
    render(
      <CandidateProfileModal application={POSTULACION} isOpen onClose={jest.fn()} userRole="recruiter" />
    );
    const ficha = await screen.findByRole('dialog', { name: 'Perfil de Ana Ruiz' });
    expect(within(ficha).getByText('En evaluación técnica')).toBeInTheDocument();
    expect(within(ficha).getByRole('link', { name: 'ana.ruiz@correo.mx' })).toHaveAttribute(
      'href',
      'mailto:ana.ruiz@correo.mx'
    );
    // Pestañas del sistema: Resumen activa al abrir.
    expect(within(ficha).getByRole('tab', { name: 'Resumen' })).toHaveAttribute('aria-selected', 'true');
  });

  it('QA b9: bajo 1024 px el contacto va en una franja, el resto plegado, y Evaluación es la segunda pestaña', async () => {
    simularFetch({ 'GET /api/evaluations/notes': () => ({ body: { success: true, data: [] } }) });
    const conPerfil = {
      ...POSTULACION,
      status: 'sent_to_company',
      candidateProfile: {
        ...POSTULACION.candidateProfile,
        ciudad: 'Monterrey',
        estado: 'Nuevo León',
        linkedinUrl: 'https://www.linkedin.com/in/ana-ruiz',
        fechaNacimiento: '1992-01-15T00:00:00Z',
      },
    };
    render(<CandidateProfileModal application={conPerfil} isOpen onClose={jest.fn()} userRole="company" />);
    const ficha = await screen.findByRole('dialog', { name: 'Perfil de Ana Ruiz' });

    // La franja de móvil: correo, teléfono y LinkedIn a un toque, con nombre
    // completo para el lector (el término «Correo» no se ve en la franja).
    const franja = within(ficha).getByRole('list', { name: 'Contacto y enlaces' });
    expect(within(franja).getByRole('link', { name: 'Correo: ana.ruiz@correo.mx' })).toHaveAttribute(
      'href',
      'mailto:ana.ruiz@correo.mx'
    );
    expect(within(franja).getByRole('link', { name: 'Teléfono: 81 5555 0000' })).toHaveAttribute(
      'href',
      'tel:81 5555 0000'
    );
    expect(within(franja).getByRole('link', { name: /LinkedIn/ })).toHaveAttribute(
      'href',
      'https://www.linkedin.com/in/ana-ruiz'
    );

    // Ubicación y datos, plegados en un <details> cerrado cuyo resumen ya
    // adelanta la ubicación y la edad.
    const resumen = ficha.querySelector('details > summary');
    expect(resumen).not.toBeNull();
    expect(resumen!.closest('details')).not.toHaveAttribute('open');
    expect(resumen).toHaveTextContent(/Monterrey, Nuevo León · \d+ años/);

    // Evaluación, justo después de Resumen: a 390 px ya no se corta.
    const nombres = within(ficha)
      .getAllByRole('tab')
      .map((t) => (t.textContent || '').replace(/\d+/g, '').trim());
    expect(nombres).toEqual(['Resumen', 'Evaluación', 'Trayectoria', 'Documentos']);

    // La empresa lee el estado con SU vocabulario (el de la lista de su vacante).
    expect(within(ficha).getByText('Por revisar')).toBeInTheDocument();
    expect(within(ficha).queryByText('Enviado a empresa')).not.toBeInTheDocument();
  });

  it('PERF-035 / PERF-017: Escape cancela primero «Agregar documento»; dentro no se cierra la ficha', async () => {
    simularFetch({ 'GET /api/evaluations/notes': () => ({ body: { success: true, data: [] } }) });
    const onClose = jest.fn();
    render(
      <CandidateProfileModal
        application={POSTULACION}
        isOpen
        onClose={onClose}
        userRole="recruiter"
        canAddDocuments
      />
    );
    const ficha = await screen.findByRole('dialog', { name: 'Perfil de Ana Ruiz' });
    fireEvent.click(within(ficha).getByRole('tab', { name: /Documentos/ }));
    fireEvent.click(within(ficha).getByRole('button', { name: 'Agregar documento' }));

    const sub = await screen.findByRole('dialog', { name: 'Agregar documento' });
    const nombre = within(sub).getByLabelText(/Nombre del documento/);
    fireEvent.mouseDown(nombre);
    fireEvent.change(nombre, { target: { value: 'Cédula profesional' } });
    fireEvent.mouseDown(sub);
    expect(onClose).not.toHaveBeenCalled();

    // Primer Escape: sólo el sub-modal.
    fireEvent.keyDown(document, { key: 'Escape' });
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Agregar documento' })).not.toBeInTheDocument());
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByRole('dialog', { name: 'Perfil de Ana Ruiz' })).toBeInTheDocument();

    // Al reabrirlo, no queda el nombre a medias.
    fireEvent.click(within(ficha).getByRole('button', { name: 'Agregar documento' }));
    const otraVez = await screen.findByRole('dialog', { name: 'Agregar documento' });
    expect(within(otraVez).getByLabelText(/Nombre del documento/)).toHaveValue('');
    fireEvent.keyDown(document, { key: 'Escape' });
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Agregar documento' })).not.toBeInTheDocument());

    // Segundo Escape: la ficha.
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('borrar una nota pide confirmación y sólo entonces llama al DELETE', async () => {
    const fetchMock = simularFetch({
      'GET /api/evaluations/notes': () => ({ body: { success: true, data: [NOTA_PROPIA] } }),
      'DELETE /api/evaluations/notes/9': () => ({ body: { success: true, message: 'Nota eliminada' } }),
    });
    render(
      <CandidateProfileModal application={POSTULACION} isOpen onClose={jest.fn()} userRole="specialist" />
    );
    const ficha = await screen.findByRole('dialog', { name: 'Perfil de Ana Ruiz' });
    fireEvent.click(within(ficha).getByRole('tab', { name: /Evaluación/ }));
    await within(ficha).findByText(NOTA_PROPIA.content);

    fireEvent.click(within(ficha).getByRole('button', { name: 'Borrar' }));
    const confirmacion = await screen.findByRole('dialog', { name: '¿Borrar esta nota?' });
    expect(confirmacion).toHaveAccessibleDescription('No se puede deshacer.');
    expect(fetchMock.mock.calls.some(([, init]) => init?.method === 'DELETE')).toBe(false);

    fireEvent.click(within(confirmacion).getByRole('button', { name: 'Borrar nota' }));
    await waitFor(() => expect(within(ficha).queryByText(NOTA_PROPIA.content)).not.toBeInTheDocument());
    expect(fetchMock).toHaveBeenCalledWith('/api/evaluations/notes/9', { method: 'DELETE' });
  });

  it('guardar calificaciones manda el mismo cuerpo de siempre', async () => {
    const fetchMock = simularFetch({
      'GET /api/evaluations/notes': () => ({ body: { success: true, data: [] } }),
      'GET /api/evaluations/skill-ratings': () => ({ body: { success: true, data: [] } }),
      'POST /api/evaluations/skill-ratings': () => ({ body: { success: true, data: [], message: 'Calificaciones guardadas' } }),
    });
    render(
      <CandidateProfileModal
        application={POSTULACION}
        isOpen
        onClose={jest.fn()}
        userRole="specialist"
        jobHabilidades={JSON.stringify(['SQL', 'Python'])}
      />
    );
    const ficha = await screen.findByRole('dialog', { name: 'Perfil de Ana Ruiz' });
    fireEvent.click(within(ficha).getByRole('tab', { name: /Evaluación/ }));

    const cuatro = await within(ficha).findByRole('button', { name: 'Calificar SQL: 4 de 5 estrellas' });
    fireEvent.click(cuatro);
    expect(cuatro).toHaveAttribute('aria-pressed', 'true');
    expect(within(ficha).getByRole('button', { name: 'Calificar SQL: 5 de 5 estrellas' })).toHaveAttribute(
      'aria-pressed',
      'false'
    );
    // Cada comentario tiene su etiqueta.
    expect(within(ficha).getByLabelText('Comentario sobre SQL')).toBeInTheDocument();

    fireEvent.click(within(ficha).getByRole('button', { name: 'Guardar calificaciones' }));
    expect(await within(ficha).findByText('Calificaciones guardadas')).toBeInTheDocument();

    const post = fetchMock.mock.calls.find(([, init]) => init?.method === 'POST');
    expect(post?.[0]).toBe('/api/evaluations/skill-ratings');
    expect(JSON.parse(String(post?.[1]?.body))).toEqual({
      applicationId: 55,
      ratings: [{ skillName: 'SQL', rating: 4, comment: null }],
    });
  });

  it('EMP-007: la empresa no ve las notas internas; el admin sí', async () => {
    simularFetch({ 'GET /api/evaluations/notes': () => ({ body: { success: true, data: [] } }) });
    const { unmount } = render(
      <CandidateProfileModal application={POSTULACION} isOpen onClose={jest.fn()} userRole="company" />
    );
    let ficha = await screen.findByRole('dialog', { name: 'Perfil de Ana Ruiz' });
    fireEvent.click(within(ficha).getByRole('tab', { name: /Evaluación/ }));
    await within(ficha).findByText('No hay notas de evaluación aún');
    expect(within(ficha).queryByText('Comentario privado del admin')).not.toBeInTheDocument();
    expect(within(ficha).queryByText('Nota interna de la postulación')).not.toBeInTheDocument();
    unmount();

    render(<CandidateProfileModal application={POSTULACION} isOpen onClose={jest.fn()} userRole="admin" />);
    ficha = await screen.findByRole('dialog', { name: 'Perfil de Ana Ruiz' });
    fireEvent.click(within(ficha).getByRole('tab', { name: /Evaluación/ }));
    expect(await within(ficha).findByText('Comentario privado del admin')).toBeInTheDocument();
    expect(within(ficha).getByText('Nota interna de la postulación')).toBeInTheDocument();
  });

  it('Anterior / Siguiente tienen nombre aunque en móvil sólo se vea la flecha', async () => {
    simularFetch({ 'GET /api/evaluations/notes': () => ({ body: { success: true, data: [] } }) });
    const onNext = jest.fn();
    render(
      <CandidateProfileModal
        application={POSTULACION}
        isOpen
        onClose={jest.fn()}
        userRole="recruiter"
        onPrev={jest.fn()}
        onNext={onNext}
        currentIndex={0}
        totalCount={3}
      />
    );
    const ficha = await screen.findByRole('dialog', { name: 'Perfil de Ana Ruiz' });
    expect(within(ficha).getByRole('button', { name: 'Anterior' })).toBeDisabled();
    fireEvent.click(within(ficha).getByRole('button', { name: 'Siguiente' }));
    expect(onNext).toHaveBeenCalledTimes(1);
    expect(within(ficha).getByText(/1 de 3/)).toBeInTheDocument();
  });
});
