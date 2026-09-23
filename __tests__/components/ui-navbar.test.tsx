/**
 * RUTA: __tests__/components/ui-navbar.test.tsx
 *
 * Auditoría UI (septiembre 2026) — Navbar. Tests de COMPORTAMIENTO: montan el
 * componente real con /api/auth/me simulado.
 *
 * Cubren:
 *  - UI-005: iniciales con nombres mal formados (no "AUNDEFINED", no TypeError).
 *  - UI-007: rol 'vendor' con enlace, etiqueta de panel y etiqueta de rol.
 *  - UI-018: si el logout falla, la sesión NO se da por cerrada.
 *  - UI-004: la sesión se revalida con el evento global, sin cambiar de ruta.
 *  - UI-019/UI-021: cierre con Escape y atributos de menú accesibles.
 */
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import Navbar from '@/components/commons/Navbar';
import { AUTH_REFRESH_EVENT } from '@/lib/auth-events';

const mockPush = jest.fn();
const mockRefresh = jest.fn();

jest.mock('next/navigation', () => ({
  usePathname: () => '/',
  useRouter: () => ({ push: mockPush, refresh: mockRefresh }),
}));

// La campanita hace polling propio; aquí sólo estorba.
jest.mock('@/components/shared/NotificationBell', () => ({
  __esModule: true,
  default: () => null,
}));

type UsuarioApi = {
  id: number;
  email: string;
  role: string;
  nombre?: string;
  credits?: number;
};

const mockFetch = jest.fn();

/** Deja /api/auth/me devolviendo este usuario y el logout con el ok indicado. */
function simularSesion(usuario: UsuarioApi | null, logoutOk = true) {
  mockFetch.mockImplementation((url: string) => {
    const ruta = String(url);

    if (ruta.includes('/api/auth/me')) {
      return Promise.resolve({
        ok: true,
        json: async () => ({ success: Boolean(usuario), user: usuario }),
      });
    }

    if (ruta.includes('/api/auth/logout')) {
      return Promise.resolve({ ok: logoutOk, json: async () => ({}) });
    }

    return Promise.resolve({ ok: true, json: async () => ({}) });
  });
}

/** Cuenta cuántas veces se consultó la sesión. */
const llamadasAMe = () =>
  mockFetch.mock.calls.filter((args) => String(args[0]).includes('/api/auth/me'))
    .length;

/** Abre el menú del avatar y lo devuelve. */
async function abrirMenuDeCuenta() {
  const boton = await screen.findByLabelText(/Menú de cuenta de/i);
  fireEvent.click(boton);
  return boton;
}

beforeEach(() => {
  jest.clearAllMocks();
  global.fetch = mockFetch as unknown as typeof fetch;
});

describe('UI-005: iniciales del avatar con nombres mal formados', () => {
  it('"Ana " (espacio final) da "AN", no "AUNDEFINED"', async () => {
    simularSesion({ id: 1, email: 'ana@inakat.com', role: 'candidate', nombre: 'Ana ' });

    render(<Navbar />);

    expect(await screen.findByText('AN')).toBeInTheDocument();
    expect(screen.queryByText(/UNDEFINED/i)).not.toBeInTheDocument();
  });

  it('"Juan  Carlos" (doble espacio) da "JC"', async () => {
    simularSesion({
      id: 2,
      email: 'juan@inakat.com',
      role: 'candidate',
      nombre: 'Juan  Carlos',
    });

    render(<Navbar />);

    expect(await screen.findByText('JC')).toBeInTheDocument();
  });

  it('" " (sólo espacios) no rompe el render: cae al email', async () => {
    simularSesion({ id: 3, email: 'zoe@inakat.com', role: 'candidate', nombre: '  ' });

    render(<Navbar />);

    // Antes: undefined + undefined = NaN -> NaN.toUpperCase() lanzaba y tumbaba
    // la app entera, porque el Navbar vive en el layout raíz.
    expect(await screen.findByText('ZO')).toBeInTheDocument();
  });
});

describe('UI-007: el rol vendor tiene panel propio en el menú', () => {
  const vendedor = {
    id: 9,
    email: 'vendedor@inakat.com',
    role: 'vendor',
    nombre: 'Vera Vega',
  };

  it('el enlace de Dashboard apunta a /vendor/dashboard y no a "/"', async () => {
    simularSesion(vendedor);

    render(<Navbar />);
    await abrirMenuDeCuenta();

    const enlace = await screen.findByRole('link', { name: /Panel Vendedor/i });
    expect(enlace).toHaveAttribute('href', '/vendor/dashboard');
  });

  it('muestra la etiqueta de rol "Vendedor" (antes quedaba vacía)', async () => {
    simularSesion(vendedor);

    render(<Navbar />);
    await abrirMenuDeCuenta();

    expect(await screen.findByText('Vendedor')).toBeInTheDocument();
  });

  it('no duplica el enlace: sólo hay uno hacia /vendor/dashboard', async () => {
    simularSesion(vendedor);

    render(<Navbar />);
    await abrirMenuDeCuenta();

    const enlaces = await screen.findAllByRole('link', { name: /Panel Vendedor/i });
    expect(enlaces).toHaveLength(1);
  });
});

