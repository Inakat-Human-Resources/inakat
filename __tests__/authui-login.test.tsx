// Tests de la auditoría 2026-09, módulo AUTHUI (páginas de acceso).
// Cubre: AUTHUI-001 (?redirect ignorado / open redirect), AUTHUI-002 (errors[]
// del API descartados), AUTHUI-011 (rol vendor) y AUTHUI-020 (doble submit).
//
// El destino tras el login se resuelve asignando window.location.href, que jsdom
// no deja observar (location es unforgeable: no se puede redefinir ni espiar).
// Por eso la lógica de destino se prueba extrayendo su bloque del código y
// evaluándolo: las aserciones miran el RESULTADO de la función, no el texto.

import fs from 'fs';
import path from 'path';
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import LoginPage from '@/app/login/page';
import UnauthorizedPage from '@/app/unauthorized/page';

let mockSearchParams = '';

jest.mock('next/navigation', () => ({
  useSearchParams: () => new URLSearchParams(mockSearchParams),
}));

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

// ============================================================
// AUTHUI-001 / AUTHUI-011 — destino tras iniciar sesión
// ============================================================

/** Extrae y evalúa el bloque de resolución de destino del login. */
const cargarDestinoTrasLogin = (): ((rol: string, redirect: string | null) => string) => {
  const fuente = fs.readFileSync(path.join(process.cwd(), 'src/app/login/page.tsx'), 'utf-8');
  const inicio = fuente.indexOf('// === INICIO destino-tras-login ===');
  const fin = fuente.indexOf('// === FIN destino-tras-login ===');
  if (inicio === -1 || fin === -1 || fin <= inicio) {
    throw new Error('No se encontró el bloque destino-tras-login en src/app/login/page.tsx');
  }
  const js = fuente
    .slice(inicio, fin)
    .replace(/:\s*Record<string, string\[\]>/g, '')
    .replace(/:\s*Record<string, string>/g, '')
    .replace(/:\s*string \| null/g, '')
    .replace(/:\s*string/g, '');
  // eslint-disable-next-line @typescript-eslint/no-implied-eval
  return new Function(`${js}\nreturn destinoTrasLogin;`)();
};

describe('AUTHUI-001/011: destino tras iniciar sesión', () => {
  const destinoTrasLogin = cargarDestinoTrasLogin();

  it('manda a cada rol a su panel cuando no hay ?redirect', () => {
    expect(destinoTrasLogin('admin', null)).toBe('/admin/requests');
    expect(destinoTrasLogin('company', null)).toBe('/company/dashboard');
    expect(destinoTrasLogin('recruiter', null)).toBe('/recruiter/dashboard');
    expect(destinoTrasLogin('specialist', null)).toBe('/specialist/dashboard');
    expect(destinoTrasLogin('candidate', null)).toBe('/talents');
    expect(destinoTrasLogin('user', null)).toBe('/talents');
  });

  it('AUTHUI-011: el rol vendor llega a su panel y no al buscador de vacantes', () => {
    expect(destinoTrasLogin('vendor', null)).toBe('/vendor/dashboard');
  });

  it('un rol desconocido cae en /talents', () => {
    expect(destinoTrasLogin('marciano', null)).toBe('/talents');
  });

  it('respeta el deep-link cuando el prefijo corresponde al rol', () => {
    expect(destinoTrasLogin('admin', '/admin/direct-applications')).toBe('/admin/direct-applications');
    expect(destinoTrasLogin('company', '/company/jobs/12/candidates')).toBe('/company/jobs/12/candidates');
    expect(destinoTrasLogin('candidate', '/my-applications')).toBe('/my-applications');
    expect(destinoTrasLogin('recruiter', '/recruiter/dashboard?tab=2')).toBe('/recruiter/dashboard?tab=2');
  });

  it('descarta el deep-link de un área que el rol no puede ver', () => {
    expect(destinoTrasLogin('company', '/admin/requests')).toBe('/company/dashboard');
    expect(destinoTrasLogin('candidate', '/company/dashboard')).toBe('/talents');
    expect(destinoTrasLogin('recruiter', '/specialist/dashboard')).toBe('/recruiter/dashboard');
  });

  it('no confunde un prefijo con otro que empiece igual', () => {
    expect(destinoTrasLogin('company', '/companyevil')).toBe('/company/dashboard');
    expect(destinoTrasLogin('admin', '/adminis/trador')).toBe('/admin/requests');
  });

  it('bloquea el open redirect en todas sus formas', () => {
    for (const hostil of [
      '//evil.com',
      '/\\evil.com',
      'https://evil.com',
      'http://evil.com/admin',
      '/admin/x\n/evil',
      '/admin/ x',
      'javascript:alert(1)',
      '',
    ]) {
      expect(destinoTrasLogin('admin', hostil)).toBe('/admin/requests');
    }
  });
});

// ============================================================
// AUTHUI-002 — errores de validación del API
// ============================================================

