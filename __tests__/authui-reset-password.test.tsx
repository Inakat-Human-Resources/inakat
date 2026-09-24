// Tests de la auditoría 2026-09, módulo AUTHUI.
// AUTHUI-008: la página de restablecer contraseña anunciaba y validaba
// «mínimo 6 caracteres» mientras /api/auth/reset-password exige 8 + mayúscula +
// número, así que el usuario descubría la política a prueba y error, gastando
// el rate limit (5 por 15 min) con un token que caduca en una hora.

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ResetPasswordPage from '@/app/reset-password/page';

const mockPush = jest.fn();
let mockSearchParams = 'token=tok-123';

jest.mock('next/navigation', () => ({
  useSearchParams: () => new URLSearchParams(mockSearchParams),
  useRouter: () => ({ push: mockPush }),
}));

jest.mock('next/link', () => ({
  __esModule: true,
  default: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
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

const enviar = async (password: string, confirmacion = password) => {
  await userEvent.type(screen.getByPlaceholderText('Mínimo 8 caracteres'), password);
  await userEvent.type(screen.getByPlaceholderText('Repite la contraseña'), confirmacion);
  fireEvent.submit(
    screen.getByRole('button', { name: /Restablecer contraseña/i }).closest('form')!
  );
};

describe('AUTHUI-008: política de contraseña en /reset-password', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSearchParams = 'token=tok-123';
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ success: true }),
    });
  });

  it('rechaza en el cliente una contraseña de menos de 8 caracteres, sin gastar un request', async () => {
    render(<ResetPasswordPage />);
    await enviar('abc123');

    await waitFor(() => {
      expect(screen.getByText('La contraseña debe tener al menos 8 caracteres')).toBeInTheDocument();
    });
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('exige mayúscula antes de llamar al API', async () => {
    render(<ResetPasswordPage />);
    await enviar('abcdefgh1');

    await waitFor(() => {
      expect(screen.getByText('Debe contener al menos una mayúscula')).toBeInTheDocument();
    });
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('exige número antes de llamar al API', async () => {
    render(<ResetPasswordPage />);
    await enviar('Abcdefgh');

    await waitFor(() => {
      expect(screen.getByText('Debe contener al menos un número')).toBeInTheDocument();
    });
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('sigue exigiendo que ambas contraseñas coincidan', async () => {
    render(<ResetPasswordPage />);
    await enviar('Abcdefgh1', 'Abcdefgh2');

    await waitFor(() => {
      expect(screen.getByText('Las contraseñas no coinciden')).toBeInTheDocument();
    });
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('con una contraseña que cumple la política sí llama a /api/auth/reset-password', async () => {
    render(<ResetPasswordPage />);
    await enviar('Abcdefgh1');

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        '/api/auth/reset-password',
        expect.objectContaining({ method: 'POST' })
      );
    });
    const [, opciones] = mockFetch.mock.calls[0];
    expect(JSON.parse(opciones.body)).toEqual({ token: 'tok-123', password: 'Abcdefgh1' });
  });

  it('los dos campos exigen 8 caracteres también en la validación nativa', () => {
    render(<ResetPasswordPage />);
    expect(screen.getByPlaceholderText('Mínimo 8 caracteres')).toHaveAttribute('minLength', '8');
    expect(screen.getByPlaceholderText('Repite la contraseña')).toHaveAttribute('minLength', '8');
  });

  it('sin token sigue ofreciendo pedir un enlace nuevo', () => {
    mockSearchParams = '';
    render(<ResetPasswordPage />);
    expect(screen.getByRole('link', { name: /Solicitar nuevo enlace/i })).toHaveAttribute(
      'href',
      '/forgot-password'
    );
  });
});