describe('UI-018: logout fallido no debe simular que la sesión se cerró', () => {
  const usuario = {
    id: 4,
    email: 'empresa@inakat.com',
    role: 'company',
    nombre: 'Empresa Demo',
    credits: 10,
  };

  it('si el servidor responde !ok, no redirige y avisa del error', async () => {
    simularSesion(usuario, false);

    render(<Navbar />);
    await abrirMenuDeCuenta();

    fireEvent.click(await screen.findByRole('button', { name: /Cerrar Sesión/i }));

    // La cookie es httpOnly: si el servidor no la borró, la sesión sigue viva.
    await screen.findByRole('alert');
    expect(mockPush).not.toHaveBeenCalled();
    expect(mockRefresh).not.toHaveBeenCalled();
  });

  it('si el servidor responde ok, sí redirige al inicio', async () => {
    simularSesion(usuario, true);

    render(<Navbar />);
    await abrirMenuDeCuenta();

    fireEvent.click(await screen.findByRole('button', { name: /Cerrar Sesión/i }));

    await waitFor(() => expect(mockPush).toHaveBeenCalledWith('/'));
  });
});

describe('UI-004: la sesión se revalida sin cambiar de ruta', () => {
  it('el evento global inakat:auth-refresh vuelve a consultar /api/auth/me', async () => {
    simularSesion({
      id: 5,
      email: 'empresa@inakat.com',
      role: 'company',
      nombre: 'Empresa Demo',
      credits: 10,
    });

    render(<Navbar />);
    await screen.findByLabelText(/Menú de cuenta de/i);

    const antes = llamadasAMe();

    // Lo que dispara una pantalla tras publicar una vacante o guardar el perfil.
    fireEvent(window, new Event(AUTH_REFRESH_EVENT));

    await waitFor(() => expect(llamadasAMe()).toBeGreaterThan(antes));
  });

  it('recuperar el foco de la pestaña también revalida', async () => {
    simularSesion({ id: 6, email: 'empresa@inakat.com', role: 'company' });

    render(<Navbar />);
    await screen.findByLabelText(/Menú de cuenta de/i);

    const antes = llamadasAMe();
    fireEvent(window, new Event('focus'));

    await waitFor(() => expect(llamadasAMe()).toBeGreaterThan(antes));
  });
});

describe('UI-006: el menú de escritorio sólo aparece cuando cabe', () => {
  it('hamburguesa y drawer hasta lg; la lista de escritorio desde lg', async () => {
    simularSesion(null);

    const { container } = render(<Navbar />);

    const boton = await screen.findByLabelText('Abrir menú');
    expect(boton.className).toMatch(/(^|\s)lg:hidden(\s|$)/);
    expect(boton.className).not.toMatch(/(^|\s)md:hidden(\s|$)/);

    const listaEscritorio = container.querySelector('nav > div > ul');
    expect(listaEscritorio?.className).toMatch(/(^|\s)hidden lg:flex(\s|$)/);
    expect(listaEscritorio?.className).not.toMatch(/md:flex/);

    fireEvent.click(boton);
    const drawer = container.querySelector('#menu-movil');
    expect(drawer?.className).toMatch(/(^|\s)lg:hidden(\s|$)/);
  });

  it('los enlaces no se parten en dos renglones', async () => {
    simularSesion(null);

    render(<Navbar />);

    const sobreNosotros = screen.getAllByRole('link', { name: 'SOBRE NOSOTROS' })[0];
    expect(sobreNosotros.className).toMatch(/whitespace-nowrap/);

    const login = await screen.findAllByRole('link', { name: 'Iniciar Sesión' });
    expect(login[0].className).toMatch(/whitespace-nowrap/);
  });
});

describe('UI-019 / UI-021: menús accesibles y que se cierran', () => {
  it('el botón hamburguesa expone estado y etiqueta en español', async () => {
    simularSesion(null);

    render(<Navbar />);

    const boton = await screen.findByLabelText('Abrir menú');
    expect(boton).toHaveAttribute('aria-expanded', 'false');
    expect(boton).toHaveAttribute('aria-controls', 'menu-movil');

    fireEvent.click(boton);

    const abierto = await screen.findByLabelText('Cerrar menú');
    expect(abierto).toHaveAttribute('aria-expanded', 'true');
  });

  it('Escape cierra el menú móvil', async () => {
    simularSesion(null);

    render(<Navbar />);

    fireEvent.click(await screen.findByLabelText('Abrir menú'));
    await screen.findByLabelText('Cerrar menú');

    fireEvent.keyDown(document, { key: 'Escape' });

    await screen.findByLabelText('Abrir menú');
  });

  it('el botón del avatar anuncia que abre un menú y si está abierto', async () => {
    simularSesion({ id: 7, email: 'ana@inakat.com', role: 'candidate', nombre: 'Ana Ruiz' });

    render(<Navbar />);

    const boton = await screen.findByLabelText(/Menú de cuenta de/i);
    expect(boton).toHaveAttribute('aria-haspopup', 'menu');
    expect(boton).toHaveAttribute('aria-expanded', 'false');

    fireEvent.click(boton);
    await waitFor(() => expect(boton).toHaveAttribute('aria-expanded', 'true'));

    fireEvent.keyDown(document, { key: 'Escape' });
    await waitFor(() => expect(boton).toHaveAttribute('aria-expanded', 'false'));
  });

  it('marca con aria-current el enlace de la ruta actual', async () => {
    simularSesion(null);

    render(<Navbar />);

    // usePathname está simulado en '/': sólo INICIO debe ir marcado.
    const inicio = screen.getAllByRole('link', { name: 'INICIO' })[0];
    expect(inicio).toHaveAttribute('aria-current', 'page');

    const contacto = screen.getAllByRole('link', { name: 'CONTACTO' })[0];
    expect(contacto).not.toHaveAttribute('aria-current');
  });
});