describe('LoginPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSearchParams = '';
  });

  it('AUTHUI-002: muestra el mensaje de errors[] cuando el API no manda `error`', async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 400,
      json: async () => ({
        success: false,
        errors: [
          { field: 'password', message: 'La contraseña debe tener al menos 8 caracteres' },
        ],
      }),
    });

    render(<LoginPage />);

    await userEvent.type(screen.getByPlaceholderText('tu@email.com'), 'juan@test.com');
    await userEvent.type(screen.getByPlaceholderText('••••••••'), 'corta1');
    fireEvent.submit(screen.getByRole('button', { name: /INGRESAR/i }).closest('form')!);

    await waitFor(() => {
      expect(
        screen.getAllByText('La contraseña debe tener al menos 8 caracteres').length
      ).toBeGreaterThan(0);
    });
    // No debe caer en el genérico que tapaba el motivo real.
    expect(screen.queryByText('Error al iniciar sesión')).not.toBeInTheDocument();
  });

  it('AUTHUI-002: sigue mostrando `error` cuando el API sí lo manda (401)', async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 401,
      json: async () => ({ success: false, error: 'Credenciales inválidas' }),
    });

    render(<LoginPage />);

    await userEvent.type(screen.getByPlaceholderText('tu@email.com'), 'juan@test.com');
    await userEvent.type(screen.getByPlaceholderText('••••••••'), 'Password123');
    fireEvent.submit(screen.getByRole('button', { name: /INGRESAR/i }).closest('form')!);

    await waitFor(() => {
      expect(screen.getAllByText('Credenciales inválidas').length).toBeGreaterThan(0);
    });
  });

  it('AUTHUI-020: tras un login correcto el botón NO se reactiva (se espera la redirección)', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ success: true, user: { id: 1, role: 'candidate' } }),
    });

    render(<LoginPage />);

    await userEvent.type(screen.getByPlaceholderText('tu@email.com'), 'juan@test.com');
    await userEvent.type(screen.getByPlaceholderText('••••••••'), 'Password123');
    fireEvent.submit(screen.getByRole('button', { name: /INGRESAR/i }).closest('form')!);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /INGRESANDO/i })).toBeDisabled();
    });
  });

  it('AUTHUI-020: dos envíos seguidos sólo disparan un POST a /api/auth/login', async () => {
    let resolver: ((valor: unknown) => void) | null = null;
    mockFetch.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolver = resolve;
        })
    );

    render(<LoginPage />);

    await userEvent.type(screen.getByPlaceholderText('tu@email.com'), 'juan@test.com');
    await userEvent.type(screen.getByPlaceholderText('••••••••'), 'Password123');

    const form = screen.getByRole('button', { name: /INGRESAR/i }).closest('form')!;
    fireEvent.submit(form);
    fireEvent.submit(form);

    expect(mockFetch).toHaveBeenCalledTimes(1);

    await waitFor(() => expect(resolver).not.toBeNull());
    resolver!({ ok: true, status: 200, json: async () => ({ success: true, user: { role: 'candidate' } }) });
    await waitFor(() => expect(mockFetch).toHaveBeenCalledTimes(1));
  });
});

// ============================================================
// AUTHUI-001 — /unauthorized propaga el deep-link al login
// ============================================================

describe('AUTHUI-001: /unauthorized y el parámetro redirect', () => {
  const hrefDelLogin = () =>
    (screen.getByRole('link', { name: /Iniciar Sesión/i }) as HTMLAnchorElement).getAttribute('href');

  it('propaga ?redirect cuando falta la sesión (no-token)', () => {
    mockSearchParams = 'reason=no-token&redirect=/company/jobs/12/candidates';
    render(<UnauthorizedPage />);
    expect(hrefDelLogin()).toBe('/login?redirect=%2Fcompany%2Fjobs%2F12%2Fcandidates');
  });

  it('propaga ?redirect cuando la sesión expiró', () => {
    mockSearchParams = 'reason=expired&redirect=/admin/direct-applications';
    render(<UnauthorizedPage />);
    expect(hrefDelLogin()).toBe('/login?redirect=%2Fadmin%2Fdirect-applications');
  });

  it('NO lo propaga cuando el usuario ya tiene sesión y le falta el permiso', () => {
    mockSearchParams = 'reason=no-permission&redirect=/admin/requests';
    render(<UnauthorizedPage />);
    expect(hrefDelLogin()).toBe('/login');
  });

  it('descarta un redirect externo (open redirect)', () => {
    for (const hostil of ['//evil.com', 'https://evil.com', '/\\evil.com']) {
      mockSearchParams = `reason=no-token&redirect=${encodeURIComponent(hostil)}`;
      const { unmount } = render(<UnauthorizedPage />);
      expect(hrefDelLogin()).toBe('/login');
      unmount();
    }
  });

  it('sin parámetros deja el enlace de siempre', () => {
    mockSearchParams = '';
    render(<UnauthorizedPage />);
    expect(hrefDelLogin()).toBe('/login');
  });
});
