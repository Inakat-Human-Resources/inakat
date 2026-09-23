// RUTA: __tests__/components/vac-panel-postulaciones-cv.test.tsx
//
// VAC-014 (parte cliente): `cvUrl` llega de POST /api/applications, que es
// público. El panel /applications lo pasaba por un helper que sólo miraba si la
// cadena empezaba por 'http', así que cualquier esquema que empezara igual
// ('httpx:…') llegaba crudo al href de "Descargar CV".

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

const mockFetch = jest.fn();
global.fetch = mockFetch as unknown as typeof fetch;

import ApplicationsManagementPanel from '@/components/sections/applications/ApplicationsManagementPanel';

const postulacion = (id: number, cvUrl: string | null) => ({
  id,
  jobId: 1,
  candidateName: `Candidato ${id}`,
  candidateEmail: `c${id}@correo.com`,
  candidatePhone: null,
  cvUrl,
  coverLetter: null,
  status: 'pending',
  notes: null,
  createdAt: new Date(2026, 0, id).toISOString(),
  job: { id: 1, title: 'Vacante', company: 'Empresa', location: 'Monterrey', salary: '$1' }
});

const abrirDetalle = async (cvUrl: string | null) => {
  mockFetch.mockResolvedValue({
    ok: true,
    json: () => Promise.resolve({ success: true, data: [postulacion(1, cvUrl)] })
  });
  render(<ApplicationsManagementPanel />);
  const boton = await screen.findByRole('button', { name: /ver detalles/i });
  fireEvent.click(boton);
  await waitFor(() => expect(screen.getAllByText('Candidato 1').length).toBeGreaterThan(1));
};

describe('ApplicationsManagementPanel — enlace al CV (VAC-014)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
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
});
