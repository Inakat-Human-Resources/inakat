// RUTA: __tests__/components/b7-aplicaciones-cv.test.tsx
//
// /applications (sólo admin) se rehízo con el sistema de diseño dentro de
// src/app/applications/page.tsx, con la misma lógica que tenía
// ApplicationsManagementPanel (borrado junto con su test,
// vac-panel-postulaciones-cv.test.tsx, que protegía código muerto). Este test
// cubre, contra la página viva, los mismos casos de VAC-014: `cvUrl`
// llega de POST /api/applications, que es público, y sólo se enlaza si es
// http(s). Además comprueba que las llamadas son las de siempre.

import React from 'react';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';

const mockFetch = jest.fn();
global.fetch = mockFetch as unknown as typeof fetch;

import ApplicationsPage from '@/app/applications/page';

const postulacion = (id: number, cvUrl: string | null, status = 'pending') => ({
  id,
  jobId: 1,
  candidateName: `Candidato ${id}`,
  candidateEmail: `c${id}@correo.com`,
  candidatePhone: null,
  cvUrl,
  coverLetter: null,
  status,
  notes: null,
  createdAt: new Date(2026, 0, id).toISOString(),
  job: { id: 1, title: 'Vacante', company: 'Empresa', location: 'Monterrey', salary: '$1' }
});

const abrirDetalle = async (cvUrl: string | null) => {
  mockFetch.mockResolvedValue({
    ok: true,
    json: () => Promise.resolve({ success: true, data: [postulacion(1, cvUrl)] })
  });
  render(<ApplicationsPage />);
  const boton = await screen.findByRole('button', { name: /ver detalles/i });
  fireEvent.click(boton);
  await waitFor(() => expect(screen.getByRole('dialog')).toBeInTheDocument());
};

describe('/applications — enlace al CV (VAC-014)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('pide la lista a GET /api/applications, sin parámetros', async () => {
    await abrirDetalle(null);
    expect(mockFetch).toHaveBeenCalledWith('/api/applications');
  });

  it('una URL https se enlaza tal cual', async () => {
    await abrirDetalle('https://blob.example.com/cv.pdf');
    const enlace = screen.getByRole('link', { name: /descargar cv/i });
    expect(enlace).toHaveAttribute('href', 'https://blob.example.com/cv.pdf');
  });

  it('un dominio suelto se fuerza a https', async () => {
    await abrirDetalle('blob.example.com/cv.pdf');
    expect(screen.getByRole('link', { name: /descargar cv/i })).toHaveAttribute(
      'href',
      'https://blob.example.com/cv.pdf'
    );
  });

  it.each(['httpx:alert(1)', 'data:text/html,<script>alert(1)</script>', 'javascript:alert(1)'])(
    'un esquema que no es http(s) no se pinta como enlace: %s',
    async (cvUrl) => {
      await abrirDetalle(cvUrl);
      expect(screen.queryByRole('link', { name: /descargar cv/i })).not.toBeInTheDocument();
    }
  );

  it('cambiar el estado manda el mismo PATCH de siempre', async () => {
    await abrirDetalle(null);
    mockFetch.mockClear();
    mockFetch.mockResolvedValue({ ok: true, json: () => Promise.resolve({ success: true, data: [] }) });

    const dialogo = screen.getByRole('dialog');
    fireEvent.click(within(dialogo).getByRole('button', { name: 'Descartar' }));

    await waitFor(() =>
      expect(mockFetch).toHaveBeenCalledWith('/api/applications/1', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'discarded', notes: undefined })
      })
    );
  });
});

// Revisión visual (b7): las seis tarjetas de cifras repetían las seis pestañas;
// ahora el conteo va en cada pestaña y tiene que ser el de las filas que enseña.
describe('/applications — pestañas con su conteo', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('cada pestaña lleva el número de filas que enseña', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          success: true,
          data: [postulacion(1, null, 'pending'), postulacion(2, null, 'rejected'), postulacion(3, null, 'discarded')]
        })
    });
    render(<ApplicationsPage />);

    await waitFor(() => expect(screen.getByRole('tab', { name: /^Todas\s*\(?3\)?$/ })).toBeInTheDocument());
    expect(screen.getByRole('tab', { name: /^Pendientes\s*\(?1\)?$/ })).toBeInTheDocument();

    // La pestaña «Rechazados» sólo enseña `rejected` (el filtro de siempre): su
    // número es 1, no el 2 de la antigua tarjeta, que sumaba `discarded`.
    const rechazados = screen.getByRole('tab', { name: /^Rechazados\s*\(?1\)?$/ });
    fireEvent.click(rechazados);
    expect(screen.getByText('Candidato 2')).toBeInTheDocument();
    expect(screen.queryByText('Candidato 3')).not.toBeInTheDocument();
  });

  it('el h1 lleva remate y la fecha es la corta del panel', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ success: true, data: [postulacion(1, null)] })
    });
    render(<ApplicationsPage />);

    await screen.findByText('Candidato 1');
    expect(screen.getByRole('heading', { level: 1, name: /Aplicaciones de todas las vacantes/ })).toBeInTheDocument();
    // Migas de vuelta al panel: la página no tiene enlace propio en el menú;
    // cuelga de la vista general del admin.
    expect(screen.getByRole('link', { name: 'Vista general' })).toHaveAttribute('href', '/admin');

    // La fecha corta del formateador único (src/lib/fechas): «1 ene 2026».
    expect(screen.getAllByText('1 ene 2026').length).toBeGreaterThan(0);
    expect(screen.queryByText(/de enero de 2026/)).not.toBeInTheDocument();
  });
});
