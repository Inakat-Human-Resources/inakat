// RUTA: __tests__/components/plat-bandeja-y-avisos.test.tsx
//
// Auditoría 2026-09 — documento «plat». Pruebas de comportamiento (render en
// jsdom) de las piezas de interfaz:
//  - PLAT-002: la notificación de "nuevo mensaje de contacto" enlaza a
//    /admin/contact-messages; esa pantalla tiene que existir y pintar lo que
//    devuelve GET /api/admin/contact-messages (antes el enlace daba 404 y el
//    lead sólo se veía entrando a la base).
//  - PLAT-025: ErrorToast se anuncia a lectores de pantalla.
//  - PLAT-027: la campanita anuncia el contador, expone aria-expanded y se
//    cierra con Escape.

import fs from 'fs';
import path from 'path';
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

jest.mock('next/link', () => ({
  __esModule: true,
  default: ({
    children,
    href,
    onClick,
  }: {
    children: React.ReactNode;
    href: string;
    onClick?: () => void;
  }) => (
    <a href={href} onClick={onClick}>
      {children}
    </a>
  ),
}));

import AdminContactMessagesPage from '@/app/admin/contact-messages/page';
import ErrorToast from '@/components/shared/ErrorToast';
import NotificationBell from '@/components/shared/NotificationBell';

const mockFetch = jest.fn();
global.fetch = mockFetch as unknown as typeof fetch;

const respuesta = (status: number, cuerpo: unknown) =>
  ({
    ok: status >= 200 && status < 300,
    status,
    json: async () => cuerpo,
  }) as Response;

beforeEach(() => {
  mockFetch.mockReset();
});

// ============================================================
// PLAT-002 — bandeja de mensajes de contacto
// ============================================================

describe('PLAT-002 · /admin/contact-messages', () => {
  it('el destino de la notificación in-app coincide con la página que existe', () => {
    const ruta = fs.readFileSync(
      path.join(process.cwd(), 'src/app/api/contact/route.ts'),
      'utf-8'
    );
    const link = ruta.match(/link: '([^']+)'/)?.[1];
    expect(link).toBe('/admin/contact-messages');
    expect(
      fs.existsSync(path.join(process.cwd(), 'src/app', link as string, 'page.tsx'))
    ).toBe(true);
  });

  it('pide la API paginada con la cookie y pinta los mensajes', async () => {
    mockFetch.mockResolvedValueOnce(
      respuesta(200, {
        success: true,
        data: [
          {
            id: 2,
            nombre: 'Ana RH',
            email: 'ana@empresa.com',
            telefono: '8112345678',
            mensaje: 'Queremos contratar reclutamiento para 5 vacantes.',
            createdAt: '2026-09-20T10:00:00.000Z',
          },
        ],
        pagination: { page: 1, limit: 20, total: 1, totalPages: 1, hasNext: false, hasPrev: false },
      })
    );

    render(<AdminContactMessagesPage />);

    expect(await screen.findByText('Ana RH')).toBeInTheDocument();
    expect(screen.getByText(/5 vacantes/)).toBeInTheDocument();
    expect(screen.getByText('ana@empresa.com').closest('a')).toHaveAttribute(
      'href',
      'mailto:ana@empresa.com'
    );

    const [url, init] = mockFetch.mock.calls[0];
    expect(url).toBe('/api/admin/contact-messages?page=1&limit=20');
    expect(init).toEqual(expect.objectContaining({ credentials: 'include' }));
  });

  it('un fallo de la API se muestra como error, no como bandeja vacía', async () => {
    mockFetch.mockResolvedValueOnce(respuesta(500, { success: false, error: 'Error al obtener los mensajes de contacto' }));

    render(<AdminContactMessagesPage />);

    expect(await screen.findByRole('alert')).toHaveTextContent('Error al obtener los mensajes de contacto');
    expect(screen.queryByText('Todavía no hay mensajes de contacto.')).not.toBeInTheDocument();
  });
});

// ============================================================
// PLAT-025 — ErrorToast accesible
// ============================================================

describe('PLAT-025 · ErrorToast', () => {
  it('se anuncia como alerta con el mensaje', () => {
    render(<ErrorToast message="Credenciales inválidas" onClose={() => {}} />);
    const alerta = screen.getByRole('alert');
    expect(alerta).toHaveTextContent('Credenciales inválidas');
    expect(alerta).toHaveAttribute('aria-live', 'assertive');
  });
});

// ============================================================
// PLAT-027 — accesibilidad de la campanita
// ============================================================

describe('PLAT-027 · NotificationBell', () => {
  const conContador = (count: number) => {
    mockFetch.mockImplementation(async (url: string) => {
      if (url === '/api/notifications/count') return respuesta(200, { success: true, count });
      return respuesta(200, { success: true, data: [] });
    });
  };

  it('el nombre accesible incluye las no leídas', async () => {
    conContador(5);
    render(<NotificationBell />);
    expect(
      await screen.findByRole('button', { name: 'Notificaciones, 5 sin leer' })
    ).toBeInTheDocument();
  });

  it('expone aria-expanded y se cierra con Escape', async () => {
    conContador(0);
    render(<NotificationBell />);

    const boton = screen.getByRole('button', { name: 'Notificaciones' });
    expect(boton).toHaveAttribute('aria-expanded', 'false');

    fireEvent.click(boton);
    expect(boton).toHaveAttribute('aria-expanded', 'true');
    await screen.findByText('Ver todas las notificaciones');

    fireEvent.keyDown(document, { key: 'Escape' });
    await waitFor(() => expect(boton).toHaveAttribute('aria-expanded', 'false'));
    expect(screen.queryByText('Ver todas las notificaciones')).not.toBeInTheDocument();
  });
});
