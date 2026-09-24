// Tests de la auditoría 2026-09, módulo AUTHUI: accesibilidad de controles.
// AUTHUI-021: los <input type="file"> tenían display:none y no se podían
//             alcanzar con teclado.
// AUTHUI-025: los botones sólo-icono (mostrar contraseña, eliminar fila) no
//             tenían nombre accesible.

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import RegisterPage from '@/app/register/page';
import ResetPasswordPage from '@/app/reset-password/page';

jest.mock('next/image', () => ({
  __esModule: true,
  // eslint-disable-next-line @next/next/no-img-element, @typescript-eslint/no-explicit-any
  default: (props: any) => <img {...props} alt={props.alt} />,
}));

jest.mock('next/link', () => ({
  __esModule: true,
  default: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));

jest.mock('next/navigation', () => ({
  useSearchParams: () => new URLSearchParams('token=tok-123'),
  useRouter: () => ({ push: jest.fn() }),
}));

const mockFetch = jest.fn();
global.fetch = mockFetch as unknown as typeof fetch;

// jsdom no implementa matchMedia; SiteMotion (el movimiento del registro
// público) lo consulta en su efecto.
beforeAll(() => {
  if (!window.matchMedia) {
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: (query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addEventListener: () => {},
        removeEventListener: () => {},
        addListener: () => {},
        removeListener: () => {},
        dispatchEvent: () => false,
      }),
    });
  }
});

beforeEach(() => {
  jest.clearAllMocks();
  mockFetch.mockResolvedValue({
    ok: true,
    status: 200,
    headers: { get: () => 'application/json' },
    json: async () => ({ success: true, data: [] }),
  });
});

describe('AUTHUI-025: botones sólo-icono con nombre accesible', () => {
  it('el toggle de contraseña del registro se nombra y expone su estado', () => {
    render(<RegisterPage />);

    const toggle = screen.getByRole('button', { name: 'Mostrar contraseña' });
    expect(toggle).toHaveAttribute('aria-pressed', 'false');

    fireEvent.click(toggle);
    expect(screen.getByRole('button', { name: 'Ocultar contraseña' })).toHaveAttribute(
      'aria-pressed',
      'true'
    );
    expect(
      screen.getByRole('button', { name: 'Mostrar confirmación de contraseña' })
    ).toBeInTheDocument();
  });

  it('el bote de basura de cada fila dice qué elimina', async () => {
    render(<RegisterPage />);
    fireEvent.click(screen.getByText(/Omitir y crear cuenta con datos básicos/));
    await waitFor(() => expect(screen.getByText(/Paso 6 de 6/)).toBeInTheDocument());

    fireEvent.click(screen.getByText('Agregar documento'));
    fireEvent.click(screen.getByRole('button', { name: 'Eliminar documento 1' }));

    expect(screen.getByText('No hay documentos agregados')).toBeInTheDocument();
  });

  it('el toggle de /reset-password también tiene nombre', () => {
    render(<ResetPasswordPage />);
    expect(screen.getByRole('button', { name: 'Mostrar contraseña' })).toHaveAttribute(
      'aria-pressed',
      'false'
    );
  });
});

describe('AUTHUI-021: inputs de archivo alcanzables con teclado', () => {
  it('la foto de perfil se puede enfocar y tiene nombre', () => {
    render(<RegisterPage />);

    const input = screen.getByLabelText('Subir foto de perfil') as HTMLInputElement;
    expect(input.type).toBe('file');
    // display:none (clase 'hidden') lo sacaba del orden de tabulación.
    expect(input).not.toHaveClass('hidden');
    input.focus();
    expect(document.activeElement).toBe(input);
  });
});
