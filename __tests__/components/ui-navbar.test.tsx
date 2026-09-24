/**
 * RUTA: __tests__/components/ui-navbar.test.tsx
 *
 * Auditoría UI (septiembre 2026) — navegación. Tests de COMPORTAMIENTO: montan
 * los componentes reales con /api/auth/me simulado.
 *
 * El Navbar único se partió en dos (sistema de diseño, septiembre 2026):
 *  - PublicNav (src/components/commons/PublicNav.tsx): la barra del sitio público;
 *  - AppShell (src/components/ui/AppShell.tsx): el armazón de la aplicación,
 *    con la navegación por rol, la tarjeta del usuario y «Cerrar sesión».
 * Las intenciones de siempre se prueban donde viven ahora:
 *  - UI-005: iniciales con nombres mal formados (no "AUNDEFINED", no TypeError).
 *  - UI-007: rol 'vendor' con su panel, etiqueta de rol y sin enlaces duplicados.
 *  - UI-018: si el logout falla, la sesión NO se da por cerrada.
 *  - UI-004: la sesión se revalida con el evento global y al recuperar el foco.
 *  - UI-006: el menú de escritorio sólo aparece cuando cabe (desde lg).
 *  - UI-019/UI-021: menús con estado accesible, Escape y aria-current.
 */
import React from 'react';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import '@testing-library/jest-dom';
import PublicNav from '@/components/commons/PublicNav';
import AppShell from '@/components/ui/AppShell';
import { AUTH_REFRESH_EVENT } from '@/lib/auth-events';

const mockPush = jest.fn();
const mockRefresh = jest.fn();
let mockRuta = '/';

jest.mock('next/navigation', () => ({
  usePathname: () => mockRuta,
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
  mockFetch.mock.calls.filter((args) => String(args[0]).includes('/api/auth/me')).length;

const armazon = () =>
  render(
    <AppShell>
      <p>Contenido de la página</p>
    </AppShell>
  );

/** La barra lateral de escritorio (el <aside> de la navegación del panel). */
const lateral = () => screen.getByRole('complementary', { name: 'Navegación del panel' });

beforeEach(() => {
  jest.clearAllMocks();
  mockRuta = '/';
  global.fetch = mockFetch as unknown as typeof fetch;
});

describe('UI-005: iniciales del avatar con nombres mal formados', () => {
  beforeEach(() => {
    mockRuta = '/my-applications';
  });

  it('"Ana " (espacio final) da "AN", no "AUNDEFINED"', async () => {
    simularSesion({ id: 1, email: 'ana@inakat.com', role: 'candidate', nombre: 'Ana ' });

    armazon();

    expect(await screen.findByText('AN')).toBeInTheDocument();
    expect(screen.queryByText(/UNDEFINED/i)).not.toBeInTheDocument();
  });

  it('"Juan  Carlos" (doble espacio) da "JC"', async () => {
    simularSesion({ id: 2, email: 'juan@inakat.com', role: 'candidate', nombre: 'Juan  Carlos' });

    armazon();

    expect(await screen.findByText('JC')).toBeInTheDocument();
  });

  it('" " (sólo espacios) no rompe el render: cae al email', async () => {
    simularSesion({ id: 3, email: 'zoe@inakat.com', role: 'candidate', nombre: '  ' });

    armazon();

    // Antes: undefined + undefined = NaN -> NaN.toUpperCase() lanzaba y tumbaba
    // la app entera, porque la navegación vive en un layout.
    expect(await screen.findByText('ZO')).toBeInTheDocument();
  });
});

describe('UI-007: el rol vendor tiene panel propio', () => {
  const vendedor = {
    id: 9,
    email: 'vendedor@inakat.com',
    role: 'vendor',
    nombre: 'Vera Vega',
  };

  beforeEach(() => {
    mockRuta = '/vendor/dashboard';
  });

  it('su navegación lleva a /vendor/dashboard y no a "/"', async () => {
    simularSesion(vendedor);

    armazon();

    const enlace = await within(lateral()).findByRole('link', { name: /Panel vendedor/i });
    expect(enlace).toHaveAttribute('href', '/vendor/dashboard');
    expect(enlace).toHaveAttribute('aria-current', 'page');
  });

  it('muestra la etiqueta de rol "Vendedor" (antes quedaba vacía)', async () => {
    simularSesion(vendedor);

    armazon();

    expect(await within(lateral()).findByText('Vendedor')).toBeInTheDocument();
  });

  it('no duplica el enlace: sólo hay uno hacia su panel', async () => {
    simularSesion(vendedor);

    armazon();

    const enlaces = await within(lateral()).findAllByRole('link', { name: /Panel vendedor/i });
    expect(enlaces).toHaveLength(1);
  });

  it('en el sitio público, «Ir a mi panel» lo lleva a /vendor/dashboard', async () => {
    mockRuta = '/';
    simularSesion(vendedor);

    render(<PublicNav />);

    const enlace = await screen.findByRole('link', { name: /Ir a mi panel/i });
    expect(enlace).toHaveAttribute('href', '/vendor/dashboard');
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

  beforeEach(() => {
    mockRuta = '/company/dashboard';
  });

  it('si el servidor responde !ok, no redirige y avisa del error', async () => {
    simularSesion(usuario, false);

    armazon();

    fireEvent.click(await within(lateral()).findByRole('button', { name: /Cerrar sesión/i }));

    // La cookie es httpOnly: si el servidor no la borró, la sesión sigue viva.
    expect(await screen.findByRole('alert')).toHaveTextContent(/No se pudo cerrar la sesión/);
    expect(mockPush).not.toHaveBeenCalled();
    expect(mockRefresh).not.toHaveBeenCalled();
  });

  it('si el servidor responde ok, sí redirige al inicio', async () => {
    simularSesion(usuario, true);

    armazon();

    fireEvent.click(await within(lateral()).findByRole('button', { name: /Cerrar sesión/i }));

    await waitFor(() => expect(mockPush).toHaveBeenCalledWith('/'));
  });

  it('la empresa ve su saldo de créditos en la cabecera', async () => {
    simularSesion(usuario);

    armazon();

    const saldo = await screen.findByRole('link', { name: /10\s*créditos/i });
    expect(saldo).toHaveAttribute('href', '/credits/purchase');
  });
});

describe('UI-004: la sesión se revalida sin cambiar de ruta', () => {
  it('el evento global inakat:auth-refresh vuelve a consultar /api/auth/me', async () => {
    mockRuta = '/company/dashboard';
    simularSesion({ id: 5, email: 'empresa@inakat.com', role: 'company', nombre: 'Empresa Demo', credits: 10 });

    armazon();
    await within(lateral()).findByText('Empresa Demo');

    const antes = llamadasAMe();

    // Lo que dispara una pantalla tras publicar una vacante o guardar el perfil.
    fireEvent(window, new Event(AUTH_REFRESH_EVENT));

    await waitFor(() => expect(llamadasAMe()).toBeGreaterThan(antes));
  });

  it('recuperar el foco de la pestaña también revalida (también en el sitio público)', async () => {
    simularSesion({ id: 6, email: 'empresa@inakat.com', role: 'company' });

    render(<PublicNav />);
    await screen.findByRole('link', { name: /Ir a mi panel/i });

    const antes = llamadasAMe();
    fireEvent(window, new Event('focus'));

    await waitFor(() => expect(llamadasAMe()).toBeGreaterThan(antes));
  });
});

describe('UI-006: el menú de escritorio de la barra pública sólo aparece cuando cabe', () => {
  it('hamburguesa y cajón hasta lg; la lista de escritorio desde lg', async () => {
    simularSesion(null);

    const { container } = render(<PublicNav />);

    const boton = await screen.findByLabelText('Abrir menú');
    expect(boton.className).toMatch(/(^|\s)lg:hidden(\s|$)/);
    expect(boton.className).not.toMatch(/(^|\s)md:hidden(\s|$)/);

    const listaEscritorio = container.querySelector('nav > ul');
    expect(listaEscritorio?.className).toMatch(/(^|\s)hidden lg:flex(\s|$)/);
    expect(listaEscritorio?.className).not.toMatch(/md:flex/);

    fireEvent.click(boton);
    const cajon = container.querySelector('#menu-movil');
    expect(cajon?.className).toMatch(/(^|\s)lg:hidden(\s|$)/);
  });

  it('los enlaces y los botones no se parten en dos renglones', async () => {
    simularSesion(null);

    render(<PublicNav />);

    const sobreNosotros = screen.getAllByRole('link', { name: 'Sobre nosotros' })[0];
    expect(sobreNosotros.className).toMatch(/whitespace-nowrap/);

    const login = await screen.findAllByRole('link', { name: 'Iniciar sesión' });
    expect(login[0].className).toMatch(/whitespace-nowrap/);

    const registro = screen.getAllByRole('link', { name: 'Registra tu empresa' })[0];
    expect(registro.className).toMatch(/whitespace-nowrap/);
  });

  it('en las rutas de la aplicación no se pinta ni pide la sesión', () => {
    mockRuta = '/admin/users';
    simularSesion(null);

    const { container } = render(<PublicNav />);

    expect(container).toBeEmptyDOMElement();
    expect(llamadasAMe()).toBe(0);
  });
});

describe('UI-019 / UI-021: menús accesibles y que se cierran', () => {
  it('la hamburguesa pública expone estado y etiqueta en español', async () => {
    simularSesion(null);

    render(<PublicNav />);

    const boton = await screen.findByLabelText('Abrir menú');
    expect(boton).toHaveAttribute('aria-expanded', 'false');
    expect(boton).toHaveAttribute('aria-controls', 'menu-movil');

    fireEvent.click(boton);

    const abierto = await screen.findByLabelText('Cerrar menú');
    expect(abierto).toHaveAttribute('aria-expanded', 'true');
    const dialogo = screen.getByRole('dialog', { name: 'Menú' });
    expect(dialogo).toHaveAttribute('aria-modal', 'true');
    // El botón que cierra y los enlaces del cajón viven DENTRO del diálogo
    // modal: con aria-modal, lo de fuera no existe para el lector de pantalla
    // (y en móvil no hay Escape).
    expect(within(dialogo).getByRole('button', { name: 'Cerrar menú' })).toBe(abierto);
    expect(dialogo).toContainElement(document.getElementById('menu-movil'));
  });

  it('Escape cierra el cajón público', async () => {
    simularSesion(null);

    render(<PublicNav />);

    fireEvent.click(await screen.findByLabelText('Abrir menú'));
    await screen.findByLabelText('Cerrar menú');

    fireEvent.keyDown(document, { key: 'Escape' });

    await screen.findByLabelText('Abrir menú');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('el cajón del panel se abre con la hamburguesa y Escape lo cierra', async () => {
    mockRuta = '/admin';
    simularSesion({ id: 7, email: 'ana@inakat.com', role: 'admin', nombre: 'Ana Ruiz' });

    armazon();
    await within(lateral()).findByText('Ana Ruiz');

    const boton = screen.getByRole('button', { name: 'Abrir menú' });
    expect(boton).toHaveAttribute('aria-expanded', 'false');

    fireEvent.click(boton);
    const cajon = await screen.findByRole('dialog', { name: 'Menú del panel' });
    expect(cajon).toHaveAttribute('aria-modal', 'true');
    expect(boton).toHaveAttribute('aria-expanded', 'true');

    fireEvent.keyDown(document, { key: 'Escape' });
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });

  it('marca con aria-current el enlace público de la ruta actual', async () => {
    simularSesion(null);

    render(<PublicNav />);

    // usePathname está simulado en '/': sólo Inicio debe ir marcado.
    const inicio = screen.getAllByRole('link', { name: 'Inicio' })[0];
    expect(inicio).toHaveAttribute('aria-current', 'page');

    const contacto = screen.getAllByRole('link', { name: 'Contacto' })[0];
    expect(contacto).not.toHaveAttribute('aria-current');
  });

  it('en el panel marca el ítem más específico: /admin/users es «Usuarios», no «Vista general»', async () => {
    mockRuta = '/admin/users';
    simularSesion({ id: 8, email: 'ana@inakat.com', role: 'admin', nombre: 'Ana Ruiz' });

    armazon();

    const usuarios = await within(lateral()).findByRole('link', { name: 'Usuarios' });
    expect(usuarios).toHaveAttribute('aria-current', 'page');
    expect(within(lateral()).getByRole('link', { name: 'Vista general' })).not.toHaveAttribute('aria-current');
  });
});

describe('AppShell: salidas que el menú antiguo ofrecía', () => {
  it('con sesión, la barra lateral enlaza al sitio público (Inicio, Empresas, Talentos…)', async () => {
    mockRuta = '/company/dashboard';
    simularSesion({ id: 5, email: 'empresa@inakat.com', role: 'company', nombre: 'Empresa Demo', credits: 3 });

    armazon();

    await within(lateral()).findByText('Empresa Demo');
    expect(within(lateral()).getByRole('link', { name: /Ir al sitio público/i })).toHaveAttribute('href', '/');
  });

  it('si la sesión caducó con la pestaña abierta, lo dice y ofrece entrar (no un esqueleto eterno)', async () => {
    mockRuta = '/admin';
    simularSesion(null);

    armazon();

    expect(await within(lateral()).findByText(/Tu sesión terminó/i)).toBeInTheDocument();
    expect(within(lateral()).getByRole('link', { name: /Iniciar sesión/i })).toHaveAttribute('href', '/login');
    // Sin sesión no hay campanita ni saldo que pintar.
    expect(screen.queryByRole('link', { name: /créditos/i })).not.toBeInTheDocument();
  });
});
